import type { RuleGateFeature, RuleGateItem, RuleGateSpecies } from "@brain-rizz/shared";
import type { Ctx } from "../_shared/canvas";
import { circle, ellipse, fill, roundRect, type Shape, stroke } from "../_shared/chalk";
import {
  BALL,
  BODY,
  BOOK,
  CROSS,
  FEET,
  GLASSES,
  HAT,
  INK,
  PAWS,
  QUESTION,
  SPECIES,
  STICKER_HALO,
  TICK,
} from "./shapes";

/*
 * Vẽ ra canvas 2D cho scene Cổng luật (bạn, phụ kiện, biểu tượng phấn, vé). Hàm thuần: nhận `ctx`
 * và màu, không biết Phaser. Scene vẽ mỗi hình một lần thành texture rồi chỉ đặt ảnh. Nét / tô /
 * hình cơ bản / hạt phấn lấy từ `_shared/chalk`.
 *
 * Không gom bộ vẽ bạn với Tìm bạn (`crowd-search/buddies.tsx`) dù cùng ý "bạn có phụ kiện": bên đó
 * là cây SVG React lấy thẳng `CHARACTER_SPECS` (6 loài, mèo Cam có đuôi, mũi elip, không ria; viền
 * nhãn dán bằng `withHalo` nong ảnh) với mũ / đồ cầm / kính khác hẳn; bên này là Path2D riêng
 * (`shapes.ts`, 3 loài, mèo không đuôi có ria, mũ lưỡi trai, sách / bóng; viền `halo` là nét trắng
 * dày quanh từng mảng). Gom về một nguồn sẽ đổi hình ít nhất một game.
 */

// ─── Bạn (hệ toạ độ nhân vật 200×200) ──────────────────────────────────────────────────────────

/**
 * Thân, tai, chân, đuôi và mặt của một loài. `halo` (đơn vị): viền trắng kiểu nhãn dán quanh cả
 * hình để bạn nổi trên giấy tối lẫn mặt bảng; 0 = không viền.
 */
export function drawBuddyBase(ctx: Ctx, species: RuleGateSpecies, halo: number) {
  const look = SPECIES[species];
  const body = new Path2D(BODY);
  const ears = new Path2D(look.ears);
  const feet = new Path2D(FEET);
  const tail = look.tail ? new Path2D(look.tail) : undefined;
  if (halo > 0) {
    for (const shape of [ears, feet, body, tail]) {
      if (shape) stroke(ctx, shape, STICKER_HALO, 6 + halo * 2);
    }
  }
  if (tail) {
    fill(ctx, tail, look.fill);
    stroke(ctx, tail, INK, 5);
  }
  fill(ctx, ears, look.earFill);
  stroke(ctx, ears, INK, 5);
  if (look.earInner && look.earInnerFill) fill(ctx, look.earInner, look.earInnerFill);
  fill(ctx, feet, look.limb);
  stroke(ctx, feet, INK, 5);
  fill(ctx, body, look.fill);
  if (look.patch && look.patchFill) fill(ctx, look.patch, look.patchFill);
  stroke(ctx, body, INK, 6);
  if (look.whiskers) stroke(ctx, look.whiskers, INK, 2.5, 0.55);
  for (const x of look.blushX) fill(ctx, ellipse(x, look.blushY, 9, 5), look.blush, 0.85);
  for (const x of look.eyeX) {
    if (look.eyes === "panda") {
      fill(ctx, circle(x, look.eyeY, 5), "#ffffff");
      fill(ctx, circle(x + 1, look.eyeY + 0.5, 3), INK);
    } else {
      fill(ctx, ellipse(x, look.eyeY, 6, 7.5), INK);
      fill(ctx, circle(x - 2, look.eyeY - 3, 2.2), "#ffffff");
    }
  }
  fill(ctx, look.nose, look.noseFill);
  stroke(ctx, look.nose, INK, 2.5);
  stroke(ctx, look.mouth, INK, 3.5);
}

/** Mũ lưỡi trai trên đỉnh đầu. */
export function drawHat(ctx: Ctx) {
  const crown = new Path2D(HAT.crown);
  const brim = new Path2D(HAT.brim);
  fill(ctx, brim, HAT.fill);
  fill(ctx, brim, "#000000", 0.22);
  stroke(ctx, brim, INK, 5);
  fill(ctx, crown, HAT.fill);
  stroke(ctx, HAT.seam, INK, 3, 0.45);
  stroke(ctx, crown, INK, 5);
  const { cx, cy, r } = HAT.button;
  fill(ctx, circle(cx, cy, r), INK);
}

/** Kính tròn, tâm (0, 0) giữa hai mắt: người gọi dời tới (100, `eyeY`) của loài. */
export function drawGlasses(ctx: Ctx) {
  for (const x of GLASSES.lensX) {
    const lens = circle(x, 0, GLASSES.r);
    fill(ctx, lens, "#ffffff", 0.28);
    stroke(ctx, lens, INK, 5);
  }
  stroke(ctx, GLASSES.bridge, INK, 5);
  stroke(ctx, GLASSES.temples, INK, 5);
}

/** Đồ cầm trước bụng (sách / bóng) và hai bàn tay ôm hai bên; `none` chỉ vẽ hai tay. */
export function drawItem(ctx: Ctx, item: RuleGateItem, species: RuleGateSpecies) {
  if (item === "book") {
    const cover = roundRect(BOOK.x, BOOK.y, BOOK.w, BOOK.h, 4);
    fill(ctx, cover, BOOK.fill);
    fill(ctx, roundRect(BOOK.x, BOOK.y, BOOK.spine, BOOK.h, 4), "#000000", 0.28);
    fill(ctx, roundRect(BOOK.x + 21, BOOK.y + 9, 24, 12, 2), BOOK.label);
    stroke(
      ctx,
      `M${BOOK.x + BOOK.spine} ${BOOK.y} L${BOOK.x + BOOK.spine} ${BOOK.y + BOOK.h}`,
      INK,
      3,
    );
    stroke(ctx, cover, INK, 4.5);
  } else if (item === "ball") {
    const ball = circle(BALL.cx, BALL.cy, BALL.r);
    fill(ctx, ball, BALL.fill);
    ctx.save();
    ctx.clip(ball);
    stroke(ctx, BALL.stripes, INK, 3.5);
    ctx.restore();
    stroke(ctx, ball, INK, 4.5);
  }
  const limb = SPECIES[species].limb;
  for (const [cx, cy] of PAWS[item]) {
    const paw = ellipse(cx, cy, 12, 9);
    fill(ctx, paw, limb);
    stroke(ctx, paw, INK, 4);
  }
}

// ─── Biểu tượng phấn trên vé (px, tâm (0, 0), khung ~112 px) ───────────────────────────────────

/** Tỉ lệ và tâm (đơn vị nhân vật) của từng biểu tượng để vừa khung ~112 px. */
const ICON_FIT: Readonly<Record<RuleGateFeature, { zoom: number; cx: number; cy: number }>> = {
  cat: { zoom: 0.58, cx: 100, cy: 100 },
  bunny: { zoom: 0.58, cx: 100, cy: 94 },
  panda: { zoom: 0.58, cx: 100, cy: 104 },
  hat: { zoom: 1, cx: 122, cy: 38 },
  glasses: { zoom: 1, cx: 0, cy: -2 },
  book: { zoom: 1.85, cx: 100, cy: 152 },
  ball: { zoom: 1.95, cx: 100, cy: 152 },
};

/** Nét phấn của biểu tượng, theo px trên vé. */
const ICON_LINE = 6;

/**
 * Một đặc điểm vẽ bằng phấn, cùng hình với phụ kiện / tai trên người bạn để soát bằng mắt.
 * `board`: màu mặt bảng, tô lót để tai nằm sau thân như trên người bạn.
 */
export function drawFeatureChalk(ctx: Ctx, feature: RuleGateFeature, chalk: string, board: string) {
  const fit = ICON_FIT[feature];
  const z = fit.zoom;
  const w = ICON_LINE / z;
  ctx.save();
  ctx.scale(z, z);
  ctx.translate(-fit.cx, -fit.cy);
  const solid = (shape: Shape, alpha = 0.14) => {
    fill(ctx, shape, board);
    fill(ctx, shape, chalk, alpha);
    stroke(ctx, shape, chalk, w);
  };
  switch (feature) {
    case "cat":
    case "bunny":
    case "panda": {
      const look = SPECIES[feature];
      if (feature === "panda") {
        // Tai tròn tô đặc như tai đen của gấu trúc.
        fill(ctx, look.ears, board);
        fill(ctx, look.ears, chalk, 0.9);
        stroke(ctx, look.ears, chalk, w);
      } else {
        solid(look.ears);
        if (look.earInner) stroke(ctx, look.earInner, chalk, w * 0.6, 0.75);
      }
      solid(BODY);
      if (look.whiskers) stroke(ctx, look.whiskers, chalk, w * 0.5, 0.85);
      if (feature === "panda" && look.patch) fill(ctx, look.patch, chalk, 0.9);
      for (const x of look.eyeX) {
        if (feature === "panda") fill(ctx, circle(x, look.eyeY, 5.5), board);
        else fill(ctx, ellipse(x, look.eyeY, 7, 8.5), chalk);
      }
      fill(ctx, look.nose, chalk);
      stroke(ctx, look.mouth, chalk, w * 0.55);
      break;
    }
    case "hat": {
      fill(ctx, HAT.brim, board);
      fill(ctx, HAT.brim, chalk, 0.5);
      stroke(ctx, HAT.brim, chalk, w);
      solid(HAT.crown);
      stroke(ctx, HAT.seam, chalk, w * 0.5, 0.7);
      fill(ctx, circle(HAT.button.cx, HAT.button.cy, HAT.button.r + 1), chalk);
      break;
    }
    case "glasses": {
      for (const x of GLASSES.lensX) {
        const lens = circle(x, 0, GLASSES.r);
        fill(ctx, lens, chalk, 0.14);
        stroke(ctx, lens, chalk, w);
      }
      stroke(ctx, GLASSES.bridge, chalk, w);
      stroke(ctx, GLASSES.temples, chalk, w);
      break;
    }
    case "book": {
      const cover = roundRect(BOOK.x, BOOK.y, BOOK.w, BOOK.h, 4);
      fill(ctx, cover, chalk, 0.14);
      fill(ctx, roundRect(BOOK.x, BOOK.y, BOOK.spine, BOOK.h, 4), chalk, 0.6);
      stroke(ctx, roundRect(BOOK.x + 21, BOOK.y + 9, 24, 12, 2), chalk, w * 0.6);
      stroke(ctx, cover, chalk, w);
      break;
    }
    case "ball": {
      const ball = circle(BALL.cx, BALL.cy, BALL.r);
      fill(ctx, ball, chalk, 0.14);
      ctx.save();
      ctx.clip(ball);
      stroke(ctx, BALL.stripes, chalk, w * 0.6);
      ctx.restore();
      stroke(ctx, ball, chalk, w);
      break;
    }
  }
  ctx.restore();
}

/** Biển cấm quanh biểu tượng (phủ định): vòng tròn + vạch chéo đỏ phấn, viền phấn trắng, vạch dày. */
export function drawBan(ctx: Ctx, radius: number, red: string, halo: string) {
  const ring = circle(0, 0, radius);
  const d = radius * Math.SQRT1_2;
  const bar = `M${-d} ${-d} L${d} ${d}`;
  stroke(ctx, ring, halo, 13);
  stroke(ctx, bar, halo, 20);
  stroke(ctx, ring, red, 7);
  stroke(ctx, bar, red, 12);
}

/** Đường viền vé: chữ nhật bo góc, khuyết nửa tròn giữa hai cạnh bên (tâm (0, 0)). */
export function ticketPath(w: number, h: number, r = 18, notch = 14): Path2D {
  const x0 = -w / 2;
  const y0 = -h / 2;
  const x1 = w / 2;
  const y1 = h / 2;
  const p = new Path2D();
  p.moveTo(x0 + r, y0);
  p.lineTo(x1 - r, y0);
  p.arcTo(x1, y0, x1, y0 + r, r);
  p.lineTo(x1, -notch);
  p.arc(x1, 0, notch, -Math.PI / 2, Math.PI / 2, true);
  p.lineTo(x1, y1 - r);
  p.arcTo(x1, y1, x1 - r, y1, r);
  p.lineTo(x0 + r, y1);
  p.arcTo(x0, y1, x0, y1 - r, r);
  p.lineTo(x0, notch);
  p.arc(x0, 0, notch, Math.PI / 2, -Math.PI / 2, true);
  p.lineTo(x0, y0 + r);
  p.arcTo(x0, y0, x0 + r, y0, r);
  p.closePath();
  return p;
}

/** Vé ngửa: viền phấn, lót phấn rất nhạt. */
export function drawTicket(ctx: Ctx, w: number, h: number, chalk: string) {
  const shape = ticketPath(w, h);
  fill(ctx, shape, chalk, 0.07);
  stroke(ctx, shape, chalk, 5);
}

/** Vé úp (Siêu khó): mặt sau gạch chéo phấn, dấu "?" lớn ở giữa. */
export function drawTicketBack(ctx: Ctx, w: number, h: number, chalk: string) {
  const shape = ticketPath(w, h);
  fill(ctx, shape, chalk, 0.1);
  ctx.save();
  ctx.clip(shape);
  for (let x = -w - h; x < w + h; x += 24) {
    stroke(ctx, `M${x} ${h / 2} L${x + h} ${-h / 2}`, chalk, 3, 0.22);
  }
  ctx.restore();
  stroke(ctx, shape, chalk, 5);
  ctx.save();
  ctx.scale(1.25, 1.25);
  stroke(ctx, QUESTION, chalk, 11);
  fill(ctx, circle(0, 34, 7), chalk);
  ctx.restore();
}

/** Dấu ✓ trên huy hiệu tròn vàng (đúng / đáp án). Tâm (0, 0), bán kính `r`. */
export function drawTickBadge(ctx: Ctx, r: number, primary: string, sticker: string) {
  const s = r / 26;
  ctx.save();
  ctx.scale(s, s);
  fill(ctx, circle(0, 5, 26), sticker);
  const badge = circle(0, 0, 26);
  fill(ctx, badge, primary);
  stroke(ctx, badge, sticker, 4);
  stroke(ctx, TICK, sticker, 6);
  ctx.restore();
}

/** Dấu ✗ đỏ viền trắng (nút vừa chọn sai, vế không khớp). */
export function drawCrossMark(ctx: Ctx, size: number, red: string) {
  const s = size / 60;
  ctx.save();
  ctx.scale(s, s);
  stroke(ctx, CROSS, "#ffffff", 22);
  stroke(ctx, CROSS, red, 11);
  ctx.restore();
}
