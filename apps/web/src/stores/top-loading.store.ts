import { useEffect } from "react";
import { create } from "zustand";

/**
 * Thanh tải mảnh trên đầu trang (kiểu YouTube) — components/common/TopLoadingBar.tsx vẽ, store này
 * đếm số việc đang tải. Nơi nào tải nội dung (chunk màn lười, Supabase…) gọi `startLoading()` /
 * `trackLoading()` / `useLoadingWhile()`; thanh hiện khi còn ít nhất một việc, ẩn khi hết.
 * Tải xong trong dưới `TOP_LOADING_DELAY_MS` thì không hiện (tránh nháy).
 * Chỉ dùng cho tải nội dung người dùng đang chờ, không cho việc chạy nền (đồng bộ, tự làm mới).
 */

/** Tải ngắn hơn ngưỡng này thì thanh không hiện. */
export const TOP_LOADING_DELAY_MS = 150;
/** Tiến trình giả không vượt quá mức này cho tới khi xong thật. */
export const TRICKLE_MAX = 0.94;
/** Mức khởi đầu khi thanh vừa hiện. */
export const TRICKLE_START = 0.08;

/** Bước tiến giả: nhanh lúc đầu, chậm dần khi gần `TRICKLE_MAX`, không bao giờ tới 100%. */
export function trickle(progress: number): number {
  if (progress >= TRICKLE_MAX) return progress;
  return Math.min(TRICKLE_MAX, progress + Math.max(0.004, (TRICKLE_MAX - progress) * 0.12));
}

interface TopLoadingStore {
  /** Số việc đang tải. */
  pending: number;
  /**
   * Thanh đang hiện: bật khi còn việc sau ngưỡng trễ; giữ nguyên lúc chạy nốt tới 100% rồi mờ,
   * tới khi thanh gọi `settle()`.
   */
  visible: boolean;
  /** Thanh mờ xong → ẩn hẳn. Có việc mới chen vào thì giữ hiện. */
  settle(): void;
}

export const useTopLoading = create<TopLoadingStore>((set, get) => ({
  pending: 0,
  visible: false,
  settle() {
    if (get().pending === 0) set({ visible: false });
  },
}));

let showTimer: ReturnType<typeof setTimeout> | undefined;

function clearShowTimer() {
  if (showTimer === undefined) return;
  clearTimeout(showTimer);
  showTimer = undefined;
}

/**
 * Bắt đầu một việc tải. Trả về hàm `done()` — gọi nhiều lần cũng chỉ tính một (an toàn với
 * StrictMode và nhánh lỗi).
 */
export function startLoading(): () => void {
  const { pending, visible } = useTopLoading.getState();
  useTopLoading.setState({ pending: pending + 1 });
  if (pending === 0 && !visible && showTimer === undefined) {
    showTimer = setTimeout(() => {
      showTimer = undefined;
      if (useTopLoading.getState().pending > 0) useTopLoading.setState({ visible: true });
    }, TOP_LOADING_DELAY_MS);
  }
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    const next = Math.max(0, useTopLoading.getState().pending - 1);
    useTopLoading.setState({ pending: next });
    if (next === 0) clearShowTimer();
  };
}

/** Hiện thanh trong lúc `task` chạy; trả lại đúng `task` (kết quả / lỗi giữ nguyên). */
export function trackLoading<T>(task: Promise<T>): Promise<T> {
  const done = startLoading();
  return task.finally(done);
}

/** Hook React: hiện thanh khi `active` (vd. `status === "loading"`), tự tắt khi đổi hoặc gỡ màn. */
export function useLoadingWhile(active: boolean) {
  useEffect(() => {
    if (!active) return;
    return startLoading();
  }, [active]);
}
