import { lazy } from "react";
import type { GameClient } from "../types";
import { ChalkArrowsHowTo } from "./ChalkArrowsHowTo";
import { locales } from "./locales";

/** Phấn trượt — logic câu đố: packages/shared/src/games/chalk-arrows/. */
export const chalkArrowsClient: GameClient = {
  scene: () => import("./ChalkArrowsScene"),
  locales,
  Illustration: ChalkArrowsHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./ChalkArrowsDemo").then((m) => ({ default: m.ChalkArrowsDemo }))),
};
