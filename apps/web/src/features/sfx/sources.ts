import { isSfxKind, type SfxKind } from "./kinds";

/** Khi có nhiều định dạng cho cùng một tiếng: ưu tiên mp3 (mọi trình duyệt, kể cả Safari iOS cũ). */
const FORMAT_PRIORITY = ["mp3", "m4a", "ogg", "wav"];

/**
 * Từ kết quả `import.meta.glob` (đường dẫn → URL) lấy URL file cho từng loại tiếng.
 * Tên file phải đúng tên loại (`click.mp3`, `correct.wav`…); file lạ bị bỏ qua.
 */
export function sfxUrlsFromGlob(urls: Record<string, string>): Partial<Record<SfxKind, string>> {
  const best = new Map<SfxKind, { rank: number; url: string }>();
  for (const [path, url] of Object.entries(urls)) {
    const file = path.split(/[\\/]/).pop() ?? path;
    const dot = file.lastIndexOf(".");
    if (dot <= 0) continue;
    const name = file.slice(0, dot).toLowerCase();
    const rank = FORMAT_PRIORITY.indexOf(file.slice(dot + 1).toLowerCase());
    if (!isSfxKind(name) || rank < 0) continue;
    const current = best.get(name);
    if (!current || rank < current.rank) best.set(name, { rank, url });
  }
  return Object.fromEntries([...best].map(([kind, { url }]) => [kind, url]));
}
