import type { SfxKind } from "./kinds";

/**
 * Tiếng tổng hợp bằng Web Audio khi chưa có file trong `src/assets/sfx/` (hoặc file lỗi).
 * Mỗi tiếng là vài "giọng" ngắn có đường bao âm lượng: nốt dao động (`Tone`) hoặc tiếng nhiễu
 * qua bộ lọc (`Noise`, cho trống và xèng). Mô tả thuần dữ liệu để test được; `player.ts` phát.
 */
export interface Tone {
  type: OscillatorType;
  /** Tần số lúc bắt đầu (Hz). */
  freq: number;
  /** Tần số lúc kết thúc nếu nốt trượt (Hz). */
  to?: number;
  /** Giây, tính từ lúc phát. */
  start: number;
  /** Giây. Với đường bao `hold`: thời gian giữ, chưa tính `release`. */
  dur: number;
  /** Âm lượng đỉnh 0–1 (trước gain chung của sfx). */
  peak: number;
  /** Thời gian lên tới đỉnh (giây), mặc định 0,005. */
  attack?: number;
  /**
   * Đường bao: `decay` (mặc định) lên nhanh rồi tắt dần tới hết `dur`; `swell` lên dần suốt `dur`
   * rồi tắt gọn; `hold` giữ đỉnh hết `dur` rồi nhả trong `release`.
   */
  envelope?: "decay" | "swell" | "hold";
  /** Giây nhả sau `dur` (đường bao `hold` / `swell`). */
  release?: number;
  /** Lệch cao độ (cent) — hai giọng lệch nhau cho tiếng kèn dày. */
  detune?: number;
  /** Lọc thấp: `from` Hz → `peak` Hz trong `rise` giây → giữ ở `settle` Hz. */
  lowpass?: { from: number; peak: number; rise: number; settle: number };
  /** Rung cao độ từ `after` giây (tính từ đầu nốt): `rate` Hz, ±`cents`. */
  vibrato?: { rate: number; cents: number; after: number };
  /** Rung âm lượng: `rate` Hz, sâu `depth` (0–1). */
  tremolo?: { rate: number; depth: number };
}

export interface NoiseFilter {
  type: BiquadFilterType;
  freq: number;
  q?: number;
}

/** Tiếng nhiễu trắng qua chuỗi bộ lọc, đường bao lên nhanh rồi tắt dần. */
export interface Noise {
  noise: true;
  start: number;
  dur: number;
  peak: number;
  attack?: number;
  filters: readonly NoiseFilter[];
}

export type Voice = Tone | Noise;

export const isNoise = (v: Voice): v is Noise => "noise" in v;

// Nốt nhạc (Hz)
const G4 = 392;
const A4 = 440;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const B5 = 987.77;
const C6 = 1046.5;
const G6 = 1567.98;

/** Trống dồn (vinh danh, ui-ux 6.2) — dài đúng bằng khoảng chờ trước hạng nhất. */
export const DRUMROLL_SECONDS = 2;

/**
 * Trống snare dồn nhanh dần + rền timpani bên dưới: khoảng cách gõ 85 → 38 ms, đỉnh 0,12 → 0,38,
 * xen kẽ ±15% như hai tay; timpani sine 73 + 110 Hz lên dần, rung 6 Hz. Dừng gọn ở 2 s.
 */
export function drumrollRecipe(): Voice[] {
  const voices: Voice[] = [];
  const filters: NoiseFilter[] = [
    { type: "highpass", freq: 700 },
    { type: "bandpass", freq: 2000, q: 0.7 },
  ];
  const hitDur = 0.062;
  let t = 0;
  let i = 0;
  while (t + hitDur <= DRUMROLL_SECONDS) {
    const p = t / DRUMROLL_SECONDS;
    const hand = i % 2 === 0 ? 1.15 : 0.85;
    voices.push({
      noise: true,
      start: t,
      dur: hitDur,
      attack: 0.002,
      peak: Math.min(1, (0.12 + 0.26 * p) * hand),
      filters,
    });
    t += 0.085 - 0.047 * p;
    i += 1;
  }
  for (const freq of [73, 110]) {
    voices.push({
      type: "sine",
      freq,
      start: 0,
      dur: DRUMROLL_SECONDS - 0.03,
      release: 0.03,
      envelope: "swell",
      peak: 0.18,
      tremolo: { rate: 6, depth: 0.3 },
    });
  }
  return voices;
}

/** Hai sawtooth lệch ±7 cent qua lọc thấp mở nhanh — một nốt kèn đồng. */
function brass(freq: number, start: number, dur: number, peak: number, chord = false): Tone[] {
  return [-7, 7].map((detune) => ({
    type: "sawtooth" as const,
    freq,
    start,
    dur,
    peak,
    attack: 0.01,
    detune,
    envelope: chord ? ("hold" as const) : ("decay" as const),
    release: chord ? 0.3 : undefined,
    lowpass: { from: 900, peak: 3200, rise: 0.04, settle: 1800 },
    vibrato: chord ? { rate: 5.5, cents: 8, after: 0.6 - start } : undefined,
  }));
}

/**
 * Kèn chiến thắng lúc lật hạng nhất: xèng + thùng, giai điệu Son–Đô–Mi rồi hợp âm Đô trưởng
 * (C5 E5 G5 C6) giữ 840 ms có vibrato, nhả 300 ms. Mỗi nốt 2 giọng; tổng hợp âm ≤ 0,3.
 */
export function fanfareRecipe(): Voice[] {
  const NOTE = 0.12;
  const chordAt = 3 * NOTE;
  return [
    // Xèng
    {
      noise: true,
      start: 0,
      dur: 1.1,
      attack: 0.003,
      peak: 0.3,
      filters: [{ type: "highpass", freq: 5000 }],
    },
    // Thùng
    { type: "sine", freq: 120, to: 50, start: 0, dur: 0.12, peak: 0.5 },
    ...[G4, C5, E5].flatMap((f, i) => brass(f, i * NOTE, NOTE, 0.04)),
    ...[C5, E5, G5, C6].flatMap((f) => brass(f, chordAt, 0.84, 0.0375, true)),
  ];
}

export const SYNTH_RECIPES: Record<SfxKind, readonly Voice[]> = {
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
  // Vinh danh hạng 3, 2: "ba-dum" đi lên Mi → Si
  reveal: [
    { type: "triangle", freq: E5, start: 0, dur: 0.08, peak: 0.22 },
    { type: "triangle", freq: B5, start: 0.07, dur: 0.14, peak: 0.22 },
  ],
  drumroll: drumrollRecipe(),
  fanfare: fanfareRecipe(),
};

/** Tiếng nhấn (giây cuối đếm ngược): blip cao hơn, dài hơn một chút. */
export const TICK_ACCENT: readonly Tone[] = [
  { type: "sine", freq: G6, start: 0, dur: 0.09, peak: 0.5 },
];

export function recipeFor(kind: SfxKind, accent = false): readonly Voice[] {
  return kind === "tick" && accent ? TICK_ACCENT : SYNTH_RECIPES[kind];
}

/** Thời điểm một giọng im hẳn (giây). */
export function voiceEnd(v: Voice): number {
  return v.start + v.dur + (isNoise(v) ? 0 : (v.release ?? 0));
}

/** Độ dài tiếng (giây) = giọng kết thúc muộn nhất. */
export function recipeDuration(voices: readonly Voice[]): number {
  return voices.reduce((max, v) => Math.max(max, voiceEnd(v)), 0);
}

/** Giới hạn độ dài: tiếng bấm ≤ 150 ms, đúng/sai ≤ 300 ms; tiếng vinh danh dài theo nhịp màn. */
const MAX_DURATION: Partial<Record<SfxKind, number>> = {
  correct: 0.3,
  wrong: 0.3,
  reveal: 0.25,
  drumroll: DRUMROLL_SECONDS,
  fanfare: 1.6,
};

export function maxDurationOf(kind: SfxKind): number {
  return MAX_DURATION[kind] ?? 0.15;
}
