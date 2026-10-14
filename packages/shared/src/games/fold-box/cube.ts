/**
 * Hình học cho Gấp hộp: polyomino 6 ô, gấp lưới thành khối lập phương, 24 phép quay của khối.
 * Nội bộ game fold-box, không export ra ngoài package. Toàn số nguyên, không ngẫu nhiên.
 */

/** Vectơ 3D nguyên, mỗi thành phần ∈ {−1, 0, 1}. */
export type Vec3 = readonly [number, number, number];

/** Một ô của lưới: `[x, y]`, x sang phải, y xuống dưới (như toạ độ màn hình). */
export type Cell = readonly [x: number, y: number];
export type Cells = readonly Cell[];

export function neg(v: Vec3): Vec3 {
  return [-v[0], -v[1], -v[2]];
}

export function eq(a: Vec3, b: Vec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/**
 * Khung của một mặt, nhìn từ NGOÀI khối: `n` là pháp tuyến hướng ra ngoài, `ex` là hướng "sang
 * phải", `ey` là hướng "xuống dưới" của mặt đó. Luôn có ex × ey = −n.
 */
export interface Frame {
  n: Vec3;
  ex: Vec3;
  ey: Vec3;
}

/**
 * Hướng "lên" của ký hiệu xoay `rot` phần tư vòng theo chiều kim đồng hồ (nhìn từ ngoài):
 * 0 → −ey, 1 → ex, 2 → ey, 3 → −ex.
 */
export function upOf(f: Frame, rot: number): Vec3 {
  switch (((rot % 4) + 4) % 4) {
    case 0:
      return neg(f.ey);
    case 1:
      return f.ex;
    case 2:
      return f.ey;
    default:
      return neg(f.ex);
  }
}

// ─── 24 phép quay ────────────────────────────────────────────────────────────

/** Ma trận 3×3 nguyên, lưu theo hàng. */
export type Mat3 = readonly [Vec3, Vec3, Vec3];

export function apply(q: Mat3, v: Vec3): Vec3 {
  return [
    q[0][0] * v[0] + q[0][1] * v[1] + q[0][2] * v[2],
    q[1][0] * v[0] + q[1][1] * v[1] + q[1][2] * v[2],
    q[2][0] * v[0] + q[2][1] * v[1] + q[2][2] * v[2],
  ];
}

function det(q: Mat3): number {
  const [a, b, c] = q;
  return (
    a[0] * (b[1] * c[2] - b[2] * c[1]) -
    a[1] * (b[0] * c[2] - b[2] * c[0]) +
    a[2] * (b[0] * c[1] - b[1] * c[0])
  );
}

/** 24 phép quay của khối lập phương: ma trận hoán vị có dấu, định thức +1. Thứ tự cố định. */
export const ROTATIONS: readonly Mat3[] = (() => {
  const perms = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  const out: Mat3[] = [];
  for (const p of perms) {
    for (let s = 0; s < 8; s++) {
      const rows = p.map((col, i) => {
        const row: [number, number, number] = [0, 0, 0];
        row[col] = (s >> i) & 1 ? -1 : 1;
        return row;
      }) as unknown as Mat3;
      if (det(rows) === 1) out.push(rows);
    }
  }
  return out;
})();

/** 6 hướng trục, thứ tự cố định; `axisCode` là chỉ số trong mảng này. */
export const AXES: readonly Vec3[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
  [-1, 0, 0],
  [0, -1, 0],
  [0, 0, -1],
];

export function axisCode(v: Vec3): number {
  return AXES.findIndex((a) => eq(a, v));
}

/** `ROTATED_AXIS[q][c]` = mã trục của `ROTATIONS[q]` áp lên `AXES[c]`. */
export const ROTATED_AXIS: readonly (readonly number[])[] = ROTATIONS.map((q) =>
  AXES.map((a) => axisCode(apply(q, a))),
);

// ─── Gấp lưới ────────────────────────────────────────────────────────────────

/** Khung của ô đầu tiên: lưới nằm phẳng, mặt in hướng về người nhìn (+z); các ô khác gập ra sau. */
const ROOT: Frame = { n: [0, 0, 1], ex: [1, 0, 0], ey: [0, -1, 0] };

/** Gập ô kề theo hướng (dx, dy) trên lưới 90° ra sau quanh cạnh chung. */
function step(f: Frame, dx: number, dy: number): Frame {
  if (dx === 1) return { n: f.ex, ex: neg(f.n), ey: f.ey };
  if (dx === -1) return { n: neg(f.ex), ex: f.n, ey: f.ey };
  if (dy === 1) return { n: f.ey, ex: f.ex, ey: neg(f.n) };
  return { n: neg(f.ey), ex: f.ex, ey: f.n };
}

function sameFrame(a: Frame, b: Frame): boolean {
  return eq(a.n, b.n) && eq(a.ex, b.ex) && eq(a.ey, b.ey);
}

export type FoldResult =
  | { ok: true; frames: Frame[] }
  /** Không gấp được: hai ô `clash` chồng lên cùng một mặt (hoặc mâu thuẫn quanh một vòng ô). */
  | { ok: false; clash: [number, number] };

const DIRS: readonly Cell[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Gấp thật một hình 6 ô: đi loang từ ô 0, mỗi bước gập ô kề 90° quanh cạnh chung. Gấp được khi
 * 6 ô rơi vào 6 mặt khác nhau và mọi cặp ô kề trên lưới đều khớp nhau sau khi gập.
 */
export function fold(cells: Cells): FoldResult {
  const key = cells.map(([x, y]) => `${x},${y}`).join(";");
  let result = foldCache.get(key);
  if (!result) {
    result = foldUncached(cells);
    foldCache.set(key, result);
  }
  return result;
}

/** Kết quả gấp theo đúng thứ tự ô (hữu hạn: 35 hình × 8 tư thế). Không sửa kết quả trả về. */
const foldCache = new Map<string, FoldResult>();

function foldUncached(cells: Cells): FoldResult {
  const index = new Map<string, number>();
  cells.forEach(([x, y], i) => {
    index.set(`${x},${y}`, i);
  });
  const frames: (Frame | undefined)[] = cells.map(() => undefined);
  frames[0] = ROOT;
  const queue = [0];
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!;
    const [x, y] = cells[i]!;
    for (const [dx, dy] of DIRS) {
      const j = index.get(`${x + dx},${y + dy}`);
      if (j === undefined) continue;
      const next = step(frames[i]!, dx, dy);
      const known = frames[j];
      if (known === undefined) {
        frames[j] = next;
        queue.push(j);
      } else if (!sameFrame(known, next)) {
        return { ok: false, clash: [Math.min(i, j), Math.max(i, j)] };
      }
    }
  }
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      if (eq(frames[i]!.n, frames[j]!.n)) return { ok: false, clash: [i, j] };
    }
  }
  return { ok: true, frames: frames as Frame[] };
}

// ─── Polyomino ───────────────────────────────────────────────────────────────

/** Dời về x, y nhỏ nhất bằng 0 và sắp theo (y, x). */
export function normalize(cells: Cells): Cell[] {
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  return cells
    .map(([x, y]): Cell => [x - minX, y - minY])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/** Một trong 8 tư thế: xoay `t % 4` phần tư vòng theo chiều kim đồng hồ, rồi lật trái–phải nếu t ≥ 4. */
export function orient(cells: Cells, t: number): Cell[] {
  let out = cells.map(([x, y]): Cell => [x, y]);
  for (let k = 0; k < t % 4; k++) out = out.map(([x, y]): Cell => [-y, x]);
  if (t >= 4) out = out.map(([x, y]): Cell => [-x, y]);
  return normalize(out);
}

export function shapeKey(cells: Cells): string {
  return normalize(cells)
    .map(([x, y]) => `${x},${y}`)
    .join(";");
}

/** Khoá chung cho mọi tư thế xoay và lật của một hình. */
export function freeKey(cells: Cells): string {
  let best = "";
  for (let t = 0; t < 8; t++) {
    const k = shapeKey(orient(cells, t));
    if (best === "" || k < best) best = k;
  }
  return best;
}

/** Mọi polyomino tự do có `size` ô, mỗi hình một đại diện (tư thế có khoá nhỏ nhất), sắp theo khoá. */
export function freePolyominoes(size: number): Cell[][] {
  let level = new Map<string, Cell[]>([["0,0", [[0, 0]]]]);
  for (let n = 1; n < size; n++) {
    const next = new Map<string, Cell[]>();
    for (const shape of level.values()) {
      const taken = new Set(shape.map(([x, y]) => `${x},${y}`));
      for (const [x, y] of shape) {
        for (const [dx, dy] of DIRS) {
          const k = `${x + dx},${y + dy}`;
          if (taken.has(k)) continue;
          const grown = [...shape, [x + dx, y + dy] as Cell];
          const fk = freeKey(grown);
          if (!next.has(fk))
            next.set(
              fk,
              fk.split(";").map((s) => s.split(",").map(Number) as unknown as Cell),
            );
        }
      }
    }
    level = next;
  }
  return [...level.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, v]) => v);
}

function hasBlock(cells: Cells): boolean {
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  return cells.some(
    ([x, y]) =>
      set.has(`${x + 1},${y}`) && set.has(`${x},${y + 1}`) && set.has(`${x + 1},${y + 1}`),
  );
}

function longestRun(cells: Cells): number {
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  let best = 0;
  for (const [x, y] of cells) {
    let h = 1;
    while (set.has(`${x + h},${y}`)) h++;
    let v = 1;
    while (set.has(`${x},${y + v}`)) v++;
    best = Math.max(best, h, v);
  }
  return best;
}

export function boundingBox(cells: Cells): { w: number; h: number } {
  const n = normalize(cells);
  return {
    w: Math.max(...n.map((c) => c[0])) + 1,
    h: Math.max(...n.map((c) => c[1])) + 1,
  };
}

export interface ShapeLibrary {
  /** 11 lưới gấp được thành khối lập phương. */
  nets: Cell[][];
  /** Không gấp được vì có hàng thẳng 5 ô (5 + 1). Bỏ hàng 6 ô vì quá dài cho thẻ. */
  runs: Cell[][];
  /** Không gấp được vì có khối vuông 2 × 2 (hai ô chồng nhau ngay khi gấp). */
  blocks: Cell[][];
}

let library: ShapeLibrary | undefined;

/** Kho hình, tính một lần cho mỗi tiến trình, thứ tự cố định theo khoá. */
export function getLibrary(): ShapeLibrary {
  if (library) return library;
  const nets: Cell[][] = [];
  const runs: Cell[][] = [];
  const blocks: Cell[][] = [];
  for (const shape of freePolyominoes(6)) {
    if (fold(shape).ok) nets.push(shape);
    else if (longestRun(shape) === 5) runs.push(shape);
    else if (hasBlock(shape)) blocks.push(shape);
  }
  library = { nets, runs, blocks };
  return library;
}
