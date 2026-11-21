import { lazy } from "react";
import type { GameClient } from "../types";
import { BeadPatternHowTo } from "./BeadPatternHowTo";
import { locales } from "./locales";

/** Chuỗi quy luật — logic câu đố: packages/shared/src/games/bead-pattern/. */
export const beadPatternClient: GameClient = {
  scene: () => import("./BeadPatternScene"),
  locales,
  Illustration: BeadPatternHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./BeadPatternDemo").then((m) => ({ default: m.BeadPatternDemo }))),
};
