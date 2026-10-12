import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/odd-one-out.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Kẻ lạc đàn",
    howTo: "Chạm vào hình duy nhất khác với tất cả các hình còn lại.",
    summary: "Tìm hình khác biệt trong lưới",
    steps: [
      "Nhìn lưới hình giống nhau",
      "Chạm vào hình duy nhất khác biệt",
      "Đúng và nhanh để được nhiều điểm",
    ],
    controls: { touch: "Chạm vào hình", mouse: "Click chuột vào hình" },
    hint: { touch: "Chạm vào hình khác biệt!", mouse: "Click vào hình khác biệt!" },
    levels: ["Lưới 3×3", "Lưới 4×4", "5×5 · chỉ khác màu", "6×6 · chỉ khác góc xoay"],
  },
  en: {
    title: "Odd One Out",
    howTo: "Tap the one shape that's different from all the others.",
    summary: "Find the different shape in the grid",
    steps: [
      "Look at the grid of matching shapes",
      "Tap the only one that's different",
      "Be right and fast for more points",
    ],
    controls: { touch: "Tap the shape", mouse: "Click the shape" },
    hint: { touch: "Tap the different shape!", mouse: "Click the different shape!" },
    levels: ["3×3 grid", "4×4 grid", "5×5 · colour only", "6×6 · rotation only"],
  },
};
