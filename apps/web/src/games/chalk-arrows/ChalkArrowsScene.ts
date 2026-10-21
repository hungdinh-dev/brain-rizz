import {
  CHALK_FIELD,
  type ChalkArrowsPuzzle,
  type ChalkColor,
  type ChalkDir,
  chalkArrows,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import { currentLanguage } from "@/i18n";
import type { Ctx } from "../_shared/canvas";
import {
  type Art,
  type Box,
  circle,
  fill,
  grain,
  paintArt,
  placeArt,
  rgba,
  roundRect,
  softStroke,
  stroke,
} from "../_shared/chalk";
import { shouldIgnoreGameKey } from "../keyboard";
import { DESIGN_HEIGHT, DESIGN_WIDTH, type MinigameBridge } from "../types";
import { sceneText } from "./locales";

/*
 * Phấn trượt — phấn trắng vuốt theo hướng mũi tên CHỈ, phấn vàng vuốt theo hướng mũi tên TRƯỢT.
 * Đặc tả: docs/04-minigames/chalk-arrows.md (mục "Ghi chú cho FE"); bản mẫu: ChalkArrowsMobile,
 * ChalkArrowsStates, ChalkArrowsLevels trên canvas Brain Rizz.
 *
 * Mọi nét phấn (mũi tên, vệt bụi, nét tẩy mờ, khung gỗ, mặt bảng) vẽ MỘT lần ra canvas 2D rồi dùng
 * làm texture; mỗi khung hình chỉ dời vị trí ảnh. Mặt bảng cắt theo khung bằng camera riêng
 * (viewport = ô bảng, cắt bằng scissor, không cần mask), lớp giao diện (khung gỗ, chip, nút) vẽ bằng
 * camera thứ hai nằm trên.
 */

// ─── Màu ────────────────────────────────────────────────────────────────────────────────────────

/** Token CSS (tự đổi theo sáng/tối), đọc lại mỗi câu. */
const TOKENS = {
  /** Mặt nút, chip, vòng nhắc vuốt, nền thanh khoá. */
  card: "--card",
  /** Mũi tên trên nút, chữ chip, viền thanh khoá. */
  text: "--card-foreground",
  /** Viền nút/chip/khung, bóng đổ, viền ngoài mũi tên chỉ dẫn. */
  sticker: "--sticker",
  /** Nút đúng, mũi tên chỉ dẫn, vòng khoanh đầu mũi tên. */
  primary: "--primary",
  /** Dấu ✗. */
  destructive: "--destructive",
  /** Viền trong của bảng (màu nhóm Phân tích). */
  analyze: "--color-analyze",
  /** Mặt bảng. */
  board: "--board",
  /** Nét tẩy mờ (Siêu khó). */
  muted: "--chalk-muted",
  /** Khung gỗ quanh bảng. */
  wood: "--wood",
  /** Mũi tên trên nút đang sáng vàng. */
  ink: "--color-ink",
} as const;

type Tone = keyof typeof TOKENS;

/** Giá trị token ở nền sáng, chỉ dùng khi không đọc được biến CSS. */
const FALLBACK: Record<Tone, string> = {
  card: "#fff8ef",
  text: "#1f1b3a",
  sticker: "#1f1b3a",
  primary: "#ffd166",
  destructive: "#c93a55",
  analyze: "#4d9de0",
  board: "#2d6a54",
  muted: "#d5e4dc",
  wood: "#a8693b",
  ink: "#1f1b3a",
};

/**
 * Màu phấn riêng của game (bảng màu ở "Phân biệt màu, không chỉ bằng màu" của đặc tả), giống nhau
 * ở hai nền. Trắng đi với nét liền, vàng đi với nét đôi; Siêu khó dùng bản `subtle` gần nhau hơn.
 */
const CHALK_COLORS: Record<ChalkColor, { clear: string; subtle: string }> = {
  white: { clear: "#f6f3ea", subtle: "#efe3c2" },
  yellow: { clear: "#f2b632", subtle: "#e3c35a" },
};
/** Viền trắng dưới dấu ✗ và mũi tên "hướng còn lại" (phấn trắng) lúc hiện đáp án. */
const HALO = "#ffffff";
const CHALK_WHITE = CHALK_COLORS.white.clear;
/** Bàn tay ở vòng nhắc vuốt (như bản mẫu). */
const HAND_FILL = "#ffffff";

interface Paint {
  num: number;
  css: string;
}

type Palette = Record<Tone, Paint> & { id: string; dark: boolean };

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
    dark: style.colorScheme === "dark",
  };
}

// ─── Bố cục (px trong khung 720×1280), theo bảng Ghi chú cho FE và bản mẫu ChalkArrowsMobile ─────

/** Khung 1 000 × 1 200 đơn vị phủ khung gỗ x 36–684, y 250–1028: 0,648 px/đơn vị. */
const UNIT = 0.648;
const FIELD_X = 36;
const FIELD_Y = 250;
const fx = (x: number) => FIELD_X + UNIT * x;
const fy = (y: number) => FIELD_Y + UNIT * y;

/** Khung gỗ và mặt bảng (phần thấy được, cắt mũi tên theo vùng này). */
const WOOD = { x: 36, y: 250, w: 648, h: 778, r: 30 };
const SLATE = { x: 52, y: 266, w: 616, h: 746, r: 18 };
const FIELD_CENTER = { x: CHALK_FIELD.width / 2, y: CHALK_FIELD.height / 2 };

/** 4 nút hướng: hàng y 1050–1160, mỗi nút 140×110, thứ tự ← ↑ ↓ →. */
const BUTTON = { y: 1105, w: 140, h: 110, r: 14, edge: 3, shadow: 4 };
const BUTTON_XS = [126, 282, 438, 594] as const;
const BUTTON_DIRS: readonly ChalkDir[] = [3, 0, 2, 1];
/** Dấu ✓ / ✗ ở góc trên phải nút (tâm, so với tâm nút). */
const BADGE_AT = { x: 68, y: -53 };
const HOVER_LIFT = 4;
const PRESS_SINK = 3;

/** Thanh khoá khi sai. */
const LOCK = { x: 150, y: 1206, w: 420, h: 14 };

/** Chip nhắc luật (chỉ Mầm, Thường): chip phấn trắng bên trái, chip phấn vàng bên phải. */
const CHIP = { y: 150, w: 264, h: 74, r: 37, shadow: 6, edge: 5 };
const CHIP_XS = { point: 36, slide: 420 } as const;

/** Vòng nhắc vuốt ở câu đầu vòng (màn cảm ứng). */
const HINT = { x: 360, y: 610, labelY: 808, labelW: 300, labelH: 56 };

/** Ngưỡng vuốt: quãng ≥ 40 px thiết kế, trục chính ≥ 1,3 lần trục kia. */
const SWIPE_MIN = 40;
const SWIPE_RATIO = 1.3;

/** Vector đơn vị theo hướng: 0 lên, 1 phải, 2 xuống, 3 trái. */
const DIR_V: readonly { x: number; y: number }[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/** Phím → hướng: mã phím (không phụ thuộc bố cục bàn phím) trước, rồi tên phím. */
const KEY_DIRS: Readonly<Record<string, ChalkDir>> = {
  ArrowUp: 0,
  ArrowRight: 1,
  ArrowDown: 2,
  ArrowLeft: 3,
  KeyW: 0,
  KeyD: 1,
  KeyS: 2,
  KeyA: 3,
};
const ARROW_KEYS = new Set(["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"]);
/** Nhãn phím nhỏ trên nút (máy tính). Là ký hiệu phím, không dịch. */
const KEY_LABELS: Readonly<Record<ChalkDir, string>> = {
  0: "↑ / W",
  1: "→ / D",
  2: "↓ / S",
  3: "← / A",
};

// ─── Chuyển động ───────────────────────────────────────────────────────────────────────────────

/** Nhóm mũi tên hiện mờ → rõ (như vừa vẽ phấn). */
const FADE_MS = 150;
/** Đúng: nhóm vụt ra khỏi bảng theo hướng vừa chọn. */
const FLY_MS = 250;
const FLY_UNITS = 1100;
/** Sau câu đúng sang câu mới; server tính phần này vào câu sau nên giữ ≤ 300 ms. */
const NEXT_AFTER_HIT_MS = 300;
const DUST_MS = 320;
const SHAKE_PX = 8;
const SHAKE_MS = 200;
const SHAKE_TIMES = 3;
const PRESS_MS = 90;
/** Độ mờ của nét tẩy mờ: 30 % lúc chơi, 15 % lúc hiện đáp án. */
const SMUDGE_ALPHA = 0.3;
const SMUDGE_ALPHA_MISS = 0.15;
/** Mũi tên "hướng còn lại" (gạch chéo) lúc hiện đáp án. */
const OTHER_ALPHA = 0.6;

/** Chờ font tối đa bấy nhiêu ms rồi vẽ bằng font dự phòng. */
const FONT_TIMEOUT_MS = 1500;
const FONT = '"Baloo 2", "Be Vietnam Pro", sans-serif';

// ─── Hình (đơn vị khung cho mũi tên, theo bản mẫu; mũi tên vẽ chỉ LÊN, vệt bụi vẽ cho trượt LÊN) ──

const SOLID = "M0 56 L0 -54 M-30 -26 L0 -58 L30 -26";
const DOUBLE = "M-11 56 L-11 -24 M11 56 L11 -24 M0 -60 L32 -24 L-32 -24 Z";
const SMUDGED = "M0 56 L0 -54 M-24 -32 L0 -58 L24 -32";
const ERASER = "M-64 -8 C-22 -22 18 4 62 -16 M-58 30 C-18 16 22 42 60 24";
const GUIDE = "M0 -40 L0 -164 M-28 -134 L0 -164 L28 -134";
const OTHER = "M0 -40 L0 -150 M-26 -122 L0 -150 L26 -122";
const OTHER_CROSS = "M-22 -114 L22 -70 M22 -114 L-22 -70";
const BUTTON_ARROW = "M0 26 L0 -26 M-19 -7 L0 -26 L19 -7";
const CHIP_ARROW = "M0 9 L0 -9 M-7 -2 L0 -9 L7 -2";
const HINT_CHEVRON = "M-20 10 L0 -10 L20 10";
const TICK = "M-12 1 L-3 10 L13 -9";
const CROSS = "M-30 -30 L30 30 M30 -30 L-30 30";
const HAND =
  "M9 11 L9 5.5 C9 4.4 9.9 3.5 11 3.5 C12.1 3.5 13 4.4 13 5.5 L13 10 L17 10.8 C18.5 11.1 19.4 12.5 19 14 L17.8 18.5 C17.5 19.7 16.4 20.5 15.2 20.5 L11.3 20.5 C10.5 20.5 9.8 20.1 9.3 19.5 L5.6 14.9 C5 14.1 5.2 13 6 12.5 C6.7 12 7.6 12.1 8.2 12.7 L9 13.5 Z";
/** Vết lau và vết phấn cũ trên mặt bảng (px khung 720×1280, tĩnh, rất nhạt). */
const BOARD_WIPES: readonly { d: string; width: number }[] = [
  { d: "M96 430 C200 366 330 384 430 452", width: 48 },
  { d: "M300 770 C400 706 520 724 640 796", width: 56 },
  { d: "M84 936 C164 904 244 914 304 964", width: 40 },
  { d: "M470 330 C540 302 600 320 650 362", width: 36 },
];
const BOARD_SCRIBBLES =
  "M110 596 L150 596 M130 576 L130 616 M174 590 C186 576 206 580 204 596 C202 610 180 616 176 630 L208 630 M520 516 C540 500 572 504 576 526 C580 548 552 556 540 548 M440 610 q16 -10 32 0 t32 0 t32 0 M218 866 A22 22 0 1 0 262 866 A22 22 0 1 0 218 866 M560 900 L600 900 M560 914 L600 914";
const WOOD_SEAMS = "M60 258 L660 258 M60 1020 L660 1020 M44 290 L44 990 M676 290 L676 990";

/** Chấm bụi phấn sau mũi tên (cx, cy, r, độ đậm), bản thường và bản giảm chuyển động. */
const TRAIL_DOTS: readonly (readonly [number, number, number, number])[] = [
  [-8, 70, 4.5, 0.7],
  [9, 78, 3.6, 0.6],
  [-2, 90, 3.2, 0.5],
  [7, 101, 2.6, 0.4],
  [-7, 111, 2.2, 0.3],
  [3, 121, 1.8, 0.22],
];
const TRAIL_DOTS_STILL: readonly (readonly [number, number, number, number])[] = [
  [-8, 70, 5, 0.85],
  [9, 78, 4.2, 0.75],
  [-3, 89, 3.8, 0.68],
  [8, 100, 3.4, 0.6],
  [-7, 111, 3, 0.52],
  [4, 122, 2.7, 0.44],
  [-5, 133, 2.4, 0.36],
  [6, 144, 2, 0.28],
  [-2, 154, 1.8, 0.2],
];

/** Texture vẽ ở độ phân giải gấp đôi khung thiết kế cho nét phấn sắc trên màn mật độ cao. */
const RES = 2;
const TAU = Math.PI * 2;
const QUARTER = Math.PI / 2;

// ─── Tiện ích ─────────────────────────────────────────────────────────────────────────────────

const mod = (a: number, m: number) => ((a % m) + m) % m;

/** Hạt phấn của game này đục đậm hơn mặc định (độ đục 0,25 + 0,65 × rand). */
const grainDeep = (ctx: Ctx, density: number, seed: number) =>
  grain(ctx, density, seed, 0.25, 0.65);

function waitForFont(): Promise<void> {
  const fonts = document.fonts;
  if (!fonts) return Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, FONT_TIMEOUT_MS);
  });
  const load = fonts.load(`800 30px "Baloo 2"`).then(
    () => {},
    () => {},
  );
  return Promise.race([load, timeout]).finally(() => clearTimeout(timer));
}

function mediaMatches(query: string): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

// ─── Scene ────────────────────────────────────────────────────────────────────────────────────

/** Một bản vẽ của mũi tên (bản chính + 3 bản ló qua mép nối vòng). */
interface Copy {
  arrow: Phaser.GameObjects.Image;
  trail?: Phaser.GameObjects.Image;
  eraser?: Phaser.GameObjects.Image;
}

interface Sprite {
  x0: number;
  y0: number;
  slide: ChalkDir;
  copies: Copy[];
}

interface ButtonView {
  dir: ChalkDir;
  x: number;
  /** Mặt nút, mũi tên, nhãn phím, dấu ✓/✗: nhấc lên khi rê chuột, lún xuống khi bấm phím. */
  body: Phaser.GameObjects.Container;
  face: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image;
  label?: Phaser.GameObjects.Text;
  tick: Phaser.GameObjects.Image;
  cross: Phaser.GameObjects.Image;
}

type ButtonState = "idle" | "right" | "wrong";

/** Phấn trượt — vuốt theo mũi tên (phấn trắng) hoặc theo hướng trượt (phấn vàng). */
export default class ChalkArrowsScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = true;
  private reducedMotion = false;
  private canHover = false;
  private touch = false;
  private palette!: Palette;
  private puzzle?: ChalkArrowsPuzzle;
  /** Mốc đồng hồ scene lúc câu hiện; quãng trượt = speed × (bây giờ − mốc). */
  private shownAt = 0;
  /** Thời điểm (ms tính từ lúc câu hiện) mũi tên dừng trượt; undefined = đang trượt. */
  private frozenAt?: number;
  /** Độ dời (đơn vị khung) lúc nhóm mũi tên vụt ra sau câu đúng. */
  private fly = { x: 0, y: 0 };

  private uiCamera?: Phaser.Cameras.Scene2D.Camera;
  /** Lớp thấy qua camera mặt bảng (cắt theo ô bảng). */
  private slateRoot?: Phaser.GameObjects.Container;
  /** Lớp giao diện (khung gỗ, chip, nút, thanh khoá) thấy qua camera toàn khung. */
  private uiRoot?: Phaser.GameObjects.Container;
  /** Phần tĩnh vẽ theo bảng màu: mặt bảng, khung gỗ, chip, nút. */
  private staticId = "";
  private slateBack?: Phaser.GameObjects.Container;
  private chrome?: Phaser.GameObjects.Container;
  private buttons: ButtonView[] = [];
  /** Phần của câu hiện tại. */
  private round?: Phaser.GameObjects.Container;
  private smudgeLayer?: Phaser.GameObjects.Container;
  private trailLayer?: Phaser.GameObjects.Container;
  private arrowLayer?: Phaser.GameObjects.Container;
  private fxLayer?: Phaser.GameObjects.Container;
  private overlay?: Phaser.GameObjects.Container;
  private hint?: Phaser.GameObjects.Container;
  private lockBar?: Phaser.GameObjects.Graphics;
  /** Đã nhấn trong khung (thả mà chưa nhấn trong khung thì không tính là vuốt/chạm). */
  private pressed = false;
  private clear: Sprite[] = [];
  private smudges: Sprite[] = [];
  private hovered?: ButtonView;
  private onKey = (event: KeyboardEvent) => this.handleKey(event);

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.locked = true;
    this.puzzle = undefined;
    this.staticId = "";
  }

  create() {
    this.canHover = mediaMatches("(hover: hover) and (pointer: fine)");
    this.touch = mediaMatches("(pointer: coarse)");

    // Camera chính = mặt bảng: viewport đúng ô bảng nên mũi tên ló ra ngoài bị cắt (scissor).
    // Cuộn đúng bằng góc viewport để toạ độ thế giới = toạ độ khung 720×1280.
    const slateCamera = this.cameras.main;
    slateCamera.setViewport(SLATE.x, SLATE.y, SLATE.w, SLATE.h);
    slateCamera.setScroll(SLATE.x, SLATE.y);
    const uiCamera = this.cameras.add(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.uiCamera = uiCamera;
    const slateRoot = this.add.container(0, 0);
    const uiRoot = this.add.container(0, 0);
    slateCamera.ignore(uiRoot);
    uiCamera.ignore(slateRoot);
    this.slateRoot = slateRoot;
    this.uiRoot = uiRoot;

    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.pressed = true;
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => this.release(p));
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, (p: Phaser.Input.Pointer) =>
      this.release(p),
    );
    if (this.canHover) {
      this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) =>
        this.hover(this.buttonAt(p.x, p.y)),
      );
      this.input.on(Phaser.Input.Events.GAME_OUT, () => this.hover(undefined));
    }
    // Bắt phím ở mọi thiết bị có bàn phím (cả máy tính bảng gắn phím), không chỉ khi màn rộng.
    window.addEventListener("keydown", this.onKey);

    // Hết vòng hoặc rời màn: dừng hẳn mọi tween, hẹn giờ và bỏ nghe phím.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
    void waitForFont().then(() => {
      // Hết vòng trong lúc chờ font thì scene đã bị huỷ.
      if (this.sys.isActive()) this.next();
    });
  }

  private cleanup() {
    window.removeEventListener("keydown", this.onKey);
    this.locked = true;
    this.puzzle = undefined;
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.round = undefined;
    this.clear = [];
    this.smudges = [];
    this.buttons = [];
    this.hovered = undefined;
  }

  private next() {
    this.locked = false;
    this.showPuzzle();
  }

  // ── Câu đố ──

  private showPuzzle() {
    // Mọi tween đang chạy đều thuộc câu cũ (hiện câu, vụt, bụi, rung, thanh khoá): dừng trước khi huỷ.
    this.tweens.killAll();
    this.round?.destroy();
    this.overlay?.destroy();
    this.overlay = undefined;
    this.lockBar?.destroy();
    this.lockBar = undefined;
    this.clear = [];
    this.smudges = [];

    this.reducedMotion = prefersReducedMotion();
    this.palette = readPalette(this.game.canvas);
    const puzzle = chalkArrows.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    this.puzzle = puzzle;
    this.drawStatic();
    for (const button of this.buttons) this.paintButton(button, "idle");

    const smudgeLayer = this.add.container(0, 0).setAlpha(SMUDGE_ALPHA);
    const trailLayer = this.add.container(0, 0);
    const arrowLayer = this.add.container(0, 0);
    const fxLayer = this.add.container(0, 0);
    const round = this.add.container(0, 0, [smudgeLayer, trailLayer, arrowLayer, fxLayer]);
    this.slateRoot?.add(round);
    this.round = round;
    this.smudgeLayer = smudgeLayer;
    this.trailLayer = trailLayer;
    this.arrowLayer = arrowLayer;
    this.fxLayer = fxLayer;

    // Nét tẩy mờ (dưới mũi tên rõ), mỗi cái hướng chỉ, hướng trượt và vết lau riêng.
    const smudgeArt = this.smudgeArt();
    const eraserArt = this.eraserArt();
    puzzle.smudges.forEach((smudge, k) => {
      const tilt = Phaser.Math.DegToRad(((this.index * 7 + k * 3) % 4) * 45 - 70);
      const copies = this.copies(() => {
        const arrow = this.place(smudgeArt).setRotation(smudge.point * QUARTER);
        const eraser = this.place(eraserArt).setRotation(tilt);
        smudgeLayer.add([arrow, eraser]);
        return { arrow, eraser };
      });
      this.smudges.push({ x0: smudge.x, y0: smudge.y, slide: smudge.slide, copies });
    });

    // Mũi tên rõ: cùng màu, cùng hướng chỉ, cùng hướng trượt; vệt bụi phía sau theo hướng trượt.
    const arrowArt = this.arrowArt(puzzle.color, puzzle.subtle);
    const trailArt = this.trailArt(puzzle.color, puzzle.subtle, this.reducedMotion);
    for (const point of puzzle.arrows) {
      const copies = this.copies(() => {
        const trail = this.place(trailArt).setRotation(puzzle.slide * QUARTER);
        const arrow = this.place(arrowArt).setRotation(puzzle.point * QUARTER);
        trailLayer.add(trail);
        arrowLayer.add(arrow);
        return { arrow, trail };
      });
      this.clear.push({ x0: point.x, y0: point.y, slide: puzzle.slide, copies });
    }

    this.shownAt = this.time.now;
    this.frozenAt = undefined;
    this.fly = { x: 0, y: 0 };
    this.layout();

    if (!this.reducedMotion) {
      smudgeLayer.setAlpha(0);
      trailLayer.setAlpha(0);
      arrowLayer.setAlpha(0);
      this.tweens.add({ targets: [trailLayer, arrowLayer], alpha: 1, duration: FADE_MS });
      this.tweens.add({ targets: smudgeLayer, alpha: SMUDGE_ALPHA, duration: FADE_MS });
    }

    // Câu đầu vòng trên màn cảm ứng: vòng nhắc vuốt, ẩn ngay khi trả lời.
    this.hint?.destroy();
    this.hint = undefined;
    if (this.touch && this.index === 0) this.drawHint();
  }

  /** Bản chính + bản ló ở mép đối diện theo ngang, dọc và góc (bảng nối vòng). */
  private copies(make: () => Copy): Copy[] {
    return [make(), make(), make(), make()];
  }

  override update() {
    if (!this.puzzle) return;
    this.layout();
  }

  /** Đặt mọi bản vẽ theo quãng trượt hiện tại (lấy mod theo khung), cộng độ dời lúc vụt ra. */
  private layout() {
    const puzzle = this.puzzle;
    if (!puzzle) return;
    const elapsed = this.frozenAt ?? this.time.now - this.shownAt;
    const dist = (puzzle.speed * elapsed) / 1000;
    const flying = this.fly.x !== 0 || this.fly.y !== 0;
    for (const sprite of this.smudges) this.position(sprite, dist, false);
    for (const sprite of this.clear) this.position(sprite, dist, flying);
  }

  private position(sprite: Sprite, dist: number, flying: boolean) {
    const v = DIR_V[sprite.slide] ?? { x: 0, y: 0 };
    const x = mod(sprite.x0 + v.x * dist, CHALK_FIELD.width);
    const y = mod(sprite.y0 + v.y * dist, CHALK_FIELD.height);
    const wrapX = x < FIELD_CENTER.x ? CHALK_FIELD.width : -CHALK_FIELD.width;
    const wrapY = y < FIELD_CENTER.y ? CHALK_FIELD.height : -CHALK_FIELD.height;
    sprite.copies.forEach((copy, k) => {
      const px = fx(x + (k & 1 ? wrapX : 0) + this.fly.x);
      const py = fy(y + (k & 2 ? wrapY : 0) + this.fly.y);
      // Lúc vụt ra chỉ còn bản chính, bản ló không bay vào từ mép kia.
      const visible = k === 0 || !flying;
      for (const image of [copy.arrow, copy.trail, copy.eraser]) {
        image?.setPosition(px, py).setVisible(visible);
      }
    });
  }

  /** Tâm (đơn vị khung, đã nối vòng) của mũi tên rõ lúc này. */
  private currentPoint(sprite: Sprite): { x: number; y: number } {
    const puzzle = this.puzzle;
    const elapsed = this.frozenAt ?? this.time.now - this.shownAt;
    const dist = ((puzzle?.speed ?? 0) * elapsed) / 1000;
    const v = DIR_V[sprite.slide] ?? { x: 0, y: 0 };
    return {
      x: mod(sprite.x0 + v.x * dist, CHALK_FIELD.width),
      y: mod(sprite.y0 + v.y * dist, CHALK_FIELD.height),
    };
  }

  // ── Nhập: vuốt, chạm nút, phím ──

  private release(pointer: Phaser.Input.Pointer) {
    if (!this.pressed) return;
    this.pressed = false;
    const dx = pointer.upX - pointer.downX;
    const dy = pointer.upY - pointer.downY;
    if (Math.hypot(dx, dy) < SWIPE_MIN) {
      // Chạm (quãng ngắn) = chọn hướng của nút được chạm.
      const button = this.buttonAt(pointer.downX, pointer.downY);
      if (button) this.answer(button.dir);
      return;
    }
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    // Vuốt chéo không rõ hướng thì bỏ qua (không gửi).
    if (ax >= SWIPE_RATIO * ay) this.answer(dx > 0 ? 1 : 3);
    else if (ay >= SWIPE_RATIO * ax) this.answer(dy > 0 ? 2 : 0);
  }

  private handleKey(event: KeyboardEvent) {
    // Có phím bổ trợ, đang gõ chữ hoặc đang mở hộp thoại (Thoát, sheet chat…): không trả lời.
    if (shouldIgnoreGameKey(event)) return;
    const dir = KEY_DIRS[event.code] ?? KEY_DIRS[event.key];
    if (dir === undefined) return;
    // Không để trang cuộn khi bấm phím mũi tên (kể cả phím lặp do giữ phím).
    if (ARROW_KEYS.has(event.code) || ARROW_KEYS.has(event.key)) event.preventDefault();
    if (event.repeat || !this.sys.isActive()) return;
    const button = this.buttons.find((b) => b.dir === dir);
    if (button && !this.locked) this.press(button);
    this.answer(dir);
  }

  private buttonAt(x: number, y: number): ButtonView | undefined {
    if (Math.abs(y - BUTTON.y) > BUTTON.h / 2) return undefined;
    return this.buttons.find((b) => Math.abs(x - b.x) <= BUTTON.w / 2);
  }

  private hover(button: ButtonView | undefined) {
    if (button === this.hovered) return;
    if (this.hovered) this.hovered.body.y = 0;
    this.hovered = button;
    if (button && !this.locked) button.body.y = -HOVER_LIFT;
    this.input.setDefaultCursor(button ? "pointer" : "default");
  }

  /** Bấm phím: nút tương ứng lún xuống một nhịp như khi click. */
  private press(button: ButtonView) {
    button.body.y = PRESS_SINK;
    this.time.delayedCall(PRESS_MS, () => {
      button.body.y = 0;
    });
  }

  // ── Trả lời ──

  private answer(choice: ChalkDir) {
    const puzzle = this.puzzle;
    if (this.locked || !puzzle) return;
    this.locked = true;
    this.hint?.destroy();
    this.hint = undefined;
    if (this.hovered) this.hovered.body.y = 0;

    // Mũi tên dừng ở chỗ lúc trả lời.
    this.frozenAt = this.time.now - this.shownAt;
    this.layout();

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const index = this.index;
    const correct = chalkArrows.check(puzzle, choice);
    this.bridge.submit(index, choice);
    this.index += 1;

    if (correct) {
      this.showHit(choice);
      this.time.delayedCall(NEXT_AFTER_HIT_MS, () => this.next());
      return;
    }

    this.showMiss(puzzle, choice);
    // Hết khoá theo `lockedUntil` của server (không tự đếm 1,5 giây) để khớp huy hiệu khoá của khung.
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive()) return;
      this.drawLockBar(ms);
      this.time.delayedCall(ms, () => this.next());
    });
  }

  /** Đúng: nút vừa chọn sáng vàng; nhóm mũi tên vụt theo hướng đó ra khỏi bảng, để lại bụi phấn. */
  private showHit(choice: ChalkDir) {
    const button = this.buttons.find((b) => b.dir === choice);
    if (button) this.paintButton(button, "right");
    if (this.reducedMotion) return;

    const puzzle = this.puzzle;
    const fxLayer = this.fxLayer;
    if (puzzle && fxLayer) {
      const dust = this.dustArt(puzzle.color, puzzle.subtle);
      for (const sprite of this.clear) {
        const at = this.currentPoint(sprite);
        const puff = this.place(dust).setPosition(fx(at.x), fy(at.y));
        fxLayer.add(puff);
        this.tweens.add({
          targets: puff,
          scale: puff.scale * 1.6,
          alpha: 0,
          duration: DUST_MS,
          ease: "Quad.easeOut",
        });
      }
    }
    const v = DIR_V[choice] ?? { x: 0, y: 0 };
    this.tweens.addCounter({
      from: 0,
      to: FLY_UNITS,
      duration: FLY_MS,
      ease: "Quad.easeIn",
      onUpdate: (tween) => {
        const d = tween.getValue() ?? 0;
        this.fly = { x: v.x * d, y: v.y * d };
      },
    });
  }

  /**
   * Sai, khoá (CR-006): mũi tên dừng; nút đúng sáng vàng + ✓, nút vừa chọn ✗ và rung. Quanh mũi tên
   * rõ gần tâm nhất: phấn trắng → khoanh đầu mũi tên; mũi tên chỉ dẫn vàng theo hướng đúng (phấn
   * vàng: dọc vệt bụi theo hướng trượt); hướng còn lại hiện mờ, gạch chéo. Nét tẩy mờ còn 15 %.
   * Mọi thứ nằm trong bảng (y ≥ 266) và hàng nút, dưới dải huy hiệu khoá.
   */
  private showMiss(puzzle: ChalkArrowsPuzzle, choice: ChalkDir) {
    for (const button of this.buttons) {
      if (button.dir === puzzle.answer) this.paintButton(button, "right");
      else if (button.dir === choice) this.paintButton(button, "wrong");
    }
    this.smudgeLayer?.setAlpha(SMUDGE_ALPHA_MISS);

    let best: { x: number; y: number } | undefined;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const sprite of this.clear) {
      const at = this.currentPoint(sprite);
      const d = Math.hypot(at.x - FIELD_CENTER.x, at.y - FIELD_CENTER.y);
      if (d < bestDist) {
        bestDist = d;
        best = at;
      }
    }
    if (best) {
      const x = fx(best.x);
      const y = fy(best.y);
      const overlay = this.add.container(0, 0);
      const other = puzzle.color === "white" ? puzzle.slide : puzzle.point;
      if (other !== puzzle.answer) {
        overlay.add(
          this.place(this.otherArt())
            .setPosition(x, y)
            .setRotation(other * QUARTER)
            .setAlpha(OTHER_ALPHA),
        );
      }
      overlay.add(
        this.place(this.guideArt())
          .setPosition(x, y)
          .setRotation(puzzle.answer * QUARTER),
      );
      if (puzzle.color === "white") {
        overlay.add(
          this.place(this.ringArt())
            .setPosition(x, y)
            .setRotation(puzzle.point * QUARTER),
        );
      }
      this.slateRoot?.add(overlay);
      this.overlay = overlay;
    }

    const wrong = this.buttons.find((b) => b.dir === choice);
    if (wrong && !this.reducedMotion) this.shake(wrong.body);
  }

  /** Rung ngang ±8 px rồi về chỗ cũ. */
  private shake(target: { x: number }) {
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: SHAKE_MS,
      onUpdate: (tween) => {
        target.x = Math.sin((tween.getValue() ?? 0) * TAU * SHAKE_TIMES) * SHAKE_PX;
      },
      onComplete: () => {
        target.x = 0;
      },
    });
  }

  /** Thanh khoá rút ngắn dần trong suốt thời gian khoá. */
  private drawLockBar(ms: number) {
    if (ms <= 0) return;
    const { card, text } = this.palette;
    const bar = this.add.graphics();
    this.uiRoot?.add(bar);
    this.lockBar = bar;
    const draw = (left: number) => {
      bar.clear();
      bar.fillStyle(card.num).fillRoundedRect(LOCK.x, LOCK.y, LOCK.w, LOCK.h, LOCK.h / 2);
      bar.lineStyle(3, text.num).strokeRoundedRect(LOCK.x, LOCK.y, LOCK.w, LOCK.h, LOCK.h / 2);
      const w = LOCK.w * left;
      if (w >= LOCK.h) {
        bar.fillStyle(text.num).fillRoundedRect(LOCK.x, LOCK.y, w, LOCK.h, LOCK.h / 2);
      }
    };
    draw(1);
    this.tweens.addCounter({
      from: 1,
      to: 0,
      duration: ms,
      onUpdate: (tween) => draw(tween.getValue() ?? 0),
    });
  }

  // ── Phần tĩnh: mặt bảng, khung gỗ, chip, nút (vẽ lại khi đổi sáng/tối) ──

  private drawStatic() {
    const palette = this.palette;
    const difficulty = this.bridge.difficulty;
    const id = `${palette.id}/${difficulty}/${currentLanguage()}`;
    if (id === this.staticId) return;
    this.staticId = id;
    this.slateBack?.destroy();
    this.chrome?.destroy();
    this.hovered = undefined;

    const slateBack = this.add.container(0, 0, [this.place(this.slateArt())]);
    this.slateRoot?.addAt(slateBack, 0);
    this.slateBack = slateBack;

    const chrome = this.add.container(0, 0, [this.place(this.frameArt())]);
    this.uiRoot?.addAt(chrome, 0);
    this.chrome = chrome;

    // Chip nhắc luật: Mầm chỉ chip phấn trắng, Thường đủ hai chip, từ Khó ẩn (đã chốt, mục 7).
    const text = sceneText[currentLanguage()];
    if (difficulty <= 1) this.drawChip(chrome, CHIP_XS.point, "white", text.point);
    if (difficulty === 1) this.drawChip(chrome, CHIP_XS.slide, "yellow", text.slide);

    this.buttons = BUTTON_XS.map((x, i) => this.drawButton(chrome, x, BUTTON_DIRS[i] ?? 0));
  }

  private drawChip(
    layer: Phaser.GameObjects.Container,
    left: number,
    color: ChalkColor,
    label: string,
  ) {
    const { card, text, sticker, board } = this.palette;
    const g = this.add.graphics();
    g.fillStyle(sticker.num).fillRoundedRect(left, CHIP.y + CHIP.shadow, CHIP.w, CHIP.h, CHIP.r);
    g.fillStyle(card.num).fillRoundedRect(left, CHIP.y, CHIP.w, CHIP.h, CHIP.r);
    g.lineStyle(CHIP.edge, sticker.num).strokeRoundedRect(left, CHIP.y, CHIP.w, CHIP.h, CHIP.r);
    const cy = CHIP.y + CHIP.h / 2;
    const swatchX = left + 40;
    g.fillStyle(board.num).fillCircle(swatchX, cy, 29);
    g.lineStyle(4, sticker.num).strokeCircle(swatchX, cy, 29);
    layer.add(g);

    // Mẫu nét trong vòng tròn: phấn trắng chỉ phải (nét liền); phấn vàng chỉ lên, trượt phải (nét đôi + bụi).
    const mini = 0.26 / UNIT;
    if (color === "white") {
      layer.add(
        this.place(this.arrowArt("white", false), mini)
          .setPosition(swatchX, cy)
          .setRotation(QUARTER),
      );
    } else {
      const sx = swatchX + 6;
      layer.add([
        this.place(this.trailArt("yellow", false, false), mini)
          .setPosition(sx, cy)
          .setRotation(QUARTER),
        this.place(this.arrowArt("yellow", false), mini).setPosition(sx, cy),
      ]);
    }
    layer.add(
      this.place(this.chipArrowArt())
        .setPosition(left + 88, cy)
        .setRotation(QUARTER),
    );

    const textX = left + 104;
    const room = left + CHIP.w - 18 - textX;
    const caption = this.add
      .text(textX, cy, label, {
        fontFamily: FONT,
        fontStyle: "800",
        fontSize: "30px",
        color: text.css,
      })
      .setOrigin(0, 0.5);
    if (caption.width > room) caption.setScale(room / caption.width);
    layer.add(caption);
  }

  private drawButton(layer: Phaser.GameObjects.Container, x: number, dir: ChalkDir): ButtonView {
    const { sticker } = this.palette;
    const shadow = this.add.graphics();
    shadow
      .fillStyle(sticker.num)
      .fillRoundedRect(-BUTTON.w / 2, -BUTTON.h / 2 + BUTTON.shadow, BUTTON.w, BUTTON.h, BUTTON.r);
    const face = this.add.graphics();
    const keys = this.canHover;
    const icon = this.place(this.buttonArrowArt("text"), keys ? 0.72 : 1)
      .setPosition(0, keys ? -12 : 0)
      .setRotation(dir * QUARTER);
    const parts: Phaser.GameObjects.GameObject[] = [face, icon];
    let label: Phaser.GameObjects.Text | undefined;
    if (keys) {
      label = this.add
        .text(0, 34, KEY_LABELS[dir], { fontFamily: FONT, fontStyle: "700", fontSize: "18px" })
        .setOrigin(0.5);
      parts.push(label);
    }
    const tick = this.place(this.tickArt()).setPosition(BADGE_AT.x, BADGE_AT.y);
    const cross = this.place(this.crossArt()).setPosition(BADGE_AT.x, BADGE_AT.y);
    parts.push(tick, cross);
    const body = this.add.container(0, 0, parts);
    layer.add(this.add.container(x, BUTTON.y, [shadow, body]));
    const view: ButtonView = { dir, x, body, face, icon, label, tick, cross };
    this.paintButton(view, "idle");
    return view;
  }

  /** Mặt nút: kem (thường) hoặc vàng (đúng / đáp án); dấu ✓ khi vàng, ✗ khi vừa chọn sai. */
  private paintButton(button: ButtonView, state: ButtonState) {
    const { card, sticker, primary, text, ink } = this.palette;
    const lit = state === "right";
    button.face.clear();
    button.face
      .fillStyle(lit ? primary.num : card.num)
      .fillRoundedRect(-BUTTON.w / 2, -BUTTON.h / 2, BUTTON.w, BUTTON.h, BUTTON.r);
    const inset = BUTTON.edge / 2;
    button.face
      .lineStyle(BUTTON.edge, sticker.num)
      .strokeRoundedRect(
        -BUTTON.w / 2 + inset,
        -BUTTON.h / 2 + inset,
        BUTTON.w - BUTTON.edge,
        BUTTON.h - BUTTON.edge,
        BUTTON.r - inset,
      );
    const art = this.buttonArrowArt(lit ? "ink" : "text");
    button.icon.setTexture(art.key).setOrigin(art.ox, art.oy);
    button.label?.setColor(lit ? ink.css : text.css).setAlpha(lit ? 1 : 0.75);
    button.tick.setVisible(lit);
    button.cross.setVisible(state === "wrong");
    if (state === "idle") button.body.setPosition(0, 0);
  }

  /** Vòng nhắc vuốt giữa bảng (câu đầu vòng, màn cảm ứng), theo bản mẫu. */
  private drawHint() {
    const { sticker, primary } = this.palette;
    const ring = this.place(this.hintArt()).setPosition(HINT.x, HINT.y);
    const pill = this.add.graphics();
    pill
      .fillStyle(sticker.num)
      .fillRoundedRect(
        HINT.x - HINT.labelW / 2,
        HINT.labelY - HINT.labelH / 2,
        HINT.labelW,
        HINT.labelH,
        HINT.labelH / 2,
      );
    const caption = this.add
      .text(HINT.x, HINT.labelY, sceneText[currentLanguage()].swipe, {
        fontFamily: FONT,
        fontStyle: "800",
        fontSize: "30px",
        color: primary.css,
      })
      .setOrigin(0.5);
    const room = HINT.labelW - 32;
    if (caption.width > room) caption.setScale(room / caption.width);
    const hint = this.add.container(0, 0, [ring, pill, caption]);
    this.uiRoot?.add(hint);
    this.hint = hint;
  }

  // ── Texture vẽ bằng canvas 2D (khoá theo hình + màu nên mỗi hình chỉ vẽ một lần) ──

  private place(art: Art, scale = 1): Phaser.GameObjects.Image {
    return placeArt(this, art, scale);
  }

  /**
   * Vẽ một texture: `box` theo đơn vị hình, `zoom` = px thiết kế mỗi đơn vị. Texture vẽ ở `res`
   * lần cỡ thiết kế, ảnh đặt với tỉ lệ 1/res.
   */
  private paint(name: string, box: Box, zoom: number, draw: (ctx: Ctx) => void, res = RES): Art {
    return paintArt(this.textures, `chalk-arrows/${name}`, box, zoom, draw, res);
  }

  private chalkColor(color: ChalkColor, subtle: boolean): string {
    return subtle ? CHALK_COLORS[color].subtle : CHALK_COLORS[color].clear;
  }

  /** Mũi tên phấn chỉ LÊN: trắng = nét liền một nét dày; vàng = thân hai nét song song, đầu rỗng. */
  private arrowArt(color: ChalkColor, subtle: boolean): Art {
    const css = this.chalkColor(color, subtle);
    if (color === "white") {
      return this.paint(`solid-${css}`, [-48, -78, 48, 74], UNIT, (ctx) => {
        const shape = new Path2D(SOLID);
        stroke(ctx, shape, css, 21, 0.16);
        stroke(ctx, shape, css, 13);
        grainDeep(ctx, 0.16, 3);
      });
    }
    return this.paint(`double-${css}`, [-46, -78, 46, 70], UNIT, (ctx) => {
      const shape = new Path2D(DOUBLE);
      stroke(ctx, shape, css, 13, 0.14);
      stroke(ctx, shape, css, 8);
      grainDeep(ctx, 0.16, 7);
    });
  }

  /**
   * Vệt bụi phấn sau mũi tên trượt LÊN (nằm phía dưới). Giảm chuyển động: vệt dài và đậm hơn vì
   * là gợi ý hướng trượt, không phải trang trí.
   */
  private trailArt(color: ChalkColor, subtle: boolean, still: boolean): Art {
    const css = this.chalkColor(color, subtle);
    const end = still ? 150 : 118;
    return this.paint(
      `trail-${css}-${still ? "still" : "live"}`,
      [-36, 44, 36, end + 26],
      UNIT,
      (ctx) => {
        softStroke(
          ctx,
          new Path2D(`M0 68 L0 ${end}`),
          css,
          still ? 0.32 : 0.22,
          still ? 32 : 30,
          10,
        );
        for (const [cx, cy, r, alpha] of still ? TRAIL_DOTS_STILL : TRAIL_DOTS) {
          fill(ctx, circle(cx, cy, r), css, alpha);
        }
      },
    );
  }

  /** Mũi tên bị tẩy mờ: nét mảnh đứt quãng, nhoè, không đầu tô đặc (độ mờ đặt ở lớp). */
  private smudgeArt(): Art {
    const css = this.palette.muted.css;
    return this.paint(`smudge-${css}`, [-40, -76, 40, 72], UNIT, (ctx) => {
      ctx.setLineDash([13, 10]);
      const shape = new Path2D(SMUDGED);
      softStroke(ctx, shape, css, 0.9, 7, 3);
      stroke(ctx, shape, css, 5, 0.85);
      grainDeep(ctx, 0.22, 11);
    });
  }

  /** Vết khăn lau quệt ngang qua mũi tên tẩy mờ, cùng màu mặt bảng. */
  private eraserArt(): Art {
    const css = this.palette.board.css;
    return this.paint(`eraser-${css}`, [-100, -60, 100, 76], UNIT, (ctx) => {
      softStroke(ctx, new Path2D(ERASER), css, 0.7, 24, 10);
    });
  }

  private dustArt(color: ChalkColor, subtle: boolean): Art {
    const css = this.chalkColor(color, subtle);
    return this.paint(`dust-${css}`, [-60, -60, 60, 60], UNIT, (ctx) => {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
      g.addColorStop(0, rgba(css, 0.45));
      g.addColorStop(1, rgba(css, 0));
      ctx.fillStyle = g;
      ctx.fill(circle(0, 0, 60));
    });
  }

  /** Mũi tên chỉ dẫn vàng viền đậm (hướng đúng), chỉ LÊN từ tâm mũi tên. */
  private guideArt(): Art {
    const { sticker, primary } = this.palette;
    return this.paint(`guide-${sticker.css}-${primary.css}`, [-44, -182, 44, -24], UNIT, (ctx) => {
      const shape = new Path2D(GUIDE);
      stroke(ctx, shape, sticker.css, 25);
      stroke(ctx, shape, primary.css, 13);
    });
  }

  /** Hướng còn lại (sai): mũi tên phấn trắng viền đậm, gạch chéo đỏ. */
  private otherArt(): Art {
    const { sticker, destructive } = this.palette;
    return this.paint(
      `other-${sticker.css}-${destructive.css}`,
      [-40, -166, 40, -28],
      UNIT,
      (ctx) => {
        const shape = new Path2D(OTHER);
        stroke(ctx, shape, sticker.css, 17);
        stroke(ctx, shape, CHALK_WHITE, 9);
        stroke(ctx, new Path2D(OTHER_CROSS), destructive.css, 10);
      },
    );
  }

  /** Vòng khoanh đầu mũi tên phấn trắng. */
  private ringArt(): Art {
    const { sticker, primary } = this.palette;
    return this.paint(`ring-${sticker.css}-${primary.css}`, [-46, -88, 46, 4], UNIT, (ctx) => {
      const shape = circle(0, -42, 34);
      stroke(ctx, shape, sticker.css, 15);
      stroke(ctx, shape, primary.css, 8);
    });
  }

  private buttonArrowArt(tone: "text" | "ink"): Art {
    const css = this.palette[tone].css;
    return this.paint(`button-arrow-${css}`, [-26, -34, 26, 34], 0.8525, (ctx) => {
      stroke(ctx, new Path2D(BUTTON_ARROW), css, 10);
    });
  }

  private chipArrowArt(): Art {
    const css = this.palette.text.css;
    return this.paint(`chip-arrow-${css}`, [-10, -12, 10, 12], 1, (ctx) => {
      stroke(ctx, new Path2D(CHIP_ARROW), css, 4.5);
    });
  }

  /** Dấu ✓ (28 px) ở góc nút. */
  private tickArt(): Art {
    const { sticker, primary } = this.palette;
    return this.paint(`tick-${sticker.css}-${primary.css}`, [-32, -32, 32, 34], 28 / 64, (ctx) => {
      fill(ctx, circle(0, 5, 26), sticker.css);
      const badge = circle(0, 0, 26);
      fill(ctx, badge, primary.css);
      stroke(ctx, badge, sticker.css, 4);
      stroke(ctx, new Path2D(TICK), sticker.css, 6);
    });
  }

  /** Dấu ✗ (28 px) ở góc nút. */
  private crossArt(): Art {
    const css = this.palette.destructive.css;
    return this.paint(`cross-${css}`, [-40, -40, 40, 40], 28 / 80, (ctx) => {
      const shape = new Path2D(CROSS);
      stroke(ctx, shape, HALO, 20);
      stroke(ctx, shape, css, 10);
    });
  }

  /** Vòng nhắc vuốt: đĩa nét đứt, 4 chevron vàng, bàn tay. */
  private hintArt(): Art {
    const { card, text, sticker, primary } = this.palette;
    return this.paint(`hint-${this.palette.id}`, [-156, -156, 156, 156], 1, (ctx) => {
      const disc = circle(0, 0, 150);
      fill(ctx, disc, card.css, 0.92);
      ctx.save();
      ctx.setLineDash([12, 10]);
      stroke(ctx, disc, text.css, 4);
      ctx.restore();
      const chevron = new Path2D(HINT_CHEVRON);
      for (let k = 0; k < 4; k++) {
        ctx.save();
        ctx.rotate(k * QUARTER);
        ctx.translate(0, -112);
        stroke(ctx, chevron, sticker.css, 15);
        stroke(ctx, chevron, primary.css, 8);
        ctx.restore();
      }
      ctx.save();
      ctx.translate(4, 6);
      ctx.scale(1.1 * 3.2, 1.1 * 3.2);
      ctx.translate(-11, -3.5);
      const hand = new Path2D(HAND);
      fill(ctx, hand, HAND_FILL);
      stroke(ctx, hand, sticker.css, 1.7);
      ctx.restore();
    });
  }

  /** Mặt bảng (px khung): màu `--board`, tối dần ở mép, vết lau và vết phấn cũ rất nhạt. */
  private slateArt(): Art {
    const { board, dark } = this.palette;
    const box = [SLATE.x, SLATE.y, SLATE.x + SLATE.w, SLATE.y + SLATE.h] as const;
    return this.paint(
      `slate-${board.css}`,
      box,
      1,
      (ctx) => {
        ctx.fillStyle = board.css;
        ctx.fillRect(SLATE.x, SLATE.y, SLATE.w, SLATE.h);
        const cx = SLATE.x + SLATE.w / 2;
        const cy = SLATE.y + SLATE.h / 2;
        for (const [px, py, r, alpha] of [
          [0.18, 0.28, 0.38, 0.07],
          [0.78, 0.7, 0.42, 0.06],
        ] as const) {
          const hx = SLATE.x + SLATE.w * px;
          const hy = SLATE.y + SLATE.h * py;
          const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, SLATE.w * r);
          g.addColorStop(0, rgba("#ffffff", alpha));
          g.addColorStop(1, rgba("#ffffff", 0));
          ctx.fillStyle = g;
          ctx.fillRect(SLATE.x, SLATE.y, SLATE.w, SLATE.h);
        }
        const vignette = ctx.createRadialGradient(cx, cy, SLATE.w * 0.3, cx, cy, SLATE.h * 0.72);
        vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
        vignette.addColorStop(1, "rgba(0, 0, 0, 0.32)");
        ctx.fillStyle = vignette;
        ctx.fillRect(SLATE.x, SLATE.y, SLATE.w, SLATE.h);
        for (const wipe of BOARD_WIPES) {
          softStroke(ctx, new Path2D(wipe.d), "#ffffff", dark ? 0.05 : 0.07, wipe.width, 24);
        }
        // Vết phấn cũ có hạt: vẽ ra canvas riêng rồi mới chép lên (hạt không đục thủng mặt bảng).
        const scratch = document.createElement("canvas");
        scratch.width = ctx.canvas.width;
        scratch.height = ctx.canvas.height;
        const sctx = scratch.getContext("2d");
        if (sctx) {
          sctx.setTransform(ctx.getTransform());
          sctx.lineCap = "round";
          sctx.lineJoin = "round";
          stroke(sctx, new Path2D(BOARD_SCRIBBLES), "#ffffff", 5, dark ? 0.07 : 0.1);
          grainDeep(sctx, 0.3, 5);
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(scratch, 0, 0);
          ctx.restore();
        }
      },
      1,
    );
  }

  /** Khung gỗ quanh bảng (px khung), có lỗ đúng ô bảng và viền trong xanh dương Phân tích. */
  private frameArt(): Art {
    const { wood, sticker, analyze } = this.palette;
    const box = [WOOD.x - 4, WOOD.y - 4, WOOD.x + WOOD.w + 4, WOOD.y + WOOD.h + 12] as const;
    return this.paint(
      `frame-${wood.css}-${sticker.css}-${analyze.css}`,
      box,
      1,
      (ctx) => {
        const outer = roundRect(WOOD.x, WOOD.y, WOOD.w, WOOD.h, WOOD.r);
        fill(ctx, roundRect(WOOD.x, WOOD.y + 7, WOOD.w, WOOD.h, WOOD.r), sticker.css);
        fill(ctx, outer, wood.css);
        // Vân gỗ như nền app: sọc dọc tối mỗi 11 px, sọc ngang sáng mỗi 7 px.
        ctx.save();
        ctx.clip(outer);
        ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
        for (let x = WOOD.x; x < WOOD.x + WOOD.w; x += 11) ctx.fillRect(x, WOOD.y, 2, WOOD.h);
        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        for (let y = WOOD.y; y < WOOD.y + WOOD.h; y += 7) ctx.fillRect(WOOD.x, y, WOOD.w, 1);
        ctx.restore();
        stroke(ctx, outer, sticker.css, 5);
        stroke(ctx, new Path2D(WOOD_SEAMS), "#000000", 3, 0.14);
        // Đục lỗ ô bảng: camera mặt bảng vẽ bên dưới lộ ra qua đây, góc bo che góc vuông của viewport.
        const hole = roundRect(SLATE.x, SLATE.y, SLATE.w, SLATE.h, SLATE.r);
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        fill(ctx, hole, "#000000");
        ctx.restore();
        stroke(ctx, hole, analyze.css, 6);
      },
      1,
    );
  }
}
