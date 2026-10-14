import { MoonIcon, SunIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/stores/theme.store";

/**
 * Nút đổi sáng ↔ tối. Lần đầu vào app theo chế độ của hệ điều hành ("system");
 * bấm một lần là chọn hẳn sáng/tối và được nhớ lại.
 * Cố ý dùng nút thay cho DropdownMenu: menu kéo theo ~23 KB gzip vào bundle đầu.
 */
export function ThemeToggle() {
  const { t } = useTranslation();
  const resolved = useTheme((s) => s.resolved);
  const setPreference = useTheme((s) => s.setPreference);
  const next = resolved === "dark" ? "light" : "dark";

  return (
    <Button
      variant="chalk"
      size="icon-chalk"
      data-sfx="toggle"
      aria-label={`${t("settings.theme")}: ${t(`settings.${next}`)}`}
      title={t(`settings.${next}`)}
      onClick={() => setPreference(next)}
    >
      {resolved === "dark" ? <MoonIcon /> : <SunIcon />}
    </Button>
  );
}
