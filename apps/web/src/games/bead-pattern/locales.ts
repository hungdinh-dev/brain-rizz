import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/bead-pattern.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Chuỗi quy luật",
    howTo:
      "Tìm quy luật của chuỗi hạt (hình, hoa văn, số chấm), rồi chạm vào hạt vừa với chỗ trống.",
    summary: "Tìm hạt còn thiếu trong chuỗi",
    steps: [
      "Nhìn chuỗi hạt, tìm quy luật",
      "Xem hình, hoa văn và số chấm",
      "Chạm hạt vừa với chỗ trống",
    ],
    controls: {
      touch: "Chạm vào thẻ hạt",
      mouse: "Click thẻ hạt, hoặc phím 1–4 (trái → phải, trên → dưới)",
    },
    hint: { touch: "Hạt nào còn thiếu?", mouse: "Hạt nào còn thiếu?" },
    levels: [
      "6 hạt · một thứ đổi",
      "7 hạt · hình và hoa văn đổi",
      "Có số chấm · trống ở giữa",
      "Chẵn lẻ khác luật · cộng dồn",
    ],
    levelHints: {
      2: {
        touch: "Đếm chấm, chỗ trống có thể ở giữa",
        mouse: "Đếm chấm, chỗ trống có thể ở giữa",
      },
      3: { touch: "Xen kẽ hai luật, hoặc cộng dồn!", mouse: "Xen kẽ hai luật, hoặc cộng dồn!" },
    },
  },
  en: {
    title: "Bead Pattern",
    howTo:
      "Find the rule of the bead chain (shape, pattern, dots), then tap the bead that fits the gap.",
    summary: "Find the missing bead in the chain",
    steps: [
      "Study the chain, find the rule",
      "Check shape, pattern and dots",
      "Tap the bead that fits the gap",
    ],
    controls: {
      touch: "Tap a bead card",
      mouse: "Click a bead card, or keys 1–4 (left → right, top → bottom)",
    },
    hint: { touch: "Which bead is missing?", mouse: "Which bead is missing?" },
    levels: [
      "6 beads · one thing changes",
      "7 beads · shape and pattern change",
      "Dots to count · gap in the middle",
      "Odd and even differ · running sums",
    ],
    levelHints: {
      2: {
        touch: "Count the dots; the gap may be in the middle",
        mouse: "Count the dots; the gap may be in the middle",
      },
      3: {
        touch: "Two rules take turns, or a running sum!",
        mouse: "Two rules take turns, or a running sum!",
      },
    },
  },
};
