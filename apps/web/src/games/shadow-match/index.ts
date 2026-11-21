import { lazy } from "react";
import type { GameClient } from "../types";
import { locales } from "./locales";
import { ShadowMatchHowTo } from "./ShadowMatchHowTo";

/** Bóng của ai — logic câu đố: packages/shared/src/games/shadow-match/. */
export const shadowMatchClient: GameClient = {
  scene: () => import("./ShadowMatchScene"),
  locales,
  Illustration: ShadowMatchHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./ShadowMatchDemo").then((m) => ({ default: m.ShadowMatchDemo }))),
};
