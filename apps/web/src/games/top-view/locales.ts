import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/**
 * Chữ của Nhìn từ trên. Ngoài các mục chung, scene còn một nhãn vẽ trên canvas: `front` (nhãn cạnh
 * mép cam của bệ). i18next vẫn nhận khoá này trong namespace `games`, scene đọc theo ngôn ngữ hiện
 * tại (xem `frontLabel` trong TopViewScene.ts).
 */
export type TopViewLocale = GameLocale & {
  /** Nhãn cạnh mép trước (mép cam) của bệ trên thẻ mô hình. */
  front: string;
};

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/top-view.md. */
export const locales: Record<Language, TopViewLocale> = {
  vi: {
    title: "Nhìn từ trên",
    howTo:
      "Nhìn mô hình khối thẳng từ trên xuống rồi chạm hình chiếu đúng; mép cam của bệ là phía trước, nằm ở dưới lưới.",
    summary: "Chọn hình nhìn từ trên xuống",
    steps: ["Nhìn mô hình từ trên xuống", "Mép cam là phía trước", "Chạm hình chiếu đúng"],
    controls: { touch: "Chạm vào hình chiếu", mouse: "Click chuột vào hình chiếu" },
    hint: { touch: "Mép cam nằm ở dưới!", mouse: "Mép cam nằm ở dưới!" },
    levels: [
      "Bệ 3×3 · 3 thẻ",
      "Bệ 3×3 · có bản gương",
      "Bệ 4×4 · ghi số tầng",
      "Bệ 4×4 · cao 4 tầng",
    ],
    levelHints: {
      2: { touch: "Ô ghi số tầng, coi chừng xoay!", mouse: "Ô ghi số tầng, coi chừng xoay!" },
      3: { touch: "Soát kỹ số tầng từng ô!", mouse: "Soát kỹ số tầng từng ô!" },
    },
    front: "Trước",
  },
  en: {
    title: "Top View",
    howTo:
      "Look straight down on the block model and tap the matching view; the orange edge is the front and goes at the bottom of the grid.",
    summary: "Pick the view from above",
    steps: [
      "Look down on the model from above",
      "The orange edge is the front",
      "Tap the matching view",
    ],
    controls: { touch: "Tap the view", mouse: "Click the view" },
    hint: { touch: "Orange edge at the bottom!", mouse: "Orange edge at the bottom!" },
    levels: [
      "3×3 base · 3 cards",
      "3×3 base · mirror traps",
      "4×4 base · heights shown",
      "4×4 base · 4 levels high",
    ],
    levelHints: {
      2: {
        touch: "Numbers are heights, watch for turns!",
        mouse: "Numbers are heights, watch for turns!",
      },
      3: { touch: "Check every height!", mouse: "Check every height!" },
    },
    front: "Front",
  },
};
