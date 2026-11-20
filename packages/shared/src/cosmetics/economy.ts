/**
 * Kinh tế phấn (CR-023, docs/01-product/gacha-pets-unlocks.md mục 2 và 4; GDD mục "Kinh tế").
 * Phấn chỉ kiếm bằng chơi, không mua bằng tiền thật. Số liệu chỉnh bằng mô phỏng
 * `economy-sim.test.ts`; đổi số ở đây thì chạy lại mô phỏng, cập nhật bảng mục 4 của kế hoạch và
 * sửa migration Supabase (test `migration.test.ts` so từng hằng số có đánh dấu `@economy`).
 *
 * Mọi hàm thuần, tất định, chỉ dùng số nguyên. Game server tính thưởng trận party và Kiểm tra não
 * bằng `partyChalkReward` / `brainChalkReward` rồi gọi RPC `grant_chalk` (kẹp trần ngày trong
 * Postgres, như `capChalkGrant`). Quay máy chạy trong Postgres (RNG ở đó); `rollGachaRarity`,
 * `rollGachaBatch` và `pickGachaItem` là bản tham chiếu cùng thuật toán, dùng cho mô phỏng và để
 * đối chiếu SQL (ADR 0016).
 */
import { MAX_TOTAL_ROUNDS, MIN_TOTAL_ROUNDS } from "../constants";
import {
  COSMETIC_ITEMS,
  type CosmeticItem,
  cosmeticsByRarity,
  RARITIES,
  type Rarity,
} from "./catalog";

// ---------- Nguồn phấn ----------

/** Nguồn ghi sổ phấn (`chalk_ledger.source`). Số âm khi tiêu (`gacha`). */
export const CHALK_SOURCES = [
  "party",
  "brain",
  "practice",
  "daily",
  "gacha",
  "refund",
  "admin",
] as const;
export type ChalkSource = (typeof CHALK_SOURCES)[number];

/** Nguồn kiếm phấn bằng chơi, mỗi nguồn có trần ngày riêng (`CHALK_DAILY_CAPS`). */
export type EarnSource = "party" | "brain" | "practice";

/** Ngày tính trần và quà mỗi ngày theo giờ Việt Nam. */
export const CHALK_DAY_TIMEZONE = "Asia/Ho_Chi_Minh";

/**
 * Thưởng một trận party: `base + perRound × số vòng + placement[hạng]` (hạng 0 = nhất; ngoài top 3
 * không có thưởng hạng). Trận chỉ có 1 người thật (còn lại là bot) nhận `soloPercent` % (làm tròn
 * xuống). Trận 3 vòng: nhất 45 · nhì 37 · ba 33 · còn lại 25 (phòng 4 người: trung bình 35); một
 * mình với bot: 22 · 18 · 16 · 12. Thưởng hạng khiến trận ngắn lời hơn tính theo phút; trần ngày
 * `CHALK_DAILY_CAPS.party` chặn việc cày trận 1 vòng với bot Dễ.
 */
export const PARTY_CHALK = {
  base: 10,
  perRound: 5,
  placement: [20, 12, 8],
  soloPercent: 50,
} as const;

/** Thưởng một lượt Kiểm tra não: `base + floor(Điểm Não / perPoints)` — 30 … 80; Điểm Não 500 → 55. */
export const BRAIN_CHALK = {
  base: 30,
  perPoints: 20,
} as const;

/** Phấn mỗi lượt luyện tập (chấm trên máy nên thấp, trần theo số lượt). */
export const PRACTICE_CHALK = 5;

/** Quà mỗi ngày (một lần mỗi ngày giờ VN, nhận hay không tuỳ người, không có chuỗi). */
export const DAILY_BONUS = 20;

/**
 * Trần mỗi ngày theo nguồn (giờ VN). `maxChalk`: tổng phấn tối đa của nguồn trong ngày (lần cộng
 * làm vượt trần bị kẹp còn phần thiếu). `maxGrants`: số lần được cộng tối đa trong ngày (lần sau
 * nhận 0). Quà mỗi ngày là 1 lần, không nằm ở đây.
 */
export const CHALK_DAILY_CAPS: Readonly<
  Record<EarnSource, { readonly maxChalk?: number; readonly maxGrants?: number }>
> = {
  party: { maxChalk: 300 },
  brain: { maxGrants: 3 },
  practice: { maxGrants: 10 },
};

// ---------- Máy quay ----------

/** Giá một lần quay. */
export const GACHA_PRICE_SINGLE = 100;
/** Số lần của gói quay nhiều; gói này chắc có ≥ 1 món Hiếm trở lên. */
export const GACHA_TEN_COUNT = 10;
/** Giá gói `GACHA_TEN_COUNT` lần (rẻ hơn 10 % so với quay lẻ). */
export const GACHA_PRICE_TEN = 900;

/**
 * Tỉ lệ từng độ hiếm, số nguyên phần trăm (tổng 100). Bốc độ hiếm bằng
 * `floor(u × tổng trọng số của các độ hiếm được phép)`, xem `rollGachaRarity`.
 */
export const GACHA_RATES: Readonly<Record<Rarity, number>> = {
  common: 60,
  rare: 30,
  epic: 8,
  legendary: 2,
};

/**
 * Bảo hiểm: lần quay thứ `epic` kể từ món Sử thi trở lên gần nhất chắc ra Sử thi trở lên; lần thứ
 * `legendary` kể từ món Huyền thoại gần nhất chắc ra Huyền thoại. Bộ đếm (`gacha_state`) là số lần
 * đã quay mà chưa ra: `sinceEpic + 1 ≥ epic` thì lần này được bảo hiểm.
 */
export const GACHA_PITY = {
  epic: 15,
  legendary: 60,
} as const;

/** Trùng món đổi lại phấn theo độ hiếm. */
export const DUPLICATE_REFUND: Readonly<Record<Rarity, number>> = {
  common: 10,
  rare: 30,
  epic: 80,
  legendary: 200,
};

/** Bộ đếm bảo hiểm của một người (`gacha_state`). */
export interface GachaPityState {
  /** Số lần đã quay kể từ món Sử thi trở lên gần nhất. */
  sinceEpic: number;
  /** Số lần đã quay kể từ món Huyền thoại gần nhất. */
  sinceLegendary: number;
}

export const INITIAL_PITY_STATE: Readonly<GachaPityState> = Object.freeze({
  sinceEpic: 0,
  sinceLegendary: 0,
});

/**
 * Hằng số mà migration Supabase phải dùng đúng giá trị, theo tên đánh dấu. Quy ước (kế hoạch mục
 * 5.3): trong SQL, ngay sau mỗi chữ số / chuỗi dùng hằng số này đặt comment khối
 * `/* @economy <TÊN> *\/`, vd `100 /* @economy GACHA_PRICE_SINGLE *\/`,
 * `'Asia/Ho_Chi_Minh' /* @economy CHALK_DAY_TIMEZONE *\/`. Test `migration.test.ts` đòi mỗi tên
 * xuất hiện ít nhất một lần, giá trị khớp, và không có tên lạ.
 */
export const ECONOMY_SQL_CONSTANTS: Readonly<Record<string, number | string>> = {
  GACHA_PRICE_SINGLE,
  GACHA_PRICE_TEN,
  GACHA_TEN_COUNT,
  "GACHA_RATES.common": GACHA_RATES.common,
  "GACHA_RATES.rare": GACHA_RATES.rare,
  "GACHA_RATES.epic": GACHA_RATES.epic,
  "GACHA_RATES.legendary": GACHA_RATES.legendary,
  "GACHA_PITY.epic": GACHA_PITY.epic,
  "GACHA_PITY.legendary": GACHA_PITY.legendary,
  "DUPLICATE_REFUND.common": DUPLICATE_REFUND.common,
  "DUPLICATE_REFUND.rare": DUPLICATE_REFUND.rare,
  "DUPLICATE_REFUND.epic": DUPLICATE_REFUND.epic,
  "DUPLICATE_REFUND.legendary": DUPLICATE_REFUND.legendary,
  "CHALK_DAILY_CAPS.party.maxChalk": CHALK_DAILY_CAPS.party.maxChalk ?? 0,
  "CHALK_DAILY_CAPS.brain.maxGrants": CHALK_DAILY_CAPS.brain.maxGrants ?? 0,
  "CHALK_DAILY_CAPS.practice.maxGrants": CHALK_DAILY_CAPS.practice.maxGrants ?? 0,
  PRACTICE_CHALK,
  DAILY_BONUS,
  CHALK_DAY_TIMEZONE,
};

// ---------- Thưởng ----------

export interface PartyChalkInput {
  /** Số vòng của trận (`match_results.rounds`), kẹp về [MIN_TOTAL_ROUNDS, MAX_TOTAL_ROUNDS]. */
  rounds: number;
  /** Hạng chung cuộc, 0 = nhất (`match_results.placement`). */
  placement: number;
  /**
   * Số người thật trong phòng lúc vào vinh danh: số tài khoản (`user_id`) khác nhau trong các ghế
   * người đã xác thực + số ghế người chưa xác thực (khách, token sai); bot không tính, một tài khoản
   * mở hai thẻ chỉ tính một. ≤ 1 → trận một mình với bot, nhận `PARTY_CHALK.soloPercent` %.
   */
  humans: number;
}

/**
 * Phấn cho một người sau trận party, CHƯA kẹp trần ngày (Postgres kẹp trong `grant_chalk`).
 * Không bao giờ ném: số không hợp lệ được kẹp (vòng ngoài khoảng → biên, hạng âm/NaN → không có
 * thưởng hạng, `humans` NaN → coi như một mình).
 */
export function partyChalkReward({ rounds, placement, humans }: PartyChalkInput): number {
  const r = clampInt(rounds, MIN_TOTAL_ROUNDS, MAX_TOTAL_ROUNDS);
  const rank = Number.isFinite(placement) ? Math.trunc(placement) : -1;
  const bonus = rank >= 0 ? (PARTY_CHALK.placement[rank] ?? 0) : 0;
  const full = PARTY_CHALK.base + PARTY_CHALK.perRound * r + bonus;
  const solo = !(Number.isFinite(humans) && humans >= 2);
  return solo ? Math.floor((full * PARTY_CHALK.soloPercent) / 100) : full;
}

/** Phấn cho một lượt Kiểm tra não, CHƯA kẹp trần ngày. Điểm Não kẹp về [0, 1 000]. */
export function brainChalkReward(brainScore: number): number {
  const score = clampInt(brainScore, 0, 1_000);
  return BRAIN_CHALK.base + Math.floor(score / BRAIN_CHALK.perPoints);
}

/** Đã cộng hôm nay (giờ VN) của một nguồn: tổng phấn và số lần cộng. */
export interface ChalkToday {
  chalk: number;
  grants: number;
}

/**
 * Số phấn thực cộng sau khi kẹp trần ngày của nguồn — bản tham chiếu của `grant_chalk` trong
 * Postgres. Đã đủ số lần → 0; còn thiếu so với trần phấn → chỉ cộng phần còn thiếu. `amount` ≤ 0
 * hoặc không hợp lệ → 0.
 */
export function capChalkGrant(source: EarnSource, amount: number, today: ChalkToday): number {
  const want = clampInt(amount, 0, Number.MAX_SAFE_INTEGER);
  if (want === 0) return 0;
  const cap = CHALK_DAILY_CAPS[source];
  if (
    cap.maxGrants !== undefined &&
    clampInt(today.grants, 0, Number.MAX_SAFE_INTEGER) >= cap.maxGrants
  ) {
    return 0;
  }
  if (cap.maxChalk !== undefined) {
    const left = cap.maxChalk - clampInt(today.chalk, 0, Number.MAX_SAFE_INTEGER);
    return Math.max(0, Math.min(want, left));
  }
  return want;
}

// ---------- Quay ----------

/**
 * Các độ hiếm được phép ở lần quay này, theo thứ tự ưu tiên của bảo hiểm:
 * 1. tới hạn Huyền thoại → chỉ Huyền thoại;
 * 2. tới hạn Sử thi → Sử thi hoặc Huyền thoại (theo tỉ lệ 8 : 2);
 * 3. `guaranteeRare` (lần cuối của gói 10 mà 9 lần trước chưa ra Hiếm trở lên) → Hiếm trở lên
 *    (30 : 8 : 2);
 * 4. còn lại → cả bốn độ hiếm theo `GACHA_RATES`.
 */
export function gachaRarityPool(state: GachaPityState, guaranteeRare = false): readonly Rarity[] {
  if (state.sinceLegendary + 1 >= GACHA_PITY.legendary) return ["legendary"];
  if (state.sinceEpic + 1 >= GACHA_PITY.epic) return ["epic", "legendary"];
  if (guaranteeRare) return ["rare", "epic", "legendary"];
  return RARITIES;
}

/**
 * Bốc độ hiếm cho một lần quay từ số ngẫu nhiên đều `u` ∈ [0, 1): lấy
 * `r = floor(u × T)` với `T` = tổng trọng số `GACHA_RATES` của các độ hiếm trong `gachaRarityPool`,
 * rồi đi theo thứ tự common → legendary trừ dần trọng số. SQL làm y hệt với `random()`.
 */
export function rollGachaRarity(u: number, state: GachaPityState, guaranteeRare = false): Rarity {
  const pool = gachaRarityPool(state, guaranteeRare);
  const total = pool.reduce((sum, rarity) => sum + GACHA_RATES[rarity], 0);
  const unit = Number.isFinite(u) ? Math.min(Math.max(u, 0), 1 - Number.EPSILON) : 0;
  let r = Math.floor(unit * total);
  for (const rarity of pool) {
    if (r < GACHA_RATES[rarity]) return rarity;
    r -= GACHA_RATES[rarity];
  }
  return pool[pool.length - 1] ?? "common";
}

/** Bộ đếm bảo hiểm sau một lần ra `rarity`. */
export function advancePity(state: GachaPityState, rarity: Rarity): GachaPityState {
  if (rarity === "legendary") return { sinceEpic: 0, sinceLegendary: 0 };
  if (rarity === "epic") return { sinceEpic: 0, sinceLegendary: state.sinceLegendary + 1 };
  return { sinceEpic: state.sinceEpic + 1, sinceLegendary: state.sinceLegendary + 1 };
}

/**
 * Một lượt quay `uniforms.length` lần (1 hoặc `GACHA_TEN_COUNT`), mỗi lần dùng một số đều trong
 * [0, 1). Gói `GACHA_TEN_COUNT` lần: lần cuối được bảo hiểm Hiếm nếu các lần trước chưa ra Hiếm
 * trở lên. Trả độ hiếm từng lần và bộ đếm mới. Chọn món trong độ hiếm: `pickGachaItem`.
 */
export function rollGachaBatch(
  uniforms: readonly number[],
  state: GachaPityState,
): { rarities: Rarity[]; state: GachaPityState } {
  const rarities: Rarity[] = [];
  let current: GachaPityState = { ...state };
  const isTen = uniforms.length === GACHA_TEN_COUNT;
  uniforms.forEach((u, i) => {
    const guaranteeRare =
      isTen && i === uniforms.length - 1 && rarities.every((r) => r === "common");
    const rarity = rollGachaRarity(u, current, guaranteeRare);
    rarities.push(rarity);
    current = advancePity(current, rarity);
  });
  return { rarities, state: current };
}

/**
 * Chọn món cho một lần quay đã ra độ hiếm `rarity` — bản tham chiếu bước 4 của `gacha_pull`
 * (kế hoạch mục 4 "Huyền thoại không trùng tới khi đủ bộ", mục 5.3). Đều nhau trong các món của độ
 * hiếm đó (trùng được, đổi lại phấn); riêng **Huyền thoại** chỉ bốc trong các món Huyền thoại chưa có
 * trong `owned`, đủ cả rồi mới bốc đều. `u` ∈ [0, 1) chọn phần tử thứ `floor(u × n)` theo thứ tự
 * `COSMETIC_ITEMS` (SQL bốc bằng `order by random()`, cùng phân bố). Không bao giờ ném.
 *
 * Gói 10 lần: thêm món vừa ra vào `owned` trước lần kế tiếp (SQL ghi `user_items` từng lần), nên
 * hai lần ra Huyền thoại trong một gói cũng không trùng nhau khi còn món chưa có.
 */
export function pickGachaItem(
  u: number,
  rarity: Rarity,
  owned: ReadonlySet<string> = new Set(),
): CosmeticItem {
  const all = cosmeticsByRarity(rarity);
  const fresh = rarity === "legendary" ? all.filter((item) => !owned.has(item.id)) : all;
  const pool = fresh.length > 0 ? fresh : all;
  const unit = Number.isFinite(u) ? Math.min(Math.max(u, 0), 1 - Number.EPSILON) : 0;
  return pool[Math.floor(unit * pool.length)] ?? COSMETIC_ITEMS[0];
}

// ---------- nội bộ ----------

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
