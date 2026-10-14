import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/hit-target.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Chạm đích",
    howTo: "Chạm các thẻ có tổng bằng số đích.",
    summary: "Chọn các số cộng lại đúng số đích",
    steps: [
      "Nhìn số đích trong hồng tâm",
      "Chạm các thẻ cộng lại bằng đích",
      "Chạm lại thẻ để bỏ chọn",
    ],
    controls: { touch: "Chạm vào thẻ số", mouse: "Click chuột vào thẻ số" },
    hint: { touch: "Cộng thẻ cho trúng đích!", mouse: "Cộng thẻ cho trúng đích!" },
    levels: [
      "6 thẻ · chọn 2 · số 1–9",
      "9 thẻ · chọn 3 · số đến 20",
      "9 thẻ · chọn 3 · số đến 60",
      "9 thẻ · chọn 3 · có số âm",
    ],
    // Câu nhắc theo mức của đặc tả: Mầm chọn 2 thẻ (mức khác 3), Siêu khó có luật riêng.
    levelHints: {
      0: { touch: "Chọn 2 thẻ cộng bằng đích", mouse: "Chọn 2 thẻ cộng bằng đích" },
      3: { touch: "Đáp án có đúng một thẻ âm", mouse: "Đáp án có đúng một thẻ âm" },
    },
  },
  en: {
    title: "Hit the Target",
    howTo: "Tap the cards that add up to the target number.",
    summary: "Pick numbers that add up to the target",
    steps: [
      "Read the target number in the bullseye",
      "Tap cards that add up to the target",
      "Tap a card again to unselect it",
    ],
    controls: { touch: "Tap a number card", mouse: "Click a number card" },
    hint: { touch: "Add the cards, hit the target!", mouse: "Add the cards, hit the target!" },
    levels: [
      "6 cards · pick 2 · numbers 1–9",
      "9 cards · pick 3 · up to 20",
      "9 cards · pick 3 · up to 60",
      "9 cards · pick 3 · negative numbers",
    ],
    levelHints: {
      0: { touch: "Pick 2 cards that make the target", mouse: "Pick 2 cards that make the target" },
      3: {
        touch: "Exactly one card in the answer is negative",
        mouse: "Exactly one card in the answer is negative",
      },
    },
  },
};
