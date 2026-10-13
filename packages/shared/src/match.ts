import { type Difficulty, isDifficulty } from "./difficulty";
import { GAME_IDS, type GameId } from "./games";

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
