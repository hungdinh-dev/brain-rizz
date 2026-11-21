import { lazy } from "react";
import type { GameClient } from "../types";
import { HitTargetHowTo } from "./HitTargetHowTo";
import { locales } from "./locales";

/** Chạm đích — logic câu đố: packages/shared/src/games/hit-target/. */
export const hitTargetClient: GameClient = {
  scene: () => import("./HitTargetScene"),
  locales,
  Illustration: HitTargetHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./HitTargetDemo").then((m) => ({ default: m.HitTargetDemo }))),
};
