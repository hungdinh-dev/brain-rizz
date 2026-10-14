import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/pair-flip.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Lật cặp",
    howTo:
      "Đầu mỗi bàn được xem nhanh toàn bộ thẻ rồi thẻ úp lại. Mỗi câu, game lật sẵn một thẻ đề có vòng vàng: chạm vào thẻ úp giống hệt nó.",
    summary: "Lật thẻ tìm cặp giống nhau",
    steps: ["Xem nhanh toàn bộ thẻ", "Thẻ đề lật lên, có vòng vàng", "Chạm thẻ úp giống thẻ đề"],
    controls: { touch: "Chạm vào thẻ", mouse: "Click chuột vào thẻ" },
    // Luật như nhau ở mọi mức nên không có levelHints.
    hint: { touch: "Nhớ chỗ từng thẻ!", mouse: "Nhớ chỗ từng thẻ!" },
    levels: [
      "3×2 · 3 cặp · xem 3 s",
      "4×2 · 4 cặp · xem 3 s",
      "4×3 · 6 cặp · xem 4 s",
      "4×4 · 8 cặp · xem 4 s",
    ],
  },
  en: {
    title: "Pair Flip",
    howTo:
      "At the start of each board you get a quick look at every card, then they flip face down. Each turn the game flips a prompt card with a yellow ring: tap the face-down card that matches it.",
    summary: "Flip cards to find matching pairs",
    steps: [
      "Take a quick look at every card",
      "A prompt card flips up with a yellow ring",
      "Tap the face-down card that matches it",
    ],
    controls: { touch: "Tap a card", mouse: "Click a card" },
    hint: { touch: "Remember where each card is!", mouse: "Remember where each card is!" },
    levels: [
      "3×2 · 3 pairs · 3 s look",
      "4×2 · 4 pairs · 3 s look",
      "4×3 · 6 pairs · 4 s look",
      "4×4 · 8 pairs · 4 s look",
    ],
  },
};
