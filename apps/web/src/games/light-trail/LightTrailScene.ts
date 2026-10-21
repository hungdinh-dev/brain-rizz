import {
  type LightTrailAnswer,
  type LightTrailPuzzle,
  lightTrail,
  lightTrailRevealMs,
  WRONG_ANSWER_LOCK_MS,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import { EYE_PATH, HAND_PATH } from "../_shared/icons";
import type { MinigameBridge } from "../types";
import { BULB_BASE_PATH, BULB_PATH, REWIND_PATH } from "./shapes";

/*
 * Theo dấu ánh đèn — đặc tả: docs/04-minigames/light-trail.md (mục "Ghi chú cho FE").
 * Bản mẫu: canvas Brain Rizz, trang Minigame, khu M2 (LightTrailMobile/Levels/States).
 * Scene không vẽ chữ: chỉ có biểu tượng, chấm và chữ số.
 */

// ---------------------------------------------------------------- bố cục (khung 720×1280)

/** Góc trên trái của lưới đèn (khung 600×600). */
const GRID_X = 60;
const GRID_Y = 340;

/** Kích thước theo cỡ lưới. Nét vẽ của bản mẫu cho lưới 3×3, lưới 4×4 thu theo tỉ lệ ô. */
interface GridLayout {
  /** Cạnh ô = vùng chạm. */
  cell: number;
  /** Cạnh ô + khe. */
  pitch: number;
  radius: number;
  /** Tỉ lệ nét vẽ so với ô 3×3 (176 px). */
  scale: number;
  /** Tia sáng của ô đang sáng: khoảng cách từ tâm (trục, chéo) và độ dày (viền, lõi), nằm gọn trong khe. */
  rays: { axis: [number, number]; diagonal: [number, number]; outer: number; inner: number };
  /** Viền vàng bên trong ô đã chạm. */
  ringInset: number;
  ringRadius: number;
  /** Huy hiệu thứ tự chạm ở góc trên trái ô. */
  badgeR: number;
  badgeOffset: number;
  badgeFont: number;
  /** Vòng số nét đứt của đáp án đúng (lúc khoá), đặt giữa ô. */
  answerR: number;
  answerFont: number;
  answerStroke: number;
  answerDash: [number, number];
  /** Dấu X của ô chạm sai: nửa cạnh, độ dày viền và lõi. */
  crossArm: number;
  crossOuter: number;
  crossInner: number;
}

const GRID_3: GridLayout = {
  cell: 176,
  pitch: 212,
  radius: 24,
  scale: 1,
  rays: { axis: [108, 116], diagonal: [96, 113], outer: 13, inner: 6 },
  ringInset: 8,
  ringRadius: 18,
  badgeR: 24,
  badgeOffset: 58,
  badgeFont: 30,
  answerR: 40,
  answerFont: 45,
  answerStroke: 5,
  answerDash: [11, 8],
  crossArm: 40,
  crossOuter: 22,
  crossInner: 12,
};

const GRID_4: GridLayout = {
  cell: 132,
  pitch: 156,
  radius: 20,
  scale: 0.75,
  rays: { axis: [79, 84], diagonal: [72, 83], outer: 9, inner: 4.5 },
  ringInset: 6,
  ringRadius: 15,
  badgeR: 20,
  badgeOffset: 41,
  badgeFont: 26,
  answerR: 30,
  answerFont: 34,
  answerStroke: 4,
  answerDash: [8, 6],
  crossArm: 30,
  crossOuter: 20,
  crossInner: 10,
};

/** Biểu tượng pha (mắt / ngón tay), tâm (360, 150). Huy hiệu tua ngược ở (500, 150). */
const STATUS_X = 360;
const STATUS_Y = 150;
const STATUS_R = 56;
const REWIND_X = 500;
const REWIND_R = 40;
/** Dải chấm tiến độ: Ø 28, cách nhau 20. */
const DOT_Y = 250;
const DOT_PITCH = 48;
/** Thanh khoá 420×14, tâm (360, 1040), chỉ hiện khi sai. */
const LOCK_BAR = { x: 150, y: 1033, w: 420, h: 14 };

// ---------------------------------------------------------------- nhịp hiệu ứng (đều ≤ 400 ms)

const FADE_IN_MS = 120;
const POP_MS = 150;
const LIGHT_ON_MS = 80;
const LIGHT_OFF_MS = 100;
const TAP_FLASH_MS = 150;
const RETAP_NUDGE_MS = 100;
/** Đúng cả câu: ô nảy rồi sang câu mới. Tính vào thời gian câu sau nên giữ ≤ 300 ms. */
const SOLVED_MS = 300;
const SHAKE_MS = 200;
const CROSS_IN_MS = 120;
const DIM_MS = 150;
/** Độ mờ của lưới trong lúc khoá sau câu sai. */
const DIM_ALPHA = 0.35;
/** Ô đang sáng vẽ to 110 %, bật đèn thì phóng từ cỡ ô thường lên. */
const LIT_SCALE = 1.1;

// ---------------------------------------------------------------- màu

/** Màu đọc từ token CSS lúc tạo scene (tự đổi theo sáng/tối). Chuỗi CSS để vẽ texture canvas. */
interface Palette {
  card: string;
  cardFg: string;
  sticker: string;
  primary: string;
  primaryFg: string;
  chalk: string;
  chalkMuted: string;
  destructive: string;
  /** Màu nhóm Ghi nhớ: viền khung lưới, mống mắt, huy hiệu tua ngược. */
  memorize: string;
  /** Giấy kem (màu thương hiệu, giống nhau ở hai giao diện): thân bóng đèn khi sáng. */
  paper: string;
  dark: boolean;
}

function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    card: token("--card"),
    cardFg: token("--card-foreground"),
    sticker: token("--sticker"),
    primary: token("--primary"),
    primaryFg: token("--primary-foreground"),
    chalk: token("--chalk"),
    chalkMuted: token("--chalk-muted"),
    destructive: token("--destructive"),
    memorize: token("--color-memorize"),
    paper: token("--color-paper"),
    dark: style.colorScheme === "dark",
  };
}

/** Màu CSS → số màu của Phaser. */
const toColor = (css: string) => Phaser.Display.Color.ValueToColor(css).color;

// ---------------------------------------------------------------- vẽ texture bằng canvas 2D

type Ctx = CanvasRenderingContext2D;

/** Hình vuông bo góc, tâm (0, 0). */
function squarePath(ctx: Ctx, side: number, r: number) {
  const h = side / 2;
  ctx.beginPath();
  ctx.moveTo(-h + r, -h);
  ctx.arcTo(h, -h, h, h, r);
  ctx.arcTo(h, h, -h, h, r);
  ctx.arcTo(-h, h, -h, -h, r);
  ctx.arcTo(-h, -h, h, -h, r);
  ctx.closePath();
}

function circlePath(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

/** Nét đứt chia đều quanh vòng tròn bán kính `r` để chỗ nối không lệch. */
function evenDash(r: number, [dash, gap]: [number, number]): [number, number] {
  const length = 2 * Math.PI * r;
  const k = length / Math.max(1, Math.round(length / (dash + gap))) / (dash + gap);
  return [dash * k, gap * k];
}

function drawBulb(ctx: Ctx, scale: number, stroke: string, fill?: string) {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.lineWidth = 6;
  ctx.strokeStyle = stroke;
  const body = new Path2D(BULB_PATH);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill(body);
  }
  ctx.stroke(body);
  ctx.stroke(new Path2D(BULB_BASE_PATH));
  ctx.restore();
}

/** Chữ số Baloo 2 đậm, căn giữa theo đường chân chữ như bản mẫu. */
function drawDigit(ctx: Ctx, n: number, size: number, color: string) {
  ctx.fillStyle = color;
  ctx.font = `800 ${size}px "Baloo 2", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(n), 0, Math.round(size * 0.36));
}

// Giảm chuyển động (`prefersReducedMotion` dùng chung, theo nút Hiệu ứng): bỏ phóng to, nảy, lắc; giữ đổi độ sáng, viền, huy hiệu, dấu X.

// ---------------------------------------------------------------- scene

type Phase = "show" | "input" | "done";
type DotState = "empty" | "filled" | "wrong";

interface CellView {
  x: number;
  y: number;
  /** Mọi lớp của ô, tâm ở giữa ô để phóng to/lắc quanh tâm. */
  box: Phaser.GameObjects.Container;
  lit: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Image;
  hover: Phaser.GameObjects.Image;
  zone: Phaser.GameObjects.Zone;
}

/** Theo dấu ánh đèn — xem đèn lần lượt sáng rồi chạm lại đúng thứ tự (Siêu khó: ngược lại). */
export default class LightTrailScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private colors!: Palette;
  private reducedMotion = false;

  private phase: Phase = "done";
  private puzzle?: LightTrailPuzzle;
  private layout: GridLayout = GRID_3;
  /** Các ô đã chạm hợp lệ của câu hiện tại, theo thứ tự chạm. */
  private taps: LightTrailAnswer = [];
  /** Ẩn tab lúc đang chiếu → quay lại thì chiếu lại từ đầu. */
  private replayOnVisible = false;
  /** Hẹn giờ của câu hiện tại (lịch trình chiếu, chuyển câu); huỷ hết khi sang câu mới. */
  private timers: Phaser.Time.TimerEvent[] = [];

  private root?: Phaser.GameObjects.Container;
  private grid?: Phaser.GameObjects.Container;
  private marks?: Phaser.GameObjects.Container;
  private cells: CellView[] = [];
  private status?: Phaser.GameObjects.Container;
  private eye?: Phaser.GameObjects.Image;
  private hand?: Phaser.GameObjects.Image;
  private rewind?: Phaser.GameObjects.Image;
  private dots?: Phaser.GameObjects.Graphics;
  private dotStates: DotState[] = [];
  private lockBar?: Phaser.GameObjects.Graphics;
  private lock = { width: 0 };

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.phase = "done";
    this.puzzle = undefined;
    this.taps = [];
    this.timers = [];
  }

  create() {
    const canvas = this.game.canvas;
    this.colors = readPalette(canvas.isConnected ? canvas : document.documentElement);
    this.reducedMotion = prefersReducedMotion();

    const onHidden = () => {
      if (this.phase === "show") this.replayOnVisible = true;
    };
    const onVisible = () => {
      if (this.replayOnVisible && this.phase === "show") this.startReveal();
      this.replayOnVisible = false;
    };
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.game.events.on(Phaser.Core.Events.VISIBLE, onVisible);
    const detach = () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden);
      this.game.events.off(Phaser.Core.Events.VISIBLE, onVisible);
      this.clearTimers();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      detach();
      this.tweens.killAll();
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, detach);

    this.showPuzzle();
  }

  // -------------------------------------------------------------- dựng câu đố

  private showPuzzle() {
    // Mọi hẹn giờ và tween đang chạy đều thuộc câu cũ: dừng trước khi huỷ.
    this.clearTimers();
    this.tweens.killAll();
    this.root?.destroy();

    const puzzle = lightTrail.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    const layout = puzzle.cols >= 4 ? GRID_4 : GRID_3;
    this.puzzle = puzzle;
    this.layout = layout;
    this.taps = [];
    this.phase = "show";
    this.replayOnVisible = false;
    this.lock.width = 0;

    const root = this.add.container(0, 0);
    const grid = this.add.container(0, 0, [this.drawFrame()]);
    this.cells = Array.from({ length: puzzle.cols * puzzle.rows }, (_, i) =>
      this.makeCell(i, puzzle.cols, grid),
    );
    const marks = this.add.container(0, 0);

    const eye = this.add.image(0, 0, this.eyeTexture());
    const hand = this.add.image(0, 0, this.handTexture()).setVisible(false);
    const status = this.add.container(STATUS_X, STATUS_Y, [
      this.add.image(0, 0, this.statusTexture()),
      eye,
      hand,
    ]);
    // Siêu khó: huy hiệu tua ngược hiện suốt câu.
    const rewind = puzzle.reverse
      ? this.add.image(REWIND_X, STATUS_Y, this.rewindTexture())
      : undefined;
    const dots = this.add.graphics();
    const lockBar = this.add.graphics();

    root.add([grid, marks, status, dots, lockBar]);
    if (rewind) root.add(rewind);
    for (const cell of this.cells) root.add(cell.zone);

    this.root = root;
    this.grid = grid;
    this.marks = marks;
    this.status = status;
    this.eye = eye;
    this.hand = hand;
    this.rewind = rewind;
    this.dots = dots;
    this.lockBar = lockBar;
    this.setDots(puzzle.sequence.map(() => "empty"));

    // Câu mới: lưới mờ dần vào, biểu tượng mắt nảy.
    root.setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: FADE_IN_MS });
    this.pop(status);

    // Bắt đầu đếm lịch trình chiếu sau khung hình đầu tiên để đèn đầu không bị giật.
    this.events.once(Phaser.Scenes.Events.POST_UPDATE, () => {
      if (this.puzzle === puzzle && this.phase === "show") this.startReveal();
    });
  }

  private drawFrame() {
    const c = this.colors;
    const g = this.add.graphics();
    g.fillStyle(toColor(c.sticker));
    g.fillRoundedRect(36, 324, 648, 648, 36);
    g.fillStyle(toColor(c.card));
    g.fillRoundedRect(36, 316, 648, 648, 36);
    g.lineStyle(5, toColor(c.sticker));
    g.strokeRoundedRect(36, 316, 648, 648, 36);
    g.lineStyle(8, toColor(c.memorize));
    g.strokeRoundedRect(47, 327, 626, 626, 27);
    return g;
  }

  private makeCell(i: number, cols: number, grid: Phaser.GameObjects.Container): CellView {
    const { cell, pitch } = this.layout;
    const x = GRID_X + (i % cols) * pitch + cell / 2;
    const y = GRID_Y + Math.floor(i / cols) * pitch + cell / 2;

    const ring = this.add.image(0, 0, this.ringTexture()).setVisible(false);
    const hover = this.add.image(0, 0, this.hoverTexture()).setVisible(false);
    const lit = this.add.image(0, 0, this.litTexture()).setAlpha(0);
    const box = this.add.container(x, y, [
      this.add.image(0, 0, this.offTexture()),
      ring,
      hover,
      lit,
    ]);
    grid.add(box);

    // Vùng chạm đúng bằng ô (132–176 px); khe và ngoài lưới không nhận chạm. Chỉ bật ở pha nhập.
    const zone = this.add.zone(x, y, cell, cell).setInteractive({ useHandCursor: true });
    zone.disableInteractive();
    zone.on("pointerdown", () => this.tap(i));
    zone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
      // Máy tính: rê chuột thấy viền mảnh trên ô chưa chạm.
      if (this.phase === "input" && !pointer.wasTouch && !this.taps.includes(i)) {
        hover.setVisible(true);
      }
    });
    zone.on("pointerout", () => hover.setVisible(false));

    return { x, y, box, lit, ring, hover, zone };
  }

  // -------------------------------------------------------------- trình chiếu

  /** Chiếu (hoặc chiếu lại) chuỗi đèn theo đúng lịch trong câu đố, rồi mở pha nhập. */
  private startReveal() {
    const puzzle = this.puzzle;
    if (!puzzle) return;
    this.clearTimers();
    this.phase = "show";
    for (const cell of this.cells) {
      this.tweens.killTweensOf(cell.lit);
      cell.lit.setAlpha(0).setScale(1);
    }
    this.setDots(puzzle.sequence.map(() => "empty"));

    // Đèn k bật lúc leadMs + k × stepMs, sáng trong litMs (gồm cả hiệu ứng bật và tắt).
    puzzle.sequence.forEach((cellIndex, k) => {
      const on = puzzle.leadMs + k * puzzle.stepMs;
      this.after(on, () => {
        this.lightOn(cellIndex);
        this.setDot(k, "filled");
      });
      this.after(on + puzzle.litMs - LIGHT_OFF_MS, () => this.lightOff(cellIndex));
    });
    // Cùng mốc với miễn trừ thời gian của server (speedAllowanceMs).
    this.after(lightTrailRevealMs(puzzle), () => this.beginInput());
  }

  private lightOn(cellIndex: number) {
    const lit = this.cells[cellIndex]?.lit;
    if (!lit) return;
    this.tweens.killTweensOf(lit);
    lit.setAlpha(0).setScale(this.reducedMotion ? 1 : 1 / LIT_SCALE);
    this.tweens.add({
      targets: lit,
      alpha: 1,
      scale: 1,
      duration: LIGHT_ON_MS,
      ease: "Quad.easeOut",
    });
  }

  private lightOff(cellIndex: number) {
    const lit = this.cells[cellIndex]?.lit;
    if (!lit) return;
    this.tweens.killTweensOf(lit);
    this.tweens.add({
      targets: lit,
      alpha: 0,
      scale: this.reducedMotion ? 1 : 1 / LIT_SCALE,
      duration: LIGHT_OFF_MS,
      ease: "Quad.easeIn",
    });
  }

  private beginInput() {
    const puzzle = this.puzzle;
    if (!puzzle || this.phase !== "show") return;
    this.phase = "input";
    // Mắt đổi thành ngón tay, chấm về rỗng; Siêu khó: tua ngược nảy một lần.
    this.eye?.setVisible(false);
    this.hand?.setVisible(true);
    if (this.status) this.pop(this.status);
    if (this.rewind) this.pop(this.rewind);
    this.setDots(puzzle.expected.map(() => "empty"));
    for (const cell of this.cells) cell.zone.setInteractive();
  }

  // -------------------------------------------------------------- nhập

  private tap(cellIndex: number) {
    const puzzle = this.puzzle;
    const cell = this.cells[cellIndex];
    if (this.phase !== "input" || !puzzle || !cell) return;

    // Chạm lại ô đã chạm: bỏ qua, không tính sai (chống chạm đúp do nảy ngón tay).
    if (this.taps.includes(cellIndex)) {
      this.shake([cell.box], 4, RETAP_NUDGE_MS, 1);
      return;
    }

    const step = this.taps.length;
    this.taps.push(cellIndex);
    // Chấm k luôn ứng với đèn k: xuôi lấp từ trái, Siêu khó lấp từ phải.
    const dot = puzzle.reverse ? puzzle.expected.length - 1 - step : step;

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    if (puzzle.expected[step] !== cellIndex) {
      this.miss(puzzle, cell, dot);
      return;
    }

    this.markTapped(cell, step + 1);
    this.setDot(dot, "filled");
    if (this.taps.length === puzzle.expected.length) this.solved();
  }

  /** Ô vừa chạm đúng sáng 150 ms rồi giữ viền vàng + huy hiệu số thứ tự chạm. */
  private markTapped(cell: CellView, order: number) {
    const { badgeOffset } = this.layout;
    cell.hover.setVisible(false);
    cell.ring.setVisible(true);
    cell.box.add(this.add.image(-badgeOffset, -badgeOffset, this.badgeTexture(order)));

    this.tweens.killTweensOf(cell.lit);
    cell.lit.setScale(1).setAlpha(1);
    this.tweens.add({ targets: cell.lit, alpha: 0, duration: TAP_FLASH_MS, ease: "Expo.easeIn" });
  }

  /** Gửi đáp án (một lần mỗi câu) và khoá nhập. Trả về chỉ số câu vừa gửi. */
  private submit(): number {
    this.phase = "done";
    for (const cell of this.cells) {
      cell.zone.disableInteractive(true);
      cell.hover.setVisible(false);
    }
    const index = this.index;
    const answer: LightTrailAnswer = [...this.taps];
    this.bridge.submit(index, answer);
    this.index += 1;
    return index;
  }

  private solved() {
    this.submit();
    if (!this.reducedMotion) {
      const boxes = this.taps.flatMap((i) => this.cells[i]?.box ?? []);
      this.tweens.add({
        targets: boxes,
        scale: 1.15,
        duration: SOLVED_MS / 2,
        yoyo: true,
        ease: "Quad.easeOut",
      });
    }
    this.after(SOLVED_MS, () => this.showPuzzle());
  }

  /**
   * Sai: gửi ngay mảng tính tới ô sai, ô sai hiện dấu X và lắc, lưới mờ 35 %, chấm của bước sai
   * hiện X. Suốt lúc khoá hiện đáp án đúng (CR-006): số k + 1 trong vòng nét đứt trên ô expected[k].
   * Mọi thứ nằm trong lưới (y ≥ 340), dưới dải trên cùng mà huy hiệu khoá của khung che.
   */
  private miss(puzzle: LightTrailPuzzle, cell: CellView, dot: number) {
    const index = this.submit();
    const marks = this.marks;
    if (!marks) return;

    this.setDot(dot, "wrong");
    if (this.grid) this.tweens.add({ targets: this.grid, alpha: DIM_ALPHA, duration: DIM_MS });

    // Dấu X và (nếu ô sai cũng thuộc đáp án) vòng số của ô đó đi chung một nhóm để lắc cùng ô.
    const cross = this.add.image(0, 0, this.crossTexture());
    const wrong = this.add.container(cell.x, cell.y, [cross]);
    marks.add(wrong);
    cross.setAlpha(0).setScale(this.reducedMotion ? 1 : 0.6);
    this.tweens.add({
      targets: cross,
      alpha: 1,
      scale: 1,
      duration: CROSS_IN_MS,
      ease: "Back.easeOut",
    });
    this.shake([cell.box, wrong], 8, SHAKE_MS, 2);

    puzzle.expected.forEach((target, k) => {
      const where = this.cells[target];
      if (!where) return;
      const ring = this.add.image(0, 0, this.answerTexture(k + 1));
      // Vẽ dấu X trước rồi vòng số đè lên, để thấy cả "chạm sai" lẫn "ô này là bước thứ mấy".
      if (where === cell) wrong.add(ring);
      else marks.add(ring.setPosition(where.x, where.y));
      if (!this.reducedMotion) {
        ring.setAlpha(0);
        this.tweens.add({ targets: ring, alpha: 1, duration: DIM_MS });
      }
    });

    // Thanh khoá chạy ngay theo thời gian khoá chuẩn, rồi chỉnh theo `lockedUntil` khi server trả lời.
    this.lock.width = LOCK_BAR.w;
    this.runLockBar(WRONG_ANSWER_LOCK_MS);
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive() || this.puzzle !== puzzle) return;
      this.runLockBar(ms);
      this.after(ms, () => this.showPuzzle());
    });
  }

  // -------------------------------------------------------------- dải chấm, thanh khoá

  private setDots(states: DotState[]) {
    this.dotStates = states;
    this.drawDots();
  }

  private setDot(k: number, state: DotState) {
    if (k < 0 || k >= this.dotStates.length) return;
    this.dotStates[k] = state;
    this.drawDots();
  }

  private drawDots() {
    const g = this.dots;
    if (!g) return;
    const c = this.colors;
    const ink = toColor(c.cardFg);
    g.clear();
    const count = this.dotStates.length;
    this.dotStates.forEach((state, k) => {
      const x = STATUS_X + (k - (count - 1) / 2) * DOT_PITCH;
      if (state === "filled") {
        g.fillStyle(ink);
        g.fillCircle(x, DOT_Y, 14);
        return;
      }
      const line = state === "wrong" ? toColor(c.destructive) : ink;
      g.fillStyle(toColor(c.card));
      g.fillCircle(x, DOT_Y, 12);
      g.lineStyle(4, line);
      g.strokeCircle(x, DOT_Y, 12);
      if (state === "wrong") {
        g.lineBetween(x - 7, DOT_Y - 7, x + 7, DOT_Y + 7);
        g.lineBetween(x + 7, DOT_Y - 7, x - 7, DOT_Y + 7);
      }
    });
  }

  /** Thanh khoá rút từ độ dài hiện tại về 0 trong `ms`. */
  private runLockBar(ms: number) {
    this.tweens.killTweensOf(this.lock);
    if (ms <= 0) {
      this.lock.width = 0;
      this.drawLockBar();
      return;
    }
    this.drawLockBar();
    this.tweens.add({
      targets: this.lock,
      width: 0,
      duration: ms,
      onUpdate: () => this.drawLockBar(),
    });
  }

  private drawLockBar() {
    const g = this.lockBar;
    if (!g) return;
    const c = this.colors;
    const { x, y, w, h } = LOCK_BAR;
    const r = h / 2;
    const fill = Math.max(0, this.lock.width);
    g.clear();
    g.fillStyle(toColor(c.card));
    g.fillRoundedRect(x, y, w, h, r);
    g.lineStyle(3, toColor(c.cardFg));
    g.strokeRoundedRect(x, y, w, h, r);
    if (fill > 0) {
      g.fillStyle(toColor(c.cardFg));
      g.fillRoundedRect(x, y, fill, h, Math.min(r, fill / 2));
    }
  }

  // -------------------------------------------------------------- hiệu ứng, hẹn giờ

  /** Nảy nhẹ (đổi pha, câu mới). Bỏ qua khi bật giảm chuyển động. */
  private pop(target: Phaser.GameObjects.Container | Phaser.GameObjects.Image) {
    if (this.reducedMotion) return;
    this.tweens.killTweensOf(target);
    target.setScale(1);
    this.tweens.add({
      targets: target,
      scale: 1.15,
      duration: POP_MS / 2,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  /** Lắc ngang ±`amplitude` px trong `ms`, `cycles` nhịp, rồi về chỗ cũ. */
  private shake(
    targets: Phaser.GameObjects.Container[],
    amplitude: number,
    ms: number,
    cycles: number,
  ) {
    if (this.reducedMotion) return;
    const items = targets.map((target) => ({ target, x: target.x }));
    const place = (offset: number) => {
      for (const { target, x } of items) target.setX(x + offset);
    };
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ms,
      onUpdate: (tween) =>
        place(amplitude * Math.sin((tween.getValue() ?? 0) * cycles * 2 * Math.PI)),
      onComplete: () => place(0),
    });
  }

  private after(ms: number, callback: () => void) {
    this.timers.push(this.time.delayedCall(ms, callback));
  }

  private clearTimers() {
    for (const timer of this.timers) timer.remove(false);
    this.timers = [];
  }

  // -------------------------------------------------------------- texture (vẽ một lần, theo cỡ lưới)

  /** Tạo texture từ canvas 2D (gốc toạ độ ở tâm) nếu chưa có; trả về khoá. */
  private texture(key: string, size: number, draw: (ctx: Ctx) => void): string {
    if (this.textures.exists(key)) return key;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(size);
    canvas.height = Math.ceil(size);
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

  /** Khoá texture theo cỡ ô để lưới 3×3 và 4×4 không lẫn nhau. */
  private key(name: string) {
    return `light-trail:${name}:${this.layout.cell}`;
  }

  /** Ô tắt: nền mực, viền 3 px (tối: phấn mờ để tách khỏi nền), bóng đèn phấn mờ. */
  private offTexture() {
    const { cell, radius, scale } = this.layout;
    const c = this.colors;
    return this.texture(this.key("off"), cell + 6, (ctx) => {
      squarePath(ctx, cell, radius);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = c.dark ? c.chalkMuted : c.sticker;
      ctx.stroke();
      ctx.globalAlpha = 0.3;
      drawBulb(ctx, scale, c.chalk);
    });
  }

  /** Ô sáng: nền vàng to 110 %, viền phấn trắng, 8 tia sáng trong khe, bóng đèn sáng. */
  private litTexture() {
    const { cell, radius, scale, rays } = this.layout;
    const c = this.colors;
    const reach = Math.max(rays.axis[1], rays.diagonal[1]) + rays.outer / 2;
    return this.texture(this.key("lit"), 2 * reach + 4, (ctx) => {
      const [a0, a1] = rays.axis;
      const [d0, d1] = rays.diagonal;
      const beams = new Path2D();
      for (const [sx, sy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        beams.moveTo(sx * a0, sy * a0);
        beams.lineTo(sx * a1, sy * a1);
      }
      for (const [sx, sy] of [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ] as const) {
        beams.moveTo(sx * d0, sy * d0);
        beams.lineTo(sx * d1, sy * d1);
      }
      ctx.lineWidth = rays.outer;
      ctx.strokeStyle = c.sticker;
      ctx.stroke(beams);
      ctx.lineWidth = rays.inner;
      ctx.strokeStyle = c.primary;
      ctx.stroke(beams);

      const side = cell * LIT_SCALE;
      squarePath(ctx, side, radius * LIT_SCALE);
      ctx.fillStyle = c.primary;
      ctx.fill();
      ctx.lineWidth = 5 * scale;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      squarePath(ctx, side - 19.6 * scale, 19 * scale);
      ctx.lineWidth = 6 * scale;
      ctx.strokeStyle = c.chalk;
      ctx.stroke();
      drawBulb(ctx, scale, c.primaryFg, c.paper);
    });
  }

  /** Ô đã chạm: viền vàng mảnh bên trong. */
  private ringTexture() {
    const { cell, ringInset, ringRadius } = this.layout;
    const c = this.colors;
    return this.texture(this.key("ring"), cell, (ctx) => {
      squarePath(ctx, cell - 2 * ringInset, ringRadius);
      ctx.lineWidth = 3;
      ctx.strokeStyle = c.primary;
      ctx.stroke();
    });
  }

  /** Rê chuột (máy tính): viền phấn nét đứt. */
  private hoverTexture() {
    const { cell, scale } = this.layout;
    const c = this.colors;
    return this.texture(this.key("hover"), cell, (ctx) => {
      squarePath(ctx, cell - 12 * scale, 19 * scale);
      ctx.setLineDash([10, 7]);
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = c.chalk;
      ctx.stroke();
    });
  }

  /** Huy hiệu thứ tự chạm ở góc trên trái ô: nền giấy, chữ số đậm. */
  private badgeTexture(order: number) {
    const { badgeR, badgeFont } = this.layout;
    const c = this.colors;
    return this.texture(this.key(`badge-${order}`), 2 * badgeR + 6, (ctx) => {
      circlePath(ctx, 0, 0, badgeR);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = c.cardFg;
      ctx.stroke();
      drawDigit(ctx, order, badgeFont, c.cardFg);
    });
  }

  /** Đáp án đúng lúc khoá: số trong vòng nét đứt, nền giấy để đọc được trên lưới mờ. */
  private answerTexture(order: number) {
    const { answerR, answerFont, answerStroke, answerDash } = this.layout;
    const c = this.colors;
    return this.texture(this.key(`answer-${order}`), 2 * (answerR + answerStroke), (ctx) => {
      circlePath(ctx, 0, 0, answerR);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.setLineDash(evenDash(answerR, answerDash));
      ctx.lineCap = "butt";
      ctx.lineWidth = answerStroke;
      ctx.strokeStyle = c.cardFg;
      ctx.stroke();
      ctx.setLineDash([]);
      drawDigit(ctx, order, answerFont, c.cardFg);
    });
  }

  /** Chạm sai: dấu X lớn màu báo lỗi, viền phấn trắng. */
  private crossTexture() {
    const { crossArm: a, crossOuter, crossInner } = this.layout;
    const c = this.colors;
    return this.texture(this.key("cross"), 2 * a + crossOuter + 4, (ctx) => {
      const cross = new Path2D(`M${-a} ${-a} L${a} ${a} M${a} ${-a} L${-a} ${a}`);
      ctx.lineWidth = crossOuter;
      ctx.strokeStyle = c.chalk;
      ctx.stroke(cross);
      ctx.lineWidth = crossInner;
      ctx.strokeStyle = c.destructive;
      ctx.stroke(cross);
    });
  }

  /** Nền tròn của biểu tượng pha: thẻ giấy viền mực, bóng đổ xuống dưới. */
  private statusTexture() {
    const c = this.colors;
    return this.texture("light-trail:status", 2 * (STATUS_R + 9), (ctx) => {
      circlePath(ctx, 0, 6, STATUS_R);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      circlePath(ctx, 0, 0, STATUS_R);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
    });
  }

  /** Pha trình chiếu: con mắt. */
  private eyeTexture() {
    const c = this.colors;
    return this.texture("light-trail:eye", 90, (ctx) => {
      const eye = new Path2D(EYE_PATH);
      ctx.fillStyle = c.card;
      ctx.fill(eye);
      ctx.lineWidth = 6;
      ctx.strokeStyle = c.cardFg;
      ctx.stroke(eye);
      circlePath(ctx, 0, 0, 14);
      ctx.fillStyle = c.memorize;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      circlePath(ctx, 0, 0, 6);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      circlePath(ctx, -4, -5, 3);
      ctx.fillStyle = c.chalk;
      ctx.fill();
    });
  }

  /** Pha nhập: ngón tay chỉ. */
  private handTexture() {
    const c = this.colors;
    return this.texture("light-trail:hand", 90, (ctx) => {
      ctx.scale(3.4, 3.4);
      ctx.translate(-12.3, -12);
      const hand = new Path2D(HAND_PATH);
      ctx.fillStyle = c.card;
      ctx.fill(hand);
      ctx.lineWidth = 1.9;
      ctx.strokeStyle = c.cardFg;
      ctx.stroke(hand);
    });
  }

  /** Siêu khó: huy hiệu tua ngược (màu nhóm Ghi nhớ, hai tam giác chỉ sang trái). */
  private rewindTexture() {
    const c = this.colors;
    return this.texture("light-trail:rewind", 2 * (REWIND_R + 9), (ctx) => {
      circlePath(ctx, 0, 6, REWIND_R);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      circlePath(ctx, 0, 0, REWIND_R);
      ctx.fillStyle = c.memorize;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      ctx.fillStyle = c.sticker;
      ctx.fill(new Path2D(REWIND_PATH));
    });
  }
}
