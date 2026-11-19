import { lazy } from "react";
import type { GameClient } from "../types";
import { LightTrailHowTo } from "./LightTrailHowTo";
import { locales } from "./locales";

/** Theo dấu ánh đèn — logic câu đố: packages/shared/src/games/light-trail/. */
export const lightTrailClient: GameClient = {
  scene: () => import("./LightTrailScene"),
  locales,
  Illustration: LightTrailHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./LightTrailDemo").then((m) => ({ default: m.LightTrailDemo }))),
};
