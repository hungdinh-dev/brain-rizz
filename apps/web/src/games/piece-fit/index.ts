import { lazy } from "react";
import type { GameClient } from "../types";
import { locales } from "./locales";
import { PieceFitHowTo } from "./PieceFitHowTo";

/** Mảnh vừa khít — logic câu đố: packages/shared/src/games/piece-fit/. */
export const pieceFitClient: GameClient = {
  scene: () => import("./PieceFitScene"),
  locales,
  Illustration: PieceFitHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./PieceFitDemo").then((m) => ({ default: m.PieceFitDemo }))),
};
