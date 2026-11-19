import { lazy } from "react";
import type { GameClient } from "../types";
import { BalanceHowTo } from "./BalanceHowTo";
import { locales } from "./locales";

/** Cân não — logic câu đố: packages/shared/src/games/balance/. */
export const balanceClient: GameClient = {
  scene: () => import("./BalanceScene"),
  locales,
  Illustration: BalanceHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./BalanceDemo").then((m) => ({ default: m.BalanceDemo }))),
};
