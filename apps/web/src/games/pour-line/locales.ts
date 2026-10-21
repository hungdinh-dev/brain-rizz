import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/pour-line.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Rót vừa vạch",
    howTo: "Giữ để rót nước vào bình, buông tay khi mặt nước chạm vạch.",
    summary: "Giữ để rót, buông đúng vạch",
    steps: [
      "Giữ để rót nước vào bình",
      "Buông tay khi nước chạm vạch",
      "Nước nằm trong dải vạch là đúng",
    ],
    controls: {
      touch: "Chạm giữ ở bất kỳ đâu để rót, nhấc ngón tay để dừng",
      mouse: "Giữ chuột trái hoặc giữ phím Space để rót, nhả ra để dừng",
    },
    hint: { touch: "Giữ để rót, buông đúng vạch!", mouse: "Giữ để rót, buông đúng vạch!" },
    levels: [
      "Ống thẳng · rót chậm · dải rộng",
      "Ống thẳng · rót vừa",
      "Bình loe hoặc thót",
      "Bình lạ · che nửa trên",
    ],
    levelHints: {
      2: { touch: "Bình loe, nước dâng không đều!", mouse: "Bình loe, nước dâng không đều!" },
      3: { touch: "Nửa trên bị che, ước lượng nhé!", mouse: "Nửa trên bị che, ước lượng nhé!" },
    },
  },
  en: {
    title: "Pour to the Line",
    howTo: "Hold to pour water into the flask, and let go when the water reaches the line.",
    summary: "Hold to pour, release on the line",
    steps: [
      "Hold to pour water into the flask",
      "Let go when the water hits the line",
      "Stop inside the band to get it right",
    ],
    controls: {
      touch: "Touch and hold anywhere to pour, lift your finger to stop",
      mouse: "Hold the left mouse button or Space to pour, release to stop",
    },
    hint: {
      touch: "Hold to pour, release on the line!",
      mouse: "Hold to pour, release on the line!",
    },
    levels: [
      "Straight tube · slow pour · wide band",
      "Straight tube · medium pour",
      "Flared or tapered flask",
      "Odd flask · top half hidden",
    ],
    levelHints: {
      2: {
        touch: "Flared flask, the water rises unevenly!",
        mouse: "Flared flask, the water rises unevenly!",
      },
      3: {
        touch: "The top half is covered, estimate it!",
        mouse: "The top half is covered, estimate it!",
      },
    },
  },
};

/** Chữ ngắn vẽ trong scene (đơn vị của số giây lệch lúc hiện đáp án). Đọc theo `currentLanguage()`. */
export const sceneText: Record<Language, { seconds: string }> = {
  vi: { seconds: "s" },
  en: { seconds: "s" },
};
