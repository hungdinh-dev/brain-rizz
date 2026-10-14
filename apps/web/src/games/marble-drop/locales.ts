import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/marble-drop.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Bi rơi đâu",
    howTo:
      "Lần theo mũi tên trên các cần gạt rồi chạm cốc bi rơi vào. Công tắc vàng lật sau mỗi bi đi qua.",
    summary: "Đoán bi lăn ra ở lối nào",
    steps: ["Lần theo mũi tên cần gạt", "Chạm cốc bi rơi vào", "Công tắc vàng lật sau mỗi bi"],
    controls: { touch: "Chạm vào cốc", mouse: "Click chuột vào cốc" },
    hint: { touch: "Lần theo mũi tên!", mouse: "Lần theo mũi tên!" },
    levels: ["2 tầng · 3 cốc", "3 tầng · 4 cốc", "4 tầng · 2 bi", "4 tầng · 3 bi"],
    levelHints: {
      2: { touch: "Công tắc lật sau mỗi bi!", mouse: "Công tắc lật sau mỗi bi!" },
      3: { touch: "3 bi, hỏi bi cuối!", mouse: "3 bi, hỏi bi cuối!" },
    },
  },
  en: {
    title: "Marble Drop",
    howTo:
      "Follow the lever arrows, then tap the cup the marble lands in. Yellow switches flip after each marble passes.",
    summary: "Guess where the marble comes out",
    steps: [
      "Follow the lever arrows",
      "Tap the cup the marble lands in",
      "Yellow switches flip after each marble",
    ],
    controls: { touch: "Tap the cup", mouse: "Click the cup" },
    hint: { touch: "Follow the arrows!", mouse: "Follow the arrows!" },
    levels: ["2 tiers · 3 cups", "3 tiers · 4 cups", "4 tiers · 2 marbles", "4 tiers · 3 marbles"],
    levelHints: {
      2: {
        touch: "Switches flip after each marble!",
        mouse: "Switches flip after each marble!",
      },
      3: { touch: "3 marbles, find the last one!", mouse: "3 marbles, find the last one!" },
    },
  },
};
