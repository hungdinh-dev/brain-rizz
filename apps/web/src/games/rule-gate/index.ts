import { lazy } from "react";
import type { GameClient } from "../types";
import { locales } from "./locales";
import { RuleGateHowTo } from "./RuleGateHowTo";

/** Cổng luật — logic câu đố: packages/shared/src/games/rule-gate/. */
export const ruleGateClient: GameClient = {
  scene: () => import("./RuleGateScene"),
  locales,
  Illustration: RuleGateHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./RuleGateDemo").then((m) => ({ default: m.RuleGateDemo }))),
};
