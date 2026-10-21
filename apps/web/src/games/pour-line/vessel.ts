import { POUR_LINE_HEIGHT, POUR_LINE_SLICE_H, POUR_LINE_SLICES } from "@brain-rizz/shared";

/*
 * Đổi mô hình bình của Rót vừa vạch (mức nước 0 … 1 000, 40 lát bề rộng nguyên) sang px trong
 * khung 720×1280, theo bảng bố cục ở mục "Ghi chú cho FE" của docs/04-minigames/pour-line.md.
 * Chỉ để vẽ: mức nước luôn tính bằng `pourLineLevelAt` của shared, không tính lại ở đây.
 */

/** Trục giữa bình, miệng bình (mức 1 000) và đáy bình (mức 0), px thiết kế. */
export const VESSEL = { cx: 360, top: 360, bottom: 1000 } as const;

/** 640 px cho 1 000 đơn vị mức nước. */
export const PX_PER_LEVEL = (VESSEL.bottom - VESSEL.top) / POUR_LINE_HEIGHT;

/** Nửa bề rộng: 360 px cho 1 000 đơn vị bề rộng, chia đôi = 0,18 px mỗi đơn vị. */
export const HALF_PX_PER_WIDTH = 0.18;

export interface Point {
  x: number;
  y: number;
}

/** Mức nước → y (px thiết kế, hướng xuống). */
export function levelY(level: number): number {
  return VESSEL.bottom - PX_PER_LEVEL * level;
}

/**
 * Nửa bề rộng lòng bình (px) tại mức `level`: lát `i` có tâm ở mức `25·i + 12,5`, nội suy tuyến
 * tính giữa tâm hai lát kề nhau; dưới tâm lát đầu và trên tâm lát cuối thì giữ bề rộng lát đó
 * (viền kéo thẳng xuống đáy và lên miệng).
 */
export function halfWidthAt(vessel: readonly number[], level: number): number {
  const last = Math.min(vessel.length, POUR_LINE_SLICES) - 1;
  const s = (level - POUR_LINE_SLICE_H / 2) / POUR_LINE_SLICE_H;
  if (last < 0) return 0;
  if (s <= 0) return HALF_PX_PER_WIDTH * (vessel[0] as number);
  if (s >= last) return HALF_PX_PER_WIDTH * (vessel[last] as number);
  const i = Math.floor(s);
  const a = vessel[i] as number;
  const b = vessel[i + 1] as number;
  return HALF_PX_PER_WIDTH * (a + (b - a) * (s - i));
}

/** Các mức cần lấy điểm trên viền trong khoảng [from, to]: hai đầu và tâm các lát nằm giữa. */
function sampleLevels(from: number, to: number): number[] {
  const levels = [from];
  for (let i = 0; i < POUR_LINE_SLICES; i++) {
    const c = POUR_LINE_SLICE_H * i + POUR_LINE_SLICE_H / 2;
    if (c > from && c < to) levels.push(c);
  }
  if (to > from) levels.push(to);
  return levels;
}

/** Một bên viền bình (`side` −1 = trái, 1 = phải) từ mức `from` lên mức `to`. */
export function wallPoints(
  vessel: readonly number[],
  side: -1 | 1,
  from = 0,
  to = POUR_LINE_HEIGHT,
): Point[] {
  return sampleLevels(from, to).map((level) => ({
    x: VESSEL.cx + side * halfWidthAt(vessel, level),
    y: levelY(level),
  }));
}

/**
 * Đa giác lòng bình giữa hai mức (px): bên trái từ dưới lên, rồi bên phải từ trên xuống. Dùng tô
 * nước (0 → mức nước), dải vạch (target ± tol) và khăn che (hideFrom → miệng).
 */
export function sectionPoints(vessel: readonly number[], from: number, to: number): Point[] {
  const lo = Math.max(0, Math.min(from, to));
  const hi = Math.min(POUR_LINE_HEIGHT, Math.max(from, to));
  const left = wallPoints(vessel, -1, lo, hi);
  const right = wallPoints(vessel, 1, lo, hi).reverse();
  return [...left, ...right];
}
