import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/cube-count.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Đếm khối",
    howTo:
      "Đếm tất cả khối trên bệ, kể cả khối bị che phía sau và bên dưới, rồi chạm vào thẻ ghi đúng số đó.",
    summary: "Đếm khối lập phương, kể cả khối bị che",
    steps: ["Nhìn mô hình khối trên bệ", "Đếm cả khối bị che khuất", "Chạm thẻ đúng tổng số khối"],
    controls: { touch: "Chạm vào thẻ số", mouse: "Click chuột vào thẻ số" },
    hint: { touch: "Đừng quên khối bị che!", mouse: "Đừng quên khối bị che!" },
    levels: [
      "Bệ 2×3 · 4–6 khối",
      "Bệ 3×3 · 8–12 khối",
      "Bệ 3×4 · 13–18 khối",
      "Bệ 4×4 · 20–26 khối",
    ],
  },
  en: {
    title: "Cube Count",
    howTo:
      "Count every cube on the base, including the ones hidden behind and underneath, then tap the card with that number.",
    summary: "Count the cubes, hidden ones too",
    steps: [
      "Look at the cubes on the base",
      "Count the hidden cubes too",
      "Tap the card with the total",
    ],
    controls: { touch: "Tap a number card", mouse: "Click a number card" },
    hint: { touch: "Don't forget the hidden cubes!", mouse: "Don't forget the hidden cubes!" },
    levels: [
      "2×3 base · 4–6 cubes",
      "3×3 base · 8–12 cubes",
      "3×4 base · 13–18 cubes",
      "4×4 base · 20–26 cubes",
    ],
  },
};
