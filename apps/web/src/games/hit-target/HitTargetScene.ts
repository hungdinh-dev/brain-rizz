import { type HitTargetPuzzle, hitTarget } from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import { DESIGN_WIDTH, type MinigameBridge } from "../types";

// ── Màu riêng của game (bản mẫu M6 trên canvas Brain Rizz, trang Minigame) ────────────────────

/**
 * Nền thẻ đã chọn: xanh nhạt ở giao diện sáng (chữ mực 13:1), xanh rêu ở giao diện tối (chữ kem
 * 6,3:1). Màu riêng của game, không phải token chung; mọi màu khác đọc từ token lúc vẽ câu.
 */
const SELECTED_LIGHT = 0xcdeedb;
const SELECTED_DARK = 0x2e6b4c;
/** Viền ngoài của dấu ✗ (bản mẫu). */
const WHITE = 0xffffff;

// ── Bố cục (khung 720×1280, px thiết kế; mục "Bố cục" trong đặc tả) ──────────────────────────────

const CENTER_X = DESIGN_WIDTH / 2;
/** Gợi ý luật không chữ ở dải trên cùng: hai ô nhỏ + "=" + hồng tâm nhỏ. */
const HINT_Y = 52;
/** Hồng tâm: vòng xanh bán kính 120, mặt kem bán kính 90. */
const TARGET_Y = 226;
const TARGET_R = 120;
const FACE_R = 90;
const TARGET_FONT = 112;
/** Số đích ba chữ số (mức Khó) nhỏ lại cho vừa mặt kem. */
const TARGET_FONT_SMALL = 88;
/** Ổ khoá cạnh hồng tâm lúc khoá, và dấu ✓ khi đúng cả câu. */
const LOCK = { x: 604, y: 230, scale: 1.25 };
const TARGET_OK = { x: 446, y: 140 };
/** Tia phấn quanh hồng tâm khi đúng cả câu (độ, bán kính trong → ngoài). */
const RAY_ANGLES = [0, 35, 145, 180, 200, 215, 340];
const RAY_FROM = 140;
const RAY_TO = 164;

/** Khay: tâm hàng ô, cạnh ô, cỡ chữ chip và ô tổng. */
const TRAY_Y = 432;
const SLOT = 96;
const SLOT_RADIUS = 18;
const CHIP_FONT = 52;
const SUM_W = 136;
const SUM_RADIUS = 22;
const SUM_FONT = 56;

/** Vị trí ô, dấu nối, dấu "=" và ô tổng của khay theo số ô. */
interface TrayLayout {
  slots: number[];
  ops: number[];
  eq: number;
  sum: number;
}
const TRAY_3: TrayLayout = { slots: [112, 264, 416], ops: [188, 340], eq: 492, sum: 588 };
const TRAY_2: TrayLayout = { slots: [188, 340], ops: [264], eq: 416, sum: 512 };

/** Lưới thẻ: tâm hàng; tâm cột theo số cột (3 cột thẻ 200 × 200, Mầm 2 cột thẻ 280 × 200). */
const ROW_Y = [632, 872, 1112];
const COL_X: Record<number, number[]> = { 2: [192, 528], 3: [136, 360, 584] };
const CARD_H = 200;
const CARD_W: Record<number, number> = { 2: 280, 3: 200 };
const CARD_RADIUS = 30;
const CARD_FONT: Record<number, number> = { 2: 104, 3: 88 };
/** Bóng đổ thấp hơn mặt thẻ 10 px; thẻ đã chọn lún xuống 8 px. */
const CARD_DROP = 10;
const SINK = 8;
/** Huy hiệu số thứ tự ở góc trên trái thẻ đã chọn (tính từ tâm mặt thẻ). */
const BADGE_R = 24;
const BADGE_INSET = 16;
const BADGE_Y = -88;
const BADGE_FONT = 30;
/** Lúc khoá: vòng nét đứt quanh thẻ đáp án (rộng hơn thẻ 12 px), ✓ và ✗ ở góc phải trên. */
const RING_PAD = 6;
const RING_RADIUS = 38;
const OK_INSET = 8;
const CROSS_OFFSET = { x: -22, y: -72 };

const FONT_FAMILY = '"Baloo 2", "Be Vietnam Pro", sans-serif';
const FONT_WEIGHT = "800";
/** Chân chữ đặt thấp hơn tâm 0,35 cỡ chữ thì chữ số nằm giữa theo chiều dọc (đo trên bản mẫu). */
const DIGIT_DROP = 0.35;
/** Chờ font tối đa ngần này ms trước câu đầu, quá thì vẽ bằng font dự phòng. */
const FONT_TIMEOUT_MS = 1500;

/** Dấu trừ dài (U+2212), không dùng gạch ngắn "-". */
const MINUS = "−";

// ── Chuyển động ────────────────────────────────────────────────────────────────────────────

const APPEAR_MS = 140;
const SINK_MS = 80;
/** Chip bay từ thẻ vào khay (≤ 200 ms, không chặn chạm tiếp). */
const FLY_MS = 160;
/** Bỏ chọn: thẻ nảy lên 12 px rồi về; vạch phấn và huy hiệu mũi tên mờ dần. */
const BOUNCE_MS = 90;
const UNDO_FADE_MS = 200;
const HOVER_LIFT = 6;
const HOVER_SCALE = 1.04;
/** Đúng cả câu → câu mới. */
const NEXT_MS = 300;
const SHAKE_MS = 200;
const DIM_ALPHA = 0.6;

type Pt = { x: number; y: number };

/** Màu lấy từ token giao diện lúc vẽ câu, để mọi thứ nổi trên cả nền sáng lẫn tối. */
interface Ink {
  dark: boolean;
  card: number;
  cardFg: number;
  /** Viền thẻ chưa chọn. */
  border: number;
  /** Bóng đổ kiểu nhãn dán, viền hồng tâm. */
  sticker: number;
  /** Dấu "+", "−", "=" trong khay. */
  op: number;
  danger: number;
  accent: number;
  accentFg: number;
  /** Vòng xanh hồng tâm (màu nhóm Tính toán). */
  compute: number;
  /** Mặt hồng tâm và số đích giữ giấy kem chữ mực ở cả hai chủ đề (bản mẫu). */
  paper: number;
  ink: number;
  selected: number;
}

/** Một thẻ số của câu hiện tại. */
interface LiveCard {
  value: number;
  x: number;
  y: number;
  w: number;
  /** Cả thẻ (bóng đổ + mặt): nảy, rung, rê chuột, làm mờ. */
  node: Phaser.GameObjects.Container;
  /** Mặt thẻ + số + huy hiệu: lún xuống khi chọn. */
  face: Phaser.GameObjects.Container;
  faceGfx: Phaser.GameObjects.Graphics;
  badge: Phaser.GameObjects.Container;
  badgeLabel: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;
const cssColor = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/** Số âm vẽ bằng "−" dài; `String(-8)` ra gạch ngắn. */
function formatNumber(n: number): string {
  return n < 0 ? `${MINUS}${-n}` : String(n);
}

/** Đọc token màu CSS (tự đổi theo sáng/tối) tại canvas; thiếu token thì dùng màu giao diện sáng. */
function readInk(el: Element): Ink {
  const css = getComputedStyle(el);
  const pick = (name: string, fallback: number) => {
    const value = css.getPropertyValue(name).trim();
    return value ? Phaser.Display.Color.ValueToColor(value).color : fallback;
  };
  const dark = css.colorScheme === "dark";
  return {
    dark,
    card: pick("--card", 0xfff8ef),
    cardFg: pick("--card-foreground", 0x1f1b3a),
    border: pick("--border", 0x1f1b3a),
    sticker: pick("--sticker", 0x1f1b3a),
    op: pick("--muted-foreground", 0x5a5578),
    danger: pick("--destructive", 0xc93a55),
    accent: pick("--primary", 0xffd166),
    accentFg: pick("--primary-foreground", 0x1f1b3a),
    compute: pick("--color-compute", 0x3bb273),
    paper: pick("--color-paper", 0xfff8ef),
    ink: pick("--color-ink", 0x1f1b3a),
    selected: dark ? SELECTED_DARK : SELECTED_LIGHT,
  };
}

/** Chờ Baloo 2 tải xong (chữ trên canvas vẽ một lần, không tự vẽ lại khi font về muộn). */
function waitForFont(): Promise<void> {
  const fonts = document.fonts;
  if (!fonts) return Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, FONT_TIMEOUT_MS);
  });
  const load = fonts.load(`${FONT_WEIGHT} 72px "Baloo 2"`, `0123456789${MINUS}`).then(
    () => {},
    () => {},
  );
  return Promise.race([load, timeout]).finally(() => clearTimeout(timer));
}

// ── Hình học cho Graphics (Phaser không có nét đứt hay đầu nét tròn) ────────────────────────────

function roundRectPoints(x: number, y: number, w: number, h: number, r: number): Pt[] {
  const corners: Array<[number, number, number]> = [
    [x + w - r, y + r, -90],
    [x + w - r, y + h - r, 0],
    [x + r, y + h - r, 90],
    [x + r, y + r, 180],
  ];
  return corners.flatMap(([cx, cy, start]) =>
    Array.from({ length: 7 }, (_, i) => {
      const a = toRad(start + i * 15);
      return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    }),
  );
}

/** Đường cong bậc ba từ `p0` (không gồm `p0`). */
function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, steps = 10): Pt[] {
  return Array.from({ length: steps }, (_, s) => {
    const t = (s + 1) / steps;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return {
      x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    };
  });
}

/** Nét thẳng đầu tròn, vẽ bằng đa giác để tô được. */
function capsule(from: Pt, to: Pt, r: number): Pt[] {
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  const cap = (c: Pt, start: number) =>
    Array.from({ length: 9 }, (_, i) => {
      const t = start + (Math.PI * i) / 8;
      return { x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) };
    });
  return [...cap(to, a - Math.PI / 2), ...cap(from, a + Math.PI / 2)];
}

/** `fillPoints`/`strokePoints` của Phaser 4 nhận mảng Vector2. */
const toVectors = (pts: Pt[]) => pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));

function fillPoly(g: Phaser.GameObjects.Graphics, pts: Pt[]) {
  g.fillPoints(toVectors(pts), true);
}

function strokePoly(g: Phaser.GameObjects.Graphics, pts: Pt[], closeShape: boolean) {
  g.strokePoints(toVectors(pts), closeShape);
}

/** Vạch đầu tròn (màu tô hiện tại của `g`), nét dày `width`. */
function bar(
  g: Phaser.GameObjects.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
) {
  fillPoly(g, capsule({ x: x1, y: y1 }, { x: x2, y: y2 }, width / 2));
}

/** Nét đứt dọc một đường khép kín (đang dùng `lineStyle` hiện tại của `g`). */
function strokeDashed(g: Phaser.GameObjects.Graphics, pts: Pt[], dash: number, gap: number) {
  let drawing = true;
  let left = dash;
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    let at = 0;
    while (length - at > 1e-6) {
      const step = Math.min(left, length - at);
      if (drawing) {
        const t0 = at / length;
        const t1 = (at + step) / length;
        g.lineBetween(
          a.x + (b.x - a.x) * t0,
          a.y + (b.y - a.y) * t0,
          a.x + (b.x - a.x) * t1,
          a.y + (b.y - a.y) * t1,
        );
      }
      at += step;
      left -= step;
      if (left <= 1e-6) {
        drawing = !drawing;
        left = drawing ? dash : gap;
      }
    }
  });
}

// ── Các hình vẽ quanh (0, 0) ────────────────────────────────────────────────────────────────

/** Gợi ý luật không chữ: hai ô nhỏ, "+", "=", hồng tâm nhỏ. */
function drawHint(g: Phaser.GameObjects.Graphics, ink: Ink) {
  g.fillStyle(ink.card, 1);
  g.lineStyle(4, ink.cardFg, 1);
  for (const x of [-107, -35]) {
    g.fillRoundedRect(x, -20, 40, 40, 9);
    g.strokeRoundedRect(x, -20, 40, 40, 9);
  }
  g.fillStyle(ink.cardFg, ink.dark ? 0.6 : 0.55);
  bar(g, -60, 0, -42, 0, 5);
  bar(g, -51, -9, -51, 9, 5);
  bar(g, 20, -6, 40, -6, 5);
  bar(g, 20, 6, 40, 6, 5);
  g.fillStyle(ink.compute, 1);
  g.lineStyle(4, ink.sticker, 1);
  g.fillCircle(81, 0, 26);
  g.strokeCircle(81, 0, 26);
  g.fillStyle(ink.paper, 1);
  g.lineStyle(3, ink.sticker, 1);
  g.fillCircle(81, 0, 14);
  g.strokeCircle(81, 0, 14);
  g.fillStyle(ink.ink, 1);
  g.fillCircle(81, 0, 4.5);
}

/** Hồng tâm: bóng đổ, vòng xanh có bốn vạch, mặt kem. */
function drawTarget(g: Phaser.GameObjects.Graphics, ink: Ink) {
  g.fillStyle(ink.sticker, 1);
  g.fillCircle(0, 8, TARGET_R);
  g.fillStyle(ink.compute, 1);
  g.lineStyle(6, ink.sticker, 1);
  g.fillCircle(0, 0, TARGET_R);
  g.strokeCircle(0, 0, TARGET_R);
  g.fillStyle(ink.paper, 1);
  for (const [x1, y1, x2, y2] of [
    [0, -113, 0, -97],
    [0, 97, 0, 113],
    [-113, 0, -97, 0],
    [97, 0, 113, 0],
  ] as const) {
    bar(g, x1, y1, x2, y2, 6);
  }
  g.lineStyle(5, ink.sticker, 1);
  g.fillCircle(0, 0, FACE_R);
  g.strokeCircle(0, 0, FACE_R);
}

/** Mặt thẻ số (chưa chọn: giấy, viền mực; đã chọn: xanh, viền đậm hơn). */
function drawCardFace(g: Phaser.GameObjects.Graphics, w: number, selected: boolean, ink: Ink) {
  g.clear();
  g.fillStyle(selected ? ink.selected : ink.card, 1);
  g.lineStyle(selected ? (ink.dark ? 6 : 7) : 5, selected ? ink.cardFg : ink.border, 1);
  g.fillRoundedRect(-w / 2, -CARD_H / 2, w, CARD_H, CARD_RADIUS);
  g.strokeRoundedRect(-w / 2, -CARD_H / 2, w, CARD_H, CARD_RADIUS);
}

/** Màu huy hiệu tròn (số thứ tự, mũi tên bỏ chọn): sáng thì nền mực viền kem, tối thì ngược lại. */
function badgeColors(ink: Ink) {
  return {
    fill: ink.cardFg,
    stroke: ink.dark ? ink.sticker : ink.card,
    fg: ink.dark ? ink.ink : ink.card,
  };
}

function drawBadge(g: Phaser.GameObjects.Graphics, ink: Ink) {
  const c = badgeColors(ink);
  g.fillStyle(c.fill, 1);
  g.lineStyle(3, c.stroke, 1);
  g.fillCircle(0, 0, BADGE_R);
  g.strokeCircle(0, 0, BADGE_R);
}

/** Huy hiệu mũi tên quay lại, thoáng qua khi bỏ chọn. */
function drawUndo(g: Phaser.GameObjects.Graphics, ink: Ink) {
  drawBadge(g, ink);
  const fg = badgeColors(ink).fg;
  // Cung 270° bán kính 11 (bản mẫu: 13 × 0,85), lật ngang: đầu mũi tên ở trên phải.
  const arc = Array.from({ length: 19 }, (_, i) => {
    const a = toRad(-26.6 - i * 15);
    return { x: 11 * Math.cos(a), y: 11 * Math.sin(a) };
  });
  g.lineStyle(4, fg, 1);
  strokePoly(g, arc, false);
  g.fillStyle(fg, 1);
  bar(g, 0.3 * 0.85, 9.3 * 0.85, 9.6 * 0.85, 10.2 * 0.85, 4);
  bar(g, 9.6 * 0.85, 10.2 * 0.85, 4.7 * 0.85, 18.3 * 0.85, 4);
}

/** Ô khay còn trống: thẻ mờ viền nét đứt. */
function drawSlot(g: Phaser.GameObjects.Graphics, ink: Ink) {
  const half = SLOT / 2;
  g.fillStyle(ink.card, ink.dark ? 0.6 : 0.55);
  g.fillRoundedRect(-half, -half, SLOT, SLOT, SLOT_RADIUS);
  g.lineStyle(4, ink.cardFg, ink.dark ? 0.7 : 0.55);
  strokeDashed(g, roundRectPoints(-half, -half, SLOT, SLOT, SLOT_RADIUS), 12, 9);
}

/** Chip trong khay: thẻ giấy viền đậm, bóng đổ. */
function drawChip(g: Phaser.GameObjects.Graphics, ink: Ink) {
  const half = SLOT / 2;
  g.fillStyle(ink.sticker, 1);
  g.fillRoundedRect(-half, -half + 6, SLOT, SLOT, SLOT_RADIUS);
  g.fillStyle(ink.card, 1);
  g.lineStyle(4, ink.cardFg, 1);
  g.fillRoundedRect(-half, -half, SLOT, SLOT, SLOT_RADIUS);
  g.strokeRoundedRect(-half, -half, SLOT, SLOT, SLOT_RADIUS);
}

type SumState = "normal" | "ok" | "bad";

/** Ô tổng: nền mực chữ vàng; đúng thì nền vàng; sai thì nền thẻ viền đỏ nét đứt. */
function drawSum(g: Phaser.GameObjects.Graphics, state: SumState, ink: Ink) {
  const x = -SUM_W / 2;
  const y = -SLOT / 2;
  g.fillStyle(ink.sticker, 1);
  g.fillRoundedRect(x, y + 6, SUM_W, SLOT, SUM_RADIUS);
  if (state === "ok") {
    g.fillStyle(ink.accent, 1);
    g.lineStyle(4, ink.sticker, 1);
    g.fillRoundedRect(x, y, SUM_W, SLOT, SUM_RADIUS);
    g.strokeRoundedRect(x, y, SUM_W, SLOT, SUM_RADIUS);
    return;
  }
  if (state === "bad") {
    g.fillStyle(ink.card, 1);
    g.fillRoundedRect(x, y, SUM_W, SLOT, SUM_RADIUS);
    g.lineStyle(6, ink.danger, 1);
    strokeDashed(g, roundRectPoints(x, y, SUM_W, SLOT, SUM_RADIUS), 16, 9);
    return;
  }
  g.fillStyle(ink.ink, 1);
  g.fillRoundedRect(x, y, SUM_W, SLOT, SUM_RADIUS);
  if (ink.dark) {
    g.lineStyle(3, ink.cardFg, 1);
    g.strokeRoundedRect(x, y, SUM_W, SLOT, SUM_RADIUS);
  } else {
    g.lineStyle(2, ink.paper, 0.25);
    g.strokeRoundedRect(x + 10, y + 10, SUM_W - 20, SLOT - 20, 14);
  }
}

/** Dấu ✗ trên thẻ chọn sai: viền trắng, lõi màu báo lỗi. */
function drawCross(g: Phaser.GameObjects.Graphics, ink: Ink) {
  for (const [color, width] of [
    [WHITE, 20],
    [ink.danger, 10],
  ] as const) {
    g.fillStyle(color, 1);
    bar(g, -24, -24, 24, 24, width);
    bar(g, 24, -24, -24, 24, width);
  }
}

/** Dấu ✓ tròn vàng (thẻ đáp án lúc khoá, hồng tâm khi đúng cả câu). */
function drawCheck(g: Phaser.GameObjects.Graphics, ink: Ink) {
  g.fillStyle(ink.sticker, 1);
  g.fillCircle(0, 5, 28);
  g.fillStyle(ink.accent, 1);
  g.lineStyle(4, ink.sticker, 1);
  g.fillCircle(0, 0, 28);
  g.strokeCircle(0, 0, 28);
  g.fillStyle(ink.accentFg, 1);
  bar(g, -13, 1, -3, 11, 6.5);
  bar(g, -3, 11, 14, -10, 6.5);
}

/** Ổ khoá cạnh hồng tâm trong lúc khoá. */
function drawLock(g: Phaser.GameObjects.Graphics, ink: Ink) {
  g.fillStyle(ink.sticker, 1);
  g.fillRoundedRect(-34, -12, 68, 54, 10);
  const top = { x: -20, y: -26 };
  g.lineStyle(9, ink.cardFg, 1);
  strokePoly(
    g,
    [
      { x: -20, y: -14 },
      top,
      ...cubic(top, { x: -20, y: -42 }, { x: 20, y: -42 }, { x: 20, y: -26 }),
      { x: 20, y: -14 },
    ],
    false,
  );
  g.fillStyle(ink.accent, 1);
  g.lineStyle(5, ink.sticker, 1);
  g.fillRoundedRect(-34, -18, 68, 54, 10);
  g.strokeRoundedRect(-34, -18, 68, 54, 10);
  g.fillStyle(ink.accentFg, 1);
  g.fillCircle(0, 4, 7);
  bar(g, 0, 6, 0, 20, 6);
}

/** Dấu nối trong khay: "+" hoặc "−" (thẻ âm), nét 8 px. */
function drawOperator(g: Phaser.GameObjects.Graphics, x: number, minus: boolean, color: number) {
  g.fillStyle(color, 1);
  bar(g, x - 15, TRAY_Y, x + 15, TRAY_Y, 8);
  if (!minus) bar(g, x, TRAY_Y - 15, x, TRAY_Y + 15, 8);
}

/** Dấu "=", gạch chéo khi tổng sai. */
function drawEquals(g: Phaser.GameObjects.Graphics, x: number, crossed: boolean, color: number) {
  g.fillStyle(color, 1);
  bar(g, x - 16, TRAY_Y - 9, x + 16, TRAY_Y - 9, 8);
  bar(g, x - 16, TRAY_Y + 9, x + 16, TRAY_Y + 9, 8);
  if (crossed) bar(g, x + 9, TRAY_Y - 21, x - 9, TRAY_Y + 21, 8);
}

/**
 * Chạm đích — chạm `pick` thẻ có tổng bằng số đích. Đặc tả: docs/04-minigames/hit-target.md.
 * Khay đủ `pick` thẻ là gửi đáp án ngay (đúng một lần mỗi câu); bỏ chọn chỉ diễn ra ở client.
 * Client chấm thử để phản hồi tức thì, server chấm lại để tính điểm thật.
 */
export default class HitTargetScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = true;
  private puzzle?: HitTargetPuzzle;
  private ink!: Ink;
  private reduced = false;
  /** Chỉ số các thẻ đang chọn, theo thứ tự chạm (= thứ tự ô trong khay). */
  private selected: number[] = [];
  private cards: LiveCard[] = [];
  private board?: Phaser.GameObjects.Container;
  private targetLayer?: Phaser.GameObjects.Container;
  private tray?: Phaser.GameObjects.Container;
  private grid?: Phaser.GameObjects.Container;
  private marks?: Phaser.GameObjects.Container;

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.locked = true;
  }

  create() {
    // Phaser tự dọn tween và hẹn giờ khi scene tắt; dọn thêm tham chiếu để không giữ câu cũ.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.locked = true;
      this.tweens.killAll();
      this.time.removeAllEvents();
      this.cards = [];
      this.puzzle = undefined;
    });
    // Chạm nhiều ngón vẫn được xử lý lần lượt theo thứ tự sự kiện; đủ `pick` thẻ là khoá.
    this.input.addPointer(2);
    void waitForFont().then(() => {
      // Hết vòng trong lúc chờ font thì scene đã bị huỷ.
      if (this.sys.isActive()) this.showPuzzle();
    });
  }

  private showPuzzle() {
    // Mọi tween đang chạy đều thuộc câu cũ (chip bay, nảy, nhịp vòng đáp án): dừng trước khi huỷ.
    this.tweens.killAll();
    this.board?.destroy();

    const puzzle = hitTarget.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    this.puzzle = puzzle;
    this.ink = readInk(this.game.canvas);
    this.reduced = prefersReducedMotion();
    this.selected = [];

    const hint = this.add.graphics({ x: CENTER_X, y: HINT_Y });
    drawHint(hint, this.ink);
    const target = this.add.graphics();
    drawTarget(target, this.ink);
    const size = puzzle.target >= 100 ? TARGET_FONT_SMALL : TARGET_FONT;
    const number = this.label(formatNumber(puzzle.target), size, this.ink.ink);
    this.targetLayer = this.add.container(CENTER_X, TARGET_Y, [target, number]);
    this.tray = this.add.container();
    this.grid = this.add.container();
    this.marks = this.add.container();
    this.board = this.add.container(0, 0, [
      hint,
      this.targetLayer,
      this.grid,
      this.marks,
      this.tray,
    ]);

    this.cards = puzzle.cards.map((value, i) => this.createCard(puzzle, value, i));
    this.renderTray();

    if (!this.reduced) {
      this.board.setAlpha(0);
      this.tweens.add({ targets: this.board, alpha: 1, duration: APPEAR_MS });
    }
    // Chạm được ngay, không chờ hiệu ứng xuất hiện.
    this.locked = false;
  }

  private createCard(puzzle: HitTargetPuzzle, value: number, i: number): LiveCard {
    const cols = puzzle.cols;
    const w = CARD_W[cols] ?? CARD_W[3]!;
    const x = (COL_X[cols] ?? COL_X[3]!)[i % cols]!;
    const y = ROW_Y[Math.floor(i / cols)]!;

    const shadow = this.add.graphics();
    shadow.fillStyle(this.ink.sticker, 1);
    shadow.fillRoundedRect(-w / 2, -CARD_H / 2 + CARD_DROP, w, CARD_H, CARD_RADIUS);
    const faceGfx = this.add.graphics();
    drawCardFace(faceGfx, w, false, this.ink);
    const label = this.label(formatNumber(value), CARD_FONT[cols] ?? 88, this.ink.cardFg);
    const badgeGfx = this.add.graphics();
    drawBadge(badgeGfx, this.ink);
    const badgeLabel = this.label("1", BADGE_FONT, badgeColors(this.ink).fg);
    const badge = this.add
      .container(-w / 2 + BADGE_INSET, BADGE_Y, [badgeGfx, badgeLabel])
      .setVisible(false);
    const face = this.add.container(0, 0, [faceGfx, label, badge]);
    const node = this.add.container(x, y, [shadow, face]);
    this.grid?.add(node);

    // Vùng chạm là cả thẻ và đứng yên (không theo hiệu ứng nảy, rê chuột).
    const zone = this.add.zone(x, y, w, CARD_H).setInteractive({ useHandCursor: true });
    const card: LiveCard = { value, x, y, w, node, face, faceGfx, badge, badgeLabel, zone };
    zone.on("pointerdown", () => this.toggle(i));
    zone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch && !this.locked && !this.selected.includes(i)) this.hover(card, true);
    });
    zone.on("pointerout", () => this.hover(card, false));
    this.board?.add(zone);
    return card;
  }

  /** Rê chuột (máy tính): thẻ nhô lên nhẹ. */
  private hover(card: LiveCard, on: boolean) {
    if (this.tweens.isTweening(card.node)) return;
    card.node.setScale(on ? HOVER_SCALE : 1).setY(on ? card.y - HOVER_LIFT : card.y);
  }

  /** Chữ Baloo 2 căn giữa theo `centerY` (tâm chữ số). */
  private label(text: string, size: number, color: number, centerY = 0) {
    const t = this.add.text(0, 0, text, {
      fontFamily: FONT_FAMILY,
      fontStyle: FONT_WEIGHT,
      fontSize: size,
      color: cssColor(color),
    });
    t.setOrigin(0.5, 0);
    t.y = centerY + DIGIT_DROP * size - t.getTextMetrics().ascent;
    return t;
  }

  /** Chạm thẻ: chọn (nếu khay còn ô), hoặc bỏ chọn nếu đã chọn. Đủ `pick` thẻ thì nộp ngay. */
  private toggle(i: number) {
    const puzzle = this.puzzle;
    const card = this.cards[i];
    if (this.locked || !puzzle || !card) return;

    const at = this.selected.indexOf(i);
    if (at >= 0) {
      this.selected.splice(at, 1);
      this.refreshCards();
      this.renderTray();
      this.unselectFx(card);
      return;
    }
    if (this.selected.length >= puzzle.pick) return;

    this.selected.push(i);
    this.hover(card, false);
    this.refreshCards();
    this.renderTray(i);
    if (this.selected.length === puzzle.pick) this.submit(puzzle);
  }

  /** Vẽ lại mặt mọi thẻ theo `selected`: thẻ đã chọn lún xuống, nền xanh, huy hiệu số thứ tự. */
  private refreshCards() {
    this.cards.forEach((card, i) => {
      const order = this.selected.indexOf(i);
      const on = order >= 0;
      drawCardFace(card.faceGfx, card.w, on, this.ink);
      card.badge.setVisible(on);
      if (on) card.badgeLabel.setText(String(order + 1));
      const y = on ? SINK : 0;
      if (card.face.y === y) return;
      this.tweens.killTweensOf(card.face);
      if (this.reduced) card.face.setY(y);
      else this.tweens.add({ targets: card.face, y, duration: SINK_MS, ease: "Quad.easeOut" });
    });
  }

  /**
   * Vẽ lại khay theo `selected`: chip các thẻ đã chọn (dồn lên đầu), ô trống, dấu nối, ô tổng.
   * `flyFrom`: thẻ vừa chọn, chip của nó bay từ thẻ vào ô. `state` khác "normal" khi đã nộp.
   */
  private renderTray(flyFrom?: number, state: SumState = "normal") {
    const tray = this.tray;
    const puzzle = this.puzzle;
    if (!tray || !puzzle) return;
    this.tweens.killTweensOf(tray.list);
    tray.removeAll(true);

    const ink = this.ink;
    const layout = puzzle.pick === 2 ? TRAY_2 : TRAY_3;
    const values = this.selected.map((i) => this.cards[i]?.value ?? 0);

    const signs = this.add.graphics();
    for (const [k, x] of layout.ops.entries()) {
      drawOperator(signs, x, (values[k + 1] ?? 0) < 0, ink.op);
    }
    drawEquals(signs, layout.eq, state === "bad", state === "bad" ? ink.danger : ink.op);
    tray.add(signs);

    layout.slots.forEach((x, k) => {
      const value = values[k];
      if (value === undefined) {
        const slot = this.add.graphics({ x, y: TRAY_Y });
        drawSlot(slot, ink);
        tray.add(slot);
        return;
      }
      // Ô đầu ghi cả dấu ("−15"); ô sau ghi trị tuyệt đối, dấu nằm ở dấu nối đứng trước.
      const text = k === 0 ? formatNumber(value) : String(Math.abs(value));
      const g = this.add.graphics();
      drawChip(g, ink);
      const chip = this.add.container(x, TRAY_Y, [g, this.label(text, CHIP_FONT, ink.cardFg)]);
      tray.add(chip);
      const cardIndex = this.selected[k]!;
      if (state === "normal") {
        // Chạm chip trong khay cũng bỏ chọn thẻ đó.
        const zone = this.add.zone(x, TRAY_Y, SLOT, SLOT).setInteractive({ useHandCursor: true });
        zone.on("pointerdown", () => this.toggle(cardIndex));
        tray.add(zone);
      }
      const from = this.cards[cardIndex];
      if (cardIndex === flyFrom && from && !this.reduced) {
        chip.setPosition(from.x, from.y).setScale(1.4).setAlpha(0.4);
        this.tweens.add({
          targets: chip,
          x,
          y: TRAY_Y,
          scale: 1,
          alpha: 1,
          duration: FLY_MS,
          ease: "Cubic.easeOut",
        });
      }
    });

    const sum = values.reduce((s, v) => s + v, 0);
    const box = this.add.graphics();
    drawSum(box, state, ink);
    const color = state === "ok" ? ink.accentFg : state === "bad" ? ink.cardFg : ink.accent;
    tray.add(
      this.add.container(layout.sum, TRAY_Y, [box, this.label(formatNumber(sum), SUM_FONT, color)]),
    );
  }

  /** Bỏ chọn: thẻ nảy lên, vạch phấn dưới thẻ, huy hiệu mũi tên quay lại thoáng qua. */
  private unselectFx(card: LiveCard) {
    if (this.reduced) return;
    card.node.setScale(1).setY(card.y);
    this.tweens.add({
      targets: card.node,
      y: card.y - 12,
      scale: 1.03,
      duration: BOUNCE_MS,
      yoyo: true,
      ease: "Quad.easeOut",
    });
    const fx = this.add.graphics({ x: card.x, y: card.y });
    fx.fillStyle(this.ink.cardFg, 0.5);
    bar(fx, -50, 112, -50, 130, 5);
    bar(fx, 0, 116, 0, 138, 5);
    bar(fx, 50, 112, 50, 130, 5);
    const undo = this.add.graphics({ x: card.x - card.w / 2 + 14, y: card.y - 98 });
    drawUndo(undo, this.ink);
    this.marks?.add([fx, undo]);
    this.tweens.add({
      targets: [fx, undo],
      alpha: 0,
      duration: UNDO_FADE_MS,
      delay: 60,
      onComplete: () => {
        fx.destroy();
        undo.destroy();
      },
    });
  }

  /** Khay vừa đủ `pick` thẻ: gửi đáp án đúng một lần, rồi hiện đúng hoặc sai. */
  private submit(puzzle: HitTargetPuzzle) {
    this.locked = true;
    for (const card of this.cards) this.hover(card, false);
    const index = this.index;
    const choice = [...this.selected];
    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const correct = hitTarget.check(puzzle, choice);
    this.bridge.submit(index, choice);
    this.index += 1;

    if (correct) {
      this.complete();
      return;
    }
    this.showMiss(puzzle);
    // Hết khoá theo `lockedUntil` của server (không tự đếm 1,5 giây) để khớp huy hiệu khoá của khung.
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive()) return;
      this.time.delayedCall(ms, () => this.showPuzzle());
    });
  }

  /** Đúng cả câu: hồng tâm có tia phấn và ✓, khay đầy nảy nhẹ, ô tổng nền vàng. */
  private complete() {
    const ink = this.ink;
    this.renderTray(undefined, "ok");

    const rays = this.add.graphics({ x: CENTER_X, y: TARGET_Y });
    rays.fillStyle(ink.cardFg, 0.5);
    for (const deg of RAY_ANGLES) {
      const c = Math.cos(toRad(deg));
      const s = Math.sin(toRad(deg));
      bar(rays, RAY_FROM * c, RAY_FROM * s, RAY_TO * c, RAY_TO * s, 6);
    }
    const ok = this.add.graphics({ x: TARGET_OK.x, y: TARGET_OK.y });
    drawCheck(ok, ink);
    this.marks?.add([rays, ok]);

    if (!this.reduced) {
      ok.setScale(0.5);
      this.tweens.add({ targets: ok, scale: 1, duration: 160, ease: "Back.easeOut" });
      rays.setScale(0.85).setAlpha(0);
      this.tweens.add({ targets: rays, scale: 1, alpha: 1, duration: 140, ease: "Quad.easeOut" });
      this.tweens.add({
        targets: this.tray,
        y: -6,
        duration: 90,
        yoyo: true,
        ease: "Sine.easeOut",
      });
    }
    this.time.delayedCall(NEXT_MS, () => this.showPuzzle());
  }

  /**
   * Sai → khoá (CR-006): ổ khoá cạnh hồng tâm; khay giữ các thẻ đã chọn, "=" bị gạch, ô tổng viền
   * đỏ nét đứt; thẻ chọn sai có ✗ và rung; mọi thẻ đáp án có vòng nét đứt và ✓ (kể cả thẻ đã chọn
   * đúng); các thẻ còn lại mờ đi. Mọi thứ nằm dưới y ≈ 106, ngoài dải huy hiệu khoá của khung.
   */
  private showMiss(puzzle: HitTargetPuzzle) {
    const marks = this.marks;
    if (!marks) return;
    const ink = this.ink;
    this.renderTray(undefined, "bad");

    const lock = this.add.graphics({ x: LOCK.x, y: LOCK.y }).setScale(LOCK.scale);
    drawLock(lock, ink);
    marks.add(lock);

    const answer = new Set(puzzle.answer);
    const chosen = new Set(this.selected);
    this.cards.forEach((card, i) => {
      if (!answer.has(i) && !chosen.has(i)) card.node.setAlpha(DIM_ALPHA);
    });

    // Thẻ đáp án: vòng nét đứt quanh mặt thẻ (thẻ đã chọn lún nên vòng thấp hơn 4 px) và ✓.
    const rings: Phaser.GameObjects.Graphics[] = [];
    for (const i of puzzle.answer) {
      const card = this.cards[i];
      if (!card) continue;
      const dy = chosen.has(i) ? SINK / 2 : 0;
      const w = card.w + RING_PAD * 2;
      const h = CARD_H + RING_PAD * 2;
      const ring = this.add.graphics({ x: card.x, y: card.y + dy });
      ring.lineStyle(5, ink.cardFg, 1);
      strokeDashed(ring, roundRectPoints(-w / 2, -h / 2, w, h, RING_RADIUS), 14, 10);
      const ok = this.add.graphics({
        x: card.x + card.w / 2 - OK_INSET,
        y: card.y + dy - CARD_H / 2 + OK_INSET,
      });
      drawCheck(ok, ink);
      marks.add([ring, ok]);
      rings.push(ring);
    }
    if (!this.reduced && rings.length > 0) {
      this.tweens.add({
        targets: rings,
        scale: 1.03,
        duration: 300,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // Thẻ chọn sai: ✗ ở góc phải trên, hai nét rung hai bên, rung ngang 200 ms.
    const wrongs = this.selected.filter((i) => !answer.has(i));
    const shake = this.add.graphics();
    shake.lineStyle(5, ink.cardFg, 1);
    for (const i of wrongs) {
      const card = this.cards[i];
      if (!card) continue;
      for (const side of [-1, 1]) {
        // Bỏ nét rung ở phía có thẻ sai kề bên cùng hàng, để hai nét không chồng nhau.
        const neighbour = i + side;
        const sameRow = Math.floor(neighbour / puzzle.cols) === Math.floor(i / puzzle.cols);
        if (sameRow && neighbour >= 0 && wrongs.includes(neighbour)) continue;
        const near = card.x + side * (card.w / 2 + 14);
        const far = card.x + side * (card.w / 2 + 22);
        const start = { x: near, y: card.y - 32 };
        strokePoly(
          shake,
          [
            start,
            ...cubic(
              start,
              { x: far, y: card.y - 10 },
              { x: far, y: card.y + 26 },
              { x: near, y: card.y + 48 },
            ),
          ],
          false,
        );
      }
      const cross = this.add.graphics({
        x: card.x + card.w / 2 + CROSS_OFFSET.x,
        y: card.y + CROSS_OFFSET.y,
      });
      drawCross(cross, ink);
      marks.add(cross);
      if (!this.reduced) {
        this.tweens.add({
          targets: card.node,
          x: card.x + 10,
          duration: SHAKE_MS / 4,
          yoyo: true,
          repeat: 1,
          ease: "Sine.easeInOut",
        });
      }
    }
    marks.addAt(shake, 0);
  }
}
