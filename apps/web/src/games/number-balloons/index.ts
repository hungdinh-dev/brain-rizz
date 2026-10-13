import type { GameClient } from "../types";
import { locales } from "./locales";
import { NumberBalloonsHowTo } from "./NumberBalloonsHowTo";

/** Bóng bay số — logic câu đố: packages/shared/src/games/number-balloons/. */
export const numberBalloonsClient: GameClient = {
  scene: () => import("./NumberBalloonsScene"),
  locales,
  Illustration: NumberBalloonsHowTo,
};
