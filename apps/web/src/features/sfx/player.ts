import { peekAudioContext } from "@/lib/audio-context";
import type { SfxKind } from "./kinds";
import { isNoise, recipeFor, type Voice, voiceEnd } from "./recipes";
import { SFX_VOLUME } from "./settings";
import { useSfx } from "./sfx.store";
import { SFX_URLS } from "./sfx-files";

/**
 * Phát âm thanh hiệu ứng qua AudioContext chung của app: file trong `src/assets/sfx/` nếu có
 * (tải + giải mã một lần, giữ AudioBuffer), không thì tiếng tổng hợp (`recipes.ts`).
 * Chưa mở khoá âm thanh (chưa có thao tác người chơi), đã tắt, hay trình duyệt không có Web Audio → im.
 */

/** Gain riêng của sfx (âm lượng cố định), nối thẳng ra loa — không đi qua gain nhạc nền. */
let master: GainNode | null = null;
/** AudioBuffer đã giải mã; null = tải/giải mã lỗi → dùng tiếng tổng hợp. */
const buffers = new Map<SfxKind, AudioBuffer | null>();
let loadStarted = false;

/** Tỉ lệ cao độ cho tiếng nhấn khi phát từ file (giây cuối đếm ngược). */
const ACCENT_RATE = 1.25;

function masterOf(ctx: AudioContext): GainNode {
  if (master) return master;
  master = ctx.createGain();
  master.gain.value = SFX_VOLUME;
  master.connect(ctx.destination);
  return master;
}

/** Tải + giải mã mọi file sfx có sẵn, mỗi file một lần; lỗi thì loại đó dùng tiếng tổng hợp. */
function loadFiles(ctx: AudioContext) {
  if (loadStarted) return;
  loadStarted = true;
  for (const [kind, url] of Object.entries(SFX_URLS) as [SfxKind, string][]) {
    fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
      .then((data) => ctx.decodeAudioData(data))
      .then(
        (buffer) => void buffers.set(kind, buffer),
        () => void buffers.set(kind, null),
      );
  }
}

/** Các nguồn âm của một lần phát — để dừng sớm (vd. rời màn vinh danh giữa tiếng trống). */
type Sources = AudioScheduledSourceNode[];

function playBuffer(
  ctx: AudioContext,
  out: AudioNode,
  buffer: AudioBuffer,
  accent: boolean,
  sources: Sources,
  when: number | undefined,
) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  if (accent) source.playbackRate.value = ACCENT_RATE;
  source.connect(out);
  // Mốc đã qua → Web Audio phát ngay.
  if (when === undefined) source.start();
  else source.start(Math.max(0, when));
  sources.push(source);
}

/** Nhiễu trắng 1 giây dùng chung cho mọi tiếng trống/xèng (tạo một lần). */
let noiseBuffer: AudioBuffer | null = null;
function noiseOf(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Chỉ là tiếng nhiễu trang trí, không phải logic câu đố (bất biến 1 không áp dụng).
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

/** Đường bao âm lượng (ramp mũ không được về đúng 0 → 0,0001). */
function envelope(ctx: AudioContext, voice: Voice, start: number): GainNode {
  const env = ctx.createGain();
  const g = env.gain;
  const attack = voice.attack ?? 0.005;
  const end = start + voice.dur;
  const shape = isNoise(voice) ? "decay" : (voice.envelope ?? "decay");
  g.setValueAtTime(0.0001, start);
  if (shape === "swell") {
    g.linearRampToValueAtTime(voice.peak, end);
    g.linearRampToValueAtTime(0.0001, end + (isNoise(voice) ? 0 : (voice.release ?? 0.03)));
  } else if (shape === "hold") {
    g.linearRampToValueAtTime(voice.peak, start + attack);
    g.setValueAtTime(voice.peak, end);
    g.exponentialRampToValueAtTime(0.0001, end + (isNoise(voice) ? 0 : (voice.release ?? 0.1)));
  } else {
    g.linearRampToValueAtTime(voice.peak, start + attack);
    g.exponentialRampToValueAtTime(0.0001, end);
  }
  return env;
}

function playVoice(ctx: AudioContext, out: AudioNode, voice: Voice, t0: number, sources: Sources) {
  const start = t0 + voice.start;
  const stopAt = t0 + voiceEnd(voice) + 0.02;
  const env = envelope(ctx, voice, start);
  env.connect(out);

  if (isNoise(voice)) {
    const src = ctx.createBufferSource();
    src.buffer = noiseOf(ctx);
    let node: AudioNode = src;
    for (const f of voice.filters) {
      const filter = ctx.createBiquadFilter();
      filter.type = f.type;
      filter.frequency.value = f.freq;
      if (f.q !== undefined) filter.Q.value = f.q;
      node.connect(filter);
      node = filter;
    }
    node.connect(env);
    // Mỗi tiếng gõ bắt đầu ở một chỗ khác trong bộ nhiễu để nghe không lặp.
    src.start(start, (voice.start * 7.3) % 0.8);
    src.stop(stopAt);
    sources.push(src);
    return;
  }

  const osc = ctx.createOscillator();
  osc.type = voice.type;
  osc.frequency.setValueAtTime(voice.freq, start);
  if (voice.to) osc.frequency.exponentialRampToValueAtTime(voice.to, start + voice.dur);
  if (voice.detune) osc.detune.value = voice.detune;
  osc.start(start);
  osc.stop(stopAt);
  sources.push(osc);

  if (voice.vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = voice.vibrato.rate;
    depth.gain.value = voice.vibrato.cents;
    lfo.connect(depth);
    depth.connect(osc.detune);
    lfo.start(start + Math.max(0, voice.vibrato.after));
    lfo.stop(stopAt);
    sources.push(lfo);
  }

  let node: AudioNode = osc;
  if (voice.lowpass) {
    const lp = ctx.createBiquadFilter();
    const { from, peak, rise, settle } = voice.lowpass;
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(from, start);
    lp.frequency.linearRampToValueAtTime(peak, start + rise);
    lp.frequency.linearRampToValueAtTime(settle, start + rise + 0.12);
    node.connect(lp);
    node = lp;
  }

  if (voice.tremolo) {
    // Gain trung gian dao động quanh (1 − depth/2) ± depth/2.
    const trem = ctx.createGain();
    trem.gain.value = 1 - voice.tremolo.depth / 2;
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = voice.tremolo.rate;
    depth.gain.value = voice.tremolo.depth / 2;
    lfo.connect(depth);
    depth.connect(trem.gain);
    lfo.start(start);
    lfo.stop(stopAt);
    sources.push(lfo);
    node.connect(trem);
    node = trem;
  }
  node.connect(env);
}

function playSynth(
  ctx: AudioContext,
  out: AudioNode,
  kind: SfxKind,
  accent: boolean,
  sources: Sources,
  when: number | undefined,
) {
  // Không có `when` (hay mốc đã qua): phát ngay như trước.
  const t0 = Math.max(ctx.currentTime + 0.005, when ?? 0);
  for (const voice of recipeFor(kind, accent)) playVoice(ctx, out, voice, t0, sources);
}

/**
 * Tải trước file sfx ngay khi âm thanh vừa được mở khoá lần đầu, để tiếng đầu tiên đã là file
 * (không phải chờ tới lần phát đầu). Chưa có context thì thôi; lỗi mạng/giải mã thì bỏ qua.
 */
export function preloadSfx() {
  const ctx = peekAudioContext();
  if (!ctx) return;
  try {
    loadFiles(ctx);
  } catch {
    /* bỏ qua */
  }
}

export interface PlaySfxOptions {
  /** Tiếng nhấn (chỉ có ý nghĩa với `tick`: giây cuối đếm ngược). */
  accent?: boolean;
  /** Nhân âm lượng của riêng lần phát này (0–1), vd. tiếng tick nhỏ hơn ở màn vinh danh. */
  volume?: number;
  /**
   * Mốc phát theo đồng hồ AudioContext (giây, cùng gốc với `sfxNow()`). Dùng để xếp lịch trước
   * cả một chuỗi tiếng cho đúng nhịp (câu trống Nhại nhịp) thay vì gọi từng tiếng theo hẹn giờ
   * khung hình (lệch ±16 ms). Bỏ trống hoặc mốc đã qua → phát ngay.
   */
  when?: number;
}

/**
 * Giờ hiện tại của đồng hồ âm thanh (giây, `AudioContext.currentTime`) làm gốc cho `when`.
 * `null` khi lúc này không phát được (đã tắt sfx, chưa mở khoá, không có Web Audio): nơi gọi chỉ
 * chạy phần hình.
 */
export function sfxNow(): number | null {
  if (!useSfx.getState().enabled) return null;
  const ctx = peekAudioContext();
  return ctx?.state === "running" ? ctx.currentTime : null;
}

/** Dừng một tiếng đang phát (tắt nhanh ~30 ms). Gọi nhiều lần hay khi đã hết tiếng đều vô hại. */
export type StopSfx = () => void;

const noop: StopSfx = () => {};

/** Phát một tiếng hiệu ứng, trả hàm dừng sớm. Không bao giờ ném lỗi. */
export function playSfx(kind: SfxKind, options: PlaySfxOptions = {}): StopSfx {
  if (!useSfx.getState().enabled) return noop;
  const ctx = peekAudioContext();
  // Context chưa chạy thì không xếp tiếng (thời gian đứng yên → mở khoá xong sẽ kêu dồn một lượt).
  if (ctx?.state !== "running") return noop;
  try {
    loadFiles(ctx);
    // Mỗi lần phát qua một gain riêng: chỉnh âm lượng lần này và tắt gọn khi dừng sớm.
    const bus = ctx.createGain();
    bus.gain.value = Math.min(1, Math.max(0, options.volume ?? 1));
    bus.connect(masterOf(ctx));
    const sources: Sources = [];
    const accent = options.accent === true;
    const buffer = buffers.get(kind);
    if (buffer) playBuffer(ctx, bus, buffer, accent, sources, options.when);
    else playSynth(ctx, bus, kind, accent, sources, options.when);
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      try {
        const now = ctx.currentTime;
        bus.gain.cancelScheduledValues(now);
        bus.gain.setValueAtTime(bus.gain.value, now);
        bus.gain.linearRampToValueAtTime(0, now + 0.03);
        for (const s of sources) {
          try {
            s.stop(now + 0.05);
          } catch {
            /* nguồn đã dừng */
          }
        }
      } catch {
        /* đã dừng rồi */
      }
    };
  } catch {
    /* im lặng: âm thanh không được làm vỡ app */
    return noop;
  }
}
