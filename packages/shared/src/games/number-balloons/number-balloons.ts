import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Bóng bay số (nhóm Tính toán): nổ các quả bóng lần lượt theo giá trị từ nhỏ đến lớn.
 * Mức cao có số âm và bóng mang phép tính (+, −, ×). Đặc tả: docs/04-minigames/number-balloons.md.
 *
 * Mọi thứ ngẫu nhiên đi qua `createRng`, không dùng Math.random() hay Date.now().
 */

/** Loại bóng: số đơn, hoặc phép tính `a + b`, `a − b`, `a × b`. */
export type BalloonKind = "num" | "add" | "sub" | "mul";

/** Một quả bóng trên sân. */
export interface Balloon {
  /**
   * Loại bóng. Shared không chứa chữ hiển thị: scene tự vẽ ký hiệu
   * `+`, `−` (U+2212, không dùng gạch ngắn), `×` (không dùng chữ x).
   */
  kind: BalloonKind;
  /** Bóng `num`: chính là số hiển thị (bằng `value`). Bóng phép tính: toán hạng trái. */
  a: number;
  /** Toán hạng phải; bóng `num` luôn là 0. */
  b: number;
  /**
   * Giá trị thật sau khi tính (`a`, `a + b`, `a − b` hoặc `a × b`). Số nguyên, đôi một khác
   * nhau trong một câu. Bóng phép tính bay **giá trị này** vào khay khi nổ đúng.
   */
  value: number;
  /** Ô lưới chứa bóng, đánh số theo hàng từ góc trên trái: 0 … cols × rows − 1. Đôi một khác nhau. */
  slot: number;
  /** Màu bóng 0–5, đôi một khác nhau trong câu. Chỉ trang trí, không liên quan giá trị. */
  color: number;
  /** Độ lệch tĩnh khỏi tâm ô theo trục ngang, bậc −2…2 (scene nhân 6 px thiết kế). */
  dx: number;
  /** Độ lệch tĩnh khỏi tâm ô theo trục dọc, bậc −2…2 (scene nhân 6 px thiết kế). */
  dy: number;
  /** Pha lắc lư 0–359 (độ), để các bóng lắc lệch nhịp nhau. */
  phase: number;
}

/** Một câu đố: `balloons.length` bóng đặt trên lưới `cols` × `rows`. */
export interface NumberBalloonsPuzzle {
  /** Số cột của lưới (Mầm 2, Thường 3, Khó 3, Siêu khó 2). */
  cols: number;
  /** Số hàng của lưới (mọi mức đều 3). */
  rows: number;
  /** Các bóng; chỉ số trong mảng này là thứ client gửi lên trong đáp án. Mầm 3 bóng, mức khác 5. */
  balloons: Balloon[];
  /**
   * Thứ tự đúng: chỉ số bóng trong `balloons`, xếp theo `value` tăng dần.
   * Lần chạm thứ `k` (đếm từ 0) đúng khi chạm bóng `order[k]`. Khi người chơi sai, scene dùng
   * mảng này để khoanh quả lẽ ra phải chạm và đánh số thứ tự cho các bóng còn lại.
   */
  order: number[];
}

/**
 * Đáp án = chỉ số các bóng (trong `balloons`) theo thứ tự đã chạm, gửi đúng một lần mỗi câu:
 * nổ hết đúng thứ tự thì gửi đủ `balloons.length` phần tử; chạm nhầm thì gửi ngay mảng tính tới
 * và gồm cả quả nhầm (mảng này luôn sai), rồi khoá.
 */
export type NumberBalloonsAnswer = number[];

/** Số bóng nhiều nhất trong một câu, cũng là độ dài tối đa của đáp án. */
const MAX_BALLOONS = 5;
/** Số màu bóng (chỉ trang trí). */
const COLOR_COUNT = 6;
/** Độ lệch tĩnh lớn nhất khỏi tâm ô, tính theo bậc. */
const MAX_OFFSET = 2;

/** Miễn trừ thưởng tốc độ (CR-006): cho mỗi lần chạm sau lần đầu và cho mỗi bóng phép tính. */
const TAP_ALLOWANCE_MS = 500;
const OPERATION_ALLOWANCE_MS = 1_000;

interface Level {
  cols: number;
  rows: number;
  values(rng: Rng): Draft[];
}

/** Bóng trước khi gắn bố cục. */
type Draft = Pick<Balloon, "kind" | "a" | "b" | "value">;

type OperationKind = Exclude<BalloonKind, "num">;
const OPERATIONS: readonly OperationKind[] = ["add", "sub", "mul"];

function range(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

/** Chọn `k` phần tử khác nhau: xáo rồi lấy `k` phần tử đầu (không thử lại nên luôn dừng). */
function sample<T>(rng: Rng, items: readonly T[], k: number): T[] {
  return rng.shuffle(items).slice(0, k);
}

function plain(value: number): Draft {
  return { kind: "num", a: value, b: 0, value };
}

/** Mọi cặp toán hạng (a, b) cho `a op b = value`: + và − dùng [2, 20], × dùng [2, 9]. */
function operandPairs(kind: OperationKind, value: number): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  if (kind === "mul") {
    for (let a = 2; a <= 9; a++) {
      const b = value / a;
      if (Number.isInteger(b) && b >= 2 && b <= 9) pairs.push([a, b]);
    }
    return pairs;
  }
  for (let a = 2; a <= 20; a++) {
    const b = kind === "add" ? value - a : a - value;
    if (b >= 2 && b <= 20) pairs.push([a, b]);
  }
  return pairs;
}

/**
 * Gắn một phép tính cho giá trị `value`: chọn đều một phép dùng được (ưu tiên khác `avoid`
 * nếu còn lựa chọn), rồi chọn đều một cặp toán hạng. Với `value` ∈ [−15, 25] luôn có ít nhất
 * phép − (phủ [−18, 18]) hoặc phép + (phủ [4, 40]).
 */
function operation(
  rng: Rng,
  value: number,
  avoid?: OperationKind,
): Draft & { kind: OperationKind } {
  const usable = OPERATIONS.filter((kind) => operandPairs(kind, value).length > 0);
  const preferred = usable.filter((kind) => kind !== avoid);
  const kind = rng.pick(preferred.length > 0 ? preferred : usable);
  const [a, b] = rng.pick(operandPairs(kind, value));
  return { kind, a, b, value };
}

/** Mầm: 3 số trong [1, 20], hai số liền kề (theo giá trị) cách nhau ≥ 2. */
function seedlingValues(rng: Rng): Draft[] {
  return sample(rng, range(1, 18), 3)
    .sort((x, y) => x - y)
    .map((v, i) => plain(v + i));
}

/** Thường: 5 số trong [10, 99], luôn có một cặp cùng hàng chục. */
function normalValues(rng: Rng): Draft[] {
  const tens = rng.int(1, 9);
  const pair = sample(rng, range(0, 9), 2).map((unit) => tens * 10 + unit);
  const rest = sample(
    rng,
    range(10, 99).filter((v) => !pair.includes(v)),
    3,
  );
  return [...pair, ...rest].map(plain);
}

/** Khó: 5 số trong [−50, 50], 2–3 số âm, luôn có một cặp số âm cùng hàng chục. */
function hardValues(rng: Rng): Draft[] {
  const negatives = rng.int(2, 3);
  const tens = rng.int(1, 4);
  const pair = sample(rng, range(0, 9), 2).map((unit) => -(tens * 10 + unit));
  const moreNegatives = sample(
    rng,
    range(-50, -1).filter((v) => !pair.includes(v)),
    negatives - 2,
  );
  const nonNegatives = sample(rng, range(0, 50), 5 - negatives);
  return [...pair, ...moreNegatives, ...nonNegatives].map(plain);
}

/**
 * Siêu khó: 5 giá trị trong [−15, 25], ≥ 1 số âm, một cặp sát (cách 1–2); đúng 2 bóng là phép
 * tính: một trong cặp sát và một trong ba số còn lại.
 */
function expertValues(rng: Rng): Draft[] {
  const low = rng.int(-15, 23);
  const pair = [low, low + rng.int(1, 2)];
  const negative = rng.pick(range(-15, -1).filter((v) => !pair.includes(v)));
  const rest = sample(
    rng,
    range(-15, 25).filter((v) => !pair.includes(v) && v !== negative),
    2,
  );
  const values = [...pair, negative, ...rest];

  const pairIndex = rng.int(0, 1);
  const otherIndex = 2 + rng.int(0, 2);
  const first = operation(rng, values[pairIndex]!);
  const second = operation(rng, values[otherIndex]!, first.kind);
  return values.map((v, i) => (i === pairIndex ? first : i === otherIndex ? second : plain(v)));
}

const LEVELS: Readonly<Record<Difficulty, Level>> = {
  0: { cols: 2, rows: 3, values: seedlingValues },
  1: { cols: 3, rows: 3, values: normalValues },
  2: { cols: 3, rows: 3, values: hardValues },
  3: { cols: 2, rows: 3, values: expertValues },
};

export const numberBalloons: MinigameDef<NumberBalloonsPuzzle, NumberBalloonsAnswer> = {
  id: "number-balloons",
  category: "compute",
  durationMs: 60_000,

  /**
   * Hệ số điểm (CR-006): chọn để người chơi đúng sức ở mỗi mức (Mầm: trẻ 7 tuổi, mức khác: người
   * lớn) được điểm vòng xấp xỉ người lớn ở Thường, tính từ thời gian giải ở mục Cân bằng của đặc
   * tả. Mầm = 1 ngang Thường (PM chốt chung cho 5 game: hệ số không giảm khi lên mức).
   * Chốt lại sau buổi chơi thử.
   */
  difficultyMultiplier: { 0: 1, 1: 1, 2: 1.35, 3: 2 },
  // Bot (CR-016): thời gian một câu chép từ bảng Cân bằng của đặc tả (Mầm theo trẻ 7 tuổi): trung
  // bình + 0,25 s chuyển câu.
  expectedSolveMs: { 0: 5_250, 1: 5_150, 2: 5_850, 3: 7_350 },
  // Bot (CR-016): tỉ lệ đúng = 1 − tỉ lệ sai ở bảng Cân bằng của đặc tả (Mầm theo trẻ 7 tuổi).
  expectedAccuracy: { 0: 0.9, 1: 0.94, 2: 0.9, 3: 0.85 },

  /** Miễn trừ thưởng tốc độ (CR-006): 0,5 s cho mỗi lần chạm sau lần đầu + 1 s mỗi bóng phép tính. */
  speedAllowanceMs(puzzle) {
    const taps = puzzle.balloons.length;
    const operations = puzzle.balloons.filter((b) => b.kind !== "num").length;
    return TAP_ALLOWANCE_MS * Math.max(0, taps - 1) + OPERATION_ALLOWANCE_MS * operations;
  },

  generate(roundSeed, index, difficulty) {
    const level = LEVELS[difficulty];
    // Hai nguồn ngẫu nhiên: `rng` cho các số, `lay` cho bố cục và trang trí. `lay` không phụ
    // thuộc độ khó nên Thường và Khó (cùng lưới 3×3, cùng 5 bóng) có bóng ở cùng vị trí.
    const rng = createRng(deriveSeed(roundSeed, index));
    const lay = createRng(deriveSeed(roundSeed, index, 1));

    // Xáo để chỉ số bóng không lộ cách sinh.
    const drafts = rng.shuffle(level.values(rng));

    const slots = sample(lay, range(0, level.cols * level.rows - 1), drafts.length);
    const colors = sample(lay, range(0, COLOR_COUNT - 1), drafts.length);
    const balloons: Balloon[] = [];
    for (let i = 0; i < drafts.length; i++) {
      const dx = lay.int(-MAX_OFFSET, MAX_OFFSET);
      const dy = lay.int(-MAX_OFFSET, MAX_OFFSET);
      const phase = lay.int(0, 359);
      balloons.push({ ...drafts[i]!, slot: slots[i]!, color: colors[i]!, dx, dy, phase });
    }

    // Các giá trị đôi một khác nhau → thứ tự tăng dần ngặt là duy nhất.
    const order = balloons.map((_, i) => i).sort((i, j) => balloons[i]!.value - balloons[j]!.value);

    return { cols: level.cols, rows: level.rows, balloons, order };
  },

  check(puzzle, answer) {
    return (
      Array.isArray(answer) &&
      answer.length === puzzle.order.length &&
      answer.every((v, i) => v === puzzle.order[i])
    );
  },

  isAnswer(value): value is NumberBalloonsAnswer {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_BALLOONS) return false;
    const seen = new Set<number>();
    // for…of trả `undefined` cho ô trống của mảng thưa, nên ô trống cũng bị từ chối.
    for (const v of value as unknown[]) {
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= MAX_BALLOONS) return false;
      if (seen.has(v)) return false;
      seen.add(v);
    }
    return true;
  },
};
