import type { GameClient } from "../types";
import { locales } from "./locales";
import { ShadowMatchHowTo } from "./ShadowMatchHowTo";

/** Bóng của ai — logic câu đố: packages/shared/src/games/shadow-match/. */
export const shadowMatchClient: GameClient = {
  scene: () => import("./ShadowMatchScene"),
  locales,
  Illustration: ShadowMatchHowTo,
};
