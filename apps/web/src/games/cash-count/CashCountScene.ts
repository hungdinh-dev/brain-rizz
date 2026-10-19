import { type CashCountPuzzle, cashCount } from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import { DESIGN_WIDTH, type MinigameBridge } from "../types";

// ── Bảng màu riêng của game ──────────────────────────────────────────────────────────────────

/**
 * Hình tờ tiền theo mệnh giá (bảng trong mục "Ghi chú cho FE" của đặc tả, lấy từ bản mẫu M7):
 * chiều rộng (cao luôn 128) và màu giấy. Tờ tiền cách điệu kiểu nhãn dán, không chép hoa văn tiền
 * thật. Màu giấy giữ nguyên ở cả giao diện sáng lẫn tối (chỉ viền và bóng đổ theo token), chữ số in
 * bằng mực nhãn dán: tương phản ≥ 8:1 trên mọi màu giấy.
 */
const BILLS: Record<number, { width: number; color: number }> = {
  // TODO(ui-designer): tờ 1.000 chưa có trong bản mẫu. Tạm dùng màu giấy xám kem, chờ chốt.
  1000: { width: 230, color: 0xd9d4cb },
  2000: { width: 236, color: 0xdcc19c },
  5000: { width: 236, color: 0xc3b2ee },
  10000: { width: 248, color: 0xf0cf72 },
  20000: { width: 258, color: 0x9cc2f2 },
  50000: { width: 268, color: 0xf6a5c0 },
  100000: { width: 278, color: 0xa7dc8f },
  200000: { width: 288, color: 0xf5ab84 },
  500000: { width: 298, color: 0x86d2d4 },
};
const BILL_FALLBACK = { width: 248, color: 0xd9d4cb };
/** Bàn giấy kem ở giao diện sáng (bản mẫu). Giao diện tối dùng token `--card` (bàn tím đậm). */
const TABLE_PAPER = 0xe9dccb;
/** Giấy in nhiệt của hoá đơn: luôn sáng, như tờ tiền. */
const RECEIPT_PAPER = 0xfff8ef;
/** Vệt sáng giữa tờ tiền và nét trong dấu ✗. */
const WHITE = 0xffffff;

// ── Bố cục (khung 720×1280, px thiết kế; mục "Bố cục" trong đặc tả) ──────────────────────────────

const CENTER_X = DESIGN_WIDTH / 2;
/** Gợi ý luật không chữ ở dải trên cùng (y 24–80). */
const HINT_Y = 50;
/** Bàn x 24–696, y 100–704. */
const TABLE = { x: 24, y: 100, w: 672, h: 604, r: 30 };
/** Tờ tiền cao 128, bóng đổ lệch 8. */
const BILL_H = 128;
const BILL_FONT = 56;
/** Mầm: một cột tờ to (phóng 1,2). */
const SEEDLING_X = 360;
const SEEDLING_Y = [206, 402, 598];
const SEEDLING_SCALE = 1.2;
/** Thường, Khó: lưới 2 cột, tờ `i` ở cột `i % 2`, hàng `⌊i / 2⌋`. */
const GRID_X = [200, 520];
const GRID_Y = [206, 404, 600];
/** Siêu khó: cột tiền khách đưa trong khung nét đứt, dấu trừ, hoá đơn bên phải. */
const PAID_X = 196;
const PAID_Y3 = [218, 406, 594];
const PAID_Y2 = [312, 500];
const PAID_FRAME = { x: 36, y: 140, w: 320, h: 540, r: 28 };
const MINUS_Y = 404;
const RECEIPT_X = 548;
const RECEIPT_Y = 404;
const RECEIPT_TILT = 2;
/** Nhãn "= tổng tiền đưa" lúc khoá (câu tiền thối), trên khung tiền đưa. */
const PAID_LABEL = { x: 88, y: 98, w: 216, h: 48 };
/** Ô kết quả x 196–524, y 726–818; dấu "=" bên trái; ổ khoá và dấu ✓ cạnh ô. */
const RESULT = { x: 196, y: 726, w: 328, h: 92, r: 20 };
const RESULT_FONT = 60;
const EQUALS_X = [138, 170];
const EQUALS_Y = [763, 779];
const LOCK_X = 586;
const LOCK_Y = 770;
const OK_X = 520;
const OK_Y = 722;
/** 4 thẻ lưới 2×2, x 24–696, y 848–1248, khe 24. */
const CARD_W = 324;
const CARD_H = 188;
const CARD_R = 30;
const CARD_GAP = 24;
const CARD_LEFT = 24;
const CARD_TOP = 848;
const CARD_FONT = 64;
/** Huy hiệu ✓/✗ ở góc phải trên thẻ, cạnh huy hiệu ×2 cạnh tờ bị đếm hai lần. */
const BADGE_R = 24;
const TWICE_R = 36;

const FONT_FAMILY = '"Baloo 2", "Be Vietnam Pro", sans-serif';
const FONT_WEIGHT = "800";
/** Chân chữ đặt thấp hơn tâm 0,35 cỡ chữ thì chữ số nằm giữa theo chiều dọc. */
const DIGIT_DROP = 0.35;
/** Chờ font tối đa ngần này ms trước câu đầu, quá thì vẽ bằng font dự phòng. */
const FONT_TIMEOUT_MS = 1500;

// ── Chuyển động ────────────────────────────────────────────────────────────────────────────

/** Tờ tiền rơi nhẹ lên bàn (tổng ≤ 200 ms kể cả so le). */
const DROP_PX = 36;
const DROP_MS = 150;
const DROP_STAGGER_MS = 8;
const HOVER_LIFT = 2;
const HOVER_SCALE = 1.03;
/** Đúng → câu mới. */
const NEXT_MS = 300;
const SHAKE_MS = 200;
/** Lúc khoá: thẻ không liên quan mờ 35 %, tờ không liên quan mờ 60 %. */
const CARD_DIM = 0.35;
const BILL_DIM = 0.6;

type Pt = { x: number; y: number };

/** Màu lấy từ token giao diện lúc vẽ câu, để thẻ, bàn và nét vẽ nổi trên cả nền sáng lẫn tối. */
interface Ink {
  card: number;
  cardFg: number;
  sticker: number;
  danger: number;
  accent: number;
  accentFg: number;
  table: number;
  /** Viền bàn: sáng là mực mờ 25 %, tối là kem mờ 30 %. */
  tableEdge: number;
  tableEdgeAlpha: number;
}

/** Một thẻ đáp án của câu hiện tại. */
interface Card {
  /** Rung, mờ. */
  node: Phaser.GameObjects.Container;
  /** Nhấc lên khi rê chuột. */
  inner: Phaser.GameObjects.Container;
  face: Phaser.GameObjects.Graphics;
  zone: Phaser.GameObjects.Zone;
}

const TAU = Math.PI * 2;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const cssColor = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/** Số tiền kiểu Việt Nam, dấu chấm ngăn nghìn (cả khi giao diện tiếng Anh): 1550000 → "1.550.000". */
function formatMoney(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function billLook(value: number) {
  return BILLS[value] ?? BILL_FALLBACK;
}

/** Đọc token màu CSS (tự đổi theo sáng/tối) tại canvas; thiếu token thì dùng màu giao diện sáng. */
function readInk(el: Element): Ink {
  const css = getComputedStyle(el);
  const pick = (name: string, fallback: number) => {
    const value = css.getPropertyValue(name).trim();
    return value ? Phaser.Display.Color.ValueToColor(value).color : fallback;
  };
  const dark = css.colorScheme === "dark";
  const card = pick("--card", 0xfff8ef);
  const cardFg = pick("--card-foreground", 0x1f1b3a);
  const sticker = pick("--sticker", 0x1f1b3a);
  return {
    card,
    cardFg,
    sticker,
    danger: pick("--destructive", 0xc93a55),
    // Bản mẫu khoanh thẻ đúng và vẽ ✓, ổ khoá bằng vàng: token `--primary`.
    accent: pick("--primary", 0xffd166),
    accentFg: pick("--primary-foreground", 0x1f1b3a),
    table: dark ? card : TABLE_PAPER,
    tableEdge: dark ? cardFg : sticker,
    tableEdgeAlpha: dark ? 0.3 : 0.25,
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
  const load = fonts.load(`${FONT_WEIGHT} 64px "Baloo 2"`, "0123456789.?=×").then(
    () => {},
    () => {},
  );
  return Promise.race([load, timeout]).finally(() => clearTimeout(timer));
}

// ── Hình học cho Graphics (Phaser không có nét đứt hay đầu nét tròn) ───────────────────────────

function ellipsePoints(cx: number, cy: number, rx: number, ry: number, n = 64): Pt[] {
  return Array.from({ length: n }, (_, i) => ({
    x: cx + rx * Math.cos((i / n) * TAU),
    y: cy + ry * Math.sin((i / n) * TAU),
  }));
}

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

/** `fillPoints`/`strokePoints` của Phaser 4 nhận mảng Vector2. Mỗi câu chỉ vẽ một lần nên đổi kiểu ở đây. */
const toVectors = (pts: Pt[]) => pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));

function fillPoly(g: Phaser.GameObjects.Graphics, pts: Pt[]) {
  g.fillPoints(toVectors(pts), true);
}

function strokePoly(g: Phaser.GameObjects.Graphics, pts: Pt[], closeShape: boolean) {
  g.strokePoints(toVectors(pts), closeShape);
}

/** Nét thẳng đầu tròn (tô bằng `fillStyle` hiện tại). */
function stroke(g: Phaser.GameObjects.Graphics, from: Pt, to: Pt, width: number) {
  fillPoly(g, capsule(from, to, width / 2));
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

// ── Hình vẽ ─────────────────────────────────────────────────────────────────────────────────

/** Tờ tiền nhãn dán: bóng đổ, giấy viền mực, khung trong, vệt sáng giữa. Vẽ quanh (0, 0). */
function drawBill(g: Phaser.GameObjects.Graphics, value: number, ink: Ink) {
  const { width: w, color } = billLook(value);
  const half = w / 2;
  const top = -BILL_H / 2;
  g.fillStyle(ink.sticker, 1);
  g.fillRoundedRect(-half, top + 8, w, BILL_H, 16);
  g.fillStyle(color, 1);
  g.lineStyle(5, ink.sticker, 1);
  g.fillRoundedRect(-half, top, w, BILL_H, 16);
  g.strokeRoundedRect(-half, top, w, BILL_H, 16);
  g.lineStyle(2.5, ink.sticker, 0.3);
  g.strokeRoundedRect(-half + 11, top + 11, w - 22, BILL_H - 22, 9);
  g.fillStyle(WHITE, 0.55);
  g.fillEllipse(0, 0, w - 36, 80);
  g.strokeEllipse(0, 0, w - 36, 80);
}

/** Đường bao hoá đơn 264 × 320, mép dưới răng cưa. */
function receiptOutline(): Pt[] {
  const teeth: Pt[] = [];
  for (let k = 0; k < 12; k++) {
    const x = 132 - 22 * k;
    teeth.push({ x: x - 11, y: 160 }, { x: x - 22, y: 148 });
  }
  return [
    { x: -132, y: -144 },
    ...cubic(
      { x: -132, y: -144 },
      { x: -132, y: -152 },
      { x: -124, y: -160 },
      { x: -116, y: -160 },
      4,
    ),
    { x: 116, y: -160 },
    ...cubic({ x: 116, y: -160 }, { x: 124, y: -160 }, { x: 132, y: -152 }, { x: 132, y: -144 }, 4),
    { x: 132, y: 148 },
    ...teeth,
  ];
}

/** Hoá đơn in nhiệt: bóng đổ, giấy, các dòng mờ, gạch ngăn nét đứt, gạch đôi dưới tổng. Vẽ quanh (0, 0). */
function drawReceipt(g: Phaser.GameObjects.Graphics, ink: Ink) {
  const outline = receiptOutline();
  g.fillStyle(ink.sticker, 1);
  fillPoly(
    g,
    outline.map((p) => ({ x: p.x, y: p.y + 8 })),
  );
  g.fillStyle(RECEIPT_PAPER, 1);
  fillPoly(g, outline);
  g.lineStyle(5, ink.sticker, 1);
  strokePoly(g, outline, true);
  g.fillStyle(ink.sticker, 0.22);
  for (const [x, y, w] of [
    [-104, -125, 124],
    [52, -125, 52],
    [-104, -91, 96],
    [52, -91, 52],
    [-104, -57, 140],
    [52, -57, 52],
  ] as const) {
    g.fillRoundedRect(x, y, w, 14, 7);
  }
  g.lineStyle(3, ink.sticker, 0.5);
  for (let x = -108; x < 108; x += 18) g.lineBetween(x, -16, Math.min(x + 10, 108), -16);
  g.lineStyle(3, ink.sticker, 1);
  g.lineBetween(-96, 80, 96, 80);
  g.lineBetween(-96, 88, 96, 88);
}

/** Ô kết quả đang chờ: thẻ mờ viền nét đứt. */
function drawResultEmpty(g: Phaser.GameObjects.Graphics, ink: Ink) {
  const { x, y, w, h, r } = RESULT;
  g.fillStyle(ink.card, 0.55);
  g.fillRoundedRect(x, y, w, h, r);
  g.lineStyle(4, ink.cardFg, 0.55);
  strokeDashed(g, roundRectPoints(x, y, w, h, r), 12, 9);
}

/** Ô kết quả đã có số: thẻ giấy viền đậm, bóng đổ. */
function drawResultFilled(g: Phaser.GameObjects.Graphics, ink: Ink) {
  const { x, y, w, h, r } = RESULT;
  g.fillStyle(ink.sticker, 1);
  g.fillRoundedRect(x, y + 8, w, h, r);
  g.fillStyle(ink.card, 1);
  g.lineStyle(4, ink.cardFg, 1);
  g.fillRoundedRect(x, y, w, h, r);
  g.strokeRoundedRect(x, y, w, h, r);
}

/** Thẻ đáp án. `right`: vòng vàng viền mực; `wrong`: viền nét đứt màu báo lỗi. Vẽ quanh (0, 0). */
function drawCardFace(g: Phaser.GameObjects.Graphics, ink: Ink, state: "idle" | "right" | "wrong") {
  const x = -CARD_W / 2;
  const y = -CARD_H / 2;
  g.clear();
  if (state === "right") {
    g.fillStyle(ink.sticker, 1);
    g.fillRoundedRect(x - 14, y - 14, CARD_W + 28, CARD_H + 28, CARD_R + 14);
    g.fillStyle(ink.accent, 1);
    g.fillRoundedRect(x - 9, y - 9, CARD_W + 18, CARD_H + 18, CARD_R + 9);
  }
  g.fillStyle(ink.sticker, 1);
  g.fillRoundedRect(x, y + 8, CARD_W, CARD_H, CARD_R);
  g.fillStyle(ink.card, 1);
  g.fillRoundedRect(x, y, CARD_W, CARD_H, CARD_R);
  if (state === "wrong") {
    g.lineStyle(6, ink.danger, 1);
    strokeDashed(g, roundRectPoints(x, y, CARD_W, CARD_H, CARD_R), 18, 12);
  } else {
    g.lineStyle(6, ink.cardFg, 1);
    g.strokeRoundedRect(x, y, CARD_W, CARD_H, CARD_R);
  }
}

/** Huy hiệu tròn ✓ (vàng) hoặc ✗ (báo lỗi) ở góc thẻ. Vẽ quanh (0, 0). */
function drawMark(g: Phaser.GameObjects.Graphics, ink: Ink, ok: boolean, r = BADGE_R) {
  const k = r / 28;
  g.fillStyle(ink.sticker, 1);
  g.fillCircle(0, 5 * k, r);
  g.fillStyle(ok ? ink.accent : ink.danger, 1);
  g.lineStyle(4, ink.sticker, 1);
  g.fillCircle(0, 0, r);
  g.strokeCircle(0, 0, r);
  if (ok) {
    g.fillStyle(ink.accentFg, 1);
    const bend = { x: -3 * k, y: 11 * k };
    stroke(g, { x: -13 * k, y: 1 * k }, bend, 6.5 * k);
    stroke(g, bend, { x: 14 * k, y: -10 * k }, 6.5 * k);
  } else {
    g.fillStyle(WHITE, 1);
    stroke(g, { x: -11 * k, y: -11 * k }, { x: 11 * k, y: 11 * k }, 7 * k);
    stroke(g, { x: 11 * k, y: -11 * k }, { x: -11 * k, y: 11 * k }, 7 * k);
  }
}

/** Ổ khoá cạnh ô kết quả trong lúc khoá. Vẽ quanh (0, 0). */
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
  stroke(g, { x: 0, y: 6 }, { x: 0, y: 20 }, 6);
}

/** Hai nét "rung" hai bên thẻ nhầm. Vẽ quanh tâm thẻ. */
function drawShakeMarks(g: Phaser.GameObjects.Graphics, ink: Ink) {
  g.lineStyle(5, ink.cardFg, 1);
  const reach = CARD_H * 0.26;
  for (const side of [-1, 1]) {
    const near = side * (CARD_W / 2 + 6);
    const far = side * (CARD_W / 2 + 11);
    const start = { x: near, y: -reach };
    strokePoly(
      g,
      [
        start,
        ...cubic(start, { x: far, y: -reach / 2 }, { x: far, y: reach / 2 }, { x: near, y: reach }),
      ],
      false,
    );
  }
}

/** Ba tờ nhỏ chồng nhau, có vệt sáng ở tờ trên cùng (dùng cho gợi ý luật). */
function drawStack(g: Phaser.GameObjects.Graphics, ink: Ink, origins: Pt[]) {
  g.fillStyle(ink.card, 1);
  g.lineStyle(4, ink.cardFg, 1);
  for (const o of origins) {
    g.fillRoundedRect(o.x, o.y, 50, 30, 6);
    g.strokeRoundedRect(o.x, o.y, 50, 30, 6);
  }
  const last = origins[origins.length - 1]!;
  g.lineStyle(2.5, ink.cardFg, 1);
  g.strokeEllipse(last.x + 25, last.y + 15, 26, 16);
}

/** Dấu "=" phấn và ô "?" nét đứt của gợi ý luật. */
function drawHintAnswer(g: Phaser.GameObjects.Graphics, ink: Ink, eqX: number, boxX: number) {
  g.fillStyle(ink.cardFg, 0.55);
  stroke(g, { x: eqX, y: -2 }, { x: eqX + 22, y: -2 }, 5);
  stroke(g, { x: eqX, y: 10 }, { x: eqX + 22, y: 10 }, 5);
  g.lineStyle(4, ink.cardFg, 0.55);
  strokeDashed(g, roundRectPoints(boxX, -22, 46, 48, 10), 8, 6);
}

/**
 * Gợi ý luật không chữ (y 24–80): "xấp tiền = ?"; Siêu khó: "xấp tiền − hoá đơn = ?".
 * Vẽ quanh (0, 0). Trả về tâm ô "?" để đặt chữ.
 */
function drawHint(g: Phaser.GameObjects.Graphics, ink: Ink, change: boolean): Pt {
  if (!change) {
    drawStack(g, ink, [
      { x: -86, y: -24 },
      { x: -76, y: -14 },
      { x: -66, y: -4 },
    ]);
    drawHintAnswer(g, ink, 1, 40);
    return { x: 63, y: 2 };
  }
  drawStack(g, ink, [
    { x: -118, y: -20 },
    { x: -108, y: -10 },
  ]);
  g.fillStyle(ink.cardFg, 0.55);
  stroke(g, { x: -46, y: 2 }, { x: -26, y: 2 }, 5);
  const slip: Pt[] = [
    { x: -14, y: -22 },
    { x: 18, y: -22 },
    { x: 18, y: 22 },
  ];
  for (let k = 0; k < 8; k++) slip.push({ x: 14 - 4 * k, y: k % 2 === 0 ? 26 : 22 });
  g.fillStyle(ink.card, 1);
  g.lineStyle(4, ink.cardFg, 1);
  fillPoly(g, slip);
  strokePoly(g, slip, true);
  g.lineStyle(3, ink.cardFg, 1);
  for (const y of [-12, -3, 9]) g.lineBetween(-7, y, 11, y);
  drawHintAnswer(g, ink, 31, 64);
  return { x: 87, y: 2 };
}

/** Tâm tờ `i` trên bàn theo mức và số tờ. */
function billPlace(puzzle: CashCountPuzzle, i: number): Pt & { scale: number } {
  if (puzzle.mode === "change") {
    const ys = puzzle.bills.length === 2 ? PAID_Y2 : PAID_Y3;
    return { x: PAID_X, y: ys[i] ?? ys[0]!, scale: 1 };
  }
  if (puzzle.bills.length <= SEEDLING_Y.length) {
    return { x: SEEDLING_X, y: SEEDLING_Y[i] ?? SEEDLING_Y[0]!, scale: SEEDLING_SCALE };
  }
  return { x: GRID_X[i % 2]!, y: GRID_Y[Math.floor(i / 2)] ?? GRID_Y[0]!, scale: 1 };
}

const cardCenter = (i: number): Pt => ({
  x: CARD_LEFT + (i % 2) * (CARD_W + CARD_GAP) + CARD_W / 2,
  y: CARD_TOP + Math.floor(i / 2) * (CARD_H + CARD_GAP) + CARD_H / 2,
});

/**
 * Đếm tiền nhanh — cộng các tờ tiền rồi chạm thẻ ghi đúng tổng; Siêu khó tính tiền thối.
 * Đặc tả: docs/04-minigames/cash-count.md. Chấm ở client để phản hồi tức thì; mỗi câu gửi đúng một
 * đáp án (chỉ số thẻ), server chấm lại.
 */
export default class CashCountScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = true;
  private puzzle?: CashCountPuzzle;
  private ink!: Ink;
  private reduced = false;
  private board?: Phaser.GameObjects.Container;
  /** Tờ tiền của câu hiện tại, theo thứ tự `bills`. */
  private bills: Phaser.GameObjects.Container[] = [];
  private cards: Card[] = [];
  /** Vòng khoanh, huy hiệu ×2, nhãn tổng tiền đưa (lúc khoá). */
  private marks?: Phaser.GameObjects.Container;
  /** Ô kết quả và dấu ✓ / ổ khoá cạnh ô. */
  private result?: Phaser.GameObjects.Container;

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
      this.bills = [];
      this.cards = [];
      this.puzzle = undefined;
    });
    void waitForFont().then(() => {
      // Hết vòng trong lúc chờ font thì scene đã bị huỷ.
      if (this.sys.isActive()) this.showPuzzle();
    });
  }

  private showPuzzle() {
    // Mọi tween đang chạy đều thuộc câu cũ (rơi, nảy, rung, nhịp vòng khoanh): dừng trước khi huỷ.
    this.tweens.killAll();
    this.board?.destroy();

    const puzzle = cashCount.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    this.puzzle = puzzle;
    this.ink = readInk(this.game.canvas);
    this.reduced = prefersReducedMotion();
    const ink = this.ink;
    const change = puzzle.mode === "change";

    const hint = this.add.graphics({ x: change ? CENTER_X + 4 : CENTER_X, y: HINT_Y });
    const ask = drawHint(hint, ink, change);
    const hintText = this.label("?", 34, ink.cardFg, ask.y).setAlpha(0.7);
    hintText.x = ask.x;
    const hintGroup = this.add.container(hint.x, hint.y, [hintText]);

    const table = this.add.graphics();
    table.fillStyle(ink.table, 1);
    table.lineStyle(4, ink.tableEdge, ink.tableEdgeAlpha);
    table.fillRoundedRect(TABLE.x, TABLE.y, TABLE.w, TABLE.h, TABLE.r);
    table.strokeRoundedRect(TABLE.x, TABLE.y, TABLE.w, TABLE.h, TABLE.r);
    if (change) this.drawChangeDesk(table);

    const billLayer = this.add.container();
    this.bills = puzzle.bills.map((value, i) => {
      const at = billPlace(puzzle, i);
      const g = this.add.graphics();
      drawBill(g, value, ink);
      const text = this.label(formatMoney(value), BILL_FONT, ink.sticker);
      const bill = this.add.container(at.x, at.y, [g, text]);
      bill.setAngle(puzzle.tilts[i] ?? 0).setScale(at.scale);
      billLayer.add(bill);
      if (!this.reduced) {
        bill.setAlpha(0).setY(at.y - DROP_PX);
        this.tweens.add({
          targets: bill,
          y: at.y,
          alpha: 1,
          duration: DROP_MS,
          delay: i * DROP_STAGGER_MS,
          ease: "Quad.easeOut",
        });
      }
      return bill;
    });
    if (change) billLayer.add(this.createReceipt(puzzle.receipt));

    const equals = this.add.graphics();
    equals.fillStyle(ink.cardFg, 1);
    for (const y of EQUALS_Y) stroke(equals, { x: EQUALS_X[0]!, y }, { x: EQUALS_X[1]!, y }, 7);

    this.marks = this.add.container();
    this.result = this.add.container();
    this.showResultEmpty();

    const cardLayer = this.add.container();
    this.cards = puzzle.options.map((value, i) => this.createCard(cardLayer, value, i));

    this.board = this.add.container(0, 0, [
      hint,
      hintGroup,
      table,
      billLayer,
      this.marks,
      equals,
      this.result,
      cardLayer,
    ]);
    // Chạm được ngay, không chờ tờ tiền rơi xong.
    this.locked = false;
  }

  /** Siêu khó: khung phấn nét đứt quanh tiền khách đưa và dấu "−" giữa tiền đưa và hoá đơn. */
  private drawChangeDesk(g: Phaser.GameObjects.Graphics) {
    const ink = this.ink;
    const { x, y, w, h, r } = PAID_FRAME;
    g.lineStyle(4, ink.cardFg, 0.45);
    strokeDashed(g, roundRectPoints(x, y, w, h, r), 14, 10);
    g.fillStyle(ink.cardFg, 1);
    stroke(g, { x: 372, y: MINUS_Y }, { x: 400, y: MINUS_Y }, 9);
  }

  private createReceipt(receipt: number) {
    const g = this.add.graphics();
    drawReceipt(g, this.ink);
    const total = this.label(formatMoney(receipt), BILL_FONT, this.ink.sticker, 36);
    return this.add.container(RECEIPT_X, RECEIPT_Y, [g, total]).setAngle(RECEIPT_TILT);
  }

  private createCard(layer: Phaser.GameObjects.Container, value: number, i: number): Card {
    const at = cardCenter(i);
    const face = this.add.graphics();
    drawCardFace(face, this.ink, "idle");
    const text = this.label(formatMoney(value), CARD_FONT, this.ink.cardFg);
    const inner = this.add.container(0, 0, [face, text]);
    const node = this.add.container(at.x, at.y, [inner]);
    // Vùng chạm là cả thẻ (324 × 188 px thiết kế); tờ tiền không nhận chạm.
    const zone = this.add.zone(at.x, at.y, CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", () => this.choose(i));
    zone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch || this.locked) return;
      inner.setPosition(0, -HOVER_LIFT).setScale(HOVER_SCALE);
    });
    zone.on("pointerout", () => inner.setPosition(0, 0).setScale(1));
    layer.add([node, zone]);
    return { node, inner, face, zone };
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

  private showResultEmpty() {
    const result = this.result;
    if (!result) return;
    result.removeAll(true);
    const g = this.add.graphics();
    drawResultEmpty(g, this.ink);
    const ask = this.label("?", RESULT_FONT, this.ink.cardFg).setAlpha(0.6);
    ask.x = CENTER_X;
    ask.y += RESULT.y + RESULT.h / 2;
    result.add([g, ask]);
  }

  /** Ô kết quả ghi `value` (khi đúng là số vừa chọn, khi sai là đáp án đúng). */
  private showResultValue(value: number) {
    const result = this.result;
    if (!result) return;
    result.removeAll(true);
    const g = this.add.graphics();
    drawResultFilled(g, this.ink);
    const text = this.label(formatMoney(value), RESULT_FONT, this.ink.cardFg);
    text.x = CENTER_X;
    text.y += RESULT.y + RESULT.h / 2;
    result.add([g, text]);
  }

  /** Lần chạm đầu tiên của câu: gửi đáp án; mọi chạm sau đó bị bỏ qua tới câu mới. */
  private choose(choice: number) {
    const puzzle = this.puzzle;
    if (this.locked || !puzzle) return;
    this.locked = true;
    for (const card of this.cards) {
      card.zone.disableInteractive(true);
      card.inner.setPosition(0, 0).setScale(1);
    }

    const index = this.index;
    const correct = cashCount.check(puzzle, choice);
    this.bridge.submit(index, choice);
    this.index += 1;

    if (correct) {
      this.showRight(puzzle, choice);
      this.time.delayedCall(NEXT_MS, () => this.showPuzzle());
      return;
    }

    this.showMiss(puzzle, choice);
    // Hết khoá theo `lockedUntil` của server (không tự đếm 1,5 giây) để khớp huy hiệu khoá của khung.
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive()) return;
      this.time.delayedCall(ms, () => this.showPuzzle());
    });
  }

  /** Đúng: ô kết quả ghi số, nảy nhẹ, có ✓ vàng; thẻ đã chọn viền vàng + ✓. */
  private showRight(puzzle: CashCountPuzzle, choice: number) {
    const card = this.cards[choice];
    const result = this.result;
    if (!card || !result) return;
    const ink = this.ink;
    this.showResultValue(puzzle.options[choice] ?? 0);
    drawCardFace(card.face, ink, "right");
    card.inner.add(this.markAt(true));

    const ok = this.add.graphics({ x: OK_X, y: OK_Y });
    drawMark(ok, ink, true, 28);
    result.add(ok);
    if (this.reduced) return;
    ok.setScale(0.5);
    this.tweens.add({ targets: ok, scale: 1, duration: 160, ease: "Back.easeOut" });
    this.tweens.add({ targets: result, y: -8, duration: 90, yoyo: true, ease: "Sine.easeOut" });
  }

  /** Huy hiệu ✓/✗ ở góc phải trên của thẻ (toạ độ trong thẻ). */
  private markAt(ok: boolean) {
    const g = this.add.graphics({ x: CARD_W / 2 - 10, y: -CARD_H / 2 });
    drawMark(g, this.ink, ok);
    return g;
  }

  /**
   * Sai → khoá (mục "Hiện đáp án đúng khi sai" của đặc tả): thẻ vừa chọn viền nét đứt đỏ + ✗ và
   * rung; thẻ đúng vòng vàng + ✓; hai thẻ còn lại mờ. Ô kết quả hiện số đúng kèm ổ khoá. Câu tính
   * tổng khoanh tờ bị sót hoặc bị đếm hai lần (thêm ×2); câu tiền thối hiện "= tổng tiền đưa".
   * Mọi thứ nằm ở y ≥ 98, dưới dải huy hiệu khoá của khung ở điện thoại thường.
   */
  private showMiss(puzzle: CashCountPuzzle, choice: number) {
    const ink = this.ink;
    const right = this.cards[puzzle.answerIndex];
    const wrong = this.cards[choice];
    const result = this.result;
    if (!right || !wrong || !result) return;

    this.cards.forEach((card, i) => {
      if (i !== choice && i !== puzzle.answerIndex) card.node.setAlpha(CARD_DIM);
    });
    drawCardFace(right.face, ink, "right");
    right.inner.add(this.markAt(true));
    drawCardFace(wrong.face, ink, "wrong");
    const shake = this.add.graphics();
    drawShakeMarks(shake, ink);
    wrong.inner.add([shake, this.markAt(false)]);
    // Nét rung nằm trong khe giữa hai thẻ: đưa thẻ nhầm lên trên để thẻ bên cạnh không che.
    wrong.node.parentContainer?.bringToTop(wrong.node);
    if (!this.reduced) {
      const x = wrong.node.x;
      this.tweens.add({
        targets: wrong.node,
        x: x + 10,
        duration: SHAKE_MS / 4,
        yoyo: true,
        repeat: 1,
        ease: "Sine.easeInOut",
      });
    }

    this.showResultValue(puzzle.options[puzzle.answerIndex] ?? 0);
    const lock = this.add.graphics({ x: LOCK_X, y: LOCK_Y });
    drawLock(lock, ink);
    result.add(lock);

    if (puzzle.mode === "change") this.showPaid(puzzle);
    else this.showSlip(puzzle, choice);
  }

  /** Câu tính tổng: khoanh tờ có giá trị bằng độ lệch; lệch dương (đếm hai lần) thêm huy hiệu ×2. */
  private showSlip(puzzle: CashCountPuzzle, choice: number) {
    const marks = this.marks;
    const diff = (puzzle.options[choice] ?? 0) - (puzzle.options[puzzle.answerIndex] ?? 0);
    const culprit = puzzle.bills.indexOf(Math.abs(diff));
    if (!marks || culprit < 0) return;
    const ink = this.ink;

    this.bills.forEach((bill, i) => {
      if (i !== culprit) bill.setAlpha(BILL_DIM);
    });
    const at = billPlace(puzzle, culprit);
    const half = billLook(puzzle.bills[culprit]!).width / 2;
    const ring = this.add.graphics({ x: at.x, y: at.y });
    ring.lineStyle(5, ink.cardFg, 1);
    strokeDashed(
      ring,
      ellipsePoints(0, 0, (half + 28) * at.scale, (BILL_H / 2 + 28) * at.scale),
      14,
      10,
    );
    marks.add(ring);
    if (!this.reduced) {
      this.tweens.add({
        targets: ring,
        scale: 1.04,
        duration: 300,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
    if (diff <= 0) return;

    // Đếm một tờ hai lần: huy hiệu "×2" ở góc phải dưới của tờ.
    const x = at.x + (half - 20) * at.scale;
    const y = at.y + (BILL_H / 2) * at.scale;
    const badge = this.add.graphics({ x, y });
    badge.fillStyle(ink.sticker, 1);
    badge.fillCircle(0, 5, TWICE_R);
    badge.fillStyle(ink.card, 1);
    badge.lineStyle(4, ink.cardFg, 1);
    badge.fillCircle(0, 0, TWICE_R);
    badge.strokeCircle(0, 0, TWICE_R);
    const text = this.label("×2", 40, ink.cardFg);
    marks.add([badge, this.add.container(x, y, [text])]);
  }

  /** Câu tiền thối: nhãn "= tổng tiền đưa" trên khung tiền khách đưa. */
  private showPaid(puzzle: CashCountPuzzle) {
    const marks = this.marks;
    if (!marks) return;
    const ink = this.ink;
    const paid = puzzle.bills.reduce((sum, v) => sum + v, 0);
    const { x, y, w, h } = PAID_LABEL;
    const g = this.add.graphics();
    g.fillStyle(ink.sticker, 1);
    g.fillRoundedRect(x, y + 6, w, h, h / 2);
    g.fillStyle(ink.card, 1);
    g.lineStyle(3.5, ink.cardFg, 1);
    g.fillRoundedRect(x, y, w, h, h / 2);
    g.strokeRoundedRect(x, y, w, h, h / 2);
    const text = this.label(`= ${formatMoney(paid)}`, 32, ink.cardFg);
    marks.add([g, this.add.container(x + w / 2, y + h / 2, [text])]);
  }
}
