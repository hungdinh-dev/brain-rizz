import { useEffect, useState } from "react";
import { useReducedMotion } from "@/features/motion";

/**
 * Số đếm dần từ 0 lên `target` trong `durationMs` (vd. Điểm Não 0,8 giây). Đang giảm chuyển động
 * (`useReducedMotion`, theo nút Hiệu ứng) → hiện ngay số cuối.
 */
export function useCountUp(target: number, durationMs = 800): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(() => (reduced ? target : 0));
  useEffect(() => {
    if (reduced || durationMs <= 0) {
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
  }, [target, durationMs, reduced]);
  return value;
}
