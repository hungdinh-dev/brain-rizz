import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/number-balloons.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Bóng bay số",
    howTo: "Nổ bóng theo thứ tự số từ nhỏ đến lớn.",
    summary: "Nổ bóng theo số tăng dần",
    steps: [
      "Tìm bóng có số nhỏ nhất",
      "Nổ bóng lần lượt từ nhỏ đến lớn",
      "Nhầm một quả là mất câu đó",
    ],
    controls: { touch: "Chạm vào bóng", mouse: "Click chuột vào bóng" },
    hint: { touch: "Nổ bóng từ nhỏ đến lớn!", mouse: "Nổ bóng từ nhỏ đến lớn!" },
    levels: [
      "3 bóng · số đến 20",
      "5 bóng · số hai chữ số",
      "5 bóng · có số âm",
      "5 bóng · có phép tính",
    ],
    // Mẹo theo mức của đặc tả: Mầm và Thường không có.
    levelHints: {
      2: { touch: "Nhớ: −8 nhỏ hơn −3", mouse: "Nhớ: −8 nhỏ hơn −3" },
      3: {
        touch: "Tính kết quả phép tính rồi mới so",
        mouse: "Tính kết quả phép tính rồi mới so",
      },
    },
  },
  en: {
    title: "Number Balloons",
    howTo: "Pop the balloons in order, smallest number first.",
    summary: "Pop balloons in increasing order",
    steps: [
      "Find the balloon with the smallest number",
      "Pop them one by one, smallest to largest",
      "One wrong pop loses that puzzle",
    ],
    controls: { touch: "Tap a balloon", mouse: "Click a balloon" },
    hint: { touch: "Pop from smallest to largest!", mouse: "Pop from smallest to largest!" },
    levels: [
      "3 balloons · up to 20",
      "5 balloons · two-digit numbers",
      "5 balloons · negative numbers",
      "5 balloons · with + − ×",
    ],
    levelHints: {
      2: { touch: "Remember: −8 is less than −3", mouse: "Remember: −8 is less than −3" },
      3: { touch: "Do the maths first, then compare", mouse: "Do the maths first, then compare" },
    },
  },
};
