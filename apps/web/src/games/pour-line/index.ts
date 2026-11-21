import { lazy } from "react";
import type { GameClient } from "../types";
import { locales } from "./locales";
import { PourLineHowTo } from "./PourLineHowTo";

/** Rót vừa vạch — logic câu đố: packages/shared/src/games/pour-line/. */
export const pourLineClient: GameClient = {
  scene: () => import("./PourLineScene"),
  locales,
  Illustration: PourLineHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./PourLineDemo").then((m) => ({ default: m.PourLineDemo }))),
};
