import {
  PAIR_FLIP_TIMING,
  type PairFlipItem,
  type PairFlipPuzzle,
  pairFlip,
  pairFlipInputMs,
  pairFlipLastPair,
  WRONG_ANSWER_LOCK_MS,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { type ArtPart, ITEM_ART } from "../balance/items";
import { EYE_PATH, HAND_PATH } from "../light-trail/shapes";
import type { MinigameBridge } from "../types";

/*
 * Lật cặp — đặc tả: docs/04-minigames/pair-flip.md (mục "Ghi chú cho FE").
 * Bản mẫu: canvas Brain Rizz, trang Minigame, hàng M11 (PairFlipMobile/Levels/States).
 * Scene không vẽ chữ: chỉ có hình vật, biểu tượng, chấm và dấu. Hình vật dùng chung với Cân não.
 *
 * Thẻ của một bàn sống qua mọi câu của bàn đó (bàn chỉ đổi khi `step === 0`), nên hiệu ứng khớp
 * cặp của câu trước chạy song song với lúc lật thẻ đề của câu sau.
 */

// ---------------------------------------------------------------- bố cục (khung 720×1280)

/** Cỡ bàn theo mức, lấy từ bảng Bố cục của đặc tả. */
interface BoardLayout {
  key: string;
  /** Cỡ thẻ = vùng chạm. */
  w: number;
  h: number;
  radius: number;
  /** Tâm cột, tâm hàng. */
  xs: number[];
  ys: number[];
  /** Chiều cao khung bàn (từ y = 316). */
  frameH: number;
  /** Tỉ lệ hình vật (vật cỡ 1 ~ 100 px). */
  item: number;
  /** Tỉ lệ nét phụ (não, dấu ?, X, huy hiệu) so với thẻ 132×212. */
  scale: number;
}

const COLS_4 = [126, 282, 438, 594];

const SPROUT: BoardLayout = {
  key: "s",
  w: 180,
  h: 248,
  radius: 24,
  xs: [150, 360, 570],
  ys: [464, 742],
  frameH: 574,
  item: 1.4,
  scale: 1.36,
};
const NORMAL: BoardLayout = {
  key: "n",
  w: 132,
  h: 212,
  radius: 20,
  xs: COLS_4,
  ys: [446, 682],
  frameH: 496,
  item: 1,
  scale: 1,
};
const HARD: BoardLayout = {
  key: "h",
  w: 132,
  h: 184,
  radius: 20,
  xs: COLS_4,
  ys: [432, 640, 848],
  frameH: 648,
  item: 1,
  scale: 1,
};
const EXPERT: BoardLayout = {
  key: "x",
  w: 132,
  h: 164,
  radius: 18,
  xs: COLS_4,
  ys: [422, 606, 790, 974],
  frameH: 764,
  item: 0.92,
  scale: 0.95,
};

function layoutFor(puzzle: Pick<PairFlipPuzzle, "cols" | "rows">): BoardLayout {
  if (puzzle.cols === 3) return SPROUT;
  if (puzzle.rows <= 2) return NORMAL;
  return puzzle.rows === 3 ? HARD : EXPERT;
}

const FRAME = { x: 36, y: 316, w: 648, radius: 36 };
/** Huy hiệu trạng thái Ø112, tâm (360, 150); vòng giờ xem trước bán kính 70. */
const STATUS_X = 360;
const STATUS_Y = 150;
const STATUS_R = 56;
const TIMER_R = 70;
const TIMER_W = 8;
/** Dải chấm: Ø28, tâm cách nhau 48. */
const DOT_Y = 250;
const DOT_PITCH = 48;
/** Thanh khoá 420×14, chỉ hiện khi sai. */
const LOCK_BAR = { x: 150, y: 1149, w: 420, h: 14 };
/** Bóng dưới của thẻ và khung. */
const CARD_SHADOW = 6;
/** Vòng vàng cách mép thẻ 7 px. */
const RING_GAP = 7;

// ---------------------------------------------------------------- nhịp hiệu ứng (đều ≤ 400 ms)

const FLIP_MS = 300;
const DEAL_FLY_MS = 260;
const POP_MS = 150;
const MATCH_MS = 300;
const MATCH_FADE_MS = 150;
const SHAKE_MS = 200;
const CROSS_IN_MS = 120;
const DIM_MS = 150;
const HOVER_MS = 80;
const HOVER_LIFT = 6;
/** Bàn mờ khi khoá sau câu sai; thẻ đã xong mờ sẵn. */
const DIM_ALPHA = 0.35;
const CLEARED_ALPHA = 0.45;
const MATCH_PEAK = 1.15;
const MATCH_SCALE = 1.08;
const LAST_PAIR_SCALE = 1.06;

// ---------------------------------------------------------------- hình

/** Não trên mặt úp (khung ~184×150, tâm ở (112, 93)), lấy từ bản mẫu. */
const BRAIN_PATH =
  "M60 150 C30 150 18 125 28 105 C12 92 18 62 42 58 C44 34 70 22 92 32 C104 14 136 14 146 32 C170 24 196 42 192 66 C212 78 210 110 192 120 C198 142 178 160 156 154 C146 170 118 172 106 158 C94 168 70 166 60 150 Z";
/** Sao lấp lánh khi cặp cuối tự lật, tâm (0, 0), rộng 40. */
const SPARK_PATH = "M0 -20 C2 -6 6 -2 20 0 C6 2 2 6 0 20 C-2 6 -6 2 -20 0 C-6 -2 -2 -6 0 -20 Z";
/** Dấu tích của huy hiệu xong bàn. */
const DONE_PATH = "M-24 2 L-7 19 L25 -17";
/** Dấu tích trong huy hiệu khớp cặp ở góc thẻ. */
const OK_PATH = "M-12 1 L-3 10 L13 -9";
/** Vạch nảy phía trên huy hiệu trạng thái. */
const BURST_PATH = "M0 -68 L0 -82 M-33 -60 L-42 -70 M33 -60 L42 -70";

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
  chalkMuted: string;
  destructive: string;
  /** Màu nhóm Ghi nhớ: viền trong khung bàn, khung trong mặt úp, mống mắt. */
  memorize: string;
  dark: boolean;
}

function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    card: token("--card"),
    cardFg: token("--card-foreground"),
    muted: token("--muted"),
    sticker: token("--sticker"),
    primary: token("--primary"),
    primaryFg: token("--primary-foreground"),
    chalk: token("--chalk"),
    chalkMuted: token("--chalk-muted"),
    destructive: token("--destructive"),
    memorize: token("--color-memorize"),
    dark: style.colorScheme === "dark",
  };
}

/** Màu CSS → số màu của Phaser. */
const toColor = (css: string) => Phaser.Display.Color.ValueToColor(css).color;

/** Đọc `prefers-reduced-motion`: bỏ bay vào, lắc, nảy, phóng to; lật thẻ thành đổi mặt tức thì. */
function prefersReducedMotion() {
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

// ---------------------------------------------------------------- vẽ texture bằng canvas 2D

type Ctx = CanvasRenderingContext2D;

/** Hình chữ nhật bo góc, tâm (cx, cy). */
function roundRectPath(ctx: Ctx, w: number, h: number, r: number, cx = 0, cy = 0) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circlePath(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function partShape(part: ArtPart): Path2D {
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

/** Vẽ một vật theo bảng hình chung với Cân não, viền màu `outline`. */
function paintItem(ctx: Ctx, item: PairFlipItem, outline: string) {
  for (const part of ITEM_ART[item]) {
    const shape = partShape(part);
    ctx.globalAlpha = part.kind === "circle" ? 1 : (part.opacity ?? 1);
    if (part.fill) {
      ctx.fillStyle = part.fill;
      ctx.fill(shape);
    }
    const width = part.kind === "ellipse" ? undefined : part.outline;
    if (width) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = width;
      ctx.stroke(shape);
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- scene

type Phase = "show" | "input" | "done";
type DotState = "empty" | "filled" | "wrong";
type Badge = "eye" | "hand" | "done";

/** Dải chấm của bàn mới: mỗi câu một chấm rỗng. */
const emptyDots = (count: number): DotState[] => Array.from({ length: count }, () => "empty");

interface CardView {
  index: number;
  item: PairFlipItem;
  x: number;
  y: number;
  /** Vị trí, cỡ (nảy, phóng to), độ mờ, nhấc lên khi rê chuột. */
  box: Phaser.GameObjects.Container;
  /** Lớp lật: co ngang về 0 rồi mở ra mặt kia. */
  flip: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Image;
  face: Phaser.GameObjects.Image;
  back: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Image;
  hover: Phaser.GameObjects.Image;
  cross: Phaser.GameObjects.Image;
  ok: Phaser.GameObjects.Image;
  zone: Phaser.GameObjects.Zone;
  /** Mặt ngửa (trạng thái logic, có thể đang lật dở). */
  up: boolean;
  /** Vòng vàng (thẻ đề, hoặc đáp án lúc khoá). */
  ringOn: boolean;
  /** Đã xong: ngửa, mờ, không bóng. */
  cleared: boolean;
}

/** Lật cặp — mỗi câu game lật sẵn thẻ đề, người chơi chạm thẻ úp giống nó. */
export default class PairFlipScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  /** Câu tiếp theo sẽ gửi. */
  private index = 0;
  private colors!: Palette;
  private reducedMotion = false;

  private phase: Phase = "done";
  private puzzle?: PairFlipPuzzle;
  /** Chỉ số câu của `puzzle`. */
  private puzzleIndex = 0;
  /** Hẹn giờ lịch của câu hiện tại; huỷ hết khi sang câu mới. */
  private timers: Phaser.Time.TimerEvent[] = [];
  /** Đang chia thẻ / xem trước: ẩn tab lúc này thì quay lại chiếu lại xem trước từ đầu. */
  private previewing = false;
  private replayOnVisible = false;

  /** Bàn đang vẽ (số thứ tự bàn trong vòng) và thẻ của nó. */
  private boardNo = -1;
  private layout: BoardLayout = NORMAL;
  private boardRoot?: Phaser.GameObjects.Container;
  private frame?: Phaser.GameObjects.Graphics;
  private cards: CardView[] = [];
  /** Tween đếm (lắc) của bàn hiện tại: dừng khi huỷ bàn. */
  private boardFx: Phaser.Tweens.Tween[] = [];
  /** Khoá sau câu sai: bàn mờ trừ các thẻ này. */
  private dimmed = false;
  private keep = new Set<number>();

  private status?: Phaser.GameObjects.Container;
  private eye?: Phaser.GameObjects.Image;
  private hand?: Phaser.GameObjects.Image;
  private done?: Phaser.GameObjects.Image;
  private burst?: Phaser.GameObjects.Image;
  private timer?: Phaser.GameObjects.Graphics;
  private timerTween?: Phaser.Tweens.Tween;
  private dots?: Phaser.GameObjects.Graphics;
  private dotStates: DotState[] = [];
  private lockBar?: Phaser.GameObjects.Graphics;
  private lock = { width: 0 };

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.phase = "done";
    this.puzzle = undefined;
    this.timers = [];
    this.boardNo = -1;
    this.cards = [];
    this.boardFx = [];
    this.dimmed = false;
    this.keep = new Set();
    this.dotStates = [];
    this.previewing = false;
    this.replayOnVisible = false;
  }

  create() {
    const canvas = this.game.canvas;
    this.colors = readPalette(canvas.isConnected ? canvas : document.documentElement);
    this.reducedMotion = prefersReducedMotion();
    this.createHud();

    const onHidden = () => {
      if (this.previewing) this.replayOnVisible = true;
    };
    const onVisible = () => {
      const puzzle = this.puzzle;
      if (this.replayOnVisible && this.previewing && puzzle) {
        this.clearTimers();
        this.replayPreview(puzzle);
      }
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

  // -------------------------------------------------------------- câu đố

  private showPuzzle() {
    this.clearTimers();
    const index = this.index;
    const puzzle = pairFlip.generate(this.bridge.seed, index, this.bridge.difficulty);
    this.puzzle = puzzle;
    this.puzzleIndex = index;
    this.phase = "show";
    this.previewing = false;
    this.replayOnVisible = false;

    // Lịch chạy bằng đồng hồ của scene, bắt đầu sau khung hình đầu tiên.
    this.events.once(Phaser.Scenes.Events.POST_UPDATE, () => {
      if (this.puzzle !== puzzle || this.phase !== "show") return;
      if (puzzle.step === 0) this.runOpening(puzzle);
      else if (this.boardNo === puzzle.board && this.cards.length > 0) this.runPrompt(puzzle);
      // Nối lại giữa bàn: người chơi chưa thấy bàn, chiếu lại xem trước.
      else this.replayPreview(puzzle);
    });
  }

  /** Câu đầu bàn: (cặp cuối bàn trước) → chia thẻ → xem trước → úp → lật thẻ đề → chạm. */
  private runOpening(puzzle: PairFlipPuzzle) {
    let t = 0;
    if (puzzle.gapMs > 0) {
      this.showLastPair();
      t += puzzle.gapMs;
    }
    this.after(t, () => this.deal(puzzle));
    t += puzzle.dealMs;
    this.after(t, () => this.startTimer(puzzle.previewMs));
    t += puzzle.previewMs;
    this.after(t, () => this.hideAll());
    t += puzzle.hideMs;
    this.after(t, () => this.flipPrompt(puzzle));
    // Cùng mốc với miễn trừ thời gian của server (speedAllowanceMs).
    this.after(pairFlipInputMs(puzzle), () => this.beginInput(puzzle));
  }

  /** Câu giữa bàn: lật thẻ đề rồi chạm. */
  private runPrompt(puzzle: PairFlipPuzzle) {
    this.flipPrompt(puzzle);
    this.after(pairFlipInputMs(puzzle), () => this.beginInput(puzzle));
  }

  /**
   * Chiếu lại xem trước (nối lại giữa vòng, hoặc quay lại tab lúc đang xem): bàn ngửa, thẻ đã xong
   * mờ sẵn, xem đủ thời gian của mức, rồi úp, lật thẻ đề và cho chạm.
   */
  private replayPreview(puzzle: PairFlipPuzzle) {
    const previewMs =
      puzzle.step === 0
        ? puzzle.previewMs
        : pairFlip.generate(
            this.bridge.seed,
            this.puzzleIndex - puzzle.step,
            this.bridge.difficulty,
          ).previewMs;
    if (this.boardNo !== puzzle.board) this.setDots(emptyDots(puzzle.steps));
    this.buildBoard(puzzle, new Set(puzzle.cleared), false);
    this.previewing = true;
    this.setBadge("eye", true);
    this.startTimer(previewMs);
    let t = previewMs;
    this.after(t, () => this.hideAll());
    t += PAIR_FLIP_TIMING.hideMs;
    this.after(t, () => this.flipPrompt(puzzle));
    t += puzzle.promptMs;
    this.after(t, () => this.beginInput(puzzle));
  }

  /** Xong bàn: cặp còn lại của bàn trước tự lật, phóng to, sao lấp lánh; huy hiệu dấu tích. */
  private showLastPair() {
    const prev = pairFlip.generate(this.bridge.seed, this.puzzleIndex - 1, this.bridge.difficulty);
    // Nối lại đúng lúc sang bàn mới: vẽ lại bàn trước ở trạng thái cuối.
    if (this.boardNo !== prev.board || this.cards.length === 0) {
      this.buildBoard(prev, new Set([...prev.cleared, prev.prompt, prev.answer]), false);
      this.turnAll(false, false);
    }
    const root = this.boardRoot;
    const { w, h } = this.layout;
    for (const i of pairFlipLastPair(prev)) {
      const card = this.cards[i];
      if (!card) continue;
      this.turn(card, true, false);
      if (!this.reducedMotion) {
        this.tweens.add({
          targets: card.box,
          scale: LAST_PAIR_SCALE,
          duration: FLIP_MS,
          ease: "Back.easeOut",
        });
      } else card.box.setScale(LAST_PAIR_SCALE);
      // Hai sao chéo góc mỗi thẻ.
      for (const [dx, dy, size] of [
        [-w / 2 - 4, -h / 2 + 12, 1],
        [w / 2 + 4, h / 2 - 16, 0.7],
      ] as const) {
        const spark = this.add.image(card.x + dx, card.y + dy, this.sparkTexture());
        root?.add(spark);
        if (this.reducedMotion) spark.setScale(size);
        else {
          spark.setScale(0);
          this.tweens.add({ targets: spark, scale: size, duration: FLIP_MS, ease: "Back.easeOut" });
        }
      }
    }
    this.setBadge("done", true);
    this.burst?.setVisible(true);
  }

  /** Chia bàn mới: thẻ bay vào chỗ, đã ngửa; dải chấm về rỗng; huy hiệu mắt. */
  private deal(puzzle: PairFlipPuzzle) {
    this.buildBoard(puzzle, new Set(), true);
    this.setDots(emptyDots(puzzle.steps));
    this.previewing = true;
    this.burst?.setVisible(false);
    this.setBadge("eye", true);
  }

  private hideAll() {
    this.previewing = false;
    this.stopTimer();
    this.turnAll(false, true);
  }

  /** Thẻ đề lật ngửa, vòng vàng hiện; huy hiệu đổi ngón tay (nảy). Đồng bộ thẻ đã xong. */
  private flipPrompt(puzzle: PairFlipPuzzle) {
    this.previewing = false;
    this.stopTimer();
    this.burst?.setVisible(false);
    for (const i of puzzle.cleared) {
      const card = this.cards[i];
      if (card && !card.cleared) this.clearCard(card);
    }
    const prompt = this.cards[puzzle.prompt];
    if (prompt) this.turn(prompt, true, true);
    this.setBadge("hand", true);
  }

  private beginInput(puzzle: PairFlipPuzzle) {
    if (this.puzzle !== puzzle || this.phase !== "show") return;
    this.phase = "input";
    for (const card of this.cards) {
      if (this.tappable(card)) card.zone.setInteractive();
      else card.zone.disableInteractive();
    }
  }

  /** Thẻ úp chưa xong, không phải thẻ đề: được chạm. */
  private tappable(card: CardView) {
    return !card.cleared && !card.up && card.index !== this.puzzle?.prompt;
  }

  // -------------------------------------------------------------- nhập

  private tap(i: number) {
    const puzzle = this.puzzle;
    const card = this.cards[i];
    // Bỏ qua, không gửi: thẻ đề, thẻ đã xong, ngoài pha chạm.
    if (this.phase !== "input" || !puzzle || !card || !this.tappable(card)) return;

    this.phase = "done";
    for (const c of this.cards) {
      c.zone.disableInteractive(true);
      this.unhover(c);
    }
    const index = this.puzzleIndex;
    this.bridge.submit(index, i);
    this.index = index + 1;

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    if (pairFlip.check(puzzle, i)) this.matched(puzzle, card);
    else this.missed(puzzle, card, index);
  }

  /**
   * Đúng: thẻ lật ngửa, hai thẻ cùng vật nảy 115 % rồi về 108 %, huy hiệu dấu tích; 300 ms sau mờ
   * thành "đã xong". Câu sau bắt đầu ngay, lật thẻ đề mới song song với hiệu ứng này.
   */
  private matched(puzzle: PairFlipPuzzle, card: CardView) {
    this.setDot(puzzle.step, "filled");
    const prompt = this.cards[puzzle.prompt];
    const pair = prompt ? [prompt, card] : [card];
    this.turn(card, true, false);
    for (const c of pair) {
      c.ringOn = false;
      c.cleared = true;
      c.ok.setVisible(true);
      if (c !== card) this.render(c);
      this.tweens.killTweensOf(c.box);
      c.box.setPosition(c.x, c.y);
      const fade = () =>
        this.tweens.add({
          targets: c.box,
          alpha: CLEARED_ALPHA,
          scale: 1,
          duration: MATCH_FADE_MS,
          onStart: () => c.shadow.setVisible(false),
          onComplete: () => c.ok.setVisible(false),
        });
      if (this.reducedMotion) {
        this.tweens.add({ targets: c.box, alpha: 1, duration: MATCH_MS, onComplete: fade });
        continue;
      }
      this.tweens.add({
        targets: c.box,
        scale: MATCH_PEAK,
        duration: MATCH_MS / 3,
        ease: "Quad.easeOut",
        onComplete: () =>
          this.tweens.add({
            targets: c.box,
            scale: MATCH_SCALE,
            duration: (MATCH_MS * 2) / 3,
            ease: "Quad.easeInOut",
            onComplete: fade,
          }),
      });
    }
    this.showPuzzle();
  }

  /**
   * Sai: gửi ngay; thẻ chạm nhầm lật ngửa có dấu X, lắc ±8 px; thẻ đáp án lật ngửa mang vòng vàng
   * như thẻ đề (CR-006); bàn còn lại mờ 35 %; chấm có X; thanh khoá chạy. Mọi thẻ ở dưới y = 316,
   * không bị huy hiệu khoá của khung che.
   */
  private missed(puzzle: PairFlipPuzzle, card: CardView, index: number) {
    this.setDot(puzzle.step, "wrong");
    this.keep = new Set([card.index, puzzle.prompt, puzzle.answer]);
    this.dimmed = true;
    this.applyAlpha(true);

    this.turn(card, true, false);
    card.cross
      .setVisible(true)
      .setAlpha(0)
      .setScale(this.reducedMotion ? 1 : 0.6);
    this.tweens.add({
      targets: card.cross,
      alpha: 1,
      scale: 1,
      duration: CROSS_IN_MS,
      ease: "Back.easeOut",
    });
    this.shake(card, 8, SHAKE_MS, 2);

    const answer = this.cards[puzzle.answer];
    if (answer) this.turn(answer, true, true);

    // Thanh khoá chạy ngay theo thời gian khoá chuẩn, rồi chỉnh theo `lockedUntil` của server.
    this.lock.width = LOCK_BAR.w;
    this.runLockBar(WRONG_ANSWER_LOCK_MS);
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive() || this.puzzle !== puzzle) return;
      this.runLockBar(ms);
      this.after(ms, () => this.unlock(puzzle, card));
    });
  }

  /** Hết khoá: thẻ sai úp lại, cặp đề mờ thành "đã xong", rồi sang câu sau (lật thẻ đề mới). */
  private unlock(puzzle: PairFlipPuzzle, wrong: CardView) {
    for (const i of [puzzle.prompt, puzzle.answer]) {
      const card = this.cards[i];
      if (!card) continue;
      card.ringOn = false;
      card.cleared = true;
    }
    this.dimmed = false;
    this.keep.clear();
    this.applyAlpha(true);
    // Lật sau applyAlpha (hàm này vẽ lại mặt theo trạng thái) để thẻ sai úp lại có hiệu ứng.
    wrong.cross.setVisible(false);
    this.turn(wrong, false, false);
    this.runLockBar(0);
    this.showPuzzle();
  }

  // -------------------------------------------------------------- bàn và thẻ

  /** Huỷ bàn cũ, dựng bàn mới cho `puzzle`. Thẻ trong `cleared` ngửa và mờ sẵn. */
  private buildBoard(puzzle: PairFlipPuzzle, cleared: Set<number>, flyIn: boolean) {
    this.destroyBoard();
    const layout = layoutFor(puzzle);
    this.layout = layout;
    this.boardNo = puzzle.board;
    this.dimmed = false;
    this.keep.clear();

    const root = this.add.container(0, 0).setDepth(0);
    const frame = this.drawFrame(layout);
    root.add(frame);
    this.cards = puzzle.cards.map((item, i) => this.makeCard(i, item, puzzle.cols, root));
    for (const card of this.cards) {
      card.cleared = cleared.has(card.index);
      card.up = true;
      this.render(card);
      card.box.setAlpha(card.cleared ? CLEARED_ALPHA : 1);
    }
    for (const card of this.cards) root.add(card.zone);
    this.boardRoot = root;
    this.frame = frame;

    if (!flyIn || this.reducedMotion) return;
    const n = this.cards.length;
    const stagger = (PAIR_FLIP_TIMING.dealMs - DEAL_FLY_MS) / Math.max(1, n - 1);
    this.cards.forEach((card, k) => {
      card.box
        .setPosition(card.x, card.y + 80)
        .setAlpha(0)
        .setScale(0.85);
      this.tweens.add({
        targets: card.box,
        y: card.y,
        alpha: 1,
        scale: 1,
        delay: k * stagger,
        duration: DEAL_FLY_MS,
        ease: "Back.easeOut",
      });
    });
  }

  private destroyBoard() {
    for (const tween of this.boardFx) tween.stop();
    this.boardFx = [];
    for (const card of this.cards) {
      this.tweens.killTweensOf([card.box, card.flip, card.cross]);
    }
    this.boardRoot?.each((child: Phaser.GameObjects.GameObject) => this.tweens.killTweensOf(child));
    if (this.frame) this.tweens.killTweensOf(this.frame);
    this.boardRoot?.destroy();
    this.boardRoot = undefined;
    this.frame = undefined;
    this.cards = [];
    this.boardNo = -1;
  }

  /** Khung bàn: nền giấy, viền mực 5 px, viền trong màu nhóm Ghi nhớ, bóng dưới 8 px. */
  private drawFrame(layout: BoardLayout) {
    const c = this.colors;
    const { x, y, w, radius } = FRAME;
    const h = layout.frameH;
    const g = this.add.graphics();
    g.fillStyle(toColor(c.sticker));
    g.fillRoundedRect(x, y + 8, w, h, radius);
    g.fillStyle(toColor(c.card));
    g.fillRoundedRect(x, y, w, h, radius);
    g.lineStyle(5, toColor(c.sticker));
    g.strokeRoundedRect(x, y, w, h, radius);
    g.lineStyle(8, toColor(c.memorize));
    g.strokeRoundedRect(x + 11, y + 11, w - 22, h - 22, radius - 9);
    return g;
  }

  private makeCard(
    i: number,
    item: PairFlipItem,
    cols: number,
    root: Phaser.GameObjects.Container,
  ): CardView {
    const layout = this.layout;
    const x = layout.xs[i % cols] ?? 0;
    const y = layout.ys[Math.floor(i / cols)] ?? 0;
    const { w, h, scale } = layout;

    const shadow = this.add.image(0, 0, this.shadowTexture());
    const face = this.add.image(0, 0, this.faceTexture(item));
    const back = this.add.image(0, 0, this.backTexture());
    const ring = this.add.image(0, 0, this.ringTexture()).setVisible(false);
    const flip = this.add.container(0, 0, [shadow, back, face, ring]);
    const hover = this.add.image(0, 0, this.hoverTexture()).setVisible(false);
    const cross = this.add.image(0, 0, this.crossTexture()).setVisible(false);
    const ok = this.add
      .image(w / 2 - 16 * scale, -h / 2 + 16 * scale, this.okTexture())
      .setVisible(false);
    const box = this.add.container(x, y, [hover, flip, cross, ok]);
    root.add(box);

    // Vùng chạm = cả thẻ; khe giữa thẻ không nhận chạm. Chỉ bật ở pha chạm, cho thẻ úp.
    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.disableInteractive();
    const card: CardView = {
      index: i,
      item,
      x,
      y,
      box,
      flip,
      shadow,
      face,
      back,
      ring,
      hover,
      cross,
      ok,
      zone,
      up: true,
      ringOn: false,
      cleared: false,
    };
    zone.on("pointerdown", () => this.tap(i));
    zone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
      // Máy tính: thẻ úp chạm được nhấc lên 6 px, viền nét đứt.
      if (this.phase !== "input" || pointer.wasTouch || !this.tappable(card)) return;
      hover.setVisible(true);
      this.tweens.add({ targets: box, y: y - HOVER_LIFT, duration: HOVER_MS });
    });
    zone.on("pointerout", () => this.unhover(card));
    return card;
  }

  private unhover(card: CardView) {
    if (!card.hover.visible && card.box.y === card.y) return;
    card.hover.setVisible(false);
    this.tweens.add({ targets: card.box, y: card.y, duration: HOVER_MS });
  }

  /** Áp trạng thái logic lên hình (mặt, vòng, bóng). */
  private render(card: CardView) {
    card.face.setVisible(card.up);
    card.back.setVisible(!card.up);
    card.ring.setVisible(card.up && card.ringOn);
    card.shadow.setVisible(!card.cleared);
  }

  /** Lật thẻ sang mặt `up`: co ngang về 0 rồi mở ra mặt kia (giảm chuyển động: đổi tức thì). */
  private turn(card: CardView, up: boolean, ring: boolean) {
    this.tweens.killTweensOf(card.flip);
    card.flip.setScale(1);
    const changed = card.up !== up;
    card.up = up;
    card.ringOn = ring;
    if (!changed || this.reducedMotion) {
      this.render(card);
      return;
    }
    this.tweens.add({
      targets: card.flip,
      scaleX: 0,
      duration: FLIP_MS / 2,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.render(card);
        this.tweens.add({
          targets: card.flip,
          scaleX: 1,
          duration: FLIP_MS / 2,
          ease: "Quad.easeOut",
        });
      },
    });
  }

  /** Úp (hoặc ngửa) mọi thẻ chưa xong cùng lúc. */
  private turnAll(up: boolean, animate: boolean) {
    for (const card of this.cards) {
      if (card.cleared) continue;
      if (animate) this.turn(card, up, false);
      else {
        card.up = up;
        card.ringOn = false;
        this.render(card);
      }
    }
  }

  /** Thẻ thành "đã xong" (ngửa, mờ, không bóng). */
  private clearCard(card: CardView) {
    card.cleared = true;
    card.up = true;
    card.ringOn = false;
    card.ok.setVisible(false);
    this.render(card);
    this.tweens.killTweensOf(card.box);
    card.box.setPosition(card.x, card.y).setScale(1);
    this.tweens.add({ targets: card.box, alpha: this.alphaOf(card), duration: DIM_MS });
  }

  private alphaOf(card: CardView) {
    const base = card.cleared ? CLEARED_ALPHA : 1;
    return this.dimmed && !this.keep.has(card.index) ? base * DIM_ALPHA : base;
  }

  /** Độ mờ của khung và từng thẻ theo trạng thái khoá. Hiệu ứng đang chạy trên thẻ về trạng thái cuối. */
  private applyAlpha(animate: boolean) {
    const frameAlpha = this.dimmed ? DIM_ALPHA : 1;
    if (this.frame) {
      this.tweens.killTweensOf(this.frame);
      if (animate) this.tweens.add({ targets: this.frame, alpha: frameAlpha, duration: DIM_MS });
      else this.frame.setAlpha(frameAlpha);
    }
    for (const card of this.cards) {
      this.tweens.killTweensOf(card.box);
      card.box.setPosition(card.x, card.y).setScale(1);
      if (card.cleared) card.ok.setVisible(false);
      this.render(card);
      const alpha = this.alphaOf(card);
      if (animate) this.tweens.add({ targets: card.box, alpha, duration: DIM_MS });
      else card.box.setAlpha(alpha);
    }
  }

  // -------------------------------------------------------------- huy hiệu, dải chấm, thanh khoá

  private createHud() {
    const timer = this.add.graphics().setVisible(false);
    const eye = this.add.image(0, 0, this.eyeTexture());
    const hand = this.add.image(0, 0, this.handTexture()).setVisible(false);
    const done = this.add.image(0, 0, this.doneTexture()).setVisible(false);
    const status = this.add.container(STATUS_X, STATUS_Y, [
      timer,
      this.add.image(0, 0, this.statusTexture()),
      eye,
      hand,
      done,
    ]);
    const burst = this.add.image(STATUS_X, STATUS_Y - 75, this.burstTexture()).setVisible(false);
    const dots = this.add.graphics();
    const lockBar = this.add.graphics();
    this.add.container(0, 0, [status, burst, dots, lockBar]).setDepth(1);

    this.status = status;
    this.eye = eye;
    this.hand = hand;
    this.done = done;
    this.burst = burst;
    this.timer = timer;
    this.dots = dots;
    this.lockBar = lockBar;
  }

  private setBadge(kind: Badge, pop: boolean) {
    this.eye?.setVisible(kind === "eye");
    this.hand?.setVisible(kind === "hand");
    this.done?.setVisible(kind === "done");
    const status = this.status;
    if (!pop || !status || this.reducedMotion) return;
    this.tweens.killTweensOf(status);
    status.setScale(1);
    this.tweens.add({
      targets: status,
      scale: 1.15,
      duration: POP_MS / 2,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  /** Vòng giờ quanh mắt rút dần trong thời gian xem trước. */
  private startTimer(ms: number) {
    this.stopTimer();
    const g = this.timer;
    if (!g || ms <= 0) return;
    g.setVisible(true);
    this.drawTimer(1);
    this.timerTween = this.tweens.addCounter({
      from: 1,
      to: 0,
      duration: ms,
      onUpdate: (tween) => this.drawTimer(tween.getValue() ?? 0),
    });
  }

  private stopTimer() {
    this.timerTween?.stop();
    this.timerTween = undefined;
    this.timer?.clear().setVisible(false);
  }

  private drawTimer(left: number) {
    const g = this.timer;
    if (!g) return;
    const ink = toColor(this.colors.cardFg);
    g.clear();
    g.lineStyle(TIMER_W, ink, 0.15);
    g.strokeCircle(0, 0, TIMER_R);
    if (left <= 0) return;
    const start = -Math.PI / 2;
    g.lineStyle(TIMER_W, ink, 1);
    g.beginPath();
    g.arc(0, 0, TIMER_R, start, start + left * Math.PI * 2, false);
    g.strokePath();
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
    g.clear();
    const fill = Math.max(0, this.lock.width);
    if (fill <= 0) return;
    const c = this.colors;
    const { x, y, w, h } = LOCK_BAR;
    const r = h / 2;
    g.fillStyle(toColor(c.card));
    g.fillRoundedRect(x, y, w, h, r);
    g.lineStyle(3, toColor(c.cardFg));
    g.strokeRoundedRect(x, y, w, h, r);
    g.fillStyle(toColor(c.cardFg));
    g.fillRoundedRect(x, y, fill, h, Math.min(r, fill / 2));
  }

  // -------------------------------------------------------------- hiệu ứng, hẹn giờ

  /** Lắc ngang ±`amplitude` px trong `ms`, `cycles` nhịp, rồi về chỗ cũ. */
  private shake(card: CardView, amplitude: number, ms: number, cycles: number) {
    if (this.reducedMotion) return;
    const tween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ms,
      onUpdate: (t) =>
        card.box.setX(card.x + amplitude * Math.sin((t.getValue() ?? 0) * cycles * 2 * Math.PI)),
      onComplete: () => card.box.setX(card.x),
    });
    this.boardFx.push(tween);
  }

  private after(ms: number, callback: () => void) {
    if (ms <= 0) {
      callback();
      return;
    }
    this.timers.push(this.time.delayedCall(ms, callback));
  }

  private clearTimers() {
    for (const timer of this.timers) timer.remove(false);
    this.timers = [];
  }

  // -------------------------------------------------------------- texture (vẽ một lần)

  /** Tạo texture từ canvas 2D (gốc toạ độ ở tâm) nếu chưa có; trả về khoá. */
  private texture(key: string, w: number, h: number, draw: (ctx: Ctx) => void): string {
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

  /** Khoá texture theo cỡ thẻ và giao diện sáng/tối. */
  private key(name: string, perLayout = true) {
    const theme = this.colors.dark ? "d" : "l";
    return perLayout
      ? `pair-flip:${name}:${this.layout.key}:${theme}`
      : `pair-flip:${name}:${theme}`;
  }

  /** Bóng dưới thẻ: khối mực lệch xuống 6 px. */
  private shadowTexture() {
    const { w, h, radius } = this.layout;
    const c = this.colors;
    return this.texture(this.key("shadow"), w + 4, h + 2 * CARD_SHADOW + 4, (ctx) => {
      roundRectPath(ctx, w, h, radius, 0, CARD_SHADOW);
      ctx.fillStyle = c.sticker;
      ctx.fill();
    });
  }

  /** Mặt ngửa: nền giấy (tối: tím), viền mực 5 px, hình vật phấn màu. */
  private faceTexture(item: PairFlipItem) {
    const { w, h, radius, item: size } = this.layout;
    const c = this.colors;
    return this.texture(this.key(`face-${item}`), w + 6, h + 6, (ctx) => {
      roundRectPath(ctx, w, h, radius);
      ctx.fillStyle = c.dark ? c.muted : c.card;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      ctx.scale(size, size);
      paintItem(ctx, item, c.sticker);
    });
  }

  /** Mặt úp: nền mực, khung trong hồng, não phấn mờ 30 % và dấu "?" (tối: viền phấn sáng). */
  private backTexture() {
    const { w, h, radius, scale } = this.layout;
    const c = this.colors;
    return this.texture(this.key("back"), w + 6, h + 6, (ctx) => {
      roundRectPath(ctx, w, h, radius);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      if (c.dark) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = c.chalkMuted;
        ctx.stroke();
      }
      roundRectPath(ctx, w - 18, h - 18, Math.max(6, radius - 8));
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.memorize;
      ctx.stroke();

      ctx.save();
      ctx.scale(0.44 * scale, 0.44 * scale);
      ctx.translate(-112, -93);
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 11;
      ctx.strokeStyle = c.chalk;
      ctx.stroke(new Path2D(BRAIN_PATH));
      ctx.restore();

      const font = Math.round(56 * scale);
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = c.chalk;
      ctx.font = `800 ${font}px "Baloo 2", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("?", 0, Math.round(20 * scale));
      ctx.globalAlpha = 1;
    });
  }

  /** Vòng vàng dày 7 px có viền mực ngoài 12 px, cách mép thẻ 7 px. */
  private ringTexture() {
    const { w, h, radius } = this.layout;
    const c = this.colors;
    const rw = w + 2 * RING_GAP;
    const rh = h + 2 * RING_GAP;
    return this.texture(this.key("ring"), rw + 16, rh + 16, (ctx) => {
      roundRectPath(ctx, rw, rh, radius + 6);
      ctx.lineWidth = 12;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      ctx.lineWidth = 7;
      ctx.strokeStyle = c.primary;
      ctx.stroke();
    });
  }

  /** Rê chuột: viền nét đứt quanh thẻ. */
  private hoverTexture() {
    const { w, h, radius } = this.layout;
    const c = this.colors;
    const rw = w + 2 * RING_GAP;
    const rh = h + 2 * RING_GAP;
    return this.texture(this.key("hover"), rw + 8, rh + 8, (ctx) => {
      roundRectPath(ctx, rw, rh, radius + 6);
      ctx.setLineDash([12, 8]);
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.cardFg;
      ctx.stroke();
    });
  }

  /** Chạm sai: dấu X màu báo lỗi, viền phấn trắng. */
  private crossTexture() {
    const { scale } = this.layout;
    const c = this.colors;
    const a = 32 * scale;
    const outer = 20 * scale;
    return this.texture(this.key("cross"), 2 * a + outer + 4, 2 * a + outer + 4, (ctx) => {
      const cross = new Path2D(`M${-a} ${-a} L${a} ${a} M${a} ${-a} L${-a} ${a}`);
      ctx.lineWidth = outer;
      ctx.strokeStyle = c.chalk;
      ctx.stroke(cross);
      ctx.lineWidth = 10 * scale;
      ctx.strokeStyle = c.destructive;
      ctx.stroke(cross);
    });
  }

  /** Khớp cặp: huy hiệu dấu tích vàng ở góc trên phải thẻ. */
  private okTexture() {
    const { scale } = this.layout;
    const c = this.colors;
    const r = 26 * scale;
    return this.texture(this.key("ok"), 2 * r + 8, 2 * r + 16, (ctx) => {
      circlePath(ctx, 0, 5 * scale, r);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      circlePath(ctx, 0, 0, r);
      ctx.fillStyle = c.primary;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      ctx.scale(scale, scale);
      ctx.lineWidth = 6;
      ctx.strokeStyle = c.primaryFg;
      ctx.stroke(new Path2D(OK_PATH));
    });
  }

  private sparkTexture() {
    const c = this.colors;
    return this.texture(this.key("spark", false), 48, 48, (ctx) => {
      const spark = new Path2D(SPARK_PATH);
      ctx.fillStyle = c.primary;
      ctx.fill(spark);
      ctx.lineWidth = 3;
      ctx.strokeStyle = c.sticker;
      ctx.stroke(spark);
    });
  }

  /** Nền tròn của huy hiệu trạng thái: thẻ giấy viền mực, bóng đổ xuống dưới. */
  private statusTexture() {
    const c = this.colors;
    return this.texture(
      this.key("status", false),
      2 * (STATUS_R + 9),
      2 * (STATUS_R + 9),
      (ctx) => {
        circlePath(ctx, 0, 6, STATUS_R);
        ctx.fillStyle = c.sticker;
        ctx.fill();
        circlePath(ctx, 0, 0, STATUS_R);
        ctx.fillStyle = c.card;
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = c.sticker;
        ctx.stroke();
      },
    );
  }

  /** Xem trước: con mắt. */
  private eyeTexture() {
    const c = this.colors;
    return this.texture(this.key("eye", false), 90, 90, (ctx) => {
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

  /** Tới lượt chạm: ngón tay chỉ. */
  private handTexture() {
    const c = this.colors;
    return this.texture(this.key("hand", false), 90, 90, (ctx) => {
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

  /** Xong bàn: dấu tích vàng viền mực. */
  private doneTexture() {
    const c = this.colors;
    return this.texture(this.key("done", false), 80, 70, (ctx) => {
      const tick = new Path2D(DONE_PATH);
      ctx.lineWidth = 16;
      ctx.strokeStyle = c.sticker;
      ctx.stroke(tick);
      ctx.lineWidth = 9;
      ctx.strokeStyle = c.primary;
      ctx.stroke(tick);
    });
  }

  /** Ba vạch nảy phía trên huy hiệu (xong bàn). Gốc ở tâm huy hiệu, texture đặt cao hơn 75 px. */
  private burstTexture() {
    const c = this.colors;
    return this.texture(this.key("burst", false), 100, 40, (ctx) => {
      ctx.translate(0, 75);
      ctx.lineWidth = 5;
      ctx.strokeStyle = c.cardFg;
      ctx.stroke(new Path2D(BURST_PATH));
    });
  }
}
