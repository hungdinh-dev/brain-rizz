import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Chạm đích (nhóm Tính toán): chạm đúng `pick` thẻ số có tổng bằng số đích. Khay có sẵn
 * `pick` ô, chọn đủ là tự nộp; chạm lại thẻ đã chọn để bỏ chọn.
 * Đặc tả: docs/04-minigames/hit-target.md.
 *
 * Mọi thứ ngẫu nhiên đi qua `createRng`, không dùng Math.random() hay Date.now().
 */

export interface HitTargetPuzzle {
  /** Số đích trong hồng tâm. Số nguyên dương. */
  target: number;
  /**
   * Giá trị các thẻ, xếp theo hàng từ góc trên trái của lưới `cols` cột: thẻ `i` ở cột
   * `i % cols`, hàng `Math.floor(i / cols)`. Số nguyên, đôi một khác nhau. Mầm 6 thẻ, mức khác 9.
   */
  cards: number[];
  /** Số cột của lưới: Mầm 2 (lưới 2×3), mức khác 3 (lưới 3×3). */
  cols: number;
  /** Số thẻ phải chọn, cũng là số ô của khay: Mầm 2, mức khác 3. */
  pick: number;
  /**
   * Chỉ số các thẻ đáp án trong `cards`, tăng dần. Đây là bộ `pick` thẻ DUY NHẤT có tổng bằng
   * `target`. Scene dùng để khoanh đáp án đúng khi người chơi sai.
   */
  answer: number[];
}

/**
 * Đáp án = chỉ số `pick` thẻ đã chọn (trong `cards`), thứ tự bất kỳ, không trùng. Client gửi
 * đúng một lần mỗi câu, ngay khi khay đủ `pick` thẻ.
 */
export type HitTargetAnswer = number[];

/** Số thẻ nhiều nhất trên sân, và số thẻ phải chọn ít nhất / nhiều nhất (cho `isAnswer`). */
const MAX_CARDS = 9;
const MIN_PICK = 2;
const MAX_PICK = 3;

/** Miễn trừ thưởng tốc độ (CR-006) cho mỗi lần chạm sau lần đầu. */
const TAP_ALLOWANCE_MS = 500;

/**
 * Số lần thử nhiều nhất để có một sân hợp lệ trong khoảng công sức của mức. Đo trên 10 000 seed
 * mỗi mức: trung bình 1 / 8 / 12 / 5 lần, nhiều nhất < 200 (đặc tả, mục Cách sinh câu đố).
 * Hết lượt thì dùng sân hợp lệ gần khoảng nhất đã gặp, nên vòng lặp luôn dừng.
 */
const MAX_ATTEMPTS = 400;

interface Level {
  /** Số thẻ trên sân. */
  cards: number;
  cols: number;
  pick: number;
  /** Mọi bộ đáp án hợp lệ (giá trị tăng dần). Tính một lần khi cần, không phụ thuộc seed. */
  answers(): readonly (readonly number[])[];
  /** Các giá trị thẻ mồi được phép. */
  pool: readonly number[];
  /** Số thẻ âm trong thẻ mồi (chỉ Siêu khó); không khai báo = không có thẻ âm riêng. */
  negativeDistractors?: number;
  /** Khoảng công sức tìm kiếm chấp nhận (`searchEffort`), tính cả hai đầu. Không khai báo = mọi sân. */
  effort?: readonly [number, number];
  /**
   * Sân dự phòng, chỉ dùng nếu không lần thử nào ra sân hợp lệ (đo 10 000 seed: chưa từng xảy
   * ra). Lấy đúng ví dụ trong bản mẫu; đã kiểm tay là có đúng một đáp án.
   */
  fallback: { answer: readonly number[]; distractors: readonly number[] };
}

function range(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

const sum = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0);

/** Mọi tổ hợp `k` phần tử của `items` (giữ thứ tự) thoả `keep`. */
function combinations(
  items: readonly number[],
  k: number,
  keep: (combo: readonly number[]) => boolean,
): number[][] {
  const out: number[][] = [];
  const combo: number[] = [];
  const walk = (start: number): void => {
    if (combo.length === k) {
      if (keep(combo)) out.push(combo.slice());
      return;
    }
    for (let i = start; i <= items.length - (k - combo.length); i++) {
      combo.push(items[i]!);
      walk(i + 1);
      combo.pop();
    }
  };
  walk(0);
  return out;
}

/** Tính một lần khi cần rồi dùng lại. */
function lazy<T>(make: () => T): () => T {
  let value: T | undefined;
  return () => {
    value ??= make();
    return value;
  };
}

/** Bộ chọn `k` số trong [min, max] có tổng trong [lo, hi]. */
const sumsInRange = (min: number, max: number, k: number, lo: number, hi: number) =>
  lazy(() => combinations(range(min, max), k, (c) => sum(c) >= lo && sum(c) <= hi));

const SUPER_NEGATIVES = range(-30, -2);
const SUPER_POSITIVES = range(2, 45);

const LEVELS: Readonly<Record<Difficulty, Level>> = {
  // Mầm: 6 thẻ 1–9, chọn 2, đích 5–17.
  0: {
    cards: 6,
    cols: 2,
    pick: 2,
    answers: sumsInRange(1, 9, 2, 5, 17),
    pool: range(1, 9),
    fallback: { answer: [4, 9], distractors: [6, 2, 8, 3] },
  },
  // Thường: 9 thẻ 2–20, chọn 3, đích 20–50.
  1: {
    cards: 9,
    cols: 3,
    pick: 3,
    answers: sumsInRange(2, 20, 3, 20, 50),
    pool: range(2, 20),
    effort: [3, 4.5],
    fallback: { answer: [5, 12, 14], distractors: [7, 18, 16, 9, 20, 11] },
  },
  // Khó: 9 thẻ 11–60, chọn 3, đích 60–150.
  2: {
    cards: 9,
    cols: 3,
    pick: 3,
    answers: sumsInRange(11, 60, 3, 60, 150),
    pool: range(11, 60),
    effort: [4.75, 5.75],
    fallback: { answer: [27, 38, 47], distractors: [23, 19, 52, 31, 44, 26] },
  },
  // Siêu khó: 3 thẻ âm −30…−2 và 6 thẻ dương 2–45; đáp án đúng 1 thẻ âm + 2 thẻ dương, đích 10–60.
  3: {
    cards: 9,
    cols: 3,
    pick: 3,
    answers: lazy(() => {
      const out: number[][] = [];
      for (const negative of SUPER_NEGATIVES) {
        for (const [a, b] of combinations(SUPER_POSITIVES, 2, () => true)) {
          const target = negative + a! + b!;
          if (target >= 10 && target <= 60) out.push([negative, a!, b!]);
        }
      }
      return out;
    }),
    pool: [...SUPER_NEGATIVES, ...SUPER_POSITIVES],
    negativeDistractors: 2,
    effort: [6, 6.75],
    fallback: { answer: [-15, 2, 41], distractors: [34, -9, 17, 8, -6, 22] },
  },
};

/**
 * Thêm thẻ mồi lần lượt theo thứ tự ngẫu nhiên của `level.pool`. Thẻ `x` chỉ được nhận nếu nó
 * không tạo thêm bộ `pick` thẻ nào có tổng bằng `target`: với `pick` = 2 nghĩa là `target − x`
 * chưa có trên sân, với `pick` = 3 nghĩa là `target − x` không phải tổng của hai thẻ đã có.
 * Mỗi bộ mới phải chứa `x`, nên kiểm vậy là đủ để giữ đúng một đáp án.
 * Trả về `undefined` nếu duyệt hết `pool` mà chưa đủ thẻ.
 */
function addDistractors(
  rng: Rng,
  level: Level,
  answer: readonly number[],
  target: number,
): number[] | undefined {
  const board = [...answer];
  const onBoard = new Set(answer);
  const pairSums = new Set<number>();
  for (let i = 0; i < board.length; i++)
    for (let j = i + 1; j < board.length; j++) pairSums.add(board[i]! + board[j]!);

  const need = level.cards - level.pick;
  const needNegative = level.negativeDistractors ?? 0;
  let negatives = 0;
  const distractors: number[] = [];

  // Xáo dần (Fisher–Yates từng bước): chỉ rút thêm khi cần, dừng ngay khi đủ thẻ.
  const pool = level.pool.slice();
  for (let i = 0; i < pool.length && distractors.length < need; i++) {
    const j = rng.int(i, pool.length - 1);
    const x = pool[j]!;
    pool[j] = pool[i]!;
    pool[i] = x;

    if (onBoard.has(x)) continue;
    if (x < 0 ? negatives === needNegative : distractors.length - negatives === need - needNegative)
      continue;
    if (level.pick === 2 ? onBoard.has(target - x) : pairSums.has(target - x)) continue;

    for (const y of board) pairSums.add(x + y);
    board.push(x);
    onBoard.add(x);
    distractors.push(x);
    if (x < 0) negatives++;
  }
  return distractors.length === need ? distractors : undefined;
}

/** Đáp án là `pick` thẻ lớn nhất hoặc nhỏ nhất trên sân: đoán được không cần tính, bỏ. */
function isObvious(answer: readonly number[], distractors: readonly number[]): boolean {
  const lo = Math.min(...answer);
  const hi = Math.max(...answer);
  return distractors.every((x) => x < lo) || distractors.every((x) => x > hi);
}

/**
 * Công sức tìm đáp án = số phép thử dự kiến của người chơi (đặc tả, mục Cách sinh câu đố).
 *
 * - Chọn 2: xét từng thẻ `x` theo thứ tự ngẫu nhiên, tính `target − x` rồi tìm trên sân. Phép
 *   thử không tính nếu `target − x` nằm ngoài [nhỏ nhất, lớn nhất] của các thẻ còn lại.
 * - Chọn 3: lấy từng thẻ "neo" `a` theo thứ tự ngẫu nhiên, `R = target − a`. Nếu `R` nằm ngoài
 *   [tổng hai thẻ nhỏ nhất, tổng hai thẻ lớn nhất] của các thẻ kia thì bỏ neo ngay (không tính).
 *   Ngược lại tính 1 phép cho neo, rồi xét từng thẻ `b` theo thứ tự ngẫu nhiên: tính 1 phép nếu
 *   `R − b` nằm trong [nhỏ nhất, lớn nhất] của các thẻ kia. Neo sai phải xét hết mới biết sai.
 * - Siêu khó (`signSplit`): người chơi biết đáp án có đúng một thẻ âm, nên neo chỉ là thẻ âm và
 *   `b` chỉ là thẻ dương.
 *
 * Tính kỳ vọng chính xác, không mô phỏng: một phần tử sai đứng trước mọi phần tử đúng trong
 * thứ tự ngẫu nhiên với xác suất 1 / (số phần tử đúng + 1).
 */
function searchEffort(
  answer: readonly number[],
  distractors: readonly number[],
  target: number,
  signSplit: boolean,
): number {
  const isAnswer = (x: number): boolean => answer.includes(x);
  const cards = [...answer, ...distractors].sort((x, y) => x - y);

  /** Kỳ vọng tổng chi phí khi xét `items` theo thứ tự ngẫu nhiên, dừng ở phần tử đúng đầu tiên. */
  const expected = (items: readonly number[], cost: (x: number) => number): number => {
    let right = 0;
    let rightCost = 0;
    let wrongCost = 0;
    for (const x of items) {
      if (isAnswer(x)) {
        right++;
        rightCost += cost(x);
      } else wrongCost += cost(x);
    }
    return wrongCost / (right + 1) + rightCost / right;
  };
  /** `v` nằm trong [nhỏ nhất, lớn nhất] của dãy tăng dần `xs` sau khi bỏ phần tử `drop`. */
  const within = (v: number, xs: readonly number[], drop: number): boolean => {
    const n = xs.length;
    const min = xs[0] === drop ? xs[1]! : xs[0]!;
    const max = xs[n - 1] === drop ? xs[n - 2]! : xs[n - 1]!;
    return v >= min && v <= max;
  };

  if (answer.length === 2) {
    return expected(cards, (x) => (within(target - x, cards, x) ? 1 : 0));
  }

  const anchors = signSplit ? cards.filter((x) => x < 0) : cards;
  const positives = cards.filter((x) => x > 0);
  return expected(anchors, (a) => {
    const rest = target - a;
    // Các thẻ ghép với neo, vẫn tăng dần sau khi lọc.
    const partners = signSplit ? positives : cards.filter((x) => x !== a);
    const n = partners.length;
    if (rest < partners[0]! + partners[1]! || rest > partners[n - 1]! + partners[n - 2]!) return 0;
    const scan = (b: number): number => (within(rest - b, partners, b) ? 1 : 0);
    let scanCost = 0;
    if (isAnswer(a)) scanCost = expected(partners, scan);
    else for (const b of partners) scanCost += scan(b);
    return 1 + scanCost;
  });
}

export const hitTarget: MinigameDef<HitTargetPuzzle, HitTargetAnswer> = {
  id: "hit-target",
  category: "compute",
  durationMs: 60_000,

  /**
   * Hệ số điểm (CR-006), tính ở mục Cân bằng của đặc tả: người chơi đúng sức ở mỗi mức (Mầm: trẻ
   * 7 tuổi, mức khác: người lớn) được điểm vòng xấp xỉ người lớn ở Thường. Mầm = 1, không cao hơn
   * Thường (PM chốt chung). Chốt lại sau buổi chơi thử.
   */
  difficultyMultiplier: { 0: 1, 1: 1, 2: 1.35, 3: 1.75 },

  /** Miễn trừ thưởng tốc độ (CR-006): 0,5 s cho mỗi lần chạm sau lần đầu (khay `pick` ô). */
  speedAllowanceMs(puzzle) {
    return TAP_ALLOWANCE_MS * Math.max(0, puzzle.pick - 1);
  },

  generate(roundSeed, index, difficulty) {
    const level = LEVELS[difficulty];
    const rng = createRng(deriveSeed(roundSeed, index));
    const answers = level.answers();

    let answerValues: readonly number[] = level.fallback.answer;
    let distractors: readonly number[] = level.fallback.distractors;
    let bestMiss = Number.POSITIVE_INFINITY;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && bestMiss > 0; attempt++) {
      const candidate = rng.pick(answers);
      const target = sum(candidate);
      const found = addDistractors(rng, level, candidate, target);
      if (!found) continue;
      if (level.pick === 3 && isObvious(candidate, found)) continue;

      let miss = 0;
      if (level.effort) {
        const [lo, hi] = level.effort;
        const effort = searchEffort(
          candidate,
          found,
          target,
          level.negativeDistractors !== undefined,
        );
        miss = effort < lo ? lo - effort : effort > hi ? effort - hi : 0;
      }
      if (miss < bestMiss) {
        bestMiss = miss;
        answerValues = candidate;
        distractors = found;
      }
    }

    // Xáo vị trí để thẻ đáp án rải trên lưới; chỉ số không lộ cách sinh.
    const cards = rng.shuffle([...answerValues, ...distractors]);
    const answer = answerValues.map((v) => cards.indexOf(v)).sort((a, b) => a - b);

    return { target: sum(answerValues), cards, cols: level.cols, pick: level.pick, answer };
  },

  check(puzzle, answer) {
    if (!Array.isArray(answer) || answer.length !== puzzle.answer.length) return false;
    const chosen = [...answer].sort((a, b) => a - b);
    return chosen.every((v, i) => v === puzzle.answer[i]);
  },

  isAnswer(value): value is HitTargetAnswer {
    if (!Array.isArray(value) || value.length < MIN_PICK || value.length > MAX_PICK) return false;
    const seen = new Set<number>();
    // for…of trả `undefined` cho ô trống của mảng thưa, nên ô trống cũng bị từ chối.
    for (const v of value as unknown[]) {
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= MAX_CARDS) return false;
      if (seen.has(v)) return false;
      seen.add(v);
    }
    return true;
  },
};
