import { AVATAR_COLORS } from "@brain-rizz/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

/** Trang quản trị tính ngày theo giờ Việt Nam (khớp RPC `admin_*`), dù máy đang ở múi giờ nào. */
export const ADMIN_TIME_ZONE = "Asia/Ho_Chi_Minh";

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: ADMIN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Ngày `YYYY-MM-DD` theo giờ Việt Nam. */
export function vnDayKey(date: Date): string {
  const parts = Object.fromEntries(dayKeyFormat.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Số ngày từ `from` tới `to` (khoá `YYYY-MM-DD`). */
export function dayDiff(from: string, to: string): number {
  const utc = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** Màu avatar ổn định theo id tài khoản (RPC chỉ trả nhân vật, không trả màu). */
export function colorIndexFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % AVATAR_COLORS.length;
}

const toDate = (value: string | number) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Định dạng số, giờ, ngày cho trang quản trị theo ngôn ngữ đang chọn (giờ Việt Nam). */
export function useAdminFormat() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language;
  return useMemo(() => {
    const zone = { timeZone: ADMIN_TIME_ZONE } as const;
    const integer = new Intl.NumberFormat(lang);
    const time = new Intl.DateTimeFormat(lang, {
      ...zone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const clock = new Intl.DateTimeFormat(lang, {
      ...zone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const dayMonth = new Intl.DateTimeFormat(lang, { ...zone, day: "2-digit", month: "2-digit" });
    const dayMonthYear = new Intl.DateTimeFormat(lang, {
      ...zone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    // Khoá ngày `YYYY-MM-DD` của RPC → "6/11" (vi) / "11/6" (en): đọc như ngày UTC để khỏi lệch.
    const shortDay = new Intl.DateTimeFormat(lang, {
      timeZone: "UTC",
      day: "numeric",
      month: "numeric",
    });
    const relative = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
    // Ngày/tháng luôn ngăn bằng "/" (vài bản ICU cho tiếng Việt ra "16-10").
    const slash = (f: Intl.DateTimeFormat, d: Date) =>
      f
        .formatToParts(d)
        .filter((p) => p.type === "day" || p.type === "month" || p.type === "year")
        .map((p) => p.value)
        .join("/");

    const num = (n: number) => integer.format(n);
    const dec = (n: number, digits = 2) =>
      new Intl.NumberFormat(lang, { maximumFractionDigits: digits }).format(n);

    /** "Hôm nay 10:42", "Hôm qua 20:55", "17/11 18:02" (khác năm thì có năm). */
    const when = (value: string | null | undefined, now = Date.now()) => {
      const d = value ? toDate(value) : null;
      if (!d) return t("admin.none");
      const at = time.format(d);
      const diff = dayDiff(vnDayKey(d), vnDayKey(new Date(now)));
      if (diff === 0) return t("admin.time.today", { time: at });
      if (diff === 1) return t("admin.time.yesterday", { time: at });
      const sameYear = vnDayKey(d).slice(0, 4) === vnDayKey(new Date(now)).slice(0, 4);
      return t("admin.time.other", {
        date: slash(sameYear ? dayMonth : dayMonthYear, d),
        time: at,
      });
    };

    /** "28/09/2026". */
    const date = (value: string | null | undefined) => {
      const d = value ? toDate(value) : null;
      return d ? slash(dayMonthYear, d) : t("admin.none");
    };

    const day = (key: string) => {
      const [y, m, dd] = key.split("-").map(Number);
      return shortDay.format(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, dd ?? 1)));
    };

    /** "12 phút trước". */
    const ago = (value: string, now = Date.now()) => {
      const d = toDate(value);
      if (!d) return t("admin.none");
      const sec = Math.round((d.getTime() - now) / 1000);
      const abs = Math.abs(sec);
      if (abs < 60) return relative.format(sec, "second");
      if (abs < 3_600) return relative.format(Math.round(sec / 60), "minute");
      if (abs < 86_400) return relative.format(Math.round(sec / 3_600), "hour");
      return relative.format(Math.round(sec / 86_400), "day");
    };

    /** "3 ngày 4 giờ" từ số giây. */
    const duration = (seconds: number) => {
      const s = Math.max(0, Math.floor(seconds));
      const d = Math.floor(s / 86_400);
      const h = Math.floor((s % 86_400) / 3_600);
      const m = Math.floor((s % 3_600) / 60);
      if (d > 0) return t("admin.duration.days", { d, h });
      if (h > 0) return t("admin.duration.hours", { h, m });
      return t("admin.duration.minutes", { m });
    };

    return {
      num,
      dec,
      when,
      date,
      day,
      ago,
      duration,
      clock: (ms: number) => clock.format(new Date(ms)),
      time: (ms: number) => time.format(new Date(ms)),
    };
  }, [lang, t]);
}
