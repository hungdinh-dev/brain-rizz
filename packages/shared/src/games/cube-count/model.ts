import type { Difficulty } from "../../difficulty";
import type { Rng } from "../../rng";

/**
 * Mô hình khối của Đếm khối: tham số từng mức, thống kê (tổng, khối bị che) và bộ sinh mô hình.
 * File nội bộ của game; phần dùng chung được export lại qua `cube-count.ts`.
 */

/**
 * Số tầng của từng cột: `heights[r][c]`, số nguyên 0…`maxHeight` (0 = ô trống).
 * - `c` (0…width − 1) chạy dọc cạnh bệ đi xuống bên PHẢI màn hình: mỗi bước +c dời (+48,5; +28) px.
 * - `r` (0…depth − 1) chạy dọc cạnh bệ đi xuống bên TRÁI màn hình: mỗi bước +r dời (−48,5; +28) px.
 * - Ô (0, 0) là góc sau cùng (đỉnh trên của bệ), cũng là cột cao nhất.
 * - Bậc thang: `heights[r][c] ≥ heights[r + 1][c]` và `heights[r][c] ≥ heights[r][c + 1]`.
 */
export type CubeCountHeights = readonly (readonly number[])[];

/** Tham số sinh mô hình của một mức. */
export interface CubeCountLevel {
  /** Số ô bệ theo trục r (cạnh trái-xuống). */
  depth: number;
  /** Số ô bệ theo trục c (cạnh phải-xuống). */
  width: number;
  /** Số tầng tối đa của một cột. */
  maxHeight: number;
  /** Khoảng tổng số khối (gồm cả hai đầu). */
  minTotal: number;
  maxTotal: number;
  /** Khoảng số khối bị che hoàn toàn (gồm cả hai đầu). Luôn ≥ 1 để có bẫy "chỉ đếm khối thấy". */
  minHidden: number;
  maxHidden: number;
  /** Khoảng số cột có khối (gồm cả hai đầu); số ô trống = depth × width − số cột. */
  minColumns: number;
  maxColumns: number;
}

export const CUBE_COUNT_LEVELS: Readonly<Record<Difficulty, Readonly<CubeCountLevel>>> = {
  0: {
    depth: 2,
    width: 3,
    maxHeight: 2,
    minTotal: 4,
    maxTotal: 6,
    minHidden: 1,
    maxHidden: 1,
    minColumns: 3,
    maxColumns: 5,
  },
  1: {
    depth: 3,
    width: 3,
    maxHeight: 3,
    minTotal: 8,
    maxTotal: 12,
    minHidden: 2,
    maxHidden: 4,
    minColumns: 5,
    maxColumns: 8,
  },
  2: {
    depth: 3,
    width: 4,
    maxHeight: 4,
    minTotal: 13,
    maxTotal: 18,
    minHidden: 5,
    maxHidden: 7,
    minColumns: 7,
    maxColumns: 10,
  },
  3: {
    depth: 4,
    width: 4,
    maxHeight: 5,
    minTotal: 20,
    maxTotal: 26,
    minHidden: 8,
    maxHidden: 12,
    minColumns: 9,
    maxColumns: 13,
  },
};

/**
 * Mô hình dự phòng khi hết lượt thử (xác suất < 1e-14 mỗi câu; test đo số lượt thử thật).
 * Chính là các câu ví dụ trong bản mẫu M12, đều thoả ràng buộc của mức.
 */
export const CUBE_COUNT_FALLBACK: Readonly<Record<Difficulty, CubeCountHeights>> = {
  0: [
    [2, 1, 1],
    [1, 0, 0],
  ],
  1: [
    [3, 2, 1],
    [2, 1, 0],
    [1, 1, 0],
  ],
  2: [
    [4, 3, 2, 1],
    [2, 2, 1, 0],
    [1, 1, 0, 0],
  ],
  3: [
    [5, 3, 2, 1],
    [3, 2, 1, 0],
    [2, 2, 1, 0],
    [1, 0, 0, 0],
  ],
};

/** Số lượt thử tối đa khi sinh mô hình. Trung bình cần khoảng 12 / 14 / 78 / 148 lượt theo mức. */
export const CUBE_COUNT_MAX_ATTEMPTS = 5_000;

export interface CubeCountStats {
  /** Tổng số khối (đáp án). */
  total: number;
  /** Số khối bị che hoàn toàn: có khối ở trên, ở ô trước-phải (+c) và ở ô trước-trái (+r). */
  hidden: number;
  /** Số khối thấy được ít nhất một phần mặt = `total − hidden`. */
  visible: number;
  /** Số cột có khối (số mặt trên thấy được). */
  columns: number;
  /** Số ô trống trên bệ. */
  empty: number;
  /** Cột cao nhất. */
  tallest: number;
}

/**
 * Thống kê một mô hình bậc thang. Khối ở tầng k (0 = sát bệ) của ô (r, c) bị che hoàn toàn khi
 * và chỉ khi có khối ở (r, c, k + 1), (r + 1, c, k) và (r, c + 1, k): ba mặt nhìn thấy được của nó
 * (trên, trước-trái, trước-phải) đều bị khối liền kề áp vào. Với mô hình bậc thang, mặt nào không
 * bị khối liền kề áp vào thì cũng không bị khối nào xa hơn che (test kiểm bằng cách vẽ thật).
 */
export function cubeCountStats(heights: CubeCountHeights): CubeCountStats {
  const depth = heights.length;
  const width = heights[0]?.length ?? 0;
  const at = (r: number, c: number) => (r < depth && c < width ? (heights[r]?.[c] ?? 0) : 0);
  let total = 0;
  let hidden = 0;
  let columns = 0;
  let tallest = 0;
  for (let r = 0; r < depth; r++) {
    for (let c = 0; c < width; c++) {
      const h = at(r, c);
      total += h;
      if (h > 0) columns++;
      tallest = Math.max(tallest, h);
      hidden += Math.max(0, Math.min(h - 1, at(r + 1, c), at(r, c + 1)));
    }
  }
  return {
    total,
    hidden,
    visible: total - hidden,
    columns,
    empty: depth * width - columns,
    tallest,
  };
}

/** Mô hình có thoả mọi ràng buộc của mức không (bậc thang, khoảng tổng, khoảng khối che, khoảng số cột). */
export function isValidCubeCountModel(heights: CubeCountHeights, difficulty: Difficulty): boolean {
  const lv = CUBE_COUNT_LEVELS[difficulty];
  if (heights.length !== lv.depth) return false;
  for (let r = 0; r < lv.depth; r++) {
    const row = heights[r]!;
    if (row.length !== lv.width) return false;
    for (let c = 0; c < lv.width; c++) {
      const h = row[c]!;
      if (!Number.isInteger(h) || h < 0 || h > lv.maxHeight) return false;
      if (r > 0 && h > heights[r - 1]![c]!) return false;
      if (c > 0 && h > row[c - 1]!) return false;
    }
  }
  const s = cubeCountStats(heights);
  return (
    s.total >= lv.minTotal &&
    s.total <= lv.maxTotal &&
    s.hidden >= lv.minHidden &&
    s.hidden <= lv.maxHidden &&
    s.columns >= lv.minColumns &&
    s.columns <= lv.maxColumns
  );
}

/**
 * Sinh mô hình: đi từng ô theo hàng (r rồi c), số tầng chọn đều trong 0…min(ô sau theo r, ô sau
 * theo c, tầng tối đa), nên luôn là bậc thang. Lặp tới khi thoả ràng buộc của mức; quá
 * `CUBE_COUNT_MAX_ATTEMPTS` lượt thì dùng mô hình dự phòng. Trả cả số lượt đã thử (cho test).
 */
export function sampleCubeCountHeights(
  rng: Rng,
  difficulty: Difficulty,
): { heights: number[][]; attempts: number } {
  const lv = CUBE_COUNT_LEVELS[difficulty];
  for (let attempt = 1; attempt <= CUBE_COUNT_MAX_ATTEMPTS; attempt++) {
    const heights: number[][] = [];
    for (let r = 0; r < lv.depth; r++) {
      const row: number[] = [];
      for (let c = 0; c < lv.width; c++) {
        const behindR = r > 0 ? heights[r - 1]![c]! : lv.maxHeight;
        const behindC = c > 0 ? row[c - 1]! : lv.maxHeight;
        row.push(rng.int(0, Math.min(behindR, behindC)));
      }
      heights.push(row);
    }
    if (isValidCubeCountModel(heights, difficulty)) return { heights, attempts: attempt };
  }
  return {
    heights: CUBE_COUNT_FALLBACK[difficulty].map((row) => row.slice()),
    attempts: CUBE_COUNT_MAX_ATTEMPTS + 1,
  };
}
