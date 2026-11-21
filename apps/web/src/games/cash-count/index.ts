import { lazy } from "react";
import type { GameClient } from "../types";
import { CashCountHowTo } from "./CashCountHowTo";
import { locales } from "./locales";

/** Đếm tiền nhanh — logic câu đố: packages/shared/src/games/cash-count/. */
export const cashCountClient: GameClient = {
  scene: () => import("./CashCountScene"),
  locales,
  Illustration: CashCountHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./CashCountDemo").then((m) => ({ default: m.CashCountDemo }))),
};
