import { sfxUrlsFromGlob } from "./sources";

/**
 * File tiếng trong `src/assets/sfx/` (`<loại>.mp3` …) — thả vào là thay tiếng tổng hợp, không phải sửa code.
 * Chỉ lấy URL lúc build; file được tải (fetch + decode) sau khi âm thanh được mở khoá.
 * Đường dẫn tương đối thay cho `@/`: alias trong glob chỉ chắc chạy với `resolve.alias`.
 */
const urls = import.meta.glob<string>("../../assets/sfx/*.{mp3,ogg,m4a,wav}", {
  eager: true,
  query: "?url",
  import: "default",
});

export const SFX_URLS = sfxUrlsFromGlob(urls);
