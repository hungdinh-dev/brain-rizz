import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/stack-recall.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Xếp lại tháp",
    howTo:
      "Nhớ tháp khối từ dưới lên; khăn lau che mất tháp thì chạm khối ở khay để xếp lại y như cũ.",
    summary: "Nhớ tháp khối, xếp lại từ dưới lên",
    steps: ["Nhớ tháp khối từ dưới lên", "Khăn lau che mất tháp", "Chạm khối ở khay, xếp lại tháp"],
    controls: { touch: "Chạm vào khối ở khay", mouse: "Click chuột vào khối ở khay" },
    // Câu nhắc dùng chung cho chạm và click (đặc tả). Mầm, Khó, Siêu khó đổi luật nên có câu riêng.
    hint: { touch: "Nhớ khối từ dưới lên!", mouse: "Nhớ khối từ dưới lên!" },
    levels: ["2 tầng · thứ tự tuỳ ý", "3 tầng · 5 khối", "4 tầng · có lặp", "5 tầng · khay xáo"],
    levelHints: {
      0: { touch: "Thứ tự nào cũng được!", mouse: "Thứ tự nào cũng được!" },
      2: { touch: "Có thể có khối lặp lại!", mouse: "Có thể có khối lặp lại!" },
      3: { touch: "Khay xáo chỗ: tìm theo hình!", mouse: "Khay xáo chỗ: tìm theo hình!" },
    },
  },
  en: {
    title: "Stack Recall",
    howTo:
      "Memorize the block tower from the bottom up; once the cloth wipes it away, tap the tray blocks to rebuild it exactly.",
    summary: "Memorize the tower, rebuild it bottom up",
    steps: [
      "Memorize the tower from the bottom up",
      "A cloth wipes the tower away",
      "Tap tray blocks to rebuild the tower",
    ],
    controls: { touch: "Tap the blocks in the tray", mouse: "Click the blocks in the tray" },
    hint: { touch: "Remember the blocks bottom up!", mouse: "Remember the blocks bottom up!" },
    levels: [
      "2 layers · any order",
      "3 layers · 5 blocks",
      "4 layers · repeats",
      "5 layers · shuffled tray",
    ],
    levelHints: {
      0: { touch: "Any order works!", mouse: "Any order works!" },
      2: { touch: "A block may repeat!", mouse: "A block may repeat!" },
      3: { touch: "Tray is shuffled: find by shape!", mouse: "Tray is shuffled: find by shape!" },
    },
  },
};
