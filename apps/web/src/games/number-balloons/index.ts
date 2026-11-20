import { lazy } from "react";
import type { GameClient } from "../types";
import { locales } from "./locales";
import { NumberBalloonsHowTo } from "./NumberBalloonsHowTo";

/** Bóng bay số — logic câu đố: packages/shared/src/games/number-balloons/. */
export const numberBalloonsClient: GameClient = {
  scene: () => import("./NumberBalloonsScene"),
  locales,
  Illustration: NumberBalloonsHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./NumberBalloonsDemo").then((m) => ({ default: m.NumberBalloonsDemo }))),
};
