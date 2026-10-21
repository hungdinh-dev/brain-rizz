import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";
import { fromTemplate, LATIN_CELL_FALLBACKS } from "./fallback";
import {
  candidateMask,
  EMPTY,
  forcedValue,
  type GridBlock,
  type GridShape,
  peersOfCell,
  randomSolution,
  stepsToForce,
  unitsOfCell,
} from "./grid";

/**
 * Ô bí ẩn (nhóm Phân tích): lưới hình kiểu Sudoku nhỏ, mỗi hàng, mỗi cột (và mỗi khối, từ Khó)
 * có đủ mỗi hình đúng một lần. Chọn hình cho ô dấu ?.
 * Mầm: một hàng/cột đã đủ hình kia. Thường: phải kết hợp hàng và cột.
 * Khó (4 × 4, khối 2 × 2): ô ? còn 2 khả năng, phải chốt một ô trung gian trước.
 * Siêu khó (6 × 6, khối 2 × 3): ô ? còn 3 khả năng, phải chốt hai ô trung gian trước.
 * Đặc tả: docs/04-minigames/latin-cell.md.
 */

/** Số hình tối đa (lưới 6 × 6). Mã hình 0..size-1; FE vẽ theo bảng hình cố định trong đặc tả. */
export const LATIN_CELL_MAX_SHAPES = 6;

/** Ô trống trong `cells` (kể cả ô ?). */
export const LATIN_CELL_EMPTY = EMPTY;

export type LatinCellBlock = GridBlock;

/** Lối suy luận mà mức bắt buộc. */
export type LatinCellReasoning = "line" | "rowCol" | "via";

/** Một ô trung gian: ô trống cùng hàng, cột hoặc khối với ô ?, chốt được ngay từ lưới đã cho. */
export interface LatinCellVia {
  /** Chỉ số ô (`hàng × size + cột`). */
  cell: number;
  /** Hình của ô đó, cũng là một hình bị loại khỏi ô ?. */
  shape: number;
}

export interface LatinCellPuzzle {
  /** Cạnh lưới (3, 4 hoặc 6) = số hình = số thẻ đáp án. */
  size: number;
  /** Khối con (từ Khó) hoặc `null`. */
  block: LatinCellBlock | null;
  /** `size × size` ô theo hàng: mã hình 0..size-1, hoặc `LATIN_CELL_EMPTY` (−1) nếu trống. */
  cells: number[];
  /** Chỉ số ô ? (`hàng × size + cột`); ô này luôn trống trong `cells`. */
  target: number;
  /**
   * Ô trung gian theo lời giải dự định (Mầm, Thường: rỗng; Khó: 1; Siêu khó: 2). Mỗi ô chốt
   * được ngay từ lưới đã cho; điền hết các ô này thì ô ? chỉ còn đúng hình `answer`. FE dùng để
   * giải thích khi trả lời sai.
   */
  via: LatinCellVia[];
  /** Mã hình đúng của ô ?. */
  answer: number;
}

/** Đáp án = mã hình (0..size-1) của thẻ người chơi chạm. */
export type LatinCellAnswer = number;

export interface LatinCellLevel {
  size: number;
  block: LatinCellBlock | null;
  reasoning: LatinCellReasoning;
  /** Số bước suy luận: số ô ít nhất phải chốt trước ô ? (0 = suy thẳng từ lưới đã cho). */
  intermediates: number;
  /**
   * Mầm, Thường: số ô cho thêm (min, max) ở ngoài hàng, cột của ô ?. Không đổi lối suy ra ô ?,
   * chỉ để lưới trông đầy đặn và đếm hình trên cả lưới không lộ đáp án.
   */
  extras: readonly [number, number];
  /** Khó, Siêu khó: số ô trống (gồm ô ?) tối thiểu và tối đa của lưới. */
  empty: readonly [number, number];
  /**
   * Khó, Siêu khó: trọng số (trên 10) khi bốc ô mang hình đáp án để đào. Ô ? chỉ hết bị chốt
   * ngay khi đào bớt hình đáp án quanh nó, nên đào đều tay thì hình đáp án thường ít nhất trên
   * lưới; trọng số < 10 bù lại để đếm hình không chọn được giữa các ứng viên (đo trong test).
   */
  answerDigWeight: number;
}

export const LATIN_CELL_LEVELS: Readonly<Record<Difficulty, LatinCellLevel>> = {
  0: {
    size: 3,
    block: null,
    reasoning: "line",
    intermediates: 0,
    extras: [1, 2],
    empty: [0, 0],
    answerDigWeight: 10,
  },
  1: {
    size: 4,
    block: null,
    reasoning: "rowCol",
    intermediates: 0,
    extras: [2, 4],
    empty: [0, 0],
    answerDigWeight: 10,
  },
  2: {
    size: 4,
    block: { rows: 2, cols: 2 },
    reasoning: "via",
    intermediates: 1,
    extras: [0, 0],
    empty: [6, 10],
    answerDigWeight: 9,
  },
  3: {
    size: 6,
    block: { rows: 2, cols: 3 },
    reasoning: "via",
    intermediates: 2,
    extras: [0, 0],
    empty: [12, 20],
    answerDigWeight: 8,
  },
};

/** Khó, Siêu khó: số lần thử đào tối đa trước khi dùng câu dự phòng. */
export const LATIN_CELL_MAX_ATTEMPTS = 120;

/** Sau ngần này lần thử đào hỏng thì sinh lưới đầy đủ mới. */
const REGRID_EVERY = 8;

/** Phần câu đố do bộ sinh của từng mức dựng ra. */
export type LatinCellBuilt = Pick<LatinCellPuzzle, "cells" | "target" | "answer" | "via">;

type Built = LatinCellBuilt;

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Ô không cùng hàng, cột với ô ? (Mầm, Thường không có khối). */
function farCells(shape: GridShape, target: number): number[] {
  const near = new Set(peersOfCell(shape, target));
  near.add(target);
  return range(shape.size * shape.size).filter((c) => !near.has(c));
}

/**
 * Cho thêm `extras` ô lấy từ `pool`, mỗi lần chọn ô mang hình đang ít trên lưới nhất (hoà thì
 * ngẫu nhiên). Nhờ vậy số lần mỗi hình xuất hiện trên lưới gần đều nhau: không đoán được đáp án
 * bằng cách đếm hình nào thiếu nhiều nhất.
 */
function addBalancedExtras(
  rng: Rng,
  cells: number[],
  sol: readonly number[],
  pool: readonly number[],
  [min, max]: readonly [number, number],
  size: number,
): void {
  const count = rng.int(min, max);
  const seen: number[] = new Array(size).fill(0);
  for (const v of cells) if (v >= 0) seen[v]! += 1;
  for (let i = 0; i < count; i++) {
    const free = pool.filter((p) => cells[p] === EMPTY);
    if (free.length === 0) return;
    const least = Math.min(...free.map((p) => seen[sol[p]!]!));
    const pick = rng.pick(free.filter((p) => seen[sol[p]!] === least));
    cells[pick] = sol[pick]!;
    seen[sol[pick]!]! += 1;
  }
}

/** Hàng và cột (không gồm ô ?) của ô ?. */
function lines(shape: GridShape, target: number): { row: number[]; col: number[] } {
  const [row = [], col = []] = unitsOfCell(shape, target);
  return { row: row.filter((p) => p !== target), col: col.filter((p) => p !== target) };
}

/** Mầm: hàng (hoặc cột) của ô ? đã có đủ các hình kia; đường còn lại để trống. */
function buildLine(rng: Rng, shape: GridShape, level: LatinCellLevel): Built {
  const sol = randomSolution(shape, rng);
  const target = rng.int(0, sol.length - 1);
  const { row, col } = lines(shape, target);
  const full = rng.int(0, 1) === 0 ? row : col;
  const cells: number[] = new Array(sol.length).fill(EMPTY);
  for (const p of full) cells[p] = sol[p]!;
  addBalancedExtras(rng, cells, sol, farCells(shape, target), level.extras, shape.size);
  return { cells, target, answer: sol[target]!, via: [] };
}

/**
 * Thường: hàng và cột của ô ? mỗi bên có ≤ 2 hình (không bên nào tự đủ), gộp lại đủ 3 hình kia.
 * Kiểu 0: hàng 2 + cột 1; kiểu 1: hàng 1 + cột 2; kiểu 2: hàng 2 + cột 2 (trùng một hình).
 */
function buildRowCol(rng: Rng, shape: GridShape, level: LatinCellLevel): Built {
  const sol = randomSolution(shape, rng);
  const target = rng.int(0, sol.length - 1);
  const { row, col } = lines(shape, target);
  const kind = rng.int(0, 2);
  const [twoSide, otherSide] = kind === 1 ? [col, row] : [row, col];
  const two = rng.shuffle(twoSide).slice(0, 2);
  const shown = new Set(two.map((p) => sol[p]));
  const others = rng.shuffle(otherSide);
  // Ô ở phía kia mang hình còn thiếu (luôn có: mỗi hàng/cột có đủ mọi hình).
  const missing = others.find((p) => !shown.has(sol[p]))!;
  const given = [...two, missing];
  if (kind === 2) given.push(others.find((p) => shown.has(sol[p]))!);

  const cells: number[] = new Array(sol.length).fill(EMPTY);
  for (const p of given) cells[p] = sol[p]!;
  addBalancedExtras(rng, cells, sol, farCells(shape, target), level.extras, shape.size);
  return { cells, target, answer: sol[target]!, via: [] };
}

/** Chọn một chỉ số theo trọng số nguyên dương (chỉ dùng `rng.int`, không dùng số thực). */
function pickWeighted(rng: Rng, weights: readonly number[]): number {
  let r = rng.int(0, weights.reduce((a, b) => a + b, 0) - 1);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!;
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/**
 * Khó, Siêu khó: một lần thử với lưới đầy đủ `sol`. Chọn ô ?, `k` hình mồi (khác đáp án) và với
 * mỗi hình mồi một ô trung gian là ô cùng nhóm với ô ? mang hình đó. Bắt đầu từ lưới gần đầy
 * (chỉ trống ô ? và các ô quanh nó mang hình mồi), rồi đào dần từng ô theo thứ tự ngẫu nhiên
 * (ô mang hình đáp án có trọng số `answerDigWeight`/10). Chỉ giữ một lần đào nếu ô ? vẫn còn
 * đúng các ứng viên {đáp án, các hình mồi} và mỗi ô trung gian vẫn chốt được ngay. Dừng ở lúc
 * đầu tiên đủ số ô trống tối thiểu mà bộ giải xác nhận câu cần **đúng** `k + 1` bước. Đào thêm
 * chỉ làm mất thông tin nên không bao giờ tạo ra lối tắt mới; còn các điều kiện trên bảo đảm
 * k + 1 bước là đủ. Trả `null` nếu tới số ô trống tối đa vẫn chưa đạt.
 */
function tryVia(
  rng: Rng,
  shape: GridShape,
  sol: readonly number[],
  level: LatinCellLevel,
): Built | null {
  const k = level.intermediates;
  const target = rng.int(0, sol.length - 1);
  const answer = sol[target]!;
  const peers = peersOfCell(shape, target);
  const decoys = rng.shuffle(range(shape.size).filter((v) => v !== answer)).slice(0, k);
  const via: LatinCellVia[] = decoys.map((d) => ({
    cell: rng.pick(peers.filter((p) => sol[p] === d)),
    shape: d,
  }));

  const cells = sol.slice();
  cells[target] = EMPTY;
  for (const p of peers) if (decoys.includes(sol[p]!)) cells[p] = EMPTY;
  const want = decoys.reduce((m, d) => m | (1 << d), 1 << answer);
  const holds = () =>
    candidateMask(shape, cells, target) === want &&
    via.every((v) => forcedValue(shape, cells, v.cell) === v.shape);
  // Các điều kiện trên đã cho một lời giải k + 1 bước; câu đạt khi bộ giải không tìm được lời
  // giải nào trong ≤ k bước.
  const done = () => stepsToForce(shape, cells, target, k) === Number.POSITIVE_INFINITY;
  if (!holds()) return null;

  const [minEmpty, maxEmpty] = level.empty;
  let empty = cells.filter((v) => v === EMPTY).length;
  const untried = range(sol.length).filter((c) => cells[c] !== EMPTY);
  // Chỉ kiểm lại `done()` khi lưới vừa đổi (lần đào được giữ).
  let ok = empty >= minEmpty && done();
  while (!ok) {
    if (empty >= maxEmpty || untried.length === 0) return null;
    const at = pickWeighted(
      rng,
      untried.map((c) => (sol[c] === answer ? level.answerDigWeight : 10)),
    );
    const cell = untried[at]!;
    untried.splice(at, 1);
    cells[cell] = EMPTY;
    if (holds()) {
      empty++;
      ok = empty >= minEmpty && done();
    } else cells[cell] = sol[cell]!;
  }
  return { cells, target, answer, via };
}

/**
 * Thử đào tối đa `LATIN_CELL_MAX_ATTEMPTS` lần (đổi lưới đầy đủ sau mỗi `REGRID_EVERY` lần
 * hỏng). Hết lượt thì dùng câu dự phòng của mức, biến đổi đối xứng bằng chính `rng`, nên vẫn tất
 * định và vẫn đúng mọi bảo đảm của mức. Đo trên 10 000 seed: Khó trung bình ~4,5 lần thử (tối
 * đa < 50), Siêu khó ~7 lần (tối đa < 60), chưa seed nào phải dùng câu dự phòng.
 */
function buildVia(
  rng: Rng,
  shape: GridShape,
  level: LatinCellLevel,
  difficulty: Difficulty,
): Built {
  let sol = randomSolution(shape, rng);
  for (let attempt = 1; attempt <= LATIN_CELL_MAX_ATTEMPTS; attempt++) {
    const built = tryVia(rng, shape, sol, level);
    if (built) return built;
    if (attempt % REGRID_EVERY === 0) sol = randomSolution(shape, rng);
  }
  return latinCellFallback(rng, difficulty);
}

/** Câu dự phòng của mức Khó / Siêu khó, biến đổi đối xứng theo `rng`. Export để test kiểm. */
export function latinCellFallback(rng: Rng, difficulty: Difficulty): Built {
  const level = LATIN_CELL_LEVELS[difficulty];
  const template = LATIN_CELL_FALLBACKS[difficulty];
  if (!template) throw new Error(`latin-cell: mức ${difficulty} không có câu dự phòng`);
  return fromTemplate(rng, { size: level.size, block: level.block }, template);
}

/** Hàng, cột (và khối nếu có) chứa `cell`, mỗi nhóm là danh sách chỉ số ô, để FE tô vùng. */
export function latinCellUnits(
  puzzle: Pick<LatinCellPuzzle, "size" | "block">,
  cell: number,
): readonly (readonly number[])[] {
  return unitsOfCell(puzzle, cell);
}

/** Các ô cùng hàng, cột hoặc khối với `cell` (không gồm chính nó). */
export function latinCellPeers(
  puzzle: Pick<LatinCellPuzzle, "size" | "block">,
  cell: number,
): readonly number[] {
  return peersOfCell(puzzle, cell);
}

export const latinCell: MinigameDef<LatinCellPuzzle, LatinCellAnswer> = {
  id: "latin-cell",
  category: "analyze",
  durationMs: 60_000,
  // Bảng Cân bằng của đặc tả (mô phỏng 200 000 vòng mỗi mức): Mầm tính ra 1,04, chặn trần 1;
  // Khó 1,92 → 1,9; Siêu khó 3,10 → 3,1.
  difficultyMultiplier: { 0: 1, 1: 1, 2: 1.9, 3: 3.1 },
  // Không khai báo `speedAllowanceMs`: lưới hiện đủ ngay, chạm được từ khung hình đầu.

  generate(roundSeed, index, difficulty) {
    const level = LATIN_CELL_LEVELS[difficulty];
    const rng = createRng(deriveSeed(roundSeed, index));
    const shape: GridShape = { size: level.size, block: level.block };
    const built =
      level.reasoning === "line"
        ? buildLine(rng, shape, level)
        : level.reasoning === "rowCol"
          ? buildRowCol(rng, shape, level)
          : buildVia(rng, shape, level, difficulty);
    return {
      size: level.size,
      block: level.block ? { ...level.block } : null,
      cells: built.cells,
      target: built.target,
      via: built.via.map((v) => ({ ...v })),
      answer: built.answer,
    };
  },

  check(puzzle, answer) {
    return answer === puzzle.answer;
  },

  isAnswer(value): value is LatinCellAnswer {
    return (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value < LATIN_CELL_MAX_SHAPES
    );
  },
};
