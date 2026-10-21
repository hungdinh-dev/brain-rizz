import type { SceneResync } from "../types";

/*
 * Phần thuần khi scene đồng bộ lại với server (tách khỏi scene để test), dùng cho các game có khoá
 * sau khi sai (Luyện ngắm, Rót vừa vạch…): chọn cách hiện lại câu sau khi nối lại, và nhận ra lúc
 * server bỏ qua một câu.
 */

/** Cách hiện lại câu theo server. */
export type ResyncPlan =
  /** Hiện câu `index` mới, đồng hồ câu đếm lại từ đầu. */
  | { kind: "show"; index: number }
  /** Scene đang khoá đúng câu trước: giữ hình khoá, chỉ hẹn hết khoá theo `unlockMs`. */
  | { kind: "rearm"; index: number; unlockMs: number }
  /** Server còn khoá sau câu `index − 1` bị chấm sai: hiện câu đó như bỏ lỡ, khoá `unlockMs`. */
  | { kind: "lock"; index: number; unlockMs: number };

/**
 * Chọn cách hiện lại câu khi nối lại. `lockedIndex` = câu scene đang hiện khoá (null nếu không
 * khoá). Không biết câu server (`sync` undefined) thì hiện lại câu đang làm của scene.
 */
export function planResync(
  sync: SceneResync | undefined,
  current: { index: number; lockedIndex: number | null },
): ResyncPlan {
  if (!sync) return { kind: "show", index: current.index };
  const { progress, unlockMs } = sync;
  if (unlockMs > 0 && progress > 0) {
    return current.lockedIndex === progress - 1
      ? { kind: "rearm", index: progress, unlockMs }
      : { kind: "lock", index: progress, unlockMs };
  }
  return { kind: "show", index: progress };
}

/**
 * Server bỏ qua câu `index` (`answerOutcome` trả `null`) — vd. đang khoá sau khi nối lại, hoặc
 * tin bị mất lúc rớt mạng — thì mọi câu gửi sau đều lệch index. Chỉ đồng bộ lại khi chắc chắn:
 * sau ngần ấy thời gian chờ, `progress` của server vẫn chưa qua câu đó (đáp án gửi sau đó vẫn
 * có thể đang trên đường nên không so với câu đang làm của scene).
 */
export function ignoredByServer(index: number, serverProgress: number | undefined): boolean {
  return serverProgress !== undefined && serverProgress <= index;
}
