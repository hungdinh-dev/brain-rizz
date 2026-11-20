import {
  type AdminRoomsResponse,
  type AdminRoomView,
  type CharacterId,
  GAME_IDS,
  type GameId,
  isCharacterId,
  isGameId,
  type Phase,
  parseScoringConfig,
  type ScoringConfig,
} from "@brain-rizz/shared";
import { hasStoredSession, loadSupabase, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { type LoginEvent, withTimeout } from "@/stores/auth.store";
import type { DataFailure } from "./data-api";
import { SERVER_HTTP_URL } from "./server-url";

/**
 * Trang quản trị (CR-019, docs/01-product/admin-console.md mục 4.3–4.4): RPC `admin_*` của Supabase
 * và HTTP `/admin/*` của game server. Như `data-api.ts`: không bao giờ ném lỗi, trả `AdminResult`
 * để màn hình hiện đúng trạng thái. Quyền do RLS + `is_admin()` trong RPC và `requireAdmin` của
 * server quyết định; web chỉ hiển thị.
 */

export type AdminFailure =
  | DataFailure
  /** Không phải quản trị viên (RPC `forbidden` / 42501, server 403). */
  | "forbidden"
  /** Thêm quản trị viên: không thấy tài khoản Google có email này (P0002). */
  | "not-found"
  /** Gỡ quản trị viên: không tự gỡ mình (P0001). */
  | "self"
  /** Gỡ quản trị viên: không gỡ người cuối cùng (P0001). */
  | "last-admin"
  /** Game server chưa cấu hình Supabase (503). */
  | "server-unconfigured";

export type AdminResult<T> = { ok: true; data: T } | { ok: false; reason: AdminFailure };

export type AccountProvider = "anonymous" | "google";

export const LOGIN_EVENTS = [
  "guest_created",
  "google_sign_in",
  "google_linked",
  "session_resumed",
  "sign_out",
] as const satisfies readonly LoginEvent[];

export interface AdminDailyRow {
  /** `YYYY-MM-DD` theo giờ Việt Nam, cũ trước. */
  day: string;
  logins: number;
  activeUsers: number;
  newUsers: number;
  matches: number;
  brainTests: number;
}

export interface AdminOverview {
  totals: {
    users: number;
    googleUsers: number;
    guestUsers: number;
    admins: number;
    matches: number;
    brainTests: number;
    practiceRecords: number;
  };
  today: { logins: number; activeUsers: number; newUsers: number; matches: number };
  daily: AdminDailyRow[];
}

export interface AdminLoginEvent {
  id: number;
  userId: string;
  /** `null` khi người đó chưa có hồ sơ. */
  name: string | null;
  avatar: CharacterId;
  email: string | null;
  provider: AccountProvider;
  event: LoginEvent;
  device: string | null;
  createdAt: string;
}

export interface AdminUserRow {
  userId: string;
  name: string | null;
  avatar: CharacterId;
  email: string | null;
  provider: AccountProvider;
  isAdmin: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  lastSeenAt: string | null;
  matches: number;
  brainTests: number;
  practiceRecords: number;
}

export interface AdminUsersPage {
  rows: AdminUserRow[];
  /** Tổng số dòng khớp bộ lọc (trước phân trang). */
  total: number;
}

export interface AdminMatchResult {
  userId: string;
  name: string | null;
  avatar: CharacterId;
  /** 0 = nhất. */
  placement: number;
  matchPoints: number;
  totalScore: number;
}

export interface AdminMatch {
  roomCode: string;
  createdAt: string;
  rounds: number;
  /** Số ghế, gồm cả bot. */
  players: number;
  botCount: number;
  games: GameId[];
  settingsVersion: number;
  /** Người đã đăng nhập trong trận, theo hạng (bot và khách không phiên không có dòng). */
  results: AdminMatchResult[];
}

export interface AdminGameStat {
  gameId: GameId;
  partyMatches: number;
  brainPlays: number;
  /** Điểm TB một lượt Kiểm tra não; `null` khi chưa có lượt nào. */
  brainAvgScore: number | null;
  practicePlayers: number;
  practicePlays: number;
}

export interface AdminPartySettings {
  /** `party_settings.version` (0 = mặc định trong code). */
  version: number;
  /** Đã qua `parseScoringConfig` (trường thiếu/sai về mặc định, như server đọc). */
  scoring: ScoringConfig;
  disabledGames: GameId[];
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface AdminSettingsHistoryRow {
  id: number;
  version: number;
  scoring: ScoringConfig;
  disabledGames: GameId[];
  note: string | null;
  changedByName: string | null;
  changedAt: string;
}

export interface AdminAccount {
  userId: string;
  name: string | null;
  email: string | null;
  note: string | null;
  createdAt: string;
}

/** Giới hạn ghi chú (cột `note`, ≤ 200 ký tự). */
export const ADMIN_NOTE_MAX = 200;

// ------------------------------------------------------------- chuẩn hoá dữ liệu

// biome-ignore lint/suspicious/noExplicitAny: dữ liệu Supabase/HTTP chưa có kiểu sinh tự động; mọi dòng được kiểm và chuẩn hoá dưới đây
type Row = Record<string, any>;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const count = (v: unknown) => Math.max(0, Math.trunc(num(v)));
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const numOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const rowsOf = (v: unknown): Row[] =>
  Array.isArray(v) ? v.filter((r): r is Row => !!r && typeof r === "object") : [];
const avatarOf = (v: unknown): CharacterId => (isCharacterId(v) ? v : "khoi");
const providerOf = (v: unknown): AccountProvider => (v === "anonymous" ? "anonymous" : "google");
const gameIdsOf = (v: unknown): GameId[] => {
  const list = Array.isArray(v) ? v : [];
  return GAME_IDS.filter((id) => list.includes(id));
};

export function toOverview(raw: unknown): AdminOverview {
  const r: Row = raw && typeof raw === "object" ? (raw as Row) : {};
  const totals: Row = r.totals ?? {};
  const today: Row = r.today ?? {};
  return {
    totals: {
      users: count(totals.users),
      googleUsers: count(totals.google_users),
      guestUsers: count(totals.guest_users),
      admins: count(totals.admins),
      matches: count(totals.matches),
      brainTests: count(totals.brain_tests),
      practiceRecords: count(totals.practice_records),
    },
    today: {
      logins: count(today.logins),
      activeUsers: count(today.active_users),
      newUsers: count(today.new_users),
      matches: count(today.matches),
    },
    daily: rowsOf(r.daily)
      .map((d) => ({
        day: str(d.day).slice(0, 10),
        logins: count(d.logins),
        activeUsers: count(d.active_users),
        newUsers: count(d.new_users),
        matches: count(d.matches),
        brainTests: count(d.brain_tests),
      }))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.day))
      .sort((a, b) => a.day.localeCompare(b.day)),
  };
}

export function toLoginEvent(r: Row): AdminLoginEvent {
  return {
    id: num(r.id),
    userId: str(r.user_id),
    name: strOrNull(r.display_name),
    avatar: avatarOf(r.avatar),
    email: strOrNull(r.email),
    provider: providerOf(r.provider),
    event: (LOGIN_EVENTS as readonly string[]).includes(r.event)
      ? (r.event as LoginEvent)
      : "session_resumed",
    device: strOrNull(r.device),
    createdAt: str(r.created_at),
  };
}

export function toUsersPage(data: unknown): AdminUsersPage {
  const rows = rowsOf(data);
  return {
    rows: rows.map((r) => ({
      userId: str(r.user_id),
      name: strOrNull(r.display_name),
      avatar: avatarOf(r.avatar),
      email: strOrNull(r.email),
      provider: providerOf(r.provider),
      isAdmin: r.is_admin === true,
      createdAt: str(r.created_at),
      lastSignInAt: strOrNull(r.last_sign_in_at),
      lastSeenAt: strOrNull(r.last_seen_at),
      matches: count(r.matches),
      brainTests: count(r.brain_tests),
      practiceRecords: count(r.practice_records),
    })),
    // Trang trống (offset quá cuối) không có dòng nào để đọc total_count.
    total: rows.length > 0 ? count(rows[0]?.total_count) : 0,
  };
}

export function toMatch(r: Row): AdminMatch {
  return {
    roomCode: str(r.room_code),
    createdAt: str(r.created_at),
    rounds: count(r.rounds),
    players: count(r.players),
    botCount: count(r.bot_count),
    games: (Array.isArray(r.games) ? r.games : []).filter(isGameId),
    settingsVersion: count(r.settings_version),
    results: rowsOf(r.results).map((x) => ({
      userId: str(x.user_id),
      name: strOrNull(x.display_name),
      avatar: avatarOf(x.avatar),
      placement: count(x.placement),
      matchPoints: num(x.match_points),
      totalScore: num(x.total_score),
    })),
  };
}

/**
 * `admin_game_stats` chỉ trả game có dữ liệu → ghép với `GAME_IDS` (thiếu thì 0), theo thứ tự danh
 * mục; bỏ id lạ (game đã gỡ khỏi code).
 */
export function mergeGameStats(data: unknown): AdminGameStat[] {
  const byId = new Map(rowsOf(data).map((r) => [str(r.game_id), r]));
  return GAME_IDS.map((gameId) => {
    const r = byId.get(gameId);
    return {
      gameId,
      partyMatches: count(r?.party_matches),
      brainPlays: count(r?.brain_plays),
      brainAvgScore: numOrNull(r?.brain_avg_score),
      practicePlayers: count(r?.practice_players),
      practicePlays: count(r?.practice_plays),
    };
  });
}

export function toPartySettings(raw: unknown): AdminPartySettings {
  const r: Row = raw && typeof raw === "object" ? (raw as Row) : {};
  return {
    version: count(r.version),
    scoring: parseScoringConfig(r.scoring),
    disabledGames: gameIdsOf(r.disabled_games),
    updatedAt: strOrNull(r.updated_at),
    updatedByName: strOrNull(r.updated_by_name),
  };
}

export function toHistoryRow(r: Row): AdminSettingsHistoryRow {
  return {
    id: num(r.id),
    version: count(r.version),
    scoring: parseScoringConfig(r.scoring),
    disabledGames: gameIdsOf(r.disabled_games),
    note: strOrNull(r.note),
    changedByName: strOrNull(r.changed_by_name),
    changedAt: str(r.changed_at),
  };
}

export function toAdminAccount(r: Row): AdminAccount {
  return {
    userId: str(r.user_id),
    name: strOrNull(r.display_name),
    email: strOrNull(r.email),
    note: strOrNull(r.note),
    createdAt: str(r.created_at),
  };
}

const PHASES: readonly Phase[] = [
  "lobby",
  "game-select",
  "game-intro",
  "countdown",
  "playing",
  "round-results",
  "podium",
];

/** Thân `GET /admin/rooms`; trường lạ/thiếu → giá trị an toàn. */
export function toRoomsResponse(body: unknown): AdminRoomsResponse {
  const r: Row = body && typeof body === "object" ? (body as Row) : {};
  const rooms: AdminRoomView[] = rowsOf(r.rooms).map((x) => ({
    roomId: str(x.roomId),
    code: str(x.code) || str(x.roomId),
    phase: PHASES.includes(x.phase) ? (x.phase as Phase) : "lobby",
    round: count(x.round),
    totalRounds: count(x.totalRounds),
    gameId: str(x.gameId),
    humans: count(x.humans),
    bots: count(x.bots),
    connected: count(x.connected),
    configVersion: count(x.configVersion),
    createdAt: str(x.createdAt),
  }));
  return { serverTime: num(r.serverTime), uptimeS: count(r.uptimeS), rooms };
}

// ------------------------------------------------------------- lỗi

/**
 * Lỗi RPC → lý do (khớp theo `error.message` mà migration `raise`, rồi theo mã SQLSTATE):
 * `forbidden` 42501, `not-found` P0002, `self` / `last-admin` P0001; hết phiên → `no-session`.
 */
export function rpcFailure(error: unknown): AdminFailure {
  const e = error && typeof error === "object" ? (error as Row) : {};
  const message = str(e.message).trim();
  const code = str(e.code);
  if (message === "forbidden" || code === "42501") return "forbidden";
  if (message === "not-found" || code === "P0002") return "not-found";
  if (message === "self") return "self";
  if (message === "last-admin") return "last-admin";
  // 28000: RPC không thấy auth.uid(); PGRST301/303: JWT sai hoặc hết hạn.
  if (code === "28000" || code === "PGRST301" || code === "PGRST303") return "no-session";
  return "error";
}

/** Mã HTTP của `/admin/*` → lý do: 401 hết phiên, 403 không có quyền, 503 server chưa cấu hình. */
export function httpFailure(status: number): AdminFailure {
  if (status === 401) return "no-session";
  if (status === 403) return "forbidden";
  if (status === 503) return "server-unconfigured";
  return "error";
}

// ------------------------------------------------------------- gọi mạng

const fail = (reason: AdminFailure): { ok: false; reason: AdminFailure } => ({ ok: false, reason });

type Sb = NonNullable<Awaited<ReturnType<typeof loadSupabase>>>;

/** Game server chậm / không chạy: không chờ quá ngần này. */
const SERVER_TIMEOUT_MS = 8_000;

/** Client + token của phiên đang có (không tạo phiên khách). */
async function withSession(): Promise<
  { ok: true; sb: Sb; token: string } | { ok: false; reason: AdminFailure }
> {
  if (!SUPABASE_CONFIGURED) return fail("not-configured");
  if (!hasStoredSession()) return fail("no-session");
  try {
    const sb = await withTimeout(loadSupabase());
    if (!sb) return fail("not-configured");
    const { data } = await withTimeout(sb.auth.getSession());
    if (!data.session) return fail("no-session");
    return { ok: true, sb, token: data.session.access_token };
  } catch (err) {
    console.warn("[admin] Không đọc được phiên:", err);
    return fail("error");
  }
}

/** Gọi một RPC; lỗi → `rpcFailure`, quá giờ / mạng → `error`. */
async function rpc<T>(
  name: string,
  args: Record<string, unknown> | undefined,
  map: (data: unknown) => T,
): Promise<AdminResult<T>> {
  const s = await withSession();
  if (!s.ok) return s;
  try {
    const { data, error } = await withTimeout(Promise.resolve(s.sb.rpc(name, args)));
    if (error) {
      const reason = rpcFailure(error);
      if (reason === "error") console.warn(`[admin] Lỗi RPC ${name}:`, error);
      return fail(reason);
    }
    return { ok: true, data: map(data) };
  } catch (err) {
    console.warn(`[admin] Lỗi RPC ${name}:`, err);
    return fail("error");
  }
}

/** Gọi `/admin/*` của game server với token Supabase. */
async function server<T>(
  path: string,
  method: "GET" | "POST",
  map: (body: unknown) => T,
): Promise<AdminResult<T>> {
  const s = await withSession();
  if (!s.ok) return s;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);
  try {
    const res = await fetch(`${SERVER_HTTP_URL}/admin${path}`, {
      method,
      headers: { Authorization: `Bearer ${s.token}` },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return fail(httpFailure(res.status));
    return { ok: true, data: map(await res.json()) };
  } catch (err) {
    console.warn(`[admin] Không gọi được game server ${path}:`, err);
    return fail("error");
  } finally {
    clearTimeout(timer);
  }
}

/** Người đang đăng nhập có trong bảng `admins` không (RPC `is_admin`). */
export function fetchIsAdmin(): Promise<AdminResult<boolean>> {
  return rpc("is_admin", undefined, (data) => data === true);
}

export function fetchOverview(days = 14): Promise<AdminResult<AdminOverview>> {
  return rpc("admin_overview", { p_days: days }, toOverview);
}

export interface LoginEventsQuery {
  limit?: number;
  /** `created_at` của dòng cuối trang trước. */
  before?: string | null;
  event?: LoginEvent | null;
  query?: string;
}

export function fetchLoginEvents(
  q: LoginEventsQuery = {},
): Promise<AdminResult<AdminLoginEvent[]>> {
  return rpc(
    "admin_login_events",
    {
      p_limit: q.limit ?? 50,
      p_before: q.before ?? null,
      p_event: q.event ?? null,
      p_query: q.query?.trim() || null,
    },
    (data) => rowsOf(data).map(toLoginEvent),
  );
}

export interface UsersQuery {
  limit?: number;
  offset?: number;
  query?: string;
  provider?: AccountProvider | null;
}

export function fetchUsers(q: UsersQuery = {}): Promise<AdminResult<AdminUsersPage>> {
  return rpc(
    "admin_users",
    {
      p_limit: q.limit ?? 50,
      p_offset: q.offset ?? 0,
      p_query: q.query?.trim() || null,
      p_provider: q.provider ?? null,
    },
    toUsersPage,
  );
}

export interface MatchesQuery {
  limit?: number;
  /**
   * Trận cuối trang trước. RPC sắp `created_at desc, room_code desc` nên con trỏ là cả cặp: hai
   * phòng xong cùng lúc không bị mất trận giữa hai trang.
   */
  before?: Pick<AdminMatch, "createdAt" | "roomCode"> | null;
}

export function fetchMatches(q: MatchesQuery = {}): Promise<AdminResult<AdminMatch[]>> {
  return rpc(
    "admin_matches",
    {
      p_limit: q.limit ?? 30,
      p_before: q.before?.createdAt ?? null,
      p_before_room: q.before?.roomCode ?? null,
    },
    (data) => rowsOf(data).map(toMatch),
  );
}

/** `days = null` → mọi lúc. */
export function fetchGameStats(days: number | null = 30): Promise<AdminResult<AdminGameStat[]>> {
  return rpc("admin_game_stats", { p_days: days }, mergeGameStats);
}

export function fetchPartySettings(): Promise<AdminResult<AdminPartySettings>> {
  return rpc("admin_get_party_settings", undefined, toPartySettings);
}

/** Lưu cấu hình (version + 1, ghi lịch sử). Trả version mới. */
export function savePartySettings(
  scoring: ScoringConfig,
  disabledGames: readonly string[],
  note: string,
): Promise<AdminResult<number>> {
  return rpc(
    "admin_update_party_settings",
    {
      p_scoring: scoring,
      p_disabled_games: [...disabledGames],
      p_note: note.trim().slice(0, ADMIN_NOTE_MAX) || null,
    },
    count,
  );
}

export function fetchSettingsHistory(limit = 20): Promise<AdminResult<AdminSettingsHistoryRow[]>> {
  return rpc("admin_settings_history", { p_limit: limit }, (data) =>
    rowsOf(data).map(toHistoryRow),
  );
}

export function fetchAdmins(): Promise<AdminResult<AdminAccount[]>> {
  return rpc("admin_list_admins", undefined, (data) => rowsOf(data).map(toAdminAccount));
}

export function addAdmin(email: string, note: string): Promise<AdminResult<string>> {
  return rpc(
    "admin_add_admin",
    { p_email: email.trim(), p_note: note.trim().slice(0, ADMIN_NOTE_MAX) || null },
    str,
  );
}

export function removeAdmin(userId: string): Promise<AdminResult<null>> {
  return rpc("admin_remove_admin", { p_user_id: userId }, () => null);
}

/** Phòng party đang mở trên game server (`GET /admin/rooms`). */
export function fetchRooms(): Promise<AdminResult<AdminRoomsResponse>> {
  return server("/rooms", "GET", toRoomsResponse);
}

/** Báo game server nạp lại cấu hình ngay (`POST /admin/config/reload`). Trả version server đang dùng. */
export function reloadPartyConfig(): Promise<AdminResult<number>> {
  return server("/config/reload", "POST", (body) =>
    count(body && typeof body === "object" ? (body as Row).version : 0),
  );
}
