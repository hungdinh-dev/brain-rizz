import { type Difficulty, isDifficulty } from "./difficulty";
import { GAME_IDS, GAMES, type GameId, isGameId } from "./games";
import { CATEGORIES, type Category } from "./games/types";

/**
 * Luật một trận dùng chung cho server và web (CR-005): xếp hạng có hoà,
 * danh sách game còn chơi được, độ khó đa số. Hàm thuần, không phụ thuộc Colyseus.
 */

export interface Ranked<T> {
  player: T;
  /** Hạng tính từ 0 (0 = nhất). Hoà điểm thì cùng hạng, hạng kế tiếp bị bỏ qua (1, 1, 3…). */
  rank: number;
}

/**
 * Sắp xếp giảm dần theo `compare` (âm = a xếp trên b) và gán hạng có hoà:
 * hạng của một người = số người xếp trên hẳn người đó. Người hoà nhau giữ thứ tự đầu vào.
 */
function rankWith<T>(players: readonly T[], compare: (a: T, b: T) => number): Ranked<T>[] {
  const sorted = [...players].sort(compare);
  const out: Ranked<T>[] = [];
  sorted.forEach((player, i) => {
    const prev = out[i - 1];
    const rank = prev && compare(prev.player, player) === 0 ? prev.rank : i;
    out.push({ player, rank });
  });
  return out;
}

/** Xếp hạng trong một vòng theo điểm vòng (RULE-09): hoà điểm thì cùng hạng, cùng điểm trận. */
export function rankByRound<T extends { roundScore: number }>(players: readonly T[]): Ranked<T>[] {
  return rankWith(players, (a, b) => b.roundScore - a.roundScore);
}

/** Xếp hạng chung cuộc: điểm trận giảm dần; hoà điểm trận thì tổng điểm vòng cao hơn xếp trên. */
export function rankByMatch<T extends { matchPoints: number; totalScore: number }>(
  players: readonly T[],
): Ranked<T>[] {
  return rankWith(players, (a, b) => b.matchPoints - a.matchPoints || b.totalScore - a.totalScore);
}

/**
 * Game còn chơi được trong trận (FR-VC-16): toàn bộ game hệ thống trừ game đã chơi.
 * Có thể rỗng — khi đó server làm mới `playedGames` lúc vào pha `game-select`,
 * nên ở pha `game-select` danh sách này luôn có ít nhất một game.
 */
export function availableGames(
  played: readonly string[],
  all: readonly GameId[] = GAME_IDS,
): GameId[] {
  return all.filter((id) => !played.includes(id));
}

/**
 * Độ khó được nhiều người chọn nhất (dùng để đánh dấu người "lệch" và cho lệnh Nhắc).
 * Trả `null` nếu danh sách rỗng hoặc nhiều mức hoà nhau ở vị trí cao nhất.
 */
export function majorityDifficulty(difficulties: Iterable<number>): Difficulty | null {
  const counts = new Map<Difficulty, number>();
  for (const d of difficulties) if (isDifficulty(d)) counts.set(d, (counts.get(d) ?? 0) + 1);
  let best: Difficulty | null = null;
  let bestCount = 0;
  let tie = false;
  for (const [d, n] of counts) {
    if (n > bestCount) {
      best = d;
      bestCount = n;
      tie = false;
    } else if (n === bestCount) {
      tie = true;
    }
  }
  return tie ? null : best;
}

/**
 * Thể loại của các game đã chơi trong trận (CR-010), theo thứ tự `CATEGORIES`, không trùng.
 * Bỏ qua id không phải game hệ thống.
 */
export function playedCategories(gameIds: Iterable<string>): Category[] {
  const seen = new Set<Category>();
  for (const id of gameIds) if (isGameId(id)) seen.add(GAMES[id].category);
  return CATEGORIES.filter((c) => seen.has(c));
}

export interface CategoryLeader {
  category: Category;
  /** Người có điểm cao nhất ở thể loại này; hoà thì cùng nhận, giữ thứ tự đầu vào. */
  leaderIds: string[];
  /** Điểm của (những) người dẫn đầu, luôn > 0. */
  score: number;
}

/**
 * Danh hiệu "giỏi nhất mỗi thể loại" của một trận (CR-010).
 * Với mỗi thể loại trong `played` (kết quả theo thứ tự `CATEGORIES`, không trùng): người có
 * `categoryScores[category]` cao nhất và > 0 nhận danh hiệu, hoà thì cùng nhận.
 * Thể loại mà mọi người đều 0 điểm (hoặc thiếu khoá) thì KHÔNG có trong kết quả — không ai
 * nhận danh hiệu. Thể loại không nằm trong `played` cũng bị bỏ qua.
 */
export function categoryLeaders<
  T extends { id: string; categoryScores: Partial<Record<Category, number>> },
>(players: readonly T[], played: Iterable<Category>): CategoryLeader[] {
  const wanted = new Set(played);
  const out: CategoryLeader[] = [];
  for (const category of CATEGORIES) {
    if (!wanted.has(category)) continue;
    let score = 0;
    let leaderIds: string[] = [];
    for (const p of players) {
      const s = p.categoryScores[category] ?? 0;
      if (s <= 0) continue;
      if (s > score) {
        score = s;
        leaderIds = [p.id];
      } else if (s === score) {
        leaderIds.push(p.id);
      }
    }
    if (leaderIds.length > 0) out.push({ category, leaderIds, score });
  }
  return out;
}
