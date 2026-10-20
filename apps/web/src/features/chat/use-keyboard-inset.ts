import { useEffect, useState } from "react";

/** Phần màn bị bàn phím ảo che dưới ngưỡng này (px) thì coi như không có bàn phím. */
const KEYBOARD_MIN_PX = 80;

export interface KeyboardInset {
  /** Khoảng từ đáy màn lên mép trên bàn phím (px). */
  bottom: number;
  /** Chiều cao phần còn nhìn thấy (px). */
  height: number;
}

/**
 * Bàn phím ảo đang mở thì sheet chat bám trên bàn phím (ui-ux 6.5): đọc `visualViewport`.
 * Trình duyệt không có `visualViewport` hoặc không mở bàn phím → `null`.
 */
export function useKeyboardInset(active: boolean): KeyboardInset | null {
  const [inset, setInset] = useState<KeyboardInset | null>(null);

  useEffect(() => {
    const vv = typeof window === "undefined" ? undefined : window.visualViewport;
    if (!active || !vv) {
      setInset(null);
      return;
    }
    const update = () => {
      const bottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset(bottom >= KEYBOARD_MIN_PX ? { bottom, height: vv.height } : null);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);

  return inset;
}
