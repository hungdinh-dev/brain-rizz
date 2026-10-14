import { STORAGE_KEYS, safeLocal } from "@/lib/storage";

/** Lựa chọn nhạc nền được nhớ trên máy. */
export interface MusicSettings {
  /** Người chơi muốn nghe nhạc (mặc định bật; bấm dừng thì tắt hẳn tới khi bấm phát lại). */
  enabled: boolean;
  /** Âm lượng người chọn, 0–1. */
  volume: number;
  /** id (tên file) của bài đang nghe, null = bài đầu. */
  trackId: string | null;
}

export const DEFAULT_MUSIC_SETTINGS: MusicSettings = { enabled: true, volume: 0.6, trackId: null };

/** Hệ số âm lượng lúc đếm ngược và đang chơi (nhạc nhỏ lại để tập trung). */
export const DUCK_FACTOR = 0.5;

/** Đọc chuỗi JSON đã lưu; trường nào hỏng/thiếu thì lấy mặc định của trường đó. */
export function parseMusicSettings(raw: string | null): MusicSettings {
  if (!raw) return { ...DEFAULT_MUSIC_SETTINGS };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_MUSIC_SETTINGS };
  }
  if (typeof data !== "object" || data === null) return { ...DEFAULT_MUSIC_SETTINGS };
  const d = data as Record<string, unknown>;
  return {
    enabled: typeof d.enabled === "boolean" ? d.enabled : DEFAULT_MUSIC_SETTINGS.enabled,
    volume:
      typeof d.volume === "number" && Number.isFinite(d.volume)
        ? clampVolume(d.volume)
        : DEFAULT_MUSIC_SETTINGS.volume,
    trackId: typeof d.trackId === "string" && d.trackId ? d.trackId : null,
  };
}

export function clampVolume(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Âm lượng thực đặt cho thẻ audio: giảm một nửa khi đang tập trung chơi. */
export function effectiveVolume(volume: number, ducked: boolean): number {
  return clampVolume(volume) * (ducked ? DUCK_FACTOR : 1);
}

/**
 * Chia âm lượng thực cho hai nút vặn: đi qua Web Audio (`routed`) thì thẻ audio để 1, gain lo hết
 * (iOS bỏ qua audio.volume); không có Web Audio thì thẻ audio tự chỉnh, gain không dùng (1).
 */
export function volumeTargets(
  volume: number,
  ducked: boolean,
  routed: boolean,
): { element: number; gain: number } {
  const level = effectiveVolume(volume, ducked);
  return routed ? { element: 1, gain: level } : { element: level, gain: 1 };
}

export function loadMusicSettings(): MusicSettings {
  return parseMusicSettings(safeLocal.get(STORAGE_KEYS.music));
}

export function saveMusicSettings(settings: MusicSettings) {
  safeLocal.set(STORAGE_KEYS.music, JSON.stringify(settings));
}
