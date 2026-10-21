/*
 * Vẽ hạt và nhãn chấm của Chuỗi quy luật bằng canvas 2D (gốc toạ độ ở tâm). Scene dùng để tạo
 * texture; hình minh hoạ (BeadPatternHowTo.tsx) vẽ cùng hình bằng SVG theo `beadShapePath`.
 *
 * - Hình (`shape`): 0 tròn, 1 vuông bo góc nhỏ, 2 tam giác đỉnh lên, 3 tim, 4 sao 5 cánh mập. Tách
 *   được bằng đường viền, màu chỉ là gợi ý phụ đi cùng hình.
 * - Hoa văn (`pattern`): 0 trơn (tô đặc), 1 sọc chéo 45°, 2 ca-rô (bàn cờ). Sọc / ca-rô là mực phủ
 *   mờ lên màu hạt nên thành màu sẫm hơn của chính hạt. Không vẽ "chấm" để không lẫn với nhãn chấm.
 * - Số chấm: nhãn vuông riêng, chấm xếp như mặt xúc xắc trong lưới 3 × 3, không dùng chữ số.
 */

type Ctx = CanvasRenderingContext2D;

/** Độ đậm của mực phủ cho sọc / ca-rô. */
export const PATTERN_ALPHA = 0.4;

/** Hình chữ nhật bo góc (dùng chung cho Path2D và context). */
export function roundRectPath(
  p: CanvasPath,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  p.moveTo(x + r, y);
  p.arcTo(x + w, y, x + w, y + h, r);
  p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r);
  p.arcTo(x, y, x + w, y, r);
  p.closePath();
}

/**
 * Đường viền SVG của hình hạt cỡ `size` (Ø), tâm (0, 0). Các hình được chỉnh cho cùng "độ nặng"
 * nhìn thấy (vuông nhỏ hơn tròn một chút, tam giác và sao dời xuống cho cân).
 */
export function beadShapePath(shape: number, size: number): string {
  const r = size / 2;
  const f = (v: number) => (v * r).toFixed(2);
  switch (shape) {
    case 1: {
      // Vuông bo góc nhỏ.
      const h = 0.82;
      const k = 0.2;
      return [
        `M${f(-h + k)} ${f(-h)}`,
        `L${f(h - k)} ${f(-h)} Q${f(h)} ${f(-h)} ${f(h)} ${f(-h + k)}`,
        `L${f(h)} ${f(h - k)} Q${f(h)} ${f(h)} ${f(h - k)} ${f(h)}`,
        `L${f(-h + k)} ${f(h)} Q${f(-h)} ${f(h)} ${f(-h)} ${f(h - k)}`,
        `L${f(-h)} ${f(-h + k)} Q${f(-h)} ${f(-h)} ${f(-h + k)} ${f(-h)} Z`,
      ].join(" ");
    }
    case 2: {
      // Tam giác đỉnh lên, góc bo nhẹ.
      const pts: [number, number][] = [
        [0, -0.98],
        [1.06, 0.84],
        [-1.06, 0.84],
      ];
      return roundedPolygon(pts, 0.16, f);
    }
    case 3:
      // Tim: hai thuỳ trên, mũi nhọn dưới.
      return [
        `M0 ${f(0.92)}`,
        `C${f(-0.5)} ${f(0.56)} ${f(-1.02)} ${f(0.14)} ${f(-1)} ${f(-0.32)}`,
        `C${f(-0.98)} ${f(-0.8)} ${f(-0.42)} ${f(-1.02)} 0 ${f(-0.56)}`,
        `C${f(0.42)} ${f(-1.02)} ${f(0.98)} ${f(-0.8)} ${f(1)} ${f(-0.32)}`,
        `C${f(1.02)} ${f(0.14)} ${f(0.5)} ${f(0.56)} 0 ${f(0.92)} Z`,
      ].join(" ");
    case 4: {
      // Sao 5 cánh mập (bán kính trong 0,56), dời xuống 0,08 cho cân.
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? 1.04 : 0.56;
        pts.push([rr * Math.cos(a), rr * Math.sin(a) + 0.08]);
      }
      return roundedPolygon(pts, 0.1, f);
    }
    default:
      return `M${f(0.96)} 0 A${f(0.96)} ${f(0.96)} 0 1 1 ${f(-0.96)} 0 A${f(0.96)} ${f(0.96)} 0 1 1 ${f(0.96)} 0 Z`;
  }
}

/** Đa giác bo góc: mỗi đỉnh thay bằng một đường cong bậc hai qua đỉnh, cắt `k` (theo bán kính). */
function roundedPolygon(pts: [number, number][], k: number, f: (v: number) => string): string {
  const n = pts.length;
  const toward = (a: [number, number], b: [number, number]): [number, number] => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    const t = Math.min(k / len, 0.5);
    return [a[0] + dx * t, a[1] + dy * t];
  };
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i + n - 1) % n] as [number, number];
    const cur = pts[i] as [number, number];
    const next = pts[(i + 1) % n] as [number, number];
    const a = toward(cur, prev);
    const b = toward(cur, next);
    parts.push(`${i === 0 ? "M" : "L"}${f(a[0])} ${f(a[1])}`);
    parts.push(`Q${f(cur[0])} ${f(cur[1])} ${f(b[0])} ${f(b[1])}`);
  }
  parts.push("Z");
  return parts.join(" ");
}

/** Màu vẽ hạt: màu theo hình, mực cho hoa văn, viền (phấn trên bảng, chữ thẻ trên thẻ). */
export interface BeadPaint {
  /** Màu theo `shape` (0–4). */
  fills: readonly string[];
  ink: string;
  outline: string;
  outlineWidth: number;
}

/** Vẽ một hạt cỡ `size` (Ø) tại tâm. */
export function drawBead(ctx: Ctx, shape: number, pattern: number, size: number, paint: BeadPaint) {
  const path = new Path2D(beadShapePath(shape, size));
  ctx.fillStyle = paint.fills[shape] ?? paint.fills[0] ?? "#ffffff";
  ctx.fill(path);
  if (pattern > 0) {
    ctx.save();
    ctx.clip(path);
    ctx.globalAlpha = PATTERN_ALPHA;
    ctx.fillStyle = paint.ink;
    if (pattern === 1) drawStripes(ctx, size);
    else drawChecker(ctx, size);
    ctx.restore();
  }
  ctx.lineWidth = paint.outlineWidth;
  ctx.lineJoin = "round";
  ctx.strokeStyle = paint.outline;
  ctx.stroke(path);
}

/** Sọc chéo 45° (3–4 sọc thấy được trên thân hạt), sọc giữa đi qua tâm. */
function drawStripes(ctx: Ctx, size: number) {
  const period = size * STRIPE.period;
  const width = period * STRIPE.width;
  ctx.save();
  ctx.rotate(-Math.PI / 4);
  for (let i = -3; i <= 3; i++) ctx.fillRect(i * period - width / 2, -size, width, size * 2);
  ctx.restore();
}

/** Ca-rô kiểu bàn cờ 5 × 5 ô theo cỡ hạt, ô giữa tô. */
function drawChecker(ctx: Ctx, size: number) {
  const cell = size / CHECKER_CELLS;
  for (let row = -3; row <= 3; row++) {
    for (let col = -3; col <= 3; col++) {
      if ((row + col) % 2 !== 0) continue;
      ctx.fillRect(col * cell - cell / 2, row * cell - cell / 2, cell, cell);
    }
  }
}

/** Nhịp sọc (theo Ø hạt) và bề rộng sọc (theo nhịp). Dùng chung với hình minh hoạ. */
export const STRIPE = { period: 0.3, width: 0.48 } as const;
/** Số ô ca-rô theo Ø hạt. */
export const CHECKER_CELLS = 5;

/**
 * Vị trí chấm trong lưới 3 × 3 (cột, hàng ∈ −1…1) theo mặt xúc xắc: 1–6 như xúc xắc quen thuộc,
 * 7 = 6 + giữa, 8 = đủ lưới bỏ giữa, 9 = đủ lưới.
 */
export const DIE_LAYOUT: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  1: [[0, 0]],
  2: [
    [-1, -1],
    [1, 1],
  ],
  3: [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  4: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ],
  5: [
    [-1, -1],
    [1, -1],
    [0, 0],
    [-1, 1],
    [1, 1],
  ],
  6: [
    [-1, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [1, 1],
  ],
  7: [
    [-1, -1],
    [1, -1],
    [-1, 0],
    [0, 0],
    [1, 0],
    [-1, 1],
    [1, 1],
  ],
  8: [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ],
  9: [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [0, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ],
};

export interface DiceLabelStyle {
  size: number;
  radius: number;
  /** Bán kính mỗi chấm. */
  dot: number;
  /** Khoảng cách giữa hai cột / hàng chấm. */
  gap: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  dotColor: string;
}

/** Nhãn vuông bo góc có `dots` chấm kiểu mặt xúc xắc, tâm (0, 0). */
export function drawDiceLabel(ctx: Ctx, dots: number, style: DiceLabelStyle) {
  const s = style.size;
  const path = new Path2D();
  roundRectPath(path, -s / 2, -s / 2, s, s, style.radius);
  ctx.fillStyle = style.fill;
  ctx.fill(path);
  ctx.lineWidth = style.strokeWidth;
  ctx.strokeStyle = style.stroke;
  ctx.stroke(path);
  ctx.fillStyle = style.dotColor;
  for (const [col, row] of DIE_LAYOUT[dots] ?? []) {
    ctx.beginPath();
    ctx.arc(col * style.gap, row * style.gap, style.dot, 0, Math.PI * 2);
    ctx.fill();
  }
}
