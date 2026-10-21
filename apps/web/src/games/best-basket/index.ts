import type { GameClient } from "../types";
import { BestBasketHowTo } from "./BestBasketHowTo";
import { locales } from "./locales";

/** Giỏ hời nhất — logic câu đố: packages/shared/src/games/best-basket/. */
export const bestBasketClient: GameClient = {
  scene: () => import("./BestBasketScene"),
  locales,
  Illustration: BestBasketHowTo,
};
