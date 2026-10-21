import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/rhythm-echo.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Nhại nhịp",
    howTo:
      "Nghe và nhìn trống gõ một câu nhịp ngắn, rồi gõ lại y hệt: đúng trống trái hay phải, đúng nhịp nhanh chậm.",
    summary: "Nghe trống gõ, gõ lại y hệt",
    steps: [
      "Nghe và nhìn trống gõ nhịp",
      "Gõ lại đúng trống trái, phải",
      "Giữ đúng khoảng cách giữa các tiếng",
    ],
    controls: {
      touch: "Chạm nửa trái / nửa phải vùng trống, một ngón hoặc hai ngón cái",
      mouse: "Click vào trống, hoặc phím ← A F (trống trái) và → D J (trống phải)",
    },
    hint: { touch: "Nghe kỹ, gõ lại y hệt!", mouse: "Nghe kỹ, gõ lại y hệt!" },
    levels: [
      "1 trống · 3 tiếng đều",
      "2 trống · 4 tiếng đều",
      "5–6 tiếng · có nghỉ",
      "6 tiếng · lệch phách",
    ],
    // Mầm đổi luật (một trống, chạm đâu cũng được); Khó có chỗ nghỉ, Siêu khó có tiếng lệch phách.
    levelHints: {
      0: {
        touch: "Một trống, chạm đâu cũng được!",
        mouse: "Một trống, click đâu hay bấm Space cũng được!",
      },
      2: { touch: "Có chỗ nghỉ, đừng gõ vội!", mouse: "Có chỗ nghỉ, đừng gõ vội!" },
      3: { touch: "Có tiếng lệch phách, nghe kỹ!", mouse: "Có tiếng lệch phách, nghe kỹ!" },
    },
  },
  en: {
    title: "Rhythm Echo",
    howTo:
      "Hear and watch the drums play a short rhythm, then tap it back exactly: the right drum, left or right, with the same timing.",
    summary: "Hear the drums, tap them back",
    steps: [
      "Hear and watch the drum rhythm",
      "Tap back the left and right drums",
      "Keep the same gaps between beats",
    ],
    controls: {
      touch: "Tap the left / right half of the drum area, with one finger or two thumbs",
      mouse: "Click the drums, or press ← A F (left drum) and → D J (right drum)",
    },
    hint: {
      touch: "Listen closely, tap it back exactly!",
      mouse: "Listen closely, tap it back exactly!",
    },
    levels: [
      "1 drum · 3 even beats",
      "2 drums · 4 even beats",
      "5–6 beats · with rests",
      "6 beats · off-beat",
    ],
    levelHints: {
      0: {
        touch: "One drum, tap anywhere!",
        mouse: "One drum, click anywhere or press Space!",
      },
      2: { touch: "There are rests, don't rush!", mouse: "There are rests, don't rush!" },
      3: {
        touch: "Some beats are off the beat, listen closely!",
        mouse: "Some beats are off the beat, listen closely!",
      },
    },
  },
};
