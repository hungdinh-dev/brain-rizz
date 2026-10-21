import type { GameClient } from "../types";
import { locales } from "./locales";
import { PourLineHowTo } from "./PourLineHowTo";

/** Rót vừa vạch — logic câu đố: packages/shared/src/games/pour-line/. */
export const pourLineClient: GameClient = {
  scene: () => import("./PourLineScene"),
  locales,
  Illustration: PourLineHowTo,
};
