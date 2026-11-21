import {
  AVATAR_COLORS,
  type CharacterId,
  type Difficulty,
  isCharacterId,
  isDifficulty,
  MAX_NAME_LENGTH,
  sanitizeLoadout,
} from "@brain-rizz/shared";
import { create } from "zustand";
import { STORAGE_KEYS, safeLocal } from "@/lib/storage";

/*
 * Hồ sơ trên máy (`brain-rizz:profile`): tên, nhân vật, độ khó, phụ kiện. Nằm ở lib (không ở
 * features/home) vì nhiều feature cùng đọc / ghi, kể cả features/pets mà home lại dùng — để trong
 * home thì thành import vòng home ↔ pets. `@/features/home` vẫn xuất lại cho code cũ.
 *
 * Có phiên Google thì tên + nhân vật của TÀI KHOẢN là nguồn đúng: `auth.store` kéo hàng `profiles`
 * về rồi hợp nhất bằng `mergeAccountProfile` (đăng nhập máy khác / xoá dữ liệu trình duyệt vẫn giữ
 * tên, không bắt nhập lại).
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

/** Làm sạch hồ sơ (dữ liệu cũ / sửa tay có thể sai → server sẽ từ chối lúc vào phòng). */
function normalizeProfile(p: Partial<Profile>): Profile {
  return {
    name: typeof p.name === "string" ? p.name.trim().slice(0, MAX_NAME_LENGTH) : "",
    colorIndex:
      Number.isInteger(p.colorIndex) && p.colorIndex! >= 0 && p.colorIndex! < AVATAR_COLORS.length
        ? p.colorIndex!
        : 0,
    avatar: isCharacterId(p.avatar) ? p.avatar : DEFAULT_PROFILE.avatar,
    difficulty: isDifficulty(p.difficulty) ? p.difficulty : 1,
    accessories: sanitizeLoadout(p.accessories),
  };
}

/** Hồ sơ lần trước (tên, nhân vật, độ khó, phụ kiện) để người chơi không phải nhập lại. */
export function loadProfile(): Profile {
  try {
    const raw = safeLocal.get(STORAGE_KEYS.profile);
    if (!raw) return { ...DEFAULT_PROFILE, accessories: [] };
    return normalizeProfile(JSON.parse(raw) as Partial<Profile>);
  } catch {
    return { ...DEFAULT_PROFILE, accessories: [] };
  }
}

/**
 * Gắn hồ sơ trên máy với tài khoản (lưu kèm trong `brain-rizz:profile`, không thuộc `Profile`):
 * - `owner`: tài khoản Google mà hồ sơ trên máy đang theo (null = chưa gắn: khách, chưa đăng nhập).
 *   Máy dùng chung: đăng nhập tài khoản Google khác chưa có tên thì không đẩy tên của người trước.
 * - `editedFor`: người chơi CHỦ ĐỘNG đổi tên khi đang đăng nhập tài khoản này mà chưa đẩy lên được
 *   (vd. Supabase tạm dừng). Lần kéo hồ sơ thành công kế tiếp thì bản sửa tay thắng, đẩy xong thì xoá.
 */
export interface ProfileMeta {
  owner: string | null;
  editedFor: string | null;
}

function loadMeta(): ProfileMeta {
  try {
    const p = JSON.parse(safeLocal.get(STORAGE_KEYS.profile) ?? "{}") as Record<string, unknown>;
    const id = (v: unknown) => (typeof v === "string" && v ? v : null);
    return { owner: id(p.owner), editedFor: id(p.editedFor) };
  } catch {
    return { owner: null, editedFor: null };
  }
}

interface ProfileStore extends ProfileMeta {
  /** Hồ sơ hiện tại (khớp `brain-rizz:profile`; localStorage bị chặn thì vẫn nhớ trong phiên này). */
  profile: Profile;
  /**
   * Tăng mỗi lần hồ sơ được thay bằng hồ sơ của tài khoản (đăng nhập Google, đổi tài khoản). Màn có
   * ô nhập riêng (Hồ sơ của bạn) dùng làm `key` để điền lại tên mới.
   */
  accountRev: number;
}

/**
 * Hồ sơ dùng chung cho các màn đang mở: `saveProfile` cập nhật luôn store này, nên màn đọc qua
 * `useProfile` thấy ngay hồ sơ mới (kể cả hồ sơ vừa kéo về từ tài khoản) mà không cần tải lại trang.
 * Ghép hồ sơ mới thì lấy từ `useProfile.getState().profile` (không từ localStorage: bị chặn thì
 * `loadProfile()` ra hồ sơ trống, ghép vào sẽ xoá mất tên).
 */
export const useProfile = create<ProfileStore>(() => ({
  profile: loadProfile(),
  accountRev: 0,
  ...loadMeta(),
}));

/** Hồ sơ đang dùng (store, không đọc lại localStorage) — dùng khi ghép hồ sơ mới ngoài React. */
export function currentProfile(): Profile {
  return useProfile.getState().profile;
}

/** Ghi store hiện tại xuống máy (hồ sơ + dấu tài khoản). */
function persist() {
  const { profile, owner, editedFor } = useProfile.getState();
  safeLocal.set(STORAGE_KEYS.profile, JSON.stringify({ ...profile, owner, editedFor }));
}

export function saveProfile(profile: Profile) {
  useProfile.setState({
    profile: normalizeProfile({ ...profile, accessories: sanitizeLoadout(profile.accessories) }),
  });
  persist();
}

/** Dấu gắn tài khoản hiện tại của hồ sơ trên máy. */
export function profileMeta(): ProfileMeta {
  const { owner, editedFor } = useProfile.getState();
  return { owner, editedFor };
}

/** Đổi dấu gắn tài khoản (giữ nguyên hồ sơ). */
export function setProfileMeta(patch: Partial<ProfileMeta>) {
  useProfile.setState(patch);
  persist();
}

/**
 * Đổi phụ kiện đang đeo (Tủ đồ, CR-023): làm sạch bằng `sanitizeLoadout`, lưu vào hồ sơ trên máy
 * (giữ nguyên tên, nhân vật, độ khó). Trả danh sách đã lưu.
 */
export function saveAccessories(ids: readonly string[]): string[] {
  const accessories = sanitizeLoadout(ids);
  saveProfile({ ...useProfile.getState().profile, accessories });
  return accessories;
}

/** Hàng `profiles` của tài khoản (Supabase) — chưa tin: có thể thiếu hoặc sai kiểu. */
export interface AccountProfileRow {
  display_name?: unknown;
  avatar?: unknown;
}

export interface AccountMergeContext {
  /** Tài khoản Google đang đăng nhập. */
  userId?: string | null;
  /** Tài khoản mà hồ sơ trên máy đang theo (`ProfileMeta.owner`). */
  owner?: string | null;
  /** Người chơi đã sửa tay hồ sơ cho tài khoản này mà chưa đẩy được → bản trên máy thắng. */
  edited?: boolean;
}

export interface AccountMerge {
  /** Hồ sơ nên dùng trên máy. */
  profile: Profile;
  /** Khác hồ sơ trên máy → cần lưu lại (`adoptAccountProfile`). */
  changed: boolean;
  /** Đẩy tên + nhân vật trên máy lên tài khoản. */
  push: boolean;
}

/**
 * Hợp nhất hồ sơ trên máy với hồ sơ của tài khoản (hàm thuần):
 * 1. Người chơi đã sửa tay cho tài khoản này (`edited`) và có tên → bản trên máy thắng, đẩy lên.
 * 2. Tài khoản có tên → tên đó thắng (máy khác, xoá dữ liệu, đổi tài khoản); nhân vật chỉ nhận khi
 *    là id hợp lệ (server tự kiểm quyền thú khoá). Độ khó, màu giữ của máy.
 * 3. Tài khoản chưa có tên: hồ sơ trên máy chưa gắn tài khoản nào (khách vừa liên kết) hoặc gắn
 *    đúng tài khoản này → giữ, có tên thì đẩy lên. Hồ sơ của tài khoản KHÁC (máy dùng chung) → không
 *    đẩy, xoá tên để người chơi đặt tên cho tài khoản mới.
 * Hồ sơ trên máy của tài khoản khác thì bỏ luôn phụ kiện (món của người trước; server cũng lọc).
 */
export function mergeAccountProfile(
  local: Profile,
  remote: AccountProfileRow | null | undefined,
  ctx: AccountMergeContext = {},
): AccountMerge {
  if (ctx.edited && local.name.trim()) return { profile: local, changed: false, push: true };
  const foreign = !!ctx.owner && !!ctx.userId && ctx.owner !== ctx.userId;
  const accessories = foreign ? [] : local.accessories;
  const name =
    typeof remote?.display_name === "string"
      ? remote.display_name.trim().slice(0, MAX_NAME_LENGTH)
      : "";
  let next: Profile;
  if (name) {
    const remoteAvatar = remote?.avatar;
    const avatar = isCharacterId(remoteAvatar) ? remoteAvatar : local.avatar;
    next = { ...local, name, avatar, accessories };
  } else if (foreign) {
    next = { ...local, name: "", accessories };
  } else {
    return { profile: local, changed: false, push: local.name.trim() !== "" };
  }
  const changed =
    next.name !== local.name ||
    next.avatar !== local.avatar ||
    next.accessories.join() !== local.accessories.join();
  return { profile: changed ? next : local, changed, push: false };
}

/**
 * Lưu hồ sơ vừa nhận từ tài khoản (gắn với `owner`) và báo màn có ô nhập điền lại (`accountRev`).
 */
export function adoptAccountProfile(profile: Profile, owner?: string) {
  saveProfile(profile);
  if (owner !== undefined) setProfileMeta({ owner });
  useProfile.setState((s) => ({ accountRev: s.accountRev + 1 }));
}
