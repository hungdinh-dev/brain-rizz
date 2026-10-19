import { STORAGE_KEYS, safeLocal } from "@/lib/storage";

/**
 * Cài đặt hiệu ứng chuyển động (CR-010) — logic thuần, có test.
 * - `system` (mặc định): theo máy — máy báo `prefers-reduced-motion: reduce` thì giảm.
 * - `on`: luôn bật đủ hiệu ứng, kể cả khi máy đang giảm chuyển động
 *   (vd. Windows tắt "Animation effects" mà vẫn muốn xem vòng quay, vinh danh).
 */
export type MotionPreference = "system" | "on";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Chỉ "on" mới là luôn bật; chưa lưu hay dữ liệu lạ → theo hệ thống. */
export function parseMotionPreference(raw: string | null): MotionPreference {
  return raw === "on" ? "on" : "system";
}

export function loadMotionPreference(): MotionPreference {
  return parseMotionPreference(safeLocal.get(STORAGE_KEYS.motion));
}

export function saveMotionPreference(preference: MotionPreference) {
  safeLocal.set(STORAGE_KEYS.motion, preference);
}

/** Có giảm chuyển động không: chỉ khi đang theo hệ thống **và** máy báo giảm. */
export function resolveReducedMotion(preference: MotionPreference, systemReduces: boolean) {
  return preference === "system" && systemReduces;
}

/** Máy có đang báo giảm chuyển động không. Không có `matchMedia` (test, trình duyệt cũ) → không. */
export function systemReducesMotion(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(REDUCED_MOTION_QUERY).matches
    );
  } catch {
    return false;
  }
}
