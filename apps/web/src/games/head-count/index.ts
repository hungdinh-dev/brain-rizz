import type { GameClient } from "../types";
import { HeadCountHowTo } from "./HeadCountHowTo";
import { locales } from "./locales";

/** Đếm sĩ số — logic câu đố: packages/shared/src/games/head-count/. */
export const headCountClient: GameClient = {
  scene: () => import("./HeadCountScene"),
  locales,
  Illustration: HeadCountHowTo,
};
