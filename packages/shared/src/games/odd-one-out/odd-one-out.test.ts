import { describe, expect, it } from "vitest";
import { DIFFICULTIES } from "../../difficulty";
import { type OddOneOutPuzzle, oddOneOut } from "./odd-one-out";

const sameCell = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

/** `#RRGGBB` → HSL (h độ, s và l theo %), chỉ dùng để kiểm tra. */
function hexToHsl(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}

const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/** Ô lạc và một ô gốc bất kỳ của câu đố. */
function oddAndBase(p: OddOneOutPuzzle) {
  return { odd: p.cells[p.oddIndex]!, base: p.cells[(p.oddIndex + 1) % p.cells.length]! };
}

/** Độ lệch độ sáng HSL (điểm %) giữa ô lạc và ô gốc. */
function lightGap(p: OddOneOutPuzzle) {
  const { odd, base } = oddAndBase(p);
  return hexToHsl(odd.color).l - hexToHsl(base.color).l;
}

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

  it("Khó/Siêu khó: ô lạc cùng hình, cùng góc, cùng sắc độ, chỉ lệch độ sáng (10.000 seed)", () => {
    // Dải lệch độ sáng HSL theo đặc tả (14–18 và 7–9), nới 0,5 cho sai số làm tròn hex.
    const ranges = { 2: [13.5, 18.5], 3: [6.5, 9.5] } as const;
    // Gom vi phạm rồi so một lần (gọi expect cho từng ô × 20.000 câu quá chậm).
    const violations: string[] = [];
    for (const d of [2, 3] as const) {
      for (let seed = 0; seed < 10_000; seed++) {
        const p = oddOneOut.generate(seed * 31 + 7, seed % 25, d);
        const { odd, base } = oddAndBase(p);
        const a = hexToHsl(base.color);
        const b = hexToHsl(odd.color);
        const gap = Math.abs(a.l - b.l);
        const ok =
          odd.shape === base.shape &&
          // Không còn kiểu khác góc xoay: mọi ô cùng góc 0.
          p.cells.every((c) => c.rotation === 0) &&
          odd.color !== base.color &&
          /^#[0-9A-F]{6}$/.test(odd.color) &&
          hueGap(a.h, b.h) <= 3 &&
          gap >= ranges[d][0] &&
          gap <= ranges[d][1] &&
          // Không quá tối/quá sáng để vẫn nổi trên nền khung ở cả giao diện sáng và tối.
          [a, b].every((c) => c.l >= 27 && c.l <= 77);
        if (!ok) violations.push(`d=${d} seed=${seed} ${base.color}→${odd.color}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("độ khó tăng thật: Siêu khó lệch độ sáng ít hơn hẳn Khó (không chồng nhau)", () => {
    const gaps = (d: 2 | 3) =>
      Array.from({ length: 2_000 }, (_, seed) =>
        Math.abs(lightGap(oddOneOut.generate(seed, 0, d))),
      );
    expect(Math.max(...gaps(3))).toBeLessThan(Math.min(...gaps(2)));
  });

  it("Khó/Siêu khó có cả ô lạc sáng hơn lẫn tối hơn", () => {
    for (const d of [2, 3] as const) {
      let lighter = 0;
      for (let seed = 0; seed < 1_000; seed++) {
        if (lightGap(oddOneOut.generate(seed, 0, d)) > 0) lighter++;
      }
      expect(lighter).toBeGreaterThan(300);
      expect(lighter).toBeLessThan(700);
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
