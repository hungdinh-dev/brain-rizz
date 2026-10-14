import type { GameClient } from "../types";
import { FoldBoxHowTo } from "./FoldBoxHowTo";
import { locales } from "./locales";

/** Gấp hộp — logic câu đố: packages/shared/src/games/fold-box/. */
export const foldBoxClient: GameClient = {
  scene: () => import("./FoldBoxScene"),
  locales,
  Illustration: FoldBoxHowTo,
};
