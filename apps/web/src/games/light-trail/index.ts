import type { GameClient } from "../types";
import { LightTrailHowTo } from "./LightTrailHowTo";
import { locales } from "./locales";

/** Theo dấu ánh đèn — logic câu đố: packages/shared/src/games/light-trail/. */
export const lightTrailClient: GameClient = {
  scene: () => import("./LightTrailScene"),
  locales,
  Illustration: LightTrailHowTo,
};
