import type { Difficulty } from "../../difficulty";

/**
 * Kho hình của Xoay hình: liệt kê polyomino (hình ghép từ các ô vuông liền cạnh), gộp thành
 * "loại hình" và lọc theo từng mức. Đặc tả: docs/04-minigames/rotate-match.md, mục "Kho hình".
 *
 * File nội bộ của game: `games/index.ts` chỉ export `rotate-match.ts`, test import thẳng file này.
 * Không có gì ngẫu nhiên ở đây: kho được liệt kê rồi sắp theo khoá chuỗi, nên mọi máy (trình
 * duyệt, Node) có cùng thứ tự. Đổi kho là đổi câu đố của mọi seed.
 *
 * Toạ độ: x sang phải, y xuống dưới (như màn hình). "Xoay" luôn là xoay theo chiều kim đồng hồ.
 */

/** Một ô `[x, y]`, toạ độ nguyên. */
export type Cell = readonly [x: number, y: number];
export type Cells = readonly Cell[];

const DIRS: readonly Cell[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * 8 biến đổi, chỉ số = (lật ? 4 : 0) + số lần xoay 90° theo chiều kim đồng hồ. "Lật" là lật
 * gương trái–phải (x → −x) làm trước, rồi mới xoay. Một lần xoay: (x, y) → (−y, x).
 * Viết `0 - v` thay cho `-v` để không sinh ra −0.
 */
const TRANSFORMS: readonly ((x: number, y: number) => Cell)[] = [
  (x, y) => [x, y],
  (x, y) => [0 - y, x],
  (x, y) => [0 - x, 0 - y],
  (x, y) => [y, 0 - x],
  (x, y) => [0 - x, y],
  (x, y) => [0 - y, 0 - x],
  (x, y) => [x, 0 - y],
  (x, y) => [y, x],
];

/** Dịch cho x, y nhỏ nhất bằng 0 rồi sắp ô theo (y, x). Luôn trả mảng và ô mới. */
export function normalize(cells: Cells): Cell[] {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const [x, y] of cells) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }
  return cells
    .map(([x, y]): Cell => [x - minX, y - minY])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/** Khoá của một hình ĐÃ chuẩn hoá: `"x,y;x,y;…"`. */
function keyOfNormalized(cells: Cells): string {
  return cells.map(([x, y]) => `${x},${y}`).join(";");
}

/** Khoá chuỗi `"x,y;x,y;…"` của hình (chuẩn hoá trước khi lập khoá). */
export function shapeKey(cells: Cells): string {
  return keyOfNormalized(normalize(cells));
}

/** Lật (nếu `flip`) rồi xoay `quarterTurns` lần 90° theo chiều kim đồng hồ; trả hình đã chuẩn hoá. */
export function orient(cells: Cells, flip: boolean, quarterTurns: number): Cell[] {
  const t = TRANSFORMS[(flip ? 4 : 0) + (((quarterTurns % 4) + 4) % 4)]!;
  return normalize(cells.map(([x, y]) => t(x, y)));
}

/** Xoay `quarterTurns` lần 90° theo chiều kim đồng hồ (y hướng xuống), trả hình đã chuẩn hoá. */
export function rotateCW(cells: Cells, quarterTurns: number): Cell[] {
  return orient(cells, false, quarterTurns);
}

/** Lật gương trái–phải, trả hình đã chuẩn hoá. */
export function mirror(cells: Cells): Cell[] {
  return orient(cells, true, 0);
}

/** So sánh chuỗi theo mã ký tự, không phụ thuộc ngôn ngữ máy (không dùng `localeCompare`). */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Cả 8 biến đổi của hình, đã chuẩn hoá, kèm khoá. */
function variants(cells: Cells): { key: string; cells: Cell[] }[] {
  return TRANSFORMS.map((t) => {
    const c = normalize(cells.map(([x, y]) => t(x, y)));
    return { key: keyOfNormalized(c), cells: c };
  });
}

/**
 * Bản chuẩn của loại hình: trong 8 biến đổi (4 phép xoay 90° × có/không lật), lấy bản có
 * khoá nhỏ nhất. Hai hình cùng loại khi và chỉ khi cùng khoá loại.
 */
export function canonicalForm(cells: Cells): { key: string; cells: Cell[] } {
  let best: { key: string; cells: Cell[] } | undefined;
  for (const v of variants(cells)) {
    if (best === undefined || compareStrings(v.key, best.key) < 0) best = v;
  }
  return best!;
}

export function classKey(cells: Cells): string {
  return canonicalForm(cells).key;
}

/** Hai hình có trùng nhau sau một phép xoay 90° nào đó (kể cả 0°) không. */
export function isRotationOf(a: Cells, b: Cells): boolean {
  const target = shapeKey(b);
  for (let r = 0; r < 4; r++) if (shapeKey(rotateCW(a, r)) === target) return true;
  return false;
}

/** Có tay thuận: bản lật gương không trùng phép xoay 90° nào của hình. */
export function isChiral(cells: Cells): boolean {
  return !isRotationOf(cells, mirror(cells));
}

/** Đối xứng xoay: xoay 90°, 180° hoặc 270° ra đúng hình cũ. */
export function hasRotationalSymmetry(cells: Cells): boolean {
  const own = shapeKey(cells);
  for (let r = 1; r < 4; r++) if (shapeKey(rotateCW(cells, r)) === own) return true;
  return false;
}

/** Chiều rộng, chiều cao khung bao (đơn vị ô). */
export function boundingBox(cells: Cells): { width: number; height: number } {
  let maxX = 0;
  let maxY = 0;
  for (const [x, y] of normalize(cells)) {
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { width: maxX + 1, height: maxY + 1 };
}

const cellId = ([x, y]: Cell): string => `${x},${y}`;

/** Các ô liền cạnh nhau thành một khối. */
export function isConnected(cells: Cells): boolean {
  if (cells.length === 0) return false;
  const all = new Set(cells.map(cellId));
  const seen = new Set<string>([cellId(cells[0]!)]);
  const stack: Cell[] = [cells[0]!];
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    for (const [dx, dy] of DIRS) {
      const n: Cell = [x + dx, y + dy];
      const id = cellId(n);
      if (all.has(id) && !seen.has(id)) {
        seen.add(id);
        stack.push(n);
      }
    }
  }
  return seen.size === all.size;
}

/** Có ô trống bị bao kín (không đi ra ngoài khung bao được). */
export function hasHole(cells: Cells): boolean {
  const norm = normalize(cells);
  const { width, height } = boundingBox(norm);
  const filled = new Set(norm.map(cellId));
  // Loang từ một ô ngoài khung, trong vùng khung bao nới thêm 1 ô mỗi phía.
  const seen = new Set<string>(["-1,-1"]);
  const stack: Cell[] = [[-1, -1]];
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < -1 || ny < -1 || nx > width || ny > height) continue;
      const id = `${nx},${ny}`;
      if (filled.has(id) || seen.has(id)) continue;
      seen.add(id);
      stack.push([nx, ny]);
    }
  }
  const emptyTotal = (width + 2) * (height + 2) - norm.length;
  return seen.size < emptyTotal;
}

/** Khoảng cách lớn nhất từ trọng tâm (trung bình tâm ô) tới góc ô xa nhất, đơn vị ô. */
export function figureRadius(cells: Cells): number {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of cells) {
    sx += x + 0.5;
    sy += y + 0.5;
  }
  const cx = sx / cells.length;
  const cy = sy / cells.length;
  let r = 0;
  for (const [x, y] of cells) {
    for (const [px, py] of [
      [x, y],
      [x + 1, y],
      [x, y + 1],
      [x + 1, y + 1],
    ] as const) {
      r = Math.max(r, Math.hypot(px - cx, py - cy));
    }
  }
  return r;
}

/** Mọi loại hình `size` ô, sắp theo khoá loại, kèm bảng tra khoá hình (cố định) → khoá loại. */
interface Catalog {
  classes: { key: string; cells: Cell[] }[];
  classOf: Map<string, string>;
}

/** Polyomino cố định (không gộp xoay/lật) theo số ô: khoá → ô đã chuẩn hoá. Ghi nhớ giữa các mức. */
const fixedBySize: Map<string, Cell[]>[] = [new Map(), new Map([["0,0", [[0, 0] as Cell]]])];

function fixedPolyominoes(size: number): Map<string, Cell[]> {
  for (let n = fixedBySize.length; n <= size; n++) {
    const next = new Map<string, Cell[]>();
    for (const shape of fixedBySize[n - 1]!.values()) {
      const occupied = new Set(shape.map(cellId));
      for (const [x, y] of shape) {
        for (const [dx, dy] of DIRS) {
          const c: Cell = [x + dx, y + dy];
          if (occupied.has(cellId(c))) continue;
          const grown = normalize([...shape, c]);
          const key = keyOfNormalized(grown);
          if (!next.has(key)) next.set(key, grown);
        }
      }
    }
    fixedBySize.push(next);
  }
  return fixedBySize[size]!;
}

function catalog(size: number): Catalog {
  const classOf = new Map<string, string>();
  const classes: { key: string; cells: Cell[] }[] = [];
  for (const [key, cells] of fixedPolyominoes(size)) {
    if (classOf.has(key)) continue;
    const vs = variants(cells);
    let best = vs[0]!;
    for (const v of vs) if (compareStrings(v.key, best.key) < 0) best = v;
    for (const v of vs) classOf.set(v.key, best.key);
    classes.push(best);
  }
  classes.sort((a, b) => compareStrings(a.key, b.key));
  return { classes, classOf };
}

/**
 * Khoá loại của mọi hình thu được khi dời đúng một ô: bỏ một ô mà phần còn lại vẫn liền, đặt nó
 * vào một ô trống kề cạnh khác chỗ cũ. Không gồm chính loại gốc.
 */
function oneMoveClassKeys(cells: Cells, classOf: Map<string, string>): Set<string> {
  const norm = normalize(cells);
  const own = classOf.get(keyOfNormalized(norm))!;
  const out = new Set<string>();
  for (let i = 0; i < norm.length; i++) {
    const removed = cellId(norm[i]!);
    const rest = norm.filter((_, j) => j !== i);
    if (!isConnected(rest)) continue;
    const occupied = new Set(rest.map(cellId));
    for (const [x, y] of rest) {
      for (const [dx, dy] of DIRS) {
        const e: Cell = [x + dx, y + dy];
        const id = cellId(e);
        if (occupied.has(id) || id === removed) continue;
        const key = classOf.get(shapeKey([...rest, e]))!;
        if (key !== own) out.add(key);
      }
    }
  }
  return out;
}

/** Một loại hình trong kho mẫu của một mức. */
export interface ShapeClass {
  /** Khoá loại (khoá nhỏ nhất trong 8 biến đổi). */
  key: string;
  /** Ô của bản chuẩn: biến đổi có khoá nhỏ nhất. */
  cells: readonly Cell[];
  /** Chỉ số (trong kho) các loại gần giống, tăng dần (tức sắp theo khoá). Mầm: rỗng. */
  near: readonly number[];
}

/** Số ô của hình ở mỗi mức. */
export const CELL_COUNT: Readonly<Record<Difficulty, number>> = { 0: 4, 1: 5, 2: 6, 3: 7 };

/** Cạnh khung bao lớn nhất (ô). */
export const MAX_BOX_SIDE = 4;

function buildPool(difficulty: Difficulty): ShapeClass[] {
  const { classes, classOf } = catalog(CELL_COUNT[difficulty]);

  if (difficulty === 0) {
    // Mầm: các loại 4 ô có khung bao 3×2 (họ L, T, S). Không cần tay thuận hay gần giống.
    return classes
      .filter(({ cells }) => {
        const { width, height } = boundingBox(cells);
        return Math.min(width, height) === 2 && Math.max(width, height) === 3;
      })
      .map(({ key, cells }) => ({ key, cells, near: [] }));
  }

  let candidates = classes.filter(({ cells }) => {
    const { width, height } = boundingBox(cells);
    return (
      width <= MAX_BOX_SIDE &&
      height <= MAX_BOX_SIDE &&
      !hasHole(cells) &&
      isChiral(cells) &&
      !hasRotationalSymmetry(cells)
    );
  });

  const moves = new Map(candidates.map((c) => [c.key, oneMoveClassKeys(c.cells, classOf)]));
  const nearKeys = (key: string, inPool: Set<string>): string[] =>
    [...moves.get(key)!].filter((k) => inPool.has(k)).sort(compareStrings);

  if (difficulty >= 2) {
    // Khó, Siêu khó: bỏ loại không có hình gần giống nào trong kho. Quan hệ "dời một ô" có tính
    // đối xứng nên bỏ các loại này không làm loại khác mất hình gần giống: lọc một lượt là đủ.
    const keys = new Set(candidates.map((c) => c.key));
    candidates = candidates.filter(({ key }) => nearKeys(key, keys).length > 0);
  }

  const keys = new Set(candidates.map((c) => c.key));
  const indexOf = new Map(candidates.map((c, i) => [c.key, i]));
  return candidates.map(({ key, cells }) => ({
    key,
    cells,
    near: nearKeys(key, keys).map((k) => indexOf.get(k)!),
  }));
}

const poolCache = new Map<Difficulty, readonly ShapeClass[]>();

/** Kho mẫu của một mức, tính lười ở lần gọi đầu rồi ghi nhớ. Không được sửa mảng trả về. */
export function getPool(difficulty: Difficulty): readonly ShapeClass[] {
  let pool = poolCache.get(difficulty);
  if (pool === undefined) {
    pool = buildPool(difficulty);
    poolCache.set(difficulty, pool);
  }
  return pool;
}
