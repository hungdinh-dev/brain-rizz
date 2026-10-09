import { oddOneOut } from "./odd-one-out";
import type { AnyMinigame } from "./types";

/**
 * Danh mục minigame. Thêm game mới:
 *  1. Tạo `src/games/<id>.ts` theo hợp đồng `MinigameDef`.
 *  2. Đăng ký vào object dưới đây.
 *  3. Tạo scene Phaser tương ứng ở `apps/web/src/games/<id>/`.
 * Xem docs/03-development-guide.md mục "Thêm một minigame".
 */
export const GAMES = {
  "odd-one-out": oddOneOut,
} as const satisfies Record<string, AnyMinigame>;

export type GameId = keyof typeof GAMES;

export const GAME_IDS = Object.keys(GAMES) as [GameId, ...GameId[]];

export function isGameId(value: unknown): value is GameId {
  return typeof value === "string" && value in GAMES;
}

export function getGame(id: GameId): AnyMinigame {
  return GAMES[id];
}

export * from "./odd-one-out";
export * from "./types";
