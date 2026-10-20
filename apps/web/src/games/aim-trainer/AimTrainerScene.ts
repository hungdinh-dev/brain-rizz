import {
  AIM_FIELD,
  AIM_TRAINER_MISS,
  type AimPoint,
  type AimTrainerPuzzle,
  aimTrainer,
  aimTrainerHitTest,
  WRONG_ANSWER_LOCK_MS,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import { currentLanguage } from "@/i18n";
import type { ConnectionEvent, MinigameBridge, SceneResync } from "../types";
import { sceneText } from "./locales";
import { HitTally, ignoredByServer, planResync } from "./sync";

/*
 * Luyện ngắm — đặc tả: docs/04-minigames/aim-trainer.md (mục "Ghi chú cho FE").
 * Bản mẫu: canvas Brain Rizz, trang Minigame, hàng M16 (AimTrainerMobile, AimTrainerStates).
 * Một câu = một tấm bia. Trúng thì gửi toạ độ và bia mới hiện ngay cùng khung hình; bia hết
 * `lifeMs` thì gửi `AIM_TRAINER_MISS`. Server chấm lại (kể cả hạn trả lời), scene chỉ hiển thị:
 * cú trúng bị server chấm muộn thì scene quay về câu đó, hiện như bỏ lỡ và khoá (`watchHit`).
 * Mất kết nối thì dừng đồng hồ bia, không gửi gì; nối lại thì hiện đúng câu server đang chờ
 * (`bridge.watchConnection`, server cũng tính lại hạn trả lời lúc nối lại — AnswerJudge.resume).
 */

// ---------------------------------------------------------------- bố cục (khung 720×1280)

/** Khung chơi theo px thiết kế: 1 000 × 1 400 đơn vị ↔ 648 × 907 px. */
const FIELD = { x: 36, y: 250, w: 648, h: 907, radius: 30, border: 5, shadow: 7 } as const;
/** px thiết kế trên một đơn vị khung (0,648). */
const S = FIELD.w / AIM_FIELD.width;
/** Viền trong cam Nhận diện và vùng chấm bi của khung. */
const FIELD_INNER = { inset: 11, radius: 21, width: 8 } as const;
const FIELD_DOTS = { inset: 19, radius: 18, step: 54, r: 3 } as const;

/** Hai chip trên khung: số bia trúng (trái) và ms trung bình (phải). */
const CHIP = { y: 150, w: 264, h: 74, border: 5, shadow: 6 } as const;
const CHIP_XS = { hits: 36, avg: 420 } as const;
/** Chữ trong chip: số Baloo 44, nhãn Be Vietnam 26, cách số 8 px. */
const CHIP_TEXT_X = { hits: 122, avg: 500 } as const;
const CHIP_TEXT_Y = 189;
const CHIP_NUM_FONT = 44;
const CHIP_LABEL_FONT = 26;

/** Thanh khoá khi sai hoặc bỏ lỡ. */
const BAR = { x: 150, y: 1206, w: 420, h: 14 } as const;

const FONT_DISPLAY = '"Baloo 2", "Be Vietnam Pro", sans-serif';
const FONT_BODY = '"Be Vietnam Pro", sans-serif';
const FONT_TIMEOUT_MS = 1500;

// ---------------------------------------------------------------- kích thước bia (đơn vị khung)

/** Nét mực của bia và mồi; vòng trong. Bóng mực lệch xuống 7,7. */
const INK_W = 6.9;
const INNER_W = 5.4;
const DROP = 7.7;
/** Vòng mờ nét đứt cỡ `r` (vùng chấm khi bia co). */
const GHOST = { width: 5.4, dash: [14, 12] as [number, number], alpha: 0.45 };
/** Cung giờ (Thường) quanh bia: bán kính r + 20, vàng 10,8 trên mực 20. */
const ARC = { gap: 20, width: 10.8, ink: 20 } as const;
/** Vòng vàng khoanh bia thật khi sai: r + 22; bỏ lỡ thì nét đứt. */
const MARK = { gap: 22, width: 10.8, ink: 20, dash: [21, 14] as [number, number] };
/** Viền răng cưa của mồi: 16 khía, nằm trong bán kính r. */
const SAW = { points: 16, inner: 0.84 } as const;
/** Viền phấn quanh mồi ở nền tối. */
const HALO_W = 15;
/** Sao bung khi trúng: R = 1,45 r. */
const BURST = { scale: 1.45, points: 16, inner: 0.55, width: 6.2 } as const;
/** Huy hiệu ✓, đồng hồ, ✗ và nhãn ms (bản mẫu phóng 1,54 / 1,3 lần). */
const BADGE_SCALE = 1.54;
const CROSS_SCALE = 1.3;
/** Nhãn ms: viên thuốc 128 × 50 (×1,54), chữ Baloo 30; đặt trên bia r × 1,45 + 52, bay lên 30. */
const PILL = { w: 128, h: 50, drop: 5, border: 4, font: 30, gap: 52, rise: 30 } as const;
/** Chấm phấn khi chạm hụt (đơn vị khung). */
const TAP = { ring: 31, dot: 12, width: 4.6, dash: [9, 9] as [number, number] };

// ---------------------------------------------------------------- nhịp hiệu ứng

/** Bia hiện: bật từ 80 % lên 100 % trong 80 ms. */
const POP_MS = 80;
const POP_FROM = 0.8;
/** Mầm: bia đứng quá 3 s thì nhịp nhẹ ±4 %. */
const NUDGE_AFTER_MS = 3000;
const NUDGE_AMP = 0.04;
const NUDGE_PERIOD = 160;
/** Sao bung 200 ms; nhãn ms bay lên và tan trong 600 ms. */
const BURST_MS = 200;
const LABEL_MS = 600;
/** Chấm phấn hụt tan trong 200 ms. */
const TAP_MS = 200;
/** Mồi bị bắn rung ±9 đơn vị trong 200 ms. */
const SHAKE_MS = 200;
const SHAKE_UNITS = 9;
/** Vòng khoanh bia thật nhấp nháy 1 ↔ 0,6 mỗi 250 ms suốt lúc khoá. */
const BLINK_MS = 250;
const BLINK_ALPHA = 0.6;

/** Lúc khoá: bia bỏ lỡ mờ 50 %, mồi không bị bắn mờ 35 %. */
const MISSED_ALPHA = 0.5;
const DIM_ALPHA = 0.35;

// ---------------------------------------------------------------- icon (tâm 0,0)

const CHECK = "M-12 1 L-3 10 L13 -9";
const CLOCK_HANDS = "M0 -17 L0 0 L12 8";
const STOPWATCH = "M0 -16 L0 -24 M-7 -26 L7 -26 M0 3 L0 -7 M0 3 L8 8";

// ---------------------------------------------------------------- màu

/**
 * Đĩa bia mồi: đỏ sẫm `--destructive` của giao diện sáng, dùng cho cả nền tối như bản mẫu (token
 * tối #f07a90 sáng quá, không "tối hơn bia thật rõ rệt"). Màu riêng của game này.
 */
const DECOY_FILL = "#c93a55";
/** Viền phấn quanh mồi ở nền tối (bản mẫu AimTrainerMobile, nền tối) để mồi không chìm. */
const HALO_DARK = "#c9c6dc";
/** Lót trắng dưới dấu ✗ của mồi bị bắn. */
const CROSS_UNDER = "#ffffff";

/** Màu đọc từ token CSS lúc tạo scene (tự đổi theo sáng/tối). Chuỗi CSS để vẽ texture canvas. */
interface Palette {
  dark: boolean;
  /** Mực: viền, bóng đổ (`--border`). */
  ink: string;
  /** Giấy của khung và chip (`--card`). */
  panel: string;
  /** Chữ và nét trên giấy (`--card-foreground`). */
  text: string;
  sub: string;
  /** Mặt bia và dấu X của mồi: giấy kem ở cả hai chủ đề. */
  paper: string;
  primary: string;
  identify: string;
  halo: string | null;
  /** Chấm bi nền khung và rãnh cung giờ (màu chữ, độ mờ theo chủ đề). */
  dotsAlpha: number;
  trackAlpha: number;
}

function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const dark = style.colorScheme === "dark";
  return {
    dark,
    ink: token("--border"),
    panel: token("--card"),
    text: token("--card-foreground"),
    sub: token("--muted-foreground"),
    paper: token("--color-paper"),
    primary: token("--primary"),
    identify: token("--color-identify"),
    halo: dark ? HALO_DARK : null,
    dotsAlpha: dark ? 0.14 : 0.13,
    trackAlpha: dark ? 0.2 : 0.16,
  };
}

/** Màu CSS → số màu của Phaser. */
const toColor = (css: string) => Phaser.Display.Color.ValueToColor(css).color;

/** Toạ độ khung → px thiết kế. */
const toPx = (p: AimPoint) => ({ x: FIELD.x + p.x * S, y: FIELD.y + p.y * S });

/** px thiết kế → toạ độ khung (số nguyên, kẹp vào khung), như mục "Đổi toạ độ" của đặc tả. */
function toUnits(px: number, py: number): AimPoint {
  const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v));
  return {
    x: clamp(Math.round((px - FIELD.x) / S), AIM_FIELD.width),
    y: clamp(Math.round((py - FIELD.y) / S), AIM_FIELD.height),
  };
}

/**
 * Đồng hồ đo đời bia (ms). Không dùng `this.time.now`: lúc scene tạo cùng game, nó còn là 0 rồi mới
 * nhảy sang giờ của vòng lặp; `delayedCall` thì cộng delta đã bị làm mượt và chặn trần nên trễ dần
 * khi rớt khung hình. Đồng hồ thật giữ `lifeMs` khớp hạn trả lời của server.
 */
const clock = () => performance.now();

/** Chỉ số mồi gần điểm chạm nhất (mồi vừa bị bắn); -1 nếu không có mồi. */
function nearest(points: readonly AimPoint[], at: AimPoint): number {
  let best = -1;
  let bestD = Number.POSITIVE_INFINITY;
  points.forEach((p, i) => {
    const d = (p.x - at.x) ** 2 + (p.y - at.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** Chờ Baloo 2 tải xong rồi vẽ lại chữ chip (chữ canvas không tự vẽ lại khi font về muộn). */
function waitForFont(): Promise<void> {
  const fonts = document.fonts;
  if (!fonts) return Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, FONT_TIMEOUT_MS);
  });
  const load = Promise.all([
    fonts.load(`800 ${CHIP_NUM_FONT}px "Baloo 2"`, "0123456789—"),
    fonts.load(`600 ${CHIP_LABEL_FONT}px "Be Vietnam Pro"`, "trúngms TB"),
  ]).then(
    () => {},
    () => {},
  );
  return Promise.race([load, timeout]).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------- vẽ canvas 2D

type Ctx = CanvasRenderingContext2D;

function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
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

/** Ngôi sao / răng cưa `n` đỉnh quanh tâm: đỉnh ở bán kính `outer`, chân ở `outer × inner`. */
function starPath(ctx: Ctx, outer: number, n: number, inner: number, dy = 0) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const r = i % 2 === 0 ? outer : outer * inner;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r + dy;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Nét đứt chia đều quanh vòng tròn để chỗ nối không lệch. */
function evenCircleDash(r: number, [dash, gap]: [number, number]): number[] {
  const length = 2 * Math.PI * r;
  const k = length / Math.max(1, Math.round(length / (dash + gap))) / (dash + gap);
  return [dash * k, gap * k];
}

/** Dấu X nửa cạnh `a`, nét tròn đầu. */
function crossStroke(ctx: Ctx, a: number, width: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(-a, -a);
  ctx.lineTo(a, a);
  ctx.moveTo(a, -a);
  ctx.lineTo(-a, a);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

// ---------------------------------------------------------------- scene

type Phase = "play" | "locked";

/** Bia (thật hoặc mồi) đang hiện. Container đặt ở tâm bia (px thiết kế). */
interface TargetView {
  root: Phaser.GameObjects.Container;
  /** Đĩa bia: co theo đồng hồ, bật lúc hiện, rung khi bị bắn (mồi). */
  body: Phaser.GameObjects.Image;
  ghost?: Phaser.GameObjects.Image;
}

/** Luyện ngắm — chạm trúng bia hồng tâm càng nhanh càng tốt, né bia mồi đỏ. */
export default class AimTrainerScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private phase: Phase = "play";
  private colors!: Palette;
  private reducedMotion = false;
  private puzzle?: AimTrainerPuzzle;
  /** Lúc bia câu hiện tại hiện (`clock()`); `lifeMs` đếm từ đây. */
  private shownAt = 0;
  private lockedAt = 0;
  /** Câu đang hiện khoá (khi `phase` = "locked"). */
  private lockIndex = -1;
  /** Mất kết nối: đồng hồ bia dừng, không nhận chạm, không gửi "bỏ lỡ". */
  private paused = false;
  private offConnection?: () => void;
  private target?: TargetView;
  private decoys: TargetView[] = [];
  /** Cung giờ quanh bia (Thường), vẽ lại mỗi khung hình. */
  private arc?: Phaser.GameObjects.Graphics;
  /** Vòng khoanh bia thật lúc khoá (nhấp nháy). */
  private mark?: Phaser.GameObjects.Image;
  /** Mồi vừa bị bắn: rung trong `SHAKE_MS`. */
  private shot?: TargetView;
  private bar?: Phaser.GameObjects.Graphics;
  private barState = { width: 0 };
  /** Bia trúng server đã chấm đúng trong vòng và ms của từng bia (chỉ để hiển thị chip). */
  private tally = new HitTally();
  private chipTexts?: {
    hits: Phaser.GameObjects.Text;
    hitsLabel: Phaser.GameObjects.Text;
    avg: Phaser.GameObjects.Text;
    avgLabel: Phaser.GameObjects.Text;
  };
  /** Hẹn giờ của câu hiện tại (hết khoá); huỷ khi sang câu mới hoặc rời màn. */
  private timers: Phaser.Time.TimerEvent[] = [];
  /**
   * Tăng mỗi khi scene đồng bộ lại câu đang làm theo server (cú trúng bị chấm muộn) hoặc chạy lại:
   * kết quả và hẹn hết khoá của các câu gửi trước đó thôi tác dụng.
   */
  private epoch = 0;

  init(data: { bridge: MinigameBridge }) {
    this.epoch += 1;
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.phase = "play";
    this.puzzle = undefined;
    this.target = undefined;
    this.decoys = [];
    this.shot = undefined;
    this.tally = new HitTally();
    this.lockIndex = -1;
    this.paused = false;
    this.timers = [];
  }

  create() {
    const canvas = this.game.canvas;
    this.colors = readPalette(canvas.isConnected ? canvas : document.documentElement);
    this.reducedMotion = prefersReducedMotion();

    const stopWatching = () => {
      this.offConnection?.();
      this.offConnection = undefined;
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      stopWatching();
      this.clearTimers();
      this.tweens.killAll();
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      stopWatching();
      this.clearTimers();
    });

    // Khung chơi, hai chip và vùng chạm giữ nguyên suốt vòng.
    this.add.image(FIELD.x + FIELD.w / 2, FIELD.y + FIELD.h / 2, this.fieldTexture());
    this.drawChips();
    const zone = this.add
      .zone(FIELD.x, FIELD.y, FIELD.w, FIELD.h)
      .setOrigin(0)
      .setInteractive({ cursor: "crosshair" });
    zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.onPointerDown(pointer));

    this.bar = this.add.graphics().setVisible(false).setDepth(5);
    this.showPuzzle();
    // Đăng ký sau khi có bia: đang mất kết nối thì báo `paused` ngay trong lúc gọi.
    this.offConnection = this.bridge.watchConnection?.((event) => this.onConnection(event));
    void waitForFont().then(() => {
      if (this.sys.isActive()) this.updateChips();
    });
  }

  // -------------------------------------------------------------- dựng câu đố

  private showPuzzle() {
    this.clearTimers();
    this.clearTargets();
    this.bar?.setVisible(false);
    this.phase = "play";

    const puzzle = aimTrainer.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    this.puzzle = puzzle;
    // Mồi nằm dưới bia thật (vùng chấm không giao nhau nên chỉ là thứ tự vẽ).
    this.decoys = puzzle.decoys.map((p) => this.makeView(p, puzzle, "decoy"));
    this.target = this.makeView(puzzle, puzzle, "target");
    if (puzzle.lifeMs > 0 && puzzle.shrinkTo >= 100) {
      // Cung giờ nằm dưới đĩa bia (bán kính r + 20 nên lộ ra ngoài).
      this.arc = this.add.graphics();
      this.target.root.addAt(this.arc, 0);
    }
    this.shownAt = clock();
    this.layoutFrame(0);
  }

  private makeView(p: AimPoint, puzzle: AimTrainerPuzzle, kind: "target" | "decoy"): TargetView {
    const { x, y } = toPx(p);
    const root = this.add.container(x, y).setDepth(kind === "target" ? 2 : 1);
    let ghost: Phaser.GameObjects.Image | undefined;
    // Khó/Siêu khó: vòng mờ cỡ `r` giữ nguyên trong lúc đĩa co (vùng chấm không đổi).
    if (puzzle.shrinkTo < 100) {
      ghost = this.add.image(0, 0, this.ghostTexture(puzzle.r));
      root.add(ghost);
    }
    const body = this.add.image(
      0,
      0,
      kind === "target" ? this.targetTexture(puzzle.r) : this.decoyTexture(puzzle.r),
    );
    root.add(body);
    return { root, body, ghost };
  }

  private clearTargets() {
    for (const view of [this.target, ...this.decoys]) {
      if (!view) continue;
      this.tweens.killTweensOf(view.body);
      view.root.destroy();
    }
    this.target = undefined;
    this.decoys = [];
    this.arc = undefined;
    this.mark = undefined;
    this.shot = undefined;
  }

  // -------------------------------------------------------------- đồng hồ bằng hình

  override update() {
    const puzzle = this.puzzle;
    // Mất kết nối: bia đứng hình, không tự gửi "bỏ lỡ" (nối lại thì hiện lại câu theo server).
    if (!puzzle || this.paused) return;
    const now = clock();
    if (this.phase !== "play") {
      this.lockFrame(now - this.lockedAt);
      return;
    }
    const elapsed = now - this.shownAt;
    // Bỏ lỡ: hết `lifeMs` kể từ lúc bia hiện (trễ tối đa một khung hình). Server tự chấm sai đáp
    // án tới muộn hơn `lifeMs` + 400 ms nên không cần chặn thêm.
    if (puzzle.lifeMs > 0 && elapsed >= puzzle.lifeMs) {
      this.miss();
      return;
    }
    this.layoutFrame(elapsed);
  }

  /** Bia đang chờ chạm: co dần (Khó/Siêu khó), cung giờ (Thường), bật lúc hiện, nhịp ở Mầm. */
  private layoutFrame(elapsed: number) {
    const puzzle = this.puzzle;
    if (!puzzle || !this.target) return;
    const life = puzzle.lifeMs;
    const progress = life > 0 ? Math.max(0, 1 - elapsed / life) : 1;
    // Đồng hồ (co dần, cung giờ) là luật chơi: giữ cả khi giảm chuyển động.
    let scale = 1 - (1 - puzzle.shrinkTo / 100) * (1 - progress);
    if (!this.reducedMotion) {
      if (elapsed < POP_MS) scale *= POP_FROM + ((1 - POP_FROM) * Math.max(0, elapsed)) / POP_MS;
      if (life === 0 && elapsed > NUDGE_AFTER_MS) {
        scale *= 1 + NUDGE_AMP * Math.sin((elapsed - NUDGE_AFTER_MS) / NUDGE_PERIOD);
      }
    }
    this.target.body.setScale(scale);
    for (const view of this.decoys) view.body.setScale(scale);
    if (this.arc) this.drawArc(this.arc, puzzle.r, progress);
  }

  /** Cung giờ quanh bia: rãnh mờ, cung vàng viền mực rút dần theo chiều kim đồng hồ từ 12 giờ. */
  private drawArc(g: Phaser.GameObjects.Graphics, r: number, progress: number) {
    const c = this.colors;
    const radius = (r + ARC.gap) * S;
    g.clear();
    g.lineStyle(ARC.width * S, toColor(c.text), c.trackAlpha);
    g.strokeCircle(0, 0, radius);
    if (progress <= 0) return;
    const start = -Math.PI / 2;
    const end = start + Math.PI * 2 * progress;
    const ends = [start, end].map((a) => [Math.cos(a) * radius, Math.sin(a) * radius] as const);
    // Phaser không có đầu nét tròn: thêm chấm tròn ở hai đầu cung.
    const pass = (width: number, color: number) => {
      g.lineStyle(width, color);
      g.beginPath();
      g.arc(0, 0, radius, start, end, false);
      g.strokePath();
      g.fillStyle(color);
      for (const [x, y] of ends) g.fillCircle(x, y, width / 2);
    };
    pass(ARC.ink * S, toColor(c.ink));
    pass(ARC.width * S, toColor(c.primary));
  }

  /** Lúc khoá: vòng khoanh bia thật nhấp nháy, mồi bị bắn rung 200 ms. */
  private lockFrame(since: number) {
    if (this.mark && !this.reducedMotion) {
      this.mark.setAlpha(Math.floor(since / BLINK_MS) % 2 ? BLINK_ALPHA : 1);
    }
    const shot = this.shot;
    if (shot) {
      const dx = !this.reducedMotion && since < SHAKE_MS ? Math.sin(since / 18) * SHAKE_UNITS : 0;
      shot.body.x = dx * S;
    }
  }

  // -------------------------------------------------------------- chạm

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    // Chỉ con trỏ đầu tiên (chuột hoặc ngón đầu), chỉ nút trái; bỏ qua cảm ứng đa điểm.
    if (pointer.id > 1 || pointer.button !== 0) return;
    if (this.phase !== "play" || this.paused || !this.puzzle) return;
    const puzzle = this.puzzle;
    const at = toUnits(pointer.x, pointer.y);
    const hit = aimTrainerHitTest(puzzle, at.x, at.y);
    if (hit === "none") {
      // Chạm hụt: không gửi, không tính sai.
      this.showTap(at);
      return;
    }

    const index = this.index;
    this.bridge.submit(index, { x: at.x, y: at.y });
    this.index += 1;

    if (hit === "target") {
      const ms = Math.max(0, Math.round(clock() - this.shownAt));
      // Chip chỉ cộng khi server chấm đúng (`watchHit`); nhãn ms hiện ngay.
      const fx = this.showHit(puzzle, ms);
      // Bia mới hiện ngay cùng khung hình, không chờ server.
      this.showPuzzle();
      this.watchHit(index, ms, fx);
      return;
    }

    this.lock(index, "decoy", nearest(puzzle.decoys, at));
  }

  /**
   * Server vẫn có thể chấm SAI một cú trúng: tới muộn hơn hạn trả lời tính từ giờ hiện câu của
   * server (mạng chập chờn, Phaser khởi động chậm, nối lại giữa vòng). Khi đó server đã khoá và bỏ
   * qua mọi đáp án gửi sau, nên scene phải quay về câu đó: hiện như bỏ lỡ, khoá theo `lockedUntil`,
   * rồi làm tiếp từ câu kế như server — không thì `index` vượt `progress` của server tới hết vòng.
   * Server bỏ qua hẳn câu đó (`null`, vd. còn khoá lúc vừa nối lại) mà `progress` vẫn chưa qua câu
   * đó thì cũng đồng bộ lại theo state server.
   */
  private watchHit(index: number, ms: number, fx: Phaser.GameObjects.Container) {
    const epoch = this.epoch;
    void this.bridge.answerOutcome(index).then((outcome) => {
      if (!this.sys.isActive()) return;
      // Kết quả theo index là của server (mỗi câu chấm một lần), đếm cả khi scene đã đồng bộ lại.
      if (outcome?.correct) {
        this.tally.confirm(index, ms);
        this.updateChips();
        return;
      }
      // Đã đồng bộ lại câu, hoặc đang mất kết nối (nối lại sẽ đồng bộ theo server): bỏ qua.
      if (epoch !== this.epoch || this.paused) return;
      if (!outcome) {
        const sync = this.bridge.serverSync?.();
        if (sync && ignoredByServer(index, sync.progress)) this.resync(sync);
        return;
      }
      this.epoch += 1;
      if (fx.active) {
        this.tweens.killTweensOf([fx, ...fx.list]);
        fx.destroy();
      }
      this.index = index;
      this.showPuzzle();
      this.index = index + 1;
      this.lock(index, "miss", -1, outcome.unlockMs);
    });
  }

  /** Hết `lifeMs` mà chưa trúng: gửi "bỏ lỡ" (luôn sai). */
  private miss() {
    if (this.phase !== "play" || this.paused) return;
    const index = this.index;
    this.bridge.submit(index, { x: AIM_TRAINER_MISS.x, y: AIM_TRAINER_MISS.y });
    this.index += 1;
    this.lock(index, "miss", -1);
  }

  /**
   * Sai (bắn mồi hoặc bỏ lỡ): hiện đáp án đúng suốt lúc khoá. Bia thật đủ cỡ `r` trong vòng vàng
   * dày nhấp nháy (bỏ lỡ: bia mờ 50 %, vòng nét đứt, đồng hồ); mồi bị bắn có ✗ đỏ viền trắng và
   * rung; mồi còn lại mờ 35 %. Bia luôn nằm trong khung (y ≥ 250), không bị huy hiệu khoá che.
   * `unlockMs` đã biết (kết quả server đã về) thì dùng luôn, không chờ `unlockDelay`.
   */
  private lock(index: number, reason: "decoy" | "miss", shotIndex: number, unlockMs?: number) {
    const puzzle = this.puzzle;
    const target = this.target;
    if (!puzzle || !target) return;
    this.phase = "locked";
    this.lockIndex = index;
    this.lockedAt = clock();
    this.clearTimers();

    // Đồng hồ dừng: bia và mồi về đủ cỡ, bỏ cung giờ và vòng mờ.
    this.arc?.destroy();
    this.arc = undefined;
    for (const view of [target, ...this.decoys]) {
      view.body.setScale(1);
      view.ghost?.setVisible(false);
    }

    const missed = reason === "miss";
    if (missed) target.body.setAlpha(MISSED_ALPHA);
    this.mark = this.add.image(0, 0, this.markTexture(puzzle.r, missed));
    target.root.add(this.mark);
    if (missed) {
      const c = puzzle.r * 0.8 + 22;
      target.root.add(this.add.image(c * S, -c * S, this.clockTexture()));
    }

    this.decoys.forEach((view, i) => {
      if (i !== shotIndex) {
        view.root.setAlpha(DIM_ALPHA);
        return;
      }
      const c = puzzle.r * 0.75;
      view.root.add(this.add.image(c * S, -c * S, this.crossTexture()));
      this.shot = view;
    });

    // Thanh khoá chạy ngay theo thời gian khoá chuẩn, rồi chỉnh theo `lockedUntil` khi server trả lời.
    this.barState.width = BAR.w;
    this.bar?.setVisible(true);
    if (unlockMs !== undefined) {
      this.armUnlock(unlockMs);
      return;
    }
    this.runBar(WRONG_ANSWER_LOCK_MS);
    // Hết khoá theo `lockedUntil` của server (không tự đếm) để khớp huy hiệu khoá của khung.
    const epoch = this.epoch;
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ; đã đồng bộ lại câu thì bỏ qua.
      if (!this.sys.isActive() || epoch !== this.epoch || this.index !== index + 1) return;
      this.armUnlock(ms);
    });
  }

  /** Thanh khoá rút về 0 trong `ms` rồi hiện bia câu kế. */
  private armUnlock(ms: number) {
    this.clearTimers();
    this.runBar(ms);
    this.after(ms, () => this.showPuzzle());
  }

  // -------------------------------------------------------------- kết nối

  private onConnection(event: ConnectionEvent) {
    if (event.type === "paused") {
      this.paused = true;
      return;
    }
    if (!this.paused) return;
    this.paused = false;
    this.resync(event.sync);
  }

  /**
   * Hiện lại đúng câu server đang chờ (sau khi nối lại, hoặc khi server bỏ qua một câu đã gửi):
   * bia mới với đồng hồ bia đếm lại từ đầu, như server tính lại hạn lúc nối lại; server còn khoá
   * sau câu trước bị chấm sai thì hiện câu đó như bỏ lỡ tới hết khoá. Kết quả và hẹn hết khoá của
   * các câu gửi trước đó thôi tác dụng (`epoch`).
   */
  private resync(sync: SceneResync | undefined) {
    const plan = planResync(sync, {
      index: this.index,
      lockedIndex: this.phase === "locked" ? this.lockIndex : null,
    });
    this.epoch += 1;
    this.clearTimers();
    if (plan.kind === "rearm") {
      this.index = plan.index;
      // Thanh có thể đã rút hết trong lúc mất kết nối: đặt lại theo phần khoá còn lại.
      this.barState.width = BAR.w * Math.min(1, plan.unlockMs / WRONG_ANSWER_LOCK_MS);
      this.armUnlock(plan.unlockMs);
      return;
    }
    if (plan.kind === "lock") {
      this.index = plan.index - 1;
      this.showPuzzle();
      this.index = plan.index;
      this.lock(plan.index - 1, "miss", -1, plan.unlockMs);
      return;
    }
    this.index = plan.index;
    this.showPuzzle();
  }

  // -------------------------------------------------------------- phản hồi

  /** Trúng: sao vàng bung 200 ms, ✓ và nhãn ms bay lên rồi tan trong 600 ms tại chỗ bia cũ. */
  private showHit(puzzle: AimTrainerPuzzle, ms: number): Phaser.GameObjects.Container {
    const { x, y } = toPx(puzzle);
    const fx = this.add.container(x, y).setDepth(3);
    const badge = this.add.image(0, 0, this.okTexture());

    // Nhãn đặt trên bia; bia sát mép trên thì đặt dưới để nhãn không ra khỏi khung.
    const offset = (puzzle.r * BURST.scale + PILL.gap) * S;
    const halfPill = (PILL.h * BADGE_SCALE * S) / 2;
    const above = y - offset - halfPill - PILL.rise * S >= FIELD.y;
    const labelY = above ? -offset : offset;
    const label = this.add.container(0, labelY, [
      this.add.image(0, 0, this.pillTexture()),
      this.add
        .text(0, (-PILL.drop / 2) * BADGE_SCALE * S, `${ms} ${sceneText[currentLanguage()].ms}`, {
          fontFamily: FONT_DISPLAY,
          fontStyle: "800",
          fontSize: `${Math.round(PILL.font * BADGE_SCALE * S)}px`,
          color: this.colors.text,
        })
        .setOrigin(0.5),
    ]);

    if (this.reducedMotion) {
      fx.add([badge, label]);
      this.time.delayedCall(LABEL_MS, () => fx.destroy());
      return fx;
    }

    const burst = this.add.image(0, 0, this.burstTexture(puzzle.r)).setScale(0.7);
    fx.add([burst, badge, label]);
    this.tweens.add({
      targets: burst,
      scale: 1.05,
      alpha: 0,
      duration: BURST_MS,
      ease: "Quad.easeOut",
    });
    this.tweens.add({
      targets: label,
      y: labelY - PILL.rise * S,
      duration: LABEL_MS,
      ease: "Sine.easeOut",
    });
    this.tweens.add({
      targets: [label, badge],
      alpha: 0,
      duration: LABEL_MS,
      ease: "Quad.easeIn",
      onComplete: () => fx.destroy(),
    });
    return fx;
  }

  /** Chạm hụt: chấm phấn nhỏ tan trong 200 ms. */
  private showTap(at: AimPoint) {
    const { x, y } = toPx(at);
    const dot = this.add.image(x, y, this.tapTexture()).setDepth(4);
    if (this.reducedMotion) {
      this.time.delayedCall(TAP_MS, () => dot.destroy());
      return;
    }
    this.tweens.add({ targets: dot, alpha: 0, duration: TAP_MS, onComplete: () => dot.destroy() });
  }

  private after(ms: number, callback: () => void) {
    this.timers.push(this.time.delayedCall(ms, callback));
  }

  private clearTimers() {
    for (const timer of this.timers) timer.remove(false);
    this.timers = [];
  }

  // -------------------------------------------------------------- chip

  private drawChips() {
    const c = this.colors;
    const text = sceneText[currentLanguage()];
    const num = (x: number) =>
      this.add
        .text(x, CHIP_TEXT_Y, "", {
          fontFamily: FONT_DISPLAY,
          fontStyle: "800",
          fontSize: `${CHIP_NUM_FONT}px`,
          color: c.text,
        })
        .setOrigin(0, 0.5);
    const label = (value: string) =>
      this.add
        .text(0, CHIP_TEXT_Y + 3, value, {
          fontFamily: FONT_BODY,
          fontStyle: "600",
          fontSize: `${CHIP_LABEL_FONT}px`,
          color: c.sub,
        })
        .setOrigin(0, 0.5);

    this.add.image(CHIP_XS.hits + CHIP.w / 2, CHIP.y + CHIP.h / 2, this.chipTexture("hits"));
    this.add.image(CHIP_XS.avg + CHIP.w / 2, CHIP.y + CHIP.h / 2, this.chipTexture("avg"));
    this.chipTexts = {
      hits: num(CHIP_TEXT_X.hits),
      hitsLabel: label(text.hits),
      avg: num(CHIP_TEXT_X.avg),
      avgLabel: label(text.avg),
    };
    this.updateChips();
  }

  /** "23 trúng" và "612 ms TB"; chưa trúng bia nào thì ms TB là "—". */
  private updateChips() {
    const chip = this.chipTexts;
    if (!chip) return;
    const avg = this.tally.avgMs;
    chip.hits.setText(String(this.tally.hits));
    chip.avg.setText(avg === undefined ? "—" : String(avg));
    // Font về muộn thì setText cùng chữ không vẽ lại: vẽ lại hết rồi đặt nhãn theo bề rộng mới.
    for (const text of Object.values(chip)) text.updateText();
    chip.hitsLabel.x = chip.hits.x + chip.hits.width + 8;
    chip.avgLabel.x = chip.avg.x + chip.avg.width + 8;
  }

  // -------------------------------------------------------------- thanh khoá

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
    g.fillStyle(toColor(c.panel));
    g.fillRoundedRect(x, y, w, h, r);
    g.lineStyle(3, toColor(c.text));
    g.strokeRoundedRect(x, y, w, h, r);
    if (fill <= 0) return;
    g.fillStyle(toColor(c.text));
    g.fillRoundedRect(x, y, fill, h, Math.min(r, fill / 2));
  }

  // -------------------------------------------------------------- texture (vẽ một lần mỗi vòng)

  /** Tạo texture từ canvas 2D (gốc toạ độ ở tâm, đơn vị px thiết kế) nếu chưa có; trả về khoá. */
  private texture(name: string, width: number, height: number, draw: (ctx: Ctx) => void) {
    const key = `aim-trainer:${this.colors.dark ? "dark" : "light"}:${name}`;
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

  /** Texture vẽ theo đơn vị khung (bán kính bao `half` đơn vị), phóng về px thiết kế. */
  private unitTexture(name: string, half: number, draw: (ctx: Ctx) => void) {
    const size = 2 * half * S + 4;
    return this.texture(name, size, size, (ctx) => {
      ctx.scale(S, S);
      draw(ctx);
    });
  }

  /** Khung chơi: bóng mực, giấy viền mực, chấm bi, viền trong cam Nhận diện. */
  private fieldTexture() {
    const c = this.colors;
    const pad = 6;
    const { w, h, radius, border, shadow } = FIELD;
    return this.texture("field", w + 2 * pad, h + shadow + 2 * pad, (ctx) => {
      const x = -w / 2;
      const y = -(h + shadow) / 2;
      roundRectPath(ctx, x, y + shadow, w, h, radius);
      ctx.fillStyle = c.ink;
      ctx.fill();
      roundRectPath(ctx, x, y, w, h, radius);
      ctx.fillStyle = c.panel;
      ctx.fill();
      ctx.lineWidth = border;
      ctx.strokeStyle = c.ink;
      ctx.stroke();

      // Chấm bi theo lưới 54 px của khung 720×1280 (như pattern của bản mẫu).
      const d = FIELD_DOTS;
      ctx.save();
      roundRectPath(ctx, x + d.inset, y + d.inset, w - 2 * d.inset, h - 2 * d.inset, d.radius);
      ctx.clip();
      ctx.fillStyle = c.text;
      ctx.globalAlpha = c.dotsAlpha;
      const left = FIELD.x + d.inset;
      const top = FIELD.y + d.inset;
      const first = (v: number) => Math.ceil((v - d.step / 2) / d.step) * d.step + d.step / 2;
      for (let py = first(top); py < FIELD.y + h - d.inset + d.r; py += d.step) {
        for (let px = first(left); px < FIELD.x + w - d.inset + d.r; px += d.step) {
          circlePath(ctx, px - FIELD.x + x, py - FIELD.y + y, d.r);
          ctx.fill();
        }
      }
      ctx.restore();

      const i = FIELD_INNER.inset;
      roundRectPath(ctx, x + i, y + i, w - 2 * i, h - 2 * i, FIELD_INNER.radius);
      ctx.lineWidth = FIELD_INNER.width;
      ctx.strokeStyle = c.identify;
      ctx.stroke();
    });
  }

  /** Chip viên thuốc có bóng mực; trái có hồng tâm nhỏ, phải có đồng hồ bấm giờ. */
  private chipTexture(kind: "hits" | "avg") {
    const c = this.colors;
    const pad = 4;
    const { w, h, border, shadow } = CHIP;
    return this.texture(`chip-${kind}`, w + 2 * pad, h + shadow + 2 * pad, (ctx) => {
      const x = -w / 2;
      const y = -(h + shadow) / 2;
      roundRectPath(ctx, x, y + shadow, w, h, h / 2);
      ctx.fillStyle = c.ink;
      ctx.fill();
      roundRectPath(ctx, x, y, w, h, h / 2);
      ctx.fillStyle = c.panel;
      ctx.fill();
      ctx.lineWidth = border;
      ctx.strokeStyle = c.ink;
      ctx.stroke();

      // Icon đặt như bản mẫu: tâm cách mép trái 48 / 46 px, giữa chip.
      ctx.save();
      if (kind === "hits") {
        ctx.translate(x + 48, y + 37);
        const rings: [number, string, number][] = [
          [22, c.paper, 3.5],
          [13.6, c.identify, 3],
          [6.2, c.primary, 3],
        ];
        for (const [r, fill, width] of rings) {
          circlePath(ctx, 0, 0, r);
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.lineWidth = width;
          ctx.strokeStyle = c.ink;
          ctx.stroke();
        }
      } else {
        ctx.translate(x + 46, y + 36);
        ctx.lineWidth = 5;
        ctx.strokeStyle = c.text;
        circlePath(ctx, 0, 3, 19);
        ctx.stroke();
        ctx.stroke(new Path2D(STOPWATCH));
      }
      ctx.restore();
    });
  }

  /** Bia hồng tâm: bóng mực, giấy kem, vòng cam Nhận diện, chấm giữa vàng; viền tròn trơn. */
  private targetTexture(r: number) {
    const c = this.colors;
    return this.unitTexture(`target-${r}`, r + DROP + INK_W, (ctx) => {
      circlePath(ctx, 0, DROP, r);
      ctx.fillStyle = c.ink;
      ctx.fill();
      const rings: [number, string, number][] = [
        [r, c.paper, INK_W],
        [r * 0.64, c.identify, INNER_W],
        [r * 0.28, c.primary, INNER_W],
      ];
      for (const [radius, fill, width] of rings) {
        circlePath(ctx, 0, 0, radius);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = width;
        ctx.strokeStyle = c.ink;
        ctx.stroke();
      }
    });
  }

  /** Bia mồi: đĩa đỏ sẫm viền răng cưa (trong bán kính r), dấu X trắng dày; nền tối viền phấn. */
  private decoyTexture(r: number) {
    const c = this.colors;
    return this.unitTexture(`decoy-${r}`, r + DROP + HALO_W, (ctx) => {
      if (c.halo) {
        starPath(ctx, r, SAW.points, SAW.inner);
        ctx.lineWidth = HALO_W;
        ctx.strokeStyle = c.halo;
        ctx.stroke();
      }
      starPath(ctx, r, SAW.points, SAW.inner, DROP);
      ctx.fillStyle = c.ink;
      ctx.fill();
      starPath(ctx, r, SAW.points, SAW.inner);
      ctx.fillStyle = DECOY_FILL;
      ctx.fill();
      ctx.lineWidth = INK_W;
      ctx.strokeStyle = c.ink;
      ctx.stroke();
      const a = r * 0.4;
      const width = r * 0.24;
      crossStroke(ctx, a, width + 9, c.ink);
      crossStroke(ctx, a, width, c.paper);
    });
  }

  /** Vòng mờ nét đứt cỡ `r` (vùng chấm giữ nguyên khi bia co). */
  private ghostTexture(r: number) {
    const c = this.colors;
    return this.unitTexture(`ghost-${r}`, r + GHOST.width, (ctx) => {
      circlePath(ctx, 0, 0, r);
      ctx.setLineDash(evenCircleDash(r, GHOST.dash));
      ctx.lineCap = "butt";
      ctx.globalAlpha = GHOST.alpha;
      ctx.lineWidth = GHOST.width;
      ctx.strokeStyle = c.text;
      ctx.stroke();
    });
  }

  /** Vòng vàng viền mực khoanh bia thật lúc khoá; bỏ lỡ thì nét đứt. */
  private markTexture(r: number, dashed: boolean) {
    const c = this.colors;
    const radius = r + MARK.gap;
    return this.unitTexture(`mark-${r}-${dashed ? "dash" : "solid"}`, radius + MARK.ink, (ctx) => {
      circlePath(ctx, 0, 0, radius);
      if (dashed) {
        ctx.setLineDash(evenCircleDash(radius, MARK.dash));
        ctx.lineCap = "butt";
      }
      ctx.lineWidth = MARK.ink;
      ctx.strokeStyle = c.ink;
      ctx.stroke();
      ctx.lineWidth = MARK.width;
      ctx.strokeStyle = c.primary;
      ctx.stroke();
    });
  }

  /** Biểu tượng đồng hồ (bỏ lỡ): mặt giấy viền mực, kim mực. */
  private clockTexture() {
    const c = this.colors;
    return this.unitTexture("clock", (30 + 9) * BADGE_SCALE, (ctx) => {
      ctx.scale(BADGE_SCALE, BADGE_SCALE);
      circlePath(ctx, 0, 5, 30);
      ctx.fillStyle = c.ink;
      ctx.fill();
      circlePath(ctx, 0, 0, 30);
      ctx.fillStyle = c.paper;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.ink;
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.stroke(new Path2D(CLOCK_HANDS));
    });
  }

  /** Dấu ✗ đỏ viền trắng trên mồi bị bắn. */
  private crossTexture() {
    return this.unitTexture("cross", (30 + 10) * CROSS_SCALE, (ctx) => {
      ctx.scale(CROSS_SCALE, CROSS_SCALE);
      crossStroke(ctx, 30, 20, CROSS_UNDER);
      crossStroke(ctx, 30, 10, DECOY_FILL);
    });
  }

  /** Sao vàng viền mực bung khi trúng. */
  private burstTexture(r: number) {
    const c = this.colors;
    const outer = r * BURST.scale;
    return this.unitTexture(`burst-${r}`, outer + BURST.width, (ctx) => {
      starPath(ctx, outer, BURST.points, BURST.inner);
      ctx.fillStyle = c.primary;
      ctx.fill();
      ctx.lineWidth = BURST.width;
      ctx.strokeStyle = c.ink;
      ctx.stroke();
    });
  }

  /** Huy hiệu ✓: tròn vàng viền mực có bóng. */
  private okTexture() {
    const c = this.colors;
    return this.unitTexture("ok", (26 + 9) * BADGE_SCALE, (ctx) => {
      ctx.scale(BADGE_SCALE, BADGE_SCALE);
      circlePath(ctx, 0, 5, 26);
      ctx.fillStyle = c.ink;
      ctx.fill();
      circlePath(ctx, 0, 0, 26);
      ctx.fillStyle = c.primary;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.ink;
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.stroke(new Path2D(CHECK));
    });
  }

  /** Nền nhãn ms: viên thuốc giấy viền mực có bóng (chữ vẽ riêng bằng Text). */
  private pillTexture() {
    const c = this.colors;
    const { w, h, drop, border } = PILL;
    return this.unitTexture("pill", (w / 2 + border + drop) * BADGE_SCALE, (ctx) => {
      ctx.scale(BADGE_SCALE, BADGE_SCALE);
      roundRectPath(ctx, -w / 2, -h / 2 + drop / 2, w, h, h / 2);
      ctx.fillStyle = c.ink;
      ctx.fill();
      roundRectPath(ctx, -w / 2, -h / 2 - drop / 2, w, h, h / 2);
      ctx.fillStyle = c.panel;
      ctx.fill();
      ctx.lineWidth = border;
      ctx.strokeStyle = c.ink;
      ctx.stroke();
    });
  }

  /** Chấm phấn khi chạm hụt: vòng nét đứt mờ và chấm giữa. */
  private tapTexture() {
    const c = this.colors;
    return this.unitTexture("tap", TAP.ring + TAP.width, (ctx) => {
      ctx.fillStyle = c.text;
      ctx.strokeStyle = c.text;
      circlePath(ctx, 0, 0, TAP.ring);
      ctx.setLineDash(evenCircleDash(TAP.ring, TAP.dash));
      ctx.lineCap = "butt";
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = TAP.width;
      ctx.stroke();
      ctx.setLineDash([]);
      circlePath(ctx, 0, 0, TAP.dot);
      ctx.globalAlpha = 0.5;
      ctx.fill();
    });
  }
}
