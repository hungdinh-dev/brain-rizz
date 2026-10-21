import type { GameClient } from "../types";
import { locales } from "./locales";
import { NumberPathHowTo } from "./NumberPathHowTo";

/** Đường số — logic câu đố: packages/shared/src/games/number-path/. */
export const numberPathClient: GameClient = {
  scene: () => import("./NumberPathScene"),
  locales,
  Illustration: NumberPathHowTo,
};
