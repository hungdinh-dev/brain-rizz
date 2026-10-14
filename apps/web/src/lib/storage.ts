/**
 * localStorage / sessionStorage an toàn: chế độ riêng tư hoặc bị chặn cookie thì đọc ra null,
 * ghi thì bỏ qua — không làm vỡ app.
 */
function safe(getStorage: () => Storage) {
  return {
    get(key: string): string | null {
      try {
        return getStorage().getItem(key);
      } catch {
        return null;
      }
    },
    set(key: string, value: string) {
      try {
        getStorage().setItem(key, value);
      } catch {
        /* bỏ qua */
      }
    },
    remove(key: string) {
      try {
        getStorage().removeItem(key);
      } catch {
        /* bỏ qua */
      }
    },
  };
}

export const safeLocal = safe(() => localStorage);
export const safeSession = safe(() => sessionStorage);

/** Khoá lưu trữ dùng trong app — gom một chỗ để không trùng tên. */
export const STORAGE_KEYS = {
  profile: "brain-rizz:profile",
  reconnect: "brain-rizz:reconnect",
  theme: "brain-rizz:theme",
  language: "brain-rizz:lang",
  /** Nhạc nền: bật/tắt, âm lượng, bài đang nghe (JSON). */
  music: "brain-rizz:music",
} as const;
