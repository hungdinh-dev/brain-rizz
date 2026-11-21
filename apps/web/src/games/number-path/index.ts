import { lazy } from "react";
import type { GameClient } from "../types";
import { locales } from "./locales";
import { NumberPathHowTo } from "./NumberPathHowTo";

/** Đường số — logic câu đố: packages/shared/src/games/number-path/. */
export const numberPathClient: GameClient = {
  scene: () => import("./NumberPathScene"),
  locales,
  Illustration: NumberPathHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./NumberPathDemo").then((m) => ({ default: m.NumberPathDemo }))),
};
