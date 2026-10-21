import type { GameClient } from "../types";
import { CircuitLinkHowTo } from "./CircuitLinkHowTo";
import { locales } from "./locales";

/** Nối mạch — logic câu đố: packages/shared/src/games/circuit-link/. */
export const circuitLinkClient: GameClient = {
  scene: () => import("./CircuitLinkScene"),
  locales,
  Illustration: CircuitLinkHowTo,
};
