import {
  STACK_RECALL_KINDS,
  type StackRecallAnswer,
  type StackRecallKind,
  type StackRecallPuzzle,
  stackRecall,
  stackRecallOnTrack,
  stackRecallRevealMs,
  WRONG_ANSWER_LOCK_MS,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
// Biểu tượng pha (mắt, mắt nhắm, ngón tay), huy hiệu đổi chỗ và dấu tích: bộ hình dùng chung với
// Ai vừa biến mất để hai game Ghi nhớ có pha xem/che/chạm giống nhau.
import {
  CHECK_PATH,
  EYE_LASH_PATH,
  EYE_PATH,
  EYE_SHUT_PATH,
  HAND_PATH,
  SWAP_HEADS_PATH,
  SWAP_LINES_PATH,
} from "../_shared/icons";
import type { MinigameBridge } from "../types";
import {
  blockRadius,
  KIND_COLOR_VARS,
  patternMarks,
  SHAPE_HEIGHT_RATIO,
  SHAPE_PATHS,
} from "./blocks";

/*
 * Xếp lại tháp — đặc tả: docs/04-minigames/stack-recall.md (mục "Ghi chú cho FE").
 * Chưa có bản mẫu: bố cục, kích thước và nhịp hiệu ứng theo đúng bảng của đặc tả.
 * Scene không vẽ chữ: chỉ khối, biểu tượng, chấm tiến độ, thanh thời gian và số thứ tự tầng mờ.
 */

// ---------------------------------------------------------------- bố cục (khung 720×1280)

/** Huy hiệu trạng thái Ø 112 tâm (360, 140); Siêu khó thêm huy hiệu xáo khay Ø 80 tâm (500, 140). */
const STATUS = { x: 360, y: 140, r: 56 };
const SHUFFLE = { x: 500, r: 40 };
/** Dải chấm tiến độ: N chấm Ø 28 cách nhau 20, tâm y = 245. */
const DOTS = { y: 245, r: 14, pitch: 48 };
/** Thanh xem 420×14 tâm (360, 280); thanh khoá 420×14 tâm (360, 935). */
const VIEW_BAR = { x: 150, y: 273, w: 420, h: 14 };
const LOCK_BAR = { x: 150, y: 928, w: 420, h: 14 };

/** Cột tháp tâm x = 360, bệ có mép trên ở y = 900. */
const TOWER_X = 360;
const BASE_TOP = 900;
const BASE = { w: 440, h: 20, radius: 8, splitW: 300 };
/** Khối tháp 360×110, khe 8. */
const BLOCK = { w: 360, h: 110, gap: 8 };
/** Lúc khoá: hai cột so sánh, khối 260×88, khe 8. */
const COMPARE = { w: 260, h: 88, gap: 8, playerX: 200, answerX: 520 };
/** Dấu X của khối chạm sai đặt lệch phải để vẫn thấy hình của khối đã chạm. */
const CROSS_OFFSET_X = 82;
/** Khăn lau (rộng 440 như bệ) nằm ngoài mép trái / phải khung trước và sau khi quét. */
const CLOTH_OFF_LEFT = -(BASE.w / 2 + 8);
const CLOTH_OFF_RIGHT = 720 + BASE.w / 2 + 8;

/** Tâm tầng `i` (0 = đáy): tầng i chiếm y từ 900 − 118(i + 1) + 8 tới 900 − 118i. */
const layerY = (i: number) => BASE_TOP - (BLOCK.h + BLOCK.gap) * i - BLOCK.h / 2;
/** Tâm tầng `i` ở cột so sánh (tầng 5 bắt đầu từ y = 428). */
const compareY = (i: number) => BASE_TOP - (COMPARE.h + COMPARE.gap) * i - COMPARE.h / 2;

/** Bố cục khay theo số loại (đặc tả: y 964–1212). */
interface TrayLayout {
  cols: number;
  /** Cỡ ô = vùng chạm. */
  w: number;
  h: number;
  gap: number;
  /** Mép trái hàng đầy. */
  left: number;
  /** Tâm từng hàng. */
  rowsY: number[];
}

const TRAYS: Record<number, TrayLayout> = {
  4: { cols: 4, w: 150, h: 150, gap: 24, left: 24, rowsY: [1088] },
  5: { cols: 5, w: 128, h: 128, gap: 12, left: 16, rowsY: [1088] },
  6: { cols: 3, w: 200, h: 116, gap: 16, left: 44, rowsY: [1022, 1154] },
  8: { cols: 4, w: 156, h: 116, gap: 16, left: 24, rowsY: [1022, 1154] },
};

/** Khay chưa có trong đặc tả (đổi tham số sau chơi thử): ≤ 5 ô một hàng, còn lại hai hàng. */
function trayLayout(count: number): TrayLayout {
  const known = TRAYS[count];
  if (known) return known;
  const rows = count <= 5 ? 1 : 2;
  const cols = Math.ceil(count / rows);
  const gap = 16;
  const w = Math.floor((672 - (cols - 1) * gap) / cols);
  const h = rows === 1 ? Math.min(w, 150) : 116;
  const left = (720 - (cols * w + (cols - 1) * gap)) / 2;
  return { cols, w, h, gap, left, rowsY: rows === 1 ? [1088] : [1022, 1154] };
}

/** Khối trong ô khay lùi vào 12 px mỗi bên. */
const TRAY_INSET = 12;
const TRAY_RADIUS = 20;
const HOVER_LIFT = 6;

// ---------------------------------------------------------------- nhịp hiệu ứng (đều ≤ 400 ms)

const FADE_IN_MS = 120;
const POP_MS = 150;
/** Khăn lau quét 250 ms, kéo đi 150 ms: vừa khít 400 ms che. */
const WIPE_IN_MS = 250;
const WIPE_OUT_MS = 150;
const FLY_MS = 150;
const RETAP_NUDGE_MS = 100;
/** Đúng cả câu: tháp nảy rồi sang câu mới. Tính vào thời gian câu sau nên giữ ≤ 300 ms. */
const SOLVED_MS = 300;
const SOLVED_SCALE = 1.15;
const SHAKE_MS = 200;
const SPLIT_MS = 200;
const CROSS_IN_MS = 120;
const DIM_MS = 150;
const HOVER_MS = 80;
/** Độ mờ của khối người chơi đã xếp và của khay trong lúc khoá sau câu sai. */
const DIM_ALPHA = 0.35;

// ---------------------------------------------------------------- màu

/** Màu đọc từ token CSS lúc tạo scene (tự đổi theo sáng/tối). Chuỗi CSS để vẽ texture canvas. */
interface Palette {
  card: string;
  cardFg: string;
  sticker: string;
  primary: string;
  primaryFg: string;
  chalk: string;
  destructive: string;
  /** Màu nhóm Ghi nhớ: thanh xem, khăn lau, huy hiệu xáo khay. */
  memorize: string;
  /** Vệt sáng trên khăn lau. */
  pink: string;
  /** Giấy kem (giống nhau ở hai giao diện): hình giữa khối. */
  paper: string;
  /** Bệ tháp. */
  wood: string;
  /** Màu gợi ý của 8 loại khối (giữ nguyên ở hai giao diện). */
  kinds: string[];
  /** Nền ô tầng, ô khay: sáng là giấy, tối là mực (đặc tả). */
  surface: string;
  /** Viền ô khay, bệ: sáng là mực, tối là phấn. */
  line: string;
  /** Nét đứt (ô tầng trống, khung khay lúc xem, viền tháp đúng): sáng là mực, tối là phấn. */
  dash: string;
  dark: boolean;
}

function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const dark = style.colorScheme === "dark";
  const card = token("--card");
  const cardFg = token("--card-foreground");
  const sticker = token("--sticker");
  const chalk = token("--chalk");
  return {
    card,
    cardFg,
    sticker,
    primary: token("--primary"),
    primaryFg: token("--primary-foreground"),
    chalk,
    destructive: token("--destructive"),
    memorize: token("--color-memorize"),
    pink: token("--color-pink") || chalk,
    paper: token("--color-paper") || card,
    wood: token("--color-wood") || sticker,
    kinds: KIND_COLOR_VARS.map((name) => token(name) || card),
    surface: dark ? sticker : card,
    line: dark ? chalk : sticker,
    dash: dark ? chalk : cardFg,
    dark,
  };
}

/** Màu CSS → số màu của Phaser. */
const toColor = (css: string) => Phaser.Display.Color.ValueToColor(css).color;

// ---------------------------------------------------------------- vẽ texture bằng canvas 2D

type Ctx = CanvasRenderingContext2D;

/** Chữ nhật bo góc, tâm (0, 0). */
function rectPath(ctx: Ctx, w: number, h: number, r: number) {
  const x = w / 2;
  const y = h / 2;
  ctx.beginPath();
  ctx.moveTo(-x + r, -y);
  ctx.arcTo(x, -y, x, y, r);
  ctx.arcTo(x, y, -x, y, r);
  ctx.arcTo(-x, y, -x, -y, r);
  ctx.arcTo(-x, -y, x, -y, r);
  ctx.closePath();
}

function circlePath(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

/**
 * Một khối: tấm bo góc màu gợi ý, phủ hoa văn nét phấn trắng, viền mực 4 px; giữa khối là hình của
 * loại tô giấy kem, viền mực dày. Hình + hoa văn đủ để phân biệt khi xem đen trắng.
 */
function paintBlock(ctx: Ctx, kind: StackRecallKind, w: number, h: number, c: Palette) {
  const art = STACK_RECALL_KINDS[kind] ?? STACK_RECALL_KINDS[0];
  const r = blockRadius(h);

  rectPath(ctx, w, h, r);
  ctx.fillStyle = c.kinds[kind] ?? c.card;
  ctx.fill();

  ctx.save();
  rectPath(ctx, w, h, r);
  ctx.clip();
  const marks = patternMarks(art.pattern, w, h);
  if (marks.lines) {
    const lines = new Path2D(marks.lines);
    // Bóng mực mờ dưới nét phấn để hoa văn vẫn rõ trên nền vàng, hồng nhạt.
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = marks.width + 3;
    ctx.strokeStyle = c.sticker;
    ctx.stroke(lines);
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = marks.width;
    ctx.strokeStyle = c.chalk;
    ctx.stroke(lines);
  }
  if (marks.fills) {
    const fills = new Path2D(marks.fills);
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 3;
    ctx.strokeStyle = c.sticker;
    ctx.stroke(fills);
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = c.chalk;
    ctx.fill(fills);
  }
  ctx.restore();

  rectPath(ctx, w, h, r);
  ctx.lineWidth = 4;
  ctx.strokeStyle = c.sticker;
  ctx.stroke();

  const scale = (h * SHAPE_HEIGHT_RATIO) / 100;
  const shape = new Path2D(SHAPE_PATHS[art.shape]);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = c.paper;
  ctx.fill(shape);
  ctx.lineWidth = Math.max(3, (5 * h) / BLOCK.h) / scale;
  ctx.strokeStyle = c.sticker;
  ctx.stroke(shape);
  ctx.restore();
}

/** Bỏ khỏi `layers` các loại đã chạm (đếm theo số lần), giữ thứ tự tầng của phần còn lại. */
function remainingLayers(
  layers: readonly StackRecallKind[],
  taps: readonly StackRecallKind[],
): StackRecallKind[] {
  const left = [...layers];
  for (const kind of taps) {
    const at = left.indexOf(kind);
    if (at >= 0) left.splice(at, 1);
  }
  return left;
}

// Giảm chuyển động (`prefersReducedMotion` dùng chung, theo nút Hiệu ứng): khăn lau mờ dần thay vì
// quét; bỏ bay, nảy, lắc, trượt tách cột, nhấc ô khay. Lịch xem/che giữ nguyên vì là luật chơi.

// ---------------------------------------------------------------- scene

type Phase = "view" | "cover" | "input" | "done";
type StatusIcon = "eye" | "shut" | "hand";
type DotState = "empty" | "filled" | "wrong";

interface TrayCell {
  /** Tâm ô. */
  x: number;
  y: number;
  kind: StackRecallKind;
  /** Nền ô + khối thu nhỏ; nhấc lên khi rê chuột, lắc khi chạm trùng. */
  box: Phaser.GameObjects.Container;
  /** Khung nét đứt rỗng trong lúc xem và che. */
  frame: Phaser.GameObjects.Image;
  zone: Phaser.GameObjects.Zone;
}

/** Xếp lại tháp — nhớ tháp khối, khăn lau che, chạm khối ở khay để xếp lại từ dưới lên. */
export default class StackRecallScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private colors!: Palette;
  private reducedMotion = false;

  private phase: Phase = "done";
  private puzzle?: StackRecallPuzzle;
  private tray: TrayLayout = trayLayout(4);
  /** Các loại đã chạm hợp lệ của câu hiện tại, theo thứ tự chạm (lần đầu là tầng đáy). */
  private taps: StackRecallAnswer = [];
  /** Ẩn tab lúc đang xem hoặc che → quay lại thì chiếu lại câu từ đầu. */
  private replayOnVisible = false;
  /** Hẹn giờ của câu hiện tại (lịch xem/che, chuyển câu); huỷ hết khi sang câu mới. */
  private timers: Phaser.Time.TimerEvent[] = [];

  private root?: Phaser.GameObjects.Container;
  private base?: Phaser.GameObjects.Graphics;
  private slots?: Phaser.GameObjects.Container;
  private viewTower?: Phaser.GameObjects.Container;
  private cloth?: Phaser.GameObjects.Image;
  private status?: Phaser.GameObjects.Container;
  private icons: Partial<Record<StatusIcon, Phaser.GameObjects.Image>> = {};
  private dots?: Phaser.GameObjects.Graphics;
  private dotStates: DotState[] = [];
  private viewBar?: Phaser.GameObjects.Graphics;
  private view = { width: 0 };
  private lockBar?: Phaser.GameObjects.Graphics;
  private lock = { width: 0 };
  private cells: TrayCell[] = [];
  /** Tháp đang dựng, gốc ở giữa mép trên bệ để cả tháp nảy lên từ bệ. */
  private built?: Phaser.GameObjects.Container;
  private builtBlocks: Phaser.GameObjects.Image[] = [];
  /** Lớp hiện đáp án đúng lúc khoá (cột tháp đúng, vòng vàng trên khay). */
  private marks?: Phaser.GameObjects.Container;

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

    const watching = () => this.phase === "view" || this.phase === "cover";
    const onHidden = () => {
      if (watching()) this.replayOnVisible = true;
    };
    const onVisible = () => {
      if (this.replayOnVisible && watching()) this.startReveal();
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

    const puzzle = stackRecall.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    this.puzzle = puzzle;
    this.tray = trayLayout(puzzle.tray.length);
    this.taps = [];
    this.builtBlocks = [];
    this.phase = "view";
    this.replayOnVisible = false;
    this.lock.width = 0;
    const height = puzzle.layers.length;

    const root = this.add.container(0, 0);
    const base = this.add.graphics();
    this.drawBase(base, false);

    // Ô tầng trống (pha nhập): Thường trở lên có số thứ tự mờ, 1 ở đáy; Mầm không có số.
    const slots = this.add.container(
      0,
      0,
      puzzle.layers.map((_, i) =>
        this.add.image(TOWER_X, layerY(i), this.slotTexture(puzzle.ordered ? i + 1 : 0)),
      ),
    );
    const viewTower = this.add.container(
      0,
      0,
      puzzle.layers.map((kind, i) =>
        this.add.image(TOWER_X, layerY(i), this.blockTexture(kind, BLOCK.w, BLOCK.h)),
      ),
    );
    const cloth = this.add
      .image(TOWER_X, BASE_TOP - 59 * height, this.clothTexture(height))
      .setVisible(false);

    const icons: Record<StatusIcon, Phaser.GameObjects.Image> = {
      eye: this.add.image(0, 0, this.eyeTexture()),
      shut: this.add.image(0, 0, this.eyeShutTexture()),
      hand: this.add.image(0, 0, this.handTexture()),
    };
    const status = this.add.container(STATUS.x, STATUS.y, [
      this.add.image(0, 0, this.badgeTexture()),
      icons.eye,
      icons.shut,
      icons.hand,
    ]);
    // Siêu khó: huy hiệu xáo khay hiện suốt câu.
    const shuffle = puzzle.trayShuffled
      ? this.add.image(SHUFFLE.x, STATUS.y, this.shuffleTexture())
      : undefined;
    const dots = this.add.graphics();
    const viewBar = this.add.graphics();
    const lockBar = this.add.graphics();

    this.cells = puzzle.tray.map((kind, slot) => this.makeCell(slot, kind, puzzle.tray.length));
    // Khối đang bay từ khay lên tháp vẽ trên khay, nên tháp đang dựng nằm sau khay.
    const built = this.add.container(TOWER_X, BASE_TOP);
    const marks = this.add.container(0, 0);

    root.add([base, slots, viewTower, cloth, status, dots, viewBar, lockBar]);
    if (shuffle) root.add(shuffle);
    for (const cell of this.cells) root.add(cell.frame);
    for (const cell of this.cells) root.add(cell.box);
    root.add([built, marks]);
    for (const cell of this.cells) root.add(cell.zone);

    this.root = root;
    this.base = base;
    this.slots = slots;
    this.viewTower = viewTower;
    this.cloth = cloth;
    this.status = status;
    this.icons = icons;
    this.dots = dots;
    this.viewBar = viewBar;
    this.lockBar = lockBar;
    this.built = built;
    this.marks = marks;
    this.prepareView(puzzle);
    this.drawLockBar();

    // Câu mới: tháp mờ dần vào, huy hiệu nảy.
    root.setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: FADE_IN_MS });
    this.pop(status);

    // Lịch chạy bằng đồng hồ của scene, bắt đầu sau khung hình đầu tiên để tháp không bị giật.
    this.events.once(Phaser.Scenes.Events.POST_UPDATE, () => {
      if (this.puzzle === puzzle && this.phase === "view") this.startReveal();
    });
  }

  private makeCell(slot: number, kind: StackRecallKind, count: number): TrayCell {
    const { cols, w, h, gap, left, rowsY } = this.tray;
    const row = Math.floor(slot / cols);
    const col = slot % cols;
    // Hàng cuối thiếu ô (khay lẻ, chỉ có khi đổi tham số) thì căn giữa hàng đó.
    const inRow = Math.min(cols, count - row * cols);
    const x = left + ((cols - inRow) * (w + gap)) / 2 + col * (w + gap) + w / 2;
    const y = rowsY[row] ?? rowsY[0] ?? 1088;

    const frame = this.add.image(x, y, this.trayFrameTexture());
    const box = this.add.container(x, y, [
      this.add.image(0, 0, this.trayCardTexture()),
      this.add.image(0, 0, this.blockTexture(kind, w - 2 * TRAY_INSET, h - 2 * TRAY_INSET)),
    ]);

    // Vùng chạm = cả ô khay (116–150 px); tháp, khe và ngoài khay không nhận chạm. Chỉ bật ở pha nhập.
    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.disableInteractive();
    zone.on("pointerdown", () => this.tap(slot));
    zone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
      // Máy tính: rê chuột ô khay nhấc lên 6 px.
      if (this.phase === "input" && !pointer.wasTouch) this.lift(box, y - HOVER_LIFT);
    });
    zone.on("pointerout", () => {
      if (this.phase === "input") this.lift(box, y);
    });

    return { x, y, kind, box, frame, zone };
  }

  /** Bệ gỗ dưới tháp; lúc so sánh tách thành hai bệ dưới hai cột. */
  private drawBase(g: Phaser.GameObjects.Graphics, split: boolean) {
    const c = this.colors;
    const spans = split
      ? [
          [COMPARE.playerX, BASE.splitW],
          [COMPARE.answerX, BASE.splitW],
        ]
      : [[TOWER_X, BASE.w]];
    g.clear();
    for (const [cx = TOWER_X, w = BASE.w] of spans) {
      g.fillStyle(toColor(c.wood));
      g.fillRoundedRect(cx - w / 2, BASE_TOP, w, BASE.h, BASE.radius);
      g.lineStyle(4, toColor(c.line));
      g.strokeRoundedRect(cx - w / 2, BASE_TOP, w, BASE.h, BASE.radius);
    }
  }

  // -------------------------------------------------------------- lịch xem → che → nhập

  /** Đưa câu về pha xem: tháp đủ tầng, mắt, thanh xem đầy, khay là khung nét đứt. */
  private prepareView(puzzle: StackRecallPuzzle) {
    this.phase = "view";
    this.viewTower?.setVisible(true).setAlpha(1);
    this.slots?.setVisible(false);
    if (this.cloth) {
      this.tweens.killTweensOf(this.cloth);
      this.cloth.setVisible(false).setAlpha(1).setX(TOWER_X);
    }
    this.setStatus("eye");
    for (const cell of this.cells) {
      cell.zone.disableInteractive(true);
      cell.frame.setVisible(true);
      this.tweens.killTweensOf(cell.box);
      cell.box.setVisible(false).setAlpha(1).setY(cell.y);
    }
    this.setDots(puzzle.layers.map(() => "empty"));
    this.tweens.killTweensOf(this.view);
    this.view.width = VIEW_BAR.w;
    this.viewBar?.setVisible(true);
    this.drawViewBar();
  }

  /** Chiếu (hoặc chiếu lại) câu từ pha xem theo đúng lịch trong câu đố, rồi mở pha nhập. */
  private startReveal() {
    const puzzle = this.puzzle;
    if (!puzzle) return;
    this.clearTimers();
    this.prepareView(puzzle);

    // Thanh xem rút dần trong thời gian xem.
    this.tweens.add({
      targets: this.view,
      width: 0,
      duration: puzzle.showMs,
      onUpdate: () => this.drawViewBar(),
    });

    // Cùng mốc với miễn trừ thời gian của server (speedAllowanceMs bắt đầu từ xem + che).
    const reveal = stackRecallRevealMs(puzzle);
    const wipeIn = Math.min(WIPE_IN_MS, puzzle.coverMs);
    const wipeOut = Math.min(WIPE_OUT_MS, puzzle.coverMs - wipeIn);
    this.after(puzzle.showMs, () => this.wipeIn(wipeIn));
    // Khăn lau phủ kín thì tháp biến mất, dưới khăn chỉ còn các ô tầng nét đứt.
    this.after(puzzle.showMs + wipeIn, () => {
      this.viewTower?.setVisible(false);
      this.slots?.setVisible(true);
    });
    this.after(reveal - wipeOut, () => this.wipeOut(wipeOut));
    this.after(reveal, () => this.beginInput());
  }

  /**
   * Khăn lau quét ngang từ mép trái khung sang, mép phải khăn che dần tháp từ trái qua phải, tới
   * khi phủ kín tháp; mắt nhắm.
   */
  private wipeIn(ms: number) {
    const cloth = this.cloth;
    if (!cloth) return;
    this.phase = "cover";
    this.setStatus("shut");
    this.tweens.killTweensOf(this.view);
    this.view.width = 0;
    this.drawViewBar();

    this.tweens.killTweensOf(cloth);
    cloth.setVisible(true).setX(TOWER_X);
    if (this.reducedMotion || ms <= 0) {
      // Giảm chuyển động: khăn lau hiện mờ dần thay vì quét.
      cloth.setAlpha(ms <= 0 ? 1 : 0);
      if (ms > 0) this.tweens.add({ targets: cloth, alpha: 1, duration: ms });
      return;
    }
    cloth.setAlpha(1).setX(CLOTH_OFF_LEFT);
    this.tweens.add({ targets: cloth, x: TOWER_X, duration: ms, ease: "Quad.easeOut" });
  }

  /** Khăn lau kéo đi tiếp sang phải, ra khỏi khung đúng lúc người chơi được chạm. */
  private wipeOut(ms: number) {
    const cloth = this.cloth;
    if (!cloth) return;
    this.tweens.killTweensOf(cloth);
    if (ms <= 0) {
      cloth.setVisible(false);
      return;
    }
    const to = this.reducedMotion ? { alpha: 0 } : { x: CLOTH_OFF_RIGHT };
    this.tweens.add({ targets: cloth, ...to, duration: ms, ease: "Quad.easeIn" });
  }

  private beginInput() {
    const puzzle = this.puzzle;
    if (!puzzle || (this.phase !== "view" && this.phase !== "cover")) return;
    this.phase = "input";
    this.cloth?.setVisible(false);
    this.viewTower?.setVisible(false);
    this.slots?.setVisible(true);
    this.setStatus("hand");
    if (this.status) this.pop(this.status);
    this.viewBar?.setVisible(false);

    // Khối khay hiện thay cho khung nét đứt (Siêu khó: đã ở chỗ mới, không bay qua lại).
    for (const cell of this.cells) {
      cell.frame.setVisible(false);
      cell.box.setVisible(true);
      cell.zone.setInteractive();
      if (!this.reducedMotion) {
        cell.box.setAlpha(0);
        this.tweens.add({ targets: cell.box, alpha: 1, duration: FADE_IN_MS });
      }
    }
  }

  // -------------------------------------------------------------- nhập

  private tap(slot: number) {
    const puzzle = this.puzzle;
    const cell = this.cells[slot];
    if (this.phase !== "input" || !puzzle || !cell) return;

    // Chạm trùng loại với lần chạm ngay trước: bỏ qua, không tính sai (chống chạm đúp). Đáp án đúng
    // không bao giờ có hai lần chạm liền nhau cùng loại.
    if (this.taps[this.taps.length - 1] === cell.kind) {
      this.shake([cell.box], 4, RETAP_NUDGE_MS, 1);
      return;
    }

    this.taps.push(cell.kind);
    const step = this.taps.length - 1;

    // Chấm ngay ở client (đúng cả luật Mầm); server chấm lại để tính điểm thật.
    if (!stackRecallOnTrack(puzzle, this.taps)) {
      this.miss(puzzle, step);
      return;
    }

    this.setDot(step, "filled");
    const done = this.taps.length === puzzle.layers.length;
    this.placeBlock(step, cell, !done);
    if (done) this.solved();
  }

  /** Khối vừa chạm đúng bay từ ô khay lên ô tầng trống thấp nhất (150 ms). */
  private placeBlock(step: number, cell: TrayCell, fly: boolean) {
    const built = this.built;
    if (!built) return;
    const y = layerY(step) - BASE_TOP;
    const image = this.add.image(0, y, this.blockTexture(cell.kind, BLOCK.w, BLOCK.h));
    built.add(image);
    this.builtBlocks.push(image);
    if (!fly || this.reducedMotion) return;
    image
      .setPosition(cell.x - TOWER_X, cell.box.y - BASE_TOP)
      .setScale((this.tray.w - 2 * TRAY_INSET) / BLOCK.w);
    this.tweens.add({
      targets: image,
      x: 0,
      y,
      scale: 1,
      duration: FLY_MS,
      ease: "Quad.easeOut",
    });
  }

  /** Gửi đáp án (một lần mỗi câu) và khoá chạm. Trả về chỉ số câu vừa gửi. */
  private submit(): number {
    this.phase = "done";
    for (const cell of this.cells) {
      cell.zone.disableInteractive(true);
      this.tweens.killTweensOf(cell.box);
      cell.box.setY(cell.y).setAlpha(1);
    }
    const index = this.index;
    const answer: StackRecallAnswer = [...this.taps];
    this.bridge.submit(index, answer);
    this.index += 1;
    return index;
  }

  /** Đúng cả câu: cả tháp nảy 115 % rồi về (300 ms), sang câu mới. */
  private solved() {
    this.submit();
    // Tháp đã đủ tầng: ẩn ô nét đứt phía sau để lúc nảy không lộ viền ô qua khe.
    this.slots?.setVisible(false);
    if (this.built && !this.reducedMotion) {
      this.tweens.add({
        targets: this.built,
        scale: SOLVED_SCALE,
        duration: SOLVED_MS / 2,
        yoyo: true,
        ease: "Quad.easeOut",
      });
    }
    this.after(SOLVED_MS, () => this.showPuzzle());
  }

  /**
   * Sai (CR-006): gửi ngay mảng tính tới khối sai, rồi suốt lúc khoá hiện đáp án đúng. Vùng tháp
   * tách hai cột: trái là tháp người chơi xếp (khối đúng mờ, khối sai có dấu X và rung), phải là
   * tháp đúng có viền nét đứt, dấu tích ở tầng đã xếp đúng, mũi tên vàng ở tầng chạm sai. Khay mờ,
   * trừ ô của khối lẽ ra phải chạm có vòng vàng. Mọi thứ nằm dưới y 290, ngoài dải trên cùng mà
   * huy hiệu khoá của khung che.
   */
  private miss(puzzle: StackRecallPuzzle, step: number) {
    const index = this.submit();
    const built = this.built;
    const marks = this.marks;
    if (!built || !marks) return;

    this.setDot(step, "wrong");
    const okTaps = this.taps.slice(0, step);
    const wrongKind = this.taps[step] ?? 0;
    // Tháp đúng ghép từ các khối đã xếp đúng + phần còn lại. Có thứ tự thì đúng bằng `layers`; Mầm
    // (thứ tự tuỳ ý) thì là một cách xếp được nhận, nên so được từng tầng với tháp người chơi.
    const remaining = remainingLayers(puzzle.layers, okTaps);
    const answer = [...okTaps, ...remaining];
    const targets = new Set(puzzle.ordered ? remaining.slice(0, 1) : remaining);

    this.slots?.setVisible(false);
    if (this.base) this.drawBase(this.base, true);

    // Cột trái: tháp người chơi xếp, khối đúng mờ còn 35 %.
    this.tweens.killTweensOf(this.builtBlocks);
    this.builtBlocks.forEach((image, i) => {
      image.setTexture(this.blockTexture(okTaps[i] ?? 0, COMPARE.w, COMPARE.h)).setScale(1);
      this.slide(image, COMPARE.playerX - TOWER_X, compareY(i) - BASE_TOP);
      this.fadeTo(image, DIM_ALPHA);
    });

    // Khối chạm sai không mờ: dấu X hai nét và rung ngang.
    const cross = this.add.image(CROSS_OFFSET_X, 0, this.crossTexture());
    const wrong = this.add.container(COMPARE.playerX - TOWER_X, compareY(step) - BASE_TOP, [
      this.add.image(0, 0, this.blockTexture(wrongKind, COMPARE.w, COMPARE.h)),
      cross,
    ]);
    built.add(wrong);
    if (!this.reducedMotion) {
      cross.setAlpha(0).setScale(0.6);
      this.tweens.add({
        targets: cross,
        alpha: 1,
        scale: 1,
        duration: CROSS_IN_MS,
        ease: "Back.easeOut",
      });
    }
    this.shake([wrong], 8, SHAKE_MS, 2);

    // Cột phải: tháp đúng đủ tầng, viền nét đứt quanh cả tháp.
    const column = this.add.container(0, 0);
    const top = compareY(answer.length - 1) - COMPARE.h / 2;
    column.add(
      this.add.image(COMPARE.answerX, (top + BASE_TOP) / 2, this.outlineTexture(answer.length)),
    );
    answer.forEach((kind, i) => {
      column.add(
        this.add.image(COMPARE.answerX, compareY(i), this.blockTexture(kind, COMPARE.w, COMPARE.h)),
      );
    });
    // Dấu tích ở mép phải các tầng đã xếp đúng (giữa tầng, để không lẫn sang tầng kề bên).
    for (let i = 0; i < step; i++) {
      column.add(
        this.add.image(COMPARE.answerX + COMPARE.w / 2 - 4, compareY(i), this.checkTexture()),
      );
    }
    marks.add(column);
    // Mũi tên phấn vàng nối khối X sang khối đúng cùng tầng (nằm trong khe giữa hai cột).
    const arrowX = (COMPARE.playerX + COMPARE.answerX) / 2;
    const arrow = this.add.image(arrowX, compareY(step), this.arrowTexture());
    marks.add(arrow);
    if (!this.reducedMotion) {
      column.setAlpha(0).setX(TOWER_X - COMPARE.answerX);
      this.tweens.add({
        targets: column,
        alpha: 1,
        x: 0,
        duration: SPLIT_MS,
        ease: "Quad.easeOut",
      });
      arrow.setAlpha(0);
      this.tweens.add({ targets: arrow, alpha: 1, delay: SPLIT_MS / 2, duration: DIM_MS });
    }

    // Khay mờ còn 35 %, trừ ô của khối lẽ ra phải chạm (Mầm: mọi loại còn thiếu) có vòng vàng.
    for (const cell of this.cells) {
      if (targets.has(cell.kind)) {
        marks.add(this.add.image(cell.x, cell.y, this.ringTexture()));
      } else {
        this.fadeTo(cell.box, DIM_ALPHA);
      }
    }

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

  // -------------------------------------------------------------- huy hiệu, chấm, thanh

  private setStatus(icon: StatusIcon) {
    for (const [name, image] of Object.entries(this.icons)) image?.setVisible(name === icon);
  }

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
    const { y, r, pitch } = DOTS;
    g.clear();
    const count = this.dotStates.length;
    this.dotStates.forEach((state, k) => {
      const x = STATUS.x + (k - (count - 1) / 2) * pitch;
      if (state === "filled") {
        g.fillStyle(ink);
        g.fillCircle(x, y, r);
        return;
      }
      const line = state === "wrong" ? toColor(c.destructive) : ink;
      g.fillStyle(toColor(c.card));
      g.fillCircle(x, y, r - 2);
      g.lineStyle(4, line);
      g.strokeCircle(x, y, r - 2);
      if (state === "wrong") {
        g.lineBetween(x - 7, y - 7, x + 7, y + 7);
        g.lineBetween(x + 7, y - 7, x - 7, y + 7);
      }
    });
  }

  /** Thanh xem: màu nhóm Ghi nhớ, rút dần trong `showMs`. */
  private drawViewBar() {
    const g = this.viewBar;
    if (!g) return;
    const c = this.colors;
    const { x, y, w, h } = VIEW_BAR;
    const r = h / 2;
    const fill = Math.max(0, this.view.width);
    g.clear();
    g.fillStyle(toColor(c.card));
    g.fillRoundedRect(x, y, w, h, r);
    g.lineStyle(3, toColor(c.cardFg));
    g.strokeRoundedRect(x, y, w, h, r);
    if (fill <= 0) return;
    const radius = Math.min(r, fill / 2);
    g.fillStyle(toColor(c.memorize));
    g.fillRoundedRect(x, y, fill, h, radius);
    g.strokeRoundedRect(x, y, fill, h, radius);
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

  /** Thanh khoá: chỉ hiện khi sai (độ dài 0 thì ẩn hẳn). */
  private drawLockBar() {
    const g = this.lockBar;
    if (!g) return;
    const c = this.colors;
    const { x, y, w, h } = LOCK_BAR;
    const r = h / 2;
    const fill = Math.max(0, this.lock.width);
    g.clear();
    if (fill <= 0) return;
    g.fillStyle(toColor(c.card));
    g.fillRoundedRect(x, y, w, h, r);
    g.lineStyle(3, toColor(c.cardFg));
    g.strokeRoundedRect(x, y, w, h, r);
    g.fillStyle(toColor(c.cardFg));
    g.fillRoundedRect(x, y, fill, h, Math.min(r, fill / 2));
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

  /** Rê chuột: nhấc / hạ ô khay. */
  private lift(box: Phaser.GameObjects.Container, y: number) {
    this.tweens.killTweensOf(box);
    if (this.reducedMotion) {
      box.setY(y);
      return;
    }
    this.tweens.add({ targets: box, y, duration: HOVER_MS, ease: "Quad.easeOut" });
  }

  /** Trượt tới chỗ mới (tách cột so sánh); giảm chuyển động thì đặt ngay. */
  private slide(target: Phaser.GameObjects.Image, x: number, y: number) {
    if (this.reducedMotion) {
      target.setPosition(x, y);
      return;
    }
    this.tweens.add({ targets: target, x, y, duration: SPLIT_MS, ease: "Quad.easeOut" });
  }

  private fadeTo(target: Phaser.GameObjects.Image | Phaser.GameObjects.Container, alpha: number) {
    this.tweens.add({ targets: target, alpha, duration: DIM_MS });
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

  // -------------------------------------------------------------- texture (vẽ một lần, theo cỡ)

  /** Tạo texture từ canvas 2D (gốc toạ độ ở tâm) nếu chưa có; trả về khoá. */
  private texture(name: string, w: number, h: number, draw: (ctx: Ctx) => void): string {
    const key = `stack-recall:${name}`;
    if (this.textures.exists(key)) return key;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(w);
    canvas.height = Math.ceil(h);
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

  /** Khối loại `kind` cỡ `w × h` (tháp 360×110, khay, cột so sánh 260×88). */
  private blockTexture(kind: StackRecallKind, w: number, h: number) {
    return this.texture(`block:${kind}:${w}x${h}`, w + 6, h + 6, (ctx) =>
      paintBlock(ctx, kind, w, h, this.colors),
    );
  }

  /** Ô tầng trống: nền ô mờ, khung nét đứt; `label` > 0 thì có số thứ tự mờ ở góc trái. */
  private slotTexture(label: number) {
    const { w, h } = BLOCK;
    const c = this.colors;
    return this.texture(`slot:${label}`, w + 6, h + 6, (ctx) => {
      const r = blockRadius(h);
      rectPath(ctx, w - 4, h - 4, r);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = c.surface;
      ctx.fill();
      ctx.globalAlpha = c.dark ? 0.7 : 0.45;
      ctx.setLineDash([16, 12]);
      ctx.lineCap = "butt";
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.dash;
      ctx.stroke();
      ctx.setLineDash([]);
      if (label <= 0) return;
      ctx.globalAlpha = c.dark ? 0.35 : 0.28;
      ctx.fillStyle = c.dash;
      ctx.font = `800 44px "Baloo 2", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(String(label), -w / 2 + 34, 16);
    });
  }

  /** Ô khay trong lúc xem và che: khung nét đứt rỗng (chưa lộ khối). */
  private trayFrameTexture() {
    const { w, h } = this.tray;
    const c = this.colors;
    return this.texture(`tray-frame:${w}x${h}`, w + 6, h + 6, (ctx) => {
      rectPath(ctx, w - 4, h - 4, TRAY_RADIUS);
      ctx.globalAlpha = c.dark ? 0.6 : 0.35;
      ctx.setLineDash([14, 12]);
      ctx.lineCap = "butt";
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.dash;
      ctx.stroke();
    });
  }

  /** Nền ô khay: sáng là giấy viền mực, tối là mực viền phấn; bóng đổ 6 px. */
  private trayCardTexture() {
    const { w, h } = this.tray;
    const c = this.colors;
    return this.texture(`tray-card:${w}x${h}`, w + 8, h + 20, (ctx) => {
      ctx.save();
      ctx.translate(0, 6);
      rectPath(ctx, w, h, TRAY_RADIUS);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      ctx.restore();
      rectPath(ctx, w, h, TRAY_RADIUS);
      ctx.fillStyle = c.surface;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.line;
      ctx.stroke();
    });
  }

  /** Vòng vàng dày quanh ô khay của khối lẽ ra phải chạm (lúc khoá). */
  private ringTexture() {
    const w = this.tray.w + 16;
    const h = this.tray.h + 16;
    const c = this.colors;
    return this.texture(`ring:${this.tray.w}x${this.tray.h}`, w + 16, h + 16, (ctx) => {
      rectPath(ctx, w, h, TRAY_RADIUS + 8);
      ctx.lineWidth = 14;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      ctx.lineWidth = 8;
      ctx.strokeStyle = c.primary;
      ctx.stroke();
    });
  }

  /** Khối chạm sai: dấu X hai nét màu báo lỗi, viền phấn trắng. */
  private crossTexture() {
    const c = this.colors;
    return this.texture("cross", 80, 80, (ctx) => {
      const cross = new Path2D("M-26 -26 L26 26 M26 -26 L-26 26");
      // Mép mực mảnh ngoài viền phấn để dấu X vẫn nổi trên khối màu sáng (hồng, vàng).
      ctx.lineWidth = 24;
      ctx.strokeStyle = c.sticker;
      ctx.stroke(cross);
      ctx.lineWidth = 20;
      ctx.strokeStyle = c.chalk;
      ctx.stroke(cross);
      ctx.lineWidth = 10;
      ctx.strokeStyle = c.destructive;
      ctx.stroke(cross);
    });
  }

  /** Huy hiệu dấu tích nhỏ ở góc phải tầng đã xếp đúng (cột tháp đúng). */
  private checkTexture() {
    const c = this.colors;
    return this.texture("check", 48, 52, (ctx) => {
      circlePath(ctx, 0, 3, 19);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      circlePath(ctx, 0, 0, 19);
      ctx.fillStyle = c.primary;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      ctx.save();
      ctx.scale(0.75, 0.75);
      ctx.lineWidth = 6;
      ctx.strokeStyle = c.primaryFg;
      ctx.stroke(new Path2D(CHECK_PATH));
      ctx.restore();
    });
  }

  /** Mũi tên phấn vàng (viền mực) chỉ sang phải, nằm trong khe 60 px giữa hai cột so sánh. */
  private arrowTexture() {
    const c = this.colors;
    return this.texture("arrow", 72, 44, (ctx) => {
      const arrow = new Path2D("M-24 0 L20 0 M8 -12 L21 0 L8 12");
      ctx.lineWidth = 13;
      ctx.strokeStyle = c.sticker;
      ctx.stroke(arrow);
      ctx.lineWidth = 7;
      ctx.strokeStyle = c.primary;
      ctx.stroke(arrow);
    });
  }

  /** Viền nét đứt quanh cả tháp đúng (cột phải lúc khoá), cao theo số tầng. */
  private outlineTexture(height: number) {
    const w = COMPARE.w + 12;
    const h = height * (COMPARE.h + COMPARE.gap) - COMPARE.gap + 12;
    const c = this.colors;
    return this.texture(`outline:${height}`, w + 8, h + 8, (ctx) => {
      rectPath(ctx, w, h, 18);
      ctx.globalAlpha = 0.85;
      ctx.setLineDash([14, 10]);
      ctx.lineCap = "butt";
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.dash;
      ctx.stroke();
    });
  }

  /**
   * Khăn lau phấn (màu nhóm Ghi nhớ, vệt sáng hồng, đường may nét đứt) phủ kín tháp `height` tầng:
   * rộng 440 (như bệ), từ trên tầng cao nhất 14 px tới sát mép trên bệ.
   */
  private clothTexture(height: number) {
    const w = BASE.w;
    const h = (BLOCK.h + BLOCK.gap) * height + 12;
    const c = this.colors;
    return this.texture(`cloth:${height}`, w + 8, h + 8, (ctx) => {
      rectPath(ctx, w, h, 28);
      ctx.fillStyle = c.memorize;
      ctx.fill();
      ctx.save();
      rectPath(ctx, w, h, 28);
      ctx.clip();
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 18;
      ctx.strokeStyle = c.pink;
      for (let x = -w; x < w; x += 110) {
        ctx.beginPath();
        ctx.moveTo(x, h / 2 + 10);
        ctx.lineTo(x + h * 0.55, -h / 2 - 10);
        ctx.stroke();
      }
      ctx.restore();
      rectPath(ctx, w - 28, h - 28, 18);
      ctx.globalAlpha = 0.75;
      ctx.setLineDash([12, 10]);
      ctx.lineCap = "butt";
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.chalk;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      rectPath(ctx, w, h, 28);
      ctx.lineWidth = 5;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
    });
  }

  /** Nền tròn của huy hiệu trạng thái: thẻ giấy viền mực, bóng đổ xuống dưới. */
  private badgeTexture() {
    const c = this.colors;
    const { r } = STATUS;
    return this.texture("status", 2 * (r + 9), 2 * (r + 9), (ctx) => {
      circlePath(ctx, 0, 6, r);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      circlePath(ctx, 0, 0, r);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
    });
  }

  /** Pha xem: mắt mở, mống mắt màu Ghi nhớ. */
  private eyeTexture() {
    const c = this.colors;
    return this.texture("eye", 90, 90, (ctx) => {
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

  /** Pha che: mắt nhắm. */
  private eyeShutTexture() {
    const c = this.colors;
    return this.texture("eye-shut", 90, 90, (ctx) => {
      ctx.strokeStyle = c.cardFg;
      ctx.lineWidth = 6;
      ctx.stroke(new Path2D(EYE_SHUT_PATH));
      ctx.lineWidth = 5;
      ctx.stroke(new Path2D(EYE_LASH_PATH));
    });
  }

  /** Pha nhập: ngón tay chỉ. */
  private handTexture() {
    const c = this.colors;
    return this.texture("hand", 90, 90, (ctx) => {
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

  /** Siêu khó: huy hiệu xáo khay (màu nhóm Ghi nhớ, hai mũi tên đổi chỗ). */
  private shuffleTexture() {
    const c = this.colors;
    const { r } = SHUFFLE;
    return this.texture("shuffle", 2 * (r + 9), 2 * (r + 9), (ctx) => {
      circlePath(ctx, 0, 6, r);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      circlePath(ctx, 0, 0, r);
      ctx.fillStyle = c.memorize;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.stroke(new Path2D(SWAP_LINES_PATH));
      const heads = new Path2D(SWAP_HEADS_PATH);
      ctx.fillStyle = c.sticker;
      ctx.fill(heads);
      ctx.lineWidth = 2;
      ctx.stroke(heads);
    });
  }
}
