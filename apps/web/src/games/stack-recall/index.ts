import type { GameClient } from "../types";
import { locales } from "./locales";
import { StackRecallHowTo } from "./StackRecallHowTo";

/** Xếp lại tháp — logic câu đố: packages/shared/src/games/stack-recall/. */
export const stackRecallClient: GameClient = {
  scene: () => import("./StackRecallScene"),
  locales,
  Illustration: StackRecallHowTo,
};
