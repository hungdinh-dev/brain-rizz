import { peekAudioContext } from "@/lib/audio-context";
import type { SfxKind } from "./kinds";
import { recipeFor } from "./recipes";
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

function playBuffer(ctx: AudioContext, out: AudioNode, buffer: AudioBuffer, accent: boolean) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  if (accent) source.playbackRate.value = ACCENT_RATE;
  source.connect(out);
  source.start();
}

function playSynth(ctx: AudioContext, out: AudioNode, kind: SfxKind, accent: boolean) {
  const t0 = ctx.currentTime + 0.005;
  for (const tone of recipeFor(kind, accent)) {
    const start = t0 + tone.start;
    const end = start + tone.dur;
    const osc = ctx.createOscillator();
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.freq, start);
    if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, end);
    // Đường bao: lên nhanh 5 ms rồi tắt dần (ramp mũ không được về đúng 0 → 0,0001).
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(tone.peak, start + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(env);
    env.connect(out);
    osc.start(start);
    osc.stop(end + 0.02);
  }
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
}

/** Phát một tiếng hiệu ứng. Không bao giờ ném lỗi. */
export function playSfx(kind: SfxKind, options: PlaySfxOptions = {}) {
  if (!useSfx.getState().enabled) return;
  const ctx = peekAudioContext();
  // Context chưa chạy thì không xếp tiếng (thời gian đứng yên → mở khoá xong sẽ kêu dồn một lượt).
  if (ctx?.state !== "running") return;
  try {
    loadFiles(ctx);
    const out = masterOf(ctx);
    const accent = options.accent === true;
    const buffer = buffers.get(kind);
    if (buffer) playBuffer(ctx, out, buffer, accent);
    else playSynth(ctx, out, kind, accent);
  } catch {
    /* im lặng: âm thanh không được làm vỡ app */
  }
}
