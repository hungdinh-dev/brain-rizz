import {
  type MarbleDirection,
  type MarbleDropPuzzle,
  type MarbleLever,
  marbleDrop,
  marbleLeverDirsBefore,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import { DESIGN_WIDTH, type MinigameBridge } from "../types";

/*
 * Bi rơi đâu — lần theo cần gạt hình mũi tên, chạm cốc bi rơi vào.
 * Đặc tả: docs/04-minigames/marble-drop.md (mục "Ghi chú cho FE"); bản mẫu: MarbleDropMobile,
 * MarbleDropLevels, MarbleDropStates trên canvas Brain Rizz. Không vẽ chữ trừ chữ cái cốc và số
 * trên bi.
 *
 * Phễu, ống, cần gạt, cốc, bi được vẽ một lần ra canvas 2D (đúng nét bản mẫu) rồi dùng làm
 * texture; thẻ cốc và vòng khoanh vẽ bằng Graphics. Client không tự mô phỏng: đường bi lấy từ
 * `paths` của câu đố, hướng công tắc lúc khoá lấy từ `marbleLeverDirsBefore`.
 */

// ─── Màu ────────────────────────────────────────────────────────────────────────────────────────

/** Token CSS (tự đổi theo sáng/tối), đọc lại mỗi câu để đổi giao diện giữa vòng vẫn đúng. */
const TOKENS = {
  /** Lòng ống, phễu, chốt cần gạt thường, thẻ cốc, huy hiệu số bước. */
  card: "--card",
  /** Viền ống, phễu, chốt; nét chấm đường bi trước; bóng nét đứt của công tắc đã lật. */
  line: "--card-foreground",
  /** Viền cần gạt, cốc, bi, thẻ; bóng đổ thẻ; viền ngoài vòng khoanh. */
  sticker: "--sticker",
  /** Bi được hỏi, chốt công tắc, nét đường bi đúng, vòng khoanh, dấu ✓. */
  primary: "--primary",
  /** Dấu ✗. */
  destructive: "--destructive",
  /** Màu nhóm Phân tích: thân cần gạt. */
  accent: "--color-analyze",
  /** Chữ cái cốc, số trên bi, vòng mũi tên công tắc (giống nhau ở hai nền). */
  ink: "--color-ink",
  /** Bi thả trước bi được hỏi (kem ở cả hai nền). */
  paper: "--color-paper",
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
  paper: "#fff8ef",
};

/** Bảng màu riêng của game (bản mẫu MarbleDropStates), giống nhau ở hai nền. */
const CUP_BODY = "#cfe3f6";
const CUP_MOUTH = "#2c2850";
const SHINE = "#ffffff";
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

// ─── Bố cục (px trong khung 720×1280), theo bảng Bố cục của đặc tả ─────────────────────────────

const CENTER_X = DESIGN_WIDTH / 2;

interface Layout {
  /** Nửa bước ngang giữa hai chạc. */
  h: number;
  /** Bước tầng. */
  v: number;
  /** Tâm chạc đỉnh. */
  y0: number;
  /** Tỉ lệ cần gạt. */
  lever: number;
  /** Tâm miệng cốc và tỉ lệ cốc. */
  cupY: number;
  cup: number;
  /** Bề ngang thẻ cốc (cũng là vùng chạm). */
  tileW: number;
  /** Mép trên phễu và tỉ lệ phễu. */
  funnelY: number;
  funnel: number;
  /** Tâm bi trong phễu và tỉ lệ bi. */
  ballY: number;
  ball: number;
  /** Ống: đầu trên (ngay dưới phễu), đầu dưới (trong miệng cốc), nét viền / nét lòng. */
  pipeTop: number;
  pipeBottom: number;
  pipeOuter: number;
  pipeInner: number;
}

/** Mầm: 2 tầng, 3 cốc. */
const LAYOUT_SPROUT: Layout = {
  h: 110,
  v: 264,
  y0: 290,
  lever: 1.2,
  cupY: 1030,
  cup: 1.3,
  tileW: 196,
  funnelY: 110,
  funnel: 1.3,
  ballY: 150,
  ball: 1.3,
  pipeTop: 202.2,
  pipeBottom: 982,
  pipeOuter: 48,
  pipeInner: 34,
};

/** Thường: 3 tầng, 4 cốc. */
const LAYOUT_NORMAL: Layout = {
  h: 75,
  v: 180,
  y0: 280,
  lever: 1,
  cupY: 1042,
  cup: 1.05,
  tileW: 136,
  funnelY: 120,
  funnel: 1,
  ballY: 154,
  ball: 1.05,
  pipeTop: 190,
  pipeBottom: 1001,
  pipeOuter: 40,
  pipeInner: 28,
};

/** Khó, Siêu khó: 4 tầng, 5 cốc, bi xếp hàng ở phễu và máng. */
const LAYOUT_DEEP: Layout = {
  h: 64,
  v: 153.6,
  y0: 284,
  lever: 0.92,
  cupY: 1048,
  cup: 0.92,
  tileW: 116,
  funnelY: 150,
  funnel: 0.95,
  ballY: 182,
  ball: 0.92,
  pipeTop: 216.3,
  pipeBottom: 1010,
  pipeOuter: 38,
  pipeInner: 26,
};

function layoutFor(tiers: number): Layout {
  if (tiers <= 2) return LAYOUT_SPROUT;
  return tiers === 3 ? LAYOUT_NORMAL : LAYOUT_DEEP;
}

const nodeX = (l: Layout, r: number, i: number) => CENTER_X + (2 * i - r) * l.h;
const nodeY = (l: Layout, r: number) => l.y0 + r * l.v;
/** Tâm bi nằm trong cốc (trên miệng cốc một chút). */
const restY = (l: Layout) => l.cupY - 6 * l.cup;

/** Thẻ cốc: từ y 980, cao 220, ngoài dải huy hiệu khoá của khung (tới y ≈ 225). */
const TILE_TOP = 980;
const TILE_H = 220;
const TILE_RADIUS = 24;
const TILE_EDGE = 4;
const TILE_SHADOW = 6;

/** Máng xếp bi (Khó, Siêu khó) và chỗ của bi 2, bi 3 trên máng. */
const CHUTE = { x0: 120, y0: 108, x1: 299.2, y1: 150, outer: 18, inner: 8 };
const QUEUE_SPOTS = [
  { x: 275.3, y: 111.6 },
  { x: 226.6, y: 100.2 },
];
/** Huy hiệu "?" cạnh bi được hỏi. */
const QUESTION_OFFSET = { x: 21, y: -22 };

/** Cần gạt nghiêng theo đúng hướng ống (atan(h / v) ở mọi mức). */
const LEVER_TILT = Phaser.Math.DegToRad(22.6);
/** Huy hiệu số bước: bên đối diện mũi tên, hơi cao hơn chốt (đơn vị trước khi nhân tỉ lệ). */
const STEP_OFFSET = { x: 54, y: -6 };

/** Đầu đường bi: ngay trên tâm bi trong phễu (đơn vị trước khi nhân tỉ lệ bi). */
const TRAIL_LEAD = 12;

/** Vòng khoanh thẻ cốc: nét `primary` có viền `sticker`. */
const RING_PAD = 12;
const RING_RADIUS = 34;
const RING_OUTER = 14;
const RING_INNER = 8;

// ─── Chuyển động (mỗi hiệu ứng ≤ 400 ms, trừ thời gian khoá) ──────────────────────────────────

const FADE_MS = 120;
/** Bi vàng nhảy thẳng vào cốc đã chạm. */
const JUMP_MS = 180;
/** Sau câu đúng sang câu mới; server tính phần này vào câu sau nên giữ ≤ 300 ms. */
const NEXT_AFTER_HIT_MS = 260;
/** Đường bi vẽ dần từ phễu xuống cốc lúc khoá. */
const TRAIL_MS = 360;
const SHAKE_PX = 8;
const SHAKE_MS = 240;
const SHAKE_TIMES = 3;
const DIM_ALPHA = 0.35;
const HOVER_LIFT = 4;

/** Chờ font tối đa bấy nhiêu ms rồi vẽ bằng font dự phòng. */
const FONT_TIMEOUT_MS = 1500;
const FONT = '"Baloo 2", "Be Vietnam Pro", sans-serif';

// ─── Vẽ ra canvas 2D ───────────────────────────────────────────────────────────────────────────

type Ctx = CanvasRenderingContext2D;
/** Khung vẽ [x0, y0, x1, y1] tính theo đơn vị hình, gốc (0, 0) là điểm neo của ảnh. */
type Box = readonly [number, number, number, number];

interface Art {
  key: string;
  ox: number;
  oy: number;
}

interface Pt {
  x: number;
  y: number;
}

const TAU = Math.PI * 2;
const ARROW = "M-6 0 L-6 44 L-14 44 L0 70 L14 44 L6 44 L6 0 Z";
const FLIP_ICON =
  "M-10.3 -3.8 A11 11 0 0 1 10.3 -3.8 M3.6 -7.7 L10.3 -3.8 L13 -11.1 M10.3 3.8 A11 11 0 0 1 -10.3 3.8 M-3.6 7.7 L-10.3 3.8 L-13 11.1";
const FUNNEL = "M-64 0 L64 0 L20 74 L-20 74 Z";
const CUP = "M-44 0 L44 0 L35 92 C34 100 29 104 21 104 L-21 104 C-29 104 -34 100 -35 92 Z";
const TICK = "M-12 1 L-3 10 L13 -9";
const CROSS = "M-24 -24 L24 24 M24 -24 L-24 24";
/** Vạch nảy trên thẻ cốc đúng (gốc ở tâm thẻ, y 950) và vạch rung cạnh thẻ cốc sai. */
const BOUNCE_MARKS = "M-30 4 L-35 -9 M0 0 L0 -13 M30 4 L35 -9";
const SHAKE_MARK = "M0 0 C-6 20 -6 48 0 68";

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

function polyline(points: readonly Pt[]): Path2D {
  const shape = new Path2D();
  points.forEach((p, k) => {
    if (k === 0) shape.moveTo(p.x, p.y);
    else shape.lineTo(p.x, p.y);
  });
  return shape;
}

/** Chữ Baloo 2 đậm căn giữa, `baseline` là toạ độ đường chân chữ. */
function label(ctx: Ctx, text: string, size: number, baseline: number, color: string) {
  ctx.fillStyle = color;
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, 0, baseline);
}

/** Góc nghiêng của mũi tên: 0 = chỉ trái (mũi tên quay về bên trái), 1 = chỉ phải. */
const tiltOf = (dir: number) => (dir === 0 ? LEVER_TILT : -LEVER_TILT);

/** Chờ Baloo 2 tải xong (chữ trên texture vẽ một lần, không tự vẽ lại khi font về muộn). */
function waitForFont(): Promise<void> {
  const fonts = document.fonts;
  if (!fonts) return Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, FONT_TIMEOUT_MS);
  });
  const load = fonts.load('800 48px "Baloo 2"', "ABCDE0123456789?").then(
    () => {},
    () => {},
  );
  return Promise.race([load, timeout]).finally(() => clearTimeout(timer));
}

function mediaMatches(query: string): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

// ─── Scene ────────────────────────────────────────────────────────────────────────────────────

interface TileView {
  cup: number;
  /** Tâm cốc và mép trái thẻ. */
  x: number;
  left: number;
  shadow: Phaser.GameObjects.Graphics;
  /** Mặt thẻ và cốc (kèm chữ cái): nhấc lên khi rê chuột. */
  paper: Phaser.GameObjects.Graphics;
  cupImage: Phaser.GameObjects.Image;
}

interface LeverView {
  r: number;
  i: number;
  lever: MarbleLever;
  image: Phaser.GameObjects.Image;
}

interface BallView {
  image: Phaser.GameObjects.Image;
  badge?: Phaser.GameObjects.Image;
}

/** Bi rơi đâu — chạm cốc bi cuối rơi vào. */
export default class MarbleDropScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = false;
  private reducedMotion = false;
  private canHover = false;
  private palette!: Palette;
  private puzzle?: MarbleDropPuzzle;
  private layout: Layout = LAYOUT_NORMAL;
  private board?: Phaser.GameObjects.Container;
  /** Lớp dưới (thẻ cốc), lớp giữa (ống, cần gạt, cốc, bi), lớp trên (đường bi, dấu ✓/✗…). */
  private back?: Phaser.GameObjects.Container;
  private mid?: Phaser.GameObjects.Container;
  private top?: Phaser.GameObjects.Container;
  private tiles: TileView[] = [];
  private levers: LeverView[] = [];
  private balls: BallView[] = [];
  /** Mọi thứ bị làm mờ khi trả lời sai (thẻ cốc đúng được trả lại độ sáng sau đó). */
  private dimmable: { setAlpha(value: number): unknown }[] = [];

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.locked = true;
    this.puzzle = undefined;
  }

  create() {
    this.reducedMotion = prefersReducedMotion();
    this.canHover = mediaMatches("(hover: hover)");
    // Hết vòng hoặc rời màn: dừng hẳn mọi tween và hẹn giờ của câu đang dở.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    void waitForFont().then(() => {
      // Hết vòng trong lúc chờ font thì scene đã bị huỷ.
      if (this.sys.isActive()) this.next();
    });
  }

  private cleanup() {
    this.locked = true;
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.board = undefined;
    this.back = undefined;
    this.mid = undefined;
    this.top = undefined;
    this.tiles = [];
    this.levers = [];
    this.balls = [];
    this.dimmable = [];
  }

  private next() {
    this.locked = false;
    this.showPuzzle();
  }

  private showPuzzle() {
    // Mọi tween đang chạy đều thuộc câu cũ (hiện câu, bi nhảy, rung, vẽ đường): dừng trước khi huỷ.
    this.tweens.killAll();
    this.board?.destroy();
    this.tiles = [];
    this.levers = [];
    this.balls = [];
    this.dimmable = [];

    this.palette = readPalette(this.game.canvas);
    const puzzle = marbleDrop.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    this.puzzle = puzzle;
    const l = layoutFor(puzzle.tiers);
    this.layout = l;

    const back = this.add.container(0, 0);
    const mid = this.add.container(0, 0);
    const top = this.add.container(0, 0);
    const board = this.add.container(0, 0, [back, mid, top]);
    this.board = board;
    this.back = back;
    this.mid = mid;
    this.top = top;

    for (let c = 0; c < puzzle.cups; c++) this.tiles.push(this.drawTile(puzzle.tiers, c));

    const pipes = this.place(0, 0, this.pipesArt(puzzle.tiers));
    mid.add(pipes);
    this.dimmable.push(pipes);
    if (puzzle.balls > 1) {
      const chute = this.place(0, 0, this.chuteArt());
      mid.add(chute);
      this.dimmable.push(chute);
    }
    const funnel = this.place(CENTER_X, l.funnelY, this.funnelArt(l.funnel));
    mid.add(funnel);
    this.dimmable.push(funnel);

    puzzle.levers.forEach((row, r) => {
      row.forEach((lever, i) => {
        const image = this.place(
          nodeX(l, r, i),
          nodeY(l, r),
          this.leverArt(lever.dir, lever.toggle, l.lever),
        );
        mid.add(image);
        this.dimmable.push(image);
        this.levers.push({ r, i, lever, image });
      });
    });

    for (const tile of this.tiles) mid.add(tile.cupImage);

    for (let b = 0; b < puzzle.balls; b++) this.balls.push(this.drawQueuedBall(puzzle, b));

    if (!this.reducedMotion) {
      board.setAlpha(0);
      this.tweens.add({ targets: board, alpha: 1, duration: FADE_MS });
    }
  }

  // ── Vẽ câu đố ──

  private drawTile(tiers: number, c: number): TileView {
    const l = this.layout;
    const { card, sticker } = this.palette;
    const x = nodeX(l, tiers, c);
    const left = x - l.tileW / 2;
    const shadow = this.add.graphics();
    shadow
      .fillStyle(sticker.num)
      .fillRoundedRect(left, TILE_TOP + TILE_SHADOW, l.tileW, TILE_H, TILE_RADIUS);
    const paper = this.add.graphics();
    paper.fillStyle(card.num).fillRoundedRect(left, TILE_TOP, l.tileW, TILE_H, TILE_RADIUS);
    paper
      .lineStyle(TILE_EDGE, sticker.num)
      .strokeRoundedRect(left, TILE_TOP, l.tileW, TILE_H, TILE_RADIUS);
    this.back?.add([shadow, paper]);
    const cupImage = this.place(x, l.cupY, this.cupArt(c, l.cup));
    this.dimmable.push(shadow, paper, cupImage);
    const tile: TileView = { cup: c, x, left, shadow, paper, cupImage };

    // Vùng chạm phủ cả thẻ cốc lẫn bóng đổ (≥ 116 px trong khung). Chỉ cốc nhận chạm.
    const hit = this.add
      .zone(x, TILE_TOP + (TILE_H + TILE_SHADOW) / 2, l.tileW, TILE_H + TILE_SHADOW)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => this.answer(c));
    if (this.canHover) {
      hit.on("pointerover", () => {
        if (!this.locked) this.lift(tile, true);
      });
      hit.on("pointerout", () => this.lift(tile, false));
    }
    this.top?.add(hit);
    return tile;
  }

  /** Rê chuột lên cốc: mặt thẻ và cốc nhấc lên, bóng đổ giữ nguyên. */
  private lift(tile: TileView, up: boolean) {
    tile.paper.y = up ? -HOVER_LIFT : 0;
    tile.cupImage.y = this.layout.cupY - (up ? HOVER_LIFT : 0);
  }

  /** Bi xếp hàng lúc hiện câu: bi 1 trong phễu, bi sau trên máng; bi được hỏi có huy hiệu "?". */
  private drawQueuedBall(puzzle: MarbleDropPuzzle, b: number): BallView {
    const l = this.layout;
    const spot = (b > 0 && QUEUE_SPOTS[b - 1]) || { x: CENTER_X, y: l.ballY };
    const asked = b === puzzle.balls - 1;
    const image = this.place(spot.x, spot.y, this.ballArt(puzzle, b));
    this.mid?.add(image);
    const view: BallView = { image };
    if (asked && puzzle.balls > 1) {
      view.badge = this.place(
        image.x + QUESTION_OFFSET.x,
        image.y + QUESTION_OFFSET.y,
        this.questionArt(),
      );
      this.mid?.add(view.badge);
    }
    return view;
  }

  // ── Trả lời ──

  private answer(choice: number) {
    const puzzle = this.puzzle;
    if (this.locked || !puzzle) return;
    this.locked = true;
    for (const tile of this.tiles) this.lift(tile, false);

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const index = this.index;
    const correct = marbleDrop.check(puzzle, choice);
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

  /** Đúng: bi vàng nhảy thẳng vào cốc đã chạm; cốc khoanh vàng, dấu ✓, vạch nảy. */
  private showHit(puzzle: MarbleDropPuzzle, choice: number) {
    const tile = this.tiles[choice];
    const ball = this.balls[puzzle.balls - 1];
    if (!tile || !ball) return;
    this.ringTile(tile);
    this.top?.add([
      this.place(tile.left + this.layout.tileW, TILE_TOP, this.tickArt()),
      this.place(tile.x, 950, this.bounceArt()),
    ]);

    ball.badge?.destroy();
    const target = { x: tile.x, y: restY(this.layout) };
    if (this.reducedMotion) {
      ball.image.setPosition(target.x, target.y);
      return;
    }
    this.tweens.add({ targets: ball.image, x: target.x, duration: JUMP_MS, ease: "Linear" });
    this.tweens.add({ targets: ball.image, y: target.y, duration: JUMP_MS, ease: "Quad.easeIn" });
  }

  /**
   * Sai, khoá (CR-006): mọi thứ mờ; cốc vừa chạm có dấu ✗ và rung. Đường bi được hỏi là nét đứt
   * vàng từ phễu xuống cốc đúng, cần gạt trên đường giữ sáng và có số bước; đường các bi trước là
   * nét chấm mảnh, mỗi bi nằm trong cốc của nó. Công tắc đã lật vẽ ở hướng mới, kèm bóng nét đứt
   * ở hướng cũ.
   */
  private showMiss(puzzle: MarbleDropPuzzle, choice: number) {
    const l = this.layout;
    const right = this.tiles[puzzle.answer];
    const wrong = this.tiles[choice];
    const mid = this.mid;
    const top = this.top;
    if (!right || !wrong || !mid || !top) return;

    for (const obj of this.dimmable) obj.setAlpha(DIM_ALPHA);
    for (const ball of this.balls) {
      ball.image.destroy();
      ball.badge?.destroy();
    }
    this.balls = [];

    // Thẻ cốc đúng giữ sáng, khoanh vàng.
    this.ringTile(right);
    for (const obj of [right.shadow, right.paper, right.cupImage]) obj.setAlpha(1);

    // Đường bi: nét chấm của các bi trước, nét đứt vàng của bi được hỏi.
    const last = puzzle.balls - 1;
    const trail = this.trailImage(puzzle);
    if (trail) top.add(trail);

    // Cần gạt theo hướng ngay trước khi thả bi được hỏi.
    const dirs = marbleLeverDirsBefore(puzzle.levers, puzzle.paths, last);
    const path = puzzle.paths[last] ?? [];
    for (const view of this.levers) {
      const dir = dirs[view.r]?.[view.i] ?? view.lever.dir;
      const onPath = path[view.r] === view.i;
      const layer = onPath ? top : mid;
      if (dir !== view.lever.dir) {
        const ghost = this.place(
          view.image.x,
          view.image.y,
          this.ghostArt(view.lever.dir, l.lever),
        );
        layer.add(ghost);
        if (!onPath) {
          ghost.setAlpha(DIM_ALPHA);
          mid.moveBelow(ghost, view.image);
        }
      }
      this.retexture(view.image, this.leverArt(dir, view.lever.toggle, l.lever));
      if (!onPath) continue;
      view.image.setAlpha(1);
      top.add(view.image);
      const side = dir === 0 ? 1 : -1;
      top.add(
        this.place(
          view.image.x + side * STEP_OFFSET.x * l.lever,
          view.image.y + STEP_OFFSET.y * l.lever,
          this.stepArt(view.r + 1, l.lever),
        ),
      );
    }

    // Bi nằm trong cốc của nó; nhiều bi trước cùng một cốc thì xếp lệch nhau.
    const perCup = new Map<number, number[]>();
    for (let b = 0; b < last; b++) {
      const cup = puzzle.paths[b]?.[puzzle.tiers] ?? 0;
      perCup.set(cup, [...(perCup.get(cup) ?? []), b]);
    }
    for (const [cup, balls] of perCup) {
      balls.forEach((b, k) => {
        const dx = (k - (balls.length - 1) / 2) * 26 * l.ball;
        top.add(this.place(nodeX(l, puzzle.tiers, cup) + dx, restY(l), this.ballArt(puzzle, b)));
      });
    }
    top.add(this.place(right.x, restY(l), this.ballArt(puzzle, last)));

    // Dấu ✗ ở góc thẻ cốc vừa chạm, vạch rung bên trái thẻ.
    const cross = this.place(wrong.left + 14, TILE_TOP + 10, this.crossArt());
    top.add([cross, this.place(wrong.left - 12, 1046, this.shakeMarkArt())]);

    if (this.reducedMotion || !trail) return;
    // Đường bi luôn đi từ trên xuống: vẽ dần bằng cách mở rộng vùng cắt theo chiều dọc.
    const height = trail.height;
    trail.setCrop(0, 0, trail.width, 0);
    this.tweens.addCounter({
      from: 0,
      to: height,
      duration: TRAIL_MS,
      ease: "Quad.easeOut",
      onUpdate: (tween) => trail.setCrop(0, 0, trail.width, tween.getValue() ?? height),
      onComplete: () => trail.setCrop(),
    });
    this.shake([wrong.shadow, wrong.paper, wrong.cupImage, cross]);
  }

  /** Vòng khoanh quanh thẻ cốc, nằm trên các thẻ khác nhưng dưới chính thẻ đó. */
  private ringTile(tile: TileView) {
    const back = this.back;
    if (!back) return;
    const { sticker, primary } = this.palette;
    const ring = this.add.graphics();
    const args = [
      tile.left - RING_PAD,
      TILE_TOP - RING_PAD,
      this.layout.tileW + RING_PAD * 2,
      TILE_H + RING_PAD * 2,
      RING_RADIUS,
    ] as const;
    ring.lineStyle(RING_OUTER, sticker.num).strokeRoundedRect(...args);
    ring.lineStyle(RING_INNER, primary.num).strokeRoundedRect(...args);
    back.add(ring);
    back.bringToTop(tile.shadow);
    back.bringToTop(tile.paper);
  }

  /** Rung ngang ±8 px rồi về chỗ cũ (Graphics vẽ theo toạ độ tuyệt đối nên gốc là 0). */
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

  /** Các điểm trên đường đi của bi `b`: phễu → từng chạc → hàng cốc → nằm trong cốc. */
  private trailPoints(puzzle: MarbleDropPuzzle, b: number): Pt[] {
    const l = this.layout;
    const path = puzzle.paths[b] ?? [];
    const cup = path[puzzle.tiers] ?? 0;
    const points: Pt[] = [{ x: CENTER_X, y: l.ballY - TRAIL_LEAD * l.ball }];
    for (let r = 0; r < puzzle.tiers; r++) {
      points.push({ x: nodeX(l, r, path[r] ?? 0), y: nodeY(l, r) });
    }
    const x = nodeX(l, puzzle.tiers, cup);
    points.push({ x, y: nodeY(l, puzzle.tiers) }, { x, y: restY(l) });
    return points;
  }

  /**
   * Ảnh đường bi của câu vừa sai (vẽ lại mỗi lần sai, dùng chung một khoá texture). Ảnh cũ đã bị
   * huỷ cùng bảng của câu trước nên xoá texture cũ an toàn.
   */
  private trailImage(puzzle: MarbleDropPuzzle): Phaser.GameObjects.Image | undefined {
    const last = puzzle.balls - 1;
    const routes = Array.from({ length: puzzle.balls }, (_, b) => this.trailPoints(puzzle, b));
    const all = routes.flat();
    const pad = 16;
    const x0 = Math.floor(Math.min(...all.map((p) => p.x)) - pad);
    const y0 = Math.floor(Math.min(...all.map((p) => p.y)) - pad);
    const x1 = Math.ceil(Math.max(...all.map((p) => p.x)) + pad);
    const y1 = Math.ceil(Math.max(...all.map((p) => p.y)) + pad);
    const key = "marble-drop/trail";
    if (this.textures.exists(key)) this.textures.remove(key);
    const texture = this.textures.createCanvas(key, x1 - x0, y1 - y0);
    if (!texture) return undefined;
    const ctx = texture.context;
    ctx.setTransform(1, 0, 0, 1, -x0, -y0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const { line, sticker, primary } = this.palette;
    routes.forEach((points, b) => {
      if (b === last) return;
      ctx.setLineDash([1, 13]);
      stroke(ctx, polyline(points), line.css, 6);
    });
    const asked = polyline(routes[last] ?? []);
    ctx.setLineDash([18, 16]);
    stroke(ctx, asked, sticker.css, 16);
    stroke(ctx, asked, primary.css, 9);
    texture.refresh();
    return this.add.image(x0, y0, key).setOrigin(0, 0);
  }

  // ── Texture vẽ bằng canvas 2D (đặt khoá theo cỡ và bảng màu nên mỗi hình chỉ vẽ một lần) ──

  private place(x: number, y: number, art: Art): Phaser.GameObjects.Image {
    return this.add.image(x, y, art.key).setOrigin(art.ox, art.oy);
  }

  private retexture(image: Phaser.GameObjects.Image, art: Art) {
    image.setTexture(art.key).setOrigin(art.ox, art.oy);
  }

  private paint(name: string, box: Box, zoom: number, draw: (ctx: Ctx, p: Palette) => void): Art {
    const [x0, y0, x1, y1] = box;
    const w = Math.ceil((x1 - x0) * zoom);
    const h = Math.ceil((y1 - y0) * zoom);
    const key = `marble-drop/${name}@${zoom.toFixed(3)}/${this.palette.id}`;
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

  /** Mạng ống theo số tầng: phễu → chạc đỉnh, mỗi chạc xuống hai chạc dưới, hàng cuối xuống cốc. */
  private pipesArt(tiers: number): Art {
    const l = this.layout;
    const half = l.pipeOuter / 2 + 2;
    const box = [
      nodeX(l, tiers, 0) - half,
      l.pipeTop - half,
      nodeX(l, tiers, tiers) + half,
      l.pipeBottom + half,
    ] as const;
    return this.paint(`pipes-${tiers}`, box, 1, (ctx, p) => {
      const shape = new Path2D();
      shape.moveTo(CENTER_X, l.pipeTop);
      shape.lineTo(CENTER_X, nodeY(l, 0));
      for (let r = 0; r < tiers; r++) {
        for (let i = 0; i <= r; i++) {
          shape.moveTo(nodeX(l, r + 1, i), nodeY(l, r + 1));
          shape.lineTo(nodeX(l, r, i), nodeY(l, r));
          shape.lineTo(nodeX(l, r + 1, i + 1), nodeY(l, r + 1));
        }
      }
      for (let c = 0; c <= tiers; c++) {
        shape.moveTo(nodeX(l, tiers, c), nodeY(l, tiers));
        shape.lineTo(nodeX(l, tiers, c), l.pipeBottom);
      }
      stroke(ctx, shape, p.line.css, l.pipeOuter);
      stroke(ctx, shape, p.card.css, l.pipeInner);
    });
  }

  private chuteArt(): Art {
    const half = CHUTE.outer / 2 + 2;
    const box = [CHUTE.x0 - half, CHUTE.y0 - half, CHUTE.x1 + half, CHUTE.y1 + half] as const;
    return this.paint("chute", box, 1, (ctx, p) => {
      const shape = new Path2D(`M${CHUTE.x0} ${CHUTE.y0} L${CHUTE.x1} ${CHUTE.y1}`);
      stroke(ctx, shape, p.line.css, CHUTE.outer);
      stroke(ctx, shape, p.card.css, CHUTE.inner);
    });
  }

  private funnelArt(zoom: number): Art {
    return this.paint("funnel", [-68, -4, 68, 78], zoom, (ctx, p) => {
      const shape = new Path2D(FUNNEL);
      fill(ctx, shape, p.card.css);
      stroke(ctx, shape, p.line.css, 5);
    });
  }

  /** Cần gạt: mũi tên quay quanh chốt; chốt kem cho cần gạt thường, chốt vàng có vòng mũi tên cho công tắc. */
  private leverArt(dir: MarbleDirection, toggle: boolean, zoom: number): Art {
    return this.paint(`lever-${dir}-${toggle ? "t" : "n"}`, [-36, -30, 36, 74], zoom, (ctx, p) => {
      ctx.save();
      ctx.rotate(tiltOf(dir));
      const arrow = new Path2D(ARROW);
      fill(ctx, arrow, p.accent.css);
      stroke(ctx, arrow, p.sticker.css, 4.5);
      ctx.restore();
      if (toggle) {
        const pin = circle(0, 0, 24);
        fill(ctx, pin, p.primary.css);
        stroke(ctx, pin, p.sticker.css, 5);
        stroke(ctx, new Path2D(FLIP_ICON), p.ink.css, 3.6);
        return;
      }
      const pin = circle(0, 0, 19);
      fill(ctx, pin, p.card.css);
      stroke(ctx, pin, p.line.css, 5);
      fill(ctx, circle(0, 0, 5.5), p.line.css);
    });
  }

  /** Bóng nét đứt ở hướng cũ của công tắc đã lật. */
  private ghostArt(dir: MarbleDirection, zoom: number): Art {
    return this.paint(`ghost-${dir}`, [-36, -30, 36, 74], zoom, (ctx, p) => {
      ctx.rotate(tiltOf(dir));
      ctx.setLineDash([7, 6]);
      stroke(ctx, new Path2D(ARROW), p.line.css, 3.5);
    });
  }

  /** Cốc kèm chữ cái (A = cốc 0). Gốc ở tâm miệng cốc. */
  private cupArt(cup: number, zoom: number): Art {
    const letter = String.fromCharCode(65 + cup);
    return this.paint(`cup-${letter}`, [-48, -16, 48, 108], zoom, (ctx, p) => {
      const body = new Path2D(CUP);
      fill(ctx, body, CUP_BODY);
      stroke(ctx, body, p.sticker.css, 5);
      const mouth = new Path2D();
      mouth.ellipse(0, 0, 44, 12, 0, 0, TAU);
      fill(ctx, mouth, CUP_MOUTH);
      stroke(ctx, mouth, p.sticker.css, 5);
      label(ctx, letter, 46, 74, p.ink.css);
    });
  }

  /** Bi: vàng là bi được hỏi, kem là bi thả trước; có nhiều bi thì ghi số thứ tự. */
  private ballArt(puzzle: MarbleDropPuzzle, b: number): Art {
    const asked = b === puzzle.balls - 1;
    const numbered = puzzle.balls > 1;
    const name = `ball-${asked ? "gold" : "cream"}-${numbered ? b + 1 : 0}`;
    return this.paint(name, [-30, -30, 30, 30], this.layout.ball, (ctx, p) => {
      const ball = circle(0, 0, 26);
      fill(ctx, ball, asked ? p.primary.css : p.paper.css);
      stroke(ctx, ball, p.sticker.css, 5);
      ctx.save();
      ctx.globalAlpha = 0.8;
      const shine = new Path2D();
      shine.ellipse(-13, -12, 6, 3.6, Phaser.Math.DegToRad(-35), 0, TAU);
      fill(ctx, shine, SHINE);
      ctx.restore();
      if (numbered) label(ctx, String(b + 1), 30, 10.5, p.ink.css);
    });
  }

  private questionArt(): Art {
    return this.paint("question", [-19, -19, 19, 19], 1, (ctx, p) => {
      const badge = circle(0, 0, 16);
      fill(ctx, badge, p.ink.css);
      stroke(ctx, badge, p.paper.css, 3);
      label(ctx, "?", 25, 9, p.primary.css);
    });
  }

  private stepArt(n: number, zoom: number): Art {
    return this.paint(`step-${n}`, [-21, -21, 21, 21], zoom, (ctx, p) => {
      const badge = circle(0, 0, 18);
      fill(ctx, badge, p.card.css);
      stroke(ctx, badge, p.line.css, 4);
      label(ctx, String(n), 24, 8.5, p.line.css);
    });
  }

  private crossArt(): Art {
    return this.paint("cross", [-35, -35, 35, 35], 1, (ctx, p) => {
      const cross = new Path2D(CROSS);
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
      stroke(ctx, new Path2D(TICK), p.sticker.css, 6);
    });
  }

  private bounceArt(): Art {
    return this.paint("bounce", [-40, -18, 40, 8], 1, (ctx, p) => {
      stroke(ctx, new Path2D(BOUNCE_MARKS), p.line.css, 5);
    });
  }

  private shakeMarkArt(): Art {
    return this.paint("shake", [-10, -4, 4, 72], 1, (ctx, p) => {
      stroke(ctx, new Path2D(SHAKE_MARK), p.line.css, 5);
    });
  }
}
