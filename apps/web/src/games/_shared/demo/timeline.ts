/*
 * Dòng thời gian của khung diễn hướng dẫn (CR-021, UI-UX 6.11): hàm thuần, không biết React hay DOM.
 * Mỗi vật động có một "làn" (track): danh sách mốc ms → tư thế (dời, xoay, phóng, độ mờ). Từ làn
 * sinh ra @keyframes CSS (mốc % = ms ÷ T) và tra được tư thế ở một ms bất kỳ (`sample`) để kiểm thử.
 * Chỉ có transform và opacity: không animate filter, d, kích thước hay màu.
 */

/** Đường cong của một đoạn: `linear` hoặc 3 token `--ease-*` trong styles/globals.css. */
export type Ease = "linear" | "glide" | "settle" | "pop";

/** Điểm điều khiển cubic-bezier, khớp từng token `--ease-*` (test so với globals.css). */
export const EASE_POINTS: Record<
  Exclude<Ease, "linear">,
  readonly [number, number, number, number]
> = {
  glide: [0.45, 0, 0.25, 1],
  settle: [0.2, 0.7, 0.3, 1],
  pop: [0.34, 1.56, 0.64, 1],
};

/**
 * Tư thế của một vật: dời (x, y) theo đơn vị sân khấu, xoay `r` độ, phóng `sx`/`sy`, độ đục `o`.
 * Vật vẽ quanh gốc 0,0 nên xoay/phóng quanh tâm vật.
 */
export interface Pose {
  x: number;
  y: number;
  r: number;
  sx: number;
  sy: number;
  o: number;
}

/** Tư thế khai báo: thiếu trường nào giữ trường đó; `s` = phóng đều hai chiều. */
export type PoseInput = Partial<Pose> & { s?: number };

/** Một mốc của làn. `ease` là đường cong của đoạn TỪ mốc này tới mốc sau (như CSS). */
export interface Stop {
  t: number;
  pose: Pose;
  ease: Ease;
}

export type Track = readonly Stop[];

export const REST: Pose = { x: 0, y: 0, r: 0, sx: 1, sy: 1, o: 1 };

function merge(base: Pose, input: PoseInput): Pose {
  const { s, ...rest } = input;
  return { ...base, ...(s === undefined ? {} : { sx: s, sy: s }), ...rest };
}

/** Bộ dựng làn: các sự kiện phải theo thứ tự thời gian (không lùi). */
export class TrackBuilder {
  private readonly stops: Stop[];

  constructor(init: PoseInput = {}) {
    this.stops = [{ t: 0, pose: merge(REST, init), ease: "linear" }];
  }

  private get last(): Stop {
    return this.stops[this.stops.length - 1] as Stop;
  }

  /** Giữ nguyên tới `at` rồi chuyển sang `pose` trong `dur` ms theo `ease` (tới nơi lúc at + dur). */
  to(at: number, dur: number, pose: PoseInput, ease: Ease = "settle"): this {
    const last = this.last;
    if (at < last.t) throw new Error(`Mốc ${at} ms lùi so với mốc trước (${last.t} ms)`);
    if (dur <= 0) throw new Error(`Thời lượng phải > 0 (mốc ${at} ms)`);
    if (at > last.t) this.stops.push({ t: at, pose: last.pose, ease });
    else last.ease = ease;
    this.stops.push({ t: at + dur, pose: merge(last.pose, pose), ease: "linear" });
    return this;
  }

  /** Đổi ngay lúc `at` (đoạn 1 ms), vd. sóng chạm hiện đậm rồi mới loang. */
  jump(at: number, pose: PoseInput): this {
    return this.to(at, 1, pose, "linear");
  }

  /** Nảy vào: phóng + hiện tới 1 trong `dur` ms (pop). */
  pop(at: number, dur = 240): this {
    return this.to(at, dur, { s: 1, o: 1 }, "pop");
  }

  /** Mờ tới độ đục `o` (mặc định hiện hẳn). */
  fade(at: number, dur = 150, o = 1, ease: Ease = "settle"): this {
    return this.to(at, dur, { o }, ease);
  }

  /** Nhịp phóng 1 → `peak` → 1 trong `dur` ms. */
  bump(at: number, peak: number, dur: number, ease: Ease = "settle"): this {
    const half = dur / 2;
    return this.to(at, half, { s: peak }, ease).to(at + half, half, { s: 1 }, ease);
  }

  /** Rung ngang ±`amp` đơn vị: 4 đoạn × 60 ms, linear (UI-UX 6.11 "Rung khi sai"). */
  shake(at: number, amp = 6): this {
    return this.to(at, 60, { x: amp }, "linear")
      .to(at + 60, 60, { x: -amp }, "linear")
      .to(at + 120, 60, { x: amp }, "linear")
      .to(at + 180, 60, { x: 0 }, "linear");
  }

  build(): Track {
    return this.stops.map((stop) => ({ ...stop }));
  }
}

export function track(init: PoseInput = {}): TrackBuilder {
  return new TrackBuilder(init);
}

// ─── Mẫu dùng chung ──────────────────────────────────────────────────────────────────────────

/** ✓ ✗ ⚡, huy hiệu, vòng khoanh: ẩn ở 0,2 rồi nảy vào lúc `at` (240 ms, pop). */
export const popIn = (at: number, dur = 240, from = 0.2) => track({ s: from, o: 0 }).pop(at, dur);

/** Sóng chạm tại điểm chạm, bắt đầu cùng lúc nhấn: 0,3 → 1,3, đục 0,95 → 0, 450 ms settle. */
export const ripple = (at: number) =>
  track({ s: 0.3, o: 0 })
    .jump(at, { o: 0.95 })
    .to(at + 1, 449, { s: 1.3, o: 0 });

/** Câu cũ ra: mờ + thu 0,96 trong 160 ms. */
export const questionOut = (at: number) => track().to(at, 160, { s: 0.96, o: 0 });

/** Câu mới vào: 0,96 → 1 + hiện trong 200 ms. */
export const questionIn = (at: number) => track({ s: 0.96, o: 0 }).to(at, 200, { s: 1, o: 1 });

/**
 * Vật bay từ thẻ vào chỗ của nó (hạt vào chỗ trống, mảnh vào ô…): ẩn ở độ lệch `from` (so với chỗ
 * đích, cỡ `from.s`), hiện ngay lúc `at` rồi lướt về (0, 0) cỡ 1 trong `dur` ms (glide).
 */
export const flyIn = (at: number, from: { x: number; y: number; s: number }, dur = 320) =>
  track({ ...from, o: 0 })
    .jump(at, { o: 1 })
    .to(at + 1, dur, { x: 0, y: 0, s: 1 }, "glide");

/**
 * Bật/tắt nhiều lần (đèn, trống sáng, số trong ô tổng): mỗi khoảng `[bật, tắt?]` hiện ngay lúc bật,
 * mờ hết trong `out` ms bắt đầu lúc tắt (mặc định 1 ms = tắt ngay); thiếu mốc tắt thì giữ tới hết vòng.
 */
export function flashes(spans: readonly (readonly [on: number, off?: number])[], out = 1) {
  const t = track({ o: 0 });
  for (const [on, off] of spans) {
    t.jump(on, { o: 1 });
    if (off !== undefined) t.to(off, out, { o: 0 }, "linear");
  }
  return t;
}

/** Mờ cả sân khấu: vào 0–300, ra 300 ms bắt đầu lúc `T − 600` (giữ khung cuối, nghỉ 300). */
export function sceneTrack(T: number): Track {
  return track({ o: 0 })
    .fade(0, 300)
    .fade(T - 600, 300, 0)
    .build();
}

/** Ba mốc bắt đầu bước ①②③ (ms); bước ① luôn từ 0. */
export type StepStarts = readonly [0, number, number];

/** Số của huy hiệu bước: mờ chéo 150 ms khi sang bước. */
export function stepTracks([, two, three]: StepStarts): [Track, Track, Track] {
  return [
    track().fade(two, 150, 0).build(),
    track({ o: 0 }).fade(two, 150).fade(three, 150, 0).build(),
    track({ o: 0 }).fade(three, 150).build(),
  ];
}

/** Bước (1–3) đang hiện trên huy hiệu ở mốc `ms`. */
export function stepAt(starts: StepStarts, ms: number): 1 | 2 | 3 {
  if (ms >= starts[2]) return 3;
  if (ms >= starts[1]) return 2;
  return 1;
}

// ─── Con trỏ ─────────────────────────────────────────────────────────────────────────────────

/** Tay chờ ngoài sân khấu, góc dưới phải. */
export const HAND_OFF = { x: 700, y: 430 } as const;
/** Toạ độ tay = điểm chạm + (4, 6): đầu ngón trỏ chạm gần tâm vật. */
export const HAND_OFFSET = { x: 4, y: 6 } as const;

/** Một lần lướt tay: bắt đầu lúc `at`, mất `dur` ms, tới điểm chạm (x, y); `null` = rút ra ngoài. */
export type HandMove = readonly [at: number, dur: number, target: readonly [number, number] | null];

export interface HandScript {
  moves: readonly HandMove[];
  /** Mốc bắt đầu mỗi lần nhấn (cùng lúc sóng chạm). */
  taps: readonly number[];
  /** Ấn giữ (vuốt, giữ nút): nhấn lúc `press`, giữ nguyên, nhả lúc `release` (≥ press + 90). */
  holds?: readonly (readonly [press: number, release: number])[];
}

/** Ba làn của con trỏ: vị trí (`hand`), nhấn (`press`, chuột `pressMouse`) và bóng (`shadow`). */
export function handTracks({ moves, taps, holds = [] }: HandScript) {
  const hand = track(HAND_OFF);
  for (const [at, dur, target] of moves) {
    const to = target
      ? { x: target[0] + HAND_OFFSET.x, y: target[1] + HAND_OFFSET.y }
      : { x: HAND_OFF.x, y: HAND_OFF.y };
    hand.to(at, dur, to, "glide");
  }
  const press = track();
  const pressMouse = track();
  const shadow = track();
  // Một lần chạm = ấn giữ đúng 90 ms; gộp rồi xếp theo thời gian vì làn không được lùi.
  const presses = [...taps.map((at) => [at, at + 90] as const), ...holds].sort(
    (a, b) => a[0] - b[0],
  );
  for (const [at, release] of presses) {
    // Nhấn 90 ms (settle), giữ tới lúc nhả, bật lại 160 ms (pop); bóng sát lại (2, 3) và nhạt còn 45 %.
    press.to(at, 90, { s: 0.86 }).to(release, 160, { s: 1 }, "pop");
    pressMouse.to(at, 90, { s: 0.9 }).to(release, 160, { s: 1 }, "pop");
    shadow.to(at, 90, { x: -3, y: -4, o: 0.45 }).to(release, 160, { x: 0, y: 0, o: 1 });
  }
  return {
    hand: hand.build(),
    press: press.build(),
    pressMouse: pressMouse.build(),
    shadow: shadow.build(),
  };
}

// ─── Tra tư thế ──────────────────────────────────────────────────────────────────────────────

/** Hàm cubic-bezier(x1, y1, x2, y2): tiến độ thời gian 0–1 → tiến độ giá trị. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const xAt = (t: number) => ((ax * t + bx) * t + cx) * t;
  const yAt = (t: number) => ((ay * t + by) * t + cy) * t;
  const slope = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = xAt(t) - x;
      if (Math.abs(err) < 1e-7) return yAt(t);
      const d = slope(t);
      if (Math.abs(d) < 1e-7) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (hi - lo > 1e-7) {
      if (xAt(t) < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return yAt(t);
  };
}

const EASE_FN: Record<Ease, (p: number) => number> = {
  linear: (p) => p,
  glide: cubicBezier(...EASE_POINTS.glide),
  settle: cubicBezier(...EASE_POINTS.settle),
  pop: cubicBezier(...EASE_POINTS.pop),
};

/** Tư thế của làn ở mốc `ms` (trước mốc đầu = mốc đầu, sau mốc cuối = mốc cuối). */
export function sample(stops: Track, ms: number): Pose {
  const first = stops[0];
  if (!first) return REST;
  if (ms <= first.t) return first.pose;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i] as Stop;
    const b = stops[i + 1] as Stop;
    if (ms < b.t) {
      const k = EASE_FN[a.ease]((ms - a.t) / (b.t - a.t));
      const mix = (u: number, v: number) => u + (v - u) * k;
      return {
        x: mix(a.pose.x, b.pose.x),
        y: mix(a.pose.y, b.pose.y),
        r: mix(a.pose.r, b.pose.r),
        sx: mix(a.pose.sx, b.pose.sx),
        sy: mix(a.pose.sy, b.pose.sy),
        o: mix(a.pose.o, b.pose.o),
      };
    }
  }
  return (stops[stops.length - 1] as Stop).pose;
}

/** Tư thế của làn `lane` trong kịch bản ở mốc `ms`; thiếu làn thì ném lỗi (dùng trong test). */
export function poseAt(script: DemoScript, lane: string, ms: number): Pose {
  const stops = script.tracks[lane];
  if (!stops) throw new Error(`${script.id}: thiếu làn ${lane}`);
  return sample(stops, ms);
}

/** Vòng lặp thứ mấy (từ 0) và mốc trong vòng sau `elapsed` ms; `done` khi đã chạy đủ `loops` vòng. */
export function loopAt(elapsed: number, T: number, loops = Number.POSITIVE_INFINITY) {
  const total = loops * T;
  if (elapsed >= total) return { loop: loops - 1, ms: T, done: true };
  const loop = Math.floor(Math.max(0, elapsed) / T);
  return { loop, ms: Math.max(0, elapsed) - loop * T, done: false };
}

// ─── Sinh CSS ────────────────────────────────────────────────────────────────────────────────

const round = (n: number, digits: number) => Number(n.toFixed(digits));

const easeCss = (ease: Ease) =>
  ease === "linear" ? "linear" : `cubic-bezier(${EASE_POINTS[ease].join(",")})`;

/** Kiểm làn: mốc tăng dần, nằm trong [0, T]. Ném lỗi để bắt sai kịch bản ngay ở test. */
export function checkTrack(stops: Track, T: number, name = "track") {
  let prev = -1;
  for (const { t } of stops) {
    if (t < 0 || t > T) throw new Error(`${name}: mốc ${t} ms nằm ngoài vòng 0–${T} ms`);
    if (t <= prev) throw new Error(`${name}: mốc ${t} ms không tăng dần`);
    prev = t;
  }
}

/**
 * `@keyframes name{…}`: mỗi mốc một khung `%`, luôn đủ 0% và 100%, transform đủ 3 hàm theo cùng thứ
 * tự để trình duyệt nội suy từng thành phần. Đường cong ghi ở khung bắt đầu đoạn (như CSS).
 */
export function keyframesCss(name: string, stops: Track, T: number): string {
  checkTrack(stops, T, name);
  const all = [...stops];
  const last = all[all.length - 1];
  if (last && last.t < T) all.push({ t: T, pose: last.pose, ease: "linear" });
  const frames = all.map(({ t, pose, ease }) => {
    const pct = round((t / T) * 100, 3);
    const { x, y, r, sx, sy, o } = pose;
    return `${pct}%{transform:translate(${round(x, 2)}px,${round(y, 2)}px) rotate(${round(r, 2)}deg) scale(${round(sx, 3)},${round(sy, 3)});opacity:${round(o, 3)};animation-timing-function:${easeCss(ease)}}`;
  });
  return `@keyframes ${name}{${frames.join("")}}`;
}

/**
 * Tên làn khung tự dựng trong `defineScript`, game KHÔNG được đặt trùng (sẽ ném lỗi):
 * - `scene`: mờ vào/ra cả sân khấu;
 * - `s1`, `s2`, `s3`: số trên huy hiệu bước;
 * - `hand` (vị trí tay), `hp` / `hpm` (nhấn tay / chuột), `hs` (bóng tay): con trỏ, dựng từ `hand`.
 * Ấn giữ (vuốt, giữ nút) khai báo bằng `hand.holds`, không ghi đè `hp`/`hpm`/`hs`.
 */
export const RESERVED_LANES = ["scene", "s1", "s2", "s3", "hand", "hp", "hpm", "hs"] as const;

/** Kịch bản một game: vòng lặp T, mốc 3 bước và các làn (khoá = tên lớp `dk-<khoá>` trong JSX). */
export interface DemoScript {
  /**
   * Tiền tố ngắn, duy nhất giữa các game (tên keyframes `dk-<id>-<làn>`, thẻ `<style href="demo-<id>">`).
   * Không được là `base` (trùng `demo-base` của khung) và không là `<id khác>-…` để tên keyframes
   * hai game không thể trùng; test `demo-scripts.test.ts` kiểm cả 30 game.
   */
  id: string;
  T: number;
  steps: StepStarts;
  tracks: Readonly<Record<string, Track>>;
}

/**
 * Dựng kịch bản: thêm làn chung `scene` (mờ vào/ra), `s1`–`s3` (huy hiệu bước) và con trỏ
 * (`hand`, `hp`, `hpm`, `hs`) từ `hand`. Làn của game trùng tên dành sẵn (`RESERVED_LANES`)
 * thì ném lỗi.
 */
export function defineScript(script: {
  id: string;
  T: number;
  steps: StepStarts;
  hand?: HandScript;
  tracks: Record<string, TrackBuilder | Track>;
}): DemoScript {
  const [s1, s2, s3] = stepTracks(script.steps);
  const tracks: Record<string, Track> = { scene: sceneTrack(script.T), s1, s2, s3 };
  if (script.hand) {
    const h = handTracks(script.hand);
    Object.assign(tracks, { hand: h.hand, hp: h.press, hpm: h.pressMouse, hs: h.shadow });
  }
  for (const [key, value] of Object.entries(script.tracks)) {
    if ((RESERVED_LANES as readonly string[]).includes(key)) {
      throw new Error(`${script.id}: làn "${key}" là tên dành sẵn của khung diễn`);
    }
    tracks[key] = value instanceof TrackBuilder ? value.build() : value;
  }
  for (const [key, stops] of Object.entries(tracks)) checkTrack(stops, script.T, key);
  return { id: script.id, T: script.T, steps: script.steps, tracks };
}

/**
 * CSS của một kịch bản, gắn dưới gốc `.demo-<id>`: thời lượng chung T cho mọi `.dk`, tên keyframes
 * cho từng lớp `dk-<làn>`, rồi các @keyframes.
 */
export function scriptCss({ id, T, tracks }: DemoScript): string {
  const scope = `.demo-${id}`;
  const parts = [`${scope} .dk{animation-duration:${T}ms}`];
  for (const key of Object.keys(tracks)) {
    parts.push(`${scope} .dk-${key}{animation-name:dk-${id}-${key}}`);
  }
  for (const [key, stops] of Object.entries(tracks)) {
    parts.push(keyframesCss(`dk-${id}-${key}`, stops, T));
  }
  return parts.join("\n");
}
