import type { GameClient } from "../types";
import { locales } from "./locales";
import { OddOneOutHowTo } from "./OddOneOutHowTo";

/** Kẻ lạc đàn — logic câu đố: packages/shared/src/games/odd-one-out/. */
export const oddOneOutClient: GameClient = {
  scene: () => import("./OddOneOutScene"),
  locales,
  Illustration: OddOneOutHowTo,
};
