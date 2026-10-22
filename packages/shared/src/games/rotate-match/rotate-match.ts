import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed } from "../../rng";
import type { MinigameDef } from "../types";
import { type Cells, getPool, mirror, orient, rotateCW, shapeKey } from "./shapes";

/**
 * Xoay hình (nhóm Hình dung): trên cùng là một hình ghép từ các ô vuông (hình mẫu); người chơi
 * chạm vào lựa chọn duy nhất là hình mẫu đã được XOAY đi. Hình bị lật gương hay lệch một ô đều sai.
 * Đặc tả: docs/04-minigames/rotate-match.md.
 *
 * Mọi thứ ngẫu nhiên đi qua `rng`, số lần gọi `rng` cố định theo mức (không có vòng thử lại).
 */

/**
 * Một ô của hình: `[x, y]`, số nguyên ≥ 0, đơn vị là ô.
 * x tăng sang phải, y tăng xuống dưới (như toạ độ màn hình).
 */
export type RotateMatchCell = readonly [x: number, y: number];

/** Một hình để vẽ: các ô ở tư thế gốc, rồi xoay cả hình đi `angle` độ khi vẽ. */
export interface RotateMatchFigure {
  /**
   * Các ô của hình, chưa xoay. Đã chuẩn hoá: x, y nhỏ nhất bằng 0; sắp theo (y, x); không trùng.
   * Các ô liền cạnh, không có lỗ, khung bao mỗi cạnh ≤ 4 ô. Số ô: 4 / 5 / 6 / 7 theo mức.
   */
  cells: readonly RotateMatchCell[];
  /**
   * Góc vẽ, số nguyên độ trong [0, 360), chiều kim đồng hồ trên màn hình (như `setAngle` của
   * Phaser), xoay quanh trọng tâm các ô: (trung bình x + 0,5; trung bình y + 0,5).
   * Hình mẫu luôn 0. Lựa chọn: Mầm, Thường {90, 180, 270}; Khó {45, 90, 135, 225, 270, 315};
   * Siêu khó {60, 120, 150, 210, 240, 300}.
   */
  angle: number;
}

/**
 * Lựa chọn là gì so với hình mẫu (FE dùng để chọn phản hồi khi sai; không được hiện trước khi chạm):
 * - `"rotation"`: đáp án, cùng các ô với hình mẫu, chỉ khác góc vẽ.
 * - `"mirror"`: bản lật gương của hình mẫu (từ Thường).
 * - `"other"`: hình khác loại. Mầm: họ khác (L/T/S). Từ Thường: hình gần giống (hình mẫu dời
 *   đúng một ô) hoặc bản lật gương của nó.
 */
export type RotateMatchChoiceKind = "rotation" | "mirror" | "other";

export interface RotateMatchChoice extends RotateMatchFigure {
  kind: RotateMatchChoiceKind;
}

export interface RotateMatchPuzzle {
  /** Hình mẫu ở thẻ trên cùng, `angle` luôn bằng 0. */
  model: RotateMatchFigure;
  /**
   * 3 lựa chọn (Mầm) hoặc 4 (từ Thường), theo thứ tự ô trên màn hình: trái → phải, trên → dưới.
   * Mọi lựa chọn có cùng số ô với hình mẫu.
   */
  choices: RotateMatchChoice[];
  /** Chỉ số lựa chọn đúng trong `choices` (lựa chọn duy nhất có `kind = "rotation"`). */
  answerIndex: number;
}

/** Đáp án = chỉ số lựa chọn người chơi chạm (số nguyên 0–3). */
export type RotateMatchAnswer = number;

/** Số lựa chọn tối đa (từ Thường). Mầm có 3. */
export const ROTATE_MATCH_MAX_CHOICES = 4;

/**
 * Bán kính lớn nhất (đơn vị ô) từ trọng tâm tới góc ô xa nhất, trên mọi hình có thể xuất hiện ở
 * mức đó, làm tròn lên 0,01. FE chọn cỡ ô u = ⌊140 / bán kính⌋ (tối đa 64 px) để hình xoay góc
 * nào cũng nằm gọn trong thẻ, và mọi câu của một mức cùng cỡ ô. Test kiểm số này khớp kho hình.
 */
export const ROTATE_MATCH_MAX_RADIUS: Readonly<Record<Difficulty, number>> = {
  0: 1.91,
  1: 2.41,
  2: 2.7,
  3: 2.88,
};

/** Tập góc vẽ (độ) của các lựa chọn ở mỗi mức. */
export const ROTATE_MATCH_ANGLES: Readonly<Record<Difficulty, readonly number[]>> = {
  0: [90, 180, 270],
  1: [90, 180, 270],
  2: [45, 90, 135, 225, 270, 315],
  3: [60, 120, 150, 210, 240, 300],
};

function figure(cells: Cells, angle: number): RotateMatchFigure {
  // Sao chép từng ô để câu đố không dùng chung mảng với kho đã ghi nhớ.
  return { cells: cells.map(([x, y]): RotateMatchCell => [x, y]), angle };
}

function choice(cells: Cells, angle: number, kind: RotateMatchChoiceKind): RotateMatchChoice {
  return { ...figure(cells, angle), kind };
}

/** Xếp lựa chọn theo `rng.shuffle`; phần tử 0 của `list` là đáp án. */
function arrange(
  model: RotateMatchFigure,
  list: RotateMatchChoice[],
  order: readonly number[],
): RotateMatchPuzzle {
  return {
    model,
    choices: order.map((i) => list[i]!),
    answerIndex: order.indexOf(0),
  };
}

export const rotateMatch: MinigameDef<RotateMatchPuzzle, RotateMatchAnswer> = {
  id: "rotate-match",
  category: "visualize",
  // CR-006: vòng 60 giây cho 4 game mới, để Siêu khó vẫn còn ≥ 8 câu mỗi vòng.
  durationMs: 60_000,
  // CR-006: mỗi mức tính để người chơi đúng sức được điểm vòng xấp xỉ người lớn ở Thường (mô
  // phỏng từ bảng Cân bằng của đặc tả). Mầm = min(mô phỏng cho trẻ 7 tuổi, 1) theo quy tắc chung
  // của PM: 0,86 → 0,85. Chốt lại sau buổi chơi thử.
  difficultyMultiplier: { 0: 0.85, 1: 1, 2: 2, 3: 3.3 },
  // Bot (CR-016): thời gian một câu chép từ bảng Cân bằng của đặc tả (Mầm theo trẻ 7 tuổi): giữa
  // khoảng + 0,35 s hiệu ứng chuyển câu.
  expectedSolveMs: { 0: 2_850, 1: 3_100, 2: 4_600, 3: 6_350 },
  // Bot (CR-016): tỉ lệ đúng = 1 − tỉ lệ sai ở bảng Cân bằng của đặc tả (Mầm theo trẻ 7 tuổi).
  expectedAccuracy: { 0: 0.9, 1: 0.9, 2: 0.87, 3: 0.83 },
  // Không khai báo `speedAllowanceMs`: thưởng tốc độ chung đã hợp với game này (đặc tả, CR-006).

  generate(roundSeed, index, difficulty) {
    const rng = createRng(deriveSeed(roundSeed, index));
    const pool = getPool(difficulty);
    const angles = ROTATE_MATCH_ANGLES[difficulty];

    // 1. Hình mẫu: chọn loại (như `rng.pick`, nhưng cần chỉ số), lật, hướng (xoay dữ liệu ô,
    //    không phải góc vẽ).
    const modelIndex = rng.int(0, pool.length - 1);
    const modelClass = pool[modelIndex]!;
    const modelFlip = rng.int(0, 1) === 1;
    const modelTurns = rng.int(0, 3);
    const modelCells = orient(modelClass.cells, modelFlip, modelTurns);
    const model = figure(modelCells, 0);

    if (difficulty === 0) {
      // 2. Đáp án: bỏ góc làm hình trông y hệt mẫu (chỉ họ S: bỏ 180°).
      const ownKey = shapeKey(modelCells);
      const answerAngles = angles.filter((a) => shapeKey(rotateCW(modelCells, a / 90)) !== ownKey);
      const list = [choice(modelCells, rng.pick(answerAngles), "rotation")];
      // 3. Hai họ còn lại, theo thứ tự trong kho.
      for (let i = 0; i < pool.length; i++) {
        if (i === modelIndex) continue;
        const flip = rng.int(0, 1) === 1;
        list.push(choice(orient(pool[i]!.cells, flip, 0), rng.pick(angles), "other"));
      }
      // 4. Xáo vị trí.
      return arrange(model, list, rng.shuffle([0, 1, 2]));
    }

    // 2. Đáp án và bản gương của mẫu. Mẫu không đối xứng xoay nên không góc nào trông y hệt mẫu.
    const answer = choice(modelCells, rng.pick(angles), "rotation");
    const mirrored = choice(mirror(modelCells), rng.pick(angles), "mirror");

    // 3. Hình gần giống Q (mẫu dời đúng một ô) và bản gương của Q.
    const nearClass = pool[rng.pick(modelClass.near)]!;
    const nearFlip = rng.int(0, 1) === 1;
    const nearTurns = rng.int(0, 3);
    const nearCells = orient(nearClass.cells, nearFlip, nearTurns);
    const near = choice(nearCells, rng.pick(angles), "other");
    const nearMirrored = choice(mirror(nearCells), rng.pick(angles), "other");

    // 4. Xáo vị trí: hai cặp gương (đáp án–gương, Q–gương Q).
    return arrange(model, [answer, mirrored, near, nearMirrored], rng.shuffle([0, 1, 2, 3]));
  },

  check(puzzle, answer) {
    return answer === puzzle.answerIndex;
  },

  isAnswer(value): value is RotateMatchAnswer {
    return (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value < ROTATE_MATCH_MAX_CHOICES
    );
  },
};
