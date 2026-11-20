import {
  BASE_CHARACTER_IDS,
  type CharacterId,
  isPetId,
  type PetId,
  petProgress,
  type UnlockProgress,
} from "@brain-rizz/shared";
import { useEffect, useMemo } from "react";
import { ensurePetUnlocks, type UnlockLoad, unlockedPetsOf, usePetUnlockStore } from "./pets.store";

export interface PetUnlocks {
  load: UnlockLoad;
  /** Có số liệu để hiện tiến độ (đã tải xong; chưa có phiên = chưa chơi gì, số 0). */
  hasData: boolean;
  /** Thú đang mở. Chưa có số liệu thì lấy các thú đã thấy mở trên máy này. */
  unlockedPets: PetId[];
  /** Nhân vật cũ luôn mở; thú theo `unlockedPets`. */
  isUnlocked(id: CharacterId): boolean;
  /** Tiến độ một thú; `null` khi chưa có số liệu ("chưa có dữ liệu"). */
  progress(pet: PetId): UnlockProgress | null;
  /** Thú vừa mở trên máy này mà chưa xem hộp chúc mừng (chip "Mới!"). */
  isNew(id: CharacterId): boolean;
}

/** Đã mở trước, khoá sau; giữ thứ tự gốc trong mỗi nhóm (ui-ux 6.12). */
export function lockedLast<T extends string>(ids: readonly T[], isOpen: (id: T) => boolean): T[] {
  return [...ids.filter((id) => isOpen(id)), ...ids.filter((id) => !isOpen(id))];
}

/**
 * Khoá / tiến độ bạn đồng hành cho màn chọn nhân vật. Lần đầu dùng thì tải (một lần mỗi phiên),
 * sau đó tự làm mới theo các mốc ở `pets.store`.
 */
export function usePetUnlocks(): PetUnlocks {
  useEffect(() => {
    ensurePetUnlocks();
  }, []);
  const load = usePetUnlockStore((s) => s.load);
  const stats = usePetUnlockStore((s) => s.stats);
  const seen = usePetUnlockStore((s) => s.seen);

  return useMemo(() => {
    const hasData = load === "ready";
    const unlockedPets = hasData ? unlockedPetsOf(stats) : (seen ?? []);
    const isUnlocked = (id: CharacterId) =>
      (BASE_CHARACTER_IDS as readonly string[]).includes(id) ||
      (isPetId(id) && unlockedPets.includes(id));
    return {
      load,
      hasData,
      unlockedPets,
      isUnlocked,
      progress: (pet: PetId) => (hasData ? petProgress(pet, stats) : null),
      isNew: (id: CharacterId) =>
        isPetId(id) && seen !== null && unlockedPets.includes(id) && !seen.includes(id),
    };
  }, [load, stats, seen]);
}
