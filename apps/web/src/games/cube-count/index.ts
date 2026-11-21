import { lazy } from "react";
import type { GameClient } from "../types";
import { CubeCountHowTo } from "./CubeCountHowTo";
import { locales } from "./locales";

/** Đếm khối — logic câu đố: packages/shared/src/games/cube-count/. */
export const cubeCountClient: GameClient = {
  scene: () => import("./CubeCountScene"),
  locales,
  Illustration: CubeCountHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./CubeCountDemo").then((m) => ({ default: m.CubeCountDemo }))),
};
