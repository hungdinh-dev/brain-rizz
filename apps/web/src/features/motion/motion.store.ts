import { create } from "zustand";
import {
  loadMotionPreference,
  type MotionPreference,
  REDUCED_MOTION_QUERY,
  resolveReducedMotion,
  saveMotionPreference,
  systemReducesMotion,
} from "./settings";

/**
 * MỘT nguồn "giảm chuyển động" cho cả app (CR-010): React (`useReducedMotion`), CSS
 * (`motion-safe:` / `motion-reduce:` và `@media` trong styles — đọc `data-motion` trên <html>)
 * và scene Phaser (`prefersReducedMotion()`). Không chỗ nào khác tự đọc `matchMedia` nữa.
 */
interface MotionStore {
  preference: MotionPreference;
  /** Máy đang báo `prefers-reduced-motion: reduce`. */
  systemReduced: boolean;
  setPreference(preference: MotionPreference): void;
  /** "Theo hệ thống" ↔ "Luôn bật". */
  toggle(): void;
}

/** `data-motion="on"` trên <html> khi luôn bật — CSS dựa vào đó để bỏ qua `@media` của máy. */
function apply(preference: MotionPreference) {
  if (typeof document === "undefined") return;
  if (preference === "on") document.documentElement.dataset.motion = "on";
  else delete document.documentElement.dataset.motion;
}

export const useMotion = create<MotionStore>((set, get) => ({
  preference: loadMotionPreference(),
  systemReduced: systemReducesMotion(),
  setPreference(preference) {
    saveMotionPreference(preference);
    apply(preference);
    set({ preference });
  },
  toggle() {
    get().setPreference(get().preference === "on" ? "system" : "on");
  },
}));

apply(useMotion.getState().preference);

// Người dùng đổi cài đặt máy khi app đang mở → cập nhật ngay.
try {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    window
      .matchMedia(REDUCED_MOTION_QUERY)
      .addEventListener("change", (e) => useMotion.setState({ systemReduced: e.matches }));
  }
} catch {
  /* trình duyệt cũ không có addEventListener trên MediaQueryList: bỏ qua */
}

/**
 * Có đang giảm chuyển động không — hàm thuần đọc tại chỗ, cho scene Phaser và code ngoài React.
 * Scene đọc một lần lúc dựng; đổi giữa vòng thì áp dụng từ vòng sau.
 */
export function prefersReducedMotion(): boolean {
  const { preference, systemReduced } = useMotion.getState();
  return resolveReducedMotion(preference, systemReduced);
}

/** Hook React: tự render lại khi đổi nút Hiệu ứng hoặc đổi cài đặt máy. */
export function useReducedMotion(): boolean {
  return useMotion((s) => resolveReducedMotion(s.preference, s.systemReduced));
}
