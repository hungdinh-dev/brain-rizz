import type { GameClient } from "../types";
import { CupShuffleHowTo } from "./CupShuffleHowTo";
import { locales } from "./locales";

/** Tráo cốc — logic câu đố: packages/shared/src/games/cup-shuffle/. */
export const cupShuffleClient: GameClient = {
  scene: () => import("./CupShuffleScene"),
  locales,
  Illustration: CupShuffleHowTo,
};
