import { type PlayerView, rankByMatch, rankByRound } from "@brain-rizz/shared";

/** Một dòng bảng tổng điểm: hạng hiện tại và hạng trước vòng vừa chơi (đều tính từ 0). */
export interface MatchRow {
  player: PlayerView;
  rank: number;
  prevRank: number;
}

/**
 * Bảng tổng điểm sau vòng: xếp theo điểm trận (hoà thì tổng điểm vòng), kèm hạng trước vòng
 * (điểm trận trừ `lastPoints`, tổng điểm vòng trừ điểm vòng này) để vẽ mũi tên lên/xuống hạng.
 */
export function matchRows(players: readonly PlayerView[]): MatchRow[] {
  const before = rankByMatch(
    players.map((p) => ({
      ...p,
      matchPoints: p.matchPoints - p.lastPoints,
      totalScore: p.totalScore - p.roundScore,
    })),
  );
  const prevRank = new Map(before.map((r) => [r.player.id, r.rank]));
  return rankByMatch(players).map(({ player, rank }) => ({
    player,
    rank,
    prevRank: prevRank.get(player.id) ?? rank,
  }));
}

/** Người leo nhiều hạng nhất sau vòng (null nếu không ai leo). */
export function biggestClimber(rows: readonly MatchRow[]): MatchRow | null {
  let best: MatchRow | null = null;
  for (const row of rows) {
    const climb = row.prevRank - row.rank;
    if (climb > 0 && (!best || climb > best.prevRank - best.rank)) best = row;
  }
  return best;
}

/** Người nhất vòng (có thể nhiều người nếu hoà điểm). */
export function roundWinners(players: readonly PlayerView[]): PlayerView[] {
  return rankByRound(players)
    .filter((r) => r.rank === 0)
    .map((r) => r.player);
}

/** Chia bục vinh danh: nhóm hạng 0, 1, 2 (đồng hạng đứng chung bục) và phần còn lại. */
export function podiumGroups(players: readonly PlayerView[]) {
  const ranked = rankByMatch(players);
  const group = (rank: number) => ranked.filter((r) => r.rank === rank).map((r) => r.player);
  return {
    podium: [group(0), group(1), group(2)] as const,
    rest: ranked.filter((r) => r.rank >= 3),
  };
}
