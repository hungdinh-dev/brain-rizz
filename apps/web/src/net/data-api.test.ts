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

describe("data-api khi chưa cấu hình Supabase (FR-MR-15)", () => {
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
  });
});
