import type { GameClient } from "../types";
import { locales } from "./locales";
import { PieceFitHowTo } from "./PieceFitHowTo";

/** Mảnh vừa khít — logic câu đố: packages/shared/src/games/piece-fit/. */
export const pieceFitClient: GameClient = {
  scene: () => import("./PieceFitScene"),
  locales,
  Illustration: PieceFitHowTo,
};
