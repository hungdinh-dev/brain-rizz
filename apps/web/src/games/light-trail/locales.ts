import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/light-trail.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Theo dấu ánh đèn",
    howTo:
      "Xem các ô đèn lần lượt sáng rồi chạm lại đúng thứ tự; Siêu khó thì chạm ngược từ ô cuối.",
    summary: "Xem đèn sáng, chạm lại đúng thứ tự",
    steps: ["Xem các ô lần lượt sáng", "Chạm lại đúng thứ tự đó", "Siêu khó: chạm ngược từ ô cuối"],
    controls: { touch: "Chạm vào ô đèn", mouse: "Click chuột vào ô đèn" },
    // Câu nhắc dùng chung cho chạm và click (đặc tả). Siêu khó đổi luật (chạm ngược) nên có câu riêng.
    hint: { touch: "Nhớ thứ tự đèn sáng!", mouse: "Nhớ thứ tự đèn sáng!" },
    levels: ["3×3 · 3 đèn", "3×3 · 4 đèn", "4×4 · 5 đèn", "4×4 · 5 đèn · ngược"],
    levelHints: {
      3: { touch: "Nhớ đèn, chạm ngược lại!", mouse: "Nhớ đèn, chạm ngược lại!" },
    },
  },
  en: {
    title: "Light Trail",
    howTo:
      "Watch the lights flash one by one, then tap them back in the same order; on Expert, tap in reverse from the last one.",
    summary: "Watch the lights, tap them back in order",
    steps: [
      "Watch the tiles light up one by one",
      "Tap them back in the same order",
      "Expert: tap in reverse from the last",
    ],
    controls: { touch: "Tap the light tiles", mouse: "Click the light tiles" },
    hint: { touch: "Remember the light order!", mouse: "Remember the light order!" },
    levels: ["3×3 · 3 lights", "3×3 · 4 lights", "4×4 · 5 lights", "4×4 · 5 lights · reverse"],
    levelHints: {
      3: {
        touch: "Remember the lights, tap in reverse!",
        mouse: "Remember the lights, tap in reverse!",
      },
    },
  },
};
