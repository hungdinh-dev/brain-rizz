import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/cup-shuffle.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Tráo cốc",
    howTo:
      "Nhớ cốc úp cục phấn, dõi theo cốc đó khi các cốc tráo chỗ, hết tráo thì chạm vào cốc có phấn.",
    summary: "Dõi theo cốc úp cục phấn",
    steps: ["Nhớ cốc úp cục phấn", "Dõi theo cốc khi tráo", "Hết tráo, chạm cốc có phấn"],
    controls: {
      touch: "Chạm vào cốc",
      mouse: "Click chuột vào cốc, hoặc phím 1–5 = cốc thứ 1–5 từ trái sang",
    },
    // Câu nhắc dùng chung cho chạm và click (đặc tả). Khó, Siêu khó đổi luật nên có câu riêng.
    hint: { touch: "Đừng rời mắt khỏi cục phấn!", mouse: "Đừng rời mắt khỏi cục phấn!" },
    levels: [
      "3 cốc · 3 lượt",
      "3 cốc · 5 lượt nhanh",
      "4 cốc · có xoay vòng",
      "5 cốc · phấn và tẩy",
    ],
    levelHints: {
      2: { touch: "Có lượt ba cốc xoay vòng!", mouse: "Có lượt ba cốc xoay vòng!" },
      3: { touch: "Nhớ cả phấn lẫn tẩy!", mouse: "Nhớ cả phấn lẫn tẩy!" },
    },
  },
  en: {
    title: "Cup Shuffle",
    howTo:
      "Remember which cup hides the chalk, follow that cup as the cups shuffle, then tap the cup with the chalk.",
    summary: "Follow the cup hiding the chalk",
    steps: [
      "Remember the cup hiding the chalk",
      "Follow that cup as they shuffle",
      "When it stops, tap the chalk cup",
    ],
    controls: {
      touch: "Tap a cup",
      mouse: "Click a cup, or press 1–5 for cups 1–5 from the left",
    },
    hint: { touch: "Keep your eyes on the chalk!", mouse: "Keep your eyes on the chalk!" },
    levels: [
      "3 cups · 3 moves",
      "3 cups · 5 quick moves",
      "4 cups · with rotations",
      "5 cups · chalk and eraser",
    ],
    levelHints: {
      2: { touch: "Some moves rotate three cups!", mouse: "Some moves rotate three cups!" },
      3: {
        touch: "Remember both the chalk and the eraser!",
        mouse: "Remember both the chalk and the eraser!",
      },
    },
  },
};
