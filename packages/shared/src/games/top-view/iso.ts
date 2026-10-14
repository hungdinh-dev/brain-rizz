/**
 * Hình học isometric cho khối lập phương xếp trên bệ vuông, mô tả bằng bảng chiều cao.
 *
 * Chỉ phụ thuộc bảng chiều cao, không biết gì về luật game, nên dùng chung được với `cube-count`
 * (cùng cách vẽ khối). Đề xuất chuyển ra thư mục chung khi game thứ hai cần (đặc tả top-view).
 *
 * Quy ước (khớp bản mẫu canvas, artboard TopView*):
 * - Ô (c, r): c là cột từ trái sang phải khi đứng ở mép trước nhìn vào; r là hàng, 0 là hàng xa
 *   nhất, n − 1 là hàng sát mép trước (mép tô cam, nhãn "Trước").
 * - `heights[r][c]` = số khối chồng ở ô đó, 0 là ô trống.
 * - Điểm (c, r, z) vẽ ra màn hình tại X = c − r (đơn vị: nửa bề ngang mặt trên một khối) và
 *   Y = c + r − 2z (đơn vị: một phần tư chiều cao mặt trên, y hướng xuống). Bản mẫu dùng nửa bề
 *   ngang 48,5 px, đơn vị Y 28 px, nên một khối cao 56 px.
 *
 * Màn hình được lát kín bằng tam giác đều có một cạnh đứng: tam giác (X, Y, trái) có cạnh đứng từ
 * (X, Y) xuống (X, Y + 2) và đỉnh thứ ba ở (X − 1, Y + 1); tam giác (X, Y, phải) có đỉnh thứ ba ở
 * (X + 1, Y + 1). Mỗi mặt khối gồm đúng hai tam giác, nên che khuất tính chính xác tới từng nửa mặt.
 *
 * Khối (c, r, h) (tầng h, đếm từ 0) có lục giác gồm: mặt trên (X, Y0, trái/phải); mặt trái, quay
 * về mép trước, (X − 1, Y0 + 1, phải) và (X, Y0 + 2, trái); mặt phải (X + 1, Y0 + 1, trái) và
 * (X, Y0 + 2, phải); với X = c − r, Y0 = c + r − 2h − 2. Sàn ô (c, r) là mặt trên của khối ảo
 * h = −1. Độ sâu c + r + h càng lớn thì càng gần người nhìn; hai khối cùng độ sâu có lục giác
 * không chồng nhau, nên ở mỗi tam giác chỉ có một mặt gần nhất.
 */

/** Loại mặt thấy được ở một tam giác. */
export const ISO_NONE = 0;
export const ISO_FLOOR = 1;
export const ISO_TOP = 2;
export const ISO_LEFT = 3;
export const ISO_RIGHT = 4;

/** Chiều cao lớn nhất bộ vẽ hỗ trợ. */
export const ISO_MAX_HEIGHT = 8;

type Heights = readonly (readonly number[])[];

/** Các ô của đường chéo d = c − r, theo r tăng dần. */
function diagonalCells(n: number, d: number): [c: number, r: number][] {
  const out: [number, number][] = [];
  for (let r = Math.max(0, -d); r <= Math.min(n - 1, n - 1 - d); r++) out.push([r + d, r]);
  return out;
}

/** Số hàng Y của một dải: Y từ −2·ISO_MAX_HEIGHT tới 2n. */
function stripRows(n: number): number {
  return 2 * ISO_MAX_HEIGHT + 2 * n + 1;
}

/**
 * Dải s là vùng giữa hai đường đứng X = s − 1 và X = s: gồm các tam giác trái ở X = s và tam giác
 * phải ở X = s − 1. Chỉ hai đường chéo s − 1 và s phủ lên dải s; mọi dải có nội dung nằm trong
 * [−(n − 1), n].
 *
 * Ghi loại mặt (`kind`) và độ sâu (`depth`) của mặt gần nhất vào hai mảng, phần tử
 * `2·(Y + 2·ISO_MAX_HEIGHT) + phía` (phía 0 = trái, 1 = phải). Ô đường chéo nào không có trong
 * `left`/`right` (null) thì coi như ngoài bệ.
 */
function renderStrip(
  _n: number,
  s: number,
  left: readonly number[] | null,
  right: readonly number[] | null,
  kind: Uint8Array,
  depth: Int16Array,
): void {
  kind.fill(ISO_NONE);
  depth.fill(-32768);
  const off = 2 * ISO_MAX_HEIGHT;
  // Ô thứ j của đường chéo d có r = max(0, −d) + j, nên c + r = 2r + d.
  // Đường chéo s (bên phải dải): nửa trái mặt trên, cả mặt trái.
  if (right) {
    const r0 = Math.max(0, -s);
    for (let j = 0; j < right.length; j++) {
      const sum = 2 * (r0 + j) + s;
      let i = 2 * (sum + off);
      if (sum - 1 > depth[i]!) {
        depth[i] = sum - 1;
        kind[i] = ISO_FLOOR;
      }
      for (let h = 0; h < right[j]!; h++) {
        const y0 = sum - 2 * h - 2;
        const dep = sum + h;
        i = 2 * (y0 + off);
        if (dep > depth[i]!) {
          depth[i] = dep;
          kind[i] = ISO_TOP;
        }
        i = 2 * (y0 + 2 + off);
        if (dep > depth[i]!) {
          depth[i] = dep;
          kind[i] = ISO_LEFT;
        }
        i = 2 * (y0 + 1 + off) + 1;
        if (dep > depth[i]!) {
          depth[i] = dep;
          kind[i] = ISO_LEFT;
        }
      }
    }
  }
  // Đường chéo s − 1 (bên trái dải): nửa phải mặt trên, cả mặt phải.
  if (left) {
    const d = s - 1;
    const r0 = Math.max(0, -d);
    for (let j = 0; j < left.length; j++) {
      const sum = 2 * (r0 + j) + d;
      let i = 2 * (sum + off) + 1;
      if (sum - 1 > depth[i]!) {
        depth[i] = sum - 1;
        kind[i] = ISO_FLOOR;
      }
      for (let h = 0; h < left[j]!; h++) {
        const y0 = sum - 2 * h - 2;
        const dep = sum + h;
        i = 2 * (y0 + off) + 1;
        if (dep > depth[i]!) {
          depth[i] = dep;
          kind[i] = ISO_TOP;
        }
        i = 2 * (y0 + 2 + off) + 1;
        if (dep > depth[i]!) {
          depth[i] = dep;
          kind[i] = ISO_RIGHT;
        }
        i = 2 * (y0 + 1 + off);
        if (dep > depth[i]!) {
          depth[i] = dep;
          kind[i] = ISO_RIGHT;
        }
      }
    }
  }
}

function diagonalHeights(heights: Heights, d: number): number[] | null {
  const n = heights.length;
  if (d < -(n - 1) || d > n - 1) return null;
  return diagonalCells(n, d).map(([c, r]) => heights[r]![c]!);
}

function checkHeights(heights: Heights): void {
  for (const row of heights) {
    if (row.length !== heights.length) throw new Error("iso: bảng chiều cao phải vuông");
    for (const h of row) {
      if (!Number.isInteger(h) || h < 0 || h > ISO_MAX_HEIGHT)
        throw new Error(`iso: chiều cao ${h}`);
    }
  }
}

/**
 * Bức vẽ như người chơi thấy: loại mặt (ISO_*) ở từng tam giác, dải −(n − 1) trước, lần lượt tới
 * dải n. Hai bảng chiều cao cho cùng mảng này thì vẽ ra y hệt nhau.
 *
 * Chỉ cần loại mặt, không cần biết mặt của khối nào: các khối nằm trên cùng một đường nhìn
 * (c + k, r + k, h + k) có chung một lục giác với cùng vai trò từng tam giác, nên hai tam giác cùng
 * loại của một mặt luôn thuộc khối gần nhất trên đường nhìn đó. Vì vậy cả màu từng chỗ lẫn các nét
 * viền (nét chỉ vắng giữa hai tam giác của cùng một mặt) đều suy ra được từ loại mặt.
 */
export function isoPicture(heights: Heights): Uint8Array {
  checkHeights(heights);
  const n = heights.length;
  const len = 2 * stripRows(n);
  const out = new Uint8Array(2 * n * len);
  const kind = new Uint8Array(len);
  const depth = new Int16Array(len);
  for (let s = -(n - 1); s <= n; s++) {
    renderStrip(n, s, diagonalHeights(heights, s - 1), diagonalHeights(heights, s), kind, depth);
    out.set(kind, (s + n - 1) * len);
  }
  return out;
}

export function samePicture(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Số nửa mặt trên (0, 1 hoặc 2) thấy được của từng ô: cột có khối thì là mặt trên của khối cao
 * nhất, ô trống thì là ô sàn. Kết quả `[r][c]`.
 */
export function isoVisibleTopHalves(heights: Heights): number[][] {
  checkHeights(heights);
  const n = heights.length;
  const len = 2 * stripRows(n);
  const off = 2 * ISO_MAX_HEIGHT;
  const kinds: Uint8Array[] = [];
  const depths: Int16Array[] = [];
  for (let s = -(n - 1); s <= n; s++) {
    const kind = new Uint8Array(len);
    const depth = new Int16Array(len);
    renderStrip(n, s, diagonalHeights(heights, s - 1), diagonalHeights(heights, s), kind, depth);
    kinds.push(kind);
    depths.push(depth);
  }
  const out: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row: number[] = [];
    for (let c = 0; c < n; c++) {
      const h = heights[r]![c]! - 1; // tầng của khối trên cùng; −1 là sàn
      const y0 = c + r - 2 * h - 2;
      const want = h === -1 ? ISO_FLOOR : ISO_TOP;
      const dep = c + r + h;
      let seen = 0;
      // Nửa trái nằm ở dải c − r, nửa phải ở dải c − r + 1.
      for (const [s, side] of [
        [c - r, 0],
        [c - r + 1, 1],
      ] as const) {
        const i = 2 * (y0 + off) + side;
        const strip = s + n - 1;
        if (kinds[strip]![i] === want && depths[strip]![i] === dep) seen++;
      }
      row.push(seen);
    }
    out.push(row);
  }
  return out;
}

/** Nửa mặt trên của cột (đường chéo s là `right`, s − 1 là `left`) có thấy được trong dải s không. */
function topHalfVisible(
  kind: Uint8Array,
  depth: Int16Array,
  c: number,
  r: number,
  height: number,
  side: number,
): boolean {
  const i = 2 * (c + r - 2 * height + 2 * ISO_MAX_HEIGHT) + side;
  return kind[i] === ISO_TOP && depth[i] === c + r + height - 1;
}

/**
 * Đếm số bảng chiều cao (mỗi ô 0 … `maxHeight`) vẽ ra y hệt `heights`, dừng khi đạt `cap`.
 * `visibleTops = true` (mặc định) chỉ đếm những bảng mà mọi cột đều lộ ít nhất nửa mặt trên, đúng
 * luật sinh câu đố: người chơi không phải đoán cột bị che kín. Kết quả 1 nghĩa là nhìn hình vẽ suy
 * ra được duy nhất một bảng chiều cao.
 *
 * Quy hoạch động theo đường chéo từ trái sang phải: dải s chỉ phụ thuộc hai đường chéo s − 1 và s.
 * Trạng thái = cách xếp một đường chéo + những ô của nó đã lộ nửa trái mặt trên (nửa phải nằm ở
 * dải kế tiếp), chỉ giữ những trạng thái khớp mọi dải đã qua.
 */
export function isoCountInterpretations(
  heights: Heights,
  maxHeight: number,
  cap = 2,
  visibleTops = true,
): number {
  checkHeights(heights);
  if (!Number.isInteger(maxHeight) || maxHeight < 0 || maxHeight > ISO_MAX_HEIGHT) {
    throw new Error(`iso: maxHeight ${maxHeight}`);
  }
  const n = heights.length;
  const len = 2 * stripRows(n);
  const kind = new Uint8Array(len);
  const depth = new Int16Array(len);
  const target: Uint8Array[] = [];
  for (let s = -(n - 1); s <= n; s++) {
    renderStrip(n, s, diagonalHeights(heights, s - 1), diagonalHeights(heights, s), kind, depth);
    target.push(kind.slice());
  }
  const diagonals: [number, number][][] = [];
  for (let d = -(n - 1); d <= n - 1; d++) diagonals.push(diagonalCells(n, d));
  const cellsOf = (d: number) => diagonals[d + n - 1]!;

  /**
   * Vẽ dải s từ hai đường chéo, so với hình đích. Khớp thì trả về mặt nạ các ô của `right` đã lộ
   * nửa trái mặt trên; không khớp, hoặc có cột của `left` không lộ chút mặt trên nào, trả về −1.
   */
  const step = (
    s: number,
    left: number[] | null,
    leftMask: number,
    right: number[] | null,
  ): number => {
    renderStrip(n, s, left, right, kind, depth);
    const want = target[s + n - 1]!;
    for (let i = 0; i < len; i++) if (kind[i] !== want[i]) return -1;
    if (!visibleTops) return 0;
    if (left) {
      const cells = cellsOf(s - 1);
      for (let j = 0; j < cells.length; j++) {
        const h = left[j]!;
        if (h === 0 || (leftMask >> j) & 1) continue;
        const [c, r] = cells[j]!;
        if (!topHalfVisible(kind, depth, c, r, h, 1)) return -1;
      }
    }
    let mask = 0;
    if (right) {
      const cells = cellsOf(s);
      for (let j = 0; j < cells.length; j++) {
        const h = right[j]!;
        const [c, r] = cells[j]!;
        if (h > 0 && topHalfVisible(kind, depth, c, r, h, 0)) mask |= 1 << j;
      }
    }
    return mask;
  };

  // Rút gọn từng ô trước khi ghép: ô sàn còn lộ trong hình đích thì chắc chắn trống; cột cao H > 0
  // (khi `visibleTops`) phải có chữ "mặt trên" ở đúng chỗ nửa trái hoặc nửa phải mặt trên của nó.
  const off = 2 * ISO_MAX_HEIGHT;
  const targetAt = (s: number, y: number, side: number) =>
    s < -(n - 1) || s > n ? ISO_NONE : target[s + n - 1]![2 * (y + off) + side];
  const allowed = (c: number, r: number): number[] => {
    const x = c - r;
    if (targetAt(x, c + r, 0) === ISO_FLOOR || targetAt(x + 1, c + r, 1) === ISO_FLOOR) return [0];
    const out = [0];
    for (let h = 1; h <= maxHeight; h++) {
      const y0 = c + r - 2 * h;
      if (!visibleTops || targetAt(x, y0, 0) === ISO_TOP || targetAt(x + 1, y0, 1) === ISO_TOP) {
        out.push(h);
      }
    }
    return out;
  };
  /** Mọi cách xếp một đường chéo, mỗi ô lấy trong tập được phép của nó. */
  const choices = (d: number): number[][] => {
    let out: number[][] = [[]];
    for (const [c, r] of cellsOf(d)) {
      const opts = allowed(c, r);
      const grown: number[][] = [];
      for (const prefix of out) for (const h of opts) grown.push([...prefix, h]);
      out = grown;
    }
    return out;
  };
  const keyOf = (diag: number[], mask: number) => {
    let key = 0;
    for (const h of diag) key = key * (ISO_MAX_HEIGHT + 1) + h;
    return key * (1 << diag.length) + mask;
  };

  type State = { diag: number[]; mask: number; count: number };
  let states = new Map<number, State>();
  for (const diag of choices(-(n - 1))) {
    const mask = step(-(n - 1), null, 0, diag);
    if (mask >= 0) states.set(keyOf(diag, mask), { diag, mask, count: 1 });
  }
  for (let d = -(n - 1); d < n - 1; d++) {
    const cands = choices(d + 1);
    const next = new Map<number, State>();
    for (const state of states.values()) {
      for (const cand of cands) {
        const mask = step(d + 1, state.diag, state.mask, cand);
        if (mask < 0) continue;
        const key = keyOf(cand, mask);
        const prev = next.get(key);
        if (prev) prev.count = Math.min(cap, prev.count + state.count);
        else next.set(key, { diag: cand, mask, count: state.count });
      }
    }
    states = next;
    if (states.size === 0) return 0;
  }
  let result = 0;
  for (const state of states.values()) {
    if (step(n, state.diag, state.mask, null) >= 0) result = Math.min(cap, result + state.count);
  }
  return result;
}

/**
 * Số nửa mặt trên bị che (0, 1, 2) nếu ô (c, r) có cột cao `height` ≥ 1, tính bằng công thức (chỉ
 * các ô phía trước mới che được): nửa trái bị che khi có k ≥ 0 với ô (c + k, r + k + 1) cao
 * ≥ height + k + 1; nửa phải khi có ô (c + k + 1, r + k) cao ≥ height + k + 1; cả hai khi có k ≥ 1
 * với ô (c + k, r + k) cao ≥ height + k. Nhanh hơn vẽ lại cả bệ, dùng khi sinh câu đố.
 */
export function isoHiddenTopHalves(heights: Heights, c: number, r: number, height: number): number {
  const n = heights.length;
  const at = (cc: number, rr: number) => (cc < n && rr < n ? heights[rr]![cc]! : 0);
  let leftHidden = false;
  let rightHidden = false;
  for (let k = 0; c + k < n && r + k < n; k++) {
    if (k >= 1 && at(c + k, r + k) >= height + k) return 2;
    if (at(c + k, r + k + 1) >= height + k + 1) leftHidden = true;
    if (at(c + k + 1, r + k) >= height + k + 1) rightHidden = true;
  }
  return (leftHidden ? 1 : 0) + (rightHidden ? 1 : 0);
}
