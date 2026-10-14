/*
 * Hình khối dùng chung cho scene và hình minh hoạ của Đếm khối (đặc tả docs/04-minigames/cube-count.md,
 * mục "Vẽ mô hình"; bản mẫu M12: CubeCountMobile, CubeCountStates, CubeCountHowTo).
 */

export type Point = readonly [x: number, y: number];

/** Nửa bề rộng mặt trên của một khối (mặt trên rộng 97 px). */
export const HALF_W = 48.5;
/** Nửa chiều cao mặt trên (mặt trên cao 56 px); cũng là bước dời theo một ô của trục r và c. */
export const HALF_H = 28;
/** Cạnh đứng của một khối = chiều cao một tầng. */
export const EDGE = 56;
/** Độ dày mặt bên của bệ. */
export const SLAB_THICK = 14;

/** Gốc (đỉnh trên của mặt trên) của khối ở ô (r, c), tầng k (k = 0 sát bệ), so với gốc mô hình. */
export function cubeOrigin(r: number, c: number, k: number): Point {
  return [HALF_W * (c - r), HALF_H * (c + r) - EDGE * (k + 1)];
}

/** Ba mặt của một khối, so với gốc khối. */
export const CUBE_TOP: readonly Point[] = [
  [0, 0],
  [HALF_W, HALF_H],
  [0, 2 * HALF_H],
  [-HALF_W, HALF_H],
];
export const CUBE_LEFT: readonly Point[] = [
  [-HALF_W, HALF_H],
  [0, 2 * HALF_H],
  [0, 2 * HALF_H + EDGE],
  [-HALF_W, HALF_H + EDGE],
];
export const CUBE_RIGHT: readonly Point[] = [
  [HALF_W, HALF_H],
  [0, 2 * HALF_H],
  [0, 2 * HALF_H + EDGE],
  [HALF_W, HALF_H + EDGE],
];

/** Bốn đỉnh mặt trên của bệ `depth × width`: trên, phải, dưới, trái (gốc ở đỉnh trên). */
export function slabCorners(depth: number, width: number) {
  const top: Point = [0, 0];
  const right: Point = [HALF_W * width, HALF_H * width];
  const bottom: Point = [HALF_W * (width - depth), HALF_H * (width + depth)];
  const left: Point = [-HALF_W * depth, HALF_H * depth];
  return { top, right, bottom, left };
}

/** Đường chia ô trên mặt bệ: mỗi đoạn [đầu, cuối]. */
export function slabGrid(depth: number, width: number): [Point, Point][] {
  const lines: [Point, Point][] = [];
  for (let c = 1; c < width; c++) {
    lines.push([
      [HALF_W * c, HALF_H * c],
      [HALF_W * (c - depth), HALF_H * (c + depth)],
    ]);
  }
  for (let r = 1; r < depth; r++) {
    lines.push([
      [-HALF_W * r, HALF_H * r],
      [HALF_W * (width - r), HALF_H * (width + r)],
    ]);
  }
  return lines;
}

/** Màu ba mặt khối (xanh nhóm Phân tích). Màu riêng của game theo đặc tả, không phải token chung. */
export interface CubeShades {
  top: string;
  left: string;
  right: string;
}

export const CUBE_LIGHT: CubeShades = { top: "#aed3f4", left: "#78b5ea", right: "#4d9de0" };
export const CUBE_DARK: CubeShades = { top: "#c9e3f9", left: "#98c8f0", right: "#74b3ea" };

/** Màu bệ: mặt trên, hai mặt bên, đường chia ô (bản tối theo artboard CubeCountStates). */
export interface SlabShades extends CubeShades {
  grid: string;
}

export const SLAB_LIGHT: SlabShades = {
  top: "#f3eadf",
  left: "#e2d5bf",
  right: "#cdbfa6",
  grid: "rgb(31 27 58 / 0.3)",
};
export const SLAB_DARK: SlabShades = {
  top: "#423c6e",
  left: "#352f5e",
  right: "#26213f",
  grid: "rgb(255 248 239 / 0.28)",
};

/** Chuỗi điểm → thuộc tính `points` của SVG, dời theo `at`. */
export function svgPoints(points: readonly Point[], at: Point = [0, 0]) {
  return points.map(([x, y]) => `${x + at[0]},${y + at[1]}`).join(" ");
}
