import type { GameClient } from "../types";
import { CubeCountHowTo } from "./CubeCountHowTo";
import { locales } from "./locales";

/** Đếm khối — logic câu đố: packages/shared/src/games/cube-count/. */
export const cubeCountClient: GameClient = {
  scene: () => import("./CubeCountScene"),
  locales,
  Illustration: CubeCountHowTo,
};
