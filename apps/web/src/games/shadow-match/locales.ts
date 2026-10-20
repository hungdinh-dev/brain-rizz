import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/shadow-match.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Bóng của ai",
    howTo:
      "Chạm vào bóng đen có đúng hình dạng của đồ vật; bóng bị xoay hay lật vẫn đúng, bóng thiếu hoặc thừa chi tiết là sai.",
    summary: "Chọn bóng đen khớp với đồ vật",
    steps: ["Nhìn đồ vật có màu", "Tìm bóng giống hệt hình dạng", "Bóng xoay hay lật vẫn đúng"],
    controls: { touch: "Chạm vào bóng", mouse: "Click chuột vào bóng" },
    hint: { touch: "Bóng nào của đồ vật?", mouse: "Bóng nào của đồ vật?" },
    levels: ["3 bóng", "4 bóng", "6 bóng · xoay", "6 bóng · xoay + lật"],
    levelHints: {
      2: { touch: "Bóng có thể bị xoay!", mouse: "Bóng có thể bị xoay!" },
      3: { touch: "Bóng xoay và lật, soi chi tiết!", mouse: "Bóng xoay và lật, soi chi tiết!" },
    },
  },
  en: {
    title: "Whose Shadow",
    howTo:
      "Tap the black shadow with exactly the object's shape; a turned or flipped shadow still counts, one with a missing or extra detail does not.",
    summary: "Match the shadow to the object",
    steps: [
      "Look at the colored object",
      "Find the shadow with the same shape",
      "Turned or flipped still counts",
    ],
    controls: { touch: "Tap the shadow", mouse: "Click the shadow" },
    hint: { touch: "Which shadow is it?", mouse: "Which shadow is it?" },
    levels: ["3 shadows", "4 shadows", "6 shadows · turned", "6 shadows · turned + flipped"],
    levelHints: {
      2: { touch: "Shadows may be turned!", mouse: "Shadows may be turned!" },
      3: {
        touch: "Turned and flipped, check the details!",
        mouse: "Turned and flipped, check the details!",
      },
    },
  },
};
