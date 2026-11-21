import { lazy } from "react";
import type { GameClient } from "../types";
import { BestBasketHowTo } from "./BestBasketHowTo";
import { locales } from "./locales";

/** Giỏ hời nhất — logic câu đố: packages/shared/src/games/best-basket/. */
export const bestBasketClient: GameClient = {
  scene: () => import("./BestBasketScene"),
  locales,
  Illustration: BestBasketHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./BestBasketDemo").then((m) => ({ default: m.BestBasketDemo }))),
};
