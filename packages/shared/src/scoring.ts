import { DIFFICULTY_MULTIPLIER, type Difficulty } from "./difficulty";
import type { MinigameDef } from "./games/types";
import { DEFAULT_SCORING, type ScoringConfig } from "./party-config";

/**
 * Công thức điểm. Mọi hàm nhận `scoring` (CR-019): trận party truyền cấu hình admin của trận,
 * Luyện tập và Kiểm tra não không truyền → `DEFAULT_SCORING` (công thức chuẩn, các hằng số
 * `BASE_POINTS`, `MAX_SPEED_BONUS`… khai báo ở `party-config.ts`, xuất lại ở đây).
 */
export {
  BASE_POINTS,
  FAST_ANSWER_MS,
  MAX_COMBO_MULTIPLIER,
  MAX_SPEED_BONUS,
  SLOW_ANSWER_MS,
  STREAK_BONUS_PER_STEP,
  STREAK_THRESHOLD,
} from "./party-config";

export interface ScoreInput {
  difficulty: Difficulty;
  /** Thời gian từ lúc câu hiện ra tới lúc trả lời (ms). */
  answerMs: number;
  /** Số câu đúng liên tiếp TRƯỚC câu này. */
  streak: number;
  /** Hệ số độ khó của game (CR-006). Không truyền → `scoring.difficultyMultiplier[difficulty]`. */
  multiplier?: number;
  /** Số ms miễn trừ trước khi tính thưởng tốc độ (CR-006), số hữu hạn ≥ 0. Mặc định 0. */
  allowanceMs?: number;
}

/**
 * Hệ số combo cho câu đúng khi đã có `streak` câu đúng liên tiếp trước đó. Chuẩn: ×1 → ×1,1 …
 * tối đa ×1,5 (từ câu đúng liên tiếp thứ `streakThreshold` mỗi câu cộng `streakBonusPerStep`).
 */
export function comboMultiplier(streak: number, scoring: ScoringConfig = DEFAULT_SCORING): number {
  const steps = Math.max(0, streak + 1 - (scoring.streakThreshold - 1));
  return Math.min(scoring.maxComboMultiplier, 1 + steps * scoring.streakBonusPerStep);
}

/**
 * Điểm cho một câu trả lời đúng. Câu sai = 0 điểm (chỉ bị khoá thao tác).
 * Điểm = (basePoints × hệ số độ khó + thưởng tốc độ) × hệ số combo, làm tròn.
 * Thưởng tốc độ tính trên `max(0, answerMs − allowanceMs)`: trọn `maxSpeedBonus` khi ≤
 * `fastAnswerMs`, giảm đều về 0 ở `slowAnswerMs`.
 */
export function pointsForCorrect(
  { difficulty, answerMs, streak, multiplier, allowanceMs = 0 }: ScoreInput,
  scoring: ScoringConfig = DEFAULT_SCORING,
): number {
  const factor = multiplier ?? scoring.difficultyMultiplier[difficulty];
  const fast = scoring.fastAnswerMs;
  const slow = scoring.slowAnswerMs;
  const elapsed = Math.max(0, answerMs - allowanceMs);
  // `slow > fast` luôn đúng với cấu hình đã qua parse/schema; vẫn chặn chia cho 0 cho chắc.
  const speedBonus =
    slow > fast
      ? Math.round(
          (scoring.maxSpeedBonus * (slow - Math.min(Math.max(elapsed, fast), slow))) /
            (slow - fast),
        )
      : elapsed <= fast
        ? scoring.maxSpeedBonus
        : 0;
  return Math.round((scoring.basePoints * factor + speedBonus) * comboMultiplier(streak, scoring));
}

/**
 * Hệ số độ khó của một game. Thứ tự ưu tiên (CR-019): ghi đè của admin
 * `scoring.gameMultipliers[game.id]` → hệ số game khai báo `game.difficultyMultiplier` (CR-006)
 * → hệ số chung `scoring.difficultyMultiplier`. Giá trị không phải số dương hữu hạn bị bỏ qua.
 * Server chấm và web hiển thị cùng dùng hàm này. Bot hẹn giờ nghĩ bằng hàm này KHÔNG truyền
 * `scoring`, nên thời gian nghĩ không phụ thuộc cấu hình admin.
 */
export function gameMultiplier(
  game: { id?: string } & Pick<MinigameDef<unknown, unknown>, "difficultyMultiplier">,
  difficulty: Difficulty,
  scoring: ScoringConfig = DEFAULT_SCORING,
): number {
  const override =
    game.id !== undefined && Object.hasOwn(scoring.gameMultipliers, game.id)
      ? scoring.gameMultipliers[game.id]?.[difficulty]
      : undefined;
  if (isPositive(override)) return override;
  const declared = game.difficultyMultiplier?.[difficulty];
  if (isPositive(declared)) return declared;
  const base = scoring.difficultyMultiplier[difficulty];
  return isPositive(base) ? base : DIFFICULTY_MULTIPLIER[difficulty];
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

/**
 * Điểm trận theo thứ hạng trong vòng, co giãn theo số người (CR-018): hạng `rank` (0 = nhất)
 * trong phòng `playerCount` ghế (tính cả bot) được `max(1, playerCount − rank) + topBonus[rank]`.
 * Mặc định thưởng top 3/2/1 → 12 người: 15, 13, 11, 9, 8 … 1; 8 người: 11, 9, 7, 5, 4, 3, 2, 1;
 * 2 người: 5, 3. Hoà điểm vòng thì cùng hạng (`rankByRound`) nên cùng điểm trận.
 */
export function placementPoints(
  rank: number,
  playerCount: number,
  topBonus: readonly number[] = DEFAULT_SCORING.placementTopBonus,
): number {
  return Math.max(1, playerCount - rank) + (topBonus[rank] ?? 0);
}

function isPositive(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}
