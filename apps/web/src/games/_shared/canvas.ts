/*
 * Helper canvas 2D dùng chung cho scene Phaser vẽ texture một lần (rồi `textures.addCanvas`).
 * Thư mục `_shared/` chứa phần hiển thị dùng lại giữa nhiều game; không phải một minigame.
 */

export type Ctx = CanvasRenderingContext2D;

/** Canvas cỡ `width × height` (làm tròn lên), nét bo tròn, rồi gọi `draw`. */
export function makeCanvas(width: number, height: number, draw: (ctx: Ctx) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    draw(ctx);
  }
  return canvas;
}

/** Thêm viền màu `color` dày `radius` px quanh hình (nong hình theo 16 hướng rồi tô một màu). */
export function withHalo(src: HTMLCanvasElement, radius: number, color: string) {
  return makeCanvas(src.width, src.height, (ctx) => {
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      ctx.drawImage(src, Math.cos(a) * radius, Math.sin(a) * radius);
    }
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, src.width, src.height);
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(src, 0, 0);
  });
}

/** Mở đường hình chữ nhật bo góc trên `ctx` (gọi `fill`/`stroke` sau). */
export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
