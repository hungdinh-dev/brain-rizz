import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/chalk-arrows.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Phấn trượt",
    howTo:
      "Phấn trắng: vuốt theo hướng mũi tên chỉ. Phấn vàng: vuốt theo hướng mũi tên trượt. Mũi tên bị tẩy mờ thì bỏ qua.",
    summary: "Phấn trắng theo mũi, phấn vàng theo trượt",
    steps: [
      "Phấn trắng: vuốt theo mũi tên chỉ",
      "Phấn vàng: vuốt theo hướng trượt",
      "Nhìn màu phấn trước rồi vuốt",
    ],
    controls: {
      touch: "Vuốt lên/xuống/trái/phải hoặc chạm 4 nút mũi tên",
      mouse: "Phím mũi tên hoặc W A S D, hoặc click 4 nút",
    },
    hint: { touch: "Trắng theo mũi, vàng theo trượt!", mouse: "Trắng theo mũi, vàng theo trượt!" },
    levels: [
      "5 mũi tên trắng · chậm",
      "7 mũi tên · hai màu",
      "10 mũi tên · hay ngược chiều",
      "Trượt nhanh · có nét tẩy mờ",
    ],
    levelHints: {
      0: { touch: "Chỉ phấn trắng: vuốt theo mũi", mouse: "Chỉ phấn trắng: bấm theo mũi" },
      2: { touch: "Màu đổi liên tục, nhìn kỹ!", mouse: "Màu đổi liên tục, nhìn kỹ!" },
      3: { touch: "Mũi tên mờ thì bỏ qua!", mouse: "Mũi tên mờ thì bỏ qua!" },
    },
  },
  en: {
    title: "Chalk Slide",
    howTo:
      "White chalk: swipe the way the arrow points. Yellow chalk: swipe the way the arrow slides. Ignore smudged arrows.",
    summary: "White chalk: follow the point; yellow: follow the slide",
    steps: [
      "White chalk: swipe where the arrow points",
      "Yellow chalk: swipe where it slides",
      "Check the chalk color, then swipe",
    ],
    controls: {
      touch: "Swipe up/down/left/right or tap the 4 arrow buttons",
      mouse: "Arrow keys or W A S D, or click the 4 buttons",
    },
    hint: {
      touch: "White follows the tip, yellow follows the slide!",
      mouse: "White follows the tip, yellow follows the slide!",
    },
    levels: [
      "5 white arrows · slow",
      "7 arrows · two colors",
      "10 arrows · often opposite",
      "Fast slide · smudged arrows",
    ],
    levelHints: {
      0: { touch: "White only: swipe where it points", mouse: "White only: press where it points" },
      2: {
        touch: "Colors keep changing, look closely!",
        mouse: "Colors keep changing, look closely!",
      },
      3: { touch: "Ignore the smudged arrows!", mouse: "Ignore the smudged arrows!" },
    },
  },
};

/**
 * Chữ ngắn vẽ trong scene (chip nhắc luật, câu nhắc vuốt lúc mở vòng). Scene đọc theo
 * `currentLanguage()` mỗi câu, như `useGameText` đọc `locales` ở phía React.
 */
export const sceneText: Record<Language, { point: string; slide: string; swipe: string }> = {
  vi: { point: "theo mũi", slide: "theo trượt", swipe: "Vuốt theo hướng" },
  en: { point: "follow tip", slide: "follow slide", swipe: "Swipe a way" },
};
