import { type Balloon, type NumberBalloonsPuzzle, numberBalloons } from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import { DESIGN_WIDTH, type MinigameBridge } from "../types";

// ── Bảng màu riêng của game ──────────────────────────────────────────────────────────────────

/**
 * 6 màu thân bóng (bản mẫu M4 trên canvas Brain Rizz, trang Minigame), chỉ số là `Balloon.color`.
 * Chỉ để vui mắt, không mang nghĩa. Thân bóng giữ nguyên màu ở cả giao diện sáng lẫn tối (chỉ
 * viền đổi theo token), nên chữ trên bóng luôn là mực `BALLOON_INK`: tương phản từ 8,9:1 (tím nhạt)
 * tới 11,4:1 (vàng), trên mức 4,5:1.
 */
const BALLOON_COLORS = [
  0xffd166, // vàng
  0xc7b6f0, // tím nhạt
  0xffc09a, // cam đào
  0xffadc6, // hồng
  0x8fd3f4, // xanh trời
  0x9be3c0, // xanh bạc hà
] as const;
/** Chữ số trên thân bóng. */
const BALLOON_INK = 0x1f1b3a;
/** Vệt sáng trên thân bóng và viền ngoài của dấu ✗ (bản mẫu). */
const WHITE = 0xffffff;

// ── Bố cục (khung 720×1280, px thiết kế; mục "Bố cục" trong đặc tả) ──────────────────────────────

const CENTER_X = DESIGN_WIDTH / 2;
/** Gợi ý luật "nhỏ → lớn" không chữ ở dải trên cùng (y 24–80). */
const HINT_Y = 44;
/** Khay thứ tự: tâm hàng ô, cạnh ô, khoảng cách hai tâm ô, cỡ số trong ô. */
const TRAY_Y = 144;
const SLOT = 96;
const SLOT_PITCH = 112;
const CARD_FONT = 48;
/** Dấu ✓ khi đúng cả câu (góc phải khay). */
const OK_X = 660;
const OK_Y = 96;
/** Sân bóng x 24–696, y 216–1254: 3 hàng, mỗi hàng cao 346. */
const FIELD_X = 24;
const FIELD_W = 672;
const FIELD_TOP = 216;
const ROW_H = 346;
/** Mỗi bậc `dx`, `dy` của bóng lệch ngần này px khỏi tâm ô. */
const OFFSET_STEP = 6;

const FONT_FAMILY = '"Baloo 2", "Be Vietnam Pro", sans-serif';
const FONT_WEIGHT = "800";
/** Chân chữ đặt thấp hơn tâm 0,35 cỡ chữ thì chữ số (không dấu) nằm giữa theo chiều dọc. */
const DIGIT_DROP = 0.35;
/** Chờ font tối đa ngần này ms trước câu đầu, quá thì vẽ bằng font dự phòng. */
const FONT_TIMEOUT_MS = 1500;

/** Dấu trừ dài (U+2212), không dùng gạch ngắn "-". */
const MINUS = "−";
const OPERATOR = { add: "+", sub: MINUS, mul: "×" } as const;

/** Hình bóng theo lưới (bảng "Bóng và vùng chạm" trong đặc tả). */
interface BalloonLook {
  /** Bán trục ngang, dọc của thân bóng. */
  rx: number;
  ry: number;
  /** Tâm thân bóng cao hơn tâm ô ngần này (dây treo phía dưới). */
  lift: number;
  /** Chân nút buộc (đầu dây), tính từ tâm thân. Dây dài 52. */
  knot: number;
  /** Cỡ số đơn và cỡ biểu thức phép tính. */
  numFont: number;
  opFont: number;
  /** Vệt sáng: tâm, bán trục, góc xoay (độ). */
  shine: { x: number; y: number; rx: number; ry: number; angle: number };
  /** Huy hiệu thứ tự và dấu ✗ lúc khoá, tính từ tâm thân. */
  badge: Pt;
  cross: Pt;
}

/** Mầm: lưới 2×3, bóng to 210 × 232. */
const LOOK_SEEDLING: BalloonLook = {
  rx: 105,
  ry: 116,
  lift: 35,
  knot: 134,
  numFont: 96,
  opFont: 72,
  shine: { x: -50, y: -56, rx: 16, ry: 34, angle: 28 },
  badge: { x: -86, y: -88 },
  cross: { x: 80, y: -80 },
};
/** Thường, Khó: lưới 3×3, bóng 176 × 208. */
const LOOK_GRID: BalloonLook = {
  rx: 88,
  ry: 104,
  lift: 33,
  knot: 118,
  numFont: 72,
  opFont: 56,
  shine: { x: -42, y: -50, rx: 14, ry: 30, angle: 28 },
  badge: { x: -70, y: -90 },
  cross: { x: 62, y: -74 },
};
/** Siêu khó: lưới 2×3, bóng rộng 264 × 220 cho biểu thức. */
const LOOK_WIDE: BalloonLook = {
  rx: 132,
  ry: 110,
  lift: 35,
  knot: 128,
  numFont: 72,
  opFont: 56,
  shine: { x: -70, y: -50, rx: 16, ry: 32, angle: 40 },
  badge: { x: -112, y: -84 },
  cross: { x: 104, y: -82 },
};

/** Lúc khoá, bóng phép tính hiện thêm "= kết quả" (40 px) dưới biểu thức đã đẩy lên. */
const RESULT_FONT = 40;
const RESULT_LIFT = 18;
const RESULT_Y = 38;
const BADGE_R = 28;
const BADGE_FONT = 34;

// ── Chuyển động ────────────────────────────────────────────────────────────────────────────

/** Lắc lư: lên xuống ±10 px, đung đưa ±6 px, nghiêng ±3°, chu kỳ 2,6–3,4 s theo `phase`. */
const BOB_Y = 10;
const SWAY_X = 6;
const TILT_DEG = 3;
const PERIOD_MS = 2600;
const PERIOD_STEP_MS = 100;
const HOVER_SCALE = 1.03;
const INFLATE_MS = 180;
/** Nổ đúng: phồng 1 → 1,2 rồi vỡ (tổng ≤ 250 ms); số bay vào khay ≤ 250 ms. */
const POP_SCALE = 1.2;
const POP_MS = 80;
const BURST_MS = 170;
const FLY_MS = 220;
const SHARDS = 9;
/** Giảm chuyển động: nổ thay bằng mờ nhanh. */
const FADE_MS = 140;
/** Đúng cả câu → câu mới. */
const NEXT_MS = 300;
const SHAKE_MS = 200;
const DIM_ALPHA = 0.6;

type Pt = { x: number; y: number };

/** Màu lấy từ token giao diện lúc vẽ câu, để khay, huy hiệu và nét vẽ nổi trên cả nền sáng lẫn tối. */
interface Ink {
  card: number;
  cardFg: number;
  outline: number;
  danger: number;
  accent: number;
  accentFg: number;
}

/** Một quả bóng của câu hiện tại. */
interface LiveBalloon {
  data: Balloon;
  /** Vị trí tĩnh của tâm thân bóng (tâm ô + độ lệch). */
  baseX: number;
  baseY: number;
  period: number;
  /** Pha lắc lư (radian). */
  phase: number;
  /** Lắc lư, rung, phồng, nổ. */
  node: Phaser.GameObjects.Container;
  /** Phóng to nhẹ khi rê chuột. */
  inner: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  popped: boolean;
}

const TAU = Math.PI * 2;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const cssColor = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/** Số âm vẽ bằng "−" dài; `String(-8)` ra gạch ngắn. */
function formatNumber(n: number): string {
  return n < 0 ? `${MINUS}${-n}` : String(n);
}

function balloonText(b: Balloon): string {
  return b.kind === "num" ? formatNumber(b.value) : `${b.a} ${OPERATOR[b.kind]} ${b.b}`;
}

function lookFor(puzzle: NumberBalloonsPuzzle): BalloonLook {
  if (puzzle.cols >= 3) return LOOK_GRID;
  return puzzle.balloons.some((b) => b.kind !== "num") ? LOOK_WIDE : LOOK_SEEDLING;
}

/** Đọc token màu CSS (tự đổi theo sáng/tối) tại canvas; thiếu token thì dùng màu giao diện sáng. */
function readInk(el: Element): Ink {
  const css = getComputedStyle(el);
  const pick = (name: string, fallback: number) => {
    const value = css.getPropertyValue(name).trim();
    return value ? Phaser.Display.Color.ValueToColor(value).color : fallback;
  };
  return {
    card: pick("--card", 0xfff8ef),
    cardFg: pick("--card-foreground", 0x1f1b3a),
    outline: pick("--sticker", 0x1f1b3a),
    danger: pick("--destructive", 0xc93a55),
    accent: pick("--primary", 0xffd166),
    accentFg: pick("--primary-foreground", 0x1f1b3a),
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
  const load = fonts.load(`${FONT_WEIGHT} 72px "Baloo 2"`, `0123456789${MINUS}+×=`).then(
    () => {},
    () => {},
  );
  return Promise.race([load, timeout]).finally(() => clearTimeout(timer));
}

// ── Hình học cho Graphics (Phaser không có đường cong SVG, nét đứt hay đầu nét tròn) ────────────

function ellipsePoints(cx: number, cy: number, rx: number, ry: number, angle = 0, n = 48): Pt[] {
  const cos = Math.cos(toRad(angle));
  const sin = Math.sin(toRad(angle));
  return Array.from({ length: n }, (_, i) => {
    const ex = rx * Math.cos((i / n) * TAU);
    const ey = ry * Math.sin((i / n) * TAU);
    return { x: cx + ex * cos - ey * sin, y: cy + ex * sin + ey * cos };
  });
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

/** Đường cong bậc ba từ `p0` (không gồm `p0`), đủ mịn cho dây bóng và nét phấn. */
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

function fillPoly(g: Phaser.GameObjects.Graphics, pts: Pt[], closeShape: boolean) {
  g.fillPoints(toVectors(pts), closeShape);
}

function strokePoly(g: Phaser.GameObjects.Graphics, pts: Pt[], closeShape: boolean) {
  g.strokePoints(toVectors(pts), closeShape);
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

/** Dây bóng lượn sóng, dài 52 từ nút buộc. */
function stringPoints(knot: number): Pt[] {
  const start = { x: 0, y: knot };
  const mid = { x: 0, y: knot + 38 };
  return [
    start,
    ...cubic(start, { x: 10, y: knot + 12 }, { x: -10, y: knot + 26 }, mid),
    ...cubic(mid, { x: 6, y: knot + 45 }, { x: 2, y: knot + 50 }, { x: 0, y: knot + 52 }, 6),
  ];
}

function drawString(g: Phaser.GameObjects.Graphics, look: BalloonLook, ink: Ink) {
  g.lineStyle(4, ink.cardFg, 0.85);
  strokePoly(g, stringPoints(look.knot), false);
}

/** Thân bóng: bóng đổ, nút buộc, thân viền mực, vệt sáng. */
function drawBody(g: Phaser.GameObjects.Graphics, look: BalloonLook, fill: number, ink: Ink) {
  const { rx, ry, knot, shine } = look;
  g.fillStyle(ink.outline, 1);
  g.fillEllipse(0, 8, rx * 2, ry * 2);
  g.fillStyle(fill, 1);
  g.lineStyle(5, ink.outline, 1);
  g.fillTriangle(-14, knot, 0, knot - 21, 14, knot);
  g.strokeTriangle(-14, knot, 0, knot - 21, 14, knot);
  g.lineStyle(6, ink.outline, 1);
  g.fillEllipse(0, 0, rx * 2, ry * 2);
  g.strokeEllipse(0, 0, rx * 2, ry * 2);
  g.fillStyle(WHITE, 0.55);
  fillPoly(g, ellipsePoints(shine.x, shine.y, shine.rx, shine.ry, shine.angle, 24), true);
}

/** Ô khay còn trống: thẻ mờ viền nét đứt. */
function drawSlot(g: Phaser.GameObjects.Graphics, x: number, ink: Ink) {
  const half = SLOT / 2;
  g.fillStyle(ink.card, 0.55);
  g.fillRoundedRect(x - half, TRAY_Y - half, SLOT, SLOT, 18);
  g.lineStyle(4, ink.cardFg, 0.6);
  strokeDashed(g, roundRectPoints(x - half, TRAY_Y - half, SLOT, SLOT, 18), 12, 9);
}

/** Ô khay đã có số: thẻ giấy viền đậm, bóng đổ. Vẽ quanh (0, 0). */
function drawCard(g: Phaser.GameObjects.Graphics, ink: Ink) {
  const half = SLOT / 2;
  g.fillStyle(ink.outline, 1);
  g.fillRoundedRect(-half, -half + 6, SLOT, SLOT, 18);
  g.fillStyle(ink.card, 1);
  g.lineStyle(4, ink.cardFg, 1);
  g.fillRoundedRect(-half, -half, SLOT, SLOT, 18);
  g.strokeRoundedRect(-half, -half, SLOT, SLOT, 18);
}

/** Gợi ý luật không chữ: ba bóng to dần kèm mũi tên phấn. Vẽ quanh (0, 0). */
function drawHint(g: Phaser.GameObjects.Graphics, ink: Ink) {
  g.fillStyle(ink.card, 1);
  g.lineStyle(4, ink.cardFg, 1);
  for (const [x, y, rx, ry] of [
    [-48, 4, 11, 13],
    [-8, 2, 14, 17],
    [40, 0, 18, 21],
  ] as const) {
    g.fillEllipse(x, y, rx * 2, ry * 2);
    g.strokeEllipse(x, y, rx * 2, ry * 2);
  }
  g.lineStyle(4, ink.cardFg, 0.55);
  g.lineBetween(-52, 30, 62, 30);
  strokePoly(
    g,
    [
      { x: 53, y: 24 },
      { x: 63, y: 30 },
      { x: 53, y: 36 },
    ],
    false,
  );
}

/** Huy hiệu tròn (thẻ giấy) cho số thứ tự đúng. Vẽ quanh (0, 0). */
function drawBadge(g: Phaser.GameObjects.Graphics, ink: Ink) {
  g.fillStyle(ink.outline, 1);
  g.fillCircle(0, 4, BADGE_R);
  g.fillStyle(ink.card, 1);
  g.lineStyle(4, ink.cardFg, 1);
  g.fillCircle(0, 0, BADGE_R);
  g.strokeCircle(0, 0, BADGE_R);
}

/** Dấu ✗ trên quả nhầm: viền trắng, lõi màu báo lỗi. Vẽ quanh (0, 0). */
function drawCross(g: Phaser.GameObjects.Graphics, ink: Ink) {
  const arms: Array<[Pt, Pt]> = [
    [
      { x: -24, y: -24 },
      { x: 24, y: 24 },
    ],
    [
      { x: 24, y: -24 },
      { x: -24, y: 24 },
    ],
  ];
  for (const [color, r] of [
    [WHITE, 10],
    [ink.danger, 5],
  ] as const) {
    g.fillStyle(color, 1);
    for (const [from, to] of arms) fillPoly(g, capsule(from, to, r), true);
  }
}

/** Ổ khoá trên khay trong lúc khoá. Vẽ quanh (0, 0). */
function drawLock(g: Phaser.GameObjects.Graphics, ink: Ink) {
  g.fillStyle(ink.outline, 1);
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
  g.lineStyle(5, ink.outline, 1);
  g.fillRoundedRect(-34, -18, 68, 54, 10);
  g.strokeRoundedRect(-34, -18, 68, 54, 10);
  g.fillStyle(ink.accentFg, 1);
  g.fillCircle(0, 4, 7);
  fillPoly(g, capsule({ x: 0, y: 6 }, { x: 0, y: 20 }, 3), true);
}

/** Dấu ✓ khi đúng cả câu. Vẽ quanh (0, 0). */
function drawCheck(g: Phaser.GameObjects.Graphics, ink: Ink) {
  g.fillStyle(ink.outline, 1);
  g.fillCircle(0, 5, BADGE_R);
  g.fillStyle(ink.accent, 1);
  g.lineStyle(4, ink.outline, 1);
  g.fillCircle(0, 0, BADGE_R);
  g.strokeCircle(0, 0, BADGE_R);
  g.fillStyle(ink.accentFg, 1);
  const bend = { x: -3, y: 11 };
  fillPoly(g, capsule({ x: -13, y: 1 }, bend, 3.25), true);
  fillPoly(g, capsule(bend, { x: 14, y: -10 }, 3.25), true);
}

/** Hai nét "rung" hai bên quả nhầm. Vẽ quanh tâm bóng. */
function drawShakeMarks(g: Phaser.GameObjects.Graphics, look: BalloonLook, ink: Ink) {
  g.lineStyle(5, ink.cardFg, 1);
  for (const side of [-1, 1]) {
    const near = side * (look.rx + 16);
    const far = side * (look.rx + 24);
    const start = { x: near, y: -38 };
    strokePoly(
      g,
      [start, ...cubic(start, { x: far, y: -16 }, { x: far, y: 16 }, { x: near, y: 38 })],
      false,
    );
  }
}

const slotX = (i: number, n: number) => CENTER_X + (i - (n - 1) / 2) * SLOT_PITCH;

/**
 * Bóng bay số — nổ bóng theo giá trị từ nhỏ đến lớn. Đặc tả: docs/04-minigames/number-balloons.md.
 * Chấm từng lần chạm ở client cho phản hồi tức thì; mỗi câu gửi đúng một đáp án (mảng chỉ số bóng
 * đã chạm), server chấm lại.
 */
export default class NumberBalloonsScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = true;
  private puzzle?: NumberBalloonsPuzzle;
  private look: BalloonLook = LOOK_GRID;
  private ink!: Ink;
  private reduced = false;
  private swaying = false;
  /** Chỉ số bóng đã nổ đúng trong câu hiện tại, theo thứ tự chạm. */
  private tapped: number[] = [];
  private balloons: LiveBalloon[] = [];
  private board?: Phaser.GameObjects.Container;
  private field?: Phaser.GameObjects.Container;
  private marks?: Phaser.GameObjects.Container;
  private tray?: Phaser.GameObjects.Container;
  private fx?: Phaser.GameObjects.Container;

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.locked = true;
  }

  create() {
    // Phaser tự dọn tween và hẹn giờ khi scene tắt; dọn thêm tham chiếu để không giữ câu cũ.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.swaying = false;
      this.locked = true;
      this.tweens.killAll();
      this.time.removeAllEvents();
      this.balloons = [];
      this.puzzle = undefined;
    });
    // Chạm hai ngón xen kẽ vẫn được xử lý, lần lượt theo thứ tự sự kiện.
    this.input.addPointer(2);
    void waitForFont().then(() => {
      // Hết vòng trong lúc chờ font thì scene đã bị huỷ.
      if (this.sys.isActive()) this.showPuzzle();
    });
  }

  override update(time: number) {
    if (!this.swaying) return;
    for (const b of this.balloons) {
      if (b.popped) continue;
      const t = (time / b.period) * TAU + b.phase;
      b.node.setPosition(b.baseX + SWAY_X * Math.cos(t), b.baseY + BOB_Y * Math.sin(t));
      b.node.setAngle(TILT_DEG * Math.cos(t));
    }
  }

  private showPuzzle() {
    // Mọi tween đang chạy đều thuộc câu cũ (phồng, nổ, số bay, nhịp vòng đúng): dừng trước khi huỷ.
    this.tweens.killAll();
    this.board?.destroy();

    const puzzle = numberBalloons.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    this.puzzle = puzzle;
    this.look = lookFor(puzzle);
    this.ink = readInk(this.game.canvas);
    this.reduced = prefersReducedMotion();
    this.tapped = [];

    const hint = this.add.graphics({ x: CENTER_X, y: HINT_Y });
    drawHint(hint, this.ink);
    const slots = this.add.graphics();
    for (let i = 0; i < puzzle.balloons.length; i++) {
      drawSlot(slots, slotX(i, puzzle.balloons.length), this.ink);
    }
    this.field = this.add.container();
    this.marks = this.add.container();
    this.tray = this.add.container(0, 0, [slots]);
    this.fx = this.add.container();
    // Khay vẽ sau sân bóng để số bay từ bóng lên khay luôn nằm trên.
    this.board = this.add.container(0, 0, [hint, this.field, this.marks, this.tray, this.fx]);

    this.balloons = puzzle.balloons.map((b, i) => this.createBalloon(puzzle, b, i));
    this.swaying = !this.reduced;
    // Chạm được ngay, không chờ hiệu ứng phồng.
    this.locked = false;
  }

  private createBalloon(puzzle: NumberBalloonsPuzzle, data: Balloon, i: number): LiveBalloon {
    const look = this.look;
    const cellW = FIELD_W / puzzle.cols;
    const cellX = FIELD_X + cellW * ((data.slot % puzzle.cols) + 0.5);
    const cellY = FIELD_TOP + ROW_H * (Math.floor(data.slot / puzzle.cols) + 0.5);
    const baseX = cellX + data.dx * OFFSET_STEP;
    const baseY = cellY - look.lift + data.dy * OFFSET_STEP;

    const string = this.add.graphics();
    drawString(string, look, this.ink);
    const body = this.add.graphics();
    drawBody(body, look, BALLOON_COLORS[data.color] ?? BALLOON_COLORS[0], this.ink);
    const label = this.label(
      balloonText(data),
      data.kind === "num" ? look.numFont : look.opFont,
      BALLOON_INK,
    );
    const inner = this.add.container(0, 0, [string, body, label]);
    const node = this.add.container(baseX, baseY, [inner]);
    this.field?.add(node);

    if (this.reduced) {
      node.setAlpha(0);
      this.tweens.add({ targets: node, alpha: 1, duration: FADE_MS });
    } else {
      node.setScale(0.6);
      this.tweens.add({ targets: node, scale: 1, duration: INFLATE_MS, ease: "Back.easeOut" });
    }

    // Vùng chạm là cả ô và đứng yên: lắc lư không làm khó chạm.
    const zone = this.add.zone(cellX, cellY, cellW, ROW_H).setInteractive({ useHandCursor: true });
    const live: LiveBalloon = {
      data,
      baseX,
      baseY,
      period: PERIOD_MS + (data.phase % 9) * PERIOD_STEP_MS,
      phase: toRad(data.phase),
      node,
      inner,
      label,
      zone,
      popped: false,
    };
    zone.on("pointerdown", () => this.tap(i));
    zone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch && !this.locked && !live.popped) inner.setScale(HOVER_SCALE);
    });
    zone.on("pointerout", () => inner.setScale(1));
    this.board?.add(zone);
    return live;
  }

  /** Chữ Baloo 2 căn giữa theo `centerY` (tâm chữ số, không tính dấu tiếng Việt). */
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

  /** Lần chạm thứ `k` (đếm từ 0) đúng khi chạm bóng `order[k]`. Xử lý tuần tự theo sự kiện. */
  private tap(i: number) {
    const puzzle = this.puzzle;
    const live = this.balloons[i];
    if (this.locked || !puzzle || !live || live.popped) return;

    const k = this.tapped.length;
    if (puzzle.order[k] !== i) {
      this.miss(puzzle, k, i);
      return;
    }

    this.tapped.push(i);
    this.pop(live, k, puzzle.balloons.length);
    if (this.tapped.length === puzzle.order.length) this.complete();
  }

  /** Đúng cả câu: gửi ngay lúc chạm quả cuối, khay nảy + ✓, sang câu mới sau ≤ 300 ms. */
  private complete() {
    this.locked = true;
    this.swaying = false;
    // Mảng đủ n phần tử, bằng `order`: các chỉ số khác nhau vì bóng đã nổ tắt vùng chạm.
    this.bridge.submit(this.index, [...this.tapped]);
    this.index += 1;

    const ok = this.add.graphics({ x: OK_X, y: OK_Y });
    drawCheck(ok, this.ink);
    this.tray?.add(ok);
    if (!this.reduced) {
      ok.setScale(0.5);
      this.tweens.add({ targets: ok, scale: 1, duration: 160, ease: "Back.easeOut" });
      this.tweens.add({
        targets: this.tray,
        y: -8,
        duration: 90,
        yoyo: true,
        ease: "Sine.easeOut",
      });
    }
    this.time.delayedCall(NEXT_MS, () => this.showPuzzle());
  }

  /**
   * Chạm nhầm: gửi ngay mảng tính tới và gồm cả quả nhầm (luôn sai), rồi khoá. Không bỏ qua quả
   * nhầm để chạm tiếp, nếu không bấm loạn cũng ra đáp án đúng.
   */
  private miss(puzzle: NumberBalloonsPuzzle, k: number, wrong: number) {
    this.locked = true;
    for (const b of this.balloons) b.zone.disableInteractive(true);
    const index = this.index;
    // k + 1 phần tử, 1 ≤ k + 1 ≤ 5, không trùng (quả nhầm chưa nổ nên chưa có trong `tapped`).
    this.bridge.submit(index, [...this.tapped, wrong]);
    this.index += 1;

    this.showMiss(puzzle, k, wrong);
    // Hết khoá theo `lockedUntil` của server (không tự đếm 1,5 giây) để khớp huy hiệu khoá của khung.
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive()) return;
      this.time.delayedCall(ms, () => this.showPuzzle());
    });
  }

  /** Nổ đúng: bóng phồng rồi vỡ, số (bóng phép tính: kết quả) bay vào ô `k` của khay. */
  private pop(live: LiveBalloon, k: number, n: number) {
    live.popped = true;
    live.zone.disableInteractive(true);
    live.label.setVisible(false);
    const { node, data } = live;
    // Nổ ngay khi câu vừa hiện: dừng hiệu ứng phồng để không tranh `scale` với hiệu ứng nổ.
    this.tweens.killTweensOf(node);
    node.setAlpha(1);

    const x = slotX(k, n);
    const card = this.add.graphics({ x, y: TRAY_Y });
    drawCard(card, this.ink);
    const num = this.add.container(node.x, node.y, [
      this.label(formatNumber(data.value), CARD_FONT, this.ink.cardFg),
    ]);
    this.tray?.add([card, num]);

    if (this.reduced) {
      num.setPosition(x, TRAY_Y);
      this.tweens.add({ targets: node, alpha: 0, duration: FADE_MS });
      return;
    }

    card.setAlpha(0).setScale(0.8);
    this.tweens.add({ targets: card, alpha: 1, scale: 1, duration: FLY_MS, ease: "Cubic.easeOut" });
    num.setScale((data.kind === "num" ? this.look.numFont : this.look.opFont) / CARD_FONT);
    this.tweens.add({
      targets: num,
      x,
      y: TRAY_Y,
      scale: 1,
      duration: FLY_MS,
      ease: "Cubic.easeOut",
    });
    this.tweens.add({
      targets: node,
      scale: POP_SCALE,
      duration: POP_MS,
      ease: "Quad.easeOut",
      onComplete: () => {
        node.setVisible(false);
        this.burst(live);
      },
    });
  }

  /** Bóng vỡ thành mảnh cùng màu, vòng "bụp" nét phấn, dây rơi và mờ dần. */
  private burst(live: LiveBalloon) {
    const fx = this.fx;
    if (!fx) return;
    const { node, data } = live;
    const look = this.look;
    const color = BALLOON_COLORS[data.color] ?? BALLOON_COLORS[0];

    // Mảnh vỡ đặt đều quanh tâm (lệch theo `phase`), bay ra bằng cách phóng to cả nhóm.
    const shards = this.add.graphics({ x: node.x, y: node.y });
    shards.fillStyle(color, 1);
    shards.lineStyle(4, this.ink.outline, 1);
    for (let s = 0; s < SHARDS; s++) {
      const a = toRad(data.phase) + (s * TAU) / SHARDS;
      const cx = Math.cos(a) * look.rx * 0.8;
      const cy = Math.sin(a) * look.ry * 0.8;
      const tri = [0, 2.2, 4.4].map((t) => ({
        x: cx + 13 * Math.cos(a + t),
        y: cy + 13 * Math.sin(a + t),
      }));
      fillPoly(shards, tri, true);
      strokePoly(shards, tri, true);
    }
    const ring = this.add.graphics({ x: node.x, y: node.y });
    ring.lineStyle(5, this.ink.cardFg, 0.3);
    strokeDashed(ring, ellipsePoints(0, 0, look.rx + 24, look.rx + 24), 16, 14);
    const string = this.add.graphics({ x: node.x, y: node.y }).setAngle(node.angle);
    drawString(string, look, this.ink);
    fx.add([ring, shards, string]);

    shards.setScale(0.8);
    ring.setScale(0.7);
    this.tweens.add({ targets: shards, scale: 1.35, alpha: 0, angle: 12, duration: BURST_MS });
    this.tweens.add({
      targets: ring,
      scale: 1,
      alpha: 0,
      duration: BURST_MS,
      ease: "Quad.easeOut",
    });
    this.tweens.add({
      targets: string,
      y: node.y + 70,
      alpha: 0,
      duration: 300,
      ease: "Quad.easeIn",
    });
  }

  /**
   * Sai → khoá (CR-006): quả nhầm rung và có ✗; các bóng khác ngừng lắc, mờ 60 %; quả lẽ ra phải
   * chạm có vòng nét đứt; mỗi bóng còn lại `order[j]` (j ≥ k) có huy hiệu `j + 1`; bóng phép tính
   * hiện "= kết quả"; khay hiện ổ khoá. Mọi thứ nằm ở sân bóng (y ≥ 216), dưới dải huy hiệu khoá
   * của khung.
   */
  private showMiss(puzzle: NumberBalloonsPuzzle, k: number, wrongIndex: number) {
    const marks = this.marks;
    const right = this.balloons[puzzle.order[k]!];
    const wrong = this.balloons[wrongIndex];
    if (!marks || !right || !wrong) return;
    const look = this.look;
    const ink = this.ink;

    this.swaying = false;
    for (const b of this.balloons) {
      if (b.popped) continue;
      // Chạm nhầm ngay khi câu vừa hiện: dừng hiệu ứng phồng để không tranh `scale` với nhịp đập.
      this.tweens.killTweensOf(b.node);
      b.node.setScale(1).setAlpha(b === right || b === wrong ? 1 : DIM_ALPHA);
      b.inner.setScale(1);
      if (b.data.kind !== "num") this.revealResult(b);
      if (this.reduced || b === wrong) {
        b.node.setPosition(b.baseX, b.baseY).setAngle(0);
      } else {
        this.tweens.add({ targets: b.node, x: b.baseX, y: b.baseY, angle: 0, duration: FADE_MS });
      }
    }

    // Quả lẽ ra phải chạm: vòng nét đứt, nhịp nhẹ.
    const ring = this.add.graphics({ x: right.baseX, y: right.baseY });
    ring.lineStyle(5, ink.cardFg, 1);
    strokeDashed(ring, ellipsePoints(0, 0, look.rx + 18, look.ry + 18), 14, 10);
    marks.add(ring);
    if (!this.reduced) {
      this.tweens.add({
        targets: [ring, right.node],
        scale: 1.06,
        duration: 300,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // Quả nhầm: rung ngang, hai nét rung, dấu ✗.
    const shake = this.add.graphics({ x: wrong.baseX, y: wrong.baseY });
    drawShakeMarks(shake, look, ink);
    const cross = this.add.graphics({
      x: wrong.baseX + look.cross.x,
      y: wrong.baseY + look.cross.y,
    });
    drawCross(cross, ink);
    marks.add([shake, cross]);
    if (!this.reduced) {
      this.tweens.add({
        targets: wrong.node,
        x: wrong.baseX + 10,
        duration: SHAKE_MS / 4,
        yoyo: true,
        repeat: 1,
        ease: "Sine.easeInOut",
      });
    }

    // Thứ tự đúng cho các bóng còn trên sân, đánh tiếp sau số ô đã đầy trong khay.
    for (let j = k; j < puzzle.order.length; j++) {
      const b = this.balloons[puzzle.order[j]!];
      if (!b) continue;
      const x = b.baseX + look.badge.x;
      const y = b.baseY + look.badge.y;
      const badge = this.add.graphics({ x, y });
      drawBadge(badge, ink);
      const num = this.add.container(x, y, [this.label(String(j + 1), BADGE_FONT, ink.cardFg)]);
      marks.add([badge, num]);
    }

    const lock = this.add.graphics({ x: CENTER_X, y: TRAY_Y + 2 });
    drawLock(lock, ink);
    this.tray?.add(lock);
  }

  /** Bóng phép tính lúc khoá: đẩy biểu thức lên, thêm "= kết quả" bên dưới. */
  private revealResult(b: LiveBalloon) {
    b.label.y -= RESULT_LIFT;
    b.inner.add(this.label(`= ${formatNumber(b.data.value)}`, RESULT_FONT, BALLOON_INK, RESULT_Y));
  }
}
