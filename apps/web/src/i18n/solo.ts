import { i18n } from "./index";

/**
 * Tải lười chữ của 4 màn một mình và tài khoản (`locales/solo/`) rồi gộp vào namespace `common`
 * cho mọi ngôn ngữ (đổi ngôn ngữ giữa chừng vẫn có chữ). Gọi cùng lúc với `import()` của màn đó
 * (App.tsx) nên màn hiện ra là đã có chữ. Gọi nhiều lần chỉ tải một lần.
 */
let loading: Promise<void> | null = null;

export function loadSoloLocales(): Promise<void> {
  // `./games` kéo theo registry minigame nên cũng import động (không lọt vào gói đầu).
  loading ??= Promise.all([
    import("./locales/solo/vi"),
    import("./locales/solo/en"),
    import("./games"),
  ])
    .then(([{ viSolo }, { enSolo }, { registerGameLocales }]) => {
      i18n.addResourceBundle("vi", "common", viSolo, true, true);
      i18n.addResourceBundle("en", "common", enSolo, true, true);
      // Các màn một mình cũng hiện tên/cách chơi minigame.
      registerGameLocales();
    })
    .catch((err) => {
      // Lỗi tải chunk (rớt mạng): lần sau thử lại.
      loading = null;
      throw err;
    });
  return loading;
}
