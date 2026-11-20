import { lazy } from "react";
import type { GameClient } from "../types";
import { locales } from "./locales";
import { RotateMatchHowTo } from "./RotateMatchHowTo";

/** Xoay hình — logic câu đố: packages/shared/src/games/rotate-match/. */
export const rotateMatchClient: GameClient = {
  scene: () => import("./RotateMatchScene"),
  locales,
  Illustration: RotateMatchHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./RotateMatchDemo").then((m) => ({ default: m.RotateMatchDemo }))),
};
