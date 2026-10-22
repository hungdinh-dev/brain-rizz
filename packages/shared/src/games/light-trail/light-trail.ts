import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import { createRng, deriveSeed } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Theo dấu ánh đèn (nhóm Ghi nhớ): các ô đèn trên lưới lần lượt sáng; xem hết rồi chạm lại
 * đúng thứ tự vừa sáng. Siêu khó chạm ngược, bắt đầu từ ô sáng cuối cùng.
 * Đặc tả: docs/04-minigames/light-trail.md.
 */

/**
 * Câu đố. Ô đánh số theo hàng, ô 0 ở góc trên trái: ô `i` nằm ở hàng `Math.floor(i / cols)`,
 * cột `i % cols`.
 *
 * Lịch trình chiếu (ms, tính từ lúc câu hiện ra): đèn thứ `k` (đếm từ 0, tức `sequence[k]`)
 * bật lúc `leadMs + k * stepMs` và sáng trong `litMs`. Người chơi được chạm từ
 * `lightTrailRevealMs(puzzle)`; trước đó mọi lần chạm bị bỏ qua, không tính sai.
 */
export interface LightTrailPuzzle {
  /** Số cột của lưới: 3 (Mầm, Thường) hoặc 4 (Khó, Siêu khó). */
  cols: number;
  /** Số hàng, luôn bằng `cols`. */
  rows: number;
  /**
   * Các ô theo thứ tự SÁNG (dùng để trình chiếu). Dài 3–5, không trùng nhau,
   * mọi phần tử nằm trong [0, cols × rows).
   */
  sequence: number[];
  /**
   * Các ô theo thứ tự PHẢI CHẠM: bằng `sequence`, hoặc `sequence` đảo ngược khi `reverse`.
   * Dùng để chấm ở client và để hiện đáp án đúng lúc khoá sau khi sai.
   */
  expected: number[];
  /** true = phải chạm ngược từ ô sáng cuối (chỉ Siêu khó). Scene hiện huy hiệu tua ngược. */
  reverse: boolean;
  /** Khoảng chờ từ lúc câu hiện ra tới khi đèn đầu tiên bật (ms). */
  leadMs: number;
  /** Mỗi đèn sáng trong bao lâu (ms), gồm cả hiệu ứng bật và tắt. */
  litMs: number;
  /** Khoảng cách giữa hai lần bật đèn liên tiếp (ms) = thời gian sáng + khoảng tắt. */
  stepMs: number;
}

/**
 * Đáp án = các ô người chơi đã chạm, theo thứ tự chạm. Client gửi MỘT lần mỗi câu:
 * - chạm đúng đủ `expected.length` ô → gửi cả mảng;
 * - chạm sai lần đầu → gửi ngay mảng tính tới ô sai (vd. `[7, 10, 3]`).
 * Chạm lại ô đã chạm thì client bỏ qua, không thêm vào mảng.
 */
export type LightTrailAnswer = number[];

interface LevelParams {
  /** Cạnh lưới n (lưới n × n). */
  size: number;
  /** Độ dài chuỗi L. */
  length: number;
  reverse: boolean;
  litMs: number;
  stepMs: number;
}

const LEAD_MS = 500;

/** Bảng Độ khó của đặc tả. Đổi số ở đây thì sửa đặc tả và test cho khớp. */
const LEVELS: Readonly<Record<Difficulty, LevelParams>> = {
  0: { size: 3, length: 3, reverse: false, litMs: 550, stepMs: 800 },
  1: { size: 3, length: 4, reverse: false, litMs: 450, stepMs: 650 },
  2: { size: 4, length: 5, reverse: false, litMs: 360, stepMs: 520 },
  3: { size: 4, length: 5, reverse: true, litMs: 360, stepMs: 520 },
};

/** Đáp án dài nhất hợp lệ = chuỗi dài nhất ở mọi mức. */
const MAX_ANSWER_LENGTH = Math.max(...DIFFICULTIES.map((d) => LEVELS[d].length));
/** Số ô của lưới lớn nhất: chỉ số ô hợp lệ nằm trong [0, MAX_CELLS). */
const MAX_CELLS = Math.max(...DIFFICULTIES.map((d) => LEVELS[d].size ** 2));

/**
 * Thời điểm người chơi bắt đầu được chạm (ms, tính từ lúc câu hiện ra) = hết trình chiếu.
 * Scene và server dùng chung con số này. Mầm 2 900 ms; Thường, Khó, Siêu khó 3 100 ms.
 */
export function lightTrailRevealMs(
  puzzle: Pick<LightTrailPuzzle, "leadMs" | "stepMs" | "sequence">,
): number {
  return puzzle.leadMs + puzzle.sequence.length * puzzle.stepMs;
}

export const lightTrail: MinigameDef<LightTrailPuzzle, LightTrailAnswer> = {
  id: "light-trail",
  category: "memorize",
  // CR-006: vòng 60 s vì mỗi câu có ~3 s trình chiếu không thao tác được.
  durationMs: 60_000,

  /**
   * CR-006: mô phỏng vòng 60 s theo bảng Cân bằng của đặc tả (xem + nhập, tỉ lệ đúng mục tiêu,
   * khoá 1,5 s khi sai, combo trần × 1,5). Hệ số để điểm vòng bằng Thường: Mầm (trẻ 7 tuổi) 1,17;
   * Khó 1,56; Siêu khó 2,19. Mầm giữ 1 để hệ số không bao giờ giảm khi lên mức.
   */
  difficultyMultiplier: { 0: 1, 1: 1, 2: 1.55, 3: 2.2 },
  // Bot (CR-016): thời gian một câu chép từ bảng Cân bằng của đặc tả (Mầm theo trẻ 7 tuổi): xem +
  // nhập + 0,3 s chuyển câu.
  expectedSolveMs: { 0: 5_800, 1: 5_700, 2: 6_500, 3: 7_600 },
  // Bot (CR-016): tỉ lệ đúng chép từ bảng Cân bằng của đặc tả (Mầm theo trẻ 7 tuổi).
  expectedAccuracy: { 0: 0.85, 1: 0.9, 2: 0.8, 3: 0.75 },

  generate(roundSeed, index, difficulty) {
    const level = LEVELS[difficulty];
    const rng = createRng(deriveSeed(roundSeed, index));
    const cells = Array.from({ length: level.size * level.size }, (_, i) => i);
    // Lần duy nhất dùng rng. Cùng cỡ lưới → cùng hoán vị, nên chuỗi Mầm là tiền tố của chuỗi
    // Thường, còn Khó và Siêu khó sáng y hệt nhau (GDD §6, "cùng gốc").
    const sequence = rng.shuffle(cells).slice(0, level.length);
    const expected = level.reverse ? [...sequence].reverse() : [...sequence];

    return {
      cols: level.size,
      rows: level.size,
      sequence,
      expected,
      reverse: level.reverse,
      leadMs: LEAD_MS,
      litMs: level.litMs,
      stepMs: level.stepMs,
    };
  },

  /** Đúng khi và chỉ khi `answer` trùng khít `expected`: cùng độ dài, từng phần tử bằng nhau. */
  check(puzzle, answer) {
    const { expected } = puzzle;
    return answer.length === expected.length && expected.every((cell, i) => answer[i] === cell);
  },

  /** Mảng 1–5 phần tử, mỗi phần tử là số nguyên 0–15 (giới hạn lấy từ bảng tham số). */
  isAnswer(value): value is LightTrailAnswer {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ANSWER_LENGTH) {
      return false;
    }
    // Duyệt theo chỉ số (không dùng every) để mảng thưa cũng bị từ chối.
    for (let i = 0; i < value.length; i++) {
      const cell: unknown = value[i];
      if (typeof cell !== "number" || !Number.isInteger(cell) || cell < 0 || cell >= MAX_CELLS) {
        return false;
      }
    }
    return true;
  },

  /**
   * CR-006: miễn trừ thưởng tốc độ = thời gian trình chiếu, lúc chưa được chạm.
   * Không phụ thuộc `difficulty` vì lịch đã nằm trong câu đố.
   */
  speedAllowanceMs(puzzle) {
    return lightTrailRevealMs(puzzle);
  },
};
