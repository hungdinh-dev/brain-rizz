import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/aim-trainer.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Luyện ngắm",
    howTo:
      "Chạm thật nhanh vào bia hồng tâm; trúng là bia mới hiện ngay. Chậm quá thì bia biến mất, và đừng bắn bia đỏ có dấu X.",
    summary: "Chạm thật nhanh vào hồng tâm",
    steps: [
      "Chạm thật nhanh vào hồng tâm",
      "Trúng là bia mới hiện ngay",
      "Đừng để bia kịp biến mất",
    ],
    controls: { touch: "Chạm vào bia", mouse: "Click chuột vào bia" },
    hint: { touch: "Chạm thật nhanh, thật trúng!", mouse: "Click thật nhanh, thật trúng!" },
    levels: [
      "Bia to · không giới hạn giờ",
      "Bia vừa · 1,5 giây",
      "Bia nhỏ · co dần",
      "Bia nhỏ · có bia mồi",
    ],
    levelHints: {
      2: { touch: "Bia co dần rồi biến mất!", mouse: "Bia co dần rồi biến mất!" },
      3: { touch: "Né bia đỏ có dấu X!", mouse: "Né bia đỏ có dấu X!" },
    },
  },
  en: {
    title: "Quick Aim",
    howTo:
      "Tap the bullseye as fast as you can; a new one pops up right away. Too slow and it vanishes, and never shoot the red target with an X.",
    summary: "Tap the bullseye as fast as you can",
    steps: ["Tap the bullseye fast", "Hit it and a new one pops up", "Don't let it vanish"],
    controls: { touch: "Tap the target", mouse: "Click the target" },
    hint: { touch: "Tap fast, tap true!", mouse: "Click fast, click true!" },
    levels: [
      "Big target · no time limit",
      "Medium target · 1.5 seconds",
      "Small target · shrinks",
      "Small target · decoys",
    ],
    levelHints: {
      2: { touch: "Targets shrink, then vanish!", mouse: "Targets shrink, then vanish!" },
      3: { touch: "Dodge the red X targets!", mouse: "Dodge the red X targets!" },
    },
  },
};

/**
 * Chữ ngắn vẽ trong scene: hai chip trên khung ("23 trúng", "612 ms TB") và nhãn ms sau mỗi lần
 * trúng. Scene đọc theo `currentLanguage()`, như `useGameText` đọc `locales` ở phía React.
 */
export const sceneText: Record<Language, { hits: string; avg: string; ms: string }> = {
  vi: { hits: "trúng", avg: "ms TB", ms: "ms" },
  en: { hits: "hits", avg: "ms avg", ms: "ms" },
};
