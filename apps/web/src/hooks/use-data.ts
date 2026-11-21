import { type DependencyList, useCallback, useEffect, useState } from "react";
import type { DataFailure, DataResult } from "@/net/data-api";
import { useLoadingWhile } from "@/stores/top-loading.store";

export type DataState<T> =
  | { status: "loading" }
  | { status: "ok"; data: T }
  | { status: DataFailure };

/**
 * Tải một lần dữ liệu từ máy chủ dữ liệu (net/data-api) và theo dõi trạng thái tải / xong /
 * chưa kết nối / chưa có phiên / lỗi. `reload()` cho nút Thử lại (quay lại "đang tải").
 * Đổi `deps` → tải lại; kết quả cũ về muộn bị bỏ.
 * `enabled = false` → đứng yên ở trạng thái `no-session` (vd. chưa có phiên thì khỏi hỏi).
 * Đang tải → hiện thanh tải trên đầu trang (stores/top-loading.store.ts), trừ khi `background`:
 * dữ liệu phụ tải nền (vd. "Cao nhất" trên thẻ menu) không bật thanh lúc mở app.
 */
export function useData<T>(
  fetcher: () => Promise<DataResult<T>>,
  deps: DependencyList,
  enabled = true,
  options: { background?: boolean } = {},
): DataState<T> & { reload(): void } {
  const [state, setState] = useState<DataState<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `deps` do nơi gọi khai báo
  useEffect(() => {
    if (!enabled) {
      setState({ status: "no-session" });
      return;
    }
    let live = true;
    setState({ status: "loading" });
    void fetcher().then((res) => {
      if (!live) return;
      setState(res.ok ? { status: "ok", data: res.data } : { status: res.reason });
    });
    return () => {
      live = false;
    };
  }, [...deps, enabled, nonce]);

  useLoadingWhile(!options.background && enabled && state.status === "loading");

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
