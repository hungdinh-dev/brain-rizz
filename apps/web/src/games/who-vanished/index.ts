import type { GameClient } from "../types";
import { locales } from "./locales";
import { WhoVanishedHowTo } from "./WhoVanishedHowTo";

/** Ai vừa biến mất — logic câu đố: packages/shared/src/games/who-vanished/. */
export const whoVanishedClient: GameClient = {
  scene: () => import("./WhoVanishedScene"),
  locales,
  Illustration: WhoVanishedHowTo,
};
