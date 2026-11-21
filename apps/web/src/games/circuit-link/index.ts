import { lazy } from "react";
import type { GameClient } from "../types";
import { CircuitLinkHowTo } from "./CircuitLinkHowTo";
import { locales } from "./locales";

/** Nối mạch — logic câu đố: packages/shared/src/games/circuit-link/. */
export const circuitLinkClient: GameClient = {
  scene: () => import("./CircuitLinkScene"),
  locales,
  Illustration: CircuitLinkHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./CircuitLinkDemo").then((m) => ({ default: m.CircuitLinkDemo }))),
};
