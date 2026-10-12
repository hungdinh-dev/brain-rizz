import type { GameClient } from "../types";
import { locales } from "./locales";
import { RotateMatchHowTo } from "./RotateMatchHowTo";

/** Xoay hình — logic câu đố: packages/shared/src/games/rotate-match/. */
export const rotateMatchClient: GameClient = {
  scene: () => import("./RotateMatchScene"),
  locales,
  Illustration: RotateMatchHowTo,
};
