import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/rotate-match.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Xoay hình",
    howTo: "Chạm vào hình là hình mẫu đã được xoay đi; hình bị lật gương hoặc lệch một ô đều sai.",
    summary: "Tìm bản xoay của hình mẫu, tránh bản lật",
    steps: [
      "Nhìn hình mẫu ở trên cùng",
      "Chạm hình là mẫu đã xoay đi",
      "Hình bị lật hoặc lệch ô là sai",
    ],
    controls: { touch: "Chạm vào hình", mouse: "Click chuột vào hình" },
    hint: { touch: "Xoay thì đúng, lật thì sai!", mouse: "Xoay thì đúng, lật thì sai!" },
    levels: ["4 ô · 3 hình", "5 ô · có bản lật", "6 ô · nghiêng 45°", "7 ô · nghiêng lẻ"],
  },
  en: {
    title: "Rotate Match",
    howTo:
      "Tap the shape that is the model turned around; a mirrored shape or one with a cell moved is wrong.",
    summary: "Find the turned copy, not the mirrored one",
    steps: [
      "Look at the model shape at the top",
      "Tap the one that is the model turned",
      "Flipped or shifted shapes are wrong",
    ],
    controls: { touch: "Tap the shape", mouse: "Click the shape" },
    hint: {
      touch: "Turned is right, flipped is wrong!",
      mouse: "Turned is right, flipped is wrong!",
    },
    levels: [
      "4 cells · 3 shapes",
      "5 cells · mirror traps",
      "6 cells · 45° tilts",
      "7 cells · odd tilts",
    ],
  },
};
