import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/piece-fit.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Mảnh vừa khít",
    howTo:
      "Chạm vào mảnh lấp vừa khít khoảng trống trong hộp; mảnh được xoay nhưng không được lật.",
    summary: "Chọn mảnh lấp vừa khoảng trống",
    steps: ["Nhìn khoảng trống trong hộp", "Chạm mảnh lấp vừa khít", "Được xoay, không được lật"],
    controls: { touch: "Chạm vào mảnh", mouse: "Click chuột vào mảnh" },
    hint: { touch: "Xoay được, lật thì sai!", mouse: "Xoay được, lật thì sai!" },
    levels: ["3 ô · đúng hướng", "4 ô · phải xoay", "5 ô · có bản lật", "5–6 ô · lật và lệch ô"],
    levelHints: {
      0: { touch: "Mảnh đúng nằm sẵn đúng hướng", mouse: "Mảnh đúng nằm sẵn đúng hướng" },
      2: { touch: "Coi chừng mảnh bị lật gương!", mouse: "Coi chừng mảnh bị lật gương!" },
      3: { touch: "Mảnh nào cũng đủ số ô!", mouse: "Mảnh nào cũng đủ số ô!" },
    },
  },
  en: {
    title: "Perfect Fit",
    howTo: "Tap the piece that exactly fills the gap in the box; pieces may turn but never flip.",
    summary: "Pick the piece that fills the gap",
    steps: [
      "Look at the gap in the box",
      "Tap the piece that fits exactly",
      "Turning is fine, flipping is not",
    ],
    controls: { touch: "Tap the piece", mouse: "Click the piece" },
    hint: { touch: "Turn it, don't flip it!", mouse: "Turn it, don't flip it!" },
    levels: [
      "3 cells · same way up",
      "4 cells · turn to fit",
      "5 cells · mirror traps",
      "5–6 cells · flips and shifts",
    ],
    levelHints: {
      0: {
        touch: "The right piece is already the right way up",
        mouse: "The right piece is already the right way up",
      },
      2: { touch: "Watch out for mirrored pieces!", mouse: "Watch out for mirrored pieces!" },
      3: {
        touch: "Every piece has the same cell count!",
        mouse: "Every piece has the same cell count!",
      },
    },
  },
};
