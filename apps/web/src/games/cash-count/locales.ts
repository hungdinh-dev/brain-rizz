import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/cash-count.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Đếm tiền nhanh",
    howTo: "Cộng các tờ tiền trên bàn rồi chọn thẻ ghi đúng tổng.",
    summary: "Cộng tổng các tờ tiền",
    steps: [
      "Cộng nhanh các tờ tiền trên bàn",
      "Chạm thẻ ghi đúng tổng tiền",
      "Chọn sai bị khoá một chút",
    ],
    controls: { touch: "Chạm vào thẻ", mouse: "Click chuột vào thẻ" },
    hint: { touch: "Cộng tiền, chạm tổng đúng!", mouse: "Cộng tiền, click tổng đúng!" },
    levels: [
      "3 tờ · đến 10.000",
      "5 tờ · đến 100.000",
      "6 tờ · có tờ trùng",
      "Tiền thối · trừ hoá đơn",
    ],
    // Câu nhắc theo mức của đặc tả: Mầm và Thường không có; Siêu khó đổi luật nên bắt buộc có.
    levelHints: {
      2: { touch: "Có tờ trùng, đừng bỏ sót!", mouse: "Có tờ trùng, đừng bỏ sót!" },
      3: { touch: "Tiền khách đưa trừ hoá đơn!", mouse: "Tiền khách đưa trừ hoá đơn!" },
    },
  },
  en: {
    title: "Cash Count",
    howTo: "Add up the banknotes on the table, then pick the card with the right total.",
    summary: "Add up the banknotes fast",
    steps: [
      "Quickly add up the notes on the table",
      "Tap the card with the right total",
      "A wrong pick locks you out for a moment",
    ],
    controls: { touch: "Tap a card", mouse: "Click a card" },
    hint: { touch: "Add the cash, tap the total!", mouse: "Add the cash, click the total!" },
    levels: [
      "3 notes · up to 10.000",
      "5 notes · up to 100.000",
      "6 notes · with repeats",
      "Change · paid minus the bill",
    ],
    levelHints: {
      2: {
        touch: "Some notes repeat, count them all!",
        mouse: "Some notes repeat, count them all!",
      },
      3: { touch: "Money paid minus the bill!", mouse: "Money paid minus the bill!" },
    },
  },
};
