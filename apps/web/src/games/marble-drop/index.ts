import { lazy } from "react";
import type { GameClient } from "../types";
import { locales } from "./locales";
import { MarbleDropHowTo } from "./MarbleDropHowTo";

/** Bi rơi đâu — logic câu đố: packages/shared/src/games/marble-drop/. */
export const marbleDropClient: GameClient = {
  scene: () => import("./MarbleDropScene"),
  locales,
  Illustration: MarbleDropHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./MarbleDropDemo").then((m) => ({ default: m.MarbleDropDemo }))),
};
