import { type Ctx, makeCanvas, roundRectPath } from "./canvas";

/*
 * Thẻ lựa chọn, vòng ✓ và huy hiệu tròn ✓/✗/gương kiểu bản mẫu RotateStates (Xoay hình), dùng
 * chung cho các game "chạm vào thẻ đúng, xoay được, lật thì sai" (Xoay hình, Mảnh vừa khít).
 * Hàm thuần vẽ lên `ctx` có gốc toạ độ ở tâm ảnh; scene tự đặt khoá texture và gọi `textures.addCanvas`.
 */

// ---------------------------------------------------------------- kích thước

/** Thẻ lựa chọn 320×320, cả thẻ là vùng chạm. Rê chuột: nhấc 4 px, viền đậm hơn. */
export const CHOICE_CARD = {
  size: 320,
  radius: 28,
  border: 4,
  hoverBorder: 7,
  shadow: 8,
  lift: 4,
} as const;

/** Thẻ bị chạm sai: viền gạch đứt. */
export const CARD_MISS_BORDER = 7;
export const CARD_MISS_DASH: [number, number] = [20, 12];

/** Huy hiệu tròn: bán kính và độ lệch bóng. */
export const BADGE_R = 30;
export const BADGE_SHADOW = 5;

type Point = readonly [x: number, y: number];

/** Vị trí huy hiệu so với tâm thẻ 320: ✓ ở góc trên phải; ✗ và icon gương cạnh nhau. */
export const BADGE_OK_AT: Point = [140, -140];
export const BADGE_BAD_AT: Point = [130, -130];
export const BADGE_MIRROR_AT: Point = [62, -130];

/** Cạnh ảnh vòng ✓ (vòng 340×340 quanh thẻ 320, nằm dưới thẻ). */
export const RING_CANVAS = 360;

// ---------------------------------------------------------------- icon (đường SVG của bản mẫu, tâm 0,0)

export const MIRROR_AXIS = "M0 -16 L0 16";
export const MIRROR_ARROWS = "M-5 0 L-19 0 M-14 -5 L-19 0 L-14 5 M5 0 L19 0 M14 -5 L19 0 L14 5";
export const CHECK = "M-14 1 L-4 12 L15 -11";
export const CROSS = "M-11 -11 L11 11 M11 -11 L-11 11";

// ---------------------------------------------------------------- màu

/** Màu (chuỗi CSS, đọc từ token lúc tạo scene) mà các hàm vẽ ở đây cần. */
export interface CardArtColors {
  card: string;
  cardFg: string;
  /** Mực: viền thẻ, viền huy hiệu. */
  border: string;
  /** Bóng đổ kiểu nhãn dán. */
  sticker: string;
  primary: string;
  primaryFg: string;
  destructive: string;
}

export type CardState = "idle" | "hover" | "miss";
export type BadgeKind = "ok" | "bad" | "mirror";

// ---------------------------------------------------------------- vẽ

/** Như `makeCanvas` nhưng dời gốc toạ độ về tâm ảnh trước khi gọi `draw`. */
export function makeCenteredCanvas(width: number, height: number, draw: (ctx: Ctx) => void) {
  return makeCanvas(width, height, (ctx) => {
    ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
    draw(ctx);
  });
}

/** Nét đứt chia đều quanh hình vuông bo góc để chỗ nối không lệch. */
export function evenDash(size: number, r: number, [dash, gap]: [number, number]): [number, number] {
  const length = 4 * (size - 2 * r) + 2 * Math.PI * r;
  const k = length / Math.max(1, Math.round(length / (dash + gap))) / (dash + gap);
  return [dash * k, gap * k];
}

export function strokeIcon(ctx: Ctx, d: string, width: number, color: string, dash: number[] = []) {
  ctx.setLineDash(dash);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke(new Path2D(d));
  ctx.setLineDash([]);
}

export function drawMirrorIcon(ctx: Ctx, color: string) {
  strokeIcon(ctx, MIRROR_AXIS, 3, color, [4, 3]);
  strokeIcon(ctx, MIRROR_ARROWS, 4, color);
}

/** Lề quanh thẻ trong ảnh thẻ. */
const CARD_PAD = 6;

/** Cỡ ảnh thẻ lựa chọn (đủ chỗ cho bóng lệch thêm khi rê chuột). */
export const CHOICE_CARD_CANVAS = {
  width: CHOICE_CARD.size + 2 * CARD_PAD,
  height: CHOICE_CARD.size + 2 * (CHOICE_CARD.shadow + CHOICE_CARD.lift + CARD_PAD),
} as const;

/**
 * Thẻ lựa chọn kèm bóng đổ (chung một ảnh). Thẻ rê chuột: viền 7 và bóng lệch thêm 4 px vì mặt thẻ
 * nhấc lên 4 px còn bóng đứng yên. Thẻ chạm sai: viền gạch đứt màu lỗi thay cho viền mực.
 */
export function drawChoiceCard(ctx: Ctx, c: CardArtColors, state: CardState) {
  const { size, radius } = CHOICE_CARD;
  const half = size / 2;
  const shadow = state === "hover" ? CHOICE_CARD.shadow + CHOICE_CARD.lift : CHOICE_CARD.shadow;
  roundRectPath(ctx, -half, -half + shadow, size, size, radius);
  ctx.fillStyle = c.sticker;
  ctx.fill();
  roundRectPath(ctx, -half, -half, size, size, radius);
  ctx.fillStyle = c.card;
  ctx.fill();
  if (state === "miss") {
    ctx.setLineDash(evenDash(size, radius, CARD_MISS_DASH));
    ctx.lineCap = "butt";
    ctx.lineWidth = CARD_MISS_BORDER;
    ctx.strokeStyle = c.destructive;
  } else {
    ctx.lineWidth = state === "hover" ? CHOICE_CARD.hoverBorder : CHOICE_CARD.border;
    ctx.strokeStyle = c.border;
  }
  ctx.stroke();
}

/** Vòng vàng viền mực quanh thẻ đúng (nằm dưới thẻ); ảnh `RING_CANVAS` × `RING_CANVAS`. */
export function drawCorrectRing(ctx: Ctx, c: CardArtColors) {
  roundRectPath(ctx, -170, -170, 340, 340, 36);
  ctx.lineWidth = 14;
  ctx.strokeStyle = c.border;
  ctx.stroke();
  ctx.lineWidth = 8;
  ctx.strokeStyle = c.primary;
  ctx.stroke();
}

/** Cạnh ảnh huy hiệu (vuông). */
export const BADGE_CANVAS = 2 * (BADGE_R + BADGE_SHADOW + 4);

/** Huy hiệu tròn có bóng: ✓ (vàng), ✗ (màu lỗi), gương (nền thẻ). */
export function drawBadge(ctx: Ctx, c: CardArtColors, kind: BadgeKind) {
  ctx.beginPath();
  ctx.arc(0, BADGE_SHADOW, BADGE_R, 0, Math.PI * 2);
  ctx.fillStyle = c.sticker;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, BADGE_R, 0, Math.PI * 2);
  ctx.fillStyle = kind === "ok" ? c.primary : kind === "bad" ? c.destructive : c.card;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = c.border;
  ctx.stroke();
  // Dấu ✗ dùng màu nền thẻ: kem trên đỏ (sáng), tím đậm trên hồng (tối), đều đủ tương phản.
  if (kind === "ok") strokeIcon(ctx, CHECK, 7, c.primaryFg);
  else if (kind === "bad") strokeIcon(ctx, CROSS, 7, c.card);
  else drawMirrorIcon(ctx, c.cardFg);
}
