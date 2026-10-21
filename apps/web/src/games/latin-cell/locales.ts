import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/latin-cell.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Ô bí ẩn",
    howTo:
      "Mỗi hàng, mỗi cột (và mỗi khối viền đậm) có đủ mọi hình, mỗi hình đúng một lần. Tìm hình còn thiếu ở ô ? rồi chạm thẻ hình đó.",
    summary: "Hình nào làm đủ hàng và cột?",
    steps: [
      "Mỗi hàng, mỗi cột đủ mọi hình",
      "Tìm hình còn thiếu ở ô ?",
      "Chạm thẻ hình đúng bên dưới",
    ],
    controls: {
      touch: "Chạm thẻ hình bên dưới",
      mouse: "Click thẻ hình, hoặc phím 1 … n chọn thẻ thứ 1 … n (trái sang phải)",
    },
    hint: { touch: "Ô ? là hình gì?", mouse: "Ô ? là hình gì?" },
    levels: [
      "3×3 · một hàng hoặc cột đã đủ",
      "4×4 · gộp hàng và cột",
      "4×4 · có khối, suy qua một ô",
      "6×6 · 6 hình, suy qua hai ô",
    ],
    levelHints: {
      2: { touch: "Khối viền đậm cũng đủ mọi hình!", mouse: "Khối viền đậm cũng đủ mọi hình!" },
      3: { touch: "Chốt ô bên cạnh trước!", mouse: "Chốt ô bên cạnh trước!" },
    },
  },
  en: {
    title: "Mystery Cell",
    howTo:
      "Every row and column (and every bold box) has each shape exactly once. Find the shape missing from the ? cell and tap its card.",
    summary: "Which shape completes the row and column?",
    steps: [
      "Each row and column has every shape",
      "Find the shape missing from the ? cell",
      "Tap the matching card below",
    ],
    controls: {
      touch: "Tap a shape card below",
      mouse: "Click a shape card, or press 1 … n for card 1 … n (left to right)",
    },
    hint: { touch: "What goes in the ? cell?", mouse: "What goes in the ? cell?" },
    levels: [
      "3×3 · one row or column is full",
      "4×4 · combine row and column",
      "4×4 · bold boxes, solve one cell first",
      "6×6 · 6 shapes, solve two cells first",
    ],
    levelHints: {
      2: {
        touch: "Bold boxes have every shape too!",
        mouse: "Bold boxes have every shape too!",
      },
      3: { touch: "Pin down a nearby cell first!", mouse: "Pin down a nearby cell first!" },
    },
  },
};
