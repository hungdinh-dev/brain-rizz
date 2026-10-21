import {
  type ShadowItem,
  type ShadowMatchOption,
  type ShadowMatchPuzzle,
  shadowDiff,
  shadowMatch,
  shadowParts,
  WRONG_ANSWER_LOCK_MS,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import { type Ctx, makeCanvas, roundRectPath } from "../_shared/canvas";
import type { MinigameBridge } from "../types";
import { diffRing, FRAME, ITEM_ART, type PlacedPart, placeParts } from "./art";

/*
 * Bóng của ai — đặc tả: docs/04-minigames/shadow-match.md (mục "Ghi chú cho FE").
 * Bản mẫu: canvas Brain Rizz, trang Minigame, hàng M14 (ShadowMatchMobile, ShadowMatchStates).
 * Scene không vẽ chữ: chỉ có thẻ đề, các thẻ bóng, huy hiệu ✓/✗ và thanh khoá.
 */

// ---------------------------------------------------------------- bố cục (khung 720×1280)

type Point = readonly [x: number, y: number];

/** Thẻ đề: giấy, viền mực 5, viền trong cam Nhận diện, bóng sàn mờ; đồ vật có màu scale 2. */
const QUESTION = { x: 150, y: 96, w: 420, h: 392, radius: 34, border: 5, shadow: 8 } as const;
const QUESTION_INNER = { inset: 11, radius: 25, width: 8 } as const;
const QUESTION_ITEM: Point = [360, 282];
const QUESTION_SCALE = 2;
const FLOOR = { x: 360, y: 440, rx: 120, ry: 16 } as const;
/** Mũi tên chữ V nét mực (nền tối: kem) giữa thẻ đề và khung lựa chọn. */
const ARROW: readonly Point[] = [
  [332, 514],
  [360, 544],
  [388, 514],
];
const ARROW_WIDTH = 9;
/** Khung lựa chọn: giấy, viền mực, viền trong cam. */
const PANEL = { x: 36, y: 568, w: 648, h: 612, radius: 36, border: 5, shadow: 8 } as const;
const PANEL_INNER = { inset: 11, radius: 27, width: 8 } as const;

/** Thẻ bóng: cỡ thẻ, hệ số vẽ vật (đơn vị khung → px) và tâm từng ô theo thứ tự `options`. */
interface Layout {
  w: number;
  h: number;
  k: number;
  slots: readonly Point[];
}
const LAYOUTS: Readonly<Record<number, Layout>> = {
  3: {
    w: 184,
    h: 268,
    k: 1.05,
    slots: [
      [150, 874],
      [360, 874],
      [570, 874],
    ],
  },
  4: {
    w: 284,
    h: 250,
    k: 1.2,
    slots: [
      [204, 740],
      [516, 740],
      [204, 1016],
      [516, 1016],
    ],
  },
  6: {
    w: 184,
    h: 250,
    k: 0.98,
    slots: [
      [150, 740],
      [360, 740],
      [570, 740],
      [150, 1016],
      [360, 1016],
      [570, 1016],
    ],
  },
};
/** Thẻ bóng: bo góc, viền mực, bóng đổ; rê chuột nhấc 6 px, viền nét đứt. */
const CARD = { radius: 18, border: 4.5, shadow: 7, lift: 6 } as const;
const HOVER_DASH: [number, number] = [14, 9];
/** Vòng vàng quanh thẻ đúng: vàng 8 ngoài viền thẻ, viền mực 5 ngoài vàng. */
const RING = { gap: 4, width: 8, ink: 5 } as const;
/** Thanh khoá khi sai. */
const BAR = { x: 150, y: 1206, w: 420, h: 14 } as const;

/** Nét vẽ vật: viền 6 gộp các phần thành một bóng liền; nền tối thêm viền phấn 16 bên ngoài. */
const OUTLINE = 6;
const HALO = 16;
/** Độ phân giải texture so với đơn vị khung: bóng (thẻ tối đa ×1,2) và đồ vật có màu (thẻ đề ×2). */
const SILHOUETTE_RES = 1.25;
const COLOR_RES = 2;
/** Vòng khoanh chi tiết khác: trắng 10 dưới, đỏ nét đứt 5 trên (đơn vị khung). */
const DIFF_RING = { under: 10, over: 5, dash: [9, 6] as [number, number] };

/** Huy hiệu (so với tâm thẻ, theo cỡ thẻ): ✓ góc trên phải, ✗ góc dưới phải. */
const OK_INSET = 30;
const BAD_INSET = 34;
const BADGE_R = 26;

/** Độ mờ của thẻ đề và các bóng không liên quan khi sai; đồ vật có màu đè lên bóng sai. */
const DIM_ALPHA = 0.35;
const WRONG_COLOR_ALPHA = 0.45;

// ---------------------------------------------------------------- nhịp hiệu ứng

/** Câu mới: thẻ đề phóng từ 90 %, các bóng hiện lần lượt cách nhau 40 ms. */
const APPEAR_MS = 160;
const APPEAR_SCALE = 0.9;
const STAGGER_MS = 40;
/** Đúng: đồ vật có màu lấp vào bóng, nảy 108 % trong 300 ms, câu mới sau 300 ms. */
const FILL_MS = 120;
const BOUNCE_MS = 300;
const BOUNCE_SCALE = 1.08;
const SOLVED_MS = 300;
/** Sai: lắc ±8 px trong 200 ms; làm mờ 120 ms. */
const SHAKE_MS = 200;
const SHAKE_PX = 8;
const DIM_MS = 120;

// ---------------------------------------------------------------- icon (tâm 0,0)

const CHECK = "M-12 1 L-3 10 L13 -9";
const CROSS = "M-30 -30 L30 30 M30 -30 L-30 30";

// ---------------------------------------------------------------- màu

/**
 * Viền phấn quanh bóng ở giao diện tối (bản mẫu ShadowMatchMobile, nền tối) để bóng #0e0c1e không
 * chìm vào thẻ tím. Màu riêng của game này, không phải token chung.
 */
const HALO_DARK = "#c9c6dc";
/** Độ đậm bóng sàn dưới đồ vật ở thẻ đề: sáng / tối. */
const FLOOR_ALPHA_LIGHT = 0.12;
const FLOOR_ALPHA_DARK = 0.5;

/** Màu đọc từ token CSS lúc tạo scene (tự đổi theo sáng/tối). Chuỗi CSS để vẽ texture canvas. */
interface Palette {
  dark: boolean;
  /** Giấy của thẻ đề và khung lựa chọn. */
  card: string;
  /** Mũi tên, thanh khoá: mực ở nền sáng, kem ở nền tối. */
  cardFg: string;
  /** Mực: viền thẻ, bóng đen, viền đồ vật có màu. */
  border: string;
  sticker: string;
  /** Nền khung chơi (bg-muted của GameFrame). */
  muted: string;
  /** Mặt thẻ bóng: giấy ở nền sáng, tím `--muted` ở nền tối. */
  face: string;
  primary: string;
  primaryFg: string;
  destructive: string;
  /** Viền trong cam của nhóm Nhận diện. */
  identify: string;
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
    border: token("--border"),
    sticker: token("--sticker"),
    muted: token("--muted"),
    face: dark ? token("--muted") : token("--card"),
    primary: token("--primary"),
    primaryFg: token("--primary-foreground"),
    destructive: token("--destructive"),
    identify: token("--color-identify"),
    halo: dark ? HALO_DARK : null,
  };
}

/** Màu CSS → số màu của Phaser. */
const toColor = (css: string) => Phaser.Display.Color.ValueToColor(css).color;

// ---------------------------------------------------------------- vẽ canvas 2D

/** Nét đứt chia đều quanh hình chữ nhật bo góc để chỗ nối không lệch. */
function evenDash(w: number, h: number, r: number, [dash, gap]: [number, number]) {
  const length = 2 * (w + h - 4 * r) + 2 * Math.PI * r;
  const k = length / Math.max(1, Math.round(length / (dash + gap))) / (dash + gap);
  return [dash * k, gap * k];
}

/** Vẽ các phần hình (đã sắp) với `paint` cho từng nét; phần ở phía ngược vẽ ảnh gương qua x = 0. */
function eachShape(
  ctx: Ctx,
  parts: readonly PlacedPart[],
  paint: (shape: PlacedPart["art"]["shapes"][number], path: Path2D) => void,
) {
  for (const { art, mirror } of parts) {
    ctx.save();
    if (mirror) ctx.scale(-1, 1);
    for (const shape of art.shapes) paint(shape, new Path2D(shape.d));
    ctx.restore();
  }
}

/** Bóng đen của một biến thể: mọi phần tô đặc + viền cùng màu (nền tối: viền phấn bên ngoài). */
function drawSilhouette(ctx: Ctx, item: ShadowItem, variant: number, c: Palette) {
  const parts = placeParts(item, shadowParts(item, variant));
  const [ox, oy] = ITEM_ART[item].offset;
  ctx.translate(ox, oy);
  const pass = (color: string, grow: number) => {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    eachShape(ctx, parts, (shape, path) => {
      if (shape.kind === "fill") {
        ctx.lineWidth = grow;
        ctx.fill(path);
        ctx.stroke(path);
      } else {
        // Nét mảnh dày thêm như viền: bóng +4, viền phấn +14.
        ctx.lineWidth = shape.width + grow - 2;
        ctx.stroke(path);
      }
    });
  };
  if (c.halo) pass(c.halo, HALO);
  pass(c.border, OUTLINE);
}

/** Đồ vật có màu (luôn là hình gốc): thân tô màu viền mực 6, rồi nét trang trí. */
function drawColored(ctx: Ctx, item: ShadowItem, c: Palette) {
  const art = ITEM_ART[item];
  const parts = placeParts(item, shadowParts(item, 0));
  ctx.translate(art.offset[0], art.offset[1]);
  ctx.strokeStyle = c.border;
  eachShape(ctx, parts, (shape, path) => {
    if (shape.kind === "fill") {
      ctx.fillStyle = shape.fill;
      ctx.lineWidth = OUTLINE;
      ctx.fill(path);
      ctx.stroke(path);
    } else {
      ctx.lineWidth = shape.width;
      ctx.stroke(path);
    }
  });
  for (const decor of art.decor) {
    const path = new Path2D(decor.d);
    if (decor.kind === "fill") {
      ctx.fillStyle = decor.fill === "ink" ? c.border : decor.fill;
      ctx.fill(path);
    } else {
      ctx.globalAlpha = decor.opacity ?? 1;
      ctx.strokeStyle = decor.color === "ink" ? c.border : decor.color;
      ctx.lineWidth = decor.width;
      ctx.stroke(path);
      ctx.globalAlpha = 1;
    }
  }
}

// ---------------------------------------------------------------- scene

type CardState = "idle" | "hover";

interface OptionView {
  option: ShadowMatchOption;
  /** Đặt tại tâm thẻ: hiện dần khi ra câu, chứa lớp phủ khi bị làm mờ. */
  slot: Phaser.GameObjects.Container;
  /** Mặt thẻ: nhấc khi rê chuột, lắc khi sai, nảy khi đúng. */
  face: Phaser.GameObjects.Container;
  card: Phaser.GameObjects.Image;
  /**
   * Khung vẽ vật đã biến đổi như đặc tả: lật (scaleX = −1) rồi xoay `rotation` quanh tâm. Mọi thứ
   * thêm vào đây (đồ vật có màu, vòng khoanh) theo đúng hướng của bóng.
   */
  figure: Phaser.GameObjects.Container;
  hovered: boolean;
}

/** Bóng của ai — chạm vào bóng duy nhất có đúng hình dạng đồ vật (xoay hay lật vẫn đúng). */
export default class ShadowMatchScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = false;
  private colors!: Palette;
  private reducedMotion = false;
  private board?: Phaser.GameObjects.Container;
  private question?: Phaser.GameObjects.Container;
  private arrow?: Phaser.GameObjects.Graphics;
  private options: OptionView[] = [];
  private layout: Layout = LAYOUTS[4]!;
  private bar?: Phaser.GameObjects.Graphics;
  private barState = { width: 0 };
  /** Hẹn giờ của câu hiện tại (sang câu mới); huỷ hết khi sang câu mới hoặc rời màn. */
  private timers: Phaser.Time.TimerEvent[] = [];

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.locked = false;
    this.options = [];
    this.timers = [];
  }

  create() {
    const canvas = this.game.canvas;
    this.colors = readPalette(canvas.isConnected ? canvas : document.documentElement);
    this.reducedMotion = prefersReducedMotion();

    const cleanup = () => {
      this.clearTimers();
      this.tweens.killAll();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.clearTimers());

    // Khung lựa chọn và mũi tên giữ nguyên suốt vòng.
    this.add.image(PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h / 2, this.panelTexture());
    const ink = toColor(this.colors.cardFg);
    const arrow = this.add.graphics();
    arrow.lineStyle(ARROW_WIDTH, ink);
    arrow.strokePoints(ARROW.map(([x, y]) => new Phaser.Math.Vector2(x, y)));
    // Đầu nét và chỗ gập tròn như bản mẫu.
    arrow.fillStyle(ink);
    for (const [x, y] of ARROW) arrow.fillCircle(x, y, ARROW_WIDTH / 2);
    this.arrow = arrow;

    this.bar = this.add.graphics().setVisible(false);
    this.showPuzzle();
  }

  // -------------------------------------------------------------- dựng câu đố

  private showPuzzle() {
    // Mọi hẹn giờ và tween đang chạy đều thuộc câu cũ: dừng trước khi huỷ.
    this.clearTimers();
    this.tweens.killAll();
    this.board?.destroy();
    this.bar?.setVisible(false);
    this.arrow?.setAlpha(1);
    this.locked = false;

    const puzzle = shadowMatch.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    const layout = LAYOUTS[puzzle.options.length] ?? LAYOUTS[6]!;
    this.layout = layout;
    const board = this.add.container(0, 0);

    // Thẻ đề: giấy + bóng sàn + đồ vật có màu.
    const question = this.add.container(QUESTION.x + QUESTION.w / 2, QUESTION.y + QUESTION.h / 2);
    const cx = QUESTION.x + QUESTION.w / 2;
    const cy = QUESTION.y + QUESTION.h / 2;
    const floorAlpha = this.colors.dark ? FLOOR_ALPHA_DARK : FLOOR_ALPHA_LIGHT;
    question.add([
      this.add.image(0, QUESTION.shadow / 2, this.questionTexture()),
      this.add.ellipse(
        FLOOR.x - cx,
        FLOOR.y - cy,
        FLOOR.rx * 2,
        FLOOR.ry * 2,
        toColor(this.colors.sticker),
        floorAlpha,
      ),
      this.add
        .image(QUESTION_ITEM[0] - cx, QUESTION_ITEM[1] - cy, this.colorTexture(puzzle.item))
        .setScale(QUESTION_SCALE / COLOR_RES),
    ]);
    board.add(question);
    this.question = question;

    this.options = puzzle.options.map((option, i) => {
      const [x, y] = layout.slots[i] ?? layout.slots[0]!;
      const card = this.add.image(0, 0, this.cardTexture("idle"));
      const silhouette = this.add
        .image(0, 0, this.silhouetteTexture(option.item, option.variant))
        .setScale(1 / SILHOUETTE_RES);
      const figure = this.add.container(0, 0, [silhouette]);
      figure.setScale(option.flipped ? -layout.k : layout.k, layout.k);
      // Lật nằm ở khung trong, xoay ở khung ngoài: lật trước rồi mới xoay (đặc tả).
      const turn = this.add.container(0, 0, [figure]).setAngle(option.rotation);
      const face = this.add.container(0, 0, [card, turn]);
      const slot = this.add.container(x, y, [face]);
      const view: OptionView = { option, slot, face, card, figure, hovered: false };

      // Vùng chạm = cả thẻ; ghi nhận ở pointerdown, một chạm là chốt.
      const zone = this.add.zone(x, y, layout.w, layout.h).setInteractive({ useHandCursor: true });
      zone.on("pointerdown", () => this.answer(puzzle, i));
      zone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
        if (!this.locked && !pointer.wasTouch) this.setHover(view, true);
      });
      zone.on("pointerout", () => {
        if (!this.locked) this.setHover(view, false);
      });
      board.add([slot, zone]);
      return view;
    });
    this.board = board;

    // Câu mới: thẻ đề phóng từ 90 %, các bóng hiện lần lượt. Giảm chuyển động: hiện ngay.
    if (this.reducedMotion) return;
    question.setAlpha(0).setScale(APPEAR_SCALE);
    this.tweens.add({
      targets: question,
      alpha: 1,
      scale: 1,
      duration: APPEAR_MS,
      ease: "Back.easeOut",
    });
    this.options.forEach((view, i) => {
      view.slot.setAlpha(0);
      this.tweens.add({
        targets: view.slot,
        alpha: 1,
        duration: APPEAR_MS,
        delay: STAGGER_MS * (i + 1),
      });
    });
  }

  private setHover(view: OptionView, on: boolean) {
    if (view.hovered === on) return;
    view.hovered = on;
    view.face.y = on ? -CARD.lift : 0;
    view.card.setTexture(this.cardTexture(on ? "hover" : "idle"));
  }

  // -------------------------------------------------------------- trả lời

  private answer(puzzle: ShadowMatchPuzzle, choice: number) {
    if (this.locked) return;
    this.locked = true;

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const index = this.index;
    const correct = shadowMatch.check(puzzle, choice);
    this.bridge.submit(index, choice);
    this.index += 1;

    for (const view of this.options) this.setHover(view, false);
    const picked = this.options[choice];
    const right = this.options[puzzle.answerIndex];
    if (!picked || !right) return;
    // Bóng đang hiện dần thì hiện hẳn để thấy kết quả.
    for (const view of this.options) {
      this.tweens.killTweensOf(view.slot);
      view.slot.setAlpha(1);
    }

    if (correct) {
      this.showRight(right, puzzle.item, true);
      this.after(SOLVED_MS, () => this.showPuzzle());
      return;
    }

    this.showMiss(picked, puzzle.item);
    this.showRight(right, puzzle.item, false);
    for (const view of this.options) if (view !== picked && view !== right) this.dim(view);
    this.dimQuestion();

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

  /** Bóng đúng: đồ vật có màu lấp vào (cùng xoay/lật), vòng vàng + ✓; đúng thì nảy 108 %. */
  private showRight(view: OptionView, item: ShadowItem, bounce: boolean) {
    const { w, h } = this.layout;
    const color = this.add.image(0, 0, this.colorTexture(item)).setScale(1 / COLOR_RES);
    view.figure.add(color);
    view.face.addAt(this.add.image(0, 0, this.ringTexture()), 0);
    view.face.add(this.add.image(w / 2 - OK_INSET, -h / 2 + OK_INSET, this.badgeTexture()));
    if (this.reducedMotion) return;

    color.setAlpha(0);
    this.tweens.add({ targets: color, alpha: 1, duration: FILL_MS });
    if (!bounce) return;
    this.tweens.add({
      targets: view.face,
      scale: BOUNCE_SCALE,
      duration: BOUNCE_MS / 2,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  /**
   * Bóng chạm nhầm: ✗ đỏ viền trắng, đồ vật có màu mờ 45 % đè lên (cùng xoay/lật của bóng này) để
   * thấy phần thừa/thiếu, vòng đỏ nét đứt quanh chi tiết khác (bóng vật khác thì không khoanh); lắc.
   */
  private showMiss(view: OptionView, item: ShadowItem) {
    const { w, h } = this.layout;
    const { option } = view;
    view.figure.add(
      this.add
        .image(0, 0, this.colorTexture(item))
        .setScale(1 / COLOR_RES)
        .setAlpha(WRONG_COLOR_ALPHA),
    );
    if (option.item === item) {
      const { missing, extra } = shadowDiff(option.item, option.variant);
      const ring = diffRing(option.item, [...missing, ...extra]);
      if (ring) view.figure.add(this.add.image(ring[0], ring[1], this.diffRingTexture(ring[2])));
    }
    view.face.add(this.add.image(w / 2 - BAD_INSET, h / 2 - BAD_INSET, this.crossTexture()));
    if (this.reducedMotion) return;

    const face = view.face;
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

  /**
   * Làm mờ thẻ bóng còn 35 % bằng lớp phủ màu giấy của khung lựa chọn (65 %). Đặt alpha cho cả nhóm
   * thì Phaser tính riêng từng lớp (bóng đổ, bóng đen lộ ra); nền dưới là một màu nên phủ cho kết
   * quả giống hệt làm mờ cả nhóm.
   */
  private dim(view: OptionView) {
    const { w, h } = this.layout;
    this.veil(view.slot, 0, CARD.shadow / 2, w + 6, h + CARD.shadow + 6, this.colors.card);
  }

  /** Thẻ đề mờ 35 % (lớp phủ màu nền khung chơi), mũi tên cũng mờ theo. */
  private dimQuestion() {
    const question = this.question;
    if (!question) return;
    this.veil(
      question,
      0,
      QUESTION.shadow / 2,
      QUESTION.w + 8,
      QUESTION.h + QUESTION.shadow + 8,
      this.colors.muted,
    );
    this.arrow?.setAlpha(DIM_ALPHA);
  }

  private veil(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
  ) {
    const veil = this.add.rectangle(x, y, w, h, toColor(color), 1).setAlpha(0);
    parent.add(veil);
    const alpha = 1 - DIM_ALPHA;
    if (this.reducedMotion) veil.setAlpha(alpha);
    else this.tweens.add({ targets: veil, alpha, duration: DIM_MS });
  }

  private after(ms: number, callback: () => void) {
    this.timers.push(this.time.delayedCall(ms, callback));
  }

  private clearTimers() {
    for (const timer of this.timers) timer.remove(false);
    this.timers = [];
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
    g.fillStyle(toColor(c.card));
    g.fillRoundedRect(x, y, w, h, r);
    g.lineStyle(3, toColor(c.cardFg));
    g.strokeRoundedRect(x, y, w, h, r);
    if (fill <= 0) return;
    g.fillStyle(toColor(c.cardFg));
    g.fillRoundedRect(x, y, fill, h, Math.min(r, fill / 2));
  }

  // -------------------------------------------------------------- texture (vẽ một lần mỗi vòng)

  /** Tạo texture từ canvas 2D (gốc toạ độ ở tâm) nếu chưa có; trả về khoá. */
  private texture(name: string, width: number, height: number, draw: (ctx: Ctx) => void) {
    const key = `shadow-match:${name}`;
    if (this.textures.exists(key)) return key;
    const canvas = makeCanvas(width, height, (ctx) => {
      ctx.translate(Math.ceil(width) / 2, Math.ceil(height) / 2);
      draw(ctx);
    });
    this.textures.addCanvas(key, canvas);
    return key;
  }

  /** Bóng đen của một biến thể, vẽ thẳng đứng không lật (xoay/lật bằng khung chứa). */
  private silhouetteTexture(item: ShadowItem, variant: number) {
    const size = (FRAME + HALO) * SILHOUETTE_RES;
    return this.texture(`sil-${item}-${variant}`, size, size, (ctx) => {
      ctx.scale(SILHOUETTE_RES, SILHOUETTE_RES);
      drawSilhouette(ctx, item, variant, this.colors);
    });
  }

  /** Đồ vật có màu (hình gốc). */
  private colorTexture(item: ShadowItem) {
    const size = (FRAME + OUTLINE) * COLOR_RES;
    return this.texture(`color-${item}`, size, size, (ctx) => {
      ctx.scale(COLOR_RES, COLOR_RES);
      drawColored(ctx, item, this.colors);
    });
  }

  /** Thẻ giấy bo góc có bóng đổ, viền mực và viền trong cam (thẻ đề, khung lựa chọn). */
  private paperTexture(
    name: string,
    box: { w: number; h: number; radius: number; border: number; shadow: number },
    inner: { inset: number; radius: number; width: number },
  ) {
    const c = this.colors;
    const pad = 6;
    return this.texture(name, box.w + 2 * pad, box.h + box.shadow + 2 * pad, (ctx) => {
      const x = -box.w / 2;
      const y = -(box.h + box.shadow) / 2;
      roundRectPath(ctx, x, y + box.shadow, box.w, box.h, box.radius);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      roundRectPath(ctx, x, y, box.w, box.h, box.radius);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.lineWidth = box.border;
      ctx.strokeStyle = c.border;
      ctx.stroke();
      const i = inner.inset;
      roundRectPath(ctx, x + i, y + i, box.w - 2 * i, box.h - 2 * i, inner.radius);
      ctx.lineWidth = inner.width;
      ctx.strokeStyle = c.identify;
      ctx.stroke();
    });
  }

  private questionTexture() {
    return this.paperTexture("question", QUESTION, QUESTION_INNER);
  }

  private panelTexture() {
    return this.paperTexture("panel", PANEL, PANEL_INNER);
  }

  /**
   * Thẻ bóng kèm bóng đổ (chung một ảnh). Thẻ rê chuột: viền nét đứt và bóng lệch thêm 6 px vì mặt
   * thẻ nhấc lên 6 px còn bóng đứng yên.
   */
  private cardTexture(state: CardState) {
    const c = this.colors;
    const { w, h } = this.layout;
    const shadow = state === "hover" ? CARD.shadow + CARD.lift : CARD.shadow;
    const pad = 6;
    return this.texture(
      `card-${w}x${h}-${state}`,
      w + 2 * pad,
      h + 2 * (CARD.shadow + CARD.lift + pad),
      (ctx) => {
        roundRectPath(ctx, -w / 2, -h / 2 + shadow, w, h, CARD.radius);
        ctx.fillStyle = c.sticker;
        ctx.fill();
        roundRectPath(ctx, -w / 2, -h / 2, w, h, CARD.radius);
        ctx.fillStyle = c.face;
        ctx.fill();
        if (state === "hover") {
          ctx.setLineDash(evenDash(w, h, CARD.radius, HOVER_DASH));
          ctx.lineCap = "butt";
        }
        ctx.lineWidth = CARD.border;
        ctx.strokeStyle = c.border;
        ctx.stroke();
      },
    );
  }

  /** Vòng vàng viền mực quanh thẻ đúng (nằm dưới thẻ). */
  private ringTexture() {
    const c = this.colors;
    const { w, h } = this.layout;
    const grow = RING.gap + RING.width / 2;
    const outer = 2 * (grow + RING.width / 2 + RING.ink + 4);
    return this.texture(`ring-${w}x${h}`, w + outer, h + outer, (ctx) => {
      roundRectPath(
        ctx,
        -w / 2 - grow,
        -h / 2 - grow,
        w + 2 * grow,
        h + 2 * grow,
        CARD.radius + grow,
      );
      ctx.lineWidth = RING.width + 2 * RING.ink;
      ctx.strokeStyle = c.border;
      ctx.stroke();
      ctx.lineWidth = RING.width;
      ctx.strokeStyle = c.primary;
      ctx.stroke();
    });
  }

  /** Huy hiệu ✓: tròn vàng viền mực có bóng. */
  private badgeTexture() {
    const c = this.colors;
    const size = 2 * (BADGE_R + 10);
    return this.texture("badge-ok", size, size, (ctx) => {
      ctx.beginPath();
      ctx.arc(0, 5, BADGE_R, 0, Math.PI * 2);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, BADGE_R, 0, Math.PI * 2);
      ctx.fillStyle = c.primary;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.border;
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.strokeStyle = c.primaryFg;
      ctx.stroke(new Path2D(CHECK));
    });
  }

  /** Dấu ✗ màu lỗi viền trắng. */
  private crossTexture() {
    const c = this.colors;
    return this.texture("cross", 84, 84, (ctx) => {
      const path = new Path2D(CROSS);
      ctx.lineWidth = 20;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke(path);
      ctx.lineWidth = 10;
      ctx.strokeStyle = c.destructive;
      ctx.stroke(path);
    });
  }

  /** Vòng khoanh chi tiết khác (đơn vị khung, nằm trong khung vẽ vật nên co theo thẻ). */
  private diffRingTexture(radius: number) {
    const c = this.colors;
    const r = Math.round(radius);
    const size = 2 * r + DIFF_RING.under + 4;
    return this.texture(`diff-${r}`, size, size, (ctx) => {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.lineWidth = DIFF_RING.under;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      const length = 2 * Math.PI * r;
      const [dash, gap] = DIFF_RING.dash;
      const k = length / Math.max(1, Math.round(length / (dash + gap))) / (dash + gap);
      ctx.setLineDash([dash * k, gap * k]);
      ctx.lineCap = "butt";
      ctx.lineWidth = DIFF_RING.over;
      ctx.strokeStyle = c.destructive;
      ctx.stroke();
    });
  }
}
