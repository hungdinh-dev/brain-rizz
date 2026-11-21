import { lazy } from "react";
import type { GameClient } from "../types";
import { locales } from "./locales";
import { RhythmEchoHowTo } from "./RhythmEchoHowTo";

/** Nhại nhịp — logic câu đố: packages/shared/src/games/rhythm-echo/. */
export const rhythmEchoClient: GameClient = {
  scene: () => import("./RhythmEchoScene"),
  locales,
  Illustration: RhythmEchoHowTo,
  // Hình động màn Hướng dẫn: tải lười thành chunk riêng khi mở màn Hướng dẫn (CR-021).
  Demo: lazy(() => import("./RhythmEchoDemo").then((m) => ({ default: m.RhythmEchoDemo }))),
};
