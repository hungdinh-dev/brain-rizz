import {
  PIECE_FIT_BOX_SIZE,
  PIECE_FIT_MAX_PIECE_SIDE,
  type PieceFitCell,
  type PieceFitPuzzle,
  pieceFit,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import type { Ctx } from "../_shared/canvas";
import {
  BADGE_BAD_AT,
  BADGE_CANVAS,
  BADGE_MIRROR_AT,
  BADGE_OK_AT,
  type BadgeKind,
  type CardState,
  CHOICE_CARD,
  CHOICE_CARD_CANVAS,
  drawBadge,
  drawChoiceCard,
  drawCorrectRing,
  makeCenteredCanvas,
  RING_CANVAS,
} from "../_shared/card-art";
import { DESIGN_WIDTH, type MinigameBridge } from "../types";

/*
 * Mảnh vừa khít — đặc tả: docs/04-minigames/piece-fit.md (mục "Ghi chú cho FE").
 * Chưa có bản mẫu riêng: bố cục theo bảng Bố cục của đặc tả; thẻ, viền, huy hiệu ✓/✗ và icon gương
 * cùng kiểu với Xoay hình (bản mẫu RotateStates) vì cùng luật "xoay được, lật thì sai".
 * Scene không vẽ chữ: chỉ có hộp lưới, mảnh ghép ô, icon và huy hiệu ✓/✗.
 */

// ---------------------------------------------------------------- bố cục (khung 720×1280)

type Point = readonly [x: number, y: number];
type Cells = readonly PieceFitCell[];
/** Hình chữ nhật `[x, y, rộng, cao]` (px). */
type Rect = readonly [x: number, y: number, w: number, h: number];

/** Hộp: căn giữa ngang, mép trên y = 96, không nhận chạm. */
const BOX_TOP = 96;
/** Viền mực ngoài hộp (vẽ ra ngoài để ô giữ đúng cỡ u) và bóng đổ kiểu nhãn dán. */
const BOX_BORDER = 6;
const BOX_SHADOW = 8;
/** Ô đã xếp: gạch chéo phấn (hoa văn, không chỉ màu) và đường chia ô mảnh. */
const HATCH_SPACING = 18;
const HATCH_LINE = 3;
const HATCH_MIX = 0.22;
const BOX_GRID_LINE = 2;
const BOX_GRID_MIX = 0.3;
/**
 * Viền phấn gạch đứt quanh khoảng trống, lùi vào trong 6 px: chừa một dải màu bảng giữa ô đã xếp
 * (nền sáng) và nét phấn, nếu không nét phấn liền với ô sáng trông như mép khoảng trống bị răng cưa.
 */
const GAP_INSET = 6;
const GAP_LINE = 5;
const GAP_DASH = 14;
const GAP_SPACE = 9;

/**
 * Cỡ ô chung cho hộp và thẻ: u = min(⌊400 / cạnh hộp⌋, ⌊280 / khung bao lớn nhất của mức⌋)
 * = 93 / 70 / 70 / 66 px. Cố định theo mức để cỡ không lộ đáp án và mảnh lắp vào khít.
 */
const BOX_REACH = 400;
const PIECE_REACH = 280;

// Thẻ 320×320 (`CHOICE_CARD`), viền chạm sai, huy hiệu ✓/✗/gương: `_shared/card-art`.
/** Tâm thẻ theo đúng thứ tự `options` (trái → phải, trên → dưới); khe 24 px. Mầm: thẻ thứ ba ở giữa. */
const SLOTS_4: readonly Point[] = [
  [188, 680],
  [532, 680],
  [188, 1024],
  [532, 1024],
];
const SLOTS_3: readonly Point[] = [
  [188, 680],
  [532, 680],
  [360, 1024],
];

/** Mảnh: viền mực 3 px, bóng đổ lệch xuống (chỉ trên thẻ), đường chia ô 2 px mực 40 %. */
const OUTLINE = 3;
const PIECE_SHADOW = 7;
const GRID_LINE = 2;
const GRID_ALPHA = 0.4;
/** Bản sao mảnh đúng bay vào khoảng trống khi sai: mờ 60 %. */
const GHOST_ALPHA = 0.6;
/** Độ mờ của các thẻ không liên quan trong lúc khoá sau câu sai. */
const DIM_ALPHA = 0.35;

// ---------------------------------------------------------------- nhịp hiệu ứng (đều ≤ 400 ms)

/** Hiện câu: mờ dần, phóng 0,96 → 1; nhận chạm ngay. */
const APPEAR_MS = 120;
const APPEAR_SCALE = 0.96;
/** Nhấn: thẻ co 0,97 rồi về. */
const PRESS_MS = 60;
const PRESS_SCALE = 0.97;
/** Đúng: bản sao bay + xoay 250 ms, hộp nảy 100 ms, sang câu mới sau 350 ms (tính vào giờ câu sau). */
const FLY_RIGHT_MS = 250;
const BOUNCE_MS = 100;
const BOUNCE_SCALE = 1.04;
const SOLVED_MS = 350;
/** Sai: rung ±8 px trong 200 ms, bản sao bay 300 ms; hết khoá theo server (`unlockDelay`). */
const FLY_MISS_MS = 300;
const SHAKE_MS = 200;
const SHAKE_PX = 8;
const DIM_MS = 120;

// ---------------------------------------------------------------- màu

/**
 * Ô mảnh ở giao diện tối: tím sáng của nhóm Hình dung trên thẻ tối, dùng chung với Xoay hình và
 * Gấp hộp (5,3:1 trên thẻ #2f2a52). Giao diện sáng dùng token `--color-visualize`.
 */
const SHAPE_DARK = "#a99ce0";

/** Token CSS (tự đổi theo sáng/tối) và giá trị nền sáng khi không đọc được biến. */
const TOKENS = {
  card: ["--card", "#fff8ef"],
  cardFg: ["--card-foreground", "#1f1b3a"],
  /** Mực: viền thẻ, viền hộp, viền mảnh. */
  border: ["--border", "#1f1b3a"],
  /** Bóng đổ kiểu nhãn dán. */
  sticker: ["--sticker", "#1f1b3a"],
  /** Nền khung chơi (bg-muted của GameFrame). */
  muted: ["--muted", "#f3eadf"],
  primary: ["--primary", "#ffd166"],
  primaryFg: ["--primary-foreground", "#1f1b3a"],
  destructive: ["--destructive", "#c93a55"],
  /** Khoảng trống: màu bảng phấn. */
  board: ["--board", "#2d6a54"],
  /** Viền gạch đứt quanh khoảng trống. */
  chalk: ["--chalk", "#f6f3ea"],
  /** Ô mảnh (nhóm Hình dung). */
  shape: ["--color-visualize", "#7768ae"],
} as const;

type Tone = keyof typeof TOKENS;
/** Màu đọc từ token lúc tạo scene. Chuỗi CSS để vẽ texture canvas. */
type Palette = Record<Tone, string>;

function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const tones = Object.keys(TOKENS) as Tone[];
  const palette = Object.fromEntries(
    tones.map((tone) => {
      const [name, fallback] = TOKENS[tone];
      return [tone, style.getPropertyValue(name).trim() || fallback];
    }),
  ) as Palette;
  if (style.colorScheme === "dark") palette.shape = SHAPE_DARK;
  return palette;
}

/** Màu CSS → số màu của Phaser. */
const toColor = (css: string) => Phaser.Display.Color.ValueToColor(css).color;
/** Số màu → chuỗi CSS `#rrggbb`. */
const toCss = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/** Trộn hai màu số (t = 0 → a, t = 1 → b). */
function mix(a: number, b: number, t: number) {
  const channel = (shift: number) =>
    Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t) << shift;
  return channel(16) | channel(8) | channel(0);
}

/** Màu số cho Graphics. Màu "mờ" trộn sẵn thành màu đặc để chỗ giao nhau không đậm hơn. */
interface Inks {
  border: number;
  sticker: number;
  shape: number;
  /** Đường chia ô trên mảnh: mực 40 % trên nền mảnh. */
  grid: number;
  card: number;
  /** Gạch chéo trên ô đã xếp (sáng: mực nhạt, tối: kem nhạt). */
  hatch: number;
  /** Đường chia ô đã xếp. */
  boxGrid: number;
  board: number;
  chalk: number;
  muted: number;
}

function toInks(c: Palette): Inks {
  const border = toColor(c.border);
  const shape = toColor(c.shape);
  const card = toColor(c.card);
  const cardFg = toColor(c.cardFg);
  return {
    border,
    sticker: toColor(c.sticker),
    shape,
    grid: mix(shape, border, GRID_ALPHA),
    card,
    hatch: mix(card, cardFg, HATCH_MIX),
    boxGrid: mix(card, cardFg, BOX_GRID_MIX),
    board: toColor(c.board),
    chalk: toColor(c.chalk),
    muted: toColor(c.muted),
  };
}

// Giảm chuyển động (`prefersReducedMotion` dùng chung, theo nút Hiệu ứng): bỏ rung, co, phóng, nảy
// và cảnh bay; bản sao mảnh đặt luôn vào khoảng trống. Giữ đổi viền, huy hiệu, làm mờ.

// ---------------------------------------------------------------- hình học ô

const cellId = (x: number, y: number) => `${x},${y}`;

/** Khung bao (đơn vị ô) của các ô, toạ độ tuyệt đối. */
function bounds(cells: Cells) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of cells) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Gộp các số nguyên liên tiếp thành đoạn [đầu, cuối]. */
function runs(values: Iterable<number>): [number, number][] {
  const out: [number, number][] = [];
  for (const v of [...new Set(values)].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && v === last[1] + 1) last[1] = v;
    else out.push([v, v]);
  }
  return out;
}

/** Chia đoạn dài `length` thành nét đứt bắt đầu và kết thúc bằng một nét: [vị trí, dài][]. */
function dashes(length: number, dash: number, space: number): [number, number][] {
  const n = Math.max(1, Math.round((length + space) / (dash + space)));
  if (n === 1) return [[0, length]];
  const step = dash + (length - n * dash) / (n - 1);
  return Array.from({ length: n }, (_, i): [number, number] => [i * step, dash]);
}

/**
 * Viền gạch đứt dày `t` chạy song song chu vi các ô, lùi vào trong `m` px (nằm hẳn trong vùng ô,
 * không lấn sang ô đã xếp), không vẽ đường nào giữa hai ô của vùng. Mỗi cạnh thẳng chia nét riêng,
 * bắt đầu và kết thúc bằng nét nên góc nào cũng liền: góc lồi (1 trong 4 ô quanh đỉnh thuộc vùng)
 * rút nét vào `m`, góc lõm (3 trong 4) kéo dài nét thêm `m + t` để lấp góc. Toạ độ px, gốc là góc
 * trên trái ô (0, 0).
 */
function insideDashes(cells: Cells, u: number, m: number, t: number): Rect[] {
  const has = new Set(cells.map(([x, y]) => cellId(x, y)));
  const filled = (x: number, y: number) => has.has(cellId(x, y));
  const extend = (vx: number, vy: number) => {
    const around = [
      filled(vx - 1, vy - 1),
      filled(vx, vy - 1),
      filled(vx - 1, vy),
      filled(vx, vy),
    ].filter(Boolean).length;
    return around === 3 ? m + t : around === 1 ? -m : 0;
  };

  // Cạnh biên theo đường kẻ: khoá `đường|phía`, phía 1 = vùng ở dưới / bên phải, −1 = ở trên / bên trái.
  const rows = new Map<string, number[]>();
  const columns = new Map<string, number[]>();
  const push = (map: Map<string, number[]>, key: string, v: number) =>
    map.set(key, [...(map.get(key) ?? []), v]);
  for (const [x, y] of cells) {
    if (!filled(x, y - 1)) push(rows, `${y}|1`, x);
    if (!filled(x, y + 1)) push(rows, `${y + 1}|-1`, x);
    if (!filled(x - 1, y)) push(columns, `${x}|1`, y);
    if (!filled(x + 1, y)) push(columns, `${x + 1}|-1`, y);
  }

  const out: Rect[] = [];
  for (const [vertical, map] of [
    [false, rows],
    [true, columns],
  ] as const) {
    for (const [key, values] of map) {
      const [line = 0, side = 1] = key.split("|").map(Number);
      const across = side > 0 ? line * u + m : line * u - m - t;
      for (const [first, last] of runs(values)) {
        const from = first;
        const to = last + 1;
        const head = vertical ? extend(line, from) : extend(from, line);
        const tail = vertical ? extend(line, to) : extend(to, line);
        const start = from * u - head;
        for (const [at, len] of dashes((to - from) * u + head + tail, GAP_DASH, GAP_SPACE)) {
          out.push(vertical ? [across, start + at, t, len] : [start + at, across, len, t]);
        }
      }
    }
  }
  return out;
}

/** Tô một hình chữ nhật màu đặc: dùng chung cho Graphics (thẻ) và canvas 2D (bản sao mờ). */
type Paint = (color: number, x: number, y: number, w: number, h: number) => void;

/**
 * Mảnh ghép ô, tâm khung bao ở gốc toạ độ: (bóng) → viền mực (ô nở thêm 3 px) → ô tím → đường
 * chia ô 2 px giữa hai ô kề nhau. Mọi lớp màu đặc; bản sao mờ vẽ ra texture rồi mới làm mờ cả ảnh.
 */
function paintPiece(paint: Paint, cells: Cells, u: number, ink: Inks, shadow: boolean) {
  const { minX, minY, width, height } = bounds(cells);
  const ox = -(width * u) / 2 - minX * u;
  const oy = -(height * u) / 2 - minY * u;
  const grown = (color: number, dy: number) => {
    for (const [x, y] of cells) {
      paint(
        color,
        ox + x * u - OUTLINE,
        oy + y * u - OUTLINE + dy,
        u + 2 * OUTLINE,
        u + 2 * OUTLINE,
      );
    }
  };
  if (shadow) grown(ink.sticker, PIECE_SHADOW);
  grown(ink.border, 0);
  for (const [x, y] of cells) paint(ink.shape, ox + x * u, oy + y * u, u, u);

  const has = new Set(cells.map(([x, y]) => cellId(x, y)));
  const h = GRID_LINE / 2;
  for (const [x, y] of cells) {
    const px = ox + x * u;
    const py = oy + y * u;
    if (has.has(cellId(x + 1, y))) paint(ink.grid, px + u - h, py, GRID_LINE, u);
    if (has.has(cellId(x, y + 1))) paint(ink.grid, px, py + u - h, u, GRID_LINE);
  }
}

// ---------------------------------------------------------------- scene

interface CardView {
  /** Đặt tại tâm thẻ: mờ dần khi hiện câu, chứa lớp phủ khi bị làm mờ. */
  slot: Phaser.GameObjects.Container;
  /** Mặt thẻ (thẻ + mảnh + huy hiệu): nhấc lên khi rê chuột, co khi nhấn, rung khi sai. */
  face: Phaser.GameObjects.Container;
  card: Phaser.GameObjects.Image;
  hovered: boolean;
}

/** Mảnh vừa khít — chạm vào thẻ có mảnh lấp vừa khít khoảng trống (được xoay, không được lật). */
export default class PieceFitScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = false;
  private colors!: Palette;
  private inks!: Inks;
  private reducedMotion = false;
  /** Cỡ ô của mức đang chơi, chung cho hộp và thẻ. */
  private unit = 70;
  private board?: Phaser.GameObjects.Container;
  /** Hộp lưới (tâm hộp), nảy khi mảnh khớp vào. */
  private box?: Phaser.GameObjects.Container;
  private cards: CardView[] = [];
  /** Texture bản sao mảnh của câu hiện tại (tạo khi trả lời, xoá khi sang câu mới). */
  private ghostKey?: string;
  /** Hẹn giờ của câu hiện tại (sang câu mới); huỷ hết khi sang câu mới hoặc rời màn. */
  private timers: Phaser.Time.TimerEvent[] = [];

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.locked = false;
    this.cards = [];
    this.timers = [];
    this.ghostKey = undefined;
  }

  create() {
    const canvas = this.game.canvas;
    this.colors = readPalette(canvas.isConnected ? canvas : document.documentElement);
    this.inks = toInks(this.colors);
    this.reducedMotion = prefersReducedMotion();
    const level = this.bridge.difficulty;
    this.unit = Math.min(
      Math.floor(BOX_REACH / PIECE_FIT_BOX_SIZE[level]),
      Math.floor(PIECE_REACH / PIECE_FIT_MAX_PIECE_SIDE[level]),
    );

    const cleanup = () => {
      this.clearTimers();
      this.tweens.killAll();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.clearTimers());

    this.showPuzzle();
  }

  // -------------------------------------------------------------- dựng câu đố

  private showPuzzle() {
    // Mọi hẹn giờ và tween đang chạy đều thuộc câu cũ: dừng trước khi huỷ.
    this.clearTimers();
    this.tweens.killAll();
    this.board?.destroy();
    if (this.ghostKey && this.textures.exists(this.ghostKey)) this.textures.remove(this.ghostKey);
    this.ghostKey = undefined;
    this.locked = false;

    const puzzle = pieceFit.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    const board = this.add.container(0, 0);
    const box = this.makeBox(puzzle);
    board.add(box);

    const slots = puzzle.options.length > 3 ? SLOTS_4 : SLOTS_3;
    this.cards = puzzle.options.map((option, i) => {
      const [x, y] = slots[i] ?? SLOTS_4[0]!;
      const card = this.add.image(0, 0, this.cardTexture("idle"));
      const piece = this.add.graphics();
      paintPiece(this.graphicsPaint(piece), option.cells, this.unit, this.inks, true);
      const face = this.add.container(0, 0, [card, piece]);
      const slot = this.add.container(x, y, [face]);
      const view: CardView = { slot, face, card, hovered: false };

      // Vùng chạm phủ cả thẻ 320×320; ghi nhận ở pointerdown, một chạm là chốt.
      const zone = this.add
        .zone(x, y, CHOICE_CARD.size, CHOICE_CARD.size)
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
    this.box = box;

    // Hiện câu: mờ dần + phóng nhẹ, nhận chạm ngay.
    const targets = [box, ...this.cards.map((view) => view.slot)];
    for (const target of targets) {
      target.setAlpha(0);
      if (!this.reducedMotion) target.setScale(APPEAR_SCALE);
    }
    this.tweens.add({ targets, alpha: 1, scale: 1, duration: APPEAR_MS, ease: "Quad.easeOut" });
  }

  private graphicsPaint(g: Phaser.GameObjects.Graphics): Paint {
    return (color, x, y, w, h) => {
      g.fillStyle(color, 1);
      g.fillRect(x, y, w, h);
    };
  }

  /** Cạnh hộp (px). */
  private boxSize(puzzle: PieceFitPuzzle) {
    return { w: puzzle.box.cols * this.unit, h: puzzle.box.rows * this.unit };
  }

  /** Tâm khung bao khoảng trống, so với tâm hộp (px). */
  private gapCenter(puzzle: PieceFitPuzzle): Point {
    const u = this.unit;
    const { w, h } = this.boxSize(puzzle);
    const { minX, minY, width, height } = bounds(puzzle.gap);
    return [(minX + width / 2) * u - w / 2, (minY + height / 2) * u - h / 2];
  }

  /**
   * Hộp lưới, gốc ở tâm hộp: bóng → nền thẻ → gạch chéo phấn → khoảng trống màu bảng → đường chia
   * ô (chỉ giữa hai ô đã xếp) → viền mực ngoài → viền phấn gạch đứt bên trong khoảng trống.
   */
  private makeBox(puzzle: PieceFitPuzzle) {
    const ink = this.inks;
    const u = this.unit;
    const { cols, rows } = puzzle.box;
    const { w, h } = this.boxSize(puzzle);
    const left = -w / 2;
    const top = -h / 2;
    const b = BOX_BORDER;
    const g = this.add.graphics();

    g.fillStyle(ink.sticker, 1);
    g.fillRect(left - b, top - b + BOX_SHADOW, w + 2 * b, h + 2 * b);
    g.fillStyle(ink.card, 1);
    g.fillRect(left, top, w, h);

    // Gạch chéo "/" phủ cả hộp, theo toạ độ chung để nét liền qua các ô; khoảng trống tô đè sau.
    g.lineStyle(HATCH_LINE, ink.hatch, 1);
    for (let c = HATCH_SPACING / 2; c < w + h; c += HATCH_SPACING) {
      const x1 = Math.min(c, w);
      const y2 = Math.min(c, h);
      g.lineBetween(left + x1, top + c - x1, left + c - y2, top + y2);
    }

    const gap = new Set(puzzle.gap.map(([x, y]) => cellId(x, y)));
    const isGap = (x: number, y: number) => gap.has(cellId(x, y));
    g.fillStyle(ink.board, 1);
    for (const [x, y] of puzzle.gap) g.fillRect(left + x * u, top + y * u, u, u);

    const half = BOX_GRID_LINE / 2;
    g.fillStyle(ink.boxGrid, 1);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (isGap(x, y)) continue;
        if (x + 1 < cols && !isGap(x + 1, y)) {
          g.fillRect(left + (x + 1) * u - half, top + y * u, BOX_GRID_LINE, u);
        }
        if (y + 1 < rows && !isGap(x, y + 1)) {
          g.fillRect(left + x * u, top + (y + 1) * u - half, u, BOX_GRID_LINE);
        }
      }
    }

    // Viền mực vẽ sau gạch chéo để che đầu nét lấn ra ngoài hộp.
    g.fillStyle(ink.border, 1);
    g.fillRect(left - b, top - b, w + 2 * b, b);
    g.fillRect(left - b, top + h, w + 2 * b, b);
    g.fillRect(left - b, top, b, h);
    g.fillRect(left + w, top, b, h);

    g.fillStyle(ink.chalk, 1);
    for (const [x, y, rw, rh] of insideDashes(puzzle.gap, u, GAP_INSET, GAP_LINE)) {
      g.fillRect(left + x, top + y, rw, rh);
    }

    return this.add.container(DESIGN_WIDTH / 2, BOX_TOP + h / 2, [g]);
  }

  private setHover(view: CardView, on: boolean) {
    if (view.hovered === on) return;
    view.hovered = on;
    view.face.y = on ? -CHOICE_CARD.lift : 0;
    view.card.setTexture(this.cardTexture(on ? "hover" : "idle"));
  }

  // -------------------------------------------------------------- trả lời

  private answer(puzzle: PieceFitPuzzle, choice: number) {
    if (this.locked) return;
    this.locked = true;

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const index = this.index;
    const correct = pieceFit.check(puzzle, choice);
    this.bridge.submit(index, choice);
    this.index += 1;

    for (const view of this.cards) this.setHover(view, false);
    const picked = this.cards[choice];
    const right = this.cards[puzzle.answerIndex];
    if (!picked || !right) return;
    if (!this.reducedMotion) {
      this.tweens.add({
        targets: picked.face,
        scale: PRESS_SCALE,
        duration: PRESS_MS / 2,
        yoyo: true,
      });
    }

    if (correct) {
      this.markRight(right);
      this.fitPiece(puzzle, right, 1, FLY_RIGHT_MS);
      this.after(SOLVED_MS, () => this.showPuzzle());
      return;
    }

    this.showMiss(picked, puzzle.options[choice]?.kind === "mirror");
    this.markRight(right);
    for (const view of this.cards) if (view !== picked && view !== right) this.dim(view);
    this.fitPiece(puzzle, right, GHOST_ALPHA, FLY_MISS_MS);

    // Hết khoá theo `lockedUntil` của server (không tự đếm 1,5 giây) để khớp huy hiệu khoá của khung.
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive() || this.index !== index + 1) return;
      this.after(ms, () => this.showPuzzle());
    });
  }

  /** Thẻ đúng: vòng vàng viền liền + ✓. */
  private markRight(view: CardView) {
    view.face.addAt(this.add.image(0, 0, this.ringTexture()), 0);
    view.face.add(this.add.image(BADGE_OK_AT[0], BADGE_OK_AT[1], this.badgeTexture("ok")));
  }

  /**
   * Bản sao mảnh của thẻ đúng bay từ thẻ vào khoảng trống, vừa bay vừa xoay `answerTurns` lượt
   * theo chiều gần nhất (3 lượt thì quay ngược 90°), khớp vào thì hộp nảy nhẹ; sau đó nằm lại trong
   * khoảng trống. Giảm chuyển động: đặt luôn vào khoảng trống, không bay, không nảy.
   */
  private fitPiece(puzzle: PieceFitPuzzle, view: CardView, alpha: number, flyMs: number) {
    const board = this.board;
    const box = this.box;
    const fit = puzzle.options[puzzle.answerIndex];
    if (!board || !box || !fit) return;

    const key = this.ghostTexture(fit.cells);
    const turns = ((puzzle.answerTurns % 4) + 4) % 4;
    const angle = turns === 3 ? -90 : turns * 90;
    const [gx, gy] = this.gapCenter(puzzle);
    // Nằm lại trong hộp (Container.add tự gỡ khỏi lớp bay) để nảy cùng hộp.
    const settle = (ghost: Phaser.GameObjects.Image) => {
      box.add(ghost);
      ghost.setPosition(gx, gy);
    };

    if (this.reducedMotion) {
      settle(this.add.image(0, 0, key).setAngle(angle).setAlpha(alpha));
      return;
    }

    // Bay ở lớp trên cùng (trên mọi thẻ), bắt đầu trùng mảnh trên thẻ.
    const ghost = this.add.image(view.slot.x, view.slot.y, key).setAlpha(alpha);
    board.add(ghost);
    this.tweens.add({
      targets: ghost,
      x: box.x + gx,
      y: box.y + gy,
      angle,
      duration: flyMs,
      ease: "Sine.easeInOut",
      onComplete: () => {
        settle(ghost);
        this.tweens.add({
          targets: box,
          scale: BOUNCE_SCALE,
          duration: BOUNCE_MS / 2,
          yoyo: true,
          ease: "Quad.easeOut",
        });
      },
    });
  }

  /** Thẻ bị chạm sai: viền gạch đứt + ✗ (bản lật gương thêm icon gương), rung ngang ±8 px. */
  private showMiss(view: CardView, mirror: boolean) {
    view.card.setTexture(this.cardTexture("miss"));
    if (mirror) {
      view.face.add(
        this.add.image(BADGE_MIRROR_AT[0], BADGE_MIRROR_AT[1], this.badgeTexture("mirror")),
      );
    }
    view.face.add(this.add.image(BADGE_BAD_AT[0], BADGE_BAD_AT[1], this.badgeTexture("bad")));
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
   * Làm mờ thẻ còn 35 % bằng lớp phủ màu nền khung (65 %). Đặt alpha cho cả nhóm thì Phaser tính
   * riêng từng lớp, bóng đổ dưới thẻ và dưới mảnh sẽ lộ ra; nền khung là một màu nên phủ cho kết
   * quả giống hệt làm mờ cả nhóm.
   */
  private dim(view: CardView) {
    const height = CHOICE_CARD.size + CHOICE_CARD.shadow + 4;
    const veil = this.add
      .rectangle(0, CHOICE_CARD.shadow / 2, CHOICE_CARD.size + 4, height, this.inks.muted, 1)
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

  /** Vẽ canvas 2D (gốc toạ độ ở tâm) rồi đăng ký làm texture. */
  private addCanvasTexture(key: string, width: number, height: number, draw: (ctx: Ctx) => void) {
    this.textures.addCanvas(key, makeCenteredCanvas(width, height, draw));
    return key;
  }

  /** Texture dùng suốt vòng: tạo một lần nếu chưa có; trả về khoá. */
  private texture(name: string, width: number, height: number, draw: (ctx: Ctx) => void) {
    const key = `piece-fit:${name}`;
    if (this.textures.exists(key)) return key;
    return this.addCanvasTexture(key, width, height, draw);
  }

  /**
   * Bản sao mảnh đúng (không bóng), tâm khung bao ở tâm ảnh để xoay quanh đúng tâm khoảng trống.
   * Vẽ ra texture để làm mờ 60 % cả mảnh một lượt (viền dưới ô tím không lộ ra).
   */
  private ghostTexture(cells: Cells) {
    const key = `piece-fit:ghost-${this.index}`;
    if (this.textures.exists(key)) this.textures.remove(key);
    this.ghostKey = key;
    const { width, height } = bounds(cells);
    const pad = OUTLINE + 2;
    return this.addCanvasTexture(
      key,
      width * this.unit + 2 * pad,
      height * this.unit + 2 * pad,
      (ctx) => {
        paintPiece(
          (color, x, y, w, h) => {
            ctx.fillStyle = toCss(color);
            ctx.fillRect(x, y, w, h);
          },
          cells,
          this.unit,
          this.inks,
          false,
        );
      },
    );
  }

  /** Thẻ lựa chọn kèm bóng đổ (chung một ảnh): thường, rê chuột hoặc chạm sai. */
  private cardTexture(state: CardState) {
    const { width, height } = CHOICE_CARD_CANVAS;
    return this.texture(`card-${state}`, width, height, (ctx) =>
      drawChoiceCard(ctx, this.colors, state),
    );
  }

  /** Vòng vàng viền mực quanh thẻ đúng (nằm dưới thẻ). */
  private ringTexture() {
    return this.texture("ring", RING_CANVAS, RING_CANVAS, (ctx) =>
      drawCorrectRing(ctx, this.colors),
    );
  }

  /** Huy hiệu tròn có bóng: ✓ (vàng), ✗ (màu lỗi), gương (nền thẻ). */
  private badgeTexture(kind: BadgeKind) {
    return this.texture(`badge-${kind}`, BADGE_CANVAS, BADGE_CANVAS, (ctx) =>
      drawBadge(ctx, this.colors, kind),
    );
  }
}
