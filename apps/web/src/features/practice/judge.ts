import {
  type AnswerResultPayload,
  type Difficulty,
  type GameId,
  initialJudgeState,
  type JudgeState,
  judgeAnswer,
} from "@brain-rizz/shared";

/**
 * Trọng tài chạy trên máy cho Luyện tập (UC-13, FR-MR-01). Luật chấm một câu là `judgeAnswer` của
 * `@brain-rizz/shared` — đúng hàm mà game server dùng — nên khoá khi sai, chống spam, dung sai hết
 * giờ, điểm (hệ số + miễn trừ của game, combo) giống hệt phòng party. File này chỉ cộng dồn số liệu
 * riêng của lượt luyện tập (điểm, số câu đúng/sai, chuỗi dài nhất).
 *
 * Hàm thuần: không đọc đồng hồ (truyền `now`). Điểm luyện tập do client tự chấm nên KHÔNG lên
 * bảng xếp hạng.
 */

export interface PracticeRound {
  gameId: GameId;
  seed: number;
  difficulty: Difficulty;
  /** Mốc bắt đầu chơi / hết giờ (ms, cùng đồng hồ với `now`). */
  startAt: number;
  endsAt: number;
}

/** Luyện tập chỉ có một "vòng"; số này đi vào `answer.round` cho khớp luật chung. */
const PRACTICE_ROUND = 1;

export interface PracticeProgress extends JudgeState {
  /** Chuỗi đúng dài nhất của lượt. */
  bestStreak: number;
  score: number;
  correct: number;
  wrong: number;
}

export function initialProgress(_round: PracticeRound): PracticeProgress {
  return { ...initialJudgeState(), bestStreak: 0, score: 0, correct: 0, wrong: 0 };
}

export interface JudgeResult {
  /** State mới — luôn thay state cũ, kể cả khi bỏ qua (bộ đếm chống spam có thể đã đổi). */
  state: PracticeProgress;
  /** `null` = bỏ qua (giống server: không có kết quả, không sang câu). */
  result: AnswerResultPayload | null;
}

/** Chấm một đáp án bằng luật chung của shared. */
export function judgePracticeAnswer(
  round: PracticeRound,
  state: PracticeProgress,
  index: number,
  answer: unknown,
  now: number,
): JudgeResult {
  const { outcome, next } = judgeAnswer(
    {
      playing: now >= round.startAt,
      round: PRACTICE_ROUND,
      gameId: round.gameId,
      seed: round.seed,
      startAt: round.startAt,
      endsAt: round.endsAt,
    },
    round.difficulty,
    state,
    { round: PRACTICE_ROUND, index, answer },
    now,
  );
  if (!outcome) return { state: { ...state, ...next }, result: null };
  return {
    state: {
      ...state,
      ...next,
      bestStreak: Math.max(state.bestStreak, next.streak),
      score: state.score + outcome.points,
      correct: state.correct + (outcome.correct ? 1 : 0),
      wrong: state.wrong + (outcome.correct ? 0 : 1),
    },
    result: outcome.result,
  };
}

/** Seed ngẫu nhiên cho một lượt luyện tập (không dùng `Math.random`). */
export function practiceSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] ?? 0;
}
