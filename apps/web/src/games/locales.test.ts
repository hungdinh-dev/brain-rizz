import { DIFFICULTIES, GAME_IDS } from "@brain-rizz/shared";
import { describe, expect, it } from "vitest";
import { countdownHint, levelHint } from "@/hooks/use-game-text";
import { LANGUAGES } from "@/i18n/languages";
import { en } from "@/i18n/locales/en";
import { vi } from "@/i18n/locales/vi";
import { GAME_CLIENTS } from "./registry";

const CATALOG_TEXT = { vi: vi.catalog, en: en.catalog };

describe("chữ của các minigame", () => {
  it("câu nhắc theo mức: mọi ngôn ngữ khai báo cùng các mức, đủ bản chạm và bản chuột", () => {
    for (const id of GAME_IDS) {
      const [base, ...others] = LANGUAGES.map((lang) => GAME_CLIENTS[id].locales[lang]);
      const levels = Object.keys(base?.levelHints ?? {});
      for (const level of levels) expect(DIFFICULTIES.map(String)).toContain(level);
      for (const locale of others) expect(Object.keys(locale.levelHints ?? {})).toEqual(levels);
      for (const lang of LANGUAGES) {
        for (const text of Object.values(GAME_CLIENTS[id].locales[lang].levelHints ?? {})) {
          expect(text.touch.trim()).not.toBe("");
          expect(text.mouse.trim()).not.toBe("");
        }
      }
    }
  });

  it("đếm ngược dùng câu riêng của mức nếu có, không thì câu chung", () => {
    const game = GAME_CLIENTS["light-trail"].locales.vi;
    expect(countdownHint(game, 3, true)).toBe("Nhớ đèn, chạm ngược lại!");
    expect(countdownHint(game, 0, true)).toBe(game.hint.touch);
    expect(countdownHint(game, undefined, false)).toBe(game.hint.mouse);
    expect(levelHint(game, 0, true)).toBeUndefined();
    expect(levelHint(GAME_CLIENTS["odd-one-out"].locales.vi, 3, false)).toBeUndefined();
  });

  it("tên và mô tả trong danh mục i18n khớp tên và summary của game đã làm", () => {
    for (const id of GAME_IDS) {
      for (const lang of LANGUAGES) {
        const game = GAME_CLIENTS[id].locales[lang];
        expect(CATALOG_TEXT[lang][id]).toEqual({ name: game.title, desc: game.summary });
      }
    }
  });
});
