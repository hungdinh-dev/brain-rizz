import { POUR_LINE_MAX_HOLD_MS } from "@brain-rizz/shared";

/*
 * Đo thời gian giữ tay của Rót vừa vạch (đáp án đo ở client, chấm ở server). Lúc nhấn và lúc buông
 * lấy từ `timeStamp` của chính hai sự kiện (cùng một đồng hồ, nên độ trễ cảm ứng cố định của máy bị
 * trừ ở cả hai đầu), không lấy từ vòng lặp khung hình. Đặc tả: docs/04-minigames/pour-line.md,
 * mục "Cách chấm" và "Ghi chú cho FE".
 */

/**
 * `timeStamp` của sự kiện lệch `performance.now()` quá ngần này thì coi là khác gốc đồng hồ (trình
 * duyệt cũ dùng giờ epoch): khi đó đo cả hai đầu bằng `performance.now()`.
 */
const SAME_CLOCK_SKEW_MS = 10_000;

/** `stamp` (timeStamp của sự kiện) cùng gốc với `now` (`performance.now()`) không. */
export function sameClock(stamp: number, now: number): boolean {
  return Number.isFinite(stamp) && stamp > 0 && Math.abs(now - stamp) <= SAME_CLOCK_SKEW_MS;
}

/**
 * Số ms giữ tay gửi server: `round(lúc buông − lúc nhấn)`, kẹp trong [0, `fullMs`] (giữ tới
 * `fullMs` là nước tràn: tự buông và gửi đúng `fullMs`, chắc chắn sai) và không quá
 * `POUR_LINE_MAX_HOLD_MS`. Luôn là số nguyên, `isAnswer` của shared nhận được.
 */
export function holdAnswer(downAt: number, upAt: number, fullMs: number): number {
  const ms = Math.round(upAt - downAt);
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.min(ms, Math.max(0, Math.floor(fullMs)), POUR_LINE_MAX_HOLD_MS);
}

/** Dấu trừ thật (U+2212), như "−0,24 s" của đặc tả. */
const MINUS = "−";

/**
 * Số giây lệch so với lúc nước vừa chạm vạch, vd. "−0,24 s" (buông sớm) hay "+0,31 s" (buông muộn),
 * dấu thập phân theo ngôn ngữ. `unit` là chữ đơn vị lấy từ `sceneText` của locales.
 */
export function formatDelta(deltaMs: number, locale: string, unit: string): string {
  const seconds = Math.abs(deltaMs) / 1000;
  const value = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(seconds);
  const sign = deltaMs < 0 ? MINUS : "+";
  return `${sign}${value} ${unit}`;
}
