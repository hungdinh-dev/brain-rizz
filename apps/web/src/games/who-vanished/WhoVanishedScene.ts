import {
  type WhoVanishedItem,
  type WhoVanishedPuzzle,
  WRONG_ANSWER_LOCK_MS,
  whoVanished,
  whoVanishedRevealMs,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import type { MinigameBridge } from "../types";
import { ITEM_ART, ITEM_BOX, type ItemPart } from "./items";
import {
  CHECK_PATH,
  CURTAIN_FOLD_PATH,
  CURTAIN_LIGHT_PATH,
  CURTAIN_PATH,
  EYE_LASH_PATH,
  EYE_PATH,
  EYE_SHUT_PATH,
  HAND_PATH,
  SWAP_HEADS_PATH,
  SWAP_LINES_PATH,
} from "./shapes";

/*
 * Ai vừa biến mất — đặc tả: docs/04-minigames/who-vanished.md (mục "Ghi chú cho FE").
 * Bản mẫu: canvas Brain Rizz, trang Minigame, hàng M10 (WhoVanishedMobile/Levels/States).
 * Scene không vẽ chữ: chỉ hình vật, dấu "?", biểu tượng và thanh thời gian.
 */

// ---------------------------------------------------------------- bố cục (khung 720×1280)

/** Khung khay 648×648, góc (36, 290). */
const FRAME = { x: 36, y: 290, size: 648, radius: 36 };

/** Kích thước ô khay theo cỡ khay (theo bản mẫu). */
interface TrayLayout {
  cellW: number;
  cellH: number;
  radius: number;
  /** Tâm các cột / hàng. */
  xs: number[];
  ys: number[];
  /** Cỡ vật trong ô (hộp vật 112 × cỡ). */
  itemScale: number;
  /** Cỡ chữ dấu "?" của ô trống. */
  markFont: number;
}

const TRAYS: Record<string, TrayLayout> = {
  "2x2": {
    cellW: 276,
    cellH: 276,
    radius: 32,
    xs: [198, 522],
    ys: [452, 776],
    itemScale: 2,
    markFont: 150,
  },
  "3x2": {
    cellW: 180,
    cellH: 276,
    radius: 26,
    xs: [150, 360, 570],
    ys: [452, 776],
    itemScale: 1.4,
    markFont: 120,
  },
  "3x3": {
    cellW: 176,
    cellH: 176,
    radius: 24,
    xs: [148, 360, 572],
    ys: [402, 614, 826],
    itemScale: 1.3,
    markFont: 110,
  },
};

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Bố cục khay; cỡ khay chưa có trong bản mẫu (đổi tham số sau chơi thử) thì chia đều lòng khung. */
function trayLayout(cols: number, rows: number): TrayLayout {
  const known = TRAYS[`${cols}x${rows}`];
  if (known) return known;
  const inner = 576;
  const pitchX = inner / cols;
  const pitchY = inner / rows;
  const cellW = Math.round(pitchX * 0.84);
  const cellH = Math.round(pitchY * 0.84);
  const side = Math.min(cellW, cellH);
  return {
    cellW,
    cellH,
    radius: Math.round(side * 0.14),
    xs: range(cols).map((c) => FRAME.x + 36 + pitchX * (c + 0.5)),
    ys: range(rows).map((r) => FRAME.y + 36 + pitchY * (r + 0.5)),
    itemScale: side / 135,
    markFont: Math.round(side * 0.62),
  };
}

/** Hàng thẻ: y 976–1176, trải từ x 32 tới 688. */
const CARD_TOP = 976;
const CARD_H = 200;
const CARD_LEFT = 32;
const CARD_ROW_W = 656;
const CARD_Y = CARD_TOP + CARD_H / 2;

interface CardLayout {
  w: number;
  /** Mép trái từng thẻ. */
  xs: number[];
  itemScale: number;
}

/** 3 thẻ (Mầm) 200 × 200, khe 28; 4 thẻ 152 × 200, khe 16. */
function cardLayout(count: number): CardLayout {
  const wide = count <= 3;
  const gap = wide ? 28 : 16;
  const w = (CARD_ROW_W - (count - 1) * gap) / count;
  return {
    w,
    xs: range(count).map((i) => CARD_LEFT + i * (w + gap)),
    itemScale: wide ? 1.4 : (1.12 * w) / 152,
  };
}

/** Huy hiệu trạng thái Ø 112 tâm (360, 140); Siêu khó thêm huy hiệu đổi chỗ Ø 80 tâm (500, 140). */
const STATUS = { x: 360, y: 140, r: 56 };
const SWAP = { x: 500, r: 40 };
/** Thanh xem / khoá 420×14, góc (150, 229). */
const BAR = { x: 150, y: 229, w: 420, h: 14 };
/** Rèm: texture phủ vùng (35, 281) – (685, 941); thanh treo rèm ở y 268–290. */
const CURTAIN = { x: 35, y: 281, w: 650, h: 660 };
/** Đĩa hiện món đúng khi sai: Ø 160. */
const ANSWER_R = 80;
const ANSWER_SCALE = 1.2;

// ---------------------------------------------------------------- nhịp hiệu ứng (đều ≤ 400 ms)

const FADE_IN_MS = 120;
const POP_MS = 150;
/** Rèm hạ 250 ms, kéo lên 150 ms: vừa khít 400 ms che. */
const CURTAIN_DOWN_MS = 250;
const CURTAIN_UP_MS = 150;
/** Đúng: món bay về ô rồi nảy; tính vào thời gian câu sau nên tổng ≤ 300 ms. */
const FLY_MS = 200;
const LAND_POP_MS = 100;
const SOLVED_MS = 300;
const HOVER_MS = 80;
const HOVER_LIFT = 8;
const SHAKE_MS = 200;
const DIM_MS = 150;
/** Độ mờ của khay và các thẻ khác trong lúc khoá sau câu sai. */
const DIM_ALPHA = 0.35;

// ---------------------------------------------------------------- màu

/** Màu đọc từ token CSS lúc tạo scene (tự đổi theo sáng/tối). Chuỗi CSS để vẽ texture canvas. */
interface Palette {
  card: string;
  cardFg: string;
  muted: string;
  sticker: string;
  primary: string;
  primaryFg: string;
  chalk: string;
  destructive: string;
  /** Màu nhóm Ghi nhớ: viền khung khay, rèm, thanh xem, huy hiệu đổi chỗ. */
  memorize: string;
  /** Nếp sáng của rèm. */
  pink: string;
  dark: boolean;
}

function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const chalk = token("--chalk");
  return {
    card: token("--card"),
    cardFg: token("--card-foreground"),
    muted: token("--muted"),
    sticker: token("--sticker"),
    primary: token("--primary"),
    primaryFg: token("--primary-foreground"),
    chalk,
    destructive: token("--destructive"),
    memorize: token("--color-memorize"),
    pink: token("--color-pink") || chalk,
    dark: style.colorScheme === "dark",
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

/** Nét đứt chia đều quanh vòng tròn bán kính `r` để chỗ nối không lệch. */
function evenDash(r: number, [dash, gap]: [number, number]): [number, number] {
  const length = 2 * Math.PI * r;
  const k = length / Math.max(1, Math.round(length / (dash + gap))) / (dash + gap);
  return [dash * k, gap * k];
}

function partShape(part: Exclude<ItemPart, { kind: "stroke" }>): Path2D {
  if (part.kind === "path") return new Path2D(part.d);
  const shape = new Path2D();
  if (part.kind === "circle") {
    shape.arc(part.cx, part.cy, part.r, 0, Math.PI * 2);
    return shape;
  }
  const rotate = Phaser.Math.DegToRad(part.rotate ?? 0);
  shape.ellipse(part.cx, part.cy, part.rx, part.ry, rotate, 0, Math.PI * 2);
  return shape;
}

/** Vẽ một vật theo bảng hình (items.ts), viền màu `outline`. */
function paintItem(ctx: Ctx, item: WhoVanishedItem, outline: string) {
  for (const part of ITEM_ART[item]) {
    ctx.globalAlpha = part.kind === "circle" ? 1 : (part.opacity ?? 1);
    if (part.kind === "stroke") {
      ctx.lineWidth = part.width;
      ctx.strokeStyle = part.color;
      ctx.stroke(new Path2D(part.d));
      continue;
    }
    const shape = partShape(part);
    if (part.fill) {
      ctx.fillStyle = part.fill;
      ctx.fill(shape);
    }
    const width = part.kind === "ellipse" ? undefined : part.outline;
    if (width) {
      ctx.lineWidth = width;
      ctx.strokeStyle = outline;
      ctx.stroke(shape);
    }
  }
  ctx.globalAlpha = 1;
}

/** Đọc `prefers-reduced-motion`: rèm mờ dần thay vì hạ; bỏ bay, nảy, rung, nhấc thẻ. */
function prefersReducedMotion() {
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

// ---------------------------------------------------------------- scene

type Phase = "view" | "cover" | "input" | "done";
type StatusIcon = "eye" | "shut" | "hand";

interface CellView {
  x: number;
  y: number;
  bg: Phaser.GameObjects.Image;
  item: Phaser.GameObjects.Image;
}

interface CardView {
  /** Tâm thẻ. */
  x: number;
  y: number;
  left: number;
  /** Nền thẻ + hình vật; nhấc lên khi rê chuột, rung khi chạm sai. */
  box: Phaser.GameObjects.Container;
  zone: Phaser.GameObjects.Zone;
}

/** Ai vừa biến mất — xem khay 3 giây, rèm che, chạm thẻ của món đã biến mất. */
export default class WhoVanishedScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private colors!: Palette;
  private reducedMotion = false;

  private phase: Phase = "done";
  private puzzle?: WhoVanishedPuzzle;
  private tray: TrayLayout = trayLayout(3, 2);
  private row: CardLayout = cardLayout(4);
  /** Ẩn tab lúc đang xem hoặc che → quay lại thì chiếu lại câu từ đầu. */
  private replayOnVisible = false;
  /** Hẹn giờ của câu hiện tại (lịch xem/che, chuyển câu); huỷ hết khi sang câu mới. */
  private timers: Phaser.Time.TimerEvent[] = [];

  private root?: Phaser.GameObjects.Container;
  private trayLayer?: Phaser.GameObjects.Container;
  private cells: CellView[] = [];
  private curtain?: Phaser.GameObjects.Image;
  private rod?: Phaser.GameObjects.Graphics;
  private status?: Phaser.GameObjects.Container;
  private icons: Partial<Record<StatusIcon, Phaser.GameObjects.Image>> = {};
  private slots?: Phaser.GameObjects.Container;
  private cardLayer?: Phaser.GameObjects.Container;
  private cards: CardView[] = [];
  private marks?: Phaser.GameObjects.Container;
  private bar?: Phaser.GameObjects.Graphics;
  /** Thanh xem (màu Ghi nhớ) hoặc thanh khoá (màu mực): độ dài phần còn lại. */
  private barState: { width: number; mode: "view" | "lock" } = { width: 0, mode: "view" };

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.phase = "done";
    this.puzzle = undefined;
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

    const puzzle = whoVanished.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    this.puzzle = puzzle;
    this.tray = trayLayout(puzzle.cols, puzzle.rows);
    this.row = cardLayout(puzzle.choices.length);
    this.phase = "view";
    this.replayOnVisible = false;

    const root = this.add.container(0, 0);
    const trayLayer = this.add.container(0, 0, [this.drawFrame()]);
    this.cells = puzzle.shown.map((item, i) => this.makeCell(i, puzzle.cols, item, trayLayer));

    const curtain = this.add
      .image(CURTAIN.x, CURTAIN.y, this.curtainTexture())
      .setOrigin(0, 0)
      .setVisible(false);
    const rod = this.drawRod().setAlpha(0);

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
    // Siêu khó: huy hiệu đổi chỗ hiện suốt câu.
    const swap = puzzle.shuffled ? this.add.image(SWAP.x, STATUS.y, this.swapTexture()) : undefined;
    const bar = this.add.graphics();

    // Pha xem: chỗ hàng thẻ là các khung nét đứt rỗng (chưa lộ thẻ).
    const slots = this.add.container(0, 0);
    const cardLayer = this.add.container(0, 0);
    this.cards = puzzle.choices.map((item, i) => this.makeCard(i, item, slots, cardLayer));
    const marks = this.add.container(0, 0);

    root.add([trayLayer, curtain, rod, status, bar, slots, cardLayer, marks]);
    if (swap) root.add(swap);
    for (const card of this.cards) root.add(card.zone);

    this.root = root;
    this.trayLayer = trayLayer;
    this.curtain = curtain;
    this.rod = rod;
    this.status = status;
    this.icons = icons;
    this.slots = slots;
    this.cardLayer = cardLayer;
    this.marks = marks;
    this.bar = bar;

    // Câu mới: khay mờ dần vào, huy hiệu nảy.
    root.setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: FADE_IN_MS });
    this.pop(status);

    // Lịch chạy bằng đồng hồ của scene, bắt đầu sau khung hình đầu tiên để không bị giật.
    this.events.once(Phaser.Scenes.Events.POST_UPDATE, () => {
      if (this.puzzle === puzzle && this.phase === "view") this.startReveal();
    });
  }

  private drawFrame() {
    const c = this.colors;
    const { x, y, size, radius } = FRAME;
    const g = this.add.graphics();
    g.fillStyle(toColor(c.sticker));
    g.fillRoundedRect(x, y + 8, size, size, radius);
    g.fillStyle(toColor(c.card));
    g.fillRoundedRect(x, y, size, size, radius);
    g.lineStyle(5, toColor(c.sticker));
    g.strokeRoundedRect(x, y, size, size, radius);
    g.lineStyle(8, toColor(c.memorize));
    g.strokeRoundedRect(x + 11, y + 11, size - 22, size - 22, radius - 9);
    return g;
  }

  private drawRod() {
    const c = this.colors;
    const g = this.add.graphics();
    g.fillStyle(toColor(c.sticker));
    g.fillRoundedRect(18, 268, 684, 22, 11);
    for (const x of [24, 696]) {
      g.fillStyle(toColor(c.primary));
      g.fillCircle(x, 279, 16);
      g.lineStyle(5, toColor(c.sticker));
      g.strokeCircle(x, 279, 16);
    }
    return g;
  }

  private makeCell(
    i: number,
    cols: number,
    item: WhoVanishedItem,
    layer: Phaser.GameObjects.Container,
  ): CellView {
    const x = this.tray.xs[i % cols] ?? 0;
    const y = this.tray.ys[Math.floor(i / cols)] ?? 0;
    const bg = this.add.image(x, y, this.cellTexture());
    const image = this.add.image(x, y, this.itemTexture(item, this.tray.itemScale));
    layer.add([bg, image]);
    return { x, y, bg, item: image };
  }

  private makeCard(
    i: number,
    item: WhoVanishedItem,
    slots: Phaser.GameObjects.Container,
    layer: Phaser.GameObjects.Container,
  ): CardView {
    const { w, itemScale } = this.row;
    const left = this.row.xs[i] ?? 0;
    const x = left + w / 2;
    const y = CARD_Y;
    slots.add(this.add.image(x, y, this.slotTexture()));
    const box = this.add.container(x, y, [
      this.add.image(0, 0, this.cardTexture()),
      this.add.image(0, 0, this.itemTexture(item, itemScale)),
    ]);
    box.setVisible(false);
    layer.add(box);

    // Vùng chạm = cả thẻ (152–200 px). Chạm vào khay không làm gì. Chỉ bật ở pha chờ chọn.
    const zone = this.add.zone(x, y, w, CARD_H).setInteractive({ useHandCursor: true });
    zone.disableInteractive();
    zone.on("pointerdown", () => this.tap(i));
    zone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
      // Máy tính: rê chuột thẻ nhấc lên 8 px.
      if (this.phase === "input" && !pointer.wasTouch) this.lift(box, y - HOVER_LIFT);
    });
    zone.on("pointerout", () => {
      if (this.phase === "input") this.lift(box, y);
    });

    return { x, y, left, box, zone };
  }

  /** Đặt khay theo một bản (xem hoặc hỏi); `null` là ô trống có dấu "?". */
  private setTray(items: readonly (WhoVanishedItem | null)[]) {
    this.cells.forEach((cell, i) => {
      const item = items[i];
      if (!item) {
        cell.bg.setTexture(this.blankTexture());
        cell.item.setVisible(false);
        return;
      }
      cell.bg.setTexture(this.cellTexture());
      cell.item
        .setTexture(this.itemTexture(item, this.tray.itemScale))
        .setVisible(true)
        .setScale(1);
    });
  }

  private setStatus(icon: StatusIcon) {
    for (const [name, image] of Object.entries(this.icons)) image?.setVisible(name === icon);
  }

  // -------------------------------------------------------------- lịch xem → che → chọn

  /** Chiếu (hoặc chiếu lại) câu từ pha xem theo đúng lịch trong câu đố, rồi mở pha chọn. */
  private startReveal() {
    const puzzle = this.puzzle;
    if (!puzzle) return;
    this.clearTimers();
    this.phase = "view";

    this.setTray(puzzle.shown);
    this.setStatus("eye");
    if (this.curtain) {
      this.tweens.killTweensOf(this.curtain);
      this.curtain.setVisible(false).setScale(1, 0).setAlpha(1);
    }
    if (this.rod) {
      this.tweens.killTweensOf(this.rod);
      this.rod.setAlpha(0);
    }
    this.slots?.setVisible(true);
    for (const card of this.cards) {
      card.zone.disableInteractive(true);
      card.box.setVisible(false).setY(card.y);
    }

    // Thanh xem đầy lại rồi rút dần trong thời gian xem.
    this.barState = { width: BAR.w, mode: "view" };
    this.bar?.setVisible(true);
    this.runBar(puzzle.viewMs);

    // Cùng mốc với miễn trừ thời gian của server (speedAllowanceMs = xem + che).
    const reveal = whoVanishedRevealMs(puzzle);
    const down = Math.min(CURTAIN_DOWN_MS, puzzle.coverMs);
    const up = Math.min(CURTAIN_UP_MS, puzzle.coverMs - down);
    this.after(puzzle.viewMs, () => this.lowerCurtain(down));
    // Đổi khay (kể cả đổi chỗ ở Siêu khó) sau rèm: người chơi không thấy món di chuyển.
    this.after(puzzle.viewMs + down, () => this.setTray(puzzle.remaining));
    this.after(reveal - up, () => this.raiseCurtain(up));
    this.after(reveal, () => this.beginInput());
  }

  private lowerCurtain(ms: number) {
    const curtain = this.curtain;
    if (!curtain) return;
    this.phase = "cover";
    this.setStatus("shut");
    this.barState.width = 0;
    this.drawBar();

    this.tweens.killTweensOf(curtain);
    curtain.setVisible(true);
    if (this.reducedMotion) {
      // Giảm chuyển động: rèm hiện mờ dần thay vì hạ xuống.
      curtain.setScale(1).setAlpha(0);
      this.tweens.add({ targets: curtain, alpha: 1, duration: ms });
    } else {
      curtain.setScale(1, 0).setAlpha(1);
      this.tweens.add({ targets: curtain, scaleY: 1, duration: ms, ease: "Quad.easeOut" });
    }
    if (this.rod) this.tweens.add({ targets: this.rod, alpha: 1, duration: Math.min(ms, 100) });
  }

  private raiseCurtain(ms: number) {
    const curtain = this.curtain;
    if (!curtain) return;
    this.tweens.killTweensOf(curtain);
    const hide = () => {
      curtain.setVisible(false);
      this.rod?.setAlpha(0);
    };
    if (ms <= 0) {
      hide();
      return;
    }
    const to = this.reducedMotion ? { alpha: 0 } : { scaleY: 0 };
    this.tweens.add({
      targets: curtain,
      ...to,
      duration: ms,
      ease: "Quad.easeIn",
      onComplete: hide,
    });
    if (this.rod) this.tweens.add({ targets: this.rod, alpha: 0, duration: ms });
  }

  private beginInput() {
    const puzzle = this.puzzle;
    if (!puzzle || (this.phase !== "view" && this.phase !== "cover")) return;
    this.phase = "input";
    this.curtain?.setVisible(false);
    this.rod?.setAlpha(0);
    this.setStatus("hand");
    if (this.status) this.pop(this.status);
    this.bar?.setVisible(false);

    // Hàng thẻ hiện thay cho khung nét đứt.
    this.slots?.setVisible(false);
    for (const card of this.cards) {
      card.box.setVisible(true);
      card.zone.setInteractive();
    }
    if (this.cardLayer && !this.reducedMotion) {
      this.cardLayer.setAlpha(0);
      this.tweens.add({ targets: this.cardLayer, alpha: 1, duration: FADE_IN_MS });
    }
  }

  // -------------------------------------------------------------- chọn

  private tap(choice: number) {
    const puzzle = this.puzzle;
    const card = this.cards[choice];
    if (this.phase !== "input" || !puzzle || !card) return;

    // Chạm một lần là nộp. Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm.
    const index = this.submit(choice);
    if (whoVanished.check(puzzle, choice)) this.solved(puzzle, card);
    else this.miss(puzzle, card, index);
  }

  /** Gửi đáp án (một lần mỗi câu) và khoá chạm. Trả về chỉ số câu vừa gửi. */
  private submit(choice: number): number {
    this.phase = "done";
    for (const card of this.cards) {
      card.zone.disableInteractive(true);
      this.tweens.killTweensOf(card.box);
      card.box.setY(card.y);
    }
    const index = this.index;
    this.bridge.submit(index, choice);
    this.index += 1;
    return index;
  }

  /** Đúng: thẻ có vòng vàng + dấu tích; món bay từ thẻ về ô "?", ô viền vàng, món nảy. */
  private solved(puzzle: WhoVanishedPuzzle, card: CardView) {
    const marks = this.marks;
    const cell = this.cells[puzzle.blankCell];
    const item = puzzle.choices[puzzle.answerIndex];
    if (!marks || !cell || !item) {
      this.after(SOLVED_MS, () => this.showPuzzle());
      return;
    }

    marks.add([
      this.add.image(card.x, CARD_TOP - 12 + 115, this.ringTexture()),
      this.add.image(card.left + this.row.w - 12, CARD_TOP + 12, this.okTexture()),
    ]);

    const flyer = this.add.image(card.x, card.y, this.itemTexture(item, this.tray.itemScale));
    flyer.setScale(this.row.itemScale / this.tray.itemScale);
    marks.add(flyer);
    const land = () => {
      cell.bg.setTexture(this.okCellTexture());
      flyer.setPosition(cell.x, cell.y).setScale(1);
      if (this.reducedMotion) return;
      this.tweens.add({
        targets: flyer,
        scale: 1.1,
        duration: LAND_POP_MS / 2,
        yoyo: true,
        ease: "Quad.easeOut",
      });
    };
    if (this.reducedMotion) land();
    else {
      this.tweens.add({
        targets: flyer,
        x: cell.x,
        y: cell.y,
        scale: 1,
        duration: FLY_MS,
        ease: "Quad.easeOut",
        onComplete: land,
      });
    }
    this.after(SOLVED_MS, () => this.showPuzzle());
  }

  /**
   * Sai (CR-006): suốt lúc khoá hiện đáp án đúng. Khay và các thẻ khác mờ 35 %; món đúng hiện lại
   * ở ô "?" trong đĩa nét đứt; thẻ đúng có vòng vàng; thẻ chạm sai có dấu X và rung.
   * Mọi thứ nằm dưới y 290, ngoài dải trên cùng mà huy hiệu khoá của khung che.
   */
  private miss(puzzle: WhoVanishedPuzzle, wrong: CardView, index: number) {
    const marks = this.marks;
    const right = this.cards[puzzle.answerIndex];
    const cell = this.cells[puzzle.blankCell];
    const item = puzzle.choices[puzzle.answerIndex];
    if (!marks) return;

    const dimmed: Phaser.GameObjects.Container[] = [];
    if (this.trayLayer) dimmed.push(this.trayLayer);
    for (const card of this.cards) if (card !== right) dimmed.push(card.box);
    this.tweens.add({ targets: dimmed, alpha: DIM_ALPHA, duration: DIM_MS });

    const shown: Phaser.GameObjects.Image[] = [];
    if (cell && item) {
      shown.push(
        this.add.image(cell.x, cell.y, this.answerTexture()),
        this.add.image(cell.x, cell.y + 2, this.itemTexture(item, ANSWER_SCALE)),
      );
    }
    if (right) shown.push(this.add.image(right.x, CARD_TOP - 12 + 115, this.ringTexture()));
    marks.add(shown);
    if (!this.reducedMotion) {
      for (const image of shown) image.setAlpha(0);
      this.tweens.add({ targets: shown, alpha: 1, duration: DIM_MS });
    }

    const cross = this.add.image(wrong.left + this.row.w - 22, CARD_TOP + 20, this.crossTexture());
    marks.add(cross);
    this.shake([wrong.box, cross], 8, SHAKE_MS, 2);

    // Thanh khoá chạy ngay theo thời gian khoá chuẩn, rồi chỉnh theo `lockedUntil` khi server trả lời.
    this.barState = { width: BAR.w, mode: "lock" };
    this.bar?.setVisible(true);
    this.runBar(WRONG_ANSWER_LOCK_MS);
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive() || this.puzzle !== puzzle) return;
      this.runBar(ms);
      this.after(ms, () => this.showPuzzle());
    });
  }

  // -------------------------------------------------------------- thanh xem / khoá

  /** Thanh rút từ độ dài hiện tại về 0 trong `ms`. */
  private runBar(ms: number) {
    this.tweens.killTweensOf(this.barState);
    if (ms <= 0) {
      this.barState.width = 0;
      this.drawBar();
      return;
    }
    this.drawBar();
    this.tweens.add({
      targets: this.barState,
      width: 0,
      duration: ms,
      onUpdate: () => this.drawBar(),
    });
  }

  private drawBar() {
    const g = this.bar;
    if (!g) return;
    const c = this.colors;
    const { x, y, w, h } = BAR;
    const r = h / 2;
    const fill = Math.max(0, this.barState.width);
    g.clear();
    g.fillStyle(toColor(c.card));
    g.fillRoundedRect(x, y, w, h, r);
    g.lineStyle(3, toColor(c.cardFg));
    g.strokeRoundedRect(x, y, w, h, r);
    if (fill <= 0) return;
    const radius = Math.min(r, fill / 2);
    if (this.barState.mode === "view") {
      g.fillStyle(toColor(c.memorize));
      g.fillRoundedRect(x, y, fill, h, radius);
      g.strokeRoundedRect(x, y, fill, h, radius);
    } else {
      g.fillStyle(toColor(c.cardFg));
      g.fillRoundedRect(x, y, fill, h, radius);
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

  /** Rê chuột: nhấc / hạ thẻ. */
  private lift(box: Phaser.GameObjects.Container, y: number) {
    this.tweens.killTweensOf(box);
    if (this.reducedMotion) {
      box.setY(y);
      return;
    }
    this.tweens.add({ targets: box, y, duration: HOVER_MS, ease: "Quad.easeOut" });
  }

  /** Lắc ngang ±`amplitude` px trong `ms`, `cycles` nhịp, rồi về chỗ cũ. */
  private shake(
    targets: (Phaser.GameObjects.Container | Phaser.GameObjects.Image)[],
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
    const key = `who-vanished:${name}`;
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

  /** Một vật ở cỡ `scale`, viền mực. */
  private itemTexture(item: WhoVanishedItem, scale: number) {
    const size = (ITEM_BOX + 8) * scale;
    return this.texture(`item:${item}:${scale}`, size, size, (ctx) => {
      ctx.scale(scale, scale);
      paintItem(ctx, item, this.colors.sticker);
    });
  }

  /** Ô khay thường: nền muted, viền mảnh. */
  private cellTexture() {
    const { cellW, cellH, radius } = this.tray;
    const c = this.colors;
    return this.texture(`cell:${cellW}x${cellH}`, cellW + 6, cellH + 6, (ctx) => {
      rectPath(ctx, cellW, cellH, radius);
      ctx.fillStyle = c.muted;
      ctx.fill();
      ctx.globalAlpha = c.dark ? 0.16 : 0.2;
      ctx.lineWidth = 3;
      ctx.strokeStyle = c.cardFg;
      ctx.stroke();
    });
  }

  /** Ô "?": nền hồng nhạt, viền đứt, dấu "?" lớn (không chỉ đổi màu nền). */
  private blankTexture() {
    const { cellW, cellH, radius, markFont } = this.tray;
    const c = this.colors;
    return this.texture(`blank:${cellW}x${cellH}`, cellW + 6, cellH + 6, (ctx) => {
      rectPath(ctx, cellW, cellH, radius);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = c.memorize;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.setLineDash([14, 10]);
      ctx.lineCap = "butt";
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.cardFg;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = c.cardFg;
      ctx.font = `800 ${markFont}px "Baloo 2", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("?", 0, Math.round(markFont * 0.345));
    });
  }

  /** Ô "?" khi chạm đúng: viền vàng dày, nền ánh vàng (nền sáng). */
  private okCellTexture() {
    const { cellW, cellH, radius } = this.tray;
    const c = this.colors;
    const w = cellW + 4;
    const h = cellH + 4;
    return this.texture(`ok-cell:${cellW}x${cellH}`, w + 14, h + 14, (ctx) => {
      rectPath(ctx, w, h, radius + 2);
      ctx.fillStyle = c.muted;
      ctx.fill();
      if (!c.dark) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = c.primary;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.lineWidth = 12;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.strokeStyle = c.primary;
      ctx.stroke();
    });
  }

  /** Thẻ chọn: nền giấy, viền mực, bóng đổ 6 px. */
  private cardTexture() {
    const { w } = this.row;
    const c = this.colors;
    return this.texture(`card:${w}`, w + 8, CARD_H + 20, (ctx) => {
      ctx.save();
      ctx.translate(0, 6);
      rectPath(ctx, w, CARD_H, 24);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      ctx.restore();
      rectPath(ctx, w, CARD_H, 24);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
    });
  }

  /** Chỗ thẻ trong pha xem: khung nét đứt rỗng. */
  private slotTexture() {
    const { w } = this.row;
    const c = this.colors;
    return this.texture(`slot:${w}`, w + 4, CARD_H + 4, (ctx) => {
      rectPath(ctx, w - 4, CARD_H - 4, 22);
      ctx.setLineDash([14, 12]);
      ctx.lineCap = "butt";
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.cardFg;
      ctx.stroke();
    });
  }

  /** Vòng vàng dày quanh thẻ đúng. */
  private ringTexture() {
    const w = this.row.w + 24;
    const h = 230;
    const c = this.colors;
    return this.texture(`ring:${this.row.w}`, w + 16, h + 16, (ctx) => {
      rectPath(ctx, w, h, 34);
      ctx.lineWidth = 14;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      ctx.lineWidth = 8;
      ctx.strokeStyle = c.primary;
      ctx.stroke();
    });
  }

  /** Huy hiệu dấu tích ở góc trên phải thẻ đúng. */
  private okTexture() {
    const c = this.colors;
    return this.texture("ok", 64, 70, (ctx) => {
      circlePath(ctx, 0, 5, 26);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      circlePath(ctx, 0, 0, 26);
      ctx.fillStyle = c.primary;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.strokeStyle = c.primaryFg;
      ctx.stroke(new Path2D(CHECK_PATH));
    });
  }

  /** Thẻ chạm sai: dấu X hai nét màu báo lỗi, viền phấn trắng. */
  private crossTexture() {
    const c = this.colors;
    return this.texture("cross", 72, 72, (ctx) => {
      const cross = new Path2D("M-24 -24 L24 24 M24 -24 L-24 24");
      ctx.lineWidth = 20;
      ctx.strokeStyle = c.chalk;
      ctx.stroke(cross);
      ctx.lineWidth = 10;
      ctx.strokeStyle = c.destructive;
      ctx.stroke(cross);
    });
  }

  /** Đĩa tròn nét đứt nền giấy chứa món đúng (lúc khoá), không bị mờ. */
  private answerTexture() {
    const c = this.colors;
    return this.texture("answer", 2 * ANSWER_R + 10, 2 * ANSWER_R + 10, (ctx) => {
      circlePath(ctx, 0, 0, ANSWER_R);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.setLineDash(evenDash(ANSWER_R, [14, 10]));
      ctx.lineCap = "butt";
      ctx.lineWidth = 5;
      ctx.strokeStyle = c.cardFg;
      ctx.stroke();
    });
  }

  /** Rèm hồng có nếp gấp, mép dưới lượn sóng; gốc ở góc trên trái vùng rèm. */
  private curtainTexture() {
    const c = this.colors;
    return this.texture("curtain", CURTAIN.w, CURTAIN.h, (ctx) => {
      ctx.translate(-CURTAIN.w / 2 - CURTAIN.x, -CURTAIN.h / 2 - CURTAIN.y);
      const body = new Path2D(CURTAIN_PATH);
      ctx.fillStyle = c.memorize;
      ctx.fill(body);
      ctx.save();
      ctx.clip(body);
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 12;
      ctx.strokeStyle = c.pink;
      ctx.stroke(new Path2D(CURTAIN_LIGHT_PATH));
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 5;
      ctx.strokeStyle = c.sticker;
      ctx.stroke(new Path2D(CURTAIN_FOLD_PATH));
      ctx.restore();
      ctx.lineWidth = 5;
      ctx.strokeStyle = c.sticker;
      ctx.stroke(body);
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

  /** Pha chờ chọn: ngón tay chỉ. */
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

  /** Siêu khó: huy hiệu đổi chỗ (màu nhóm Ghi nhớ, hai mũi tên ngược chiều). */
  private swapTexture() {
    const c = this.colors;
    const { r } = SWAP;
    return this.texture("swap", 2 * (r + 9), 2 * (r + 9), (ctx) => {
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
