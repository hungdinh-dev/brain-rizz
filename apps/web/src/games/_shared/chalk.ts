import type Phaser from "phaser";
import type { Ctx } from "./canvas";

/*
 * Bộ vẽ phấn dùng chung cho các scene bảng phấn (Mũi tên phấn, Hình trong hình, Cổng luật…): nét /
 * tô theo Path2D, hình cơ bản, hạt phấn theo seed và texture `Art` vẽ một lần bằng canvas 2D.
 * Hàm thuần trên `ctx` (trừ `paintArt` / `placeArt` cần Phaser), không biết game nào gọi.
 */

/** Hình vẽ: Path2D dựng sẵn hoặc chuỗi path SVG. */
export type Shape = Path2D | string;

const TAU = Math.PI * 2;

const asPath = (shape: Shape) => (typeof shape === "string" ? new Path2D(shape) : shape);

/** Vẽ nét `shape` màu `color`, dày `width`, độ đục `alpha` (không đổi trạng thái `ctx`). */
export function stroke(ctx: Ctx, shape: Shape, color: string, width: number, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke(asPath(shape));
  ctx.restore();
}

/** Tô `shape` màu `color`, độ đục `alpha` (không đổi trạng thái `ctx`). */
export function fill(ctx: Ctx, shape: Shape, color: string, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill(asPath(shape));
  ctx.restore();
}

/** Đường tròn tâm (`cx`, `cy`) bán kính `r`. */
export function circle(cx: number, cy: number, r: number): Path2D {
  const shape = new Path2D();
  shape.arc(cx, cy, r, 0, TAU);
  return shape;
}

/** Elip tâm (`cx`, `cy`), bán trục `rx` × `ry`, không xoay. */
export function ellipse(cx: number, cy: number, rx: number, ry: number): Path2D {
  const shape = new Path2D();
  shape.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  return shape;
}

/** Chữ nhật bo góc `r` dạng Path2D (bản mở đường thẳng trên `ctx`: `roundRectPath` ở canvas.ts). */
export function roundRect(x: number, y: number, w: number, h: number, r: number): Path2D {
  const shape = new Path2D();
  shape.moveTo(x + r, y);
  shape.arcTo(x + w, y, x + w, y + h, r);
  shape.arcTo(x + w, y + h, x, y + h, r);
  shape.arcTo(x, y + h, x, y, r);
  shape.arcTo(x, y, x + w, y, r);
  shape.closePath();
  return shape;
}

/** Hex `#rrggbb` → `rgba(…, a)`. */
export function rgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Nét nhoè (thay cho filter blur, Safari không hỗ trợ `ctx.filter`): vẽ hình lệch hẳn ra ngoài
 * khung rồi chỉ để lại bóng đổ mờ đúng chỗ. `blur` tính theo đơn vị hình.
 */
export function softStroke(
  ctx: Ctx,
  shape: Path2D,
  color: string,
  alpha: number,
  width: number,
  blur: number,
) {
  const zoom = ctx.getTransform().a;
  const shift = 10000;
  ctx.save();
  ctx.translate(-shift / zoom, 0);
  ctx.shadowOffsetX = shift;
  ctx.shadowBlur = blur * zoom;
  ctx.shadowColor = rgba(color, alpha);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = width;
  ctx.stroke(shape);
  ctx.restore();
}

/** Bộ sinh số giả ngẫu nhiên cho hạt phấn (trang trí, không phải logic câu đố). */
function grainRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hạt phấn: đục lỗ li ti vào nét vừa vẽ (cả canvas), như phấn trên mặt bảng sần. Mỗi hạt đục với
 * độ đục `alphaMin + rand × alphaSpan` (mặc định 0,2 + 0,55; Mũi tên phấn đục đậm hơn).
 */
export function grain(ctx: Ctx, density: number, seed: number, alphaMin = 0.2, alphaSpan = 0.55) {
  const { width, height } = ctx.canvas;
  const rand = grainRng(seed);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#000000";
  const count = Math.round(width * height * density);
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = alphaMin + rand() * alphaSpan;
    const size = rand() < 0.2 ? 2 : 1;
    ctx.fillRect(Math.floor(rand() * width), Math.floor(rand() * height), size, size);
  }
  ctx.restore();
}

// ─── Texture vẽ một lần ────────────────────────────────────────────────────────────────────────

/** Khung vẽ [x0, y0, x1, y1] theo đơn vị hình, gốc (0, 0) là điểm neo của ảnh. */
export type Box = readonly [number, number, number, number];

export interface Art {
  key: string;
  ox: number;
  oy: number;
  /** Tỉ lệ đặt ảnh để ra đúng cỡ thiết kế (texture vẽ ở `res` lần). */
  scale: number;
}

/**
 * Vẽ texture `key` nếu chưa có: `box` theo đơn vị hình, `zoom` = px thiết kế mỗi đơn vị. Texture
 * vẽ ở `res` lần cỡ thiết kế (nét sắc trên màn mật độ cao), ảnh đặt với tỉ lệ 1/res.
 */
export function paintArt(
  textures: Phaser.Textures.TextureManager,
  key: string,
  box: Box,
  zoom: number,
  draw: (ctx: Ctx) => void,
  res: number,
): Art {
  const [x0, y0, x1, y1] = box;
  const z = zoom * res;
  const w = Math.ceil((x1 - x0) * z);
  const h = Math.ceil((y1 - y0) * z);
  if (!textures.exists(key)) {
    const texture = textures.createCanvas(key, w, h);
    if (texture) {
      const ctx = texture.context;
      ctx.setTransform(z, 0, 0, z, -x0 * z, -y0 * z);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      draw(ctx);
      texture.refresh();
    }
  }
  return { key, ox: (-x0 * z) / w, oy: (-y0 * z) / h, scale: 1 / res };
}

/** Đặt ảnh của `art` tại (0, 0) với điểm neo và tỉ lệ đúng cỡ thiết kế (nhân thêm `scale`). */
export function placeArt(scene: Phaser.Scene, art: Art, scale = 1): Phaser.GameObjects.Image {
  return scene.add
    .image(0, 0, art.key)
    .setOrigin(art.ox, art.oy)
    .setScale(art.scale * scale);
}
