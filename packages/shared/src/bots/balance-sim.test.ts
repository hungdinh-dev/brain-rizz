import { describe, expect, it } from "vitest";
import { GAME_IDS, type GameId } from "../games";
import { BOT_LEVEL_SPECS, BOT_LEVELS, type BotLevel } from "./index";
import { QuestionInfoCache, type SimPlayer, simulateRound } from "./simulate";

/**
 * Mô phỏng cân bằng bot, docs/01-product/bot-players.md mục 6: 1 000 vòng cho mỗi game và mỗi mức.
 * Để chạy nhanh, 1 000 vòng = 50 seed vòng cố định × 20 mã bot: cùng seed thì câu đố giống nhau,
 * chỉ RNG của bot khác (`QuestionInfoCache` nhớ phần cần của từng câu). Chấm bằng các hàm chung
 * (`pointsForCorrect`, `gameMultiplier`, `gameSpeedAllowanceMs`, `gameAnswerWindowMs`,
 * `WRONG_ANSWER_LOCK_MS`) theo dòng thời gian của `judgeAnswer`, xem `simulate.ts`.
 *
 * Mọi tỉ lệ đúng dưới đây là danh nghĩa (ở game chuẩn 90 %): bot và người mô hình đều quy theo
 * `expectedAccuracy` của từng game bằng `relativeAccuracy`, nên ở game người lớn chỉ đúng 70 % ở
 * Siêu khó thì người chuẩn, người giỏi và bot Siêu đều sai nhiều tương ứng.
 *
 * Không đạt thì CHỈ chỉnh số trong `levels.ts`, rồi cập nhật bảng 3.1 của kế hoạch.
 */

const ROUND_SEEDS = Array.from(
  { length: 50 },
  (_, i) => (Math.imul(i + 1, 0x9e3779b1) ^ 0x5eed) >>> 0,
);
const PLAYER_IDS = Array.from({ length: 20 }, (_, i) => `bot-${i}`);
const ROUNDS = ROUND_SEEDS.length * PLAYER_IDS.length;

type Model = Omit<SimPlayer, "id">;

/** Người chơi chuẩn: Thường, giải mỗi câu hết đúng T, đúng đúng tỉ lệ chuẩn của game. */
const STANDARD: Model = { difficulty: 1, timeFactor: 1, accuracy: 0.9 };
/**
 * "Người giỏi": Siêu khó, nhanh hơn chuẩn 20 %, sai bằng nửa người chuẩn (95 % ở game chuẩn 90 %,
 * Lật cặp ở Siêu khó 68 % → 84 %), trần `BOT_MAX_ACCURACY`.
 */
const STRONG: Model = { difficulty: 3, timeFactor: 0.8, accuracy: 0.95 };
/** Trẻ 7 tuổi chơi Mầm đúng sức: T và tỉ lệ đúng của Mầm (theo trẻ) trong bảng Cân bằng. */
const CHILD: Model = { difficulty: 0, timeFactor: 1, accuracy: 0.9 };

/**
 * Game mà điểm bot KHÔNG tăng dần Vừa < Khó < Siêu, kèm lý do. Test đòi đúng như danh sách: game
 * đã cân lại thì phải bỏ khỏi đây.
 */
const NOT_ORDERED: Readonly<Partial<Record<GameId, string>>> = {
  "odd-one-out":
    "còn hệ số chung 0,8 / 1 / 1,25 / 1,5 (chưa cân theo CR-006): theo ước lượng thời gian, người " +
    "đúng sức ở Khó, Siêu khó chỉ được ~63 %, ~44 % điểm ở Thường, nên bot cũng vậy. Hệ số đề xuất " +
    "ở docs/04-minigames/odd-one-out.md › Cân bằng, chờ chủ dự án duyệt",
};

const cache = new QuestionInfoCache();

function botModel(level: BotLevel): Model {
  const { difficulty, timeFactor, accuracy } = BOT_LEVEL_SPECS[level];
  return { difficulty, timeFactor, accuracy };
}

/** Điểm từng vòng của `model`; `prefix` tách RNG của người với bot cùng chỉ số. */
function roundScores(gameId: GameId, model: Model, prefix = ""): number[] {
  const scores: number[] = [];
  for (const seed of ROUND_SEEDS) {
    for (const id of PLAYER_IDS) {
      scores.push(simulateRound(gameId, seed, { ...model, id: `${prefix}${id}` }, cache).score);
    }
  }
  return scores;
}

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Tỉ lệ vòng `a` thắng `b` (cùng seed vòng, hoà tính nửa). */
function winRate(a: readonly number[], b: readonly number[]): number {
  let wins = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    wins += x > y ? 1 : x === y ? 0.5 : 0;
  }
  return wins / a.length;
}

describe(`mô phỏng cân bằng bot (${ROUNDS} vòng mỗi game và mỗi mức)`, () => {
  it.each(GAME_IDS)("%s", (gameId) => {
    const bots = BOT_LEVELS.map((level) => roundScores(gameId, botModel(level)));
    const [easy = 0, medium = 0, hard = 0, expert = 0] = bots.map(mean);

    // Điểm vòng trung bình tăng dần: Dễ < Vừa < Khó < Siêu (trừ ngoại lệ có lý do).
    expect(medium, "Vừa phải hơn Dễ").toBeGreaterThan(easy);
    const ordered = hard > medium && expert > hard;
    expect(ordered, NOT_ORDERED[gameId] ?? "Vừa < Khó < Siêu").toBe(
      NOT_ORDERED[gameId] === undefined,
    );

    // Người chơi chuẩn thắng bot Vừa khoảng nửa số vòng.
    const standard = winRate(roundScores(gameId, STANDARD, "human-"), bots[1] ?? []);
    expect(standard).toBeGreaterThanOrEqual(0.4);
    expect(standard).toBeLessThanOrEqual(0.6);

    // Người giỏi cố gắng vẫn thắng bot Siêu ít nhất nửa số vòng.
    expect(winRate(roundScores(gameId, STRONG, "human-"), bots[3] ?? [])).toBeGreaterThanOrEqual(
      0.5,
    );

    // Trẻ em thắng được bot Dễ.
    expect(winRate(roundScores(gameId, CHILD, "human-"), bots[0] ?? [])).toBeGreaterThanOrEqual(
      0.6,
    );
  });
});
