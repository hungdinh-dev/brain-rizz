import { type HeadCountPuzzle, headCount, headCountTally } from "@brain-rizz/shared";
import Phaser from "phaser";
import type { ReactNode } from "react";
import { prefersReducedMotion } from "@/features/motion";
import { type Ctx, makeCanvas, roundRectPath, withHalo } from "../_shared/canvas";
import { drawSvg } from "../_shared/canvas-svg";
import { EYE_PATH, HAND_PATH } from "../_shared/icons";
import type { MinigameBridge } from "../types";
import { type Facing, KID_BOX, KID_LOOKS, kidArt, TEACHER_BOX, teacherArt } from "./figures";
import {
  poseAt,
  type Stage,
  stageAt,
  teacherInsideAtEnd,
  WALL_DROP_MS,
  type Walker,
  walkersOf,
} from "./timeline";

/*
 * Đếm sĩ số — đặc tả: docs/04-minigames/head-count.md (mục "Ghi chú cho FE" và "Hiện đáp án đúng
 * khi sai"). Chưa có bản mẫu: bố cục theo bảng của đặc tả. Lớp học mở cho xem sĩ số đầu, tường hạ
 * che lớp, các bạn đi vào/ra qua cửa theo đúng dòng thời gian của Puzzle (timeline.ts, suy ra từ
 * `t` mỗi khung hình), cửa đóng thì chạm thẻ số. Scene không vẽ chữ: chỉ hình người, cửa, chữ số và
 * dấu +/−/=, biểu tượng.
 */

// ---------------------------------------------------------------- bố cục (khung 720×1280)

/** Lớp học; tường trước phủ đúng vùng này. */
const ROOM = { x: 40, y: 260, w: 640, h: 500, radius: 32, border: 5, shadow: 8 } as const;
const ROOM_RIM = { inset: 11, radius: 23, width: 7 } as const;
/** Cửa trong tường trước. */
const DOOR = { x: 300, y: 560, w: 120, h: 200, frame: 8 } as const;
/** Lá cửa lúc mở: dải hẹp bên bản lề (trái), bằng `OPEN_LEAF` bề rộng cửa. */
const OPEN_LEAF = 0.2;
/** Bảng đen trên cùng lớp, ghi sĩ số. */
const BOARD = { x: 250, y: 284, w: 220, h: 100, radius: 12, frame: 8, font: 80 } as const;
/** 9 bàn 3 × 3: tâm cột, mặt bàn từng hàng. */
const DESK_X = [170, 360, 550] as const;
const DESK_Y = [494, 594, 694] as const;
const DESK = { top: 104, topH: 14, front: 92, frontH: 28 } as const;
/** Texture bàn chừa lề 3 px; gốc ảnh ở giữa mặt bàn (khớp `DESK_Y`). */
const DESK_ORIGIN_Y = (DESK.topH / 2 + 3) / (DESK.topH + DESK.frontH + 6);
/** Thứ tự ngồi cố định (chỉ số bàn trái → phải, trên → dưới): hàng giữa trước, giữa hàng trước. */
const SEAT_ORDER = [4, 3, 5, 1, 0, 2, 7, 6, 8] as const;
/** Bạn ngồi: thu nhỏ, chân dưới mặt bàn 24 px để bàn che nửa dưới người. */
const SEAT = { scale: 0.74, feet: 24 } as const;
/** Thầy đứng cạnh bảng (chân). */
const TEACHER_SPOT = { x: 588, y: 418, scale: 0.66 } as const;

/** Hành lang: vạch sàn, mũi tên phấn mờ (trái: vào cửa; phải: ra xa cửa). */
const FLOOR_Y = 920;
const ARROW_IN = "M110 954 L282 954 Q326 954 336 926";
const ARROW_IN_HEAD = "M322 930 L336 924 L342 939";
const ARROW_OUT = "M384 926 Q394 954 438 954 L604 954";
const ARROW_OUT_HEAD = "M590 942 L606 954 L590 966";
const ARROWS_BOX = { x: 100, y: 910, w: 520, h: 66 } as const;

/** 4 thẻ: góc trái các thẻ, đỉnh, cỡ. */
const CARD_X = [32, 200, 368, 536] as const;
const CARD = { y: 990, w: 152, h: 180, radius: 26, border: 5, shadow: 7, font: 100 } as const;
/** Rê chuột: thẻ nhấc 8 px. */
const HOVER_LIFT = 8;

/** Biểu tượng pha ở góc trái trên (mắt → bước chân → ngón tay), ngoài dải giữa của huy hiệu khoá. */
const PHASE_ICON = { x: 86, y: 132, r: 46 } as const;

/** Dải các bước khi sai (vd. 3 +2 −1 +1 = 5), giữa hành lang; dài quá thì xuống hai dòng. */
const TALLY = {
  y: 852,
  h: 58,
  radius: 16,
  border: 3,
  font: 40,
  padX: 12,
  gap: 8,
  lineGap: 12,
  maxW: 640,
} as const;

/** Texture nhân vật chừa lề cho viền mực và viền phấn ở nền tối. */
const FIG_PAD = 8;
const HALO_PX = 3;

const DIM_ALPHA = 0.35;
const TEACHER_GHOST = 0.5;

// ---------------------------------------------------------------- nhịp hiệu ứng (đều ≤ 300 ms)

const DOOR_CLOSE_MS = 100;
const FLIP_MS = 150;
/** Đúng: nảy rồi sang câu mới; tính vào thời gian câu sau nên giữ ≤ 300 ms. */
const SOLVED_MS = 300;
const BOUNCE_SCALE = 1.08;
const SHAKE_MS = 200;
const SHAKE_PX = 8;
const DIM_MS = 120;
const WALL_LIFT_MS = 200;
/** Giảm chuyển động: tường mờ dần 100 ms thay vì trượt. */
const WALL_FADE_MS = 100;
const TALLY_FADE_MS = 120;
/** Nhún bước khi đi (bỏ khi giảm chuyển động): cao 3 px, mỗi bước 26 px. */
const STEP_BOB = { px: 3, stride: 26 } as const;
/** Bạn ngồi nhún nhẹ (thở), chu kỳ 1,6 s. */
const BREATH = { amount: 0.025, ms: 1600 } as const;

const DEPTH = {
  room: 1,
  wall: 2,
  door: 3,
  walkers: 10,
  cards: 20,
  tally: 30,
  icon: 40,
} as const;

// ---------------------------------------------------------------- màu

interface Palette {
  dark: boolean;
  card: string;
  cardFg: string;
  sticker: string;
  primary: string;
  primaryFg: string;
  destructive: string;
  chalk: string;
  board: string;
  wood: string;
  /** Màu nhóm Tính toán: viền trong lớp học, tường trước. */
  compute: string;
  /** Viền phấn quanh nhân vật ở nền tối (`--chalk-muted`), không có ở nền sáng. */
  halo: string | null;
}

function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const dark = style.colorScheme === "dark";
  return {
    dark,
    card: token("--card"),
    cardFg: token("--card-foreground"),
    sticker: token("--sticker"),
    primary: token("--primary"),
    primaryFg: token("--primary-foreground"),
    destructive: token("--destructive"),
    chalk: token("--chalk"),
    board: token("--board"),
    wood: token("--wood"),
    compute: token("--color-compute"),
    halo: dark ? token("--chalk-muted") : null,
  };
}

/** Màu CSS → số màu của Phaser. */
const toColor = (css: string) => Phaser.Display.Color.ValueToColor(css).color;

// ---------------------------------------------------------------- vẽ canvas 2D

/** Nét đứt chia đều theo chu vi để chỗ nối không lệch. */
function evenDash(length: number, [dash, gap]: [number, number]): [number, number] {
  const k = length / Math.max(1, Math.round(length / (dash + gap))) / (dash + gap);
  return [dash * k, gap * k];
}

/** Bàn: mặt bàn + vạt trước (gốc ở giữa mép trên mặt bàn). */
function drawDesk(ctx: Ctx, c: Palette) {
  roundRectPath(ctx, -DESK.front / 2, DESK.topH / 2, DESK.front, DESK.frontH, 6);
  ctx.fillStyle = c.wood;
  ctx.fill();
  ctx.fillStyle = c.sticker;
  ctx.globalAlpha = 0.18;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 3;
  ctx.strokeStyle = c.sticker;
  ctx.stroke();
  roundRectPath(ctx, -DESK.top / 2, -DESK.topH / 2, DESK.top, DESK.topH, 6);
  ctx.fillStyle = c.wood;
  ctx.fill();
  ctx.stroke();
}

/** Bàn chân (vết chân của biểu tượng "đang đi"), tâm (0, 0). */
function drawFootprint(ctx: Ctx, x: number, y: number, angle: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 4, 8, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [tx, ty, r] of [
    [-6, -11, 3.2],
    [-1, -13.5, 3],
    [4, -12.5, 2.7],
    [8, -9, 2.3],
  ] as const) {
    ctx.beginPath();
    ctx.arc(tx, ty, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- scene

type Phase = "show" | "steps" | "input" | "done";
type IconKind = "eye" | "steps" | "hand";

interface SeatView {
  kid: Phaser.GameObjects.Image;
  chair: Phaser.GameObjects.Image;
}

interface CardView {
  /** Mọi lớp của thẻ (mặt, số, vòng, dấu), tâm ở giữa thẻ: lật, nảy, rung, nhấc. */
  box: Phaser.GameObjects.Container;
  face: Phaser.GameObjects.Container;
  digit: Phaser.GameObjects.Text;
  slot: Phaser.GameObjects.Image;
  marks: Phaser.GameObjects.GameObject[];
  hovered: boolean;
  x: number;
  y: number;
}

interface WalkerView {
  image: Phaser.GameObjects.Image;
  walker?: Walker;
}

/** Đếm sĩ số — nhớ sĩ số đầu, cộng bạn vào, trừ bạn ra, chạm số bạn còn trong lớp. */
export default class HeadCountScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private colors!: Palette;
  private reducedMotion = false;

  private phase: Phase = "done";
  private puzzle?: HeadCountPuzzle;
  /** Mốc câu hiện ra (performance.now), đặt ở khung hình đầu tiên của câu; `null` = chưa đặt. */
  private t0: number | null = null;
  /** Lượt đang vẽ người đi (−1 = chưa). */
  private shownStep = -1;
  /** Ẩn tab lúc đang trình chiếu → quay lại thì chiếu lại câu từ đầu. */
  private replayOnVisible = false;
  /** Hẹn giờ của câu hiện tại (sang câu mới); huỷ hết khi sang câu mới hoặc rời màn. */
  private timers: Phaser.Time.TimerEvent[] = [];

  private seats: SeatView[] = [];
  private boardDigit?: Phaser.GameObjects.Text;
  private teacher?: Phaser.GameObjects.Image;
  private teacherCross?: Phaser.GameObjects.Image;
  private wall?: Phaser.GameObjects.Image;
  /** Tiến độ tường che lớp (0 = lớp mở, 1 = che kín), cho tween kéo tường lên. */
  private wallState = { cover: 0 };
  private doorLeaf?: Phaser.GameObjects.Image;
  private walkers: WalkerView[] = [];
  private cards: CardView[] = [];
  private icons?: Record<IconKind, Phaser.GameObjects.Image>;
  private tally?: Phaser.GameObjects.Container;

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.phase = "done";
    this.puzzle = undefined;
    this.t0 = null;
    this.shownStep = -1;
    this.replayOnVisible = false;
    this.timers = [];
    this.seats = [];
    this.walkers = [];
    this.cards = [];
  }

  create() {
    const canvas = this.game.canvas;
    this.colors = readPalette(canvas.isConnected ? canvas : document.documentElement);
    this.reducedMotion = prefersReducedMotion();

    const onHidden = () => {
      if (this.phase === "show" || this.phase === "steps") this.replayOnVisible = true;
    };
    // Ẩn lúc đang chờ chọn thì giữ nguyên. Ẩn giữa trình chiếu thì chiếu lại từ đầu, kể cả khi
    // trình duyệt vẫn chạy khung hình lúc ẩn và câu đã sang pha chọn (chưa chạm gì).
    const onVisible = () => {
      if (this.replayOnVisible && this.phase !== "done") this.restartShow();
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

    this.buildRoom();
    this.buildCorridor();
    this.buildCards();
    this.buildIcon();
    this.showPuzzle();
  }

  override update(time: number) {
    const puzzle = this.puzzle;
    if (puzzle && (this.phase === "show" || this.phase === "steps")) {
      const now = performance.now();
      // Mốc câu đặt ở khung hình đầu tiên sau khi dựng câu (đã vẽ xong texture), không trước.
      if (this.t0 === null) this.t0 = now;
      this.render(puzzle, stageAt(puzzle, now - this.t0));
    }
    if (this.reducedMotion) return;
    // Bạn ngồi thở nhẹ: chỉ đổi scale quanh chân, không đổi vị trí.
    this.seats.forEach((seat, i) => {
      const d = BREATH.amount * 0.5 * (1 - Math.cos((time / BREATH.ms) * Math.PI * 2 + i * 1.7));
      seat.kid.setScale(SEAT.scale, SEAT.scale * (1 + d));
    });
  }

  // -------------------------------------------------------------- dựng phần cố định

  private buildRoom() {
    const c = this.colors;
    this.add
      .image(ROOM.x - 6, ROOM.y - 6, this.roomTexture())
      .setOrigin(0)
      .setDepth(DEPTH.room);

    const room = this.add.container(0, 0).setDepth(DEPTH.room);
    room.add(this.add.image(BOARD.x - 4, BOARD.y - 4, this.boardTexture()).setOrigin(0));
    this.boardDigit = this.digitText(
      BOARD.x + BOARD.w / 2,
      BOARD.y + BOARD.h / 2,
      BOARD.font,
      c.chalk,
    );
    room.add(this.boardDigit);

    // Mỗi bàn: lưng ghế (thấy khi bàn trống), bạn ngồi, mặt bàn che nửa dưới người. Vẽ hàng trên
    // (xa) trước để đầu bạn hàng dưới (gần) đè lên vạt bàn hàng trên.
    const chairKey = this.chairTexture();
    const deskKey = this.deskTexture();
    this.seats = Array.from({ length: 9 }, (_, i) => {
      const x = DESK_X[i % 3] as number;
      const y = DESK_Y[Math.floor(i / 3)] as number;
      const chair = this.add.image(x, y - 6, chairKey).setOrigin(0.5, 1);
      const kid = this.figureImage(this.kidKey(0, "front"), KID_BOX.h)
        .setPosition(x, y + SEAT.feet)
        .setScale(SEAT.scale);
      const desk = this.add.image(x, y, deskKey).setOrigin(0.5, DESK_ORIGIN_Y);
      room.add([chair, kid, desk]);
      return { kid, chair };
    });

    this.teacher = this.figureImage(this.teacherKey("front"), TEACHER_BOX.h)
      .setPosition(TEACHER_SPOT.x, TEACHER_SPOT.y)
      .setScale(TEACHER_SPOT.scale);
    this.teacherCross = this.add.image(
      TEACHER_SPOT.x,
      TEACHER_SPOT.y - (TEACHER_BOX.h * TEACHER_SPOT.scale) / 2,
      this.slashTexture(),
    );
    room.add([this.teacher, this.teacherCross]);

    this.wall = this.add
      .image(ROOM.x - FIG_PAD, ROOM.y - FIG_PAD, this.wallTexture(false))
      .setOrigin(0)
      .setDepth(DEPTH.wall);
    this.doorLeaf = this.add
      .image(DOOR.x, DOOR.y + DOOR.h / 2, this.doorTexture())
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.door)
      .setVisible(false);
  }

  private buildCorridor() {
    const c = this.colors;
    const g = this.add.graphics();
    g.lineStyle(3, toColor(c.sticker), 0.25);
    g.lineBetween(ROOM.x, FLOOR_Y, ROOM.x + ROOM.w, FLOOR_Y);
    this.add.image(ARROWS_BOX.x, ARROWS_BOX.y, this.arrowsTexture()).setOrigin(0);

    // Bể người đi: tối đa 2 vào + 2 ra, hoặc thầy + 2 bạn cùng hướng.
    this.walkers = Array.from({ length: 6 }, () => ({
      image: this.figureImage(this.kidKey(0, "front"), KID_BOX.h)
        .setVisible(false)
        .setDepth(DEPTH.walkers),
    }));
  }

  private buildCards() {
    const c = this.colors;
    const slotKey = this.slotTexture();
    const faceKey = this.cardTexture();
    this.cards = CARD_X.map((left, i) => {
      const x = left + CARD.w / 2;
      const y = CARD.y + CARD.h / 2;
      const slot = this.add.image(x, y, slotKey).setDepth(DEPTH.cards);
      const digit = this.digitText(0, 0, CARD.font, c.cardFg);
      const face = this.add.container(0, 0, [this.add.image(0, CARD.shadow / 2, faceKey), digit]);
      const box = this.add.container(x, y, [face]).setDepth(DEPTH.cards);
      const view: CardView = { box, face, digit, slot, marks: [], hovered: false, x, y };

      // Vùng chạm là cả thẻ (152 × 180 trên khung 720, ~82 px trên điện thoại 390 px).
      const zone = this.add
        .zone(x, y, CARD.w, CARD.h + CARD.shadow)
        .setInteractive({ useHandCursor: true })
        .setDepth(DEPTH.cards + 1);
      zone.on("pointerdown", () => this.answer(i));
      // Máy tính: rê chuột lên thẻ thì thẻ nhấc lên; chuột đã nằm sẵn trên thẻ lúc thẻ hiện thì
      // nhấc ở lần nhích chuột kế tiếp (không có "over" mới).
      const hover = (pointer: Phaser.Input.Pointer) => {
        if (this.phase === "input" && !pointer.wasTouch) this.setHover(view, true);
      };
      zone.on("pointerover", hover);
      zone.on("pointermove", hover);
      zone.on("pointerout", () => this.setHover(view, false));
      return view;
    });
    // Chuột rời hẳn canvas thì không có "out" trên thẻ.
    this.input.on(Phaser.Input.Events.GAME_OUT, () => {
      for (const card of this.cards) this.setHover(card, false);
    });
  }

  private buildIcon() {
    this.add.image(PHASE_ICON.x, PHASE_ICON.y, this.iconBgTexture()).setDepth(DEPTH.icon);
    const make = (key: string) =>
      this.add.image(PHASE_ICON.x, PHASE_ICON.y, key).setDepth(DEPTH.icon).setVisible(false);
    this.icons = {
      eye: make(this.eyeTexture()),
      steps: make(this.stepsTexture()),
      hand: make(this.handTexture()),
    };
  }

  // -------------------------------------------------------------- câu đố

  private showPuzzle() {
    this.clearTimers();
    this.tweens.killAll();
    this.tally?.destroy();
    this.tally = undefined;

    const puzzle = headCount.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    this.puzzle = puzzle;

    puzzle.options.forEach((n, i) => {
      const card = this.cards[i];
      if (!card) return;
      for (const mark of card.marks) mark.destroy();
      card.marks = [];
      card.hovered = false;
      card.box.setPosition(card.x, card.y).setScale(1).setAlpha(1);
      card.digit.setText(String(n));
    });
    this.setRoom(puzzle.start, puzzle.teacherAtStart, false);
    this.restartShow();
  }

  /**
   * Chiếu (lại) câu hiện tại từ đầu: mốc mới ở khung hình kế tiếp, lớp mở, chưa ai đi, thẻ về khung
   * nét đứt. Dùng cả khi quay lại tab giữa lúc trình chiếu (người chơi đã lỡ lượt).
   */
  private restartShow() {
    this.phase = "show";
    this.t0 = null;
    this.shownStep = -1;
    if (this.doorLeaf) this.tweens.killTweensOf(this.doorLeaf);
    this.doorLeaf?.setVisible(false);
    this.wall?.setTexture(this.wallTexture(false));
    this.setWallCover(0);
    this.hideWalkers();
    this.setIcon("eye");
    for (const card of this.cards) {
      this.tweens.killTweensOf(card.face);
      this.setHover(card, false);
      card.face.setVisible(false).setScale(1);
      card.slot.setVisible(true);
    }
  }

  /**
   * Lớp học: `count` bạn ngồi theo thứ tự cố định, bảng ghi `count`; thầy đứng cạnh bảng nếu
   * `teacher` (khi `crossed`: mờ 50 % và gạch chéo, nhắc thầy không tính).
   */
  private setRoom(count: number, teacher: boolean, crossed: boolean) {
    const look = this.index * 5;
    const occupied = new Set<number>(SEAT_ORDER.slice(0, count));
    this.seats.forEach((seat, i) => {
      const on = occupied.has(i);
      seat.kid.setVisible(on);
      seat.chair.setVisible(!on);
      if (on) seat.kid.setTexture(this.kidKey(look + i, "front"));
    });
    this.boardDigit?.setText(String(count));
    this.teacher?.setVisible(teacher).setAlpha(crossed ? TEACHER_GHOST : 1);
    this.teacherCross?.setVisible(teacher && crossed);
  }

  // -------------------------------------------------------------- trình chiếu (theo `t`)

  private render(puzzle: HeadCountPuzzle, stage: Stage) {
    if (stage.kind === "show") {
      this.setWallCover(stage.wall);
      return;
    }
    if (stage.kind === "input") {
      this.beginInput();
      return;
    }
    if (this.phase === "show") {
      this.phase = "steps";
      this.setWallCover(1);
      this.setIcon("steps");
    }
    if (stage.k !== this.shownStep) this.assignWalkers(puzzle, stage.k);
    for (const view of this.walkers) {
      const pose = view.walker ? poseAt(view.walker, stage.walk) : null;
      if (!pose) {
        view.image.setVisible(false);
        continue;
      }
      const bob = this.reducedMotion
        ? 0
        : STEP_BOB.px * Math.abs(Math.sin((pose.dist / STEP_BOB.stride) * Math.PI));
      view.image
        .setVisible(true)
        .setPosition(pose.x, pose.y - bob)
        .setAlpha(pose.alpha)
        .setScale(pose.scale)
        .setDepth(DEPTH.walkers + pose.y / 10_000);
    }
  }

  /** Gán hình cho người đi lượt `k`: bạn vào quay lưng (thấy cặp), bạn ra quay mặt. */
  private assignWalkers(puzzle: HeadCountPuzzle, k: number) {
    this.shownStep = k;
    const event = puzzle.events[k];
    const list = event ? walkersOf(event) : [];
    this.walkers.forEach((view, i) => {
      const walker = list[i];
      view.walker = walker;
      view.image.setVisible(false);
      if (!walker) return;
      const facing: Facing = walker.dir === "in" ? "back" : "front";
      const key = walker.teacher
        ? this.teacherKey(facing)
        : this.kidKey(this.index * 3 + k * 2 + i, facing);
      const box = walker.teacher ? TEACHER_BOX.h : KID_BOX.h;
      view.image.setTexture(key).setOrigin(0.5, (FIG_PAD + box) / (box + 2 * FIG_PAD));
    });
  }

  private hideWalkers() {
    for (const view of this.walkers) {
      view.walker = undefined;
      view.image.setVisible(false);
    }
  }

  /**
   * Tường trước che `cover` (0…1) lớp, trượt từ mép trên lớp xuống: chỉ hiện phần dưới của
   * texture tường ở đầu lớp. Giảm chuyển động: tường không trượt mà hiện dần (mờ 100 ms cuối).
   */
  private setWallCover(cover: number) {
    const wall = this.wall;
    if (!wall) return;
    this.wallState.cover = cover;
    if (this.reducedMotion) {
      const fade = WALL_FADE_MS / WALL_DROP_MS;
      const alpha = Phaser.Math.Clamp((cover - (1 - fade)) / fade, 0, 1);
      wall
        .setCrop()
        .setY(ROOM.y - FIG_PAD)
        .setAlpha(alpha)
        .setVisible(alpha > 0);
      return;
    }
    const full = wall.frame.height;
    const shown = Math.round(full * cover);
    wall.setAlpha(1).setVisible(shown > 0);
    if (shown <= 0) return;
    wall.setCrop(0, full - shown, wall.frame.width, shown);
    wall.setY(ROOM.y - FIG_PAD - (full - shown));
  }

  private beginInput() {
    if (this.phase !== "show" && this.phase !== "steps") return;
    this.phase = "input";
    this.hideWalkers();
    this.setWallCover(1);
    this.setIcon("hand");
    this.closeDoor();
    for (const card of this.cards) this.flipIn(card);
  }

  /** Cửa đóng trong 100 ms: lá cửa quay từ dải hẹp bên bản lề ra phủ kín cửa. */
  private closeDoor() {
    const leaf = this.doorLeaf;
    const closed = () => {
      leaf?.setVisible(false);
      this.wall?.setTexture(this.wallTexture(true));
      this.setWallCover(1);
    };
    if (!leaf || this.reducedMotion) {
      closed();
      return;
    }
    leaf.setVisible(true).setScale(OPEN_LEAF, 1);
    this.tweens.add({
      targets: leaf,
      scaleX: 1,
      duration: DOOR_CLOSE_MS,
      ease: "Quad.easeIn",
      onComplete: closed,
    });
  }

  /** Thẻ lật hiện số (≤ 150 ms); giảm chuyển động: hiện ngay. */
  private flipIn(card: CardView) {
    card.slot.setVisible(false);
    card.face.setVisible(true);
    if (this.reducedMotion) return;
    card.face.setScale(0, 1);
    this.tweens.add({ targets: card.face, scaleX: 1, duration: FLIP_MS, ease: "Quad.easeOut" });
  }

  // -------------------------------------------------------------- trả lời

  private setHover(card: CardView, on: boolean) {
    if (card.hovered === on) return;
    card.hovered = on;
    card.box.y = card.y - (on ? HOVER_LIFT : 0);
  }

  private answer(choice: number) {
    const puzzle = this.puzzle;
    // Trước khi cửa đóng (và sau khi đã chạm) bỏ qua mọi lần chạm, không tính sai.
    if (this.phase !== "input" || !puzzle) return;
    this.phase = "done";
    for (const card of this.cards) this.setHover(card, false);

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const index = this.index;
    this.bridge.submit(index, choice);
    this.index += 1;
    const picked = this.cards[choice];
    const right = this.cards[puzzle.answerIndex];
    if (!picked || !right) return;

    if (headCount.check(puzzle, choice)) {
      this.markRight(right, true);
      this.after(SOLVED_MS, () => this.showPuzzle());
      return;
    }

    this.showMiss(puzzle, picked, right);
    // Hết khoá theo `lockedUntil` của server (không tự đếm) để khớp huy hiệu khoá của khung.
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive() || this.index !== index + 1) return;
      this.after(ms, () => this.showPuzzle());
    });
  }

  /** Thẻ đúng: vòng vàng dày quanh thẻ (+ dấu tích khi chạm đúng, nảy nhẹ). */
  private markRight(card: CardView, solved: boolean) {
    const ring = this.add.image(0, CARD.shadow / 2, this.ringTexture());
    card.box.addAt(ring, 0);
    card.marks.push(ring);
    if (solved) {
      const badge = this.add.image(CARD.w / 2 - 8, -CARD.h / 2 + 8, this.checkTexture());
      card.box.add(badge);
      card.marks.push(badge);
    }
    if (this.reducedMotion || !solved) return;
    this.tweens.add({
      targets: card.box,
      scale: BOUNCE_SCALE,
      duration: SOLVED_MS / 2,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  /**
   * Sai (CR-006), suốt lúc khoá: tường kéo lên cho thấy lớp với đúng số bạn còn lại, bảng ghi số
   * đúng; thầy còn trong lớp thì mờ 50 % và bị gạch. Thẻ đúng có vòng vàng, thẻ chạm sai có dấu X
   * và rung, hai thẻ kia mờ 35 %. Dải dưới tường liệt kê các bước (vd. 3 +2 −1 +1 = 5). Mọi thứ
   * nằm dưới y 260, không bị huy hiệu khoá ở dải trên cùng che.
   */
  private showMiss(puzzle: HeadCountPuzzle, picked: CardView, right: CardView) {
    const answer = puzzle.options[puzzle.answerIndex] ?? 0;
    this.setRoom(answer, teacherInsideAtEnd(puzzle), true);
    this.setIcon("eye");
    this.liftWall();

    this.markRight(right, false);
    for (const card of this.cards) {
      if (card === picked || card === right) continue;
      if (this.reducedMotion) card.box.setAlpha(DIM_ALPHA);
      else this.tweens.add({ targets: card.box, alpha: DIM_ALPHA, duration: DIM_MS });
    }
    const cross = this.add.image(0, 0, this.crossTexture());
    picked.box.add(cross);
    picked.marks.push(cross);
    this.shake(picked);
    this.showTally(puzzle);
  }

  private liftWall() {
    // Cửa đang đóng dở thì đóng hẳn trước khi kéo tường.
    if (this.doorLeaf?.visible) {
      this.tweens.killTweensOf(this.doorLeaf);
      this.doorLeaf.setVisible(false);
      this.wall?.setTexture(this.wallTexture(true));
    }
    if (this.reducedMotion) {
      this.wall
        ?.setCrop()
        .setY(ROOM.y - FIG_PAD)
        .setVisible(true)
        .setAlpha(1);
      this.tweens.add({
        targets: this.wall,
        alpha: 0,
        duration: WALL_FADE_MS,
        onComplete: () => this.wall?.setVisible(false),
      });
      return;
    }
    this.wallState.cover = 1;
    this.tweens.add({
      targets: this.wallState,
      cover: 0,
      duration: WALL_LIFT_MS,
      ease: "Quad.easeIn",
      onUpdate: () => this.setWallCover(this.wallState.cover),
    });
  }

  /** Rung ngang ±8 px trong 200 ms (bỏ khi giảm chuyển động). */
  private shake(card: CardView) {
    if (this.reducedMotion) return;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: SHAKE_MS,
      onUpdate: (tween) => {
        card.box.x = card.x + SHAKE_PX * Math.sin((tween.getValue() ?? 0) * Math.PI * 4);
      },
      onComplete: () => {
        card.box.x = card.x;
      },
    });
  }

  /**
   * Dải các bước: [sĩ số đầu] [+vào −ra mỗi lượt] = [đáp án], lấy từ `headCountTally`. Lượt chỉ
   * có thầy ghi 0 (thầy không tính). Chỉ có số và dấu, không có chữ.
   */
  private showTally(puzzle: HeadCountPuzzle) {
    const c = this.colors;
    const tally = headCountTally(puzzle);
    const tokens: { text: string; fill: string | null; ink: string }[] = [
      { text: String(tally[0]), fill: c.board, ink: c.chalk },
      ...puzzle.events.map((e) => {
        const parts = [e.in ? `+${e.in}` : "", e.out ? `−${e.out}` : ""].join("");
        return { text: parts || "0", fill: c.card, ink: c.cardFg };
      }),
      { text: "=", fill: null, ink: c.cardFg },
      { text: String(tally[tally.length - 1]), fill: c.primary, ink: c.primaryFg },
    ];

    // Mỗi ô: chữ số + nền (nếu có), gốc ở giữa ô.
    const cells = tokens.map((token) => {
      const text = this.add
        .text(0, 1, token.text, {
          fontFamily: '"Baloo 2", sans-serif',
          fontSize: `${TALLY.font}px`,
          fontStyle: "800",
          color: token.ink,
        })
        .setOrigin(0.5);
      const w = token.fill ? Math.max(TALLY.h - 6, text.width + 2 * TALLY.padX) : text.width;
      const cell = this.add.container(0, 0);
      if (token.fill) {
        const chip = this.add.graphics();
        chip.fillStyle(toColor(token.fill));
        chip.fillRoundedRect(-w / 2, -TALLY.h / 2, w, TALLY.h, TALLY.radius);
        chip.lineStyle(TALLY.border, toColor(c.sticker));
        chip.strokeRoundedRect(-w / 2, -TALLY.h / 2, w, TALLY.h, TALLY.radius);
        cell.add(chip);
      }
      cell.add(text);
      return { cell, w };
    });

    // Một dòng nếu vừa, không thì hai dòng (ngắt ở ô gần giữa nhất), mỗi dòng căn giữa.
    const widthOf = (list: typeof cells) =>
      list.reduce((sum, { w }) => sum + w, 0) + TALLY.gap * Math.max(0, list.length - 1);
    let lines = [cells];
    if (widthOf(cells) > TALLY.maxW) {
      let best = 1;
      for (let i = 1; i < cells.length; i++) {
        const diff = Math.abs(widthOf(cells.slice(0, i)) - widthOf(cells.slice(i)));
        if (diff < Math.abs(widthOf(cells.slice(0, best)) - widthOf(cells.slice(best)))) best = i;
      }
      lines = [cells.slice(0, best), cells.slice(best)];
    }
    const widest = Math.max(...lines.map(widthOf));
    const scale = Math.min(1, TALLY.maxW / widest);
    const pitch = TALLY.h + TALLY.lineGap;
    const row = this.add.container(360, TALLY.y).setScale(scale).setDepth(DEPTH.tally);
    lines.forEach((line, n) => {
      let x = -widthOf(line) / 2;
      const y = (n - (lines.length - 1) / 2) * pitch;
      for (const { cell, w } of line) {
        row.add(cell.setPosition(x + w / 2, y));
        x += w + TALLY.gap;
      }
    });
    this.tally = row;
    if (!this.reducedMotion) {
      row.setAlpha(0);
      this.tweens.add({ targets: row, alpha: 1, duration: TALLY_FADE_MS });
    }
  }

  // -------------------------------------------------------------- tiện ích

  private setIcon(kind: IconKind) {
    if (!this.icons) return;
    for (const [name, image] of Object.entries(this.icons)) image.setVisible(name === kind);
  }

  private digitText(x: number, y: number, size: number, color: string) {
    return this.add
      .text(x, y, "", {
        fontFamily: '"Baloo 2", sans-serif',
        fontSize: `${size}px`,
        fontStyle: "800",
        color,
      })
      .setOrigin(0.5);
  }

  private after(ms: number, callback: () => void) {
    this.timers.push(this.time.delayedCall(ms, callback));
  }

  private clearTimers() {
    for (const timer of this.timers) timer.remove(false);
    this.timers = [];
  }

  // -------------------------------------------------------------- texture

  /** Tạo texture từ canvas 2D nếu chưa có; trả về khoá. */
  private texture(name: string, w: number, h: number, draw: (ctx: Ctx) => void): string {
    const key = `head-count:${name}:${this.colors.dark ? "dark" : "light"}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, makeCanvas(w, h, draw));
    return key;
  }

  /** Hình người (gốc ở chân), đặt origin ở chân. */
  private figureImage(key: string, boxH: number) {
    return this.add.image(0, 0, key).setOrigin(0.5, (FIG_PAD + boxH) / (boxH + 2 * FIG_PAD));
  }

  private figureTexture(name: string, box: { w: number; h: number }, art: ReactNode) {
    const w = box.w + 2 * FIG_PAD;
    const h = box.h + 2 * FIG_PAD;
    const key = `head-count:${name}:${this.colors.dark ? "dark" : "light"}`;
    if (this.textures.exists(key)) return key;
    const canvas = makeCanvas(w, h, (ctx) => {
      ctx.translate(w / 2, FIG_PAD + box.h);
      drawSvg(ctx, art);
    });
    const halo = this.colors.halo;
    this.textures.addCanvas(key, halo ? withHalo(canvas, HALO_PX, halo) : canvas);
    return key;
  }

  private kidKey(look: number, facing: Facing) {
    const i = ((look % KID_LOOKS) + KID_LOOKS) % KID_LOOKS;
    return this.figureTexture(`kid-${i}-${facing}`, KID_BOX, kidArt(i, facing));
  }

  private teacherKey(facing: Facing) {
    return this.figureTexture(`teacher-${facing}`, TEACHER_BOX, teacherArt(facing));
  }

  /** Khung lớp: bóng đổ, giấy, viền mực, viền trong màu nhóm Tính toán. */
  private roomTexture() {
    const c = this.colors;
    const pad = 6;
    return this.texture("room", ROOM.w + 2 * pad, ROOM.h + ROOM.shadow + 2 * pad, (ctx) => {
      ctx.translate(pad, pad);
      roundRectPath(ctx, 0, ROOM.shadow, ROOM.w, ROOM.h, ROOM.radius);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      roundRectPath(ctx, 0, 0, ROOM.w, ROOM.h, ROOM.radius);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.lineWidth = ROOM.border;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      const i = ROOM_RIM.inset;
      roundRectPath(ctx, i, i, ROOM.w - 2 * i, ROOM.h - 2 * i, ROOM_RIM.radius);
      ctx.lineWidth = ROOM_RIM.width;
      ctx.strokeStyle = c.compute;
      ctx.stroke();
    });
  }

  /** Bảng đen viền gỗ (số vẽ bằng chữ Text đè lên). */
  private boardTexture() {
    const c = this.colors;
    return this.texture("board", BOARD.w + 8, BOARD.h + 8, (ctx) => {
      ctx.translate(4, 4);
      roundRectPath(ctx, 0, 0, BOARD.w, BOARD.h, BOARD.radius);
      ctx.fillStyle = c.board;
      ctx.fill();
      ctx.lineWidth = BOARD.frame;
      ctx.strokeStyle = c.wood;
      ctx.stroke();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = c.sticker;
      roundRectPath(
        ctx,
        -BOARD.frame / 2,
        -BOARD.frame / 2,
        BOARD.w + BOARD.frame,
        BOARD.h + BOARD.frame,
        BOARD.radius + 3,
      );
      ctx.stroke();
    });
  }

  private deskTexture() {
    const c = this.colors;
    const w = DESK.top + 6;
    const h = DESK.topH + DESK.frontH + 6;
    return this.texture("desk", w, h, (ctx) => {
      ctx.translate(w / 2, DESK.topH / 2 + 3);
      drawDesk(ctx, c);
    });
  }

  /** Lưng ghế trống: thấy rõ bàn nào chưa có bạn. */
  private chairTexture() {
    const c = this.colors;
    return this.texture("chair", 50, 34, (ctx) => {
      roundRectPath(ctx, 4, 3, 42, 30, 8);
      ctx.fillStyle = c.wood;
      ctx.globalAlpha = 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
    });
  }

  /** Gạch chéo lên thầy (thầy không tính): nét đỏ viền phấn. */
  private slashTexture() {
    const c = this.colors;
    return this.texture("slash", 110, 150, (ctx) => {
      const line = new Path2D("M20 20 L90 130");
      ctx.lineWidth = 18;
      ctx.strokeStyle = c.chalk;
      ctx.stroke(line);
      ctx.lineWidth = 10;
      ctx.strokeStyle = c.destructive;
      ctx.stroke(line);
    });
  }

  /**
   * Tường trước phủ đúng lớp: màu nhóm Tính toán, viền mực, vân ván ngang, chân tường. Cửa mở:
   * lòng cửa tối, lá cửa là dải hẹp bên bản lề; cửa đóng: lá cửa gỗ phủ kín, có núm.
   */
  private wallTexture(closed: boolean) {
    const c = this.colors;
    const pad = FIG_PAD;
    return this.texture(
      closed ? "wall-closed" : "wall-open",
      ROOM.w + 2 * pad,
      ROOM.h + 2 * pad,
      (ctx) => {
        ctx.translate(pad - ROOM.x, pad - ROOM.y);
        roundRectPath(ctx, ROOM.x, ROOM.y, ROOM.w, ROOM.h, ROOM.radius);
        ctx.fillStyle = c.compute;
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = c.sticker;
        ctx.globalAlpha = 0.14;
        ctx.lineWidth = 3;
        for (let y = ROOM.y + 56; y < ROOM.y + ROOM.h - 30; y += 56) {
          ctx.beginPath();
          ctx.moveTo(ROOM.x, y);
          ctx.lineTo(ROOM.x + ROOM.w, y);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = c.sticker;
        ctx.fillRect(ROOM.x, ROOM.y + ROOM.h - 26, ROOM.w, 26);
        ctx.restore();
        roundRectPath(ctx, ROOM.x, ROOM.y, ROOM.w, ROOM.h, ROOM.radius);
        ctx.lineWidth = ROOM.border;
        ctx.strokeStyle = c.sticker;
        ctx.stroke();

        // Khung cửa gỗ (không có bậu dưới: lối đi).
        ctx.beginPath();
        ctx.moveTo(DOOR.x, DOOR.y + DOOR.h);
        ctx.lineTo(DOOR.x, DOOR.y);
        ctx.lineTo(DOOR.x + DOOR.w, DOOR.y);
        ctx.lineTo(DOOR.x + DOOR.w, DOOR.y + DOOR.h);
        ctx.lineWidth = DOOR.frame + 5;
        ctx.strokeStyle = c.sticker;
        ctx.stroke();
        ctx.lineWidth = DOOR.frame;
        ctx.strokeStyle = c.wood;
        ctx.stroke();
        if (closed) {
          ctx.save();
          ctx.translate(DOOR.x, DOOR.y);
          this.drawDoorLeaf(ctx);
          ctx.restore();
          return;
        }
        ctx.fillStyle = c.sticker;
        ctx.globalAlpha = 0.88;
        ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.translate(DOOR.x, DOOR.y);
        ctx.scale(OPEN_LEAF, 1);
        this.drawDoorLeaf(ctx);
        ctx.restore();
      },
    );
  }

  /** Lá cửa đóng (gốc ở góc trái trên cửa), dùng cho tường cửa đóng và lúc cửa đang đóng. */
  private drawDoorLeaf(ctx: Ctx) {
    const c = this.colors;
    ctx.fillStyle = c.wood;
    ctx.fillRect(0, 0, DOOR.w, DOOR.h);
    ctx.lineWidth = 3;
    ctx.strokeStyle = c.sticker;
    ctx.strokeRect(0, 0, DOOR.w, DOOR.h);
    ctx.globalAlpha = 0.35;
    roundRectPath(ctx, 14, 14, DOOR.w - 28, 74, 6);
    ctx.stroke();
    roundRectPath(ctx, 14, 104, DOOR.w - 28, 82, 6);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(DOOR.w - 18, 100, 7, 0, Math.PI * 2);
    ctx.fillStyle = c.primary;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  private doorTexture() {
    return this.texture("door", DOOR.w, DOOR.h, (ctx) => this.drawDoorLeaf(ctx));
  }

  /** Mũi tên phấn mờ trên sàn hành lang (toạ độ khung, trong hộp `ARROWS_BOX`). */
  private arrowsTexture() {
    const c = this.colors;
    return this.texture("arrows", ARROWS_BOX.w, ARROWS_BOX.h, (ctx) => {
      ctx.translate(-ARROWS_BOX.x, -ARROWS_BOX.y);
      ctx.strokeStyle = c.cardFg;
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 7;
      for (const d of [ARROW_IN, ARROW_IN_HEAD, ARROW_OUT, ARROW_OUT_HEAD]) {
        ctx.stroke(new Path2D(d));
      }
    });
  }

  /** Khung nét đứt rỗng của thẻ trong lúc trình chiếu. */
  private slotTexture() {
    const c = this.colors;
    return this.texture("slot", CARD.w + 8, CARD.h + CARD.shadow + 8, (ctx) => {
      ctx.translate(4, 4 + CARD.shadow / 2);
      roundRectPath(ctx, 2, 2, CARD.w - 4, CARD.h - 4, CARD.radius);
      ctx.setLineDash(evenDash(2 * (CARD.w + CARD.h) - 8, [14, 10]));
      ctx.lineCap = "butt";
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.cardFg;
      ctx.globalAlpha = 0.35;
      ctx.stroke();
    });
  }

  /** Mặt thẻ: bóng đổ, giấy, viền mực (số là chữ Text đè lên). */
  private cardTexture() {
    const c = this.colors;
    const pad = 4;
    return this.texture("card", CARD.w + 2 * pad, CARD.h + CARD.shadow + 2 * pad, (ctx) => {
      ctx.translate(pad, pad);
      roundRectPath(ctx, 0, CARD.shadow, CARD.w, CARD.h, CARD.radius);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      roundRectPath(ctx, 0, 0, CARD.w, CARD.h, CARD.radius);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.lineWidth = CARD.border;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
    });
  }

  /** Vòng vàng dày quanh thẻ đúng, viền mực hai bên. */
  private ringTexture() {
    const c = this.colors;
    const out = 14;
    const w = CARD.w + 2 * out + 8;
    const h = CARD.h + CARD.shadow + 2 * out + 8;
    return this.texture("ring", w, h, (ctx) => {
      roundRectPath(ctx, 4 + out / 2, 4 + out / 2, w - 8 - out, h - 8 - out, CARD.radius + 8);
      ctx.lineWidth = 15;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      ctx.lineWidth = 9;
      ctx.strokeStyle = c.primary;
      ctx.stroke();
    });
  }

  /** Huy hiệu ✓ ở góc trên phải thẻ chạm đúng. */
  private checkTexture() {
    const c = this.colors;
    return this.texture("check", 64, 64, (ctx) => {
      ctx.translate(32, 32);
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fillStyle = c.primary;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.stroke(new Path2D("M-12 1 L-3 10 L13 -9"));
    });
  }

  /** Dấu X hai nét trên thẻ chạm sai: đỏ báo lỗi, viền phấn trắng. */
  private crossTexture() {
    const c = this.colors;
    const a = 40;
    return this.texture("cross", 2 * a + 30, 2 * a + 30, (ctx) => {
      ctx.translate(a + 15, a + 15);
      const cross = new Path2D(`M${-a} ${-a} L${a} ${a} M${a} ${-a} L${-a} ${a}`);
      ctx.lineWidth = 24;
      ctx.strokeStyle = c.chalk;
      ctx.stroke(cross);
      ctx.lineWidth = 13;
      ctx.strokeStyle = c.destructive;
      ctx.stroke(cross);
    });
  }

  /** Nền tròn của biểu tượng pha: giấy viền mực, bóng đổ. */
  private iconBgTexture() {
    const c = this.colors;
    const r = PHASE_ICON.r;
    return this.texture("icon", 2 * r + 12, 2 * r + 18, (ctx) => {
      ctx.translate(r + 6, r + 6);
      ctx.beginPath();
      ctx.arc(0, 6, r, 0, Math.PI * 2);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
    });
  }

  /** Pha xem lớp: con mắt. */
  private eyeTexture() {
    const c = this.colors;
    return this.texture("eye", 2 * PHASE_ICON.r + 12, 2 * PHASE_ICON.r + 18, (ctx) => {
      ctx.translate(PHASE_ICON.r + 6, PHASE_ICON.r + 6);
      ctx.scale(0.82, 0.82);
      const eye = new Path2D(EYE_PATH);
      ctx.fillStyle = c.card;
      ctx.fill(eye);
      ctx.lineWidth = 6;
      ctx.strokeStyle = c.cardFg;
      ctx.stroke(eye);
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fillStyle = c.compute;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = c.sticker;
      ctx.fill();
    });
  }

  /** Các lượt: hai vết chân. */
  private stepsTexture() {
    const c = this.colors;
    return this.texture("steps", 2 * PHASE_ICON.r + 12, 2 * PHASE_ICON.r + 18, (ctx) => {
      ctx.translate(PHASE_ICON.r + 6, PHASE_ICON.r + 6);
      drawFootprint(ctx, -11, 9, -14, c.cardFg);
      drawFootprint(ctx, 12, -9, 14, c.cardFg);
    });
  }

  /** Chờ chọn: ngón tay chỉ. */
  private handTexture() {
    const c = this.colors;
    return this.texture("hand", 2 * PHASE_ICON.r + 12, 2 * PHASE_ICON.r + 18, (ctx) => {
      ctx.translate(PHASE_ICON.r + 6, PHASE_ICON.r + 6);
      ctx.scale(3, 3);
      ctx.translate(-12.3, -12);
      const hand = new Path2D(HAND_PATH);
      ctx.fillStyle = c.card;
      ctx.fill(hand);
      ctx.lineWidth = 1.9;
      ctx.strokeStyle = c.cardFg;
      ctx.stroke(hand);
    });
  }
}
