import { i18n } from "./index";

/**
 * Tải lười chữ của Máy quay phụ kiện và Tủ đồ (`locales/gacha/`, CR-023: 24 món, độ hiếm, chỗ đeo)
 * rồi gộp vào namespace `common` cho mọi ngôn ngữ, như `solo.ts`. Gọi cùng lúc với `import()` của
 * màn đó (App.tsx) nên màn hiện ra là đã có chữ. Gọi nhiều lần chỉ tải một lần.
 */
let loading: Promise<void> | null = null;

export function loadGachaLocales(): Promise<void> {
  loading ??= Promise.all([import("./locales/gacha/vi"), import("./locales/gacha/en")])
    .then(([{ viGacha }, { enGacha }]) => {
      i18n.addResourceBundle("vi", "common", viGacha, true, true);
      i18n.addResourceBundle("en", "common", enGacha, true, true);
    })
    .catch((err) => {
      // Lỗi tải chunk (rớt mạng): lần sau thử lại.
      loading = null;
      throw err;
    });
  return loading;
}
