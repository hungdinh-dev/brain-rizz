import type { Difficulty } from "../difficulty";
import type { Rng } from "../rng";

/**
 * Mức bot (CR-016): 0 = Dễ, 1 = Vừa, 2 = Khó, 3 = Siêu. Tên hiển thị nằm ở i18n của web.
 * Thông số từng mức ở `BOT_LEVEL_SPECS` (`levels.ts`).
 */
export type BotLevel = 0 | 1 | 2 | 3;

export const BOT_LEVELS: readonly BotLevel[] = [0, 1, 2, 3];

export function isBotLevel(value: unknown): value is BotLevel {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

/**
 * Dữ liệu model bot cần để quyết định MỘT câu. Bot không giải câu đố: chỉ cần câu để biết
 * miễn trừ, hạn trả lời và thời gian dự kiến (docs/01-product/bot-players.md mục 3.2).
 */
export interface BotAnswerContext {
  gameId: string;
  /** Độ khó câu đố bot chơi (theo mức, `botDifficulty`). */
  difficulty: Difficulty;
  level: BotLevel;
  /** Câu thứ mấy trong vòng. */
  index: number;
  /** Thời gian một câu của người chơi mục tiêu ở độ khó này (`botExpectedSolveMs`). */
  expectedSolveMs: number;
  /**
   * Tỉ lệ đúng của người chơi chuẩn ở game và độ khó này (`botExpectedAccuracy`), chưa kẹp. Model
   * quy tỉ lệ đúng của mức theo số này bằng `relativeAccuracy` (đã kẹp ở `BOT_MAX_BASE_ACCURACY`),
   * không dùng thẳng: số này có thể là 1.
   */
  expectedAccuracy: number;
  /** Miễn trừ thưởng tốc độ của câu (`gameSpeedAllowanceMs`): bot không trả lời sớm hơn mức này. */
  allowanceMs: number;
  /** Hạn trả lời của câu (`gameAnswerWindowMs`), `undefined` = không giới hạn. Trả lời muộn bị chấm sai như người. */
  answerWindowMs: number | undefined;
  /** RNG riêng của bot cho câu này (`createRng(botSeed(...))`), không phải RNG câu đố. */
  rng: Rng;
}

/** Kế hoạch trả lời một câu: trả lời sau `delayMs` (tính từ lúc câu hiện ra) và đúng hay sai. */
export interface BotAnswerPlan {
  /** Số nguyên ms ≥ 0, tính từ giờ hiện câu (như `answerMs` của người). */
  delayMs: number;
  correct: boolean;
}

/**
 * Model bot: hàm thuần, tất định theo `ctx` (mọi ngẫu nhiên lấy từ `ctx.rng`). Thêm model mới chỉ
 * cần thêm file trong `models/` và đăng ký vào `BOT_MODELS`, không sửa server.
 */
export interface BotModel {
  id: string;
  planAnswer(ctx: BotAnswerContext): BotAnswerPlan;
}
