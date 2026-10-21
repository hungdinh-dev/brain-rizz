import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/head-count.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Đếm sĩ số",
    howTo:
      "Nhớ số bạn trong lớp, bạn vào thì cộng, bạn ra thì trừ, cửa đóng thì chạm số bạn còn lại.",
    summary: "Bạn vào, bạn ra: còn mấy bạn?",
    steps: ["Nhớ số bạn trong lớp", "Bạn vào thì cộng, ra thì trừ", "Chạm số bạn còn lại"],
    controls: { touch: "Chạm thẻ số", mouse: "Click chuột vào thẻ" },
    hint: { touch: "Vào thì cộng, ra thì trừ!", mouse: "Vào thì cộng, ra thì trừ!" },
    levels: [
      "3–4 lượt · từng bạn",
      "5 lượt · có cặp",
      "6 lượt · vừa vào vừa ra",
      "7 lượt · có thầy giáo",
    ],
    levelHints: {
      2: { touch: "Có lượt vừa vào vừa ra!", mouse: "Có lượt vừa vào vừa ra!" },
      3: {
        touch: "Thầy giáo không tính vào sĩ số!",
        mouse: "Thầy giáo không tính vào sĩ số!",
      },
    },
  },
  en: {
    title: "Head Count",
    howTo:
      "Remember how many kids are in class, add the ones who walk in, subtract the ones who walk out, then tap how many are left.",
    summary: "Kids in, kids out: how many left?",
    steps: [
      "Remember the kids in class",
      "Kids in: add. Kids out: subtract",
      "Tap how many are left",
    ],
    controls: { touch: "Tap a number card", mouse: "Click a number card" },
    hint: { touch: "In: add. Out: subtract!", mouse: "In: add. Out: subtract!" },
    levels: [
      "3–4 turns · one at a time",
      "5 turns · some pairs",
      "6 turns · in and out at once",
      "7 turns · the teacher too",
    ],
    levelHints: {
      2: {
        touch: "Some kids go in and out at once!",
        mouse: "Some kids go in and out at once!",
      },
      3: { touch: "The teacher doesn't count!", mouse: "The teacher doesn't count!" },
    },
  },
};
