import type { GameClient } from "../types";
import { ChalkArrowsHowTo } from "./ChalkArrowsHowTo";
import { locales } from "./locales";

/** Phấn trượt — logic câu đố: packages/shared/src/games/chalk-arrows/. */
export const chalkArrowsClient: GameClient = {
  scene: () => import("./ChalkArrowsScene"),
  locales,
  Illustration: ChalkArrowsHowTo,
};
