/**
 * Logic thuần của danh sách nhạc nền (không đụng DOM, không đụng import.meta.glob) để test được.
 * Danh sách thật được dựng trong `track-list.ts`.
 */

export interface Track {
  /** Tên file (vd. `01-happy-chalk.mp3`) — dùng để nhớ bài đang nghe, thêm bài mới không làm lệch. */
  id: string;
  /** Tên hiển thị suy ra từ tên file (vd. "Happy Chalk"). */
  title: string;
  /** URL file nhạc do Vite cấp (có hash khi build). */
  url: string;
}

/** Lấy tên file từ đường dẫn, bỏ phần thư mục. */
export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/**
 * Suy tên bài từ tên file: bỏ đuôi, bỏ tiền tố số thứ tự (`01-`, `2_`, `03.`), tách theo `-`/`_`/khoảng trắng,
 * viết hoa chữ cái đầu mỗi từ. Bỏ hết mà không còn gì (vd. `01.mp3`) thì giữ nguyên tên không đuôi.
 */
export function trackTitleFromPath(path: string): string {
  const base = fileNameOf(path).replace(/\.[^.]+$/, "");
  const words = base
    .replace(/^\d+[-_.\s]+/, "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase() + w.slice(1));
  return words.length > 0 ? words.join(" ") : base;
}

/** Dựng danh sách bài từ kết quả `import.meta.glob` (đường dẫn → URL), sắp theo tên file (số tự nhiên: 2 trước 10). */
export function buildTracks(urls: Record<string, string>): Track[] {
  return Object.entries(urls)
    .map(([path, url]) => ({ id: fileNameOf(path), title: trackTitleFromPath(path), url }))
    .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
}

/** Bài kế tiếp, hết danh sách quay về bài đầu. Danh sách rỗng → -1. */
export function nextTrackIndex(current: number, length: number): number {
  if (length <= 0) return -1;
  if (!Number.isInteger(current) || current < 0 || current >= length - 1) return 0;
  return current + 1;
}

/** Vị trí bài theo id đã lưu; không còn bài đó (bị xoá/đổi tên) → bài đầu. Danh sách rỗng → -1. */
export function trackIndexOf(tracks: readonly Track[], id: string | null): number {
  if (tracks.length === 0) return -1;
  const i = id ? tracks.findIndex((t) => t.id === id) : -1;
  return i >= 0 ? i : 0;
}
