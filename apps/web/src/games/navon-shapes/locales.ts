import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/navon-shapes.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Hình to hình nhỏ",
    howTo:
      "Hình to ghép từ nhiều hình nhỏ. Khung tròn: chạm nút hình to. Khung vuông (từ Khó): chạm nút hình nhỏ.",
    summary: "Chọn hình to hay hình nhỏ theo khung",
    steps: [
      "Nhìn hình to ghép từ hình nhỏ",
      "Khung tròn: chạm hình to",
      "Khung vuông (từ Khó): chạm hình nhỏ",
    ],
    controls: {
      touch: "Chạm nút hình",
      mouse: "Click nút hình, hoặc phím số 1–5 theo nút từ trái sang",
    },
    hint: { touch: "Hình to là hình gì?", mouse: "Hình to là hình gì?" },
    levels: [
      "3 hình · chọn hình to",
      "4 hình · hình nhỏ đánh lừa",
      "Khung tròn hình to, vuông hình nhỏ",
      "5 hình · nút đổi chỗ",
    ],
    levelHints: {
      2: {
        touch: "Tròn: hình to · Vuông: hình nhỏ!",
        mouse: "Tròn: hình to · Vuông: hình nhỏ!",
      },
      3: { touch: "Nhớ luật khung, nút đổi chỗ!", mouse: "Nhớ luật khung, nút đổi chỗ!" },
    },
  },
  en: {
    title: "Big Shape, Small Shape",
    howTo:
      "A big shape is made of small ones. Round frame: tap the big shape. Square frame (from Hard): tap the small shape.",
    summary: "Pick the big or small shape",
    steps: [
      "See the big shape made of small ones",
      "Round frame: tap the big shape",
      "Square frame (from Hard): tap the small one",
    ],
    controls: {
      touch: "Tap a shape button",
      mouse: "Click a shape button, or number keys 1–5 from left to right",
    },
    hint: { touch: "What's the big shape?", mouse: "What's the big shape?" },
    levels: [
      "3 shapes · pick the big one",
      "4 shapes · small ones trick you",
      "Round: big shape, square: small one",
      "5 shapes · buttons move",
    ],
    levelHints: {
      2: {
        touch: "Round: big shape · Square: small ones!",
        mouse: "Round: big shape · Square: small ones!",
      },
      3: { touch: "Mind the frame, buttons move!", mouse: "Mind the frame, buttons move!" },
    },
  },
};
