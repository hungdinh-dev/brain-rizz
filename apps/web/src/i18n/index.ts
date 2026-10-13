import type { GameId } from "@brain-rizz/shared";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { GAME_CLIENTS } from "@/games/registry";
import type { GameLocale } from "@/games/types";
import { STORAGE_KEYS, safeLocal } from "@/lib/storage";
import { isLanguage, LANGUAGES, type Language } from "./languages";
import { en } from "./locales/en";
import { vi } from "./locales/vi";

/**
 * i18n: bản dịch viết thẳng trong code (src/i18n/locales/*.ts), đóng gói cùng bundle —
 * không tải file JSON qua mạng. Hai namespace:
 *  - `common`: chữ giao diện chung (mặc định, gọi `t("lobby.start")`).
 *  - `games`: tên + cách chơi từng minigame, gom từ `src/games/<id>/locales.ts`
 *    (gọi `t("games:odd-one-out.title")` hoặc dùng hook `useGameText`).
 */

const COMMON: Record<Language, typeof vi> = { vi, en };

function gamesBundle(lang: Language) {
  return Object.fromEntries(
    Object.entries(GAME_CLIENTS).map(([id, client]) => [id, client.locales[lang]]),
  ) as Record<GameId, GameLocale>;
}

/** Ngôn ngữ lần đầu: đã chọn trước đó → ngôn ngữ trình duyệt → tiếng Việt. */
function detectLanguage(): Language {
  const saved = safeLocal.get(STORAGE_KEYS.language);
  if (isLanguage(saved)) return saved;
  const browser = navigator.language.slice(0, 2);
  return isLanguage(browser) ? browser : LANGUAGES[0];
}

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(
    LANGUAGES.map((lang) => [lang, { common: COMMON[lang], games: gamesBundle(lang) }]),
  ),
  lng: detectLanguage(),
  fallbackLng: LANGUAGES[0],
  supportedLngs: LANGUAGES,
  defaultNS: "common",
  ns: ["common", "games"],
  // React đã tự escape khi render.
  interpolation: { escapeValue: false },
  // Tài nguyên có sẵn trong bundle nên khởi tạo đồng bộ, không cần Suspense.
  initAsync: false,
});

function syncDocumentLang(lang: string) {
  document.documentElement.lang = lang;
}
syncDocumentLang(i18n.language);
i18n.on("languageChanged", (lang) => {
  syncDocumentLang(lang);
  safeLocal.set(STORAGE_KEYS.language, lang);
});

export function currentLanguage(): Language {
  return isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : LANGUAGES[0];
}

export { i18n };
