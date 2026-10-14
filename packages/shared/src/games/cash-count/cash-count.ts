import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Đếm tiền nhanh (nhóm Tính toán): cộng các tờ tiền trên bàn rồi chọn tổng đúng trong 4 thẻ.
 * Siêu khó đổi sang tính tiền thối: tổng các tờ khách đưa trừ hoá đơn.
 * Đặc tả: docs/04-minigames/cash-count.md.
 *
 * Mọi số tiền tính bằng đồng (số nguyên, bội của 1 000). Mọi thứ ngẫu nhiên đi qua `createRng`,
 * không dùng Math.random() hay Date.now().
 */

/** `"sum"`: tổng các tờ trên bàn (Mầm–Khó). `"change"`: tiền thối = tiền khách đưa − hoá đơn (Siêu khó). */
export type CashCountMode = "sum" | "change";

export interface CashCountPuzzle {
  mode: CashCountMode;
  /**
   * Mệnh giá từng tờ (đồng), theo thứ tự ô trên bàn: Mầm một cột từ trên xuống, Thường và Khó
   * lưới 2 cột đọc theo hàng (`0 1 / 2 3 / 4 5`). Ở `"change"` là các tờ khách đưa, một cột bên trái.
   * Mỗi giá trị thuộc `CASH_DENOMINATIONS`.
   */
  bills: number[];
  /** Độ nghiêng của từng tờ (độ, một trong −4, −3, −2, 2, 3, 4), cùng độ dài `bills`. Chỉ trang trí. */
  tilts: number[];
  /** Hoá đơn (đồng) ở `"change"`, luôn có hàng nghìn khác 0 (vd. 286 000). Ở `"sum"` là 0. */
  receipt: number;
  /** 4 số tiền (đồng) tăng dần ngặt, vẽ lưới 2×2 đọc theo hàng. Mọi số đều dương. */
  options: number[];
  /** Chỉ số thẻ đúng trong `options`. */
  answerIndex: number;
}

/** Đáp án = chỉ số thẻ người chơi chạm trong `options` (0–3). */
export type CashCountAnswer = number;

/** Mệnh giá tiền giấy dùng trong game (đồng), tăng dần. Tờ lớn vẽ dài hơn. */
export const CASH_DENOMINATIONS = [
  1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000,
] as const;

const OPTION_COUNT = 4;
const TILTS = [-4, -3, -2, 2, 3, 4] as const;

/** Mầm: 3 tờ không trùng trong các mệnh giá này → tổng ≤ 17 000. */
const SEEDLING_DENOMS = [1_000, 2_000, 5_000, 10_000];
/** Thường: 5 tờ trong các mệnh giá này, mỗi mệnh giá tối đa 2 tờ. */
const NORMAL_DENOMS = [1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000];
/** Siêu khó: khách đưa 2–3 tờ không trùng trong các mệnh giá này, tổng ≥ `MIN_PAID`. */
const PAID_DENOMS = [10_000, 20_000, 50_000, 100_000, 200_000, 500_000];
const MIN_PAID = 200_000;
/** Siêu khó: thẻ nhiễu = tiền thối ± một tờ "thối nhầm" trong các mệnh giá này. */
const CHANGE_SLIPS = [10_000, 20_000, 50_000, 100_000];
/**
 * Siêu khó: hàng chục nghìn nhỏ nhất của tiền thối, theo số thẻ nhiễu nhỏ hơn đáp án (0–3), để
 * đủ tờ "thối nhầm" nhỏ hơn tiền thối: 1 cần > 10 000, 2 cần > 20 000, 3 cần > 50 000.
 */
const CHANGE_MIN_TENS = [1, 1, 2, 5] as const;

/** Miễn trừ thưởng tốc độ (CR-006): cho mỗi tờ sau tờ thứ hai, và cho phép trừ ở Siêu khó. */
const BILL_ALLOWANCE_MS = 500;
const CHANGE_ALLOWANCE_MS = 2_000;

/** Chọn `k` phần tử khác vị trí: xáo rồi lấy `k` phần tử đầu (không thử lại nên luôn dừng). */
function sample<T>(rng: Rng, items: readonly T[], k: number): T[] {
  return rng.shuffle(items).slice(0, k);
}

/** Mỗi mệnh giá lặp `copies` lần, để rút không hoàn lại mà không quá `copies` tờ cùng loại. */
function stack(denoms: readonly number[], copies: number): number[] {
  return denoms.flatMap((d) => Array<number>(copies).fill(d));
}

const descending = (values: number[]) => [...values].sort((a, b) => b - a);
const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

/** Mọi tập `size` mệnh giá khác nhau trong `PAID_DENOMS` có tổng ≥ `MIN_PAID`, mỗi tập giảm dần. */
function paidSets(size: number): number[][] {
  const out: number[][] = [];
  const walk = (start: number, picked: number[]) => {
    if (picked.length === size) {
      if (sum(picked) >= MIN_PAID) out.push(descending(picked));
      return;
    }
    for (let i = start; i < PAID_DENOMS.length; i++) walk(i + 1, [...picked, PAID_DENOMS[i]!]);
  };
  walk(0, []);
  return out;
}
const PAID_SETS: Readonly<Record<2 | 3, number[][]>> = { 2: paidSets(2), 3: paidSets(3) };

/** Mầm: 3 tờ khác mệnh giá trong 1 000–10 000, xếp từ lớn đến nhỏ. */
function seedlingBills(rng: Rng): number[] {
  return descending(sample(rng, SEEDLING_DENOMS, 3));
}

/** Thường: 5 tờ 1 000–100 000, mỗi mệnh giá ≤ 2 tờ (nên ≥ 3 mệnh giá khác nhau), xếp từ lớn đến nhỏ. */
function normalBills(rng: Rng): number[] {
  return descending(sample(rng, stack(NORMAL_DENOMS, 2), 5));
}

/**
 * Khó: 6 tờ 1 000–500 000, luôn có ít nhất một cặp trùng, mỗi mệnh giá ≤ 2 tờ (nên ≥ 3 mệnh giá
 * khác nhau), xếp từ lớn đến nhỏ. Chọn cặp trùng trước rồi rút 4 tờ còn lại, không cần thử lại.
 */
function hardBills(rng: Rng): number[] {
  const pair = rng.pick(CASH_DENOMINATIONS);
  const rest = sample(
    rng,
    stack(
      CASH_DENOMINATIONS.filter((d) => d !== pair),
      2,
    ),
    4,
  );
  return descending([pair, pair, ...rest]);
}

/** Cách rút tờ cho các mức tính tổng (Mầm, Thường, Khó). */
const SUM_BILLS: Readonly<Record<Exclude<Difficulty, 3>, (rng: Rng) => number[]>> = {
  0: seedlingBills,
  1: normalBills,
  2: hardBills,
};

interface Draft {
  bills: number[];
  receipt: number;
  correct: number;
  /** Các khoản lệch ứng viên cho thẻ nhiễu nằm DƯỚI đáp án (đều < `correct`), đôi một khác nhau. */
  below: number[];
  /** Các khoản lệch ứng viên cho thẻ nhiễu nằm TRÊN đáp án, đôi một khác nhau. */
  above: number[];
}

/**
 * Câu tính tổng: thẻ nhiễu = tổng ± giá trị một tờ đang có trên bàn (sót một tờ / đếm một tờ hai
 * lần). Bàn luôn có ≥ 3 mệnh giá khác nhau và mỗi mệnh giá nhỏ hơn tổng, nên đủ 3 khoản mỗi phía.
 */
function sumDraft(bills: number[]): Draft {
  const distinct = [...new Set(bills)];
  return { bills, receipt: 0, correct: sum(bills), below: distinct, above: distinct };
}

/**
 * Siêu khó, tiền thối. `below` = số thẻ nhiễu cần nằm dưới đáp án: chọn hàng chục nghìn của tiền
 * thối đủ lớn để có ít nhất ngần ấy tờ "thối nhầm" nhỏ hơn nó.
 */
function changeDraft(rng: Rng, below: number): Draft {
  const size = rng.int(2, 3) as 2 | 3;
  const bills = rng.pick(PAID_SETS[size]);
  const paid = sum(bills);
  // Tiền thối 11 000–99 000, hàng nghìn khác 0. Tiền đưa là bội của 10 000 nên hoá đơn cũng có
  // hàng nghìn khác 0 (số "lẻ nghìn"), và phép trừ luôn phải mượn ở hàng nghìn. Tiền thối lớn hơn
  // phần dưới 100 000 của tiền đưa (vd. 350 000 → > 50 000), nên phép trừ mượn thêm ở hàng chục
  // nghìn: luôn mượn ít nhất hai lần. Phần đó ≤ 90 000 nên hàng chục nghìn luôn chọn được.
  const tail = (paid % 100_000) / 10_000;
  const tens = rng.int(Math.max(CHANGE_MIN_TENS[below]!, tail), 9);
  const units = rng.int(1, 9);
  const correct = (tens * 10 + units) * 1_000;
  return {
    bills,
    receipt: paid - correct,
    correct,
    below: CHANGE_SLIPS.filter((d) => d < correct),
    above: [...CHANGE_SLIPS],
  };
}

export const cashCount: MinigameDef<CashCountPuzzle, CashCountAnswer> = {
  id: "cash-count",
  category: "compute",
  durationMs: 60_000,

  /**
   * Hệ số điểm (CR-006): người chơi đúng sức ở mỗi mức (Mầm: trẻ 7 tuổi, mức khác: người lớn) được
   * điểm vòng xấp xỉ người lớn ở Thường, tính từ mô phỏng ở mục Cân bằng của đặc tả. Mầm không cao
   * hơn Thường (PM chốt chung: hệ số không giảm khi lên mức). Chốt lại sau buổi chơi thử.
   */
  difficultyMultiplier: { 0: 1, 1: 1, 2: 1.4, 3: 1.8 },

  /** Miễn trừ thưởng tốc độ (CR-006): 0,5 s mỗi tờ sau tờ thứ hai, thêm 2 s cho phép trừ tiền thối. */
  speedAllowanceMs(puzzle) {
    const extraBills = Math.max(0, puzzle.bills.length - 2);
    return BILL_ALLOWANCE_MS * extraBills + (puzzle.mode === "change" ? CHANGE_ALLOWANCE_MS : 0);
  },

  generate(roundSeed, index, difficulty) {
    // Hai nguồn ngẫu nhiên: `rng` cho số tiền và thẻ, `deco` cho độ nghiêng (chỉ trang trí).
    const rng = createRng(deriveSeed(roundSeed, index));
    const deco = createRng(deriveSeed(roundSeed, index, 1));

    // Chọn trước vị trí đáp án (= số thẻ nhiễu nhỏ hơn nó) để 4 ô có tần suất đúng như nhau.
    const below = rng.int(0, OPTION_COUNT - 1);
    const draft = difficulty === 3 ? changeDraft(rng, below) : sumDraft(SUM_BILLS[difficulty](rng));

    // Khoản lệch mỗi phía đôi một khác nhau và > 0 → 4 thẻ đôi một khác nhau, đều dương.
    const lower = sample(rng, draft.below, below).map((d) => draft.correct - d);
    const upper = sample(rng, draft.above, OPTION_COUNT - 1 - below).map((d) => draft.correct + d);
    const options = [...lower, draft.correct, ...upper].sort((a, b) => a - b);

    return {
      mode: difficulty === 3 ? "change" : "sum",
      bills: draft.bills,
      tilts: draft.bills.map(() => deco.pick(TILTS)),
      receipt: draft.receipt,
      options,
      answerIndex: options.indexOf(draft.correct),
    };
  },

  check(puzzle, answer) {
    return answer === puzzle.answerIndex;
  },

  isAnswer(value): value is CashCountAnswer {
    return Number.isInteger(value) && (value as number) >= 0 && (value as number) < OPTION_COUNT;
  },
};
