import { lazy } from "react";
import type { GameClient } from "../types";
import { locales } from "./locales";
import { OddOneOutHowTo } from "./OddOneOutHowTo";

/** Kẻ lạc đàn — logic câu đố: packages/shared/src/games/odd-one-out/. */
export const oddOneOutClient: GameClient = {
  scene: () => import("./OddOneOutScene"),
  locales,
  Illustration: OddOneOutHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./OddOneOutDemo").then((m) => ({ default: m.OddOneOutDemo }))),
};
