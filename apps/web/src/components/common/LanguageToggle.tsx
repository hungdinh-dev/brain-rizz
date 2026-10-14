import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { currentLanguage } from "@/i18n";
import { LANGUAGE_NAMES, LANGUAGES } from "@/i18n/languages";

/**
 * Nút đổi ngôn ngữ: bấm để chuyển sang ngôn ngữ kế tiếp (lựa chọn được nhớ trong localStorage).
 * Khi có từ 3 ngôn ngữ trở lên thì đổi sang DropdownMenu (`@/components/ui/dropdown-menu`).
 */
export function LanguageToggle() {
  const { t, i18n } = useTranslation();
  const lang = currentLanguage();
  const next = LANGUAGES[(LANGUAGES.indexOf(lang) + 1) % LANGUAGES.length] ?? LANGUAGES[0];

  return (
    <Button
      variant="chalk"
      size="icon-chalk"
      data-sfx="toggle"
      aria-label={`${t("settings.language")}: ${LANGUAGE_NAMES[next]}`}
      title={LANGUAGE_NAMES[next]}
      onClick={() => void i18n.changeLanguage(next)}
    >
      <span className="text-base uppercase">{lang}</span>
    </Button>
  );
}
