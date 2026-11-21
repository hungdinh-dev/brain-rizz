import { lazy } from "react";
import type { GameClient } from "../types";
import { FoldBoxHowTo } from "./FoldBoxHowTo";
import { locales } from "./locales";

/** Gấp hộp — logic câu đố: packages/shared/src/games/fold-box/. */
export const foldBoxClient: GameClient = {
  scene: () => import("./FoldBoxScene"),
  locales,
  Illustration: FoldBoxHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./FoldBoxDemo").then((m) => ({ default: m.FoldBoxDemo }))),
};
