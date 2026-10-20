import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed } from "../../rng";
import type { MinigameDef } from "../types";
import { SHADOW_BIG_DECOYS, SHADOW_ITEMS, SHADOW_SMALL_DECOYS, type ShadowItem } from "./items";

export * from "./items";

/**
 * Bóng của ai (nhóm Nhận diện): trên cùng là một đồ vật có màu, bên dưới là các bóng đen; chạm
 * vào bóng duy nhất có đúng hình dạng của đồ vật. Bóng có thể bị xoay (từ Khó) và lật gương (Siêu
 * khó); bóng đúng bị xoay/lật vẫn là đúng, mồi luôn khác hình chứ không chỉ khác hướng.
 * Đặc tả: docs/04-minigames/shadow-match.md.
 *
 * Mọi thứ ngẫu nhiên đi qua `rng`; số lần gọi `rng` cố định theo mức (không có vòng thử lại).
 */

/** Góc xoay của bóng (độ, chiều kim đồng hồ trên màn hình). */
export type ShadowRotation = 0 | 90 | 180 | 270;

export interface ShadowMatchOption {
  /** Vật của bóng: là `puzzle.item` hoặc (Mầm, Thường) một vật khác. */
  item: ShadowItem;
  /** 0 = hình gốc; 1–2 mồi chi tiết lớn; 3–6 mồi chi tiết nhỏ (xem `SHADOW_ITEM_DEFS`). */
  variant: number;
  /**
   * Cách vẽ: vẽ vật thẳng đứng, nếu `flipped` thì lật gương ngang (scaleX = −1), RỒI xoay
   * `rotation` độ theo chiều kim đồng hồ quanh tâm khung vẽ của vật.
   */
  rotation: ShadowRotation;
  flipped: boolean;
}

export interface ShadowMatchPuzzle {
  /** Đồ vật có màu ở thẻ đề, luôn vẽ hình gốc (biến thể 0), thẳng đứng, không lật. */
  item: ShadowItem;
  /** 3 / 4 / 6 / 6 bóng theo thứ tự ô: trái → phải, trên → dưới. */
  options: ShadowMatchOption[];
  /** Ô của bóng đúng (bóng duy nhất có `item = puzzle.item` và `variant = 0`). */
  answerIndex: number;
}

/** Đáp án = chỉ số ô bóng người chơi chạm (số nguyên 0–5). */
export type ShadowMatchAnswer = number;

export const SHADOW_MATCH_OPTIONS: Readonly<Record<Difficulty, number>> = {
  0: 3,
  1: 4,
  2: 6,
  3: 6,
};
export const SHADOW_MATCH_MAX_OPTIONS = 6;

/** Góc xoay dùng cho MỌI bóng (kể cả bóng đúng) từ Khó. Mầm, Thường: luôn 0. */
export const SHADOW_MATCH_ROTATIONS: readonly ShadowRotation[] = [90, 180, 270];

/** Muối cho luồng ngẫu nhiên chọn vật đề theo khối 8 câu (tách khỏi luồng của từng câu). */
const ITEM_SALT = 0x5ad0;

/**
 * Vật đề của câu `index`: mỗi khối 8 câu liên tiếp là một hoán vị của 8 vật (mỗi vật đúng một
 * lần), và không bao giờ hai câu liền nhau trùng vật (kể cả chỗ nối hai khối). Chỉ phụ thuộc
 * (roundSeed, index), không phụ thuộc độ khó.
 */
function blockOrder(roundSeed: number, block: number): ShadowItem[] {
  const order = createRng(deriveSeed(roundSeed, block, ITEM_SALT)).shuffle(SHADOW_ITEMS);
  if (block > 0) {
    const prev = createRng(deriveSeed(roundSeed, block - 1, ITEM_SALT)).shuffle(SHADOW_ITEMS);
    // Vật cuối khối trước trùng vật đầu khối này → đổi chỗ hai vật đầu khối này.
    if (order[0] === prev[prev.length - 1]) [order[0], order[1]] = [order[1]!, order[0]!];
  }
  return order;
}

export function shadowMatchItem(roundSeed: number, index: number): ShadowItem {
  const n = SHADOW_ITEMS.length;
  return blockOrder(roundSeed, Math.floor(index / n))[index % n]!;
}

const BIG_VARIANTS = Array.from({ length: SHADOW_BIG_DECOYS }, (_, i) => 1 + i);
const SMALL_VARIANTS = Array.from(
  { length: SHADOW_SMALL_DECOYS },
  (_, i) => 1 + SHADOW_BIG_DECOYS + i,
);

const upright = (item: ShadowItem, variant: number): ShadowMatchOption => ({
  item,
  variant,
  rotation: 0,
  flipped: false,
});

export const shadowMatch: MinigameDef<ShadowMatchPuzzle, ShadowMatchAnswer> = {
  id: "shadow-match",
  category: "identify",
  // CR-006: vòng 60 giây như các game mới, Siêu khó vẫn còn ~11 câu mỗi vòng.
  durationMs: 60_000,
  // CR-006: mô phỏng ở mục Cân bằng của đặc tả (người chơi đúng sức mỗi mức ≈ người lớn ở Thường;
  // Mầm = min(mô phỏng cho trẻ 7 tuổi, 1)). Chốt lại sau buổi chơi thử.
  difficultyMultiplier: { 0: 1, 1: 1, 2: 2.55, 3: 4 },
  // Không khai báo `speedAllowanceMs`: không có pha trình chiếu, một chạm là xong (đặc tả).

  generate(roundSeed, index, difficulty) {
    const rng = createRng(deriveSeed(roundSeed, index));
    const item = shadowMatchItem(roundSeed, index);
    const others = SHADOW_ITEMS.filter((it) => it !== item);

    // Danh sách bóng; phần tử 0 luôn là bóng đúng.
    let list: ShadowMatchOption[];
    if (difficulty === 0) {
      // Mầm: 2 vật khác, hình gốc.
      const [a, b] = rng.shuffle(others);
      list = [upright(item, 0), upright(a!, 0), upright(b!, 0)];
    } else if (difficulty === 1) {
      // Thường: 2 mồi lớn của chính vật + hình gốc của 1 vật khác.
      list = [
        upright(item, 0),
        ...BIG_VARIANTS.map((v) => upright(item, v)),
        upright(rng.pick(others), 0),
      ];
    } else {
      // Khó: 2 mồi lớn + 3 trong 4 mồi nhỏ. Siêu khó: 1 trong 2 mồi lớn + cả 4 mồi nhỏ.
      const variants =
        difficulty === 2
          ? [0, ...BIG_VARIANTS, ...rng.shuffle(SMALL_VARIANTS).slice(0, 3)]
          : [0, rng.pick(BIG_VARIANTS), ...SMALL_VARIANTS];
      list = variants.map((variant) => ({
        item,
        variant,
        rotation: rng.pick(SHADOW_MATCH_ROTATIONS),
        flipped: difficulty === 3 ? rng.int(0, 1) === 1 : false,
      }));
    }

    // Xáo vị trí ô.
    const order = rng.shuffle(list.map((_, i) => i));
    return {
      item,
      options: order.map((i) => list[i]!),
      answerIndex: order.indexOf(0),
    };
  },

  check(puzzle, answer) {
    return answer === puzzle.answerIndex;
  },

  isAnswer(value): value is ShadowMatchAnswer {
    return (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value < SHADOW_MATCH_MAX_OPTIONS
    );
  },
};
