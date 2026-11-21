import { lazy } from "react";
import type { GameClient } from "../types";
import { AimTrainerHowTo } from "./AimTrainerHowTo";
import { locales } from "./locales";

/** Luyện ngắm — logic câu đố: packages/shared/src/games/aim-trainer/. */
export const aimTrainerClient: GameClient = {
  scene: () => import("./AimTrainerScene"),
  locales,
  Illustration: AimTrainerHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./AimTrainerDemo").then((m) => ({ default: m.AimTrainerDemo }))),
};
