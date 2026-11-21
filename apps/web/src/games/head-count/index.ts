import { lazy } from "react";
import type { GameClient } from "../types";
import { HeadCountHowTo } from "./HeadCountHowTo";
import { locales } from "./locales";

/** Đếm sĩ số — logic câu đố: packages/shared/src/games/head-count/. */
export const headCountClient: GameClient = {
  scene: () => import("./HeadCountScene"),
  locales,
  Illustration: HeadCountHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./HeadCountDemo").then((m) => ({ default: m.HeadCountDemo }))),
};
