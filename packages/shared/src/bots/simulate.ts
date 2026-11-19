import { gameAnswerWindowMs } from "../answer-judge";
import { LATE_ANSWER_GRACE_MS, WRONG_ANSWER_LOCK_MS } from "../constants";
import type { Difficulty } from "../difficulty";
import { type GameId, getGame } from "../games";
import { createRng } from "../rng";
import { gameMultiplier, gameSpeedAllowanceMs, pointsForCorrect } from "../scoring";
import { botExpectedAccuracy, botExpectedSolveMs, botSeed } from "./index";
import type { BotLevelSpec } from "./levels";
import { planBasicAnswer } from "./models/basic";

/**
 * Mô phỏng cân bằng bot (docs/01-product/bot-players.md mục 6). CHỈ dùng trong test, không export
 * ra ngoài `src/bots/index.ts`. Chấm theo đúng dòng thời gian của `judgeAnswer`: câu 0 hiện lúc
 * `startAt`, câu đúng thì câu sau hiện lúc trả lời, câu sai thì lúc hết khoá `WRONG_ANSWER_LOCK_MS`;
 * trả lời quá hạn `answerWindowMs + LATE_ANSWER_GRACE_MS` bị chấm sai; lần trả lời rơi sau `endsAt`
 * thì dừng (như `BotDriver`). Người chơi mô hình hoá bằng chính lõi model "basic", nên tỉ lệ đúng
 * của người cũng quy theo `expectedAccuracy` của game như bot (`relativeAccuracy`).
 */

/** Một người chơi trong mô phỏng: bot hoặc mô hình người (thông số như một mức bot). */
export interface SimPlayer {
  /** Mã dùng để tạo RNG (`botSeed`), khác nhau giữa các người chơi trong cùng vòng. */
  id: string;
  difficulty: Difficulty;
  timeFactor: BotLevelSpec["timeFactor"];
  /** Tỉ lệ đúng danh nghĩa (ở game chuẩn 90 %), quy theo game bằng `relativeAccuracy`. */
  accuracy: BotLevelSpec["accuracy"];
}

interface QuestionInfo {
  expectedSolveMs: number;
  expectedAccuracy: number;
  allowanceMs: number;
  answerWindowMs: number | undefined;
}

/**
 * Nhớ phần cần cho bot của từng câu (thời gian dự kiến, miễn trừ, hạn), để nhiều vòng dùng chung một
 * seed vòng không phải sinh lại câu đố.
 */
export class QuestionInfoCache {
  private readonly cache = new Map<string, QuestionInfo>();

  get(gameId: GameId, difficulty: Difficulty, roundSeed: number, index: number): QuestionInfo {
    const key = `${gameId}|${difficulty}|${roundSeed}|${index}`;
    let info = this.cache.get(key);
    if (!info) {
      const game = getGame(gameId);
      const puzzle = game.generate(roundSeed, index, difficulty);
      info = {
        expectedSolveMs: botExpectedSolveMs(game, puzzle, difficulty),
        expectedAccuracy: botExpectedAccuracy(game, difficulty),
        allowanceMs: gameSpeedAllowanceMs(game, puzzle, difficulty),
        answerWindowMs: gameAnswerWindowMs(game, puzzle, difficulty),
      };
      this.cache.set(key, info);
    }
    return info;
  }
}

export interface SimRoundResult {
  score: number;
  answered: number;
  correct: number;
}

/**
 * Điểm một vòng của `player` ở game `gameId`, seed vòng `roundSeed`. `durationMs` mặc định là
 * thời lượng vòng party của game; Kiểm tra não truyền `brainTestDurationMs` (mô phỏng kinh tế phấn).
 */
export function simulateRound(
  gameId: GameId,
  roundSeed: number,
  player: SimPlayer,
  cache: QuestionInfoCache,
  durationMs?: number,
): SimRoundResult {
  const game = getGame(gameId);
  const { difficulty } = player;
  const multiplier = gameMultiplier(game, difficulty);
  const endsAt = durationMs ?? game.durationMs;
  let shownAt = 0;
  let streak = 0;
  const result: SimRoundResult = { score: 0, answered: 0, correct: 0 };

  for (let index = 0; ; index++) {
    const info = cache.get(gameId, difficulty, roundSeed, index);
    const rng = createRng(botSeed(roundSeed, player.id, index));
    const plan = planBasicAnswer({ ...info, rng }, player);
    const answerAt = shownAt + plan.delayMs;
    if (answerAt > endsAt) break;

    result.answered++;
    const late =
      info.answerWindowMs !== undefined &&
      plan.delayMs > info.answerWindowMs + LATE_ANSWER_GRACE_MS;
    if (plan.correct && !late) {
      result.correct++;
      result.score += pointsForCorrect({
        difficulty,
        answerMs: plan.delayMs,
        streak,
        multiplier,
        allowanceMs: info.allowanceMs,
      });
      streak++;
      shownAt = answerAt;
    } else {
      streak = 0;
      shownAt = answerAt + WRONG_ANSWER_LOCK_MS;
    }
  }
  return result;
}
