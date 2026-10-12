import { useEffect, useState } from "react";
import { serverNow } from "@/stores/game.store";

/** Giờ server ước tính, cập nhật mỗi `intervalMs` — dùng cho đếm ngược và đồng hồ vòng. */
export function useServerClock(intervalMs = 100) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
