import type { GameClient } from "../types";
import { locales } from "./locales";
import { NavonShapesHowTo } from "./NavonShapesHowTo";

/** Hình to hình nhỏ — logic câu đố: packages/shared/src/games/navon-shapes/. */
export const navonShapesClient: GameClient = {
  scene: () => import("./NavonShapesScene"),
  locales,
  Illustration: NavonShapesHowTo,
};
