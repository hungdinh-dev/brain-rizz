import type { Difficulty } from "../../difficulty";
import type { Rng } from "../../rng";
import { EMPTY, type GridShape } from "./grid";

/**
 * Câu dự phòng của Ô bí ẩn: khi bộ sinh của Khó / Siêu khó đào hỏng quá số lần cho phép, lấy
 * câu mẫu cố định của mức rồi biến đổi đối xứng bằng `rng`. Các phép biến đổi giữ nguyên hàng,
 * cột và khối (chỉ đổi chỗ chúng với nhau) nên giữ nguyên mọi bước suy luận của câu mẫu.
 */

export interface LatinCellTemplate {
  /** Ô theo hàng: chữ số là mã hình, "." là ô trống (gồm ô ?). */
  cells: string;
  target: number;
  answer: number;
  /** Ô trung gian: [ô, hình]. */
  via: readonly (readonly [cell: number, shape: number])[];
}

/** Câu mẫu lấy từ chính bộ sinh, đã được test kiểm đủ bảo đảm của mức. */
export const LATIN_CELL_FALLBACKS: Readonly<Partial<Record<Difficulty, LatinCellTemplate>>> = {
  // Khó (4 × 4, khối 2 × 2): ô ? (0, 2) còn {2, 3}; ô (3, 2) chốt hình 3 (hàng 3).
  2: { cells: "0..1....3..0.0.2", target: 2, answer: 2, via: [[14, 3]] },
  // Siêu khó (6 × 6, khối 2 × 3): ô ? (4, 5) còn {2, 4, 5}; chốt ô (4, 4) = 5 và (5, 4) = 4.
  3: {
    cells: "5...3..3.40....31031.52.1.3...0.5..3",
    target: 29,
    answer: 2,
    via: [
      [28, 5],
      [34, 4],
    ],
  },
};

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/**
 * Hoán vị chỉ số hàng (hoặc cột) giữ nguyên khối: xáo thứ tự các dải `group` hàng, rồi xáo các
 * hàng trong từng dải. Trả về `out[mới] = cũ`.
 */
function permuteInGroups(rng: Rng, size: number, group: number): number[] {
  const out: number[] = [];
  for (const band of rng.shuffle(range(size / group))) {
    for (const r of rng.shuffle(range(group))) out.push(band * group + r);
  }
  return out;
}

/**
 * Câu mẫu sau một phép đối xứng ngẫu nhiên: đổi tên hình, xáo dải hàng / hàng trong dải, xáo
 * chồng cột / cột trong chồng, và lật chéo (chỉ khi khối vuông hoặc không có khối).
 */
export function fromTemplate(rng: Rng, shape: GridShape, template: LatinCellTemplate) {
  const n = shape.size;
  const rows = permuteInGroups(rng, n, shape.block?.rows ?? n);
  const cols = permuteInGroups(rng, n, shape.block?.cols ?? n);
  const symbol = rng.shuffle(range(n));
  const square = !shape.block || shape.block.rows === shape.block.cols;
  const transpose = square && rng.int(0, 1) === 1;

  const cells: number[] = new Array(n * n).fill(EMPTY);
  const moved: number[] = new Array(n * n).fill(-1);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const r = rows[i]!;
      const c = cols[j]!;
      const old = transpose ? c * n + r : r * n + c;
      moved[old] = i * n + j;
      const ch = template.cells[old];
      cells[i * n + j] = ch === "." || ch === undefined ? EMPTY : symbol[Number(ch)]!;
    }
  }
  return {
    cells,
    target: moved[template.target]!,
    answer: symbol[template.answer]!,
    via: template.via.map(([cell, s]) => ({ cell: moved[cell]!, shape: symbol[s]! })),
  };
}
