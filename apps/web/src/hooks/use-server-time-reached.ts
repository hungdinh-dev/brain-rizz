import { useEffect, useState } from "react";
import { serverNow, useGame } from "@/stores/game.store";

/**
 * `true` khi giờ server đã tới mốc `at` (ms epoch). Chỉ hẹn một setTimeout thay vì cập nhật
 * định kỳ, nên màn hình không phải render lại liên tục chỉ để biết "đã bắt đầu/hết giờ chưa".
 * Độ lệch giờ đo lại (`clockOffset`) thì hẹn lại.
 */
export function useServerTimeReached(at: number): boolean {
  const clockOffset = useGame((s) => s.clockOffset);
  const [reached, setReached] = useState(() => serverNow() >= at);

  useEffect(() => {
    const wait = at - (Date.now() + clockOffset);
    if (wait <= 0) {
      setReached(true);
      return;
    }
    setReached(false);
    const id = setTimeout(() => setReached(true), wait);
    return () => clearTimeout(id);
  }, [at, clockOffset]);

  return reached;
}
