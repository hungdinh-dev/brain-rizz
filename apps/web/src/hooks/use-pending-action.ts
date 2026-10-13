import { useEffect, useRef, useState } from "react";
import { useGame } from "@/stores/game.store";

/** Quá ngần này ms mà server chưa phản hồi (vd. tin mất lúc rớt mạng) thì mở khoá nút lại. */
const PENDING_TIMEOUT_MS = 5_000;

interface PendingMark {
  key: string;
  errorSeq: number;
}

/**
 * Khoá nút gửi lệnh ngay khi bấm, để bấm đúp không gửi lệnh hai lần (lần hai server từ chối
 * và hiện toast lỗi). Nút mở lại khi:
 *  - `resetKey` đổi: truyền chuỗi ghép các trường state mà lệnh sẽ làm đổi (pha, vòng…);
 *  - server báo lỗi (`errorSeq` trong store tăng);
 *  - quá PENDING_TIMEOUT_MS mà chưa có gì đổi.
 *
 * Cách dùng:
 * ```tsx
 * const start = usePendingAction(`${party.phase}:${party.round}`);
 * <Button disabled={start.pending} onClick={() => start.run(() => send(ClientMessage.StartRound, {}))} />
 * ```
 * Nút không nên nháy/mất focus (vd. "Bắt đầu" ở phòng chờ) thì giữ `disabled` như cũ, chỉ đặt
 * `aria-busy={start.pending}` + spinner; `run()` vẫn tự bỏ qua cú bấm thứ hai.
 */
export function usePendingAction(resetKey: string) {
  const errorSeq = useGame((s) => s.errorSeq);
  const [mark, setMark] = useState<PendingMark | null>(null);
  // Bản đồng bộ của `mark`: hai cú bấm sát nhau trước khi React kịp render lại vẫn bị chặn.
  const markRef = useRef<PendingMark | null>(null);

  const isLive = (m: PendingMark | null) =>
    m !== null && m.key === resetKey && m.errorSeq === errorSeq;
  const live = isLive(mark);

  useEffect(() => {
    if (!mark) return;
    const clear = () => {
      markRef.current = null;
      setMark(null);
    };
    // State đã đổi hoặc server báo lỗi → bỏ dấu ngay (để state quay lại giá trị cũ không khoá nhầm).
    if (!live) {
      clear();
      return;
    }
    const id = setTimeout(clear, PENDING_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [mark, live]);

  return {
    pending: live,
    run(action: () => void) {
      if (isLive(markRef.current)) return;
      const next = { key: resetKey, errorSeq };
      markRef.current = next;
      setMark(next);
      action();
    },
  };
}
