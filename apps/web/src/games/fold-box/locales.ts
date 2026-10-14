import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/**
 * Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/fold-box.md.
 * `title` và `summary` phải khớp `catalog["fold-box"]` trong src/i18n/locales (test locales.test.ts).
 */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Gấp hộp",
    howTo:
      "Chạm vào lưới trải phẳng gấp được đúng khối hộp ở trên: ký hiệu phải nằm đúng mặt, đúng hướng.",
    summary: "Hình trải phẳng nào gấp thành khối",
    steps: [
      "Nhìn khối hộp ở trên cùng",
      "Chạm lưới gấp được đúng hộp",
      "Ký hiệu phải đúng mặt, đúng hướng",
    ],
    controls: { touch: "Chạm vào lưới", mouse: "Click chuột vào lưới" },
    hint: { touch: "Gấp trong đầu rồi chạm!", mouse: "Gấp trong đầu rồi click!" },
    levels: [
      "Khối trơn · 3 hình",
      "3 ký hiệu · mặt đối diện",
      "Tam giác, sọc · bản soi gương",
      "Sáu mặt đều có ký hiệu",
    ],
    levelHints: {
      0: { touch: "Chọn hình gấp được thành hộp", mouse: "Chọn hình gấp được thành hộp" },
      2: { touch: "Coi chừng hình soi gương!", mouse: "Coi chừng hình soi gương!" },
      3: { touch: "Sáu mặt đều có ký hiệu!", mouse: "Sáu mặt đều có ký hiệu!" },
    },
  },
  en: {
    title: "Fold the Box",
    howTo:
      "Tap the flat net that folds into exactly the box at the top: every symbol on the right face, facing the right way.",
    summary: "Which net folds into the cube",
    steps: [
      "Look at the box at the top",
      "Tap the net that folds into it",
      "Symbols must match face and direction",
    ],
    controls: { touch: "Tap the net", mouse: "Click the net" },
    hint: { touch: "Fold it in your head, then tap!", mouse: "Fold it in your head, then click!" },
    levels: [
      "Plain box · 3 shapes",
      "3 symbols · opposite faces",
      "Triangle, bar · mirror traps",
      "All six faces marked",
    ],
    levelHints: {
      0: {
        touch: "Pick the shape that folds into a box",
        mouse: "Pick the shape that folds into a box",
      },
      2: { touch: "Watch out for mirror images!", mouse: "Watch out for mirror images!" },
      3: { touch: "All six faces have symbols!", mouse: "All six faces have symbols!" },
    },
  },
};
