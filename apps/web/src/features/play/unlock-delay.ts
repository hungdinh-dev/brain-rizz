import { type AnswerResultPayload, WRONG_ANSWER_LOCK_MS } from "@brain-rizz/shared";
import { serverNow, useGame } from "@/stores/game.store";

/**
 * Chờ `answerResult` của câu sai tối đa ngần này ms. Quá hạn thì coi như server đã bỏ qua câu đó
 * (không khoá) để scene không kẹt. Kết quả về muộn hơn `lockedUntil` thì đằng nào cũng đã hết khoá,
 * nên chờ gấp đôi thời gian khoá là đủ cho mạng chậm.
 */
export const UNLOCK_RESULT_TIMEOUT_MS = 2 * WRONG_ANSWER_LOCK_MS;

/** Số ms (đồng hồ máy) còn lại tới khi server mở khoá theo kết quả `result`. Không khoá → 0. */
export function unlockDelayOf(result: AnswerResultPayload): number {
  return result.lockedUntil ? Math.max(0, result.lockedUntil - serverNow()) : 0;
}

/**
 * `MinigameBridge.unlockDelay`: chờ kết quả câu `index` trong store, rồi trả về số ms còn lại tới
 * `lockedUntil` (giờ server, đã quy về đồng hồ máy). Chờ quá `timeoutMs` thì trả về 0.
 */
export function waitUnlockDelay(
  index: number,
  timeoutMs = UNLOCK_RESULT_TIMEOUT_MS,
): Promise<number> {
  const ofIndex = (r: AnswerResultPayload | null) => (r?.index === index ? r : null);
  const ready = ofIndex(useGame.getState().lastAnswer);
  if (ready) return Promise.resolve(unlockDelayOf(ready));

  return new Promise((resolve) => {
    let unsubscribe = () => {};
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(0);
    }, timeoutMs);
    unsubscribe = useGame.subscribe((s) => {
      const result = ofIndex(s.lastAnswer);
      if (!result) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(unlockDelayOf(result));
    });
  });
}
