import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed } from "../../rng";
import {
  boundingBox,
  type Cell,
  type Cells,
  isConnected,
  mirror,
  normalize,
  rotateCW,
  shapeKey,
} from "../rotate-match/shapes";
import type { MinigameDef } from "../types";

/**
 * Mảnh vừa khít (nhóm Hình dung): hộp lưới đã xếp kín, chỉ còn một khoảng trống. Người chơi chạm
 * vào thẻ duy nhất có mảnh lấp vừa khít khoảng trống đó. Mảnh được XOAY, không được LẬT: bản lật
 * gương là thẻ nhiễu. Đặc tả: docs/04-minigames/piece-fit.md.
 *
 * Hàm hình học (chuẩn hoá, xoay, lật, liền khối) dùng lại của Xoay hình (`rotate-match/shapes.ts`):
 * toạ độ x sang phải, y xuống dưới; "xoay" là xoay 90° theo chiều kim đồng hồ trên màn hình.
 * Mọi thứ ngẫu nhiên đi qua `rng`, không có vòng thử lại. Kho mảnh liệt kê tất định, sắp theo khoá
 * chuỗi, nên mọi máy (trình duyệt, Node) có cùng thứ tự. Đổi kho là đổi câu đố của mọi seed.
 */

/** Một ô `[x, y]`, số nguyên ≥ 0, đơn vị là ô. x tăng sang phải, y tăng xuống dưới. */
export type PieceFitCell = readonly [x: number, y: number];

/**
 * Thẻ là gì so với khoảng trống (FE dùng để chọn phản hồi khi sai; không được hiện trước khi chạm):
 * - `"fit"`: đáp án, chính khoảng trống (Mầm: cùng hướng; từ Thường: đã xoay đi).
 * - `"mirror"`: bản lật gương của khoảng trống (Khó, Siêu khó). Xoay thế nào cũng không khớp.
 * - `"near"`: cùng số ô, khoảng trống bị dời đúng một ô (Siêu khó).
 * - `"size"`: khoảng trống thêm một ô, giữ đúng hướng (Mầm).
 * - `"other"`: hình khác cùng số ô (Mầm: mảnh 3 ô còn lại; Thường: mảnh 4 ô khác; Khó: một
 *   pentomino khác chữ và bản lật gương của nó; Siêu khó: bản lật gương của mảnh `"near"`).
 */
export type PieceFitKind = "fit" | "mirror" | "near" | "size" | "other";

export interface PieceFitPiece {
  /** Các ô của mảnh đúng như vẽ trên thẻ (không xoay thêm). Đã chuẩn hoá: x, y nhỏ nhất bằng 0; sắp theo (y, x). */
  cells: readonly PieceFitCell[];
  kind: PieceFitKind;
}

export interface PieceFitPuzzle {
  /** Kích thước hộp (ô). Hộp vuông: 4 / 5 / 5 / 6 theo mức. */
  box: { cols: number; rows: number };
  /**
   * Các ô trống của hộp, toạ độ tuyệt đối trong hộp (0 ≤ x < cols, 0 ≤ y < rows), sắp theo (y, x).
   * Liền cạnh, 3 / 4 / 5 / 5–6 ô theo mức. Mọi ô khác của hộp là ô đã xếp kín.
   */
  gap: readonly PieceFitCell[];
  /** 3 thẻ (Mầm) hoặc 4, theo thứ tự ô trên màn hình: trái → phải, trên → dưới. */
  options: PieceFitPiece[];
  /** Chỉ số thẻ đúng trong `options` (thẻ duy nhất có `kind = "fit"`). */
  answerIndex: number;
  /**
   * Số lần xoay 90° theo chiều kim đồng hồ đưa mảnh trên thẻ đúng về đúng hướng khoảng trống:
   * Mầm 0; Thường 1 hoặc 2; Khó, Siêu khó 1–3 (3 = xoay 90° ngược chiều). FE dùng để chạy hiệu
   * ứng "xoay rồi lắp vào" khi hiện đáp án.
   */
  answerTurns: number;
}

/** Đáp án = chỉ số thẻ người chơi chạm (số nguyên 0–3). */
export type PieceFitAnswer = number;

/** Số thẻ tối đa (từ Thường). Mầm có 3. */
export const PIECE_FIT_MAX_OPTIONS = 4;

/** Cạnh hộp (ô) ở mỗi mức. */
export const PIECE_FIT_BOX_SIZE: Readonly<Record<Difficulty, number>> = { 0: 4, 1: 5, 2: 5, 3: 6 };

/**
 * Cạnh khung bao lớn nhất (ô) của mọi mảnh trên thẻ và của khoảng trống ở mỗi mức. FE chọn một
 * cỡ ô chung cho hộp và thẻ từ số này (đặc tả, Ghi chú cho FE).
 */
export const PIECE_FIT_MAX_PIECE_SIDE: Readonly<Record<Difficulty, number>> = {
  0: 3,
  1: 4,
  2: 4,
  3: 4,
};

/** Tập `answerTurns` có thể có ở mỗi mức (trước khi bỏ hướng trông y hệt khoảng trống). */
export const PIECE_FIT_ANSWER_TURNS: Readonly<Record<Difficulty, readonly number[]>> = {
  0: [0],
  1: [1, 2],
  2: [1, 2, 3],
  3: [1, 2, 3],
};

/** Số ô của khoảng trống ở Mầm, Thường, Khó. Siêu khó bốc 5 hoặc 6. */
const GAP_CELLS: Readonly<Record<Exclude<Difficulty, 3>, number>> = { 0: 3, 1: 4, 2: 5 };

const DIRS: readonly Cell[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const cellId = ([x, y]: Cell): string => `${x},${y}`;

/** So sánh chuỗi theo mã ký tự, không phụ thuộc ngôn ngữ máy (không dùng `localeCompare`). */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function maxSide(cells: Cells): number {
  const { width, height } = boundingBox(cells);
  return Math.max(width, height);
}

/**
 * Bản đại diện của mảnh "một mặt" (chỉ gộp 4 phép xoay, không gộp lật): phép xoay có khoá nhỏ
 * nhất. Hai mảnh khớp nhau sau khi xoay khi và chỉ khi cùng khoá.
 */
function oneSided(cells: Cells): { key: string; cells: Cell[] } {
  let best: { key: string; cells: Cell[] } | undefined;
  for (let r = 0; r < 4; r++) {
    const c = rotateCW(cells, r);
    const key = shapeKey(c);
    if (best === undefined || compareStrings(key, best.key) < 0) best = { key, cells: c };
  }
  return best!;
}

/** Một mảnh một mặt trong kho. */
interface Piece {
  /** Khoá một mặt. */
  key: string;
  /** Bản đại diện, đã chuẩn hoá. */
  cells: readonly Cell[];
  /** Khoá một mặt của bản lật gương; bằng `key` khi mảnh đối xứng gương. */
  mirrorKey: string;
  /** Khoá loại (gộp cả xoay lẫn lật): khoá nhỏ hơn trong `key`, `mirrorKey`. */
  freeKey: string;
  /** Có tay thuận: bản lật gương không trùng phép xoay nào. */
  chiral: boolean;
}

function makePiece(cells: Cells): Piece {
  const own = oneSided(cells);
  const mirrorKey = oneSided(mirror(cells)).key;
  return {
    key: own.key,
    cells: own.cells,
    mirrorKey,
    freeKey: compareStrings(own.key, mirrorKey) <= 0 ? own.key : mirrorKey,
    chiral: own.key !== mirrorKey,
  };
}

/** Polyomino cố định (không gộp xoay/lật) theo số ô, đã chuẩn hoá. Ghi nhớ giữa các lần gọi. */
const fixedBySize: Cell[][][] = [[], [[[0, 0]]]];

function fixedPolyominoes(size: number): Cell[][] {
  for (let n = fixedBySize.length; n <= size; n++) {
    const next = new Map<string, Cell[]>();
    for (const shape of fixedBySize[n - 1]!) {
      const occupied = new Set(shape.map(cellId));
      for (const [x, y] of shape) {
        for (const [dx, dy] of DIRS) {
          const c: Cell = [x + dx, y + dy];
          if (occupied.has(cellId(c))) continue;
          const grown = normalize([...shape, c]);
          const key = shapeKey(grown);
          if (!next.has(key)) next.set(key, grown);
        }
      }
    }
    fixedBySize.push([...next.values()]);
  }
  return fixedBySize[size]!;
}

const piecesBySize = new Map<number, readonly Piece[]>();

/** Mọi mảnh một mặt `size` ô, sắp theo khoá. 3 ô: 2 · 4 ô: 7 · 5 ô: 18 · 6 ô: 60. */
function pieces(size: number): readonly Piece[] {
  let list = piecesBySize.get(size);
  if (list === undefined) {
    const byKey = new Map<string, Piece>();
    for (const cells of fixedPolyominoes(size)) {
      const p = makePiece(cells);
      if (!byKey.has(p.key)) byKey.set(p.key, p);
    }
    list = [...byKey.values()].sort((a, b) => compareStrings(a.key, b.key));
    piecesBySize.set(size, list);
  }
  return list;
}

/**
 * Gom kết quả theo khoá một mặt, giữ bản gặp đầu tiên (thứ tự duyệt cố định), rồi sắp theo khoá.
 * Ô giữ nguyên hệ toạ độ của mảnh gốc (chỉ chuẩn hoá), để Mầm vẽ được "khoảng trống thêm một ô"
 * cùng hướng với khoảng trống.
 */
function collect(shapes: Iterable<Cell[]>, keep: (cells: Cell[]) => boolean): Cell[][] {
  const byKey = new Map<string, Cell[]>();
  for (const s of shapes) {
    const cells = normalize(s);
    if (!keep(cells)) continue;
    const key = oneSided(cells).key;
    if (!byKey.has(key)) byKey.set(key, cells);
  }
  return [...byKey.entries()].sort((a, b) => compareStrings(a[0], b[0])).map(([, cells]) => cells);
}

/** Thêm một ô kề cạnh. */
function* grownShapes(cells: Cells): Generator<Cell[]> {
  const occupied = new Set(cells.map(cellId));
  for (const [x, y] of cells) {
    for (const [dx, dy] of DIRS) {
      const e: Cell = [x + dx, y + dy];
      if (!occupied.has(cellId(e))) yield [...cells, e];
    }
  }
}

/** Dời đúng một ô: bỏ một ô mà phần còn lại vẫn liền, đặt vào một ô trống kề cạnh khác chỗ cũ. */
function* movedShapes(cells: Cells): Generator<Cell[]> {
  for (let i = 0; i < cells.length; i++) {
    const removed = cellId(cells[i]!);
    const rest = cells.filter((_, j) => j !== i);
    if (!isConnected(rest)) continue;
    for (const grown of grownShapes(rest)) {
      if (cellId(grown[grown.length - 1]!) !== removed) yield grown;
    }
  }
}

/** Một mảnh có thể làm khoảng trống ở một mức, kèm các mảnh nhiễu dựng sẵn từ nó. */
interface GapEntry {
  piece: Piece;
  /** Siêu khó: mảnh "lệch 1 ô", cùng số ô, khác loại (kể cả lật), có tay thuận. */
  near: readonly Cells[];
  /** Mầm: mảnh thừa một ô. */
  grow: readonly Cells[];
  /**
   * Khó: một đại diện cho mỗi loại pentomino khác (gộp cả lật) có tay thuận, để làm cặp gương
   * thứ hai. Bốc độc lập với cách xếp ô của khoảng trống, không dựng bằng cách dời một ô.
   */
  pair: readonly Cells[];
}

function buildGapPool(difficulty: Difficulty, size: number): GapEntry[] {
  const side = PIECE_FIT_MAX_PIECE_SIDE[difficulty];
  const fits = (cells: Cells) => maxSide(cells) <= side;
  const out: GapEntry[] = [];
  for (const p of pieces(size)) {
    const { cells } = p;
    if (!fits(cells)) continue;
    // Từ Thường đáp án phải xoay mới khớp: bỏ mảnh xoay 90° vẫn y hệt (hình vuông 2×2). Mảnh
    // có tay thuận 5–6 ô không có đối xứng xoay 90° nên Khó, Siêu khó không mất mảnh nào ở bước này.
    if (difficulty >= 1 && shapeKey(rotateCW(cells, 1)) === shapeKey(cells)) continue;
    // Khó, Siêu khó luôn có thẻ bản lật gương: chỉ lấy mảnh có tay thuận (lật không trùng phép
    // xoay nào), nếu không bản lật gương cũng là một đáp án đúng.
    if (difficulty >= 2 && !p.chiral) continue;

    const near =
      difficulty === 3
        ? collect(movedShapes(cells), (c) => {
            if (!fits(c)) return false;
            const q = makePiece(c);
            return q.freeKey !== p.freeKey && q.chiral;
          })
        : [];
    const grow = difficulty === 0 ? collect(grownShapes(cells), fits) : [];
    const pair =
      difficulty === 2
        ? pieces(size)
            .filter((q) => q.chiral && q.key === q.freeKey && q.freeKey !== p.freeKey)
            .filter((q) => fits(q.cells))
            .map((q) => q.cells)
        : [];

    if (difficulty === 3 && near.length === 0) continue;
    if (difficulty === 0 && grow.length === 0) continue;
    if (difficulty === 2 && pair.length === 0) continue;
    out.push({ piece: p, near, grow, pair });
  }
  return out;
}

const gapPoolCache = new Map<string, readonly GapEntry[]>();

/** Kho khoảng trống của một mức và số ô, tính lười ở lần gọi đầu rồi ghi nhớ. */
function gapPool(difficulty: Difficulty, size: number): readonly GapEntry[] {
  const id = `${difficulty}:${size}`;
  let pool = gapPoolCache.get(id);
  if (pool === undefined) {
    pool = buildGapPool(difficulty, size);
    gapPoolCache.set(id, pool);
  }
  return pool;
}

function card(cells: Cells, kind: PieceFitKind): PieceFitPiece {
  // `rotateCW` luôn trả mảng và ô mới, nên câu đố không dùng chung mảng với kho đã ghi nhớ.
  return { cells: rotateCW(cells, 0), kind };
}

export const pieceFit: MinigameDef<PieceFitPuzzle, PieceFitAnswer> = {
  id: "piece-fit",
  category: "visualize",
  // CR-006: vòng 60 giây cho game mới, để Siêu khó vẫn còn ≥ 8 câu mỗi vòng.
  durationMs: 60_000,
  // CR-006: mô phỏng từ bảng Cân bằng của đặc tả (người chơi đúng sức ở mỗi mức ≈ người lớn ở
  // Thường). Mầm = min(1,13 mô phỏng cho trẻ 7 tuổi, 1). Chốt lại sau buổi chơi thử.
  difficultyMultiplier: { 0: 1, 1: 1, 2: 2, 3: 3.2 },
  // Không khai báo `speedAllowanceMs`: không có pha trình chiếu, một chạm là xong (đặc tả).

  generate(roundSeed, index, difficulty) {
    const rng = createRng(deriveSeed(roundSeed, index));
    const size = difficulty === 3 ? rng.int(5, 6) : GAP_CELLS[difficulty];
    const side = PIECE_FIT_BOX_SIZE[difficulty];

    // 1. Khoảng trống: mảnh, hướng, vị trí trong hộp.
    const entry = rng.pick(gapPool(difficulty, size));
    const gapTurns = rng.int(0, 3);
    const gapShape = rotateCW(entry.piece.cells, gapTurns);
    const { width, height } = boundingBox(gapShape);
    const ox = rng.int(0, side - width);
    const oy = rng.int(0, side - height);
    const gap = gapShape.map(([x, y]): PieceFitCell => [x + ox, y + oy]);

    // 2. Đáp án: khoảng trống xoay ngược `answerTurns` lần; từ Thường bỏ hướng trông y hệt khoảng trống.
    const ownKey = shapeKey(gapShape);
    const turns = PIECE_FIT_ANSWER_TURNS[difficulty].filter(
      (t) => difficulty === 0 || shapeKey(rotateCW(gapShape, 4 - t)) !== ownKey,
    );
    const answerTurns = rng.pick(turns);
    const list: PieceFitPiece[] = [card(rotateCW(gapShape, (4 - answerTurns) % 4), "fit")];

    // 3. Thẻ nhiễu.
    if (difficulty === 0) {
      // Mảnh 3 ô còn lại (hướng bất kỳ) + khoảng trống thêm một ô, cùng hướng khoảng trống.
      for (const p of pieces(3)) {
        if (p.key !== entry.piece.key) list.push(card(rotateCW(p.cells, rng.int(0, 3)), "other"));
      }
      list.push(card(rotateCW(rng.pick(entry.grow), gapTurns), "size"));
    } else if (difficulty === 1) {
      // 3 mảnh 4 ô khác, không lấy bản lật gương của khoảng trống, không lấy cặp gương của nhau.
      const own = entry.piece;
      const taken = new Set<string>([own.key, own.mirrorKey]);
      for (const p of rng.shuffle(pieces(4))) {
        if (list.length === 4) break;
        if (taken.has(p.key)) continue;
        taken.add(p.key);
        taken.add(p.mirrorKey);
        list.push(card(rotateCW(p.cells, rng.int(0, 3)), "other"));
      }
    } else {
      // Luôn hai cặp gương: (đáp án, bản lật gương) và (W, gương của W), nên tìm cặp gương không
      // loại được thẻ nào. Khó: W là pentomino khác chữ, tay ngẫu nhiên. Siêu khó: W là mảnh lệch 1 ô.
      list.push(card(rotateCW(mirror(gapShape), rng.int(0, 3)), "mirror"));
      if (difficulty === 2) {
        const base = rng.pick(entry.pair);
        const w = rng.int(0, 1) === 1 ? mirror(base) : base;
        list.push(card(rotateCW(w, rng.int(0, 3)), "other"));
        list.push(card(rotateCW(mirror(w), rng.int(0, 3)), "other"));
      } else {
        const near = rng.pick(entry.near);
        list.push(card(rotateCW(near, rng.int(0, 3)), "near"));
        list.push(card(rotateCW(mirror(near), rng.int(0, 3)), "other"));
      }
    }

    // 4. Xáo vị trí; phần tử 0 của `list` là đáp án.
    const order = rng.shuffle(list.map((_, i) => i));
    return {
      box: { cols: side, rows: side },
      gap,
      options: order.map((i) => list[i]!),
      answerIndex: order.indexOf(0),
      answerTurns,
    };
  },

  check(puzzle, answer) {
    return answer === puzzle.answerIndex;
  },

  isAnswer(value): value is PieceFitAnswer {
    return (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value < PIECE_FIT_MAX_OPTIONS
    );
  },
};
