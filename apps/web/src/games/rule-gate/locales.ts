import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/rule-gate.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Cổng luật",
    howTo:
      "Bạn nào khớp vé trên bảng thì vuốt trái cho vào cổng, không khớp thì vuốt phải mời về nhà.",
    summary: "Khớp vé thì cho vào, sai mời về",
    steps: [
      "Bảng vẽ vé: bạn nào được vào",
      "Khớp vé: vuốt trái cho vào cổng",
      "Không khớp: vuốt phải mời về nhà",
    ],
    controls: {
      touch: "Vuốt trái / phải hoặc chạm hai nút Cổng / Nhà",
      mouse: "Phím ← → (hoặc A D), hoặc click hai nút Cổng / Nhà",
    },
    hint: { touch: "Khớp vé: trái · Không: phải!", mouse: "Khớp vé: trái · Không: phải!" },
    levels: ["Một vé cả vòng", "Vé đổi sau 6 bạn", "Vé ghép, đổi sau 4–6 bạn", "Vé ẩn, đổi ngầm"],
    levelHints: {
      0: { touch: "Có hình trên vé thì cho vào!", mouse: "Có hình trên vé thì cho vào!" },
      1: { touch: "Vé mới hiện lên thì đọc lại!", mouse: "Vé mới hiện lên thì đọc lại!" },
      2: {
        touch: "Vé ghép: xem cả hai, coi dấu cấm!",
        mouse: "Vé ghép: xem cả hai, coi dấu cấm!",
      },
      3: {
        touch: "Vé bị úp: đoán luật qua đúng sai!",
        mouse: "Vé bị úp: đoán luật qua đúng sai!",
      },
    },
  },
  en: {
    title: "Rule Gate",
    howTo:
      "If a buddy fits the ticket on the board, swipe left to let them in; if not, swipe right to send them home.",
    summary: "Let in only buddies who fit the rule",
    steps: [
      "The board shows who gets in",
      "Fits the ticket: swipe left into the gate",
      "Doesn't fit: swipe right to send them home",
    ],
    controls: {
      touch: "Swipe left / right or tap the Gate / Home buttons",
      mouse: "← → keys (or A D), or click the Gate / Home buttons",
    },
    hint: { touch: "Fits: left · Doesn't: right!", mouse: "Fits: left · Doesn't: right!" },
    levels: [
      "One ticket all round",
      "Ticket changes every 6 buddies",
      "Combo tickets, change every 4–6",
      "Hidden ticket, changes silently",
    ],
    levelHints: {
      0: {
        touch: "Got what's on the ticket? Let them in!",
        mouse: "Got what's on the ticket? Let them in!",
      },
      1: { touch: "New ticket? Read it again!", mouse: "New ticket? Read it again!" },
      2: {
        touch: "Combo ticket: check both, watch for bans!",
        mouse: "Combo ticket: check both, watch for bans!",
      },
      3: {
        touch: "Ticket face down: learn the rule from right and wrong!",
        mouse: "Ticket face down: learn the rule from right and wrong!",
      },
    },
  },
};

/**
 * Chữ ngắn vẽ trong scene (nhãn "Vé mới!" khi luật đổi). Scene đọc theo `currentLanguage()` mỗi câu,
 * như `useGameText` đọc `locales` ở phía React (cùng cách Phấn trượt).
 */
export const sceneText: Record<Language, { newTicket: string }> = {
  vi: { newTicket: "Vé mới!" },
  en: { newTicket: "New ticket!" },
};
