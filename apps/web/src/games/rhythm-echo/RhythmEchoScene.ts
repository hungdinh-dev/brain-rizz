import {
  RHYTHM_ECHO_DEBOUNCE_MS,
  type RhythmEchoHit,
  type RhythmEchoPuzzle,
  type RhythmEchoSide,
  rhythmEcho,
  rhythmEchoFirstMiss,
  rhythmEchoListenMs,
  rhythmEchoNextWindow,
  rhythmEchoSpanMs,
  WRONG_ANSWER_LOCK_MS,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import { playSfx, type SfxKind, type StopSfx, sfxNow } from "@/features/sfx";
import { HAND_PATH } from "../_shared/icons";
import { shouldIgnoreGameKey } from "../keyboard";
import type { MinigameBridge } from "../types";
import { DRUM_DOT, DRUM_RIM, DRUM_RING_INNER, DRUM_RING_OUTER, EAR_PATH, lacePath } from "./shapes";

/*
 * Nhại nhịp — đặc tả: docs/04-minigames/rhythm-echo.md (mục "Ghi chú cho FE").
 * Scene không vẽ chữ: chỉ có biểu tượng, trống, chấm, chữ số và nhãn phím (ký hiệu bàn phím).
 *
 * Đo thời gian: mỗi lần gõ lấy `event.timeStamp` của sự kiện DOM gốc (`pointer.event`,
 * `KeyboardEvent`), cùng gốc với `performance.now()`. Lịch trình chiếu (đèn) chạy theo
 * `performance.now()` trong `update()` từ một mốc, tiếng trống xếp lịch trước cả câu theo đồng hồ
 * AudioContext từ cùng mốc đó, nên đèn và tiếng không trôi theo độ giật khung hình.
 */

// ---------------------------------------------------------------- bố cục (khung 720×1280)

const MID_X = 360;
/** Biểu tượng pha (tai / ngón tay) Ø 112, tâm (360, 160). */
const STATUS = { x: MID_X, y: 160, r: 56 };
/** Dải chấm tiến độ: Ø 28, cách nhau 20 (bước 48), tâm y = 290. */
const DOT_Y = 290;
const DOT_PITCH = 48;
/** Vùng trống (nhận chạm) y 360–1240, cả bề ngang; trên đó không nhận chạm. */
const ZONE_TOP = 360;
const ZONE_BOTTOM = 1240;
const DRUM_Y = 700;
/** Hai trống Ø 300 tâm x 180 / 540; Mầm một trống Ø 400 giữa màn. */
const DRUM_R2 = 150;
const DRUM_R1 = 200;
const DRUM_X: Record<RhythmEchoSide, number> = { left: 180, right: 540 };
/**
 * Dải nhịp khi sai: thẻ x 40–680, y 940–1160. Toạ độ dưới đây tính từ mép trái thẻ: biểu tượng
 * làn tâm x 24 (khung x 64), thanh thời gian x 62–602 (khung 102–642) để chấm tiếng đầu không đè
 * lên biểu tượng làn.
 */
const STRIP = { x: 40, y: 940, w: 640, h: 220 };
const LANE_ICON_X = 24;
const LANE_ICON_R = 15;
const BAR_FROM = 62;
const BAR_WIDTH = 540;
/** Thanh khoá 420×14 dưới dải nhịp, vẫn trong vùng trống. */
const LOCK_BAR = { x: 150, y: 1193, w: 420, h: 14 };
/** Nhãn phím (máy tính) dưới mép trống. */
const KEY_SIZE = 44;
const KEY_GAP = 10;

// ---------------------------------------------------------------- nhịp hiệu ứng (đều ≤ 300 ms)

/** Trống sáng 140 ms: bật 40 ms, tắt 100 ms — ở khoảng ngắn nhất 260 ms vẫn tắt hẳn trước tiếng kế. */
const LIGHT_ON_MS = 40;
const LIGHT_OFF_MS = 100;
const LIT_SCALE = 1.06;
const WAVE_MS = 250;
const WAVE_SCALE = 1.28;
const FADE_IN_MS = 120;
const POP_MS = 150;
/** Đúng cả câu: hai trống nảy 115 % rồi về, rồi sang câu mới. */
const SOLVED_MS = 300;
const SOLVED_SCALE = 1.15;
const SHAKE_MS = 200;
const SHAKE_PX = 8;
const DIM_MS = 150;
const DIM_ALPHA = 0.35;
const STRIP_IN_MS = 150;
/** Quá hạn tiếng kế thêm ngần này ms mới báo sai (chỉ làm báo sai muộn chút, không đổi đúng/sai). */
const DEADLINE_SLACK_MS = 50;

// ---------------------------------------------------------------- phím

const KEY_SIDES: Readonly<Record<string, RhythmEchoSide>> = {
  ArrowLeft: "left",
  KeyA: "left",
  KeyF: "left",
  ArrowRight: "right",
  KeyD: "right",
  KeyJ: "right",
};
/** Phím chỉ có ở Mầm (một trống): mọi phím trống và Space đều là trống duy nhất. */
const SINGLE_DRUM_KEYS = new Set(["Space"]);

// ---------------------------------------------------------------- màu

/** Màu đọc từ token CSS lúc tạo scene (tự đổi theo sáng/tối). Chuỗi CSS để vẽ texture canvas. */
interface Palette {
  card: string;
  cardFg: string;
  sticker: string;
  primary: string;
  primaryFg: string;
  chalk: string;
  chalkMuted: string;
  destructive: string;
  dark: boolean;
}

function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    card: token("--card"),
    cardFg: token("--card-foreground"),
    sticker: token("--sticker"),
    primary: token("--primary"),
    primaryFg: token("--primary-foreground"),
    chalk: token("--chalk"),
    chalkMuted: token("--chalk-muted"),
    destructive: token("--destructive"),
    dark: style.colorScheme === "dark",
  };
}

/** Màu CSS → số màu của Phaser. */
const toColor = (css: string) => Phaser.Display.Color.ValueToColor(css).color;

function mediaMatches(query: string): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

/**
 * Giờ sự kiện DOM gốc (ms, cùng gốc với `performance.now()`). Số lạ (0 ở sự kiện giả, giờ epoch
 * của trình duyệt rất cũ, hay sự kiện tới trễ quá 1 s) thì lấy giờ hiện tại.
 */
function eventTime(event: Event | undefined): number {
  const now = performance.now();
  const t = event?.timeStamp;
  return typeof t === "number" && t > 0 && t <= now + 1 && now - t < 1000 ? t : now;
}

// ---------------------------------------------------------------- vẽ texture bằng canvas 2D

type Ctx = CanvasRenderingContext2D;

function circlePath(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

/** Hình chữ nhật bo góc (thêm vào path hiện tại; `ctx.roundRect` thiếu ở Safari cũ). */
function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/** Nét đứt chia đều quanh vòng tròn bán kính `r` để chỗ nối không lệch. */
function evenDash(r: number, [dash, gap]: [number, number]): [number, number] {
  const length = 2 * Math.PI * r;
  const k = length / Math.max(1, Math.round(length / (dash + gap))) / (dash + gap);
  return [dash * k, gap * k];
}

/**
 * Hoa văn mặt trống (không kể nền): vòng viền trong cho cả hai; trống trái thêm hai vòng đồng
 * tâm + chấm giữa, trống phải thêm một vòng + dây chéo chữ X ở viền. Hai hoa văn khác nhau để
 * không chỉ phân biệt trống bằng vị trí, và để dải nhịp dùng lại làm biểu tượng làn.
 */
function drawPattern(ctx: Ctx, side: RhythmEchoSide, r: number, color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  circlePath(ctx, 0, 0, r * DRUM_RIM);
  ctx.stroke();
  if (side === "left") {
    circlePath(ctx, 0, 0, r * DRUM_RING_OUTER);
    ctx.stroke();
    circlePath(ctx, 0, 0, r * DRUM_RING_INNER);
    ctx.stroke();
    circlePath(ctx, 0, 0, r * DRUM_DOT);
    ctx.fill();
    return;
  }
  circlePath(ctx, 0, 0, r * DRUM_RING_OUTER);
  ctx.stroke();
  ctx.stroke(new Path2D(lacePath(r * DRUM_RIM, r * DRUM_RING_OUTER)));
}

/** Chữ số Baloo 2 đậm, căn giữa theo đường chân chữ (như Theo dấu ánh đèn). */
function drawDigit(ctx: Ctx, n: number, x: number, y: number, size: number, color: string) {
  ctx.fillStyle = color;
  ctx.font = `800 ${size}px "Baloo 2", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(n), x, y + Math.round(size * 0.36));
}

// ---------------------------------------------------------------- scene

type Phase = "listen" | "input" | "done";
type DotState = "empty" | "filled" | "wrong";

interface DrumView {
  side: RhythmEchoSide;
  r: number;
  /** Mọi lớp của trống, tâm ở giữa mặt trống để phóng to / lắc quanh tâm. */
  box: Phaser.GameObjects.Container;
  lit: Phaser.GameObjects.Image;
  wave: Phaser.GameObjects.Image;
  hover: Phaser.GameObjects.Image;
}

/** Một việc trong lịch trình chiếu, `at` tính bằng ms từ mốc bắt đầu pha nghe. */
interface Cue {
  at: number;
  run: () => void;
}

/** Nhại nhịp — nghe và nhìn trống gõ một câu nhịp, rồi gõ lại đúng trống, đúng nhịp. */
export default class RhythmEchoScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private colors!: Palette;
  private reducedMotion = false;
  /** Máy có chuột / bàn di: hiện nhãn phím dưới trống, viền mảnh khi rê chuột. */
  private canHover = false;

  private phase: Phase = "done";
  private puzzle?: RhythmEchoPuzzle;
  /** Các lần gõ hợp lệ của câu hiện tại (đáp án gửi đi), `atMs` tính từ lần gõ đầu. */
  private taps: RhythmEchoHit[] = [];
  /** `event.timeStamp` của lần gõ đầu (gốc của `atMs`). */
  private firstTapAt = 0;
  /** Lần gõ gần nhất của từng mặt (bộ lọc nảy). */
  private lastTapAt: Record<RhythmEchoSide, number> = { left: -Infinity, right: -Infinity };
  /** Hạn tiếng kế theo `performance.now()`; quá hạn chưa gõ thì gửi luôn (sai). */
  private deadline?: number;
  /** Lịch trình chiếu, xếp theo `at`; `update()` chạy dần theo `performance.now()`. */
  private cues: Cue[] = [];
  private cueStart = 0;
  /** Tiếng trống đã xếp lịch của pha nghe, để dừng khi chiếu lại hay sang câu mới. */
  private sounds: StopSfx[] = [];
  /** Ẩn tab lúc đang nghe → quay lại thì chiếu lại từ đầu; lúc đang gõ dở → quay lại thì gửi luôn. */
  private replayOnVisible = false;
  private failOnVisible = false;
  /** Hẹn giờ không cần chính xác (chuyển câu, hết khoá); huỷ hết khi sang câu mới. */
  private timers: Phaser.Time.TimerEvent[] = [];
  /** Texture dải nhịp của câu sai gần nhất (vẽ riêng mỗi câu), xoá khi sang câu mới. */
  private stripKey?: string;
  private stripSeq = 0;

  private root?: Phaser.GameObjects.Container;
  /** Trống + vạch chia + nhãn phím: cùng mờ khi sai. */
  private stage?: Phaser.GameObjects.Container;
  private drums: DrumView[] = [];
  private zones: Phaser.GameObjects.Zone[] = [];
  private status?: Phaser.GameObjects.Container;
  private ear?: Phaser.GameObjects.Image;
  private hand?: Phaser.GameObjects.Image;
  private dots?: Phaser.GameObjects.Graphics;
  private dotStates: DotState[] = [];
  private lockBar?: Phaser.GameObjects.Graphics;
  private lock = { width: 0 };

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.phase = "done";
    this.puzzle = undefined;
    this.taps = [];
    this.cues = [];
    this.sounds = [];
    this.timers = [];
    this.stripKey = undefined;
  }

  create() {
    const canvas = this.game.canvas;
    this.colors = readPalette(canvas.isConnected ? canvas : document.documentElement);
    this.reducedMotion = prefersReducedMotion();
    this.canHover = mediaMatches("(hover: hover) and (pointer: fine)");
    // Đa chạm: gõ hai ngón cái xen kẽ, mỗi `pointerdown` là một lần gõ dù ngón kia còn chạm.
    if (this.input.manager.pointersTotal < 3) this.input.addPointer(1);

    const onHidden = () => {
      if (this.phase === "listen") {
        // Dừng tiếng đã xếp lịch ngay, quay lại thì chiếu lại cả câu.
        this.replayOnVisible = true;
        this.cues = [];
        this.stopSounds();
      } else if (this.phase === "input" && this.taps.length > 0) {
        // Đang gõ dở: nhịp đã đứt, quay lại thì gửi luôn các lần gõ đã có (sai).
        this.failOnVisible = true;
      }
    };
    const onVisible = () => {
      if (this.replayOnVisible && this.phase === "listen") this.startListen();
      else if (this.failOnVisible && this.phase === "input") this.timeout();
      this.replayOnVisible = false;
      this.failOnVisible = false;
    };
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.game.events.on(Phaser.Core.Events.VISIBLE, onVisible);
    // Bắt phím ở mọi thiết bị có bàn phím (cả máy tính bảng gắn phím).
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    const detach = () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden);
      this.game.events.off(Phaser.Core.Events.VISIBLE, onVisible);
      window.removeEventListener("keydown", this.onKeyDown);
      window.removeEventListener("keyup", this.onKeyUp);
      this.clearTimers();
      this.cues = [];
      this.stopSounds();
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
    if (this.cues.length > 0) {
      const elapsed = performance.now() - this.cueStart;
      while (this.cues.length > 0 && (this.cues[0] as Cue).at <= elapsed) {
        (this.cues.shift() as Cue).run();
      }
    }
    if (
      this.phase === "input" &&
      this.deadline !== undefined &&
      performance.now() > this.deadline
    ) {
      this.timeout();
    }
  }

  // -------------------------------------------------------------- dựng câu đố

  private showPuzzle() {
    // Mọi hẹn giờ, tiếng và tween đang chạy đều thuộc câu cũ: dừng trước khi huỷ.
    this.clearTimers();
    this.cues = [];
    this.stopSounds();
    this.tweens.killAll();
    this.root?.destroy();
    this.removeStrip();

    const puzzle = rhythmEcho.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    this.puzzle = puzzle;
    this.taps = [];
    this.deadline = undefined;
    this.phase = "listen";
    this.replayOnVisible = false;
    this.failOnVisible = false;
    this.lock.width = 0;

    const root = this.add.container(0, 0);
    const stage = this.add.container(0, 0);
    const single = puzzle.drums === 1;
    if (!single) stage.add(this.drawDivider());
    const sides: RhythmEchoSide[] = single ? ["left"] : ["left", "right"];
    this.drums = sides.map((side) => this.makeDrum(side, single, stage));
    if (this.canHover) for (const drum of this.drums) stage.add(this.makeKeys(drum, single));
    this.zones = this.drums.map((drum) => this.makeZone(drum, single));

    const ear = this.add.image(0, 0, this.earTexture());
    const hand = this.add.image(0, 0, this.handTexture()).setVisible(false);
    const status = this.add.container(STATUS.x, STATUS.y, [
      this.add.image(0, 0, this.statusTexture()),
      ear,
      hand,
    ]);
    const dots = this.add.graphics();
    const lockBar = this.add.graphics();
    root.add([stage, status, dots, lockBar, ...this.zones]);

    this.root = root;
    this.stage = stage;
    this.status = status;
    this.ear = ear;
    this.hand = hand;
    this.dots = dots;
    this.lockBar = lockBar;
    this.setDots(puzzle.hits.map(() => "empty"));

    // Câu mới: trống mờ dần vào, biểu tượng tai nảy.
    root.setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: FADE_IN_MS });
    this.pop(status);

    // Bắt đầu lịch trình chiếu sau khung hình đầu tiên để tiếng đầu không bị giật.
    this.events.once(Phaser.Scenes.Events.POST_UPDATE, () => {
      if (this.puzzle === puzzle && this.phase === "listen") this.startListen();
    });
  }

  private makeDrum(
    side: RhythmEchoSide,
    single: boolean,
    stage: Phaser.GameObjects.Container,
  ): DrumView {
    const r = single ? DRUM_R1 : DRUM_R2;
    const x = single ? MID_X : DRUM_X[side];
    const wave = this.add.image(0, 0, this.waveTexture(r)).setAlpha(0);
    const hover = this.add.image(0, 0, this.hoverTexture(r)).setVisible(false);
    const lit = this.add.image(0, 0, this.litTexture(side, r)).setAlpha(0);
    const box = this.add.container(x, DRUM_Y, [
      wave,
      this.add.image(0, 0, this.offTexture(side, r)),
      hover,
      lit,
    ]);
    stage.add(box);
    return { side, r, box, lit, wave, hover };
  }

  /**
   * Vùng chạm là cả nửa màn của trống (360 × 880), Mầm là cả vùng trống (720 × 880): gõ bằng hai
   * ngón cái không cần nhìn. Trên y 360 không nhận chạm. Chỉ bật ở pha gõ.
   */
  private makeZone(drum: DrumView, single: boolean): Phaser.GameObjects.Zone {
    const width = single ? 720 : 360;
    const x = single ? MID_X : DRUM_X[drum.side];
    const zone = this.add
      .zone(x, (ZONE_TOP + ZONE_BOTTOM) / 2, width, ZONE_BOTTOM - ZONE_TOP)
      .setInteractive({ useHandCursor: true });
    zone.disableInteractive();
    zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // Chuột: chỉ nút trái (nút phải mở menu, không tính là gõ).
      if (!pointer.wasTouch && pointer.button !== 0) return;
      this.tap(drum.side, eventTime(pointer.event));
    });
    zone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
      // Máy tính: rê chuột thấy viền mảnh quanh trống.
      if (this.phase === "input" && !pointer.wasTouch) drum.hover.setVisible(true);
    });
    zone.on("pointerout", () => drum.hover.setVisible(false));
    return zone;
  }

  /** Vạch chia hai nửa vùng chạm (nét đứt mờ), chỉ khi có hai trống. */
  private drawDivider() {
    const g = this.add.graphics();
    g.lineStyle(3, toColor(this.colors.cardFg), 0.2);
    for (let y = ZONE_TOP + 40; y < ZONE_BOTTOM - 40; y += 28) {
      g.lineBetween(MID_X, y, MID_X, Math.min(y + 14, ZONE_BOTTOM - 40));
    }
    return g;
  }

  /** Nhãn phím nhỏ dưới mép trống (máy tính): ← A F / → D J; Mầm: ← → và Space. */
  private makeKeys(drum: DrumView, single: boolean): Phaser.GameObjects.Container {
    const labels = single
      ? ["left", "right", "space"]
      : drum.side === "left"
        ? ["left", "A", "F"]
        : ["right", "D", "J"];
    const widths = labels.map((label) => (label === "space" ? KEY_SIZE * 2 : KEY_SIZE));
    const total = widths.reduce((a, b) => a + b, 0) + KEY_GAP * (labels.length - 1);
    const x0 = drum.box.x - total / 2;
    const y = DRUM_Y + drum.r + 50;
    let x = x0;
    const caps = labels.map((label, i) => {
      const w = widths[i] as number;
      const cap = this.add.image(x + w / 2, y, this.keyTexture(label, w));
      x += w + KEY_GAP;
      return cap;
    });
    return this.add.container(0, 0, caps);
  }

  // -------------------------------------------------------------- pha nghe

  /** Chiếu (hoặc chiếu lại) câu nhịp đúng lịch của câu đố, rồi tới lượt gõ. */
  private startListen() {
    const puzzle = this.puzzle;
    if (!puzzle) return;
    this.cues = [];
    this.stopSounds();
    this.phase = "listen";
    for (const drum of this.drums) {
      this.tweens.killTweensOf([drum.lit, drum.wave]);
      drum.lit.setAlpha(0).setScale(1);
      drum.wave.setAlpha(0).setScale(1);
    }
    this.setDots(puzzle.hits.map(() => "empty"));

    // Một mốc chung: đèn theo performance.now(), tiếng theo đồng hồ AudioContext. Tiếng k vang lúc
    // leadMs + hits[k].atMs; chưa phát được tiếng (tắt sfx, chưa mở khoá) thì chỉ có đèn.
    this.cueStart = performance.now();
    const audioStart = sfxNow();
    puzzle.hits.forEach((hit, k) => {
      const at = puzzle.leadMs + hit.atMs;
      if (audioStart !== null) {
        this.sounds.push(playSfx(this.drumSound(hit.side), { when: audioStart + at / 1000 }));
      }
      this.cues.push({
        at,
        run: () => {
          this.flash(hit.side);
          this.setDot(k, "filled");
        },
      });
    });
    // Cùng mốc với miễn trừ thời gian của server (speedAllowanceMs).
    this.cues.push({ at: rhythmEchoListenMs(puzzle), run: () => this.beginInput() });
  }

  /** Tới lượt gõ: tai đổi thành ngón tay (nảy), tiếng "tách", chấm về rỗng, bật vùng chạm. */
  private beginInput() {
    const puzzle = this.puzzle;
    if (!puzzle || this.phase !== "listen") return;
    this.phase = "input";
    this.taps = [];
    this.deadline = undefined;
    this.lastTapAt = { left: -Infinity, right: -Infinity };
    this.ear?.setVisible(false);
    this.hand?.setVisible(true);
    if (this.status) this.pop(this.status);
    playSfx("toggle");
    this.setDots(puzzle.hits.map(() => "empty"));
    for (const zone of this.zones) zone.setInteractive();
  }

  // -------------------------------------------------------------- pha gõ

  private readonly onKeyDown = (event: KeyboardEvent) => {
    const side = this.keySide(event);
    if (side === undefined) return;
    // Có phím bổ trợ, đang gõ chữ hoặc đang mở hộp thoại (Thoát, sheet chat…): không tính.
    if (shouldIgnoreGameKey(event)) return;
    // Không cuộn trang (mũi tên, Space), Space không bấm nút đang được focus.
    event.preventDefault();
    if (event.repeat || !this.sys.isActive()) return;
    this.tap(side, eventTime(event));
  };

  /** Space bấm nút đang focus lúc nhả phím: chặn luôn ở Mầm (Space là phím trống). */
  private readonly onKeyUp = (event: KeyboardEvent) => {
    if (SINGLE_DRUM_KEYS.has(event.code) && this.keySide(event) && !shouldIgnoreGameKey(event)) {
      event.preventDefault();
    }
  };

  private keySide(event: KeyboardEvent): RhythmEchoSide | undefined {
    const puzzle = this.puzzle;
    if (!puzzle) return undefined;
    const side = KEY_SIDES[event.code];
    if (puzzle.drums === 2) return side;
    // Mầm một trống: mọi phím trống và Space đều là trống duy nhất.
    const isDrumKey = side !== undefined || SINGLE_DRUM_KEYS.has(event.code);
    return isDrumKey ? "left" : undefined;
  }

  /**
   * Một lần gõ lúc `ts` (`event.timeStamp`). Bỏ qua ngoài pha gõ và chạm nảy (cùng mặt, sớm hơn
   * 100 ms). Chấm ngay bằng hàm của shared — server chấm lại cả mảng bằng chính hàm này.
   */
  private tap(raw: RhythmEchoSide, ts: number) {
    const puzzle = this.puzzle;
    if (this.phase !== "input" || !puzzle) return;
    // Mầm một trống: mọi lần gõ là "left" (chạm đâu cũng được).
    const side: RhythmEchoSide = puzzle.drums === 1 ? "left" : raw;
    if (ts - this.lastTapAt[side] < RHYTHM_ECHO_DEBOUNCE_MS) return;
    this.lastTapAt[side] = ts;

    if (this.taps.length === 0) this.firstTapAt = ts;
    // Giờ sự kiện chuột/chạm/phím có thể tới không đúng thứ tự vài ms: giữ atMs không giảm để
    // đáp án luôn hợp lệ (isAnswer), không bị server bỏ qua làm lệch câu.
    const prev = this.taps.at(-1)?.atMs ?? 0;
    const atMs = Math.max(prev, Math.round(ts - this.firstTapAt));
    this.taps.push({ side, atMs });
    this.flash(side);
    playSfx(this.drumSound(side));

    const miss = rhythmEchoFirstMiss(puzzle, this.taps);
    if (miss !== -1) {
      this.fail(puzzle, miss, false);
      return;
    }
    this.setDot(this.taps.length - 1, "filled");
    if (this.taps.length === puzzle.hits.length) {
      this.solved();
      return;
    }
    const next = rhythmEchoNextWindow(puzzle, this.taps);
    this.deadline = next ? this.firstTapAt + next.toMs + DEADLINE_SLACK_MS : undefined;
  }

  /** Quá hạn tiếng kế (hoặc ẩn tab giữa lúc gõ): gửi các lần gõ đã có, câu sai. */
  private timeout() {
    const puzzle = this.puzzle;
    if (this.phase !== "input" || !puzzle || this.taps.length === 0) return;
    this.fail(puzzle, this.taps.length, true);
  }

  /** Gửi đáp án (một lần mỗi câu) và khoá nhập. Trả về chỉ số câu vừa gửi. */
  private submit(): number {
    this.phase = "done";
    this.deadline = undefined;
    for (const zone of this.zones) zone.disableInteractive(true);
    for (const drum of this.drums) drum.hover.setVisible(false);
    const index = this.index;
    this.bridge.submit(
      index,
      this.taps.map((t) => ({ side: t.side, atMs: t.atMs })),
    );
    this.index += 1;
    return index;
  }

  private solved() {
    this.submit();
    if (!this.reducedMotion) {
      this.tweens.add({
        targets: this.drums.map((d) => d.box),
        scale: SOLVED_SCALE,
        duration: SOLVED_MS / 2,
        yoyo: true,
        ease: "Quad.easeOut",
      });
    }
    this.after(SOLVED_MS, () => this.showPuzzle());
  }

  /**
   * Sai ở bước `step` (gõ sai mặt / lệch nhịp, hoặc quá hạn): gửi ngay, chấm của bước đó hiện X,
   * trống lắc rồi mờ 35 %, dải nhịp đáp án hiện suốt lúc khoá (CR-006), thanh khoá chạy. Mọi thứ
   * nằm dưới y 360, ngoài dải trên cùng mà huy hiệu khoá của khung che.
   */
  private fail(puzzle: RhythmEchoPuzzle, step: number, timedOut: boolean) {
    const taps = [...this.taps];
    const index = this.submit();
    this.setDot(Math.min(step, puzzle.hits.length - 1), "wrong");

    const struck = timedOut ? undefined : this.drumOf(taps.at(-1)?.side ?? "left");
    if (struck) this.shake(struck.box);
    if (this.stage) {
      this.tweens.add({
        targets: this.stage,
        alpha: DIM_ALPHA,
        duration: DIM_MS,
      });
    }
    this.showStrip(puzzle, taps, step, timedOut);

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

  // -------------------------------------------------------------- đèn, dải nhịp

  private drumOf(side: RhythmEchoSide): DrumView | undefined {
    return this.drums.length === 1 ? this.drums[0] : this.drums.find((d) => d.side === side);
  }

  private drumSound(side: RhythmEchoSide): SfxKind {
    return side === "right" && this.puzzle?.drums === 2 ? "drum-high" : "drum-low";
  }

  /**
   * Trống sáng một tiếng: nền vàng to 106 %, viền phấn, một vòng sóng lan ra. Giảm chuyển động:
   * bỏ phóng to và vòng sóng, giữ đổi độ sáng và viền (là luật chơi khi tắt tiếng).
   */
  private flash(side: RhythmEchoSide) {
    const drum = this.drumOf(side);
    if (!drum) return;
    const { lit, wave } = drum;
    const rest = this.reducedMotion ? 1 : 1 / LIT_SCALE;
    this.tweens.killTweensOf(lit);
    lit.setAlpha(0).setScale(rest);
    this.tweens.add({
      targets: lit,
      alpha: 1,
      scale: 1,
      duration: LIGHT_ON_MS,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: lit,
          alpha: 0,
          scale: rest,
          duration: LIGHT_OFF_MS,
          ease: "Quad.easeIn",
        });
      },
    });
    if (this.reducedMotion) return;
    this.tweens.killTweensOf(wave);
    wave.setAlpha(0.9).setScale(1);
    this.tweens.add({
      targets: wave,
      alpha: 0,
      scale: WAVE_SCALE,
      duration: WAVE_MS,
      ease: "Quad.easeOut",
    });
  }

  /** Dải nhịp đáp án (vẽ một lần thành texture), trượt vào trừ khi giảm chuyển động. */
  private showStrip(
    puzzle: RhythmEchoPuzzle,
    taps: RhythmEchoHit[],
    step: number,
    timedOut: boolean,
  ) {
    const root = this.root;
    if (!root) return;
    this.removeStrip();
    const key = `rhythm-echo:strip:${this.stripSeq++}`;
    this.stripKey = key;
    const pad = 8;
    this.texture(key, STRIP.w + 2 * pad, STRIP.h + 2 * pad, (ctx) => {
      ctx.translate(pad, pad);
      this.drawStrip(ctx, puzzle, taps, step, timedOut);
    });
    const strip = this.add.image(STRIP.x - pad, STRIP.y - pad, key).setOrigin(0, 0);
    // Dải nhịp nằm trên trống đã mờ, dưới thanh khoá.
    root.addAt(strip, root.getIndex(this.lockBar as Phaser.GameObjects.Graphics));
    if (this.reducedMotion) return;
    strip.setAlpha(0).setY(strip.y + 24);
    this.tweens.add({
      targets: strip,
      alpha: 1,
      y: STRIP.y - pad,
      duration: STRIP_IN_MS,
      ease: "Quad.easeOut",
    });
  }

  /**
   * Vẽ dải nhịp, gốc toạ độ ở góc trên trái thẻ (x 40, y 940 của khung):
   * thanh thời gian x 102–642 tỉ lệ để cả câu (và lần gõ muộn nhất) vừa khung, vạch phách mỗi
   * 2 × unitMs; làn trên = trống trái, làn dưới = trống phải (Mầm một làn), đầu làn là hoa văn
   * trống. Tiếng đúng: chấm đặc đánh số. Lần gõ: vòng nét đứt, lần đầu trùng tiếng đầu. Lần gõ sai
   * đầu tiên: dấu X; khung nhận của tiếng đó vẽ thành vạch mờ trên làn đúng. Quá hạn: X ở cuối khung.
   */
  private drawStrip(
    ctx: Ctx,
    puzzle: RhythmEchoPuzzle,
    taps: RhythmEchoHit[],
    step: number,
    timedOut: boolean,
  ) {
    const c = this.colors;
    const { w, h } = STRIP;
    const single = puzzle.drums === 1;
    const laneY = (side: RhythmEchoSide) => (single ? h / 2 : side === "left" ? 76 : 150);
    const lanes: RhythmEchoSide[] = single ? ["left"] : ["left", "right"];
    const accept = step > 0 ? rhythmEchoNextWindow(puzzle, taps.slice(0, step)) : undefined;
    const missHit = puzzle.hits[step];

    const end = Math.max(
      rhythmEchoSpanMs(puzzle),
      taps.at(-1)?.atMs ?? 0,
      accept?.toMs ?? 0,
      puzzle.unitMs * 2,
    );
    const xAt = (ms: number) => BAR_FROM + (ms / end) * BAR_WIDTH;

    // Thẻ giấy: bóng đổ + nền + viền mực.
    ctx.beginPath();
    roundRectPath(ctx, 0, 6, w, h, 28);
    ctx.fillStyle = c.sticker;
    ctx.fill();
    ctx.beginPath();
    roundRectPath(ctx, 0, 0, w, h, 28);
    ctx.fillStyle = c.card;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = c.sticker;
    ctx.stroke();

    // Vạch phách mờ mỗi 2 × unitMs.
    const top = single ? h / 2 - 44 : 40;
    const bottom = single ? h / 2 + 44 : 186;
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = c.cardFg;
    ctx.lineWidth = 2;
    for (let ms = 0; ms <= end + 1; ms += puzzle.unitMs * 2) {
      ctx.beginPath();
      ctx.moveTo(xAt(ms), top);
      ctx.lineTo(xAt(ms), bottom);
      ctx.stroke();
    }
    ctx.restore();

    // Làn: đường kẻ + hoa văn trống ở đầu làn.
    for (const side of lanes) {
      const y = laneY(side);
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = c.cardFg;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(BAR_FROM, y);
      ctx.lineTo(BAR_FROM + BAR_WIDTH, y);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.translate(LANE_ICON_X, y);
      circlePath(ctx, 0, 0, LANE_ICON_R);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      drawPattern(ctx, side, LANE_ICON_R, c.chalk, 1.8);
      ctx.restore();
    }

    // Khung nhận của tiếng bị sai (sớm quá / muộn quá / sai trống), trên làn đúng của tiếng đó.
    if (accept && missHit) {
      const y = laneY(missHit.side);
      const x0 = xAt(Math.max(0, accept.fromMs));
      const x1 = xAt(accept.toMs);
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = c.primary;
      ctx.beginPath();
      roundRectPath(ctx, x0, y - 20, Math.max(4, x1 - x0), 40, 10);
      ctx.fill();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = c.cardFg;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x0, y - 24);
      ctx.lineTo(x0, y + 24);
      ctx.moveTo(x1, y - 24);
      ctx.lineTo(x1, y + 24);
      ctx.stroke();
      ctx.restore();
    }

    // Tiếng đúng: chấm đặc Ø 28 đánh số 1…N.
    puzzle.hits.forEach((hit, k) => {
      const x = xAt(hit.atMs);
      const y = laneY(hit.side);
      circlePath(ctx, x, y, 14);
      ctx.fillStyle = c.cardFg;
      ctx.fill();
      drawDigit(ctx, k + 1, x, y, 18, c.card);
    });

    // Lần gõ của người chơi: vòng rỗng nét đứt Ø 36 (bao quanh chấm nếu gõ trúng).
    ctx.save();
    ctx.strokeStyle = c.cardFg;
    ctx.lineWidth = 3;
    ctx.lineCap = "butt";
    ctx.setLineDash(evenDash(18, [6, 5]));
    for (const tap of taps) {
      circlePath(ctx, xAt(tap.atMs), laneY(single ? "left" : tap.side), 18);
      ctx.stroke();
    }
    ctx.restore();

    // Dấu X của lần gõ sai đầu tiên; quá hạn thì ở cuối khung nhận trên làn đúng.
    const wrongTap = timedOut ? undefined : taps[step];
    const cross = wrongTap
      ? { x: xAt(wrongTap.atMs), y: laneY(single ? "left" : wrongTap.side) }
      : accept && missHit
        ? { x: xAt(accept.toMs), y: laneY(missHit.side) }
        : undefined;
    if (cross) {
      const a = 11;
      const path = new Path2D(
        `M${cross.x - a} ${cross.y - a} L${cross.x + a} ${cross.y + a} M${cross.x + a} ${cross.y - a} L${cross.x - a} ${cross.y + a}`,
      );
      ctx.lineWidth = 12;
      ctx.strokeStyle = c.chalk;
      ctx.stroke(path);
      ctx.lineWidth = 6;
      ctx.strokeStyle = c.destructive;
      ctx.stroke(path);
    }
  }

  private removeStrip() {
    const key = this.stripKey;
    this.stripKey = undefined;
    if (key && this.textures.exists(key)) this.textures.remove(key);
  }

  // -------------------------------------------------------------- dải chấm, thanh khoá

  private setDots(states: DotState[]) {
    this.dotStates = states;
    this.drawDots();
  }

  private setDot(k: number, state: DotState) {
    if (k < 0 || k >= this.dotStates.length) return;
    this.dotStates[k] = state;
    this.drawDots();
  }

  /** N chấm Ø 28, không mang thông tin trái/phải: đặc = đã vang / đã gõ khớp, X = bước sai. */
  private drawDots() {
    const g = this.dots;
    if (!g) return;
    const c = this.colors;
    const ink = toColor(c.cardFg);
    g.clear();
    const count = this.dotStates.length;
    this.dotStates.forEach((state, k) => {
      const x = MID_X + (k - (count - 1) / 2) * DOT_PITCH;
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

  // -------------------------------------------------------------- hiệu ứng, hẹn giờ, tiếng

  /** Nảy nhẹ (đổi pha, câu mới). Bỏ qua khi bật giảm chuyển động. */
  private pop(target: Phaser.GameObjects.Container) {
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

  /** Lắc ngang ±8 px trong 200 ms rồi về chỗ cũ. Bỏ qua khi bật giảm chuyển động. */
  private shake(target: Phaser.GameObjects.Container) {
    if (this.reducedMotion) return;
    const x = target.x;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: SHAKE_MS,
      onUpdate: (tween) =>
        target.setX(x + SHAKE_PX * Math.sin((tween.getValue() ?? 0) * 2 * 2 * Math.PI)),
      onComplete: () => target.setX(x),
    });
  }

  private after(ms: number, callback: () => void) {
    this.timers.push(this.time.delayedCall(ms, callback));
  }

  private clearTimers() {
    for (const timer of this.timers) timer.remove(false);
    this.timers = [];
  }

  private stopSounds() {
    for (const stop of this.sounds) stop();
    this.sounds = [];
  }

  // -------------------------------------------------------------- texture (vẽ một lần)

  /** Tạo texture từ canvas 2D (gốc toạ độ ở góc trên trái) nếu chưa có; trả về khoá. */
  private texture(key: string, width: number, height: number, draw: (ctx: Ctx) => void): string {
    if (this.textures.exists(key)) return key;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      draw(ctx);
    }
    this.textures.addCanvas(key, canvas);
    return key;
  }

  /** Texture vuông, gốc toạ độ ở tâm. */
  private centered(key: string, size: number, draw: (ctx: Ctx) => void): string {
    return this.texture(key, size, size, (ctx) => {
      ctx.translate(Math.ceil(size) / 2, Math.ceil(size) / 2);
      draw(ctx);
    });
  }

  /**
   * Trống tắt: mặt mực (chênh độ sáng với trống sáng vàng ≥ 4,5 : 1 ở cả hai giao diện), viền
   * (tối: phấn mờ để tách khỏi nền), hoa văn phấn mờ.
   */
  private offTexture(side: RhythmEchoSide, r: number) {
    const c = this.colors;
    return this.centered(`rhythm-echo:off:${side}:${r}`, 2 * r + 8, (ctx) => {
      circlePath(ctx, 0, 0, r);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.dark ? c.chalkMuted : c.sticker;
      ctx.stroke();
      ctx.globalAlpha = 0.45;
      drawPattern(ctx, side, r, c.chalk, r * 0.035);
    });
  }

  /** Trống sáng: nền vàng to 106 %, viền mực + viền phấn 6 px bên trong, hoa văn mực. */
  private litTexture(side: RhythmEchoSide, r: number) {
    const c = this.colors;
    const big = r * LIT_SCALE;
    return this.centered(`rhythm-echo:lit:${side}:${r}`, 2 * big + 10, (ctx) => {
      circlePath(ctx, 0, 0, big);
      ctx.fillStyle = c.primary;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      circlePath(ctx, 0, 0, big - 9);
      ctx.lineWidth = 6;
      ctx.strokeStyle = c.chalk;
      ctx.stroke();
      ctx.globalAlpha = 0.85;
      drawPattern(ctx, side, big - 6, c.primaryFg, r * 0.035);
    });
  }

  /** Vòng sóng lan ra quanh trống sáng: vàng viền mực để rõ trên nền sáng lẫn tối. */
  private waveTexture(r: number) {
    const c = this.colors;
    const ring = r * LIT_SCALE + 6;
    return this.centered(`rhythm-echo:wave:${r}`, 2 * ring + 16, (ctx) => {
      circlePath(ctx, 0, 0, ring);
      ctx.lineWidth = 11;
      ctx.strokeStyle = c.sticker;
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.strokeStyle = c.primary;
      ctx.stroke();
    });
  }

  /** Rê chuột (máy tính) lúc tới lượt: viền mảnh nét đứt quanh trống. */
  private hoverTexture(r: number) {
    const c = this.colors;
    const ring = r + 16;
    return this.centered(`rhythm-echo:hover:${r}`, 2 * ring + 8, (ctx) => {
      circlePath(ctx, 0, 0, ring);
      ctx.setLineDash(evenDash(ring, [12, 9]));
      ctx.lineCap = "butt";
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = c.cardFg;
      ctx.stroke();
    });
  }

  /** Nhãn phím: nắp phím giấy viền mực, bóng đổ; mũi tên và Space vẽ bằng nét. */
  private keyTexture(label: string, width: number) {
    const c = this.colors;
    const h = KEY_SIZE;
    return this.texture(`rhythm-echo:key:${label}`, width + 6, h + 10, (ctx) => {
      ctx.translate(3, 3);
      ctx.beginPath();
      roundRectPath(ctx, 0, 4, width, h, 10);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      ctx.beginPath();
      roundRectPath(ctx, 0, 0, width, h, 10);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = c.cardFg;
      ctx.stroke();
      ctx.translate(width / 2, h / 2);
      ctx.strokeStyle = c.cardFg;
      ctx.lineWidth = 3.5;
      if (label === "left" || label === "right") {
        if (label === "right") ctx.scale(-1, 1);
        ctx.stroke(new Path2D("M10 0 L-10 0 M-3 -7 L-10 0 L-3 7"));
        return;
      }
      if (label === "space") {
        ctx.stroke(new Path2D("M-16 -4 L-16 5 L16 5 L16 -4"));
        return;
      }
      ctx.fillStyle = c.cardFg;
      ctx.font = `700 22px "Be Vietnam Pro", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 0, 1);
    });
  }

  /** Nền tròn của biểu tượng pha: thẻ giấy viền mực, bóng đổ xuống dưới. */
  private statusTexture() {
    const c = this.colors;
    const { r } = STATUS;
    return this.centered("rhythm-echo:status", 2 * (r + 9), (ctx) => {
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

  /** Pha nghe: cái tai. */
  private earTexture() {
    const c = this.colors;
    return this.centered("rhythm-echo:ear", 90, (ctx) => {
      ctx.scale(3.2, 3.2);
      ctx.translate(-12.5, -12);
      ctx.lineWidth = 2;
      ctx.strokeStyle = c.cardFg;
      ctx.stroke(new Path2D(EAR_PATH));
    });
  }

  /** Pha gõ: ngón tay chỉ (cùng hình với Theo dấu ánh đèn). */
  private handTexture() {
    const c = this.colors;
    return this.centered("rhythm-echo:hand", 90, (ctx) => {
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
}
