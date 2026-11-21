import { lazy } from "react";
import type { GameClient } from "../types";
import { locales } from "./locales";
import { StackRecallHowTo } from "./StackRecallHowTo";

/** Xếp lại tháp — logic câu đố: packages/shared/src/games/stack-recall/. */
export const stackRecallClient: GameClient = {
  scene: () => import("./StackRecallScene"),
  locales,
  Illustration: StackRecallHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./StackRecallDemo").then((m) => ({ default: m.StackRecallDemo }))),
};
