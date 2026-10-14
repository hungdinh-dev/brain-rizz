import type { GameClient } from "../types";
import { CashCountHowTo } from "./CashCountHowTo";
import { locales } from "./locales";

/** Đếm tiền nhanh — logic câu đố: packages/shared/src/games/cash-count/. */
export const cashCountClient: GameClient = {
  scene: () => import("./CashCountScene"),
  locales,
  Illustration: CashCountHowTo,
};
