import { useSyncExternalStore } from "react";

/** Khớp breakpoint `lg` của Tailwind (≥ 1024px) — bố cục máy tính. */
export const DESKTOP_QUERY = "(min-width: 1024px)";

/** Thiết bị chạm (điện thoại, máy tính bảng): chọn bản "chạm" thay vì bản "chuột" của chữ hướng dẫn. */
export const TOUCH_QUERY = "(pointer: coarse)";

/**
 * Theo dõi một media query. Dùng khi hai bố cục khác hẳn nhau và không muốn giữ cả hai
 * trong DOM (vd. khung chơi: chỉ render đúng một bộ HUD, canvas Phaser không bị dựng lại).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
