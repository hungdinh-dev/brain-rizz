import { useEffect, useState } from "react";
import { useReducedMotion } from "@/features/motion";
import { playSfx } from "@/features/sfx";
import { serverNow } from "@/stores/game.store";
import { centerRow, type DrumFrame, type DrumFrameInput, type DrumPhase, drumFrame } from "../drum";

export type WheelStatus = DrumPhase;

/** Tiếng tick mỗi dòng đi qua kim: cách nhau ít nhất ngần này ms, âm lượng 40% (ui-ux 6.7). */
const TICK_GAP_MS = 60;
const TICK_VOLUME = 0.4;

/**
 * Trạng thái vòng quay cho cả màn: chờ / đang quay / đã trúng, theo giờ server (mọi máy cùng
 * dừng sau `spinMs`). Chỉ đổi hai lần mỗi lượt quay nên màn không vẽ lại mỗi khung hình; vị trí
 * trống do `useDrumFrame` tính riêng trong component trống. Vào lại khi đã quay xong → "landed".
 */
export function useWheelStatus(spinAt: number, spinMs: number): WheelStatus {
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    if (!spinAt) return;
    const endAt = spinAt + spinMs;
    let id: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      const n = serverNow();
      setNow(n);
      // Hẹn giờ có thể dậy sớm vài ms so với giờ server: chưa tới thì hẹn tiếp.
      if (n < endAt) id = setTimeout(check, Math.max(16, endAt - n));
    };
    check();
    return () => clearTimeout(id);
  }, [spinAt, spinMs]);

  if (!spinAt) return "idle";
  return now >= spinAt + spinMs ? "landed" : "spinning";
}

/**
 * Vị trí trống mỗi khung hình (requestAnimationFrame) theo giờ server: chờ quay thì trôi đều,
 * đang quay thì chậm dần tới game trúng (`drumFrame`). Phát tiếng tick khi một dòng đi qua kim lúc
 * đang quay và tiếng chọn lúc trúng (theo nút Âm thanh, không theo nút Hiệu ứng).
 * Giảm chuyển động: trống đứng yên, không chạy khung hình, tới giờ thì nhảy tới game trúng.
 */
export function useDrumFrame(input: Omit<DrumFrameInput, "reduced">): DrumFrame {
  const reduced = useReducedMotion();
  const { spinAt, spinMs, count, target } = input;
  const [frame, setFrame] = useState(() => drumFrame(serverNow(), { ...input, reduced }));

  useEffect(() => {
    const opts: DrumFrameInput = { spinAt, spinMs, count, target, reduced };
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let phase: DrumPhase | null = null;
    let row: number | null = null;
    let tickAt = 0;

    const step = () => {
      const now = serverNow();
      const f = drumFrame(now, opts);
      setFrame((prev) =>
        prev.phase === f.phase && prev.pos === f.pos && prev.blur === f.blur ? prev : f,
      );

      if (f.phase === "spinning") {
        const r = centerRow(f.pos);
        const at = performance.now();
        if (row !== null && r !== row && at - tickAt >= TICK_GAP_MS) {
          playSfx("tick", { volume: TICK_VOLUME });
          tickAt = at;
        }
        row = r;
      }
      // Chỉ kêu khi thấy trống dừng ngay trên màn (vào lại lúc đã trúng thì im).
      if (f.phase === "landed" && phase === "spinning") playSfx("confirm");
      phase = f.phase;

      if (f.phase === "landed") return;
      if (!reduced) {
        raf = requestAnimationFrame(step);
      } else if (f.phase === "spinning") {
        timer = setTimeout(step, Math.max(16, spinAt + spinMs - now));
      }
    };
    step();
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [spinAt, spinMs, count, target, reduced]);

  return frame;
}
