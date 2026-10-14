import { balance } from "./balance/balance";
import { cashCount } from "./cash-count/cash-count";
import { hitTarget } from "./hit-target/hit-target";
import { lightTrail } from "./light-trail/light-trail";
import { numberBalloons } from "./number-balloons/number-balloons";
import { oddOneOut } from "./odd-one-out/odd-one-out";
import { rotateMatch } from "./rotate-match/rotate-match";
import type { AnyMinigame } from "./types";

/**
 * Danh mục minigame. Mỗi game là một thư mục `src/games/<id>/` (bộ sinh câu đố + test).
 * Tạo game mới bằng `pnpm new-game <id> <nhóm>` — script tự đăng ký vào đây.
 * Xem docs/03-guides/development.md mục "Thêm một minigame".
 */
export const GAMES = {
  "odd-one-out": oddOneOut,
  "light-trail": lightTrail,
  balance: balance,
  "number-balloons": numberBalloons,
  "rotate-match": rotateMatch,
  "hit-target": hitTarget,
  "cash-count": cashCount,
  // @new-game:entry
} as const satisfies Record<string, AnyMinigame>;

export type GameId = keyof typeof GAMES;

export const GAME_IDS = Object.keys(GAMES) as [GameId, ...GameId[]];

export function isGameId(value: unknown): value is GameId {
  return typeof value === "string" && value in GAMES;
}

export function getGame(id: GameId): AnyMinigame {
  return GAMES[id];
}

export * from "./balance/balance";
export * from "./cash-count/cash-count";
export * from "./hit-target/hit-target";
export * from "./light-trail/light-trail";
export * from "./number-balloons/number-balloons";
export * from "./odd-one-out/odd-one-out";
export * from "./rotate-match/rotate-match";
export * from "./types";
