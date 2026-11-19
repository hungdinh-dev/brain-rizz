import {
  AVATAR_COLORS,
  type CharacterId,
  type Difficulty,
  isCharacterId,
  isDifficulty,
  MAX_NAME_LENGTH,
  sanitizeLoadout,
} from "@brain-rizz/shared";
import { STORAGE_KEYS, safeLocal } from "@/lib/storage";

/*
 * Hồ sơ trên máy (`brain-rizz:profile`): tên, nhân vật, độ khó, phụ kiện. Nằm ở lib (không ở
 * features/home) vì nhiều feature cùng đọc / ghi, kể cả features/pets mà home lại dùng — để trong
 * home thì thành import vòng home ↔ pets. `@/features/home` vẫn xuất lại cho code cũ.
 */

export interface Profile {
  name: string;
  /** Màu gợi ý gửi lên server (server tự đổi sang màu còn trống nếu trùng) — làm nền avatar */
  colorIndex: number;
  avatar: CharacterId;
  difficulty: Difficulty;
  /**
   * Phụ kiện đang đeo (CR-023): id `COSMETIC_ITEMS` đã qua `sanitizeLoadout` (≤ 1 món mỗi chỗ,
   * thứ tự đầu → mặt → cổ). Gửi kèm khi vào phòng; server lọc lại theo món đã sở hữu.
   */
  accessories: string[];
}

const DEFAULT_PROFILE: Profile = {
  name: "",
  colorIndex: 0,
  avatar: "khoi",
  difficulty: 1,
  accessories: [],
};

/** Hồ sơ lần trước (tên, nhân vật, độ khó, phụ kiện) để người chơi không phải nhập lại. */
export function loadProfile(): Profile {
  try {
    const raw = safeLocal.get(STORAGE_KEYS.profile);
    if (!raw) return { ...DEFAULT_PROFILE, accessories: [] };
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
      accessories: sanitizeLoadout(p.accessories),
    };
  } catch {
    return { ...DEFAULT_PROFILE, accessories: [] };
  }
}

export function saveProfile(profile: Profile) {
  safeLocal.set(
    STORAGE_KEYS.profile,
    JSON.stringify({ ...profile, accessories: sanitizeLoadout(profile.accessories) }),
  );
}

/**
 * Đổi phụ kiện đang đeo (Tủ đồ, CR-023): làm sạch bằng `sanitizeLoadout`, lưu vào hồ sơ trên máy
 * (giữ nguyên tên, nhân vật, độ khó). Trả danh sách đã lưu.
 */
export function saveAccessories(ids: readonly string[]): string[] {
  const accessories = sanitizeLoadout(ids);
  saveProfile({ ...loadProfile(), accessories });
  return accessories;
}
