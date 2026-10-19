import { useMemo } from "react";
import { useTranslation } from "react-i18next";

/**
 * Định dạng ngày theo ngôn ngữ đang chọn: `short` = "16/10" (vi) / "10/16" (en),
 * `long` = "Thứ Năm 16/10" / "Thursday 10/16". Thứ tự ngày/tháng theo ngôn ngữ, luôn ngăn bằng "/"
 * (vài bản ICU cho tiếng Việt ra "16-10"). Chuỗi ngày hỏng → "".
 */
export function useDateFormat() {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language;
  return useMemo(() => {
    const dayMonth = new Intl.DateTimeFormat(lang, { day: "2-digit", month: "2-digit" });
    const weekday = new Intl.DateTimeFormat(lang, { weekday: "long" });
    const toDate = (value: string | number | Date) => {
      const d = value instanceof Date ? value : new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const short = (value: string | number | Date) => {
      const d = toDate(value);
      if (!d) return "";
      return dayMonth
        .formatToParts(d)
        .filter((p) => p.type === "day" || p.type === "month")
        .map((p) => p.value)
        .join("/");
    };
    const long = (value: string | number | Date) => {
      const d = toDate(value);
      if (!d) return "";
      const day = weekday.format(d);
      return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${short(d)}`;
    };
    return { short, long };
  }, [lang]);
}
