import type { ConnectionEvent, MinigameBridge, SceneResync } from "@/games/types";
import { useGame } from "@/stores/game.store";
import { unlockDelayOf } from "./unlock-delay";

/**
 * Cho scene có đồng hồ riêng (bia tự hết hạn…) biết lúc mất / có lại kết nối và câu server đang
 * chờ — `MinigameBridge.watchConnection`, `serverSync`. Dùng chung cho phòng party và Kiểm tra não.
 *
 * Thứ tự khi SDK nối lại (Colyseus 0.18): server chạy `onReconnect` (AnswerJudge.resume tính lại
 * giờ hiện câu) → client nhận JOIN_ROOM, store chuyển `online` → client xác nhận → server gửi
 * state đầy đủ. Nên chỉ báo `resumed` khi state đổi SAU lúc `online`: lúc đó `progress` đã là
 * của server sau khi nối lại.
 */

/** Đã nối lại mà quá ngần này ms chưa thấy state mới thì vẫn báo `resumed` theo state đang có. */
export const RESYNC_STATE_TIMEOUT_MS = 1_500;

/** Đọc `progress` của mình trong state đang mở; `undefined` = không có. */
export type ProgressReader = () => number | undefined;

/** Phòng party: `progress` của mình trong `players`. */
export const partyProgress: ProgressReader = () => {
  const s = useGame.getState();
  return s.party?.players[s.sessionId]?.progress;
};

/** Phòng Kiểm tra não. */
export const brainProgress: ProgressReader = () => useGame.getState().brain?.progress;

/**
 * Câu server đang chờ và số ms còn khoá. Server không đồng bộ `lockedUntil` nên lấy từ kết quả
 * câu cuối đã nhận khi đó đúng là câu `progress − 1` (câu khác thì khoá đã hết từ trước).
 */
export function serverSyncOf(read: ProgressReader): SceneResync | undefined {
  const progress = read();
  if (progress === undefined) return undefined;
  const last = useGame.getState().lastAnswer;
  const unlockMs = last && last.index === progress - 1 ? unlockDelayOf(last) : 0;
  return { progress, unlockMs };
}

/** Theo dõi store kết nối, báo `paused` / `resumed` cho scene. Trả hàm huỷ. */
export function watchConnectionOf(
  read: ProgressReader,
  listener: (event: ConnectionEvent) => void,
  timeoutMs = RESYNC_STATE_TIMEOUT_MS,
): () => void {
  let phase: "online" | "paused" | "awaiting-state" = "online";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stopTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const pause = () => {
    stopTimer();
    phase = "paused";
    listener({ type: "paused" });
  };
  const resume = () => {
    stopTimer();
    phase = "online";
    listener({ type: "resumed", sync: serverSyncOf(read) });
  };

  // `reconnecting` (đang nối lại) và `offline` (phòng đã đóng hẳn) đều là mất kết nối: dừng đồng
  // hồ, huỷ hẹn giờ chờ state. Phòng đóng lúc đang chờ state thì không bao giờ báo `resumed`.
  if (useGame.getState().connection !== "online") pause();
  const unsubscribe = useGame.subscribe((s, prev) => {
    if (s.connection !== "online") {
      if (phase !== "paused") pause();
      return;
    }
    if (phase === "paused" && s.connection === "online") {
      phase = "awaiting-state";
      timer = setTimeout(resume, timeoutMs);
      return;
    }
    if (phase === "awaiting-state" && (s.party !== prev.party || s.brain !== prev.brain)) resume();
  });
  return () => {
    stopTimer();
    unsubscribe();
  };
}

/** Hai hàm của `MinigameBridge` theo state đang mở (party hoặc Kiểm tra não). */
export function connectionSync(
  read: ProgressReader,
): Required<Pick<MinigameBridge, "watchConnection" | "serverSync">> {
  return {
    watchConnection: (listener) => watchConnectionOf(read, listener),
    serverSync: () => serverSyncOf(read),
  };
}
