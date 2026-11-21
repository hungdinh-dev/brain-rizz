import { lazy } from "react";
import type { GameClient } from "../types";
import { locales } from "./locales";
import { PairFlipHowTo } from "./PairFlipHowTo";

/** Lật cặp — logic câu đố: packages/shared/src/games/pair-flip/. */
export const pairFlipClient: GameClient = {
  scene: () => import("./PairFlipScene"),
  locales,
  Illustration: PairFlipHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./PairFlipDemo").then((m) => ({ default: m.PairFlipDemo }))),
};
