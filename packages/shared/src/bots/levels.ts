import { BOT_BASE_ACCURACY, BOT_MAX_ACCURACY, BOT_MAX_BASE_ACCURACY } from "../constants";
import type { Difficulty } from "../difficulty";
import type { BotLevel } from "./types";

/** Thông số của một mức bot. */
export interface BotLevelSpec {
  /** Độ khó câu đố bot chơi. */
  difficulty: Difficulty;
  /** Thời gian nghĩ = thời gian dự kiến của câu × hệ số này (trước khi cộng nhiễu). */
  timeFactor: number;
  /**
   * Tỉ lệ đúng **danh nghĩa**, trong (0, 1): tỉ lệ đúng của mức ở game mà người chơi chuẩn đúng
   * `BOT_BASE_ACCURACY` (90 %). Ở game khác, tỉ lệ đúng thật là
   * `relativeAccuracy(accuracy, tỉ lệ chuẩn của game)`.
   */
  accuracy: number;
}

/**
 * Quy tỉ lệ đúng danh nghĩa (ở game chuẩn 90 %) về game có tỉ lệ đúng chuẩn `baseAccuracy`
 * (`expectedAccuracy[độ khó]` của game). Công thức **giữ tỉ số tỉ lệ sai** so với người chuẩn:
 *
 *   A = min(baseAccuracy, BOT_MAX_BASE_ACCURACY)
 *   hệ số sai = (1 − nominal) / (1 − BOT_BASE_ACCURACY)
 *   tỉ lệ đúng = kẹp(1 − (1 − A) × hệ số sai, 0, BOT_MAX_ACCURACY)
 *
 * Kẹp `A` ở `BOT_MAX_BASE_ACCURACY` (98 %) TRƯỚC khi nhân là bắt buộc: game khai báo `A` = 1 (không
 * có cách sai) thì 1 − A = 0, mọi mức cùng ra trần 99 % và bot Dễ đúng như bot Siêu. Sau khi kẹp,
 * ở mọi game bot Dễ sai ít nhất 4,4 %, bot Siêu ít nhất 1,6 % (vẫn đúng tỉ số 2,2 / 0,8).
 *
 * Ví dụ Siêu (danh nghĩa 92 %, tức sai bằng 0,8 lần người chuẩn): game chuẩn 90 % → 92 %; Lật cặp
 * ở Siêu khó chuẩn 68 % → 74,4 %; Luyện ngắm chuẩn 92 % → 93,6 %. Dễ (78 %, sai gấp 2,2 lần):
 * game chuẩn 85 % → 67 %; game chuẩn 98 % hay 100 % → 95,6 %. Danh nghĩa bằng `BOT_BASE_ACCURACY`
 * thì ra đúng tỉ lệ chuẩn của game (trừ khi bị kẹp). Thuần, tất định, chỉ dùng cộng trừ nhân chia.
 */
export function relativeAccuracy(nominal: number, baseAccuracy: number): number {
  const base = Math.min(baseAccuracy, BOT_MAX_BASE_ACCURACY);
  const errorRatio = (1 - nominal) / (1 - BOT_BASE_ACCURACY);
  const value = 1 - (1 - base) * errorRatio;
  return Math.min(BOT_MAX_ACCURACY, Math.max(0, value));
}

/**
 * Bảng mức bot, docs/01-product/bot-players.md mục 3.1. Mốc so sánh là người chơi chuẩn: giải mỗi
 * câu hết đúng `expectedSolveMs` của game, đúng đúng `expectedAccuracy` của game (không khai báo
 * thì `BOT_BASE_ACCURACY`). Tỉ lệ đúng ở đây là danh nghĩa (game chuẩn 90 %), quy theo từng game
 * bằng `relativeAccuracy`. Chỉnh sau mô phỏng (`balance-sim.test.ts`) hay chơi thử thì CHỈ sửa số ở
 * đây, rồi cập nhật bảng 3.1.
 *
 * Lịch sử chỉnh (kế hoạch bản 0.3 → 0.5, 2026-10-21):
 * - Vừa **T × 1 / 90 %** = đúng người chơi chuẩn (bản 0.2: T × 1,15 / 82 %, người chuẩn thắng
 *   81–97 % số vòng; game nhiều câu như Luyện ngắm ít dao động nên lệch vài phần trăm là ra khỏi
 *   khoảng 40–60 %).
 * - Khó **T × 0,9 / 90 %** (bản 0.2: T × 0,95 / 88 %, chỉ hơn Vừa ~14 %).
 * - Bản 0.5: tỉ lệ đúng thành tương đối theo game (trước đó là số chung, nên ở game người giỏi chỉ
 *   đúng 68–75 % ở Siêu khó thì bot Siêu 92 % gần như bất bại). Dễ nới từ T × 1,5 / 70 % thành
 *   **T × 1,2 / 78 %** theo quyết định của chủ dự án.
 * - Bản 0.6 (lỗi QA): `relativeAccuracy` kẹp tỉ lệ chuẩn ở `BOT_MAX_BASE_ACCURACY` (98 %) trước khi
 *   nhân; Luyện ngắm khai báo Mầm 1 làm bot Dễ đúng 99 % như bot Siêu. Bảng mức không đổi.
 */
export const BOT_LEVEL_SPECS: Readonly<Record<BotLevel, BotLevelSpec>> = {
  0: { difficulty: 0, timeFactor: 1.2, accuracy: 0.78 },
  1: { difficulty: 1, timeFactor: 1, accuracy: 0.9 },
  2: { difficulty: 2, timeFactor: 0.9, accuracy: 0.9 },
  3: { difficulty: 3, timeFactor: 0.8, accuracy: 0.92 },
};

/** Độ khó câu đố bot ở mức này chơi (Dễ → Mầm … Siêu → Siêu khó). Không đổi được trong trận. */
export function botDifficulty(level: BotLevel): Difficulty {
  return BOT_LEVEL_SPECS[level].difficulty;
}
