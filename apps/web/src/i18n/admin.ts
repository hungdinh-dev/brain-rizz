import { i18n } from "./index";

/**
 * Tải lười chữ của trang quản trị (`locales/admin/`, CR-019) rồi gộp vào namespace `common` cho mọi
 * ngôn ngữ, như `solo.ts`. Gọi cùng lúc với `import()` của trang (App.tsx) nên trang hiện ra là đã
 * có chữ. Tên game đọc thẳng từ registry (`useGameTextLookup`) nên không cần `registerGameLocales`.
 * Gọi nhiều lần chỉ tải một lần.
 */
let loading: Promise<void> | null = null;

export function loadAdminLocales(): Promise<void> {
  loading ??= Promise.all([import("./locales/admin/vi"), import("./locales/admin/en")])
    .then(([{ viAdmin }, { enAdmin }]) => {
      i18n.addResourceBundle("vi", "common", viAdmin, true, true);
      i18n.addResourceBundle("en", "common", enAdmin, true, true);
    })
    .catch((err) => {
      // Lỗi tải chunk (rớt mạng): lần sau thử lại.
      loading = null;
      throw err;
    });
  return loading;
}
