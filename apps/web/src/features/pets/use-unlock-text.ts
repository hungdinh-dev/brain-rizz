import { type GameId, PET_CHARACTER_IDS, UNLOCK_RULES } from "@brain-rizz/shared";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameLocale } from "@/games/types";
import { useNumberFormat } from "@/hooks/use-number-format";
import { isLanguage, LANGUAGES, type Language } from "@/i18n/languages";
import type { UnlockTextDeps } from "./unlock-text";

/**
 * Tên minigame trong điều kiện mở khoá ("Kỷ lục Luyện tập Bóng bay số…"). Registry game kéo theo
 * hình minh hoạ của mọi game nên không đưa vào gói đầu: chỉ tải lười `locales.ts` của đúng game có
 * trong luật (vài trăm byte mỗi game).
 */
const LOCALE_LOADERS = import.meta.glob<{ locales: Record<Language, GameLocale> }>(
  "../../games/*/locales.ts",
);

const titles = new Map<GameId, Record<Language, GameLocale>>();
const loading = new Map<GameId, Promise<void>>();

/** Game có trong luật mở khoá (hiện tại chỉ luật "kỷ lục một game"). */
const RULE_GAMES: GameId[] = [
  ...new Set(
    PET_CHARACTER_IDS.flatMap((pet) => {
      const rule = UNLOCK_RULES[pet];
      const leaves = rule.kind === "all" ? rule.rules : [rule];
      return leaves.flatMap((r) => (r.kind === "practice-best" ? [r.game] : []));
    }),
  ),
];

function loadTitle(id: GameId): Promise<void> {
  const existing = loading.get(id);
  if (existing) return existing;
  const loader = LOCALE_LOADERS[`../../games/${id}/locales.ts`];
  const task = (loader ? loader() : Promise.reject(new Error(`no locales for ${id}`)))
    .then((m) => {
      titles.set(id, m.locales);
    })
    .catch((err) => {
      // Lỗi tải chunk (rớt mạng): lần sau thử lại.
      loading.delete(id);
      console.warn("[pets] Không tải được tên game:", err);
    });
  loading.set(id, task);
  return task;
}

/** `t`, định dạng số, nối danh sách và tên game theo ngôn ngữ đang chọn cho `unlock-text`. */
export function useUnlockText(): UnlockTextDeps {
  const { t, i18n } = useTranslation();
  const fmt = useNumberFormat();
  const resolved = i18n.resolvedLanguage;
  const lang: Language = isLanguage(resolved) ? resolved : LANGUAGES[0];
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    const missing = RULE_GAMES.filter((id) => !titles.has(id));
    if (missing.length === 0) return;
    void Promise.all(missing.map(loadTitle)).then(() => {
      if (live) setVersion((v) => v + 1);
    });
    return () => {
      live = false;
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` tăng khi tên game tải xong (bảng `titles` ở ngoài React)
  return useMemo((): UnlockTextDeps => {
    const listFormat = new Intl.ListFormat(lang, { type: "conjunction" });
    return {
      t,
      fmt,
      list: (items: string[]) => listFormat.format(items),
      // Đang tải tên game (một nhịp) thì để dấu "…".
      gameTitle: (id: GameId) => titles.get(id)?.[lang].title ?? "…",
    };
  }, [t, fmt, lang, version]);
}
