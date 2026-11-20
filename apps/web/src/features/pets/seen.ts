import { PET_CHARACTER_IDS, type PetId } from "@brain-rizz/shared";
import { STORAGE_KEYS, safeLocal } from "@/lib/storage";

/**
 * Bạn đồng hành đã thấy mở khoá trên máy này (CR-024, ui-ux 6.12 "hộp chúc mừng"), lưu kèm người
 * dùng: `{ user, ids }` (`user` = id Supabase; khách chưa có phiên = `null`). So với danh sách đang
 * mở để biết thú nào vừa mở. Chưa có danh sách của người này (lần đầu, hoặc máy vừa đổi tài khoản):
 * ghi lại danh sách đang mở, không chúc mừng thú đã mở sẵn từ trước.
 */
export interface SeenRecord {
  user: string | null;
  ids: PetId[];
}

/** Đọc bản lưu; hỏng / sai kiểu / kiểu cũ (mảng không kèm người dùng) coi như chưa ghi. */
export function loadSeenRecord(): SeenRecord | null {
  const raw = safeLocal.get(STORAGE_KEYS.petsSeen);
  if (raw === null) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const { user, ids } = data as Record<string, unknown>;
    if ((user !== null && typeof user !== "string") || !Array.isArray(ids)) return null;
    return { user, ids: normalizeSeen(ids) };
  } catch {
    return null;
  }
}

/** Danh sách đã thấy của đúng người dùng `user`; người khác hoặc chưa ghi → `null`. */
export function loadSeenPets(user: string | null): PetId[] | null {
  const record = loadSeenRecord();
  return record && record.user === user ? record.ids : null;
}

export function saveSeenPets(user: string | null, ids: readonly PetId[]) {
  const record: SeenRecord = { user, ids: normalizeSeen(ids) };
  safeLocal.set(STORAGE_KEYS.petsSeen, JSON.stringify(record));
}

/** Bỏ id lạ / trùng, theo thứ tự `PET_CHARACTER_IDS`. */
export function normalizeSeen(ids: readonly unknown[]): PetId[] {
  return PET_CHARACTER_IDS.filter((id) => ids.includes(id));
}

/**
 * Thú cần chúc mừng: đang mở mà chưa có trong danh sách đã thấy, theo thứ tự `PET_CHARACTER_IDS`
 * (nhiều thú cùng lúc → lần lượt từng hộp). Chưa có danh sách (lần đầu) → không chúc mừng gì.
 */
export function pendingCelebrations(
  unlocked: readonly PetId[],
  seen: readonly PetId[] | null,
): PetId[] {
  if (seen === null) return [];
  return PET_CHARACTER_IDS.filter((id) => unlocked.includes(id) && !seen.includes(id));
}
