import { describe, expect, it } from "vitest";
import { DIFFICULTIES } from "../difficulty";
import { oddOneOut } from "./odd-one-out";

const sameCell = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

describe("odd-one-out", () => {
  it("tất định: cùng (seed, index, độ khó) → cùng câu đố", () => {
    for (const d of DIFFICULTIES) {
      expect(oddOneOut.generate(777, 5, d)).toEqual(oddOneOut.generate(777, 5, d));
    }
  });

  it("mọi câu đố có đúng MỘT ô khác biệt (10.000 seed × 4 độ khó)", () => {
    for (const d of DIFFICULTIES) {
      for (let seed = 0; seed < 2_500; seed++) {
        const p = oddOneOut.generate(seed, seed % 20, d);
        expect(p.cells).toHaveLength(p.cols * p.rows);

        const odd = p.cells[p.oddIndex]!;
        const others = p.cells.filter((_, i) => i !== p.oddIndex);
        const reference = others[0]!;

        expect(others.every((c) => sameCell(c, reference))).toBe(true);
        expect(sameCell(odd, reference)).toBe(false);
      }
    }
  });

  it("lưới lớn dần theo độ khó", () => {
    const sizes = DIFFICULTIES.map((d) => oddOneOut.generate(1, 0, d).cols);
    expect(sizes).toEqual([3, 4, 5, 6]);
  });

  it("check() chỉ đúng với oddIndex", () => {
    const p = oddOneOut.generate(9, 0, 1);
    expect(oddOneOut.check(p, p.oddIndex)).toBe(true);
    expect(oddOneOut.check(p, (p.oddIndex + 1) % p.cells.length)).toBe(false);
  });

  it("isAnswer() từ chối dữ liệu rác", () => {
    expect(oddOneOut.isAnswer(3)).toBe(true);
    expect(oddOneOut.isAnswer(-1)).toBe(false);
    expect(oddOneOut.isAnswer(1.5)).toBe(false);
    expect(oddOneOut.isAnswer("3")).toBe(false);
  });
});
