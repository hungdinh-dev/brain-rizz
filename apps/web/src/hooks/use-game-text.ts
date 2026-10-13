import type { Difficulty, GameId } from "@brain-rizz/shared";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { GAME_CLIENTS } from "@/games/registry";
import type { DeviceText, GameLocale } from "@/games/types";
import { isLanguage, LANGUAGES } from "@/i18n/languages";

function useLang() {
  const { i18n } = useTranslation();
  return isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : LANGUAGES[0];
}

/**
 * Chữ của một minigame (tên, cách chơi, 3 bước, điều khiển, câu nhắc, mô tả độ khó)
 * theo ngôn ngữ đang chọn — lấy thẳng từ `src/games/<id>/locales.ts`.
 */
export function useGameText(id: GameId): GameLocale {
  return GAME_CLIENTS[id].locales[useLang()];
}

/** Như `useGameText` nhưng trả về hàm tra theo id — dùng khi hiện nhiều game một lúc (vòng quay, lưới thẻ). */
export function useGameTextLookup(): (id: GameId) => GameLocale {
  const lang = useLang();
  return useCallback((id: GameId) => GAME_CLIENTS[id].locales[lang], [lang]);
}

const byDevice = (text: DeviceText, touch: boolean) => (touch ? text.touch : text.mouse);

/**
 * Câu nhắc riêng của mức độ khó (`levelHints`); `undefined` khi game không có câu riêng cho mức đó
 * hoặc chưa biết mức (vd. chưa có mình trong state phòng).
 */
export function levelHint(
  game: GameLocale,
  difficulty: Difficulty | undefined,
  touch: boolean,
): string | undefined {
  const text = difficulty === undefined ? undefined : game.levelHints?.[difficulty];
  return text && byDevice(text, touch);
}

/** Câu nhắc lớn lúc đếm ngược: câu riêng của mức nếu game có, không thì `hint` chung. */
export function countdownHint(
  game: GameLocale,
  difficulty: Difficulty | undefined,
  touch: boolean,
): string {
  return levelHint(game, difficulty, touch) ?? byDevice(game.hint, touch);
}
