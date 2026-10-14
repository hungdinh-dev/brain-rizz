import type { SfxKind } from "./kinds";

/**
 * Tiếng tổng hợp bằng OscillatorNode khi chưa có file trong `src/assets/sfx/` (hoặc file lỗi).
 * Mỗi tiếng là vài nốt ngắn có đường bao âm lượng (lên nhanh ~5 ms, tắt dần); nhẹ nhàng, không chói.
 */
export interface Tone {
  type: OscillatorType;
  /** Tần số lúc bắt đầu (Hz). */
  freq: number;
  /** Tần số lúc kết thúc nếu nốt trượt (Hz). */
  to?: number;
  /** Giây, tính từ lúc phát. */
  start: number;
  /** Giây. */
  dur: number;
  /** Âm lượng đỉnh 0–1 (trước gain chung của sfx). */
  peak: number;
}

// Nốt nhạc (Hz)
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const A4 = 440;
const C6 = 1046.5;
const G6 = 1567.98;

export const SYNTH_RECIPES: Record<SfxKind, readonly Tone[]> = {
  // Pop nhẹ: một nốt sine trượt xuống rất nhanh
  click: [{ type: "sine", freq: 900, to: 500, start: 0, dur: 0.06, peak: 0.6 }],
  // Hai nốt ngắn cách quãng năm
  toggle: [
    { type: "triangle", freq: 660, start: 0, dur: 0.05, peak: 0.5 },
    { type: "triangle", freq: 990, start: 0.06, dur: 0.05, peak: 0.5 },
  ],
  // Hai nốt đi lên (Đô → Son)
  confirm: [
    { type: "triangle", freq: C5, start: 0, dur: 0.07, peak: 0.55 },
    { type: "triangle", freq: G5, start: 0.07, dur: 0.08, peak: 0.55 },
  ],
  // Hai nốt đi xuống (Mi → La)
  back: [
    { type: "triangle", freq: E5, start: 0, dur: 0.07, peak: 0.45 },
    { type: "triangle", freq: A4, start: 0.07, dur: 0.08, peak: 0.45 },
  ],
  // Buzz thấp nhẹ: hai nốt triangle lệch nhau vài Hz tạo tiếng rè êm, trượt xuống
  error: [
    { type: "triangle", freq: 196, to: 160, start: 0, dur: 0.15, peak: 0.7 },
    { type: "triangle", freq: 203, to: 166, start: 0, dur: 0.15, peak: 0.5 },
  ],
  // Blip ngắn
  tick: [{ type: "sine", freq: C6, start: 0, dur: 0.05, peak: 0.45 }],
  // Arpeggio vui Đô–Mi–Son–Đô
  correct: [
    { type: "triangle", freq: C5, start: 0, dur: 0.07, peak: 0.5 },
    { type: "triangle", freq: E5, start: 0.06, dur: 0.07, peak: 0.5 },
    { type: "triangle", freq: G5, start: 0.12, dur: 0.07, peak: 0.5 },
    { type: "triangle", freq: C6, start: 0.18, dur: 0.1, peak: 0.5 },
  ],
  // Nốt trượt xuống
  wrong: [{ type: "triangle", freq: 392, to: 196, start: 0, dur: 0.26, peak: 0.55 }],
};

/** Tiếng nhấn (giây cuối đếm ngược): blip cao hơn, dài hơn một chút. */
export const TICK_ACCENT: readonly Tone[] = [
  { type: "sine", freq: G6, start: 0, dur: 0.09, peak: 0.5 },
];

export function recipeFor(kind: SfxKind, accent = false): readonly Tone[] {
  return kind === "tick" && accent ? TICK_ACCENT : SYNTH_RECIPES[kind];
}

/** Độ dài tiếng (giây) = nốt kết thúc muộn nhất. */
export function recipeDuration(tones: readonly Tone[]): number {
  return tones.reduce((max, t) => Math.max(max, t.start + t.dur), 0);
}

/** Giới hạn độ dài: tiếng bấm ≤ 150 ms, đúng/sai ≤ 300 ms. */
export function maxDurationOf(kind: SfxKind): number {
  return kind === "correct" || kind === "wrong" ? 0.3 : 0.15;
}
