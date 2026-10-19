import {
  BRAIN_TEST_RULES_VERSION,
  CATEGORIES,
  type Category,
  type CharacterId,
  type Difficulty,
  type GameId,
  isCharacterId,
  isGameId,
} from "@brain-rizz/shared";
import { hasStoredSession, loadSupabase, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { useAuth, withTimeout } from "@/stores/auth.store";

/**
 * Đọc/ghi máy chủ dữ liệu Supabase (ADR 0011) cho Tài khoản, Bảng xếp hạng, Kiểm tra não,
 * Luyện tập. Không bao giờ ném lỗi: trả `DataResult` để màn hình hiện đúng trạng thái
 * (chưa kết nối / chưa có phiên / lỗi + Thử lại). Điểm xếp hạng chỉ do server ghi (NFR-SEC-03);
 * client chỉ ghi hồ sơ (auth.store) và kỷ lục luyện tập.
 */

export type DataFailure =
  /** Thiếu biến môi trường Supabase (FR-MR-15). */
  | "not-configured"
  /** Cần phiên mà chưa có. */
  | "no-session"
  /** Mạng / Supabase tạm dừng / lỗi RPC. */
  | "error";

export type DataResult<T> = { ok: true; data: T } | { ok: false; reason: DataFailure };

export type LeaderboardPeriod = "week" | "all";
export const LEADERBOARD_LIMIT = 50;

export type LeaderboardBoard = { kind: "brain" } | { kind: "game"; gameId: GameId };

export interface LeaderboardRow {
  rank: number;
  userId: string;
  /** `null` khi người đó chưa có hồ sơ (hiện tên dự phòng qua i18n). */
  name: string | null;
  avatar: CharacterId;
  score: number;
  achievedAt: string;
}

export interface MyRank {
  rank: number;
  score: number;
}

export interface BrainTestGameRow {
  gameId: GameId;
  category: Category;
  score: number;
  correct: number;
}

export interface BrainTestRow {
  id: string;
  brainScore: number;
  skills: Partial<Record<Category, number>>;
  createdAt: string;
  rulesVersion: number;
  games: BrainTestGameRow[];
}

export interface MatchRow {
  id: string;
  roomCode: string;
  /** 0 = nhất. */
  placement: number;
  players: number;
  matchPoints: number;
  totalScore: number;
  rounds: number;
  games: GameId[];
  /**
   * Tổng điểm vòng theo thể loại trong trận (CR-010): chỉ thể loại đã chơi có khoá.
   * Trận cũ (trước cột `category_scores`) là `{}` → coi như không có dữ liệu.
   */
  categoryScores: Partial<Record<Category, number>>;
  /** Thể loại mình giành danh hiệu "giỏi nhất" trong trận (không trùng, thứ tự CATEGORIES). */
  categoryTitles: Category[];
  createdAt: string;
}

export interface PracticeBestRow {
  gameId: string;
  difficulty: number;
  bestScore: number;
  bestCorrect: number;
  plays: number;
}

// biome-ignore lint/suspicious/noExplicitAny: dữ liệu Supabase chưa có kiểu sinh tự động; mọi dòng được kiểm và chuẩn hoá dưới đây
type Row = Record<string, any>;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown) => (typeof v === "string" ? v : "");

const fail = (reason: DataFailure): { ok: false; reason: DataFailure } => ({ ok: false, reason });

/** Chạy một truy vấn Supabase; lỗi hoặc quá giờ → `error`. */
async function run<T>(
  query: (sb: NonNullable<Awaited<ReturnType<typeof loadSupabase>>>) => PromiseLike<{
    data: unknown;
    error: unknown;
  }>,
  map: (data: unknown) => T,
  needSession: boolean,
): Promise<DataResult<T>> {
  if (!SUPABASE_CONFIGURED) return fail("not-configured");
  if (needSession && !hasStoredSession()) return fail("no-session");
  try {
    const sb = await withTimeout(loadSupabase());
    if (!sb) return fail("not-configured");
    if (needSession) {
      // Phiên còn trên máy nhưng có thể đã bị đăng xuất ở tab khác.
      const { data } = await withTimeout(sb.auth.getSession());
      if (!data.session) return fail("no-session");
    }
    const { data, error } = await withTimeout(Promise.resolve(query(sb)));
    if (error) throw error;
    return { ok: true, data: map(data) };
  } catch (err) {
    console.warn("[data] Lỗi máy chủ dữ liệu:", err);
    return fail("error");
  }
}

function toLeaderboardRow(r: Row): LeaderboardRow {
  return {
    rank: num(r.rank),
    userId: str(r.user_id),
    name: typeof r.display_name === "string" && r.display_name.trim() ? r.display_name : null,
    avatar: isCharacterId(r.avatar) ? r.avatar : "khoi",
    score: num(r.score),
    achievedAt: str(r.achieved_at),
  };
}

/** Top `LEADERBOARD_LIMIT` (FR-MR-12). Xem được khi chưa đăng nhập. */
export function fetchLeaderboard(
  board: LeaderboardBoard,
  period: LeaderboardPeriod,
): Promise<DataResult<LeaderboardRow[]>> {
  return run(
    (sb) =>
      board.kind === "brain"
        ? sb.rpc("leaderboard_brain", {
            p_period: period,
            p_limit: LEADERBOARD_LIMIT,
            p_rules_version: BRAIN_TEST_RULES_VERSION,
          })
        : sb.rpc("leaderboard_game", {
            p_game_id: board.gameId,
            p_period: period,
            p_limit: LEADERBOARD_LIMIT,
            p_rules_version: BRAIN_TEST_RULES_VERSION,
          }),
    (data) => ((data as Row[] | null) ?? []).map(toLeaderboardRow),
    false,
  );
}

/** Hạng của mình trong kỳ (FR-MR-13); `null` khi chưa có điểm. Không tạo phiên mới. */
export function fetchMyRank(
  board: LeaderboardBoard,
  period: LeaderboardPeriod,
): Promise<DataResult<MyRank | null>> {
  return run(
    (sb) =>
      board.kind === "brain"
        ? sb.rpc("my_rank_brain", {
            p_period: period,
            p_rules_version: BRAIN_TEST_RULES_VERSION,
          })
        : sb.rpc("my_rank_game", {
            p_game_id: board.gameId,
            p_period: period,
            p_rules_version: BRAIN_TEST_RULES_VERSION,
          }),
    (data) => {
      const row = ((data as Row[] | null) ?? [])[0];
      return row ? { rank: num(row.rank), score: num(row.score) } : null;
    },
    true,
  );
}

/** Object thể loại → số (điểm kỹ năng Kiểm tra não, điểm thể loại trận party); bỏ khoá/giá trị lạ. */
function toSkills(v: unknown): Partial<Record<Category, number>> {
  const out: Partial<Record<Category, number>> = {};
  if (v && typeof v === "object") {
    for (const c of CATEGORIES) {
      const value = (v as Row)[c];
      if (typeof value === "number" && Number.isFinite(value)) out[c] = value;
    }
  }
  return out;
}

/** Lịch sử Kiểm tra não, mới nhất trước (RLS: chỉ của mình). */
export function fetchBrainHistory(limit = 50): Promise<DataResult<BrainTestRow[]>> {
  return run(
    (sb) =>
      sb
        .from("brain_tests")
        .select(
          "id, brain_score, skills, created_at, rules_version, brain_test_games(game_id, category, score, correct, created_at)",
        )
        .order("created_at", { ascending: false })
        .limit(limit),
    (data) =>
      ((data as Row[] | null) ?? []).map((r) => {
        const games: BrainTestGameRow[] = ((r.brain_test_games as Row[] | null) ?? [])
          .filter((g) => isGameId(g.game_id))
          .map((g) => ({
            gameId: g.game_id as GameId,
            category: (CATEGORIES as readonly string[]).includes(g.category)
              ? (g.category as Category)
              : "identify",
            score: num(g.score),
            correct: num(g.correct),
          }))
          .sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category));
        return {
          id: str(r.id),
          brainScore: num(r.brain_score),
          skills: toSkills(r.skills),
          createdAt: str(r.created_at),
          rulesVersion: num(r.rules_version),
          games,
        };
      }),
    true,
  );
}

/** Mảng thể loại hợp lệ, bỏ phần tử lạ và trùng, theo thứ tự `CATEGORIES`. */
function toCategories(v: unknown): Category[] {
  const list = Array.isArray(v) ? v : [];
  return CATEGORIES.filter((c) => list.includes(c));
}

/** Lịch sử trận party, mới nhất trước. */
export function fetchMatchHistory(limit = 50): Promise<DataResult<MatchRow[]>> {
  return run(
    (sb) =>
      sb
        .from("match_results")
        .select(
          "id, room_code, placement, players, match_points, total_score, rounds, games, category_scores, category_titles, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(limit),
    (data) =>
      ((data as Row[] | null) ?? []).map((r) => ({
        id: str(r.id),
        roomCode: str(r.room_code),
        placement: num(r.placement),
        players: num(r.players),
        matchPoints: num(r.match_points),
        totalScore: num(r.total_score),
        rounds: num(r.rounds),
        games: (Array.isArray(r.games) ? r.games : []).filter(isGameId),
        categoryScores: toSkills(r.category_scores),
        categoryTitles: toCategories(r.category_titles),
        createdAt: str(r.created_at),
      })),
    true,
  );
}

/** Kỷ lục luyện tập trên tài khoản. */
export function fetchPracticeBests(): Promise<DataResult<PracticeBestRow[]>> {
  return run(
    (sb) =>
      sb.from("practice_bests").select("game_id, difficulty, best_score, best_correct, plays"),
    (data) =>
      ((data as Row[] | null) ?? []).map((r) => ({
        gameId: str(r.game_id),
        difficulty: num(r.difficulty),
        bestScore: num(r.best_score),
        bestCorrect: num(r.best_correct),
        plays: num(r.plays),
      })),
    true,
  );
}

/**
 * Gửi một lượt luyện tập (UC-13 luồng rẽ 4a): tạo phiên khách nếu chưa có, RPC
 * `submit_practice_result` giữ điểm cao nhất. Không lên bảng xếp hạng.
 */
export async function submitPracticeResult(
  gameId: GameId,
  difficulty: Difficulty,
  score: number,
  correct: number,
  profile: { name: string; avatar: CharacterId },
): Promise<DataResult<null>> {
  if (!SUPABASE_CONFIGURED) return fail("not-configured");
  const token = await useAuth.getState().ensureSession(profile);
  if (!token) return fail("error");
  return run(
    (sb) =>
      sb.rpc("submit_practice_result", {
        p_game_id: gameId,
        p_difficulty: difficulty,
        p_score: Math.max(0, Math.round(score)),
        p_correct: Math.max(0, Math.round(correct)),
      }),
    () => null,
    true,
  );
}
