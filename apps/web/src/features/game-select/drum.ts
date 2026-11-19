/**
 * Trống quay dọc (CR-017, ui-ux 6.7): hình học và chuyển động, hàm thuần có test (`drum.test.ts`).
 *
 * Vị trí `pos` là số thực đo bằng dòng: dòng thứ `k` (số nguyên, lặp vô hạn quanh danh sách N
 * game, game `k mod N`) nằm ở giữa dải chọn khi `pos = k`. Mọi máy tính `pos` từ giờ server nên
 * cùng hình: chờ quay thì trôi đều, đang quay thì chậm dần (easeOutQuart) tới đúng game server chọn.
 */

/** Góc giữa hai dòng liền nhau trên mặt trống (độ). */
export const DRUM_STEP_DEG = 20;
/** Chỉ vẽ dòng có |θ| ≤ 80° (khoảng 9 dòng), ngoài ra đã quay ra sau trống. */
export const DRUM_MAX_DEG = 80;
/** Chờ quay: trôi đều 0,8 dòng/giây, tức 1 dòng mỗi 1.250 ms. */
export const DRUM_IDLE_MS_PER_ROW = 1_250;
/** Quãng quay tối thiểu (dòng): quãng thật 45 → 45 + N − 1 dòng. */
export const DRUM_MIN_SPIN_ROWS = 45;
/** Lớp trong dải chọn chỉ chép các dòng lệch tâm dưới ngần này dòng. */
export const DRUM_BAND_ROWS = 1.3;
/** Nhoè theo tốc độ (dòng/giây): từ 25 → 2,5 px, từ 10 → 1,2 px, dưới 10 → 0. Dải chọn tối đa 1,2 px. */
export const DRUM_BLUR_STEPS = [
  { speed: 25, px: 2.5 },
  { speed: 10, px: 1.2 },
] as const;
export const DRUM_BAND_MAX_BLUR = 1.2;

const RAD = Math.PI / 180;

/** Chia lấy dư luôn không âm (dòng âm vẫn ra game hợp lệ). */
export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** Bán kính trụ (px): mỗi dòng chiếm đúng `rowHeight` trên cung 20° → 183 px (dòng 64), 149 px (dòng 52). */
export function drumRadius(rowHeight: number): number {
  return rowHeight / (DRUM_STEP_DEG * RAD);
}

export interface DrumRow {
  /** Số thứ tự dòng trên trống (khoá React, không trùng). */
  key: number;
  /** Vị trí game trong danh sách (`key mod N`). */
  index: number;
  /** Lệch so với tâm dải chọn, tính bằng dòng (âm = phía trên). */
  d: number;
  /** Góc trên trụ θ = 20°·d. */
  deg: number;
  /** Lệch dọc của tâm dòng so với tâm trống (px): R·sin θ. */
  y: number;
  /** Mờ dần về mép: cos(θ)^1,5 → ±1: 0,91 · ±2: 0,67 · ±3: 0,35. */
  opacity: number;
}

/** Các dòng nhìn thấy ở vị trí `pos` (từ trên xuống), trống có `count` game, cao dòng `rowHeight`. */
export function drumRows(pos: number, count: number, rowHeight: number): DrumRow[] {
  if (count <= 0 || !Number.isFinite(pos)) return [];
  const reach = DRUM_MAX_DEG / DRUM_STEP_DEG;
  const radius = drumRadius(rowHeight);
  const rows: DrumRow[] = [];
  for (let k = Math.ceil(pos - reach); k <= Math.floor(pos + reach); k++) {
    const d = k - pos;
    const deg = d * DRUM_STEP_DEG;
    const rad = deg * RAD;
    rows.push({
      key: k,
      index: mod(k, count),
      d,
      deg,
      y: radius * Math.sin(rad),
      opacity: Math.max(0, Math.cos(rad)) ** 1.5,
    });
  }
  return rows;
}

/** Chờ quay: `pos` theo giờ server, mọi máy cùng hình. */
export function idlePos(serverNow: number, count: number): number {
  return count > 0 ? mod(serverNow / DRUM_IDLE_MS_PER_ROW, count) : 0;
}

/**
 * Điểm dừng: số nhỏ nhất dạng `k·N + target` mà ≥ `start + 45`, nên game ở giữa dải lúc dừng đúng
 * là `target` và quãng quay luôn trong [45, 45 + N).
 */
export function spinEnd(start: number, target: number, count: number): number {
  if (count <= 0) return start;
  const min = start + DRUM_MIN_SPIN_ROWS;
  return Math.ceil((min - target) / count) * count + target;
}

/** Chậm dần về cuối như bánh xe thật; CSS gần đúng `cubic-bezier(.25,1,.5,1)`. */
export function easeOutQuart(p: number): number {
  return 1 - (1 - p) ** 4;
}

/** Tốc độ (dòng/giây) ở tiến độ `p` của một lần quay `spinMs` từ `start` tới `end`. */
export function spinSpeed(start: number, end: number, p: number, spinMs: number): number {
  const q = Math.min(1, Math.max(0, p));
  return ((end - start) * 4 * (1 - q) ** 3) / Math.max(0.001, spinMs / 1000);
}

/** Độ nhoè (px) theo tốc độ, đổi theo bậc. */
export function blurForSpeed(speed: number): number {
  for (const step of DRUM_BLUR_STEPS) if (speed >= step.speed) return step.px;
  return 0;
}

export type DrumPhase = "idle" | "spinning" | "landed";

export interface DrumFrameInput {
  /** Giờ server bắt đầu quay (0 = chưa quay). */
  spinAt: number;
  spinMs: number;
  /** Số game trên trống. */
  count: number;
  /** Vị trí game server chọn trong danh sách (`wheelSlices`). */
  target: number;
  /** Giảm chuyển động: trống đứng yên, tới giờ thì nhảy thẳng tới game trúng. */
  reduced: boolean;
}

export interface DrumFrame {
  phase: DrumPhase;
  pos: number;
  /** Nhoè của lớp dòng (px); dải chọn dùng `min(blur, 1,2)`. */
  blur: number;
}

/**
 * Trạng thái trống ở giờ server `now`. Vào lại phòng giữa chừng cũng tính ra đúng chỗ đang quay;
 * đã quay xong thì ra thẳng game trúng. Trước `spinAt` (server hẹn trước 300 ms) trống vẫn trôi
 * đều, nên lúc bắt đầu quay không bị giật.
 */
export function drumFrame(now: number, input: DrumFrameInput): DrumFrame {
  const { spinAt, spinMs, count, target, reduced } = input;
  if (!spinAt) return { phase: "idle", pos: reduced ? 0 : idlePos(now, count), blur: 0 };
  const p = (now - spinAt) / Math.max(1, spinMs);
  if (reduced) {
    return p >= 1
      ? { phase: "landed", pos: target, blur: 0 }
      : { phase: "spinning", pos: 0, blur: 0 };
  }
  const start = idlePos(spinAt, count);
  const end = spinEnd(start, target, count);
  if (p >= 1) return { phase: "landed", pos: end, blur: 0 };
  if (p <= 0) return { phase: "spinning", pos: idlePos(now, count), blur: 0 };
  return {
    phase: "spinning",
    pos: start + (end - start) * easeOutQuart(p),
    blur: blurForSpeed(spinSpeed(start, end, p, spinMs)),
  };
}

/** Dòng nằm giữa dải chọn (đổi số này = một dòng vừa đi qua kim, phát tiếng tick). */
export function centerRow(pos: number): number {
  return Math.floor(pos + 0.5);
}
