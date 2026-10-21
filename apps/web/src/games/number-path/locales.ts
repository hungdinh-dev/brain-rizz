import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/number-path.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Đường số",
    howTo: "Chạm cửa ra của đường tính ra đúng số đích.",
    summary: "Chọn đường tính ra đúng số đích",
    steps: [
      "Nhìn số xuất phát và số đích",
      "Tính dọc từng đường, từng ô",
      "Chạm cửa ra của đường đúng",
    ],
    controls: { touch: "Chạm vào cửa ra", mouse: "Click chuột vào cửa ra" },
    hint: { touch: "Tính đường cho trúng đích!", mouse: "Tính đường cho trúng đích!" },
    levels: [
      "2 đường · 2 phép cộng trừ · số đến 20",
      "3 đường · 3 phép · có ×2",
      "3 đường · có ÷ · xuất phát từ số âm",
      "4 đường đan nhau · có x² và đổi dấu",
    ],
    // Câu nhắc theo mức của đặc tả: Khó luôn xuất phát âm (bẫy là dấu khi chia), Siêu khó có ô
    // dùng chung giữa các đường đan nhau.
    levelHints: {
      2: { touch: "Âm chia dương vẫn ra số âm", mouse: "Âm chia dương vẫn ra số âm" },
      3: {
        touch: "Bám đúng nét đường; ô chung, phép chung",
        mouse: "Bám đúng nét đường; ô chung, phép chung",
      },
    },
  },
  en: {
    title: "Number Path",
    howTo: "Tap the exit of the path that makes the target.",
    summary: "Pick the path that hits the target",
    steps: [
      "Read the start and target numbers",
      "Work down each path, cell by cell",
      "Tap the exit of the right path",
    ],
    controls: { touch: "Tap an exit", mouse: "Click an exit" },
    hint: { touch: "Work the paths, hit the target!", mouse: "Work the paths, hit the target!" },
    levels: [
      "2 paths · 2 steps of + and − · up to 20",
      "3 paths · 3 steps · with ×2",
      "3 paths · with ÷ · negative start",
      "4 crossing paths · with x² and sign flips",
    ],
    levelHints: {
      2: {
        touch: "Negative ÷ positive stays negative",
        mouse: "Negative ÷ positive stays negative",
      },
      3: {
        touch: "Follow your line; shared cell, shared step",
        mouse: "Follow your line; shared cell, shared step",
      },
    },
  },
};
