import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import {
  BEST_BASKET_SNACKS,
  type BestBasketItem,
  type BestBasketPuzzle,
  bestBasket,
  bestBasketFallback,
  bestBasketSolve,
  bestBasketTotals,
} from "./best-basket";

const SEEDS = 10_000;

/** Bảng Độ khó của đặc tả (docs/04-minigames/best-basket.md), theo thứ tự Mầm → Siêu khó. */
const SPEC = [
  { baskets: 3, items: 1, price: [1, 9], stars: [1, 5], budget: [3, 8], overage: 3, gap: 4 },
  { baskets: 4, items: 2, price: [1, 5], stars: [1, 5], budget: [4, 10], overage: 2, gap: 2 },
  { baskets: 4, items: 2, price: [1, 5], stars: [1, 5], budget: [4, 10], overage: 2, gap: 2 },
  { baskets: 4, items: 2, price: [1, 5], stars: [1, 5], budget: [4, 10], overage: 2, gap: 2 },
] as const;
const AFFORDABLE = 2;
const COMBO_KIND_MAX_STARS = 4;

const cache = new Map<Difficulty, BestBasketPuzzle[]>();

/** 10.000 câu mỗi mức, sinh một lần rồi dùng chung cho mọi test. */
function puzzlesOf(d: Difficulty): BestBasketPuzzle[] {
  let list = cache.get(d);
  if (!list) {
    list = Array.from({ length: SEEDS }, (_, s) => bestBasket.generate(s * 7 + 3, s % 41, d));
    cache.set(d, list);
  }
  return list;
}

/** Chạy `fn` cho mọi câu của mọi mức; gom tối đa 5 lỗi đầu tiên để báo. */
function expectEvery(fn: (p: BestBasketPuzzle, d: Difficulty) => string | null) {
  const bad: string[] = [];
  let failures = 0;
  for (const d of DIFFICULTIES) {
    puzzlesOf(d).forEach((p, s) => {
      const msg = fn(p, d);
      if (msg === null) return;
      failures++;
      if (bad.length < 5) bad.push(`độ khó ${d}, seed ${s}: ${msg}`);
    });
  }
  expect(bad, `${failures} câu lỗi`).toEqual([]);
}

/** Tỉ lệ câu thoả `fn` ở mức `d`. */
function rate(d: Difficulty, fn: (p: BestBasketPuzzle) => boolean): number {
  return puzzlesOf(d).filter(fn).length / SEEDS;
}

/** Tổng giá/sao tính lại độc lập với `bestBasketTotals`, để kiểm chính hàm dùng chung đó. */
function naiveTotals(p: BestBasketPuzzle, basket: readonly BestBasketItem[]) {
  let price = basket.reduce((n, it) => n + it.price, 0);
  let stars = basket.reduce((n, it) => n + it.stars, 0);
  const kinds = basket.map((it) => it.kind);
  if (p.combo && kinds.includes(p.combo.kinds[0]) && kinds.includes(p.combo.kinds[1])) {
    stars += p.combo.bonus;
  }
  if (p.deal) {
    const same = kinds.filter((k) => k === p.deal!.kind).length;
    price -= p.deal.discount * Math.floor(same / 2);
  }
  return { price, stars };
}

const inRange = (v: number, [min, max]: readonly [number, number]) =>
  Number.isInteger(v) && v >= min && v <= max;

/** Mọi bất biến của một câu; trả lỗi đầu tiên hoặc `null`. Dùng cho câu sinh ra và câu dựng sẵn. */
function violation(p: BestBasketPuzzle, d: Difficulty): string | null {
  const spec = SPEC[d];
  if (p.baskets.length !== spec.baskets) return `${p.baskets.length} giỏ`;
  if (!inRange(p.budget, spec.budget)) return `số xu ${p.budget}`;
  if (p.baskets.some((b) => b.length !== spec.items)) return "sai số món mỗi giỏ";

  // Cùng loại thì cùng giá, cùng sao; giá trị trong khoảng của mức.
  const menu = new Map<string, string>();
  for (const it of p.baskets.flat()) {
    if (!BEST_BASKET_SNACKS.includes(it.kind)) return `loại lạ ${it.kind}`;
    if (!inRange(it.price, spec.price) || !inRange(it.stars, spec.stars)) {
      return `món ${it.kind} ${it.price}/${it.stars} ngoài khoảng`;
    }
    const key = `${it.price}/${it.stars}`;
    if ((menu.get(it.kind) ?? key) !== key) return `${it.kind} có hai giá/sao`;
    menu.set(it.kind, key);
  }
  const shapes = p.baskets.map((b) =>
    b
      .map((it) => it.kind)
      .sort()
      .join("+"),
  );
  if (new Set(shapes).size !== shapes.length) return "hai giỏ giống hệt nhau";

  // Luật theo mức.
  const totals = p.baskets.map((b) => bestBasketTotals(b, p));
  for (const [i, b] of p.baskets.entries()) {
    const naive = naiveTotals(p, b);
    if (naive.price !== totals[i]!.price || naive.stars !== totals[i]!.stars) {
      return "bestBasketTotals lệch cách tính độc lập";
    }
    if (totals[i]!.price < 1) return "giỏ giá < 1 xu sau ưu đãi";
  }
  const comboAt = totals.flatMap((t, i) => (t.comboApplied ? [i] : []));
  const dealAt = totals.flatMap((t, i) => (t.dealTimes > 0 ? [i] : []));
  if (d < 2 && (p.combo !== null || p.deal !== null)) return "Mầm/Thường có luật";
  if (d >= 2) {
    const c = p.combo;
    if (!c || c.kinds[0] === c.kinds[1] || !inRange(c.bonus, [2, 3])) return "cặp đi kèm sai";
    if (comboAt.length !== 1) return `${comboAt.length} giỏ đủ cặp đi kèm`;
    if (c.kinds.some((k) => Number(menu.get(k)?.split("/")[1]) > COMBO_KIND_MAX_STARS)) {
      return "món đi kèm > 4 sao";
    }
    const partial = p.baskets.some((b) => b.filter((it) => c.kinds.includes(it.kind)).length === 1);
    if (d === 2 && !partial) return "không có giỏ chỉ có nửa cặp";
  }
  if (d === 2 && p.deal !== null) return "Khó có ưu đãi";
  if (d === 3) {
    const deal = p.deal;
    if (!deal || !inRange(deal.discount, [2, 3]) || p.combo?.kinds.includes(deal.kind)) {
      return "ưu đãi sai";
    }
    if (dealAt.length !== 1) return `${dealAt.length} giỏ được ưu đãi`;
    const dealBasket = p.baskets[dealAt[0]!]!;
    if (dealBasket.some((it) => it.kind !== deal.kind))
      return "giỏ ưu đãi không phải 2 món cùng loại";
    if (totals[dealAt[0]!]!.price + deal.discount <= p.budget)
      return "giỏ ưu đãi không trông như lố";
    if (!p.baskets.some((b) => b.filter((it) => it.kind === deal.kind).length === 1)) {
      return "không có giỏ chỉ có một món ưu đãi";
    }
  }
  // Ngoài giỏ ưu đãi, mọi giỏ 2 món khác loại.
  for (const [i, b] of p.baskets.entries()) {
    if (!dealAt.includes(i) && new Set(b.map((it) => it.kind)).size !== b.length) {
      return "giỏ thường có 2 món cùng loại";
    }
  }

  // Đúng một đáp án; đúng số giỏ vừa tiền; bẫy lố tiền nhiều sao hơn; giỏ kia sát đáp án.
  const correct = p.baskets.map((_, i) => i).filter((i) => bestBasket.check(p, i));
  if (correct.length !== 1 || correct[0] !== p.answerIndex) return `đáp án ${correct.join(",")}`;
  if (bestBasketSolve(p) !== p.answerIndex) return "answerIndex ≠ bestBasketSolve";
  const affordable = totals.flatMap((t, i) => (t.price <= p.budget ? [i] : []));
  if (affordable.length !== AFFORDABLE) return `${affordable.length} giỏ vừa tiền`;
  const best = totals[p.answerIndex]!.stars;
  const runner = totals[affordable.find((i) => i !== p.answerIndex)!]!.stars;
  if (best <= runner || best - runner > spec.gap) return `đáp án ${best} sao, giỏ kia ${runner}`;
  const traps = totals.filter((t) => t.price > p.budget && t.stars > best);
  if (traps.length === 0) return "không có giỏ bẫy";
  if (Math.min(...traps.map((t) => t.price - p.budget)) > spec.overage) return "bẫy lố quá xa";
  return null;
}

/**
 * Mô hình thời gian giải của người lớn (giây), đúng như mục Cân bằng của đặc tả: cố định 1,1 s; mỗi
 * luật 0,35 s đọc thẻ + 0,05 s mỗi món phải dò; mỗi giỏ đọc giá (0,15 s mỗi loại món), cộng (0,25 s
 * mỗi món thêm, +0,15 s nếu tổng ≥ 10), trừ ưu đãi 0,3 s, so với túi 0,1 s (+0,15 s nếu sát: bằng
 * hoặc lố 1 xu); giỏ vừa tiền đọc và cộng sao như giá, cộng thưởng 0,3 s; so sao 0,1 s mỗi giỏ sau
 * giỏ đầu (+0,15 s nếu hơn kém 1 sao).
 */
function modelSeconds(p: BestBasketPuzzle): number {
  const rules = (p.combo ? 1 : 0) + (p.deal ? 1 : 0);
  const items = p.baskets.reduce((n, b) => n + b.length, 0);
  let t = 1.1 + rules * (0.35 + 0.05 * items);
  const totals = p.baskets.map((b) => bestBasketTotals(b, p));
  const raw = p.baskets.map((b) => bestBasketTotals(b, { combo: null, deal: null }));
  const affordable: number[] = [];
  p.baskets.forEach((b, i) => {
    const distinct = new Set(b.map((it) => it.kind)).size;
    const read = 0.15 * distinct + 0.25 * (b.length - 1);
    t += read + (raw[i]!.price >= 10 ? 0.15 : 0) + 0.1;
    if (totals[i]!.dealTimes > 0) t += 0.3;
    const over = totals[i]!.price - p.budget;
    if (over === 0 || over === 1) t += 0.15;
    if (totals[i]!.price > p.budget) return;
    affordable.push(totals[i]!.stars);
    t += read + (raw[i]!.stars >= 10 ? 0.15 : 0);
    if (totals[i]!.comboApplied)
      t += 0.3 + (totals[i]!.stars >= 10 && raw[i]!.stars < 10 ? 0.15 : 0);
  });
  t += 0.1 * (affordable.length - 1);
  const [a, b] = [...affordable].sort((x, y) => y - x);
  if (a! - b! === 1) t += 0.15;
  return t;
}

const percentile = (values: number[], q: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(q * (sorted.length - 1))]!;
};

describe("best-basket", () => {
  it("tất định: cùng (seed, index, độ khó) → cùng câu đố", () => {
    for (const d of DIFFICULTIES) {
      for (let s = 0; s < 200; s++) {
        expect(bestBasket.generate(s * 31 + 1, s % 13, d)).toEqual(
          bestBasket.generate(s * 31 + 1, s % 13, d),
        );
      }
    }
  });

  it("câu khác nhau theo index (không lặp một câu)", () => {
    for (const d of DIFFICULTIES) {
      const shapes = new Set(
        Array.from({ length: 50 }, (_, i) => JSON.stringify(bestBasket.generate(42, i, d))),
      );
      expect(shapes.size).toBeGreaterThan(45);
    }
  });

  it("mọi câu đúng luật của mức và có đúng MỘT đáp án (10.000 seed × 4 mức)", () => {
    expectEvery((p, d) => violation(p, d));
  });

  it("câu dựng sẵn (dự phòng) cũng đúng luật, và bộ sinh không phải dùng tới", () => {
    for (const d of DIFFICULTIES) {
      const base = bestBasketFallback(d);
      const p = { ...base, answerIndex: bestBasketSolve(base) };
      expect(violation(p, d), `mức ${d}`).toBeNull();
      const key = (q: BestBasketPuzzle) =>
        JSON.stringify([q.budget, q.combo, q.deal, q.baskets.map((b) => JSON.stringify(b)).sort()]);
      expect(puzzlesOf(d).filter((q) => key(q) === key(p))).toHaveLength(0);
    }
  });

  it("đáp án rơi đều vào mọi giỏ", () => {
    for (const d of DIFFICULTIES) {
      const n = SPEC[d].baskets;
      for (let i = 0; i < n; i++) {
        expect(Math.abs(rate(d, (p) => p.answerIndex === i) - 1 / n)).toBeLessThan(0.03);
      }
    }
  });

  it("Khó: thưởng cặp đi kèm thật sự đổi đáp án, giỏ đi kèm đóng đủ vai", () => {
    const comboAt = (p: BestBasketPuzzle) =>
      p.baskets.findIndex((b) => bestBasketTotals(b, p).comboApplied);
    const decisive = rate(2, (p) => bestBasketSolve({ ...p, combo: null }) !== p.answerIndex);
    const answer = rate(2, (p) => comboAt(p) === p.answerIndex);
    const over = rate(2, (p) => bestBasketTotals(p.baskets[comboAt(p)]!, p).price > p.budget);
    expect(decisive).toBeGreaterThan(0.3);
    expect(answer).toBeGreaterThan(0.3);
    expect(answer).toBeLessThan(0.5);
    expect(over).toBeGreaterThan(0.2);
    expect(1 - answer - over).toBeGreaterThan(0.2);
  });

  it("Siêu khó: ưu đãi và thưởng đều đổi đáp án ở nhiều câu", () => {
    const dealDecisive = rate(3, (p) => bestBasketSolve({ ...p, deal: null }) !== p.answerIndex);
    const comboDecisive = rate(3, (p) => bestBasketSolve({ ...p, combo: null }) !== p.answerIndex);
    const rescued = rate(3, (p) =>
      p.baskets.some((b) => {
        const t = bestBasketTotals(b, p);
        return t.dealTimes > 0 && t.price <= p.budget;
      }),
    );
    const ignoreRules = rate(
      3,
      (p) => bestBasketSolve({ ...p, combo: null, deal: null }) === p.answerIndex,
    );
    expect(dealDecisive).toBeGreaterThan(0.25);
    expect(comboDecisive).toBeGreaterThan(0.25);
    expect(rescued).toBeGreaterThan(0.5);
    expect(rescued).toBeLessThan(0.9);
    expect(ignoreRules).toBeLessThan(0.5);
  });

  it("không có mẹo tắt: chọn giỏ vừa tiền đắt hơn không thắng quá nửa", () => {
    for (const d of DIFFICULTIES) {
      const pricier = rate(d, (p) => {
        const aff = p.baskets
          .map((b, i) => ({ i, price: bestBasketTotals(b, p).price }))
          .filter((x) => x.price <= p.budget)
          .sort((x, y) => y.price - x.price);
        return aff[0]!.price > aff[1]!.price && aff[0]!.i === p.answerIndex;
      });
      expect(pricier, `mức ${d}`).toBeLessThan(0.5);
    }
  });

  it("khó dần thật: số món, số luật và thời gian giải theo mô hình cùng tăng, các mức không chồng nhau", () => {
    const load = DIFFICULTIES.map((d) => {
      const p = puzzlesOf(d)[0]!;
      return p.baskets.flat().length + 10 * ((p.combo ? 1 : 0) + (p.deal ? 1 : 0));
    });
    expect(load).toEqual([3, 8, 18, 28]);
    const times = DIFFICULTIES.map((d) => puzzlesOf(d).map(modelSeconds));
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    for (let d = 1; d < times.length; d++) {
      expect(mean(times[d]!) - mean(times[d - 1]!)).toBeGreaterThan(0.5);
      expect(percentile(times[d - 1]!, 0.9)).toBeLessThan(percentile(times[d]!, 0.1));
    }
    // Siêu khó vẫn ≤ 7,1 s để còn ≥ 8 câu mỗi vòng 60 s (mục Cân bằng).
    expect(mean(times[3]!)).toBeLessThan(7.1);
  });

  it("bestBasketTotals: thưởng cần đủ cặp, ưu đãi tính theo từng đôi", () => {
    const it2 = (kind: BestBasketItem["kind"], price: number, stars: number) => ({
      kind,
      price,
      stars,
    });
    const rules = {
      combo: { kinds: ["bun", "milk"] as ["bun", "milk"], bonus: 3 },
      deal: { kind: "apple" as const, discount: 2 },
    };
    expect(bestBasketTotals([it2("bun", 2, 1), it2("milk", 3, 2)], rules)).toEqual({
      price: 5,
      stars: 6,
      comboApplied: true,
      dealTimes: 0,
    });
    expect(bestBasketTotals([it2("bun", 2, 1), it2("apple", 3, 2)], rules).stars).toBe(3);
    expect(bestBasketTotals([it2("apple", 3, 2), it2("apple", 3, 2)], rules).price).toBe(4);
    expect(
      bestBasketTotals([it2("apple", 3, 2), it2("apple", 3, 2), it2("apple", 3, 2)], rules).price,
    ).toBe(7);
    // Hoà sao hoặc không giỏ nào vừa tiền → không có đáp án.
    const tie = {
      budget: 5,
      combo: null,
      deal: null,
      baskets: [[it2("bun", 2, 3)], [it2("milk", 3, 3)]],
    };
    expect(bestBasketSolve(tie)).toBe(-1);
    expect(bestBasketSolve({ ...tie, budget: 1 })).toBe(-1);
  });

  it("miễn trừ thời gian và hệ số điểm hợp lệ", () => {
    const expected = [250, 1500, 2000, 2500];
    for (const d of DIFFICULTIES) {
      for (const p of puzzlesOf(d).slice(0, 200)) {
        expect(bestBasket.speedAllowanceMs?.(p, d)).toBe(expected[d]);
      }
    }
    const m = DIFFICULTIES.map((d) => bestBasket.difficultyMultiplier![d]);
    expect(m.every((x) => Number.isFinite(x) && x > 0)).toBe(true);
    expect(m).toEqual([...m].sort((a, b) => a - b));
  });

  it("check() và isAnswer() từ chối dữ liệu rác", () => {
    const p = puzzlesOf(1)[0]!;
    expect(bestBasket.check(p, p.answerIndex)).toBe(true);
    expect(bestBasket.check(p, (p.answerIndex + 1) % 4)).toBe(false);
    expect(bestBasket.check(p, 7)).toBe(false);
    for (const ok of [0, 1, 2, 3]) expect(bestBasket.isAnswer(ok)).toBe(true);
    for (const bad of [
      -1,
      4,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "0",
      null,
      undefined,
      {},
      [0],
      true,
    ]) {
      expect(bestBasket.isAnswer(bad)).toBe(false);
    }
  });
});
