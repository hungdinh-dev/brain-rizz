/**
 * Địa chỉ game server, dùng chung cho kết nối Colyseus (`connection.ts`) và HTTP của trang quản trị
 * (`admin-api.ts`). `VITE_SERVER_URL` để trống khi dev → cùng máy với trang web, cổng 2567 (điện thoại
 * cùng Wi-Fi vào được bằng IP máy tính).
 */

/** Cổng mặc định của game server khi chạy dev. */
export const DEFAULT_SERVER_PORT = 2567;

interface LocationLike {
  protocol: string;
  hostname: string;
}

/** Địa chỉ server từ biến môi trường, không có thì suy từ trang đang mở (hàm thuần, có test). */
export function resolveServerUrl(
  envUrl: string | undefined,
  loc: LocationLike | undefined,
): string {
  const fromEnv = envUrl?.trim();
  if (fromEnv) return fromEnv;
  if (!loc) return `http://localhost:${DEFAULT_SERVER_PORT}`;
  return `${loc.protocol}//${loc.hostname}:${DEFAULT_SERVER_PORT}`;
}

/**
 * Gốc HTTP của server cho `fetch`: `ws://` → `http://`, `wss://` → `https://` (SDK Colyseus nhận cả
 * hai kiểu), bỏ dấu `/` cuối.
 */
export function toHttpBase(url: string): string {
  return url.replace(/^ws(s?):\/\//i, "http$1://").replace(/\/+$/, "");
}

export const SERVER_URL = resolveServerUrl(
  import.meta.env.VITE_SERVER_URL,
  typeof location === "undefined" ? undefined : location,
);

/** Gốc HTTP của game server (endpoint `/admin/*`). */
export const SERVER_HTTP_URL = toHttpBase(SERVER_URL);
