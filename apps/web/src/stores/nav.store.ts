import { create } from "zustand";

/**
 * Màn hình khi KHÔNG ở trong phòng party (app không dùng router; trong phòng thì chọn màn theo pha).
 * intro/menu/profile do `features/home` lo; còn lại là các chế độ một mình và tài khoản (CR-009),
 * và trang quản trị (CR-019) mở bằng đường dẫn `/admin`.
 */
export type Screen =
  | "intro"
  | "menu"
  | "profile"
  | "practice"
  | "brain-test"
  | "account"
  | "leaderboard"
  | "admin";

/** Đường dẫn của trang quản trị (CR-019). Trùng `ADMIN_PATH` của auth.store (không import để nav nhẹ). */
const ADMIN_PATH = "/admin";

interface NavStore {
  screen: Screen;
  /**
   * Màn một mình đang ở lúc đếm ngược / đang chơi: App ẩn hàng nút nhạc/ngôn ngữ/theme và nhỏ tiếng
   * nhạc như pha `countdown`/`playing` của party.
   */
  soloFocus: boolean;
  /** Màn quay về sau khi sửa hồ sơ (mặc định menu; mở từ Tài khoản thì về Tài khoản). */
  profileReturn: Screen;
  go(screen: Screen, options?: { profileReturn?: Screen }): void;
  setSoloFocus(focused: boolean): void;
}

/** Màn mở đầu theo đường dẫn (hàm thuần, có test). */
export function screenForPath(pathname: string): Screen {
  // Trang quản trị: `/admin` (kể cả `/admin/` và lúc quay về từ Google `/admin?code=…`).
  if (/^\/admin\/?$/i.test(pathname)) return "admin";
  // Link mời /r/<mã> → bỏ qua màn giới thiệu, vào thẳng menu với mã điền sẵn.
  return /^\/r\/[A-Za-z0-9]{4}/.test(pathname) ? "menu" : "intro";
}

/** Giữ thanh địa chỉ khớp màn: vào trang quản trị → `/admin`; rời trang quản trị → `/`. */
function syncPath(from: Screen, to: Screen) {
  if (typeof location === "undefined" || from === to) return;
  if (to === "admin" && location.pathname !== ADMIN_PATH) {
    history.replaceState(null, "", ADMIN_PATH);
  } else if (from === "admin" && /^\/admin/i.test(location.pathname)) {
    history.replaceState(null, "", "/");
  }
}

export const useNav = create<NavStore>((set, get) => ({
  screen: typeof location === "undefined" ? "intro" : screenForPath(location.pathname),
  soloFocus: false,
  profileReturn: "menu",
  go: (screen, options) => {
    syncPath(get().screen, screen);
    set({ screen, soloFocus: false, profileReturn: options?.profileReturn ?? "menu" });
  },
  setSoloFocus: (soloFocus) => set({ soloFocus }),
}));
