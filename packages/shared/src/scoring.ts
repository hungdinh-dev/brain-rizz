import { DIFFICULTY_MULTIPLIER, type Difficulty } from "./difficulty";
import type { MinigameDef } from "./games/types";

export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 50;
/** Trả lời trong vòng ngần này ms thì được trọn thưởng tốc độ. */
export const FAST_ANSWER_MS = 1_500;
/** Sau ngần này ms thì không còn thưởng tốc độ. */
export const SLOW_ANSWER_MS = 8_000;
export const STREAK_THRESHOLD = 3;
export const STREAK_BONUS_PER_STEP = 0.1;
/** Trần hệ số combo (CR-006): từ câu đúng liên tiếp thứ 7 trở đi giữ × 1,5. */
export const MAX_COMBO_MULTIPLIER = 1.5;

export interface ScoreInput {
  difficulty: Difficulty;
  /** Thời gian từ lúc câu hiện ra tới lúc trả lời (ms). */
  answerMs: number;
  /** Số câu đúng liên tiếp TRƯỚC câu này. */
  streak: number;
  /** Hệ số độ khó của game (CR-006). Không truyền → `DIFFICULTY_MULTIPLIER[difficulty]`. */
  multiplier?: number;
  /** Số ms miễn trừ trước khi tính thưởng tốc độ (CR-006), số hữu hạn ≥ 0. Mặc định 0. */
  allowanceMs?: number;
}

/** Hệ số combo cho câu đúng khi đã có `streak` câu đúng liên tiếp trước đó (×1 → ×1,1 … tối đa ×1,5). */
export function comboMultiplier(streak: number): number {
  const steps = Math.max(0, streak + 1 - (STREAK_THRESHOLD - 1));
  return Math.min(MAX_COMBO_MULTIPLIER, 1 + steps * STREAK_BONUS_PER_STEP);
}

/**
 * Điểm cho một câu trả lời đúng. Câu sai = 0 điểm (chỉ bị khoá thao tác).
 * Điểm = (BASE_POINTS × hệ số độ khó + thưởng tốc độ) × hệ số combo, làm tròn.
 * Thưởng tốc độ tính trên `max(0, answerMs − allowanceMs)`.
 */
export function pointsForCorrect({
  difficulty,
  answerMs,
  streak,
  multiplier = DIFFICULTY_MULTIPLIER[difficulty],
  allowanceMs = 0,
}: ScoreInput): number {
  const elapsed = Math.max(0, answerMs - allowanceMs);
  const t = Math.min(Math.max(elapsed, FAST_ANSWER_MS), SLOW_ANSWER_MS);
  const speedBonus = Math.round(
    (MAX_SPEED_BONUS * (SLOW_ANSWER_MS - t)) / (SLOW_ANSWER_MS - FAST_ANSWER_MS),
  );
  return Math.round((BASE_POINTS * multiplier + speedBonus) * comboMultiplier(streak));
}

/**
 * Hệ số độ khó của một game (CR-006). Game không khai báo, hoặc khai báo giá trị không phải
 * số dương hữu hạn, thì dùng `DIFFICULTY_MULTIPLIER` chung. Server chấm và web hiển thị cùng dùng hàm này.
 */
export function gameMultiplier(
  game: Pick<MinigameDef<unknown, unknown>, "difficultyMultiplier">,
  difficulty: Difficulty,
): number {
  const value = game.difficultyMultiplier?.[difficulty];
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : DIFFICULTY_MULTIPLIER[difficulty];
}

/**
 * Số ms miễn trừ thưởng tốc độ của câu đố này (CR-006), kẹp về số hữu hạn ≥ 0:
 * game không khai báo, hoặc trả về số âm / NaN / vô cực, thì coi như 0.
 * `puzzle` phải là câu server tự sinh lại, không phải dữ liệu client gửi.
 */
export function gameSpeedAllowanceMs<Puzzle>(
  game: Pick<MinigameDef<Puzzle, unknown>, "speedAllowanceMs">,
  puzzle: Puzzle,
  difficulty: Difficulty,
): number {
  const value = game.speedAllowanceMs?.(puzzle, difficulty) ?? 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Điểm trận theo thứ hạng trong vòng (8 người: 10, 8, 6, 5, 4, 3, 2, 1). */
const PLACEMENT_POINTS = [10, 8, 6, 5, 4, 3, 2, 1] as const;

export function placementPoints(rank: number): number {
  return PLACEMENT_POINTS[rank] ?? 0;
}
