import {
  type BeadPatternAttr,
  type BeadPatternBead,
  type BeadPatternPuzzle,
  type BeadPatternRule,
  beadPattern,
  beadPatternClues,
  WRONG_ANSWER_LOCK_MS,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import { shouldIgnoreGameKey } from "../keyboard";
import type { MinigameBridge } from "../types";
import { type BeadPaint, drawBead, drawDiceLabel, roundRectPath } from "./beads";

/*
 * Chuỗi quy luật — đặc tả: docs/04-minigames/bead-pattern.md (mục "Ghi chú cho FE" và "Hiện đáp án
 * đúng khi sai"). Trên là tấm bảng phấn: chuỗi hạt xâu trên sợi dây phấn, một chỗ trống "?"; dưới là
 * 4 thẻ giấy xếp 2 × 2, chạm thẻ có hạt vừa với chỗ trống. Hạt có hình (5 loại, mỗi hình một màu cố
 * định), hoa văn (trơn / sọc / ca-rô) và nhãn số chấm kiểu mặt xúc xắc (từ mức Khó).
 *
 * Mọi hình vẽ MỘT lần ra canvas 2D rồi dùng làm texture (khoá theo bảng màu), mỗi khung hình chỉ
 * dời ảnh. Scene không vẽ chữ; lời giải khi sai chỉ dùng số và ký hiệu.
 */

// ─── Màu ────────────────────────────────────────────────────────────────────────────────────────

/** Token CSS (tự đổi theo sáng/tối), đọc lại mỗi câu. */
const TOKENS = {
  /** Mặt bảng phấn sau chuỗi hạt. */
  board: "--board",
  /** Viền + bóng đổ của bảng và thẻ. */
  sticker: "--sticker",
  /** Sợi dây, viền hạt trên bảng, chỗ trống, nét lời giải. */
  chalk: "--chalk",
  /** Giấy của thẻ, nền nhãn chấm trên bảng, nền thanh khoá. */
  card: "--card",
  /** Viền hạt trên thẻ, chấm trên nhãn, thanh khoá. */
  cardFg: "--card-foreground",
  /** Nền nhãn chấm trên thẻ (khác giấy thẻ một chút). */
  muted: "--muted",
  /** Viền mực của thẻ, vòng, huy hiệu. */
  border: "--border",
  /** Thẻ đúng, hạt đúng điền vào chỗ trống. */
  primary: "--primary",
  primaryFg: "--primary-foreground",
  /** Huy hiệu ✗ trên thẻ vừa chạm. */
  destructive: "--destructive",
  destructiveFg: "--destructive-foreground",
  /** Viền trong của bảng (màu nhóm Phân tích). */
  analyze: "--color-analyze",
  /** Hoa văn sọc / ca-rô: mực phủ mờ lên màu hạt = màu sẫm hơn của chính hạt. */
  ink: "--color-ink",
  /** Màu cố định theo hình (chỉ là gợi ý phụ, luôn đi cùng hình). */
  sky: "--color-sky",
  mint: "--color-mint",
  grape: "--color-grape",
  pink: "--color-pink",
  sun: "--color-sun",
} as const;

type Tone = keyof typeof TOKENS;

/** Giá trị token ở nền sáng, chỉ dùng khi không đọc được biến CSS. */
const FALLBACK: Record<Tone, string> = {
  board: "#2d6a54",
  sticker: "#1f1b3a",
  chalk: "#f6f3ea",
  card: "#fff8ef",
  cardFg: "#1f1b3a",
  muted: "#f3eadf",
  border: "#1f1b3a",
  primary: "#ffd166",
  primaryFg: "#1f1b3a",
  destructive: "#c93a55",
  destructiveFg: "#fff8ef",
  analyze: "#4d9de0",
  ink: "#1f1b3a",
  sky: "#8ec5ff",
  mint: "#7fd1ae",
  grape: "#c3a6ff",
  pink: "#f7a8b8",
  sun: "#ffd166",
};

/** Màu theo hình: 0 tròn, 1 vuông, 2 tam giác, 3 tim, 4 sao. Không bao giờ đổi màu riêng với hình. */
const SHAPE_TONES: readonly Tone[] = ["sky", "mint", "grape", "pink", "sun"];

type Palette = Record<Tone, string> & { id: string };

function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const entries = (Object.keys(TOKENS) as Tone[]).map((tone): [Tone, string] => {
    const raw = style.getPropertyValue(TOKENS[tone]).trim() || FALLBACK[tone];
    // Chuẩn hoá về #rrggbb để canvas 2D và Phaser đọc như nhau.
    const num = Phaser.Display.Color.ValueToColor(raw).color;
    return [tone, `#${num.toString(16).padStart(6, "0")}`];
  });
  const colors = Object.fromEntries(entries) as Record<Tone, string>;
  return { ...colors, id: hashOf(entries.map(([, c]) => c).join("")) };
}

/** Băm ngắn (djb2) cho khoá texture theo bảng màu. */
function hashOf(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const toColor = (css: string) => Phaser.Display.Color.ValueToColor(css).color;

// ─── Bố cục (px trong khung 720×1280), theo bảng Ghi chú cho FE ─────────────────────────────────

/** Tấm bảng phấn chứa chuỗi hạt, nhãn chấm và nét lời giải (y 312–664, dưới dải khoá y ≤ 250). */
const BOARD = { x: 24, y: 312, w: 672, h: 352, r: 28, edge: 5, shadow: 7, inset: 11, inner: 4 };
/** Chuỗi: tâm hạt y 420, mỗi hạt một ô 640 ÷ n (tối đa 96), căn giữa; hạt Ø 64. */
const CHAIN = { y: 420, span: 640, maxCell: 96, bead: 64, string: 4 };
/** Nhãn chấm trên bảng: tâm y 500 (470–530), vuông 52, nối với hạt bằng một nét dây (y 452–474). */
const LABEL = { dy: 80, size: 52, radius: 11, dot: 5, gap: 14, tailTop: 32, tailBottom: 54 };
/** 4 thẻ 300 × 220: x 45 / 375, y 690 / 940 (trái → phải, trên → dưới = phím 1–4). */
const CARD = { w: 300, h: 220, r: 26, edge: 4, shadow: 6 };
const CARD_SLOTS: readonly (readonly [x: number, y: number])[] = [
  [45, 690],
  [375, 690],
  [45, 940],
  [375, 940],
];
/** Hạt trên thẻ: Ø 120 giữa thẻ; có nhãn chấm thì Ø 112 lệch lên, nhãn 72 bên dưới. */
const CARD_BEAD = { plain: 120, withDots: 112, dy: -40 };
const CARD_LABEL = { dy: 62, size: 72, radius: 15, dot: 6.5, gap: 20 };
/** Huy hiệu ✓ / ✗ ở góc trên phải thẻ (so với tâm thẻ). */
const BADGE = { dx: CARD.w / 2 - 26, dy: -CARD.h / 2 + 26, r: 24 };
/** Thanh khoá khi sai. */
const BAR = { x: 150, y: 1206, w: 420, h: 14 };

/**
 * Nét lời giải (dưới chuỗi): nét cong đi từ đáy hạt / nhãn xuống tới `dip` rồi lên lại, ký hiệu
 * ghi dưới đáy nét. Thuộc tính thứ nhất nét liền, nông; thuộc tính thứ hai nét đứt, sâu hơn.
 */
const CLUE = {
  dots: { anchor: 538, dip: [562, 604], symbol: [586, 630] },
  plain: { anchor: 462, dip: [514, 574], symbol: [540, 600] },
  /** Vòng khoanh hạt (bán kính) và nhãn (cạnh) theo thứ tự thuộc tính. */
  ring: [38, 44],
  labelRing: [64, 72],
  width: 4,
  dash: [11, 8] as [number, number],
  /** Phép tính của luật cộng dồn: ngay dưới nhãn (so với đáy nhãn). */
  sumDy: 26,
  font: '700 30px "Baloo 2", "Be Vietnam Pro", ui-sans-serif, sans-serif',
  /** Vùng vẽ lời giải (một texture): y 300–680. */
  top: 300,
  height: 380,
};

// ─── Nhịp hiệu ứng ──────────────────────────────────────────────────────────────────────────────

/** Câu mới: hạt xâu vào dây lần lượt từ trái (tổng ≤ 200 ms), thẻ hiện mờ → rõ 120 ms. */
const STRING_MS = 90;
const STRING_SPREAD_MS = 110;
const STRING_FROM = 26;
const CARD_FADE_MS = 120;
/** Chỗ trống: nhịp sáng 1,2 s (mờ 45 % rồi sáng lại). */
const PULSE_MS = 600;
const PULSE_ALPHA = 0.45;
/** Đúng: hạt bay lên chỗ trống 200 ms, chuỗi nảy 10 px; câu mới sau 360 ms. */
const FLY_MS = 200;
const BOUNCE_MS = 80;
const BOUNCE_PX = 10;
const SOLVED_MS = 360;
const SOLVED_REDUCED_MS = 300;
/** Sai: thẻ vừa chạm rung ±7 px 200 ms rồi mờ 50 %; thẻ không liên quan mờ 35 %. */
const SHAKE_MS = 200;
const SHAKE_PX = 7;
const DIM_MS = 120;
const PICKED_ALPHA = 0.5;
const DIM_ALPHA = 0.35;
/** Rê chuột: thẻ nhấc 4 px. */
const HOVER_LIFT = 4;

/** Phím 1–4 (hàng số và bàn phím số) → thẻ theo thứ tự trái → phải, trên → dưới. */
const KEY_SLOTS: Readonly<Record<string, number>> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
  Numpad4: 3,
};

const TICK = "M-12 1 L-3 10 L13 -9";
const CROSS = "M-9 -9 L9 9 M9 -9 L-9 9";

function mediaMatches(query: string): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

// ─── Canvas 2D ──────────────────────────────────────────────────────────────────────────────────

type Ctx = CanvasRenderingContext2D;

function makeCanvas(width: number, height: number, draw: (ctx: Ctx) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    draw(ctx);
  }
  return canvas;
}

/** Nét đứt chia đều theo chiều dài để chỗ nối khép kín không lệch. */
function evenDash(length: number, [dash, gap]: [number, number]) {
  const k = length / Math.max(1, Math.round(length / (dash + gap))) / (dash + gap);
  return [dash * k, gap * k];
}

/** Nét phấn: một nét mờ rộng bên dưới + nét chính (cùng kiểu đứt nếu có). */
function chalkStroke(ctx: Ctx, path: Path2D, color: string, width: number, dash?: number[]) {
  ctx.save();
  ctx.setLineDash(dash ?? []);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = width + 6;
  ctx.stroke(path);
  ctx.globalAlpha = 1;
  ctx.lineWidth = width;
  ctx.stroke(path);
  ctx.restore();
}

/** Chữ số / ký hiệu phấn có viền màu bảng để đọc được cả khi đè lên nét cong. */
function chalkText(ctx: Ctx, text: string, x: number, y: number, chalk: string, board: string) {
  ctx.save();
  ctx.font = CLUE.font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 9;
  ctx.strokeStyle = board;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = chalk;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Số bước của luật cộng đều: "+1", "−2" (dấu trừ thật). */
const stepText = (step: number) => (step >= 0 ? `+${step}` : `−${Math.abs(step)}`);

// ─── Scene ──────────────────────────────────────────────────────────────────────────────────────

interface ChainView {
  container: Phaser.GameObjects.Container;
  /** Tâm x của từng hạt. */
  xs: number[];
  /** Hạt đang hiện (không có ở chỗ trống) + vị trí x đích của hiệu ứng xâu. */
  slots: { slot: Phaser.GameObjects.Container; x: number }[];
  blank: Phaser.GameObjects.Container;
  hasDots: boolean;
}

interface CardView {
  /** Bóng + mặt thẻ: mờ khi sai. */
  slot: Phaser.GameObjects.Container;
  /** Giấy + hạt + nhãn: nhấc khi rê chuột, rung khi sai. */
  face: Phaser.GameObjects.Container;
  bead: Phaser.GameObjects.Image;
  beadSize: number;
  hovered: boolean;
}

/** Chuỗi quy luật — chạm thẻ có hạt vừa với chỗ trống của chuỗi. */
export default class BeadPatternScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = true;
  private puzzle?: BeadPatternPuzzle;
  private colors!: Palette;
  private reducedMotion = false;
  private canHover = false;
  private boardImage?: Phaser.GameObjects.Image;
  /** Mọi thứ của câu hiện tại (chuỗi, thẻ, lời giải, huy hiệu). */
  private round?: Phaser.GameObjects.Container;
  private chain?: ChainView;
  private cards: CardView[] = [];
  /** Lớp trên thẻ (huy hiệu ✓ / ✗, hạt đang bay) để không bị mờ cùng thẻ. */
  private overlay?: Phaser.GameObjects.Container;
  /** Texture lời giải của câu sai gần nhất (vẽ riêng cho câu đó, xoá khi sang câu mới). */
  private clueKey?: string;
  private bar?: Phaser.GameObjects.Graphics;
  private barState = { width: 0 };
  /** Hẹn giờ của câu hiện tại; huỷ hết khi sang câu mới hoặc rời màn. */
  private timers: Phaser.Time.TimerEvent[] = [];
  private onKey = (event: KeyboardEvent) => this.handleKey(event);

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.locked = true;
    this.puzzle = undefined;
    this.cards = [];
    this.timers = [];
    this.clueKey = undefined;
  }

  create() {
    this.canHover = mediaMatches("(hover: hover) and (pointer: fine)");
    // Bắt phím ở mọi thiết bị có bàn phím (cả máy tính bảng gắn phím).
    window.addEventListener("keydown", this.onKey);
    // Hết vòng hoặc rời màn: dừng hẳn mọi tween, hẹn giờ và bỏ nghe phím.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());

    // Tấm bảng giữ nguyên suốt vòng (đổi texture khi đổi sáng/tối giữa vòng).
    this.readTheme();
    const boardY = BOARD.y + (BOARD.h + BOARD.shadow) / 2;
    this.boardImage = this.add.image(BOARD.x + BOARD.w / 2, boardY, this.boardTexture());
    this.bar = this.add.graphics().setVisible(false).setDepth(2);
    this.showPuzzle();
  }

  /** Đọc lại bảng màu và tuỳ chọn giảm chuyển động (mỗi câu). */
  private readTheme() {
    const canvas = this.game.canvas;
    this.colors = readPalette(canvas.isConnected ? canvas : document.documentElement);
    this.reducedMotion = prefersReducedMotion();
  }

  private cleanup() {
    window.removeEventListener("keydown", this.onKey);
    this.locked = true;
    this.puzzle = undefined;
    this.clearTimers();
    this.tweens.killAll();
    this.cards = [];
    this.chain = undefined;
  }

  // ── Câu đố ──

  private showPuzzle() {
    // Mọi hẹn giờ và tween đang chạy đều thuộc câu cũ: dừng trước khi huỷ.
    this.clearTimers();
    this.tweens.killAll();
    this.round?.destroy();
    this.dropClues();
    this.bar?.setVisible(false);

    this.readTheme();
    this.boardImage?.setTexture(this.boardTexture());

    const puzzle = beadPattern.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    this.puzzle = puzzle;
    const round = this.add.container(0, 0);
    this.round = round;
    this.chain = this.buildChain(puzzle, round);
    this.cards = puzzle.options.map((bead, i) => this.buildCard(bead, i, round));
    this.overlay = this.add.container(0, 0);
    round.add(this.overlay);
    this.locked = false;

    // Câu mới: hạt xâu vào dây, thẻ hiện dần. Chạm được ngay, không chờ hiệu ứng.
    if (this.reducedMotion) return;
    const { slots } = this.chain;
    slots.forEach(({ slot, x }, i) => {
      slot.setAlpha(0).setX(x - STRING_FROM);
      this.tweens.add({
        targets: slot,
        x,
        alpha: 1,
        duration: STRING_MS,
        delay: (STRING_SPREAD_MS * i) / Math.max(1, slots.length - 1),
        ease: "Quad.easeOut",
      });
    });
    this.tweens.add({
      targets: this.chain.blank,
      alpha: PULSE_ALPHA,
      duration: PULSE_MS,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    for (const card of this.cards) {
      card.slot.setAlpha(0);
      this.tweens.add({ targets: card.slot, alpha: 1, duration: CARD_FADE_MS });
    }
  }

  private buildChain(puzzle: BeadPatternPuzzle, round: Phaser.GameObjects.Container): ChainView {
    const c = this.colors;
    const n = puzzle.beads.length;
    const cell = Math.min(CHAIN.maxCell, CHAIN.span / n);
    const left = 360 - (cell * n) / 2;
    const xs = puzzle.beads.map((_, i) => left + cell * (i + 0.5));
    const hasDots = puzzle.options.some((o) => o.dots > 0);
    const container = this.add.container(0, 0);
    round.add(container);

    // Sợi dây phấn ngang qua tâm hạt, thò ra hai đầu nửa ô.
    const string = this.add.graphics();
    const x1 = left + 8;
    const x2 = left + cell * n - 8;
    string
      .lineStyle(CHAIN.string + 6, toColor(c.chalk), 0.18)
      .lineBetween(x1, CHAIN.y, x2, CHAIN.y);
    string.lineStyle(CHAIN.string, toColor(c.chalk), 0.95).lineBetween(x1, CHAIN.y, x2, CHAIN.y);
    container.add(string);

    const slots: ChainView["slots"] = [];
    let blank: Phaser.GameObjects.Container | undefined;
    puzzle.beads.forEach((bead, i) => {
      const x = xs[i] as number;
      if (bead === null) {
        blank = this.add.container(x, CHAIN.y, [this.add.image(0, 0, this.blankTexture())]);
        if (hasDots) {
          blank.add(this.tail());
          blank.add(this.add.image(0, LABEL.dy, this.blankLabelTexture()));
        }
        container.add(blank);
        return;
      }
      const slot = this.beadSlot(bead, x, hasDots);
      container.add(slot);
      slots.push({ slot, x });
    });
    // Bộ sinh luôn có đúng một chỗ trống; container rỗng chỉ để kiểu luôn có giá trị.
    if (!blank) {
      blank = this.add.container(0, 0);
      container.add(blank);
    }
    return { container, xs, slots, blank, hasDots };
  }

  /** Một hạt trên bảng (+ nét dây và nhãn chấm khi có), gốc ở tâm hạt. */
  private beadSlot(bead: BeadPatternBead, x: number, hasDots: boolean) {
    const slot = this.add.container(x, CHAIN.y);
    if (hasDots) {
      slot.add(this.tail());
      slot.add(this.add.image(0, LABEL.dy, this.labelTexture(bead.dots, "board")));
    }
    slot.add(this.add.image(0, 0, this.beadTexture(bead, CHAIN.bead, "board")));
    return slot;
  }

  /** Nét dây ngắn nối hạt với nhãn chấm. */
  private tail() {
    const h = LABEL.tailBottom - LABEL.tailTop;
    return this.add.rectangle(0, LABEL.tailTop + h / 2, 3, h, toColor(this.colors.chalk));
  }

  private buildCard(bead: BeadPatternBead, i: number, round: Phaser.GameObjects.Container) {
    const [left, top] = CARD_SLOTS[i] as readonly [number, number];
    const cx = left + CARD.w / 2;
    const cy = top + CARD.h / 2;
    const hasDots = bead.dots > 0;
    const beadSize = hasDots ? CARD_BEAD.withDots : CARD_BEAD.plain;
    const beadImage = this.add.image(
      0,
      hasDots ? CARD_BEAD.dy : 0,
      this.beadTexture(bead, beadSize, "card"),
    );
    const face = this.add.container(0, 0, [this.add.image(0, 0, this.cardTexture()), beadImage]);
    if (hasDots) face.add(this.add.image(0, CARD_LABEL.dy, this.labelTexture(bead.dots, "card")));
    const slot = this.add.container(cx, cy, [
      this.add.image(0, CARD.shadow, this.cardShadowTexture()),
      face,
    ]);
    const view: CardView = { slot, face, bead: beadImage, beadSize, hovered: false };

    // Cả thẻ là vùng chạm (300 × 220).
    const zone = this.add.zone(cx, cy, CARD.w, CARD.h).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", () => this.answer(i));
    if (this.canHover) {
      zone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
        if (!this.locked && !pointer.wasTouch) this.setHover(view, true);
      });
      zone.on("pointerout", () => this.setHover(view, false));
    }
    round.add([slot, zone]);
    return view;
  }

  private setHover(view: CardView, on: boolean) {
    if (view.hovered === on) return;
    view.hovered = on;
    view.face.y = on ? -HOVER_LIFT : 0;
  }

  // ── Trả lời ──

  private handleKey(event: KeyboardEvent) {
    // Có phím bổ trợ, đang gõ chữ hoặc đang mở hộp thoại (Thoát, sheet chat…): không trả lời.
    if (event.repeat || shouldIgnoreGameKey(event)) return;
    const slot = KEY_SLOTS[event.code];
    if (slot === undefined || !this.sys.isActive()) return;
    this.answer(slot);
  }

  private answer(choice: number) {
    const puzzle = this.puzzle;
    if (this.locked || !puzzle) return;
    this.locked = true;

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const index = this.index;
    const correct = beadPattern.check(puzzle, choice);
    this.bridge.submit(index, choice);
    this.index += 1;
    this.settle();

    if (correct) {
      this.solve(puzzle, choice);
      return;
    }

    this.showMiss(puzzle, choice);
    // Thanh khoá chạy ngay theo thời gian khoá chuẩn, rồi chỉnh theo `lockedUntil` khi server trả lời.
    this.barState.width = BAR.w;
    this.bar?.setVisible(true);
    this.runBar(WRONG_ANSWER_LOCK_MS);
    // Hết khoá theo `lockedUntil` của server (không tự đếm) để khớp huy hiệu khoá của khung.
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive() || this.index !== index + 1) return;
      this.runBar(ms);
      this.after(ms, () => this.showPuzzle());
    });
  }

  /** Đang xâu hạt / hiện thẻ thì hiện hẳn để thấy kết quả; chỗ trống thôi nhịp. */
  private settle() {
    const chain = this.chain;
    if (chain) {
      for (const view of chain.slots) {
        this.tweens.killTweensOf(view.slot);
        view.slot.setAlpha(1).setX(view.x);
      }
      this.tweens.killTweensOf(chain.blank);
      chain.blank.setAlpha(1);
    }
    for (const card of this.cards) {
      this.setHover(card, false);
      this.tweens.killTweensOf(card.slot);
      card.slot.setAlpha(1);
    }
  }

  /** Đúng: hạt của thẻ bay lên lấp chỗ trống, cả chuỗi nảy nhẹ, rồi sang câu mới. */
  private solve(puzzle: BeadPatternPuzzle, choice: number) {
    const chain = this.chain;
    const card = this.cards[choice];
    const bead = puzzle.options[choice];
    if (!chain || !card || !bead) return;
    chain.blank.setVisible(false);
    const tx = chain.xs[puzzle.blank] as number;

    if (this.reducedMotion) {
      this.fillBlank(bead, false);
      this.after(SOLVED_REDUCED_MS, () => this.showPuzzle());
      return;
    }

    const from = card.bead;
    const sx = card.slot.x + card.face.x + from.x;
    const sy = card.slot.y + card.face.y + from.y;
    from.setVisible(false);
    const fly = this.add.image(sx, sy, from.texture.key);
    this.overlay?.add(fly);
    this.tweens.add({
      targets: fly,
      x: tx,
      y: CHAIN.y,
      scale: CHAIN.bead / card.beadSize,
      duration: FLY_MS,
      ease: "Quad.easeOut",
      onComplete: () => {
        fly.destroy();
        this.fillBlank(bead, false);
        this.tweens.add({
          targets: chain.container,
          y: -BOUNCE_PX,
          duration: BOUNCE_MS,
          yoyo: true,
          ease: "Quad.easeOut",
        });
      },
    });
    this.after(SOLVED_MS, () => this.showPuzzle());
  }

  /** Đặt hạt vào chỗ trống; `highlight` = hạt đúng hiện khi sai (vòng `--primary`). */
  private fillBlank(bead: BeadPatternBead, highlight: boolean) {
    const chain = this.chain;
    const puzzle = this.puzzle;
    if (!chain || !puzzle) return;
    const x = chain.xs[puzzle.blank] as number;
    const slot = this.beadSlot(bead, x, chain.hasDots);
    if (highlight) {
      slot.addAt(this.add.image(0, 0, this.answerRingTexture()), 0);
      if (chain.hasDots) slot.add(this.add.image(0, LABEL.dy, this.answerLabelRingTexture()));
    }
    chain.container.add(slot);
  }

  /**
   * Sai (suốt lúc khoá): thẻ vừa chạm ✗, rung rồi mờ 50 %; thẻ đúng viền `--primary` + ✓; hạt đúng
   * hiện ngay vào chỗ trống; khoanh và nối các hạt mà luật dựa vào (lời giải, chỉ số và ký hiệu).
   */
  private showMiss(puzzle: BeadPatternPuzzle, choice: number) {
    const picked = this.cards[choice];
    const right = this.cards[puzzle.answer];
    const answerBead = puzzle.options[puzzle.answer];
    const chain = this.chain;
    if (!picked || !right || !answerBead || !chain) return;

    for (const card of this.cards) {
      if (card !== picked && card !== right) this.dim(card, DIM_ALPHA, 0);
    }
    right.face.add(this.add.image(0, 0, this.answerBorderTexture()));
    this.badge(right, this.tickTexture());
    this.badge(picked, this.crossTexture());
    this.dim(picked, PICKED_ALPHA, this.reducedMotion ? 0 : SHAKE_MS);

    chain.blank.setVisible(false);
    this.fillBlank(answerBead, true);
    this.drawClues(puzzle, chain);

    if (this.reducedMotion) return;
    const face = picked.face;
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

  private badge(card: CardView, texture: string) {
    this.overlay?.add(this.add.image(card.slot.x + BADGE.dx, card.slot.y + BADGE.dy, texture));
  }

  private dim(card: CardView, alpha: number, delay: number) {
    if (this.reducedMotion) {
      card.slot.setAlpha(alpha);
      return;
    }
    this.tweens.add({ targets: card.slot, alpha, duration: DIM_MS, delay });
  }

  // ── Lời giải khi sai ──

  /**
   * Với mỗi thuộc tính trong `tested` có luật khác `same`: khoanh các hạt `beadPatternClues` và nối
   * chúng với chỗ trống bằng nét phấn cong dưới chuỗi. Thuộc tính thứ nhất nét liền, thứ hai nét
   * đứt (sâu hơn). `alternate` tô nhạt thêm các hạt cùng chẵn lẻ với chỗ trống (dưới hạt).
   */
  private drawClues(puzzle: BeadPatternPuzzle, chain: ChainView) {
    const c = this.colors;
    const k = puzzle.blank;
    const geo = chain.hasDots ? CLUE.dots : CLUE.plain;
    const xs = chain.xs;
    const x = (i: number) => xs[i] as number;
    const dotsOf = (i: number) => puzzle.beads[i]?.dots ?? 0;

    // Tô nhạt (luật xen kẽ) nằm dưới hạt: vẽ bằng Graphics đặt đầu chuỗi.
    const tint = this.add.graphics();
    chain.container.addAt(tint, 0);

    const key = `bead-pattern:clues-${this.index}`;
    if (this.textures.exists(key)) this.textures.remove(key);
    const canvas = makeCanvas(720, CLUE.height, (ctx) => {
      ctx.translate(0, -CLUE.top);
      puzzle.tested.forEach((attr, t) => {
        const rule = puzzle.rules[attr];
        if (rule.kind === "same") return;
        const clues = beadPatternClues(puzzle, attr);
        const dash = t === 0 ? undefined : CLUE.dash;
        const dip = geo.dip[t] as number;
        const symbolY = geo.symbol[t] as number;

        for (const i of clues) this.ringClue(ctx, attr, x(i), t, chain.hasDots);
        /** Nét cong giữa cột `a` < `b`; `arrow` = có mũi tên chỉ vào chỗ trống (một trong hai đầu). */
        const hop = (a: number, b: number, arrow = false) =>
          this.hop(ctx, x(a), x(b), geo.anchor, dip, dash, arrow ? (a === k ? -1 : 1) : 0);

        switch (rule.kind) {
          case "cycle": {
            const members = [...clues, k].sort((a, b) => a - b);
            for (let m = 0; m + 1 < members.length; m++) {
              const a = members[m] as number;
              const b = members[m + 1] as number;
              hop(a, b, a === k || b === k);
            }
            const near = clues[0];
            if (near !== undefined) {
              this.cycleSymbol(ctx, (x(near) + x(k)) / 2, symbolY, rule.period);
            }
            break;
          }
          case "step": {
            const members = [...clues, k].sort((a, b) => a - b);
            for (let m = 0; m + 1 < members.length; m++) {
              const a = members[m] as number;
              const b = members[m + 1] as number;
              hop(a, b);
              chalkText(ctx, stepText(rule.step), (x(a) + x(b)) / 2, symbolY, c.chalk, c.board);
            }
            break;
          }
          case "sum": {
            // Hai nhãn liền nhau (trước chỗ trống: a + b; sau chỗ trống: chỗ trống = c − b).
            const [a, b] = [...clues].sort((p, q) => p - q) as [number, number];
            const mid = (x(a) + x(b)) / 2;
            const text = a < k ? `${dotsOf(a)} + ${dotsOf(b)}` : `${dotsOf(b)} − ${dotsOf(a)}`;
            // Phép tính ngay dưới hai nhãn được khoanh, mũi tên từ phép tính lên chỗ trống.
            const y = geo.anchor + CLUE.sumDy;
            ctx.font = CLUE.font;
            const half = ctx.measureText(text).width / 2 + 8;
            this.arrowCurve(ctx, k > b ? mid + half : mid - half, y, x(k), geo.anchor, dash);
            chalkText(ctx, text, mid, y, c.chalk, c.board);
            break;
          }
          case "alternate": {
            const members = xs.map((_, i) => i).filter((i) => (i - k) % 2 === 0);
            for (const i of members) {
              if (i === k) continue;
              this.tintColumn(tint, x(i), chain.hasDots);
            }
            const sub: BeadPatternRule = k % 2 === 0 ? rule.even : rule.odd;
            const label = sub.kind === "step" ? stepText(sub.step) : "=";
            for (let m = 0; m + 1 < members.length; m++) {
              const a = members[m] as number;
              const b = members[m + 1] as number;
              hop(a, b);
              chalkText(ctx, label, (x(a) + x(b)) / 2, symbolY, c.chalk, c.board);
            }
            break;
          }
        }
      });
    });
    this.textures.addCanvas(key, canvas);
    this.clueKey = key;
    chain.container.add(this.add.image(360, CLUE.top + CLUE.height / 2, key));
  }

  /** Khoanh hạt (hình, hoa văn) hoặc nhãn (số chấm) mà luật dựa vào. */
  private ringClue(ctx: Ctx, attr: BeadPatternAttr, x: number, t: number, hasDots: boolean) {
    const dash = t === 0 ? undefined : CLUE.dash;
    const path = new Path2D();
    if (attr === "dots" && hasDots) {
      const s = CLUE.labelRing[t] as number;
      roundRectPath(path, x - s / 2, CHAIN.y + LABEL.dy - s / 2, s, s, 16);
      const length = 4 * s - (8 - 2 * Math.PI) * 16;
      chalkStroke(ctx, path, this.colors.chalk, CLUE.width, dash && evenDash(length, dash));
      return;
    }
    const r = CLUE.ring[t] as number;
    path.arc(x, CHAIN.y, r, 0, Math.PI * 2);
    chalkStroke(ctx, path, this.colors.chalk, CLUE.width, dash && evenDash(2 * Math.PI * r, dash));
  }

  /**
   * Nét cong từ đáy cột `x1` xuống `dip` rồi lên đáy cột `x2` (x1 < x2). `arrow`: 0 không có mũi
   * tên, −1 mũi tên ở đầu trái, 1 ở đầu phải.
   */
  private hop(
    ctx: Ctx,
    x1: number,
    x2: number,
    anchor: number,
    dip: number,
    dash: number[] | undefined,
    arrow: -1 | 0 | 1,
  ) {
    const gap = 6;
    const a = x1 + gap;
    const b = x2 - gap;
    const cx = (a + b) / 2;
    const cy = 2 * dip - anchor;
    const path = new Path2D();
    path.moveTo(a, anchor);
    path.quadraticCurveTo(cx, cy, b, anchor);
    chalkStroke(ctx, path, this.colors.chalk, CLUE.width, dash);
    if (arrow === 0) return;
    const tipX = arrow < 0 ? a : b;
    // Tiếp tuyến tại đầu đường cong bậc hai hướng từ điểm điều khiển về đầu mút.
    this.arrowHead(ctx, tipX, anchor, Math.atan2(anchor - cy, tipX - cx));
  }

  /** Nét cong có mũi tên từ (x1, y1) vòng xuống rồi lên đáy cột `x2`. */
  private arrowCurve(
    ctx: Ctx,
    x1: number,
    y1: number,
    x2: number,
    anchor: number,
    dash: number[] | undefined,
  ) {
    const path = new Path2D();
    const end = anchor + 2;
    path.moveTo(x1, y1);
    path.quadraticCurveTo(x2, y1, x2, end);
    chalkStroke(ctx, path, this.colors.chalk, CLUE.width, dash);
    this.arrowHead(ctx, x2, end, -Math.PI / 2);
  }

  private arrowHead(ctx: Ctx, x: number, y: number, angle: number) {
    const size = 13;
    const spread = 0.5;
    const path = new Path2D();
    path.moveTo(x - size * Math.cos(angle - spread), y - size * Math.sin(angle - spread));
    path.lineTo(x, y);
    path.lineTo(x - size * Math.cos(angle + spread), y - size * Math.sin(angle + spread));
    chalkStroke(ctx, path, this.colors.chalk, CLUE.width);
  }

  /** Ký hiệu "↺ p": mũi tên vòng + số chu kỳ. */
  private cycleSymbol(ctx: Ctx, x: number, y: number, period: number) {
    const c = this.colors;
    const ix = x - 17;
    const r = 11;
    // Vòng hở ở trên, đi ngược chiều kim đồng hồ từ trên trái tới trên phải.
    const start = -0.62 * Math.PI;
    const end = -2.38 * Math.PI;
    const arc = new Path2D();
    arc.arc(ix, y, r, start, end, true);
    // Đầu mũi tên tô đặc ở cuối vòng, theo tiếp tuyến khi đi ngược chiều: (sin θ, −cos θ).
    const ex = ix + r * Math.cos(end);
    const ey = y + r * Math.sin(end);
    const dx = Math.sin(end);
    const dy = -Math.cos(end);
    const head = new Path2D();
    head.moveTo(ex + dx * 7, ey + dy * 7);
    head.lineTo(ex - dx * 3 - dy * 6, ey - dy * 3 + dx * 6);
    head.lineTo(ex - dx * 3 + dy * 6, ey - dy * 3 - dx * 6);
    head.closePath();
    for (const [color, width] of [
      [c.board, 10],
      [c.chalk, 4],
    ] as const) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = width;
      ctx.stroke(arc);
      ctx.stroke(head);
      ctx.fill(head);
      ctx.restore();
    }
    chalkText(ctx, String(period), x + 11, y + 1, c.chalk, c.board);
  }

  /** Tô nhạt cột hạt (+ nhãn) cùng chẵn lẻ với chỗ trống. */
  private tintColumn(g: Phaser.GameObjects.Graphics, x: number, hasDots: boolean) {
    const top = CHAIN.y - 44;
    const bottom = hasDots ? CHAIN.y + LABEL.dy + 36 : CHAIN.y + 44;
    g.fillStyle(toColor(this.colors.chalk), 0.16);
    g.fillRoundedRect(x - 36, top, 72, bottom - top, 18);
  }

  private dropClues() {
    if (this.clueKey && this.textures.exists(this.clueKey)) this.textures.remove(this.clueKey);
    this.clueKey = undefined;
  }

  private after(ms: number, callback: () => void) {
    this.timers.push(this.time.delayedCall(ms, callback));
  }

  private clearTimers() {
    for (const timer of this.timers) timer.remove(false);
    this.timers = [];
  }

  // ── Thanh khoá ──

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
    g.fillStyle(toColor(c.cardFg));
    g.fillRoundedRect(x, y, fill, h, Math.min(r, fill / 2));
  }

  // ── Texture (vẽ một lần mỗi vòng, khoá theo bảng màu) ──

  /** Tạo texture từ canvas 2D (gốc toạ độ ở tâm) nếu chưa có; trả về khoá. */
  private texture(name: string, width: number, height: number, draw: (ctx: Ctx) => void) {
    const key = `bead-pattern:${name}-${this.colors.id}`;
    if (this.textures.exists(key)) return key;
    const canvas = makeCanvas(width, height, (ctx) => {
      ctx.translate(Math.ceil(width) / 2, Math.ceil(height) / 2);
      draw(ctx);
    });
    this.textures.addCanvas(key, canvas);
    return key;
  }

  private paint(where: "board" | "card"): BeadPaint {
    const c = this.colors;
    return {
      fills: SHAPE_TONES.map((tone) => c[tone]),
      ink: c.ink,
      outline: where === "board" ? c.chalk : c.cardFg,
      outlineWidth: where === "board" ? 4 : 5,
    };
  }

  private beadTexture(bead: BeadPatternBead, size: number, where: "board" | "card") {
    const side = size + 16;
    return this.texture(`bead-${bead.shape}${bead.pattern}-${size}-${where}`, side, side, (ctx) =>
      drawBead(ctx, bead.shape, bead.pattern, size, this.paint(where)),
    );
  }

  private labelTexture(dots: number, where: "board" | "card") {
    const c = this.colors;
    const spec = where === "board" ? LABEL : CARD_LABEL;
    const side = spec.size + 10;
    return this.texture(`label-${dots}-${where}`, side, side, (ctx) =>
      drawDiceLabel(ctx, dots, {
        size: spec.size,
        radius: spec.radius,
        dot: spec.dot,
        gap: spec.gap,
        fill: where === "board" ? c.card : c.muted,
        stroke: where === "board" ? c.chalk : c.cardFg,
        strokeWidth: 3,
        dotColor: c.cardFg,
      }),
    );
  }

  /** Chỗ trống: vòng phấn nét đứt cỡ hạt + dấu "?" phấn. */
  private blankTexture() {
    const c = this.colors;
    const side = CHAIN.bead + 20;
    return this.texture("blank", side, side, (ctx) => {
      const r = CHAIN.bead / 2 - 2;
      const ring = new Path2D();
      ring.arc(0, 0, r, 0, Math.PI * 2);
      chalkStroke(ctx, ring, c.chalk, 4, evenDash(2 * Math.PI * r, [9, 7]));
      const mark = new Path2D("M-8 -9 C-8 -18 8 -18 8 -9 C8 -3 0 -3 0 5");
      chalkStroke(ctx, mark, c.chalk, 5);
      ctx.beginPath();
      ctx.arc(0, 14, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = c.chalk;
      ctx.fill();
    });
  }

  /** Nhãn chấm của chỗ trống: vuông bo góc phấn nét đứt. */
  private blankLabelTexture() {
    const c = this.colors;
    const side = LABEL.size + 12;
    return this.texture("blank-label", side, side, (ctx) => {
      const s = LABEL.size - 2;
      const path = new Path2D();
      roundRectPath(path, -s / 2, -s / 2, s, s, LABEL.radius);
      const length = 4 * s - (8 - 2 * Math.PI) * LABEL.radius;
      chalkStroke(ctx, path, c.chalk, 3, evenDash(length, [8, 6]));
    });
  }

  /** Vòng `--primary` viền mực quanh hạt đúng ở chỗ trống (nằm dưới hạt). */
  private answerRingTexture() {
    const c = this.colors;
    const r = CHAIN.bead / 2 + 7;
    const side = 2 * (r + 10);
    return this.texture("answer-ring", side, side, (ctx) => {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.lineWidth = 11;
      ctx.strokeStyle = c.border;
      ctx.stroke();
      ctx.lineWidth = 7;
      ctx.strokeStyle = c.primary;
      ctx.stroke();
    });
  }

  /** Viền `--primary` quanh nhãn chấm của hạt đúng ở chỗ trống. */
  private answerLabelRingTexture() {
    const c = this.colors;
    const s = LABEL.size + 8;
    const side = s + 16;
    return this.texture("answer-label-ring", side, side, (ctx) => {
      const path = new Path2D();
      roundRectPath(path, -s / 2, -s / 2, s, s, LABEL.radius + 4);
      ctx.lineWidth = 9;
      ctx.strokeStyle = c.border;
      ctx.stroke(path);
      ctx.lineWidth = 5;
      ctx.strokeStyle = c.primary;
      ctx.stroke(path);
    });
  }

  /** Tấm bảng phấn: bóng đổ, mặt bảng, viền sticker, viền trong màu nhóm Phân tích. */
  private boardTexture() {
    const c = this.colors;
    const pad = 6;
    const { w, h, r, edge, shadow, inset, inner } = BOARD;
    return this.texture("board", w + 2 * pad, h + shadow + 2 * pad, (ctx) => {
      const x = -w / 2;
      const y = -(h + shadow) / 2;
      const body = new Path2D();
      roundRectPath(body, x, y, w, h, r);
      const drop = new Path2D();
      roundRectPath(drop, x, y + shadow, w, h, r);
      ctx.fillStyle = c.sticker;
      ctx.fill(drop);
      ctx.fillStyle = c.board;
      ctx.fill(body);
      ctx.lineWidth = edge;
      ctx.strokeStyle = c.sticker;
      ctx.stroke(body);
      const line = new Path2D();
      roundRectPath(line, x + inset, y + inset, w - 2 * inset, h - 2 * inset, r - inset / 2);
      ctx.lineWidth = inner;
      ctx.strokeStyle = c.analyze;
      ctx.globalAlpha = 0.85;
      ctx.stroke(line);
    });
  }

  private cardTexture() {
    const c = this.colors;
    return this.texture("card", CARD.w + 8, CARD.h + 8, (ctx) => {
      const path = new Path2D();
      roundRectPath(path, -CARD.w / 2, -CARD.h / 2, CARD.w, CARD.h, CARD.r);
      ctx.fillStyle = c.card;
      ctx.fill(path);
      ctx.lineWidth = CARD.edge;
      ctx.strokeStyle = c.border;
      ctx.stroke(path);
    });
  }

  private cardShadowTexture() {
    const c = this.colors;
    return this.texture("card-shadow", CARD.w + 8, CARD.h + 8, (ctx) => {
      const path = new Path2D();
      roundRectPath(path, -CARD.w / 2, -CARD.h / 2, CARD.w, CARD.h, CARD.r);
      ctx.fillStyle = c.sticker;
      ctx.fill(path);
    });
  }

  /** Viền `--primary` dày, viền mực hai bên, trùng mép thẻ đúng. */
  private answerBorderTexture() {
    const c = this.colors;
    return this.texture("answer-border", CARD.w + 16, CARD.h + 16, (ctx) => {
      const inset = 3;
      const path = new Path2D();
      roundRectPath(
        path,
        -CARD.w / 2 + inset,
        -CARD.h / 2 + inset,
        CARD.w - 2 * inset,
        CARD.h - 2 * inset,
        CARD.r - inset,
      );
      ctx.lineWidth = 12;
      ctx.strokeStyle = c.border;
      ctx.stroke(path);
      ctx.lineWidth = 8;
      ctx.strokeStyle = c.primary;
      ctx.stroke(path);
    });
  }

  /** Huy hiệu tròn có bóng: nền `fill`, ký hiệu `mark` màu `markColor`. */
  private badgeTexture(name: string, fill: string, mark: string, markColor: string) {
    const c = this.colors;
    const r = BADGE.r;
    const side = 2 * (r + 8);
    return this.texture(name, side, side, (ctx) => {
      ctx.beginPath();
      ctx.arc(0, 4, r, 0, Math.PI * 2);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = c.border;
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.strokeStyle = markColor;
      ctx.stroke(new Path2D(mark));
    });
  }

  private tickTexture() {
    const c = this.colors;
    return this.badgeTexture("tick", c.primary, TICK, c.primaryFg);
  }

  private crossTexture() {
    const c = this.colors;
    return this.badgeTexture("cross", c.destructive, CROSS, c.destructiveFg);
  }
}
