import type { GameClient } from "../types";
import { LatinCellHowTo } from "./LatinCellHowTo";
import { locales } from "./locales";

/** Ô bí ẩn — logic câu đố: packages/shared/src/games/latin-cell/. */
export const latinCellClient: GameClient = {
  scene: () => import("./LatinCellScene"),
  locales,
  Illustration: LatinCellHowTo,
};
