import {
  type CosmeticId,
  type GACHA_TEN_COUNT,
  getCosmetic,
  isCosmeticId,
  RARITIES,
  type Rarity,
} from "@brain-rizz/shared";
import { hasStoredSession, loadSupabase, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { type ProfileForAccount, useAuth, withTimeout } from "@/stores/auth.store";
import type { DataFailure } from "./data-api";

/**
 * Phấn và máy quay phụ kiện (CR-023, docs/01-product/gacha-pets-unlocks.md mục 5.3): RPC
 * `my_wallet`, `claim_daily_chalk`, `gacha_pull`, `my_items`, `gacha_history`. Như `data-api.ts`:
 * không bao giờ ném lỗi, trả `GachaResult` để màn hình hiện đúng trạng thái. Số dư, kết quả quay,
 * sở hữu do Postgres quyết (RNG chạy trong `gacha_pull`); web chỉ hiển thị.
 */

export type GachaFailure =
  | DataFailure
  /** DB chưa chạy migration gacha (404 / PGRST202): hiện như "chưa kết nối máy chủ dữ liệu". */
  | "unavailable"
  /** `gacha_pull`: không đủ phấn (P0001 `insufficient`, vd. số dư đổi ở máy khác). */
  | "insufficient";

export type GachaResult<T> = { ok: true; data: T } | { ok: false; reason: GachaFailure };

export interface ChalkToday {
  /** Số phấn trận party đã cộng hôm nay (trần theo phấn). */
  party: number;
  /** Số lượt Kiểm tra não đã được cộng hôm nay. */
  brain: number;
  /** Số lượt luyện tập đã được cộng hôm nay. */
  practice: number;
}

export interface Wallet {
  balance: number;
  /** Số lần quay kể từ món Sử thi trở lên gần nhất (bảo hiểm). */
  sinceEpic: number;
  /** Số lần quay kể từ món Huyền thoại gần nhất. */
  sinceLegendary: number;
  totalPulls: number;
  /** Đã nhận quà hôm nay (ngày giờ Việt Nam). */
  dailyClaimed: boolean;
  today: ChalkToday;
}

/** Ví của người chưa có phiên: chưa có phấn, chưa quay. */
export const EMPTY_WALLET: Wallet = Object.freeze({
  balance: 0,
  sinceEpic: 0,
  sinceLegendary: 0,
  totalPulls: 0,
  dailyClaimed: false,
  today: Object.freeze({ party: 0, brain: 0, practice: 0 }),
});

export interface PullResult {
  itemId: CosmeticId;
  rarity: Rarity;
  /** Đã có từ trước (kể cả ra ở lần trước của cùng gói) → đổi lại `refund` phấn. */
  duplicate: boolean;
  refund: number;
}

export interface PullBatch {
  results: PullResult[];
  /** Số dư sau lượt quay (đã trừ giá, đã cộng phấn trùng). */
  balance: number;
  sinceEpic: number;
  sinceLegendary: number;
  /**
   * Gọi lại cùng mã yêu cầu (lượt đầu đã quay xong nhưng web chưa nhận được kết quả): máy chủ trả lại
   * đúng các món đã quay, không trừ phấn lần hai; số dư / bảo hiểm là số hiện tại.
   */
  replayed: boolean;
}

export interface GachaHistoryRow {
  id: number;
  batchId: string;
  itemId: CosmeticId;
  rarity: Rarity;
  duplicate: boolean;
  refund: number;
  createdAt: string;
}

export type PullCount = 1 | typeof GACHA_TEN_COUNT;

// ------------------------------------------------------------- chuẩn hoá dữ liệu

// biome-ignore lint/suspicious/noExplicitAny: dữ liệu Supabase chưa có kiểu sinh tự động; mọi dòng được kiểm và chuẩn hoá dưới đây
type Row = Record<string, any>;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const count = (v: unknown) => Math.max(0, Math.trunc(num(v)));
const str = (v: unknown) => (typeof v === "string" ? v : "");
const objOf = (v: unknown): Row => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const rowsOf = (v: unknown): Row[] =>
  Array.isArray(v) ? v.filter((r): r is Row => !!r && typeof r === "object") : [];

/** Độ hiếm từ server; lạ → lấy theo danh mục của món. */
function rarityOf(v: unknown, itemId: CosmeticId): Rarity {
  return (RARITIES as readonly unknown[]).includes(v)
    ? (v as Rarity)
    : (getCosmetic(itemId)?.rarity ?? "common");
}

/** JSON của `my_wallet` → `Wallet`; thiếu / sai kiểu → 0. Số dư có thể âm khi quản trị trừ: giữ nguyên. */
export function toWallet(raw: unknown): Wallet {
  const r = objOf(raw);
  const today = objOf(r.today);
  return {
    balance: Math.trunc(num(r.balance)),
    sinceEpic: count(r.since_epic),
    sinceLegendary: count(r.since_legendary),
    totalPulls: count(r.total_pulls),
    dailyClaimed: r.daily_claimed === true,
    today: {
      party: count(today.party),
      brain: count(today.brain),
      practice: count(today.practice),
    },
  };
}

/** JSON của `gacha_pull` → `PullBatch`; bỏ dòng có id món lạ (món đã gỡ khỏi code). */
export function toPullBatch(raw: unknown): PullBatch {
  const r = objOf(raw);
  return {
    results: rowsOf(r.results)
      .filter((x) => isCosmeticId(x.item_id))
      .map((x) => ({
        itemId: x.item_id as CosmeticId,
        rarity: rarityOf(x.rarity, x.item_id),
        duplicate: x.duplicate === true,
        refund: count(x.refund),
      })),
    balance: Math.trunc(num(r.balance)),
    sinceEpic: count(r.since_epic),
    sinceLegendary: count(r.since_legendary),
    replayed: r.replayed === true,
  };
}

/** `text[]` của `my_items` → id món có thật, không trùng, giữ thứ tự nhận. */
export function toItemIds(data: unknown): CosmeticId[] {
  const list = Array.isArray(data) ? data : [];
  return [...new Set(list.filter(isCosmeticId))];
}

export function toHistoryRow(r: Row): GachaHistoryRow | null {
  if (!isCosmeticId(r.item_id)) return null;
  return {
    id: num(r.id),
    batchId: str(r.batch_id),
    itemId: r.item_id,
    rarity: rarityOf(r.rarity, r.item_id),
    duplicate: r.duplicate === true,
    refund: count(r.refund),
    createdAt: str(r.created_at),
  };
}

// ------------------------------------------------------------- lỗi

/**
 * Lỗi RPC → lý do: DB chưa có hàm (PGRST202 / 404) → `unavailable`; `insufficient` (P0001);
 * hết phiên (28000, JWT sai / hết hạn, anon không có quyền gọi 42501) → `no-session`; còn lại `error`.
 */
export function rpcFailure(error: unknown, status?: number): GachaFailure {
  const e = objOf(error);
  const code = str(e.code);
  const message = str(e.message).trim();
  if (code === "PGRST202" || status === 404) return "unavailable";
  if (message === "insufficient") return "insufficient";
  if (["28000", "42501", "PGRST301", "PGRST303"].includes(code)) return "no-session";
  return "error";
}

// ------------------------------------------------------------- gọi mạng

const fail = (reason: GachaFailure): { ok: false; reason: GachaFailure } => ({ ok: false, reason });

type Sb = NonNullable<Awaited<ReturnType<typeof loadSupabase>>>;
type RpcResponse = { data: unknown; error: unknown; status?: number };

/**
 * DB chưa có các RPC máy quay (Supabase thật chưa chạy migration) → thôi gọi, mọi lời gọi trả
 * `unavailable` ngay, tới khi người dùng bấm "Thử lại" (`retryUnavailable`) hoặc tải lại trang.
 */
let unavailable = false;

/** "Thử lại" ở thẻ "Chưa kết nối máy chủ dữ liệu": bỏ cờ `unavailable` để lần gọi sau hỏi lại máy chủ. */
export function retryUnavailable() {
  unavailable = false;
}

/**
 * Gọi một RPC. `session`:
 * - `require`: cần phiên đang có (không tạo mới) → chưa có thì `no-session`.
 * - `probe`: không có phiên vẫn gọi bằng khoá công khai để biết DB đã có hàm chưa (anon không có
 *   quyền → 42501 → `no-session`; chưa có hàm → `unavailable`).
 */
async function rpc<T>(
  name: string,
  args: Record<string, unknown> | undefined,
  map: (data: unknown) => T,
  session: "require" | "probe" = "require",
): Promise<GachaResult<T>> {
  if (!SUPABASE_CONFIGURED) return fail("not-configured");
  if (unavailable) return fail("unavailable");
  const stored = hasStoredSession();
  if (session === "require" && !stored) return fail("no-session");
  try {
    const sb: Sb | null = await withTimeout(loadSupabase());
    if (!sb) return fail("not-configured");
    let hasSession = false;
    if (stored) {
      // Phiên còn trên máy nhưng có thể đã bị đăng xuất ở tab khác.
      const { data } = await withTimeout(sb.auth.getSession());
      hasSession = !!data.session;
    }
    if (!hasSession && session === "require") return fail("no-session");
    const res = (await withTimeout(Promise.resolve(sb.rpc(name, args)))) as RpcResponse;
    if (res.error) {
      const reason = rpcFailure(res.error, res.status);
      if (reason === "unavailable") unavailable = true;
      if (reason === "error") console.warn(`[gacha] Lỗi RPC ${name}:`, res.error);
      return fail(reason);
    }
    if (!hasSession) return fail("no-session");
    return { ok: true, data: map(res.data) };
  } catch (err) {
    console.warn(`[gacha] Lỗi RPC ${name}:`, err);
    return fail("error");
  }
}

/**
 * Ví của mình. `probe = true` (màn Máy quay): chưa có phiên vẫn hỏi để phân biệt "DB chưa có máy
 * quay" (`unavailable`) với "chưa có phiên" (`no-session` = ví trống). Menu để `false`: chưa có
 * phiên thì khỏi tải supabase-js.
 */
export function fetchWallet(probe = false): Promise<GachaResult<Wallet>> {
  return rpc("my_wallet", undefined, toWallet, probe ? "probe" : "require");
}

/**
 * Quà mỗi ngày: tạo phiên khách nếu chưa có (ví khách như ví Google), trả số phấn vừa cộng
 * (0 = hôm nay đã nhận, vd. ở máy khác).
 */
export async function claimDailyChalk(profile?: ProfileForAccount): Promise<GachaResult<number>> {
  if (!SUPABASE_CONFIGURED) return fail("not-configured");
  if (unavailable) return fail("unavailable");
  const token = await useAuth.getState().ensureSession(profile);
  if (!token) return fail("error");
  return rpc("claim_daily_chalk", undefined, count);
}

/**
 * Mã yêu cầu cho một lần bấm Quay (uuid v4). `crypto.randomUUID` chỉ có trong ngữ cảnh an toàn
 * (HTTPS / localhost); mở bản dev qua IP mạng LAN thì dựng từ `crypto.getRandomValues`.
 */
export function newPullRequestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Quay `count` lần (1 hoặc 10) với mã yêu cầu `requestId` (`newPullRequestId`, mỗi lần bấm Quay một
 * mã). Gọi lại cùng mã (Thử lại sau lỗi mạng / hết giờ chờ) → máy chủ trả đúng kết quả cũ kèm
 * `replayed`, không trừ phấn lần hai. Thiếu phấn → `insufficient`, phấn không bị trừ.
 */
export function gachaPull(n: PullCount, requestId: string): Promise<GachaResult<PullBatch>> {
  return rpc("gacha_pull", { p_count: n, p_request_id: requestId }, toPullBatch);
}

/** Món đã có, theo thứ tự nhận. */
export function fetchMyItems(): Promise<GachaResult<CosmeticId[]>> {
  return rpc("my_items", undefined, toItemIds);
}

/** Lịch sử quay của mình, mới nhất trước (`limit` 1–100, server cũng kẹp). */
export function fetchGachaHistory(limit = 30): Promise<GachaResult<GachaHistoryRow[]>> {
  return rpc("gacha_history", { p_limit: Math.min(100, Math.max(1, Math.trunc(limit))) }, (data) =>
    rowsOf(data)
      .map(toHistoryRow)
      .filter((r): r is GachaHistoryRow => r !== null),
  );
}
