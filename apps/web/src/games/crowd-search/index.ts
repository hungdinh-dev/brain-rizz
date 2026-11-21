import { lazy } from "react";
import type { GameClient } from "../types";
import { CrowdSearchHowTo } from "./CrowdSearchHowTo";
import { locales } from "./locales";

/** Tìm bạn — logic câu đố: packages/shared/src/games/crowd-search/. */
export const crowdSearchClient: GameClient = {
  scene: () => import("./CrowdSearchScene"),
  locales,
  Illustration: CrowdSearchHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./CrowdSearchDemo").then((m) => ({ default: m.CrowdSearchDemo }))),
};
