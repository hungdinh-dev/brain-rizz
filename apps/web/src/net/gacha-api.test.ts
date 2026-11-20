import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phấn và máy quay (CR-023, kế hoạch gacha-pets-unlocks mục 5.3): RPC đúng tên + tham số, JSON
 * snake_case → kiểu web (dữ liệu lạ không ném), lỗi → lý do để màn hiện đúng trạng thái. DB chưa có
 * máy quay (Supabase thật chưa chạy migration: 404 / PGRST202) → `unavailable` rồi thôi gọi.
 */

type RpcResult = { data: unknown; error: unknown; status?: number };

interface Setup {
  configured?: boolean;
  /** Máy có lưu phiên (`hasStoredSession`). */
  stored?: boolean;
  /** Phiên supabase-js trả về (`null` = đã đăng xuất ở tab khác). */
  session?: unknown;
  /** Token `ensureSession` trả (null = không tạo được phiên). */
  ensureToken?: string | null;
}

async function load(answer: (name: string, args: unknown) => RpcResult, setup: Setup = {}) {
  const { configured = true, stored = true, session = { user: { id: "u1" } } } = setup;
  vi.resetModules();
  const rpc = vi.fn(async (name: string, args?: unknown) => answer(name, args));
  const client = { rpc, auth: { getSession: async () => ({ data: { session } }) } };
  const ensureSession = vi.fn(async () =>
    setup.ensureToken === undefined ? "token" : setup.ensureToken,
  );
  vi.doMock("@/lib/supabase", () => ({
    SUPABASE_CONFIGURED: configured,
    hasStoredSession: () => stored,
    loadSupabase: async () => (configured ? client : null),
  }));
  vi.doMock("@/stores/auth.store", () => ({
    useAuth: { getState: () => ({ ensureSession }) },
    withTimeout: <T>(p: Promise<T>) => p,
  }));
  const api = await import("./gacha-api");
  return { api, rpc, ensureSession };
}

const ok = (data: unknown): RpcResult => ({ data, error: null, status: 200 });

const REQ = "0b6f2a4e-6c1d-4f3a-9a52-3c7d1e2f4a01";
const REQ_2 = "5d0c9b8a-7e6f-4a3b-8c2d-1e0f9a8b7c02";

describe("gacha-api", { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.doUnmock("@/lib/supabase");
    vi.doUnmock("@/stores/auth.store");
    vi.restoreAllMocks();
  });

  it("chưa cấu hình Supabase → mọi hàm trả not-configured, không gọi mạng, không tạo phiên", async () => {
    const { api, rpc, ensureSession } = await load(() => ok(null), { configured: false });
    const failed = { ok: false, reason: "not-configured" };
    await expect(api.fetchWallet(true)).resolves.toEqual(failed);
    await expect(api.claimDailyChalk()).resolves.toEqual(failed);
    await expect(api.gachaPull(1, REQ)).resolves.toEqual(failed);
    await expect(api.fetchMyItems()).resolves.toEqual(failed);
    await expect(api.fetchGachaHistory()).resolves.toEqual(failed);
    expect(rpc).not.toHaveBeenCalled();
    expect(ensureSession).not.toHaveBeenCalled();
  });

  it("gọi đúng tên RPC và tham số (quay kèm mã yêu cầu)", async () => {
    const { api, rpc } = await load(() => ok(null));
    await api.fetchWallet();
    await api.claimDailyChalk({ name: "Na", avatar: "khoi" });
    await api.gachaPull(10, REQ);
    await api.gachaPull(1, REQ_2);
    await api.fetchMyItems();
    await api.fetchGachaHistory(500);
    expect(rpc.mock.calls).toEqual([
      ["my_wallet", undefined],
      ["claim_daily_chalk", undefined],
      ["gacha_pull", { p_count: 10, p_request_id: REQ }],
      ["gacha_pull", { p_count: 1, p_request_id: REQ_2 }],
      ["my_items", undefined],
      ["gacha_history", { p_limit: 100 }],
    ]);
  });

  it("mã yêu cầu: uuid v4, mỗi lần một mã; không có randomUUID (http qua IP LAN) vẫn tạo được", async () => {
    const { api } = await load(() => ok(null));
    const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const a = api.newPullRequestId();
    const b = api.newPullRequestId();
    expect(a).toMatch(UUID_V4);
    expect(b).not.toBe(a);
    // Che `randomUUID` (thuộc prototype) bằng thuộc tính riêng, rồi gỡ ra để trả lại hàm gốc.
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const ids = new Set(Array.from({ length: 50 }, () => api.newPullRequestId()));
      expect(ids.size).toBe(50);
      for (const id of ids) expect(id).toMatch(UUID_V4);
    } finally {
      Reflect.deleteProperty(crypto, "randomUUID");
    }
    expect(typeof crypto.randomUUID).toBe("function");
  });

  it("gọi lại cùng mã: máy chủ trả kết quả cũ kèm replayed, web giữ cờ", async () => {
    const { api } = await load(() =>
      ok({
        results: [{ item_id: "crown", rarity: "epic", duplicate: false, refund: 0 }],
        balance: 340,
        since_epic: 0,
        since_legendary: 12,
        replayed: true,
      }),
    );
    const res = await api.gachaPull(1, REQ);
    expect(res).toMatchObject({ ok: true, data: { replayed: true, balance: 340 } });
    expect(api.toPullBatch({ replayed: "true" }).replayed).toBe(false);
  });

  it("ví: snake_case → camelCase; thiếu / sai kiểu → 0, không ném", async () => {
    const { api } = await load(() =>
      ok({
        balance: 1240,
        since_epic: 6,
        since_legendary: "17",
        total_pulls: 23,
        daily_claimed: true,
        today: { party: 45, brain: 1, practice: null },
      }),
    );
    await expect(api.fetchWallet()).resolves.toEqual({
      ok: true,
      data: {
        balance: 1240,
        sinceEpic: 6,
        sinceLegendary: 17,
        totalPulls: 23,
        dailyClaimed: true,
        today: { party: 45, brain: 1, practice: 0 },
      },
    });
    expect(api.toWallet(null)).toEqual(api.EMPTY_WALLET);
    expect(api.toWallet({ since_epic: -3, daily_claimed: "true", today: [] })).toEqual(
      api.EMPTY_WALLET,
    );
  });

  it("quay: bỏ món lạ, độ hiếm lạ lấy theo danh mục, refund không âm", async () => {
    const { api } = await load(() =>
      ok({
        results: [
          { item_id: "crown", rarity: "epic", duplicate: false, refund: 0 },
          { item_id: "khong-co", rarity: "rare", duplicate: false, refund: 0 },
          { item_id: "halo", rarity: "???", duplicate: true, refund: 200 },
          { item_id: "cap", rarity: "common", duplicate: true, refund: -5 },
          null,
        ],
        balance: 340,
        since_epic: 0,
        since_legendary: 12,
      }),
    );
    await expect(api.gachaPull(10, REQ)).resolves.toEqual({
      ok: true,
      data: {
        results: [
          { itemId: "crown", rarity: "epic", duplicate: false, refund: 0 },
          { itemId: "halo", rarity: "legendary", duplicate: true, refund: 200 },
          { itemId: "cap", rarity: "common", duplicate: true, refund: 0 },
        ],
        balance: 340,
        sinceEpic: 0,
        sinceLegendary: 12,
        replayed: false,
      },
    });
    expect(api.toPullBatch("rác").results).toEqual([]);
  });

  it("món đã có: chỉ giữ id có thật, không trùng; lịch sử bỏ dòng lạ", async () => {
    const { api } = await load((name) =>
      name === "my_items"
        ? ok(["crown", 7, "crown", "khong-co", "scarf"])
        : ok([
            {
              id: 9,
              batch_id: "b1",
              item_id: "scarf",
              rarity: "common",
              duplicate: false,
              refund: 0,
              created_at: "2026-11-20T08:00:00Z",
            },
            { id: 8, item_id: "khong-co" },
          ]),
    );
    await expect(api.fetchMyItems()).resolves.toEqual({ ok: true, data: ["crown", "scarf"] });
    await expect(api.fetchGachaHistory()).resolves.toEqual({
      ok: true,
      data: [
        {
          id: 9,
          batchId: "b1",
          itemId: "scarf",
          rarity: "common",
          duplicate: false,
          refund: 0,
          createdAt: "2026-11-20T08:00:00Z",
        },
      ],
    });
  });

  it("thiếu phấn (P0001 insufficient) → insufficient; lỗi khác → error", async () => {
    const insufficient = await load(() => ({
      data: null,
      error: { code: "P0001", message: "insufficient" },
      status: 400,
    }));
    await expect(insufficient.api.gachaPull(10, REQ)).resolves.toEqual({
      ok: false,
      reason: "insufficient",
    });
    const broken = await load(() => ({ data: null, error: { code: "XX000" }, status: 500 }));
    await expect(broken.api.gachaPull(1, REQ)).resolves.toEqual({ ok: false, reason: "error" });
    await expect(broken.api.gachaPull(1, REQ)).resolves.toEqual({ ok: false, reason: "error" });
    expect(broken.rpc).toHaveBeenCalledTimes(2);
  });

  it("DB chưa có máy quay (404 / PGRST202) → unavailable, thôi gọi tới khi bấm Thử lại", async () => {
    let migrated = false;
    const { api, rpc } = await load(() =>
      migrated
        ? ok({ balance: 50 })
        : {
            data: null,
            error: { code: "PGRST202", message: "Could not find the function public.my_wallet" },
            status: 404,
          },
    );
    const unavailable = { ok: false, reason: "unavailable" };
    await expect(api.fetchWallet()).resolves.toEqual(unavailable);
    await expect(api.fetchMyItems()).resolves.toEqual(unavailable);
    await expect(api.gachaPull(1, REQ)).resolves.toEqual(unavailable);
    await expect(api.claimDailyChalk()).resolves.toEqual(unavailable);
    expect(rpc).toHaveBeenCalledTimes(1);
    // Thử lại (DB vẫn chưa có) → hỏi lại đúng một lần rồi lại thôi.
    api.retryUnavailable();
    await expect(api.fetchWallet(true)).resolves.toEqual(unavailable);
    await expect(api.fetchWallet(true)).resolves.toEqual(unavailable);
    expect(rpc).toHaveBeenCalledTimes(2);
    // Đã chạy migration → Thử lại đọc được ví, không phải tải lại trang.
    migrated = true;
    api.retryUnavailable();
    await expect(api.fetchWallet(true)).resolves.toMatchObject({ ok: true, data: { balance: 50 } });
  });

  it("chưa có phiên: menu không gọi; màn Máy quay dò bằng khoá công khai", async () => {
    // Hàm có thật, anon không có quyền (42501) → no-session = ví trống.
    const exists = await load(
      () => ({ data: null, error: { code: "42501", message: "permission denied" }, status: 401 }),
      { stored: false },
    );
    await expect(exists.api.fetchWallet()).resolves.toEqual({ ok: false, reason: "no-session" });
    expect(exists.rpc).not.toHaveBeenCalled();
    await expect(exists.api.fetchWallet(true)).resolves.toEqual({
      ok: false,
      reason: "no-session",
    });
    expect(exists.rpc).toHaveBeenCalledTimes(1);
    // Chưa chạy migration → unavailable dù chưa có phiên.
    const missing = await load(() => ({ data: null, error: { code: "PGRST202" }, status: 404 }), {
      stored: false,
    });
    await expect(missing.api.fetchWallet(true)).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
    // Phiên đã mất ở tab khác: các hàm cần phiên không gọi RPC.
    const gone = await load(() => ok({ balance: 1 }), { session: null });
    await expect(gone.api.gachaPull(1, REQ)).resolves.toEqual({ ok: false, reason: "no-session" });
    expect(gone.rpc).not.toHaveBeenCalled();
  });

  it("quà mỗi ngày tạo phiên khách (kèm hồ sơ); không tạo được → error", async () => {
    const { api, ensureSession } = await load(() => ok(20));
    const profile = { name: "Na", avatar: "bo" as const };
    await expect(api.claimDailyChalk(profile)).resolves.toEqual({ ok: true, data: 20 });
    expect(ensureSession).toHaveBeenCalledWith(profile);
    const noToken = await load(() => ok(20), { ensureToken: null });
    await expect(noToken.api.claimDailyChalk()).resolves.toEqual({ ok: false, reason: "error" });
    expect(noToken.rpc).not.toHaveBeenCalled();
  });
});
