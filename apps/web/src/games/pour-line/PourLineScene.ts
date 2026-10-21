import {
  POUR_LINE_HEIGHT,
  type PourLinePuzzle,
  pourLine,
  pourLineLevelAt,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import { currentLanguage } from "@/i18n";
import { planResync } from "../_shared/resync";
import { shouldIgnoreGameKey } from "../keyboard";
import {
  type ConnectionEvent,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  type MinigameBridge,
  type SceneResync,
} from "../types";
import { formatDelta, holdAnswer, sameClock } from "./hold";
import { sceneText } from "./locales";
import { halfWidthAt, levelY, type Point, sectionPoints, VESSEL, wallPoints } from "./vessel";

/*
 * Rót vừa vạch — giữ để rót nước vào bình thí nghiệm, buông tay khi mặt nước chạm vạch.
 * Đặc tả: docs/04-minigames/pour-line.md (mục "Ghi chú cho FE", "Hiện đáp án đúng khi sai").
 *
 * Một câu = một lần giữ. Đáp án là số ms giữ tay, đo bằng `timeStamp` của chính sự kiện nhấn và
 * buông (Phaser: `pointer.downTime` / `pointer.upTime`; phím: `KeyboardEvent.timeStamp`), không đo
 * theo vòng lặp khung hình. Mỗi khung hình chỉ VẼ nước bằng `pourLineLevelAt(puzzle, now − lúc nhấn)`
 * của shared (cùng hàm server dùng để chấm), không tích luỹ theo khung hình.
 * Buông (nhả tay, nhả Space, `touchcancel`, con trỏ rời canvas, cửa sổ mất tiêu điểm / bị ẩn) là
 * gửi; tới `fullMs` thì tự buông và gửi `fullMs` (tràn, chắc chắn sai). Mất kết nối giữa lúc giữ thì
 * huỷ lần rót (nước về 0, không gửi), nối lại thì rót lại câu server đang chờ.
 *
 * Nét vẽ tĩnh của câu (viền bình, vạch đứt, mũi tên vạch, khăn che) vẽ một lần mỗi câu ra canvas 2D
 * làm texture; nước, dải vạch và hiệu ứng vẽ bằng Graphics.
 */

// ---------------------------------------------------------------- bố cục (khung 720×1280)

/** Nhấn ở bất kỳ đâu từ y này trở xuống đều rót (nút giữ chỉ là gợi ý thị giác). */
const HOLD_TOP = 240;
/** Ống nghiệm rót: miệng ở (360, 328), thân nghiêng lên trái 25°. */
const FAUCET = { x: 360, y: 328, length: 150, width: 46, angle: 25 } as const;
/** Texture ống nghiệm và vị trí miệng ống trong texture (origin của ảnh). */
const FAUCET_TEX = { w: 210, h: 160 } as const;
const FAUCET_MOUTH = { x: 182, y: 118 } as const;
/** Dòng nước từ miệng vòi xuống mặt nước. */
const STREAM = { top: 330, width: 14 } as const;
/** Bệ (mặt bàn thí nghiệm) dưới đáy bình. */
const BENCH = { x: 110, y: 1000, w: 500, h: 30, r: 10, drop: 6 } as const;
/** Nút giữ: tâm (360, 1140), bán kính 72, bóng lệch 7, lún 5 khi đang giữ. */
const BUTTON = { x: 360, y: 1140, r: 72, drop: 7, sink: 5 } as const;
/** Vùng vẽ của hai texture theo câu (viền + vạch, khăn che), px thiết kế. */
const LAYER = { x: 90, y: 330, w: 540, h: 720 } as const;

/** Nét viền bình; môi bình loe ra ở miệng. */
const WALL = 6;
const LIP = { dx: 14, dy: 8 } as const;
/** Vạch: đường đứt nét dài hơn bình 24 px mỗi bên, mũi tên tam giác ngoài mép trái. */
const LINE_OVERHANG = 24;
const LINE_DASH: [number, number] = [16, 10];
const MARKER = { gap: 6, w: 30, h: 34 } as const;
/** Vạch chia của ống đong (chỉ ống thẳng, trang trí): mỗi 50 đơn vị, vạch dài mỗi 100. */
const TICK = { step: 50, major: 22, minor: 12 } as const;

/** Độ mờ của dải vạch: Mầm đậm hơn; lúc hiện đáp án sáng hơn. */
const BAND_ALPHA = { sprout: 0.45, base: 0.28, answer: 0.5 } as const;
const FLASH_ALPHA = 0.85;
/** Mặt nước ma (phần nước còn thiếu tới vạch) lúc hiện đáp án. */
const GHOST_ALPHA = 0.3;
/** Nút giữ mờ đi khi đang khoá hoặc mất kết nối. */
const BUTTON_OFF_ALPHA = 0.45;
/** Gợn mặt nước (px) khi rót và ngay sau khi đúng. */
const WAVE_AMP = 2.5;

const FONT_DISPLAY = '"Baloo 2", "Be Vietnam Pro", sans-serif';

// ---------------------------------------------------------------- nhịp hiệu ứng (ms)

const APPEAR_MS = 150;
const NEXT_MS = 300;
const FLASH_MS = 200;
const REVEAL_MS = 200;
const SPILL_MS = 300;
const RIPPLE_MS = 300;

// ---------------------------------------------------------------- màu

/** Màu đọc từ token CSS lúc tạo scene (tự đổi theo sáng/tối). Chuỗi CSS để vẽ texture canvas. */
interface Palette {
  dark: boolean;
  /** Nét phấn: viền bình, vòi, bệ, vạch đứt, chữ (`--card-foreground`: mực ở nền sáng, kem ở nền tối). */
  line: string;
  /** Bóng đổ, viền nút, mũi tên vạch, huy hiệu (`--sticker`). */
  sticker: string;
  /** Khăn che, mặt bệ, nhãn số giây (`--card`). */
  card: string;
  /** Dải vạch, mũi tên vạch, nút giữ, mũi tên chỉ đáp án (`--primary`). */
  primary: string;
  /** Giọt nước trên nút, dấu ✓ (`--primary-foreground`). */
  primaryFg: string;
  /** Nước (`--color-sky`), mặt nước (`--color-analyze`), bọt (`--color-paper`). */
  water: string;
  surface: string;
  foam: string;
}

/** Giá trị token ở nền sáng, chỉ dùng khi không đọc được biến CSS. */
const FALLBACK: Omit<Palette, "dark"> = {
  line: "#1f1b3a",
  sticker: "#1f1b3a",
  card: "#fff8ef",
  primary: "#ffd166",
  primaryFg: "#1f1b3a",
  water: "#8ec5ff",
  surface: "#4d9de0",
  foam: "#fff8ef",
};

function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    dark: style.colorScheme === "dark",
    line: token("--card-foreground", FALLBACK.line),
    sticker: token("--sticker", FALLBACK.sticker),
    card: token("--card", FALLBACK.card),
    primary: token("--primary", FALLBACK.primary),
    primaryFg: token("--primary-foreground", FALLBACK.primaryFg),
    water: token("--color-sky", FALLBACK.water),
    surface: token("--color-analyze", FALLBACK.surface),
    foam: token("--color-paper", FALLBACK.foam),
  };
}

/** Màu CSS → số màu của Phaser. */
const toColor = (css: string) => Phaser.Display.Color.ValueToColor(css).color;

// ---------------------------------------------------------------- vẽ canvas 2D

type Ctx = CanvasRenderingContext2D;

function tracePoints(ctx: Ctx, points: readonly Point[]) {
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
}

/** Giọt nước tâm (0, 0), cao ~72 px. */
const DROP =
  "M0 -36 C12 -20 26 -6 26 10 C26 26 14 36 0 36 C-14 36 -26 26 -26 10 C-26 -6 -12 -20 0 -36 Z";

/** Mép dưới gợn của khăn che: chỉ gợn XUỐNG dưới mức `hideFrom` để không hở nước phía trên. */
const clothEdge = (x: number, edgeY: number) => edgeY + 3 + 2.5 * Math.sin((x - VESSEL.cx) / 15);

// ---------------------------------------------------------------- scene

type Phase = "appear" | "ready" | "holding" | "result" | "locked";

interface Hold {
  source: "pointer" | "key";
  /** Con trỏ đang giữ (chỉ con trỏ đầu tiên); -1 khi giữ bằng phím. */
  pointerId: number;
  /** Lúc nhấn (`timeStamp` của sự kiện, cùng gốc với `performance.now()`). */
  start: number;
  /** `timeStamp` dùng được; không thì đo cả hai đầu bằng `performance.now()`. */
  stamped: boolean;
}

type ButtonState = "idle" | "pressed" | "off";

/** Rót vừa vạch — giữ để rót, buông đúng vạch. */
export default class PourLineScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private phase: Phase = "appear";
  private puzzle?: PourLinePuzzle;
  private colors!: Palette;
  private reducedMotion = false;
  /** Mất kết nối: không nhận nhấn, không gửi gì (nối lại thì hiện lại câu theo server). */
  private paused = false;
  /** Tăng mỗi khi đồng bộ lại câu theo server: kết quả chờ của các câu gửi trước thôi tác dụng. */
  private epoch = 0;
  /** Câu đang hiện khoá (khi `phase` = "locked"). */
  private lockIndex = -1;
  private hold?: Hold;
  /** Mức nước đang vẽ của câu hiện tại. */
  private level = 0;
  /** Gợn nước sau khi đúng chạy tới lúc này (`performance.now()`). */
  private rippleUntil = 0;
  /** Số ms đã gửi theo câu, để hiện lại đáp án khi đồng bộ lại vào lúc server còn khoá. */
  private sent = new Map<number, number>();
  /** Hẹn giờ của câu hiện tại (câu kế, hết khoá); huỷ khi sang câu mới hoặc rời màn. */
  private timers: Phaser.Time.TimerEvent[] = [];
  private offConnection?: () => void;

  /** Các lớp của câu (mờ dần lúc câu mới hiện), từ dưới lên. */
  private root!: Phaser.GameObjects.Container;
  private water!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Graphics;
  private cloth!: Phaser.GameObjects.Image;
  private clothTex!: Phaser.Textures.CanvasTexture;
  /** Mép dưới khăn trong texture (px), để kéo khăn lên bằng crop. */
  private clothBottom = 0;
  private band!: Phaser.GameObjects.Graphics;
  private flash!: Phaser.GameObjects.Graphics;
  private layerTex!: Phaser.Textures.CanvasTexture;
  /** Huy hiệu ✓, mũi tên + nhãn số giây, nước tràn (xoá mỗi câu). */
  private fx!: Phaser.GameObjects.Container;
  private buttonFace!: Phaser.GameObjects.Image;
  private buttonShadow!: Phaser.GameObjects.Graphics;

  private readonly onKeyDown = (event: KeyboardEvent) => this.handleKeyDown(event);
  private readonly onKeyUp = (event: KeyboardEvent) => this.handleKeyUp(event);
  // Cửa sổ mất tiêu điểm / bị ẩn giữa lúc giữ: coi như buông tại lúc đó và gửi như thường (huỷ lượt
  // sẽ thành mẹo chuyển tab để tránh bị chấm sai). Đặc tả, mục "Buông bất thường".
  private readonly onBlur = (event: Event) => this.release(event.timeStamp);
  private readonly onVisibility = (event: Event) => {
    if (document.visibilityState === "hidden") this.release(event.timeStamp);
  };

  init(data: { bridge: MinigameBridge }) {
    this.epoch += 1;
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.phase = "appear";
    this.puzzle = undefined;
    this.paused = false;
    this.lockIndex = -1;
    this.hold = undefined;
    this.level = 0;
    this.rippleUntil = 0;
    this.sent = new Map();
    this.timers = [];
  }

  create() {
    const canvas = this.game.canvas;
    this.colors = readPalette(canvas.isConnected ? canvas : document.documentElement);
    this.reducedMotion = prefersReducedMotion();

    // Giữ lâu trên điện thoại: trình duyệt không cuộn/thu phóng, không hiện menu chạm giữ, không bôi chọn.
    canvas.style.touchAction = "none";
    canvas.style.userSelect = "none";
    canvas.style.setProperty("-webkit-user-select", "none");
    canvas.style.setProperty("-webkit-touch-callout", "none");
    this.input.mouse?.disableContextMenu();

    this.drawBench();
    this.add
      .image(FAUCET.x, FAUCET.y, this.faucetTexture())
      .setOrigin(FAUCET_MOUTH.x / FAUCET_TEX.w, FAUCET_MOUTH.y / FAUCET_TEX.h);

    this.water = this.add.graphics();
    this.ghost = this.add.graphics();
    this.clothTex = this.canvasTexture("pour-line:cloth");
    this.cloth = this.add.image(LAYER.x, LAYER.y, this.clothTex.key).setOrigin(0);
    this.band = this.add.graphics();
    this.flash = this.add.graphics().setAlpha(0);
    this.layerTex = this.canvasTexture("pour-line:layer");
    const layer = this.add.image(LAYER.x, LAYER.y, this.layerTex.key).setOrigin(0);
    this.fx = this.add.container(0, 0);
    this.root = this.add.container(0, 0, [
      this.water,
      this.ghost,
      this.cloth,
      this.band,
      this.flash,
      layer,
      this.fx,
    ]);

    this.buttonShadow = this.add.graphics();
    this.buttonShadow.fillStyle(toColor(this.colors.sticker));
    this.buttonShadow.fillCircle(BUTTON.x, BUTTON.y + BUTTON.drop, BUTTON.r);
    this.buttonFace = this.add.image(BUTTON.x, BUTTON.y, this.buttonTexture());

    // Nhấn ở bất kỳ đâu từ y ≥ 240 (vùng chạm phủ gần cả khung). Buông nghe ở cả scene: nhả ngoài
    // canvas vẫn nhận (Phaser nghe mouseup/touchend trên window).
    const zone = this.add
      .zone(0, HOLD_TOP, DESIGN_WIDTH, DESIGN_HEIGHT - HOLD_TOP)
      .setOrigin(0)
      .setInteractive({ cursor: "pointer" });
    zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.onPointerDown(pointer));
    this.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => this.onPointerUp(p));
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, (p: Phaser.Input.Pointer) =>
      this.onPointerUp(p),
    );
    this.input.on(Phaser.Input.Events.GAME_OUT, (timeStamp: number) =>
      this.onPointerLeave(timeStamp),
    );

    // Bắt phím ở mọi thiết bị có bàn phím (Space = giữ để rót).
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());

    this.showPuzzle();
    // Đăng ký sau khi có câu: đang mất kết nối thì báo `paused` ngay trong lúc gọi.
    this.offConnection = this.bridge.watchConnection?.((event) => this.onConnection(event));
  }

  private cleanup() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.offConnection?.();
    this.offConnection = undefined;
    this.clearTimers();
    this.tweens.killAll();
    this.hold = undefined;
    this.puzzle = undefined;
  }

  // -------------------------------------------------------------- dựng câu đố

  private showPuzzle() {
    this.clearTimers();
    // Mọi tween đang chạy đều thuộc câu cũ (hiện câu, loé, khăn kéo lên, tràn): dừng trước khi vẽ lại.
    this.tweens.killAll();
    this.fx.removeAll(true);
    this.ghost.clear();
    this.flash.clear().setAlpha(0);
    this.hold = undefined;
    this.rippleUntil = 0;

    const puzzle = pourLine.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    this.puzzle = puzzle;
    this.level = 0;
    this.drawLayer(puzzle);
    this.drawCloth(puzzle);
    this.drawBand(puzzle, "idle");
    this.drawWater(0);
    this.setButton(this.paused ? "off" : "idle");

    // Câu mới hiện mờ dần 150 ms rồi mới nhận nhấn (nhấn trong lúc hiện thì bỏ qua, phải nhấn lại).
    if (this.reducedMotion) {
      this.root.setAlpha(1);
      this.phase = "ready";
      return;
    }
    this.phase = "appear";
    this.root.setAlpha(0);
    this.tweens.add({
      targets: this.root,
      alpha: 1,
      duration: APPEAR_MS,
      onComplete: () => {
        if (this.puzzle === puzzle && this.phase === "appear") this.phase = "ready";
      },
    });
  }

  // -------------------------------------------------------------- vòng lặp: chỉ vẽ

  override update() {
    const puzzle = this.puzzle;
    if (!puzzle) return;
    const now = performance.now();
    const hold = this.hold;
    if (this.phase === "holding" && hold) {
      const elapsed = now - hold.start;
      // Tràn: tự buông đúng ở mốc `fullMs` (trễ tối đa một khung hình, số gửi vẫn là `fullMs`).
      if (elapsed >= puzzle.fullMs) {
        this.release(hold.start + puzzle.fullMs);
        return;
      }
      this.level = pourLineLevelAt(puzzle, elapsed);
      this.drawWater(this.level, { pouring: true, now });
      return;
    }
    if (this.rippleUntil > 0) {
      const left = (this.rippleUntil - now) / RIPPLE_MS;
      if (left <= 0) this.rippleUntil = 0;
      this.drawWater(this.level, { ripple: Math.max(0, left), now });
    }
  }

  // -------------------------------------------------------------- nhấn / buông

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    // Chỉ con trỏ đầu tiên (chuột hoặc ngón đầu), chỉ nút trái; ngón thứ hai bỏ qua.
    if (pointer.id > 1 || pointer.button !== 0) return;
    this.startHold("pointer", pointer.id, pointer.downTime);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer) {
    const hold = this.hold;
    if (hold?.source !== "pointer" || pointer.id !== hold.pointerId || pointer.button !== 0) return;
    this.release(pointer.upTime);
  }

  /** Con trỏ rời canvas trong lúc giữ: coi như buông tại lúc đó. */
  private onPointerLeave(timeStamp: number) {
    if (this.hold?.source === "pointer") this.release(timeStamp);
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (!isSpace(event)) return;
    // Có phím bổ trợ, đang gõ chữ hoặc đang mở hộp thoại (Thoát, sheet chat…): không rót.
    if (shouldIgnoreGameKey(event)) return;
    // Không cuộn trang, không bấm nút đang được focus.
    event.preventDefault();
    // Bỏ qua tự lặp phím: giữ Space từ câu trước sang câu mới không tính là nhấn.
    if (event.repeat || !this.sys.isActive()) return;
    this.startHold("key", -1, event.timeStamp);
  }

  private handleKeyUp(event: KeyboardEvent) {
    if (!isSpace(event)) return;
    if (this.hold?.source === "key") {
      event.preventDefault();
      this.release(event.timeStamp);
      return;
    }
    if (!shouldIgnoreGameKey(event)) event.preventDefault();
  }

  private startHold(source: Hold["source"], pointerId: number, stamp: number) {
    if (this.phase !== "ready" || this.hold || this.paused || !this.puzzle) return;
    const now = performance.now();
    const stamped = sameClock(stamp, now);
    this.hold = { source, pointerId, start: stamped ? stamp : now, stamped };
    this.phase = "holding";
    this.setButton("pressed");
  }

  /**
   * Huỷ lần rót đang giữ (mất kết nối): nước rút về 0, không gửi,
   * câu vẫn chờ một lần giữ mới. Nhả tay sau đó không tính.
   */
  private cancelHold() {
    if (this.phase !== "holding" || !this.hold) return;
    this.hold = undefined;
    this.phase = "ready";
    this.level = 0;
    this.drawWater(0);
    this.setButton(this.paused ? "off" : "idle");
  }

  /** Buông tại `stamp` (`timeStamp` của sự kiện): đo, vẽ mức nước thật, chấm ở máy và gửi ngay. */
  private release(stamp: number) {
    const puzzle = this.puzzle;
    const hold = this.hold;
    if (!puzzle || !hold || this.phase !== "holding") return;
    this.hold = undefined;

    const now = performance.now();
    const up = hold.stamped && sameClock(stamp, now) && stamp >= hold.start ? stamp : now;
    const holdMs = holdAnswer(hold.start, up, puzzle.fullMs);
    const overflow = holdMs >= puzzle.fullMs;
    // Dòng nước tắt ngay, mặt nước đứng yên ở đúng mức server sẽ tính từ số ms này.
    this.level = pourLineLevelAt(puzzle, holdMs);
    this.drawWater(this.level);

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const index = this.index;
    const correct = pourLine.check(puzzle, holdMs);
    this.bridge.submit(index, holdMs);
    this.sent.set(index, holdMs);
    this.index += 1;

    if (correct) {
      this.phase = "result";
      this.setButton("idle");
      this.revealCloth(() => {
        this.showCorrect(puzzle);
        this.after(NEXT_MS, () => this.showPuzzle());
      });
      return;
    }

    // Sai / tràn: hiện đáp án đúng suốt lúc khoá (CR-006).
    this.phase = "locked";
    this.lockIndex = index;
    this.setButton("off");
    if (overflow) this.spill(puzzle);
    this.revealCloth(() => this.showMiss(puzzle, holdMs));
    // Hết khoá theo `lockedUntil` của server (không tự đếm) để khớp huy hiệu khoá của khung.
    const epoch = this.epoch;
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ; đã đồng bộ lại câu thì bỏ qua.
      if (!this.sys.isActive() || epoch !== this.epoch || this.index !== index + 1) return;
      this.armUnlock(ms);
    });
  }

  /** Hết khoá sau `ms` thì hiện câu kế. */
  private armUnlock(ms: number) {
    this.clearTimers();
    this.after(ms, () => this.showPuzzle());
  }

  // -------------------------------------------------------------- kết nối

  private onConnection(event: ConnectionEvent) {
    if (event.type === "paused") {
      this.paused = true;
      this.cancelHold();
      this.setButton("off");
      return;
    }
    if (!this.paused) return;
    this.paused = false;
    this.resync(event.sync);
  }

  /**
   * Hiện lại đúng câu server đang chờ sau khi nối lại (như Luyện ngắm): server còn khoá sau câu
   * trước bị chấm sai thì hiện câu đó kèm đáp án tới hết khoá. Kết quả chờ của các câu gửi trước
   * đó thôi tác dụng (`epoch`).
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
      this.setButton("off");
      this.armUnlock(plan.unlockMs);
      return;
    }
    if (plan.kind === "lock") {
      this.showLocked(plan.index - 1, plan.unlockMs);
      return;
    }
    this.index = plan.index;
    this.showPuzzle();
  }

  /** Hiện câu `index` ở trạng thái khoá (đáp án đúng + lần giữ đã gửi nếu còn nhớ) trong `unlockMs`. */
  private showLocked(index: number, unlockMs: number) {
    this.index = index;
    this.showPuzzle();
    this.index = index + 1;
    const puzzle = this.puzzle;
    if (!puzzle) return;
    this.tweens.killTweensOf(this.root);
    this.root.setAlpha(1);
    this.phase = "locked";
    this.lockIndex = index;
    this.setButton("off");
    const holdMs = this.sent.get(index) ?? null;
    if (holdMs !== null) {
      this.level = pourLineLevelAt(puzzle, holdMs);
      this.drawWater(this.level);
    }
    this.cloth.setVisible(false);
    this.showMiss(puzzle, holdMs);
    this.armUnlock(unlockMs);
  }

  // -------------------------------------------------------------- phản hồi

  /** Đúng: dải vạch loé sáng 200 ms, dấu ✓ cạnh mặt nước, gợn nước. */
  private showCorrect(puzzle: PourLinePuzzle) {
    const c = this.colors;
    const level = this.level;
    if (!this.reducedMotion) {
      this.flash.clear();
      this.flash.fillStyle(toColor(c.primary), 1);
      fillPoly(
        this.flash,
        sectionPoints(puzzle.vessel, puzzle.target - puzzle.tol, puzzle.target + puzzle.tol),
      );
      this.flash.setAlpha(FLASH_ALPHA);
      this.tweens.add({ targets: this.flash, alpha: 0, duration: FLASH_MS, ease: "Quad.easeOut" });
      this.rippleUntil = performance.now() + RIPPLE_MS;
    }
    const x = Math.min(VESSEL.cx + halfWidthAt(puzzle.vessel, level) + 40, DESIGN_WIDTH - 34);
    this.fx.add(this.badge(x, levelY(level)));
  }

  /**
   * Sai: dải vạch sáng viền dày, mặt nước ma ở vạch (nước mờ 30 % phần còn thiếu + đường đứt nét),
   * mũi tên dọc từ mặt nước thật tới vạch (lên = buông sớm, xuống = buông muộn) kèm đồng hồ và số
   * giây lệch. Mọi thứ nằm trong vùng bình (y ≥ 360), không bị huy hiệu khoá che.
   * `holdMs` = null: không biết lần giữ đã gửi (đồng bộ lại), chỉ hiện vạch và mặt nước ma.
   */
  private showMiss(puzzle: PourLinePuzzle, holdMs: number | null) {
    const c = this.colors;
    const v = puzzle.vessel;
    const level = holdMs === null ? 0 : pourLineLevelAt(puzzle, holdMs);
    this.drawBand(puzzle, "answer");

    const g = this.ghost;
    g.clear();
    if (level < puzzle.target) {
      g.fillStyle(toColor(c.water), GHOST_ALPHA);
      fillPoly(g, sectionPoints(v, level, puzzle.target));
    }
    const ty = levelY(puzzle.target);
    const hw = halfWidthAt(v, puzzle.target);
    dashedLine(g, VESSEL.cx - hw, VESSEL.cx + hw, ty, 9, toColor(c.sticker));
    dashedLine(g, VESSEL.cx - hw, VESSEL.cx + hw, ty, 5, toColor(c.primary));

    if (holdMs === null) return;
    const y0 = levelY(level);
    const arrow = this.add.graphics();
    drawArrow(arrow, VESSEL.cx, y0, ty, toColor(c.sticker), toColor(c.primary));
    this.fx.add(arrow);

    // Nhãn đặt cạnh mũi tên, bên phải bình (chỗ rộng nhất giữa hai mức), không ra khỏi khung.
    const lang = currentLanguage();
    const text = formatDelta(holdMs - puzzle.idealHoldMs, lang, sceneText[lang].seconds);
    const lo = Math.min(level, puzzle.target);
    const hi = Math.max(level, puzzle.target);
    let widest = 0;
    for (let l = lo; l <= hi; l += 25) widest = Math.max(widest, halfWidthAt(v, l));
    widest = Math.max(widest, halfWidthAt(v, hi));
    const midY = Phaser.Math.Clamp((y0 + ty) / 2, VESSEL.top + 30, VESSEL.bottom - 30);
    this.fx.add(this.deltaPill(VESSEL.cx + widest + 22, midY, text));
  }

  /** Huy hiệu ✓: tròn vàng viền mực có bóng. */
  private badge(x: number, y: number): Phaser.GameObjects.Graphics {
    const c = this.colors;
    const g = this.add.graphics();
    g.fillStyle(toColor(c.sticker));
    g.fillCircle(x, y + 4, 26);
    g.fillStyle(toColor(c.primary));
    g.fillCircle(x, y, 26);
    g.lineStyle(4, toColor(c.sticker));
    g.strokeCircle(x, y, 26);
    g.lineStyle(6, toColor(c.primaryFg));
    strokePoly(g, [
      { x: x - 12, y: y + 1 },
      { x: x - 3, y: y + 10 },
      { x: x + 13, y: y - 9 },
    ]);
    return g;
  }

  /** Nhãn số giây lệch: viên thuốc giấy viền phấn có bóng, đồng hồ nhỏ bên trái. `x` = mép trái. */
  private deltaPill(x: number, y: number, value: string): Phaser.GameObjects.Container {
    const c = this.colors;
    const label = this.add
      .text(0, 0, value, {
        fontFamily: FONT_DISPLAY,
        fontStyle: "800",
        fontSize: "30px",
        color: c.line,
      })
      .setOrigin(0, 0.5);
    const h = 52;
    const w = 18 + 28 + 10 + label.width + 18;
    const left = Math.min(x, DESIGN_WIDTH - w - 8);
    const bg = this.add.graphics();
    bg.fillStyle(toColor(c.sticker));
    bg.fillRoundedRect(0, -h / 2 + 5, w, h, h / 2);
    bg.fillStyle(toColor(c.card));
    bg.fillRoundedRect(0, -h / 2, w, h, h / 2);
    bg.lineStyle(4, toColor(c.line));
    bg.strokeRoundedRect(0, -h / 2, w, h, h / 2);
    // Đồng hồ: mặt tròn + hai kim.
    const cx = 18 + 14;
    bg.lineStyle(4, toColor(c.line));
    bg.strokeCircle(cx, 0, 13);
    bg.lineBetween(cx, 0, cx, -8);
    bg.lineBetween(cx, 0, cx + 6, 4);
    label.setPosition(18 + 28 + 10, -2);
    return this.add.container(left, y, [bg, label]);
  }

  /** Tràn: nước chảy tràn qua miệng xuống hai bên thành bình trong 300 ms. */
  private spill(puzzle: PourLinePuzzle) {
    const c = this.colors;
    const g = this.add.graphics();
    this.fx.add(g);
    const sides = ([-1, 1] as const).map((side) => {
      const wall = wallPoints(puzzle.vessel, side)
        .reverse()
        .map((p) => ({ x: p.x + side * (WALL + 2), y: p.y }));
      const top = wall[0] as Point;
      return [{ x: top.x + side * LIP.dx, y: top.y - LIP.dy }, ...wall];
    });
    const draw = (t: number) => {
      const cut = VESSEL.top - LIP.dy + t * (VESSEL.bottom - VESSEL.top + LIP.dy);
      g.clear();
      g.lineStyle(8, toColor(c.water), 0.95);
      for (const pts of sides) {
        const part = clipPolyline(pts, cut);
        if (part.length >= 2) strokePoly(g, part);
      }
    };
    if (this.reducedMotion) {
      draw(1);
      return;
    }
    const state = { t: 0 };
    this.tweens.add({
      targets: state,
      t: 1,
      duration: SPILL_MS,
      ease: "Quad.easeIn",
      onUpdate: () => draw(state.t),
    });
  }

  /**
   * Siêu khó: buông xong thì khăn kéo lên (200 ms) cho thấy mực nước thật rồi mới báo đúng/sai.
   * Giảm chuyển động: khăn biến mất tức thì. Không có khăn thì báo ngay.
   */
  private revealCloth(then: () => void) {
    const puzzle = this.puzzle;
    if (!puzzle || puzzle.hideFrom === null || !this.cloth.visible) {
      then();
      return;
    }
    if (this.reducedMotion) {
      this.cloth.setVisible(false);
      then();
      return;
    }
    const full = this.clothBottom;
    const state = { t: 0 };
    this.tweens.add({
      targets: state,
      t: 1,
      duration: REVEAL_MS,
      ease: "Quad.easeIn",
      onUpdate: () => this.cloth.setCrop(0, 0, LAYER.w, Math.max(0, full * (1 - state.t))),
      onComplete: () => {
        this.cloth.setVisible(false);
        then();
      },
    });
  }

  // -------------------------------------------------------------- vẽ theo câu

  /**
   * Nước: dòng từ vòi (khi đang rót) và lòng bình tới `level`, mặt nước, bọt nhỏ. Siêu khó: khăn
   * đặc nằm trên lớp này nên dưới khăn không lộ gì của nước. Giảm chuyển động: mặt phẳng, không bọt;
   * nước dâng giữ nguyên vì là luật chơi.
   */
  private drawWater(
    level: number,
    opts: { pouring?: boolean; ripple?: number; now?: number } = {},
  ) {
    const puzzle = this.puzzle;
    const g = this.water;
    g.clear();
    if (!puzzle) return;
    const c = this.colors;
    const v = puzzle.vessel;
    const now = opts.now ?? performance.now();
    const animate = !this.reducedMotion;
    const sy = levelY(level);
    const water = toColor(c.water);

    if (opts.pouring) {
      const wobble = animate ? Math.sin(now / 45) * 1.5 : 0;
      g.fillStyle(water, 1);
      g.fillRect(
        VESSEL.cx - STREAM.width / 2 + wobble,
        STREAM.top,
        STREAM.width,
        Math.max(0, sy - STREAM.top),
      );
    }
    if (level <= 0) return;

    const left = wallPoints(v, -1, 0, level);
    const right = wallPoints(v, 1, 0, level).reverse();
    const xl = (left[left.length - 1] as Point).x;
    const xr = (right[0] as Point).x;
    const amp = animate ? (opts.pouring ? 1 : (opts.ripple ?? 0)) * WAVE_AMP : 0;
    const top: Point[] = [];
    if (amp > 0) {
      for (let x = xl + 10; x < xr - 10; x += 12) {
        top.push({ x, y: sy + amp * Math.sin(x / 16 + now / 70) });
      }
    }
    g.fillStyle(water, 1);
    fillPoly(g, [...left, ...top, ...right]);
    g.lineStyle(4, toColor(c.surface), 1);
    strokePoly(g, [{ x: xl, y: sy }, ...top, { x: xr, y: sy }]);

    // Bọt nhỏ nổi lên quanh chỗ dòng nước chạm mặt nước.
    if (opts.pouring && animate) {
      g.fillStyle(toColor(c.foam), 0.85);
      for (let k = 0; k < 3; k++) {
        const p = (now / 600 + k / 3) % 1;
        const by = sy + 6 + (1 - p) * 26;
        if (by > VESSEL.bottom - 6) continue;
        const bx = VESSEL.cx + (k - 1) * 20 + Math.sin(now / 90 + k * 2) * 4;
        g.fillCircle(bx, by, 2.5 + 2 * p);
      }
    }
  }

  /** Dải vạch `target ± tol` trong lòng bình. Lúc hiện đáp án: sáng hơn, hai mép viền dày. */
  private drawBand(puzzle: PourLinePuzzle, mode: "idle" | "answer") {
    const c = this.colors;
    const g = this.band;
    const v = puzzle.vessel;
    const lo = puzzle.target - puzzle.tol;
    const hi = puzzle.target + puzzle.tol;
    g.clear();
    const alpha =
      mode === "answer"
        ? BAND_ALPHA.answer
        : this.bridge.difficulty === 0
          ? BAND_ALPHA.sprout
          : BAND_ALPHA.base;
    g.fillStyle(toColor(c.primary), alpha);
    fillPoly(g, sectionPoints(v, lo, hi));
    for (const l of [lo, hi]) {
      const y = levelY(l);
      const hw = halfWidthAt(v, l);
      if (mode === "answer") {
        g.lineStyle(8, toColor(c.sticker), 1);
        g.lineBetween(VESSEL.cx - hw, y, VESSEL.cx + hw, y);
        g.lineStyle(4, toColor(c.primary), 1);
        g.lineBetween(VESSEL.cx - hw, y, VESSEL.cx + hw, y);
      } else {
        // Mép dải mảnh để thấy rõ cả trên nền giấy sáng (không chỉ dựa vào màu vàng nhạt).
        g.lineStyle(2, toColor(c.line), 0.35);
        g.lineBetween(VESSEL.cx - hw, y, VESSEL.cx + hw, y);
      }
    }
  }

  /** Viền bình, vạch chia (ống thẳng), vạch đứt nét và mũi tên vạch: vẽ ra texture một lần mỗi câu. */
  private drawLayer(puzzle: PourLinePuzzle) {
    const c = this.colors;
    const v = puzzle.vessel;
    const ctx = beginLayer(this.layerTex);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (puzzle.shape === "tube") {
      ctx.strokeStyle = c.line;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 3;
      for (let l = 100; l < POUR_LINE_HEIGHT; l += TICK.step) {
        const x = VESSEL.cx - halfWidthAt(v, l) + WALL / 2 + 3;
        const y = levelY(l);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (l % 100 === 0 ? TICK.major : TICK.minor), y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Viền: môi trái → thành trái xuống đáy → đáy → thành phải lên → môi phải (miệng để hở).
    const left = wallPoints(v, -1).reverse();
    const right = wallPoints(v, 1);
    const topLeft = left[0] as Point;
    const topRight = right[right.length - 1] as Point;
    ctx.beginPath();
    ctx.moveTo(topLeft.x - LIP.dx, topLeft.y - LIP.dy);
    for (const p of left) ctx.lineTo(p.x, p.y);
    for (const p of right) ctx.lineTo(p.x, p.y);
    ctx.lineTo(topRight.x + LIP.dx, topRight.y - LIP.dy);
    ctx.lineWidth = WALL;
    ctx.strokeStyle = c.line;
    ctx.stroke();

    // Vạch: đường đứt nét dài hơn bình 24 px mỗi bên, mũi tên tam giác ngoài mép trái.
    const y = levelY(puzzle.target);
    const hw = halfWidthAt(v, puzzle.target);
    const x0 = VESSEL.cx - hw - LINE_OVERHANG;
    const x1 = VESSEL.cx + hw + LINE_OVERHANG;
    ctx.setLineDash(LINE_DASH);
    ctx.lineCap = "butt";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.setLineDash([]);

    const tip = x0 - MARKER.gap;
    ctx.beginPath();
    ctx.moveTo(tip, y);
    ctx.lineTo(tip - MARKER.w, y - MARKER.h / 2);
    ctx.lineTo(tip - MARKER.w, y + MARKER.h / 2);
    ctx.closePath();
    ctx.fillStyle = c.primary;
    ctx.fill();
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = c.sticker;
    ctx.stroke();
    this.layerTex.refresh();
  }

  /**
   * Siêu khó: khăn vải màu thẻ, đặc, gạch chéo phấn, phủ lòng bình từ mức `hideFrom` lên miệng; mép
   * dưới gợn nhẹ. Viền bình, dải vạch, vạch đứt và mũi tên vẽ đè lên khăn (lớp trên).
   */
  private drawCloth(puzzle: PourLinePuzzle) {
    const c = this.colors;
    const ctx = beginLayer(this.clothTex);
    this.cloth.setCrop();
    if (puzzle.hideFrom === null) {
      this.clothTex.refresh();
      this.cloth.setVisible(false);
      return;
    }
    const edgeY = levelY(puzzle.hideFrom);
    const x0 = VESSEL.cx - 200;
    const x1 = VESSEL.cx + 200;
    const y0 = VESSEL.top - 20;

    ctx.save();
    tracePoints(ctx, sectionPoints(puzzle.vessel, 0, POUR_LINE_HEIGHT));
    ctx.clip();
    const cloth = new Path2D();
    cloth.moveTo(x0, y0);
    cloth.lineTo(x1, y0);
    for (let x = x1; x >= x0; x -= 6) cloth.lineTo(x, clothEdge(x, edgeY));
    cloth.closePath();
    ctx.fillStyle = c.card;
    ctx.fill(cloth);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = c.line;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = x1; x >= x0; x -= 6) ctx.lineTo(x, clothEdge(x, edgeY));
    ctx.stroke();

    // Gạch chéo phấn (nền tối: gạch sáng hơn để khăn vẫn tách khỏi nền).
    ctx.clip(cloth);
    ctx.globalAlpha = c.dark ? 0.3 : 0.16;
    ctx.beginPath();
    const h = edgeY - y0 + 10;
    for (let d = -h; d < x1 - x0; d += 22) {
      ctx.moveTo(x0 + d, y0);
      ctx.lineTo(x0 + d + h, y0 + h);
    }
    ctx.stroke();
    ctx.restore();

    this.clothTex.refresh();
    this.clothBottom = edgeY + 6 - LAYER.y;
    this.cloth.setVisible(true);
  }

  // -------------------------------------------------------------- phần tĩnh của scene

  /** Bệ: mặt bàn thí nghiệm viền phấn có bóng. */
  private drawBench() {
    const c = this.colors;
    const g = this.add.graphics();
    const { x, y, w, h, r, drop } = BENCH;
    g.fillStyle(toColor(c.sticker));
    g.fillRoundedRect(x, y + drop, w, h, r);
    g.fillStyle(toColor(c.card));
    g.fillRoundedRect(x, y, w, h, r);
    g.lineStyle(5, toColor(c.line));
    g.strokeRoundedRect(x, y, w, h, r);
  }

  private setButton(state: ButtonState) {
    if (!this.buttonFace) return;
    this.buttonFace.y = BUTTON.y + (state === "pressed" ? BUTTON.sink : 0);
    const alpha = state === "off" ? BUTTON_OFF_ALPHA : 1;
    this.buttonFace.setAlpha(alpha);
    this.buttonShadow.setAlpha(alpha);
  }

  private after(ms: number, callback: () => void) {
    this.timers.push(this.time.delayedCall(ms, callback));
  }

  private clearTimers() {
    for (const timer of this.timers) timer.remove(false);
    this.timers = [];
  }

  // -------------------------------------------------------------- texture

  /** Texture canvas dùng lại mỗi câu (vẽ lại rồi `refresh`), cùng khổ `LAYER`. */
  private canvasTexture(key: string): Phaser.Textures.CanvasTexture {
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, LAYER.w, LAYER.h);
    if (!tex) throw new Error(`pour-line: không tạo được texture ${key}`);
    return tex;
  }

  /** Tạo texture tĩnh từ canvas 2D (gốc toạ độ ở tâm) nếu chưa có; trả về khoá. */
  private staticTexture(name: string, width: number, height: number, draw: (ctx: Ctx) => void) {
    const key = `pour-line:${this.colors.dark ? "dark" : "light"}:${name}`;
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

  /**
   * Ống nghiệm rót nghiêng 25° bằng nét phấn, miệng ở góc dưới phải; nước trong ống đọng về phía
   * miệng (mặt nước nằm ngang). Miệng ống ở `FAUCET_MOUTH` trong texture.
   */
  private faucetTexture() {
    const c = this.colors;
    const { w: W, h: H } = FAUCET_TEX;
    return this.staticTexture("faucet", W, H, (ctx) => {
      // Gốc về miệng ống.
      ctx.translate(FAUCET_MOUTH.x - W / 2, FAUCET_MOUTH.y - H / 2);
      ctx.rotate((FAUCET.angle * Math.PI) / 180);
      const r = FAUCET.width / 2;
      const body = new Path2D();
      body.moveTo(0, -r);
      body.lineTo(-(FAUCET.length - r), -r);
      body.arc(-(FAUCET.length - r), 0, r, -Math.PI / 2, Math.PI / 2, true);
      body.lineTo(0, r);
      ctx.fillStyle = c.card;
      ctx.fill(body);
      ctx.save();
      ctx.clip(body);
      ctx.rotate((-FAUCET.angle * Math.PI) / 180);
      ctx.fillStyle = c.water;
      ctx.fillRect(-W, -26, 2 * W, H);
      ctx.restore();
      ctx.lineWidth = 5;
      ctx.strokeStyle = c.line;
      ctx.stroke(body);
      // Môi ống loe nhẹ ở miệng.
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(7, -r - 6);
      ctx.moveTo(0, r);
      ctx.lineTo(7, r + 6);
      ctx.stroke();
    });
  }

  /** Mặt nút giữ: tròn vàng viền mực, giọt nước mực ở giữa. */
  private buttonTexture() {
    const c = this.colors;
    const size = 2 * (BUTTON.r + 4);
    return this.staticTexture("button", size, size, (ctx) => {
      ctx.beginPath();
      ctx.arc(0, 0, BUTTON.r - 2.5, 0, Math.PI * 2);
      ctx.fillStyle = c.primary;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      ctx.translate(0, -2);
      ctx.scale(0.9, 0.9);
      ctx.fillStyle = c.primaryFg;
      ctx.fill(new Path2D(DROP));
      // Ánh sáng trên giọt nước.
      ctx.beginPath();
      ctx.arc(-9, 14, 6, Math.PI * 0.6, Math.PI * 1.15);
      ctx.lineWidth = 5;
      ctx.strokeStyle = c.primary;
      ctx.stroke();
    });
  }
}

// ---------------------------------------------------------------- tiện ích vẽ

function isSpace(event: KeyboardEvent): boolean {
  return event.code === "Space" || event.key === " ";
}

/** `fillPoints`/`strokePoints` của Phaser 4 nhận mảng Vector2: đổi kiểu ở đây. */
const toVectors = (points: readonly Point[]) =>
  points.map((p) => new Phaser.Math.Vector2(p.x, p.y));

/** Tô đa giác kín bằng màu tô hiện tại của `g` (đa giác lõm cũng được, Phaser tự chia tam giác). */
function fillPoly(g: Phaser.GameObjects.Graphics, points: readonly Point[]) {
  g.fillPoints(toVectors(points), true);
}

/** Nét đường gấp khúc hở bằng nét hiện tại của `g`. */
function strokePoly(g: Phaser.GameObjects.Graphics, points: readonly Point[]) {
  g.strokePoints(toVectors(points), false);
}

/** Xoá texture canvas và trả context đã dời gốc về toạ độ thiết kế. */
function beginLayer(tex: Phaser.Textures.CanvasTexture): Ctx {
  const ctx = tex.context;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, LAYER.w, LAYER.h);
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.translate(-LAYER.x, -LAYER.y);
  return ctx;
}

/** Đường đứt nét ngang (Graphics không có nét đứt). */
function dashedLine(
  g: Phaser.GameObjects.Graphics,
  x0: number,
  x1: number,
  y: number,
  width: number,
  color: number,
) {
  const [dash, gap] = LINE_DASH;
  g.lineStyle(width, color, 1);
  for (let x = x0; x < x1; x += dash + gap) g.lineBetween(x, y, Math.min(x + dash, x1), y);
}

/** Mũi tên dọc từ `y0` tới `y1` (đầu mũi tên ở `y1`), viền mực dưới, vàng trên. */
function drawArrow(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y0: number,
  y1: number,
  ink: number,
  fill: number,
) {
  const dir = Math.sign(y1 - y0) || -1;
  const head = 22;
  const half = 15;
  const shaftEnd = y1 - dir * head;
  for (const [width, color, grow] of [
    [14, ink, 4],
    [7, fill, 0],
  ] as const) {
    if (Math.abs(shaftEnd - y0) > 2) {
      g.lineStyle(width, color, 1);
      g.lineBetween(x, y0, x, shaftEnd);
    }
    g.fillStyle(color, 1);
    g.fillTriangle(
      x,
      y1 + dir * grow,
      x - half - grow,
      shaftEnd - dir * (grow / 2),
      x + half + grow,
      shaftEnd - dir * (grow / 2),
    );
  }
}

/** Phần đường gấp khúc (y tăng dần) nằm trên `cut`, kèm điểm cắt nội suy. */
function clipPolyline(points: readonly Point[], cut: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i] as Point;
    if (p.y <= cut) {
      out.push(p);
      continue;
    }
    const prev = points[i - 1];
    if (prev && prev.y < cut) {
      const t = (cut - prev.y) / (p.y - prev.y);
      out.push({ x: prev.x + (p.x - prev.x) * t, y: cut });
    }
    break;
  }
  return out;
}
