import { create } from "zustand";

/**
 * Màn hình khi KHÔNG ở trong phòng party (app không dùng router; trong phòng thì chọn màn theo pha).
 * intro/menu/profile do `features/home` lo; còn lại là các chế độ một mình và tài khoản (CR-009).
 */
export type Screen =
  | "intro"
  | "menu"
  | "profile"
  | "practice"
  | "brain-test"
  | "account"
  | "leaderboard";

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

function initialScreen(): Screen {
  // Link mời /r/<mã> → bỏ qua màn giới thiệu, vào thẳng menu với mã điền sẵn.
  return /^\/r\/[A-Za-z0-9]{4}/.test(location.pathname) ? "menu" : "intro";
}

export const useNav = create<NavStore>((set) => ({
  screen: typeof location === "undefined" ? "intro" : initialScreen(),
  soloFocus: false,
  profileReturn: "menu",
  go: (screen, options) =>
    set({ screen, soloFocus: false, profileReturn: options?.profileReturn ?? "menu" }),
  setSoloFocus: (soloFocus) => set({ soloFocus }),
}));
