import { describe, expect, it } from "vitest";
import { createRng, deriveSeed } from "./rng";

describe("createRng", () => {
  it("cùng seed cho cùng dãy số", () => {
    const a = createRng(12345);
    const b = createRng(12345);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it("seed khác cho dãy khác", () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it("next() nằm trong [0, 1)", () => {
    const r = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int() bao gồm cả hai đầu và không vượt ra ngoài", () => {
    const r = createRng(99);
    const seen = new Set<number>();
    for (let i = 0; i < 5_000; i++) {
      const v = r.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });

  it("shuffle() giữ nguyên phần tử và không sửa mảng gốc", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = createRng(3).shuffle(input);
    expect(out.slice().sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("khớp giá trị chuẩn (snapshot) — đổi thuật toán sẽ làm hỏng tính tương thích", () => {
    const r = createRng(42);
    expect([r.next(), r.next(), r.next()]).toMatchInlineSnapshot(`
      [
        0.6011037519201636,
        0.44829055899754167,
        0.8524657934904099,
      ]
    `);
  });
});

describe("deriveSeed", () => {
  it("tất định và khác nhau theo index", () => {
    expect(deriveSeed(100, 3)).toBe(deriveSeed(100, 3));
    expect(deriveSeed(100, 3)).not.toBe(deriveSeed(100, 4));
    expect(deriveSeed(100, 3)).not.toBe(deriveSeed(101, 3));
  });

  it("luôn là uint32", () => {
    for (let i = 0; i < 1000; i++) {
      const s = deriveSeed(0xffffffff, i);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(0xffffffff);
    }
  });
});
