import { describe, expect, it, vi } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import {
  ACCESSORY_SLOTS,
  type AccessorySlot,
  BUDDY_ATTRS,
  BUDDY_VARIANTS,
  type Buddy,
  CROWD_SEARCH_GRID,
  CROWD_SEARCH_MAX_CROWD,
  CROWD_SPECIES,
  type CrowdSearchPuzzle,
  crowdSearch,
  crowdSearchMismatch,
  matchesCard,
} from "./crowd-search";

/** 2 500 seed × 4 mức = 10 000 câu đố. */
const SEEDS_PER_LEVEL = 2_500;
const CROWD_SIZE: Record<Difficulty, number> = { 0: 9, 1: 16, 2: 25, 3: 30 };

function forAll(d: Difficulty, fn: (p: CrowdSearchPuzzle, seed: number) => void) {
  for (let seed = 0; seed < SEEDS_PER_LEVEL; seed++) {
    fn(crowdSearch.generate(seed, seed % 31, d), seed);
  }
}

/*
 * Ba cách đọc luật, viết lại độc lập với bộ sinh. Bộ sinh phải cho cùng một đáp án duy nhất ở cả
 * ba cách, để người chơi hiểu luật kiểu nào cũng không gặp câu hai đáp án.
 */
const card = (p: CrowdSearchPuzzle) => p.card.buddy;
/** "Giống hệt thẻ": cả 4 thuộc tính bằng nhau (món không vẽ = không có). */
const isTwin = (p: CrowdSearchPuzzle, b: Buddy) => BUDDY_ATTRS.every((a) => b[a] === card(p)[a]);
/** "Có đủ những gì vẽ trên thẻ" (món không vẽ thì sao cũng được). */
const hasAllDrawn = (p: CrowdSearchPuzzle, b: Buddy) =>
  b.species === card(p).species &&
  ACCESSORY_SLOTS.every((s) => card(p)[s] === 0 || b[s] === card(p)[s]);
/** Luật chính thức: có đủ những gì trên thẻ, KHÔNG có đúng món bị gạch. */
const officialRule = (p: CrowdSearchPuzzle, b: Buddy) =>
  hasAllDrawn(p, b) && !(p.card.not && b[p.card.not.slot] === p.card.not.value);
/** Đọc gạch chéo là "không có món nào ở ô đó" (vd. "không đội mũ" nói chung). */
const strictNone = (p: CrowdSearchPuzzle, b: Buddy) =>
  hasAllDrawn(p, b) && !(p.card.not && b[p.card.not.slot] !== 0);

const indicesWhere = (p: CrowdSearchPuzzle, pred: (b: Buddy) => boolean) =>
  p.crowd.flatMap((b, i) => (pred(b) ? [i] : []));

const distance = (a: Buddy, b: Buddy) => BUDDY_ATTRS.filter((k) => a[k] !== b[k]).length;
const answerOf = (p: CrowdSearchPuzzle) => p.crowd[p.answerIndex]!;
const others = (p: CrowdSearchPuzzle) => p.crowd.filter((_, i) => i !== p.answerIndex);
/** Bạn "gần giống": lệch đúng 1 thuộc tính so với bạn cần tìm. */
const nearCount = (p: CrowdSearchPuzzle) =>
  others(p).filter((b) => distance(b, answerOf(p)) === 1).length;
const sameSpeciesCount = (p: CrowdSearchPuzzle) =>
  p.crowd.filter((b) => b.species === answerOf(p).species).length;
const drawnAccessories = (p: CrowdSearchPuzzle) =>
  ACCESSORY_SLOTS.filter((s) => card(p)[s] !== 0).length;
/** Số điều kiện trên thẻ: loài + số món vẽ + món bị gạch. */
const conditionCount = (p: CrowdSearchPuzzle) => 1 + drawnAccessories(p) + (p.card.not ? 1 : 0);

describe("crowd-search: bộ sinh", { timeout: 60_000 }, () => {
  it("tất định: cùng (seed, index, độ khó) → cùng câu đố", () => {
    for (const d of DIFFICULTIES) {
      for (let seed = 0; seed < 500; seed++) {
        expect(crowdSearch.generate(seed, seed % 23, d)).toEqual(
          crowdSearch.generate(seed, seed % 23, d),
        );
      }
    }
    // Seed hay index khác thì câu đố khác (không trả về một câu cố định).
    const a = crowdSearch.generate(1, 0, 2);
    expect(crowdSearch.generate(2, 0, 2)).not.toEqual(a);
    expect(crowdSearch.generate(1, 1, 2)).not.toEqual(a);
  });

  it("không dùng Math.random hay Date.now", () => {
    const random = vi.spyOn(Math, "random");
    const now = vi.spyOn(Date, "now");
    for (const d of DIFFICULTIES) for (let i = 0; i < 200; i++) crowdSearch.generate(i, i, d);
    expect(random).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    random.mockRestore();
    now.mockRestore();
  });

  for (const d of DIFFICULTIES) {
    it(`mức ${d}: đúng MỘT bạn khớp thẻ ở cả ba cách đọc luật (${SEEDS_PER_LEVEL} seed)`, () => {
      forAll(d, (p) => {
        expect(p.cols).toBe(CROWD_SEARCH_GRID[d].cols);
        expect(p.rows).toBe(CROWD_SEARCH_GRID[d].rows);
        expect(p.crowd).toHaveLength(CROWD_SIZE[d]);
        expect(p.crowd).toHaveLength(p.cols * p.rows);
        for (const b of p.crowd) {
          expect(Number.isInteger(b.species)).toBe(true);
          expect(b.species).toBeGreaterThanOrEqual(0);
          expect(b.species).toBeLessThan(CROWD_SPECIES.length);
          for (const s of ACCESSORY_SLOTS) {
            expect(Number.isInteger(b[s])).toBe(true);
            expect(b[s]).toBeGreaterThanOrEqual(0);
            expect(b[s]).toBeLessThanOrEqual(BUDDY_VARIANTS[s]);
          }
        }
        // Thẻ vẽ đúng nguyên dạng bạn cần tìm.
        expect(answerOf(p)).toEqual(card(p));
        expect(indicesWhere(p, (b) => officialRule(p, b))).toEqual([p.answerIndex]);
        expect(indicesWhere(p, (b) => isTwin(p, b))).toEqual([p.answerIndex]);
        expect(indicesWhere(p, (b) => strictNone(p, b))).toEqual([p.answerIndex]);
        // Hàm export cho FE khớp luật chính thức; bạn sai nào cũng có ít nhất một chi tiết lệch.
        expect(indicesWhere(p, (b) => matchesCard(b, p.card))).toEqual([p.answerIndex]);
        p.crowd.forEach((b, i) => {
          expect(crowdSearchMismatch(b, p.card).length === 0).toBe(i === p.answerIndex);
        });
        const correct = p.crowd.flatMap((_, i) => (crowdSearch.check(p, i) ? [i] : []));
        expect(correct).toEqual([p.answerIndex]);
      });
    });
  }

  it("Mầm: bạn cần tìm là bạn duy nhất của loài đó, thẻ có 1 món, đủ 5 loài khác", () => {
    forAll(0, (p) => {
      expect(sameSpeciesCount(p)).toBe(1);
      expect(drawnAccessories(p)).toBe(1);
      expect(p.card.not).toBeUndefined();
      expect(new Set(others(p).map((b) => b.species)).size).toBe(CROWD_SPECIES.length - 1);
    });
  });

  it("Thường: 4 bạn cùng loài, 3 bạn kia lệch đúng 1 món có trên thẻ; ≥ 2 bạn khác loài y hệt phụ kiện", () => {
    forAll(1, (p) => {
      const ans = answerOf(p);
      expect(drawnAccessories(p)).toBe(2);
      expect(p.card.not).toBeUndefined();
      expect(sameSpeciesCount(p)).toBe(4);
      for (const b of others(p).filter((o) => o.species === ans.species)) {
        const diff = BUDDY_ATTRS.filter((k) => b[k] !== ans[k]);
        expect(diff).toHaveLength(1);
        expect(card(p)[diff[0] as AccessorySlot]).not.toBe(0);
      }
      const otherTwins = others(p).filter(
        (b) => b.species !== ans.species && distance(b, ans) === 1,
      );
      expect(otherTwins.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("Khó: thẻ đủ 3 món; ≥ 8 bạn gần giống (lệch đúng 1 thuộc tính), ≥ 5 trong đó cùng loài", () => {
    forAll(2, (p) => {
      const ans = answerOf(p);
      expect(drawnAccessories(p)).toBe(3);
      expect(p.card.not).toBeUndefined();
      const near = others(p).filter((b) => distance(b, ans) === 1);
      expect(near.length).toBeGreaterThanOrEqual(8);
      expect(near.filter((b) => b.species === ans.species).length).toBeGreaterThanOrEqual(5);
    });
  });

  it("Siêu khó: có món bị gạch ở ô bạn cần tìm để trống; ≥ 2 bẫy = bạn cần tìm + đúng món đó", () => {
    forAll(3, (p) => {
      const ans = answerOf(p);
      const not = p.card.not;
      expect(not).toBeDefined();
      if (!not) return;
      expect(drawnAccessories(p)).toBe(2);
      expect(ans[not.slot]).toBe(0);
      expect(not.value).toBeGreaterThanOrEqual(1);
      expect(not.value).toBeLessThanOrEqual(BUDDY_VARIANTS[not.slot]);
      // Bẫy: có đủ mọi thứ vẽ trên thẻ nhưng có món bị gạch, và chỉ khác đáp án ở đúng món đó.
      const traps = others(p).filter((b) => hasAllDrawn(p, b));
      expect(traps.length).toBeGreaterThanOrEqual(2);
      for (const t of traps) {
        expect(t).toEqual({ ...ans, [not.slot]: not.value });
        expect(crowdSearchMismatch(t, p.card)).toEqual([not.slot]);
      }
      expect(nearCount(p)).toBeGreaterThanOrEqual(9);
    });
  });

  it("độ khó tăng thật: đông hơn, nhiều bạn gần giống và cùng loài hơn, thẻ nhiều điều kiện hơn", () => {
    const mean = (d: Difficulty, f: (p: CrowdSearchPuzzle) => number) => {
      let sum = 0;
      forAll(d, (p) => {
        sum += f(p);
      });
      return sum / SEEDS_PER_LEVEL;
    };
    /** Bạn cùng loài lệch đúng 1 món: chỉ phân biệt được bằng chi tiết phụ kiện. */
    const smallDetail = (p: CrowdSearchPuzzle) =>
      others(p).filter((b) => b.species === answerOf(p).species && distance(b, answerOf(p)) === 1)
        .length;
    const increasing = (xs: number[]) => xs.every((x, i) => i === 0 || x > (xs[i - 1] as number));

    const sizes = DIFFICULTIES.map((d) => mean(d, (p) => p.crowd.length));
    const near = DIFFICULTIES.map((d) => mean(d, nearCount));
    const same = DIFFICULTIES.map((d) => mean(d, sameSpeciesCount));
    const small = DIFFICULTIES.map((d) => mean(d, smallDetail));
    const conditions = DIFFICULTIES.map((d) => mean(d, conditionCount));

    expect(sizes).toEqual([9, 16, 25, 30]);
    expect(increasing(near)).toBe(true);
    expect(increasing(same)).toBe(true);
    expect(increasing(small)).toBe(true);
    expect(small[0]).toBe(0);
    expect(conditions).toEqual([2, 3, 4, 4]);
  });

  it("phân bố đều: ô đáp án, loài cần tìm, ô món bị gạch (lệch < 20 % so với đều)", () => {
    const N = 12_000;
    for (const d of DIFFICULTIES) {
      const cells = new Array<number>(CROWD_SIZE[d]).fill(0);
      const species = new Array<number>(CROWD_SPECIES.length).fill(0);
      const notSlots = new Map<string, number>();
      for (let seed = 0; seed < N; seed++) {
        const p = crowdSearch.generate(seed * 7 + 3, seed % 17, d);
        cells[p.answerIndex] = (cells[p.answerIndex] ?? 0) + 1;
        species[answerOf(p).species] = (species[answerOf(p).species] ?? 0) + 1;
        if (p.card.not) notSlots.set(p.card.not.slot, (notSlots.get(p.card.not.slot) ?? 0) + 1);
      }
      const within = (count: number, expected: number) =>
        Math.abs(count - expected) < 0.2 * expected;
      for (const c of cells) expect(within(c, N / CROWD_SIZE[d])).toBe(true);
      for (const c of species) expect(within(c, N / CROWD_SPECIES.length)).toBe(true);
      if (d === 3) {
        for (const s of ACCESSORY_SLOTS) expect(within(notSlots.get(s) ?? 0, N / 3)).toBe(true);
      } else {
        expect(notSlots.size).toBe(0);
      }
    }
  });

  it("check chỉ nhận answerIndex; isAnswer từ chối dữ liệu rác", () => {
    const p = crowdSearch.generate(42, 3, 3);
    for (let i = 0; i < CROWD_SEARCH_MAX_CROWD; i++) {
      expect(crowdSearch.check(p, i)).toBe(i === p.answerIndex);
    }
    expect(crowdSearch.isAnswer(0)).toBe(true);
    expect(crowdSearch.isAnswer(29)).toBe(true);
    for (const bad of [
      30,
      -1,
      1.5,
      "0",
      null,
      undefined,
      true,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      [0],
      {},
      0n,
    ]) {
      expect(crowdSearch.isAnswer(bad)).toBe(false);
    }
  });

  it("hệ số điểm không giảm khi lên mức, Thường = 1, Mầm ≤ 1", () => {
    const m = crowdSearch.difficultyMultiplier;
    expect(m).toBeDefined();
    if (!m) return;
    expect(m[0]).toBeLessThanOrEqual(1);
    expect(m[1]).toBe(1);
    expect(m[0]).toBeLessThanOrEqual(m[1]);
    expect(m[1]).toBeLessThanOrEqual(m[2]);
    expect(m[2]).toBeLessThanOrEqual(m[3]);
  });
});
