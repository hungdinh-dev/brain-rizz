import { DIFFICULTY_MULTIPLIER, type Difficulty } from "./difficulty";

export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 50;
/** Trả lời trong vòng ngần này ms thì được trọn thưởng tốc độ. */
export const FAST_ANSWER_MS = 1_500;
/** Sau ngần này ms thì không còn thưởng tốc độ. */
export const SLOW_ANSWER_MS = 8_000;
export const STREAK_THRESHOLD = 3;
export const STREAK_BONUS_PER_STEP = 0.1;

export interface ScoreInput {
  difficulty: Difficulty;
  /** Thời gian từ lúc câu hiện ra tới lúc trả lời (ms). */
  answerMs: number;
  /** Số câu đúng liên tiếp TRƯỚC câu này. */
  streak: number;
}

/** Điểm cho một câu trả lời đúng. Câu sai = 0 điểm (chỉ bị khoá thao tác). */
export function pointsForCorrect({ difficulty, answerMs, streak }: ScoreInput): number {
  const t = Math.min(Math.max(answerMs, FAST_ANSWER_MS), SLOW_ANSWER_MS);
  const speedBonus = Math.round(
    (MAX_SPEED_BONUS * (SLOW_ANSWER_MS - t)) / (SLOW_ANSWER_MS - FAST_ANSWER_MS),
  );
  const comboSteps = Math.max(0, streak + 1 - (STREAK_THRESHOLD - 1));
  const combo = 1 + comboSteps * STREAK_BONUS_PER_STEP;
  return Math.round((BASE_POINTS * DIFFICULTY_MULTIPLIER[difficulty] + speedBonus) * combo);
}

/** Điểm trận theo thứ hạng trong vòng (8 người: 10, 8, 6, 5, 4, 3, 2, 1). */
const PLACEMENT_POINTS = [10, 8, 6, 5, 4, 3, 2, 1] as const;

export function placementPoints(rank: number): number {
  return PLACEMENT_POINTS[rank] ?? 0;
}
