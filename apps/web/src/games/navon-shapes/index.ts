import { lazy } from "react";
import type { GameClient } from "../types";
import { locales } from "./locales";
import { NavonShapesHowTo } from "./NavonShapesHowTo";

/** Hình to hình nhỏ — logic câu đố: packages/shared/src/games/navon-shapes/. */
export const navonShapesClient: GameClient = {
  scene: () => import("./NavonShapesScene"),
  locales,
  Illustration: NavonShapesHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./NavonShapesDemo").then((m) => ({ default: m.NavonShapesDemo }))),
};
