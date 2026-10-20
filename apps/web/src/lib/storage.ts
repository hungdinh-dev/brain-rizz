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
  /** Âm thanh hiệu ứng khi bấm nút: "on" | "off". */
  sfx: "brain-rizz:sfx",
  /** Hiệu ứng chuyển động: "system" | "on" (CR-010). */
  motion: "brain-rizz:motion",
  /** Kỷ lục luyện tập trên máy + độ khó lần trước của từng game (JSON, UC-13). */
  practice: "brain-rizz:practice",
  /** Chat trong phòng (CR-011): người bị tắt tiếng theo mã phòng (JSON, chỉ trên máy này). */
  chatMute: "brain-rizz:chat-mute",
  /** Cột chat máy tính đang thu gọn: "1" | không có. */
  chatCollapsed: "brain-rizz:chat-collapsed",
  /** Phiên Supabase (supabase-js tự đọc/ghi; app chỉ xem có hay không để khỏi tải thư viện sớm). */
  auth: "brain-rizz:auth",
  /** sessionStorage: đang đi đăng nhập Google, quay về thì mở lại màn Tài khoản. */
  oauthReturn: "brain-rizz:oauth-return",
} as const;
