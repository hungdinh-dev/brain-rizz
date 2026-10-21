import type { GameClient } from "../types";
import { BeadPatternHowTo } from "./BeadPatternHowTo";
import { locales } from "./locales";

/** Chuỗi quy luật — logic câu đố: packages/shared/src/games/bead-pattern/. */
export const beadPatternClient: GameClient = {
  scene: () => import("./BeadPatternScene"),
  locales,
  Illustration: BeadPatternHowTo,
};
