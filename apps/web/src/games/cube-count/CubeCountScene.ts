import { type CubeCountPuzzle, cubeCount } from "@brain-rizz/shared";
import Phaser from "phaser";
import type { MinigameBridge } from "../types";
import {
  CUBE_DARK,
  CUBE_LEFT,
  CUBE_LIGHT,
  CUBE_RIGHT,
  CUBE_TOP,
  type CubeShades,
  cubeOrigin,
  HALF_H,
  type Point,
  SLAB_DARK,
  SLAB_LIGHT,
  SLAB_THICK,
  type SlabShades,
  slabCorners,
  slabGrid,
} from "./art";

/*
 * Đếm khối — đặc tả: docs/04-minigames/cube-count.md (mục "Ghi chú cho FE").
 * Bản mẫu: canvas Brain Rizz, trang Minigame, hàng M12 (CubeCountMobile, CubeCountLevels,
 * CubeCountStates). Scene chỉ vẽ chữ số (Baloo 2), không có chữ cần dịch.
 */

// ---------------------------------------------------------------- bố cục (khung 720×1280)

/** Thẻ mô hình 656×688 tại (32, 32): viền mực 7, bóng đặc lệch 10. Không nhận chạm. */
const MODEL = { x: 32, y: 32, width: 656, height: 688, radius: 32, border: 7, shadow: 10 } as const;
/** Gốc mô hình (đỉnh trên của bệ) theo cỡ bệ: x = 360 + 48,5 × (depth − width) ÷ 2, y = 285 + 14 × (depth + width). */
const modelOrigin = (depth: number, width: number): Point => [
  360 + (48.5 * (depth - width)) / 2,
  285 + 14 * (depth + width),
];

/** Hàng phép tính: icon một khối tỉ lệ 0,5 có gốc tại (219, 762), dấu "=" ở x 255–285. */
const EQ_CUBE: Point = [219, 762];
const EQ_SCALE = 0.5;
const EQ_BARS = { from: 255, to: 285, ys: [783, 797], width: 7 } as const;
/** Ô kết quả (309, 748) 216×84 bo 20; "?" 60 px chân chữ y 810, số 64 px chân chữ y 812. */
const RESULT = { x: 309, y: 748, width: 216, height: 84, radius: 20, border: 4 } as const;
const RESULT_DASH: [number, number] = [12, 9];
const RESULT_CENTER: Point = [RESULT.x + RESULT.width / 2, RESULT.y + RESULT.height / 2];
const QUESTION = { size: 60, baseline: 20 } as const;
const TOTAL = { size: 64, baseline: 22 } as const;

/** Thẻ số 312×160 bo 28, viền 4, bóng đặc 6; cả thẻ là vùng chạm. Rê chuột: nhấc 4 px. */
const CARD = { width: 312, height: 160, radius: 28, border: 4, shadow: 6, lift: 4 } as const;
/** Số trên thẻ: Baloo 2 đậm 88 px, chân chữ thấp hơn tâm thẻ 31 px (như bản mẫu). */
const CARD_NUMBER = { size: 88, baseline: 31 } as const;
/** Tâm 4 thẻ theo thứ tự `options` (trái → phải, trên → dưới). */
const SLOTS: readonly Point[] = [
  [188, 944],
  [532, 944],
  [188, 1128],
  [532, 1128],
];
/** Thẻ bị chạm sai: viền gạch đứt. */
const MISS_BORDER = 7;
const MISS_DASH: [number, number] = [20, 12];
/** Vòng vàng quanh thẻ đúng: lề 12 px ngoài thẻ, bo 38. */
const RING = { pad: 12, radius: 38, outer: 14, inner: 8 } as const;
/** Độ mờ của hai thẻ không liên quan trong lúc khoá sau câu sai. */
const DIM_ALPHA = 0.35;

/** Huy hiệu tròn (so với tâm thẻ): ✓/✗ ở góc trên phải, icon con mắt cạnh ✗. */
const BADGE_R = 30;
const BADGE_SHADOW = 5;
const BADGE_AT: Point = [143, -74];
const EYE_AT: Point = [75, -74];

/** Số tầng ghi giữa mặt trên khi khoá: Baloo 2 đậm 40 px, chân chữ thấp hơn tâm mặt 13 px. */
const LEVEL_NUMBER = { size: 40, baseline: 13 } as const;
const LINE = 4;
const GRID_LINE = 2.5;

// ---------------------------------------------------------------- nhịp hiệu ứng (đều ≤ 400 ms)

/** Hiện câu: mờ dần, phóng 0,96 → 1; nhận chạm ngay. */
const APPEAR_MS = 120;
const APPEAR_SCALE = 0.96;
/** Nhấn: thẻ thu còn 0,96 rồi về. */
const PRESS_MS = 80;
const PRESS_SCALE = 0.96;
/** Đúng: thẻ phóng 1,05 rồi về; sang câu mới sau 350 ms (khoảng này tính vào giờ câu sau). */
const BOUNCE_MS = 200;
const BOUNCE_SCALE = 1.05;
const SOLVED_MS = 350;
/** Sai: rung ±8 px trong 200 ms; hết khoá theo server (`unlockDelay`). */
const SHAKE_MS = 200;
const SHAKE_PX = 8;
const DIM_MS = 120;

// ---------------------------------------------------------------- icon (tâm 0,0)

const CHECK = "M-14 1 L-4 12 L15 -11";
const CROSS = "M-11 -11 L11 11 M11 -11 L-11 11";
const EYE = "M-17 0 C-11 -9 -5 -11 0 -11 C5 -11 11 -9 17 0 C11 9 5 11 0 11 C-5 11 -11 9 -17 0 Z";

// ---------------------------------------------------------------- chữ số

const FONT_FAMILY = '"Baloo 2", "Be Vietnam Pro", sans-serif';
const FONT_WEIGHT = "800";
/** Chờ font tối đa chừng này rồi vẽ bằng font dự phòng, để vòng chơi không bị kẹt. */
const FONT_TIMEOUT_MS = 1500;

/** Chờ Baloo 2 tải xong (chữ số vẽ vào texture một lần, không tự vẽ lại khi font về muộn). */
function waitForFont(): Promise<void> {
  const fonts = document.fonts;
  if (!fonts) return Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, FONT_TIMEOUT_MS);
  });
  const load = fonts.load(`${FONT_WEIGHT} 88px "Baloo 2"`, "0123456789?").then(
    () => {},
    () => {},
  );
  return Promise.race([load, timeout]).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------- màu

/** Màu đọc từ token CSS lúc tạo scene (tự đổi theo sáng/tối), kèm màu khối riêng của game. */
interface Palette {
  card: string;
  cardFg: string;
  /** Mực: viền thẻ, viền khối. */
  border: string;
  /** Bóng đổ kiểu nhãn dán. */
  sticker: string;
  /** Nền khung chơi (bg-muted của GameFrame): lớp phủ làm mờ thẻ. */
  muted: string;
  primary: string;
  /** Chữ trên nền vàng: mực ở cả sáng lẫn tối (số tầng trên mặt trên vàng, dấu ✓). */
  primaryFg: string;
  destructive: string;
  /** Kem cố định (nền huy hiệu con mắt, như bản mẫu ở cả hai nền). */
  chalk: string;
  cube: CubeShades;
  slab: SlabShades;
}

function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const dark = style.colorScheme === "dark";
  return {
    card: token("--card"),
    cardFg: token("--card-foreground"),
    border: token("--border"),
    sticker: token("--sticker"),
    muted: token("--muted"),
    primary: token("--primary"),
    primaryFg: token("--primary-foreground"),
    destructive: token("--destructive"),
    chalk: token("--chalk"),
    cube: dark ? CUBE_DARK : CUBE_LIGHT,
    slab: dark ? SLAB_DARK : SLAB_LIGHT,
  };
}

/** Màu CSS → số màu của Phaser. */
const toColor = (css: string) => Phaser.Display.Color.ValueToColor(css).color;

/** Đọc `prefers-reduced-motion`: bỏ rung, co, phóng; giữ đổi viền, huy hiệu, mặt trên vàng và số. */
function prefersReducedMotion() {
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

// ---------------------------------------------------------------- vẽ canvas 2D

type Ctx = CanvasRenderingContext2D;
type CardState = "idle" | "hover" | "miss";
type BadgeKind = "ok" | "bad" | "eye";

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
function evenDash(w: number, h: number, r: number, [dash, gap]: [number, number]): number[] {
  const length = 2 * (w + h - 4 * r) + 2 * Math.PI * r;
  const k = length / Math.max(1, Math.round(length / (dash + gap))) / (dash + gap);
  return [dash * k, gap * k];
}

function polygonPath(ctx: Ctx, points: readonly Point[], at: Point) {
  ctx.beginPath();
  points.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x + at[0], y + at[1]);
    else ctx.lineTo(x + at[0], y + at[1]);
  });
  ctx.closePath();
}

function fillStroke(ctx: Ctx, points: readonly Point[], at: Point, fill: string, ink: string) {
  polygonPath(ctx, points, at);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = LINE;
  ctx.strokeStyle = ink;
  ctx.stroke();
}

/** Một khối lập phương: mặt trên (màu riêng nếu có), mặt trái, mặt phải, viền mực nối góc tròn. */
function drawCube(ctx: Ctx, at: Point, shades: CubeShades, ink: string, top = shades.top) {
  fillStroke(ctx, CUBE_TOP, at, top, ink);
  fillStroke(ctx, CUBE_LEFT, at, shades.left, ink);
  fillStroke(ctx, CUBE_RIGHT, at, shades.right, ink);
}

function strokeIcon(ctx: Ctx, d: string, width: number, color: string) {
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke(new Path2D(d));
}

/** Chữ số căn giữa theo `x`, chân chữ ở `baseline`. */
function drawNumber(ctx: Ctx, text: string, x: number, baseline: number, size: number) {
  ctx.font = `${FONT_WEIGHT} ${size}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, baseline);
}

/**
 * Bệ và mô hình, gốc mô hình tại `origin`. `highlight`: mặt trên của khối cao nhất mỗi cột đổi sang
 * vàng và ghi số tầng của cột (lúc khoá sau câu sai).
 */
function drawModel(
  ctx: Ctx,
  puzzle: CubeCountPuzzle,
  origin: Point,
  c: Palette,
  highlight: boolean,
) {
  const { depth, width, heights } = puzzle;
  const ink = c.border;
  const at = (p: Point): Point => [p[0] + origin[0], p[1] + origin[1]];
  const down = (p: Point): Point => [p[0], p[1] + SLAB_THICK];

  // Bệ: mặt trên, đường chia ô, rồi hai mặt bên dày 14 px.
  const s = slabCorners(depth, width);
  fillStroke(ctx, [s.top, s.right, s.bottom, s.left], origin, c.slab.top, ink);
  ctx.beginPath();
  for (const [from, to] of slabGrid(depth, width)) {
    ctx.moveTo(...at(from));
    ctx.lineTo(...at(to));
  }
  ctx.lineWidth = GRID_LINE;
  ctx.strokeStyle = c.slab.grid;
  ctx.stroke();
  fillStroke(ctx, [s.left, s.bottom, down(s.bottom), down(s.left)], origin, c.slab.left, ink);
  fillStroke(ctx, [s.bottom, s.right, down(s.right), down(s.bottom)], origin, c.slab.right, ink);

  // Khối: theo r + c + k tăng dần, khối gần mắt vẽ sau đè lên khối xa.
  const cubes: [r: number, c: number, k: number][] = [];
  heights.forEach((row, r) => {
    row.forEach((h, col) => {
      for (let k = 0; k < h; k++) cubes.push([r, col, k]);
    });
  });
  cubes.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  for (const [r, col, k] of cubes) {
    const top = highlight && k === (heights[r]?.[col] ?? 0) - 1 ? c.primary : c.cube.top;
    drawCube(ctx, at(cubeOrigin(r, col, k)), c.cube, ink, top);
  }

  // Số tầng giữa mặt trên của mỗi cột (mặt trên luôn thấy trọn nên vẽ sau cùng không che gì).
  if (!highlight) return;
  ctx.fillStyle = c.primaryFg;
  heights.forEach((row, r) => {
    row.forEach((h, col) => {
      if (h <= 0) return;
      const [x, y] = at(cubeOrigin(r, col, h - 1));
      drawNumber(ctx, String(h), x, y + HALF_H + LEVEL_NUMBER.baseline, LEVEL_NUMBER.size);
    });
  });
}

// ---------------------------------------------------------------- scene

interface OptionView {
  /** Đặt tại tâm thẻ: mờ dần khi hiện câu, chứa lớp phủ khi bị làm mờ. */
  slot: Phaser.GameObjects.Container;
  /** Mặt thẻ (thẻ + số + huy hiệu): nhấc khi rê chuột, co khi nhấn, rung khi sai. */
  face: Phaser.GameObjects.Container;
  card: Phaser.GameObjects.Image;
  hovered: boolean;
}

/** Đếm khối — đếm mọi khối trên bệ, kể cả khối bị che, rồi chạm thẻ ghi đúng tổng. */
export default class CubeCountScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = true;
  private colors!: Palette;
  private reducedMotion = false;
  private board?: Phaser.GameObjects.Container;
  private options: OptionView[] = [];
  /** Texture mô hình (cỡ thẻ mô hình), vẽ lại mỗi câu và khi hiện đáp án. */
  private modelCanvas?: Phaser.Textures.CanvasTexture;
  /** Ô kết quả cạnh dấu "=": khung + chữ ("?" hoặc tổng số khối). */
  private result?: Phaser.GameObjects.Container;
  /** Hẹn giờ của câu hiện tại (sang câu mới); huỷ hết khi sang câu mới hoặc rời màn. */
  private timers: Phaser.Time.TimerEvent[] = [];

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.locked = true;
    this.options = [];
    this.timers = [];
  }

  create() {
    const canvas = this.game.canvas;
    this.colors = readPalette(canvas.isConnected ? canvas : document.documentElement);
    this.reducedMotion = prefersReducedMotion();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.locked = true;
      this.clearTimers();
      this.tweens.killAll();
      this.options = [];
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.clearTimers());

    void waitForFont().then(() => {
      // Hết vòng trong lúc chờ font thì scene đã bị huỷ.
      if (!this.sys.isActive()) return;
      this.buildStatic();
      this.showPuzzle();
    });
  }

  /** Phần giữ nguyên suốt vòng: thẻ mô hình, icon một khối và dấu "=". */
  private buildStatic() {
    const cx = MODEL.x + MODEL.width / 2;
    const cy = MODEL.y + MODEL.height / 2;
    this.add.image(cx, cy + MODEL.shadow / 2, this.modelCardTexture());
    const key = "cube-count:model";
    if (this.textures.exists(key)) this.textures.remove(key);
    this.modelCanvas = this.textures.createCanvas(key, MODEL.width, MODEL.height) ?? undefined;
    this.add.image(EQ_BARS.from - 4, RESULT_CENTER[1], this.equationTexture()).setOrigin(1, 0.5);
    this.add.image((EQ_BARS.from + EQ_BARS.to) / 2, RESULT_CENTER[1], this.equalsTexture());
  }

  // -------------------------------------------------------------- dựng câu đố

  private showPuzzle() {
    // Mọi hẹn giờ và tween đang chạy đều thuộc câu cũ: dừng trước khi huỷ.
    this.clearTimers();
    this.tweens.killAll();
    this.board?.destroy();
    this.locked = false;

    const puzzle = cubeCount.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    const board = this.add.container(0, 0);

    this.paintModel(puzzle, false);
    const model = this.add.image(
      MODEL.x + MODEL.width / 2,
      MODEL.y + MODEL.height / 2,
      this.modelCanvas?.key ?? "__MISSING",
    );
    board.add(model);

    this.result = this.add.container(RESULT_CENTER[0], RESULT_CENTER[1]);
    this.setResult(undefined);
    board.add(this.result);

    this.options = puzzle.options.map((value, i) => {
      const [x, y] = SLOTS[i] ?? SLOTS[0]!;
      const card = this.add.image(0, 0, this.cardTexture("idle"));
      const number = this.numberImage(String(value), CARD_NUMBER.size, this.colors.cardFg);
      number.y = CARD_NUMBER.baseline;
      const face = this.add.container(0, 0, [card, number]);
      const slot = this.add.container(x, y, [face]);
      const view: OptionView = { slot, face, card, hovered: false };

      // Vùng chạm phủ cả thẻ 312×160; ghi nhận ở pointerdown, một chạm là chốt.
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

    // Hiện câu: mờ dần + phóng nhẹ, nhận chạm ngay.
    const targets = [model, ...this.options.map((view) => view.slot)];
    for (const target of targets) {
      target.setAlpha(0);
      if (!this.reducedMotion) target.setScale(APPEAR_SCALE);
    }
    this.tweens.add({ targets, alpha: 1, scale: 1, duration: APPEAR_MS, ease: "Quad.easeOut" });
  }

  /** Vẽ lại texture mô hình (cùng một canvas cho mọi câu). */
  private paintModel(puzzle: CubeCountPuzzle, highlight: boolean) {
    const texture = this.modelCanvas;
    if (!texture) return;
    const ctx = texture.getContext();
    ctx.save();
    ctx.clearRect(0, 0, MODEL.width, MODEL.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.translate(-MODEL.x, -MODEL.y);
    drawModel(ctx, puzzle, modelOrigin(puzzle.depth, puzzle.width), this.colors, highlight);
    ctx.restore();
    texture.refresh();
  }

  /** Ô kết quả: chưa biết thì khung nét đứt mờ + "?", biết rồi thì khung liền + tổng số khối. */
  private setResult(total: number | undefined) {
    const box = this.result;
    if (!box) return;
    box.removeAll(true);
    const known = total !== undefined;
    box.add(this.add.image(0, 0, this.resultTexture(known)));
    const label = this.numberImage(
      known ? String(total) : "?",
      known ? TOTAL.size : QUESTION.size,
      this.colors.cardFg,
    );
    label.y = known ? TOTAL.baseline : QUESTION.baseline;
    if (!known) label.setAlpha(0.75);
    box.add(label);
  }

  private setHover(view: OptionView, on: boolean) {
    if (view.hovered === on) return;
    view.hovered = on;
    view.face.y = on ? -CARD.lift : 0;
    view.card.setTexture(this.cardTexture(on ? "hover" : "idle"));
  }

  // -------------------------------------------------------------- trả lời

  private answer(puzzle: CubeCountPuzzle, choice: number) {
    if (this.locked) return;
    this.locked = true;

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const index = this.index;
    const correct = cubeCount.check(puzzle, choice);
    this.bridge.submit(index, choice);
    this.index += 1;

    for (const view of this.options) this.setHover(view, false);
    const picked = this.options[choice];
    const right = this.options[puzzle.answerIndex];
    if (!picked || !right) return;
    const total = puzzle.options[puzzle.answerIndex];

    if (correct) {
      this.markRight(right);
      this.setResult(total);
      if (!this.reducedMotion) {
        this.tweens.add({
          targets: right.face,
          scale: BOUNCE_SCALE,
          duration: BOUNCE_MS / 2,
          yoyo: true,
          ease: "Quad.easeOut",
        });
      }
      this.after(SOLVED_MS, () => this.showPuzzle());
      return;
    }

    if (!this.reducedMotion) {
      this.tweens.add({
        targets: picked.face,
        scale: PRESS_SCALE,
        duration: PRESS_MS / 2,
        yoyo: true,
      });
    }
    this.showMiss(picked, puzzle.kinds[choice] === "visible");
    this.markRight(right);
    for (const view of this.options) if (view !== picked && view !== right) this.dim(view);
    // Mặt trên vàng + số tầng từng cột; ô "=" ghi tổng để người chơi tự cộng lại.
    this.paintModel(puzzle, true);
    this.setResult(total);

    // Hết khoá theo `lockedUntil` của server (không tự đếm 1,5 giây) để khớp huy hiệu khoá của khung.
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive() || this.index !== index + 1) return;
      this.after(ms, () => this.showPuzzle());
    });
  }

  /** Thẻ đúng: vòng vàng (nằm dưới thẻ) + huy hiệu ✓. */
  private markRight(view: OptionView) {
    view.face.addAt(this.add.image(0, 0, this.ringTexture()), 0);
    view.face.add(this.add.image(BADGE_AT[0], BADGE_AT[1], this.badgeTexture("ok")));
  }

  /** Thẻ bị chạm sai: viền gạch đứt + ✗ (quên khối bị che thì thêm icon con mắt), rung ±8 px. */
  private showMiss(view: OptionView, visibleOnly: boolean) {
    view.card.setTexture(this.cardTexture("miss"));
    if (visibleOnly) {
      view.face.add(this.add.image(EYE_AT[0], EYE_AT[1], this.badgeTexture("eye")));
    }
    view.face.add(this.add.image(BADGE_AT[0], BADGE_AT[1], this.badgeTexture("bad")));
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
   * riêng từng lớp, bóng đổ dưới thẻ sẽ lộ ra; nền khung là một màu nên phủ cho kết quả như làm mờ.
   */
  private dim(view: OptionView) {
    const veil = this.add
      .rectangle(
        0,
        CARD.shadow / 2,
        CARD.width + 6,
        CARD.height + CARD.shadow + 6,
        toColor(this.colors.muted),
        1,
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

  // -------------------------------------------------------------- texture (vẽ một lần mỗi vòng)

  /** Tạo texture từ canvas 2D (gốc toạ độ ở tâm) nếu chưa có; trả về khoá. */
  private texture(name: string, width: number, height: number, draw: (ctx: Ctx) => void) {
    const key = `cube-count:${name}`;
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
   * Chữ số Baloo 2 thành ảnh, gốc ảnh đặt ở chân chữ giữa chữ (đặt `y` của ảnh = vị trí chân chữ).
   * Mỗi cặp (chữ, cỡ, màu) vẽ một lần mỗi vòng.
   */
  private numberImage(text: string, size: number, color: string) {
    const width = Math.ceil(size * 0.62 * Math.max(1, text.length)) + 16;
    const height = Math.ceil(size * 1.3);
    const baseline = Math.round(size * 0.95);
    const key = this.texture(`num-${size}-${color}-${text}`, width, height, (ctx) => {
      ctx.fillStyle = color;
      drawNumber(ctx, text, 0, baseline - height / 2, size);
    });
    return this.add.image(0, 0, key).setOrigin(0.5, baseline / height);
  }

  /** Thẻ mô hình 656×688 kèm bóng đổ lệch 10 px. */
  private modelCardTexture() {
    const c = this.colors;
    const { width, height, radius, border, shadow } = MODEL;
    const pad = 6;
    return this.texture("model-card", width + 2 * pad, height + shadow + 2 * pad, (ctx) => {
      const x = -width / 2;
      const y = -(height + shadow) / 2;
      roundRectPath(ctx, x, y + shadow, width, height, radius);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      roundRectPath(ctx, x, y, width, height, radius);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.lineWidth = border;
      ctx.strokeStyle = c.border;
      ctx.stroke();
    });
  }

  /** Icon một khối tỉ lệ 0,5 (gốc khối tại EQ_CUBE); ảnh đặt mép phải sát dấu "=". */
  private equationTexture() {
    const c = this.colors;
    // Hộp bao của khối tỉ lệ 0,5: x 194,75–243,25, y 762–818 (thêm lề nét).
    const left = EQ_CUBE[0] - 26;
    const right = EQ_BARS.from - 4;
    const top = RESULT.y;
    const bottom = RESULT.y + RESULT.height;
    return this.texture("equation", right - left, bottom - top, (ctx) => {
      ctx.translate(-(left + right) / 2, -(top + bottom) / 2);
      ctx.translate(EQ_CUBE[0], EQ_CUBE[1]);
      ctx.scale(EQ_SCALE, EQ_SCALE);
      drawCube(ctx, [0, 0], c.cube, c.border);
    });
  }

  /** Dấu "=": hai vạch 30 px, dày 7, đầu tròn. */
  private equalsTexture() {
    const c = this.colors;
    const { from, to, ys, width } = EQ_BARS;
    const [y1 = 0, y2 = 0] = ys;
    return this.texture("equals", to - from + width + 2, y2 - y1 + width + 2, (ctx) => {
      const half = (to - from) / 2;
      const gap = (y2 - y1) / 2;
      ctx.beginPath();
      ctx.moveTo(-half, -gap);
      ctx.lineTo(half, -gap);
      ctx.moveTo(-half, gap);
      ctx.lineTo(half, gap);
      ctx.lineWidth = width;
      ctx.strokeStyle = c.cardFg;
      ctx.stroke();
    });
  }

  /** Ô kết quả: chưa biết thì nền thẻ 55 % và khung nét đứt mờ; biết rồi thì nền thẻ, khung liền. */
  private resultTexture(known: boolean) {
    const c = this.colors;
    const { width, height, radius, border } = RESULT;
    const pad = 4;
    return this.texture(
      known ? "result-known" : "result-empty",
      width + 2 * pad,
      height + 2 * pad,
      (ctx) => {
        roundRectPath(ctx, -width / 2, -height / 2, width, height, radius);
        ctx.globalAlpha = known ? 1 : 0.55;
        ctx.fillStyle = c.card;
        ctx.fill();
        if (!known) {
          ctx.setLineDash(evenDash(width, height, radius, RESULT_DASH));
          ctx.lineCap = "butt";
        }
        ctx.lineWidth = border;
        ctx.strokeStyle = c.cardFg;
        ctx.stroke();
      },
    );
  }

  /**
   * Thẻ số kèm bóng đổ (chung một ảnh). Thẻ rê chuột: bóng lệch thêm 4 px vì mặt thẻ nhấc lên 4 px
   * còn bóng đứng yên. Thẻ chạm sai: viền gạch đứt màu lỗi thay cho viền mực.
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
        const x = -width / 2;
        const y = -height / 2;
        roundRectPath(ctx, x, y + shadow, width, height, radius);
        ctx.fillStyle = c.sticker;
        ctx.fill();
        roundRectPath(ctx, x, y, width, height, radius);
        ctx.fillStyle = c.card;
        ctx.fill();
        if (state === "miss") {
          ctx.setLineDash(evenDash(width, height, radius, MISS_DASH));
          ctx.lineCap = "butt";
          ctx.lineWidth = MISS_BORDER;
          ctx.strokeStyle = c.destructive;
        } else {
          ctx.lineWidth = CARD.border;
          ctx.strokeStyle = c.border;
        }
        ctx.stroke();
      },
    );
  }

  /** Vòng vàng viền mực quanh thẻ đúng (nằm dưới thẻ). */
  private ringTexture() {
    const c = this.colors;
    const { pad, radius, outer, inner } = RING;
    const width = CARD.width + 2 * pad;
    const height = CARD.height + 2 * pad;
    return this.texture("ring", width + outer + 4, height + outer + 4, (ctx) => {
      roundRectPath(ctx, -width / 2, -height / 2, width, height, radius);
      ctx.lineWidth = outer;
      ctx.strokeStyle = c.border;
      ctx.stroke();
      ctx.lineWidth = inner;
      ctx.strokeStyle = c.primary;
      ctx.stroke();
    });
  }

  /** Huy hiệu tròn có bóng: ✓ (vàng), ✗ (màu lỗi), con mắt (nền kem, nét mực). */
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
      ctx.fillStyle = kind === "ok" ? c.primary : kind === "bad" ? c.destructive : c.chalk;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.border;
      ctx.stroke();
      if (kind === "ok") {
        strokeIcon(ctx, CHECK, 7, c.primaryFg);
      } else if (kind === "bad") {
        // Dấu ✗ dùng màu nền thẻ: kem trên đỏ (sáng), tím đậm trên hồng (tối), đều đủ tương phản.
        strokeIcon(ctx, CROSS, 7, c.card);
      } else {
        strokeIcon(ctx, EYE, 4, c.primaryFg);
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = c.primaryFg;
        ctx.fill();
      }
    });
  }
}
