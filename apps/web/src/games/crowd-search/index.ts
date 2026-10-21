import type { GameClient } from "../types";
import { CrowdSearchHowTo } from "./CrowdSearchHowTo";
import { locales } from "./locales";

/** Tìm bạn — logic câu đố: packages/shared/src/games/crowd-search/. */
export const crowdSearchClient: GameClient = {
  scene: () => import("./CrowdSearchScene"),
  locales,
  Illustration: CrowdSearchHowTo,
};
