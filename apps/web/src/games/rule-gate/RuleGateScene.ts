import {
  RULE_GATE_FEATURE_ATTR,
  type RuleGateAnswer,
  type RuleGateBuddy,
  type RuleGateFeature,
  type RuleGateItem,
  type RuleGatePuzzle,
  type RuleGateRule,
  type RuleGateSpecies,
  type RuleGateTerm,
  ruleGate,
  ruleGateHas,
  ruleGateTermHolds,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import { currentLanguage } from "@/i18n";
import type { Ctx } from "../_shared/canvas";
import {
  type Art,
  type Box,
  circle,
  ellipse,
  fill,
  grain,
  paintArt,
  placeArt,
  rgba,
  roundRect,
  stroke,
} from "../_shared/chalk";
import { shouldIgnoreGameKey } from "../keyboard";
import type { MinigameBridge } from "../types";
import {
  drawBan,
  drawBuddyBase,
  drawCrossMark,
  drawFeatureChalk,
  drawGlasses,
  drawHat,
  drawItem,
  drawTickBadge,
  drawTicket,
  drawTicketBack,
} from "./art";
import { sceneText } from "./locales";
import {
  afterAnswer,
  classifyGesture,
  isArrowKey,
  keySide,
  type LogEntry,
  logColumns,
  pushLog,
  ruleKey,
  seedLog,
  TICKET_SINGLE_W,
  ticketLayout,
} from "./play-state";
import {
  ARROW_LEFT,
  BUDDY_ANCHOR,
  FEATURE_RING,
  GATE_ICON,
  HOUSE_ICON,
  PLUS,
  SLASH,
  SPECIES,
} from "./shapes";

/*
 * Cổng luật — bạn nào khớp vé trên bảng thì cho vào cổng (vuốt trái), không khớp thì mời về nhà
 * (vuốt phải). Đặc tả: docs/04-minigames/rule-gate.md (mục "Ghi chú cho FE", "Hiện đáp án đúng khi
 * sai"). Chưa có bản mẫu: bố cục theo bảng toạ độ của đặc tả.
 *
 * Mọi hình (bạn, phụ kiện, biểu tượng phấn, vé, cổng, nhà) vẽ MỘT lần ra canvas 2D rồi dùng làm
 * texture (khoá theo hình + màu); mỗi câu chỉ đặt ảnh và chạy tween. Canvas trong suốt trên nền
 * giấy (`bg-muted`) của khung chơi, nên màu lấy từ token CSS và đọc lại mỗi câu (đổi sáng/tối).
 */

// ─── Màu ────────────────────────────────────────────────────────────────────────────────────────

const TOKENS = {
  /** Mặt nút, thanh khoá, tường nhà. */
  card: "--card",
  /** Biểu tượng trên nút, viền cảnh (cổng, nhà) để rõ trên giấy sáng lẫn tối. */
  text: "--card-foreground",
  /** Viền, bóng đổ nút / bảng. */
  sticker: "--sticker",
  /** Nút đúng, vòng khoanh, khung bảng nháy, nhãn "Vé mới!". */
  primary: "--primary",
  /** Dấu ✗, biển cấm. */
  destructive: "--destructive",
  /** Viền trong của bảng (màu nhóm Phân tích). */
  analyze: "--color-analyze",
  /** Mặt bảng vé. */
  board: "--board",
  /** Nét phấn trên bảng. */
  chalk: "--chalk",
  /** Nỉ khăn lau bảng. */
  chalkMuted: "--chalk-muted",
  /** Cổng gỗ, mái nhà. */
  wood: "--wood",
  /** Biểu tượng trên nút đang sáng vàng. */
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
  chalk: "#f6f3ea",
  chalkMuted: "#d5e4dc",
  wood: "#a8693b",
  ink: "#1f1b3a",
};

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

// ─── Bố cục (px trong khung 720×1280), theo bảng Ghi chú cho FE ────────────────────────────────

/** Bảng vé x 60–660, y 240–500: dưới dải huy hiệu khoá (tới y ≈ 225). */
const BOARD = { x: 60, y: 240, w: 600, h: 260, r: 24, inset: 9 };
const TICKET_Y = 372;
const TICKET_H = 180;
/** Tâm cụm vé (mức hiện luật): chừa bên trái cho cổng nhỏ + mũi tên "vé là điều kiện để vào". */
const TICKETS_CX = 420;
const GATE_HINT = { iconX: 114, arrowX: 186 };
/** Dấu ✓ / ✗ cạnh từng biểu tượng trên vé (so với tâm biểu tượng). */
const MARK_AT = { x: 60, y: -62 };
/** Nhãn "Vé mới!" dán ở mép trên bên phải bảng. */
const NEW_TAG = { x: 560, y: 252, h: 46, angle: -4 };

/** Siêu khó: vé úp bên trái, sổ cổng hai cột bên phải. */
const BACK = { cx: 165, w: 170 };
const LOG = {
  headerY: 288,
  rows: [352, 434] as const,
  cols: { in: 361, out: 555 } as Record<RuleGateAnswer, number>,
  dx: 44,
  dividerX: 458,
};
/** Bạn trong sổ ~64 px. */
const MINI_ZOOM = 0.34;
const MINI_HALO = 7;

/** Bạn đứng trước cổng: điểm neo (giữa thân) ở x 360; chân chạm đất y 930; cao ~300 px. */
const BUDDY = { x: 360, y: 802, zoom: 1.56 };
const MAIN_HALO = 4;
const GROUND_Y = 930;
/** Chỗ bạn biến mất khi đi vào cổng / về nhà (tâm, tỉ lệ). */
const EXIT: Record<RuleGateAnswer, { x: number; y: number; scale: number }> = {
  in: { x: 112, y: 860, scale: 0.55 },
  out: { x: 608, y: 879, scale: 0.4 },
};
/** Sai: bạn đi chậm về phía đúng rồi dừng giữa đường. */
const HALFWAY: Record<RuleGateAnswer, number> = { in: 262, out: 458 };

/** Hai nút: hàng y 1040–1170, nút Cổng x 40–340, nút Nhà x 380–680. */
const BUTTON = { y: 1105, w: 300, h: 130, r: 24, edge: 4, shadow: 6 };
const BUTTON_XS: Record<RuleGateAnswer, number> = { in: 190, out: 530 };
const BADGE_AT = { x: 128, y: -58 };
const HOVER_LIFT = 4;
const PRESS_SINK = 3;
/** Nhãn phím nhỏ trên nút (máy tính). Là ký hiệu phím, không dịch. */
const KEY_LABELS: Record<RuleGateAnswer, string> = { in: "← / A", out: "→ / D" };

/** Thanh khoá khi sai. */
const LOCK = { x: 150, y: 1206, w: 420, h: 14 };

// ─── Chuyển động ───────────────────────────────────────────────────────────────────────────────

/** Bạn mới trượt từ dưới lên. */
const ENTER_MS = 200;
const ENTER_RISE = 90;
/** Đúng: bạn đi qua cổng / về nhà; sau đó bạn mới (server tính phần này vào câu sau, giữ ≤ 300). */
const WALK_MS = 250;
const NEXT_AFTER_HIT_MS = 300;
/** Sai: đi chậm về phía đúng. */
const WALK_SLOW_MS = 900;
/** Siêu khó: bạn thu nhỏ bay vào sổ. */
const FLY_MS = 250;
const FLY_MISS_MS = 520;
const FADE_MS = 150;
const BOB_PX = 12;
const BOB_MS = 80;
/** Vé mới: khăn lau quệt vé cũ, vé mới hiện như vừa vẽ phấn, khung bảng nháy vàng 2 lần. */
const WIPE_MS = 300;
const DRAW_MS = 300;
const FLASH_MS = 130;
const FLIP_MS = 120;
const DUST_MS = 320;
const SHAKE_PX = 8;
const SHAKE_MS = 200;
const SHAKE_TIMES = 3;
const PRESS_MS = 90;

/** Chờ font tối đa bấy nhiêu ms rồi vẽ bằng font dự phòng. */
const FONT_TIMEOUT_MS = 1500;
const FONT = '"Baloo 2", "Be Vietnam Pro", sans-serif';

/** Texture vẽ ở độ phân giải gấp đôi khung thiết kế cho nét sắc trên màn mật độ cao. */
const RES = 2;
const TAU = Math.PI * 2;

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

function termAt(rule: RuleGateRule, index: 0 | 1): RuleGateTerm | undefined {
  return (rule.terms as readonly RuleGateTerm[])[index];
}

// ─── Scene ────────────────────────────────────────────────────────────────────────────────────

interface ButtonView {
  side: RuleGateAnswer;
  x: number;
  /** Mặt nút, biểu tượng, nhãn phím, dấu ✓/✗: nhấc lên khi rê chuột, lún khi bấm phím. */
  body: Phaser.GameObjects.Container;
  face: Phaser.GameObjects.Graphics;
  icons: { image: Phaser.GameObjects.Image; shape: "gate" | "house" | "arrow" }[];
  label?: Phaser.GameObjects.Text;
  tick: Phaser.GameObjects.Image;
  cross: Phaser.GameObjects.Image;
}

type ButtonState = "idle" | "right" | "wrong";

/** Vé (hoặc cụm vé) đang vẽ trên bảng. `root` đặt ở tâm cụm để lật / phóng quanh tâm. */
interface TicketView {
  key: string;
  root: Phaser.GameObjects.Container;
  /** Luật vẽ trên vé; không có = vé úp. */
  rule?: RuleGateRule;
  /** Biểu tượng: vế và vị trí ngang so với tâm cụm. */
  icons: { term: 0 | 1; dx: number }[];
  /** Dấu ✓ / ✗ lúc hiện đáp án; gỡ ở câu sau (vé có thể giữ nguyên cho bạn kế tiếp). */
  marks: Phaser.GameObjects.Image[];
}

/** Một bạn: `root` mang bóng đổ, `bob` mang hình (nảy khi đi, có vòng khoanh lúc hiện đáp án). */
interface BuddyView {
  root: Phaser.GameObjects.Container;
  bob: Phaser.GameObjects.Container;
  shadow?: Phaser.GameObjects.Graphics;
  zoom: number;
}

/** Cổng luật — cho vào (trái) hay mời về (phải) theo vé trên bảng. */
export default class RuleGateScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = true;
  private reducedMotion = false;
  private canHover = false;
  private palette!: Palette;
  private puzzle?: RuleGatePuzzle;

  /** Sổ cổng (Siêu khó): 4 bạn gần nhất theo đáp án đúng; không xoá khi luật đổi ngầm. */
  private log: LogEntry[] = [];
  /** Số câu sai liền (Siêu khó), để lật vé gợi ý sau 2 câu. */
  private missStreak = 0;

  /** Lớp vẽ theo thứ tự: cảnh tĩnh → vé → sổ → bạn → hiệu ứng → nút. */
  private staticLayer?: Phaser.GameObjects.Container;
  private ticketLayer?: Phaser.GameObjects.Container;
  private logLayer?: Phaser.GameObjects.Container;
  private buddyLayer?: Phaser.GameObjects.Container;
  private fxLayer?: Phaser.GameObjects.Container;
  private uiLayer?: Phaser.GameObjects.Container;

  /** Phần tĩnh vẽ theo bảng màu + mức: bảng, cổng, nhà, nút. */
  private staticId = "";
  private buttons: ButtonView[] = [];
  private hovered?: ButtonView;
  private ticket?: TicketView;
  /** Vé cũ đang bị khăn lau quệt đi. */
  private oldTicket?: TicketView;
  private eraser?: Phaser.GameObjects.Image;
  private flash?: Phaser.GameObjects.Graphics;
  private newTag?: Phaser.GameObjects.Container;
  private buddy?: BuddyView;
  private lockBar?: Phaser.GameObjects.Graphics;
  /** Đã nhấn trong khung (thả mà chưa nhấn trong khung thì không tính là vuốt/chạm). */
  private pressed = false;
  private onKey = (event: KeyboardEvent) => this.handleKey(event);

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.locked = true;
    this.puzzle = undefined;
    this.staticId = "";
    this.ticket = undefined;
    this.missStreak = 0;
    // Vào giữa vòng (nối lại): dựng lại sổ từ các câu trước để sổ không đổi khi rớt mạng.
    this.log = seedLog(data.bridge.seed, data.bridge.startIndex, data.bridge.difficulty);
  }

  create() {
    this.canHover = mediaMatches("(hover: hover) and (pointer: fine)");
    this.staticLayer = this.add.container(0, 0);
    this.ticketLayer = this.add.container(0, 0);
    this.logLayer = this.add.container(0, 0);
    this.buddyLayer = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0);
    this.uiLayer = this.add.container(0, 0);

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

    // Hết vòng hoặc rời màn: dừng hẳn mọi tween, hẹn giờ và bỏ nghe phím. Sổ cổng xoá khi hết vòng.
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
    this.log = [];
    this.buttons = [];
    this.hovered = undefined;
    this.ticket = undefined;
    this.oldTicket = undefined;
    this.buddy = undefined;
  }

  private next() {
    this.locked = false;
    this.showPuzzle();
  }

  // ── Câu đố ──

  private showPuzzle() {
    this.settleTicket();
    // Mọi tween còn lại thuộc câu cũ (bạn đi, nảy, rung nút, thanh khoá): dừng trước khi huỷ.
    this.tweens.killAll();
    this.buddy?.root.destroy();
    this.buddy = undefined;
    this.lockBar?.destroy();
    this.lockBar = undefined;
    this.newTag?.destroy();
    this.newTag = undefined;
    this.fxLayer?.removeAll(true);

    this.reducedMotion = prefersReducedMotion();
    this.palette = readPalette(this.game.canvas);
    const puzzle = ruleGate.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    this.puzzle = puzzle;
    this.drawStatic(puzzle.ruleShown);
    for (const button of this.buttons) this.paintButton(button, "idle");
    this.updateTicket(puzzle);
    if (!puzzle.ruleShown) this.drawLog(false);
    this.enterBuddy(puzzle.buddy);
  }

  // ── Vé ──

  /** Vẽ lại vé khi luật trên bảng khác luật của câu (hoặc đổi màu). Siêu khó: luôn vé úp. */
  private updateTicket(puzzle: RuleGatePuzzle) {
    const id = this.palette.id;
    const key = puzzle.ruleShown ? `${id}|${ruleKey(puzzle.rule)}` : `${id}|back`;
    const old = this.ticket;
    if (old?.key === key) {
      for (const mark of old.marks) mark.destroy();
      old.marks = [];
      return;
    }
    const view = puzzle.ruleShown
      ? this.buildTicket(puzzle.rule, TICKETS_CX, TICKET_SINGLE_W, key)
      : this.buildBack(key);
    this.ticket = view;

    if (puzzle.ruleShown && puzzle.ruleIsNew) {
      this.renewTicket(old, view);
      return;
    }
    if (old && !puzzle.ruleShown) {
      // Úp lại vé sau lần gợi ý.
      this.flip(old, view);
      return;
    }
    old?.root.destroy();
    if (!this.reducedMotion) {
      view.root.setAlpha(0);
      this.tweens.add({ targets: view.root, alpha: 1, duration: FADE_MS });
    }
  }

  private buildTicket(
    rule: RuleGateRule,
    center: number,
    singleW: number,
    key: string,
  ): TicketView {
    const layout = ticketLayout(rule, center, singleW);
    const root = this.add.container(center, TICKET_Y);
    const icons: TicketView["icons"] = [];
    for (const ticket of layout.tickets) {
      root.add(this.place(this.ticketArt(ticket.w)).setPosition(ticket.cx - center, 0));
      for (const icon of ticket.icons) {
        const term = termAt(rule, icon.term);
        if (!term) continue;
        const dx = icon.x - center;
        root.add(this.place(this.iconArt(term.feature)).setPosition(dx, 0));
        if (term.negated) root.add(this.place(this.banArt()).setPosition(dx, 0));
        icons.push({ term: icon.term, dx });
      }
    }
    if (layout.joiner) {
      root.add(
        this.place(this.joinerArt(layout.joiner.kind)).setPosition(layout.joiner.x - center, 0),
      );
    }
    this.ticketLayer?.add(root);
    return { key, root, rule, icons, marks: [] };
  }

  private buildBack(key: string): TicketView {
    const root = this.add.container(BACK.cx, TICKET_Y, [this.place(this.backArt())]);
    this.ticketLayer?.add(root);
    return { key, root, icons: [], marks: [] };
  }

  /**
   * Vé mới (`ruleIsNew`): khăn lau quệt vé cũ (300 ms), vé mới hiện như vừa vẽ phấn (300 ms, có bụi
   * phấn), khung bảng nháy vàng 2 lần, nhãn "Vé mới!". Giảm chuyển động: không khăn lau, khung nháy
   * một lần, giữ nhãn. Bạn vẫn vuốt được ngay trong lúc đó.
   */
  private renewTicket(old: TicketView | undefined, view: TicketView) {
    this.drawFlash(this.reducedMotion ? 0 : 1);
    this.drawNewTag();
    if (this.reducedMotion) {
      old?.root.destroy();
      return;
    }
    if (old) {
      this.oldTicket = old;
      const eraser = this.place(this.eraserArt()).setPosition(BOARD.x + 70, TICKET_Y - 20);
      eraser.setAngle(-8);
      this.fxLayer?.add(eraser);
      this.eraser = eraser;
      this.tweens.add({
        targets: eraser,
        x: BOARD.x + BOARD.w - 60,
        y: TICKET_Y + 24,
        angle: 6,
        duration: WIPE_MS,
        ease: "Sine.easeInOut",
        onComplete: () => {
          eraser.destroy();
          if (this.eraser === eraser) this.eraser = undefined;
        },
      });
      this.tweens.add({
        targets: old.root,
        alpha: 0,
        duration: WIPE_MS,
        onComplete: () => {
          old.root.destroy();
          if (this.oldTicket === old) this.oldTicket = undefined;
        },
      });
    }
    const delay = old ? WIPE_MS / 2 : 0;
    view.root.setAlpha(0).setScale(0.94);
    this.tweens.add({
      targets: view.root,
      alpha: 1,
      scale: 1,
      delay,
      duration: DRAW_MS,
      ease: "Quad.easeOut",
    });
    const dust = this.dustArt();
    for (const icon of view.icons) {
      const puff = this.place(dust)
        .setPosition(view.root.x + icon.dx, TICKET_Y)
        .setAlpha(0);
      this.fxLayer?.add(puff);
      this.tweens.add({
        targets: puff,
        alpha: { from: 0.9, to: 0 },
        scale: puff.scale * 1.7,
        delay,
        duration: DUST_MS,
        ease: "Quad.easeOut",
      });
    }
  }

  /** Lật vé: vé cũ khép lại theo chiều ngang, vé mới mở ra (gợi ý Siêu khó và úp lại sau đó). */
  private flip(old: TicketView, view: TicketView) {
    if (this.reducedMotion) {
      old.root.destroy();
      return;
    }
    this.oldTicket = old;
    this.tweens.add({
      targets: old.root,
      scaleX: 0,
      duration: FLIP_MS,
      ease: "Quad.easeIn",
      onComplete: () => {
        old.root.destroy();
        if (this.oldTicket === old) this.oldTicket = undefined;
      },
    });
    view.root.setScale(0, 1);
    this.tweens.add({
      targets: view.root,
      scaleX: 1,
      delay: FLIP_MS,
      duration: FLIP_MS,
      ease: "Quad.easeOut",
    });
  }

  /** Dừng hiệu ứng vé đang chạy, đưa về trạng thái cuối (trước câu mới hoặc khi hiện đáp án). */
  private settleTicket() {
    if (this.oldTicket) {
      this.tweens.killTweensOf(this.oldTicket.root);
      this.oldTicket.root.destroy();
      this.oldTicket = undefined;
    }
    if (this.eraser) {
      this.tweens.killTweensOf(this.eraser);
      this.eraser.destroy();
      this.eraser = undefined;
    }
    if (this.flash) {
      this.tweens.killTweensOf(this.flash);
      this.flash.destroy();
      this.flash = undefined;
    }
    if (this.ticket) {
      this.tweens.killTweensOf(this.ticket.root);
      this.ticket.root.setAlpha(1).setScale(1);
    }
    if (this.newTag) {
      this.tweens.killTweensOf(this.newTag);
      this.newTag.setScale(1).setAlpha(1);
    }
  }

  /** Khung bảng nháy vàng (`repeat` + 1 lần). */
  private drawFlash(repeat: number) {
    const { primary } = this.palette;
    const inner = BOARD.inset;
    const flash = this.add.graphics();
    flash
      .lineStyle(10, primary.num)
      .strokeRoundedRect(
        BOARD.x + inner,
        BOARD.y + inner,
        BOARD.w - inner * 2,
        BOARD.h - inner * 2,
        BOARD.r - 8,
      );
    flash.setAlpha(0);
    this.fxLayer?.add(flash);
    this.flash = flash;
    this.tweens.add({
      targets: flash,
      alpha: 1,
      duration: FLASH_MS,
      yoyo: true,
      repeat,
      onComplete: () => {
        flash.destroy();
        if (this.flash === flash) this.flash = undefined;
      },
    });
  }

  /** Nhãn "Vé mới!" (chữ qua `sceneText`), dán ở mép trên bảng; sống hết câu đầu khối. */
  private drawNewTag() {
    const { primary, sticker, ink } = this.palette;
    const caption = this.add
      .text(0, 0, sceneText[currentLanguage()].newTicket, {
        fontFamily: FONT,
        fontStyle: "800",
        fontSize: "28px",
        color: ink.css,
      })
      .setOrigin(0.5);
    const w = Math.min(220, caption.width + 40);
    if (caption.width > w - 28) caption.setScale((w - 28) / caption.width);
    const h = NEW_TAG.h;
    const pill = this.add.graphics();
    pill.fillStyle(sticker.num).fillRoundedRect(-w / 2, -h / 2 + 5, w, h, h / 2);
    pill.fillStyle(primary.num).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    pill.lineStyle(4, sticker.num).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    const tag = this.add.container(NEW_TAG.x, NEW_TAG.y, [pill, caption]);
    tag.setAngle(NEW_TAG.angle);
    this.uiLayer?.add(tag);
    this.newTag = tag;
    if (!this.reducedMotion) {
      tag.setScale(0.6);
      this.tweens.add({ targets: tag, scale: 1, duration: 180, ease: "Back.easeOut" });
    }
  }

  /** Sai ở mức hiện luật: ✓ (khớp) / ✗ (không khớp) cạnh từng biểu tượng trên vé. */
  private markTicket(view: TicketView, buddy: RuleGateBuddy) {
    const rule = view.rule;
    if (!rule) return;
    for (const icon of view.icons) {
      const term = termAt(rule, icon.term);
      if (!term) continue;
      const art = ruleGateTermHolds(buddy, term) ? this.tickArt() : this.crossArt();
      const mark = this.place(art).setPosition(icon.dx + MARK_AT.x, MARK_AT.y);
      view.root.add(mark);
      view.marks.push(mark);
    }
  }

  // ── Sổ cổng (Siêu khó) ──

  private slotAt(side: RuleGateAnswer, slot: number): { x: number; y: number } {
    const row = LOG.rows[Math.min(1, Math.floor(slot / 2))] ?? LOG.rows[0];
    // Điểm neo bạn ở giữa thân, hơi thấp hơn tâm hình (tai ở trên).
    return { x: LOG.cols[side] + (slot % 2 ? LOG.dx : -LOG.dx), y: row + 4 };
  }

  /** Vẽ lại sổ: mới nhất đầu mỗi cột; `highlight` khoanh bạn mới nhất (câu vừa sai). */
  private drawLog(highlight: boolean) {
    const layer = this.logLayer;
    if (!layer) return;
    layer.removeAll(true);
    const columns = logColumns(this.log);
    const newest = this.log[this.log.length - 1];
    for (const side of ["in", "out"] as const) {
      for (const { entry, slot } of columns[side]) {
        const at = this.slotAt(side, slot);
        if (highlight && entry === newest) {
          const { sticker, primary } = this.palette;
          const ring = this.add.graphics();
          ring.lineStyle(8, sticker.num).strokeCircle(at.x, at.y - 4, 40);
          ring.lineStyle(5, primary.num).strokeCircle(at.x, at.y - 4, 40);
          layer.add(ring);
        }
        const mini = this.makeBuddy(entry.buddy, MINI_ZOOM, MINI_HALO, false);
        mini.root.setPosition(at.x, at.y);
        layer.add(mini.root);
      }
    }
  }

  // ── Bạn ──

  private makeBuddy(buddy: RuleGateBuddy, zoom: number, halo: number, shadow: boolean): BuddyView {
    const parts: Phaser.GameObjects.GameObject[] = [
      this.place(this.baseArt(buddy.species, zoom, halo)),
    ];
    if (buddy.glasses) {
      const eyeY = (SPECIES[buddy.species].eyeY - BUDDY_ANCHOR.y) * zoom;
      parts.push(this.place(this.glassesArt(zoom)).setPosition(0, eyeY));
    }
    parts.push(this.place(this.itemArt(buddy.item, buddy.species, zoom)));
    if (buddy.hat) parts.push(this.place(this.hatArt(zoom)));
    const bob = this.add.container(0, 0, parts);
    const root = this.add.container(0, 0);
    let ground: Phaser.GameObjects.Graphics | undefined;
    if (shadow) {
      ground = this.add.graphics();
      // Bóng dưới chân (chân chạm đất ở y 192 hệ toạ độ nhân vật).
      const feet = (192 - BUDDY_ANCHOR.y) * zoom;
      ground.fillStyle(this.palette.sticker.num, 0.16).fillEllipse(0, feet, 220, 30);
      root.add(ground);
    }
    root.add(bob);
    return { root, bob, shadow: ground, zoom };
  }

  /** Câu mới: bạn trượt từ dưới lên (giảm chuyển động: hiện mờ dần); nhận đáp án ngay. */
  private enterBuddy(buddy: RuleGateBuddy) {
    const view = this.makeBuddy(buddy, BUDDY.zoom, MAIN_HALO, true);
    view.root.setPosition(BUDDY.x, BUDDY.y);
    this.buddyLayer?.add(view.root);
    this.buddy = view;
    view.root.setAlpha(0);
    if (this.reducedMotion) {
      this.tweens.add({ targets: view.root, alpha: 1, duration: FADE_MS });
      return;
    }
    view.root.y += ENTER_RISE;
    this.tweens.add({
      targets: view.root,
      y: BUDDY.y,
      alpha: 1,
      duration: ENTER_MS,
      ease: "Quad.easeOut",
    });
  }

  /** Nảy lên xuống như đang bước (`times` nhịp, -1 = tới khi bị dừng). */
  private bob(view: BuddyView, times: number) {
    this.tweens.add({
      targets: view.bob,
      y: -BOB_PX,
      duration: BOB_MS,
      yoyo: true,
      repeat: times,
      ease: "Sine.easeOut",
    });
  }

  /** Đúng: bạn đi qua cổng (vào) hoặc theo đường mòn về nhà (về). Giảm chuyển động: mờ dần. */
  private walkOff(side: RuleGateAnswer) {
    const view = this.buddy;
    if (!view) return;
    this.tweens.killTweensOf(view.root);
    view.root.setAlpha(1);
    if (this.reducedMotion) {
      this.tweens.add({ targets: view.root, alpha: 0, duration: WALK_MS });
      return;
    }
    const exit = EXIT[side];
    this.tweens.add({
      targets: view.root,
      x: exit.x,
      y: exit.y,
      scale: exit.scale,
      duration: WALK_MS,
      ease: "Quad.easeIn",
    });
    this.tweens.add({
      targets: view.root,
      alpha: 0,
      delay: WALK_MS * 0.5,
      duration: WALK_MS * 0.5,
    });
    this.bob(view, 1);
  }

  /** Sai (mức hiện luật): bạn quay sang và đi chậm về phía đúng, dừng giữa đường tới hết khoá. */
  private walkHalfway(side: RuleGateAnswer) {
    const view = this.buddy;
    if (!view) return;
    this.tweens.killTweensOf(view.root);
    view.root.setAlpha(1).setPosition(view.root.x, BUDDY.y);
    const tilt = side === "in" ? -6 : 6;
    if (this.reducedMotion) {
      view.root.setX(HALFWAY[side]).setAngle(tilt);
      return;
    }
    this.tweens.add({ targets: view.root, angle: tilt, duration: 120 });
    this.tweens.add({
      targets: view.root,
      x: HALFWAY[side],
      scale: 0.92,
      duration: WALK_SLOW_MS,
      ease: "Sine.easeOut",
    });
    this.bob(view, Math.round(WALK_SLOW_MS / (BOB_MS * 2)) - 1);
  }

  /** Siêu khó: bạn thu nhỏ bay vào sổ cổng đúng cột (theo đáp án đúng), rồi vẽ lại sổ. */
  private flyToLog(side: RuleGateAnswer, duration: number, highlight: boolean) {
    const view = this.buddy;
    if (!view) {
      this.drawLog(highlight);
      return;
    }
    this.tweens.killTweensOf(view.root);
    const land = () => {
      view.root.setVisible(false);
      this.drawLog(highlight);
    };
    if (this.reducedMotion) {
      land();
      return;
    }
    view.shadow?.setVisible(false);
    view.root.setAlpha(1);
    const at = this.slotAt(side, 0);
    this.tweens.add({
      targets: view.root,
      x: at.x,
      y: at.y,
      scale: MINI_ZOOM / BUDDY.zoom,
      duration,
      ease: "Cubic.easeInOut",
      onComplete: land,
    });
  }

  /** Vòng phấn quanh chỗ của từng vế trên người bạn: liền nét nếu bạn có, đứt nét nếu không. */
  private ringBuddy(buddy: RuleGateBuddy, rule: RuleGateRule) {
    const view = this.buddy;
    if (!view) return;
    const { sticker, primary } = this.palette;
    const z = view.zoom;
    const g = this.add.graphics();
    for (const term of rule.terms) {
      const ring = FEATURE_RING[RULE_GATE_FEATURE_ATTR[term.feature]];
      const cx = (ring.cx - BUDDY_ANCHOR.x) * z;
      const cy = (ring.cy - BUDDY_ANCHOR.y) * z;
      const rx = ring.rx * z;
      const ry = ring.ry * z;
      const dashed = !ruleGateHas(buddy, term.feature);
      for (const [width, color] of [
        [13, sticker.num],
        [7, primary.num],
      ] as const) {
        g.lineStyle(width, color);
        this.strokeEllipse(g, cx, cy, rx, ry, dashed);
      }
    }
    view.bob.add(g);
  }

  private strokeEllipse(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    dashed: boolean,
  ) {
    const steps = 48;
    const point = (k: number) => {
      const a = (k / steps) * TAU;
      return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
    };
    if (!dashed) {
      g.beginPath();
      const p0 = point(0);
      g.moveTo(p0.x, p0.y);
      for (let k = 1; k <= steps; k++) {
        const p = point(k);
        g.lineTo(p.x, p.y);
      }
      g.closePath();
      g.strokePath();
      return;
    }
    // Nét đứt: 12 đoạn liền xen 12 khoảng trống.
    for (let k = 0; k < steps; k += 4) {
      g.beginPath();
      const p0 = point(k);
      g.moveTo(p0.x, p0.y);
      for (let j = 1; j <= 2; j++) {
        const p = point(k + j);
        g.lineTo(p.x, p.y);
      }
      g.strokePath();
    }
  }

  // ── Nhập: vuốt, chạm nút, phím ──

  private release(pointer: Phaser.Input.Pointer) {
    if (!this.pressed) return;
    this.pressed = false;
    const gesture = classifyGesture(pointer.upX - pointer.downX, pointer.upY - pointer.downY);
    if (gesture.kind === "swipe") this.answer(gesture.side);
    else if (gesture.kind === "tap") {
      // Chạm (quãng ngắn) = chọn bên của nút được chạm.
      const button = this.buttonAt(pointer.downX, pointer.downY);
      if (button) this.answer(button.side);
    }
  }

  private handleKey(event: KeyboardEvent) {
    // Có phím bổ trợ, đang gõ chữ hoặc đang mở hộp thoại (Thoát, sheet chat…): không trả lời.
    if (shouldIgnoreGameKey(event)) return;
    const side = keySide(event.code, event.key);
    if (!side) return;
    // Không để trang cuộn khi bấm phím mũi tên (kể cả phím lặp do giữ phím).
    if (isArrowKey(event.code, event.key)) event.preventDefault();
    if (event.repeat || !this.sys.isActive()) return;
    const button = this.buttons.find((b) => b.side === side);
    if (button && !this.locked) this.press(button);
    this.answer(side);
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

  private answer(choice: RuleGateAnswer) {
    const puzzle = this.puzzle;
    if (this.locked || !puzzle) return;
    this.locked = true;
    if (this.hovered) this.hovered.body.y = 0;

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const index = this.index;
    const correct = ruleGate.check(puzzle, choice);
    this.bridge.submit(index, choice);
    this.index += 1;

    // Siêu khó: sổ ghi đáp án ĐÚNG của câu (cả khi trả lời sai); đếm sai liền cho gợi ý.
    let hint = false;
    if (!puzzle.ruleShown) {
      this.log = pushLog(this.log, { buddy: puzzle.buddy, side: puzzle.answer });
      const next = afterAnswer(this.missStreak, correct);
      this.missStreak = next.streak;
      hint = next.hint;
    }

    if (correct) {
      this.showHit(puzzle, choice);
      this.time.delayedCall(NEXT_AFTER_HIT_MS, () => this.next());
      return;
    }

    this.settleTicket();
    this.showMiss(puzzle, choice, hint);
    // Hết khoá theo `lockedUntil` của server (không tự đếm 1,5 giây) để khớp huy hiệu khoá của khung.
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive()) return;
      this.drawLockBar(ms);
      this.time.delayedCall(ms, () => this.next());
    });
  }

  /** Đúng: nút vừa chọn sáng vàng + ✓; bạn đi vào cổng / về nhà (Siêu khó: bay vào sổ). */
  private showHit(puzzle: RuleGatePuzzle, choice: RuleGateAnswer) {
    const button = this.buttons.find((b) => b.side === choice);
    if (button) this.paintButton(button, "right");
    if (puzzle.ruleShown) this.walkOff(choice);
    else this.flyToLog(puzzle.answer, FLY_MS, false);
  }

  /**
   * Sai, khoá (CR-006), suốt `bridge.unlockDelay`: nút đúng sáng vàng + ✓, nút vừa chọn ✗ và rung.
   * Mức hiện luật: ✓ / ✗ cạnh từng biểu tượng trên vé, vòng phấn quanh chỗ tương ứng trên người
   * bạn, bạn đi chậm về phía đúng. Siêu khó: bạn bay vào sổ đúng cột; sai liền 2 câu thì lật vé cho
   * xem luật của câu vừa sai. Mọi thứ nằm từ y 240 trở xuống, dưới dải huy hiệu khoá.
   */
  private showMiss(puzzle: RuleGatePuzzle, choice: RuleGateAnswer, hint: boolean) {
    for (const button of this.buttons) {
      if (button.side === puzzle.answer) this.paintButton(button, "right");
      else if (button.side === choice) this.paintButton(button, "wrong");
    }
    const wrong = this.buttons.find((b) => b.side === choice);
    if (wrong && !this.reducedMotion) this.shake(wrong.body);

    if (puzzle.ruleShown) {
      if (this.ticket) this.markTicket(this.ticket, puzzle.buddy);
      this.ringBuddy(puzzle.buddy, puzzle.rule);
      this.walkHalfway(puzzle.answer);
      return;
    }
    this.flyToLog(puzzle.answer, FLY_MISS_MS, true);
    if (hint) this.showHint(puzzle);
  }

  /** Gợi ý Siêu khó: lật vé úp cho thấy luật của câu vừa sai, kèm ✓ / ✗; úp lại ở câu sau. */
  private showHint(puzzle: RuleGatePuzzle) {
    const old = this.ticket;
    const view = this.buildTicket(
      puzzle.rule,
      BACK.cx,
      BACK.w,
      `${this.palette.id}|hint|${ruleKey(puzzle.rule)}`,
    );
    this.markTicket(view, puzzle.buddy);
    this.ticket = view;
    if (old) this.flip(old, view);
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
    this.uiLayer?.add(bar);
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

  // ── Phần tĩnh: bảng, cổng, nhà, nút (vẽ lại khi đổi sáng/tối) ──

  private drawStatic(ruleShown: boolean) {
    const palette = this.palette;
    const id = `${palette.id}/${ruleShown ? "shown" : "hidden"}`;
    if (id === this.staticId) return;
    this.staticId = id;
    this.staticLayer?.removeAll(true);
    this.uiLayer?.removeAll(true);
    this.hovered = undefined;
    // Vé, sổ vẽ theo bảng màu: dựng lại.
    this.ticket?.root.destroy();
    this.ticket = undefined;

    const layer = this.staticLayer;
    if (!layer) return;
    layer.add(this.place(this.sceneryArt()));
    layer.add(this.place(this.boardArt()));
    if (ruleShown) {
      // Cạnh vé: cổng nhỏ + mũi tên chỉ về cổng, nhắc rằng vé là điều kiện để VÀO.
      layer.add(this.place(this.chalkIconArt("gate", 0.7)).setPosition(GATE_HINT.iconX, TICKET_Y));
      layer.add(this.place(this.chalkArrowArt()).setPosition(GATE_HINT.arrowX, TICKET_Y));
    } else {
      // Sổ cổng: cột trái biểu tượng cổng (được vào), cột phải biểu tượng nhà (mời về).
      layer.add(this.place(this.chalkIconArt("gate", 0.44)).setPosition(LOG.cols.in, LOG.headerY));
      layer.add(
        this.place(this.chalkIconArt("house", 0.44)).setPosition(LOG.cols.out, LOG.headerY),
      );
      layer.add(this.place(this.dividerArt()).setPosition(LOG.dividerX, TICKET_Y));
    }

    this.buttons = (["in", "out"] as const).map((side) => this.drawButton(side));
  }

  private drawButton(side: RuleGateAnswer): ButtonView {
    const { sticker } = this.palette;
    const x = BUTTON_XS[side];
    const shadow = this.add.graphics();
    shadow
      .fillStyle(sticker.num)
      .fillRoundedRect(-BUTTON.w / 2, -BUTTON.h / 2 + BUTTON.shadow, BUTTON.w, BUTTON.h, BUTTON.r);
    const face = this.add.graphics();
    const keys = this.canHover;
    const iy = keys ? -12 : 0;
    const scale = keys ? 0.62 : 0.72;
    const shape = side === "in" ? "gate" : "house";
    const icon = this.place(this.buttonIconArt(shape, "text"), scale).setPosition(
      side === "in" ? 40 : -40,
      iy,
    );
    const arrow = this.place(this.buttonIconArt("arrow", "text"), scale + 0.2)
      .setPosition(side === "in" ? -62 : 62, iy)
      .setAngle(side === "in" ? 0 : 180);
    const parts: Phaser.GameObjects.GameObject[] = [face, icon, arrow];
    let label: Phaser.GameObjects.Text | undefined;
    if (keys) {
      label = this.add
        .text(0, 42, KEY_LABELS[side], { fontFamily: FONT, fontStyle: "700", fontSize: "20px" })
        .setOrigin(0.5);
      parts.push(label);
    }
    const tick = this.place(this.tickArt()).setPosition(BADGE_AT.x, BADGE_AT.y);
    const cross = this.place(this.crossArt()).setPosition(BADGE_AT.x, BADGE_AT.y);
    parts.push(tick, cross);
    const body = this.add.container(0, 0, parts);
    this.uiLayer?.add(this.add.container(x, BUTTON.y, [shadow, body]));
    const view: ButtonView = {
      side,
      x,
      body,
      face,
      icons: [
        { image: icon, shape },
        { image: arrow, shape: "arrow" },
      ],
      label,
      tick,
      cross,
    };
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
    for (const { image, shape } of button.icons) {
      const art = this.buttonIconArt(shape, lit ? "ink" : "text");
      image.setTexture(art.key).setOrigin(art.ox, art.oy);
    }
    button.label?.setColor(lit ? ink.css : text.css).setAlpha(lit ? 1 : 0.75);
    button.tick.setVisible(lit);
    button.cross.setVisible(state === "wrong");
    if (state === "idle") button.body.setPosition(0, 0);
  }

  // ── Texture vẽ bằng canvas 2D (khoá theo hình + màu nên mỗi hình chỉ vẽ một lần) ──

  private place(art: Art, scale = 1): Phaser.GameObjects.Image {
    return placeArt(this, art, scale);
  }

  /**
   * Vẽ một texture: `box` theo đơn vị hình, `zoom` = px thiết kế mỗi đơn vị. Texture vẽ ở `RES`
   * lần cỡ thiết kế, ảnh đặt với tỉ lệ 1/RES.
   */
  private paint(name: string, box: Box, zoom: number, draw: (ctx: Ctx) => void): Art {
    return paintArt(this.textures, `rule-gate/${name}`, box, zoom, draw, RES);
  }

  // Bạn: hệ toạ độ nhân vật, điểm neo (100, 110). Mỗi lớp cùng điểm neo nên chồng khít nhau.

  private baseArt(species: RuleGateSpecies, zoom: number, halo: number): Art {
    return this.paint(`base-${species}-${zoom}-${halo}`, [-82, -120, 86, 96], zoom, (ctx) => {
      ctx.translate(-BUDDY_ANCHOR.x, -BUDDY_ANCHOR.y);
      drawBuddyBase(ctx, species, halo);
    });
  }

  private hatArt(zoom: number): Art {
    return this.paint(`hat-${zoom}`, [-48, -106, 88, -40], zoom, (ctx) => {
      ctx.translate(-BUDDY_ANCHOR.x, -BUDDY_ANCHOR.y);
      drawHat(ctx);
    });
  }

  private glassesArt(zoom: number): Art {
    return this.paint(`glasses-${zoom}`, [-66, -26, 66, 26], zoom, (ctx) => drawGlasses(ctx));
  }

  private itemArt(item: RuleGateItem, species: RuleGateSpecies, zoom: number): Art {
    return this.paint(`item-${item}-${species}-${zoom}`, [-44, 12, 44, 76], zoom, (ctx) => {
      ctx.translate(-BUDDY_ANCHOR.x, -BUDDY_ANCHOR.y);
      drawItem(ctx, item, species);
    });
  }

  // Vé và biểu tượng phấn (px, tâm (0, 0)).

  private iconArt(feature: RuleGateFeature): Art {
    const { chalk, board } = this.palette;
    return this.paint(`icon-${feature}-${chalk.css}-${board.css}`, [-66, -66, 66, 66], 1, (ctx) => {
      drawFeatureChalk(ctx, feature, chalk.css, board.css);
      grain(ctx, 0.08, feature.length * 7 + 3);
    });
  }

  private banArt(): Art {
    const { chalk, destructive } = this.palette;
    return this.paint(`ban-${chalk.css}-${destructive.css}`, [-74, -74, 74, 74], 1, (ctx) =>
      drawBan(ctx, 58, destructive.css, chalk.css),
    );
  }

  private ticketArt(w: number): Art {
    const chalk = this.palette.chalk.css;
    const box = [-w / 2 - 6, -TICKET_H / 2 - 6, w / 2 + 6, TICKET_H / 2 + 6] as const;
    return this.paint(`ticket-${w}-${chalk}`, box, 1, (ctx) => {
      drawTicket(ctx, w, TICKET_H, chalk);
      grain(ctx, 0.06, w);
    });
  }

  private backArt(): Art {
    const chalk = this.palette.chalk.css;
    const w = BACK.w;
    const box = [-w / 2 - 6, -TICKET_H / 2 - 6, w / 2 + 6, TICKET_H / 2 + 6] as const;
    return this.paint(`back-${w}-${chalk}`, box, 1, (ctx) => {
      drawTicketBack(ctx, w, TICKET_H, chalk);
      grain(ctx, 0.08, 17);
    });
  }

  private joinerArt(kind: "plus" | "slash"): Art {
    const chalk = this.palette.chalk.css;
    return this.paint(`joiner-${kind}-${chalk}`, [-40, -52, 40, 52], 1, (ctx) => {
      ctx.scale(1.4, 1.4);
      stroke(ctx, kind === "plus" ? PLUS : SLASH, chalk, 7);
      grain(ctx, 0.08, kind.length);
    });
  }

  private chalkIconArt(shape: "gate" | "house", zoom: number): Art {
    const chalk = this.palette.chalk.css;
    return this.paint(`chalk-${shape}-${zoom}-${chalk}`, [-58, -58, 58, 58], zoom, (ctx) => {
      stroke(ctx, shape === "gate" ? GATE_ICON : HOUSE_ICON, chalk, 7 / zoom);
      grain(ctx, 0.08, 29);
    });
  }

  private chalkArrowArt(): Art {
    const chalk = this.palette.chalk.css;
    return this.paint(`chalk-arrow-${chalk}`, [-36, -24, 36, 24], 0.85, (ctx) => {
      stroke(ctx, ARROW_LEFT, chalk, 9);
      grain(ctx, 0.08, 31);
    });
  }

  /** Vạch phấn đứt nét chia hai cột sổ cổng. */
  private dividerArt(): Art {
    const chalk = this.palette.chalk.css;
    const half = BOARD.h / 2 - 24;
    return this.paint(`divider-${chalk}`, [-6, -half - 4, 6, half + 4], 1, (ctx) => {
      ctx.setLineDash([12, 12]);
      stroke(ctx, `M0 ${-half} L0 ${half}`, chalk, 4, 0.55);
    });
  }

  private dustArt(): Art {
    const chalk = this.palette.chalk.css;
    return this.paint(`dust-${chalk}`, [-60, -60, 60, 60], 1, (ctx) => {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
      g.addColorStop(0, rgba(chalk, 0.5));
      g.addColorStop(1, rgba(chalk, 0));
      ctx.fillStyle = g;
      ctx.fill(circle(0, 0, 60));
    });
  }

  /** Khăn lau bảng: đế gỗ, mặt nỉ. */
  private eraserArt(): Art {
    const { wood, chalkMuted, sticker } = this.palette;
    return this.paint(`eraser-${wood.css}-${chalkMuted.css}`, [-56, -32, 56, 32], 1, (ctx) => {
      const top = roundRect(-50, -26, 100, 30, 9);
      fill(ctx, top, wood.css);
      stroke(ctx, top, sticker.css, 4);
      const felt = roundRect(-50, 0, 100, 24, 7);
      fill(ctx, felt, chalkMuted.css);
      stroke(ctx, felt, sticker.css, 4);
    });
  }

  private tickArt(): Art {
    const { sticker, primary } = this.palette;
    return this.paint(`tick-${sticker.css}-${primary.css}`, [-26, -26, 26, 30], 1, (ctx) =>
      drawTickBadge(ctx, 21, primary.css, sticker.css),
    );
  }

  private crossArt(): Art {
    const css = this.palette.destructive.css;
    return this.paint(`cross-${css}`, [-28, -28, 28, 28], 1, (ctx) => drawCrossMark(ctx, 36, css));
  }

  private buttonIconArt(shape: "gate" | "house" | "arrow", tone: "text" | "ink"): Art {
    const css = this.palette[tone].css;
    const path = shape === "gate" ? GATE_ICON : shape === "house" ? HOUSE_ICON : ARROW_LEFT;
    return this.paint(`button-${shape}-${css}`, [-60, -60, 60, 60], 1, (ctx) =>
      stroke(ctx, path, css, 10),
    );
  }

  /** Bảng vé (px khung): mặt `--board`, viền mực, viền trong xanh dương Phân tích. */
  private boardArt(): Art {
    const { board, sticker, analyze } = this.palette;
    const B = BOARD;
    const box = [B.x - 4, B.y - 4, B.x + B.w + 4, B.y + B.h + 12] as const;
    return this.paint(`board-${board.css}-${sticker.css}-${analyze.css}`, box, 1, (ctx) => {
      const shape = roundRect(B.x, B.y, B.w, B.h, B.r);
      fill(ctx, roundRect(B.x, B.y + 7, B.w, B.h, B.r), sticker.css);
      fill(ctx, shape, board.css);
      ctx.save();
      ctx.clip(shape);
      const cx = B.x + B.w / 2;
      const cy = B.y + B.h / 2;
      const vignette = ctx.createRadialGradient(cx, cy, B.h * 0.3, cx, cy, B.w * 0.62);
      vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
      vignette.addColorStop(1, "rgba(0, 0, 0, 0.28)");
      ctx.fillStyle = vignette;
      ctx.fillRect(B.x, B.y, B.w, B.h);
      // Vết lau cũ rất nhạt.
      stroke(ctx, "M100 300 C220 270 340 290 460 330", "#ffffff", 44, 0.04);
      stroke(ctx, "M300 450 C420 420 520 430 640 470", "#ffffff", 36, 0.035);
      ctx.restore();
      stroke(ctx, shape, sticker.css, 5);
      const inner = B.inset;
      stroke(
        ctx,
        roundRect(B.x + inner, B.y + inner, B.w - inner * 2, B.h - inner * 2, B.r - 8),
        analyze.css,
        5,
      );
    });
  }

  /**
   * Cảnh trên giấy (px khung): cổng lớp bên trái (cột gỗ, xà, biển quyển vở, hai cánh mở), ngôi nhà
   * nhỏ bên phải có đường mòn dẫn ra, mặt đất. Viền theo `--card-foreground` để rõ trên giấy sáng
   * (mực tối) lẫn giấy tối (nét kem).
   */
  private sceneryArt(): Art {
    const { wood, text, card, analyze } = this.palette;
    const line = text.css;
    return this.paint(
      `scenery-${wood.css}-${line}-${card.css}-${analyze.css}`,
      [0, 560, 720, 972],
      1,
      (ctx) => {
        // Mặt đất + đường mòn tới cửa nhà.
        stroke(ctx, `M8 ${GROUND_Y} L712 ${GROUND_Y}`, line, 3, 0.22);
        for (const [x, y] of [
          [436, 944],
          [478, 950],
          [520, 952],
          [562, 950],
          [600, 945],
        ] as const) {
          fill(ctx, ellipse(x, y, 16, 6), line, 0.16);
        }

        // Cổng lớp.
        fill(ctx, roundRect(58, 660, 108, GROUND_Y - 660, 4), line, 0.08);
        for (const leaf of [
          "M58 672 L86 684 L86 920 L58 930 Z",
          "M166 672 L138 684 L138 920 L166 930 Z",
        ]) {
          fill(ctx, leaf, wood.css);
          fill(ctx, leaf, "#000000", 0.14);
          stroke(ctx, leaf, line, 4);
        }
        stroke(ctx, "M72 690 L72 922 M152 690 L152 922", line, 2.5, 0.35);
        for (const x of [30, 166]) {
          const post = roundRect(x, 646, 28, GROUND_Y - 646, 6);
          fill(ctx, post, wood.css);
          stroke(ctx, `M${x + 10} 664 L${x + 10} ${GROUND_Y - 12}`, "#000000", 2, 0.14);
          stroke(ctx, post, line, 5);
        }
        const beam = roundRect(18, 626, 188, 30, 9);
        fill(ctx, beam, wood.css);
        stroke(ctx, beam, line, 5);
        // Biển hình quyển vở (không chữ): dòng kẻ xanh, gáy lò xo bên trái.
        const sign = roundRect(84, 590, 58, 50, 6);
        fill(ctx, sign, card.css);
        stroke(ctx, "M98 606 L132 606 M98 616 L132 616 M98 626 L132 626", analyze.css, 3);
        stroke(ctx, sign, line, 4);
        for (const y of [600, 612, 624]) stroke(ctx, circle(86, y, 4), line, 3);

        // Ngôi nhà.
        const chimney = roundRect(648, 676, 24, 56, 4);
        fill(ctx, chimney, wood.css);
        stroke(ctx, chimney, line, 4);
        const walls = roundRect(540, 762, 136, GROUND_Y - 762, 6);
        fill(ctx, walls, card.css);
        stroke(ctx, walls, line, 5);
        const roof = "M520 774 L608 662 L696 774 Z";
        fill(ctx, roof, wood.css);
        stroke(ctx, roof, line, 5);
        const door = `M590 ${GROUND_Y} L590 880 C590 862 626 862 626 880 L626 ${GROUND_Y} Z`;
        fill(ctx, door, wood.css);
        stroke(ctx, door, line, 4);
        fill(ctx, circle(618, 902, 3.5), line);
        for (const x of [552, 636]) {
          const pane = roundRect(x, 798, 28, 28, 4);
          fill(ctx, pane, analyze.css, 0.4);
          stroke(ctx, `M${x + 14} 798 L${x + 14} 826 M${x} 812 L${x + 28} 812`, line, 2.5);
          stroke(ctx, pane, line, 3.5);
        }
      },
    );
  }
}
