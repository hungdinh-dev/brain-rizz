import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/crowd-search.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Tìm bạn",
    howTo:
      "Nhìn bạn trên thẻ rồi chạm vào bạn giống hệt trong lớp: cùng con vật, cùng mũ, đồ cầm và kính; món bị gạch trên thẻ thì bạn đó không có.",
    summary: "Tìm đúng bạn giữa đám đông",
    steps: ["Nhìn bạn trên thẻ", "Tìm bạn giống hệt trong lớp", "Chạm vào bạn đó"],
    controls: { touch: "Chạm vào bạn", mouse: "Click chuột vào bạn" },
    hint: { touch: "Bạn nào giống hệt thẻ?", mouse: "Bạn nào giống hệt thẻ?" },
    levels: ["9 bạn", "16 bạn", "25 bạn", "30 bạn · có món cấm"],
    levelHints: {
      2: { touch: "Soi kỹ mũ, kính, đồ cầm!", mouse: "Soi kỹ mũ, kính, đồ cầm!" },
      3: { touch: "Món bị gạch: bạn đó không có!", mouse: "Món bị gạch: bạn đó không có!" },
    },
  },
  en: {
    title: "Find the Pal",
    howTo:
      "Look at the pal on the card, then tap the exact match in the class: same animal, hat, held item and glasses; a crossed-out item on the card means the pal doesn't have it.",
    summary: "Spot the friend in the crowd",
    steps: ["Look at the pal on the card", "Find the exact match in the class", "Tap that pal"],
    controls: { touch: "Tap the pal", mouse: "Click the pal" },
    hint: { touch: "Who matches the card?", mouse: "Who matches the card?" },
    levels: ["9 pals", "16 pals", "25 pals", "30 pals · banned item"],
    levelHints: {
      2: {
        touch: "Check hats, glasses, held items!",
        mouse: "Check hats, glasses, held items!",
      },
      3: {
        touch: "Crossed-out item: the pal doesn't have it!",
        mouse: "Crossed-out item: the pal doesn't have it!",
      },
    },
  },
};
