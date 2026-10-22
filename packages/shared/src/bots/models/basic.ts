import { BOT_MIN_REACTION_MS } from "../../constants";
import type { Rng } from "../../rng";
import { BOT_LEVEL_SPECS, type BotLevelSpec, relativeAccuracy } from "../levels";
import type { BotAnswerContext, BotAnswerPlan, BotModel } from "../types";

/** Độ lệch chuẩn của nhiễu log-normal trên thời gian nghĩ (σ của ln), mục 3.2. */
export const BASIC_BOT_NOISE_SIGMA = 0.25;
/** Cắt nhiễu ở ±3σ (× 0,47 … × 2,1) để không có câu nhanh hay chậm vô lý. */
const MAX_NOISE_Z = 3;

/** Số ngẫu nhiên phân phối chuẩn tắc (Box–Muller), cắt ở ±`MAX_NOISE_Z`. Dùng đúng 2 lần `rng.next()`. */
function standardNormal(rng: Rng): number {
  const u1 = 1 - rng.next(); // (0, 1]: tránh log(0)
  const u2 = rng.next();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.min(MAX_NOISE_Z, Math.max(-MAX_NOISE_Z, z));
}

/**
 * Lõi của model "basic", nhận thông số mức tuỳ ý (mô phỏng cân bằng dùng lại để mô hình người chơi):
 * - `delayMs` = thời gian dự kiến × `timeFactor` × e^(σ·Z), làm tròn ms, không dưới
 *   `allowanceMs + BOT_MIN_REACTION_MS` (không ai trả lời được khi câu còn đang trình chiếu);
 * - `correct` đúng với xác suất `relativeAccuracy(spec.accuracy, ctx.expectedAccuracy)`: tỉ lệ
 *   đúng danh nghĩa của mức quy theo tỉ lệ đúng chuẩn của game và độ khó (`levels.ts`).
 * Nhiễu có trung vị 1, nên trung vị thời gian nghĩ đúng bằng thời gian dự kiến × hệ số.
 * Thứ tự gọi rng cố định (2 lần cho nhiễu, 1 lần cho đúng/sai) để kế hoạch tất định.
 */
export function planBasicAnswer(
  ctx: Pick<BotAnswerContext, "expectedSolveMs" | "expectedAccuracy" | "allowanceMs" | "rng">,
  spec: Pick<BotLevelSpec, "timeFactor" | "accuracy">,
): BotAnswerPlan {
  const noise = Math.exp(BASIC_BOT_NOISE_SIGMA * standardNormal(ctx.rng));
  const correct = ctx.rng.next() < relativeAccuracy(spec.accuracy, ctx.expectedAccuracy);
  const thinkMs = ctx.expectedSolveMs * spec.timeFactor * noise;
  const floorMs = ctx.allowanceMs + BOT_MIN_REACTION_MS;
  return { delayMs: Math.round(Math.max(floorMs, thinkMs)), correct };
}

/**
 * Model bot v1: mạnh đều ở mọi game so với người chơi chuẩn của game đó, thông số theo
 * `BOT_LEVEL_SPECS` (tỉ lệ đúng quy theo `expectedAccuracy` của game). Không xét hạn trả lời:
 * trả lời quá `answerWindowMs` thì trọng tài chấm sai như người (mục 3.2).
 */
export const basicBotModel: BotModel = {
  id: "basic",
  planAnswer(ctx) {
    return planBasicAnswer(ctx, BOT_LEVEL_SPECS[ctx.level]);
  },
};
