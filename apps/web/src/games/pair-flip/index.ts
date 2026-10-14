import type { GameClient } from "../types";
import { locales } from "./locales";
import { PairFlipHowTo } from "./PairFlipHowTo";

/** Lật cặp — logic câu đố: packages/shared/src/games/pair-flip/. */
export const pairFlipClient: GameClient = {
  scene: () => import("./PairFlipScene"),
  locales,
  Illustration: PairFlipHowTo,
};
