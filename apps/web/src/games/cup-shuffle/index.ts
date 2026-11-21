import { lazy } from "react";
import type { GameClient } from "../types";
import { CupShuffleHowTo } from "./CupShuffleHowTo";
import { locales } from "./locales";

/** Tráo cốc — logic câu đố: packages/shared/src/games/cup-shuffle/. */
export const cupShuffleClient: GameClient = {
  scene: () => import("./CupShuffleScene"),
  locales,
  Illustration: CupShuffleHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./CupShuffleDemo").then((m) => ({ default: m.CupShuffleDemo }))),
};
