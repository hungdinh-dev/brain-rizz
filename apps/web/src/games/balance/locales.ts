import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/balance.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Cân não",
    howTo: "Bên cân thấp hơn là bên nặng hơn. Đọc các cân rồi chạm vào vật nặng nhất ở hàng dưới.",
    summary: "Nhìn các cân, chọn vật nặng nhất",
    steps: [
      "Bên cân thấp hơn là bên nặng hơn",
      "Cân thăng bằng: hai bên nặng bằng nhau",
      "Chạm vật nặng nhất ở hàng dưới",
    ],
    controls: { touch: "Chạm vào vật", mouse: "Click chuột vào vật" },
    hint: { touch: "Tìm vật nặng nhất!", mouse: "Tìm vật nặng nhất!" },
    levels: ["3 vật · 2 cân", "4 vật · 3 cân", "5 vật · có cân “=”", "6 vật · có đĩa đôi"],
  },
  en: {
    title: "Brain Balance",
    howTo: "The lower pan is the heavier side. Read the scales, then tap the heaviest item below.",
    summary: "Read the scales, pick the heaviest",
    steps: [
      "The lower pan is the heavier side",
      "Level scale: both sides weigh the same",
      "Tap the heaviest item in the bottom row",
    ],
    controls: { touch: "Tap the item", mouse: "Click the item" },
    hint: { touch: "Find the heaviest item!", mouse: "Find the heaviest item!" },
    levels: [
      "3 items · 2 scales",
      "4 items · 3 scales",
      "5 items · adds a “=” scale",
      "6 items · adds a double pan",
    ],
  },
};
