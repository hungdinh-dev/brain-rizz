import { lazy } from "react";
import type { GameClient } from "../types";
import { locales } from "./locales";
import { TopViewHowTo } from "./TopViewHowTo";

/** Nhìn từ trên — logic câu đố: packages/shared/src/games/top-view/. */
export const topViewClient: GameClient = {
  scene: () => import("./TopViewScene"),
  locales,
  Illustration: TopViewHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./TopViewDemo").then((m) => ({ default: m.TopViewDemo }))),
};
