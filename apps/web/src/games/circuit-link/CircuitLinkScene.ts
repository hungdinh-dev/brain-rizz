import {
  CIRCUIT_E,
  CIRCUIT_N,
  CIRCUIT_S,
  CIRCUIT_W,
  type CircuitLinkPuzzle,
  circuitLink,
  circuitLinkDecoyPorts,
  circuitLinkFill,
  circuitLinkPowered,
  circuitTileKind,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import type { MinigameBridge } from "../types";

/*
 * Nối mạch — chọn thẻ mảnh dây (Siêu khó: cặp mảnh) lấp ô trống để điện chạy từ pin tới bóng đèn.
 * Đặc tả: docs/04-minigames/circuit-link.md (mục "Ghi chú cho FE"). Chưa có bản mẫu.
 *
 * Scene không vẽ chữ. Mọi nét (dây, pin, đèn, thẻ) vẽ MỘT lần ra canvas 2D làm texture, khoá theo
 * hình + màu; mỗi câu chỉ đặt ảnh. Mọi đoạn dây trên bảng (đường chính, nhánh cụt, mảnh nhiễu, dây
 * mồi) dùng chung một texture theo bitmask nên trông giống hệt nhau; chỉ khi chấm xong mới tô điện.
 */

// ─── Bố cục (px trong khung 720×1280) ───────────────────────────────────────────────────────────

/** Tâm lưới; bảng mạch (mặt bảng phấn) y 250–900, đủ lưới 5 × 5 + lề 64 px cho pin/đèn. */
const BOARD = { x: 360, y: 575 } as const;
const SLATE = { x: 28, y: 250, w: 664, h: 650, r: 28, edge: 5, shadow: 8 } as const;
/** Cạnh ô theo cạnh lưới. */
const CELL: Readonly<Record<number, number>> = { 3: 140, 4: 120, 5: 104 };

/** Dải nhắc luật: viên thuốc kem, icon pin → mũi tên → bóng đèn (huy hiệu khoá được phép che). */
const PILL = { x: 360, y: 150, w: 260, h: 56, r: 28, edge: 4, shadow: 6 } as const;

/** Thẻ: một hàng y 960–1120, 152 × 160, khe 16 px; Mầm 3 thẻ đặt giữa. */
const CARD = { y: 1040, w: 152, h: 160, gap: 16, r: 24, edge: 4, shadow: 8, lift: 4 } as const;
/** Mảnh trên thẻ: 1 ô thì 96 px ở giữa; Siêu khó hai mảnh 64 px cạnh nhau, huy hiệu ●/▲ bên dưới. */
const PIECE_ONE = 96;
const PIECE_TWO = { size: 64, dx: 37, y: -12, badgeY: 50 } as const;
/** Vòng vàng quanh thẻ đúng (ngoài viền thẻ), huy hiệu ✓/✗ ở góc trên phải thẻ. */
const RING = { gap: 4, width: 8, ink: 5 } as const;
const MARK_AT = { x: CARD.w / 2 - 10, y: -CARD.h / 2 + 10 } as const;
const MARK_R = 20;
/** Huy hiệu ●/▲ nối ô thiếu với mảnh trên thẻ (Siêu khó). */
const BADGE_R = 15;
const BADGE_INSET = 19;

/** Nét dây trên bảng: phấn dày 14 px, nút tròn 18 px ở tâm (ngã ba, chữ thập, đầu cụt). */
interface WireStyle {
  width: number;
  node: number;
  /** Đầu tròn của dây chĩa vào ô không mở cổng ngược lại (đầu hở). */
  knob: number;
  /** Bán kính bo góc trong của khúc cua. */
  bend: number;
  /** Quầng quanh nét (độ rộng thêm) và độ đậm quầng. */
  halo: number;
  haloAlpha: number;
}

const BOARD_WIRE = { width: 14, node: 9, knob: 9, halo: 8 } as const;

// ─── Nhịp hiệu ứng (mỗi hiệu ứng ≤ 400 ms) ────────────────────────────────────────────────────

/** Câu mới: bảng và thẻ hiện mờ dần, phóng 0,96 → 1; nhận chạm ngay. */
const APPEAR_MS = 120;
const APPEAR_SCALE = 0.96;
/** Đúng: mảnh bay vào ô, dòng điện chạy dọc đường (≤ 25 ms mỗi ô), câu mới sau 350 ms. */
const FLY_MS = 110;
const RUN_MS = 200;
const STEP_MS = 25;
const SOLVED_MS = 350;
/** Sai: đặt thử thẻ đã chọn (điện chạy tới chỗ hở), rồi đổi sang thẻ đúng. */
const TRY_MS = 520;
const SHAKE_MS = 200;
const SHAKE_PX = 8;
const PRESS_MS = 70;
const PRESS_SCALE = 0.97;
/** Dây mồi nháy đỏ một lần. */
const FLASH_IN_MS = 120;
const FLASH_HOLD_MS = 160;
/** Xem trước khi rê chuột: mảnh mờ 40 % trong ô thiếu. */
const PREVIEW_ALPHA = 0.4;
/** Các thẻ không liên quan mờ còn 35 % khi sai. */
const DIM_ALPHA = 0.35;
const DIM_MS = 120;

// ─── Hình ──────────────────────────────────────────────────────────────────────────────────────

const PORTS = [CIRCUIT_N, CIRCUIT_E, CIRCUIT_S, CIRCUIT_W] as const;
const VEC: Readonly<Record<number, readonly [number, number]>> = {
  [CIRCUIT_N]: [0, -1],
  [CIRCUIT_E]: [1, 0],
  [CIRCUIT_S]: [0, 1],
  [CIRCUIT_W]: [-1, 0],
};
const OPPOSITE: Readonly<Record<number, number>> = {
  [CIRCUIT_N]: CIRCUIT_S,
  [CIRCUIT_E]: CIRCUIT_W,
  [CIRCUIT_S]: CIRCUIT_N,
  [CIRCUIT_W]: CIRCUIT_E,
};
/** Góc xoay để trục "hướng ra ngoài lưới" (+x khi vẽ pin/đèn) chĩa đúng phía. */
const SIDE_ANGLE: Readonly<Record<number, number>> = {
  [CIRCUIT_E]: 0,
  [CIRCUIT_S]: Math.PI / 2,
  [CIRCUIT_W]: Math.PI,
  [CIRCUIT_N]: -Math.PI / 2,
};

const TAU = Math.PI * 2;
/** Dấu "?" ở ô thiếu (vẽ bằng nét, đơn vị cho ô 104 px). */
const QUESTION = "M-12 -12 C-12 -29 13 -29 13 -14 C13 -3 0 -2 0 9";
const TICK = "M-10 1 L-3 8 L11 -8";
const CROSS = "M-13 -13 L13 13 M13 -13 L-13 13";
const PILL_ARROW = "M-20 0 L18 0 M8 -10 L18 0 L8 10";

/** Texture vẽ gấp đôi khung thiết kế cho nét sắc trên màn mật độ cao. */
const RES = 2;

// ─── Màu ───────────────────────────────────────────────────────────────────────────────────────

/** Token CSS (tự đổi theo sáng/tối), đọc một lần khi dựng scene. */
const TOKENS = {
  card: "--card",
  cardFg: "--card-foreground",
  border: "--border",
  sticker: "--sticker",
  /** Nền khung chơi (bg-muted của GameFrame): lớp phủ làm mờ thẻ. */
  muted: "--muted",
  /** Dòng điện, đèn sáng, ô thiếu, vòng thẻ đúng. */
  primary: "--primary",
  primaryFg: "--primary-foreground",
  destructive: "--destructive",
  /** Đỏ hồng `#e85d75` của đặc tả (thẻ sai, dây mồi) ở nền sáng. */
  memorize: "--color-memorize",
  board: "--board",
  chalk: "--chalk",
  ink: "--color-ink",
} as const;

type Tone = keyof typeof TOKENS;

/** Giá trị token ở nền sáng, chỉ dùng khi không đọc được biến CSS. */
const FALLBACK: Record<Tone, string> = {
  card: "#fff8ef",
  cardFg: "#1f1b3a",
  border: "#1f1b3a",
  sticker: "#1f1b3a",
  muted: "#f3eadf",
  primary: "#ffd166",
  primaryFg: "#1f1b3a",
  destructive: "#c93a55",
  memorize: "#e85d75",
  board: "#2d6a54",
  chalk: "#f6f3ea",
  ink: "#1f1b3a",
};

type Palette = Record<Tone, string> & {
  dark: boolean;
  /** Thẻ sai và dây mồi: đỏ hồng `#e85d75` ở nền sáng, hồng `--destructive` ở nền tối. */
  wrong: string;
};

function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const tones = Object.keys(TOKENS) as Tone[];
  const colors = Object.fromEntries(
    tones.map((tone) => {
      const raw = style.getPropertyValue(TOKENS[tone]).trim() || FALLBACK[tone];
      const num = Phaser.Display.Color.ValueToColor(raw).color;
      return [tone, `#${num.toString(16).padStart(6, "0")}`];
    }),
  ) as Record<Tone, string>;
  const dark = style.colorScheme === "dark";
  return { ...colors, dark, wrong: dark ? colors.destructive : colors.memorize };
}

const toColor = (css: string) => Phaser.Display.Color.ValueToColor(css).color;

// ─── Vẽ canvas 2D ──────────────────────────────────────────────────────────────────────────────

type Ctx = CanvasRenderingContext2D;
/** Khung vẽ [x0, y0, x1, y1] theo px thiết kế, gốc (0, 0) là điểm neo của ảnh. */
type Box = readonly [number, number, number, number];

interface Art {
  key: string;
  ox: number;
  oy: number;
  scale: number;
}

function roundRect(x: number, y: number, w: number, h: number, r: number): Path2D {
  const shape = new Path2D();
  shape.moveTo(x + r, y);
  shape.arcTo(x + w, y, x + w, y + h, r);
  shape.arcTo(x + w, y + h, x, y + h, r);
  shape.arcTo(x, y + h, x, y, r);
  shape.arcTo(x, y, x + w, y, r);
  shape.closePath();
  return shape;
}

function circle(cx: number, cy: number, r: number): Path2D {
  const shape = new Path2D();
  shape.arc(cx, cy, r, 0, TAU);
  return shape;
}

/** Nét đứt chia đều quanh hình chữ nhật bo góc để chỗ nối không lệch. */
function evenDash(w: number, h: number, r: number, dash: number, gap: number): number[] {
  const length = 2 * (w + h - 4 * r) + 2 * Math.PI * r;
  const k = length / Math.max(1, Math.round(length / (dash + gap))) / (dash + gap);
  return [dash * k, gap * k];
}

/** Vẽ lên canvas phụ rồi chép xuống với độ đậm `alpha` (quầng không bị đậm lên ở chỗ chồng nét). */
function layer(ctx: Ctx, alpha: number, draw: (c: Ctx) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = ctx.canvas.width;
  canvas.height = ctx.canvas.height;
  const c = canvas.getContext("2d");
  if (!c) return;
  c.setTransform(ctx.getTransform());
  c.lineJoin = "round";
  draw(c);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.drawImage(canvas, 0, 0);
  ctx.restore();
}

/** Băm khoá texture thành seed hạt phấn: cùng hình thì cùng hạt (không lộ ô nào thuộc đường chính). */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Hạt phấn: đục lỗ li ti vào nét vừa vẽ. Bộ sinh số trang trí, không phải logic câu đố. */
function grain(ctx: Ctx, density: number, seed: number) {
  const { width, height } = ctx.canvas;
  let s = seed;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#000000";
  const count = Math.round(width * height * density);
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = 0.2 + rand() * 0.6;
    ctx.fillRect(Math.floor(rand() * width), Math.floor(rand() * height), 1, 1);
  }
  ctx.restore();
}

/**
 * Hình một mảnh dây (gốc ở tâm ô, nửa cạnh `half`): mỗi cổng là nét từ tâm ra sát mép ô (đầu bằng
 * để hai ô thông nhau nối liền); cổng hở (`open`) dừng trước mép bằng đầu tròn. Khúc cua bo góc
 * trong; ngã ba, chữ thập, đầu cụt có nút tròn ở tâm.
 */
function wireShape(mask: number, open: number, half: number, s: WireStyle) {
  const lines = new Path2D();
  const dots = new Path2D();
  const end = (d: number): [number, number] => {
    const [vx, vy] = VEC[d] ?? [0, 0];
    const r = open & d ? half - s.knob : half;
    return [vx * r, vy * r];
  };
  const ports = PORTS.filter((d) => mask & d);
  const kind = circuitTileKind(mask);
  if (kind === "straight" || kind === "corner") {
    const [a, b] = ports.map(end) as [[number, number], [number, number]];
    lines.moveTo(a[0], a[1]);
    if (kind === "corner") lines.arcTo(0, 0, b[0], b[1], s.bend);
    lines.lineTo(b[0], b[1]);
  } else {
    for (const d of ports) {
      const [x, y] = end(d);
      lines.moveTo(0, 0);
      lines.lineTo(x, y);
    }
    if (kind !== "blank") {
      dots.moveTo(s.node, 0);
      dots.arc(0, 0, s.node, 0, TAU);
    }
  }
  for (const d of ports) {
    if (!(open & d)) continue;
    const [x, y] = end(d);
    dots.moveTo(x + s.knob, y);
    dots.arc(x, y, s.knob, 0, TAU);
  }
  return { lines, dots };
}

function drawWire(ctx: Ctx, mask: number, open: number, half: number, s: WireStyle, color: string) {
  const { lines, dots } = wireShape(mask, open, half, s);
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";
  layer(ctx, s.haloAlpha, (c) => {
    c.lineCap = "butt";
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = s.width + s.halo;
    c.stroke(lines);
    c.lineWidth = s.halo;
    c.fill(dots);
    c.stroke(dots);
  });
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s.width;
  ctx.stroke(lines);
  ctx.fill(dots);
}

/** Đổi điểm (x, y) của khung "hướng ra ngoài = +x" sang khung ảnh khi xoay `angle`. */
function turn(angle: number, x: number, y: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x * c - y * s, x * s + y * c];
}

/**
 * Pin (gốc = điểm nối ở mép ô, trục +x hướng ra ngoài lưới): dây nối ngắn, núm cực dương, thân
 * bo góc. Dấu + (gần lưới) và − (xa lưới) vẽ bằng nét, luôn đứng thẳng dù pin xoay.
 */
function drawBattery(ctx: Ctx, angle: number, color: string, stub: boolean, k = 1) {
  ctx.save();
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  if (stub) {
    // Dây nối giữ đúng độ dày dây trên bảng dù pin phóng theo cỡ ô.
    ctx.lineCap = "butt";
    ctx.lineWidth = BOARD_WIRE.width;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(13 * k, 0);
    ctx.stroke();
  }
  ctx.scale(k, k);
  ctx.fill(roundRect(12, -8, 8, 16, 2));
  ctx.lineWidth = 5;
  ctx.stroke(roundRect(20, -17, 38, 34, 7));
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4 * k;
  ctx.lineCap = "round";
  const [px, py] = turn(angle, 31 * k, 0);
  const [mx, my] = turn(angle, 48 * k, 0);
  const arm = 6 * k;
  ctx.beginPath();
  ctx.moveTo(px - arm, py);
  ctx.lineTo(px + arm, py);
  ctx.moveTo(px, py - arm);
  ctx.lineTo(px, py + arm);
  ctx.moveTo(mx - arm, my);
  ctx.lineTo(mx + arm, my);
  ctx.stroke();
  ctx.restore();
}

/**
 * Bóng đèn (gốc = điểm nối ở mép ô, trục +x hướng ra ngoài lưới): dây nối, đui có ren, bóng tròn.
 * Tắt: bóng phấn rỗng. Sáng: bóng vàng, dây tóc mực, tia sáng và quầng.
 */
function drawBulb(
  ctx: Ctx,
  angle: number,
  lit: boolean,
  colors: { line: string; light: string; ink: string },
  stub: boolean,
  k = 1,
) {
  const glass = { x: 35, r: 15 };
  ctx.save();
  ctx.rotate(angle);
  ctx.lineJoin = "round";
  if (lit) {
    const [gx, gr] = [glass.x * k, glass.r * k];
    const glow = ctx.createRadialGradient(gx, 0, gr * 0.6, gx, 0, gr * 2);
    glow.addColorStop(0, `${colors.light}99`);
    glow.addColorStop(1, `${colors.light}00`);
    ctx.fillStyle = glow;
    ctx.fill(circle(gx, 0, gr * 2));
  }
  if (stub) {
    // Dây nối giữ đúng độ dày dây trên bảng dù đèn phóng theo cỡ ô.
    ctx.strokeStyle = lit ? colors.light : colors.line;
    ctx.lineCap = "butt";
    ctx.lineWidth = BOARD_WIRE.width;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(11 * k, 0);
    ctx.stroke();
  }
  ctx.scale(k, k);
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 4;
  ctx.stroke(roundRect(10, -11, 12, 22, 3));
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(14, -11);
  ctx.lineTo(14, 11);
  ctx.moveTo(18, -11);
  ctx.lineTo(18, 11);
  ctx.stroke();
  const bulb = circle(glass.x, 0, glass.r);
  if (lit) {
    ctx.fillStyle = colors.light;
    ctx.fill(bulb);
  }
  ctx.strokeStyle = lit ? colors.light : colors.line;
  ctx.lineWidth = 4;
  ctx.stroke(bulb);
  ctx.strokeStyle = lit ? colors.ink : colors.line;
  ctx.globalAlpha = lit ? 1 : 0.75;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.stroke(new Path2D("M23 -5 L31 -5 Q38 -5 38 0 Q38 5 31 5 L23 5"));
  ctx.globalAlpha = 1;
  if (lit) {
    ctx.strokeStyle = colors.light;
    ctx.lineWidth = 4;
    for (const deg of [-70, -35, 0, 35, 70]) {
      const a = (deg * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(glass.x + Math.cos(a) * 19, Math.sin(a) * 19);
      ctx.lineTo(glass.x + Math.cos(a) * 24, Math.sin(a) * 24);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Ô kề phía `d` của ô `cell`, hoặc −1 nếu ra ngoài lưới (hình học lưới, không phải BFS). */
function neighborOf(size: number, cell: number, d: number): number {
  const x = cell % size;
  const y = (cell - x) / size;
  if (d === CIRCUIT_N) return y > 0 ? cell - size : -1;
  if (d === CIRCUIT_S) return y < size - 1 ? cell + size : -1;
  if (d === CIRCUIT_E) return x < size - 1 ? cell + 1 : -1;
  return x > 0 ? cell - 1 : -1;
}

function mediaMatches(query: string): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

// ─── Scene ─────────────────────────────────────────────────────────────────────────────────────

type GapState = "empty" | "filled" | "wrong" | "right";
type WireTone = "chalk" | "current" | "wrong";

interface GapView {
  cell: number;
  frame: Phaser.GameObjects.Image;
  mark: Phaser.GameObjects.Image;
}

interface CardView {
  /** Tâm thẻ (trong lớp thẻ): đứng yên, chứa lớp phủ làm mờ. */
  slot: Phaser.GameObjects.Container;
  /** Mặt thẻ: nhấc khi rê chuột, co khi nhấn, rung khi sai. */
  face: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Image;
  /** Vị trí mảnh thứ j trên thẻ (so với tâm thẻ) và cỡ mảnh. */
  pieces: readonly (readonly [number, number])[];
  pieceSize: number;
  hovered: boolean;
}

/** Nối mạch — chạm thẻ mảnh dây làm bóng đèn sáng. */
export default class CircuitLinkScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = false;
  private palette!: Palette;
  private reducedMotion = false;
  private canHover = false;
  private puzzle?: CircuitLinkPuzzle;
  /** Cạnh ô của câu hiện tại. */
  private cs = 0;
  /** Gốc của mọi thứ thuộc câu hiện tại; huỷ khi sang câu mới. */
  private round?: Phaser.GameObjects.Container;
  private board?: Phaser.GameObjects.Container;
  private wires?: Phaser.GameObjects.Container;
  private preview?: Phaser.GameObjects.Container;
  private current?: Phaser.GameObjects.Container;
  private alerts?: Phaser.GameObjects.Container;
  private cardLayer?: Phaser.GameObjects.Container;
  private fly?: Phaser.GameObjects.Container;
  private gaps: GapView[] = [];
  private cards: CardView[] = [];
  private bulb?: Phaser.GameObjects.Image;
  private batteryLit?: Phaser.GameObjects.Image;
  /** Hẹn giờ của câu hiện tại; huỷ hết khi sang câu mới hoặc rời màn. */
  private timers: Phaser.Time.TimerEvent[] = [];

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.locked = false;
    this.puzzle = undefined;
    this.gaps = [];
    this.cards = [];
    this.timers = [];
  }

  create() {
    const canvas = this.game.canvas;
    this.palette = readPalette(canvas.isConnected ? canvas : document.documentElement);
    this.reducedMotion = prefersReducedMotion();
    this.canHover = mediaMatches("(hover: hover) and (pointer: fine)");

    const cleanup = () => {
      this.clearTimers();
      this.tweens.killAll();
      this.locked = true;
      this.cards = [];
      this.gaps = [];
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);

    // Dải nhắc luật và mặt bảng giữ nguyên suốt vòng.
    this.place(this.pillArt(), PILL.x, PILL.y);
    this.place(this.slateArt(), 0, 0);
    this.showPuzzle();
  }

  // ── Câu đố ──

  private showPuzzle() {
    // Mọi hẹn giờ và tween đang chạy đều thuộc câu cũ: dừng trước khi huỷ.
    this.clearTimers();
    this.tweens.killAll();
    this.round?.destroy();
    this.locked = false;

    const puzzle = circuitLink.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    this.puzzle = puzzle;
    this.cs = CELL[puzzle.size] ?? CELL[5]!;

    const round = this.add.container(0, 0);
    const board = this.add.container(BOARD.x, BOARD.y);
    const gapLayer = this.add.container(0, 0);
    const wires = this.add.container(0, 0);
    const preview = this.add.container(0, 0);
    const terminals = this.add.container(0, 0);
    const current = this.add.container(0, 0);
    const alerts = this.add.container(0, 0);
    const badges = this.add.container(0, 0);
    board.add([gapLayer, wires, preview, terminals, current, alerts, badges]);
    const cardLayer = this.add.container(BOARD.x, CARD.y);
    const fly = this.add.container(0, 0);
    round.add([board, cardLayer, fly]);
    this.round = round;
    this.board = board;
    this.wires = wires;
    this.preview = preview;
    this.current = current;
    this.alerts = alerts;
    this.cardLayer = cardLayer;
    this.fly = fly;

    // Ô thiếu: viền nét đứt vàng nhạt + dấu "?"; Siêu khó thêm huy hiệu ●/▲ ở góc trên trái.
    this.gaps = puzzle.missing.map((cell, j) => {
      const [x, y] = this.cellXY(cell);
      const frame = this.place(this.gapArt("empty"), x, y);
      const mark = this.place(this.questionArt(), x, y);
      gapLayer.add([frame, mark]);
      if (puzzle.missing.length > 1) {
        const half = this.cs / 2;
        badges.add(this.place(this.badgeArt(j), x - half + BADGE_INSET, y - half + BADGE_INSET));
      }
      return { cell, frame, mark };
    });
    this.renderWires(puzzle.tiles);

    // Pin và bóng đèn ở lề ngoài, nối vào ô bằng một nét dây ngắn.
    const [bx, by] = this.terminalXY(puzzle.battery.cell, puzzle.battery.side);
    const [lx, ly] = this.terminalXY(puzzle.bulb.cell, puzzle.bulb.side);
    this.batteryLit = this.place(this.stubArt(puzzle.battery.side), bx, by).setVisible(false);
    this.bulb = this.place(this.bulbArt(puzzle.bulb.side, false), lx, ly);
    terminals.add([this.place(this.batteryArt(puzzle.battery.side), bx, by), this.batteryLit]);
    terminals.add(this.bulb);

    this.cards = puzzle.options.map((option, i) => this.buildCard(puzzle, option, i));

    if (this.reducedMotion) return;
    for (const target of [board, cardLayer]) {
      target.setAlpha(0).setScale(APPEAR_SCALE);
      this.tweens.add({ targets: target, alpha: 1, scale: 1, duration: APPEAR_MS });
    }
  }

  /** Dựng lại các mảnh dây trên bảng theo lưới `tiles` (đầu hở tính lại theo ô kề). */
  private renderWires(tiles: readonly number[]) {
    const puzzle = this.puzzle;
    const wires = this.wires;
    if (!puzzle || !wires) return;
    wires.removeAll(true);
    const chalk = toColor(this.palette.chalk);
    tiles.forEach((tile, cell) => {
      const [x, y] = this.cellXY(cell);
      if (tile !== 0) {
        wires.add(this.place(this.wireArt(tile, this.openPorts(cell, tiles), "chalk"), x, y));
      } else if (!puzzle.missing.includes(cell)) {
        // Ô không có dây: chấm phấn mờ ở tâm để thấy lưới.
        wires.add(this.add.circle(x, y, 4, chalk, 0.3));
      }
    });
  }

  /** Cổng của ô `cell` chĩa vào ô kề không mở cổng ngược lại, hoặc ra ngoài lưới mà không có pin/đèn. */
  private openPorts(cell: number, tiles: readonly number[]): number {
    const puzzle = this.puzzle;
    if (!puzzle) return 0;
    const tile = tiles[cell] ?? 0;
    let open = 0;
    for (const d of PORTS) {
      if (!(tile & d)) continue;
      const n = neighborOf(puzzle.size, cell, d);
      if (n < 0) {
        const wired =
          (puzzle.battery.cell === cell && puzzle.battery.side === d) ||
          (puzzle.bulb.cell === cell && puzzle.bulb.side === d);
        if (!wired) open |= d;
      } else if (!((tiles[n] ?? 0) & (OPPOSITE[d] ?? 0))) {
        open |= d;
      }
    }
    return open;
  }

  private cellXY(cell: number): [number, number] {
    const size = this.puzzle?.size ?? 3;
    const k = (size - 1) / 2;
    return [((cell % size) - k) * this.cs, (Math.floor(cell / size) - k) * this.cs];
  }

  /** Điểm nối của pin/đèn: giữa cạnh `side` của ô `cell`. */
  private terminalXY(cell: number, side: number): [number, number] {
    const [x, y] = this.cellXY(cell);
    const [vx, vy] = VEC[side] ?? [0, 0];
    return [x + (vx * this.cs) / 2, y + (vy * this.cs) / 2];
  }

  private setGap(j: number, state: GapState) {
    const gap = this.gaps[j];
    if (!gap) return;
    const art = this.gapArt(state);
    gap.frame.setTexture(art.key).setOrigin(art.ox, art.oy);
    gap.mark.setVisible(state === "empty");
  }

  // ── Thẻ ──

  private buildCard(puzzle: CircuitLinkPuzzle, option: readonly number[], i: number): CardView {
    const count = puzzle.options.length;
    const x = (i - (count - 1) / 2) * (CARD.w + CARD.gap);
    const two = option.length > 1;
    const pieceSize = two ? PIECE_TWO.size : PIECE_ONE;
    const pieces: [number, number][] = two
      ? [
          [-PIECE_TWO.dx, PIECE_TWO.y],
          [PIECE_TWO.dx, PIECE_TWO.y],
        ]
      : [[0, 0]];

    const shadow = this.add.graphics();
    shadow
      .fillStyle(toColor(this.palette.sticker))
      .fillRoundedRect(-CARD.w / 2, -CARD.h / 2 + CARD.shadow, CARD.w, CARD.h, CARD.r);
    const bg = this.place(this.cardArt(false));
    const face = this.add.container(0, 0, [bg]);
    option.forEach((tile, j) => {
      const [px, py] = pieces[j] ?? [0, 0];
      face.add(this.place(this.socketArt(pieceSize), px, py));
      face.add(this.place(this.pieceArt(tile, pieceSize), px, py));
      if (two) face.add(this.place(this.badgeArt(j), px, PIECE_TWO.badgeY));
    });
    const slot = this.add.container(x, 0, [shadow, face]);
    const view: CardView = { slot, face, bg, pieces, pieceSize, hovered: false };

    // Vùng chạm = cả thẻ (đứng yên khi mặt thẻ nhấc); ghi nhận ở pointerdown, một chạm là chốt.
    const zone = this.add.zone(x, 0, CARD.w, CARD.h + CARD.shadow).setInteractive({
      useHandCursor: true,
    });
    zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.answer(i, pointer));
    zone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
      if (!this.locked && this.canHover && !pointer.wasTouch) this.setHover(view, option, true);
    });
    zone.on("pointerout", () => {
      if (!this.locked) this.setHover(view, option, false);
    });
    this.cardLayer?.add([slot, zone]);
    return view;
  }

  /**
   * Rê chuột: thẻ nhấc 4 px, mảnh trên thẻ hiện mờ 40 % trong ô thiếu. Chỉ xem trước hình, không
   * chạy điện hay bật đèn (nếu không rê qua 4 thẻ là biết đáp án).
   */
  private setHover(view: CardView, option: readonly number[], on: boolean) {
    if (view.hovered === on) return;
    view.hovered = on;
    view.face.y = on ? -CARD.lift : 0;
    const puzzle = this.puzzle;
    const preview = this.preview;
    if (!puzzle || !preview) return;
    preview.removeAll(true);
    for (const gap of this.gaps) gap.mark.setVisible(!on);
    if (!on) return;
    const tiles = circuitLinkFill(puzzle, option);
    puzzle.missing.forEach((cell, j) => {
      const tile = option[j] ?? 0;
      const [x, y] = this.cellXY(cell);
      const art = this.wireArt(tile, this.openPorts(cell, tiles), "chalk");
      preview.add(this.place(art, x, y).setAlpha(PREVIEW_ALPHA));
    });
  }

  private clearHover() {
    const puzzle = this.puzzle;
    if (!puzzle) return;
    this.cards.forEach((view, i) => {
      this.setHover(view, puzzle.options[i] ?? [], false);
    });
  }

  // ── Trả lời ──

  private answer(choice: number, pointer: Phaser.Input.Pointer) {
    const puzzle = this.puzzle;
    if (this.locked || !puzzle) return;
    this.locked = true;

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const index = this.index;
    const correct = circuitLink.check(puzzle, choice);
    this.bridge.submit(index, choice);
    this.index += 1;

    this.clearHover();
    // Bảng và thẻ đang hiện dần thì hiện hẳn để thấy kết quả.
    for (const target of [this.board, this.cardLayer]) {
      if (!target) continue;
      this.tweens.killTweensOf(target);
      target.setAlpha(1).setScale(1);
    }
    const picked = this.cards[choice];
    if (picked && pointer.wasTouch && !this.reducedMotion) {
      this.tweens.add({
        targets: picked.face,
        scale: PRESS_SCALE,
        duration: PRESS_MS,
        yoyo: true,
      });
    }

    if (correct) {
      this.showSolved(puzzle, choice);
      this.after(SOLVED_MS, () => this.showPuzzle());
      return;
    }

    this.showMiss(puzzle, choice);
    // Hết khoá theo `lockedUntil` của server (không tự đếm 1,5 s) để khớp huy hiệu khoá của khung.
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive() || this.index !== index + 1) return;
      this.after(ms, () => this.showPuzzle());
    });
  }

  /** Đúng: mảnh bay từ thẻ vào ô thiếu, dòng điện chạy dọc đường từ pin tới đèn, đèn sáng. */
  private showSolved(puzzle: CircuitLinkPuzzle, choice: number) {
    const card = this.cards[choice];
    const option = puzzle.options[choice] ?? [];
    if (card) this.markRight(card);
    const land = () => {
      this.fill(option, "right");
      this.runCurrent(option);
    };
    if (this.reducedMotion || !card) {
      land();
      return;
    }
    this.flyPieces(card, option);
    this.after(FLY_MS, land);
  }

  /**
   * Sai: thẻ vừa chạm rung, viền gạch đứt đỏ + ✗; đặt thử thẻ đó vào ô thiếu để thấy điện dừng ở
   * chỗ hở, rồi đổi sang mảnh đáp án viền vàng, điện chạy tới đèn, dây mồi nháy đỏ; thẻ đúng vòng
   * vàng + ✓, thẻ khác mờ 35 %. Giảm chuyển động: bỏ rung, đặt thử và dòng điện chạy.
   */
  private showMiss(puzzle: CircuitLinkPuzzle, choice: number) {
    const picked = this.cards[choice];
    const right = this.cards[puzzle.answerIndex];
    const chosen = puzzle.options[choice] ?? [];
    const answer = puzzle.options[puzzle.answerIndex] ?? [];
    if (picked) this.markWrong(picked);

    const reveal = () => {
      this.current?.removeAll(true);
      this.batteryLit?.setVisible(false);
      this.fill(answer, "right");
      this.runCurrent(answer);
      this.flashDecoys(puzzle, answer);
      if (right) this.markRight(right);
      for (const view of this.cards) if (view !== picked && view !== right) this.dim(view);
    };
    if (this.reducedMotion) {
      reveal();
      return;
    }

    // Đặt thử: ô có mảnh khác đáp án viền gạch đứt đỏ; điện chạy từ pin tới đâu thì tô tới đó.
    this.fill(chosen, "filled");
    chosen.forEach((tile, j) => {
      if (tile !== answer[j]) this.setGap(j, "wrong");
    });
    this.runCurrent(chosen);
    this.after(TRY_MS, reveal);
  }

  /** Đặt `option` vào các ô thiếu (vẽ lại dây để đầu hở của ô kề đổi theo). */
  private fill(option: readonly number[], state: GapState) {
    const puzzle = this.puzzle;
    if (!puzzle) return;
    this.renderWires(circuitLinkFill(puzzle, option));
    puzzle.missing.forEach((_, j) => {
      this.setGap(j, state);
    });
  }

  /**
   * Tô dòng điện vàng từ pin khi đặt `option`: các ô của đường chính có điện theo thứ tự pin → đèn
   * (mỗi ô ≤ 25 ms, cả đường trong `RUN_MS`), sau cùng là các ô có điện khác (nhánh nối vào đường)
   * và bóng đèn nếu sáng. Giảm chuyển động: tô hết một lần.
   */
  private runCurrent(option: readonly number[]) {
    const puzzle = this.puzzle;
    const current = this.current;
    if (!puzzle || !current) return;
    const tiles = circuitLinkFill(puzzle, option);
    const powered = circuitLinkPowered(puzzle.size, tiles, puzzle.battery);
    const lit =
      ((tiles[puzzle.bulb.cell] ?? 0) & puzzle.bulb.side) !== 0 &&
      powered[puzzle.bulb.cell] === true;
    const along = puzzle.path.filter((cell) => powered[cell]);
    const rest = powered.flatMap((on, cell) => (on && !puzzle.path.includes(cell) ? [cell] : []));
    const step = this.reducedMotion ? 0 : Math.min(STEP_MS, RUN_MS / Math.max(1, along.length));

    const light = (cell: number) => {
      const [x, y] = this.cellXY(cell);
      const art = this.wireArt(tiles[cell] ?? 0, this.openPorts(cell, tiles), "current");
      current.add(this.place(art, x, y));
    };
    const at = (ms: number, run: () => void) => {
      if (ms <= 0) run();
      else this.after(ms, run);
    };

    this.batteryLit?.setVisible(true);
    along.forEach((cell, k) => {
      at(k * step, () => light(cell));
    });
    at(along.length * step, () => {
      for (const cell of rest) light(cell);
      if (!lit || !this.bulb) return;
      const art = this.bulbArt(puzzle.bulb.side, true);
      this.bulb.setTexture(art.key).setOrigin(art.ox, art.oy);
    });
  }

  /** Dây mồi chĩa vào ô thiếu (không nối về pin hay đèn) nháy đỏ một lần. Giảm chuyển động: tô đỏ. */
  private flashDecoys(puzzle: CircuitLinkPuzzle, answer: readonly number[]) {
    const alerts = this.alerts;
    if (!alerts) return;
    const tiles = circuitLinkFill(puzzle, answer);
    puzzle.missing.forEach((gap, j) => {
      for (const d of circuitLinkDecoyPorts(puzzle, answer, j)) {
        const cell = neighborOf(puzzle.size, gap, d);
        if (cell < 0) continue;
        const [x, y] = this.cellXY(cell);
        const art = this.wireArt(tiles[cell] ?? 0, this.openPorts(cell, tiles), "wrong");
        const image = this.place(art, x, y);
        alerts.add(image);
        if (this.reducedMotion) continue;
        image.setAlpha(0);
        this.tweens.add({
          targets: image,
          alpha: 1,
          duration: FLASH_IN_MS,
          hold: FLASH_HOLD_MS,
          yoyo: true,
        });
      }
    });
  }

  /** Mảnh trên thẻ bay vào ô thiếu tương ứng (phóng từ cỡ thẻ lên cỡ ô). */
  private flyPieces(card: CardView, option: readonly number[]) {
    const puzzle = this.puzzle;
    const fly = this.fly;
    if (!puzzle || !fly) return;
    option.forEach((tile, j) => {
      const [px, py] = card.pieces[j] ?? [0, 0];
      const cell = puzzle.missing[j];
      if (cell === undefined) return;
      const [gx, gy] = this.cellXY(cell);
      const image = this.place(
        this.pieceArt(tile, card.pieceSize),
        BOARD.x + card.slot.x + px,
        CARD.y + card.face.y + py,
      );
      fly.add(image);
      const start = image.scale;
      this.tweens.add({
        targets: image,
        x: BOARD.x + gx,
        y: BOARD.y + gy,
        scale: (start * this.cs) / card.pieceSize,
        duration: FLY_MS,
        ease: "Quad.easeIn",
        onComplete: () => image.destroy(),
      });
    });
  }

  /** Thẻ đúng: vòng vàng viền mực quanh thẻ + huy hiệu ✓. */
  private markRight(card: CardView) {
    card.face.addAt(this.place(this.ringArt()), 0);
    card.face.add(this.place(this.tickArt(), MARK_AT.x, MARK_AT.y));
  }

  /** Thẻ vừa chạm sai: viền gạch đứt đỏ + ✗, rung ngang ±8 px. */
  private markWrong(card: CardView) {
    const art = this.cardArt(true);
    card.bg.setTexture(art.key).setOrigin(art.ox, art.oy);
    card.face.add(this.place(this.crossArt(), MARK_AT.x, MARK_AT.y));
    if (this.reducedMotion) return;
    const face = card.face;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: SHAKE_MS,
      onUpdate: (tween) => {
        face.x = SHAKE_PX * Math.sin((tween.getValue() ?? 0) * Math.PI * 4);
      },
      onComplete: () => {
        face.x = 0;
      },
    });
  }

  /**
   * Làm mờ thẻ còn 35 % bằng lớp phủ màu nền khung (65 %). Đặt alpha cho cả nhóm thì Phaser tính
   * riêng từng lớp (bóng đổ lộ qua mặt thẻ); nền dưới là một màu nên phủ cho kết quả như làm mờ.
   */
  private dim(card: CardView) {
    const veil = this.add
      .rectangle(
        0,
        CARD.shadow / 2,
        CARD.w + 8,
        CARD.h + CARD.shadow + 8,
        toColor(this.palette.muted),
        1,
      )
      .setAlpha(0);
    card.slot.add(veil);
    const alpha = 1 - DIM_ALPHA;
    if (this.reducedMotion) veil.setAlpha(alpha);
    else this.tweens.add({ targets: veil, alpha, duration: DIM_MS });
  }

  private after(ms: number, callback: () => void) {
    this.timers.push(this.time.delayedCall(ms, callback));
  }

  private clearTimers() {
    for (const timer of this.timers) timer.remove(false);
    this.timers = [];
  }

  // ── Texture vẽ bằng canvas 2D (khoá theo hình + màu nên mỗi hình chỉ vẽ một lần mỗi vòng) ──

  private place(art: Art, x = 0, y = 0): Phaser.GameObjects.Image {
    return this.add.image(x, y, art.key).setOrigin(art.ox, art.oy).setScale(art.scale);
  }

  /** Vẽ một texture: `box` theo px thiết kế, texture vẽ gấp `RES` lần, ảnh đặt với tỉ lệ 1/RES. */
  private paint(name: string, box: Box, draw: (ctx: Ctx) => void): Art {
    const [x0, y0, x1, y1] = box;
    const w = Math.ceil((x1 - x0) * RES);
    const h = Math.ceil((y1 - y0) * RES);
    const key = `circuit-link/${name}`;
    if (!this.textures.exists(key)) {
      const texture = this.textures.createCanvas(key, w, h);
      if (texture) {
        const ctx = texture.context;
        ctx.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        draw(ctx);
        texture.refresh();
      }
    }
    return { key, ox: (-x0 * RES) / w, oy: (-y0 * RES) / h, scale: 1 / RES };
  }

  /**
   * Mảnh dây trên bảng (cỡ ô): phấn trắng, hoặc dòng điện vàng / dây mồi đỏ phủ đúng hình đó.
   * Khoá chỉ gồm cỡ ô, bitmask, cổng hở và màu: dây thuộc đường chính hay không đều cùng một ảnh.
   */
  private wireArt(mask: number, open: number, tone: WireTone): Art {
    const cs = this.cs;
    const half = cs / 2;
    const p = this.palette;
    const color = tone === "chalk" ? p.chalk : tone === "current" ? p.primary : p.wrong;
    const style: WireStyle = {
      ...BOARD_WIRE,
      bend: Math.round(cs * 0.24),
      halo: tone === "chalk" ? BOARD_WIRE.halo : 14,
      haloAlpha: tone === "chalk" ? 0.16 : 0.4,
    };
    const name = `wire-${cs}-${mask}-${open}-${tone}-${color}`;
    return this.paint(name, [-half, -half, half, half], (ctx) => {
      drawWire(ctx, mask, open, half, style, color);
      if (tone === "chalk") grain(ctx, 0.14, hash(name));
    });
  }

  /** Mảnh trên thẻ: nét mực (nền tối: kem), không có đầu hở. */
  private pieceArt(mask: number, size: number): Art {
    const half = size / 2;
    const color = this.palette.cardFg;
    const width = Math.round(size * 0.125);
    const style: WireStyle = {
      width,
      node: Math.round(width * 0.65),
      knob: 0,
      bend: Math.round(size * 0.24),
      halo: 0,
      haloAlpha: 0,
    };
    return this.paint(`piece-${size}-${mask}-${color}`, [-half, -half, half, half], (ctx) => {
      drawWire(ctx, mask, 0, half, style, color);
    });
  }

  /** Khung ô mờ quanh mảnh trên thẻ, để thấy mép ô mà dây chạm tới. */
  private socketArt(size: number): Art {
    const half = size / 2;
    const color = this.palette.cardFg;
    return this.paint(`socket-${size}-${color}`, [-half, -half, half, half], (ctx) => {
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke(roundRect(-half + 1, -half + 1, size - 2, size - 2, 8));
    });
  }

  /** Viền ô thiếu: nét đứt vàng nhạt (trống / đặt thử), gạch đứt đỏ (mảnh sai), vàng liền (đáp án). */
  private gapArt(state: GapState): Art {
    const cs = this.cs;
    const half = cs / 2;
    const p = this.palette;
    const inset = 7;
    const size = cs - 2 * inset;
    const r = 14;
    return this.paint(
      `gap-${cs}-${state}-${p.primary}-${p.wrong}`,
      [-half, -half, half, half],
      (ctx) => {
        const shape = roundRect(-half + inset, -half + inset, size, size, r);
        ctx.lineCap = "butt";
        if (state === "right") {
          ctx.strokeStyle = p.primary;
          ctx.lineWidth = 6;
          ctx.stroke(shape);
          return;
        }
        ctx.setLineDash(evenDash(size, size, r, state === "wrong" ? 14 : 11, 9));
        ctx.strokeStyle = state === "wrong" ? p.wrong : p.primary;
        ctx.globalAlpha = state === "wrong" ? 1 : 0.8;
        ctx.lineWidth = state === "wrong" ? 6 : 4;
        ctx.stroke(shape);
      },
    );
  }

  /** Dấu "?" vẽ bằng nét vàng nhạt ở giữa ô thiếu. */
  private questionArt(): Art {
    const cs = this.cs;
    const half = cs / 2;
    const color = this.palette.primary;
    return this.paint(`question-${cs}-${color}`, [-half, -half, half, half], (ctx) => {
      ctx.scale(cs / 104, cs / 104);
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 7;
      ctx.stroke(new Path2D(QUESTION));
      ctx.fill(circle(0, 22, 4.5));
    });
  }

  /** Huy hiệu nối ô thiếu với mảnh trên thẻ (Siêu khó): ● cho ô thứ nhất, ▲ cho ô thứ hai. */
  private badgeArt(j: number): Art {
    const p = this.palette;
    const r = BADGE_R + 3;
    return this.paint(`badge-${j}-${p.card}-${p.cardFg}-${p.sticker}`, [-r, -r, r, r], (ctx) => {
      const disc = circle(0, 0, BADGE_R);
      ctx.fillStyle = p.card;
      ctx.fill(disc);
      ctx.strokeStyle = p.sticker;
      ctx.lineWidth = 3;
      ctx.stroke(disc);
      ctx.fillStyle = p.cardFg;
      if (j === 0) {
        ctx.fill(circle(0, 0, 6.5));
      } else {
        ctx.fill(new Path2D("M0 -8 L8 6 L-8 6 Z"));
      }
    });
  }

  /** Cỡ pin/đèn theo cỡ ô (vẽ chuẩn cho ô 104 px của lưới 5 × 5, vừa lề 64 px). */
  private terminalScale(): number {
    return this.cs / CELL[5]!;
  }

  /** Pin ở phía `side` (xoay theo phía, dấu +/− đứng thẳng). */
  private batteryArt(side: number): Art {
    const color = this.palette.chalk;
    const k = this.terminalScale();
    return this.paint(`battery-${this.cs}-${side}-${color}`, [-90, -90, 90, 90], (ctx) => {
      drawBattery(ctx, SIDE_ANGLE[side] ?? 0, color, true, k);
    });
  }

  /** Nét dây nối pin tô vàng khi điện chạy. */
  private stubArt(side: number): Art {
    const color = this.palette.primary;
    const k = this.terminalScale();
    return this.paint(`stub-${this.cs}-${side}-${color}`, [-24, -24, 24, 24], (ctx) => {
      ctx.rotate(SIDE_ANGLE[side] ?? 0);
      ctx.strokeStyle = color;
      ctx.lineCap = "butt";
      ctx.lineWidth = BOARD_WIRE.width;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(13 * k, 0);
      ctx.stroke();
    });
  }

  private bulbArt(side: number, lit: boolean): Art {
    const p = this.palette;
    const colors = { line: p.chalk, light: p.primary, ink: p.ink };
    const k = this.terminalScale();
    const name = `bulb-${this.cs}-${side}-${lit}-${p.chalk}-${p.primary}`;
    return this.paint(name, [-90, -90, 90, 90], (ctx) => {
      drawBulb(ctx, SIDE_ANGLE[side] ?? 0, lit, colors, true, k);
    });
  }

  /** Mặt bảng mạch: màu `--board`, viền mực, bóng đặc; hơi tối ở mép như bảng phấn. */
  private slateArt(): Art {
    const p = this.palette;
    const { x, y, w, h, r, edge, shadow } = SLATE;
    const box = [x - 4, y - 4, x + w + 4, y + h + shadow + 4] as const;
    return this.paint(`slate-${p.board}-${p.sticker}`, box, (ctx) => {
      ctx.fillStyle = p.sticker;
      ctx.fill(roundRect(x, y + shadow, w, h, r));
      const face = roundRect(x, y, w, h, r);
      ctx.fillStyle = p.board;
      ctx.fill(face);
      const vignette = ctx.createRadialGradient(
        x + w / 2,
        y + h / 2,
        w * 0.3,
        x + w / 2,
        y + h / 2,
        h * 0.75,
      );
      vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
      vignette.addColorStop(1, "rgba(0, 0, 0, 0.28)");
      ctx.fillStyle = vignette;
      ctx.fill(face);
      ctx.strokeStyle = p.border;
      ctx.lineWidth = edge;
      ctx.stroke(face);
    });
  }

  /** Dải nhắc luật: viên thuốc kem viền mực, icon pin → mũi tên → bóng đèn sáng, không chữ. */
  private pillArt(): Art {
    const p = this.palette;
    const { w, h, r, edge, shadow } = PILL;
    const box = [-w / 2 - 4, -h / 2 - 4, w / 2 + 4, h / 2 + shadow + 4] as const;
    return this.paint(`pill-${p.card}-${p.cardFg}-${p.sticker}-${p.primary}`, box, (ctx) => {
      ctx.fillStyle = p.sticker;
      ctx.fill(roundRect(-w / 2, -h / 2 + shadow, w, h, r));
      const face = roundRect(-w / 2, -h / 2, w, h, r);
      ctx.fillStyle = p.card;
      ctx.fill(face);
      ctx.strokeStyle = p.border;
      ctx.lineWidth = edge;
      ctx.stroke(face);
      // Pin nằm ngang, cực dương chĩa về mũi tên.
      ctx.save();
      ctx.translate(-50, 0);
      ctx.scale(0.72, 0.72);
      drawBattery(ctx, Math.PI, p.cardFg, false);
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = p.cardFg;
      ctx.lineWidth = 5;
      ctx.stroke(new Path2D(PILL_ARROW));
      ctx.restore();
      // Bóng đèn đứng (đui ở dưới), đang sáng.
      ctx.save();
      ctx.translate(76, 19);
      ctx.scale(0.72, 0.72);
      drawBulb(ctx, -Math.PI / 2, true, { line: p.cardFg, light: p.primary, ink: p.ink }, false);
      ctx.restore();
    });
  }

  /** Mặt thẻ: nền kem (nền tối: tím thẻ), viền mực 4; thẻ chọn sai thêm viền gạch đứt đỏ. */
  private cardArt(wrong: boolean): Art {
    const p = this.palette;
    const { w, h, r, edge } = CARD;
    const box = [-w / 2 - 4, -h / 2 - 4, w / 2 + 4, h / 2 + 4] as const;
    return this.paint(`card-${wrong}-${p.card}-${p.border}-${p.wrong}`, box, (ctx) => {
      const face = roundRect(-w / 2, -h / 2, w, h, r);
      ctx.fillStyle = p.card;
      ctx.fill(face);
      ctx.strokeStyle = p.border;
      ctx.lineWidth = edge;
      ctx.stroke(face);
      if (!wrong) return;
      const inner = roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, r - 1);
      ctx.setLineDash(evenDash(w - 2, h - 2, r - 1, 16, 10));
      ctx.lineCap = "butt";
      ctx.strokeStyle = p.wrong;
      ctx.lineWidth = 7;
      ctx.stroke(inner);
    });
  }

  /** Vòng vàng viền mực quanh thẻ đúng. */
  private ringArt(): Art {
    const p = this.palette;
    const { w, h, r } = CARD;
    const grow = RING.gap + RING.width / 2;
    const pad = grow + RING.width / 2 + RING.ink + 2;
    const box = [-w / 2 - pad, -h / 2 - pad, w / 2 + pad, h / 2 + pad] as const;
    return this.paint(`ring-${p.border}-${p.primary}`, box, (ctx) => {
      const shape = roundRect(-w / 2 - grow, -h / 2 - grow, w + 2 * grow, h + 2 * grow, r + grow);
      ctx.strokeStyle = p.border;
      ctx.lineWidth = RING.width + 2 * RING.ink;
      ctx.stroke(shape);
      ctx.strokeStyle = p.primary;
      ctx.lineWidth = RING.width;
      ctx.stroke(shape);
    });
  }

  /** Huy hiệu ✓: tròn vàng viền mực có bóng. */
  private tickArt(): Art {
    const p = this.palette;
    const r = MARK_R + 6;
    return this.paint(
      `tick-${p.sticker}-${p.primary}-${p.primaryFg}`,
      [-r, -r, r, r + 4],
      (ctx) => {
        ctx.fillStyle = p.sticker;
        ctx.fill(circle(0, 4, MARK_R));
        const disc = circle(0, 0, MARK_R);
        ctx.fillStyle = p.primary;
        ctx.fill(disc);
        ctx.strokeStyle = p.sticker;
        ctx.lineWidth = 4;
        ctx.stroke(disc);
        ctx.strokeStyle = p.primaryFg;
        ctx.lineWidth = 5;
        ctx.stroke(new Path2D(TICK));
      },
    );
  }

  /** Dấu ✗ đỏ viền trắng. */
  private crossArt(): Art {
    const color = this.palette.wrong;
    return this.paint(`cross-${color}`, [-24, -24, 24, 24], (ctx) => {
      const shape = new Path2D(CROSS);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 16;
      ctx.stroke(shape);
      ctx.strokeStyle = color;
      ctx.lineWidth = 8;
      ctx.stroke(shape);
    });
  }
}
