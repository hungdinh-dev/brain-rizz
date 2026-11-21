import type { GameId } from "@brain-rizz/shared";
import { useEffect, useSyncExternalStore } from "react";
import { enabledGames } from "@/lib/enabled-games";

/**
 * Game đang bật (quản trị viên tắt game nào thì Luyện tập ẩn game đó, CR-019). Lần đầu trả đủ danh
 * mục rồi cập nhật khi tải xong; mỗi lần mở màn thì tải lại nếu đệm đã hết hạn.
 */
export function useEnabledGames(): readonly GameId[] {
  useEffect(() => {
    void enabledGames.refresh();
  }, []);
  return useSyncExternalStore(enabledGames.subscribe, enabledGames.get);
}

/** Giữ các id đang bật, theo thứ tự của `ids` (vd. thứ tự thêm Yêu thích). */
export function onlyEnabled(ids: readonly GameId[], enabled: readonly GameId[]): GameId[] {
  const on = new Set(enabled);
  return ids.filter((id) => on.has(id));
}
