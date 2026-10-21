import type { GameClient } from "../types";
import { locales } from "./locales";
import { RhythmEchoHowTo } from "./RhythmEchoHowTo";

/** Nhại nhịp — logic câu đố: packages/shared/src/games/rhythm-echo/. */
export const rhythmEchoClient: GameClient = {
  scene: () => import("./RhythmEchoScene"),
  locales,
  Illustration: RhythmEchoHowTo,
};
