import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/who-vanished.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Ai vừa biến mất",
    howTo:
      "Nhớ các món trên khay trong 3 giây. Rèm che lại, một món biến mất: chạm vào thẻ của món đó.",
    summary: "Nhớ đồ vật, tìm món biến mất",
    steps: ["Nhớ các món trên khay", "Một món biến mất", "Chạm thẻ của món đó"],
    controls: { touch: "Chạm vào thẻ", mouse: "Click chuột vào thẻ" },
    // Câu nhắc dùng chung cho chạm và click (đặc tả). Siêu khó đổi chỗ các món nên có câu riêng.
    hint: { touch: "Nhớ hết các món trên khay!", mouse: "Nhớ hết các món trên khay!" },
    levels: ["4 món · 3 thẻ", "6 món · 4 thẻ", "9 món · 4 thẻ", "9 món · đổi chỗ"],
    levelHints: {
      3: {
        touch: "Khay sẽ xáo: nhớ món, đừng nhớ chỗ!",
        mouse: "Khay sẽ xáo: nhớ món, đừng nhớ chỗ!",
      },
    },
  },
  en: {
    title: "Who Vanished",
    howTo:
      "Memorize the items on the tray for 3 seconds. The curtain drops and one item vanishes: tap its card.",
    summary: "Spot the item that disappeared",
    steps: ["Memorize the items on the tray", "One item vanishes", "Tap that item's card"],
    controls: { touch: "Tap a card", mouse: "Click a card" },
    hint: { touch: "Remember every item on the tray!", mouse: "Remember every item on the tray!" },
    levels: ["4 items · 3 cards", "6 items · 4 cards", "9 items · 4 cards", "9 items · shuffled"],
    levelHints: {
      3: {
        touch: "The tray gets shuffled: remember items, not spots!",
        mouse: "The tray gets shuffled: remember items, not spots!",
      },
    },
  },
};
