import { useEffect, useState } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia(REDUCED_MOTION).matches;

/**
 * Số đếm dần từ 0 lên `target` trong `durationMs` (vd. Điểm Não 0,8 giây). Người dùng bật
 * giảm chuyển động → hiện ngay số cuối.
 */
export function useCountUp(target: number, durationMs = 800): number {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0));
  useEffect(() => {
    if (reducedMotion() || durationMs <= 0) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      // Chậm dần cuối (ease-out cubic).
      setValue(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return value;
}
