import { afterEach, describe, expect, it, vi } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import {
  NAVON_GRID,
  NAVON_MASKS,
  NAVON_SHAPES,
  NAVON_SHAPES_LEVELS,
  type NavonShape,
  type NavonShapesPuzzle,
  navonShapes,
} from "./navon-shapes";

const SEEDS = 10_000;
/** Số câu liên tiếp mỗi seed khi đo tỉ lệ (xung đột, khung, đổi chỗ nút, đáp án). */
const RUN = 12;
/** Mọi đáp án `isAnswer` chấp nhận (0–4). */
const ALL_ANSWERS = [0, 1, 2, 3, 4];

const target = (p: NavonShapesPuzzle): NavonShape => (p.ask === "global" ? p.global : p.local);

interface Stats {
  n: number;
  conflicts: number;
  localAsks: number;
  pairs: number;
  askSwitches: number;
  /** Tổng số nút đổi chỗ giữa hai câu liền nhau. */
  moved: number;
  buttons: number;
  answerSlots: number[];
  targets: Record<NavonShape, number>;
  globals: Record<NavonShape, number>;
}

/** Sinh 10.000 seed × RUN câu liên tiếp của một mức, kiểm bất biến từng câu và gom số liệu. */
function sweep(d: Difficulty): Stats {
  const level = NAVON_SHAPES_LEVELS[d];
  const pool = NAVON_SHAPES.slice(0, level.shapes);
  const s: Stats = {
    n: 0,
    conflicts: 0,
    localAsks: 0,
    pairs: 0,
    askSwitches: 0,
    moved: 0,
    buttons: 0,
    answerSlots: [0, 0, 0, 0, 0],
    targets: { circle: 0, square: 0, triangle: 0, plus: 0, heart: 0 },
    globals: { circle: 0, square: 0, triangle: 0, plus: 0, heart: 0 },
  };
  for (let seed = 0; seed < SEEDS; seed++) {
    let prev: NavonShapesPuzzle | undefined;
    for (let index = 0; index < RUN; index++) {
      const p = navonShapes.generate(seed, index, d);
      const where = `mức ${d} seed ${seed} câu ${index}`;

      // Đúng MỘT nút đúng trong mọi đáp án hợp lệ, và nút đó mang hình được hỏi.
      const correct = ALL_ANSWERS.filter((a) => navonShapes.check(p, a));
      if (correct.length !== 1) throw new Error(`${where}: ${correct.length} nút đúng`);
      if (p.buttons[p.answerIndex] !== target(p)) throw new Error(`${where}: nút đúng sai hình`);

      // Nút: đủ các loại của mức, không trùng → hình được hỏi có đúng một lần.
      if (p.buttons.length !== level.shapes) throw new Error(`${where}: sai số nút`);
      if (new Set(p.buttons).size !== p.buttons.length) throw new Error(`${where}: nút trùng`);
      if (!pool.every((shape) => p.buttons.includes(shape)))
        throw new Error(`${where}: thiếu loại`);
      if (p.buttons.filter((b) => b === target(p)).length !== 1)
        throw new Error(`${where}: đáp án không đúng một lần`);

      // Hình to, hình nhỏ thuộc mức; xung đột thì cả hai có trên nút (giằng co).
      if (!pool.includes(p.global) || !pool.includes(p.local)) throw new Error(`${where}: hình lạ`);
      if (!p.buttons.includes(p.global) || !p.buttons.includes(p.local)) {
        throw new Error(`${where}: thiếu hình to hoặc hình nhỏ trên nút`);
      }
      if (p.cells !== NAVON_MASKS[p.global]) throw new Error(`${where}: mặt nạ không khớp`);

      // Mầm/Thường luôn hỏi hình to; các mức không xáo giữ thứ tự nút cố định.
      if (level.localAskPct === 0 && p.ask !== "global") throw new Error(`${where}: hỏi hình nhỏ`);
      if (!level.shuffleButtons && p.buttons.join() !== pool.join()) {
        throw new Error(`${where}: nút đổi chỗ ở mức không xáo`);
      }

      s.n++;
      s.buttons += p.buttons.length;
      if (p.global !== p.local) s.conflicts++;
      if (p.ask === "local") s.localAsks++;
      (s.answerSlots[p.answerIndex] as number)++;
      s.targets[target(p)]++;
      s.globals[p.global]++;
      if (prev) {
        const before = prev;
        s.pairs++;
        if (before.global === p.global && before.local === p.local && before.ask === p.ask) {
          throw new Error(`${where}: giống hệt câu trước`);
        }
        if (before.ask !== p.ask) s.askSwitches++;
        const moved = p.buttons.filter((b, i) => before.buttons[i] !== b).length;
        if (level.shuffleButtons && moved === 0) {
          throw new Error(`${where}: nút không đổi chỗ so với câu trước`);
        }
        s.moved += moved;
      }
      prev = p;
    }
  }
  return s;
}

const STATS = new Map<Difficulty, Stats>();
function stats(d: Difficulty): Stats {
  let s = STATS.get(d);
  if (!s) {
    s = sweep(d);
    STATS.set(d, s);
  }
  return s;
}

describe("navon-shapes: mặt nạ hình to", () => {
  const masks = NAVON_SHAPES.map((shape) => ({ shape, cells: NAVON_MASKS[shape] }));
  const key = (c: { col: number; row: number }) => c.row * NAVON_GRID + c.col;

  it("mỗi hình nằm trong lưới 7 × 7, không ô trùng, chiếm trọn khung (cùng cỡ)", () => {
    for (const { shape, cells } of masks) {
      const keys = new Set(cells.map(key));
      expect(keys.size, shape).toBe(cells.length);
      expect(cells.length, shape).toBeGreaterThanOrEqual(12);
      for (const c of cells) {
        expect(Number.isInteger(c.col) && Number.isInteger(c.row), shape).toBe(true);
        expect(c.col >= 0 && c.col < NAVON_GRID && c.row >= 0 && c.row < NAVON_GRID).toBe(true);
      }
      const cols = cells.map((c) => c.col);
      const rows = cells.map((c) => c.row);
      expect([Math.min(...cols), Math.max(...cols)], shape).toEqual([0, NAVON_GRID - 1]);
      expect([Math.min(...rows), Math.max(...rows)], shape).toEqual([0, NAVON_GRID - 1]);
    }
  });

  it("mỗi hình đối xứng trái–phải và liền một khối (nối 8 hướng)", () => {
    for (const { shape, cells } of masks) {
      const keys = new Set(cells.map(key));
      for (const c of cells) {
        expect(keys.has(c.row * NAVON_GRID + (NAVON_GRID - 1 - c.col)), shape).toBe(true);
      }
      const seen = new Set<number>([key(cells[0] as { col: number; row: number })]);
      const queue = [cells[0] as { col: number; row: number }];
      while (queue.length > 0) {
        const c = queue.pop() as { col: number; row: number };
        for (const other of cells) {
          const k = key(other);
          if (
            !seen.has(k) &&
            Math.abs(other.col - c.col) <= 1 &&
            Math.abs(other.row - c.row) <= 1
          ) {
            seen.add(k);
            queue.push(other);
          }
        }
      }
      expect(seen.size, shape).toBe(cells.length);
    }
  });

  it("hai hình bất kỳ khác nhau ≥ 12 ô và không hình nào nằm gọn trong hình khác", () => {
    for (let i = 0; i < masks.length; i++) {
      for (let j = i + 1; j < masks.length; j++) {
        const a = new Set((masks[i] as (typeof masks)[number]).cells.map(key));
        const b = new Set((masks[j] as (typeof masks)[number]).cells.map(key));
        const onlyA = [...a].filter((k) => !b.has(k)).length;
        const onlyB = [...b].filter((k) => !a.has(k)).length;
        const pair = `${masks[i]?.shape}/${masks[j]?.shape}`;
        expect(onlyA + onlyB, pair).toBeGreaterThanOrEqual(12);
        expect(onlyA > 0 && onlyB > 0, pair).toBe(true);
      }
    }
  });
});

describe("navon-shapes", () => {
  afterEach(() => vi.restoreAllMocks());

  it("tất định: cùng (seed, index, độ khó) → cùng câu đố", () => {
    for (const d of DIFFICULTIES) {
      for (let k = 0; k < 200; k++) {
        const seed = (k * 2_654_435_761) >>> 0;
        expect(navonShapes.generate(seed, k % 50, d)).toEqual(
          navonShapes.generate(seed, k % 50, d),
        );
      }
    }
  });

  it("không dùng Math.random hay Date.now", () => {
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random");
    });
    vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("Date.now");
    });
    for (const d of DIFFICULTIES) {
      for (let i = 0; i < 50; i++) navonShapes.generate(12_345, i, d);
    }
  });

  it("mọi câu có đúng MỘT nút đúng, nút không trùng, không giống hệt câu trước (10.000 seed × 12 câu × 4 độ khó)", () => {
    for (const d of DIFFICULTIES) expect(stats(d).n).toBe(SEEDS * RUN);
  }, 60_000);

  it("hình to phân bố đều các loại (lệch < 3 %), kể cả cuối vòng dài", () => {
    for (const d of DIFFICULTIES) {
      const s = stats(d);
      const n = NAVON_SHAPES_LEVELS[d].shapes;
      for (const shape of NAVON_SHAPES.slice(0, n)) {
        expect(Math.abs(s.globals[shape] / s.n - 1 / n), `mức ${d} ${shape}`).toBeLessThan(0.03);
      }
      // Câu 50–59 (người lớn chọn Mầm đi được ~55 câu): vẫn đều, vẫn không lặp y hệt câu trước.
      const late: Record<string, number> = {};
      let count = 0;
      for (let seed = 0; seed < 2_000; seed++) {
        let prev = navonShapes.generate(seed, 49, d);
        for (let index = 50; index < 60; index++) {
          const p = navonShapes.generate(seed, index, d);
          expect(
            prev.global === p.global && prev.local === p.local && prev.ask === p.ask,
            `mức ${d} seed ${seed} câu ${index}`,
          ).toBe(false);
          late[p.global] = (late[p.global] ?? 0) + 1;
          count++;
          prev = p;
        }
      }
      for (const shape of NAVON_SHAPES.slice(0, n)) {
        expect(
          Math.abs((late[shape] ?? 0) / count - 1 / n),
          `mức ${d} ${shape} cuối vòng`,
        ).toBeLessThan(0.03);
      }
    }
  }, 60_000);

  it("tỉ lệ câu xung đột (hình nhỏ khác hình to) đúng bảng mức (lệch < 2 %)", () => {
    for (const d of DIFFICULTIES) {
      const s = stats(d);
      const rate = s.conflicts / s.n;
      expect(Math.abs(rate - NAVON_SHAPES_LEVELS[d].conflictPct / 100), `mức ${d}`).toBeLessThan(
        0.02,
      );
    }
    // Mầm: hình nhỏ thường trùng hình to; Thường trở lên: thường khác.
    expect(stats(0).conflicts / stats(0).n).toBeLessThan(0.5);
    for (const d of [1, 2, 3] as const)
      expect(stats(d).conflicts / stats(d).n).toBeGreaterThan(0.5);
  }, 60_000);

  it("Mầm/Thường chỉ khung tròn; Khó trở lên có cả hai khung (~50 %), đổi theo câu", () => {
    for (const d of [0, 1] as const) expect(stats(d).localAsks).toBe(0);
    for (const d of [2, 3] as const) {
      const s = stats(d);
      expect(s.localAsks).toBeGreaterThan(0);
      expect(s.localAsks).toBeLessThan(s.n);
      expect(Math.abs(s.localAsks / s.n - 0.5), `mức ${d}`).toBeLessThan(0.02);
      // Câu hỏi bốc độc lập từng câu → đổi khung giữa hai câu liền nhau ~50 %.
      expect(Math.abs(s.askSwitches / s.pairs - 0.5), `mức ${d}`).toBeLessThan(0.02);
    }
  }, 60_000);

  it("chỉ Siêu khó xáo nút, và hai câu liền nhau luôn khác thứ tự", () => {
    for (const d of [0, 1, 2] as const) expect(stats(d).moved).toBe(0);
    const s = stats(3);
    // Hoán vị ngẫu nhiên 5 nút: trung bình ~4 nút đổi chỗ so với câu trước.
    expect(s.moved / s.pairs).toBeGreaterThan(3.5);
  }, 60_000);

  it("đáp án phân bố đều theo nút và theo loại hình (lệch < 3 %)", () => {
    for (const d of DIFFICULTIES) {
      const s = stats(d);
      const n = NAVON_SHAPES_LEVELS[d].shapes;
      for (let slot = 0; slot < n; slot++) {
        expect(
          Math.abs((s.answerSlots[slot] as number) / s.n - 1 / n),
          `mức ${d} nút ${slot}`,
        ).toBeLessThan(0.03);
      }
      for (const shape of NAVON_SHAPES.slice(0, n)) {
        expect(Math.abs(s.targets[shape] / s.n - 1 / n), `mức ${d} ${shape}`).toBeLessThan(0.03);
      }
    }
  }, 60_000);

  it("khó dần: số nút, tỉ lệ xung đột, tỉ lệ hỏi hình nhỏ, số nút đổi chỗ không giảm và mỗi mức tăng ít nhất một", () => {
    const metrics = DIFFICULTIES.map((d) => {
      const s = stats(d);
      return [s.buttons / s.n, s.conflicts / s.n, s.localAsks / s.n, s.moved / s.pairs];
    });
    for (let d = 1; d < metrics.length; d++) {
      const prev = metrics[d - 1] as number[];
      const cur = metrics[d] as number[];
      // Dung sai 0,01 cho nhiễu lấy mẫu khi hai mức cùng tham số (vd. hỏi hình nhỏ 50 % ở Khó và Siêu khó).
      cur.forEach((v, k) => {
        expect(v, `mức ${d} chỉ số ${k}`).toBeGreaterThanOrEqual((prev[k] as number) - 0.01);
      });
      expect(
        cur.some((v, k) => v > (prev[k] as number) + 0.01),
        `mức ${d}`,
      ).toBe(true);
    }
  }, 60_000);

  it("check() chỉ nhận đúng nút đáp án", () => {
    const p = navonShapes.generate(42, 3, 3);
    expect(navonShapes.check(p, p.answerIndex)).toBe(true);
    expect(navonShapes.check(p, (p.answerIndex + 1) % 5)).toBe(false);
    expect(navonShapes.check(p, 7)).toBe(false);
  });

  it("isAnswer() nhận số nguyên 0–4, từ chối dữ liệu rác", () => {
    for (const ok of ALL_ANSWERS) expect(navonShapes.isAnswer(ok)).toBe(true);
    for (const bad of [
      -1,
      5,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "0",
      "circle",
      null,
      undefined,
      {},
      [0],
      true,
    ]) {
      expect(navonShapes.isAnswer(bad), String(bad)).toBe(false);
    }
  });
});
