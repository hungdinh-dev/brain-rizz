import { STORAGE_KEYS, safeLocal } from "@/lib/storage";

/** Âm lượng chung của âm thanh hiệu ứng (gain riêng, độc lập với nhạc nền). */
export const SFX_VOLUME = 0.5;

/** Đọc lựa chọn đã lưu: chỉ "off" mới là tắt; chưa lưu hay dữ liệu lạ → bật. */
export function parseSfxEnabled(raw: string | null): boolean {
  return raw !== "off";
}

export function serializeSfxEnabled(enabled: boolean): string {
  return enabled ? "on" : "off";
}

export function loadSfxEnabled(): boolean {
  return parseSfxEnabled(safeLocal.get(STORAGE_KEYS.sfx));
}

export function saveSfxEnabled(enabled: boolean) {
  safeLocal.set(STORAGE_KEYS.sfx, serializeSfxEnabled(enabled));
}
