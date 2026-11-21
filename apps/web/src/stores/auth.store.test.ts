import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Lịch sử đăng nhập (CR-019): `auth.store` ghi đúng sự kiện qua RPC `log_login` (khách mới, đăng
 * nhập / liên kết Google, mở lại phiên, đăng xuất) và quay về đúng màn sau khi đi Google (Tài khoản
 * hay trang quản trị). Supabase là client giả; `location`, `history`, `sessionStorage` là bản giả.
 */

interface FakeSession {
  access_token: string;
  user: { id: string; is_anonymous: boolean; email?: string };
}

interface RpcCall {
  name: string;
  args: Record<string, unknown>;
  headers: Record<string, string>;
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, String(value));
    },
  };
}

const GOOGLE: FakeSession = {
  access_token: "tok-google",
  user: { id: "u-google", is_anonymous: false, email: "a@b.c" },
};
const GUEST: FakeSession = {
  access_token: "tok-guest",
  user: { id: "u-guest", is_anonymous: true },
};

let session: FakeSession | null = null;
let rpcCalls: RpcCall[] = [];
/** Lỗi RPC giả theo tên hàm (vd. `delete_my_data` → `last-admin`). */
let rpcErrors: Record<string, { message: string; code: string }> = {};
let storage: Storage;
/** Hàng `profiles` của người đang đăng nhập (null = chưa có) và các lần upsert. */
let profileRow: Record<string, unknown> | null = null;
let upserts: Record<string, unknown>[] = [];

const auth = {
  getSession: vi.fn(async () => ({ data: { session } })),
  onAuthStateChange: vi.fn(),
  signInAnonymously: vi.fn(async () => {
    session = GUEST;
    return { data: { session: GUEST }, error: null };
  }),
  signInWithOAuth: vi.fn(async (_opts: unknown) => ({ error: null })),
  linkIdentity: vi.fn(async (_opts: unknown) => ({ error: null })),
  signOut: vi.fn(async () => {
    session = null;
    return { error: null };
  }),
};

/** RPC giả kiểu PostgrestBuilder: `setHeader` rồi `await` mới gửi. */
function rpc(name: string, args: Record<string, unknown>) {
  const headers: Record<string, string> = {};
  const call = {
    setHeader(key: string, value: string) {
      headers[key] = value;
      return call;
    },
    // biome-ignore lint/suspicious/noThenProperty: giả lập PostgrestBuilder (thenable) của supabase-js
    then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
      rpcCalls.push({ name, args, headers });
      return Promise.resolve({ data: null, error: rpcErrors[name] ?? null }).then(resolve, reject);
    },
  };
  return call;
}

const sb = {
  auth,
  rpc: vi.fn(rpc),
  from: vi.fn(() => ({
    upsert: async (row: Record<string, unknown>) => {
      upserts.push(row);
      return { error: null };
    },
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: profileRow, error: null }) }),
    }),
  })),
};

async function load({ href = "http://app.test/", stored = true } = {}) {
  vi.resetModules();
  const url = new URL(href);
  vi.stubGlobal("sessionStorage", storage);
  vi.stubGlobal("location", { href: url.href, origin: url.origin, pathname: url.pathname });
  vi.stubGlobal("history", { state: null, replaceState: vi.fn() });
  vi.doMock("@/lib/supabase", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/supabase")>()),
    SUPABASE_CONFIGURED: true,
    hasStoredSession: () => stored,
    loadSupabase: async () => sb,
  }));
  return import("./auth.store");
}

const logged = () => rpcCalls.filter((c) => c.name === "log_login").map((c) => c.args.p_event);

describe("lịch sử đăng nhập (CR-019, RPC log_login)", { timeout: 30_000 }, () => {
  beforeEach(() => {
    session = null;
    rpcCalls = [];
    rpcErrors = {};
    storage = memoryStorage();
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.doUnmock("@/lib/supabase");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("mở lại app khi đã có phiên → session_resumed kèm nhãn thiết bị", async () => {
    session = GOOGLE;
    const { useAuth } = await load();
    useAuth.getState().init();
    await vi.waitFor(() => expect(logged()).toEqual(["session_resumed"]));
    expect(useAuth.getState().status).toBe("google");
    expect(typeof rpcCalls[0]?.args.p_device).toBe("string");
  });

  it("chưa có phiên lưu, không quay về từ Google → không ghi gì, không tải Supabase", async () => {
    const { useAuth } = await load({ stored: false });
    useAuth.getState().init();
    await new Promise((r) => setTimeout(r, 20));
    expect(useAuth.getState().status).toBe("signed-out");
    expect(rpcCalls).toEqual([]);
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("quay về từ Google sau khi liên kết → google_linked; đăng nhập → google_sign_in", async () => {
    session = GOOGLE;
    storage.setItem("brain-rizz:oauth-flow", "link");
    let mod = await load({ href: "http://app.test/?code=abc" });
    mod.useAuth.getState().init();
    await vi.waitFor(() => expect(logged()).toEqual(["google_linked"]));
    // Dấu luồng chỉ đọc một lần.
    expect(storage.getItem("brain-rizz:oauth-flow")).toBeNull();

    rpcCalls = [];
    storage.setItem("brain-rizz:oauth-flow", "signin");
    mod = await load({ href: "http://app.test/admin?code=abc" });
    mod.useAuth.getState().init();
    await vi.waitFor(() => expect(logged()).toEqual(["google_sign_in"]));
  });

  it("init gọi hai lần (StrictMode) → chỉ đọc phiên và ghi session_resumed một lần", async () => {
    session = GOOGLE;
    const { useAuth } = await load();
    const first = useAuth.getState().init();
    const second = useAuth.getState().init();
    expect(second).toBe(first);
    await Promise.all([first, second]);
    await new Promise((r) => setTimeout(r, 20));
    expect(logged()).toEqual(["session_resumed"]);
    expect(auth.getSession).toHaveBeenCalledTimes(1);
  });

  it("quay về sau khi liên kết Google, init hai lần → chỉ google_linked, không thêm google_sign_in", async () => {
    session = GOOGLE;
    storage.setItem("brain-rizz:oauth-flow", "link");
    const { useAuth } = await load({ href: "http://app.test/?code=abc" });
    useAuth.getState().init();
    useAuth.getState().init();
    await vi.waitFor(() => expect(logged()).toEqual(["google_linked"]));
    await new Promise((r) => setTimeout(r, 20));
    expect(logged()).toEqual(["google_linked"]);
    expect(storage.getItem("brain-rizz:oauth-flow")).toBeNull();
  });

  it("quay về từ Google mà phiên vẫn là khách (liên kết lỗi) → không ghi sự kiện Google", async () => {
    session = GUEST;
    storage.setItem("brain-rizz:oauth-flow", "link");
    const { useAuth } = await load({ href: "http://app.test/?code=abc" });
    useAuth.getState().init();
    await vi.waitFor(() => expect(useAuth.getState().status).toBe("guest"));
    await new Promise((r) => setTimeout(r, 20));
    expect(logged()).toEqual([]);
  });

  it("tạo phiên khách lười → guest_created; đã có phiên thì không ghi lại", async () => {
    const { useAuth } = await load({ stored: false });
    await expect(useAuth.getState().ensureSession()).resolves.toBe("tok-guest");
    await vi.waitFor(() => expect(logged()).toEqual(["guest_created"]));
    await useAuth.getState().ensureSession();
    await new Promise((r) => setTimeout(r, 20));
    expect(logged()).toEqual(["guest_created"]);
  });

  it("đăng xuất → sign_out gắn token của phiên sắp bỏ, vẫn đăng xuất trên máy", async () => {
    session = GOOGLE;
    const { useAuth } = await load();
    await useAuth.getState().signOut();
    await vi.waitFor(() => expect(logged()).toEqual(["sign_out"]));
    expect(rpcCalls[0]?.headers.Authorization).toBe("Bearer tok-google");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(useAuth.getState().status).toBe("signed-out");
  });

  it("đăng xuất khi không có phiên → không ghi sign_out", async () => {
    const { useAuth } = await load();
    await useAuth.getState().signOut();
    await new Promise((r) => setTimeout(r, 20));
    expect(logged()).toEqual([]);
    expect(useAuth.getState().status).toBe("signed-out");
  });
});

describe("xoá dữ liệu của tôi (RPC delete_my_data)", { timeout: 30_000 }, () => {
  beforeEach(() => {
    session = GOOGLE;
    rpcCalls = [];
    rpcErrors = {};
    storage = memoryStorage();
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.doUnmock("@/lib/supabase");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("xoá xong → deleted và đăng xuất trên máy", async () => {
    const { useAuth } = await load();
    await expect(useAuth.getState().deleteMyData()).resolves.toBe("deleted");
    expect(rpcCalls.map((c) => c.name)).toContain("delete_my_data");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(useAuth.getState().status).toBe("signed-out");
  });

  it("quản trị viên duy nhất (last-admin, P0001) → last-admin, không đăng xuất", async () => {
    rpcErrors.delete_my_data = { message: "last-admin", code: "P0001" };
    const { useAuth } = await load();
    useAuth.setState({ status: "google", userId: GOOGLE.user.id });
    await expect(useAuth.getState().deleteMyData()).resolves.toBe("last-admin");
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(useAuth.getState().status).toBe("google");
  });

  it("lỗi khác → failed", async () => {
    rpcErrors.delete_my_data = { message: "boom", code: "XX000" };
    const { useAuth } = await load();
    await expect(useAuth.getState().deleteMyData()).resolves.toBe("failed");
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});

describe("đi Google rồi quay về đúng màn (CR-019)", { timeout: 30_000 }, () => {
  beforeEach(() => {
    session = null;
    rpcCalls = [];
    rpcErrors = {};
    storage = memoryStorage();
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.doUnmock("@/lib/supabase");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("từ trang quản trị: về thẳng /admin, hiện bảng chọn tài khoản, không mở màn Tài khoản", async () => {
    const { useAuth, takeOAuthReturnScreen, ADMIN_PATH } = await load();
    await expect(
      useAuth.getState().signInGoogle({ returnTo: "admin", selectAccount: true }),
    ).resolves.toBe(true);
    const opts = auth.signInWithOAuth.mock.calls[0]?.[0] as {
      options: { redirectTo: string; queryParams?: Record<string, string> };
    };
    expect(opts.options.redirectTo).toBe(`http://app.test${ADMIN_PATH}`);
    expect(opts.options.queryParams).toEqual({ prompt: "select_account" });
    expect(storage.getItem("brain-rizz:oauth-flow")).toBe("signin");
    expect(takeOAuthReturnScreen()).toBe(false);
    expect(storage.getItem("brain-rizz:oauth-return")).toBeNull();
  });

  it("mặc định: về trang gốc rồi mở màn Tài khoản (một lần)", async () => {
    const { useAuth, takeOAuthReturnScreen } = await load();
    await useAuth.getState().signInGoogle();
    const opts = auth.signInWithOAuth.mock.calls[0]?.[0] as {
      options: { redirectTo: string; queryParams?: unknown };
    };
    expect(opts.options.redirectTo).toBe("http://app.test/");
    expect(opts.options.queryParams).toBeUndefined();
    expect(takeOAuthReturnScreen()).toBe(true);
    expect(takeOAuthReturnScreen()).toBe(false);
  });

  it("liên kết Google ghi luồng 'link'; lỗi thì xoá cả hai dấu", async () => {
    session = GUEST;
    const { useAuth } = await load();
    await expect(useAuth.getState().linkGoogle()).resolves.toBe(true);
    expect(storage.getItem("brain-rizz:oauth-flow")).toBe("link");
    expect(storage.getItem("brain-rizz:oauth-return")).toBe("account");

    auth.linkIdentity.mockResolvedValueOnce({ error: new Error("boom") } as never);
    await expect(useAuth.getState().linkGoogle()).resolves.toBe(false);
    expect(storage.getItem("brain-rizz:oauth-flow")).toBeNull();
    expect(storage.getItem("brain-rizz:oauth-return")).toBeNull();
  });
});

describe("hồ sơ theo tài khoản: kéo tên + nhân vật về khi có phiên Google", {
  timeout: 30_000,
}, () => {
  let local: Storage;
  beforeEach(() => {
    session = null;
    rpcCalls = [];
    rpcErrors = {};
    profileRow = null;
    upserts = [];
    storage = memoryStorage();
    local = memoryStorage();
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.doUnmock("@/lib/supabase");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Tải lại module với hồ sơ trên máy `saved` (localStorage giả). */
  async function loadWith(saved: Record<string, unknown> | null, opts?: { href?: string }) {
    if (saved) local.setItem("brain-rizz:profile", JSON.stringify(saved));
    vi.stubGlobal("localStorage", local);
    const mod = await load(opts);
    const profile = await import("@/lib/profile");
    return { ...mod, ...profile };
  }

  it("máy mới / đã xoá dữ liệu: tên tài khoản về hồ sơ trên máy, không bắt nhập lại", async () => {
    session = GOOGLE;
    profileRow = { display_name: "Hùng", avatar: "mochi" };
    const { useAuth, useProfile, loadProfile } = await loadWith(null, {
      href: "http://app.test/?code=abc",
    });
    void useAuth.getState().init();
    await vi.waitFor(() => expect(useProfile.getState().profile.name).toBe("Hùng"));
    expect(useProfile.getState().profile.avatar).toBe("mochi");
    expect(useProfile.getState().accountRev).toBe(1);
    expect(loadProfile().name).toBe("Hùng");
    expect(upserts).toEqual([]);
  });

  it("máy đang giữ tên của tài khoản khác → tên tài khoản thắng, giữ độ khó + phụ kiện", async () => {
    session = GOOGLE;
    profileRow = { display_name: "Hùng", avatar: "dragon" };
    const saved = {
      name: "Lan",
      colorIndex: 2,
      avatar: "op",
      difficulty: 3,
      accessories: ["crown"],
    };
    const { useAuth, useProfile } = await loadWith(saved);
    void useAuth.getState().init();
    await vi.waitFor(() => expect(useProfile.getState().profile.name).toBe("Hùng"));
    // Nhân vật lạ từ tài khoản → giữ nhân vật trên máy.
    expect(useProfile.getState().profile).toEqual({ ...saved, name: "Hùng" });
    // Màn mở từ trước (giá trị cũ "Lan") gọi đồng bộ → không đè tên tài khoản.
    await useAuth.getState().syncProfile({ name: "Lan", avatar: "op" });
    expect(upserts).toEqual([]);
  });

  it("tài khoản chưa có tên mà máy có → đẩy tên trên máy lên", async () => {
    session = GOOGLE;
    const { useAuth, useProfile } = await loadWith({ name: "Lan", avatar: "op" });
    void useAuth.getState().init();
    await vi.waitFor(() => expect(upserts).toHaveLength(1));
    expect(upserts[0]).toEqual({ id: "u-google", display_name: "Lan", avatar: "op" });
    expect(useProfile.getState().profile.name).toBe("Lan");
  });

  it("phiên khách → không kéo hồ sơ; đăng xuất không xoá tên trên máy", async () => {
    session = GUEST;
    profileRow = { display_name: "Khác", avatar: "khoi" };
    const { useAuth, useProfile } = await loadWith({ name: "Lan", avatar: "op" });
    await useAuth.getState().init();
    await new Promise((r) => setTimeout(r, 20));
    expect(useProfile.getState().profile.name).toBe("Lan");
    await useAuth.getState().signOut();
    expect(useProfile.getState().profile.name).toBe("Lan");
  });

  it("đổi sang tài khoản Google khác → hồ sơ theo tài khoản mới", async () => {
    session = GOOGLE;
    profileRow = { display_name: "Hùng", avatar: "mochi" };
    const { useAuth, useProfile } = await loadWith(null);
    void useAuth.getState().init();
    await vi.waitFor(() => expect(useProfile.getState().profile.name).toBe("Hùng"));
    profileRow = { display_name: "Mai", avatar: "lua" };
    useAuth.setState({ status: "google", userId: "u-google-2" });
    await vi.waitFor(() => expect(useProfile.getState().profile.name).toBe("Mai"));
    expect(useProfile.getState().profile.avatar).toBe("lua");
  });

  it("Supabase lỗi khi đọc hồ sơ → chỉ cảnh báo, giữ hồ sơ trên máy", async () => {
    session = GOOGLE;
    sb.from.mockImplementationOnce(() => {
      throw new Error("paused");
    });
    const { useAuth, useProfile } = await loadWith({ name: "Lan", avatar: "op" });
    await useAuth.getState().init();
    await vi.waitFor(() => expect(console.warn).toHaveBeenCalled());
    expect(useProfile.getState().profile.name).toBe("Lan");
  });

  /** Lần đọc `profiles` kế tiếp treo tới khi gọi `resolve(row)` (mô phỏng mạng chậm). */
  function holdNextProfileRead() {
    let resolve!: (row: Record<string, unknown> | null) => void;
    const pending = new Promise<{ data: Record<string, unknown> | null; error: null }>((r) => {
      resolve = (row) => r({ data: row, error: null });
    });
    sb.from.mockImplementationOnce(
      () =>
        ({
          select: () => ({ eq: () => ({ maybeSingle: () => pending }) }),
        }) as unknown as ReturnType<typeof sb.from>,
    );
    return (row: Record<string, unknown> | null) => resolve(row);
  }

  it("syncProfile gọi lúc đang kéo hồ sơ (giá trị cũ trên máy) → chờ kéo xong, không đè tên tài khoản", async () => {
    session = GOOGLE;
    const release = holdNextProfileRead();
    const { useAuth, useProfile } = await loadWith({ name: "Lan", avatar: "op" });
    await useAuth.getState().init();
    // Vd. ensureSession(profile) khi vào phòng, hồ sơ đọc trước khi tài khoản về tới.
    const sync = useAuth.getState().syncProfile({ name: "Lan", avatar: "op" });
    await new Promise((r) => setTimeout(r, 20));
    expect(upserts).toEqual([]);
    release({ display_name: "Hùng", avatar: "mochi" });
    await sync;
    await new Promise((r) => setTimeout(r, 20));
    expect(useProfile.getState().profile.name).toBe("Hùng");
    expect(upserts).toEqual([]);
  });

  it("người chơi sửa tên trong lúc đang kéo hồ sơ → bản vừa sửa thắng và được đẩy lên một lần", async () => {
    session = GOOGLE;
    const release = holdNextProfileRead();
    const { useAuth, useProfile, saveProfile, loadProfile } = await loadWith({
      name: "Lan",
      avatar: "op",
    });
    await useAuth.getState().init();
    // Như confirmProfile ở HomeScreen: lưu trước, đồng bộ sau.
    saveProfile({ ...loadProfile(), name: "Lan Mới" });
    const sync = useAuth.getState().syncProfile({ name: "Lan Mới", avatar: "op" });
    release({ display_name: "Hùng", avatar: "mochi" });
    await sync;
    await new Promise((r) => setTimeout(r, 20));
    expect(useProfile.getState().profile.name).toBe("Lan Mới");
    expect(upserts).toEqual([{ id: "u-google", display_name: "Lan Mới", avatar: "op" }]);
  });

  const failNextProfileCall = () =>
    sb.from.mockImplementationOnce(() => {
      throw new Error("paused");
    });
  const stored = () => JSON.parse(local.getItem("brain-rizz:profile") ?? "{}");

  it("kéo hồ sơ lỗi → syncProfile kéo lại trước; tài khoản có tên thì không đè", async () => {
    session = GOOGLE;
    profileRow = { display_name: "Hùng", avatar: "mochi" };
    failNextProfileCall();
    const { useAuth, useProfile } = await loadWith({ name: "Lan", avatar: "op" });
    await useAuth.getState().init();
    await vi.waitFor(() => expect(console.warn).toHaveBeenCalled());
    expect(useProfile.getState().profile.name).toBe("Lan");
    // Vd. ensureSession(profile) khi vào phòng: kéo lại được → tên tài khoản thắng, không đẩy "Lan".
    await useAuth.getState().syncProfile({ name: "Lan", avatar: "op" });
    expect(useProfile.getState().profile.name).toBe("Hùng");
    expect(upserts).toEqual([]);
  });

  it("kéo lại vẫn lỗi → không đẩy; lần sau kéo được thì xử lý bình thường", async () => {
    session = GOOGLE;
    failNextProfileCall();
    failNextProfileCall();
    const { useAuth } = await loadWith({ name: "Lan", avatar: "op" });
    await useAuth.getState().init();
    await vi.waitFor(() => expect(console.warn).toHaveBeenCalled());
    await useAuth.getState().syncProfile({ name: "Lan", avatar: "op" });
    expect(upserts).toEqual([]);
    // Tài khoản chưa có tên, hồ sơ trên máy chưa gắn ai → đẩy lên (không bị kẹt bởi lần lỗi trước).
    await useAuth.getState().syncProfile({ name: "Lan", avatar: "op" });
    await vi.waitFor(() => expect(upserts).toHaveLength(1));
    expect(stored().owner).toBe("u-google");
  });

  it("sửa tên tay lúc Supabase lỗi → dấu bền trên máy; lần tải sau kéo được thì bản sửa tay thắng", async () => {
    session = GOOGLE;
    profileRow = { display_name: "Hùng", avatar: "mochi" };
    failNextProfileCall();
    failNextProfileCall();
    let mod = await loadWith({ name: "Hùng", avatar: "mochi", owner: "u-google" });
    await mod.useAuth.getState().init();
    await vi.waitFor(() => expect(console.warn).toHaveBeenCalled());
    // Như confirmProfile ở HomeScreen.
    mod.saveProfile({ ...mod.useProfile.getState().profile, name: "Hùng Mới" });
    await mod.useAuth
      .getState()
      .syncProfile({ name: "Hùng Mới", avatar: "mochi" }, { edited: true });
    expect(upserts).toEqual([]);
    expect(stored()).toMatchObject({ name: "Hùng Mới", editedFor: "u-google" });

    // Tải lại trang (Supabase đã chạy lại): tài khoản vẫn "Hùng" nhưng bản sửa tay thắng.
    mod = await loadWith(null);
    void mod.useAuth.getState().init();
    await vi.waitFor(() => expect(upserts).toHaveLength(1));
    expect(upserts[0]).toEqual({ id: "u-google", display_name: "Hùng Mới", avatar: "mochi" });
    expect(mod.useProfile.getState().profile.name).toBe("Hùng Mới");
    await vi.waitFor(() => expect(stored().editedFor).toBeNull());
    expect(stored().owner).toBe("u-google");
  });

  it("máy dùng chung: hồ sơ của tài khoản khác, tài khoản mới chưa có tên → không đẩy, xoá tên + phụ kiện", async () => {
    session = GOOGLE;
    const saved = {
      name: "Lan",
      colorIndex: 1,
      avatar: "op",
      difficulty: 3,
      accessories: ["crown"],
      owner: "u-other",
    };
    const { useAuth, useProfile } = await loadWith(saved);
    void useAuth.getState().init();
    await vi.waitFor(() => expect(useProfile.getState().profile.name).toBe(""));
    expect(useProfile.getState().profile).toMatchObject({
      avatar: "op",
      difficulty: 3,
      accessories: [],
    });
    expect(stored().owner).toBe("u-google");
    await new Promise((r) => setTimeout(r, 20));
    expect(upserts).toEqual([]);
  });

  it("đổi tên khi là khách → hồ sơ thôi gắn tài khoản cũ; đăng nhập tài khoản mới chưa có tên thì đẩy lên", async () => {
    session = GUEST;
    const { useAuth, useProfile, saveProfile } = await loadWith({
      name: "Lan",
      avatar: "op",
      owner: "u-other",
    });
    await useAuth.getState().init();
    saveProfile({ ...useProfile.getState().profile, name: "Mai" });
    await useAuth.getState().syncProfile({ name: "Mai", avatar: "op" }, { edited: true });
    expect(stored().owner).toBeNull();
    upserts = [];
    useAuth.setState({ status: "google", userId: "u-google" });
    await vi.waitFor(() => expect(upserts).toHaveLength(1));
    expect(upserts[0]).toEqual({ id: "u-google", display_name: "Mai", avatar: "op" });
  });
});
