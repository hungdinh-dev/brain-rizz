import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import { type HitTargetPuzzle, hitTarget } from "./hit-target";

/** Số seed mỗi mức (≥ 10 000 theo AGENTS.md). */
const SEEDS = 10_000;

/**
 * Seed vòng trải khắp dải 32 bit, chỉ số câu 0–24. Không nhân với 0x9e3779b1 như `deriveSeed`
 * nhân chỉ số câu, kẻo hai số hạng triệt tiêu nhau qua phép XOR và nhiều seed cho cùng câu đố.
 */
function roundSeedOf(s: number): number {
  return (Math.imul(s, 0x27d4eb2f) + 0x165667b1) >>> 0;
}

function generate(s: number, d: Difficulty): HitTargetPuzzle {
  return hitTarget.generate(roundSeedOf(s), s % 25, d);
}

/** Sinh sẵn 10 000 câu mỗi mức, dùng chung cho các test. */
const SAMPLES: Record<Difficulty, HitTargetPuzzle[]> = {
  0: Array.from({ length: SEEDS }, (_, s) => generate(s, 0)),
  1: Array.from({ length: SEEDS }, (_, s) => generate(s, 1)),
  2: Array.from({ length: SEEDS }, (_, s) => generate(s, 2)),
  3: Array.from({ length: SEEDS }, (_, s) => generate(s, 3)),
};

/** Thông số mỗi mức theo đặc tả (mục Độ khó). Siêu khó: thẻ dương 2–45, thẻ âm −30…−2. */
const SPEC: Record<
  Difficulty,
  {
    cards: number;
    cols: number;
    pick: number;
    min: number;
    max: number;
    tMin: number;
    tMax: number;
  }
> = {
  0: { cards: 6, cols: 2, pick: 2, min: 1, max: 9, tMin: 5, tMax: 17 },
  1: { cards: 9, cols: 3, pick: 3, min: 2, max: 20, tMin: 20, tMax: 50 },
  2: { cards: 9, cols: 3, pick: 3, min: 11, max: 60, tMin: 60, tMax: 150 },
  3: { cards: 9, cols: 3, pick: 3, min: -30, max: 45, tMin: 10, tMax: 60 },
};

/** Thời gian giải trung bình theo mô hình (giây, người lớn), đúng bảng ở mục Độ khó của đặc tả. */
const SPEC_MEAN_SECONDS: Record<Difficulty, number> = { 0: 2.92, 1: 5.23, 2: 6.01, 3: 6.84 };

/** Gom lỗi để một vòng 10 000 seed chỉ gọi `expect` một lần (nhanh, báo vài lỗi đầu). */
function expectNoFailures(failures: string[]): void {
  expect(failures.slice(0, 5), `${failures.length} lỗi`).toEqual([]);
}

/** Mọi bộ `k` chỉ số tăng dần trong [0, n). */
function indexSets(n: number, k: number): number[][] {
  if (k === 0) return [[]];
  const out: number[][] = [];
  for (let last = k - 1; last < n; last++)
    for (const head of indexSets(last, k - 1)) out.push([...head, last]);
  return out;
}
const INDEX_SETS: Record<string, number[][]> = {
  "6-2": indexSets(6, 2),
  "9-3": indexSets(9, 3),
};
const setsOf = (p: HitTargetPuzzle) => INDEX_SETS[`${p.cards.length}-${p.pick}`]!;

const valuesOf = (p: HitTargetPuzzle, idx: readonly number[]) => idx.map((i) => p.cards[i]!);
const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);

// ---------------------------------------------------------------------------------------------
// Mô hình thời gian giải của người lớn (giây), đúng như mục Cân bằng của đặc tả.
// ---------------------------------------------------------------------------------------------

const LOOK = 0.15;
const GLANCE = 0.1;
const digits = (v: number) => String(Math.abs(v)).length;

/** Thời gian tính `x − y` trong đầu. */
function arith(x: number, y: number): number {
  const d = Math.max(digits(x), digits(y));
  let cost = d === 1 ? 0.25 : d === 2 ? 0.4 : 0.5;
  if (x < 0 || y < 0) cost += 0.2;
  else if (x >= y && x % 10 < y % 10) cost += 0.1; // có mượn
  return cost;
}

function modelSeconds(p: HitTargetPuzzle): number {
  const { cards, target: t, pick } = p;
  const right = new Set(p.answer);
  const all = cards.map((_, i) => i);

  let read = 0.3 + (digits(t) >= 3 ? 0.4 : 0.3);
  for (const v of cards) read += 0.1 + (v < 0 ? 0.05 : 0);
  const taps = 0.35 * pick;

  let search = 0;
  if (pick === 2) {
    const cost = (i: number): number => {
      const need = t - cards[i]!;
      return need < 1 || need > 9 ? GLANCE : arith(t, cards[i]!) + LOOK;
    };
    for (const i of all) if (!right.has(i)) search += cost(i) / 3;
    search += (cost(p.answer[0]!) + cost(p.answer[1]!)) / 2;
    return read + search + taps;
  }

  const signSplit = cards.some((v) => v < 0);
  const anchors = signSplit ? all.filter((i) => cards[i]! < 0) : all;
  const partnersOf = (a: number) =>
    signSplit ? all.filter((i) => cards[i]! > 0) : all.filter((i) => i !== a);
  const partnerCost = (a: number, b: number): number => {
    const rest = t - cards[a]!;
    const others = partnersOf(a)
      .filter((i) => i !== b)
      .map((i) => cards[i]!);
    const need = rest - cards[b]!;
    if (need < Math.min(...others) || need > Math.max(...others)) return GLANCE;
    return arith(rest, cards[b]!) + LOOK;
  };
  const anchorPruned = (a: number): boolean => {
    const rest = t - cards[a]!;
    const vs = partnersOf(a)
      .map((i) => cards[i]!)
      .sort((x, y) => x - y);
    const n = vs.length;
    return rest < vs[0]! + vs[1]! || rest > vs[n - 1]! + vs[n - 2]!;
  };

  const rightAnchors = anchors.filter((i) => right.has(i));
  for (const a of anchors) {
    if (right.has(a)) continue;
    let fail = GLANCE;
    if (!anchorPruned(a)) {
      fail = arith(t, cards[a]!);
      for (const b of partnersOf(a)) fail += partnerCost(a, b);
    }
    search += fail / (rightAnchors.length + 1);
  }
  let success = 0;
  for (const a of rightAnchors) {
    const partners = partnersOf(a);
    const rightPartners = partners.filter((i) => right.has(i));
    let s = arith(t, cards[a]!);
    for (const b of partners)
      if (!right.has(b)) s += partnerCost(a, b) / (rightPartners.length + 1);
    s += sum(rightPartners.map((b) => partnerCost(a, b))) / rightPartners.length;
    success += s;
  }
  search += success / rightAnchors.length;
  return read + search + taps;
}

function percentile(xs: readonly number[], q: number): number {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

describe("hit-target", () => {
  it("khai báo theo CR-006: vòng 60 giây, hệ số dương và không giảm theo mức", () => {
    expect(hitTarget.id).toBe("hit-target");
    expect(hitTarget.category).toBe("compute");
    expect(hitTarget.durationMs).toBe(60_000);
    const m = DIFFICULTIES.map((d) => hitTarget.difficultyMultiplier![d]);
    for (const v of m) expect(v).toBeGreaterThan(0);
    expect(m).toEqual([...m].sort((a, b) => a - b));
    expect(m[0]).toBeLessThanOrEqual(m[1]!);
  });

  it("tất định: cùng (seed, index, độ khó) → cùng câu đố (10 000 seed × 4 mức)", () => {
    for (const d of DIFFICULTIES) {
      const failures: string[] = [];
      for (let s = 0; s < SEEDS; s++) {
        const again = generate(s, d);
        if (JSON.stringify(again) !== JSON.stringify(SAMPLES[d][s])) failures.push(`d${d} s${s}`);
      }
      expectNoFailures(failures);
    }
  }, 60_000);

  it("câu khác nhau theo seed và theo chỉ số câu", () => {
    for (const d of DIFFICULTIES) {
      const bySeed = new Set(SAMPLES[d].slice(0, 200).map((p) => JSON.stringify(p)));
      expect(bySeed.size).toBeGreaterThan(190);
      const byIndex = new Set(
        Array.from({ length: 25 }, (_, i) => JSON.stringify(hitTarget.generate(42, i, d))),
      );
      expect(byIndex.size).toBeGreaterThan(22);
    }
  });

  it("đúng MỘT bộ thẻ ra số đích, và check chỉ nhận đúng bộ đó (10 000 seed × 4 mức)", () => {
    for (const d of DIFFICULTIES) {
      const failures: string[] = [];
      for (const [s, p] of SAMPLES[d].entries()) {
        const hits = setsOf(p).filter((idx) => sum(valuesOf(p, idx)) === p.target);
        if (hits.length !== 1 || hits[0]!.join() !== p.answer.join())
          failures.push(`d${d} s${s}: ${hits.length} bộ ra đích`);
        const accepted = setsOf(p).filter((idx) => hitTarget.check(p, idx));
        if (accepted.length !== 1 || accepted[0]!.join() !== p.answer.join())
          failures.push(`d${d} s${s}: check nhận ${accepted.length} bộ`);
      }
      expectNoFailures(failures);
    }
  }, 60_000);

  it("check nhận đáp án theo mọi thứ tự chạm, từ chối mảng thiếu, thừa hoặc trùng", () => {
    for (const d of DIFFICULTIES) {
      for (const p of SAMPLES[d].slice(0, 500)) {
        const a = p.answer;
        expect(hitTarget.check(p, [...a].reverse())).toBe(true);
        if (a.length === 3) expect(hitTarget.check(p, [a[1]!, a[0]!, a[2]!])).toBe(true);
        expect(hitTarget.check(p, a.slice(0, -1))).toBe(false);
        expect(hitTarget.check(p, [a[0]!, ...a])).toBe(false);
        expect(
          hitTarget.check(
            p,
            a.map(() => a[0]!),
          ),
        ).toBe(false);
      }
    }
  });

  it("ràng buộc từng mức: số thẻ, lưới, giá trị khác nhau, phạm vi số và số đích (10 000 seed × 4 mức)", () => {
    for (const d of DIFFICULTIES) {
      const spec = SPEC[d];
      const failures: string[] = [];
      for (const [s, p] of SAMPLES[d].entries()) {
        const tag = `d${d} s${s}`;
        if (p.cards.length !== spec.cards || p.cols !== spec.cols || p.pick !== spec.pick)
          failures.push(`${tag}: hình dạng`);
        if (new Set(p.cards).size !== p.cards.length) failures.push(`${tag}: thẻ trùng giá trị`);
        if (!p.cards.every((v) => Number.isInteger(v) && v >= spec.min && v <= spec.max && v !== 0))
          failures.push(`${tag}: giá trị ngoài phạm vi ${p.cards}`);
        if (!Number.isInteger(p.target) || p.target < spec.tMin || p.target > spec.tMax)
          failures.push(`${tag}: đích ${p.target}`);
        const sortedIdx = [...p.answer].sort((a, b) => a - b);
        if (
          p.answer.length !== p.pick ||
          p.answer.join() !== sortedIdx.join() ||
          new Set(p.answer).size !== p.pick ||
          !p.answer.every((i) => Number.isInteger(i) && i >= 0 && i < p.cards.length)
        )
          failures.push(`${tag}: answer ${p.answer}`);

        const negatives = p.cards.filter((v) => v < 0).length;
        const answerNegatives = valuesOf(p, p.answer).filter((v) => v < 0).length;
        if (d === 3) {
          if (negatives !== 3 || answerNegatives !== 1)
            failures.push(`${tag}: ${negatives} thẻ âm, đáp án ${answerNegatives} thẻ âm`);
          if (!p.cards.every((v) => (v < 0 ? v >= -30 && v <= -2 : v >= 2 && v <= 45)))
            failures.push(`${tag}: thẻ âm/dương ngoài phạm vi`);
        } else if (negatives !== 0) failures.push(`${tag}: có thẻ âm`);

        // Mức chọn 3: đáp án không bao giờ là 3 thẻ lớn nhất hay 3 thẻ nhỏ nhất.
        if (p.pick === 3) {
          const sorted = [...p.cards].sort((a, b) => a - b);
          const ans = valuesOf(p, p.answer)
            .sort((a, b) => a - b)
            .join();
          if (ans === sorted.slice(0, 3).join() || ans === sorted.slice(-3).join())
            failures.push(`${tag}: đáp án là 3 thẻ lớn/nhỏ nhất`);
        }
      }
      expectNoFailures(failures);
    }
  });

  it("vị trí đáp án rải đều trên lưới (tần suất mỗi ô lệch < 15 % so với chia đều)", () => {
    for (const d of DIFFICULTIES) {
      const n = SPEC[d].cards;
      const counts = new Array<number>(n).fill(0);
      for (const p of SAMPLES[d]) for (const i of p.answer) counts[i]!++;
      const expected = SPEC[d].pick / n;
      for (const c of counts) {
        expect(c / SEEDS).toBeGreaterThan(expected * 0.85);
        expect(c / SEEDS).toBeLessThan(expected * 1.15);
      }
    }
  });

  it("độ khó tăng thật: thời gian theo mô hình tăng ngặt, P90 mức dưới < P10 mức trên", () => {
    const stats = DIFFICULTIES.map((d) => {
      const times = SAMPLES[d].map(modelSeconds);
      const mean = sum(times) / times.length;
      return { d, mean, p10: percentile(times, 0.1), p90: percentile(times, 0.9) };
    });
    for (const { d, mean } of stats)
      expect(Math.abs(mean - SPEC_MEAN_SECONDS[d])).toBeLessThan(0.1);
    for (let i = 1; i < stats.length; i++) {
      expect(stats[i]!.mean).toBeGreaterThan(stats[i - 1]!.mean);
      expect(stats[i - 1]!.p90).toBeLessThan(stats[i]!.p10);
    }
  }, 60_000);

  it("độ khó tăng thật: mỗi mức thêm một thứ mới (số thẻ, số hai chữ số, đích ba chữ số, số âm)", () => {
    const mean = (d: Difficulty, f: (p: HitTargetPuzzle) => number) =>
      sum(SAMPLES[d].map(f)) / SEEDS;
    const twoDigitShare = (p: HitTargetPuzzle) =>
      p.cards.filter((v) => digits(v) >= 2).length / p.cards.length;
    // Mầm → Thường: thêm thẻ (6 → 9), chọn 3 và số hai chữ số.
    expect(mean(0, twoDigitShare)).toBe(0);
    expect(mean(1, twoDigitShare)).toBeGreaterThan(0.3);
    // Thường → Khó: mọi thẻ hai chữ số, đích thường có ba chữ số.
    expect(mean(2, twoDigitShare)).toBe(1);
    expect(mean(2, (p) => (p.target >= 100 ? 1 : 0))).toBeGreaterThan(0.4);
    // Khó → Siêu khó: thêm số âm.
    expect(mean(3, (p) => p.cards.filter((v) => v < 0).length)).toBe(3);
  });

  it("speedAllowanceMs hữu hạn, ≥ 0, tất định: 500 / 1 000 / 1 000 / 1 000 ms", () => {
    const expected: Record<Difficulty, number> = { 0: 500, 1: 1_000, 2: 1_000, 3: 1_000 };
    for (const d of DIFFICULTIES) {
      for (const p of SAMPLES[d].slice(0, 1_000)) {
        const v = hitTarget.speedAllowanceMs!(p, d);
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBe(expected[d]);
      }
    }
  });

  it("isAnswer nhận mọi đáp án đúng và mọi bộ đủ thẻ client có thể gửi", () => {
    for (const d of DIFFICULTIES) {
      for (const p of SAMPLES[d].slice(0, 200)) {
        expect(hitTarget.isAnswer(p.answer)).toBe(true);
        for (const idx of setsOf(p)) expect(hitTarget.isAnswer([...idx].reverse())).toBe(true);
      }
    }
  });

  it("isAnswer từ chối dữ liệu rác", () => {
    const sparse = [0, 1, 2];
    delete sparse[1];
    const junk: unknown[] = [
      0,
      "0,1",
      null,
      undefined,
      {},
      [],
      [0],
      [0, 1, 2, 3],
      [0, 0],
      [1, 2, 1],
      [-1, 2],
      [0, 9],
      [0, 1.5],
      [0, Number.NaN],
      [0, Number.POSITIVE_INFINITY],
      ["0", 1],
      [0, 1n],
      [[0], 1],
      sparse,
    ];
    for (const [i, v] of junk.entries()) expect(hitTarget.isAnswer(v), `junk[${i}]`).toBe(false);
  });
});
