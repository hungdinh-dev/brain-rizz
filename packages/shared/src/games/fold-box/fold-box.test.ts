import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import { boundingBox, fold, freeKey, freePolyominoes, getLibrary, ROTATIONS } from "./cube";
import { type FoldBoxChoiceKind, type FoldBoxPuzzle, foldBox, foldBoxMatches } from "./fold-box";

const SEEDS_PER_LEVEL = 2_500; // × 4 mức = 10 000 câu

/** Sinh một lần 2 500 câu mỗi mức rồi dùng chung cho các test bên dưới. */
const cache = new Map<Difficulty, FoldBoxPuzzle[]>();
function each(d: Difficulty, fn: (p: FoldBoxPuzzle, seed: number) => void): void {
  let list = cache.get(d);
  if (!list) {
    list = [];
    for (let seed = 0; seed < SEEDS_PER_LEVEL; seed++)
      list.push(foldBox.generate(seed, seed % 20, d));
    cache.set(d, list);
  }
  list.forEach(fn);
}

const xy = (p: FoldBoxPuzzle, i: number) => p.choices[i]!.cells.map((c) => [c.x, c.y] as const);

describe("fold-box: hình học", () => {
  it("24 phép quay khác nhau", () => {
    expect(ROTATIONS).toHaveLength(24);
    expect(new Set(ROTATIONS.map((q) => JSON.stringify(q))).size).toBe(24);
  });

  it("35 hình 6 ô, đúng 11 hình gấp được thành hộp", () => {
    const all = freePolyominoes(6);
    expect(all).toHaveLength(35);
    expect(all.filter((s) => fold(s).ok)).toHaveLength(11);
  });

  it("kho hình: 11 lưới, 3 hình hàng 5 ô, 8 hình có khối 2 × 2, khung bao vừa thẻ", () => {
    const lib = getLibrary();
    expect([lib.nets.length, lib.runs.length, lib.blocks.length]).toEqual([11, 3, 8]);
    for (const s of [...lib.nets, ...lib.runs, ...lib.blocks]) {
      const { w, h } = boundingBox(s);
      expect(Math.max(w, h)).toBeLessThanOrEqual(5);
      expect(Math.min(w, h)).toBeLessThanOrEqual(3);
    }
    for (const s of [...lib.runs, ...lib.blocks]) expect(fold(s).ok).toBe(false);
  });
});

// Sinh 10 000 câu ở test đầu tiên của mỗi mức; chạy song song với test game khác có thể quá 5 giây mặc định.
describe("fold-box: bộ sinh", { timeout: 60_000 }, () => {
  it("tất định: cùng (seed, index, độ khó) → cùng câu đố", () => {
    for (const d of DIFFICULTIES) {
      for (let seed = 0; seed < 50; seed++) {
        expect(foldBox.generate(seed, 7, d)).toEqual(foldBox.generate(seed, 7, d));
      }
    }
  });

  it("đổi index thì đổi câu", () => {
    for (const d of DIFFICULTIES) {
      expect(foldBox.generate(1, 0, d)).not.toEqual(foldBox.generate(1, 1, d));
    }
  });

  it("đúng MỘT lựa chọn gấp được thành khối mẫu (gấp thật, 24 phép quay; 10 000 câu)", () => {
    const bad: string[] = [];
    for (const d of DIFFICULTIES) {
      each(d, (p, seed) => {
        const ok = p.choices.map((c) => foldBoxMatches(c.cells, p.cube).length > 0);
        const correct = p.choices.map((_, i) => foldBox.check(p, i));
        if (
          ok.filter(Boolean).length !== 1 ||
          !ok[p.answerIndex] ||
          p.choices[p.answerIndex]!.kind !== "answer" ||
          p.choices.filter((c) => c.kind === "answer").length !== 1 ||
          correct.filter(Boolean).length !== 1
        ) {
          bad.push(`d=${d} seed=${seed}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });

  it("mỗi lựa chọn một dáng lưới khác nhau; 6 ô, chuẩn hoá, vừa thẻ", () => {
    let bad = 0;
    for (const d of DIFFICULTIES) {
      each(d, (p) => {
        const keys = p.choices.map((_, i) => freeKey(xy(p, i)));
        if (new Set(keys).size !== p.choices.length) bad++;
        p.choices.forEach((c, i) => {
          const cells = xy(p, i);
          const { w, h } = boundingBox(cells);
          const sorted = c.cells.every((q, k) => {
            const prev = c.cells[k - 1];
            return !prev || prev.y < q.y || (prev.y === q.y && prev.x < q.x);
          });
          if (
            c.cells.length !== 6 ||
            Math.min(...cells.map((q) => q[0])) !== 0 ||
            Math.min(...cells.map((q) => q[1])) !== 0 ||
            !sorted ||
            Math.max(w, h) > 5 ||
            Math.min(w, h) > 3
          ) {
            bad++;
          }
        });
      });
    }
    expect(bad).toBe(0);
  });

  it("dữ liệu ký hiệu đã chuẩn hoá (rot nguyên; không hướng → 0; sọc 0–1; tam giác 0–3)", () => {
    let bad = 0;
    for (const d of DIFFICULTIES) {
      each(d, (p) => {
        const marks = [
          p.cube.top,
          p.cube.left,
          p.cube.right,
          ...p.choices.flatMap((c) => c.cells.map((x) => x.mark)),
        ];
        for (const m of marks) {
          if (!m) continue;
          const max = m.symbol === "triangle" ? 3 : m.symbol === "bar" ? 1 : 0;
          if (!(Number.isInteger(m.rot) && m.rot >= 0 && m.rot <= max)) bad++;
        }
        // Mỗi lưới chứa mỗi ký hiệu nhiều nhất một lần, và đủ mọi ký hiệu của khối mẫu.
        const want = [p.cube.top, p.cube.left, p.cube.right].flatMap((m) => (m ? [m.symbol] : []));
        for (const c of p.choices) {
          const syms = c.cells.flatMap((x) => (x.mark ? [x.mark.symbol] : []));
          if (new Set(syms).size !== syms.length || !want.every((s) => syms.includes(s))) bad++;
        }
      });
    }
    expect(bad).toBe(0);
  });

  it("đúng loại mồi theo mức, `focus` trỏ đúng ô gây sai", () => {
    const expected: Record<Difficulty, FoldBoxChoiceKind[]> = {
      0: ["answer", "notNet", "notNet"],
      1: ["answer", "opposite", "opposite", "opposite"],
      2: ["answer", "mirror", "opposite", "rotated"],
      3: ["answer", "mirror", "rotated", "rotated"],
    };
    const bad: string[] = [];
    for (const d of DIFFICULTIES) {
      each(d, (p, seed) => {
        const fail = (why: string) => bad.push(`d=${d} seed=${seed}: ${why}`);
        if (
          p.choices
            .map((c) => c.kind)
            .sort()
            .join() !== expected[d].join()
        )
          fail("kinds");
        for (const c of p.choices) {
          const size = { answer: d === 0 ? 0 : 3, notNet: 2, opposite: 2, mirror: 2, rotated: 1 }[
            c.kind
          ];
          if (c.focus.length !== size || c.focus.some((i) => !(i >= 0 && i < 6))) fail("focus");
          if (c.kind === "notNet" && fold(c.cells.map((q) => [q.x, q.y] as const)).ok) fail("net");
          if (
            (c.kind === "opposite" || c.kind === "rotated" || c.kind === "mirror") &&
            c.focus.some((i) => !c.cells[i]!.mark)
          ) {
            fail("focus mark");
          }
          if (c.kind === "answer" && d > 0) {
            const got = c.focus.map((i) => c.cells[i]!.mark?.symbol).join();
            const want = [p.cube.top, p.cube.left, p.cube.right].map((m) => m?.symbol).join();
            if (got !== want) fail("answer focus");
          }
        }
        // Thường: ba mồi dùng ba cặp ký hiệu đối diện khác nhau.
        if (d === 1) {
          const pairs = p.choices
            .filter((c) => c.kind === "opposite")
            .map((c) =>
              c.focus
                .map((i) => c.cells[i]!.mark?.symbol)
                .sort()
                .join("+"),
            );
          if (new Set(pairs).size !== 3) fail("pairs");
        }
      });
    }
    expect(bad).toEqual([]);
  });

  it("khó dần thật: số lựa chọn, số mặt có ký hiệu, ký hiệu có hướng, mồi khó", () => {
    const metric = (d: Difficulty) => {
      let marked = 0;
      let directed = 0;
      let hardDecoys = 0;
      let options = 0;
      each(d, (p) => {
        options += p.choices.length;
        marked += p.choices[p.answerIndex]!.cells.filter((c) => c.mark).length;
        directed += [p.cube.top, p.cube.left, p.cube.right].filter(
          (m) => m && (m.symbol === "triangle" || m.symbol === "bar"),
        ).length;
        hardDecoys += p.choices.filter((c) => c.kind === "mirror" || c.kind === "rotated").length;
      });
      const n = SEEDS_PER_LEVEL;
      return [options / n, marked / n, directed / n, hardDecoys / n];
    };
    const m = DIFFICULTIES.map(metric);
    expect(m).toEqual([
      [3, 0, 0, 0],
      [4, 3, 0, 0],
      [4, 3, 2, 2],
      [4, 6, 2, 3],
    ]);
    // Từng chỉ số không giảm, và mỗi mức tăng ít nhất một chỉ số.
    for (let d = 1; d < 4; d++) {
      for (const [k, v] of m[d]!.entries()) expect(v).toBeGreaterThanOrEqual(m[d - 1]![k]!);
      expect(m[d]!.some((v, k) => v > m[d - 1]![k]!)).toBe(true);
    }
  });

  it("vị trí đáp án và dáng lưới đáp án phân bố đều", () => {
    for (const d of DIFFICULTIES) {
      const pos = new Map<number, number>();
      const shapes = new Map<string, number>();
      each(d, (p) => {
        pos.set(p.answerIndex, (pos.get(p.answerIndex) ?? 0) + 1);
        const k = freeKey(xy(p, p.answerIndex));
        shapes.set(k, (shapes.get(k) ?? 0) + 1);
      });
      const n = d === 0 ? 3 : 4;
      expect(pos.size).toBe(n);
      for (const c of pos.values())
        expect(Math.abs(c / SEEDS_PER_LEVEL - 1 / n)).toBeLessThan(0.04);
      expect(shapes.size).toBe(11);
      for (const c of shapes.values()) expect(c / SEEDS_PER_LEVEL).toBeGreaterThan(0.06);
    }
  });
});

describe("fold-box: chấm", () => {
  it("isAnswer() chỉ nhận số nguyên 0–3", () => {
    for (const v of [0, 1, 2, 3]) expect(foldBox.isAnswer(v)).toBe(true);
    for (const v of [-1, 4, 1.5, Number.NaN, "0", null, undefined, [0], {}]) {
      expect(foldBox.isAnswer(v)).toBe(false);
    }
  });

  it("hệ số độ khó không giảm, Thường = 1, Mầm ≤ 1", () => {
    const m = foldBox.difficultyMultiplier!;
    expect(m[1]).toBe(1);
    expect(m[0]).toBeLessThanOrEqual(1);
    for (let d = 1; d < 4; d++) {
      expect(m[d as Difficulty]).toBeGreaterThanOrEqual(m[(d - 1) as Difficulty]);
    }
  });
});
