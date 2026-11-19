import { emptyUnlockStats } from "@brain-rizz/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tiến độ mở khoá bạn đồng hành (CR-024): RPC `my_unlock_stats` → `parseUnlockStats`. Supabase giả
 * qua `vi.doMock`, mỗi test nạp lại module (cờ "chưa có hàm" là biến của module).
 */

type RpcResult = { data: unknown; error: unknown; status?: number };

interface Setup {
  configured?: boolean;
  stored?: boolean;
  session?: unknown;
  answer?: () => RpcResult;
}

async function load({
  configured = true,
  stored = true,
  session = { user: { id: "user-a" } },
  answer = () => ({ data: null, error: null }),
}: Setup = {}) {
  vi.resetModules();
  const rpc = vi.fn(async (_name: string) => answer());
  const client = { rpc, auth: { getSession: async () => ({ data: { session } }) } };
  vi.doMock("@/lib/supabase", () => ({
    SUPABASE_CONFIGURED: configured,
    hasStoredSession: () => stored,
    loadSupabase: async () => (configured ? client : null),
  }));
  vi.doMock("@/stores/auth.store", () => ({ withTimeout: <T>(p: Promise<T>) => p }));
  const api = await import("./unlocks-api");
  return { api, rpc };
}

describe("fetchUnlockStats (my_unlock_stats, CR-024)", { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.doUnmock("@/lib/supabase");
    vi.doUnmock("@/stores/auth.store");
    vi.restoreAllMocks();
  });

  it("đọc JSON snake_case của RPC thành UnlockStats", async () => {
    const { api, rpc } = await load({
      answer: () => ({
        data: {
          party_matches: 12,
          party_wins: "3",
          brain_best: 512,
          practice_best: { "number-balloons": { "1": 1800 } },
          party_category: { analyze: { sum: 4000, matches: 2 } },
        },
        error: null,
      }),
    });
    await expect(api.fetchUnlockStats()).resolves.toEqual({
      ok: true,
      data: {
        partyMatches: 12,
        partyWins: 3,
        brainBest: 512,
        practiceBest: { "number-balloons": { 1: 1800 } },
        partyCategory: { analyze: { sum: 4000, matches: 2 } },
      },
    });
    expect(rpc).toHaveBeenCalledWith("my_unlock_stats");
  });

  it("dữ liệu rỗng / lạ → số liệu trống, không ném", async () => {
    const { api } = await load({ answer: () => ({ data: "not json", error: null }) });
    await expect(api.fetchUnlockStats()).resolves.toEqual({ ok: true, data: emptyUnlockStats() });
  });

  it("chưa cấu hình → not-configured; chưa có phiên → no-session, không gọi RPC", async () => {
    const off = await load({ configured: false });
    await expect(off.api.fetchUnlockStats()).resolves.toEqual({
      ok: false,
      reason: "not-configured",
    });
    const none = await load({ stored: false });
    await expect(none.api.fetchUnlockStats()).resolves.toEqual({
      ok: false,
      reason: "no-session",
    });
    const gone = await load({ session: null });
    await expect(gone.api.fetchUnlockStats()).resolves.toEqual({
      ok: false,
      reason: "no-session",
    });
    expect(off.rpc).not.toHaveBeenCalled();
    expect(none.rpc).not.toHaveBeenCalled();
    expect(gone.rpc).not.toHaveBeenCalled();
  });

  it("lỗi mạng / RPC → error, lần sau vẫn gọi lại", async () => {
    const { api, rpc } = await load({
      answer: () => ({ data: null, error: { code: "57014", message: "timeout" }, status: 500 }),
    });
    await expect(api.fetchUnlockStats()).resolves.toEqual({ ok: false, reason: "error" });
    await expect(api.fetchUnlockStats()).resolves.toEqual({ ok: false, reason: "error" });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("DB chưa có hàm (404 / PGRST202) → error êm, rồi thôi gọi lên máy chủ", async () => {
    const { api, rpc } = await load({
      answer: () => ({
        data: null,
        error: { code: "PGRST202", message: "Could not find the function" },
        status: 404,
      }),
    });
    await expect(api.fetchUnlockStats()).resolves.toEqual({ ok: false, reason: "error" });
    await expect(api.fetchUnlockStats()).resolves.toEqual({ ok: false, reason: "error" });
    expect(rpc).toHaveBeenCalledTimes(1);
    api.resetUnlockStatsAvailability();
    await api.fetchUnlockStats();
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
