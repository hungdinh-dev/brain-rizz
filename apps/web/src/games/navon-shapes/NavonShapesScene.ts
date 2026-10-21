import {
  NAVON_GRID,
  NAVON_MASKS,
  NAVON_SHAPES_LEVELS,
  type NavonAsk,
  type NavonCell,
  type NavonShape,
  type NavonShapesPuzzle,
  navonShapes,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import type { Ctx } from "../_shared/canvas";
import { type Art, type Box, circle, grain, paintArt, placeArt, roundRect } from "../_shared/chalk";
import { shouldIgnoreGameKey } from "../keyboard";
import type { MinigameBridge } from "../types";

/*
 * Hình to hình nhỏ — một HÌNH TO ghép từ nhiều HÌNH NHỎ. Khung tròn → chạm nút có hình to; khung
 * vuông (từ Khó) → chạm nút có hình nhỏ. Đặc tả: docs/04-minigames/navon-shapes.md ("Ghi chú cho FE",
 * "Hiện đáp án đúng khi sai").
 *
 * Khung là DẤU HIỆU LUẬT nên vẽ khác hẳn hình: khung là một tấm bảng (tròn / vuông, viền sticker)
 * có NÉT VIỀN phấn bên trong (khung tròn một nét liền, khung vuông một chuỗi ô vuông nhỏ rỗng); hình
 * to, hình nhỏ và hình trên nút luôn là phấn ĐẶC. Không phân biệt bằng màu.
 *
 * Mọi hình vẽ một lần ra canvas 2D rồi dùng làm texture (khoá theo hình + màu), mỗi câu chỉ đặt ảnh.
 */

// ─── Màu ────────────────────────────────────────────────────────────────────────────────────────

/** Token CSS (tự đổi theo sáng/tối), đọc lại mỗi câu. */
const TOKENS = {
  /** Mặt nút, chip luật, nền thanh khoá. */
  card: "--card",
  /** Hình trên nút, biểu tượng chip, viền thanh khoá. */
  text: "--card-foreground",
  /** Viền nút/chip, bóng đổ, viền ngoài kính lúp. */
  sticker: "--sticker",
  /** Nút đúng, dải vàng theo hình to, viền kính lúp, khung nháy. */
  primary: "--primary",
  /** Dấu ✗. */
  destructive: "--destructive",
  /** Hình nhỏ và khung (phấn). */
  chalk: "--chalk",
  /** Tấm bảng của khung, lòng kính lúp. */
  board: "--board",
  /** Hình trên nút đang sáng vàng. */
  ink: "--color-ink",
} as const;

type Tone = keyof typeof TOKENS;

/** Giá trị token ở nền sáng, chỉ dùng khi không đọc được biến CSS. */
const FALLBACK: Record<Tone, string> = {
  card: "#fff8ef",
  text: "#1f1b3a",
  sticker: "#1f1b3a",
  primary: "#ffd166",
  destructive: "#c93a55",
  chalk: "#f6f3ea",
  board: "#2d6a54",
  ink: "#1f1b3a",
};

/** Lòng kính lúp: bóng tối phủ lên mặt bảng (`--board-shade`, dạng `rgb(… / a)` nên đọc thô). */
const SHADE_TOKEN = "--board-shade";
const SHADE_FALLBACK = "rgba(0, 0, 0, 0.22)";
/** Viền trắng dưới dấu ✗. */
const HALO = "#ffffff";

interface Paint {
  num: number;
  css: string;
}

type Palette = Record<Tone, Paint> & { shade: string; id: string };

function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const tones = Object.keys(TOKENS) as Tone[];
  const paints = tones.map((tone): [Tone, Paint] => {
    const raw = style.getPropertyValue(TOKENS[tone]).trim() || FALLBACK[tone];
    const num = Phaser.Display.Color.ValueToColor(raw).color;
    return [tone, { num, css: `#${num.toString(16).padStart(6, "0")}` }];
  });
  const shade = style.getPropertyValue(SHADE_TOKEN).trim() || SHADE_FALLBACK;
  return {
    ...(Object.fromEntries(paints) as Record<Tone, Paint>),
    shade,
    id: `${paints.map(([, paint]) => paint.css.slice(1)).join("")}${shade.replace(/\s+/g, "")}`,
  };
}

// ─── Bố cục (px trong khung 720×1280), theo bảng Ghi chú cho FE ─────────────────────────────────

/** Tâm khung (= tâm lưới hình to). */
const FRAME = { x: 360, y: 580 };
/**
 * Thẻ khung chơi là giấy (`bg-muted`), không phải bảng, nên khung là một TẤM BẢNG (`--board`, viền
 * sticker, bóng đổ) và phấn vẽ trên đó.
 */
const PANEL = { edge: 5, shadow: 7 };
/**
 * Khung tròn: tấm bảng bán kính 328 (x 32–688, y 252–908); vòng phấn liền dày 12 ở bán kính
 * 308–320. Góc xa nhất của hình nhỏ ở góc lưới cách tâm ~300 → cách mép trong vòng phấn ≥ 8.
 */
const RING = { outer: 328, r: 314, width: 12 };
/**
 * Khung vuông: tấm bảng 640 × 640 (x 40–680, y 260–900), góc vuông không bo; viền phấn là chuỗi
 * 20 ô vuông rỗng 22 × 22 mỗi cạnh (khe ~9,4), cách mép tấm bảng 11.
 */
const SQUARE = { size: 640, chain: 618, link: 22, perSide: 20, edge: 6 };
/** Lưới hình to 448 × 448, ô 64, góc trên trái (136, 356). */
const CELL = 448 / NAVON_GRID;
/** Cỡ hình nhỏ (~72 % ô). */
const SMALL = 46;
/** Hiện đáp án, khung tròn: đĩa vàng sau mỗi hình nhỏ. */
const BAND = { r: CELL * 0.6, alpha: 0.35, edge: 5 };
/** Hiện đáp án, khung vuông: kính lúp phóng một hình nhỏ ×2,2. */
const LENS = { zoom: 2.2, r: 76, ring: 8, handle: 46 };
/** Hiện đáp án, khung vuông: độ mờ của hình to. */
const LOCAL_DIM = 0.5;

/** Chip luật (Mầm → Khó): y 180–236, căn giữa. */
const CHIP = { y: 208, h: 56, half: 164, sep: 24, shadow: 5, edge: 4 };
/** Nửa chip hiện dưới khung lúc sai (y 905–950). */
const MISS_CHIP = { y: 927, h: 45 };

/** Hàng nút y 960–1120. */
const BUTTON_Y = 1040;
interface ButtonLayout {
  w: number;
  h: number;
  xs: readonly number[];
  icon: number;
}
const BUTTON_LAYOUTS: Readonly<Record<number, ButtonLayout>> = {
  3: { w: 200, h: 160, xs: [136, 360, 584], icon: 76 },
  4: { w: 150, h: 160, xs: [111, 277, 443, 609], icon: 76 },
  5: { w: 120, h: 150, xs: [96, 228, 360, 492, 624], icon: 64 },
};
const BUTTON = { r: 18, edge: 4, shadow: 6 };
/** Vùng chạm phủ cả khe giữa hai nút (không chồng nhau). */
const ZONE_PAD = 12;
const BADGE = 40;
const HOVER_LIFT = 4;
const PRESS_SINK = 3;

/** Thanh khoá khi sai. */
const LOCK = { x: 150, y: 1206, w: 420, h: 14 };

/** Phím số → vị trí nút (trái → phải), theo mã phím trước rồi tên phím. */
const KEY_SLOTS: Readonly<Record<string, number>> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Digit5: 4,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
  Numpad4: 3,
  Numpad5: 4,
  "1": 0,
  "2": 1,
  "3": 2,
  "4": 3,
  "5": 4,
};

/** Mức ẩn chip luật (Siêu khó, đã chốt). */
const CHIP_HIDDEN_FROM = 3;

// ─── Chuyển động ───────────────────────────────────────────────────────────────────────────────

/** Câu mới: khung + hình to mờ → rõ, hình to phóng 92 % → 100 %. */
const SHOW_MS = 120;
const SHOW_FROM = 0.92;
/** Đúng: hình nhỏ tản ra như bụi phấn; câu mới sau 300 ms (server tính vào câu sau). */
const SCATTER_MS = 250;
const SCATTER_PX = 60;
const NEXT_AFTER_HIT_MS = 300;
/** Sai: rung nút, khung nháy vàng 2 lần. */
const SHAKE_MS = 200;
const SHAKE_PX = 8;
const SHAKE_TIMES = 3;
const FLASH_MS = 150;
const PRESS_MS = 90;
const DIM_ALPHA = 0.35;

const FONT = '"Baloo 2", "Be Vietnam Pro", sans-serif';
/** Texture hình nhỏ, nút, chip vẽ gấp đôi khung thiết kế; khung to vẽ đúng cỡ. */
const RES = 2;
const TAU = Math.PI * 2;
const SQRT3 = Math.sqrt(3);

const TICK = "M-12 1 L-3 10 L13 -9";
const CROSS = "M-30 -30 L30 30 M30 -30 L-30 30";
const CHIP_ARROW = "M-9 0 L9 0 M2 -7 L9 0 L2 7";

// ─── Vẽ ra canvas 2D ───────────────────────────────────────────────────────────────────────────

function polygon(points: readonly (readonly [number, number])[]): Path2D {
  const shape = new Path2D();
  points.forEach(([x, y], i) => {
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

/**
 * Hình đặc cỡ `s` (khung bao), tâm (0, 0), đứng thẳng. Trả về nhiều mảnh để tô từng mảnh (tránh
 * lỗ ở chỗ chồng nhau khi các mảnh ngược chiều). Tròn = đĩa; vuông = ô vuông (cạnh ~87 % để cân mắt
 * với đĩa); tam giác đều đỉnh lên; chữ thập = hai thanh rộng 1/3; trái tim = hai đĩa + tam giác.
 */
function shapePaths(shape: NavonShape, s: number): Path2D[] {
  const h = s / 2;
  switch (shape) {
    case "circle":
      return [circle(0, 0, h)];
    case "square": {
      const a = h * (40 / 46);
      return [
        polygon([
          [-a, -a],
          [a, -a],
          [a, a],
          [-a, a],
        ]),
      ];
    }
    case "triangle": {
      const th = (s * SQRT3) / 4;
      return [
        polygon([
          [0, -th],
          [h, th],
          [-h, th],
        ]),
      ];
    }
    case "plus": {
      const b = s / 6;
      return [
        polygon([
          [-h, -b],
          [h, -b],
          [h, b],
          [-h, b],
        ]),
        polygon([
          [-b, -h],
          [b, -h],
          [b, h],
          [-b, h],
        ]),
      ];
    }
    case "heart": {
      // Theo cỡ 46: hai đĩa r 12,5 ở (±11,5; −8,35); cạnh tam giác tiếp xúc đĩa ở góc 45°.
      const k = s / 46;
      const a = 11.5 * k;
      const b = 8.35 * k;
      const r = 12.5 * k;
      const t = r / Math.SQRT2;
      return [
        circle(-a, -b, r),
        circle(a, -b, r),
        polygon([
          [-a - t, -b + t],
          [-a, -b],
          [a, -b],
          [a + t, -b + t],
          [0, -b + a + r * Math.SQRT2],
        ]),
      ];
    }
  }
}

/** Tô hình đặc; `chalk` thêm viền nhoè nhẹ + hạt phấn (hình trên bảng), nút thì nét gọn. */
function fillShape(ctx: Ctx, shape: NavonShape, size: number, color: string, chalk: boolean) {
  const paths = shapePaths(shape, size);
  ctx.save();
  ctx.fillStyle = color;
  if (chalk) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = Math.max(3, size * 0.1);
    for (const p of paths) ctx.stroke(p);
    ctx.globalAlpha = 1;
  }
  for (const p of paths) ctx.fill(p);
  ctx.restore();
  if (chalk) grain(ctx, 0.12, 3 + size);
}

/** Toạ độ góc trên trái của từng ô trong chuỗi ô vuông quanh hình vuông cạnh `size` tâm (0, 0). */
function squareLinks(size: number, link: number, perSide: number): [number, number][] {
  const half = size / 2;
  const step = (size - link) / (perSide - 1);
  const seen = new Set<string>();
  const out: [number, number][] = [];
  const push = (x: number, y: number) => {
    const key = `${Math.round(x)}:${Math.round(y)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push([x, y]);
  };
  for (let k = 0; k < perSide; k++) {
    const p = -half + k * step;
    push(p, -half);
    push(p, half - link);
    push(-half, p);
    push(half - link, p);
  }
  return out;
}

/** Viền khung theo câu hỏi: tròn = một nét liền; vuông = chuỗi ô vuông rỗng, góc vuông. */
function drawBorder(ctx: Ctx, ask: NavonAsk, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  if (ask === "global") {
    ctx.lineWidth = RING.width;
    ctx.stroke(circle(0, 0, RING.r));
  } else {
    ctx.lineWidth = SQUARE.edge;
    ctx.lineJoin = "miter";
    const inset = SQUARE.edge / 2;
    const side = SQUARE.link - SQUARE.edge;
    for (const [x, y] of squareLinks(SQUARE.chain, SQUARE.link, SQUARE.perSide)) {
      ctx.strokeRect(x + inset, y + inset, side, side);
    }
  }
  ctx.restore();
}

/** Tấm bảng của khung, thu vào `inset` (để vẽ viền sticker nằm trong mép). */
function framePanel(ask: NavonAsk, inset = 0, dy = 0): Path2D {
  if (ask === "global") return circle(0, dy, RING.outer - inset);
  const half = SQUARE.size / 2 - inset;
  const shape = new Path2D();
  shape.rect(-half, -half + dy, half * 2, half * 2);
  return shape;
}

/** Tô bằng màu CSS bất kỳ (vd. `rgb(0 0 0 / 0.22)`); trình duyệt không hiểu thì dùng dự phòng. */
function fillCss(ctx: Ctx, shape: Path2D, css: string, fallback: string) {
  ctx.save();
  ctx.fillStyle = fallback;
  ctx.fillStyle = css;
  ctx.fill(shape);
  ctx.restore();
}

/** Tâm ô (so với tâm khung). */
function cellOffset(cell: NavonCell): { x: number; y: number } {
  const mid = (NAVON_GRID - 1) / 2;
  return { x: (cell.col - mid) * CELL, y: (cell.row - mid) * CELL };
}

/** Ô gần tâm khung nhất; hoà thì lấy ô đứng trước trong `cells` (đặc tả). */
function centerMost(cells: readonly NavonCell[]): NavonCell | undefined {
  let best: NavonCell | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const cell of cells) {
    const { x, y } = cellOffset(cell);
    const d = x * x + y * y;
    if (d < bestDist) {
      bestDist = d;
      best = cell;
    }
  }
  return best;
}

function mediaMatches(query: string): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

// ─── Scene ────────────────────────────────────────────────────────────────────────────────────

interface ButtonView {
  x: number;
  layout: ButtonLayout;
  shape: NavonShape;
  /** Bóng + mặt nút: làm mờ cả nút. */
  root: Phaser.GameObjects.Container;
  /** Mặt nút, hình, nhãn phím, dấu ✓/✗: nhấc lên khi rê chuột, lún khi bấm phím, rung khi sai. */
  body: Phaser.GameObjects.Container;
  face: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image;
  label?: Phaser.GameObjects.Text;
  tick: Phaser.GameObjects.Image;
  cross: Phaser.GameObjects.Image;
}

type ButtonState = "idle" | "right" | "wrong" | "dim";

/** Hình to hình nhỏ — khung tròn chạm hình to, khung vuông chạm hình nhỏ. */
export default class NavonShapesScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = true;
  private reducedMotion = false;
  private canHover = false;
  private palette!: Palette;
  private puzzle?: NavonShapesPuzzle;

  /** Phần tĩnh (chip luật, nút) vẽ theo bảng màu + mức. */
  private staticId = "";
  private chrome?: Phaser.GameObjects.Container;
  private buttons: ButtonView[] = [];
  private hovered?: ButtonView;
  /** Phần của câu hiện tại: khung, hình to, lớp hiện đáp án. */
  private round?: Phaser.GameObjects.Container;
  private shapeLayer?: Phaser.GameObjects.Container;
  private smalls: Phaser.GameObjects.Image[] = [];
  private lockBar?: Phaser.GameObjects.Graphics;
  private onKey = (event: KeyboardEvent) => this.handleKey(event);

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.locked = true;
    this.puzzle = undefined;
    this.staticId = "";
  }

  create() {
    this.canHover = mediaMatches("(hover: hover) and (pointer: fine)");
    // Bắt phím ở mọi thiết bị có bàn phím (cả máy tính bảng gắn phím).
    window.addEventListener("keydown", this.onKey);
    if (this.canHover) this.input.on(Phaser.Input.Events.GAME_OUT, () => this.hover(undefined));
    // Hết vòng hoặc rời màn: dừng hẳn mọi tween, hẹn giờ và bỏ nghe phím.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
    this.next();
  }

  private cleanup() {
    window.removeEventListener("keydown", this.onKey);
    this.locked = true;
    this.puzzle = undefined;
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.round = undefined;
    this.shapeLayer = undefined;
    this.smalls = [];
    this.buttons = [];
    this.hovered = undefined;
  }

  private next() {
    this.locked = false;
    this.showPuzzle();
  }

  // ── Câu đố ──

  private showPuzzle() {
    // Mọi tween đang chạy đều thuộc câu cũ (hiện câu, tản, rung, nháy, thanh khoá): dừng trước khi huỷ.
    this.tweens.killAll();
    this.round?.destroy();
    this.lockBar?.destroy();
    this.lockBar = undefined;

    this.reducedMotion = prefersReducedMotion();
    this.palette = readPalette(this.game.canvas);
    const puzzle = navonShapes.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    this.puzzle = puzzle;
    this.drawStatic(puzzle.buttons.length);
    puzzle.buttons.forEach((shape, i) => {
      const button = this.buttons[i];
      if (!button) return;
      button.shape = shape;
      this.paintButton(button, "idle");
    });
    if (this.hovered && this.canHover) this.hovered.body.y = -HOVER_LIFT;

    // Khung (lòng + viền) và hình to hiện cùng lúc; không có hiệu ứng riêng khi đổi khung.
    const round = this.add.container(FRAME.x, FRAME.y);
    round.add(this.place(this.frameArt(puzzle.ask)));
    const shapeLayer = this.add.container(0, 0);
    const small = this.shapeArt(puzzle.local, "chalk", SMALL, true);
    this.smalls = puzzle.cells.map((cell) => {
      const { x, y } = cellOffset(cell);
      return this.place(small).setPosition(x, y);
    });
    shapeLayer.add(this.smalls);
    round.add(shapeLayer);
    this.round = round;
    this.shapeLayer = shapeLayer;

    // Hiệu ứng hiện câu luôn chạy (hai câu liền cùng hình to vẫn đọc ra là câu mới). Giảm chuyển
    // động: chỉ mờ → rõ, bỏ phóng.
    round.setAlpha(0);
    this.tweens.add({ targets: round, alpha: 1, duration: SHOW_MS });
    if (!this.reducedMotion) {
      shapeLayer.setScale(SHOW_FROM);
      this.tweens.add({ targets: shapeLayer, scale: 1, duration: SHOW_MS, ease: "Quad.easeOut" });
    }
  }

  // ── Nhập: chạm/click nút, phím số ──

  private handleKey(event: KeyboardEvent) {
    // Có phím bổ trợ, đang gõ chữ hoặc đang mở hộp thoại (Thoát, sheet chat…): không trả lời.
    if (shouldIgnoreGameKey(event)) return;
    const slot = KEY_SLOTS[event.code] ?? KEY_SLOTS[event.key];
    if (slot === undefined || event.repeat || !this.sys.isActive()) return;
    const button = this.buttons[slot];
    if (!button) return;
    if (!this.locked) this.press(button);
    this.answer(slot);
  }

  private hover(button: ButtonView | undefined) {
    if (button === this.hovered) return;
    if (this.hovered) this.hovered.body.y = 0;
    this.hovered = button;
    if (button && !this.locked) button.body.y = -HOVER_LIFT;
  }

  /** Bấm phím: nút tương ứng lún xuống một nhịp như khi click. */
  private press(button: ButtonView) {
    button.body.y = PRESS_SINK;
    this.time.delayedCall(PRESS_MS, () => {
      button.body.y = 0;
    });
  }

  // ── Trả lời ──

  private answer(choice: number) {
    const puzzle = this.puzzle;
    if (this.locked || !puzzle || choice >= puzzle.buttons.length) return;
    this.locked = true;
    if (this.hovered) this.hovered.body.y = 0;
    // Trả lời trong lúc câu đang hiện: cho hiện hẳn để lớp hiện đáp án không bị phóng/mờ theo.
    if (this.round && this.shapeLayer) {
      this.tweens.killTweensOf([this.round, this.shapeLayer]);
      this.round.setAlpha(1);
      this.shapeLayer.setScale(1);
    }

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const index = this.index;
    const correct = navonShapes.check(puzzle, choice);
    this.bridge.submit(index, choice);
    this.index += 1;

    if (correct) {
      this.showHit(choice);
      this.time.delayedCall(NEXT_AFTER_HIT_MS, () => this.next());
      return;
    }

    this.showMiss(puzzle, choice);
    // Hết khoá theo `lockedUntil` của server (không tự đếm 1,5 giây) để khớp huy hiệu khoá của khung.
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive()) return;
      this.drawLockBar(ms);
      this.time.delayedCall(ms, () => this.next());
    });
  }

  /** Đúng: nút vừa chọn sáng vàng; các hình nhỏ bay tản ra như bụi phấn. */
  private showHit(choice: number) {
    const button = this.buttons[choice];
    if (button) this.paintButton(button, "right");
    if (this.reducedMotion) return;
    this.smalls.forEach((image, k) => {
      const len = Math.hypot(image.x, image.y);
      const dx = len > 0 ? image.x / len : 0;
      const dy = len > 0 ? image.y / len : -1;
      const reach = SCATTER_PX * (0.75 + ((k * 7) % 5) * 0.12);
      this.tweens.add({
        targets: image,
        x: image.x + dx * reach,
        y: image.y + dy * reach,
        scale: image.scale * 1.3,
        alpha: 0,
        duration: SCATTER_MS,
        ease: "Quad.easeOut",
      });
    });
  }

  /**
   * Sai, khoá (CR-006): nút đúng sáng vàng + ✓, nút vừa chạm ✗ và rung, các nút khác mờ 35 %. Trong
   * khung chỉ ra cấp đúng: khung tròn → dải vàng theo đường bao hình to; khung vuông → kính lúp
   * phóng một hình nhỏ, hình to mờ 50 %. Viền khung nháy vàng 2 lần; dưới khung hiện nửa chip luật
   * của khung đó. Mọi thứ ở dưới y 260, không bị huy hiệu khoá che.
   */
  private showMiss(puzzle: NavonShapesPuzzle, choice: number) {
    this.buttons.forEach((button, i) => {
      if (i === puzzle.answerIndex) this.paintButton(button, "right");
      else if (i === choice) this.paintButton(button, "wrong");
      else this.paintButton(button, "dim");
    });

    const round = this.round;
    const shapeLayer = this.shapeLayer;
    if (!round || !shapeLayer) return;

    if (puzzle.ask === "global") {
      const band = this.place(this.bandArt(puzzle.global));
      round.addAt(band, round.getIndex(shapeLayer));
    } else {
      shapeLayer.setAlpha(LOCAL_DIM);
      const cell = centerMost(puzzle.cells);
      if (cell) {
        const { x, y } = cellOffset(cell);
        const lens = this.add.container(x, y, [
          this.place(this.lensArt()),
          this.place(this.shapeArt(puzzle.local, "chalk", Math.round(SMALL * LENS.zoom), true)),
        ]);
        round.add(lens);
      }
    }

    const flash = this.place(this.borderArt(puzzle.ask)).setAlpha(0);
    round.addAt(flash, 1);
    if (!this.reducedMotion) {
      this.tweens.add({
        targets: flash,
        alpha: 1,
        duration: FLASH_MS,
        yoyo: true,
        repeat: 1,
        ease: "Sine.easeInOut",
      });
    }

    const kind = puzzle.ask === "global" ? "round" : "square";
    round.add(
      this.place(this.chipArt(kind), MISS_CHIP.h / CHIP.h).setPosition(0, MISS_CHIP.y - FRAME.y),
    );

    const wrong = this.buttons[choice];
    if (wrong && !this.reducedMotion) this.shake(wrong.body);
  }

  /** Rung ngang ±8 px rồi về chỗ cũ. */
  private shake(target: { x: number }) {
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: SHAKE_MS,
      onUpdate: (tween) => {
        target.x = Math.sin((tween.getValue() ?? 0) * TAU * SHAKE_TIMES) * SHAKE_PX;
      },
      onComplete: () => {
        target.x = 0;
      },
    });
  }

  /** Thanh khoá rút ngắn dần trong suốt thời gian khoá. */
  private drawLockBar(ms: number) {
    if (ms <= 0) return;
    const { card, text } = this.palette;
    const bar = this.add.graphics();
    this.lockBar = bar;
    const draw = (left: number) => {
      bar.clear();
      bar.fillStyle(card.num).fillRoundedRect(LOCK.x, LOCK.y, LOCK.w, LOCK.h, LOCK.h / 2);
      bar.lineStyle(3, text.num).strokeRoundedRect(LOCK.x, LOCK.y, LOCK.w, LOCK.h, LOCK.h / 2);
      const w = LOCK.w * left;
      if (w >= LOCK.h) {
        bar.fillStyle(text.num).fillRoundedRect(LOCK.x, LOCK.y, w, LOCK.h, LOCK.h / 2);
      }
    };
    draw(1);
    this.tweens.addCounter({
      from: 1,
      to: 0,
      duration: ms,
      onUpdate: (tween) => draw(tween.getValue() ?? 0),
    });
  }

  // ── Phần tĩnh: chip luật, nút (vẽ lại khi đổi sáng/tối) ──

  private drawStatic(count: number) {
    const palette = this.palette;
    const difficulty = this.bridge.difficulty;
    const id = `${palette.id}/${difficulty}/${count}`;
    if (id === this.staticId) return;
    this.staticId = id;
    this.chrome?.destroy();
    this.hovered = undefined;

    const chrome = this.add.container(0, 0);
    this.chrome = chrome;

    // Chip luật: Mầm/Thường chỉ nửa khung tròn, Khó đủ hai nửa, Siêu khó ẩn (đã chốt).
    if (difficulty < CHIP_HIDDEN_FROM) {
      const both = NAVON_SHAPES_LEVELS[difficulty].localAskPct > 0;
      chrome.add(this.place(this.chipArt(both ? "both" : "round")).setPosition(FRAME.x, CHIP.y));
    }

    const layout = BUTTON_LAYOUTS[count] ?? BUTTON_LAYOUTS[5];
    if (!layout) return;
    const pitch = layout.xs.length > 1 ? (layout.xs[1] ?? 0) - (layout.xs[0] ?? 0) : layout.w;
    const zoneW = Math.min(pitch, layout.w + ZONE_PAD);
    this.buttons = layout.xs.slice(0, count).map((x, i) => {
      const view = this.drawButton(chrome, x, layout, i);
      // Vùng chạm phủ cả nút (≥ 120 × 150, ~65 px trên điện thoại 390), không nhấc theo nút.
      const zone = this.add
        .zone(x, BUTTON_Y, zoneW, layout.h + ZONE_PAD)
        .setInteractive({ useHandCursor: true });
      zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.answer(i));
      if (this.canHover) {
        zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.hover(view));
        zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
          if (this.hovered === view) this.hover(undefined);
        });
      }
      chrome.add(zone);
      return view;
    });
  }

  private drawButton(
    layer: Phaser.GameObjects.Container,
    x: number,
    layout: ButtonLayout,
    slot: number,
  ): ButtonView {
    const { sticker } = this.palette;
    const { w, h } = layout;
    const shadow = this.add.graphics();
    shadow.fillStyle(sticker.num).fillRoundedRect(-w / 2, -h / 2 + BUTTON.shadow, w, h, BUTTON.r);
    const face = this.add.graphics();
    const icon = this.place(this.shapeArt("circle", "text", layout.icon, false));
    const parts: Phaser.GameObjects.GameObject[] = [face, icon];
    let label: Phaser.GameObjects.Text | undefined;
    if (this.canHover) {
      // Nhãn phím số (máy tính) ở góc trên trái. Là ký hiệu phím, không dịch.
      label = this.add
        .text(-w / 2 + 20, -h / 2 + 18, String(slot + 1), {
          fontFamily: FONT,
          fontStyle: "800",
          fontSize: "22px",
        })
        .setOrigin(0.5);
      parts.push(label);
    }
    const badgeAt = { x: w / 2 - 20, y: -h / 2 + 20 };
    const tick = this.place(this.tickArt()).setPosition(badgeAt.x, badgeAt.y);
    const cross = this.place(this.crossArt()).setPosition(badgeAt.x, badgeAt.y);
    parts.push(tick, cross);
    const body = this.add.container(0, 0, parts);
    const root = this.add.container(x, BUTTON_Y, [shadow, body]);
    layer.add(root);
    return { x, layout, shape: "circle", root, body, face, icon, label, tick, cross };
  }

  /** Mặt nút: kem (thường, mờ) hoặc vàng (đúng / đáp án); ✓ khi vàng, ✗ khi vừa chọn sai. */
  private paintButton(button: ButtonView, state: ButtonState) {
    const { card, sticker, primary, text, ink } = this.palette;
    const { w, h, icon } = button.layout;
    const lit = state === "right";
    button.face.clear();
    button.face
      .fillStyle(lit ? primary.num : card.num)
      .fillRoundedRect(-w / 2, -h / 2, w, h, BUTTON.r);
    const inset = BUTTON.edge / 2;
    button.face
      .lineStyle(BUTTON.edge, sticker.num)
      .strokeRoundedRect(
        -w / 2 + inset,
        -h / 2 + inset,
        w - BUTTON.edge,
        h - BUTTON.edge,
        BUTTON.r - inset,
      );
    const art = this.shapeArt(button.shape, lit ? "ink" : "text", icon, false);
    button.icon.setTexture(art.key).setOrigin(art.ox, art.oy).setScale(art.scale);
    button.label?.setColor(lit ? ink.css : text.css).setAlpha(lit ? 1 : 0.7);
    button.tick.setVisible(lit);
    button.cross.setVisible(state === "wrong");
    button.root.setAlpha(state === "dim" ? DIM_ALPHA : 1);
    if (state === "idle") button.body.setPosition(0, 0);
  }

  // ── Texture vẽ bằng canvas 2D (khoá theo hình + màu nên mỗi hình chỉ vẽ một lần) ──

  private place(art: Art, scale = 1): Phaser.GameObjects.Image {
    return placeArt(this, art, scale);
  }

  /** Vẽ một texture: `box` theo px thiết kế, texture vẽ ở `res` lần, ảnh đặt với tỉ lệ 1/res. */
  private paint(name: string, box: Box, draw: (ctx: Ctx) => void, res = RES): Art {
    return paintArt(this.textures, `navon-shapes/${name}`, box, 1, draw, res);
  }

  /** Hình đặc cỡ `size`: phấn trên bảng (`chalk`) hoặc nét gọn trên nút. */
  private shapeArt(shape: NavonShape, tone: Tone, size: number, chalk: boolean): Art {
    const { css } = this.palette[tone];
    const m = size / 2 + 6;
    return this.paint(
      `shape-${shape}-${size}-${css}-${chalk ? "chalk" : "flat"}`,
      [-m, -m, m, m],
      (ctx) => fillShape(ctx, shape, size, css, chalk),
    );
  }

  /**
   * Khung: tấm bảng (bóng đổ, mặt `--board`, viền sticker) + viền phấn bên trong. Hạt phấn chỉ đục
   * vào viền phấn (vẽ ở canvas riêng rồi chép lên), không đục thủng tấm bảng.
   */
  private frameArt(ask: NavonAsk): Art {
    const { chalk, board, sticker } = this.palette;
    const m = RING.outer + 2;
    return this.paint(
      `frame-${ask}-${this.palette.id}`,
      [-m, -m, m, m + PANEL.shadow],
      (ctx) => {
        ctx.fillStyle = sticker.css;
        ctx.fill(framePanel(ask, 0, PANEL.shadow));
        ctx.fillStyle = board.css;
        ctx.fill(framePanel(ask));
        ctx.save();
        ctx.strokeStyle = sticker.css;
        ctx.lineWidth = PANEL.edge;
        ctx.lineJoin = "miter";
        ctx.stroke(framePanel(ask, PANEL.edge / 2));
        ctx.restore();
        const scratch = document.createElement("canvas");
        scratch.width = ctx.canvas.width;
        scratch.height = ctx.canvas.height;
        const sctx = scratch.getContext("2d");
        if (!sctx) {
          drawBorder(ctx, ask, chalk.css);
          return;
        }
        sctx.setTransform(ctx.getTransform());
        drawBorder(sctx, ask, chalk.css);
        grain(sctx, 0.14, ask === "global" ? 5 : 9);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(scratch, 0, 0);
        ctx.restore();
      },
      1,
    );
  }

  /** Viền khung màu vàng (nháy lúc sai), cùng hình dạng và kiểu viền. */
  private borderArt(ask: NavonAsk): Art {
    const { primary } = this.palette;
    const m = RING.outer + 2;
    return this.paint(
      `border-${ask}-${primary.css}`,
      [-m, -m, m, m],
      (ctx) => drawBorder(ctx, ask, primary.css),
      1,
    );
  }

  /**
   * Dải vàng theo đường bao hình to: đĩa bán kính 0,6 ô sau mỗi hình nhỏ, nối liền các ô kề nhau
   * (cả chéo) để thành một dải không đứt; lòng dải vàng 35 %, mép dải vàng đặc để nhìn rõ trên bảng.
   * Vẽ bằng một lần `stroke` nên chỗ chồng nhau không đậm hơn.
   */
  private bandArt(shape: NavonShape): Art {
    const { primary } = this.palette;
    const m = (CELL * NAVON_GRID) / 2 + BAND.r + BAND.edge + 2;
    return this.paint(
      `band-${shape}-${primary.css}`,
      [-m, -m, m, m],
      (ctx) => {
        const cells = NAVON_MASKS[shape];
        const band = new Path2D();
        cells.forEach((a, i) => {
          const pa = cellOffset(a);
          // Đoạn dài 0 vẫn vẽ ra một đĩa nhờ đầu nét tròn.
          band.moveTo(pa.x, pa.y);
          band.lineTo(pa.x, pa.y);
          for (const b of cells.slice(i + 1)) {
            if (Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row)) !== 1) continue;
            const pb = cellOffset(b);
            band.moveTo(pa.x, pa.y);
            band.lineTo(pb.x, pb.y);
          }
        });
        ctx.strokeStyle = primary.css;
        ctx.lineWidth = 2 * (BAND.r + BAND.edge);
        ctx.stroke(band);
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth = 2 * BAND.r;
        ctx.stroke(band);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = BAND.alpha;
        ctx.lineWidth = 2 * BAND.r;
        ctx.stroke(band);
        ctx.restore();
      },
      1,
    );
  }

  /** Kính lúp: lòng bảng tô đậm, vành vàng viền đậm, cán chéo xuống phải. */
  private lensArt(): Art {
    const { board, sticker, primary, shade } = this.palette;
    const reach = LENS.r + LENS.handle + 24;
    return this.paint(
      `lens-${this.palette.id}`,
      [-LENS.r - 16, -LENS.r - 16, reach, reach],
      (ctx) => {
        const c = Math.SQRT1_2;
        const handle = new Path2D();
        handle.moveTo((LENS.r + 4) * c, (LENS.r + 4) * c);
        handle.lineTo((LENS.r + LENS.handle) * c, (LENS.r + LENS.handle) * c);
        ctx.save();
        ctx.strokeStyle = sticker.css;
        ctx.lineWidth = 26;
        ctx.stroke(handle);
        ctx.strokeStyle = primary.css;
        ctx.lineWidth = 16;
        ctx.stroke(handle);
        ctx.restore();
        const disc = circle(0, 0, LENS.r);
        ctx.fillStyle = board.css;
        ctx.fill(disc);
        fillCss(ctx, disc, shade, SHADE_FALLBACK);
        ctx.save();
        ctx.strokeStyle = sticker.css;
        ctx.lineWidth = LENS.ring + 8;
        ctx.stroke(disc);
        ctx.strokeStyle = primary.css;
        ctx.lineWidth = LENS.ring;
        ctx.stroke(disc);
        ctx.restore();
      },
    );
  }

  /**
   * Chip luật, chỉ biểu tượng: [khung tròn nhỏ] → [một hình to] · [khung vuông nhỏ] → [kính lúp trên
   * 3 hình nhỏ]. `round` / `square` là một nửa (Mầm, Thường, và nửa chip dưới khung lúc sai).
   */
  private chipArt(kind: "round" | "square" | "both"): Art {
    const { card, text, sticker } = this.palette;
    const width = kind === "both" ? CHIP.half * 2 + CHIP.sep : CHIP.half;
    const hw = width / 2;
    const hh = CHIP.h / 2;
    return this.paint(
      `chip-${kind}-${this.palette.id}`,
      [-hw - 4, -hh - 4, hw + 4, hh + CHIP.shadow + 4],
      (ctx) => {
        ctx.fillStyle = sticker.css;
        ctx.fill(roundRect(-hw, -hh + CHIP.shadow, width, CHIP.h, hh));
        const pill = roundRect(-hw, -hh, width, CHIP.h, hh);
        ctx.fillStyle = card.css;
        ctx.fill(pill);
        ctx.strokeStyle = sticker.css;
        ctx.lineWidth = CHIP.edge;
        ctx.stroke(pill);

        const ink = text.css;
        if (kind === "both") {
          this.chipHalf(ctx, -hw, "global", ink);
          ctx.save();
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = ink;
          ctx.fill(circle(0, 0, 3.5));
          ctx.restore();
          this.chipHalf(ctx, -hw + CHIP.half + CHIP.sep, "local", ink);
        } else {
          this.chipHalf(ctx, -hw, kind === "round" ? "global" : "local", ink);
        }
      },
    );
  }

  /** Một nửa chip bắt đầu ở `x0`: khung nhỏ (x0 + 40) → mũi tên (x0 + 80) → biểu tượng (x0 + 122). */
  private chipHalf(ctx: Ctx, x0: number, ask: NavonAsk, ink: string) {
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    // Khung nhỏ: tròn nét liền; vuông là chuỗi ô vuông nhỏ (4 ô mỗi cạnh).
    ctx.translate(x0 + 40, 0);
    if (ask === "global") {
      ctx.lineWidth = 4;
      ctx.stroke(circle(0, 0, 17));
    } else {
      for (const [x, y] of squareLinks(36, 6, 4)) ctx.fillRect(x, y, 6, 6);
    }
    // Mũi tên.
    ctx.translate(40, 0);
    ctx.lineWidth = 4;
    ctx.stroke(new Path2D(CHIP_ARROW));
    ctx.translate(42, 0);
    if (ask === "global") {
      // Một hình to: tam giác đặc.
      ctx.fill(
        polygon([
          [0, -17.3],
          [20, 17.3],
          [-20, 17.3],
        ]),
      );
    } else {
      // Kính lúp trên nhóm 3 hình nhỏ: hình trong kính to hơn.
      ctx.fill(circle(-17, 14, 3.5));
      ctx.fill(circle(-4, 16, 3.5));
      ctx.fill(circle(-5, -5, 5.5));
      ctx.lineWidth = 3.5;
      ctx.stroke(circle(-5, -5, 12));
      ctx.lineWidth = 5;
      const handle = new Path2D("M4 4 L15 15");
      ctx.stroke(handle);
    }
    ctx.restore();
  }

  /** Dấu ✓ ở góc nút. */
  private tickArt(): Art {
    const { sticker, primary } = this.palette;
    const k = BADGE / 64;
    return this.paint(
      `tick-${sticker.css}-${primary.css}`,
      [-34 * k, -34 * k, 34 * k, 36 * k],
      (ctx) => {
        ctx.scale(k, k);
        ctx.fillStyle = sticker.css;
        ctx.fill(circle(0, 5, 26));
        const badge = circle(0, 0, 26);
        ctx.fillStyle = primary.css;
        ctx.fill(badge);
        ctx.strokeStyle = sticker.css;
        ctx.lineWidth = 4;
        ctx.stroke(badge);
        ctx.lineWidth = 6;
        ctx.stroke(new Path2D(TICK));
      },
    );
  }

  /** Dấu ✗ ở góc nút. */
  private crossArt(): Art {
    const css = this.palette.destructive.css;
    const k = BADGE / 80;
    return this.paint(`cross-${css}`, [-42 * k, -42 * k, 42 * k, 42 * k], (ctx) => {
      ctx.scale(k, k);
      const shape = new Path2D(CROSS);
      ctx.strokeStyle = HALO;
      ctx.lineWidth = 20;
      ctx.stroke(shape);
      ctx.strokeStyle = css;
      ctx.lineWidth = 10;
      ctx.stroke(shape);
    });
  }
}
