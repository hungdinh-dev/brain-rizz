import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";
import { CUBE_COUNT_LEVELS, cubeCountStats, sampleCubeCountHeights } from "./model";

/**
 * Đếm khối (nhóm Phân tích): một mô hình khối lập phương xếp trên bệ, vẽ isometric. Người chơi
 * chạm vào thẻ ghi đúng tổng số khối, tính cả những khối bị che. Đặc tả: docs/04-minigames/cube-count.md.
 *
 * Mô hình luôn là "bậc thang": không có khối lơ lửng, và cột phía trước không bao giờ cao hơn cột
 * ngay sau nó (theo cả hai hướng). Nhờ vậy mặt trên của mọi cột luôn thấy trọn, số tầng từng cột
 * đọc được từ hình, nên tổng số khối suy ra duy nhất.
 *
 * Mọi thứ ngẫu nhiên đi qua `rng`; không dùng Math.random() hay Date.now().
 */

export {
  CUBE_COUNT_LEVELS,
  type CubeCountHeights,
  type CubeCountLevel,
  type CubeCountStats,
  cubeCountStats,
  isValidCubeCountModel,
} from "./model";

/**
 * Thẻ số là gì (FE dùng để chọn phản hồi khi sai; không được hiện trước khi chạm):
 * - `"answer"`: tổng số khối, đáp án.
 * - `"visible"`: chỉ đếm khối nhìn thấy, quên khối bị che (FE thêm icon con mắt).
 * - `"double"`: đếm trùng, cộng thêm số khối bị che một lần nữa (chỉ khi số khối bị che ≥ 3,
 *   để không trùng với lệch 1–2).
 * - `"near"`: lệch 1–3 so với đáp án.
 */
export type CubeCountOptionKind = "answer" | "visible" | "double" | "near";

export interface CubeCountPuzzle {
  /** Số ô dọc cạnh trái-xuống của bệ (trục r). */
  depth: number;
  /** Số ô dọc cạnh phải-xuống của bệ (trục c). */
  width: number;
  /** Số tầng từng cột, `depth` hàng × `width` cột (xem `CubeCountHeights`). */
  heights: number[][];
  /** 4 số đôi một khác nhau, ≥ 1, xếp TĂNG dần; thứ tự trên màn hình: trái → phải, trên → dưới. */
  options: number[];
  /** Loại của từng thẻ, cùng thứ tự với `options`. */
  kinds: CubeCountOptionKind[];
  /** Chỉ số thẻ đúng trong `options`. `options[answerIndex]` là tổng số khối. */
  answerIndex: number;
}

/** Đáp án = chỉ số thẻ người chơi chạm (số nguyên 0–3). */
export type CubeCountAnswer = number;

/** Số thẻ số mỗi câu, ở mọi mức. */
export const CUBE_COUNT_OPTIONS = 4;

/**
 * Bốn thẻ số. Vị trí đáp án sau khi xếp tăng dần (`rank`) chọn đều 0–3, để không mẹo vị trí nào
 * đoán được. Các số nhỏ hơn đáp án: số khối thấy (`visible`, luôn có khi rank ≥ 1), rồi lệch −1,
 * −2 (xáo), thiếu thì −3. Các số lớn hơn: chọn từ +1, +2 và + số khối che khi số này ≥ 3 (xáo),
 * thiếu thì +3.
 */
function buildOptions(
  rng: Rng,
  total: number,
  hidden: number,
): Pick<CubeCountPuzzle, "options" | "kinds" | "answerIndex"> {
  const visible = total - hidden;
  const rank = rng.int(0, CUBE_COUNT_OPTIONS - 1);

  const below: number[] = [];
  if (rank >= 1) below.push(visible);
  for (const v of rng.shuffle([total - 1, total - 2])) {
    if (below.length < rank && v !== visible) below.push(v);
  }
  for (let d = 3; below.length < rank; d++) {
    if (total - d !== visible) below.push(total - d);
  }

  const above: number[] = [];
  const need = CUBE_COUNT_OPTIONS - 1 - rank;
  const upper = hidden >= 3 ? [total + 1, total + 2, total + hidden] : [total + 1, total + 2];
  for (const v of rng.shuffle(upper)) {
    if (above.length < need) above.push(v);
  }
  for (let d = 3; above.length < need; d++) {
    if (!above.includes(total + d)) above.push(total + d);
  }

  const options = [...below, total, ...above].sort((a, b) => a - b);
  const kinds = options.map((v): CubeCountOptionKind => {
    if (v === total) return "answer";
    if (v === visible) return "visible";
    if (hidden >= 3 && v === total + hidden) return "double";
    return "near";
  });
  return { options, kinds, answerIndex: options.indexOf(total) };
}

export const cubeCount: MinigameDef<CubeCountPuzzle, CubeCountAnswer> = {
  id: "cube-count",
  category: "analyze",
  // CR-006: vòng 60 giây cho game mới, để Siêu khó vẫn còn ≥ 8 câu mỗi vòng.
  durationMs: 60_000,
  // CR-006: mỗi mức tính để người chơi đúng sức được điểm vòng xấp xỉ người lớn ở Thường (mô
  // phỏng theo bảng Cân bằng của đặc tả). Mầm = min(mô phỏng cho trẻ 7 tuổi, 1).
  difficultyMultiplier: { 0: 1, 1: 1, 2: 1.7, 3: 2.45 },
  // Không khai báo `speedAllowanceMs`: không có pha trình chiếu, một chạm là chốt (đặc tả).

  generate(roundSeed, index, difficulty) {
    const rng = createRng(deriveSeed(roundSeed, index));
    const lv = CUBE_COUNT_LEVELS[difficulty];
    const { heights } = sampleCubeCountHeights(rng, difficulty);
    const { total, hidden } = cubeCountStats(heights);
    return { depth: lv.depth, width: lv.width, heights, ...buildOptions(rng, total, hidden) };
  },

  check(puzzle, answer) {
    return answer === puzzle.answerIndex;
  },

  isAnswer(value): value is CubeCountAnswer {
    return (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value < CUBE_COUNT_OPTIONS
    );
  },
};
