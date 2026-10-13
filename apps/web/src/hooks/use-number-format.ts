import { useMemo } from "react";
import { useTranslation } from "react-i18next";

/**
 * Định dạng số theo ngôn ngữ đang chọn: tiếng Việt `1.180` và `1,2`, tiếng Anh `1,180` và `1.2`.
 * `fractionDigits` = số chữ số thập phân cố định (bỏ trống = số nguyên như điểm).
 */
export function useNumberFormat(fractionDigits?: number) {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language;
  return useMemo(() => {
    const nf = new Intl.NumberFormat(
      lang,
      fractionDigits === undefined
        ? undefined
        : { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits },
    );
    return (value: number) => nf.format(value);
  }, [lang, fractionDigits]);
}
