import {
  type BalanceItem,
  type BalancePuzzle,
  type BalanceScale,
  balance,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { DESIGN_WIDTH, type MinigameBridge } from "../types";
import { type ArtPart, ITEM_ART, ITEM_BOX } from "./items";

/*
 * Cân não — đọc các cân đĩa, chạm vật nặng nhất ở hàng lựa chọn bên dưới.
 * Đặc tả: docs/04-minigames/balance.md (mục "Ghi chú cho FE"); bản mẫu: BalanceMobile,
 * BalanceLevels, BalanceStates trên canvas Brain Rizz. Không có chữ trong màn chơi.
 *
 * Hình vật lấy từ bảng `ITEM_ART` (items.ts): đổi bộ vật chỉ cần thay bảng đó.
 * Vật, cân, đĩa được vẽ một lần ra canvas 2D (đúng nét bản mẫu, kể cả đường cong) rồi dùng
 * làm texture; ô và vòng khoanh vẽ bằng Graphics.
 */

// ─── Màu ────────────────────────────────────────────────────────────────────────────────────────

/** Token CSS (tự đổi theo sáng/tối), đọc lại mỗi câu để đổi giao diện giữa vòng vẫn đúng. */
const TOKENS = {
  /** Nền ô cân, ô lựa chọn, đĩa cân. */
  card: "--card",
  /** Nét cân: mực trên nền sáng, kem trên nền tối. */
  line: "--card-foreground",
  /** Viền ô lựa chọn, viền vật, viền ngoài vòng khoanh. */
  sticker: "--sticker",
  /** Vòng khoanh vật đúng, dấu ✓. */
  primary: "--primary",
  /** Dấu ✗. */
  destructive: "--destructive",
  /** Màu nhóm Phân tích, chỉ làm điểm nhấn: đế cân, huy hiệu "=". */
  accent: "--color-analyze",
  /** Dấu "=" trên huy hiệu xanh (giống nhau ở hai nền). */
  ink: "--color-ink",
} as const;

type Tone = keyof typeof TOKENS;

/** Giá trị token ở nền sáng, chỉ dùng khi không đọc được biến CSS. */
const FALLBACK: Record<Tone, string> = {
  card: "#fff8ef",
  line: "#1f1b3a",
  sticker: "#1f1b3a",
  primary: "#ffd166",
  destructive: "#c93a55",
  accent: "#4d9de0",
  ink: "#1f1b3a",
};

/** Bảng màu riêng của game (bản mẫu BalanceStates): viền trắng quanh dấu ✗ ở cả hai nền. */
const CROSS_HALO = "#ffffff";

interface Paint {
  num: number;
  css: string;
}

type Palette = Record<Tone, Paint> & { id: string };

function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const tones = Object.keys(TOKENS) as Tone[];
  const paints = tones.map((tone): [Tone, Paint] => {
    const raw = style.getPropertyValue(TOKENS[tone]).trim() || FALLBACK[tone];
    const num = Phaser.Display.Color.ValueToColor(raw).color;
    return [tone, { num, css: `#${num.toString(16).padStart(6, "0")}` }];
  });
  return {
    ...(Object.fromEntries(paints) as Record<Tone, Paint>),
    id: paints.map(([, paint]) => paint.css.slice(1)).join(""),
  };
}

// ─── Bố cục (px trong khung 720×1280) ─────────────────────────────────────────────────────────

const MARGIN = 32;
const AREA_W = DESIGN_WIDTH - MARGIN * 2;
/** Vùng cân y 32–872, không nhận chạm. */
const SCALES_TOP = 32;
const SCALES_BOTTOM = 872;
const CELL_GAP = 16;
const CELL_RADIUS = 24;
const CELL_EDGE = 3;
const CELL_EDGE_ALPHA = 0.16;
/** Đường ngăn phấn giữa vùng cân và hàng lựa chọn. */
const DIVIDER = { x: 48, y: 896, d: "M0 0 C152 -4 472 4 624 -1", alpha: 0.5, width: 4 };
/** Hàng lựa chọn y 920–1248, ngoài dải huy hiệu khoá của khung (tới y ≈ 225). */
const CHOICES_MID = 1084;
const TILE_RADIUS = 24;
const TILE_EDGE = 4;
const TILE_SHADOW = 6;
const TILE_GAP_Y = 16;

interface PanShape {
  /** Hai dây treo chạm đĩa ở (±strings, drop). */
  strings: number;
  drop: number;
  half: number;
  bottom: number;
  bowl: string;
}

const PAN_WIDE: PanShape = {
  strings: 62,
  drop: 108,
  half: 68,
  bottom: 132,
  bowl: "M-68 108 L68 108 C60 126 32 132 0 132 C-32 132 -60 126 -68 108 Z",
};
const PAN_NARROW: PanShape = {
  strings: 46,
  drop: 100,
  half: 52,
  bottom: 119,
  bowl: "M-52 100 L52 100 C46 114 26 119 0 119 C-26 119 -46 114 -52 100 Z",
};
/** Đĩa đôi: hai vật cạnh nhau trong cùng một đĩa, không có dấu "+". */
const PAN_DOUBLE: PanShape = {
  strings: 88,
  drop: 100,
  half: 96,
  bottom: 121,
  bowl: "M-96 100 L96 100 C86 116 48 121 0 121 C-48 121 -86 116 -96 100 Z",
};

interface StandShape {
  post: number;
  postWidth: number;
  half: number;
  bottom: number;
  base: string;
}

const STAND_TALL: StandShape = {
  post: 172,
  postWidth: 9,
  half: 90,
  bottom: 190,
  base: "M-90 190 L-78 170 L78 170 L90 190 Z",
};
const STAND_NARROW: StandShape = {
  post: 172,
  postWidth: 8,
  half: 70,
  bottom: 190,
  base: "M-70 190 L-60 172 L60 172 L70 190 Z",
};
const STAND_SHORT: StandShape = {
  post: 150,
  postWidth: 8,
  half: 62,
  bottom: 166,
  base: "M-62 166 L-52 150 L52 150 L62 166 Z",
};

/** Một kiểu cân theo cỡ ô (toạ độ tính từ trục cân). */
interface ScaleKind {
  stand: StandShape;
  beamHalf: number;
  beamWidth: number;
  pivotRadius: number;
  pan: PanShape;
  /** Cỡ vật trên đĩa (1 = 100 px). */
  item: number;
  /** Tâm vật, tính từ móc treo đĩa. */
  itemY: number;
  /** Huy hiệu "=" trên trụ. */
  equalY: number;
  /** Tâm ô cách trục cân bao nhiêu (theo chiều dọc) để cân nằm giữa ô. */
  lift: number;
}

/** 1 cột (Mầm, Thường): ô 656 × 269; Mầm phóng to TALL_ZOOM vì ô cao 412. */
const KIND_TALL: ScaleKind = {
  stand: STAND_TALL,
  beamHalf: 180,
  beamWidth: 11,
  pivotRadius: 11,
  pan: PAN_WIDE,
  item: 0.96,
  itemY: 64,
  equalY: 88,
  lift: 69.5,
};
const TALL_ZOOM = 7 / 6;
/** Lưới 2×2 ô 320 × 412 (Khó). */
const KIND_NARROW: ScaleKind = {
  stand: STAND_NARROW,
  beamHalf: 104,
  beamWidth: 10,
  pivotRadius: 10,
  pan: PAN_NARROW,
  item: 0.88,
  itemY: 58,
  equalY: 88,
  lift: 79.5,
};
/** Lưới 2×2 ô 320 × 269 (Siêu khó). */
const KIND_SMALL: ScaleKind = {
  stand: STAND_SHORT,
  beamHalf: 104,
  beamWidth: 10,
  pivotRadius: 10,
  pan: PAN_NARROW,
  item: 0.8,
  itemY: 62,
  equalY: 80,
  lift: 67.5,
};
/** Cân có đĩa đôi, rộng hết vùng ở hàng cuối (Siêu khó). */
const KIND_WIDE: ScaleKind = {
  stand: STAND_SHORT,
  beamHalf: 200,
  beamWidth: 11,
  pivotRadius: 11,
  pan: PAN_NARROW,
  item: 0.72,
  itemY: 65,
  equalY: 80,
  lift: 74.5,
};
/** Khoảng cách tâm hai vật trong đĩa đôi, theo cỡ vật (84 px ở cỡ 0,72). */
const PAIR_STEP = 84 / 0.72;

// ─── Chuyển động (mỗi hiệu ứng ≤ 400 ms, trừ thời gian khoá) ──────────────────────────────────

/** Mọi cân nghiêng cùng một góc, không phụ thuộc chênh lệch khối lượng. */
const TILT = Phaser.Math.DegToRad(14);
const FADE_MS = 120;
/** Đòn nghiêng từ ½ góc tới góc cuối (không bắt đầu nằm ngang để khỏi giống cân thăng bằng). */
const SWING_MS = 180;
const BOUNCE_SCALE = 1.15;
const BOUNCE_MS = 160;
/** Sau câu đúng sang câu mới; server tính phần này vào câu sau nên giữ ≤ 250 ms. */
const NEXT_AFTER_HIT_MS = 200;
const SHAKE_PX = 8;
const SHAKE_MS = 240;
const SHAKE_TIMES = 3;
const DIM_ALPHA = 0.35;
const HOVER_LIFT = 4;
const PRESS_SCALE = 0.96;
const PRESS_RELEASE_MS = 80;

/** Vòng khoanh: nét `primary` có viền `sticker`. */
const RING_OUTER = 14;
const RING_INNER = 8;
/** Bán kính vòng quanh vật đúng trên cân, theo cỡ vật (62 px ở cỡ 0,96). */
const SPOT_RING = 62 / 0.96;

// ─── Vẽ ra canvas 2D ───────────────────────────────────────────────────────────────────────────

type Ctx = CanvasRenderingContext2D;
/** Khung vẽ [x0, y0, x1, y1] tính theo đơn vị hình, gốc (0, 0) là điểm neo của ảnh. */
type Box = readonly [number, number, number, number];

interface Art {
  key: string;
  ox: number;
  oy: number;
}

const TAU = Math.PI * 2;

function circle(cx: number, cy: number, r: number): Path2D {
  const shape = new Path2D();
  shape.arc(cx, cy, r, 0, TAU);
  return shape;
}

function stroke(ctx: Ctx, shape: Path2D, color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke(shape);
}

function fill(ctx: Ctx, shape: Path2D, color: string) {
  ctx.fillStyle = color;
  ctx.fill(shape);
}

function partShape(part: ArtPart): Path2D {
  if (part.kind === "path") return new Path2D(part.d);
  if (part.kind === "circle") return circle(part.cx, part.cy, part.r);
  const shape = new Path2D();
  const rotate = Phaser.Math.DegToRad(part.rotate ?? 0);
  shape.ellipse(part.cx, part.cy, part.rx, part.ry, rotate, 0, TAU);
  return shape;
}

function paintItem(ctx: Ctx, item: BalanceItem, outline: string) {
  for (const part of ITEM_ART[item]) {
    const shape = partShape(part);
    ctx.globalAlpha = part.kind === "circle" ? 1 : (part.opacity ?? 1);
    if (part.fill) fill(ctx, shape, part.fill);
    const width = part.kind === "ellipse" ? undefined : part.outline;
    if (width) stroke(ctx, shape, outline, width);
  }
  ctx.globalAlpha = 1;
}

// ─── Bố cục theo câu đố ────────────────────────────────────────────────────────────────────────

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ScaleSlot {
  cell: Rect;
  kind: ScaleKind;
  zoom: number;
}

const isDoublePan = (scale: BalanceScale) => scale.left.length > 1 || scale.right.length > 1;

/**
 * Ô của từng cân theo thứ tự `scales` (trái → phải, trên → dưới):
 * 2–3 cân 1–1 xếp một cột; từ 4 cân 1–1 thì lưới 2 cột; cân đĩa đôi rộng hết vùng ở hàng cuối.
 */
function scaleSlots(scales: readonly BalanceScale[]): ScaleSlot[] {
  const singles = scales.filter((s) => !isDoublePan(s)).length;
  const cols = singles >= 4 ? 2 : 1;
  const singleRows = Math.ceil(singles / cols);
  const rows = singleRows + (scales.length - singles);
  const h = (SCALES_BOTTOM - SCALES_TOP - CELL_GAP * (rows - 1)) / rows;
  const w = (AREA_W - CELL_GAP * (cols - 1)) / cols;
  const rowY = (row: number) => SCALES_TOP + row * (h + CELL_GAP);

  let slot = 0;
  let wideRow = singleRows;
  return scales.map((scale) => {
    if (isDoublePan(scale)) {
      return { cell: { x: MARGIN, y: rowY(wideRow++), w: AREA_W, h }, kind: KIND_WIDE, zoom: 1 };
    }
    const col = slot % cols;
    const cell = { x: MARGIN + col * (w + CELL_GAP), y: rowY(Math.floor(slot / cols)), w, h };
    slot += 1;
    if (cols === 1) return { cell, kind: KIND_TALL, zoom: h >= 400 ? TALL_ZOOM : 1 };
    return { cell, kind: h >= 400 ? KIND_NARROW : KIND_SMALL, zoom: 1 };
  });
}

interface TileLayout {
  w: number;
  h: number;
  /** Cỡ vật trong ô (1 = 100 px). */
  item: number;
  /** Lề vòng khoanh quanh ô: trái/phải/trên và dưới (dưới phủ cả bóng đổ). */
  ring: { pad: number; bottom: number };
  centers: { x: number; y: number }[];
}

/** Hàng lựa chọn: tới 4 ô thì một hàng; 5–6 ô thì hai hàng (hàng dưới căn giữa). */
function tileLayout(count: number): TileLayout {
  const twoRows = count > 4;
  const perRow = twoRows ? Math.ceil(count / 2) : count;
  const gapX = twoRows || count <= 3 ? 28 : 16;
  const w = twoRows ? 200 : (AREA_W - gapX * (perRow - 1)) / perRow;
  const h = twoRows ? 148 : 200;
  const item = twoRows ? 1 : count <= 3 ? 1.4 : 1.12;
  // Hai hàng chỉ cách nhau 16 px: vòng khoanh sát hơn để không đè lên ô hàng dưới.
  const ring = twoRows ? { pad: 8, bottom: 8 } : { pad: 12, bottom: 12 + TILE_SHADOW };
  const rows = twoRows ? [perRow, count - perRow] : [count];
  const top = CHOICES_MID - (rows.length * h + (rows.length - 1) * TILE_GAP_Y) / 2;

  const centers: { x: number; y: number }[] = [];
  rows.forEach((n, row) => {
    const left = (DESIGN_WIDTH - (n * w + (n - 1) * gapX)) / 2;
    for (let col = 0; col < n; col++) {
      centers.push({ x: left + col * (w + gapX) + w / 2, y: top + row * (h + TILE_GAP_Y) + h / 2 });
    }
  });
  return { w, h, item, ring, centers };
}

// ─── Scene ────────────────────────────────────────────────────────────────────────────────────

/** Một vật đặt trên đĩa cân (để khoanh vật đúng khi trả lời sai). */
interface Spot {
  item: number;
  pan: Phaser.GameObjects.Container;
  image: Phaser.GameObjects.Image;
  size: number;
}

interface ScaleView {
  /** Đặt tại trục cân. */
  root: Phaser.GameObjects.Container;
  beam: Phaser.GameObjects.Image;
  left: Phaser.GameObjects.Container;
  right: Phaser.GameObjects.Container;
  /** Nửa đòn cân (px). */
  half: number;
  /** Góc cuối (radian): âm = đĩa trái thấp, dương = đĩa phải thấp, 0 = thăng bằng. */
  tilt: number;
  spots: Spot[];
}

interface TileView {
  /** Đặt tại tâm mặt ô; nảy khi đúng, rung khi sai. */
  root: Phaser.GameObjects.Container;
  /** Mặt ô + hình vật; nhấc lên khi rê chuột, thu lại khi nhấn. */
  face: Phaser.GameObjects.Container;
  w: number;
  h: number;
  ring: TileLayout["ring"];
}

/** Đặt đòn và hai đĩa theo góc; đĩa luôn treo thẳng đứng ở hai đầu đòn. */
function setTilt(view: ScaleView, angle: number) {
  view.beam.setRotation(angle);
  const dx = view.half * Math.cos(angle);
  const dy = view.half * Math.sin(angle);
  view.left.setPosition(-dx, -dy);
  view.right.setPosition(dx, dy);
}

function mediaMatches(query: string): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

/** Cân não — chạm vào vật nặng nhất. */
export default class BalanceScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = false;
  private reducedMotion = false;
  private canHover = false;
  private palette!: Palette;
  private puzzle?: BalancePuzzle;
  private board?: Phaser.GameObjects.Container;
  private scaleViews: ScaleView[] = [];
  private tiles: TileView[] = [];
  /** Mọi thứ bị làm mờ khi trả lời sai (ô đúng được trả lại độ sáng sau đó). */
  private dimmable: { setAlpha(value: number): unknown }[] = [];
  private intro?: Phaser.Tweens.Tween;

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.locked = false;
    this.puzzle = undefined;
  }

  create() {
    this.reducedMotion = mediaMatches("(prefers-reduced-motion: reduce)");
    this.canHover = mediaMatches("(hover: hover)");
    // Hết vòng hoặc rời màn: dừng hẳn mọi tween và hẹn giờ của câu đang dở.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.showPuzzle();
  }

  private cleanup() {
    this.locked = true;
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.intro = undefined;
    this.board = undefined;
    this.scaleViews = [];
    this.tiles = [];
    this.dimmable = [];
  }

  private next() {
    this.locked = false;
    this.showPuzzle();
  }

  private showPuzzle() {
    // Mọi tween đang chạy đều thuộc câu cũ (hiện câu, nảy, rung): dừng trước khi huỷ.
    this.tweens.killAll();
    this.intro = undefined;
    this.board?.destroy();
    this.scaleViews = [];
    this.tiles = [];
    this.dimmable = [];

    this.palette = readPalette(this.game.canvas);
    const puzzle = balance.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    this.puzzle = puzzle;
    const board = this.add.container(0, 0);
    this.board = board;

    const cells = this.add.graphics();
    board.add(cells);
    this.dimmable.push(cells);
    scaleSlots(puzzle.scales).forEach((slot, k) => {
      const scale = puzzle.scales[k];
      if (!scale) return;
      this.drawCell(cells, slot.cell);
      this.scaleViews.push(this.drawScale(board, puzzle, scale, slot));
    });

    const divider = this.place(DIVIDER.x, DIVIDER.y, this.dividerArt());
    board.add(divider);
    this.dimmable.push(divider);

    const layout = tileLayout(puzzle.items.length);
    puzzle.items.forEach((item, i) => {
      const center = layout.centers[i];
      if (center) this.tiles.push(this.drawTile(board, item, i, center, layout));
    });

    this.playIntro();
  }

  // ── Vẽ câu đố ──

  private drawCell(g: Phaser.GameObjects.Graphics, cell: Rect) {
    const { card, line } = this.palette;
    g.fillStyle(card.num).fillRoundedRect(cell.x, cell.y, cell.w, cell.h, CELL_RADIUS);
    g.lineStyle(CELL_EDGE, line.num, CELL_EDGE_ALPHA);
    g.strokeRoundedRect(cell.x, cell.y, cell.w, cell.h, CELL_RADIUS);
  }

  private drawScale(
    board: Phaser.GameObjects.Container,
    puzzle: BalancePuzzle,
    scale: BalanceScale,
    { cell, kind, zoom }: ScaleSlot,
  ): ScaleView {
    const root = this.add.container(cell.x + cell.w / 2, cell.y + cell.h / 2 - kind.lift * zoom);
    root.add(this.place(0, 0, this.standArt(kind.stand, zoom)));
    if (scale.heavier === "equal") root.add(this.place(0, kind.equalY * zoom, this.equalArt(zoom)));
    const beam = this.place(0, 0, this.beamArt(kind, zoom));
    root.add([beam, this.place(0, 0, this.pivotArt(kind, zoom))]);

    const spots: Spot[] = [];
    const size = kind.item * zoom;
    const makePan = (items: readonly number[]) => {
      const shape = items.length > 1 ? PAN_DOUBLE : kind.pan;
      const pan = this.add.container(0, 0, [this.place(0, 0, this.panArt(shape, zoom))]);
      items.forEach((itemIndex, j) => {
        const item = puzzle.items[itemIndex];
        if (!item) return;
        const x = (j - (items.length - 1) / 2) * PAIR_STEP * size;
        const image = this.place(x, kind.itemY * zoom, this.itemArt(item, size));
        pan.add(image);
        spots.push({ item: itemIndex, pan, image, size });
      });
      root.add(pan);
      return pan;
    };

    const view: ScaleView = {
      root,
      beam,
      left: makePan(scale.left),
      right: makePan(scale.right),
      half: kind.beamHalf * zoom,
      tilt: scale.heavier === "equal" ? 0 : scale.heavier === "left" ? -TILT : TILT,
      spots,
    };
    setTilt(view, view.tilt);
    board.add(root);
    this.dimmable.push(root);
    return view;
  }

  private drawTile(
    board: Phaser.GameObjects.Container,
    item: BalanceItem,
    index: number,
    center: { x: number; y: number },
    { w, h, item: size, ring }: TileLayout,
  ): TileView {
    const { card, sticker } = this.palette;
    const shadow = this.add.graphics();
    shadow.fillStyle(sticker.num).fillRoundedRect(-w / 2, -h / 2 + TILE_SHADOW, w, h, TILE_RADIUS);
    const paper = this.add.graphics();
    paper.fillStyle(card.num).fillRoundedRect(-w / 2, -h / 2, w, h, TILE_RADIUS);
    paper.lineStyle(TILE_EDGE, sticker.num).strokeRoundedRect(-w / 2, -h / 2, w, h, TILE_RADIUS);
    const face = this.add.container(0, 0, [paper, this.place(0, 0, this.itemArt(item, size))]);
    const root = this.add.container(center.x, center.y, [shadow, face]);
    board.add(root);
    this.dimmable.push(root);

    // Vùng chạm phủ cả ô lẫn bóng đổ (≥ 112 × 112 px trong khung).
    const hit = this.add
      .zone(center.x, center.y + TILE_SHADOW / 2, w, h + TILE_SHADOW)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => {
      if (this.locked) return;
      if (!this.reducedMotion) face.setScale(PRESS_SCALE);
      this.answer(index);
    });
    if (this.canHover) {
      hit.on("pointerover", () => {
        if (!this.locked) face.y = -HOVER_LIFT;
      });
      hit.on("pointerout", () => {
        face.y = 0;
      });
    }
    board.add(hit);
    return { root, face, w, h, ring };
  }

  /** Hiện câu: cân hiện dần, đòn nghiêng từ ½ góc tới góc cuối. Hàng lựa chọn nhận chạm ngay. */
  private playIntro() {
    const views = this.scaleViews;
    if (this.reducedMotion || views.length === 0) return;
    for (const view of views) {
      view.root.setAlpha(0);
      setTilt(view, view.tilt / 2);
    }
    this.intro = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: SWING_MS,
      ease: "Quad.easeOut",
      onUpdate: (tween) => {
        const swing = tween.getValue() ?? 1;
        const alpha = Math.min(1, (tween.progress * SWING_MS) / FADE_MS);
        for (const view of views) {
          view.root.setAlpha(alpha);
          setTilt(view, view.tilt * (0.5 + swing / 2));
        }
      },
      onComplete: () => {
        this.intro = undefined;
      },
    });
  }

  /** Chạm khi cân còn đang hiện: đưa ngay về trạng thái cuối trước khi khoanh/làm mờ. */
  private settleIntro() {
    if (!this.intro) return;
    this.intro.stop();
    this.intro = undefined;
    for (const view of this.scaleViews) {
      view.root.setAlpha(1);
      setTilt(view, view.tilt);
    }
  }

  // ── Trả lời ──

  private answer(choice: number) {
    const puzzle = this.puzzle;
    if (this.locked || !puzzle) return;
    this.locked = true;
    this.settleIntro();

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const index = this.index;
    const correct = balance.check(puzzle, choice);
    this.bridge.submit(index, choice);
    this.index += 1;

    if (correct) {
      this.showHit(choice);
      this.time.delayedCall(NEXT_AFTER_HIT_MS, () => this.next());
      return;
    }

    this.showMiss(choice, puzzle.answer);
    // Hết khoá theo `lockedUntil` của server (không tự đếm 1,5 giây) để khớp huy hiệu khoá của khung.
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive()) return;
      this.time.delayedCall(ms, () => this.next());
    });
  }

  /** Đúng: ô nảy 1 → 1,15 → 1, có vòng khoanh và dấu ✓. */
  private showHit(choice: number) {
    const tile = this.tiles[choice];
    if (!tile) return;
    tile.face.y = 0;
    tile.root.addAt(this.tileRing(tile), 0);
    tile.root.add(this.place(tile.w / 2 - 4, -tile.h / 2, this.tickArt()));
    if (this.reducedMotion) return;
    this.tweens.add({ targets: tile.face, scale: 1, duration: PRESS_RELEASE_MS });
    this.tweens.add({
      targets: tile.root,
      scale: BOUNCE_SCALE,
      duration: BOUNCE_MS / 2,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  /**
   * Sai, khoá (CR-006): mọi thứ mờ còn 35 %, trừ ô vật đúng (khoanh, giữ sáng). Vật đúng trên
   * các cân cũng được viền sáng để người chơi thấy vì sao. Ô vừa chạm rung ngang + dấu ✗.
   */
  private showMiss(choice: number, answer: number) {
    const board = this.board;
    const right = this.tiles[answer];
    const wrong = this.tiles[choice];
    if (!board || !right || !wrong) return;
    const { sticker, card, primary } = this.palette;

    for (const obj of this.dimmable) obj.setAlpha(DIM_ALPHA);
    right.root.setAlpha(1);
    right.face.y = 0;
    wrong.face.y = 0;
    right.root.addAt(this.tileRing(right), 0);

    // Bản sao rõ nét của vật đúng, đặt trên lớp mờ (đĩa cân không xoay nên chỉ cộng toạ độ).
    for (const view of this.scaleViews) {
      for (const spot of view.spots) {
        if (spot.item !== answer) continue;
        const x = view.root.x + spot.pan.x + spot.image.x;
        const y = view.root.y + spot.pan.y + spot.image.y;
        const r = SPOT_RING * spot.size;
        const ring = this.add.graphics({ x, y });
        ring.lineStyle(RING_OUTER, sticker.num).strokeCircle(0, 0, r);
        ring.fillStyle(card.num).fillCircle(0, 0, r);
        ring.lineStyle(RING_INNER, primary.num).strokeCircle(0, 0, r);
        const copy = this.add
          .image(x, y, spot.image.texture.key)
          .setOrigin(spot.image.originX, spot.image.originY);
        board.add([ring, copy]);
      }
    }

    const cross = this.place(
      wrong.root.x + wrong.w / 2 - 14,
      wrong.root.y - wrong.h / 2 + 16,
      this.crossArt(),
    );
    board.add(cross);
    if (this.reducedMotion) return;
    this.tweens.add({ targets: wrong.face, scale: 1, duration: PRESS_RELEASE_MS });
    this.shake([wrong.root, cross]);
  }

  /** Rung ngang ±8 px rồi về chỗ cũ. */
  private shake(targets: { x: number }[]) {
    const base = targets.map((t) => t.x);
    const moveTo = (dx: number) => {
      targets.forEach((t, i) => {
        t.x = (base[i] ?? t.x) + dx;
      });
    };
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: SHAKE_MS,
      onUpdate: (tween) => moveTo(Math.sin((tween.getValue() ?? 0) * TAU * SHAKE_TIMES) * SHAKE_PX),
      onComplete: () => moveTo(0),
    });
  }

  /** Vòng khoanh quanh một ô lựa chọn, đặt dưới mặt ô; góc bo đồng tâm với góc ô. */
  private tileRing({ w, h, ring: { pad, bottom } }: TileView): Phaser.GameObjects.Graphics {
    const { sticker, primary } = this.palette;
    const ring = this.add.graphics();
    const args = [
      -w / 2 - pad,
      -h / 2 - pad,
      w + pad * 2,
      h + pad + bottom,
      TILE_RADIUS + pad,
    ] as const;
    ring.lineStyle(RING_OUTER, sticker.num).strokeRoundedRect(...args);
    ring.lineStyle(RING_INNER, primary.num).strokeRoundedRect(...args);
    return ring;
  }

  // ── Texture vẽ bằng canvas 2D (đặt khoá theo cỡ và bảng màu nên mỗi hình chỉ vẽ một lần) ──

  private place(x: number, y: number, art: Art): Phaser.GameObjects.Image {
    return this.add.image(x, y, art.key).setOrigin(art.ox, art.oy);
  }

  private paint(name: string, box: Box, zoom: number, draw: (ctx: Ctx, p: Palette) => void): Art {
    const [x0, y0, x1, y1] = box;
    const w = Math.ceil((x1 - x0) * zoom);
    const h = Math.ceil((y1 - y0) * zoom);
    const key = `balance/${name}@${zoom.toFixed(3)}/${this.palette.id}`;
    if (!this.textures.exists(key)) {
      const texture = this.textures.createCanvas(key, w, h);
      if (texture) {
        const ctx = texture.context;
        ctx.setTransform(zoom, 0, 0, zoom, -x0 * zoom, -y0 * zoom);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        draw(ctx, this.palette);
        texture.refresh();
      }
    }
    return { key, ox: (-x0 * zoom) / w, oy: (-y0 * zoom) / h };
  }

  private itemArt(item: BalanceItem, size: number): Art {
    const r = ITEM_BOX / 2;
    return this.paint(`item-${item}`, [-r, -r, r, r], size, (ctx, p) => {
      paintItem(ctx, item, p.sticker.css);
    });
  }

  private standArt(stand: StandShape, zoom: number): Art {
    const box = [-stand.half - 3, -stand.postWidth, stand.half + 3, stand.bottom + 3] as const;
    return this.paint(`stand-${stand.post}-${stand.half}`, box, zoom, (ctx, p) => {
      stroke(ctx, new Path2D(`M0 0 L0 ${stand.post}`), p.line.css, stand.postWidth);
      const base = new Path2D(stand.base);
      fill(ctx, base, p.accent.css);
      stroke(ctx, base, p.line.css, 4);
    });
  }

  private beamArt(kind: ScaleKind, zoom: number): Art {
    const { beamHalf: half, beamWidth: width } = kind;
    const box = [-half - width, -width, half + width, width] as const;
    return this.paint(`beam-${half}-${width}`, box, zoom, (ctx, p) => {
      stroke(ctx, new Path2D(`M${-half} 0 L${half} 0`), p.line.css, width);
    });
  }

  private pivotArt(kind: ScaleKind, zoom: number): Art {
    const r = kind.pivotRadius;
    return this.paint(`pivot-${r}`, [-r - 3, -r - 3, r + 3, r + 3], zoom, (ctx, p) => {
      const cap = circle(0, 0, r);
      fill(ctx, cap, p.card.css);
      stroke(ctx, cap, p.line.css, 4);
    });
  }

  private panArt(pan: PanShape, zoom: number): Art {
    const box = [-pan.half - 3, -6, pan.half + 3, pan.bottom + 3] as const;
    return this.paint(`pan-${pan.half}`, box, zoom, (ctx, p) => {
      const { strings: s, drop: d } = pan;
      stroke(ctx, new Path2D(`M0 0 L${-s} ${d} M0 0 L${s} ${d}`), p.line.css, 3);
      const bowl = new Path2D(pan.bowl);
      fill(ctx, bowl, p.card.css);
      stroke(ctx, bowl, p.line.css, 4);
      fill(ctx, circle(0, 0, 5), p.line.css);
    });
  }

  /** Huy hiệu "=" trên trụ của cân thăng bằng. */
  private equalArt(zoom: number): Art {
    return this.paint("equal", [-25, -25, 25, 25], zoom, (ctx, p) => {
      const badge = circle(0, 0, 22);
      fill(ctx, badge, p.accent.css);
      stroke(ctx, badge, p.line.css, 4);
      stroke(ctx, new Path2D("M-10 -5 L10 -5 M-10 5 L10 5"), p.ink.css, 5);
    });
  }

  private crossArt(): Art {
    return this.paint("cross", [-35, -35, 35, 35], 1, (ctx, p) => {
      const cross = new Path2D("M-24 -24 L24 24 M24 -24 L-24 24");
      stroke(ctx, cross, CROSS_HALO, 20);
      stroke(ctx, cross, p.destructive.css, 10);
    });
  }

  private tickArt(): Art {
    return this.paint("tick", [-29, -29, 29, 34], 1, (ctx, p) => {
      fill(ctx, circle(0, 5, 26), p.sticker.css);
      const badge = circle(0, 0, 26);
      fill(ctx, badge, p.primary.css);
      stroke(ctx, badge, p.sticker.css, 4);
      stroke(ctx, new Path2D("M-12 1 L-3 10 L13 -9"), p.sticker.css, 6);
    });
  }

  private dividerArt(): Art {
    return this.paint("divider", [-4, -8, 628, 8], 1, (ctx, p) => {
      ctx.globalAlpha = DIVIDER.alpha;
      stroke(ctx, new Path2D(DIVIDER.d), p.line.css, DIVIDER.width);
      ctx.globalAlpha = 1;
    });
  }
}
