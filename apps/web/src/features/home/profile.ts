import {
  AVATAR_COLORS,
  type CharacterId,
  type Difficulty,
  isCharacterId,
  isDifficulty,
  MAX_NAME_LENGTH,
} from "@brain-rizz/shared";
import { STORAGE_KEYS, safeLocal } from "@/lib/storage";

export interface Profile {
  name: string;
  /** Màu gợi ý gửi lên server (server tự đổi sang màu còn trống nếu trùng) — làm nền avatar */
  colorIndex: number;
  avatar: CharacterId;
  difficulty: Difficulty;
}

const DEFAULT_PROFILE: Profile = { name: "", colorIndex: 0, avatar: "khoi", difficulty: 1 };

/** Hồ sơ lần trước (tên, nhân vật, độ khó) để người chơi không phải nhập lại. */
export function loadProfile(): Profile {
  try {
    const raw = safeLocal.get(STORAGE_KEYS.profile);
    if (!raw) return DEFAULT_PROFILE;
    const p = JSON.parse(raw) as Partial<Profile>;
    return {
      // Dữ liệu cũ/sửa tay có thể sai → làm sạch để server không từ chối lúc vào phòng.
      name: typeof p.name === "string" ? p.name.trim().slice(0, MAX_NAME_LENGTH) : "",
      colorIndex:
        Number.isInteger(p.colorIndex) && p.colorIndex! >= 0 && p.colorIndex! < AVATAR_COLORS.length
          ? p.colorIndex!
          : 0,
      avatar: isCharacterId(p.avatar) ? p.avatar : DEFAULT_PROFILE.avatar,
      difficulty: isDifficulty(p.difficulty) ? p.difficulty : 1,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: Profile) {
  safeLocal.set(STORAGE_KEYS.profile, JSON.stringify(profile));
}
