import { afterEach, describe, expect, it, vi } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import { createRng } from "../../rng";
import { fromTemplate, LATIN_CELL_FALLBACKS } from "./fallback";
import {
  bitCount,
  candidateMask,
  EMPTY,
  forcedValue,
  type GridShape,
  hasCompletion,
  isConsistent,
  peersOfCell,
  seenMask,
  stepsToForce,
  unitsOfCell,
} from "./grid";
import {
  LATIN_CELL_LEVELS,
  LATIN_CELL_MAX_SHAPES,
  type LatinCellPuzzle,
  latinCell,
  latinCellFallback,
  latinCellPeers,
  latinCellUnits,
} from "./latin-cell";

const SEEDS = 10_000;

const shapeOf = (p: LatinCellPuzzle): GridShape => ({ size: p.size, block: p.block });

// ---------------------------------------------------------------------------------------------
// Bộ giải độc lập với grid.ts: tự dựng nhóm và tự tính ứng viên bằng cách quét thẳng lưới.
// ---------------------------------------------------------------------------------------------

interface Naive {
  size: number;
  /** Theo ô: các nhóm chứa ô. */
  unitsOf: number[][][];
}

const naiveCache = new Map<string, Naive>();

function naiveOf(p: Pick<LatinCellPuzzle, "size" | "block">): Naive {
  const key = JSON.stringify([p.size, p.block]);
  const hit = naiveCache.get(key);
  if (hit) return hit;
  const n = p.size;
  const units: number[][] = [];
  for (let r = 0; r < n; r++) units.push(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) units.push(Array.from({ length: n }, (_, r) => r * n + c));
  if (p.block) {
    const { rows, cols } = p.block;
    for (let br = 0; br < n; br += rows) {
      for (let bc = 0; bc < n; bc += cols) {
        const u: number[] = [];
        for (let r = br; r < br + rows; r++) for (let c = bc; c < bc + cols; c++) u.push(r * n + c);
        units.push(u);
      }
    }
  }
  const unitsOf = Array.from({ length: n * n }, (_, cell) => units.filter((u) => u.includes(cell)));
  const nv = { size: n, unitsOf };
  naiveCache.set(key, nv);
  return nv;
}

/** Theo ô trống: các hình chưa có trong nhóm nào chứa ô (ô đã có hình: mảng rỗng). */
function naiveTable(nv: Naive, grid: readonly number[]): number[][] {
  return grid.map((g, cell) => {
    if (g !== EMPTY) return [];
    const out: number[] = [];
    for (let v = 0; v < nv.size; v++) {
      if (nv.unitsOf[cell]!.every((u) => u.every((q) => grid[q] !== v))) out.push(v);
    }
    return out;
  });
}

/** Hình chốt được ngay cho ô trống `cell` (ô chỉ còn một hình, hoặc hình chỉ còn một chỗ), hoặc −1. */
function naiveSingle(
  nv: Naive,
  grid: readonly number[],
  cell: number,
  table = naiveTable(nv, grid),
): number {
  if (grid[cell] !== EMPTY) return -1;
  const own = table[cell]!;
  if (own.length === 1) return own[0]!;
  for (const u of nv.unitsOf[cell]!) {
    for (const v of own) {
      const elsewhere = u.some(
        (q) => q !== cell && (grid[q] === v || (grid[q] === EMPTY && table[q]!.includes(v))),
      );
      if (!elsewhere) return v;
    }
  }
  return -1;
}

/** Các hình đặt vào ô ? mà lưới vẫn điền kín hợp lệ được (vét cạn, độc lập với bộ sinh). */
function possibleAnswers(p: LatinCellPuzzle): number[] {
  const shape = shapeOf(p);
  const out: number[] = [];
  for (let v = 0; v < p.size; v++) {
    const grid = p.cells.slice();
    grid[p.target] = v;
    if (isConsistent(shape, grid) && hasCompletion(shape, grid)) out.push(v);
  }
  return out;
}

/**
 * Số nhóm ít nhất (chọn trong hàng, cột, khối của ô ?) mà các hình đã cho trong đó đủ chốt ô ?
 * theo kiểu "ô chỉ còn một hình". 4 = không bộ nhóm nào đủ.
 */
function minUnits(p: LatinCellPuzzle): number {
  const units = unitsOfCell(shapeOf(p), p.target);
  const full = (1 << p.size) - 1;
  let best = 4;
  for (let pick = 1; pick < 1 << units.length; pick++) {
    const chosen = units.filter((_, i) => pick & (1 << i));
    const seen = chosen.reduce((m, u) => m | seenMask(p.cells, u), 0);
    if (bitCount(full & ~seen) === 1) best = Math.min(best, chosen.length);
  }
  return best;
}

/** Độ chính xác kỳ vọng khi đoán "hình có ít (nhiều) ô đã cho nhất" trong `pool`; hoà thì bốc đều. */
function countGuess(p: LatinCellPuzzle, pool: number[], fewest: boolean): number {
  const count: number[] = new Array(p.size).fill(0);
  for (const v of p.cells) if (v >= 0) count[v]! += 1;
  const values = pool.map((v) => count[v]!);
  const best = fewest ? Math.min(...values) : Math.max(...values);
  const tie = pool.filter((v) => count[v] === best);
  return tie.includes(p.answer) ? 1 / tie.length : 0;
}

// ---------------------------------------------------------------------------------------------
// Kiểm một câu: ném lỗi ngay khi sai, trả số đo độ khó.
// ---------------------------------------------------------------------------------------------

/** Đúng lối suy luận của từng mức: số bước (gồm ô ?), số ứng viên ban đầu của ô ?, số nhóm cần. */
const EXPECTED: Record<Difficulty, { steps: number; candidates: number; minUnits: number }> = {
  0: { steps: 1, candidates: 1, minUnits: 1 },
  1: { steps: 1, candidates: 1, minUnits: 2 },
  2: { steps: 2, candidates: 2, minUnits: 4 },
  3: { steps: 3, candidates: 3, minUnits: 4 },
};

interface Metrics {
  steps: number;
  candidates: number;
  minUnits: number;
  givens: number;
  empties: number;
  /** Đoán theo đếm hình trên cả lưới: hình ít nhất, hình nhiều nhất. */
  fewestAll: number;
  mostAll: number;
  /** Đoán theo đếm hình, chỉ trong các ứng viên của ô ?. */
  fewestCand: number;
  mostCand: number;
}

function verify(p: LatinCellPuzzle, d: Difficulty, at: string): Metrics {
  const level = LATIN_CELL_LEVELS[d];
  const shape = shapeOf(p);
  const fail = (msg: string): never => {
    throw new Error(`${at}: ${msg} ${JSON.stringify(p)}`);
  };

  // Hình dạng lưới đúng mức, ô ? trống, hình đã cho không trùng trong nhóm nào.
  if (p.size !== level.size) fail("sai cạnh lưới");
  if (JSON.stringify(p.block) !== JSON.stringify(level.block)) fail("sai khối");
  if (p.cells.length !== p.size * p.size) fail("sai số ô");
  if (p.cells.some((v) => !Number.isInteger(v) || v < EMPTY || v >= p.size)) fail("mã hình lạ");
  if (!Number.isInteger(p.target) || p.target < 0 || p.target >= p.cells.length) fail("ô ? lạ");
  if (p.cells[p.target] !== EMPTY) fail("ô ? không trống");
  if (!isConsistent(shape, p.cells)) fail("hình trùng trong một nhóm");

  // Đúng MỘT đáp án: vét cạn mọi cách điền kín (cũng chứng minh lưới khớp một hình vuông
  // Latin có khối hợp lệ), ô ? chỉ nhận đúng hình `answer`; check() chỉ nhận đáp án đó.
  const possible = possibleAnswers(p);
  if (possible.length !== 1 || possible[0] !== p.answer) fail(`ô ? nhận được ${possible}`);
  const accepted = Array.from({ length: LATIN_CELL_MAX_SHAPES }, (_, a) => a).filter((a) =>
    latinCell.check(p, a),
  );
  if (accepted.length !== 1 || accepted[0] !== p.answer) fail("check() không khớp đáp án");

  // Số bước suy luận đúng mức, đo bằng bộ giải của grid.ts.
  const want = EXPECTED[d];
  const m = {
    steps: stepsToForce(shape, p.cells, p.target, 4),
    candidates: bitCount(candidateMask(shape, p.cells, p.target)),
    minUnits: minUnits(p),
  };
  if (m.steps !== want.steps) fail(`cần ${m.steps} bước, mức đòi ${want.steps}`);
  if (m.candidates !== want.candidates) fail(`ô ? có ${m.candidates} ứng viên`);
  if (m.minUnits !== want.minUnits) fail(`cần ${m.minUnits} nhóm, mức đòi ${want.minUnits}`);

  // Đo lại bằng bộ giải độc lập: chốt ngay được (Mầm, Thường) hay không (Khó, Siêu khó); Siêu
  // khó không có lối tắt 2 bước (điền bất kỳ một ô chốt được nào cũng chưa chốt được ô ?).
  const nv = naiveOf(p);
  const table = naiveTable(nv, p.cells);
  const first = naiveSingle(nv, p.cells, p.target, table);
  if (level.intermediates === 0 && first !== p.answer) fail("bộ giải độc lập không chốt ngay");
  if (level.intermediates > 0 && first >= 0) fail("bộ giải độc lập chốt ngay được ô ?");
  if (level.intermediates >= 2) {
    for (let cell = 0; cell < p.cells.length; cell++) {
      if (cell === p.target) continue;
      const v = naiveSingle(nv, p.cells, cell, table);
      if (v < 0) continue;
      const next = p.cells.slice();
      next[cell] = v;
      if (naiveSingle(nv, next, p.target) >= 0) fail(`lối tắt qua ô ${cell}`);
    }
  }

  // Ô trung gian: đúng số lượng, khác nhau, cùng nhóm với ô ?, đang trống, chốt được ngay;
  // ứng viên của ô ? = {đáp án, hình các ô trung gian}; điền hết thì ô ? chốt được.
  if (p.via.length !== level.intermediates) fail(`có ${p.via.length} ô trung gian`);
  const peers = peersOfCell(shape, p.target);
  const next = p.cells.slice();
  let wantMask = 1 << p.answer;
  for (const v of p.via) {
    if (!peers.includes(v.cell) || p.cells[v.cell] !== EMPTY) fail("ô trung gian sai chỗ");
    if (naiveSingle(nv, p.cells, v.cell, table) !== v.shape) fail("ô trung gian chưa chốt");
    if (forcedValue(shape, p.cells, v.cell) !== v.shape) fail("ô trung gian chưa chốt (grid)");
    if (wantMask & (1 << v.shape)) fail("hai ô trung gian cùng hình hoặc trùng đáp án");
    wantMask |= 1 << v.shape;
    next[v.cell] = v.shape;
  }
  if (new Set(p.via.map((v) => v.cell)).size !== p.via.length) fail("ô trung gian trùng nhau");
  if (candidateMask(shape, p.cells, p.target) !== wantMask) fail("ứng viên của ô ? sai");
  if (naiveSingle(nv, next, p.target) !== p.answer) fail("điền ô trung gian chưa chốt");

  // Riêng từng mức.
  const [row = [], col = []] = unitsOfCell(shape, p.target);
  const givenIn = (u: readonly number[]) => u.filter((c) => p.cells[c] !== EMPTY).length;
  const empties = p.cells.filter((v) => v === EMPTY).length;
  if (level.reasoning === "line") {
    // Một đường của ô ? đủ hình, đường kia trống hẳn.
    const counts = [givenIn(row), givenIn(col)].sort((a, b) => a - b);
    if (counts[0] !== 0 || counts[1] !== p.size - 1) fail("Mầm phải có đúng một đường đủ");
  }
  if (level.reasoning === "via" && (empties < level.empty[0] || empties > level.empty[1])) {
    fail(`${empties} ô trống`);
  }

  const all = Array.from({ length: p.size }, (_, v) => v);
  const cands = all.filter((v) => wantMask & (1 << v));
  return {
    ...m,
    givens: p.cells.length - empties,
    empties,
    fewestAll: countGuess(p, all, true),
    mostAll: countGuess(p, all, false),
    fewestCand: countGuess(p, cands, true),
    mostCand: countGuess(p, cands, false),
  };
}

interface Summary {
  avg: Record<keyof Metrics, number>;
  answers: number[];
  targets: number[];
}

const sweeps = new Map<Difficulty, Summary>();

/** Sinh 10.000 seed của một mức, kiểm từng câu và gom số liệu. */
function sweep(d: Difficulty): Summary {
  const cached = sweeps.get(d);
  if (cached) return cached;
  const level = LATIN_CELL_LEVELS[d];
  const sum = {} as Record<keyof Metrics, number>;
  const answers: number[] = new Array(level.size).fill(0);
  const targets: number[] = new Array(level.size * level.size).fill(0);
  for (let seed = 0; seed < SEEDS; seed++) {
    const index = seed % 40;
    const p = latinCell.generate(seed, index, d);
    const m = verify(p, d, `mức ${d} seed ${seed} câu ${index}`);
    for (const [k, v] of Object.entries(m) as [keyof Metrics, number][]) sum[k] = (sum[k] ?? 0) + v;
    answers[p.answer]! += 1;
    targets[p.target]! += 1;
  }
  const avg = Object.fromEntries(
    Object.entries(sum).map(([k, v]) => [k, v / SEEDS]),
  ) as Summary["avg"];
  const summary = { avg, answers, targets };
  sweeps.set(d, summary);
  return summary;
}

describe("latin-cell: lưới và bộ giải", () => {
  it("số ô cùng nhóm đúng theo cấu hình lưới", () => {
    for (const d of DIFFICULTIES) {
      const p = latinCell.generate(1, 0, d);
      const expected = { 0: 4, 1: 6, 2: 7, 3: 12 }[d];
      for (let cell = 0; cell < p.size * p.size; cell++) {
        expect(latinCellPeers(p, cell)).toHaveLength(expected);
        expect(latinCellUnits(p, cell)).toHaveLength(p.block ? 3 : 2);
      }
    }
  });

  it("nhận ra ô duy nhất ẩn (không phải ô duy nhất trần)", () => {
    // Hình 0 đã có ở cột 1, 2, 3 nên trên hàng 0 chỉ còn ô (0, 0) đặt được hình 0.
    const shape: GridShape = { size: 4, block: null };
    const grid = [-1, -1, -1, -1, -1, 0, -1, -1, -1, -1, 0, -1, -1, -1, -1, 0];
    expect(bitCount(candidateMask(shape, grid, 0))).toBe(4);
    expect(forcedValue(shape, grid, 0)).toBe(0);
    expect(stepsToForce(shape, grid, 0, 3)).toBe(1);
  });

  it("đếm đúng số bước của một câu mẫu 2 bước", () => {
    // Câu dự phòng Khó: ô ? (0, 2) còn {2, 3}; hàng 3 chỉ còn ô (3, 2) đặt được hình 3.
    const t = LATIN_CELL_FALLBACKS[2]!;
    const shape: GridShape = { size: 4, block: { rows: 2, cols: 2 } };
    const grid = [...t.cells].map((ch) => (ch === "." ? EMPTY : Number(ch)));
    expect(forcedValue(shape, grid, t.target)).toBe(-1);
    expect(forcedValue(shape, grid, 14)).toBe(3);
    expect(stepsToForce(shape, grid, t.target, 4)).toBe(2);
  });
});

describe("latin-cell: bộ sinh", { timeout: 120_000 }, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tất định: cùng (seed, index, độ khó) → cùng câu đố, không phụ thuộc thứ tự sinh", () => {
    for (const d of DIFFICULTIES) {
      for (let seed = 0; seed < 50; seed++) {
        const first = latinCell.generate(seed * 7919, seed, d);
        latinCell.generate(seed, seed + 1, d);
        expect(latinCell.generate(seed * 7919, seed, d)).toEqual(first);
      }
      const distinct = new Set(
        Array.from({ length: 50 }, (_, i) => JSON.stringify(latinCell.generate(42, i, d))),
      );
      expect(distinct.size).toBeGreaterThanOrEqual(45);
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
      for (let seed = 0; seed < 200; seed++) latinCell.generate(seed, seed % 9, d);
    }
  });

  for (const d of DIFFICULTIES) {
    it(`mức ${d}: đúng MỘT đáp án và đúng số bước suy luận (10.000 seed)`, () => {
      const s = sweep(d);
      // Đáp án phân bố đều giữa các hình (lệch < 2 điểm %).
      for (const count of s.answers) {
        expect(Math.abs(count / SEEDS - 1 / s.answers.length)).toBeLessThan(0.02);
      }
      // Ô nào cũng có lúc là ô ?, không ô nào quá hiếm.
      const mean = SEEDS / s.targets.length;
      for (const count of s.targets) expect(count).toBeGreaterThan(mean * 0.6);
    });
  }

  it("câu dự phòng (khi đào hỏng quá số lần) vẫn đúng mọi bảo đảm của mức", () => {
    for (const d of [2, 3] as const) {
      const level = LATIN_CELL_LEVELS[d];
      const seen = new Set<string>();
      for (let seed = 0; seed < 1_000; seed++) {
        const built = latinCellFallback(createRng(seed), d);
        const p: LatinCellPuzzle = { size: level.size, block: level.block, ...built };
        verify(p, d, `dự phòng mức ${d} seed ${seed}`);
        seen.add(JSON.stringify(p.cells));
      }
      // Phép đối xứng cho ra nhiều câu khác nhau, không lặp một câu duy nhất.
      expect(seen.size).toBeGreaterThan(300);
    }
    // Không có câu dự phòng cho mức không đào.
    expect(() => latinCellFallback(createRng(1), 0)).toThrow();
  });

  it("phép đối xứng của câu dự phòng giữ nguyên số hình đã cho của từng hình", () => {
    const t = LATIN_CELL_FALLBACKS[3]!;
    const histogram = (cells: readonly number[]) =>
      cells
        .filter((v) => v !== EMPTY)
        .reduce((h, v) => h.set(v, (h.get(v) ?? 0) + 1), new Map<number, number>());
    const before = [...histogram([...t.cells].map((ch) => (ch === "." ? EMPTY : Number(ch))))]
      .map(([, n]) => n)
      .sort();
    for (let seed = 0; seed < 50; seed++) {
      const p = fromTemplate(createRng(seed), { size: 6, block: { rows: 2, cols: 3 } }, t);
      expect([...histogram(p.cells)].map(([, n]) => n).sort()).toEqual(before);
    }
  });

  it("khó dần theo độ khó (đo trên 10.000 seed mỗi mức)", () => {
    const avg = DIFFICULTIES.map((d) => sweep(d).avg);
    const series = (k: keyof Metrics) => avg.map((a) => a[k]);
    const increasing = (xs: number[]) => xs.every((x, i) => i === 0 || x > xs[i - 1]!);

    // Mỗi mức đòi thêm một lớp suy luận: 1 nhóm → hàng + cột → 1 ô trung gian → 2 ô trung gian.
    expect(series("minUnits")).toEqual([1, 2, 4, 4]);
    expect(series("steps")).toEqual([1, 1, 2, 3]);
    expect(series("candidates")).toEqual([1, 1, 2, 3]);
    expect(increasing(series("steps").slice(1))).toBe(true);
    // Số thẻ đáp án (= cạnh lưới) không giảm: 3 → 4 → 4 → 6.
    expect(DIFFICULTIES.map((d) => LATIN_CELL_LEVELS[d].size)).toEqual([3, 4, 4, 6]);
  });

  it("không đoán được bằng cách đếm hình trên lưới", () => {
    for (const d of DIFFICULTIES) {
      const { avg } = sweep(d);
      const c = EXPECTED[d].candidates;
      const chance = 1 / LATIN_CELL_LEVELS[d].size;
      if (c === 1) {
        // Mầm, Thường: đoán "hình ít nhất / nhiều nhất trên lưới" chỉ ngang bốc bừa.
        expect(Math.abs(avg.fewestAll - chance)).toBeLessThan(0.04);
        expect(Math.abs(avg.mostAll - chance)).toBeLessThan(0.04);
      } else {
        // Khó, Siêu khó: giữa các ứng viên thật của ô ?, đếm hình không hơn bốc bừa;
        // đếm trên cả lưới cũng không hơn người nhìn quanh ô ? rồi bốc một ứng viên.
        expect(Math.abs(avg.fewestCand - 1 / c)).toBeLessThan(0.04);
        expect(Math.abs(avg.mostCand - 1 / c)).toBeLessThan(0.04);
        expect(avg.fewestAll).toBeLessThan(1 / c);
        expect(avg.mostAll).toBeLessThan(1 / c);
      }
    }
  });

  it("khai báo vòng 60 s, hệ số điểm không giảm khi lên mức, không miễn trừ thời gian", () => {
    expect(latinCell.durationMs).toBe(60_000);
    const mult = DIFFICULTIES.map((d) => latinCell.difficultyMultiplier?.[d] ?? Number.NaN);
    expect(mult[1]).toBe(1);
    for (let i = 1; i < mult.length; i++) expect(mult[i]!).toBeGreaterThanOrEqual(mult[i - 1]!);
    expect(latinCell.speedAllowanceMs).toBeUndefined();
  });

  it("isAnswer() từ chối dữ liệu rác", () => {
    expect(latinCell.isAnswer(0)).toBe(true);
    expect(latinCell.isAnswer(LATIN_CELL_MAX_SHAPES - 1)).toBe(true);
    for (const junk of [
      LATIN_CELL_MAX_SHAPES,
      -1,
      1.5,
      "0",
      null,
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      [0],
      { answer: 0 },
      true,
      0n,
    ]) {
      expect(latinCell.isAnswer(junk)).toBe(false);
    }
    // Mã hình hợp lệ nhưng vượt cạnh lưới của mức thì chấm sai.
    const p = latinCell.generate(3, 0, 1);
    expect(latinCell.check(p, 5)).toBe(false);
  });
});
