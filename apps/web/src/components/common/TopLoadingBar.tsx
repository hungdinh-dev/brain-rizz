import { useEffect, useState } from "react";
import { useReducedMotion } from "@/features/motion";
import { cn } from "@/lib/utils";
import { TRICKLE_START, trickle, useTopLoading } from "@/stores/top-loading.store";

/** Nhịp nhích giả (ms) — trùng thời lượng chuyển động của thanh. */
const TRICKLE_MS = 250;
/** Chạy nốt tới 100% rồi mới mờ (ms). */
const FINISH_MS = 220;
/** Thời gian mờ dần (ms). */
const FADE_MS = 300;
/** Giảm chuyển động: thanh đứng yên ở mức này, không nhích giả. */
const REDUCED_PROGRESS = 0.5;

/**
 * Thanh tải mảnh trên đầu trang (kiểu YouTube), đọc `stores/top-loading.store.ts`. Đặt một lần ở
 * App. Nhích giả nhanh rồi chậm dần, không chạm 100% tới khi xong; xong thì chạy hết rồi mờ đi.
 * Chỉ trang trí (`aria-hidden`): chỗ đang tải tự có `role="status"` / `aria-busy`.
 * Dùng `scaleX` (không đổi bố cục) và chỉ chạy hẹn giờ khi đang hiện.
 */
export function TopLoadingBar() {
  const running = useTopLoading((s) => s.pending > 0);
  const visible = useTopLoading((s) => s.visible);
  const settle = useTopLoading((s) => s.settle);
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);

  // Đang tải: nhích giả. Việc mới chen vào lúc đang chạy nốt / mờ → bắt đầu lại từ đầu.
  useEffect(() => {
    if (!visible || !running) return;
    setFading(false);
    if (reduced) {
      setProgress(REDUCED_PROGRESS);
      return;
    }
    setProgress((p) => (p === 0 || p >= 1 ? TRICKLE_START : p));
    const id = window.setInterval(() => setProgress(trickle), TRICKLE_MS);
    return () => window.clearInterval(id);
  }, [visible, running, reduced]);

  // Xong hết: chạy tới 100%, mờ đi, rồi ẩn hẳn.
  useEffect(() => {
    if (!visible || running) return;
    setProgress(1);
    const fade = window.setTimeout(() => setFading(true), FINISH_MS);
    const hide = window.setTimeout(() => {
      setProgress(0);
      setFading(false);
      settle();
    }, FINISH_MS + FADE_MS);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(hide);
    };
  }, [visible, running, settle]);

  if (!visible) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-100 h-[3px]">
      <div
        className={cn(
          "h-full origin-left rounded-r-full bg-primary shadow-[0_0_8px_var(--color-primary)]",
          "motion-safe:transition-[transform,opacity] motion-safe:duration-300 motion-safe:ease-out",
          fading && "opacity-0",
        )}
        // Giá trị tính lúc chạy (tiến trình), không có class tương ứng.
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
