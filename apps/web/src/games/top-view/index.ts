import type { GameClient } from "../types";
import { locales } from "./locales";
import { TopViewHowTo } from "./TopViewHowTo";

/** Nhìn từ trên — logic câu đố: packages/shared/src/games/top-view/. */
export const topViewClient: GameClient = {
  scene: () => import("./TopViewScene"),
  locales,
  Illustration: TopViewHowTo,
};
