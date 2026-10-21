import type { GameClient } from "../types";
import { locales } from "./locales";
import { RuleGateHowTo } from "./RuleGateHowTo";

/** Cổng luật — logic câu đố: packages/shared/src/games/rule-gate/. */
export const ruleGateClient: GameClient = {
  scene: () => import("./RuleGateScene"),
  locales,
  Illustration: RuleGateHowTo,
};
