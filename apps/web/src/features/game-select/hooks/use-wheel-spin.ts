import { useEffect, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { serverNow } from "@/stores/game.store";

export type WheelStatus = "idle" | "spinning" | "landed";

/** Chậm dần về cuối như vòng quay thật. */
const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;

/**
 * Tiến độ quay (0 → 1) theo giờ server: mọi máy cùng bắt đầu ở `spinAt`, cùng dừng sau `spinMs`.
 * Nối lại khi đã quay xong thì ra thẳng kết quả. Bật "giảm chuyển động": không quay, tới giờ thì nhảy tới kết quả.
 */
export function useWheelSpin(spinAt: number, spinMs: number) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    if (!spinAt) return;
    const endAt = spinAt + spinMs;
    if (reduced) {
      const id = setTimeout(() => setNow(serverNow()), Math.max(0, endAt - serverNow()));
      setNow(serverNow());
      return () => clearTimeout(id);
    }
    let raf = 0;
    const tick = () => {
      const n = serverNow();
      setNow(n);
      if (n < endAt) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spinAt, spinMs, reduced]);

  if (!spinAt) return { progress: 0, status: "idle" as WheelStatus };
  const p = Math.min(1, Math.max(0, (now - spinAt) / Math.max(1, spinMs)));
  const status: WheelStatus = p >= 1 ? "landed" : "spinning";
  return { progress: reduced ? (p >= 1 ? 1 : 0) : easeOutCubic(p), status };
}
