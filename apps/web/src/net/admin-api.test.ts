import { DEFAULT_SCORING, GAME_IDS } from "@brain-rizz/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  httpFailure,
  mergeGameStats,
  rpcFailure,
  toLoginEvent,
  toMatch,
  toOverview,
  toPartySettings,
  toRoomsResponse,
  toUsersPage,
} from "./admin-api";
import { resolveServerUrl, toHttpBase } from "./server-url";

/**
 * Trang quản trị (CR-019): chuẩn hoá dữ liệu RPC/HTTP, ánh xạ lỗi, và lời gọi mạng không bao giờ
 * ném lỗi (chưa cấu hình Supabase, không có quyền, game server lỗi).
 */

describe("địa chỉ game server dùng chung", () => {
  it("lấy từ biến môi trường, không có thì cùng máy cổng 2567", () => {
    expect(resolveServerUrl("https://game.example", undefined)).toBe("https://game.example");
    expect(resolveServerUrl("  ", { protocol: "http:", hostname: "192.168.1.5" })).toBe(
      "http://192.168.1.5:2567",
    );
    expect(resolveServerUrl(undefined, { protocol: "https:", hostname: "brainrizz.app" })).toBe(
      "https://brainrizz.app:2567",
    );
    expect(resolveServerUrl(undefined, undefined)).toBe("http://localhost:2567");
  });

  it("gốc HTTP: ws → http, wss → https, bỏ / cuối", () => {
    expect(toHttpBase("wss://game.example/")).toBe("https://game.example");
    expect(toHttpBase("ws://localhost:2567")).toBe("http://localhost:2567");
    expect(toHttpBase("https://game.example//")).toBe("https://game.example");
  });
});

describe("chuẩn hoá dữ liệu RPC", () => {
  it("admin_overview: số là int, ngày cũ trước, thiếu trường → 0", () => {
    const o = toOverview({
      totals: { users: 12, google_users: 5, guest_users: 7, admins: 1, matches: "3" },
      today: { logins: 4 },
      daily: [
        { day: "2026-11-19", logins: 4, active_users: 3, new_users: 1, matches: 2, brain_tests: 0 },
        { day: "2026-11-18", logins: 1 },
        { day: "hỏng", logins: 9 },
      ],
    });
    expect(o.totals).toEqual({
      users: 12,
      googleUsers: 5,
      guestUsers: 7,
      admins: 1,
      matches: 3,
      brainTests: 0,
      practiceRecords: 0,
    });
    expect(o.today).toEqual({ logins: 4, activeUsers: 0, newUsers: 0, matches: 0 });
    expect(o.daily.map((d) => d.day)).toEqual(["2026-11-18", "2026-11-19"]);
    expect(toOverview(null).daily).toEqual([]);
  });

  it("admin_login_events: avatar/sự kiện lạ → mặc định, tên rỗng → null", () => {
    const e = toLoginEvent({
      id: 7,
      user_id: "u1",
      display_name: " ",
      avatar: "khong-co",
      email: null,
      provider: "anonymous",
      event: "guest_created",
      device: "Chrome · Android",
      created_at: "2026-11-19T03:00:00Z",
    });
    expect(e).toMatchObject({
      id: 7,
      name: null,
      avatar: "khoi",
      provider: "anonymous",
      event: "guest_created",
      device: "Chrome · Android",
    });
    expect(toLoginEvent({ event: "hack" }).event).toBe("session_resumed");
  });

  it("admin_users: total_count lấy từ dòng đầu, trang trống → 0", () => {
    const page = toUsersPage([
      { user_id: "a", is_admin: true, provider: "google", matches: 3, total_count: 42 },
      { user_id: "b", is_admin: "true", provider: "anonymous", total_count: 42 },
    ]);
    expect(page.total).toBe(42);
    expect(page.rows[0]?.isAdmin).toBe(true);
    expect(page.rows[1]?.isAdmin).toBe(false);
    expect(page.rows[1]?.provider).toBe("anonymous");
    expect(toUsersPage([])).toEqual({ rows: [], total: 0 });
    expect(toUsersPage(null)).toEqual({ rows: [], total: 0 });
  });

  it("admin_matches: bỏ game lạ, kết quả theo dòng", () => {
    const m = toMatch({
      room_code: "ABCD",
      created_at: "2026-11-19T03:00:00Z",
      rounds: 3,
      players: 12,
      bot_count: 2,
      games: ["odd-one-out", "da-go"],
      settings_version: 4,
      results: [
        { user_id: "u", display_name: "Na", avatar: "bap", placement: 0, match_points: 41 },
      ],
    });
    expect(m.games).toEqual(["odd-one-out"]);
    expect(m.results[0]).toMatchObject({ name: "Na", avatar: "bap", matchPoints: 41 });
    expect(m.settingsVersion).toBe(4);
  });

  it("admin_game_stats chỉ trả game có dữ liệu → ghép đủ GAME_IDS, thiếu thì 0", () => {
    const stats = mergeGameStats([
      { game_id: "balance", party_matches: 3, brain_plays: 2, brain_avg_score: "812.5" },
      { game_id: "game-da-go", party_matches: 9 },
    ]);
    expect(stats.map((s) => s.gameId)).toEqual(GAME_IDS);
    expect(stats.find((s) => s.gameId === "balance")).toMatchObject({
      partyMatches: 3,
      brainPlays: 2,
      brainAvgScore: 812.5,
    });
    expect(stats.find((s) => s.gameId === "odd-one-out")).toMatchObject({
      partyMatches: 0,
      brainAvgScore: null,
    });
  });

  it("admin_get_party_settings: cấu hình qua parseScoringConfig, game tắt chỉ giữ id có thật", () => {
    const s = toPartySettings({
      version: 3,
      scoring: { basePoints: 120, maxSpeedBonus: "nhiều" },
      disabled_games: ["balance", "khong-co", "balance"],
      updated_at: null,
      updated_by_name: "Hưng",
    });
    expect(s.version).toBe(3);
    expect(s.scoring.basePoints).toBe(120);
    expect(s.scoring.maxSpeedBonus).toBe(DEFAULT_SCORING.maxSpeedBonus);
    expect(s.disabledGames).toEqual(["balance"]);
    expect(toPartySettings({}).scoring).toEqual(DEFAULT_SCORING);
  });

  it("GET /admin/rooms: pha lạ → lobby, số âm → 0", () => {
    const r = toRoomsResponse({
      serverTime: 1,
      uptimeS: 3600,
      rooms: [{ roomId: "ABCD", phase: "nope", humans: -2, bots: 1, configVersion: 2 }],
    });
    expect(r.uptimeS).toBe(3600);
    expect(r.rooms[0]).toMatchObject({ code: "ABCD", phase: "lobby", humans: 0, bots: 1 });
    expect(toRoomsResponse("rác").rooms).toEqual([]);
  });
});

describe("ánh xạ lỗi", () => {
  it("RPC: theo error.message của migration rồi theo SQLSTATE", () => {
    expect(rpcFailure({ message: "forbidden", code: "42501" })).toBe("forbidden");
    expect(rpcFailure({ message: "permission denied for function", code: "42501" })).toBe(
      "forbidden",
    );
    expect(rpcFailure({ message: "not-found", code: "P0002" })).toBe("not-found");
    expect(rpcFailure({ message: "self", code: "P0001" })).toBe("self");
    expect(rpcFailure({ message: "last-admin", code: "P0001" })).toBe("last-admin");
    expect(rpcFailure({ message: "JWT expired", code: "PGRST301" })).toBe("no-session");
    expect(rpcFailure({ message: "p_note tối đa 200 ký tự", code: "22023" })).toBe("error");
    expect(rpcFailure(null)).toBe("error");
  });

  it("HTTP: 401 hết phiên, 403 không có quyền, 503 server chưa cấu hình", () => {
    expect(httpFailure(401)).toBe("no-session");
    expect(httpFailure(403)).toBe("forbidden");
    expect(httpFailure(503)).toBe("server-unconfigured");
    expect(httpFailure(500)).toBe("error");
  });
});

// Mỗi test nạp lại module từ đầu (kéo theo cả @brain-rizz/shared) nên nới thời gian như data-api.test.
describe("chưa cấu hình Supabase (FR-MR-15)", { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("mọi lời gọi trả not-configured, không ném lỗi, không gọi mạng", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const api = await import("./admin-api");
    const notConfigured = { ok: false, reason: "not-configured" };
    await expect(api.fetchIsAdmin()).resolves.toEqual(notConfigured);
    await expect(api.fetchOverview()).resolves.toEqual(notConfigured);
    await expect(api.fetchLoginEvents()).resolves.toEqual(notConfigured);
    await expect(api.fetchUsers()).resolves.toEqual(notConfigured);
    await expect(api.fetchMatches()).resolves.toEqual(notConfigured);
    await expect(api.fetchGameStats(null)).resolves.toEqual(notConfigured);
    await expect(api.fetchPartySettings()).resolves.toEqual(notConfigured);
    await expect(api.savePartySettings(DEFAULT_SCORING, [], "")).resolves.toEqual(notConfigured);
    await expect(api.fetchSettingsHistory()).resolves.toEqual(notConfigured);
    await expect(api.fetchAdmins()).resolves.toEqual(notConfigured);
    await expect(api.addAdmin("a@b.c", "")).resolves.toEqual(notConfigured);
    await expect(api.removeAdmin("u")).resolves.toEqual(notConfigured);
    await expect(api.fetchRooms()).resolves.toEqual(notConfigured);
    await expect(api.reloadPartyConfig()).resolves.toEqual(notConfigured);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("đã cấu hình Supabase (client giả)", { timeout: 30_000 }, () => {
  const rpcMock = vi.fn();
  const fetchMock = vi.fn();

  async function load(session: { access_token: string } | null = { access_token: "tok" }) {
    vi.resetModules();
    vi.stubEnv("VITE_SERVER_URL", "wss://game.test/");
    vi.doMock("@/lib/supabase", () => ({
      SUPABASE_CONFIGURED: true,
      hasStoredSession: () => true,
      loadSupabase: async () => ({
        rpc: rpcMock,
        auth: { getSession: async () => ({ data: { session } }) },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    return import("./admin-api");
  }

  beforeEach(() => {
    rpcMock.mockReset();
    fetchMock.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.doUnmock("@/lib/supabase");
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lưu cấu hình: gửi đúng tham số RPC, trả version mới", async () => {
    rpcMock.mockResolvedValue({ data: 13, error: null });
    const api = await load();
    const res = await api.savePartySettings(DEFAULT_SCORING, ["balance"], `  ${"x".repeat(300)} `);
    expect(res).toEqual({ ok: true, data: 13 });
    const [name, args] = rpcMock.mock.calls[0] ?? [];
    expect(name).toBe("admin_update_party_settings");
    expect(args.p_scoring).toEqual(DEFAULT_SCORING);
    expect(args.p_disabled_games).toEqual(["balance"]);
    expect(args.p_note).toHaveLength(200);
  });

  it("admin_matches: trang đầu không con trỏ; tải thêm gửi cả created_at và room_code", async () => {
    rpcMock.mockResolvedValue({
      data: [{ room_code: "WXYZ", created_at: "2026-11-19T03:00:00.123456+00:00", results: [] }],
      error: null,
    });
    const api = await load();
    const first = await api.fetchMatches({ limit: 30 });
    expect(first.ok && first.data.map((m) => m.roomCode)).toEqual(["WXYZ"]);
    expect(rpcMock.mock.calls[0]).toEqual([
      "admin_matches",
      { p_limit: 30, p_before: null, p_before_room: null },
    ]);

    await api.fetchMatches({
      limit: 30,
      before: { createdAt: "2026-11-19T03:00:00.123456+00:00", roomCode: "WXYZ" },
    });
    // Giữ nguyên chuỗi thời gian của RPC (micro giây) để so `created_at = p_before` cho đúng.
    expect(rpcMock.mock.calls[1]).toEqual([
      "admin_matches",
      { p_limit: 30, p_before: "2026-11-19T03:00:00.123456+00:00", p_before_room: "WXYZ" },
    ]);
  });

  it("RPC từ chối (không phải admin) → forbidden; lỗi ném → error", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "forbidden", code: "42501" } });
    rpcMock.mockRejectedValueOnce(new Error("mạng"));
    const api = await load();
    await expect(api.fetchOverview()).resolves.toEqual({ ok: false, reason: "forbidden" });
    await expect(api.fetchAdmins()).resolves.toEqual({ ok: false, reason: "error" });
  });

  it("không có phiên → no-session, không gọi RPC", async () => {
    const api = await load(null);
    await expect(api.fetchIsAdmin()).resolves.toEqual({ ok: false, reason: "no-session" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("game server: gọi gốc HTTP từ VITE_SERVER_URL kèm Bearer token", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ serverTime: 5, uptimeS: 60, rooms: [] }),
    });
    const api = await load();
    await expect(api.fetchRooms()).resolves.toEqual({
      ok: true,
      data: { serverTime: 5, uptimeS: 60, rooms: [] },
    });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://game.test/admin/rooms");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("game server: 403 → forbidden, 503 → server-unconfigured, mất mạng → error", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const api = await load();
    await expect(api.reloadPartyConfig()).resolves.toEqual({ ok: false, reason: "forbidden" });
    await expect(api.reloadPartyConfig()).resolves.toEqual({
      ok: false,
      reason: "server-unconfigured",
    });
    await expect(api.fetchRooms()).resolves.toEqual({ ok: false, reason: "error" });
  });
});
