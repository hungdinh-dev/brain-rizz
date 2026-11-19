import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * FR-MR-15: thiếu biến môi trường Supabase → mọi lời gọi dữ liệu trả `not-configured`,
 * không ném lỗi, không tải supabase-js, không tạo phiên.
 * `SUPABASE_CONFIGURED` tính lúc nạp module nên đặt biến rỗng rồi import lại sau mỗi lần reset.
 */
async function loadModules() {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
  const supabase = await import("@/lib/supabase");
  const api = await import("./data-api");
  const { useAuth } = await import("@/stores/auth.store");
  return { supabase, api, useAuth };
}

// Mỗi test nạp lại module từ đầu (kéo theo cả @brain-rizz/shared): chạy riêng < 1 s nhưng khi
// `pnpm check` chạy song song test 10.000 seed của shared thì có lúc quá 5 s mặc định.
describe("data-api khi chưa cấu hình Supabase (FR-MR-15)", { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("client Supabase là null, trạng thái tài khoản not-configured", async () => {
    const { supabase, useAuth } = await loadModules();
    expect(supabase.SUPABASE_CONFIGURED).toBe(false);
    await expect(supabase.loadSupabase()).resolves.toBeNull();
    expect(useAuth.getState().status).toBe("not-configured");
    await expect(useAuth.getState().ensureSession()).resolves.toBeNull();
    await expect(useAuth.getState().currentToken()).resolves.toBeNull();
  });

  it("mọi hàm đọc/ghi trả not-configured, không ném lỗi", async () => {
    const { api } = await loadModules();
    const notConfigured = { ok: false, reason: "not-configured" };
    await expect(api.fetchLeaderboard({ kind: "brain" }, "week")).resolves.toEqual(notConfigured);
    await expect(
      api.fetchLeaderboard({ kind: "game", gameId: "odd-one-out" }, "all"),
    ).resolves.toEqual(notConfigured);
    await expect(api.fetchMyRank({ kind: "brain" }, "week")).resolves.toEqual(notConfigured);
    await expect(api.fetchBrainHistory()).resolves.toEqual(notConfigured);
    await expect(api.fetchMatchHistory()).resolves.toEqual(notConfigured);
    await expect(api.fetchPracticeBests()).resolves.toEqual(notConfigured);
    await expect(
      api.submitPracticeResult("odd-one-out", 1, 1200, 8, { name: "QA", avatar: "khoi" }),
    ).resolves.toEqual(notConfigured);
    await expect(api.fetchPracticeFavorites()).resolves.toEqual(notConfigured);
    await expect(api.setPracticeFavorite("odd-one-out", true)).resolves.toEqual(notConfigured);
    await expect(api.mergePracticeFavorites(["odd-one-out"])).resolves.toEqual(notConfigured);
    await expect(api.fetchSessionUserId()).resolves.toEqual(notConfigured);
  });
});

describe("game yêu thích: RPC practice_favorites_* (CR-020)", { timeout: 30_000 }, () => {
  type RpcResult = { data: unknown; error: unknown; status?: number };

  /** Supabase giả: có cấu hình, có phiên (của `session`); `rpc` trả lần lượt theo `answer`. */
  async function loadWithRpc(
    answer: (name: string, args: unknown) => RpcResult,
    session: unknown = { user: { id: "user-a" } },
  ) {
    vi.resetModules();
    const rpc = vi.fn(async (name: string, args?: unknown) => answer(name, args));
    const client = { rpc, auth: { getSession: async () => ({ data: { session } }) } };
    vi.doMock("@/lib/supabase", () => ({
      SUPABASE_CONFIGURED: true,
      hasStoredSession: () => true,
      loadSupabase: async () => client,
    }));
    vi.doMock("@/stores/auth.store", () => ({
      useAuth: { getState: () => ({}) },
      withTimeout: <T>(p: Promise<T>) => p,
    }));
    const api = await import("./data-api");
    return { api, rpc };
  }

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.doUnmock("@/lib/supabase");
    vi.doUnmock("@/stores/auth.store");
    vi.restoreAllMocks();
  });

  it("gọi đúng tên RPC và tham số; chỉ giữ phần tử là chuỗi", async () => {
    const { api, rpc } = await loadWithRpc((name) =>
      name === "practice_favorites_set"
        ? { data: null, error: null }
        : { data: ["odd-one-out", 7, null, "balance"], error: null },
    );
    await expect(api.fetchPracticeFavorites()).resolves.toEqual({
      ok: true,
      data: ["odd-one-out", "balance"],
    });
    await expect(api.setPracticeFavorite("balance", false)).resolves.toEqual({
      ok: true,
      data: null,
    });
    await expect(api.mergePracticeFavorites(["balance", "odd-one-out"])).resolves.toEqual({
      ok: true,
      data: ["odd-one-out", "balance"],
    });
    expect(rpc.mock.calls).toEqual([
      ["practice_favorites_get"],
      ["practice_favorites_set", { p_game_id: "balance", p_favorite: false }],
      ["practice_favorites_merge", { p_game_ids: ["balance", "odd-one-out"] }],
    ]);
  });

  it("id tài khoản của phiên đang có; phiên đã mất (đăng xuất ở tab khác) → no-session", async () => {
    const answer = () => ({ data: null, error: null });
    const { api, rpc } = await loadWithRpc(answer);
    await expect(api.fetchSessionUserId()).resolves.toEqual({ ok: true, data: "user-a" });
    expect(rpc).not.toHaveBeenCalled();
    const gone = await loadWithRpc(answer, null);
    await expect(gone.api.fetchSessionUserId()).resolves.toEqual({
      ok: false,
      reason: "no-session",
    });
  });

  it("dữ liệu lạ (null, không phải mảng) → mảng rỗng", async () => {
    const { api } = await loadWithRpc(() => ({ data: null, error: null }));
    await expect(api.fetchPracticeFavorites()).resolves.toEqual({ ok: true, data: [] });
  });

  it("lỗi RPC (vd. limit P0001) → error, vẫn gọi tiếp lần sau", async () => {
    const { api, rpc } = await loadWithRpc(() => ({
      data: null,
      error: { code: "P0001", message: "limit" },
      status: 400,
    }));
    await expect(api.setPracticeFavorite("balance", true)).resolves.toEqual({
      ok: false,
      reason: "error",
    });
    await expect(api.setPracticeFavorite("balance", true)).resolves.toEqual({
      ok: false,
      reason: "error",
    });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("DB chưa có hàm (404 / PGRST202) → error, rồi thôi gọi lên máy chủ", async () => {
    const { api, rpc } = await loadWithRpc(() => ({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function" },
      status: 404,
    }));
    const failed = { ok: false, reason: "error" };
    await expect(api.mergePracticeFavorites(["balance"])).resolves.toEqual(failed);
    await expect(api.fetchPracticeFavorites()).resolves.toEqual(failed);
    await expect(api.setPracticeFavorite("balance", true)).resolves.toEqual(failed);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe("lịch sử trận party: bot_count (CR-016)", { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const ROW = {
    id: "m1",
    room_code: "ABCD",
    placement: 1,
    players: 5,
    match_points: 18,
    total_score: 1234,
    rounds: 3,
    games: ["odd-one-out", "khong-co"],
    category_scores: { identify: 300 },
    category_titles: ["identify"],
    created_at: "2026-10-21T08:00:00Z",
  };

  it("đọc bot_count; players vẫn là tổng số ghế gồm cả bot", async () => {
    const { api } = await loadModules();
    const row = api.toMatchRow({ ...ROW, bot_count: 3 });
    expect(row.botCount).toBe(3);
    expect(row.players).toBe(5);
    expect(row.games).toEqual(["odd-one-out"]);
  });

  it("trận cũ chưa có cột hoặc giá trị lạ thì là 0 (chỉ có người thật)", async () => {
    const { api } = await loadModules();
    expect(api.toMatchRow(ROW).botCount).toBe(0);
    expect(api.toMatchRow({ ...ROW, bot_count: null }).botCount).toBe(0);
    expect(api.toMatchRow({ ...ROW, bot_count: "2" }).botCount).toBe(2);
    expect(api.toMatchRow({ ...ROW, bot_count: -1 }).botCount).toBe(0);
    expect(api.toMatchRow({ ...ROW, bot_count: "abc" }).botCount).toBe(0);
  });
});
