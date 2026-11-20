import { type DependencyList, useCallback, useEffect, useState } from "react";
import type { AdminResult } from "@/net/admin-api";
import { type AdminLoad, useAdminStore } from "../admin.store";

/**
 * Tải dữ liệu một mục của trang quản trị (như `useData` nhưng với `AdminResult`). Đổi `deps` → tải
 * lại; kết quả cũ về muộn bị bỏ. `keepData`: lúc tải lại vẫn hiện dữ liệu cũ (tự làm mới, không
 * nháy khung xám). Mất quyền giữa chừng → báo store để trang về cổng.
 */
export function useAdminData<T>(
  fetcher: () => Promise<AdminResult<T>>,
  deps: DependencyList,
  options: { keepData?: boolean } = {},
) {
  const [state, setState] = useState<AdminLoad<T>>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const reportFailure = useAdminStore((s) => s.reportFailure);
  const keepData = options.keepData ?? false;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `deps` do nơi gọi khai báo
  useEffect(() => {
    let live = true;
    setRefreshing(true);
    setState((prev) => (keepData && prev.status === "ok" ? prev : { status: "loading" }));
    void fetcher().then((res) => {
      if (!live) return;
      if (!res.ok) reportFailure(res.reason);
      setState(res.ok ? { status: "ok", data: res.data } : { status: res.reason });
      setLoadedAt(Date.now());
      setRefreshing(false);
    });
    return () => {
      live = false;
    };
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { state, reload, refreshing, loadedAt };
}

/** Giá trị trễ (ô tìm kiếm: chờ người gõ xong mới gọi máy chủ). */
export function useDebounced<T>(value: T, ms = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
