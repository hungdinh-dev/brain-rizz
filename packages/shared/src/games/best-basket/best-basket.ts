import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Giỏ hời nhất (nhóm Tính toán): túi có `budget` xu, căng tin bày 3–4 giỏ đồ ăn vặt, mỗi món có giá
 * (xu) và số sao ngon. Chọn giỏ nhiều sao nhất mà tổng giá không vượt số xu trong túi.
 * Khó thêm cặp món đi kèm được cộng sao; Siêu khó thêm ưu đãi "mua 2 món cùng loại được giảm giá".
 * Đặc tả: docs/04-minigames/best-basket.md.
 *
 * Mọi số là số nguyên nhỏ. Mọi thứ ngẫu nhiên đi qua `createRng`, không dùng Math.random() hay Date.now().
 */

/** Các loại món ăn vặt; web vẽ từng loại bằng hình (Phaser Graphics), không ghi tên. */
export const BEST_BASKET_SNACKS = [
  "bun",
  "milk",
  "apple",
  "banana",
  "candy",
  "cookie",
  "juice",
  "corn",
] as const;
export type BestBasketSnack = (typeof BEST_BASKET_SNACKS)[number];

/** Một món trong giỏ. Trong cùng một câu, cùng loại thì cùng giá và cùng số sao. */
export interface BestBasketItem {
  kind: BestBasketSnack;
  /** Giá (xu), số nguyên dương. */
  price: number;
  /** Số sao ngon, số nguyên dương. */
  stars: number;
}

/** Cặp món đi kèm (Khó, Siêu khó): giỏ có đủ cả hai loại thì được cộng `bonus` sao. */
export interface BestBasketCombo {
  kinds: [BestBasketSnack, BestBasketSnack];
  bonus: number;
}

/** Ưu đãi (Siêu khó): mỗi 2 món loại `kind` trong cùng một giỏ được giảm `discount` xu. */
export interface BestBasketDeal {
  kind: BestBasketSnack;
  discount: number;
}

export interface BestBasketPuzzle {
  /** Số xu trong túi. Giỏ có tổng giá (sau ưu đãi) lớn hơn số này là lố tiền. */
  budget: number;
  /** Các giỏ theo thứ tự vẽ (Mầm 3 giỏ; mức khác 4 giỏ, lưới 2×2 đọc theo hàng). */
  baskets: BestBasketItem[][];
  /** Cặp món đi kèm; `null` ở Mầm và Thường. */
  combo: BestBasketCombo | null;
  /** Ưu đãi mua 2 món cùng loại; `null` trừ Siêu khó. */
  deal: BestBasketDeal | null;
  /** Chỉ số giỏ đúng, bằng `bestBasketSolve(puzzle)`. */
  answerIndex: number;
}

/** Đáp án = chỉ số giỏ người chơi chạm (0–3). */
export type BestBasketAnswer = number;

/** Luật thưởng/ưu đãi của một câu. */
export type BestBasketRules = Pick<BestBasketPuzzle, "combo" | "deal">;

/** Tổng của một giỏ sau khi tính thưởng và ưu đãi. */
export interface BestBasketTotals {
  /** Tổng giá (xu) sau ưu đãi. */
  price: number;
  /** Tổng sao sau thưởng cặp đi kèm. */
  stars: number;
  /** Giỏ có đủ cặp đi kèm nên được cộng sao. */
  comboApplied: boolean;
  /** Số lần được giảm giá (mỗi 2 món loại ưu đãi một lần). */
  dealTimes: number;
}

/**
 * Tổng giá và tổng sao của một giỏ, dùng chung cho bộ sinh, `check`, scene (hiện đáp án) và test.
 * Thưởng cặp đi kèm cộng một lần nếu giỏ có cả hai loại; ưu đãi trừ `discount` cho mỗi 2 món loại ưu đãi.
 */
export function bestBasketTotals(
  basket: readonly BestBasketItem[],
  rules: BestBasketRules,
): BestBasketTotals {
  let price = 0;
  let stars = 0;
  for (const item of basket) {
    price += item.price;
    stars += item.stars;
  }
  const { combo, deal } = rules;
  let comboApplied = false;
  if (combo?.kinds.every((kind) => basket.some((item) => item.kind === kind))) {
    comboApplied = true;
    stars += combo.bonus;
  }
  let dealTimes = 0;
  if (deal) {
    dealTimes = Math.floor(basket.filter((item) => item.kind === deal.kind).length / 2);
    price -= deal.discount * dealTimes;
  }
  return { price, stars, comboApplied, dealTimes };
}

/** Chỉ số giỏ vừa tiền duy nhất nhiều sao nhất trong `totals`; −1 nếu không có giỏ vừa tiền hoặc hoà. */
function bestOf(totals: readonly BestBasketTotals[], budget: number): number {
  let best = -1;
  let bestStars = Number.NEGATIVE_INFINITY;
  let tie = false;
  totals.forEach((t, i) => {
    if (t.price > budget) return;
    if (t.stars > bestStars) {
      best = i;
      bestStars = t.stars;
      tie = false;
    } else if (t.stars === bestStars) {
      tie = true;
    }
  });
  return tie ? -1 : best;
}

/**
 * Chỉ số giỏ đúng: trong các giỏ không lố tiền, giỏ duy nhất có tổng sao lớn nhất (sau thưởng và ưu
 * đãi). Trả −1 nếu không có giỏ nào vừa tiền, hoặc hai giỏ cùng nhiều sao nhất (bộ sinh không tạo ra).
 */
export function bestBasketSolve(
  puzzle: Pick<BestBasketPuzzle, "budget" | "baskets" | "combo" | "deal">,
): number {
  return bestOf(
    puzzle.baskets.map((basket) => bestBasketTotals(basket, puzzle)),
    puzzle.budget,
  );
}

type Range = readonly [number, number];

interface Level {
  baskets: number;
  /** Số món mỗi giỏ. */
  items: 1 | 2;
  /** Số loại món dùng trong câu. */
  menu: number;
  price: Range;
  stars: Range;
  budget: Range;
  /** Giỏ bẫy (lố tiền, nhiều sao hơn đáp án) gần nhất lố tối đa ngần này xu, để bẫy không lộ. */
  maxOverage: number;
  /** Giỏ vừa tiền còn lại kém đáp án tối đa ngần này sao, để phải so thật. */
  maxGap: number;
  combo: boolean;
  deal: boolean;
}

/** Tham số từng mức (bảng Độ khó của đặc tả). */
const LEVELS: Readonly<Record<Difficulty, Level>> = {
  0: {
    baskets: 3,
    items: 1,
    menu: 3,
    price: [1, 9],
    stars: [1, 5],
    budget: [3, 8],
    maxOverage: 3,
    maxGap: 4,
    combo: false,
    deal: false,
  },
  1: {
    baskets: 4,
    items: 2,
    menu: 6,
    price: [1, 5],
    stars: [1, 5],
    budget: [4, 10],
    maxOverage: 2,
    maxGap: 2,
    combo: false,
    deal: false,
  },
  2: {
    baskets: 4,
    items: 2,
    menu: 6,
    price: [1, 5],
    stars: [1, 5],
    budget: [4, 10],
    maxOverage: 2,
    maxGap: 2,
    combo: true,
    deal: false,
  },
  3: {
    baskets: 4,
    items: 2,
    menu: 6,
    price: [1, 5],
    stars: [1, 5],
    budget: [4, 10],
    maxOverage: 2,
    maxGap: 2,
    combo: true,
    deal: true,
  },
};

/** Số giỏ vừa tiền ở mọi mức: đáp án và một giỏ để so (còn lại đều lố tiền). */
const AFFORDABLE = 2;
/** Số giỏ tối đa ở mọi mức (`isAnswer`). */
const MAX_BASKETS = 4;
/** Thưởng cặp đi kèm (sao) và mức giảm của ưu đãi (xu). */
const COMBO_BONUS: Range = [2, 3];
const DEAL_DISCOUNT: Range = [2, 3];
/** Số lần gán lại sao cho một bộ giá trước khi bày lại từ đầu. */
const STAR_TRIES = 8;
/** Số sao tối đa của mỗi loại trong cặp đi kèm. */
const COMBO_KIND_MAX_STARS = 4;
/** Số lần thử sinh tối đa trước khi dùng câu dựng sẵn (test đo: không bao giờ cần tới). */
const MAX_ATTEMPTS = 500;

/** Miễn trừ thưởng tốc độ (CR-006): mỗi món sau hai món đầu, và mỗi luật thưởng/ưu đãi. */
const ITEM_ALLOWANCE_MS = 250;
const RULE_ALLOWANCE_MS = 500;

/** Câu đã dựng xong, giỏ chưa xáo vị trí. */
type Draft = Omit<BestBasketPuzzle, "answerIndex">;

/** Dữ liệu để kiểm "cốt truyện" của câu với một số xu cụ thể. */
interface Scene {
  totals: readonly BestBasketTotals[];
  budget: number;
  answer: number;
  /** Giỏ còn lại vừa tiền (không phải đáp án). */
  runner: number;
  /** Chỉ số giỏ có đủ cặp đi kèm / đủ 2 món ưu đãi; −1 nếu không có. */
  comboAt: number;
  dealAt: number;
  bonus: number;
  discount: number;
}

/**
 * "Cốt truyện" của câu: vai trò của giỏ có luật, bốc trước khi sinh để mọi vai trò xuất hiện đều
 * (không thì giỏ được thưởng gần như luôn là giỏ bẫy, người chơi đoán được).
 */
type Story = (s: Scene) => boolean;

/** Giỏ đi kèm là đáp án, và chỉ nhờ thưởng mới thắng (bỏ thưởng thì giỏ kia ≥). */
const comboAnswer: Story = (s) =>
  s.answer === s.comboAt && s.totals[s.runner]!.stars >= s.totals[s.comboAt]!.stars - s.bonus;
/** Giỏ đi kèm lố tiền mà nhiều sao hơn đáp án: bẫy người chỉ nhìn thưởng. */
const comboTrap: Story = (s) =>
  s.totals[s.comboAt]!.price > s.budget && s.totals[s.comboAt]!.stars > s.totals[s.answer]!.stars;
/** Giỏ đi kèm vừa tiền nhưng vẫn thua. */
const comboRunner: Story = (s) => s.runner === s.comboAt;
/** Giỏ ưu đãi là đáp án, và chỉ nhờ giảm giá mới vừa tiền. */
const dealAnswer: Story = (s) =>
  s.answer === s.dealAt && s.totals[s.dealAt]!.price + s.discount > s.budget;
/** Giỏ ưu đãi chỉ nhờ giảm giá mới vừa tiền, nhưng vẫn thua. */
const dealRunner: Story = (s) =>
  s.runner === s.dealAt && s.totals[s.dealAt]!.price + s.discount > s.budget;
/** Siêu khó, đáp án là giỏ thường: luật vẫn phải tính (giỏ ưu đãi được cứu, hoặc giỏ đi kèm là bẫy). */
const plainAnswer: Story = (s) =>
  s.answer !== s.dealAt && s.answer !== s.comboAt && (dealRunner(s) || comboTrap(s));
const anyStory: Story = () => true;

/** Bốc cốt truyện theo tỉ lệ ở đặc tả (mục Cách sinh câu đố). */
function pickStory(rng: Rng, difficulty: Difficulty): Story {
  const roll = rng.int(0, 19);
  if (difficulty === 2) return roll < 8 ? comboAnswer : roll < 14 ? comboTrap : comboRunner;
  if (difficulty === 3) return roll < 7 ? dealAnswer : roll < 13 ? comboAnswer : plainAnswer;
  return anyStory;
}

const between = (rng: Rng, [min, max]: Range) => rng.int(min, max);

/**
 * Với số xu `budget`, trả về `Scene` nếu câu hợp lệ: đúng `AFFORDABLE` giỏ vừa tiền, một giỏ nhiều sao
 * hơn hẳn giỏ kia (kém ≤ `maxGap`), có giỏ bẫy lố tiền mà nhiều sao hơn đáp án (bẫy gần nhất lố
 * ≤ `maxOverage` xu). Không thì `null`.
 */
function sceneAt(
  totals: readonly BestBasketTotals[],
  budget: number,
  level: Level,
  draft: Pick<Draft, "combo" | "deal">,
): Scene | null {
  const affordable = totals.flatMap((t, i) => (t.price <= budget ? [i] : []));
  if (affordable.length !== AFFORDABLE) return null;
  const answer = bestOf(totals, budget);
  if (answer < 0) return null;
  const runner = affordable.find((i) => i !== answer)!;
  if (totals[answer]!.stars - totals[runner]!.stars > level.maxGap) return null;
  const overage = totals
    .filter((t) => t.price > budget && t.stars > totals[answer]!.stars)
    .map((t) => t.price - budget);
  if (overage.length === 0 || Math.min(...overage) > level.maxOverage) return null;
  return {
    totals,
    budget,
    answer,
    runner,
    comboAt: totals.findIndex((t) => t.comboApplied),
    dealAt: totals.findIndex((t) => t.dealTimes > 0),
    bonus: draft.combo?.bonus ?? 0,
    discount: draft.deal?.discount ?? 0,
  };
}

/**
 * Một lần thử, hai bước. Bước 1: bày món (mỗi loại một giá), dựng giỏ, lọc các số xu cho đúng
 * `AFFORDABLE` giỏ vừa tiền và có giỏ lố ≤ `maxOverage` xu. Bước 2: gán sao cho từng loại, thử lại tối
 * đa `STAR_TRIES` lần cho tới khi có số xu làm câu hợp lệ và đúng `story`. `null` nếu không được.
 */
function tryDraft(rng: Rng, level: Level, story: Story): Draft | null {
  const kinds = rng.shuffle(BEST_BASKET_SNACKS).slice(0, level.menu);
  // Vai trò theo vị trí trong `kinds` (đã xáo): loại ưu đãi trước, rồi cặp đi kèm.
  let next = 0;
  const dealKind = level.deal ? kinds[next++]! : null;
  const comboKinds: [BestBasketSnack, BestBasketSnack] | null = level.combo
    ? [kinds[next++]!, kinds[next++]!]
    : null;
  const combo = comboKinds ? { kinds: comboKinds, bonus: between(rng, COMBO_BONUS) } : null;
  const deal = dealKind ? { kind: dealKind, discount: between(rng, DEAL_DISCOUNT) } : null;

  const prices = new Map<BestBasketSnack, number>();
  for (const kind of kinds) {
    // Loại ưu đãi giá ≥ 2 để 2 món sau khi giảm (tối đa 3 xu) vẫn còn ≥ 1 xu.
    const min = kind === dealKind ? Math.max(2, level.price[0]) : level.price[0];
    prices.set(kind, rng.int(min, level.price[1]));
  }

  let groups: BestBasketSnack[][];
  if (level.items === 1) {
    groups = kinds.map((kind) => [kind]);
  } else {
    // Giỏ có luật trước: đủ 2 món ưu đãi, đủ cặp đi kèm. Các giỏ khác là 2 món khác loại, không đủ cặp.
    groups = [];
    if (dealKind) groups.push([dealKind, dealKind]);
    if (comboKinds) groups.push([...comboKinds]);
    const pairs: BestBasketSnack[][] = [];
    for (let i = 0; i < kinds.length; i++) {
      for (let j = i + 1; j < kinds.length; j++) {
        const pair = [kinds[i]!, kinds[j]!];
        if (!comboKinds?.every((kind) => pair.includes(kind))) pairs.push(pair);
      }
    }
    const pool = rng.shuffle(pairs);
    // Giỏ "gần đủ": chỉ có một món loại ưu đãi (Siêu khó) hoặc một nửa cặp đi kèm (Khó).
    const partial = dealKind ? [dealKind] : (comboKinds ?? []);
    if (partial.length > 0) {
      const at = pool.findIndex((pair) => pair.some((kind) => partial.includes(kind)));
      groups.push(...pool.splice(at, 1));
    }
    groups.push(...pool.slice(0, level.baskets - groups.length));
    groups = groups.map((group) => rng.shuffle(group));
  }

  // Bước 1: chỉ giá. Giỏ ưu đãi tính giá sau giảm.
  const costs = groups.map(
    (group) =>
      bestBasketTotals(
        group.map((kind) => ({ kind, price: prices.get(kind)!, stars: 0 })),
        { combo, deal },
      ).price,
  );
  // Giỏ ưu đãi (Siêu khó, dựng đầu tiên nên là `costs[0]`) luôn "trông như lố tiền": giá chưa giảm
  // > số xu, nên phải trừ ưu đãi mới biết vừa hay lố.
  const dealRawCost = deal ? costs[0]! + deal.discount : Number.POSITIVE_INFINITY;
  const budgets: number[] = [];
  for (let budget = level.budget[0]; budget <= level.budget[1]; budget++) {
    const affordable = costs.filter((c) => c <= budget).length;
    const nearMiss = costs.some((c) => c > budget && c - budget <= level.maxOverage);
    if (affordable === AFFORDABLE && nearMiss && dealRawCost > budget) budgets.push(budget);
  }
  if (budgets.length === 0) return null;

  // Bước 2: gán sao. Hai loại đi kèm là món "thường" (≤ `COMBO_KIND_MAX_STARS` sao): có thưởng mới ngon.
  for (let tryNo = 0; tryNo < STAR_TRIES; tryNo++) {
    const menu = new Map<BestBasketSnack, BestBasketItem>();
    for (const kind of kinds) {
      const max = comboKinds?.includes(kind)
        ? Math.min(COMBO_KIND_MAX_STARS, level.stars[1])
        : level.stars[1];
      menu.set(kind, { kind, price: prices.get(kind)!, stars: rng.int(level.stars[0], max) });
    }
    const baskets = groups.map((group) => group.map((kind) => ({ ...menu.get(kind)! })));
    const totals = baskets.map((basket) => bestBasketTotals(basket, { combo, deal }));
    const fits = budgets.filter((budget) => {
      const scene = sceneAt(totals, budget, level, { combo, deal });
      return scene !== null && story(scene);
    });
    if (fits.length > 0) return { budget: rng.pick(fits), baskets, combo, deal };
  }
  return null;
}

/**
 * Câu dựng sẵn cho từng mức, chỉ dùng nếu `MAX_ATTEMPTS` lần thử đều trượt (test đo: không xảy ra).
 * Thoả mọi ràng buộc của mức (test kiểm lại); giỏ chưa xáo vị trí.
 */
export function bestBasketFallback(difficulty: Difficulty): Omit<BestBasketPuzzle, "answerIndex"> {
  const it = (kind: BestBasketSnack, price: number, stars: number): BestBasketItem => ({
    kind,
    price,
    stars,
  });
  switch (difficulty) {
    case 0:
      return {
        budget: 5,
        baskets: [[it("apple", 3, 2)], [it("milk", 4, 4)], [it("cookie", 7, 5)]],
        combo: null,
        deal: null,
      };
    case 1:
      return {
        budget: 8,
        baskets: [
          [it("bun", 3, 2), it("milk", 4, 3)],
          [it("cookie", 1, 2), it("juice", 5, 4)],
          [it("candy", 5, 4), it("juice", 5, 4)],
          [it("apple", 4, 1), it("candy", 5, 4)],
        ],
        combo: null,
        deal: null,
      };
    case 2:
      return {
        budget: 8,
        baskets: [
          [it("bun", 3, 2), it("milk", 4, 3)],
          [it("milk", 4, 3), it("juice", 4, 3)],
          [it("candy", 5, 5), it("juice", 4, 3)],
          [it("apple", 5, 4), it("cookie", 5, 1)],
        ],
        combo: { kinds: ["bun", "milk"], bonus: 2 },
        deal: null,
      };
    case 3:
      return {
        budget: 8,
        baskets: [
          [it("apple", 5, 3), it("apple", 5, 3)],
          [it("bun", 3, 2), it("milk", 4, 3)],
          [it("apple", 5, 3), it("candy", 5, 5)],
          [it("cookie", 5, 1), it("juice", 4, 3)],
        ],
        combo: { kinds: ["bun", "milk"], bonus: 2 },
        deal: { kind: "apple", discount: 2 },
      };
  }
}

export const bestBasket: MinigameDef<BestBasketPuzzle, BestBasketAnswer> = {
  id: "best-basket",
  category: "compute",
  durationMs: 60_000,

  /**
   * Hệ số điểm (CR-006): người chơi đúng sức ở mỗi mức (Mầm: trẻ 7 tuổi, mức khác: người lớn) được
   * điểm vòng xấp xỉ người lớn ở Thường, theo mô phỏng ở mục Cân bằng của đặc tả. Mầm = min(giá trị cho
   * trẻ 7 tuổi, 1); hệ số không giảm khi lên mức. Chốt lại sau buổi chơi thử.
   */
  difficultyMultiplier: { 0: 0.85, 1: 1, 2: 1.4, 3: 1.65 },
  // Bot (CR-016): thời gian một câu chép từ bảng Cân bằng của đặc tả (Mầm theo trẻ 7 tuổi): trung
  // bình + 0,25 s chuyển câu.
  expectedSolveMs: { 0: 4_650, 1: 5_550, 2: 6_550, 3: 7_250 },
  // Bot (CR-016): tỉ lệ đúng = 1 − tỉ lệ sai ở bảng Cân bằng của đặc tả (Mầm theo trẻ 7 tuổi).
  expectedAccuracy: { 0: 0.9, 1: 0.93, 2: 0.9, 3: 0.88 },

  /** Miễn trừ thưởng tốc độ (CR-006): 250 ms mỗi món sau hai món đầu, 500 ms mỗi luật thưởng/ưu đãi. */
  speedAllowanceMs(puzzle) {
    const items = puzzle.baskets.reduce((n, basket) => n + basket.length, 0);
    const rules = (puzzle.combo ? 1 : 0) + (puzzle.deal ? 1 : 0);
    return ITEM_ALLOWANCE_MS * Math.max(0, items - 2) + RULE_ALLOWANCE_MS * rules;
  },

  generate(roundSeed, index, difficulty) {
    const rng = createRng(deriveSeed(roundSeed, index));
    const level = LEVELS[difficulty];
    const story = pickStory(rng, difficulty);
    let draft: Draft | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && draft === null; attempt++) {
      draft = tryDraft(rng, level, story);
    }
    const base = draft ?? bestBasketFallback(difficulty);
    // Xáo vị trí giỏ: đáp án rơi đều vào mọi ô.
    const puzzle: Draft = { ...base, baskets: rng.shuffle(base.baskets) };
    return { ...puzzle, answerIndex: bestBasketSolve(puzzle) };
  },

  check(puzzle, answer) {
    return answer === bestBasketSolve(puzzle);
  },

  isAnswer(value): value is BestBasketAnswer {
    return Number.isInteger(value) && (value as number) >= 0 && (value as number) < MAX_BASKETS;
  },
};
