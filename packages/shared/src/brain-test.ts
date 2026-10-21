/**
 * Kiểm tra não (UC-14, CR-009): chọn 5 game và tính Điểm Não.
 * Server (`BrainTestRoom`) và web dùng chung. Hàm thuần, tất định theo tham số; không dùng
 * nguồn ngẫu nhiên nào ngoài `createRng`. Luật và lý do: docs/01-product/game-design.md mục
 * "Kiểm tra não".
 */
import type { Difficulty } from "./difficulty";
import { GAME_IDS, type GameId, getGame, isGameId } from "./games";
import { CATEGORIES, type Category } from "./games/types";
import { createRng, deriveSeed } from "./rng";

/**
 * Phiên bản luật Kiểm tra não (thời lượng, điểm chuẩn, công thức, bộ game). Tăng mỗi khi đổi một trong
 * các thứ đó, kể cả thêm game vào một nhóm; server lưu kèm mỗi lượt và bảng xếp hạng chỉ so các lượt cùng phiên bản.
 */
// 2: thêm Bóng của ai vào nhóm Nhận diện (2026-10-20).
// 3: thêm Luyện ngắm (Nhận diện) và Phấn trượt (Phân tích), CR-012 (2026-10-20).
// 4: thêm 14 game của kế hoạch mở rộng vào cả 5 nhóm, CR-013 + CR-014 (2026-10-20).
export const BRAIN_TEST_RULES_VERSION = 4;

/** Số game trong một lượt: mỗi nhóm kỹ năng một game. */
export const BRAIN_TEST_GAME_COUNT = CATEGORIES.length;

/**
 * Độ khó cố định cho mọi người để bảng xếp hạng so sánh được: Thường (hệ số 1 ở mọi game),
 * mức dành cho người lớn chơi đúng sức.
 */
export const BRAIN_TEST_DIFFICULTY: Difficulty = 1;

/** Đếm ngược trước mỗi game (ms). */
export const BRAIN_TEST_COUNTDOWN_MS = 3000;

/** Thời gian giữ màn kết quả một game trước khi sang game kế (ms). */
export const BRAIN_TEST_GAME_RESULT_MS = 3000;

/**
 * Thời lượng chơi theo nhóm (ms). Theo nhóm chứ không theo game để lượt nào cũng dài như nhau
 * (mỗi nhóm đúng một game): tổng 200 s chơi. Nhóm có câu chậm (Ghi nhớ có pha trình chiếu,
 * Tính toán ~5 s mỗi câu) được 45 s để vẫn còn ~7–8 câu; Nhận diện câu ~1,5 s nên 30 s là đủ.
 * Đổi số ở đây thì phải tính lại `BRAIN_TEST_REFERENCE_SCORE`.
 */
export const BRAIN_TEST_DURATION_MS_BY_CATEGORY: Readonly<Record<Category, number>> = {
  identify: 30_000,
  memorize: 45_000,
  analyze: 40_000,
  compute: 45_000,
  visualize: 40_000,
};

/** Tổng thời gian chơi của một lượt (ms), chưa gồm hướng dẫn, đếm ngược, màn kết quả. */
export const BRAIN_TEST_PLAY_MS = CATEGORIES.reduce(
  (sum, c) => sum + BRAIN_TEST_DURATION_MS_BY_CATEGORY[c],
  0,
);

/** Thời gian đọc hướng dẫn ước lượng mỗi game (ms), chỉ để hiện "tổng thời gian dự kiến". */
export const BRAIN_TEST_INTRO_ESTIMATE_MS = 12_000;

/** Tổng thời gian dự kiến một lượt (ms) để hiện ở màn giới thiệu: ~4 phút 50 giây. */
export const BRAIN_TEST_ESTIMATED_TOTAL_MS =
  BRAIN_TEST_PLAY_MS +
  BRAIN_TEST_GAME_COUNT *
    (BRAIN_TEST_INTRO_ESTIMATE_MS + BRAIN_TEST_COUNTDOWN_MS + BRAIN_TEST_GAME_RESULT_MS);

/**
 * Điểm chuẩn mỗi game: điểm kỳ vọng của người lớn chơi đúng sức ở Thường, trong đúng thời lượng
 * Kiểm tra não của game đó, theo công thức chấm của server (khoá khi sai, combo, thưởng tốc độ,
 * miễn trừ). Mô phỏng 4 000 lượt bằng chính `generate()` và `pointsForCorrect` với thời gian giải
 * và tỉ lệ sai ở bảng Cân bằng trong đặc tả từng game, làm tròn tới 50.
 *
 * SỐ TẠM: chốt lại sau buổi chơi thử (đo điểm trung vị người lớn ở Thường).
 * Thêm game mới → bắt buộc khai báo ở đây (TypeScript báo lỗi nếu thiếu). `pnpm new-game` tự
 * chèn số giữ chỗ 1500 kèm TODO; game designer thay bằng số mô phỏng trước khi xong game.
 */
export const BRAIN_TEST_REFERENCE_SCORE: Readonly<Record<GameId, number>> = {
  "odd-one-out": 3350,
  "light-trail": 1050,
  "who-vanished": 1250,
  "pair-flip": 1950,
  balance: 1850,
  "cube-count": 1400,
  "marble-drop": 2100,
  "number-balloons": 1250,
  "hit-target": 1100,
  "cash-count": 1200,
  "rotate-match": 1900,
  "top-view": 1550,
  "fold-box": 1700,
  "shadow-match": 2050,
  "aim-trainer": 8350,
  "chalk-arrows": 4900,
  "cup-shuffle": 900,
  "stack-recall": 1250,
  "bead-pattern": 1750,
  "head-count": 1050,
  "piece-fit": 1900,
  "latin-cell": 1600,
  "circuit-link": 1900,
  "crowd-search": 1600,
  "best-basket": 1100,
  "pour-line": 3450,
  "navon-shapes": 3450,
  "rhythm-echo": 1450,
  "rule-gate": 4750,
  "number-path": 1200,
  // @new-game:brain-reference
};

/** Điểm kỹ năng khi đạt đúng điểm chuẩn của game. */
export const BRAIN_SKILL_REFERENCE = 100;
/** Trần điểm một kỹ năng (trục biểu đồ 5 cạnh chạy 0 → 200). */
export const BRAIN_SKILL_MAX = 200;
/** Trần Điểm Não = 5 × trần kỹ năng. */
export const BRAIN_SCORE_MAX = BRAIN_TEST_GAME_COUNT * BRAIN_SKILL_MAX;

/** Điểm 5 kỹ năng của một lượt. */
export type BrainSkills = Record<Category, number>;

export interface BrainGameResult {
  gameId: GameId;
  score: number;
  correct: number;
}

export interface BrainTestResult {
  brainScore: number;
  skills: BrainSkills;
}

/**
 * Thời lượng một game trong Kiểm tra não (ms): thời lượng của nhóm, không dài hơn vòng party
 * của game đó.
 */
export function brainTestDurationMs(gameId: GameId): number {
  const game = getGame(gameId);
  return Math.min(BRAIN_TEST_DURATION_MS_BY_CATEGORY[game.category], game.durationMs);
}

/**
 * Chọn 5 game theo thứ tự `CATEGORIES`, mỗi nhóm một game, tất định theo `seed`.
 * Mỗi nhóm bốc bằng một luồng ngẫu nhiên riêng (`deriveSeed(seed, i)`), nên đổi danh sách game
 * của nhóm này không làm đổi kết quả nhóm khác.
 *
 * `available` mặc định là mọi game đã đăng ký. Id lạ và id trùng bị bỏ qua; thứ tự trong
 * `available` không ảnh hưởng kết quả. Nhóm không còn game nào trong `available` thì bốc từ mọi
 * game đã đăng ký của nhóm đó, để lượt luôn đủ 5 game (kỹ năng không bao giờ bị 0 vì thiếu game).
 */
export function pickBrainTestGames(
  seed: number,
  available: readonly GameId[] = GAME_IDS,
): GameId[] {
  const allowed = new Set<string>(available.filter(isGameId));
  const picked: GameId[] = [];
  CATEGORIES.forEach((category, i) => {
    const all = GAME_IDS.filter((id) => getGame(id).category === category);
    const pool = all.filter((id) => allowed.has(id));
    const from = pool.length > 0 ? pool : all;
    if (from.length === 0) return;
    picked.push(createRng(deriveSeed(seed, i)).pick(from));
  });
  return picked;
}

/**
 * Quy điểm một game về thang kỹ năng 0–200, với `r = điểm / điểm chuẩn`:
 * - `r ≤ 1`: tỉ lệ thẳng, `100 × r` (đạt điểm chuẩn = 100).
 * - `r > 1`: tăng chậm dần, `200 − 100 / r` (gấp đôi chuẩn = 150, gấp ba = 167), không vượt 200.
 * Hai nhánh nối trơn tại `r = 1`. Làm tròn số nguyên; điểm âm, NaN hay vô cực coi như 0.
 */
export function skillScore(gameId: GameId, score: number): number {
  const reference = BRAIN_TEST_REFERENCE_SCORE[gameId];
  if (!(reference > 0) || !Number.isFinite(score) || score <= 0) return 0;
  const r = score / reference;
  const raw =
    r <= 1
      ? BRAIN_SKILL_REFERENCE * r
      : BRAIN_SKILL_MAX - (BRAIN_SKILL_MAX - BRAIN_SKILL_REFERENCE) / r;
  return Math.min(BRAIN_SKILL_MAX, Math.max(0, Math.round(raw)));
}

/**
 * Tính Điểm Não và điểm 5 kỹ năng từ kết quả 5 game.
 * Điểm Não = tổng 5 kỹ năng (0–1 000; người lớn chơi đúng sức ≈ 500).
 * Nhóm không có kết quả → kỹ năng đó = 0. Id lạ bị bỏ qua. Một nhóm có nhiều kết quả (không xảy
 * ra khi chơi đúng luồng) thì lấy kỹ năng cao nhất.
 */
export function computeBrainResult(games: readonly BrainGameResult[]): BrainTestResult {
  const skills = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as BrainSkills;
  for (const g of games) {
    if (!isGameId(g.gameId)) continue;
    const category = getGame(g.gameId).category;
    skills[category] = Math.max(skills[category], skillScore(g.gameId, g.score));
  }
  const brainScore = CATEGORIES.reduce((sum, c) => sum + skills[c], 0);
  return { brainScore, skills };
}
