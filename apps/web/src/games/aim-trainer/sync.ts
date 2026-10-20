import type { SceneResync } from "../types";

/*
 * Phần thuần của Luyện ngắm khi đồng bộ với server (tách khỏi scene để test): đếm chip
 * "trúng + ms TB" và chọn cách hiện lại câu sau khi nối lại / khi server bỏ qua một câu.
 */

/**
 * Chip "trúng + ms TB" chỉ đếm câu server đã chấm ĐÚNG (`answerResult`), không đếm lúc máy thấy
 * trúng: cú trúng bị chấm muộn, hay gửi tiếp lúc server đang khoá (bị bỏ qua), không được cộng.
 * Khoá theo index câu nên một câu chỉ được đếm một lần (server chỉ chấm mỗi câu một lần trong vòng).
 * ms là đồng hồ scene lúc chạm (chỉ để hiển thị).
 */
export class HitTally {
  private confirmed = new Map<number, number>();

  /** Server chấm đúng câu `index`, chạm sau `ms` kể từ lúc bia hiện. */
  confirm(index: number, ms: number) {
    if (!this.confirmed.has(index)) this.confirmed.set(index, Math.max(0, Math.round(ms)));
  }

  get hits(): number {
    return this.confirmed.size;
  }

  /** ms trung bình mỗi bia trúng; `undefined` khi chưa trúng bia nào. */
  get avgMs(): number | undefined {
    if (this.confirmed.size === 0) return undefined;
    let sum = 0;
    for (const ms of this.confirmed.values()) sum += ms;
    return Math.round(sum / this.confirmed.size);
  }
}

/** Cách hiện lại câu theo server. */
export type ResyncPlan =
  /** Hiện bia câu `index` mới, đồng hồ bia đếm lại từ đầu. */
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
