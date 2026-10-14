import type { GameClient } from "../types";
import { HitTargetHowTo } from "./HitTargetHowTo";
import { locales } from "./locales";

/** Chạm đích — logic câu đố: packages/shared/src/games/hit-target/. */
export const hitTargetClient: GameClient = {
  scene: () => import("./HitTargetScene"),
  locales,
  Illustration: HitTargetHowTo,
};
