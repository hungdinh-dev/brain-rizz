/**
 * Hình của Tráo cốc dùng chung cho scene (canvas 2D → texture) và hình minh hoạ màn Hướng dẫn
 * (SVG): đường vẽ theo cú pháp SVG path, gốc (0, 0) ở giữa mép dưới của hình (đứng trên mặt bàn).
 */

type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------- cốc úp

/** Chiều cao vành dưới của cốc. */
export const cupRimHeight = (h: number) => Math.round(h * 0.13);

/** Dải ngang trên thân cốc: [y trên, y dưới]. */
export const cupBand = (h: number): [number, number] => [-h * 0.64, -h * 0.5];

/** Thân cốc úp (hình thang, đáy cốc bo góc ở trên), rộng `w` ở vành, cao `h`. */
export function cupBodyPath(w: number, h: number): string {
  const y0 = -cupRimHeight(h) + 1;
  const bottom = w * 0.45;
  const top = w * 0.31;
  const r = w * 0.07;
  return [
    `M${-bottom} ${y0}`,
    `L${-top} ${-h + r}`,
    `Q${-top} ${-h} ${-top + r} ${-h}`,
    `L${top - r} ${-h}`,
    `Q${top} ${-h} ${top} ${-h + r}`,
    `L${bottom} ${y0}Z`,
  ].join(" ");
}

/** Hình chữ nhật bo góc (SVG path), góc trên trái (x, y). */
export function roundRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const k = Math.min(r, w / 2, h / 2);
  return [
    `M${x + k} ${y}`,
    `L${x + w - k} ${y}`,
    `Q${x + w} ${y} ${x + w} ${y + k}`,
    `L${x + w} ${y + h - k}`,
    `Q${x + w} ${y + h} ${x + w - k} ${y + h}`,
    `L${x + k} ${y + h}`,
    `Q${x} ${y + h} ${x} ${y + h - k}`,
    `L${x} ${y + k}`,
    `Q${x} ${y} ${x + k} ${y}Z`,
  ].join(" ");
}

/** Dải ngang trên thân cốc dưới dạng hình thang nằm gọn trong thân (dùng cho SVG). */
export function cupBandPath(w: number, h: number): string {
  const yBottom = -cupRimHeight(h) + 1;
  const yTop = -h + w * 0.07;
  const half = (y: number) => w * 0.45 + (w * 0.31 - w * 0.45) * ((yBottom - y) / (yBottom - yTop));
  const [y0, y1] = cupBand(h);
  return `M${-half(y0)} ${y0} L${half(y0)} ${y0} L${half(y1)} ${y1} L${-half(y1)} ${y1}Z`;
}

/** Vành dưới của cốc. */
export function cupRimPath(w: number, h: number): string {
  const rim = cupRimHeight(h);
  return roundRectPath(-w / 2, -rim, w, rim, rim / 2);
}

export interface CupColors {
  body: string;
  line: string;
  /** Dải ngang trên thân. */
  band: string;
  /** Lớp tô nửa phải tạo khối. */
  shade: string;
  shadeAlpha: number;
}

/** Vẽ cốc úp, gốc (0, 0) ở giữa mép dưới. Mọi cốc giống hệt nhau (không màu, số hay vết riêng). */
export function drawCup(ctx: Ctx, w: number, h: number, line: number, colors: CupColors) {
  const body = new Path2D(cupBodyPath(w, h));
  ctx.fillStyle = colors.body;
  ctx.fill(body);

  ctx.save();
  ctx.clip(body);
  const [b0, b1] = cupBand(h);
  ctx.fillStyle = colors.band;
  ctx.fillRect(-w, b0, 2 * w, b1 - b0);
  ctx.globalAlpha = colors.shadeAlpha;
  ctx.fillStyle = colors.shade;
  ctx.fillRect(w * 0.14, -h, w, h);
  ctx.globalAlpha = 1;
  ctx.lineWidth = line * 0.6;
  ctx.strokeStyle = colors.line;
  ctx.beginPath();
  ctx.moveTo(-w, b0);
  ctx.lineTo(w, b0);
  ctx.moveTo(-w, b1);
  ctx.lineTo(w, b1);
  ctx.stroke();
  ctx.restore();

  ctx.lineWidth = line;
  ctx.strokeStyle = colors.line;
  ctx.stroke(body);

  const rim = new Path2D(cupRimPath(w, h));
  ctx.fillStyle = colors.body;
  ctx.fill(rim);
  ctx.stroke(rim);
}

// ---------------------------------------------------------------- vật: phấn, tẩy

/** Cỡ vật ở hàng 3 cốc (đơn vị khung): phấn dài mảnh, tẩy vuông dẹt — khác hẳn dáng. */
export const CHALK_SIZE = { w: 84, h: 24 } as const;
export const ERASER_SIZE = { w: 64, h: 40 } as const;

/** Phấn: thanh trụ nằm ngang, đầu trái tròn (mặt cắt), đầu phải vát. */
export const CHALK_PATH = "M-36 -24 L29 -24 L42 -10 L37 0 L-36 0 C-44 0 -44 -24 -36 -24Z";
/** Mặt cắt tròn ở đầu trái (nửa elip phía trong). */
export const CHALK_CAP_PATH = "M-36 -24 C-30 -24 -30 0 -36 0";
/** Mặt vát ở đầu phải. */
export const CHALK_BEVEL_PATH = "M29 -24 L42 -10 L37 0 L32 0Z";

/** Tẩy: khối chữ nhật dẹt bo góc; nửa trên gỗ, nửa dưới nỉ. */
export const ERASER_PATH = roundRectPath(
  -ERASER_SIZE.w / 2,
  -ERASER_SIZE.h,
  ERASER_SIZE.w,
  ERASER_SIZE.h,
  7,
);
/** Vân gỗ trên nửa trên. */
export const ERASER_GRAIN_PATH = [-34, -28, -23]
  .map((y) => `M-32 ${y} C-12 ${y - 3} 10 ${y + 3} 32 ${y - 1}`)
  .join(" ");
/** Chấm nỉ trên nửa dưới. */
export const ERASER_FELT_DOTS: readonly [number, number][] = [
  [-22, -13],
  [-8, -6],
  [6, -13],
  [20, -6],
  [-15, -4],
  [13, -15],
];

/**
 * Màu riêng của game cho hai vật (vật giữ màu ở cả hai giao diện, như đặc tả): gỗ nâu có vân và
 * nỉ xám của cục tẩy. Phấn dùng giấy kem `--color-paper`, viền mực `--color-ink` của thương hiệu.
 */
export const ERASER_WOOD = "#a8693b";
export const ERASER_GRAIN = "#74421f";
export const ERASER_FELT = "#9d9aab";
export const ERASER_FELT_DOT = "#c4c1cf";

export interface ItemColors {
  ink: string;
  paper: string;
  /** Nền tối: viền phấn mờ quanh vật để tách khỏi nền. */
  halo?: string;
}

/** Viền vật: (nền tối) viền phấn dày bên dưới, rồi nét mực. */
function outline(ctx: Ctx, path: Path2D, colors: ItemColors) {
  if (colors.halo) {
    ctx.lineWidth = 8;
    ctx.strokeStyle = colors.halo;
    ctx.stroke(path);
  }
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = colors.ink;
  ctx.stroke(path);
}

/** Vẽ cục phấn ở tỉ lệ `scale`, gốc (0, 0) ở giữa mép dưới. */
export function drawChalk(ctx: Ctx, scale: number, colors: ItemColors) {
  ctx.save();
  ctx.scale(scale, scale);
  const body = new Path2D(CHALK_PATH);
  outline(ctx, body, colors);
  ctx.fillStyle = colors.paper;
  ctx.fill(body);
  // Khối trụ: nửa dưới tối nhẹ; mặt vát tối hơn.
  ctx.save();
  ctx.clip(body);
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = colors.ink;
  ctx.fillRect(-44, -8, 88, 8);
  ctx.globalAlpha = 0.16;
  ctx.fill(new Path2D(CHALK_BEVEL_PATH));
  ctx.restore();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = colors.ink;
  ctx.stroke(body);
  ctx.lineWidth = 2.5;
  ctx.stroke(new Path2D(CHALK_CAP_PATH));
  ctx.beginPath();
  ctx.moveTo(29, -24);
  ctx.lineTo(32, 0);
  ctx.stroke();
  ctx.restore();
}

/** Vẽ cục tẩy ở tỉ lệ `scale`, gốc (0, 0) ở giữa mép dưới. */
export function drawEraser(ctx: Ctx, scale: number, colors: ItemColors) {
  const { w, h } = ERASER_SIZE;
  ctx.save();
  ctx.scale(scale, scale);
  const body = new Path2D(ERASER_PATH);
  outline(ctx, body, colors);
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = ERASER_WOOD;
  ctx.fillRect(-w / 2, -h, w, h / 2);
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 2;
  ctx.strokeStyle = ERASER_GRAIN;
  ctx.stroke(new Path2D(ERASER_GRAIN_PATH));
  ctx.globalAlpha = 1;
  ctx.fillStyle = ERASER_FELT;
  ctx.fillRect(-w / 2, -h / 2, w, h / 2);
  ctx.fillStyle = ERASER_FELT_DOT;
  for (const [x, y] of ERASER_FELT_DOTS) {
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = colors.ink;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(w / 2, -h / 2);
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.stroke(body);
  ctx.restore();
}

// ---------------------------------------------------------------- huy hiệu xoay vòng

/**
 * Ba mũi tên cong nối thành vòng tròn bán kính `r`, theo chiều kim đồng hồ, tâm (0, 0).
 * `arcs` để vẽ nét, `heads` để tô (đầu mũi tên rộng ±`head`).
 */
export function rotateIconPaths(r: number, head: number): { arcs: string; heads: string } {
  const third = (2 * Math.PI) / 3;
  const point = (a: number, radius = r) =>
    `${(radius * Math.cos(a)).toFixed(2)} ${(radius * Math.sin(a)).toFixed(2)}`;
  const arcs: string[] = [];
  const heads: string[] = [];
  for (let i = 0; i < 3; i++) {
    const a0 = -Math.PI / 2 + i * third + 0.3;
    const a1 = a0 + third - 0.75;
    arcs.push(`M${point(a0)} A${r} ${r} 0 0 1 ${point(a1)}`);
    heads.push(`M${point(a1 + 0.42)} L${point(a1, r + head)} L${point(a1, r - head)}Z`);
  }
  return { arcs: arcs.join(" "), heads: heads.join(" ") };
}

/** Vẽ biểu tượng xoay vòng (canvas), nét `line`, màu `color`. */
export function drawRotateIcon(ctx: Ctx, r: number, line: number, color: string) {
  const { arcs, heads } = rotateIconPaths(r, line * 1.5);
  ctx.lineWidth = line;
  ctx.strokeStyle = color;
  ctx.stroke(new Path2D(arcs));
  ctx.fillStyle = color;
  ctx.fill(new Path2D(heads));
  ctx.lineWidth = line * 0.5;
  ctx.stroke(new Path2D(heads));
}
