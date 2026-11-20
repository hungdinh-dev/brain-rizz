import {
  COSMETIC_ITEMS,
  type CosmeticSlot,
  GACHA_PITY,
  GACHA_PRICE_SINGLE,
  GACHA_PRICE_TEN,
  GACHA_RATES,
  GACHA_TEN_COUNT,
  getCosmetic,
  RARITIES,
  type Rarity,
} from "@brain-rizz/shared";
import type { PullBatch, PullCount, PullResult, Wallet } from "@/net/gacha-api";

/**
 * Hàm thuần cho màn Máy quay (có test): tóm tắt kết quả, món "Mặc thử", số lượt còn tới bảo hiểm,
 * tỉ lệ mỗi món, Thử lại sau lỗi quay, ví hiện trên màn lúc quay. Số đọc từ `economy.ts` / danh mục
 * shared — giao diện không viết cứng.
 */

export const PULL_PRICE: Record<PullCount, number> = {
  1: GACHA_PRICE_SINGLE,
  [GACHA_TEN_COUNT]: GACHA_PRICE_TEN,
};

/**
 * Lượt quay chưa rõ kết quả (lỗi mạng / hết giờ chờ): máy chủ có thể đã quay xong. "Thử lại" gửi lại
 * đúng mã này → máy chủ trả kết quả cũ, không trừ phấn lần hai.
 */
export interface PendingPull {
  id: string;
  count: PullCount;
}

export type RetryPlan =
  | { kind: "replay"; pull: PendingPull }
  | { kind: "fresh"; count: PullCount }
  | { kind: "insufficient" };

/**
 * "Thử lại" sau lỗi quay (màn đã đọc lại ví): còn mã cũ → gửi lại đúng mã đó, không cần kiểm số dư
 * (gọi lại không trừ phấn); không còn mã → lượt mới, phải đủ phấn cho `count` lượt.
 */
export function retryPlan(
  pending: PendingPull | null,
  count: PullCount,
  balance: number,
): RetryPlan {
  if (pending) return { kind: "replay", pull: pending };
  return balance >= PULL_PRICE[count] ? { kind: "fresh", count } : { kind: "insufficient" };
}

/**
 * Ví hiện trên màn Máy quay. `frozen` = ví lúc bấm Quay, giữ từ lúc bấm tới khi mở hết quà (kể cả
 * lúc chờ Thử lại): thanh bảo hiểm về 0 hay số dư được cộng phấn trùng trước khi mở là lộ độ hiếm.
 * Đang mở quà: số dư = sau khi trừ giá, phấn trùng cộng khi mở hết (bản mẫu).
 */
export function walletOnScreen({
  wallet,
  frozen,
  batch,
  openedAll,
}: {
  wallet: Wallet | null;
  frozen: Wallet | null;
  batch: PullBatch | null;
  openedAll: boolean;
}): { wallet: Wallet | null; balance: number } {
  const shown = frozen ?? wallet;
  const balance =
    batch && !openedAll
      ? batch.balance - summarizePulls(batch.results).refund
      : (shown?.balance ?? 0);
  return { wallet: shown, balance };
}

interface Focusable {
  readonly isConnected: boolean;
  readonly disabled?: boolean;
  focus(options?: FocusOptions): void;
}

/**
 * Đưa tiêu điểm về phần tử đầu tiên còn trên trang và không bị tắt (đóng hộp thoại / màn mở quà →
 * trả về nút đã mở nó). Trả `false` nếu không có phần tử nào nhận được.
 */
export function focusFirst(candidates: readonly (Focusable | null | undefined)[]): boolean {
  for (const el of candidates) {
    if (!el?.isConnected || el.disabled) continue;
    el.focus({ preventScroll: true });
    return true;
  }
  return false;
}

/** Số món mỗi độ hiếm trong danh mục (Thường 9 · Hiếm 8 · Sử thi 4 · Huyền thoại 3). */
export function itemsOfRarity(rarity: Rarity): number {
  return COSMETIC_ITEMS.filter((item) => item.rarity === rarity).length;
}

/** Tỉ lệ ra một món cụ thể trong một lượt thường (%, chưa làm tròn). */
export function itemShare(rarity: Rarity): number {
  const n = itemsOfRarity(rarity);
  return n > 0 ? GACHA_RATES[rarity] / n : 0;
}

/** Số lượt nữa chắc chắn tới bảo hiểm (lượt thứ `max` kể từ lần gần nhất), luôn ≥ 1. */
export function pityLeft(since: number, max: number): number {
  return Math.max(1, max - Math.max(0, since));
}

export interface PityBar {
  rarity: Extract<Rarity, "epic" | "legendary">;
  since: number;
  max: number;
  left: number;
}

/** Hai thanh bảo hiểm: Sử thi trở lên, Huyền thoại. `since` kẹp trong [0, max − 1]. */
export function pityBars(sinceEpic: number, sinceLegendary: number): PityBar[] {
  const bar = (rarity: PityBar["rarity"], since: number, max: number): PityBar => {
    const s = Math.min(max - 1, Math.max(0, since));
    return { rarity, since: s, max, left: pityLeft(s, max) };
  };
  return [
    bar("epic", sinceEpic, GACHA_PITY.epic),
    bar("legendary", sinceLegendary, GACHA_PITY.legendary),
  ];
}

export interface PullSummary {
  newCount: number;
  dupCount: number;
  /** Tổng phấn trùng đổi lại. */
  refund: number;
}

export function summarizePulls(results: readonly PullResult[]): PullSummary {
  let newCount = 0;
  let dupCount = 0;
  let refund = 0;
  for (const r of results) {
    if (r.duplicate) {
      dupCount++;
      refund += r.refund;
    } else newCount++;
  }
  return { newCount, dupCount, refund };
}

/**
 * Món cho nút "Mặc thử": món hiếm nhất vừa ra; cùng độ hiếm thì ưu tiên món mới, rồi món ra trước.
 */
export function rarestPull(results: readonly PullResult[]): PullResult | undefined {
  let best: PullResult | undefined;
  for (const r of results) {
    if (!best) {
      best = r;
      continue;
    }
    const diff = RARITIES.indexOf(r.rarity) - RARITIES.indexOf(best.rarity);
    if (diff > 0 || (diff === 0 && best.duplicate && !r.duplicate)) best = r;
  }
  return best;
}

/** Chỗ đeo của một món (để mở Tủ đồ đúng chỗ). */
export function slotOf(itemId: string): CosmeticSlot | undefined {
  return getCosmetic(itemId)?.slot;
}
