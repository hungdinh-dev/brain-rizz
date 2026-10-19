import {
  type Difficulty,
  type TopViewChoice,
  type TopViewPuzzle,
  topView,
  topViewCubes,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import { currentLanguage } from "@/i18n";
import type { MinigameBridge } from "../types";
import { locales } from "./locales";

/*
 * Nhìn từ trên — đặc tả: docs/04-minigames/top-view.md (mục "Ghi chú cho FE").
 * Bản mẫu: canvas Brain Rizz, trang Minigame, hàng M8 (TopViewMobile, TopViewLevels, TopViewStates).
 * Mọi hình vẽ bằng canvas 2D thành texture (nét bo tròn, nét đứt như bản mẫu). Chữ duy nhất là
 * nhãn "Trước" (qua locales của game) và số tầng trên thẻ Khó, Siêu khó.
 */

// ---------------------------------------------------------------- bố cục (khung 720×1280)

type Point = readonly [x: number, y: number];

/** Thẻ mô hình 560×414, tâm (360, 263): viền mực dày 7, huy hiệu con mắt giữa cạnh trên; không nhận chạm. */
const MODEL = {
  x: 360,
  y: 263,
  width: 560,
  height: 414,
  radius: 32,
  border: 7,
  shadow: 10,
} as const;
/** Huy hiệu con mắt (so với tâm thẻ mô hình) và mũi tên chỉ xuống dưới nó. */
const EYE_Y = -207;
const EYE_R = 31;
/** Dải nhắc 240×56, tâm (360, 522): ô bệ nghiêng có mép cam → lưới có vạch cam. Không chữ. */
const HINT: Point = [360, 522];
/** Thẻ lựa chọn 320×300, cả thẻ là vùng chạm. Rê chuột: nhấc 4 px, viền đậm hơn. */
const CARD = {
  width: 320,
  height: 300,
  radius: 28,
  border: 4,
  hoverBorder: 7,
  shadow: 8,
  lift: 4,
} as const;
/** Thẻ bị chạm sai: viền gạch đứt. */
const MISS_BORDER = 7;
const MISS_DASH: [number, number] = [20, 12];
/** Tâm thẻ theo đúng thứ tự `choices` (trái → phải, trên → dưới). Mầm: thẻ thứ ba ở giữa. */
const SLOTS_4: readonly Point[] = [
  [188, 734],
  [532, 734],
  [188, 1058],
  [532, 1058],
];
const SLOTS_3: readonly Point[] = [
  [188, 734],
  [532, 734],
  [360, 1058],
];

/**
 * Vị trí mô hình theo mức: (x₀, y₀) là đỉnh sau của bệ (góc ô (0, 0)); bệ 4×4 thu × 0,74. Mọi câu
 * của một mức dùng cùng tỉ lệ. `front` là tâm nhãn "Trước", cạnh mép cam phía trước–trái của bệ.
 */
const STAGES: Record<Difficulty, { y0: number; scale: number; front: Point }> = {
  0: { y0: 263, scale: 1, front: [148.5, 393] },
  1: { y0: 277, scale: 1, front: [148.5, 407] },
  2: { y0: 261.74, scale: 0.74, front: [150.45, 386.98] },
  3: { y0: 282.46, scale: 0.74, front: [150.45, 407.7] },
};
const STAGE_X = 360;
/** Vùng vẽ mô hình (texture vẽ lại mỗi câu), nằm trong thẻ mô hình. */
const ART = { left: 72, top: 48, width: 576, height: 440 } as const;

/**
 * Hình học isometric: điểm (c, r, z) vẽ tại x = x₀ + ISO_X·(c − r), y = y₀ + ISO_Y·(c + r) − CUBE_H·z.
 * Mặt trên một khối là hình thoi 97 × 56, khối cao 56.
 */
const ISO_X = 28 * Math.sqrt(3);
const ISO_Y = 28;
const CUBE_H = 56;
const CUBE_LINE = 4;
/** Dải mép bệ (cam phía trước–trái, sẫm phía trước–phải) cao 14. */
const SLAB_BAND = 14;
const DOT_R = 3.5;

/** Lưới trong thẻ: 3×3 ô 64 px, 4×4 ô 50 px; vạch cam cao 14 cách lưới 10 px. */
const GRID_CELL: Record<number, number> = { 3: 64, 4: 50 };
const GRID_BORDER = 4;
const GRID_LINE = 2.5;
const BAR_GAP = 10;
const BAR_H = 14;
/** Texture lưới đặt tại tâm thẻ (lưới + vạch cam cân đối quanh tâm). */
const GRID_TEX = { width: 224, height: 244 } as const;

/** Số tầng trên ô (Khó, Siêu khó): Baloo 2 đậm 800, cỡ 32; đường chân chữ dưới tâm ô 11 px. */
const FONT_FAMILY = '"Baloo 2", "Be Vietnam Pro", sans-serif';
const FONT_WEIGHT = 800;
const NUMBER_SIZE = 32;
const NUMBER_BASELINE = 11;
/** Nhãn "Trước": viên thuốc 104 × 40 (giãn theo chữ), chữ cỡ 26. */
const FRONT = {
  width: 104,
  height: 40,
  padding: 18,
  fontSize: 26,
  baseline: 9,
  shadow: 4,
} as const;
const FONT_TIMEOUT_MS = 1500;

/** Độ mờ của các thẻ không liên quan trong lúc khoá sau câu sai. */
const DIM_ALPHA = 0.35;

/** Huy hiệu (so với tâm thẻ): ✓ góc trên phải; ✗ và icon loại lựa chọn cạnh nhau. */
const BADGE_R = 30;
const BADGE_SHADOW = 5;
const OK_AT: Point = [140, -130];
const BAD_AT: Point = [130, -120];
const KIND_AT: Point = [62, -120];

// ---------------------------------------------------------------- nhịp hiệu ứng (đều ≤ 400 ms)

/** Hiện câu: mờ dần, thẻ phóng 0,96 → 1; nhận chạm ngay. */
const APPEAR_MS = 140;
const APPEAR_SCALE = 0.96;
/** Nhấn: thẻ co 0,97 rồi về. */
const PRESS_MS = 60;
const PRESS_SCALE = 0.97;
/** Đúng: mặt trên các cột sáng vàng, sang câu mới sau 350 ms (khoảng này tính vào giờ câu sau). */
const LIT_MS = 120;
const SOLVED_MS = 350;
/** Sai: rung ±8 px trong 200 ms; hết khoá theo server (`unlockDelay`). */
const SHAKE_MS = 200;
const SHAKE_PX = 8;
const DIM_MS = 120;

// ---------------------------------------------------------------- icon (đường SVG của bản mẫu, tâm 0,0)

const TURN_ARC = "M-12 -6 A13 13 0 1 1 -6 12";
const TURN_HEAD = "M-0.3 9.3 L-9.6 10.2 L-4.7 18.3";
const MIRROR_AXIS = "M0 -16 L0 16";
const MIRROR_ARROWS = "M-5 0 L-19 0 M-14 -5 L-19 0 L-14 5 M5 0 L19 0 M14 -5 L19 0 L14 5";
const CHECK = "M-14 1 L-4 12 L15 -11";
const CROSS = "M-11 -11 L11 11 M11 -11 L-11 11";
const EYE =
  "M-20 0 C-14 -10 -7 -13 0 -13 C7 -13 14 -10 20 0 C14 10 7 13 0 13 C-7 13 -14 10 -20 0 Z";
/**
 * Mũi tên dưới con mắt. Bản mẫu dài tới y = −139, nhưng ở Thường cột 3 tầng ở ô sau cùng có đỉnh tại
 * y = −154 (so với tâm thẻ) và che mất đầu mũi tên; rút ngắn để mũi tên luôn trọn vẹn.
 */
const EYE_ARROW = "M0 -170 L0 -155 M-10 -165 L0 -154 L10 -165";

// ---------------------------------------------------------------- màu

/**
 * Màu riêng của game theo bản mẫu (TopViewMobile, TopViewStates), không phải token chung:
 * ba mặt khối, mặt bệ, dải mép bên phải và ô tô trên thẻ. Giao diện sáng lấy mặt phải khối và ô tô
 * từ token `--color-visualize`; mép trước luôn cam (`--color-identify`).
 */
const ART_LIGHT = {
  cubeTop: "#b7adea",
  cubeLeft: "#8f82cc",
  slabSide: "#d9cfbd",
  number: "#ffffff",
  gridAlpha: 0.3,
} as const;
const ART_DARK = {
  cubeTop: "#cfc7f5",
  cubeLeft: "#a99ce0",
  cubeRight: "#8a7cc9",
  slabTop: "#423c6e",
  slabSide: "#26213f",
  cell: "#a99ce0",
  gridAlpha: 0.28,
} as const;
const VISUALIZE = "#7768ae";
const ORANGE = "#f2a541";
const LABEL_INK = "#1f1b3a";

/** Màu đọc từ token CSS lúc tạo scene (tự đổi theo sáng/tối). Chuỗi CSS để vẽ texture canvas. */
interface Palette {
  card: string;
  cardFg: string;
  /** Mực: viền thẻ, viền khối, viền ô. */
  border: string;
  /** Bóng đổ kiểu nhãn dán. */
  sticker: string;
  /** Nền khung chơi (bg-muted của GameFrame), nền lưới trên thẻ. */
  muted: string;
  primary: string;
  primaryFg: string;
  destructive: string;
  orange: string;
  cubeTop: string;
  cubeLeft: string;
  cubeRight: string;
  slabTop: string;
  slabSide: string;
  /** Ô có khối trên thẻ lựa chọn. */
  cell: string;
  /** Số tầng trên ô. */
  number: string;
  /** Đường lưới (trên bệ và trên thẻ) và độ mờ của nó. */
  gridInk: string;
  gridAlpha: number;
}

function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  const base = {
    card: token("--card", "#fff8ef"),
    cardFg: token("--card-foreground", "#1f1b3a"),
    border: token("--border", "#1f1b3a"),
    sticker: token("--sticker", "#1f1b3a"),
    muted: token("--muted", "#f3eadf"),
    primary: token("--primary", "#ffd166"),
    primaryFg: token("--primary-foreground", "#1f1b3a"),
    destructive: token("--destructive", "#c93a55"),
    orange: token("--color-identify", ORANGE),
  };
  if (style.colorScheme === "dark") {
    return {
      ...base,
      ...ART_DARK,
      number: base.border,
      gridInk: base.cardFg,
    };
  }
  const visualize = token("--color-visualize", VISUALIZE);
  return {
    ...base,
    ...ART_LIGHT,
    cubeRight: visualize,
    slabTop: base.muted,
    cell: visualize,
    gridInk: base.border,
  };
}

/** Màu CSS → số màu của Phaser. */
const toColor = (css: string) => Phaser.Display.Color.ValueToColor(css).color;

// Giảm chuyển động (`prefersReducedMotion` dùng chung, theo nút Hiệu ứng): bỏ rung, co, phóng, nhấp nháy; giữ đổi viền, huy hiệu, tô vàng tĩnh.

/** Nhãn mép trước theo ngôn ngữ đang dùng (khoá `front` trong locales của game). */
function frontLabel() {
  return locales[currentLanguage()].front;
}

/** Chờ Baloo 2 tải xong (chữ trên canvas vẽ một lần, không tự vẽ lại khi font về muộn). */
function waitForFont(text: string): Promise<void> {
  const fonts = document.fonts;
  if (!fonts) return Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, FONT_TIMEOUT_MS);
  });
  const load = fonts.load(`${FONT_WEIGHT} ${NUMBER_SIZE}px "Baloo 2"`, `0123456789${text}`).then(
    () => {},
    () => {},
  );
  return Promise.race([load, timeout]).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------- vẽ bằng canvas 2D

type Ctx = CanvasRenderingContext2D;
type CardState = "idle" | "hover" | "miss";
type BadgeKind = "ok" | "bad" | "mirror" | "rotation";

function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Nét đứt chia đều quanh hình chữ nhật bo góc để chỗ nối không lệch. */
function evenDash(w: number, h: number, r: number, [dash, gap]: [number, number]) {
  const length = 2 * (w + h - 4 * r) + 2 * Math.PI * r;
  const k = length / Math.max(1, Math.round(length / (dash + gap))) / (dash + gap);
  return [dash * k, gap * k];
}

function strokeIcon(ctx: Ctx, d: string, width: number, color: string, dash: number[] = []) {
  ctx.setLineDash(dash);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke(new Path2D(d));
  ctx.setLineDash([]);
}

function fillPolygon(ctx: Ctx, points: readonly Point[], fill: string, stroke?: string, width = 0) {
  ctx.beginPath();
  for (const [x, y] of points) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = width;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function line(ctx: Ctx, [x1, y1]: Point, [x2, y2]: Point) {
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
}

/** Điểm (c, r, z) của mô hình, gốc toạ độ ở đỉnh sau của bệ. */
function iso(c: number, r: number, z = 0): Point {
  return [ISO_X * (c - r), ISO_Y * (c + r) - CUBE_H * z];
}

const below = ([x, y]: Point, dy: number): Point => [x, y + dy];

/**
 * Bệ + khối (gốc toạ độ ở đỉnh sau của bệ). Bệ: mặt trên có lưới mờ để đếm ô, dải cam ở mép trước
 * (từ góc (0, n) tới (n, n)) có chấm ở vạch chia cột, dải sẫm ở mép phải. Khối vẽ theo
 * `topViewCubes` (đã sắp theo độ sâu), khối sau đè khối trước. `lit`: mặt trên mọi cột tô vàng.
 */
function drawStage(ctx: Ctx, heights: readonly (readonly number[])[], lit: boolean, p: Palette) {
  const n = heights.length;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  fillPolygon(ctx, [iso(0, 0), iso(n, 0), iso(n, n), iso(0, n)], p.slabTop, p.border, CUBE_LINE);
  ctx.save();
  ctx.globalAlpha = p.gridAlpha;
  ctx.beginPath();
  for (let i = 1; i < n; i++) {
    line(ctx, iso(i, 0), iso(i, n));
    line(ctx, iso(0, i), iso(n, i));
  }
  ctx.lineWidth = GRID_LINE;
  ctx.strokeStyle = p.gridInk;
  ctx.stroke();
  ctx.restore();

  const frontLeft = [iso(0, n), iso(n, n)] as const;
  const frontRight = [iso(n, n), iso(n, 0)] as const;
  for (const [[a, b], fill] of [
    [frontLeft, p.orange],
    [frontRight, p.slabSide],
  ] as const) {
    fillPolygon(ctx, [a, b, below(b, SLAB_BAND), below(a, SLAB_BAND)], fill, p.border, CUBE_LINE);
  }
  ctx.fillStyle = p.border;
  for (let i = 1; i < n; i++) {
    const [x, y] = below(iso(i, n), SLAB_BAND / 2);
    ctx.beginPath();
    ctx.arc(x, y, DOT_R, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const { c, r, h } of topViewCubes(heights)) {
    const top = lit && h === (heights[r]?.[c] ?? 0) - 1 ? p.primary : p.cubeTop;
    const z = h + 1;
    fillPolygon(
      ctx,
      [iso(c, r, z), iso(c + 1, r, z), iso(c + 1, r + 1, z), iso(c, r + 1, z)],
      top,
      p.border,
      CUBE_LINE,
    );
    fillPolygon(
      ctx,
      [iso(c, r + 1, z), iso(c + 1, r + 1, z), iso(c + 1, r + 1, h), iso(c, r + 1, h)],
      p.cubeLeft,
      p.border,
      CUBE_LINE,
    );
    fillPolygon(
      ctx,
      [iso(c + 1, r, z), iso(c + 1, r + 1, z), iso(c + 1, r + 1, h), iso(c + 1, r, h)],
      p.cubeRight,
      p.border,
      CUBE_LINE,
    );
  }
}

/**
 * Lưới hình chiếu của một thẻ (gốc toạ độ ở tâm thẻ): ô trống nền bệ + lưới mờ, ô có khối tô tím
 * viền mực, số tầng giữa ô khi `showHeights`; dưới lưới là vạch cam có chấm ở vạch chia cột.
 */
function drawGrid(
  ctx: Ctx,
  grid: readonly (readonly number[])[],
  showHeights: boolean,
  p: Palette,
) {
  const n = grid.length;
  const cell = GRID_CELL[n] ?? Math.floor(200 / n);
  const span = n * cell;
  const left = -span / 2;
  const top = -(span + BAR_GAP + BAR_H) / 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.fillStyle = p.muted;
  ctx.fillRect(left, top, span, span);
  ctx.save();
  ctx.globalAlpha = p.gridAlpha;
  ctx.beginPath();
  for (let i = 1; i < n; i++) {
    line(ctx, [left + i * cell, top], [left + i * cell, top + span]);
    line(ctx, [left, top + i * cell], [left + span, top + i * cell]);
  }
  ctx.lineWidth = GRID_LINE;
  ctx.strokeStyle = p.gridInk;
  ctx.stroke();
  ctx.restore();
  ctx.lineWidth = GRID_BORDER;
  ctx.strokeStyle = p.border;
  ctx.strokeRect(left, top, span, span);

  grid.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value <= 0) return;
      const x = left + c * cell;
      const y = top + r * cell;
      ctx.fillStyle = p.cell;
      ctx.fillRect(x, y, cell, cell);
      ctx.lineWidth = GRID_BORDER;
      ctx.strokeStyle = p.border;
      ctx.strokeRect(x, y, cell, cell);
      if (showHeights) {
        ctx.font = `${FONT_WEIGHT} ${NUMBER_SIZE}px ${FONT_FAMILY}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = p.number;
        ctx.fillText(String(value), x + cell / 2, y + cell / 2 + NUMBER_BASELINE);
      }
    });
  });

  const barY = top + span + BAR_GAP;
  roundRectPath(ctx, left, barY, span, BAR_H, 5);
  ctx.fillStyle = p.orange;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = p.border;
  ctx.stroke();
  ctx.fillStyle = p.border;
  for (let i = 1; i < n; i++) {
    ctx.beginPath();
    ctx.arc(left + i * cell, barY + BAR_H / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------- scene

interface ChoiceView {
  /** Đặt tại tâm thẻ: mờ dần khi hiện câu, chứa lớp phủ khi bị làm mờ. */
  slot: Phaser.GameObjects.Container;
  /** Mặt thẻ: nhấc lên khi rê chuột, co khi nhấn, rung khi sai. */
  face: Phaser.GameObjects.Container;
  card: Phaser.GameObjects.Image;
  hovered: boolean;
}

/** Nhìn từ trên — chạm vào hình chiếu nhìn thẳng từ trên xuống của mô hình khối (mép cam ở dưới). */
export default class TopViewScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = true;
  private colors!: Palette;
  private reducedMotion = false;
  private board?: Phaser.GameObjects.Container;
  private choices: ChoiceView[] = [];
  /** Mô hình sáng vàng (đặt chồng lên mô hình thường, hiện khi trả lời). */
  private lit?: Phaser.GameObjects.Image;
  /** Hẹn giờ của câu hiện tại (sang câu mới); huỷ hết khi sang câu mới hoặc rời màn. */
  private timers: Phaser.Time.TimerEvent[] = [];

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.locked = true;
    this.choices = [];
    this.timers = [];
    this.lit = undefined;
    this.board = undefined;
  }

  create() {
    const canvas = this.game.canvas;
    this.colors = readPalette(canvas.isConnected ? canvas : document.documentElement);
    this.reducedMotion = prefersReducedMotion();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearTimers();
      this.tweens.killAll();
      this.locked = true;
      this.choices = [];
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.clearTimers());

    // Phần cố định suốt vòng: thẻ mô hình, dải nhắc.
    this.add.image(MODEL.x, MODEL.y, this.modelTexture());
    this.add.image(HINT[0], HINT[1], this.hintTexture());

    const front = frontLabel();
    void waitForFont(front).then(() => {
      // Hết vòng trong lúc chờ font thì scene đã bị huỷ.
      if (!this.sys.isActive()) return;
      const [x, y] = STAGES[this.bridge.difficulty].front;
      // Nhãn vẽ sau mô hình (mô hình là texture vẽ lại mỗi câu, nhãn nằm trên cùng).
      this.add.image(x, y, this.frontTexture(front)).setDepth(1);
      this.showPuzzle();
    });
  }

  // -------------------------------------------------------------- dựng câu đố

  private showPuzzle() {
    // Mọi hẹn giờ và tween đang chạy đều thuộc câu cũ: dừng trước khi huỷ.
    this.clearTimers();
    this.tweens.killAll();
    this.board?.destroy();
    this.locked = false;

    const difficulty = this.bridge.difficulty;
    const puzzle = topView.generate(this.bridge.seed, this.index, difficulty);
    const board = this.add.container(0, 0);

    // Mô hình: hai texture (thường và sáng vàng), vẽ lại mỗi câu.
    this.drawArt("art", puzzle, false);
    this.drawArt("art-lit", puzzle, true);
    const art = this.add.image(ART.left, ART.top, this.key("art")).setOrigin(0);
    const lit = this.add.image(ART.left, ART.top, this.key("art-lit")).setOrigin(0).setAlpha(0);
    board.add([art, lit]);
    this.lit = lit;

    const slots = puzzle.choices.length > 3 ? SLOTS_4 : SLOTS_3;
    this.choices = puzzle.choices.map((choice, i) => {
      const [x, y] = slots[i] ?? SLOTS_4[0]!;
      const card = this.add.image(0, 0, this.cardTexture("idle"));
      const grid = this.add.image(0, 0, this.gridTexture(i, choice, puzzle.showHeights));
      const face = this.add.container(0, 0, [card, grid]);
      const slot = this.add.container(x, y, [face]);
      const view: ChoiceView = { slot, face, card, hovered: false };

      // Vùng chạm phủ cả thẻ 320×300; ghi nhận ở pointerdown, một chạm là chốt.
      const zone = this.add
        .zone(x, y, CARD.width, CARD.height)
        .setInteractive({ useHandCursor: true });
      zone.on("pointerdown", () => this.answer(puzzle, i));
      zone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
        if (!this.locked && !pointer.wasTouch) this.setHover(view, true);
      });
      zone.on("pointerout", () => {
        if (!this.locked) this.setHover(view, false);
      });
      board.add([slot, zone]);
      return view;
    });
    this.board = board;

    // Hiện câu: mô hình mờ dần, thẻ mờ dần + phóng nhẹ; nhận chạm ngay.
    const cards = this.choices.map((view) => view.slot);
    art.setAlpha(0);
    for (const slot of cards) {
      slot.setAlpha(0);
      if (!this.reducedMotion) slot.setScale(APPEAR_SCALE);
    }
    this.tweens.add({ targets: art, alpha: 1, duration: APPEAR_MS, ease: "Quad.easeOut" });
    this.tweens.add({
      targets: cards,
      alpha: 1,
      scale: 1,
      duration: APPEAR_MS,
      ease: "Quad.easeOut",
    });
  }

  private setHover(view: ChoiceView, on: boolean) {
    if (view.hovered === on) return;
    view.hovered = on;
    view.face.y = on ? -CARD.lift : 0;
    view.card.setTexture(this.cardTexture(on ? "hover" : "idle"));
  }

  // -------------------------------------------------------------- trả lời

  private answer(puzzle: TopViewPuzzle, choice: number) {
    if (this.locked) return;
    this.locked = true;

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const index = this.index;
    const correct = topView.check(puzzle, choice);
    this.bridge.submit(index, choice);
    this.index += 1;

    for (const view of this.choices) this.setHover(view, false);
    const picked = this.choices[choice];
    const right = this.choices[puzzle.answerIndex];
    if (!picked || !right) return;
    if (!this.reducedMotion) {
      this.tweens.add({
        targets: picked.face,
        scale: PRESS_SCALE,
        duration: PRESS_MS / 2,
        yoyo: true,
      });
    }

    // Đúng hay sai đều cho mặt trên mọi cột sáng vàng để đối chiếu với thẻ đúng.
    this.lightUp();
    this.markRight(right);

    if (correct) {
      this.after(SOLVED_MS, () => this.showPuzzle());
      return;
    }

    this.showMiss(picked, puzzle.choices[choice]);
    for (const view of this.choices) if (view !== picked && view !== right) this.dim(view);

    // Hết khoá theo `lockedUntil` của server (không tự đếm 1,5 giây) để khớp huy hiệu khoá của khung.
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive() || this.index !== index + 1) return;
      this.after(ms, () => this.showPuzzle());
    });
  }

  /** Mặt trên mọi cột trong mô hình sáng vàng (giảm chuyển động: hiện ngay, không mờ dần). */
  private lightUp() {
    const lit = this.lit;
    if (!lit) return;
    if (this.reducedMotion) lit.setAlpha(1);
    else this.tweens.add({ targets: lit, alpha: 1, duration: LIT_MS, ease: "Quad.easeOut" });
  }

  /** Thẻ đúng: vòng vàng (dưới thẻ) + huy hiệu ✓. */
  private markRight(view: ChoiceView) {
    view.face.addAt(this.add.image(0, 0, this.ringTexture()), 0);
    view.face.add(this.add.image(OK_AT[0], OK_AT[1], this.badgeTexture("ok")));
  }

  /** Thẻ bị chạm sai: viền gạch đứt + ✗ (bản gương, bản xoay thêm icon riêng), rung ngang ±8 px. */
  private showMiss(view: ChoiceView, choice: TopViewChoice | undefined) {
    view.card.setTexture(this.cardTexture("miss"));
    const kind = choice?.kind;
    if (kind === "mirror" || kind === "rotation") {
      view.face.add(this.add.image(KIND_AT[0], KIND_AT[1], this.badgeTexture(kind)));
    }
    view.face.add(this.add.image(BAD_AT[0], BAD_AT[1], this.badgeTexture("bad")));
    if (this.reducedMotion) return;

    const face = view.face;
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
   * Làm mờ thẻ còn 35 % bằng lớp phủ màu nền khung (65 %). Đặt alpha cho cả nhóm thì bóng đổ dưới
   * thẻ lộ qua mặt thẻ; nền khung là một màu nên phủ cho kết quả giống làm mờ cả nhóm.
   */
  private dim(view: ChoiceView) {
    const veil = this.add
      .rectangle(
        0,
        CARD.shadow / 2,
        CARD.width + 4,
        CARD.height + CARD.shadow + 4,
        toColor(this.colors.muted),
      )
      .setAlpha(0);
    view.slot.add(veil);
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

  // -------------------------------------------------------------- texture

  private key(name: string) {
    return `top-view:${name}`;
  }

  /** Texture tĩnh từ canvas 2D (gốc toạ độ ở tâm), vẽ một lần mỗi vòng; trả về khoá. */
  private texture(name: string, width: number, height: number, draw: (ctx: Ctx) => void) {
    const key = this.key(name);
    if (this.textures.exists(key)) return key;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      draw(ctx);
    }
    this.textures.addCanvas(key, canvas);
    return key;
  }

  /** Texture canvas vẽ lại được (mô hình, lưới thẻ): tạo một lần, mỗi câu xoá và vẽ lại. */
  private redraw(name: string, width: number, height: number, draw: (ctx: Ctx) => void) {
    const key = this.key(name);
    const texture =
      (this.textures.exists(key)
        ? (this.textures.get(key) as Phaser.Textures.CanvasTexture)
        : null) ?? this.textures.createCanvas(key, width, height);
    if (!texture) return key;
    const ctx = texture.getContext();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    draw(ctx);
    texture.refresh();
    return key;
  }

  /** Mô hình của câu (gốc texture ở góc trên trái vùng vẽ `ART`). */
  private drawArt(name: string, puzzle: TopViewPuzzle, lit: boolean) {
    const stage = STAGES[this.bridge.difficulty];
    this.redraw(name, ART.width, ART.height, (ctx) => {
      ctx.translate(STAGE_X - ART.left, stage.y0 - ART.top);
      ctx.scale(stage.scale, stage.scale);
      drawStage(ctx, puzzle.heights, lit, this.colors);
    });
  }

  /** Lưới hình chiếu của thẻ thứ `i` (gốc texture đặt tại tâm thẻ). */
  private gridTexture(i: number, choice: TopViewChoice, showHeights: boolean) {
    const { width, height } = GRID_TEX;
    return this.redraw(`grid-${i}`, width, height, (ctx) => {
      ctx.translate(width / 2, height / 2);
      drawGrid(ctx, choice.grid, showHeights, this.colors);
    });
  }

  /**
   * Thẻ lựa chọn kèm bóng đổ (chung một ảnh). Thẻ rê chuột: viền 7 và bóng lệch thêm 4 px vì mặt thẻ
   * nhấc lên 4 px còn bóng đứng yên. Thẻ chạm sai: viền gạch đứt màu lỗi thay cho viền mực.
   */
  private cardTexture(state: CardState) {
    const c = this.colors;
    const { width, height, radius } = CARD;
    const shadow = state === "hover" ? CARD.shadow + CARD.lift : CARD.shadow;
    const pad = 6;
    return this.texture(
      `card-${state}`,
      width + 2 * pad,
      height + 2 * (CARD.shadow + CARD.lift + pad),
      (ctx) => {
        roundRectPath(ctx, -width / 2, -height / 2 + shadow, width, height, radius);
        ctx.fillStyle = c.sticker;
        ctx.fill();
        roundRectPath(ctx, -width / 2, -height / 2, width, height, radius);
        ctx.fillStyle = c.card;
        ctx.fill();
        if (state === "miss") {
          ctx.setLineDash(evenDash(width, height, radius, MISS_DASH));
          ctx.lineCap = "butt";
          ctx.lineWidth = MISS_BORDER;
          ctx.strokeStyle = c.destructive;
        } else {
          ctx.lineWidth = state === "hover" ? CARD.hoverBorder : CARD.border;
          ctx.strokeStyle = c.border;
        }
        ctx.stroke();
      },
    );
  }

  /** Thẻ mô hình: viền mực dày, bóng đổ, huy hiệu con mắt giữa cạnh trên + mũi tên chỉ xuống. */
  private modelTexture() {
    const c = this.colors;
    const { width, height, radius } = MODEL;
    const pad = 8;
    const halfH = -EYE_Y + EYE_R + pad;
    return this.texture("model", width + 2 * pad, 2 * halfH, (ctx) => {
      roundRectPath(ctx, -width / 2, -height / 2 + MODEL.shadow, width, height, radius);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      roundRectPath(ctx, -width / 2, -height / 2, width, height, radius);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.lineWidth = MODEL.border;
      ctx.strokeStyle = c.border;
      ctx.stroke();

      ctx.save();
      ctx.translate(0, EYE_Y);
      ctx.beginPath();
      ctx.arc(0, 0, EYE_R, 0, Math.PI * 2);
      ctx.fillStyle = c.muted;
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = c.cardFg;
      ctx.stroke();
      const eye = new Path2D(EYE);
      ctx.fillStyle = c.card;
      ctx.fill(eye);
      ctx.stroke(eye);
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fillStyle = c.cell;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = c.border;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = c.border;
      ctx.fill();
      ctx.restore();

      strokeIcon(ctx, EYE_ARROW, 5, c.cardFg);
    });
  }

  /** Dải nhắc: ô bệ nghiêng có mép cam → lưới có vạch cam (mép cam = vạch cam). Không chữ. */
  private hintTexture() {
    const c = this.colors;
    return this.texture("hint", 248, 64, (ctx) => {
      roundRectPath(ctx, -120, -28, 240, 56, 28);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = c.border;
      ctx.stroke();

      const ink = c.cardFg;
      const w = 2.5;
      fillPolygon(
        ctx,
        [
          [-54, -18],
          [-28.02, -3],
          [-54, 12],
          [-79.98, -3],
        ],
        c.slabTop,
        ink,
        w,
      );
      fillPolygon(
        ctx,
        [
          [-79.98, -3],
          [-54, 12],
          [-54, 18],
          [-79.98, 3],
        ],
        c.orange,
        ink,
        w,
      );
      fillPolygon(
        ctx,
        [
          [-54, 12],
          [-28.02, -3],
          [-28.02, 3],
          [-54, 18],
        ],
        c.slabSide,
        ink,
        w,
      );
      ctx.fillStyle = c.muted;
      ctx.fillRect(36, -22, 36, 36);
      ctx.lineWidth = w;
      ctx.strokeStyle = ink;
      ctx.strokeRect(36, -22, 36, 36);
      roundRectPath(ctx, 36, 18, 36, 7, 2.5);
      ctx.fillStyle = c.orange;
      ctx.fill();
      ctx.stroke();

      ctx.save();
      ctx.globalAlpha = 0.45;
      strokeIcon(
        ctx,
        "M-41.01 -10.5 L-66.99 4.5 M-66.99 -10.5 L-41.01 4.5 M54 -22 L54 14 M36 -4 L72 -4",
        2,
        ink,
      );
      ctx.restore();
      strokeIcon(ctx, "M-14 0 L17 0 M8 -8 L18 0 L8 8", 4, ink);
    });
  }

  /** Nhãn mép trước: viên thuốc cam viền mực có bóng, chữ mực (giãn theo độ dài chữ). */
  private frontTexture(text: string) {
    const c = this.colors;
    const font = `${FONT_WEIGHT} ${FRONT.fontSize}px ${FONT_FAMILY}`;
    const measure = document.createElement("canvas").getContext("2d");
    if (measure) measure.font = font;
    const textWidth = measure?.measureText(text).width ?? 0;
    const width = Math.max(FRONT.width, Math.ceil(textWidth) + 2 * FRONT.padding);
    const { height, shadow } = FRONT;
    return this.texture(`front-${text}`, width + 8, height + 2 * (shadow + 4), (ctx) => {
      roundRectPath(ctx, -width / 2, -height / 2 + shadow, width, height, height / 2);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      roundRectPath(ctx, -width / 2, -height / 2, width, height, height / 2);
      ctx.fillStyle = c.orange;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = c.border;
      ctx.stroke();
      ctx.font = font;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = LABEL_INK;
      ctx.fillText(text, 0, FRONT.baseline);
    });
  }

  /** Vòng vàng viền mực quanh thẻ đúng (nằm dưới thẻ). */
  private ringTexture() {
    const c = this.colors;
    return this.texture("ring", 360, 340, (ctx) => {
      roundRectPath(ctx, -170, -160, 340, 320, 36);
      ctx.lineWidth = 14;
      ctx.strokeStyle = c.border;
      ctx.stroke();
      ctx.lineWidth = 8;
      ctx.strokeStyle = c.primary;
      ctx.stroke();
    });
  }

  /** Huy hiệu tròn có bóng: ✓ (vàng), ✗ (màu lỗi), gương và xoay (nền thẻ). */
  private badgeTexture(kind: BadgeKind) {
    const c = this.colors;
    const size = 2 * (BADGE_R + BADGE_SHADOW + 4);
    return this.texture(`badge-${kind}`, size, size, (ctx) => {
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
      else if (kind === "mirror") {
        strokeIcon(ctx, MIRROR_AXIS, 3, c.cardFg, [4, 3]);
        strokeIcon(ctx, MIRROR_ARROWS, 4, c.cardFg);
      } else {
        ctx.translate(0, -3);
        strokeIcon(ctx, TURN_ARC, 4, c.cardFg);
        strokeIcon(ctx, TURN_HEAD, 4, c.cardFg);
      }
    });
  }
}
