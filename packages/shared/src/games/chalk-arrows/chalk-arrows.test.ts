import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import {
  CHALK_ARROWS_LEVELS,
  CHALK_FIELD,
  type ChalkArrowsPuzzle,
  type ChalkPoint,
  chalkArrows,
  chalkArrowsColor,
} from "./chalk-arrows";

const SEEDS = 10_000;
/** Số câu liên tiếp mỗi seed khi đo tỉ lệ (đổi màu, quan hệ hai hướng, đáp án). */
const RUN = 12;

type Relation = "same" | "perp" | "opposite";

function relation(p: ChalkArrowsPuzzle): Relation {
  const diff = (p.slide - p.point + 4) % 4;
  return diff === 0 ? "same" : diff === 2 ? "opposite" : "perp";
}

/** Khoảng cách theo một trục, tính cả đường nối vòng qua mép. */
function wrapDist(a: number, b: number, size: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, size - d);
}

interface Stats {
  n: number;
  yellow: number;
  switches: number;
  pairs: number;
  relations: Record<Relation, number>;
  answers: number[];
}

/** Sinh 10.000 seed × RUN câu liên tiếp của một mức, kiểm bất biến từng câu và gom số liệu. */
function sweep(d: Difficulty): Stats {
  const level = CHALK_ARROWS_LEVELS[d];
  const s: Stats = {
    n: 0,
    yellow: 0,
    switches: 0,
    pairs: 0,
    relations: { same: 0, perp: 0, opposite: 0 },
    answers: [0, 0, 0, 0],
  };
  for (let seed = 0; seed < SEEDS; seed++) {
    let prev: ChalkArrowsPuzzle | undefined;
    for (let index = 0; index < RUN; index++) {
      const p = chalkArrows.generate(seed, index, d);

      // Đúng một đáp án trong 4 hướng, khớp luật màu.
      const correct = [0, 1, 2, 3].filter((a) => chalkArrows.check(p, a));
      if (correct.length !== 1)
        throw new Error(`seed ${seed} câu ${index}: ${correct.length} đáp án`);
      if (p.answer !== (p.color === "white" ? p.point : p.slide)) {
        throw new Error(`seed ${seed} câu ${index}: đáp án không khớp luật màu`);
      }

      // Số lượng, tốc độ, bảng màu đúng mức.
      if (p.arrows.length !== level.arrows || p.smudges.length !== level.smudges) {
        throw new Error(`seed ${seed} câu ${index}: sai số mũi tên`);
      }
      if (p.speed !== level.speed || p.subtle !== level.subtle) {
        throw new Error(`seed ${seed} câu ${index}: sai tốc độ hoặc bảng màu`);
      }

      // Vị trí: số nguyên, trong khung, mỗi mũi tên một ô, cách nhau ≥ 140 theo ít nhất một trục.
      const all: ChalkPoint[] = [...p.arrows, ...p.smudges];
      const cells = new Set<number>();
      for (const a of all) {
        if (!Number.isInteger(a.x) || !Number.isInteger(a.y))
          throw new Error("toạ độ không nguyên");
        if (a.x < 0 || a.x >= CHALK_FIELD.width || a.y < 0 || a.y >= CHALK_FIELD.height) {
          throw new Error(`seed ${seed} câu ${index}: tâm ngoài khung`);
        }
        cells.add(
          Math.floor(a.y / CHALK_FIELD.cell) * CHALK_FIELD.cols +
            Math.floor(a.x / CHALK_FIELD.cell),
        );
      }
      if (cells.size !== all.length)
        throw new Error(`seed ${seed} câu ${index}: hai mũi tên chung ô`);
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i] as ChalkPoint;
          const b = all[j] as ChalkPoint;
          const gap = Math.max(
            wrapDist(a.x, b.x, CHALK_FIELD.width),
            wrapDist(a.y, b.y, CHALK_FIELD.height),
          );
          if (gap < 140) throw new Error(`seed ${seed} câu ${index}: hai mũi tên quá gần`);
        }
      }

      s.n++;
      if (p.color === "yellow") s.yellow++;
      s.relations[relation(p)]++;
      (s.answers[p.answer] as number)++;
      if (prev) {
        s.pairs++;
        if (prev.color !== p.color) s.switches++;
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

describe("chalk-arrows", () => {
  it("tất định: cùng (seed, index, độ khó) → cùng câu đố", () => {
    for (const d of DIFFICULTIES) {
      for (let seed = 0; seed < 200; seed++) {
        const index = seed % 40;
        expect(chalkArrows.generate(seed, index, d)).toEqual(chalkArrows.generate(seed, index, d));
      }
    }
  });

  it("màu của câu không phụ thuộc thứ tự sinh (chuỗi đổi màu tính lại từ câu 0)", () => {
    for (const d of DIFFICULTIES) {
      const forward = Array.from({ length: 30 }, (_, i) => chalkArrows.generate(9, i, d).color);
      const backward = Array.from({ length: 30 }, (_, i) =>
        chalkArrowsColor(9, 29 - i, d),
      ).reverse();
      expect(forward).toEqual(backward);
    }
  });

  for (const d of DIFFICULTIES) {
    it(`mức ${d}: đúng một đáp án, đúng mức, vị trí hợp lệ (10.000 seed × ${RUN} câu)`, () => {
      expect(stats(d).n).toBe(SEEDS * RUN);
    }, 60_000);
  }

  it("Mầm chỉ phấn trắng, không có quan hệ ngược; từ Thường trắng/vàng ~50/50", () => {
    expect(stats(0).yellow).toBe(0);
    expect(stats(0).relations.opposite).toBe(0);
    for (const d of [1, 2, 3] as const) {
      const s = stats(d);
      expect(Math.abs(s.yellow / s.n - 0.5)).toBeLessThan(0.03);
    }
  });

  it("tỉ lệ đổi màu giữa hai câu liền đúng switchPct (lệch < 3 %)", () => {
    for (const d of DIFFICULTIES) {
      const s = stats(d);
      const rate = s.switches / s.pairs;
      expect(Math.abs(rate - CHALK_ARROWS_LEVELS[d].switchPct / 100)).toBeLessThan(0.03);
    }
  });

  it("tỉ lệ trùng / vuông góc / ngược đúng bảng mức (lệch < 3 %)", () => {
    for (const d of DIFFICULTIES) {
      const s = stats(d);
      const level = CHALK_ARROWS_LEVELS[d];
      const want = {
        same: level.samePct / 100,
        perp: level.perpPct / 100,
        opposite: 1 - (level.samePct + level.perpPct) / 100,
      };
      for (const r of ["same", "perp", "opposite"] as const) {
        expect(Math.abs(s.relations[r] / s.n - want[r])).toBeLessThan(0.03);
      }
    }
  });

  it("đáp án phân bố đều 4 hướng (lệch < 5 %)", () => {
    for (const d of DIFFICULTIES) {
      const s = stats(d);
      for (const a of s.answers) expect(Math.abs(a / s.n - 0.25)).toBeLessThan(0.05);
    }
  });

  it("khó dần: mỗi bước tăng ít nhất một chỉ số, không chỉ số nào giảm", () => {
    const metrics = DIFFICULTIES.map((d) => {
      const s = stats(d);
      const l = CHALK_ARROWS_LEVELS[d];
      return [
        l.arrows + l.smudges,
        l.speed,
        s.switches / s.pairs,
        1 - s.relations.same / s.n, // tỉ lệ câu xung đột (hai hướng khác nhau)
        s.yellow / s.n > 0 ? 1 : 0,
      ];
    });
    for (let i = 1; i < metrics.length; i++) {
      const prev = metrics[i - 1] as number[];
      const cur = metrics[i] as number[];
      // Sai số đo của tỉ lệ (Khó và Siêu khó cùng 60 % đổi màu, cùng 90 % xung đột).
      for (let k = 0; k < cur.length; k++)
        expect(cur[k] as number).toBeGreaterThan((prev[k] as number) - 0.02);
      expect(cur.some((v, k) => v > (prev[k] as number) + 0.02)).toBe(true);
    }
  });

  it("nhiễu tẩy mờ chỉ có ở Siêu khó và không đổi đáp án", () => {
    for (const d of [0, 1, 2] as const) expect(chalkArrows.generate(3, 4, d).smudges).toEqual([]);
    for (let seed = 0; seed < 500; seed++) {
      const p = chalkArrows.generate(seed, seed % 30, 3);
      const clean = { ...p, smudges: [] };
      expect(chalkArrows.check(clean, p.answer)).toBe(true);
    }
  });

  it("isAnswer() chỉ nhận số nguyên 0–3", () => {
    for (const v of [0, 1, 2, 3]) expect(chalkArrows.isAnswer(v)).toBe(true);
    for (const v of [-1, 4, 1.5, "0", null, undefined, Number.NaN]) {
      expect(chalkArrows.isAnswer(v)).toBe(false);
    }
  });
});
