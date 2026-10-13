import {
  ROTATE_MATCH_MAX_RADIUS,
  type RotateMatchCell,
  type RotateMatchFigure,
  type RotateMatchPuzzle,
  rotateMatch,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import type { MinigameBridge } from "../types";

/*
 * Xoay hình — đặc tả: docs/04-minigames/rotate-match.md (mục "Ghi chú cho FE").
 * Bản mẫu: canvas Brain Rizz, trang Minigame, khu M5 (RotateMobile, RotateLevels, RotateStates).
 * Scene không vẽ chữ: chỉ có hình ghép ô, icon và huy hiệu ✓/✗.
 */

// ---------------------------------------------------------------- bố cục (khung 720×1280)

type Point = readonly [x: number, y: number];

/** Thẻ mẫu 360×360, tâm (360, 236): viền mực dày, icon con mắt ở góc trên trái, không nhận chạm. */
const MODEL = { x: 360, y: 236, size: 360, radius: 32, border: 7, shadow: 10 } as const;
/** Dải nhắc luật 288×56, tâm (360, 464): ↻ ✓ (xoay: được) và ⇋ ✗ (lật: không), không có chữ. */
const RULES: Point = [360, 464];
/** Thẻ lựa chọn 320×320, cả thẻ là vùng chạm. Rê chuột: nhấc 4 px, viền đậm hơn. */
const CARD = { size: 320, radius: 28, border: 4, hoverBorder: 7, shadow: 8, lift: 4 } as const;
/** Thẻ bị chạm sai: viền gạch đứt. */
const MISS_BORDER = 7;
const MISS_DASH: [number, number] = [20, 12];
/** Tâm thẻ lựa chọn theo đúng thứ tự `choices` (trái → phải, trên → dưới). Mầm: thẻ thứ ba ở giữa. */
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

/** Nửa cạnh thẻ lựa chọn trừ lề 20: cỡ ô u = ⌊140 / bán kính lớn nhất của mức⌋, tối đa 64 px. */
const FIGURE_REACH = 140;
const MAX_UNIT = 64;
/** Viền mực ngoài hình; bóng đổ lệch theo trục màn hình (không xoay theo hình); đường chia ô. */
const OUTLINE = 3;
const FIGURE_SHADOW = 7;
const GRID_LINE = 2;
const GRID_ALPHA = 0.4;
/** Bóng ma: viền các ô của hình mẫu, mờ 60 %. */
const GHOST_LINE = 5;
const GHOST_ALPHA = 0.6;
/** Độ mờ của các thẻ không liên quan trong lúc khoá sau câu sai. */
const DIM_ALPHA = 0.35;

/** Huy hiệu (so với tâm thẻ): ✓ ở góc trên phải; ✗ và icon gương cạnh nhau; mũi tên chiều xoay góc dưới phải. */
const BADGE_R = 30;
const BADGE_SHADOW = 5;
const OK_AT: Point = [140, -140];
const BAD_AT: Point = [130, -130];
const MIRROR_AT: Point = [62, -130];
const TURN_AT: Point = [116, 116];
const TURN_SCALE = 1.6;
/** Icon con mắt của thẻ mẫu (so với tâm thẻ). */
const EYE_AT: Point = [-142, -142];

// ---------------------------------------------------------------- nhịp hiệu ứng (đều ≤ 400 ms)

/** Hiện câu: mờ dần, phóng 0,96 → 1; nhận chạm ngay. */
const APPEAR_MS = 120;
const APPEAR_SCALE = 0.96;
/** Nhấn: thẻ co 0,97 rồi về. */
const PRESS_MS = 60;
const PRESS_SCALE = 0.97;
/** Đúng: bóng ma xoay 250 ms + nảy 100 ms, sang câu mới sau 350 ms (khoảng này tính vào giờ câu sau). */
const GHOST_RIGHT_MS = 250;
const BOUNCE_MS = 100;
const BOUNCE_SCALE = 1.08;
const SOLVED_MS = 350;
/** Sai: rung ±8 px trong 200 ms, bóng ma trên thẻ đúng 300 ms; hết khoá theo server (`unlockDelay`). */
const GHOST_MISS_MS = 300;
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

// ---------------------------------------------------------------- màu

/**
 * Ô hình ở giao diện tối: tím sáng của bản mẫu (RotateStates, 5,3:1 trên thẻ #2f2a52). Màu riêng
 * của game này, không phải token chung; giao diện sáng dùng token `--color-visualize`.
 */
const SHAPE_DARK = "#a99ce0";

/** Màu đọc từ token CSS lúc tạo scene (tự đổi theo sáng/tối). Chuỗi CSS để vẽ texture canvas. */
interface Palette {
  card: string;
  cardFg: string;
  /** Mực: viền thẻ, viền hình. */
  border: string;
  /** Bóng đổ kiểu nhãn dán. */
  sticker: string;
  /** Nền khung chơi (bg-muted của GameFrame). */
  muted: string;
  primary: string;
  primaryFg: string;
  destructive: string;
  /** Màu ô hình (nhóm Hình dung). */
  shape: string;
}

function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    card: token("--card"),
    cardFg: token("--card-foreground"),
    border: token("--border"),
    sticker: token("--sticker"),
    muted: token("--muted"),
    primary: token("--primary"),
    primaryFg: token("--primary-foreground"),
    destructive: token("--destructive"),
    shape: style.colorScheme === "dark" ? SHAPE_DARK : token("--color-visualize"),
  };
}

/** Màu CSS → số màu của Phaser. */
const toColor = (css: string) => Phaser.Display.Color.ValueToColor(css).color;

/** Trộn hai màu số (t = 0 → a, t = 1 → b). */
function mix(a: number, b: number, t: number) {
  const channel = (shift: number) =>
    Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t) << shift;
  return channel(16) | channel(8) | channel(0);
}

/** Màu số cho Graphics (hình vẽ lại mỗi câu). */
interface Inks {
  border: number;
  sticker: number;
  shape: number;
  /** Đường chia ô: mực 40 % trên nền hình, trộn sẵn thành màu đặc để chỗ giao không đậm hơn. */
  grid: number;
  /** Bóng ma: chữ trên thẻ (sáng: mực, tối: kem) để thấy được cả trên thẻ lẫn trên hình. */
  ghost: number;
  muted: number;
}

function toInks(c: Palette): Inks {
  const border = toColor(c.border);
  const shape = toColor(c.shape);
  return {
    border,
    sticker: toColor(c.sticker),
    shape,
    grid: mix(shape, border, GRID_ALPHA),
    ghost: toColor(c.cardFg),
    muted: toColor(c.muted),
  };
}

/** Đọc `prefers-reduced-motion`: bỏ rung, co, phóng, nảy và bóng ma; giữ đổi viền, huy hiệu, làm mờ. */
function prefersReducedMotion() {
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

// ---------------------------------------------------------------- hình ghép ô (Graphics)

type Cells = readonly RotateMatchCell[];

/** Trọng tâm các ô (đơn vị ô) = tâm xoay của hình: (trung bình x + 0,5; trung bình y + 0,5). */
function centroid(cells: Cells): Point {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of cells) {
    sx += x;
    sy += y;
  }
  return [sx / cells.length + 0.5, sy / cells.length + 0.5];
}

/** Tô từng ô cạnh `u`, nở thêm `grow` px mỗi phía; gốc toạ độ là trọng tâm hình. */
function fillCells(g: Phaser.GameObjects.Graphics, cells: Cells, u: number, grow: number) {
  const [cx, cy] = centroid(cells);
  for (const [x, y] of cells) {
    g.fillRect((x - cx) * u - grow, (y - cy) * u - grow, u + 2 * grow, u + 2 * grow);
  }
}

/** Đường chia ô: chỉ cạnh chung giữa hai ô kề nhau. */
function fillGridLines(g: Phaser.GameObjects.Graphics, cells: Cells, u: number) {
  const [cx, cy] = centroid(cells);
  const has = new Set(cells.map(([x, y]) => `${x},${y}`));
  const h = GRID_LINE / 2;
  for (const [x, y] of cells) {
    const px = (x - cx) * u;
    const py = (y - cy) * u;
    if (has.has(`${x + 1},${y}`)) g.fillRect(px + u - h, py, GRID_LINE, u);
    if (has.has(`${x},${y + 1}`)) g.fillRect(px, py + u - h, u, GRID_LINE);
  }
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

/**
 * Viền mọi cạnh ô, dày `t`, bằng các mảnh tô không chồng lên nhau (màu bán trong suốt chồng lên
 * nhau sẽ đậm hơn): cạnh ngang gộp thành đoạn liền và dài thêm nửa nét mỗi đầu để góc vuông vức,
 * cạnh dọc ngắn đi nửa nét mỗi đầu vì đỉnh nào cũng đã có cạnh ngang đi qua.
 */
function fillCellEdges(g: Phaser.GameObjects.Graphics, cells: Cells, u: number, t: number) {
  const [cx, cy] = centroid(cells);
  const h = t / 2;
  const rows = new Map<number, number[]>();
  const columns = new Set<string>();
  for (const [x, y] of cells) {
    for (const row of [y, y + 1]) rows.set(row, [...(rows.get(row) ?? []), x]);
    columns.add(`${x},${y}`).add(`${x + 1},${y}`);
  }
  for (const [row, xs] of rows) {
    for (const [from, to] of runs(xs)) {
      g.fillRect((from - cx) * u - h, (row - cy) * u - h, (to + 1 - from) * u + t, t);
    }
  }
  for (const key of columns) {
    const [x = 0, y = 0] = key.split(",").map(Number);
    g.fillRect((x - cx) * u - h, (y - cy) * u + h, t, u - t);
  }
}

// ---------------------------------------------------------------- vẽ texture bằng canvas 2D

type Ctx = CanvasRenderingContext2D;
type CardState = "idle" | "hover" | "miss";
type BadgeKind = "ok" | "bad" | "mirror";

function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Nét đứt chia đều quanh hình vuông bo góc để chỗ nối không lệch. */
function evenDash(size: number, r: number, [dash, gap]: [number, number]): [number, number] {
  const length = 4 * (size - 2 * r) + 2 * Math.PI * r;
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

function drawTurnIcon(ctx: Ctx, width: number, color: string) {
  strokeIcon(ctx, TURN_ARC, width, color);
  strokeIcon(ctx, TURN_HEAD, width, color);
}

function drawMirrorIcon(ctx: Ctx, color: string) {
  strokeIcon(ctx, MIRROR_AXIS, 3, color, [4, 3]);
  strokeIcon(ctx, MIRROR_ARROWS, 4, color);
}

// ---------------------------------------------------------------- scene

interface ChoiceView {
  /** Đặt tại tâm thẻ: mờ dần khi hiện câu, chứa lớp phủ khi bị làm mờ. */
  slot: Phaser.GameObjects.Container;
  /** Mặt thẻ: nhấc lên khi rê chuột, co khi nhấn, rung khi sai. */
  face: Phaser.GameObjects.Container;
  card: Phaser.GameObjects.Image;
  /** Bóng + hình (+ bóng ma), không xoay; nảy khi bóng ma khớp. */
  figure: Phaser.GameObjects.Container;
  angle: number;
  hovered: boolean;
}

/** Xoay hình — chạm vào lựa chọn duy nhất là hình mẫu đã được xoay (không lật, không lệch ô). */
export default class RotateMatchScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = false;
  private colors!: Palette;
  private inks!: Inks;
  private reducedMotion = false;
  /** Cỡ ô của mức đang chơi: mọi hình (mẫu và lựa chọn) cùng cỡ để cỡ không lộ đáp án. */
  private unit = MAX_UNIT;
  private board?: Phaser.GameObjects.Container;
  private choices: ChoiceView[] = [];
  /** Hẹn giờ của câu hiện tại (sang câu mới); huỷ hết khi sang câu mới hoặc rời màn. */
  private timers: Phaser.Time.TimerEvent[] = [];

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.locked = false;
    this.choices = [];
    this.timers = [];
  }

  create() {
    const canvas = this.game.canvas;
    this.colors = readPalette(canvas.isConnected ? canvas : document.documentElement);
    this.inks = toInks(this.colors);
    this.reducedMotion = prefersReducedMotion();
    this.unit = Math.min(
      MAX_UNIT,
      Math.floor(FIGURE_REACH / ROTATE_MATCH_MAX_RADIUS[this.bridge.difficulty]),
    );

    const cleanup = () => {
      this.clearTimers();
      this.tweens.killAll();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.clearTimers());

    // Dải nhắc luật giữ nguyên suốt vòng.
    this.add.image(RULES[0], RULES[1], this.rulesTexture());
    this.showPuzzle();
  }

  // -------------------------------------------------------------- dựng câu đố

  private showPuzzle() {
    // Mọi hẹn giờ và tween đang chạy đều thuộc câu cũ: dừng trước khi huỷ.
    this.clearTimers();
    this.tweens.killAll();
    this.board?.destroy();
    this.locked = false;

    const puzzle = rotateMatch.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    const board = this.add.container(0, 0);

    const model = this.add.container(MODEL.x, MODEL.y, [
      this.add.image(0, 0, this.modelTexture()),
      this.makeFigure(puzzle.model),
    ]);
    board.add(model);

    const slots = puzzle.choices.length > 3 ? SLOTS_4 : SLOTS_3;
    this.choices = puzzle.choices.map((choice, i) => {
      const [x, y] = slots[i] ?? SLOTS_4[0]!;
      const card = this.add.image(0, 0, this.cardTexture("idle"));
      const figure = this.makeFigure(choice);
      const face = this.add.container(0, 0, [card, figure]);
      const slot = this.add.container(x, y, [face]);
      const view: ChoiceView = { slot, face, card, figure, angle: choice.angle, hovered: false };

      // Vùng chạm phủ cả thẻ 320×320; ghi nhận ở pointerdown, một chạm là chốt.
      const zone = this.add
        .zone(x, y, CARD.size, CARD.size)
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

    // Hiện câu: mờ dần + phóng nhẹ, nhận chạm ngay.
    const targets = [model, ...this.choices.map((view) => view.slot)];
    for (const target of targets) {
      target.setAlpha(0);
      if (!this.reducedMotion) target.setScale(APPEAR_SCALE);
    }
    this.tweens.add({ targets, alpha: 1, scale: 1, duration: APPEAR_MS, ease: "Quad.easeOut" });
  }

  /** Bóng đổ + hình, mỗi lớp xoay quanh trọng tâm; bóng lệch xuống theo trục màn hình. */
  private makeFigure(figure: RotateMatchFigure) {
    const ink = this.inks;
    const u = this.unit;
    const shadow = this.add.graphics({ x: 0, y: FIGURE_SHADOW });
    shadow.fillStyle(ink.sticker, 1);
    fillCells(shadow, figure.cells, u, OUTLINE);

    const shape = this.add.graphics();
    shape.fillStyle(ink.border, 1);
    fillCells(shape, figure.cells, u, OUTLINE);
    shape.fillStyle(ink.shape, 1);
    fillCells(shape, figure.cells, u, 0);
    shape.fillStyle(ink.grid, 1);
    fillGridLines(shape, figure.cells, u);

    shadow.setAngle(figure.angle);
    shape.setAngle(figure.angle);
    return this.add.container(0, 0, [shadow, shape]);
  }

  private setHover(view: ChoiceView, on: boolean) {
    if (view.hovered === on) return;
    view.hovered = on;
    view.face.y = on ? -CARD.lift : 0;
    view.card.setTexture(this.cardTexture(on ? "hover" : "idle"));
  }

  // -------------------------------------------------------------- trả lời

  private answer(puzzle: RotateMatchPuzzle, choice: number) {
    if (this.locked) return;
    this.locked = true;

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const index = this.index;
    const correct = rotateMatch.check(puzzle, choice);
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

    if (correct) {
      this.showRight(right, puzzle.model, GHOST_RIGHT_MS);
      this.after(SOLVED_MS, () => this.showPuzzle());
      return;
    }

    this.showMiss(picked, puzzle.choices[choice]?.kind === "mirror");
    this.showRight(right, puzzle.model, GHOST_MISS_MS);
    for (const view of this.choices) if (view !== picked && view !== right) this.dim(view);

    // Hết khoá theo `lockedUntil` của server (không tự đếm 1,5 giây) để khớp huy hiệu khoá của khung.
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive() || this.index !== index + 1) return;
      this.after(ms, () => this.showPuzzle());
    });
  }

  /**
   * Thẻ đúng: vòng vàng + ✓. Bóng ma là viền hình mẫu đặt ở 0°, quay theo chiều gần nhất tới góc
   * của thẻ (270° thì quay ngược 90°) rồi khớp khít vào hình, sau đó hình nảy nhẹ.
   */
  private showRight(view: ChoiceView, model: RotateMatchFigure, ghostMs: number) {
    view.face.addAt(this.add.image(0, 0, this.ringTexture()), 0);
    view.face.add(this.add.image(OK_AT[0], OK_AT[1], this.badgeTexture("ok")));
    if (this.reducedMotion) return;

    const target = view.angle > 180 ? view.angle - 360 : view.angle;
    const ghost = this.add.graphics();
    ghost.fillStyle(this.inks.ghost, GHOST_ALPHA);
    fillCellEdges(ghost, model.cells, this.unit, GHOST_LINE);
    view.figure.add(ghost);
    view.face.add(this.add.image(TURN_AT[0], TURN_AT[1], this.turnTexture()).setFlipX(target < 0));

    this.tweens.add({
      targets: ghost,
      angle: target,
      duration: ghostMs,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.tweens.add({
          targets: view.figure,
          scale: BOUNCE_SCALE,
          duration: BOUNCE_MS / 2,
          yoyo: true,
          ease: "Quad.easeOut",
        });
      },
    });
  }

  /** Thẻ bị chạm sai: viền gạch đứt + ✗ (bản gương thêm icon gương), rung ngang ±8 px. */
  private showMiss(view: ChoiceView, mirror: boolean) {
    view.card.setTexture(this.cardTexture("miss"));
    if (mirror) {
      view.face.add(this.add.image(MIRROR_AT[0], MIRROR_AT[1], this.badgeTexture("mirror")));
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
   * Làm mờ thẻ còn 35 % bằng lớp phủ màu nền khung (65 %). Đặt alpha cho cả nhóm thì Phaser tính
   * riêng từng lớp, bóng đổ dưới thẻ và dưới hình sẽ lộ ra; nền khung là một màu nên phủ cho kết quả
   * giống hệt làm mờ cả nhóm.
   */
  private dim(view: ChoiceView) {
    const height = CARD.size + CARD.shadow + 4;
    const veil = this.add
      .rectangle(0, CARD.shadow / 2, CARD.size + 4, height, this.inks.muted, 1)
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

  // -------------------------------------------------------------- texture (vẽ một lần mỗi vòng)

  /** Tạo texture từ canvas 2D (gốc toạ độ ở tâm) nếu chưa có; trả về khoá. */
  private texture(name: string, width: number, height: number, draw: (ctx: Ctx) => void) {
    const key = `rotate-match:${name}`;
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

  /**
   * Thẻ lựa chọn kèm bóng đổ (chung một ảnh). Thẻ rê chuột: viền 7 và bóng lệch thêm 4 px vì mặt thẻ
   * nhấc lên 4 px còn bóng đứng yên. Thẻ chạm sai: viền gạch đứt màu lỗi thay cho viền mực.
   */
  private cardTexture(state: CardState) {
    const c = this.colors;
    const { size, radius } = CARD;
    const half = size / 2;
    const shadow = state === "hover" ? CARD.shadow + CARD.lift : CARD.shadow;
    const pad = 6;
    return this.texture(
      `card-${state}`,
      size + 2 * pad,
      size + 2 * (CARD.shadow + CARD.lift + pad),
      (ctx) => {
        roundRectPath(ctx, -half, -half + shadow, size, size, radius);
        ctx.fillStyle = c.sticker;
        ctx.fill();
        roundRectPath(ctx, -half, -half, size, size, radius);
        ctx.fillStyle = c.card;
        ctx.fill();
        if (state === "miss") {
          ctx.setLineDash(evenDash(size, radius, MISS_DASH));
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

  /** Thẻ mẫu: viền mực dày, bóng đổ, icon con mắt ở góc trên trái. */
  private modelTexture() {
    const c = this.colors;
    const { size, radius } = MODEL;
    const half = size / 2;
    const pad = 6;
    return this.texture("model", size + 2 * pad, size + 2 * (MODEL.shadow + pad), (ctx) => {
      roundRectPath(ctx, -half, -half + MODEL.shadow, size, size, radius);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      roundRectPath(ctx, -half, -half, size, size, radius);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.lineWidth = MODEL.border;
      ctx.strokeStyle = c.border;
      ctx.stroke();

      ctx.save();
      ctx.translate(EYE_AT[0], EYE_AT[1]);
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fillStyle = c.muted;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = c.cardFg;
      ctx.stroke();
      const eye = new Path2D(EYE);
      ctx.fillStyle = c.card;
      ctx.fill(eye);
      ctx.lineWidth = 3.5;
      ctx.stroke(eye);
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fillStyle = c.shape;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = c.border;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = c.border;
      ctx.fill();
      ctx.restore();
    });
  }

  /** Dải nhắc luật: hai viên ↻ ✓ và ⇋ ✗, không có chữ. */
  private rulesTexture() {
    const c = this.colors;
    return this.texture("rules", 296, 64, (ctx) => {
      for (const x of [-144, 8]) {
        roundRectPath(ctx, x, -28, 136, 56, 28);
        ctx.fillStyle = c.card;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = c.border;
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(-104, 0);
      drawTurnIcon(ctx, 4, c.cardFg);
      ctx.restore();
      strokeIcon(ctx, "M-62 0 L-54 8 L-38 -10", 5, c.cardFg);
      ctx.save();
      ctx.translate(48, 0);
      drawMirrorIcon(ctx, c.cardFg);
      ctx.restore();
      strokeIcon(ctx, "M96 -9 L114 9 M114 -9 L96 9", 5, c.destructive);
    });
  }

  /** Vòng vàng viền mực quanh thẻ đúng (nằm dưới thẻ). */
  private ringTexture() {
    const c = this.colors;
    return this.texture("ring", 360, 360, (ctx) => {
      roundRectPath(ctx, -170, -170, 340, 340, 36);
      ctx.lineWidth = 14;
      ctx.strokeStyle = c.border;
      ctx.stroke();
      ctx.lineWidth = 8;
      ctx.strokeStyle = c.primary;
      ctx.stroke();
    });
  }

  /** Huy hiệu tròn có bóng: ✓ (vàng), ✗ (màu lỗi), gương (nền thẻ). */
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
      else drawMirrorIcon(ctx, c.cardFg);
    });
  }

  /** Mũi tên chiều xoay của bóng ma (↻; lật ngang thành ↺ khi quay ngược). */
  private turnTexture() {
    const c = this.colors;
    return this.texture("turn", 76, 76, (ctx) => {
      ctx.scale(TURN_SCALE, TURN_SCALE);
      drawTurnIcon(ctx, 3.5, c.cardFg);
    });
  }
}
