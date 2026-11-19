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
  from: vi.fn(() => ({ upsert: async () => ({ error: null }) })),
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
