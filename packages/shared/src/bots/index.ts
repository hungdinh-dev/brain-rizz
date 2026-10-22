import { gameAnswerWindowMs } from "../answer-judge";
import { BOT_BASE_ACCURACY, BOT_BASE_SOLVE_MS } from "../constants";
import { DIFFICULTY_MULTIPLIER, type Difficulty } from "../difficulty";
import { getGame, isGameId } from "../games";
import type { MinigameDef } from "../games/types";
import { createRng, deriveSeed } from "../rng";
import { gameMultiplier, gameSpeedAllowanceMs } from "../scoring";
import { botDifficulty } from "./levels";
import { basicBotModel } from "./models/basic";
import type { BotAnswerContext, BotAnswerPlan, BotLevel, BotModel } from "./types";

/**
 * Bot (CR-016, docs/01-product/bot-players.md): bot KHÔNG giải câu đố. Với mỗi câu, model bốc thời
 * gian trả lời và đúng/sai, server chấm qua cùng đường với người (`judgeBotAnswer`).
 * Mọi hàm ở đây thuần và tất định; ngẫu nhiên chỉ qua `createRng(botSeed(...))`, không đụng
 * seed câu đố (bất biến 1).
 */

export * from "./levels";
export * from "./models/basic";
export * from "./types";

/** Các model bot đã đăng ký. Thêm model: tạo `models/<id>.ts` rồi thêm một dòng ở đây. */
export const BOT_MODELS = {
  basic: basicBotModel,
} as const satisfies Record<string, BotModel>;

export type BotModelId = keyof typeof BOT_MODELS;

export const BOT_MODEL_IDS = Object.keys(BOT_MODELS) as [BotModelId, ...BotModelId[]];

export const DEFAULT_BOT_MODEL_ID: BotModelId = "basic";

export function isBotModelId(value: unknown): value is BotModelId {
  return typeof value === "string" && Object.hasOwn(BOT_MODELS, value);
}

/** Model theo id; không truyền hoặc id lạ thì dùng `DEFAULT_BOT_MODEL_ID`. */
export function getBotModel(id?: string): BotModel {
  return isBotModelId(id) ? BOT_MODELS[id] : BOT_MODELS[DEFAULT_BOT_MODEL_ID];
}

/**
 * Thời gian một câu (ms) bot lấy làm mốc: `expectedSolveMs` game khai báo (số dương hữu hạn),
 * không có thì ước lượng `BOT_BASE_SOLVE_MS × hệ số độ khó của game + miễn trừ của câu`.
 * `puzzle` là câu server tự sinh lại.
 */
export function botExpectedSolveMs<Puzzle>(
  game: Pick<
    MinigameDef<Puzzle, unknown>,
    "expectedSolveMs" | "difficultyMultiplier" | "speedAllowanceMs"
  >,
  puzzle: Puzzle,
  difficulty: Difficulty,
): number {
  const declared = game.expectedSolveMs?.[difficulty];
  if (declared !== undefined && Number.isFinite(declared) && declared > 0) return declared;
  return (
    BOT_BASE_SOLVE_MS * gameMultiplier(game, difficulty) +
    gameSpeedAllowanceMs(game, puzzle, difficulty)
  );
}

/**
 * Tỉ lệ đúng của người chơi chuẩn ở game và độ khó này, làm mốc cho tỉ lệ đúng của bot
 * (`relativeAccuracy`): `expectedAccuracy` game khai báo (số hữu hạn trong (0, 1]), không có hoặc
 * không hợp lệ thì `BOT_BASE_ACCURACY`. Trả nguyên số khai báo; số trên `BOT_MAX_BASE_ACCURACY` do
 * `relativeAccuracy` kẹp trước khi nhân hệ số sai.
 */
export function botExpectedAccuracy(
  game: Pick<MinigameDef<unknown, unknown>, "expectedAccuracy">,
  difficulty: Difficulty,
): number {
  const declared = game.expectedAccuracy?.[difficulty];
  return declared !== undefined && Number.isFinite(declared) && declared > 0 && declared <= 1
    ? declared
    : BOT_BASE_ACCURACY;
}

/** Băm FNV-1a 32 bit của mã bot. */
function hashBotId(botId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < botId.length; i++) {
    h = Math.imul(h ^ botId.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h;
}

/** Trộn vào seed vòng để seed của bot không bao giờ trùng dãy seed câu đố `deriveSeed(seed, index)`. */
const BOT_SEED_SALT = 0x5b07b075;

/**
 * Seed RNG của bot `botId` cho câu `index` trong vòng `roundSeed`: cùng vòng thì bot chơi giống hệt
 * nhau, hai bot khác mã chơi khác nhau. Chỉ dùng cho `createRng` của bot, không bao giờ cho câu đố.
 */
export function botSeed(roundSeed: number, botId: string, index: number): number {
  return deriveSeed((roundSeed ^ BOT_SEED_SALT) >>> 0, index, hashBotId(botId));
}

export interface PlanBotAnswerInput {
  /** Model bot, mặc định `DEFAULT_BOT_MODEL_ID`. */
  modelId?: string;
  level: BotLevel;
  gameId: string;
  roundSeed: number;
  botId: string;
  /** Câu bot sắp trả lời (= tiến độ của bot trong vòng). */
  index: number;
}

/**
 * Dựng `BotAnswerContext` cho câu `index`: sinh lại câu bằng `generate(roundSeed, index,
 * botDifficulty(level))` để lấy miễn trừ, hạn trả lời và thời gian dự kiến; tỉ lệ đúng chuẩn của
 * game; RNG riêng của bot. Game lạ (không có trong `GAMES`) thì không ném lỗi: dùng ước lượng
 * chung, tỉ lệ đúng chung, miễn trừ 0, không hạn.
 */
export function botAnswerContext(input: PlanBotAnswerInput): BotAnswerContext {
  const { level, gameId, roundSeed, botId, index } = input;
  const difficulty = botDifficulty(level);
  const rng = createRng(botSeed(roundSeed, botId, index));
  const base = { gameId, difficulty, level, index, rng };
  if (!isGameId(gameId)) {
    return {
      ...base,
      expectedSolveMs: BOT_BASE_SOLVE_MS * DIFFICULTY_MULTIPLIER[difficulty],
      expectedAccuracy: BOT_BASE_ACCURACY,
      allowanceMs: 0,
      answerWindowMs: undefined,
    };
  }
  const game = getGame(gameId);
  const puzzle = game.generate(roundSeed, index, difficulty);
  return {
    ...base,
    expectedSolveMs: botExpectedSolveMs(game, puzzle, difficulty),
    expectedAccuracy: botExpectedAccuracy(game, difficulty),
    allowanceMs: gameSpeedAllowanceMs(game, puzzle, difficulty),
    answerWindowMs: gameAnswerWindowMs(game, puzzle, difficulty),
  };
}

/**
 * Kế hoạch trả lời câu `index` của một bot: trả lời sau `delayMs` (tính từ giờ hiện câu, như
 * `AnswerJudge` dùng cho người) và đúng hay sai. Server hẹn giờ rồi chấm bằng `judgeBotAnswer`.
 */
export function planBotAnswer(input: PlanBotAnswerInput): BotAnswerPlan {
  return getBotModel(input.modelId).planAnswer(botAnswerContext(input));
}
