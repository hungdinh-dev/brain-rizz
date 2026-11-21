import { lazy } from "react";
import type { GameClient } from "../types";
import { LatinCellHowTo } from "./LatinCellHowTo";
import { locales } from "./locales";

/** Ô bí ẩn — logic câu đố: packages/shared/src/games/latin-cell/. */
export const latinCellClient: GameClient = {
  scene: () => import("./LatinCellScene"),
  locales,
  Illustration: LatinCellHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./LatinCellDemo").then((m) => ({ default: m.LatinCellDemo }))),
};
