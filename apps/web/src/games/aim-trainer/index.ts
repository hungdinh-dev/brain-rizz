import type { GameClient } from "../types";
import { AimTrainerHowTo } from "./AimTrainerHowTo";
import { locales } from "./locales";

/** Luyện ngắm — logic câu đố: packages/shared/src/games/aim-trainer/. */
export const aimTrainerClient: GameClient = {
  scene: () => import("./AimTrainerScene"),
  locales,
  Illustration: AimTrainerHowTo,
};
