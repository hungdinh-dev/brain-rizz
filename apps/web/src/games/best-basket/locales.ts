import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/best-basket.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Giỏ hời nhất",
    howTo: "Cộng giá và sao từng giỏ, rồi chọn giỏ nhiều sao nhất mà không lố số xu trong túi.",
    summary: "Nhiều sao nhất mà không lố tiền",
    steps: ["Xem số xu trong túi", "Cộng giá và sao từng giỏ", "Chạm giỏ nhiều sao mà đủ tiền"],
    controls: { touch: "Chạm vào giỏ", mouse: "Click chuột vào giỏ" },
    hint: { touch: "Nhiều sao nhất, đừng lố tiền!", mouse: "Nhiều sao nhất, đừng lố tiền!" },
    levels: [
      "3 khay · mỗi khay 1 món",
      "4 giỏ · cộng giá và sao",
      "Có cặp món đi kèm thêm sao",
      "Thêm ưu đãi mua 2 giảm giá",
    ],
    // Câu nhắc theo mức của đặc tả: Khó và Siêu khó thêm luật mới nên bắt buộc có.
    levelHints: {
      2: { touch: "Đủ cặp món nối được thêm sao!", mouse: "Đủ cặp món nối được thêm sao!" },
      3: { touch: "Đủ đôi món ưu đãi thì giảm giá!", mouse: "Đủ đôi món ưu đãi thì giảm giá!" },
    },
  },
  en: {
    title: "Best Basket",
    howTo: "Add up each basket's price and stars, then pick the most stars you can afford.",
    summary: "Most stars without going over budget",
    steps: [
      "Check the coins in your bag",
      "Add up each basket's price and stars",
      "Tap the most stars you can afford",
    ],
    controls: { touch: "Tap a basket", mouse: "Click a basket" },
    hint: { touch: "Most stars, stay on budget!", mouse: "Most stars, stay on budget!" },
    levels: [
      "3 trays · 1 snack each",
      "4 baskets · add price and stars",
      "Linked pairs earn bonus stars",
      "Plus buy-2 discounts",
    ],
    levelHints: {
      2: { touch: "A linked pair earns bonus stars!", mouse: "A linked pair earns bonus stars!" },
      3: { touch: "Two deal snacks cost less!", mouse: "Two deal snacks cost less!" },
    },
  },
};
