/**
 * MỘT AudioContext dùng chung cho cả app (nhạc nền + âm thanh hiệu ứng).
 *
 * Trình duyệt (nhất là iOS) chỉ cho context chạy nếu được tạo/resume trong một thao tác của người chơi,
 * nên `getAudioContext()` / `unlockAudio()` phải được gọi đồng bộ trong handler của thao tác đó.
 * Trình duyệt không có Web Audio hoặc tạo lỗi → null: nơi dùng tự im lặng / quay về cách khác.
 */

type WindowWithWebkitAudio = typeof window & { webkitAudioContext?: typeof AudioContext };

/** undefined = chưa thử tạo; null = không có / tạo lỗi (không thử lại). */
let ctx: AudioContext | null | undefined;

/** Lấy context, tạo nếu chưa có. Gọi trong thao tác người chơi để context được phép chạy. */
export function getAudioContext(): AudioContext | null {
  if (ctx !== undefined) return ctx;
  ctx = null;
  if (typeof window === "undefined") return ctx;
  const Ctor = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
  if (!Ctor) return ctx;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Context đã tạo (không tạo mới) — để biết đã mở khoá chưa mà không đụng tới thao tác người chơi. */
export function peekAudioContext(): AudioContext | null {
  return ctx ?? null;
}

/** Context đã tạo và đang chạy → phát tiếng được ngay (chưa mở khoá thì đừng xếp tiếng, kẻo dồn lại). */
export function isAudioRunning(): boolean {
  return ctx?.state === "running";
}

/**
 * Mở khoá / đánh thức: tạo nếu chưa có, resume nếu đang "suspended" hoặc "interrupted"
 * (Safari: cuộc gọi, khoá máy). Trả về promise xong khi context chạy (hoặc không thể chạy).
 */
export function unlockAudio(): Promise<boolean> {
  const c = getAudioContext();
  if (!c) return Promise.resolve(false);
  if (c.state === "running") return Promise.resolve(true);
  return c.resume().then(
    () => c.state === "running",
    () => false,
  );
}

/** Tạm ngưng context (tab ẩn) — đỡ tốn pin. */
export function suspendAudio() {
  if (ctx?.state === "running") void ctx.suspend().catch(() => {});
}
