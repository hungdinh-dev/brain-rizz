import { type GameId, isGameId } from "@brain-rizz/shared";
import { create } from "zustand";
import { STORAGE_KEYS, safeLocal } from "@/lib/storage";
import { hasStoredSession, SUPABASE_CONFIGURED } from "@/lib/supabase";
import {
  type DataResult,
  fetchPracticeFavorites,
  fetchSessionUserId,
  mergePracticeFavorites,
  setPracticeFavorite,
} from "@/net/data-api";

/**
 * Game yêu thích ở Luyện tập (CR-020, kế hoạch `practice-favorites-howto-routes.md` mục 3.1).
 *
 * - Lưu trên máy (`brain-rizz:favorites`): `ids` theo thứ tự thêm, `synced` = máy đã khớp tài khoản,
 *   `userId` = tài khoản của lần đồng bộ cuối (`null` = chưa từng đồng bộ).
 * - Bấm ⭐: đổi trên máy ngay (lạc quan); có phiên thì gửi lên, lỗi thì `synced = false`.
 * - Mở Luyện tập khi có phiên: xem `syncMode` (gộp danh sách máy vào tài khoản hay lấy danh sách
 *   tài khoản); kết quả thay `ids`, ghi lại `userId`. Không tạo phiên khách chỉ để lưu yêu thích;
 *   chưa có phiên / chưa cấu hình / DB chưa có RPC → chỉ dùng máy, không báo lỗi.
 */

export interface Favorites {
  ids: GameId[];
  /** Máy đã khớp tài khoản `userId` (không còn lần bấm ⭐ nào chưa gửi được). */
  synced: boolean;
  /**
   * Tài khoản của lần đồng bộ thành công cuối; `null` = chưa từng (kể cả dữ liệu cũ chưa có
   * trường này).
   */
  userId: string | null;
}

/** Máy chưa lưu gì: chưa từng đồng bộ (mở Luyện tập có phiên thì gộp danh sách rỗng = lấy về). */
export const EMPTY_FAVORITES: Favorites = { ids: [], synced: true, userId: null };

/** Mảng id đọc từ máy / tài khoản: chỉ giữ game có thật, bỏ trùng, giữ thứ tự. */
export function normalizeIds(value: unknown): GameId[] {
  if (!Array.isArray(value)) return [];
  const out: GameId[] = [];
  for (const v of value) if (isGameId(v) && !out.includes(v)) out.push(v);
  return out;
}

/** Đọc JSON đã lưu; hỏng hay sai kiểu thì về rỗng, không bao giờ ném lỗi. */
export function parseFavorites(raw: string | null): Favorites {
  if (!raw) return EMPTY_FAVORITES;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY_FAVORITES;
  }
  if (!data || typeof data !== "object") return EMPTY_FAVORITES;
  const d = data as Record<string, unknown>;
  return {
    ids: normalizeIds(d.ids),
    synced: d.synced !== false,
    userId: typeof d.userId === "string" && d.userId !== "" ? d.userId : null,
  };
}

export function loadFavorites(): Favorites {
  return parseFavorites(safeLocal.get(STORAGE_KEYS.favorites));
}

export function saveFavorites(favorites: Favorites) {
  safeLocal.set(
    STORAGE_KEYS.favorites,
    JSON.stringify({ ids: favorites.ids, synced: favorites.synced, userId: favorites.userId }),
  );
}

/** Thêm vào cuối nếu chưa có, bỏ nếu đã có. Không đụng `synced`. */
export function toggleId(ids: readonly GameId[], gameId: GameId): GameId[] {
  return ids.includes(gameId) ? ids.filter((id) => id !== gameId) : [...ids, gameId];
}

/**
 * Mở Luyện tập khi có phiên của `userId` (mục 3.1): chưa từng đồng bộ, hoặc cùng tài khoản mà còn
 * ⭐ chưa gửi được → gộp danh sách máy vào tài khoản; cùng tài khoản đã khớp → lấy danh sách tài
 * khoản; **khác tài khoản** → lấy danh sách của tài khoản mới (không trộn ⭐ của người trước).
 */
export function syncMode(local: Favorites, userId: string): "merge" | "get" {
  if (local.userId === null) return "merge";
  if (local.userId !== userId) return "get";
  return local.synced ? "get" : "merge";
}

/** Có phiên Supabase trên máy (không tạo phiên mới). */
function canSync(): boolean {
  return SUPABASE_CONFIGURED && hasStoredSession();
}

interface FavoritesStore extends Favorites {
  /** Bấm ⭐: trả `true` nếu game vừa được thêm, `false` nếu vừa bỏ. */
  toggle(gameId: GameId): boolean;
  /** Đọc lại từ máy rồi đồng bộ với tài khoản (nếu có phiên). Không bao giờ ném lỗi. */
  sync(): Promise<void>;
}

/** Tăng mỗi lần bấm ⭐: kết quả đồng bộ về sau một lần bấm thì không ghi đè lên máy. */
let version = 0;
/**
 * Mọi lời gọi tài khoản (gộp/lấy, bật/tắt ⭐) chạy lần lượt, đúng thứ tự bấm: bật rồi tắt nhanh,
 * hay tắt ngay lúc đang gộp, không bị máy chủ nhận đảo thứ tự.
 */
let queue: Promise<void> = Promise.resolve();
function enqueue(task: () => Promise<void>): Promise<void> {
  const next = queue.then(task).catch((err) => console.warn("[favorites]", err));
  queue = next;
  return next;
}
let syncing: Promise<void> | null = null;

/** Chờ các lời gọi tài khoản đang xếp hàng chạy xong (dùng trong test). */
export function whenFavoritesIdle(): Promise<void> {
  return queue;
}

export const useFavorites = create<FavoritesStore>((set, get) => {
  const commit = (next: Favorites) => {
    saveFavorites(next);
    set({ ids: next.ids, synced: next.synced, userId: next.userId });
  };

  async function runSync() {
    commit(loadFavorites());
    if (!canSync()) return;
    const start = get();
    const startVersion = version;
    const session = await fetchSessionUserId();
    if (!session.ok) return;
    const userId = session.data;
    const res: DataResult<string[]> =
      syncMode(start, userId) === "merge"
        ? await mergePracticeFavorites(start.ids)
        : await fetchPracticeFavorites();
    if (!res.ok) return;
    // Bấm ⭐ trong lúc chờ: giữ bản trên máy và tài khoản đã khớp lần trước (lời bấm đã xếp hàng
    // gửi lên tài khoản hiện tại), lần mở sau đồng bộ lại theo `syncMode`.
    if (version !== startVersion) commit({ ids: get().ids, synced: false, userId: get().userId });
    else commit({ ids: normalizeIds(res.data), synced: true, userId });
  }

  return {
    ...loadFavorites(),

    toggle(gameId) {
      const { ids, synced, userId } = get();
      const next = toggleId(ids, gameId);
      const added = next.includes(gameId);
      const online = canSync();
      version++;
      commit({ ids: next, synced: synced && online, userId });
      if (online) {
        void enqueue(async () => {
          const res = await setPracticeFavorite(gameId, added);
          if (!res.ok && get().synced) {
            commit({ ids: get().ids, synced: false, userId: get().userId });
          }
        });
      }
      return added;
    },

    sync() {
      // Mở lại màn khi lần trước chưa xong → dùng chung lần đó.
      syncing ??= enqueue(runSync).finally(() => {
        syncing = null;
      });
      return syncing;
    },
  };
});
