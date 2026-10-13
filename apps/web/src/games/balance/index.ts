import type { GameClient } from "../types";
import { BalanceHowTo } from "./BalanceHowTo";
import { locales } from "./locales";

/** Cân não — logic câu đố: packages/shared/src/games/balance/. */
export const balanceClient: GameClient = {
  scene: () => import("./BalanceScene"),
  locales,
  Illustration: BalanceHowTo,
};
