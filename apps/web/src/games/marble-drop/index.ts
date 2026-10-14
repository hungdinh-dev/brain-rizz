import type { GameClient } from "../types";
import { locales } from "./locales";
import { MarbleDropHowTo } from "./MarbleDropHowTo";

/** Bi rơi đâu — logic câu đố: packages/shared/src/games/marble-drop/. */
export const marbleDropClient: GameClient = {
  scene: () => import("./MarbleDropScene"),
  locales,
  Illustration: MarbleDropHowTo,
};
