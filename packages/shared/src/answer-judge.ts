import { LATE_ANSWER_GRACE_MS, MAX_ANSWERS_PER_SECOND, WRONG_ANSWER_LOCK_MS } from "./constants";
import type { Difficulty } from "./difficulty";
import { getGame, isGameId } from "./games";
import type { AnyMinigame } from "./games/types";
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
 *
 * Game có hạn trả lời (`answerWindowMs`, CR-012: vật biến mất như bia Luyện ngắm): đáp án tới
 * muộn hơn lúc câu bắt đầu + hạn + `LATE_ANSWER_GRACE_MS` bị chấm SAI như bỏ lỡ, dù `check` đúng.
 *
 * Bot (CR-016, ADR 0014) chấm bằng `judgeBotAnswer`: bỏ `isAnswer`/`check` và chống spam, còn lại
 * (giờ hiện câu, hạn trả lời, thưởng tốc độ, hệ số, combo, khoá khi sai) đi CÙNG đường với người.
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

/**
 * Hạn trả lời của câu (ms) theo game, kẹp về số hữu hạn > 0; game không khai báo, hoặc trả
 * `undefined` / số không hợp lệ, thì không giới hạn (`undefined`). `puzzle` là câu server tự sinh lại.
 */
export function gameAnswerWindowMs<Puzzle>(
  game: { answerWindowMs?(puzzle: Puzzle, difficulty: Difficulty): number | undefined },
  puzzle: Puzzle,
  difficulty: Difficulty,
): number | undefined {
  const value = game.answerWindowMs?.(puzzle, difficulty);
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined;
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

  return settleAnswer(
    round,
    difficulty,
    counted,
    game,
    (puzzle) => game.check(puzzle, msg.answer),
    now,
  );
}

/** Câu trả lời của bot (CR-016): server đã bốc trước đúng hay sai, không có đáp án thật. */
export interface BotAnswer {
  /** Câu bot trả lời; phải bằng `state.progress`, khác thì bỏ qua. */
  index: number;
  /** Đúng hay sai theo kế hoạch của model bot. Tới muộn hơn hạn trả lời thì vẫn bị chấm sai. */
  correct: boolean;
}

/**
 * Chấm một câu của bot (CR-016). Bỏ qua `isAnswer`/`check` (bot không gửi đáp án) và bộ chống
 * spam (server tự hẹn giờ, mỗi câu một lần); `recentAnswers` giữ nguyên. Vẫn bỏ qua (`outcome =
 * null`) khi: không ở pha chơi, `index` khác câu đang làm, quá `endsAt + LATE_ANSWER_GRACE_MS`,
 * đang bị khoá. Phần còn lại (giờ hiện câu, hạn trả lời, thưởng tốc độ, hệ số + miễn trừ, combo,
 * khoá khi sai, sang câu kế) dùng chung `settleAnswer` với `judgeAnswer`, nên cùng thời gian và
 * cùng đúng/sai thì bot được đúng số điểm của người.
 */
export function judgeBotAnswer(
  round: JudgeRound,
  difficulty: Difficulty,
  state: JudgeState,
  answer: BotAnswer,
  now: number,
): Judgement {
  const ignore: Judgement = { outcome: null, next: state };
  if (!round.playing || !isGameId(round.gameId)) return ignore;
  if (answer.index !== state.progress) return ignore;
  if (now > round.endsAt + LATE_ANSWER_GRACE_MS) return ignore;
  if (state.lockedUntil > now) return ignore;
  return settleAnswer(round, difficulty, state, getGame(round.gameId), () => answer.correct, now);
}

/**
 * Phần chung sau khi đáp án đã qua các bước bỏ qua: sinh lại câu `state.progress`, xét hạn trả
 * lời, chấm (`solved` chỉ được gọi khi chưa muộn), tính điểm theo hệ số + miễn trừ + combo,
 * khoá khi sai, sang câu kế.
 */
function settleAnswer(
  round: JudgeRound,
  difficulty: Difficulty,
  state: JudgeState,
  game: AnyMinigame,
  solved: (puzzle: unknown) => boolean,
  now: number,
): Judgement {
  const index = state.progress;
  const puzzle = game.generate(round.seed, index, difficulty);
  const shownAt = state.shownAt ?? round.startAt;
  const windowMs = gameAnswerWindowMs(game, puzzle, difficulty);
  const late = windowMs !== undefined && now - shownAt > windowMs + LATE_ANSWER_GRACE_MS;
  const correct = !late && solved(puzzle);
  const result: AnswerResultPayload = { index, correct, points: 0 };
  const next: JudgeState = { ...state, progress: index + 1 };

  if (correct) {
    // Hệ số và miễn trừ thời gian riêng của game (CR-006), tính trên câu vừa sinh lại;
    // giá trị game khai báo sai bị kẹp về mặc định trong gameMultiplier/gameSpeedAllowanceMs.
    result.points = pointsForCorrect({
      difficulty,
      answerMs: now - shownAt,
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
