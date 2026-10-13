import { create } from "zustand";
import { STORAGE_KEYS, safeLocal } from "@/lib/storage";

/**
 * Giao diện sáng/tối. Người dùng chọn "light" | "dark" | "system" (theo hệ điều hành);
 * kết quả thực tế ("light" | "dark") được gắn bằng class `.dark` trên <html>.
 * index.html có đoạn script nhỏ làm việc tương tự TRƯỚC khi React chạy để không bị nháy màu.
 */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** Màu thanh trình duyệt trên điện thoại, khớp màu khung gỗ --wood trong globals.css. */
const THEME_COLOR: Record<ResolvedTheme, string> = { light: "#a8693b", dark: "#6b4528" };

const media = window.matchMedia("(prefers-color-scheme: dark)");

function readPreference(): ThemePreference {
  const saved = safeLocal.get(STORAGE_KEYS.theme);
  return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  return media.matches ? "dark" : "light";
}

function apply(theme: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

interface ThemeStore {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference(preference: ThemePreference): void;
}

const initialPreference = readPreference();

export const useTheme = create<ThemeStore>((set) => ({
  preference: initialPreference,
  resolved: resolve(initialPreference),
  setPreference(preference) {
    safeLocal.set(STORAGE_KEYS.theme, preference);
    const resolved = resolve(preference);
    apply(resolved);
    set({ preference, resolved });
  },
}));

apply(useTheme.getState().resolved);

// Đang để "theo hệ thống" mà người dùng đổi chế độ máy → đổi theo ngay.
media.addEventListener("change", () => {
  const { preference } = useTheme.getState();
  if (preference !== "system") return;
  const resolved = resolve(preference);
  apply(resolved);
  useTheme.setState({ resolved });
});

/** "light" | "dark" đang hiển thị — dùng cho thứ không đọc được CSS (Sonner, canvas Phaser…). */
export function useResolvedTheme() {
  return useTheme((s) => s.resolved);
}
