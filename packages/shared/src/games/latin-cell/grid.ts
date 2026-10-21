import type { Rng } from "../../rng";

/**
 * Lưới hình vuông Latin nhỏ cho Ô bí ẩn: nhóm (hàng, cột, khối), ứng viên, bộ giải suy luận
 * từng ô và tìm cách điền kín. Lưới là mảng theo hàng (`hàng × size + cột`), mỗi ô là mã hình
 * 0..size-1 hoặc `EMPTY`. Hàm thuần; thứ ngẫu nhiên duy nhất là `Rng` truyền vào `randomSolution`.
 */

export const EMPTY = -1;

export interface GridBlock {
  /** Số hàng của một khối. */
  rows: number;
  /** Số cột của một khối. */
  cols: number;
}

export interface GridShape {
  size: number;
  /** Khối con (luật kiểu Sudoku) hoặc `null` nếu chỉ có luật hàng/cột. */
  block: GridBlock | null;
}

interface Layout {
  /** Theo ô: các nhóm chứa ô, theo thứ tự hàng, cột, khối (nếu có). */
  unitsOf: number[][][];
  /** Theo ô: các ô cùng nhóm, không trùng, không gồm chính ô đó, tăng dần. */
  peers: number[][];
}

const layouts = new Map<string, Layout>();

function layoutOf(shape: GridShape): Layout {
  const key = `${shape.size}:${shape.block ? `${shape.block.rows}x${shape.block.cols}` : "-"}`;
  let layout = layouts.get(key);
  if (!layout) {
    layout = buildLayout(shape);
    layouts.set(key, layout);
  }
  return layout;
}

function buildLayout({ size, block }: GridShape): Layout {
  const units: number[][] = [];
  for (let r = 0; r < size; r++) units.push(Array.from({ length: size }, (_, c) => r * size + c));
  for (let c = 0; c < size; c++) units.push(Array.from({ length: size }, (_, r) => r * size + c));
  if (block) {
    for (let br = 0; br < size; br += block.rows) {
      for (let bc = 0; bc < size; bc += block.cols) {
        const cells: number[] = [];
        for (let r = br; r < br + block.rows; r++) {
          for (let c = bc; c < bc + block.cols; c++) cells.push(r * size + c);
        }
        units.push(cells);
      }
    }
  }
  const unitsOf: number[][][] = [];
  const peers: number[][] = [];
  for (let cell = 0; cell < size * size; cell++) {
    const own = units.filter((u) => u.includes(cell));
    unitsOf.push(own);
    const set = new Set<number>();
    for (const u of own) for (const p of u) if (p !== cell) set.add(p);
    peers.push([...set].sort((a, b) => a - b));
  }
  return { unitsOf, peers };
}

/** Các nhóm chứa ô: [hàng, cột] hoặc [hàng, cột, khối]. */
export function unitsOfCell(shape: GridShape, cell: number): readonly (readonly number[])[] {
  return layoutOf(shape).unitsOf[cell] ?? [];
}

/** Các ô cùng hàng, cùng cột hoặc cùng khối với `cell` (không gồm chính nó). */
export function peersOfCell(shape: GridShape, cell: number): readonly number[] {
  return layoutOf(shape).peers[cell] ?? [];
}

/** Số bit 1 của mặt nạ. */
export function bitCount(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}

/** Giá trị duy nhất của mặt nạ có đúng một bit; ngược lại -1. */
export function onlyValue(mask: number): number {
  if (mask === 0 || (mask & (mask - 1)) !== 0) return -1;
  return 31 - Math.clz32(mask);
}

/** Mặt nạ các hình đã có trong những ô `cells` (bỏ ô trống). */
export function seenMask(grid: readonly number[], cells: readonly number[]): number {
  let seen = 0;
  for (const p of cells) {
    const v = grid[p] ?? EMPTY;
    if (v >= 0) seen |= 1 << v;
  }
  return seen;
}

/** Ứng viên của ô: các hình chưa xuất hiện ở hàng, cột, khối của ô. */
export function candidateMask(shape: GridShape, grid: readonly number[], cell: number): number {
  return ((1 << shape.size) - 1) & ~seenMask(grid, peersOfCell(shape, cell));
}

/**
 * Hình của ô trống suy ra được ngay từ lưới bằng một bước (−1 nếu chưa):
 * - ô duy nhất trần: hàng + cột + khối của ô đã có đủ mọi hình trừ một;
 * - ô duy nhất ẩn: trong một nhóm của ô, có hình chỉ còn đặt được vào ô này.
 * Cả hai bước đều đúng với mọi cách điền kín, nên không bao giờ suy ra sai với lưới lấy từ
 * một lời giải thật.
 */
export function forcedValue(shape: GridShape, grid: readonly number[], cell: number): number {
  if (grid[cell] !== EMPTY) return -1;
  const mask = candidateMask(shape, grid, cell);
  const naked = onlyValue(mask);
  if (naked >= 0) return naked;
  for (const unit of unitsOfCell(shape, cell)) {
    let others = seenMask(grid, unit);
    for (const p of unit) {
      if (p !== cell && grid[p] === EMPTY) others |= candidateMask(shape, grid, p);
    }
    const hidden = onlyValue(mask & ~others);
    if (hidden >= 0) return hidden;
  }
  return -1;
}

/**
 * Số ô ít nhất phải suy ra (tính cả ô đích) để chốt được ô đích, mỗi lần một ô bằng
 * `forcedValue` trên lưới đã điền thêm các ô trước đó. Vượt quá `limit` thì trả `Infinity`.
 */
export function stepsToForce(
  shape: GridShape,
  grid: readonly number[],
  target: number,
  limit: number,
): number {
  if (forcedValue(shape, grid, target) >= 0) return 1;
  if (limit <= 1) return Number.POSITIVE_INFINITY;
  const work = grid.slice();
  let best = Number.POSITIVE_INFINITY;
  for (let cell = 0; cell < grid.length && best > 2; cell++) {
    if (cell === target || grid[cell] !== EMPTY) continue;
    const value = forcedValue(shape, grid, cell);
    if (value < 0) continue;
    work[cell] = value;
    best = Math.min(best, 1 + stepsToForce(shape, work, target, Math.min(limit, best - 1) - 1));
    work[cell] = EMPTY;
  }
  return best;
}

/** Không nhóm nào có hai ô cùng hình. */
export function isConsistent(shape: GridShape, grid: readonly number[]): boolean {
  for (let cell = 0; cell < grid.length; cell++) {
    const v = grid[cell] ?? EMPTY;
    if (v === EMPTY) continue;
    if (!Number.isInteger(v) || v < 0 || v >= shape.size) return false;
    for (const p of peersOfCell(shape, cell)) if (grid[p] === v) return false;
  }
  return true;
}

/** Có cách điền kín lưới hợp lệ (quay lui, ô ít ứng viên nhất trước). Lưới phải `isConsistent`. */
export function hasCompletion(shape: GridShape, grid: readonly number[]): boolean {
  const work = grid.slice();
  const solve = (): boolean => {
    let best = -1;
    let bestMask = 0;
    let bestCount = Number.POSITIVE_INFINITY;
    for (let cell = 0; cell < work.length; cell++) {
      if (work[cell] !== EMPTY) continue;
      const mask = candidateMask(shape, work, cell);
      const count = bitCount(mask);
      if (count === 0) return false;
      if (count < bestCount) {
        best = cell;
        bestMask = mask;
        bestCount = count;
      }
    }
    if (best < 0) return true;
    for (let v = 0; v < shape.size; v++) {
      if (!(bestMask & (1 << v))) continue;
      work[best] = v;
      if (solve()) return true;
    }
    work[best] = EMPTY;
    return false;
  };
  return solve();
}

/**
 * Lưới đầy đủ ngẫu nhiên hợp lệ: điền từng ô theo hàng, thử các hình theo thứ tự `rng.shuffle`,
 * hết đường thì quay lui. Lưới tối đa 6 × 6 nên luôn xong rất nhanh.
 */
export function randomSolution(shape: GridShape, rng: Rng): number[] {
  const grid: number[] = new Array(shape.size * shape.size).fill(EMPTY);
  const values = Array.from({ length: shape.size }, (_, v) => v);
  const fill = (cell: number): boolean => {
    if (cell === grid.length) return true;
    const mask = candidateMask(shape, grid, cell);
    for (const v of rng.shuffle(values)) {
      if (!(mask & (1 << v))) continue;
      grid[cell] = v;
      if (fill(cell + 1)) return true;
    }
    grid[cell] = EMPTY;
    return false;
  };
  fill(0);
  return grid;
}
