import {
  type CupShuffleAnswer,
  type CupShufflePuzzle,
  cupShuffle,
  cupShuffleCupOrder,
  cupShuffleInputAtMs,
  cupShuffleItemSlots,
  cupShuffleMoveStartMs,
  WRONG_ANSWER_LOCK_MS,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import { EYE_PATH, HAND_PATH } from "../_shared/icons";
import { shouldIgnoreGameKey } from "../keyboard";
import type { MinigameBridge } from "../types";
import {
  CHALK_SIZE,
  type CupColors,
  drawChalk,
  drawCup,
  drawEraser,
  drawRotateIcon,
  ERASER_SIZE,
  type ItemColors,
} from "./shapes";

/*
 * Tráo cốc — đặc tả: docs/04-minigames/cup-shuffle.md (mục "Ghi chú cho FE" và "Hiện đáp án đúng
 * khi sai"). Cốc nhấc lên cho thấy vật → úp xuống → tráo theo `moves` → hết tráo mới chạm được.
 * Toàn bộ pha xem + tráo là HÀM THUẦN của `t` (ms tính từ khung hình đầu tiên của câu): mỗi khung
 * đặt lại mọi cốc đúng chỗ của thời điểm `t`, không tween nối đuôi, không đếm khung hình.
 * Scene không vẽ chữ: chỉ cốc, vật, biểu tượng và thanh thời gian.
 */

// ---------------------------------------------------------------- bố cục (khung 720×1280)

/** Đáy cốc đứng trên bàn; mặt bàn (vạch ngang) ngay dưới. */
const BASE_Y = 820;
const TABLE = { y: 830, x0: 36, x1: 684, width: 6 } as const;
/** Pha xem: cốc nhấc lên 90 px. Rê chuột lúc chờ chạm: nhấc 8 px. */
const LIFT = 90;
const HOVER_LIFT = 8;
/** Vùng chạm: cả cột của ô, từ y 560 tới 900. */
const ZONE_TOP = 560;
const ZONE_BOTTOM = 900;

/** Hàng cốc theo số cốc: tâm ô, khoảng cách hai tâm (= bề rộng vùng chạm), cỡ cốc, tỉ lệ vật. */
interface RowLayout {
  xs: number[];
  pitch: number;
  cupW: number;
  cupH: number;
  /** Nét viền cốc. */
  line: number;
  /** Tỉ lệ vẽ vật so với hàng 3 cốc. */
  item: number;
}

const ROWS: Record<number, RowLayout> = {
  3: { xs: [160, 360, 560], pitch: 200, cupW: 150, cupH: 170, line: 5, item: 1 },
  4: { xs: [120, 280, 440, 600], pitch: 160, cupW: 130, cupH: 150, line: 4.5, item: 0.9 },
  5: { xs: [96, 228, 360, 492, 624], pitch: 132, cupW: 112, cupH: 130, line: 4, item: 0.8 },
};

/** Huy hiệu trạng thái Ø 112 (mắt → cốc úp → ngón tay); huy hiệu xoay vòng Ø 80 (Khó, Siêu khó). */
const STATUS = { x: 360, y: 140, r: 56 } as const;
const ROTATE = { x: 500, y: 140, r: 40 } as const;
/** Huy hiệu xoay vòng lúc không có lượt xoay. */
const ROTATE_IDLE_ALPHA = 0.4;
/** Thanh tráo / khoá 420×14. */
const BAR = { x: 150, y: 229, w: 420, h: 14 } as const;
/** Siêu khó: bong bóng hỏi vật Ø 140, dưới dải huy hiệu khoá (y ≈ 225). */
const BUBBLE = { x: 360, y: 420, r: 70, item: 1.35 } as const;

/** Đường đi của cốc: cung cao 0,35 × quãng đường, tối đa 140 px; cốc vòng phía trước to hơn 6 %. */
const ARC_RATIO = 0.35;
const ARC_MAX = 140;
const FRONT_SCALE = 0.06;
/** Giữa hai khung hình trong pha xem / tráo mà đồng hồ nhảy quá ngần này thì dừng đồng hồ câu. */
const MAX_FRAME_GAP_MS = 250;

/** Vòng vàng quanh cốc đúng + vật (lúc cốc nhấc lên): lề quanh cốc, bo góc, độ dày (mực, vàng). */
const RING = { pad: 15, top: 12, bottom: 14, radius: 26, ink: 13, gold: 7 } as const;
const CHECK = "M-11 1 L-3 9 L12 -8";

// ---------------------------------------------------------------- nhịp hiệu ứng (đều ≤ 300 ms)

const FADE_IN_MS = 120;
const POP_MS = 150;
/** Đúng: cốc nhấc lên lộ vật rồi sang câu mới; tính vào thời gian câu sau nên giữ ≤ 300 ms. */
const SOLVED_MS = 300;
const REVEAL_LIFT_MS = 120;
const ITEM_POP_MS = 180;
const SHAKE_MS = 200;
const SHAKE_PX = 8;
const DIM_MS = 120;
const DIM_ALPHA = 0.35;
/** Cốc nghiêng theo hướng chạy (độ), bụi phấn khi cốc chạm bàn, cốc nhún khi dừng. */
const TILT_DEG = 7;
const DUST_MS = 260;
const SQUASH_MS = 160;

// ---------------------------------------------------------------- màu

/** Màu đọc từ token CSS lúc tạo scene (tự đổi theo sáng/tối). */
interface Palette {
  dark: boolean;
  card: string;
  cardFg: string;
  sticker: string;
  primary: string;
  destructive: string;
  chalk: string;
  chalkMuted: string;
  /** Màu nhóm Nhận diện: dải trên thân cốc, thanh tráo, huy hiệu xoay vòng. */
  identify: string;
  /** Mực và giấy của thương hiệu (giống nhau ở hai giao diện): viền và thân vật. */
  ink: string;
  paper: string;
}

function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    dark: style.colorScheme === "dark",
    card: token("--card"),
    cardFg: token("--card-foreground"),
    sticker: token("--sticker"),
    primary: token("--primary"),
    destructive: token("--destructive"),
    chalk: token("--chalk"),
    chalkMuted: token("--chalk-muted"),
    identify: token("--color-identify"),
    ink: token("--color-ink"),
    paper: token("--color-paper"),
  };
}

/** Màu CSS → số màu của Phaser. */
const toColor = (css: string) => Phaser.Display.Color.ValueToColor(css).color;

const easeInOutSine = (u: number) => -(Math.cos(Math.PI * u) - 1) / 2;

type Ctx = CanvasRenderingContext2D;

/** Lề quanh hình trong texture (chừa nét viền, viền phấn ở nền tối). */
const TEX_PAD = 8;

function circlePath(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

// Giảm chuyển động (`prefersReducedMotion`, theo nút Hiệu ứng): KHÔNG bỏ phần nhấc / úp / tráo cốc
// (nội dung câu đố). Chỉ bỏ hiệu ứng phụ: nghiêng, bụi phấn, nhún, nảy, rung, mờ dần; dấu tích, X,
// vòng vàng và cốc nhấc lên khi hiện đáp án vẫn giữ (hiện ngay, không chạy hiệu ứng).

// ---------------------------------------------------------------- dòng thời gian

/** Một chiếc cốc chạy trong một lượt tráo. */
interface Step {
  cup: number;
  from: number;
  to: number;
  /** Độ cao cung (px). */
  arc: number;
  /** Cốc đi sang trái vòng phía dưới (phía trước), to hơn; cốc sang phải vòng phía trên. */
  front: boolean;
}

/** Mọi thứ tính sẵn của một câu để mỗi khung chỉ còn nội suy. */
interface Plan {
  /** Mốc bắt đầu lượt đầu và mốc hết tráo (ms). */
  shuffleAt: number;
  inputAt: number;
  /** `slotOf[k][cốc]` = ô của cốc trước lượt `k`; `k = moves.length`: sau lượt cuối. */
  slotOf: number[][];
  /** `cupAt[ô]` sau lượt cuối. */
  finalCupAt: number[];
  /** Các cốc chạy trong lượt `k`. */
  steps: Step[][];
  /** Lượt `k` là xoay vòng 3 cốc. */
  rotation: boolean[];
}

function buildPlan(puzzle: CupShufflePuzzle, row: RowLayout): Plan {
  const n = puzzle.moves.length;
  const cupAt = Array.from({ length: n + 1 }, (_, k) => cupShuffleCupOrder(puzzle, k));
  const slotOf = cupAt.map((order) => {
    const inverse = Array<number>(puzzle.cups).fill(0);
    order.forEach((cup, slot) => {
      inverse[cup] = slot;
    });
    return inverse;
  });
  const steps = puzzle.moves.map((move, k) =>
    move.map((from, i): Step => {
      const to = move[(i + 1) % move.length] as number;
      const dx = (row.xs[to] ?? 0) - (row.xs[from] ?? 0);
      return {
        cup: cupAt[k]?.[from] ?? 0,
        from,
        to,
        arc: Math.min(ARC_MAX, ARC_RATIO * Math.abs(dx)),
        front: dx < 0,
      };
    }),
  );
  return {
    shuffleAt: cupShuffleMoveStartMs(puzzle, 0),
    inputAt: cupShuffleInputAtMs(puzzle),
    slotOf,
    finalCupAt: cupAt[n] ?? [],
    steps,
    rotation: puzzle.moves.map((m) => m.length === 3),
  };
}

// ---------------------------------------------------------------- scene

type Phase = "show" | "cover" | "shuffle" | "input" | "done";
type Dimmable = Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
type StatusIcon = "eye" | "cup" | "hand";

interface CupView {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
}

/** Tráo cốc — dõi theo cốc úp cục phấn rồi chạm đúng cốc đó (Siêu khó: phấn hoặc tẩy). */
export default class CupShuffleScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private colors!: Palette;
  private reducedMotion = false;

  private phase: Phase = "done";
  private puzzle?: CupShufflePuzzle;
  private plan?: Plan;
  private row: RowLayout = ROWS[3] as RowLayout;
  /** Đồng hồ của câu: `t = this.time.now − t0`; `undefined` = chưa có khung hình đầu tiên. */
  private t0?: number;
  private lastNow = 0;
  /** Lượt tráo đang chạy (−1 = không có), để chỉ xếp lại lớp cốc khi đổi lượt. */
  private activeMove = -1;
  private dusted = false;
  private statusIcon?: StatusIcon;
  /** Ẩn tab lúc đang xem / tráo → quay lại thì chiếu lại câu từ pha xem. */
  private replayOnVisible = false;
  /** Hẹn giờ của câu hiện tại; huỷ hết khi sang câu mới. */
  private timers: Phaser.Time.TimerEvent[] = [];
  private canHover = false;
  private hovered = -1;

  private root?: Phaser.GameObjects.Container;
  private cupLayer?: Phaser.GameObjects.Container;
  private marks?: Phaser.GameObjects.Container;
  private cups: CupView[] = [];
  /** Vật theo thứ tự `start` (0 = phấn, 1 = tẩy). */
  private items: Phaser.GameObjects.Image[] = [];
  private zones: Phaser.GameObjects.Zone[] = [];
  private status?: Phaser.GameObjects.Container;
  private icons: Partial<Record<StatusIcon, Phaser.GameObjects.Image>> = {};
  private rotate?: Phaser.GameObjects.Container;
  private rotateLit?: Phaser.GameObjects.Image;
  private bubble?: Phaser.GameObjects.Container;
  private bar?: Phaser.GameObjects.Graphics;
  private lock = { width: 0 };

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.phase = "done";
    this.puzzle = undefined;
    this.plan = undefined;
    this.timers = [];
    this.hovered = -1;
  }

  create() {
    const canvas = this.game.canvas;
    this.colors = readPalette(canvas.isConnected ? canvas : document.documentElement);
    this.canHover =
      typeof window.matchMedia === "function" && window.matchMedia("(hover: hover)").matches;
    this.drawTable();

    const onHidden = () => {
      if (this.inTimeline()) this.replayOnVisible = true;
    };
    const onVisible = () => {
      if (this.replayOnVisible && this.inTimeline()) this.restartTimeline();
      this.replayOnVisible = false;
    };
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.game.events.on(Phaser.Core.Events.VISIBLE, onVisible);
    // Bàn phím (tuỳ chọn): phím 1–5 = cốc thứ 1–5 từ trái sang.
    window.addEventListener("keydown", this.onKey);
    const detach = () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden);
      this.game.events.off(Phaser.Core.Events.VISIBLE, onVisible);
      window.removeEventListener("keydown", this.onKey);
      this.clearTimers();
      this.phase = "done";
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      detach();
      this.tweens.killAll();
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, detach);

    this.showPuzzle();
  }

  override update() {
    if (!this.inTimeline() || !this.plan) return;
    const now = this.time.now;
    if (this.t0 === undefined) {
      // Khung hình đầu tiên của câu: bắt đầu đồng hồ.
      this.t0 = now;
      this.lastNow = now;
    }
    // Tab bị bóp / GC: dừng đồng hồ câu đúng bằng quãng nhảy để không lượt tráo nào bị bỏ qua.
    const gap = now - this.lastNow;
    if (gap > MAX_FRAME_GAP_MS) this.t0 += gap;
    this.lastNow = now;

    const t = now - this.t0;
    if (t >= this.plan.inputAt) {
      this.beginInput();
      return;
    }
    this.render(t);
  }

  private inTimeline() {
    return this.phase === "show" || this.phase === "cover" || this.phase === "shuffle";
  }

  // -------------------------------------------------------------- dựng câu đố

  private showPuzzle() {
    // Mọi hẹn giờ và tween đang chạy đều thuộc câu cũ: dừng trước khi huỷ.
    this.clearTimers();
    this.tweens.killAll();
    this.root?.destroy();
    this.reducedMotion = prefersReducedMotion();

    const puzzle = cupShuffle.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    const row = ROWS[puzzle.cups] ?? (ROWS[3] as RowLayout);
    this.puzzle = puzzle;
    this.row = row;
    this.plan = buildPlan(puzzle, row);
    this.hovered = -1;
    this.lock.width = 0;

    const root = this.add.container(0, 0);
    const shadowLayer = this.add.container(0, 0);
    const itemLayer = this.add.container(0, 0);
    const cupLayer = this.add.container(0, 0);
    const marks = this.add.container(0, 0);

    const shadowColor = toColor(this.colors.sticker);
    const shadowAlpha = this.colors.dark ? 0.45 : 0.16;
    this.cups = Array.from({ length: puzzle.cups }, () => {
      const shadow = this.add.ellipse(0, 0, row.cupW * 0.92, 18, shadowColor, shadowAlpha);
      const img = this.add.image(0, 0, this.cupTexture()).setOrigin(...this.cupOrigin());
      shadowLayer.add(shadow);
      cupLayer.add(img);
      return { img, shadow };
    });
    this.items = puzzle.start.map((_, j) => {
      const key = this.itemTexture(j, row.item);
      const img = this.add.image(0, 0, key).setOrigin(...this.itemOrigin(j, row.item));
      itemLayer.add(img);
      return img;
    });
    this.zones = row.xs.map((x, slot) => this.makeZone(x, slot));

    const status = this.add.container(STATUS.x, STATUS.y, [
      this.add.image(0, 0, this.badgeTexture()),
    ]);
    this.icons = {};
    for (const icon of ["eye", "cup", "hand"] as const) {
      const img = this.add.image(0, 0, this.iconTexture(icon)).setVisible(false);
      status.add(img);
      this.icons[icon] = img;
    }
    this.status = status;
    this.statusIcon = undefined;

    // Khó, Siêu khó: huy hiệu xoay vòng, sáng lên trong lượt xoay.
    this.rotate = undefined;
    this.rotateLit = undefined;
    if (this.bridge.difficulty >= 2) {
      const lit = this.add.image(0, 0, this.rotateTexture(true)).setVisible(false);
      this.rotate = this.add
        .container(ROTATE.x, ROTATE.y, [this.add.image(0, 0, this.rotateTexture(false)), lit])
        .setAlpha(ROTATE_IDLE_ALPHA);
      this.rotateLit = lit;
    }

    // Siêu khó: bong bóng hỏi vật, hiện lúc hết tráo.
    this.bubble = undefined;
    if (puzzle.start.length > 1) {
      const key = this.itemTexture(puzzle.target, BUBBLE.item);
      this.bubble = this.add
        .container(BUBBLE.x, BUBBLE.y, [
          this.add.image(0, 0, this.bubbleTexture()),
          this.add.image(0, 0, key),
        ])
        .setVisible(false);
    }

    const bar = this.add.graphics();
    root.add([shadowLayer, itemLayer, cupLayer, marks, status, bar]);
    if (this.rotate) root.add(this.rotate);
    if (this.bubble) root.add(this.bubble);
    for (const zone of this.zones) root.add(zone);

    this.root = root;
    this.cupLayer = cupLayer;
    this.marks = marks;
    this.bar = bar;

    this.restartTimeline();

    // Câu mới mờ dần vào (hiệu ứng phụ).
    if (!this.reducedMotion) {
      root.setAlpha(0);
      this.tweens.add({ targets: root, alpha: 1, duration: FADE_IN_MS });
    }
  }

  /** Chiếu (hoặc chiếu lại) câu từ pha xem: đồng hồ bắt đầu lại ở khung hình kế tiếp. */
  private restartTimeline() {
    this.phase = "show";
    this.t0 = undefined;
    this.activeMove = -1;
    this.dusted = false;
    this.setZones(false);
    this.render(0);
  }

  /** Mặt bàn: vạch ngang (mực mờ ở nền sáng, phấn ở nền tối), vẽ một lần cho cả vòng. */
  private drawTable() {
    const c = this.colors;
    const g = this.add.graphics();
    g.fillStyle(toColor(c.dark ? c.chalkMuted : c.cardFg), c.dark ? 0.55 : 0.35);
    g.fillRoundedRect(
      TABLE.x0,
      TABLE.y - TABLE.width / 2,
      TABLE.x1 - TABLE.x0,
      TABLE.width,
      TABLE.width / 2,
    );
  }

  /** Vùng chạm = cả cột của ô (chạm theo ô, không theo hình cốc). Chỉ bật ở pha chờ chạm. */
  private makeZone(x: number, slot: number) {
    const { pitch } = this.row;
    const zone = this.add
      .zone(x, (ZONE_TOP + ZONE_BOTTOM) / 2, pitch, ZONE_BOTTOM - ZONE_TOP)
      .setInteractive({ useHandCursor: true });
    zone.disableInteractive();
    zone.on("pointerdown", () => this.choose(slot));
    zone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
      if (this.canHover && !pointer.wasTouch) this.hover(slot);
    });
    zone.on("pointerout", () => {
      if (this.hovered === slot) this.hover(-1);
    });
    return zone;
  }

  private setZones(on: boolean) {
    for (const zone of this.zones) {
      if (on) zone.setInteractive();
      else zone.disableInteractive();
    }
  }

  // -------------------------------------------------------------- dòng thời gian

  /** Đặt mọi thứ đúng chỗ của thời điểm `t` (ms) trong pha xem / úp / tráo. Hàm thuần của `t`. */
  private render(t: number) {
    const puzzle = this.puzzle;
    const plan = this.plan;
    if (!puzzle || !plan) return;
    const { xs } = this.row;
    const n = puzzle.moves.length;

    // Nhấc / úp cốc.
    const coverEnd = puzzle.showMs + puzzle.coverMs;
    let lift = 0;
    if (t < puzzle.showMs) lift = LIFT;
    else if (t < coverEnd) {
      const u = (t - puzzle.showMs) / puzzle.coverMs;
      lift = LIFT * (1 - u * u);
    }

    // Lượt tráo đang chạy và tỉ lệ trong lượt.
    let k = 0;
    let u = 0;
    let moving: Step[] | undefined;
    if (t >= plan.inputAt) k = n;
    else if (t >= plan.shuffleAt) {
      const s = (t - plan.shuffleAt) / puzzle.moveMs;
      k = Math.min(n - 1, Math.floor(s));
      u = Math.min(1, s - k);
      moving = plan.steps[k];
    }
    this.setActiveMove(moving ? k : -1);

    const slotOf = plan.slotOf[k] ?? [];
    const e = easeInOutSine(u);
    const bump = Math.sin(Math.PI * e);
    this.cups.forEach((view, cup) => {
      this.placeCup(view, xs[slotOf[cup] ?? 0] ?? 0, 0, 1, 0, lift);
    });
    for (const step of moving ?? []) {
      const view = this.cups[step.cup];
      if (!view) continue;
      const fromX = xs[step.from] ?? 0;
      const toX = xs[step.to] ?? 0;
      const x = fromX + (toX - fromX) * e;
      const y = (step.front ? 1 : -1) * step.arc * bump;
      const scale = step.front ? 1 + FRONT_SCALE * bump : 1;
      const angle = this.reducedMotion
        ? 0
        : Math.sign(toX - fromX) * TILT_DEG * Math.sin(Math.PI * u);
      this.placeCup(view, x, y, scale, angle, 0);
    }

    // Vật: nằm dưới cốc của nó ở pha xem, ẩn hẳn từ lúc cốc úp xong (không hiện xuyên cốc).
    const hidden = t >= coverEnd;
    this.items.forEach((item, j) => {
      item.setVisible(!hidden).setAlpha(1).setScale(1);
      item.setPosition(xs[puzzle.start[j] ?? 0] ?? 0, BASE_Y);
    });
    if (hidden && !this.dusted) {
      this.dusted = true;
      this.dust();
    }

    this.phase = t < puzzle.showMs ? "show" : t < coverEnd ? "cover" : "shuffle";
    this.setStatus(t < puzzle.showMs ? "eye" : "cup");
    this.drawBar(BAR.w * Math.max(0, 1 - t / plan.inputAt), this.colors.identify);
  }

  /** Đặt cốc và bóng: `y` là độ lệch trên mặt bàn (cung tráo), `lift` là độ nhấc khỏi bàn. */
  private placeCup(view: CupView, x: number, y: number, scale: number, angle: number, lift = 0) {
    view.img
      .setPosition(x, BASE_Y + y - lift)
      .setScale(scale)
      .setAngle(angle);
    // Bóng nằm trên bàn (theo cung tráo), thu nhỏ khi cốc nhấc lên.
    view.shadow.setPosition(x, BASE_Y + y).setScale(scale * (1 - 0.25 * (lift / LIFT)));
  }

  /** Đổi lượt: xếp lớp cốc (vòng sau dưới cùng, vòng trước trên cùng) và bật huy hiệu xoay vòng. */
  private setActiveMove(k: number) {
    if (k === this.activeMove) return;
    this.activeMove = k;
    const plan = this.plan;
    const layer = this.cupLayer;
    const steps = k >= 0 ? (plan?.steps[k] ?? []) : [];
    if (layer) {
      // Cung càng cao (vòng sau, đi xa hơn) càng nằm dưới; cung trước càng sâu càng nằm trên.
      const back = steps.filter((s) => !s.front).sort((a, b) => a.arc - b.arc);
      const front = steps.filter((s) => s.front).sort((a, b) => a.arc - b.arc);
      for (const s of back) {
        const img = this.cups[s.cup]?.img;
        if (img) layer.sendToBack(img);
      }
      for (const s of front) {
        const img = this.cups[s.cup]?.img;
        if (img) layer.bringToTop(img);
      }
    }
    const rotating = k >= 0 && (plan?.rotation[k] ?? false);
    if (this.rotate && this.rotateLit) {
      const wasLit = this.rotateLit.visible;
      this.rotateLit.setVisible(rotating);
      this.rotate.setAlpha(rotating ? 1 : ROTATE_IDLE_ALPHA);
      if (rotating && !wasLit) this.pop(this.rotate);
    }
  }

  private setStatus(icon: StatusIcon) {
    if (icon === this.statusIcon) return;
    const first = this.statusIcon === undefined;
    this.statusIcon = icon;
    for (const [name, img] of Object.entries(this.icons)) img?.setVisible(name === icon);
    if (!first && this.status) this.pop(this.status);
  }

  /** Hết tráo: cốc đứng yên đúng ô cuối, ngón tay; Siêu khó hiện vật được hỏi. */
  private beginInput() {
    const plan = this.plan;
    if (!plan || !this.inTimeline()) return;
    this.render(plan.inputAt);
    this.phase = "input";
    this.setStatus("hand");
    this.drawBar(0, this.colors.identify);
    if (this.bubble) {
      this.bubble.setVisible(true);
      this.pop(this.bubble);
    }
    // Cốc nhún khi dừng (hiệu ứng phụ).
    if (!this.reducedMotion) {
      this.tweens.add({
        targets: this.cups.map((c) => c.img),
        scaleY: 0.94,
        scaleX: 1.03,
        duration: SQUASH_MS / 2,
        yoyo: true,
        ease: "Quad.easeOut",
      });
    }
    this.setZones(true);
  }

  // -------------------------------------------------------------- nhập

  private onKey = (event: KeyboardEvent) => {
    if (event.repeat || shouldIgnoreGameKey(event)) return;
    const slot = Number.parseInt(event.key, 10) - 1;
    const cups = this.puzzle?.cups ?? 0;
    if (!Number.isInteger(slot) || slot < 0 || slot >= cups) return;
    if (this.phase !== "input") return;
    event.preventDefault();
    this.choose(slot);
  };

  /** Máy tính: rê chuột lên cột thì cốc ở ô đó nhấc 8 px. */
  private hover(slot: number) {
    const plan = this.plan;
    if (!plan) return;
    const prev = this.cups[plan.finalCupAt[this.hovered] ?? -1];
    if (prev && this.phase === "input") prev.img.setY(BASE_Y);
    this.hovered = -1;
    if (slot < 0 || this.phase !== "input") return;
    const view = this.cups[plan.finalCupAt[slot] ?? -1];
    if (!view) return;
    this.hovered = slot;
    view.img.setY(BASE_Y - HOVER_LIFT);
  }

  private choose(slot: number) {
    const puzzle = this.puzzle;
    if (this.phase !== "input" || !puzzle || slot < 0 || slot >= puzzle.cups) return;
    this.hover(-1);
    this.phase = "done";
    this.setZones(false);
    // Dừng nhún của lúc hết tráo để cốc nhấc lên đúng cỡ.
    for (const view of this.cups) {
      this.tweens.killTweensOf(view.img);
      view.img.setScale(1);
    }

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const index = this.index;
    const answer: CupShuffleAnswer = slot;
    this.bridge.submit(index, answer);
    this.index += 1;

    if (cupShuffle.check(puzzle, answer)) this.solved(puzzle, slot);
    else this.miss(puzzle, slot, index);
  }

  /** Đúng: cốc vừa chạm nhấc lên lộ vật, vòng vàng + dấu tích, rồi sang câu mới sau 300 ms. */
  private solved(puzzle: CupShufflePuzzle, slot: number) {
    this.revealItems(puzzle, [puzzle.target]);
    this.liftCup(slot);
    this.ring(slot, true);
    this.after(SOLVED_MS, () => this.showPuzzle());
  }

  /**
   * Sai → khoá (mục "Hiện đáp án đúng khi sai"): mọi cốc nhấc lên cho thấy vật thật ở đâu (Siêu
   * khó thấy cả phấn lẫn tẩy); cốc đúng có vòng vàng dày; cốc chạm sai có dấu X và rung; các cốc
   * còn lại mờ 35 %. Mọi thứ nằm trong hàng cốc (y ≥ 548), dưới dải huy hiệu khoá của khung.
   */
  private miss(puzzle: CupShufflePuzzle, slot: number, index: number) {
    const plan = this.plan;
    const marks = this.marks;
    if (!plan || !marks) return;
    this.revealItems(
      puzzle,
      puzzle.start.map((_, j) => j),
    );
    for (let s = 0; s < puzzle.cups; s++) this.liftCup(s);

    // Mờ các cốc không phải cốc đúng, không phải cốc vừa chạm. Vật dưới cốc mờ (Siêu khó: vật kia)
    // vẫn rõ để người chơi thấy cả phấn lẫn tẩy nằm ở đâu.
    for (let s = 0; s < puzzle.cups; s++) {
      if (s === puzzle.answer || s === slot) continue;
      const view = this.cups[plan.finalCupAt[s] ?? -1];
      if (view) this.fade([view.img, view.shadow], DIM_ALPHA);
    }
    this.ring(puzzle.answer, false);

    // Dấu X trên chỗ trống (hoặc trên vật kia ở Siêu khó) dưới cốc vừa chạm, rung cùng cốc.
    const x = this.row.xs[slot] ?? 0;
    const cross = this.add.image(x, BASE_Y - 22 * this.row.item, this.crossTexture());
    marks.add(cross);
    const wrong = this.cups[plan.finalCupAt[slot] ?? -1];
    this.shake([cross, ...(wrong ? [wrong.img] : [])]);

    // Thanh khoá chạy ngay theo thời gian khoá chuẩn, rồi chỉnh theo `lockedUntil` khi server trả lời.
    this.lock.width = BAR.w;
    this.runLockBar(WRONG_ANSWER_LOCK_MS);
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive() || this.puzzle !== puzzle) return;
      this.runLockBar(ms);
      this.after(ms, () => this.showPuzzle());
    });
  }

  /** Đặt các vật `which` đúng ô cuối, hiện ra (nảy nhẹ). */
  private revealItems(puzzle: CupShufflePuzzle, which: number[]) {
    const slots = cupShuffleItemSlots(puzzle);
    for (const j of which) {
      const item = this.items[j];
      if (!item) continue;
      item.setPosition(this.row.xs[slots[j] ?? 0] ?? 0, BASE_Y).setVisible(true);
      if (this.reducedMotion) continue;
      item.setScale(0.7);
      this.tweens.add({ targets: item, scale: 1, duration: ITEM_POP_MS, ease: "Back.easeOut" });
    }
  }

  /** Cốc ở ô `slot` nhấc lên (giảm chuyển động: nhấc ngay, không chạy). */
  private liftCup(slot: number) {
    const view = this.cups[this.plan?.finalCupAt[slot] ?? -1];
    if (!view) return;
    const x = view.img.x;
    view.img.setScale(1).setAngle(0);
    if (this.reducedMotion) {
      this.placeCup(view, x, 0, 1, 0, LIFT);
      return;
    }
    const state = { lift: Math.max(0, BASE_Y - view.img.y) };
    this.tweens.add({
      targets: state,
      lift: LIFT,
      duration: REVEAL_LIFT_MS,
      ease: "Quad.easeOut",
      onUpdate: () => this.placeCup(view, view.img.x, 0, 1, 0, state.lift),
    });
  }

  /** Vòng vàng dày quanh cốc đã nhấc + vật ở ô `slot`; `check` thêm dấu tích ở góc trên phải. */
  private ring(slot: number, check: boolean) {
    const marks = this.marks;
    if (!marks) return;
    const { cupW, cupH, pitch } = this.row;
    const c = this.colors;
    const x = this.row.xs[slot] ?? 0;
    const w = Math.min(cupW + 2 * RING.pad, pitch - 6);
    const top = BASE_Y - LIFT - cupH - RING.top;
    const h = BASE_Y + RING.bottom - top;
    const g = this.add.graphics();
    g.lineStyle(RING.ink, toColor(c.sticker));
    g.strokeRoundedRect(x - w / 2, top, w, h, RING.radius);
    g.lineStyle(RING.gold, toColor(c.primary));
    g.strokeRoundedRect(x - w / 2, top, w, h, RING.radius);
    marks.add(g);
    if (!check) return;
    const badge = this.add.image(x + w / 2 - 8, top + 8, this.checkTexture());
    marks.add(badge);
    this.pop(badge);
  }

  // -------------------------------------------------------------- thanh tráo / khoá

  /** Thanh rút dần: `fill` px, màu `color`; 0 = ẩn thanh. */
  private drawBar(fill: number, color: string) {
    const g = this.bar;
    if (!g) return;
    g.clear();
    if (fill <= 0) return;
    const c = this.colors;
    const { x, y, w, h } = BAR;
    const r = h / 2;
    g.fillStyle(toColor(c.card));
    g.fillRoundedRect(x, y, w, h, r);
    g.fillStyle(toColor(color));
    g.fillRoundedRect(x, y, fill, h, Math.min(r, fill / 2));
    g.lineStyle(3, toColor(c.cardFg));
    g.strokeRoundedRect(x, y, w, h, r);
  }

  /** Thanh khoá (màu mực) rút từ độ dài hiện tại về 0 trong `ms`. */
  private runLockBar(ms: number) {
    this.tweens.killTweensOf(this.lock);
    const draw = () => this.drawBar(this.lock.width, this.colors.cardFg);
    if (ms <= 0) {
      this.lock.width = 0;
      draw();
      return;
    }
    draw();
    this.tweens.add({ targets: this.lock, width: 0, duration: ms, onUpdate: draw });
  }

  // -------------------------------------------------------------- hiệu ứng, hẹn giờ

  /** Nảy nhẹ (đổi pha, huy hiệu). Bỏ qua khi bật giảm chuyển động. */
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

  /** Mờ dần (giảm chuyển động: mờ ngay). */
  private fade(targets: Dimmable[], alpha: number) {
    if (this.reducedMotion) {
      for (const target of targets) target.setAlpha(alpha);
      return;
    }
    this.tweens.add({ targets, alpha, duration: DIM_MS });
  }

  /** Rung ngang ±8 px trong 200 ms, hai nhịp, rồi về chỗ cũ. */
  private shake(targets: Phaser.GameObjects.Image[]) {
    if (this.reducedMotion) return;
    const items = targets.map((target) => ({ target, x: target.x }));
    const place = (offset: number) => {
      for (const { target, x } of items) target.setX(x + offset);
    };
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: SHAKE_MS,
      onUpdate: (tween) => place(SHAKE_PX * Math.sin((tween.getValue() ?? 0) * 4 * Math.PI)),
      onComplete: () => place(0),
    });
  }

  /** Bụi phấn ở chân mỗi cốc khi cốc úp chạm bàn (hiệu ứng phụ). */
  private dust() {
    const root = this.root;
    if (this.reducedMotion || !root) return;
    const c = this.colors;
    const color = toColor(c.dark ? c.chalk : c.sticker);
    const alpha = c.dark ? 0.55 : 0.22;
    const { cupW, item } = this.row;
    for (const view of this.cups) {
      for (const side of [-1, 1]) {
        const puff = this.add.circle(
          view.img.x + side * cupW * 0.48,
          BASE_Y - 4,
          6 * item,
          color,
          alpha,
        );
        root.addAt(puff, 0);
        this.tweens.add({
          targets: puff,
          x: puff.x + side * 18,
          y: puff.y - 6,
          scale: 1.8,
          alpha: 0,
          duration: DUST_MS,
          ease: "Quad.easeOut",
          onComplete: () => puff.destroy(),
        });
      }
    }
  }

  private after(ms: number, callback: () => void) {
    this.timers.push(this.time.delayedCall(ms, callback));
  }

  private clearTimers() {
    for (const timer of this.timers) timer.remove(false);
    this.timers = [];
  }

  // -------------------------------------------------------------- texture (vẽ một lần mỗi vòng)

  /** Tạo texture từ canvas 2D (gốc toạ độ ở `origin`, mặc định tâm) nếu chưa có; trả về khoá. */
  private texture(
    key: string,
    width: number,
    height: number,
    draw: (ctx: Ctx) => void,
    origin: [number, number] = [width / 2, height / 2],
  ): string {
    const full = `cup-shuffle:${key}:${this.colors.dark ? "dark" : "light"}`;
    if (this.textures.exists(full)) return full;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.translate(origin[0], origin[1]);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      draw(ctx);
    }
    this.textures.addCanvas(full, canvas);
    return full;
  }

  private cupColors(): CupColors {
    const c = this.colors;
    // Nền sáng: cốc giấy viền mực. Nền tối: cốc nền mực viền phấn. Dải cam Nhận diện ở cả hai.
    return c.dark
      ? { body: c.sticker, line: c.chalk, band: c.identify, shade: c.chalk, shadeAlpha: 0.1 }
      : { body: c.card, line: c.sticker, band: c.identify, shade: c.sticker, shadeAlpha: 0.08 };
  }

  private itemColors(): ItemColors {
    const c = this.colors;
    return { ink: c.ink, paper: c.paper, halo: c.dark ? c.chalkMuted : undefined };
  }

  private cupTexture() {
    const { cupW, cupH, line } = this.row;
    const pad = TEX_PAD;
    return this.texture(
      `cup-${cupW}`,
      cupW + 2 * pad,
      cupH + 2 * pad,
      (ctx) => drawCup(ctx, cupW, cupH, line, this.cupColors()),
      [cupW / 2 + pad, cupH + pad],
    );
  }

  /** Gốc của texture cốc: giữa mép dưới (đáy cốc úp). */
  private cupOrigin(): [number, number] {
    const { cupH } = this.row;
    const pad = TEX_PAD;
    return [0.5, (cupH + pad) / (cupH + 2 * pad)];
  }

  private itemSize(j: number, scale: number) {
    const size = j === 0 ? CHALK_SIZE : ERASER_SIZE;
    return { w: size.w * scale, h: size.h * scale };
  }

  /** Vật `j` (0 = phấn, 1 = tẩy) ở tỉ lệ `scale`; gốc vẽ ở giữa mép dưới. */
  private itemTexture(j: number, scale: number) {
    const { w, h } = this.itemSize(j, scale);
    const pad = TEX_PAD;
    const colors = this.itemColors();
    return this.texture(
      `${j === 0 ? "chalk" : "eraser"}-${scale}`,
      w + 2 * pad,
      h + 2 * pad,
      (ctx) => (j === 0 ? drawChalk(ctx, scale, colors) : drawEraser(ctx, scale, colors)),
      [w / 2 + pad, h + pad],
    );
  }

  /** Gốc của texture vật: giữa mép dưới (nằm trên mặt bàn). */
  private itemOrigin(j: number, scale: number): [number, number] {
    const { h } = this.itemSize(j, scale);
    const pad = TEX_PAD;
    return [0.5, (h + pad) / (h + 2 * pad)];
  }

  /** Nền tròn của huy hiệu trạng thái: thẻ giấy viền mực, bóng đổ xuống dưới. */
  private badgeTexture() {
    const c = this.colors;
    return this.texture("status", 2 * (STATUS.r + 9), 2 * (STATUS.r + 9), (ctx) => {
      circlePath(ctx, 0, 6, STATUS.r);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      circlePath(ctx, 0, 0, STATUS.r);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
    });
  }

  /** Biểu tượng pha: mắt (xem), cốc úp (tráo), ngón tay (chờ chạm). */
  private iconTexture(icon: StatusIcon) {
    const c = this.colors;
    return this.texture(`icon-${icon}`, 96, 96, (ctx) => {
      if (icon === "eye") {
        const eye = new Path2D(EYE_PATH);
        ctx.fillStyle = c.card;
        ctx.fill(eye);
        ctx.lineWidth = 6;
        ctx.strokeStyle = c.cardFg;
        ctx.stroke(eye);
        circlePath(ctx, 0, 0, 14);
        ctx.fillStyle = c.identify;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = c.sticker;
        ctx.stroke();
        circlePath(ctx, 0, 0, 6);
        ctx.fillStyle = c.sticker;
        ctx.fill();
        return;
      }
      if (icon === "cup") {
        ctx.translate(0, 30);
        drawCup(ctx, 58, 62, 4, {
          body: c.card,
          line: c.cardFg,
          band: c.identify,
          shade: c.cardFg,
          shadeAlpha: 0.08,
        });
        return;
      }
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

  /** Huy hiệu xoay vòng: ba mũi tên nối thành vòng tròn. `lit`: nền cam Nhận diện. */
  private rotateTexture(lit: boolean) {
    const c = this.colors;
    const r = ROTATE.r;
    return this.texture(`rotate-${lit ? "lit" : "idle"}`, 2 * (r + 9), 2 * (r + 9), (ctx) => {
      circlePath(ctx, 0, 5, r);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      circlePath(ctx, 0, 0, r);
      ctx.fillStyle = lit ? c.identify : c.card;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      drawRotateIcon(ctx, 21, 5, lit ? c.ink : c.cardFg);
    });
  }

  /** Siêu khó: bong bóng hỏi vật, nền giấy, viền vàng dày giữa hai nét mực. */
  private bubbleTexture() {
    const c = this.colors;
    const r = BUBBLE.r;
    return this.texture("bubble", 2 * (r + 10), 2 * (r + 10), (ctx) => {
      circlePath(ctx, 0, 6, r);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      circlePath(ctx, 0, 0, r);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      circlePath(ctx, 0, 0, r - 8);
      ctx.lineWidth = 8;
      ctx.strokeStyle = c.primary;
      ctx.stroke();
      circlePath(ctx, 0, 0, r - 13);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
    });
  }

  /** Dấu tích của câu đúng: tròn vàng viền mực. */
  private checkTexture() {
    const c = this.colors;
    return this.texture("check", 64, 64, (ctx) => {
      circlePath(ctx, 0, 4, 24);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      circlePath(ctx, 0, 0, 24);
      ctx.fillStyle = c.primary;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.stroke(new Path2D(CHECK));
    });
  }

  /** Chạm sai: dấu X hai nét màu báo lỗi, viền trắng phấn; cỡ theo hàng cốc. */
  private crossTexture() {
    const c = this.colors;
    const a = 26 * this.row.item;
    const outer = 20 * this.row.item;
    const inner = 11 * this.row.item;
    return this.texture(`cross-${this.row.item}`, 2 * a + outer + 4, 2 * a + outer + 4, (ctx) => {
      const cross = new Path2D(`M${-a} ${-a} L${a} ${a} M${a} ${-a} L${-a} ${a}`);
      ctx.lineWidth = outer;
      ctx.strokeStyle = c.chalk;
      ctx.stroke(cross);
      ctx.lineWidth = inner;
      ctx.strokeStyle = c.destructive;
      ctx.stroke(cross);
    });
  }
}
