import { LATE_ANSWER_GRACE_MS, MAX_ANSWERS_PER_SECOND, WRONG_ANSWER_LOCK_MS } from "./constants";
import type { Difficulty } from "./difficulty";
import { getGame, isGameId } from "./games";
import type { AnswerPayload, AnswerResultPayload } from "./protocol";
import { gameMultiplier, gameSpeedAllowanceMs, pointsForCorrect } from "./scoring";

/**
 * Trọng tài chấm MỘT câu — luật chung cho phòng party, Kiểm tra não (server) và Luyện tập (web).
 * Hàm thuần: không đọc đồng hồ (truyền `now`), không giữ state, không phụ thuộc Colyseus.
 *
 * Bỏ qua (`outcome = null`) nếu: không ở pha chơi, sai vòng, `index` khác câu đang làm, quá
 * `endsAt + LATE_ANSWER_GRACE_MS`, đang bị khoá sau câu sai, gửi quá `MAX_ANSWERS_PER_SECOND`
 * trong 1 giây, hoặc đáp án sai kiểu (`isAnswer`). Còn lại: sinh lại câu bằng `generate()`,
 * `check()`, đúng thì tính `pointsForCorrect` theo hệ số + miễn trừ của game; đúng hay sai đều
 * sang câu kế. Sai thì mất chuỗi và bị khoá `WRONG_ANSWER_LOCK_MS`; giờ hiện câu kế tính từ lúc hết khoá.
 */

/** Vòng/game đang chơi. */
export interface JudgeRound {
  /** Đang ở pha chơi (server: phase `playing`; luyện tập: đã qua `startAt`). */
  playing: boolean;
  /** Số vòng (party) / thứ tự game (Kiểm tra não) mà `answer.round` phải khớp. */
  round: number;
  gameId: string;
  seed: number;
  startAt: number;
  endsAt: number;
}

/** Trạng thái chấm của một người trong vòng hiện tại. */
export interface JudgeState {
  /** Câu đang làm (= số câu đã trả lời, đúng hoặc sai). */
  progress: number;
  /** Số câu đúng liên tiếp. */
  streak: number;
  /** Lúc câu hiện tại bắt đầu (giờ của `now`); `undefined` = câu đầu, lấy `startAt`. */
  shownAt: number | undefined;
  /** Bị khoá tới thời điểm này (0 = không khoá). */
  lockedUntil: number;
  /** Mốc các đáp án đã đếm cho chống spam (chỉ cần giữ 1 giây gần nhất). */
  recentAnswers: readonly number[];
}

export interface JudgeOutcome {
  /** Gửi lại cho người vừa trả lời (`ServerMessage.AnswerResult`). */
  result: AnswerResultPayload;
  correct: boolean;
  points: number;
}

export interface Judgement {
  /** `null` = bỏ qua: không gửi gì, không sang câu. */
  outcome: JudgeOutcome | null;
  /** State mới — luôn dùng thay state cũ, kể cả khi bỏ qua (bộ đếm chống spam có thể đã đổi). */
  next: JudgeState;
}

/** State đầu vòng: câu 0, không khoá, không chuỗi. */
export function initialJudgeState(): JudgeState {
  return { progress: 0, streak: 0, shownAt: undefined, lockedUntil: 0, recentAnswers: [] };
}

export function judgeAnswer(
  round: JudgeRound,
  difficulty: Difficulty,
  state: JudgeState,
  msg: AnswerPayload,
  now: number,
): Judgement {
  const ignore = (next: JudgeState = state): Judgement => ({ outcome: null, next });
  if (!round.playing || !isGameId(round.gameId)) return ignore();
  if (msg.round !== round.round || msg.index !== state.progress) return ignore();
  if (now > round.endsAt + LATE_ANSWER_GRACE_MS) return ignore();
  if (state.lockedUntil > now) return ignore();

  // Chống spam: mọi đáp án tới được bước này đều được đếm, kể cả đáp án rác.
  const recentAnswers = [...state.recentAnswers.filter((t) => now - t < 1_000), now];
  const counted: JudgeState = { ...state, recentAnswers };
  if (recentAnswers.length > MAX_ANSWERS_PER_SECOND) return ignore(counted);

  const game = getGame(round.gameId);
  if (!game.isAnswer(msg.answer)) return ignore(counted);

  const puzzle = game.generate(round.seed, msg.index, difficulty);
  const correct = game.check(puzzle, msg.answer);
  const result: AnswerResultPayload = { index: msg.index, correct, points: 0 };
  const next: JudgeState = { ...counted, progress: state.progress + 1 };

  if (correct) {
    // Hệ số và miễn trừ thời gian riêng của game (CR-006), tính trên câu vừa sinh lại;
    // giá trị game khai báo sai bị kẹp về mặc định trong gameMultiplier/gameSpeedAllowanceMs.
    result.points = pointsForCorrect({
      difficulty,
      answerMs: now - (state.shownAt ?? round.startAt),
      streak: state.streak,
      multiplier: gameMultiplier(game, difficulty),
      allowanceMs: gameSpeedAllowanceMs(game, puzzle, difficulty),
    });
    next.streak = state.streak + 1;
    next.shownAt = now;
  } else {
    result.lockedUntil = now + WRONG_ANSWER_LOCK_MS;
    next.streak = 0;
    next.lockedUntil = result.lockedUntil;
    next.shownAt = result.lockedUntil;
  }
  return { outcome: { result, correct, points: result.points }, next };
}
