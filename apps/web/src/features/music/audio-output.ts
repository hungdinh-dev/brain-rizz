import { getAudioContext, suspendAudio, unlockAudio } from "@/lib/audio-context";
import { volumeTargets } from "./settings";

/**
 * Đường ra loa của thẻ <audio> nhạc nền.
 *
 * iOS/iPadOS không cho đổi `audio.volume` (luôn 1), nên âm lượng và việc nhỏ tiếng khi chơi phải đi qua
 * Web Audio: audio → MediaElementSource → GainNode → loa, chỉnh `gain` thay cho `audio.volume`.
 * Trình duyệt không có AudioContext hoặc tạo lỗi → quay về `audio.volume` như cũ.
 *
 * Dùng AudioContext chung của app (`@/lib/audio-context`, chung với âm thanh hiệu ứng). Context chỉ chạy
 * được nếu được tạo/resume trong một thao tác của người chơi, nên `createAudioOutput` và `wake()` phải được
 * gọi đồng bộ trong handler của thao tác đó (trước mọi `await`).
 */
export interface AudioOutput {
  /** Web Audio đang dùng (true) hay đang chỉnh audio.volume (false). */
  readonly routed: boolean;
  /** Đặt âm lượng thực; `smooth` = chuyển dần ~200 ms (khi vào/ra pha chơi). */
  setLevel(volume: number, ducked: boolean, smooth: boolean): void;
  /** Resume context nếu đang suspended/interrupted (iOS khoá máy, cuộc gọi, tab ẩn). */
  wake(): void;
  /** Tạm ngưng context khi tab ẩn — đỡ tốn pin. */
  sleep(): void;
}

/** Hằng thời gian của setTargetAtTime: sau ~3τ ≈ 200 ms gần như tới đích. */
const RAMP_TIME_CONSTANT = 0.07;

/** Nối thẻ audio qua Web Audio (chỉ gọi MỘT lần cho mỗi thẻ — createMediaElementSource không gọi lại được). */
export function createAudioOutput(el: HTMLAudioElement): AudioOutput {
  const ctx = getAudioContext();
  let gain: GainNode | null = null;
  if (ctx) {
    try {
      const source = ctx.createMediaElementSource(el);
      const node = ctx.createGain();
      source.connect(node);
      node.connect(ctx.destination);
      gain = node;
    } catch {
      // Context dùng chung (âm thanh hiệu ứng vẫn cần) → không đóng, chỉ quay về audio.volume.
      gain = null;
    }
  }

  if (!ctx || !gain) {
    return {
      routed: false,
      setLevel(volume, ducked) {
        el.volume = volumeTargets(volume, ducked, false).element;
      },
      wake() {},
      sleep() {},
    };
  }

  const g = gain;
  return {
    routed: true,
    setLevel(volume, ducked, smooth) {
      const { element, gain: level } = volumeTargets(volume, ducked, true);
      el.volume = element;
      const now = ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      if (smooth) g.gain.setTargetAtTime(level, now, RAMP_TIME_CONSTANT);
      else g.gain.setValueAtTime(level, now);
    },
    wake() {
      void unlockAudio();
    },
    sleep() {
      suspendAudio();
    },
  };
}
