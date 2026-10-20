import { describe, expect, it, vi } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import {
  SHADOW_BIG_DECOYS,
  SHADOW_ITEM_DEFS,
  SHADOW_ITEMS,
  SHADOW_MATCH_MAX_OPTIONS,
  SHADOW_MATCH_OPTIONS,
  SHADOW_MATCH_ROTATIONS,
  SHADOW_SMALL_DECOYS,
  SHADOW_VARIANTS,
  type ShadowItem,
  type ShadowMatchOption,
  type ShadowMatchPuzzle,
  shadowDetailSize,
  shadowDiff,
  shadowMatch,
  shadowMatchItem,
  shadowParts,
  shadowShapeKey,
} from "./shadow-match";

const SEEDS = 10_000;

/*
 * So hình độc lập với items.ts: dựng lại danh sách phần từ dữ liệu thô, lật gương bằng cách đổi
 * hậu tố @L/@R. Hai bóng cùng hình (bất kể xoay 90°·k, có lật hay không) khi cùng vật và danh sách
 * phần bằng nhau trực tiếp hoặc sau khi lật.
 */
function rawParts(item: ShadowItem, variant: number): string[] {
  const def = SHADOW_ITEM_DEFS[item];
  if (variant === 0) return [...def.base].sort();
  const d = def.decoys[variant - 1]!;
  return [...def.base.filter((p) => !d.remove.includes(p)), ...d.add].sort();
}
const flipParts = (parts: readonly string[]) =>
  parts
    .map((p) =>
      p.endsWith("@L") ? `${p.slice(0, -1)}R` : p.endsWith("@R") ? `${p.slice(0, -1)}L` : p,
    )
    .sort();
const eq = (a: readonly string[], b: readonly string[]) => a.join("|") === b.join("|");
function sameShape(a: ShadowMatchOption, b: ShadowMatchOption): boolean {
  if (a.item !== b.item) return false;
  const pa = rawParts(a.item, a.variant);
  const pb = rawParts(b.item, b.variant);
  return eq(pa, pb) || eq(pa, flipParts(pb));
}

/** Bóng nào khớp đồ vật đề (hình gốc, cho phép xoay và lật). */
function matching(p: ShadowMatchPuzzle): number[] {
  const target: ShadowMatchOption = { item: p.item, variant: 0, rotation: 0, flipped: false };
  return p.options.flatMap((o, i) => (sameShape(o, target) ? [i] : []));
}

/** Trọng số chênh lệch của một mồi: vật khác 3, chi tiết lớn 2, chi tiết nhỏ 1. */
function decoyWeight(p: ShadowMatchPuzzle, o: ShadowMatchOption): number {
  if (o.item !== p.item) return 3;
  return shadowDetailSize(o.item, o.variant) === "big" ? 2 : 1;
}

function forAll(d: Difficulty, fn: (p: ShadowMatchPuzzle, seed: number) => void) {
  for (let seed = 0; seed < SEEDS; seed++) fn(shadowMatch.generate(seed, seed % 37, d), seed);
}

describe("shadow-match: bộ vật", () => {
  it("≥ 8 vật, mỗi vật 2 mồi lớn rồi 4 mồi nhỏ, khoá phần hình hợp lệ", () => {
    expect(SHADOW_ITEMS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(SHADOW_ITEMS).size).toBe(SHADOW_ITEMS.length);
    for (const item of SHADOW_ITEMS) {
      const def = SHADOW_ITEM_DEFS[item];
      expect(def.decoys).toHaveLength(SHADOW_VARIANTS - 1);
      expect(def.decoys.map((d) => d.size)).toEqual([
        ...Array(SHADOW_BIG_DECOYS).fill("big"),
        ...Array(SHADOW_SMALL_DECOYS).fill("small"),
      ]);
      expect(new Set(def.base).size).toBe(def.base.length);
      for (const p of def.base) expect(p).toMatch(/^[a-z-]+@[LRC]$/);
      for (const d of def.decoys) {
        expect(d.remove.length + d.add.length).toBeGreaterThan(0);
        for (const p of d.remove) expect(def.base).toContain(p);
        for (const p of d.add) {
          expect(p).toMatch(/^[a-z-]+@[LRC]$/);
          expect(def.base).not.toContain(p);
        }
      }
    }
  });

  it("không biến thể nào cùng hình với biến thể khác của cùng vật, kể cả khi lật gương", () => {
    for (const item of SHADOW_ITEMS) {
      for (let a = 0; a < SHADOW_VARIANTS; a++) {
        for (let b = a + 1; b < SHADOW_VARIANTS; b++) {
          const pa = rawParts(item, a);
          const pb = rawParts(item, b);
          expect(eq(pa, pb), `${item} ${a}/${b}`).toBe(false);
          expect(eq(pa, flipParts(pb)), `${item} ${a}/gương ${b}`).toBe(false);
        }
      }
    }
  });

  it("shadowParts, shadowShapeKey, shadowDiff khớp với dữ liệu thô", () => {
    for (const item of SHADOW_ITEMS) {
      const keys = new Set<string>();
      for (let v = 0; v < SHADOW_VARIANTS; v++) {
        expect(shadowParts(item, v)).toEqual(rawParts(item, v));
        keys.add(shadowShapeKey(item, v));
        if (v === 0) continue;
        const { missing, extra } = shadowDiff(item, v);
        const d = SHADOW_ITEM_DEFS[item].decoys[v - 1]!;
        expect(missing).toEqual([...d.remove].sort());
        expect(extra).toEqual([...d.add].sort());
      }
      expect(keys.size).toBe(SHADOW_VARIANTS);
    }
    expect(() => shadowParts("teapot", SHADOW_VARIANTS)).toThrow();
  });
});

describe("shadow-match: bộ sinh", { timeout: 60_000 }, () => {
  it("tất định: cùng (seed, index, độ khó) → cùng câu đố", () => {
    for (const d of DIFFICULTIES) {
      for (let seed = 0; seed < 500; seed++) {
        expect(shadowMatch.generate(seed, seed % 23, d)).toEqual(
          shadowMatch.generate(seed, seed % 23, d),
        );
      }
    }
  });

  it("không dùng Math.random hay Date.now", () => {
    const random = vi.spyOn(Math, "random");
    const now = vi.spyOn(Date, "now");
    for (const d of DIFFICULTIES) for (let i = 0; i < 200; i++) shadowMatch.generate(i, i, d);
    expect(random).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    random.mockRestore();
    now.mockRestore();
  });

  for (const d of DIFFICULTIES) {
    it(`mức ${d}: đúng một bóng khớp (xét cả xoay/lật), mọi bóng đôi một khác hình (${SEEDS} seed)`, () => {
      forAll(d, (p) => {
        expect(p.options).toHaveLength(SHADOW_MATCH_OPTIONS[d]);
        expect(matching(p)).toEqual([p.answerIndex]);
        expect(p.options[p.answerIndex]).toMatchObject({ item: p.item, variant: 0 });
        for (let i = 0; i < p.options.length; i++) {
          for (let j = i + 1; j < p.options.length; j++) {
            expect(sameShape(p.options[i]!, p.options[j]!)).toBe(false);
          }
        }
        const correct = p.options.flatMap((_, i) => (shadowMatch.check(p, i) ? [i] : []));
        expect(correct).toEqual([p.answerIndex]);
      });
    });
  }

  it("cấu trúc từng mức: vật khác, mồi lớn/nhỏ, xoay, lật", () => {
    for (const d of DIFFICULTIES) {
      forAll(d, (p) => {
        const decoys = p.options.filter((_, i) => i !== p.answerIndex);
        const otherItems = decoys.filter((o) => o.item !== p.item);
        const bigs = decoys.filter(
          (o) => o.item === p.item && shadowDetailSize(o.item, o.variant) === "big",
        );
        const smalls = decoys.filter(
          (o) => o.item === p.item && shadowDetailSize(o.item, o.variant) === "small",
        );
        expect([otherItems.length, bigs.length, smalls.length]).toEqual(
          [
            [2, 0, 0],
            [1, 2, 0],
            [0, 2, 3],
            [0, 1, 4],
          ][d],
        );
        for (const o of otherItems) expect(o.variant).toBe(0);
        for (const o of p.options) {
          if (d <= 1) expect(o.rotation).toBe(0);
          else expect(SHADOW_MATCH_ROTATIONS).toContain(o.rotation);
          if (d <= 2) expect(o.flipped).toBe(false);
        }
      });
    }
  });

  it("độ khó tăng thật: chênh lệch trung bình của mồi giảm, số hướng vẽ tăng", () => {
    const meanWeight: number[] = [];
    const orientations: number[] = [];
    for (const d of DIFFICULTIES) {
      let sum = 0;
      let n = 0;
      const seen = new Set<string>();
      forAll(d, (p) => {
        p.options.forEach((o, i) => {
          seen.add(`${o.rotation}/${o.flipped}`);
          if (i === p.answerIndex) return;
          sum += decoyWeight(p, o);
          n++;
        });
      });
      meanWeight.push(sum / n);
      orientations.push(seen.size);
    }
    // 3 · 2,33 · 1,4 · 1,2 (vật khác 3, chi tiết lớn 2, chi tiết nhỏ 1).
    expect(meanWeight.map((w) => Math.round(w * 100) / 100)).toEqual([3, 2.33, 1.4, 1.2]);
    expect(orientations).toEqual([1, 1, 3, 6]);
    const sizes = DIFFICULTIES.map((d) => SHADOW_MATCH_OPTIONS[d]);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });

  it("phân bố đều: vị trí đáp án, góc xoay, lật (lệch < 15 % so với đều)", () => {
    for (const d of DIFFICULTIES) {
      const n = SHADOW_MATCH_OPTIONS[d];
      const pos = Array<number>(n).fill(0);
      const rot = new Map<number, number>();
      let flips = 0;
      let answerFlips = 0;
      forAll(d, (p) => {
        pos[p.answerIndex]!++;
        const a = p.options[p.answerIndex]!;
        rot.set(a.rotation, (rot.get(a.rotation) ?? 0) + 1);
        if (a.flipped) answerFlips++;
        for (const o of p.options) if (o.flipped) flips++;
      });
      for (const c of pos) expect(Math.abs(c / SEEDS - 1 / n)).toBeLessThan(0.15 / n);
      if (d >= 2) {
        for (const r of SHADOW_MATCH_ROTATIONS) {
          expect(Math.abs((rot.get(r) ?? 0) / SEEDS - 1 / 3)).toBeLessThan(0.05);
        }
      }
      if (d === 3) {
        expect(Math.abs(answerFlips / SEEDS - 0.5)).toBeLessThan(0.05);
        expect(Math.abs(flips / (SEEDS * n) - 0.5)).toBeLessThan(0.03);
      }
    }
  });

  it("vật đề: mỗi khối 8 câu đủ 8 vật, hai câu liền nhau không trùng, giống nhau ở mọi mức", () => {
    for (let seed = 0; seed < 2_000; seed++) {
      const items = Array.from({ length: 40 }, (_, i) => shadowMatchItem(seed * 7919, i));
      for (let b = 0; b < 5; b++) {
        expect(new Set(items.slice(b * 8, b * 8 + 8)).size).toBe(8);
      }
      for (let i = 1; i < items.length; i++) expect(items[i]).not.toBe(items[i - 1]);
      const i = seed % 40;
      for (const d of DIFFICULTIES) {
        expect(shadowMatch.generate(seed * 7919, i, d).item).toBe(items[i]);
      }
    }
  });

  it("check chỉ nhận answerIndex; isAnswer từ chối dữ liệu rác", () => {
    const p = shadowMatch.generate(42, 3, 3);
    for (let i = 0; i < SHADOW_MATCH_MAX_OPTIONS; i++) {
      expect(shadowMatch.check(p, i)).toBe(i === p.answerIndex);
    }
    expect(shadowMatch.isAnswer(0)).toBe(true);
    expect(shadowMatch.isAnswer(5)).toBe(true);
    for (const bad of [
      6,
      -1,
      1.5,
      "0",
      null,
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      [0],
      {},
      0n,
    ]) {
      expect(shadowMatch.isAnswer(bad)).toBe(false);
    }
  });

  it("hệ số điểm không giảm khi lên mức", () => {
    const m = shadowMatch.difficultyMultiplier!;
    expect(m[0]).toBeLessThanOrEqual(m[1]);
    expect(m[1]).toBe(1);
    expect(m[1]).toBeLessThanOrEqual(m[2]);
    expect(m[2]).toBeLessThanOrEqual(m[3]);
    expect(m[0]).toBeLessThanOrEqual(1);
  });
});
