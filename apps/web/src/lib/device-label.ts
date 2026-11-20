/**
 * Nhãn thiết bị "trình duyệt · hệ điều hành" ghi kèm sự kiện đăng nhập (CR-019, RPC `log_login`).
 * Chỉ suy từ user agent, không ghi IP hay phiên bản (có trẻ em chơi, giữ dữ liệu tối thiểu).
 * Tên riêng (Chrome, Android…) không dịch nên lưu thẳng vào DB. Không nhận ra gì → "".
 */

/** Giới hạn cột `login_events.device`. */
export const DEVICE_LABEL_MAX = 120;

/** Thứ tự quan trọng: trình duyệt dựa trên Chromium cũng ghi "Chrome/", Chrome cũng ghi "Safari/". */
const BROWSERS: readonly [RegExp, string][] = [
  [/Zalo/i, "Zalo"],
  [/FBAN|FBAV|FB_IAB/, "Facebook"],
  [/Instagram/, "Instagram"],
  [/SamsungBrowser/, "Samsung Internet"],
  [/coc_coc_browser|CocCoc/i, "Cốc Cốc"],
  [/EdgA?\/|EdgiOS\/|Edge\//, "Edge"],
  [/OPR\/|OPiOS\/|Opera/, "Opera"],
  [/YaBrowser\//, "Yandex"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/CriOS\/|Chrome\/|Chromium\//, "Chrome"],
  [/Version\/[\d.]+.*Safari\/|Mobile\/\w+ Safari/, "Safari"],
];

const SYSTEMS: readonly [RegExp, string][] = [
  [/Windows NT|Windows Phone/, "Windows"],
  [/iPad/, "iPadOS"],
  [/iPhone|iPod/, "iOS"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Macintosh|Mac OS X/, "macOS"],
  [/Linux|X11/, "Linux"],
];

const first = (ua: string, table: readonly [RegExp, string][]) =>
  table.find(([pattern]) => pattern.test(ua))?.[1];

/**
 * "Chrome · Android", "Safari · iOS"… `touchPoints` (`navigator.maxTouchPoints`) giúp nhận ra iPad
 * đời mới, vốn khai là Macintosh.
 */
export function deviceLabel(userAgent: string, touchPoints = 0): string {
  const ua = userAgent.slice(0, 1_000);
  const browser = first(ua, BROWSERS);
  let system = first(ua, SYSTEMS);
  if (system === "macOS" && touchPoints > 1) system = "iPadOS";
  return [browser, system]
    .filter((part): part is string => !!part)
    .join(" · ")
    .slice(0, DEVICE_LABEL_MAX);
}

/** Nhãn của máy đang dùng; ngoài trình duyệt (test) → "". */
export function currentDeviceLabel(): string {
  if (typeof navigator === "undefined") return "";
  return deviceLabel(navigator.userAgent ?? "", navigator.maxTouchPoints ?? 0);
}
