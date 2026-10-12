import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Cân não (nhóm Phân tích): vài chiếc cân đĩa, bên thấp hơn là bên nặng hơn.
 * Đọc các cân, suy ra vật nặng nhất rồi chạm vào vật đó ở hàng lựa chọn.
 * Đặc tả: docs/04-minigames/balance.md.
 *
 * Mọi thứ ngẫu nhiên đi qua `rng`; khối lượng là số nguyên 1–12.
 * Câu đố được dựng từ một "cây chứng minh" mọc ra từ đáp án nên luôn có đúng một đáp án.
 */

/**
 * Danh mục vật. Trong game không hiện chữ: FE ánh xạ ID sang hình, 8 vật vẽ cùng cỡ.
 * Đổi bộ vật (vd. sang bộ trung tính sau chơi thử) chỉ cần thay danh sách này, giữ đủ 8 vật.
 */
export const BALANCE_ITEMS = [
  "apple",
  "pear",
  "banana",
  "carrot",
  "mushroom",
  "grapes",
  "strawberry",
  "watermelon",
] as const;
export type BalanceItem = (typeof BALANCE_ITEMS)[number];

/** Một chiếc cân trong câu đố. */
export interface BalanceScale {
  /** Chỉ số trong `items` của các vật trên đĩa trái (1 vật; riêng cân đĩa đôi có thể là 2 vật). */
  left: number[];
  /** Chỉ số trong `items` của các vật trên đĩa phải (1 vật; riêng cân đĩa đôi có thể là 2 vật). */
  right: number[];
  /** Đĩa nặng hơn, tức đĩa nằm thấp hơn; `"equal"` là cân thăng bằng (đòn ngang, dấu "="). */
  heavier: "left" | "right" | "equal";
}

export interface BalancePuzzle {
  /** 3–6 vật khác nhau. Thứ tự mảng là thứ tự ô ở hàng lựa chọn (trái → phải, trên → dưới). */
  items: BalanceItem[];
  /**
   * Các cân theo thứ tự hiển thị (trái → phải, trên → dưới).
   * Mọi cân là 1 vật – 1 vật, trừ Siêu khó có đúng một cân đĩa đôi "1 vật – 2 vật"
   * (luôn thăng bằng) và cân này luôn đứng cuối mảng.
   */
  scales: BalanceScale[];
  /**
   * Khối lượng ẩn (số nguyên 1–12) theo thứ tự `items`, chỉ để server và test kiểm.
   * FE KHÔNG hiển thị và không dùng để vẽ (mọi cân nghiêng cùng một góc).
   */
  weights: number[];
  /** Chỉ số trong `items` của vật nặng nhất, tức đáp án đúng. */
  answer: number;
}

/** Đáp án = chỉ số ô người chơi chạm ở hàng lựa chọn (0 … số vật − 1), gửi một lần mỗi câu. */
export type BalanceAnswer = number;

/** Số vật theo độ khó; số cân suy ra từ thuật toán: 2 / 3 / 4 / 5. */
const ITEM_COUNT: Record<Difficulty, number> = { 0: 3, 1: 4, 2: 5, 3: 6 };
const MAX_ITEMS = 6;

/**
 * Hệ số điểm riêng của game (CR-006), tính từ bảng Cân bằng của đặc tả: mức Thường làm mốc 1,
 * mỗi mức chọn sao cho người chơi mục tiêu của mức đó (Mầm: trẻ 7 tuổi; còn lại: người lớn
 * đúng sức) được điểm vòng xấp xỉ người lớn ở Thường. Mầm tính ra 1,35 nhưng bị chặn ở mức
 * của Thường để hệ số không giảm khi lên mức. Chỉnh số sau buổi chơi thử, không cần sửa code.
 */
const MULTIPLIER_BY_DIFFICULTY: Readonly<Record<Difficulty, number>> = {
  0: 1,
  1: 1,
  2: 1.75,
  3: 2.85,
};

/**
 * Miễn trừ thưởng tốc độ (CR-006): phần thời gian suy luận dài hơn mức Thường, tính bằng
 * giữa khoảng thời gian giải dự kiến của mức trừ giữa khoảng của Thường (3 s).
 * Cấu trúc câu cố định theo mức nên miễn trừ là hằng số cho mỗi mức.
 */
const ALLOWANCE_MS_BY_DIFFICULTY: Readonly<Record<Difficulty, number>> = {
  0: 0,
  1: 0,
  2: 1_250,
  3: 3_000,
};

/** Một quan hệ trước khi đặt lên cân: đĩa `heavy` nặng hơn đĩa `light`, hoặc bằng nhau. */
interface Relation {
  heavy: number[];
  light: number[];
  equal: boolean;
}

interface Built {
  weights: number[];
  /** Các cân 1 vật – 1 vật (sẽ được xáo thứ tự). */
  pairs: Relation[];
  /** Cân đĩa đôi "1 vật = 2 vật" (chỉ Siêu khó), luôn đứng cuối. */
  doublePan?: Relation;
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

const tilt = (heavy: number, light: number): Relation => ({
  heavy: [heavy],
  light: [light],
  equal: false,
});

/**
 * Mầm, Thường: `order` xếp theo khối lượng giảm dần, mọi khối lượng khác nhau.
 * Vật `order[k]` thua một vật chọn ngẫu nhiên trong `order[0 … k−1]` → n−1 cân nghiêng.
 */
function buildChain(rng: Rng, order: number[]): Built {
  const n = order.length;
  const weights = new Array<number>(n).fill(0);
  let w = rng.int(1, 3);
  weights[order[n - 1]!] = w;
  for (let k = n - 2; k >= 0; k--) {
    w += rng.int(1, 3);
    weights[order[k]!] = w;
  }

  const pairs: Relation[] = [];
  for (let k = 1; k < n; k++) {
    pairs.push(tilt(order[rng.int(0, k - 1)]!, order[k]!));
  }
  return { weights, pairs };
}

/**
 * Khó: như chuỗi nhưng `order[t]` và `order[t+1]` nặng bằng nhau (P, Q).
 * Cây dựng trên 4 nhóm; cặp thua thì đưa P lên cân, cặp thắng thì dùng Q; thêm cân P = Q.
 * Q không bao giờ ở đĩa nhẹ, nên phải đọc cân thăng bằng mới loại được Q.
 */
function buildWithTie(rng: Rng, order: number[]): Built {
  const n = order.length;
  const t = rng.int(1, n - 2);
  const weights = new Array<number>(n).fill(0);
  let w = rng.int(1, 3);
  weights[order[n - 1]!] = w;
  for (let k = n - 2; k >= 0; k--) {
    if (k !== t) w += rng.int(1, 3);
    weights[order[k]!] = w;
  }

  const [p, q] = rng.shuffle([order[t]!, order[t + 1]!]) as [number, number];
  const pairGroup = -1;
  // Nhóm theo khối lượng giảm dần: số ≥ 0 là vật lẻ, `pairGroup` là cặp P–Q.
  const groups: number[] = [];
  for (let k = 0; k < n; k++) {
    if (k === t + 1) continue;
    groups.push(k === t ? pairGroup : order[k]!);
  }

  const pairs: Relation[] = [];
  for (let g = 1; g < groups.length; g++) {
    const parent = groups[rng.int(0, g - 1)]!;
    const child = groups[g]!;
    pairs.push(tilt(parent === pairGroup ? q : parent, child === pairGroup ? p : child));
  }
  pairs.push({ heavy: [p], light: [q], equal: true });
  return { weights, pairs };
}

/**
 * Siêu khó: cân đĩa đôi "Y = A + B" (thăng bằng), Y là đáp án hoặc một vật ở giữa (50/50),
 * 3 cân nghiêng của cây chứng minh, cộng một cân mồi đúng sự thật.
 */
function buildWithDoublePan(rng: Rng, order: number[]): Built {
  const n = order.length;
  const answer = order[0]!;
  const singleIsAnswer = rng.int(0, 1) === 0;

  // Cặp khối lượng (a, b) khác nhau trong 2–5; Y là đáp án thì cần a + b ≥ 6.
  const weightPairs: [number, number][] = [];
  for (let a = 2; a <= 5; a++) {
    for (let b = 2; b <= 5; b++) {
      if (a !== b && (!singleIsAnswer || a + b >= 6)) weightPairs.push([a, b]);
    }
  }
  const [a, b] = rng.pick(weightPairs);
  const itemA = order[1]!;
  const itemB = order[2]!;
  const single = singleIsAnswer ? answer : order[3]!;

  const weights = new Array<number>(n).fill(0);
  weights[itemA] = a;
  weights[itemB] = b;
  weights[single] = a + b;
  if (singleIsAnswer) {
    const pool = range(a + b - 1)
      .map((i) => i + 1)
      .filter((x) => x !== a && x !== b);
    const picked = rng.shuffle(pool);
    for (let k = 3; k < n; k++) weights[order[k]!] = picked[k - 3]!;
  } else {
    const pool = range(9)
      .map((i) => i + 1)
      .filter((x) => x !== a && x !== b && x !== a + b);
    const picked = rng.shuffle(pool);
    for (let k = 4; k < n; k++) weights[order[k]!] = picked[k - 4]!;
    weights[answer] = Math.max(...weights) + rng.int(1, 3);
  }

  // Cây chứng minh: duyệt vật theo khối lượng giảm dần (mọi khối lượng khác nhau).
  const byWeight = range(n).sort((x, y) => weights[y]! - weights[x]!);
  const visited: number[] = [];
  const pairs: Relation[] = [];
  for (const x of byWeight) {
    if (x !== answer && x !== itemA && x !== itemB) {
      pairs.push(tilt(rng.pick(visited), x));
    }
    visited.push(x);
  }

  // Cân mồi: H > L, cả hai không phải đáp án, L đã bị nhấc, cặp chưa từng được so.
  const compared = new Set<number>();
  const key = (x: number, y: number) => Math.min(x, y) * n + Math.max(x, y);
  for (const r of pairs) compared.add(key(r.heavy[0]!, r.light[0]!));
  compared.add(key(single, itemA));
  compared.add(key(single, itemB));
  const lifted = pairs.map((r) => r.light[0]!);

  const decoys: [number, number][] = [];
  for (const light of lifted) {
    for (let heavy = 0; heavy < n; heavy++) {
      if (heavy === answer || weights[heavy]! <= weights[light]!) continue;
      if (compared.has(key(heavy, light))) continue;
      decoys.push([heavy, light]);
    }
  }
  const preferred = decoys.filter(([heavy]) => heavy === itemA || heavy === itemB);
  const pool = preferred.length > 0 ? preferred : decoys;
  if (pool.length === 0) throw new Error("balance: không tìm được cân mồi");
  const [decoyHeavy, decoyLight] = rng.pick(pool);
  pairs.push(tilt(decoyHeavy, decoyLight));

  return {
    weights,
    pairs,
    doublePan: { heavy: [single], light: rng.shuffle([itemA, itemB]), equal: true },
  };
}

/** Đặt quan hệ lên cân: đĩa nặng sang trái hay phải ngẫu nhiên 50/50. */
function place(rng: Rng, r: Relation): BalanceScale {
  const heavyOnLeft = rng.int(0, 1) === 0;
  return {
    left: heavyOnLeft ? r.heavy : r.light,
    right: heavyOnLeft ? r.light : r.heavy,
    heavier: r.equal ? "equal" : heavyOnLeft ? "left" : "right",
  };
}

export const balance: MinigameDef<BalancePuzzle, BalanceAnswer> = {
  id: "balance",
  category: "analyze",
  durationMs: 60_000,
  difficultyMultiplier: MULTIPLIER_BY_DIFFICULTY,

  generate(roundSeed, index, difficulty) {
    const rng = createRng(deriveSeed(roundSeed, index));
    const n = ITEM_COUNT[difficulty];

    // Xáo cả 8 vật trước tiên → vật của mức thấp là phần đầu danh sách vật của mức cao.
    const items = rng.shuffle(BALANCE_ITEMS).slice(0, n);
    // Gán vai ngẫu nhiên; `order[0]` luôn là đáp án.
    const order = rng.shuffle(range(n));

    const built =
      difficulty <= 1
        ? buildChain(rng, order)
        : difficulty === 2
          ? buildWithTie(rng, order)
          : buildWithDoublePan(rng, order);

    const scales = rng.shuffle(built.pairs).map((r) => place(rng, r));
    if (built.doublePan) scales.push(place(rng, built.doublePan));

    return { items, scales, weights: built.weights, answer: order[0]! };
  },

  check(puzzle, answer) {
    return answer === puzzle.answer;
  },

  isAnswer(value): value is BalanceAnswer {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < MAX_ITEMS;
  },

  speedAllowanceMs(_puzzle, difficulty) {
    return ALLOWANCE_MS_BY_DIFFICULTY[difficulty];
  },
};
