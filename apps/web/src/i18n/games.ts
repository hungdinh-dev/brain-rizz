import { GAME_CLIENTS } from "@/games/registry";
import { i18n } from "./index";
import { LANGUAGES } from "./languages";

let registered = false;

/**
 * Gộp chữ của mọi minigame (`src/games/<id>/locales.ts`) vào namespace `games`. Gọi từ chunk tải
 * lười của các màn trong phòng và màn một mình, nên gói đầu (menu) không phải chở chữ, hình minh hoạ
 * của 13 game. Hook `useGameText` đọc thẳng registry nên không phụ thuộc bước này.
 */
export function registerGameLocales() {
  if (registered) return;
  registered = true;
  for (const lang of LANGUAGES) {
    const bundle = Object.fromEntries(
      Object.entries(GAME_CLIENTS).map(([id, client]) => [id, client.locales[lang]]),
    );
    i18n.addResourceBundle(lang, "games", bundle, true, true);
  }
}
