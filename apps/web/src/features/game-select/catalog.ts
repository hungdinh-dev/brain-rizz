import {
  availableGames,
  type Category,
  GAME_IDS,
  type GameId,
  isGameId,
  type PartyStateView,
  type PlayerView,
} from "@brain-rizz/shared";

/**
 * Danh mục 15 minigame theo docs/04-minigames/README.md (chỉ id + nhóm, tên ở i18n `catalog.<id>`).
 * Game đã đăng ký trong `GAMES` được chơi; game còn lại hiện thẻ "Sắp có" ở màn Chọn game.
 */
export const CATALOG = [
  { id: "odd-one-out", category: "identify" },
  { id: "shadow-match", category: "identify" },
  { id: "whack-right", category: "identify" },
  { id: "light-trail", category: "memorize" },
  { id: "who-vanished", category: "memorize" },
  { id: "pair-flip", category: "memorize" },
  { id: "balance", category: "analyze" },
  { id: "cube-count", category: "analyze" },
  { id: "marble-drop", category: "analyze" },
  { id: "number-balloons", category: "compute" },
  { id: "hit-target", category: "compute" },
  { id: "cash-count", category: "compute" },
  { id: "rotate-match", category: "visualize" },
  { id: "top-view", category: "visualize" },
  { id: "fold-box", category: "visualize" },
] as const satisfies readonly { id: string; category: Category }[];

export type CatalogEntry = (typeof CATALOG)[number];

/** Game trong danh mục nhưng chưa có code. */
export const UPCOMING: readonly CatalogEntry[] = CATALOG.filter((g) => !isGameId(g.id));

/** Game đã chơi trong trận (chỉ những id còn đăng ký). */
export function playedGameIds(party: PartyStateView): GameId[] {
  return party.playedGames.filter(isGameId);
}

/** Lát của vòng quay: game còn chơi được; luôn chứa kết quả server đã chọn. */
export function wheelSlices(party: PartyStateView): GameId[] {
  const slices = availableGames(playedGameIds(party));
  const result = party.wheelGameId;
  if (isGameId(result) && !slices.includes(result)) slices.push(result);
  return slices.length > 0 ? slices : [...GAME_IDS];
}

/** Gom phiếu bình chọn: gameId → người bầu (theo thứ tự vào phòng). */
export function tallyVotes(party: PartyStateView): Map<GameId, PlayerView[]> {
  const tally = new Map<GameId, PlayerView[]>();
  for (const [playerId, gameId] of Object.entries(party.votes)) {
    const player = party.players[playerId];
    if (!player || !isGameId(gameId)) continue;
    tally.set(gameId, [...(tally.get(gameId) ?? []), player]);
  }
  return tally;
}

/** Game được bầu nhiều nhất; hoà thì lấy game đứng trước trong danh mục. `null` khi chưa ai bầu. */
export function topVoted(tally: Map<GameId, PlayerView[]>): { id: GameId; votes: number } | null {
  let best: { id: GameId; votes: number } | null = null;
  for (const id of GAME_IDS) {
    const votes = tally.get(id)?.length ?? 0;
    if (votes > 0 && (!best || votes > best.votes)) best = { id, votes };
  }
  return best;
}
