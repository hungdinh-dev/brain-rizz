/**
 * Kho hình chiếu của Nhìn từ trên: các tập ô (mặt nạ bit) trên bệ n × n. Đặc tả:
 * docs/04-minigames/top-view.md, mục "Kho hình chiếu".
 *
 * File nội bộ của game: `games/index.ts` chỉ export `top-view.ts`, test import thẳng file này.
 * Không có gì ngẫu nhiên ở đây: kho được liệt kê theo mặt nạ tăng dần, nên mọi máy có cùng thứ tự.
 * Đổi kho là đổi câu đố của mọi seed.
 *
 * Ô (c, r) ứng với bit r·n + c; r = 0 là hàng xa nhất, r = n − 1 là hàng sát mép trước.
 */

export type Grid = number[][];

/**
 * 8 phép biến đổi của bệ vuông, chỉ số = (lật ? 4 : 0) + số lần xoay 90° theo chiều kim đồng hồ
 * (nhìn từ trên, mép trước ở dưới). "Lật" là lật gương trái–phải (c → n − 1 − c), làm trước khi xoay.
 * Trả về ô mới của ô (c, r).
 */
export function transformCell(n: number, t: number, c: number, r: number): [c: number, r: number] {
  let x = c;
  let y = r;
  if (t >= 4) x = n - 1 - x;
  for (let i = 0; i < t % 4; i++) {
    const nx = n - 1 - y;
    y = x;
    x = nx;
  }
  return [x, y];
}

export const MIRROR = 4;
export const ROTATE_CW = 1;
export const ROTATE_CCW = 3;

export function transformMask(mask: number, n: number, t: number): number {
  let out = 0;
  for (let i = 0; i < n * n; i++) {
    if (!((mask >> i) & 1)) continue;
    const [c, r] = transformCell(n, t, i % n, Math.floor(i / n));
    out |= 1 << (r * n + c);
  }
  return out;
}

export function transformGrid(grid: Grid, t: number): Grid {
  const n = grid.length;
  const out: Grid = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const [nc, nr] = transformCell(n, t, c, r);
      out[nr]![nc] = grid[r]![c]!;
    }
  }
  return out;
}

export function popcount(mask: number): number {
  let k = 0;
  for (let m = mask; m; m &= m - 1) k++;
  return k;
}

/** Các ô của mặt nạ có liền cạnh với nhau không. */
export function isConnected(mask: number, n: number): boolean {
  if (mask === 0) return false;
  const start = 31 - Math.clz32(mask & -mask);
  let seen = 1 << start;
  const stack = [start];
  while (stack.length > 0) {
    const i = stack.pop()!;
    const c = i % n;
    const r = Math.floor(i / n);
    const next = [
      c > 0 ? i - 1 : -1,
      c < n - 1 ? i + 1 : -1,
      r > 0 ? i - n : -1,
      r < n - 1 ? i + n : -1,
    ];
    for (const j of next) {
      if (j >= 0 && (mask >> j) & 1 && !((seen >> j) & 1)) {
        seen |= 1 << j;
        stack.push(j);
      }
    }
  }
  return seen === mask;
}

/** 8 phép biến đổi cho 8 mặt nạ khác nhau (hình chiếu không có trục hay tâm đối xứng nào của bệ). */
export function isAsymmetric(mask: number, n: number): boolean {
  for (let t = 1; t < 8; t++) if (transformMask(mask, n, t) === mask) return false;
  return true;
}

/** Hai ô liền cạnh (chỉ số bit), mỗi cặp một lần, theo chỉ số tăng dần. */
export function edgePairs(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n * n; i++) {
    if (i % n < n - 1) out.push([i, i + 1]);
    if (i + n < n * n) out.push([i, i + n]);
  }
  return out;
}

// ---------------------------------------------------------------- Mầm: 4 ô trên bệ 3 × 3

export type TetrominoClass = "L" | "T" | "S";
export const TETROMINO_CLASSES: readonly TetrominoClass[] = ["L", "T", "S"];

/** Khoá loại hình (bất kể vị trí, xoay, lật) của một tập ô trên bệ n × n. */
function freeKey(mask: number, n: number): string {
  let best = "";
  for (let t = 0; t < 8; t++) {
    const cells: [number, number][] = [];
    for (let i = 0; i < n * n; i++) {
      if ((mask >> i) & 1) cells.push(transformCell(n, t, i % n, Math.floor(i / n)));
    }
    const mx = Math.min(...cells.map(([c]) => c));
    const my = Math.min(...cells.map(([, r]) => r));
    const key = cells
      .map(([c, r]) => (r - my) * 8 + (c - mx))
      .sort((a, b) => a - b)
      .join(",");
    if (best === "" || key < best) best = key;
  }
  return best;
}

const TETROMINO_REFERENCE: Record<TetrominoClass, number> = {
  // Toạ độ trên bệ 3 × 3, bit r·3 + c.
  L: (1 << 0) | (1 << 3) | (1 << 6) | (1 << 7),
  T: (1 << 0) | (1 << 1) | (1 << 2) | (1 << 4),
  S: (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4),
};

let tetrominoCache: Record<TetrominoClass, number[]> | undefined;

/** Mọi cách đặt hình 4 ô họ L, T, S trên bệ 3 × 3 (mọi hướng, mọi vị trí), mặt nạ tăng dần. */
export function getTetrominoPlacements(): Record<TetrominoClass, number[]> {
  if (tetrominoCache) return tetrominoCache;
  const keys = Object.fromEntries(
    TETROMINO_CLASSES.map((k) => [freeKey(TETROMINO_REFERENCE[k], 3), k]),
  ) as Record<string, TetrominoClass>;
  const out: Record<TetrominoClass, number[]> = { L: [], T: [], S: [] };
  for (let mask = 0; mask < 1 << 9; mask++) {
    if (popcount(mask) !== 4 || !isConnected(mask, 3)) continue;
    const cls = keys[freeKey(mask, 3)];
    if (cls) out[cls].push(mask);
  }
  tetrominoCache = out;
  return out;
}

// ---------------------------------------------------------------- Thường: 5–6 ô trên bệ 3 × 3

export interface ShiftPattern {
  mask: number;
  /** Các cách dời một ô: [bit bỏ đi, bit thêm vào], theo (bỏ, thêm) tăng dần. */
  moves: [from: number, to: number][];
}

const shiftCache = new Map<number, ShiftPattern[]>();

/**
 * Hình chiếu k ô liền cạnh, không đối xứng, trên bệ 3 × 3, kèm các cách "dời 1 ô": bỏ một ô, đặt
 * vào một ô trống bất kỳ, được hình B vẫn liền cạnh, không đối xứng (để B khác gương của B) và khác
 * bản gương của hình gốc (để bốn lựa chọn khác nhau). Chỉ giữ hình có ít nhất một cách dời.
 */
export function getShiftPool(k: number): ShiftPattern[] {
  const cached = shiftCache.get(k);
  if (cached) return cached;
  const n = 3;
  const out: ShiftPattern[] = [];
  for (let mask = 0; mask < 1 << 9; mask++) {
    if (popcount(mask) !== k || !isConnected(mask, n) || !isAsymmetric(mask, n)) continue;
    const mirrored = transformMask(mask, n, MIRROR);
    const moves: [number, number][] = [];
    for (let from = 0; from < 9; from++) {
      if (!((mask >> from) & 1)) continue;
      for (let to = 0; to < 9; to++) {
        if ((mask >> to) & 1) continue;
        const shifted = (mask & ~(1 << from)) | (1 << to);
        if (isConnected(shifted, n) && isAsymmetric(shifted, n) && shifted !== mirrored) {
          moves.push([from, to]);
        }
      }
    }
    if (moves.length > 0) out.push({ mask, moves });
  }
  shiftCache.set(k, out);
  return out;
}

// ---------------------------------------------------------------- Khó, Siêu khó: bệ 4 × 4

const pool4Cache = new Map<number, number[]>();

/** Hình chiếu k ô liền cạnh, không đối xứng, trên bệ 4 × 4, mặt nạ tăng dần. */
export function getPool4(k: number): number[] {
  const cached = pool4Cache.get(k);
  if (cached) return cached;
  const out: number[] = [];
  for (let mask = 0; mask < 1 << 16; mask++) {
    if (popcount(mask) === k && isConnected(mask, 4) && isAsymmetric(mask, 4)) out.push(mask);
  }
  pool4Cache.set(k, out);
  return out;
}
