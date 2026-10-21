import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import {
  applyNumberPathOp,
  evaluateNumberPath,
  type NumberPathOp,
  type NumberPathOpKind,
  type NumberPathPuzzle,
  numberPath,
  numberPathFallback,
  numberPathSolveSeconds,
  numberPathTryGenerate,
  traceNumberPath,
} from "./number-path";

/** Số seed mỗi mức (≥ 10 000 theo AGENTS.md). */
const SEEDS = 10_000;

/**
 * Seed vòng trải khắp dải 32 bit, chỉ số câu 0–24. Không nhân với 0x9e3779b1 như `deriveSeed`
 * nhân chỉ số câu, kẻo hai số hạng triệt tiêu nhau qua phép XOR và nhiều seed cho cùng câu đố.
 */
function roundSeedOf(s: number): number {
  return (Math.imul(s, 0x27d4eb2f) + 0x165667b1) >>> 0;
}

function generate(s: number, d: Difficulty): NumberPathPuzzle {
  return numberPath.generate(roundSeedOf(s), s % 25, d);
}

/** Sinh sẵn 10 000 câu mỗi mức, dùng chung cho các test. */
const SAMPLES: Record<Difficulty, NumberPathPuzzle[]> = {
  0: Array.from({ length: SEEDS }, (_, s) => generate(s, 0)),
  1: Array.from({ length: SEEDS }, (_, s) => generate(s, 1)),
  2: Array.from({ length: SEEDS }, (_, s) => generate(s, 2)),
  3: Array.from({ length: SEEDS }, (_, s) => generate(s, 3)),
};

const ALL_KINDS: NumberPathOpKind[] = ["add", "sub", "mul", "div", "sq", "neg"];

/** Thông số mỗi mức theo đặc tả (mục Độ khó và Cân bằng). */
const SPEC: Record<
  Difficulty,
  {
    paths: number;
    rows: number;
    start: readonly [number, number];
    range: readonly [number, number];
    near: number;
    kinds: readonly NumberPathOpKind[];
    mulBy: readonly number[];
    seconds: readonly [number, number];
    shared: readonly [number, number];
  }
> = {
  0: {
    paths: 2,
    rows: 2,
    start: [2, 12],
    range: [0, 20],
    near: 3,
    kinds: ["add", "sub"],
    mulBy: [],
    seconds: [0, 3.6],
    shared: [0, 0],
  },
  1: {
    paths: 3,
    rows: 3,
    start: [1, 12],
    range: [0, 40],
    near: 4,
    kinds: ["add", "sub", "mul"],
    mulBy: [2],
    seconds: [3.7, 4.95],
    shared: [0, 0],
  },
  2: {
    paths: 3,
    rows: 3,
    start: [-12, -2],
    range: [-20, 20],
    near: 4,
    kinds: ["add", "sub", "mul", "div"],
    mulBy: [2, 3],
    seconds: [5.05, 6.05],
    shared: [0, 0],
  },
  3: {
    paths: 4,
    rows: 3,
    start: [-9, 9],
    range: [-20, 20],
    near: 5,
    kinds: ALL_KINDS,
    mulBy: [2, 3],
    seconds: [6.15, 7.3],
    shared: [1, 2],
  },
};

/** Thời gian giải trung bình theo mô hình (giây, người lớn), đúng bảng ở mục Cân bằng của đặc tả. */
const SPEC_MEAN_SECONDS: Record<Difficulty, number> = { 0: 2.83, 1: 4.53, 2: 5.65, 3: 6.56 };

/** Gom lỗi để một vòng 10 000 seed chỉ gọi `expect` một lần (nhanh, báo vài lỗi đầu). */
function expectNoFailures(failures: string[]): void {
  expect(failures.slice(0, 5), `${failures.length} lỗi`).toEqual([]);
}

/** Chạy `check(p)` trên mọi câu mẫu của mọi mức (và câu dự phòng), gom lỗi theo nhãn. */
function forAll(check: (p: NumberPathPuzzle, d: Difficulty) => string | null): void {
  const failures: string[] = [];
  for (const d of DIFFICULTIES) {
    for (const [s, p] of [...SAMPLES[d], numberPathFallback(d)].entries()) {
      const err = check(p, d);
      if (err) failures.push(`d${d} ${s === SEEDS ? "dự phòng" : `s${s}`}: ${err}`);
    }
  }
  expectNoFailures(failures);
}

const ends = (p: NumberPathPuzzle) => p.paths.map((ops) => evaluateNumberPath(p.start, ops));
/** Giá trị đi vào từng phép của một đường (số xuất phát rồi các kết quả trung gian). */
const inputs = (p: NumberPathPuzzle, ops: readonly NumberPathOp[]) => [
  p.start,
  ...traceNumberPath(p.start, ops).slice(0, -1),
];
const isPm = (o: NumberPathOp) => o.kind === "add" || o.kind === "sub";
const sameCell = (p: NumberPathPuzzle, i: number, j: number, r: number) =>
  p.layout[i]![r]!.col === p.layout[j]![r]!.col;

function sharedCount(p: NumberPathPuzzle): number {
  let n = 0;
  for (let r = 0; r < p.rows; r++) {
    const cols = p.layout.map((cells) => cells[r]!.col);
    n += cols.length - new Set(cols).size;
  }
  return n;
}

function percentile(xs: readonly number[], q: number): number {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

describe("number-path", () => {
  it("khai báo theo CR-006: vòng 60 giây, hệ số dương và không giảm theo mức, không miễn trừ", () => {
    expect(numberPath.id).toBe("number-path");
    expect(numberPath.category).toBe("compute");
    expect(numberPath.durationMs).toBe(60_000);
    const m = DIFFICULTIES.map((d) => numberPath.difficultyMultiplier![d]);
    for (const v of m) expect(v).toBeGreaterThan(0);
    expect(m).toEqual([...m].sort((a, b) => a - b));
    expect(m[0]).toBeLessThanOrEqual(1);
    expect(m[1]).toBe(1);
    expect(numberPath.speedAllowanceMs).toBeUndefined();
    expect(numberPath.answerWindowMs).toBeUndefined();
  });

  it("tất định: cùng (seed, index, độ khó) → cùng câu đố (10 000 seed × 4 mức)", () => {
    const failures: string[] = [];
    for (const d of DIFFICULTIES) {
      for (let s = 0; s < SEEDS; s++) {
        if (JSON.stringify(generate(s, d)) !== JSON.stringify(SAMPLES[d][s]))
          failures.push(`d${d} s${s}`);
      }
    }
    expectNoFailures(failures);
  }, 60_000);

  it("không bao giờ cần câu dự phòng (10 000 seed × 4 mức)", () => {
    const failures: string[] = [];
    for (const d of DIFFICULTIES) {
      for (let s = 0; s < SEEDS; s++) {
        const p = numberPathTryGenerate(roundSeedOf(s), s % 25, d);
        if (p === null) failures.push(`d${d} s${s}`);
      }
    }
    expectNoFailures(failures);
  }, 60_000);

  it("câu khác nhau theo seed và theo chỉ số câu", () => {
    for (const d of DIFFICULTIES) {
      const bySeed = new Set(SAMPLES[d].slice(0, 200).map((p) => JSON.stringify(p)));
      expect(bySeed.size).toBeGreaterThan(190);
      const byIndex = new Set(
        Array.from({ length: 25 }, (_, i) => JSON.stringify(numberPath.generate(42, i, d))),
      );
      expect(byIndex.size).toBeGreaterThan(22);
    }
  });

  it("đúng MỘT đường ra số đích, và check chỉ nhận đúng đường đó (10 000 seed × 4 mức)", () => {
    forAll((p) => {
      const hits = ends(p).flatMap((e, i) => (e === p.target ? [i] : []));
      if (hits.length !== 1 || hits[0] !== p.answer) return `${hits.length} đường ra đích`;
      const accepted = [0, 1, 2, 3].filter((i) => numberPath.check(p, i));
      if (accepted.length !== 1 || accepted[0] !== p.answer) return `check nhận ${accepted}`;
      return null;
    });
  });

  it("đường nhiễu lệch đích gần (1 … near), kết quả các đường đôi một khác nhau", () => {
    forAll((p, d) => {
      const e = ends(p);
      if (new Set(e).size !== e.length) return `kết quả trùng ${e}`;
      for (const [i, v] of e.entries()) {
        const off = Math.abs(v - p.target);
        if (i !== p.answer && (off < 1 || off > SPEC[d].near)) return `đường ${i} lệch ${off}`;
      }
      return null;
    });
  });

  it("÷ luôn chia hết (số bị chia khác 0, thương khác ±1); x² chỉ trên |x| 2–4", () => {
    forAll((p) => {
      for (const ops of p.paths) {
        const ins = inputs(p, ops);
        for (const [k, o] of ops.entries()) {
          const v = ins[k]!;
          if (o.kind === "div" && (v === 0 || v % o.n !== 0 || Math.abs(v) <= o.n))
            return `${v} ÷ ${o.n}`;
          if (o.kind === "sq" && (Math.abs(v) < 2 || Math.abs(v) > 4)) return `(${v})²`;
          if (o.kind === "mul" && v === 0) return `0 × ${o.n}`;
          if (o.kind === "neg" && v === 0) return "đổi dấu 0";
        }
      }
      return null;
    });
  });

  it("mọi số (xuất phát, trung gian, đích) là số nguyên trong giới hạn của mức, không có −0", () => {
    forAll((p, d) => {
      const [lo, hi] = SPEC[d].range;
      const [s0, s1] = SPEC[d].start;
      if (!Number.isInteger(p.start) || p.start < s0 || p.start > s1) return `xuất phát ${p.start}`;
      if (!Number.isInteger(p.target) || p.target < lo || p.target > hi) return `đích ${p.target}`;
      for (const ops of p.paths) {
        for (const v of traceNumberPath(p.start, ops)) {
          if (!Number.isInteger(v) || v < lo || v > hi || Object.is(v, -0)) return `giá trị ${v}`;
        }
      }
      return null;
    });
  });

  it("phép đúng loại của mức, toán hạng đúng phạm vi, phép cuối luôn cộng/trừ, không phép nào triệt tiêu phép trước", () => {
    forAll((p, d) => {
      const spec = SPEC[d];
      for (const ops of p.paths) {
        if (!isPm(ops[ops.length - 1]!)) return "phép cuối không phải cộng/trừ";
        for (const [k, o] of ops.entries()) {
          if (!spec.kinds.includes(o.kind)) return `phép ${o.kind} không thuộc mức`;
          const okN =
            o.kind === "add" || o.kind === "sub"
              ? Number.isInteger(o.n) && o.n >= 1 && o.n <= 9
              : o.kind === "mul"
                ? spec.mulBy.includes(o.n)
                : o.kind === "div"
                  ? o.n === 2 || o.n === 3
                  : o.n === 0;
          if (!okN) return `toán hạng ${o.kind} ${o.n}`;
          const prev = ops[k - 1];
          if (prev && JSON.stringify(applyInverse(prev)) === JSON.stringify(o))
            return `${prev.kind}${prev.n} rồi ${o.kind}${o.n}`;
        }
      }
      return null;
    });
  });

  it("khuôn từng mức: Thường mỗi đường đúng một ×2; Khó mỗi đường đúng một ÷, xuất phát âm; Siêu khó mỗi đường có x² hoặc đổi dấu", () => {
    forAll((p, d) => {
      const count = (ops: readonly NumberPathOp[], kind: NumberPathOpKind) =>
        ops.filter((o) => o.kind === kind).length;
      for (const ops of p.paths) {
        if (ops.length !== SPEC[d].rows) return `đường dài ${ops.length}`;
        if (d === 1 && count(ops, "mul") !== 1) return `${count(ops, "mul")} phép ×`;
        if (d === 2 && (count(ops, "div") !== 1 || count(ops, "mul") > 1)) return "khuôn Khó";
        if (d === 3 && count(ops, "sq") + count(ops, "neg") === 0) return "thiếu phép đặc biệt";
      }
      if (d === 2 && p.start >= 0) return `xuất phát ${p.start}`;
      if (d === 3) {
        const all = p.paths.flat();
        if (!all.some((o) => o.kind === "sq") || !all.some((o) => o.kind === "neg"))
          return "thiếu x² hoặc đổi dấu";
      }
      // Đường thẳng: phần đầu các đường đôi một khác nhau (không có đường chỉ khác phép cuối).
      if (d < 3) {
        const heads = p.paths.map((ops) => JSON.stringify(ops.slice(0, -1)));
        if (new Set(heads).size !== heads.length) return "hai đường cùng phần đầu";
      }
      return null;
    });
  });

  it("lưới: kích thước đúng mức, mỗi hàng một ô, lệch tối đa một cột, đường i ra cửa i", () => {
    forAll((p, d) => {
      const spec = SPEC[d];
      if (p.cols !== spec.paths || p.rows !== spec.rows) return `lưới ${p.cols}×${p.rows}`;
      if (p.paths.length !== spec.paths || p.layout.length !== spec.paths) return "số đường";
      if (!Number.isInteger(p.answer) || p.answer < 0 || p.answer >= spec.paths)
        return `answer ${p.answer}`;
      for (const [i, cells] of p.layout.entries()) {
        if (cells.length !== p.rows) return `đường ${i} có ${cells.length} ô`;
        for (const [k, c] of cells.entries()) {
          if (c.row !== k || !Number.isInteger(c.col) || c.col < 0 || c.col >= p.cols)
            return `ô ${JSON.stringify(c)}`;
          if (k > 0 && Math.abs(c.col - cells[k - 1]!.col) > 1) return `đường ${i} nhảy cột`;
          if (d < 3 && c.col !== i) return `đường ${i} không thẳng`;
        }
        if (cells[p.rows - 1]!.col !== i) return `đường ${i} ra cửa ${cells[p.rows - 1]!.col}`;
      }
      return null;
    });
  });

  it("Siêu khó có 1–2 ô dùng chung: tối đa 2 đường một ô, cùng ô thì cùng phép, không đi chồng một đoạn nét", () => {
    forAll((p, d) => {
      const [lo, hi] = SPEC[d].shared;
      const shared = sharedCount(p);
      if (shared < lo || shared > hi) return `${shared} ô dùng chung`;
      for (let r = 0; r < p.rows; r++) {
        for (let i = 0; i < p.paths.length; i++) {
          for (let j = i + 1; j < p.paths.length; j++) {
            if (!sameCell(p, i, j, r)) continue;
            if (JSON.stringify(p.paths[i]![r]) !== JSON.stringify(p.paths[j]![r]))
              return `ô hàng ${r} hai phép khác nhau`;
            if (r + 1 < p.rows && sameCell(p, i, j, r + 1)) return `đường ${i}, ${j} chồng nét`;
            for (let k = j + 1; k < p.paths.length; k++)
              if (sameCell(p, i, k, r)) return "3 đường một ô";
          }
        }
      }
      return null;
    });
  });

  it("độ khó tăng thật: thời gian theo mô hình đúng đặc tả, tăng ngặt, các mức không chồng nhau", () => {
    const stats = DIFFICULTIES.map((d) => {
      const times = SAMPLES[d].map(numberPathSolveSeconds);
      return {
        d,
        mean: mean(times),
        min: Math.min(...times),
        max: Math.max(...times),
        p10: percentile(times, 0.1),
        p90: percentile(times, 0.9),
      };
    });
    for (const { d, mean: m, min, max } of stats) {
      expect(Math.abs(m - SPEC_MEAN_SECONDS[d])).toBeLessThan(0.1);
      expect(min).toBeGreaterThanOrEqual(SPEC[d].seconds[0]);
      expect(max).toBeLessThanOrEqual(SPEC[d].seconds[1]);
    }
    for (let i = 1; i < stats.length; i++) {
      expect(stats[i]!.mean).toBeGreaterThan(stats[i - 1]!.mean);
      expect(stats[i - 1]!.p90).toBeLessThan(stats[i]!.p10);
      expect(stats[i - 1]!.max).toBeLessThan(stats[i]!.min);
    }
    // Câu dự phòng cũng nằm trong khoảng thời gian của mức.
    for (const d of DIFFICULTIES) {
      const s = numberPathSolveSeconds(numberPathFallback(d));
      expect(s).toBeGreaterThanOrEqual(SPEC[d].seconds[0]);
      expect(s).toBeLessThanOrEqual(SPEC[d].seconds[1]);
    }
  });

  it("độ khó tăng thật: mỗi mức thêm một thứ mới (đường, phép, số âm, ô dùng chung)", () => {
    const avg = (d: Difficulty, f: (p: NumberPathPuzzle) => number) => mean(SAMPLES[d].map(f));
    const negatives = (p: NumberPathPuzzle) =>
      [p.start, ...p.paths.flatMap((ops) => traceNumberPath(p.start, ops))].filter((v) => v < 0)
        .length;
    const has = (kind: NumberPathOpKind) => (p: NumberPathPuzzle) =>
      p.paths.flat().some((o) => o.kind === kind) ? 1 : 0;
    // Mầm → Thường: thêm đường, thêm phép, có ×2.
    expect(avg(0, (p) => p.paths.length * p.rows)).toBe(4);
    expect(avg(1, (p) => p.paths.length * p.rows)).toBe(9);
    expect(avg(0, has("mul"))).toBe(0);
    expect(avg(1, has("mul"))).toBe(1);
    // Thường → Khó: có ÷ và số âm.
    expect(avg(1, negatives)).toBe(0);
    expect(avg(2, has("div"))).toBe(1);
    expect(avg(2, negatives)).toBeGreaterThan(5);
    // Khó → Siêu khó: 4 đường đan nhau có ô dùng chung, có x² và đổi dấu.
    expect(avg(2, sharedCount)).toBe(0);
    expect(avg(3, (p) => p.paths.length)).toBe(4);
    expect(avg(3, sharedCount)).toBeGreaterThanOrEqual(1);
    expect(avg(3, has("sq"))).toBe(1);
    expect(avg(3, has("neg"))).toBe(1);
  });

  it("vị trí đáp án rải đều (tần suất mỗi đường lệch < 10 % so với chia đều)", () => {
    for (const d of DIFFICULTIES) {
      const n = SPEC[d].paths;
      const counts = new Array<number>(n).fill(0);
      for (const p of SAMPLES[d]) counts[p.answer]!++;
      for (const c of counts) {
        expect(c / SEEDS).toBeGreaterThan((1 / n) * 0.9);
        expect(c / SEEDS).toBeLessThan((1 / n) * 1.1);
      }
    }
  });

  it("không đoán được đáp án qua phép cuối: độ lớn và dấu phép cuối của đường đúng như đường nhiễu", () => {
    for (const d of DIFFICULTIES) {
      const right: number[] = [];
      const wrong: number[] = [];
      for (const p of SAMPLES[d]) {
        for (const [i, ops] of p.paths.entries()) {
          const last = ops[ops.length - 1]!;
          (i === p.answer ? right : wrong).push(last.kind === "add" ? last.n : -last.n);
        }
      }
      expect(Math.abs(mean(right.map(Math.abs)) - mean(wrong.map(Math.abs)))).toBeLessThan(0.3);
      const plus = (xs: number[]) => xs.filter((x) => x > 0).length / xs.length;
      expect(Math.abs(plus(right) - plus(wrong))).toBeLessThan(0.05);
    }
  });

  it("evaluateNumberPath và traceNumberPath khớp nhau và khớp từng phép", () => {
    for (const d of DIFFICULTIES) {
      for (const p of SAMPLES[d].slice(0, 500)) {
        for (const ops of p.paths) {
          const trace = traceNumberPath(p.start, ops);
          expect(trace).toHaveLength(ops.length);
          expect(trace[trace.length - 1]).toBe(evaluateNumberPath(p.start, ops));
          let v = p.start;
          for (const [k, o] of ops.entries()) {
            v = applyNumberPathOp(v, o);
            expect(trace[k]).toBe(v);
          }
        }
      }
    }
    expect(applyNumberPathOp(0, { kind: "neg", n: 0 })).toBe(0);
    expect(applyNumberPathOp(-4, { kind: "sq", n: 0 })).toBe(16);
    expect(applyNumberPathOp(-9, { kind: "div", n: 3 })).toBe(-3);
    expect(evaluateNumberPath(5, [])).toBe(5);
  });

  it("check từ chối chỉ số đường không có trong câu", () => {
    for (const d of DIFFICULTIES) {
      for (const p of SAMPLES[d].slice(0, 200)) {
        expect(numberPath.check(p, p.answer)).toBe(true);
        for (let i = p.paths.length; i < 4; i++) expect(numberPath.check(p, i)).toBe(false);
      }
    }
  });

  it("isAnswer nhận chỉ số đường 0–3 và từ chối dữ liệu rác", () => {
    for (const v of [0, 1, 2, 3]) expect(numberPath.isAnswer(v)).toBe(true);
    const junk: unknown[] = [
      -1,
      4,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "0",
      null,
      undefined,
      true,
      {},
      [],
      [0],
      1n,
    ];
    for (const [i, v] of junk.entries()) expect(numberPath.isAnswer(v), `junk[${i}]`).toBe(false);
  });
});

/** Phép ngược của một phép (để kiểm không có hai phép liền nhau triệt tiêu nhau). */
function applyInverse(o: NumberPathOp): NumberPathOp | null {
  switch (o.kind) {
    case "add":
      return { kind: "sub", n: o.n };
    case "sub":
      return { kind: "add", n: o.n };
    case "mul":
      return { kind: "div", n: o.n };
    case "div":
      return { kind: "mul", n: o.n };
    case "neg":
      return { kind: "neg", n: 0 };
    case "sq":
      return null;
  }
}
