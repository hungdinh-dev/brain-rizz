import { buildTracks } from "./tracks";

/**
 * Mọi file nhạc trong `src/assets/music/` — thả file vào là có, không phải sửa code.
 * `query: "?url"` + `eager`: lúc build chỉ lấy URL (file được chép ra dist kèm hash),
 * không tải nhạc lúc mở trang; thẻ audio tự tải khi bắt đầu phát.
 * Đường dẫn tương đối thay cho `@/`: alias trong glob chỉ chắc chạy với `resolve.alias`.
 */
const urls = import.meta.glob<string>("../../assets/music/*.{mp3,ogg,m4a}", {
  eager: true,
  query: "?url",
  import: "default",
});

export const TRACKS = buildTracks(urls);
