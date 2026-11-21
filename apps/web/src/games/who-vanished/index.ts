import { lazy } from "react";
import type { GameClient } from "../types";
import { locales } from "./locales";
import { WhoVanishedHowTo } from "./WhoVanishedHowTo";

/** Ai vừa biến mất — logic câu đố: packages/shared/src/games/who-vanished/. */
export const whoVanishedClient: GameClient = {
  scene: () => import("./WhoVanishedScene"),
  locales,
  Illustration: WhoVanishedHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./WhoVanishedDemo").then((m) => ({ default: m.WhoVanishedDemo }))),
};
