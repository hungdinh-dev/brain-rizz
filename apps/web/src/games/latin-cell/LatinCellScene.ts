import {
  LATIN_CELL_EMPTY,
  type LatinCellPuzzle,
  type LatinCellVia,
  latinCell,
  latinCellUnits,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import { shouldIgnoreGameKey } from "../keyboard";
import { DESIGN_WIDTH, type MinigameBridge } from "../types";
import { SHAPE_PAINTS, SHAPES } from "./shapes";

/*
 * Ô bí ẩn — lưới hình kiểu Sudoku nhỏ: mỗi hàng, mỗi cột (và mỗi khối viền đậm, từ Khó) đủ mọi
 * hình đúng một lần; chạm thẻ hình của ô dấu ?. Đặc tả: docs/04-minigames/latin-cell.md (mục
 * "Ghi chú cho FE" và "Hiện đáp án đúng khi sai"). Chưa có bản mẫu (CR-013), bố cục theo bảng
 * "Bố cục (khung 720×1280)" của đặc tả. Scene không vẽ chữ; chữ số chỉ là ký hiệu (số bước ①②,
 * phím 1 … n trên máy tính).
 */

// ─── Bố cục (px trong khung 720×1280) ─────────────────────────────────────────────────────────

/** Lưới: tâm x = 360, y 265–865 (Mầm 295–835); dải trên y 0–225 để trống cho HUD và huy hiệu khoá. */
const GRID = { centerY: 565, maxSide: 600, maxCell: 180 } as const;
/** Hình trong ô (và trong thẻ): bán kính 30 % cạnh, tức rộng ~60 %. */
const SHAPE_RATIO = 0.3;
/** Nét lưới: đường ô mảnh mờ, đường khối và viền ngoài đậm. */
const LINE = { thin: 2, thinAlpha: 0.4, bold: 6, boldAlpha: 0.95 } as const;
/** Hàng thẻ: tâm y 1075, lề 24 (mọi thẻ ≥ 102 × 140, vùng chạm ≥ 48 px). */
const CARDS = { centerY: 1075, margin: 24, radius: 18, border: 4, shadow: 6 } as const;
const CARD_SIZES: Readonly<Record<number, { w: number; h: number; gap: number }>> = {
  3: { w: 200, h: 190, gap: 36 },
  4: { w: 150, h: 170, gap: 24 },
  6: { w: 102, h: 140, gap: 12 },
};
const HOVER_LIFT = 4;

// ─── Độ mờ, màu tô ─────────────────────────────────────────────────────────────────────────────

/** Tô phấn rất nhạt hàng, cột (và khối) của ô ? khi chơi; đậm hơn khi hiện lời giải. */
const UNIT_TINT_PLAY = 0.08;
const UNIT_TINT_MISS = 0.16;
/** Sai, khoá: phần không liên quan mờ còn 35 %; hình của ô trung gian 60 %. */
const DIM_ALPHA = 0.35;
const VIA_SHAPE_ALPHA = 0.6;

// ─── Chuyển động ───────────────────────────────────────────────────────────────────────────────

const APPEAR_MS = 120;
/** Đúng: hình hiện vào ô ? như nét phấn vẽ nhanh, thẻ nảy, sang câu kế sau 250 ms. */
const DRAW_MS = 150;
const BOUNCE_MS = 90;
const BOUNCE_SCALE = 1.1;
const NEXT_AFTER_HIT_MS = 250;
/** Viền ô ? nhấp nháy nhẹ. */
const PULSE_MS = 650;
const PULSE_MIN = 0.45;
/** Sai: lần lượt ô trung gian ①, ② rồi ô ?, mỗi bước cách 260 ms; thẻ chạm nhầm lắc ±8 px. */
const REVEAL_FIRST_MS = 120;
const REVEAL_STEP_MS = 260;
const REVEAL_FADE_MS = 140;
const SHAKE_PX = 8;
const SHAKE_MS = 50;

const FONT = '"Baloo 2", "Be Vietnam Pro", sans-serif';

// ─── Màu ───────────────────────────────────────────────────────────────────────────────────────

interface Paint {
  num: number;
  css: string;
  alpha: number;
}

interface Palette {
  /** Mặt thẻ giấy. */
  card: Paint;
  /** Số phím trên thẻ (máy tính). */
  cardFg: Paint;
  /** Mực: viền hình, viền thẻ, bóng thẻ. */
  sticker: Paint;
  /** Viền ô ?, khung ô ? lúc hiện đáp án, huy hiệu số bước. */
  primary: Paint;
  primaryFg: Paint;
  destructive: Paint;
  /** Phấn: nét lưới, dấu ?, vòng khoanh thẻ đúng, viền nét đứt ô trung gian. */
  chalk: Paint;
  /** Nền sẫm dưới lưới (`--board-shade`, có alpha). */
  shade: Paint;
  shapes: Paint[];
}

let probe: CanvasRenderingContext2D | null | undefined;

/** Màu CSS bất kỳ (kể cả `rgb(0 0 0 / 0.22)`) → số màu + alpha, nhờ canvas 2D chuẩn hoá. */
function paint(raw: string, fallback: string): Paint {
  if (probe === undefined) probe = document.createElement("canvas").getContext("2d");
  let css = raw || fallback;
  let alpha = 1;
  if (probe) {
    probe.fillStyle = fallback;
    probe.fillStyle = css;
    const value = String(probe.fillStyle);
    const rgba = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(value);
    if (rgba) {
      const [r, g, b] = [rgba[1], rgba[2], rgba[3]].map(Number);
      css = `#${[r, g, b].map((n) => (n ?? 0).toString(16).padStart(2, "0")).join("")}`;
      alpha = rgba[4] === undefined ? 1 : Number(rgba[4]);
    } else {
      css = value;
    }
  }
  return { num: Phaser.Display.Color.ValueToColor(css).color, css, alpha };
}

function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const token = (name: string, fallback: string) =>
    paint(style.getPropertyValue(name).trim(), fallback);
  return {
    card: token("--card", "#fff8ef"),
    cardFg: token("--card-foreground", "#1f1b3a"),
    sticker: token("--sticker", "#1f1b3a"),
    primary: token("--primary", "#ffd166"),
    primaryFg: token("--primary-foreground", "#1f1b3a"),
    destructive: token("--destructive", "#c93a55"),
    chalk: token("--chalk", "#f6f3ea"),
    shade: token("--board-shade", "rgba(0, 0, 0, 0.22)"),
    shapes: SHAPE_PAINTS.map((p) => token(p.token, p.fallback)),
  };
}

// ─── Vẽ ────────────────────────────────────────────────────────────────────────────────────────

type XY = { x: number; y: number };

/** Phaser 4 nhận mảng `Vector2` cho fillPoints / strokePoints. */
const vectors = (pts: readonly XY[]) => pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));

/** Viền mực quanh hình, theo bán kính hình. */
const inkWidth = (r: number) => Math.max(3, r * 0.1);

/** Hình mã `shape` tâm (0, 0) bán kính `r`: màu phụ + viền mực, góc nhọn bo tròn. */
function drawShape(g: Phaser.GameObjects.Graphics, shape: number, r: number, palette: Palette) {
  const geom = SHAPES[shape];
  const fill = palette.shapes[shape];
  if (!geom || !fill) return;
  const ink = palette.sticker.num;
  const width = inkWidth(r);
  g.fillStyle(fill.num, 1);
  if (geom.kind === "circle") {
    g.fillCircle(0, 0, geom.r * r);
    g.lineStyle(width, ink, 1);
    g.strokeCircle(0, 0, geom.r * r);
    return;
  }
  const pts = vectors(geom.points.map(([x, y]) => ({ x: x * r, y: y * r })));
  g.fillPoints(pts, true);
  g.lineStyle(width, ink, 1);
  g.strokePoints(pts, true, true);
  g.fillStyle(ink, 1);
  for (const [x, y] of geom.corners) g.fillCircle(x * r, y * r, width / 2);
}

/** Polyline nét tròn đầu (WebGL nối nét kiểu vát; chấm tròn ở mỗi đỉnh cho mềm như phấn). */
function roundLine(
  g: Phaser.GameObjects.Graphics,
  pts: readonly XY[],
  width: number,
  color: Paint,
) {
  g.lineStyle(width, color.num, 1);
  g.strokePoints(vectors(pts), false);
  g.fillStyle(color.num, 1);
  for (const p of pts) g.fillCircle(p.x, p.y, width / 2);
}

/** Dấu ? viết phấn, tâm (0, 0), cao ~43 % cạnh ô. */
function drawQuestion(g: Phaser.GameObjects.Graphics, cell: number, chalk: Paint) {
  const u = cell * 0.5;
  const width = Math.max(5, cell * 0.075);
  const hook: XY[] = [];
  for (let d = 200; d <= 405; d += 9) {
    const a = (d * Math.PI) / 180;
    hook.push({ x: Math.cos(a) * 0.2 * u, y: (-0.24 + Math.sin(a) * 0.2) * u });
  }
  const end = (405 * Math.PI) / 180;
  hook.push({ x: Math.cos(end) * 0.2 * u, y: (-0.24 + Math.sin(end) * 0.2) * u });
  hook.push({ x: 0, y: 0.03 * u }, { x: 0, y: 0.14 * u });
  roundLine(g, hook, width, chalk);
  g.fillStyle(chalk.num, 1);
  g.fillCircle(0, 0.36 * u, width * 0.62);
}

/** Viền chữ nhật nét đứt (tâm 0, 0). */
function dashedRect(
  g: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  width: number,
  dash: number,
  gap: number,
  color: Paint,
) {
  g.fillStyle(color.num, 1);
  const sides: [number, number, number, number][] = [
    [-w / 2, -h / 2, 1, 0],
    [w / 2, -h / 2, 0, 1],
    [w / 2, h / 2, -1, 0],
    [-w / 2, h / 2, 0, -1],
  ];
  for (const [x0, y0, dx, dy] of sides) {
    const len = dx !== 0 ? w : h;
    // Chia đều để hai đầu cạnh đều là nét liền (góc khép kín).
    const count = Math.max(1, Math.round((len + gap) / (dash + gap)));
    const step = (len + gap) / count;
    const seg = step - gap;
    for (let i = 0; i < count; i++) {
      const s = i * step;
      const x = x0 + dx * s;
      const y = y0 + dy * s;
      const ex = x + dx * seg;
      const ey = y + dy * seg;
      g.fillRect(
        Math.min(x, ex) - width / 2,
        Math.min(y, ey) - width / 2,
        Math.abs(ex - x) + width,
        Math.abs(ey - y) + width,
      );
    }
  }
}

// ─── Trạng thái ────────────────────────────────────────────────────────────────────────────────

interface GridLayout {
  size: number;
  cell: number;
  left: number;
  top: number;
  side: number;
}

function gridLayout(size: number): GridLayout {
  const cell = Math.min(GRID.maxSide / size, GRID.maxCell);
  const side = cell * size;
  return { size, cell, side, left: DESIGN_WIDTH / 2 - side / 2, top: GRID.centerY - side / 2 };
}

function cellCenter(grid: GridLayout, index: number): { x: number; y: number } {
  return {
    x: grid.left + ((index % grid.size) + 0.5) * grid.cell,
    y: grid.top + (Math.floor(index / grid.size) + 0.5) * grid.cell,
  };
}

function cardSize(count: number): { w: number; h: number; gap: number } {
  const known = CARD_SIZES[count];
  if (known) return known;
  const gap = 12;
  return { w: (DESIGN_WIDTH - 2 * CARDS.margin - (count - 1) * gap) / count, h: 140, gap };
}

interface CardView {
  /** Mã hình của thẻ (= vị trí từ trái sang, mọi câu như nhau). */
  shape: number;
  x: number;
  w: number;
  h: number;
  root: Phaser.GameObjects.Container;
  /** Phần nhấc lên khi rê chuột (mặt thẻ + hình), không gồm bóng. */
  body: Phaser.GameObjects.Container;
}

/** Phím 1 … 9 (hàng số hoặc bàn phím số) → vị trí thẻ 0 … 8. */
function keySlot(event: KeyboardEvent): number | undefined {
  const code = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
  if (code?.[1]) return Number(code[1]) - 1;
  if (/^[1-9]$/.test(event.key)) return Number(event.key) - 1;
  return undefined;
}

function mediaMatches(query: string): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

/** Ô bí ẩn — chạm thẻ hình còn thiếu ở ô ?. */
export default class LatinCellScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = false;
  private reduced = false;
  private canHover = false;
  private palette!: Palette;
  private puzzle?: LatinCellPuzzle;
  private grid?: GridLayout;
  private board?: Phaser.GameObjects.Container;
  /** Hình đã cho trên lưới, theo chỉ số ô. */
  private cellShapes = new Map<number, Phaser.GameObjects.Graphics>();
  /** Hàng, cột (và khối) của ô ?, gồm cả ô ?. */
  private units = new Set<number>();
  private tint?: Phaser.GameObjects.Graphics;
  private ring?: Phaser.GameObjects.Graphics;
  private question?: Phaser.GameObjects.Graphics;
  private cards: CardView[] = [];
  private hovered?: CardView;
  private onKey = (event: KeyboardEvent) => this.handleKey(event);

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.locked = false;
    this.canHover = mediaMatches("(hover: hover) and (pointer: fine)");
  }

  create() {
    // Bắt phím 1 … n ở mọi thiết bị có bàn phím.
    window.addEventListener("keydown", this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
    this.showPuzzle();
  }

  private cleanup() {
    window.removeEventListener("keydown", this.onKey);
    this.locked = true;
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.cards = [];
    this.cellShapes.clear();
    this.hovered = undefined;
  }

  private next() {
    this.locked = false;
    this.showPuzzle();
  }

  // ── Câu đố ──

  private showPuzzle() {
    // Mọi tween đang chạy (hiện câu, nhấp nháy ô ?, lời giải) đều thuộc câu cũ: dừng trước khi huỷ.
    this.tweens.killAll();
    this.board?.destroy();
    this.cellShapes.clear();
    this.cards = [];
    this.hovered = undefined;

    this.reduced = prefersReducedMotion();
    this.palette = readPalette(this.game.canvas);
    const puzzle = latinCell.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    const grid = gridLayout(puzzle.size);
    this.puzzle = puzzle;
    this.grid = grid;
    this.units = new Set(latinCellUnits(puzzle, puzzle.target).flat());
    this.units.add(puzzle.target);

    const board = this.add.container(0, 0);
    this.board = board;
    this.drawGrid(board, puzzle, grid);
    this.drawCards(board, puzzle.size);

    if (!this.reduced) {
      board.setAlpha(0);
      this.tweens.add({ targets: board, alpha: 1, duration: APPEAR_MS });
    }
  }

  private drawGrid(board: Phaser.GameObjects.Container, puzzle: LatinCellPuzzle, grid: GridLayout) {
    const p = this.palette;
    const { size, cell, left, top, side } = grid;

    // Nền sẫm dưới lưới cho dễ nhìn ô trên bảng phấn.
    const panel = this.add.graphics();
    panel.fillStyle(p.shade.num, p.shade.alpha);
    panel.fillRect(left, top, side, side);

    // Tô phấn nhạt hàng, cột (và khối) của ô ? (Câu hỏi mở 3 của đặc tả: ui-designer chốt).
    const tint = this.add.graphics().setAlpha(UNIT_TINT_PLAY);
    tint.fillStyle(p.chalk.num, 1);
    for (const i of this.units) {
      const at = cellCenter(grid, i);
      tint.fillRect(at.x - cell / 2, at.y - cell / 2, cell, cell);
    }
    this.tint = tint;

    // Đường ô mảnh, đường khối đậm (Siêu khó 2 hàng × 3 cột: dọc sau cột 3, ngang sau hàng 2, 4).
    const lines = this.add.graphics();
    const block = puzzle.block;
    for (let k = 1; k < size; k++) {
      const boldCol = block !== null && k % block.cols === 0;
      const boldRow = block !== null && k % block.rows === 0;
      const x = left + k * cell;
      const y = top + k * cell;
      const colW = boldCol ? LINE.bold : LINE.thin;
      const rowW = boldRow ? LINE.bold : LINE.thin;
      lines.fillStyle(p.chalk.num, boldCol ? LINE.boldAlpha : LINE.thinAlpha);
      lines.fillRect(x - colW / 2, top, colW, side);
      lines.fillStyle(p.chalk.num, boldRow ? LINE.boldAlpha : LINE.thinAlpha);
      lines.fillRect(left, y - rowW / 2, side, rowW);
    }
    const b = LINE.bold;
    lines.fillStyle(p.chalk.num, LINE.boldAlpha);
    lines.fillRect(left - b / 2, top - b / 2, side + b, b);
    lines.fillRect(left - b / 2, top + side - b / 2, side + b, b);
    lines.fillRect(left - b / 2, top + b / 2, b, side - b);
    lines.fillRect(left + side - b / 2, top + b / 2, b, side - b);
    board.add([panel, tint, lines]);

    // Hình đã cho.
    const r = cell * SHAPE_RATIO;
    puzzle.cells.forEach((shape, i) => {
      if (shape === LATIN_CELL_EMPTY || i === puzzle.target) return;
      const at = cellCenter(grid, i);
      const g = this.add.graphics({ x: at.x, y: at.y });
      drawShape(g, shape, r, p);
      board.add(g);
      this.cellShapes.set(i, g);
    });

    // Ô ?: dấu ? viết phấn, viền primary nhấp nháy nhẹ.
    const at = cellCenter(grid, puzzle.target);
    const inset = Math.max(6, cell * 0.06);
    const ring = this.add.graphics({ x: at.x, y: at.y });
    ring.lineStyle(Math.max(4, cell * 0.04), p.primary.num, 1);
    ring.strokeRoundedRect(
      -cell / 2 + inset,
      -cell / 2 + inset,
      cell - 2 * inset,
      cell - 2 * inset,
      cell * 0.1,
    );
    const question = this.add.graphics({ x: at.x, y: at.y });
    drawQuestion(question, cell, p.chalk);
    board.add([ring, question]);
    this.ring = ring;
    this.question = question;
    if (!this.reduced) {
      this.tweens.add({
        targets: ring,
        alpha: PULSE_MIN,
        duration: PULSE_MS,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  /** Hàng thẻ: `count` thẻ theo thứ tự mã hình cố định 0, 1, … (thẻ thứ j là hình mã j). */
  private drawCards(board: Phaser.GameObjects.Container, count: number) {
    const p = this.palette;
    const { w, h, gap } = cardSize(count);
    const total = count * w + (count - 1) * gap;
    const x0 = DESIGN_WIDTH / 2 - total / 2 + w / 2;
    const y = CARDS.centerY;
    const r = Math.min(w, h) * SHAPE_RATIO;

    for (let shape = 0; shape < count; shape++) {
      const x = x0 + shape * (w + gap);
      const shadow = this.add.graphics();
      shadow.fillStyle(p.sticker.num, 1);
      shadow.fillRoundedRect(-w / 2, -h / 2 + CARDS.shadow, w, h, CARDS.radius);

      const face = this.add.graphics();
      face.fillStyle(p.card.num, 1);
      face.fillRoundedRect(-w / 2, -h / 2, w, h, CARDS.radius);
      face.lineStyle(CARDS.border, p.sticker.num, 1);
      face.strokeRoundedRect(-w / 2, -h / 2, w, h, CARDS.radius);
      const art = this.add.graphics();
      drawShape(art, shape, r, p);
      const body = this.add.container(0, 0, [face, art]);
      if (this.canHover) {
        // Số phím (máy tính): ký hiệu, không dịch.
        const size = Math.round(Math.min(18, w * 0.17));
        const label = this.add
          .text(w / 2 - size * 0.75, h / 2 - size * 0.85, String(shape + 1), {
            fontFamily: FONT,
            fontSize: size,
            fontStyle: "800",
            color: p.cardFg.css,
          })
          .setOrigin(0.5)
          .setAlpha(0.55);
        body.add(label);
      }
      const root = this.add.container(x, y, [shadow, body]);
      const card: CardView = { shape, x, w, h, root, body };

      // Vùng chạm phủ cả thẻ và bóng (≥ 102 × 146).
      const hit = this.add
        .zone(x, y + CARDS.shadow / 2, w, h + CARDS.shadow)
        .setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => this.answer(shape));
      if (this.canHover) {
        hit.on("pointerover", () => this.hover(card));
        hit.on("pointerout", () => {
          if (this.hovered === card) this.hover(undefined);
        });
      }
      board.add([root, hit]);
      this.cards.push(card);
    }
  }

  // ── Nhập ──

  private hover(card: CardView | undefined) {
    if (this.hovered) this.hovered.body.y = 0;
    this.hovered = card;
    if (card && !this.locked) card.body.y = -HOVER_LIFT;
  }

  private handleKey(event: KeyboardEvent) {
    // Có phím bổ trợ, đang gõ chữ hoặc đang mở hộp thoại (Thoát, sheet chat…): không trả lời.
    if (shouldIgnoreGameKey(event)) return;
    const slot = keySlot(event);
    if (slot === undefined || !this.sys.isActive()) return;
    const card = this.cards[slot];
    if (!card) return;
    event.preventDefault();
    if (event.repeat) return;
    this.answer(card.shape);
  }

  // ── Trả lời ──

  private answer(choice: number) {
    const puzzle = this.puzzle;
    if (this.locked || !puzzle) return;
    this.locked = true;
    this.hover(undefined);

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const index = this.index;
    const correct = latinCell.check(puzzle, choice);
    this.bridge.submit(index, choice);
    this.index += 1;

    if (correct) {
      this.showHit(puzzle, choice);
      this.time.delayedCall(NEXT_AFTER_HIT_MS, () => this.next());
      return;
    }

    this.showMiss(puzzle, choice);
    // Hết khoá theo `lockedUntil` của server (không tự đếm 1,5 giây) để khớp huy hiệu khoá của khung.
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive()) return;
      this.time.delayedCall(ms, () => this.next());
    });
  }

  /** Dừng nhấp nháy viền ô ?, giữ sáng hẳn. */
  private settleRing() {
    if (!this.ring) return;
    this.tweens.killTweensOf(this.ring);
    this.ring.setAlpha(1);
  }

  /** Đúng: hình hiện vào ô ? (nét phấn vẽ nhanh), thẻ được chạm nảy nhẹ. */
  private showHit(puzzle: LatinCellPuzzle, choice: number) {
    this.settleRing();
    this.question?.setVisible(false);
    const shape = this.cellArt(puzzle.target, puzzle.answer);
    if (this.reduced || !shape) return;
    shape.setScale(0.6).setAlpha(0);
    this.tweens.add({
      targets: shape,
      scale: 1,
      alpha: 1,
      duration: DRAW_MS,
      ease: "Back.easeOut",
    });
    const card = this.cards[choice];
    if (card) {
      this.tweens.add({
        targets: card.root,
        scale: BOUNCE_SCALE,
        duration: BOUNCE_MS,
        yoyo: true,
      });
    }
  }

  /**
   * Sai, khoá (CR-006). Dấu hiệu chính: thẻ đúng khoanh phấn, giữ sáng 100 %; ô ? hiện hình đúng
   * trong khung primary viền mực. Thẻ vừa chạm lắc ngang + ✗. Lời giải: tô đậm hơn hàng, cột (và
   * khối) của ô ?, hình đã cho trong đó giữ sáng; Khó, Siêu khó lần lượt điền ô trung gian ①, ②
   * (hình mờ 60 %, viền nét đứt) rồi mới tới ô ?. Phần còn lại mờ 35 %. Mọi thứ nằm ở lưới
   * (y ≥ 265) và hàng thẻ, dưới dải huy hiệu khoá.
   */
  private showMiss(puzzle: LatinCellPuzzle, choice: number) {
    const board = this.board;
    if (!board) return;
    this.settleRing();
    this.tint?.setAlpha(UNIT_TINT_MISS);
    for (const [cell, g] of this.cellShapes) if (!this.units.has(cell)) g.setAlpha(DIM_ALPHA);
    for (const card of this.cards) {
      if (card.shape !== puzzle.answer && card.shape !== choice) card.root.setAlpha(DIM_ALPHA);
    }

    const right = this.cards[puzzle.answer];
    if (right) this.circleCard(right);
    const wrong = this.cards[choice];
    if (wrong) this.crossCard(wrong);

    puzzle.via.forEach((via, k) => {
      const mark = this.viaMark(via, k);
      if (mark) this.reveal(mark, REVEAL_FIRST_MS + k * REVEAL_STEP_MS, false);
    });
    const at = REVEAL_FIRST_MS + puzzle.via.length * REVEAL_STEP_MS;
    const answer = this.answerMark(puzzle);
    if (answer) this.reveal(answer, at, true);
    const question = this.question;
    if (question) {
      if (this.reduced) question.setVisible(false);
      else this.tweens.add({ targets: question, alpha: 0, delay: at, duration: REVEAL_FADE_MS });
    }
  }

  /** Hiện dần sau `delay` ms (giảm chuyển động: hiện ngay, không tween). */
  private reveal(target: Phaser.GameObjects.Container, delay: number, pop: boolean) {
    if (this.reduced) return;
    target.setAlpha(0);
    if (pop) target.setScale(0.6);
    this.tweens.add({
      targets: target,
      alpha: 1,
      scale: 1,
      delay,
      duration: REVEAL_FADE_MS,
      ease: pop ? "Back.easeOut" : "Quad.easeOut",
    });
  }

  /** Hình `shape` vẽ vào ô `cell` (trên cùng lưới). */
  private cellArt(cell: number, shape: number): Phaser.GameObjects.Graphics | undefined {
    const grid = this.grid;
    if (!grid || !this.board) return undefined;
    const at = cellCenter(grid, cell);
    const g = this.add.graphics({ x: at.x, y: at.y });
    drawShape(g, shape, grid.cell * SHAPE_RATIO, this.palette);
    this.board.add(g);
    return g;
  }

  /** Ô ? lúc hiện đáp án: khung primary viền mực + hình đúng. */
  private answerMark(puzzle: LatinCellPuzzle): Phaser.GameObjects.Container | undefined {
    const grid = this.grid;
    if (!grid || !this.board) return undefined;
    const p = this.palette;
    const { cell } = grid;
    const at = cellCenter(grid, puzzle.target);
    const inset = Math.max(5, cell * 0.05);
    const side = cell - 2 * inset;
    const radius = cell * 0.1;
    const width = Math.max(5, cell * 0.05);
    const frame = this.add.graphics();
    frame.fillStyle(p.primary.num, 0.22);
    frame.fillRoundedRect(-side / 2, -side / 2, side, side, radius);
    frame.lineStyle(width + 4, p.sticker.num, 1);
    frame.strokeRoundedRect(-side / 2, -side / 2, side, side, radius);
    frame.lineStyle(width, p.primary.num, 1);
    frame.strokeRoundedRect(-side / 2, -side / 2, side, side, radius);
    const art = this.add.graphics();
    drawShape(art, puzzle.answer, cell * SHAPE_RATIO, p);
    const mark = this.add.container(at.x, at.y, [frame, art]);
    this.board.add(mark);
    return mark;
  }

  /** Ô trung gian thứ `k`: hình mờ 60 %, viền phấn nét đứt, số thứ tự ở góc trên trái. */
  private viaMark(via: LatinCellVia, k: number): Phaser.GameObjects.Container | undefined {
    const grid = this.grid;
    if (!grid || !this.board) return undefined;
    const p = this.palette;
    const { cell } = grid;
    const at = cellCenter(grid, via.cell);
    const inset = Math.max(5, cell * 0.06);
    const border = this.add.graphics();
    const dash = cell * 0.1;
    dashedRect(border, cell - 2 * inset, cell - 2 * inset, 3, dash, dash * 0.7, p.chalk);
    const art = this.add.graphics().setAlpha(VIA_SHAPE_ALPHA);
    drawShape(art, via.shape, cell * SHAPE_RATIO, p);

    const br = Math.max(14, cell * 0.13);
    const bx = -cell / 2 + inset + br * 0.75;
    const by = -cell / 2 + inset + br * 0.75;
    const badge = this.add.graphics();
    badge.fillStyle(p.primary.num, 1);
    badge.fillCircle(bx, by, br);
    badge.lineStyle(3, p.sticker.num, 1);
    badge.strokeCircle(bx, by, br);
    const digit = this.add
      .text(bx, by, String(k + 1), {
        fontFamily: FONT,
        fontSize: Math.round(br * 1.3),
        fontStyle: "800",
        color: p.primaryFg.css,
      })
      .setOrigin(0.5, 0.52);
    const mark = this.add.container(at.x, at.y, [border, art, badge, digit]);
    this.board.add(mark);
    return mark;
  }

  /** Thẻ đúng: khoanh phấn quanh thẻ (cả bóng), giữ sáng 100 %. */
  private circleCard(card: CardView) {
    const p = this.palette;
    const off = Math.min(10, cardSize(this.cards.length).gap / 2);
    const w = card.w + 2 * off;
    const h = card.h + CARDS.shadow + 2 * off;
    const y = -card.h / 2 - off;
    const ring = this.add.graphics();
    ring.lineStyle(12, p.chalk.num, 0.25);
    ring.strokeRoundedRect(-w / 2, y, w, h, CARDS.radius + off);
    ring.lineStyle(5, p.chalk.num, 1);
    ring.strokeRoundedRect(-w / 2, y, w, h, CARDS.radius + off);
    card.root.addAt(ring, 0);
  }

  /** Thẻ vừa chạm nhầm: dấu ✗ màu destructive viền mực, lắc ngang (trừ khi giảm chuyển động). */
  private crossCard(card: CardView) {
    const p = this.palette;
    const arm = Math.min(card.w, card.h) * 0.62;
    const thick = Math.max(10, arm * 0.17);
    const cross = this.add.graphics();
    for (const [color, grow] of [
      [p.sticker.num, 6],
      [p.destructive.num, 0],
    ] as const) {
      cross.fillStyle(color, 1);
      for (const angle of [45, -45]) {
        const rad = (angle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const hx = (arm + grow) / 2;
        const hy = (thick + grow) / 2;
        const corners = [
          [-hx, -hy],
          [hx, -hy],
          [hx, hy],
          [-hx, hy],
        ].map(([x = 0, y = 0]) => ({ x: x * cos - y * sin, y: x * sin + y * cos }));
        cross.fillPoints(vectors(corners), true);
      }
    }
    card.body.add(cross);
    if (this.reduced) return;
    this.tweens.add({
      targets: card.root,
      x: { from: card.x - SHAKE_PX, to: card.x + SHAKE_PX },
      duration: SHAKE_MS,
      yoyo: true,
      repeat: 1,
      ease: "Sine.easeInOut",
      onComplete: () => card.root.setX(card.x),
    });
  }
}
