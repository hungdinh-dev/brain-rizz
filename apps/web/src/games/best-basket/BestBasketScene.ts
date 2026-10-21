import {
  type BestBasketItem,
  type BestBasketPuzzle,
  type BestBasketSnack,
  type BestBasketTotals,
  bestBasket,
  bestBasketTotals,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import type { MinigameBridge } from "../types";
import {
  bagArt,
  basketBackArt,
  basketRimArt,
  CELL,
  COLORS,
  circle,
  coinArt,
  type Pt,
  ropeArt,
  roundRect,
  type Shape,
  snackArt,
  starArt,
  TRAY,
  trayArt,
} from "./art";

/*
 * Giỏ hời nhất — chạm giỏ nhiều sao nhất mà tổng giá không vượt số xu trong túi.
 * Đặc tả: docs/04-minigames/best-basket.md (mục "Ghi chú cho FE"). Chấm ở client để phản hồi tức
 * thì; mỗi câu gửi đúng một đáp án (chỉ số giỏ), server chấm lại. Tổng giá / tổng sao lúc hiện đáp
 * án lấy từ `bestBasketTotals`, scene không tự tính luật.
 *
 * Không có chữ nào ngoài chữ số; dấu + − < > → · ✓ ✗ vẽ bằng Graphics (không phụ thuộc font).
 */

// ── Bố cục (khung 720×1280, px thiết kế; bảng "Bố cục" của đặc tả) ───────────────────────────────

/** Túi xu ở góc trái trên, lệch khỏi dải huy hiệu khoá ở giữa. */
const BAG = { x: 24, y: 96, w: 276, h: 140, r: 28 };
const BAG_ICON = { x: 96, y: 168, k: 0.95 };
const BUDGET = { x: 222, y: 166, font: 80 };
/** Thẻ luật ở góc phải trên (Khó: một thẻ; Siêu khó: hai thẻ cao 62 xếp chồng). */
const RULES = { x: 320, y: 96, w: 376, h: 140, r: 28 };
const RULE_HALF = { h: 62, gap: 16, r: 20 };
/** Lưới giỏ 2×2 (Thường trở lên): tâm cột, tâm hàng. */
const GRID_X = [188, 532] as const;
const GRID_Y = [500, 1004] as const;
/** Khay Mầm xếp dọc. */
const TRAY_X = 360;
const TRAY_Y = [416, 752, 1088] as const;
/** Bóng đổ phẳng của thẻ, giỏ (px thiết kế). */
const SHADOW = 8;
/** Bóng phẳng của món, theo đơn vị hình (ô 120). */
const SNACK_SHADOW = 6;

const FONT_FAMILY = '"Baloo 2", "Be Vietnam Pro", sans-serif';
const FONT_WEIGHT = "800";
/** Chân chữ đặt thấp hơn tâm 0,35 cỡ chữ thì chữ số nằm giữa theo chiều dọc. */
const DIGIT_DROP = 0.35;
/** Chờ font tối đa ngần này ms trước câu đầu, quá thì vẽ bằng font dự phòng. */
const FONT_TIMEOUT_MS = 1500;

// ── Chuyển động ────────────────────────────────────────────────────────────────────────────

/** Giỏ trượt nhẹ vào chỗ (tổng ≤ 200 ms kể cả so le). */
const SLIDE_PX = 28;
const SLIDE_MS = 150;
const SLIDE_STAGGER_MS = 12;
const HOVER_LIFT = 2;
const HOVER_SCALE = 1.02;
/** Đúng → câu mới. */
const NEXT_MS = 300;
const SHAKE_MS = 200;
const BLINK_MS = 130;
/** Giỏ lố tiền lúc hiện đáp án. */
const OVER_DIM = 0.5;
/** Giá chưa giảm (giỏ ưu đãi) mờ hơn giá sau giảm. */
const FAINT = 0.7;

type Sign = "+" | "-" | "<" | ">" | "dot" | "arrow";

/** Một mẩu của dòng chữ số + biểu tượng (dòng tổng, đuôi thẻ luật). */
type Piece =
  | { t: "num"; n: number; size: number; strike?: "thin" | "bold"; faint?: boolean; color?: number }
  | { t: "coin"; r: number }
  | { t: "star"; r: number }
  | { t: "mark"; ok: boolean; r: number }
  | { t: "sign"; s: Sign; size: number; color?: number }
  | { t: "gap"; w: number };

/** Màu lấy từ token giao diện lúc vẽ câu, để thẻ và nét vẽ nổi trên cả nền sáng lẫn tối. */
interface Ink {
  card: number;
  cardFg: number;
  sticker: number;
  danger: number;
  accent: number;
  accentFg: number;
}

/** Một giỏ (khay ở Mầm) của câu hiện tại. */
interface BasketView {
  /** Trượt vào, rung, nảy. */
  node: Phaser.GameObjects.Container;
  /** Nhấc lên khi rê chuột. */
  inner: Phaser.GameObjects.Container;
  /** Giỏ, món, thẻ giá, thẻ sao: mờ đi khi lố tiền. */
  body: Phaser.GameObjects.Container;
  /** Viền liền của giỏ; ẩn khi đổi sang viền nét đứt. */
  edge: Phaser.GameObjects.Graphics;
  /** Dòng tổng, viền trạng thái, dấu ✓/✗, dây nối: không bị mờ cùng giỏ. */
  overlay: Phaser.GameObjects.Container;
  zone: Phaser.GameObjects.Zone;
  w: number;
  h: number;
  r: number;
  tray: boolean;
}

type Place = { x: number; y: number; k: number };

const cssColor = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/** Đọc token màu CSS (tự đổi theo sáng/tối) tại canvas; thiếu token thì dùng màu giao diện sáng. */
function readInk(el: Element): Ink {
  const css = getComputedStyle(el);
  const pick = (name: string, fallback: number) => {
    const value = css.getPropertyValue(name).trim();
    return value ? Phaser.Display.Color.ValueToColor(value).color : fallback;
  };
  return {
    card: pick("--card", 0xfff8ef),
    cardFg: pick("--card-foreground", 0x1f1b3a),
    sticker: pick("--sticker", 0x1f1b3a),
    danger: pick("--destructive", 0xc93a55),
    // Vòng vàng giỏ đúng và dấu ✓ dùng vàng sun `--primary`, như Đếm tiền nhanh. `--highlight`
    // của bộ token là màu xanh lá (link), không phải vàng.
    accent: pick("--primary", 0xffd166),
    accentFg: pick("--primary-foreground", 0x1f1b3a),
  };
}

/** Chờ Baloo 2 tải xong (chữ trên canvas vẽ một lần, không tự vẽ lại khi font về muộn). */
function waitForFont(): Promise<void> {
  const fonts = document.fonts;
  if (!fonts) return Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, FONT_TIMEOUT_MS);
  });
  const load = fonts.load(`${FONT_WEIGHT} 64px "Baloo 2"`, "0123456789").then(
    () => {},
    () => {},
  );
  return Promise.race([load, timeout]).finally(() => clearTimeout(timer));
}

// ── Vẽ bằng Graphics ──────────────────────────────────────────────────────────────────────────

/** `fillPoints`/`strokePoints` của Phaser 4 nhận mảng Vector2. Mỗi câu chỉ vẽ một lần nên đổi kiểu ở đây. */
const toVectors = (pts: Pt[]) => pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));

/** Nét thẳng đầu tròn (tô bằng `fillStyle` hiện tại). */
function stroke(g: Phaser.GameObjects.Graphics, from: Pt, to: Pt, width: number) {
  const r = width / 2;
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  const cap = (c: Pt, start: number) =>
    Array.from({ length: 9 }, (_, i) => {
      const t = start + (Math.PI * i) / 8;
      return { x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) };
    });
  g.fillPoints(toVectors([...cap(to, a - Math.PI / 2), ...cap(from, a + Math.PI / 2)]), true);
}

/** Nét mở dày, đầu tròn (và khớp tròn khi ít đỉnh). */
function polyline(g: Phaser.GameObjects.Graphics, pts: Pt[], width: number, color: number) {
  g.lineStyle(width, color, 1);
  g.strokePoints(toVectors(pts), false);
  if (width < 4) return;
  g.fillStyle(color, 1);
  const joints = pts.length <= 4 ? pts : [pts[0]!, pts[pts.length - 1]!];
  for (const p of joints) g.fillCircle(p.x, p.y, width / 2);
}

/**
 * Vẽ một hình của `art.ts` tại `at` (phóng `k`). `mono` = tô mọi nét một màu (bóng phẳng), viền
 * dùng mực nhãn dán `sticker`.
 */
function drawShapes(
  g: Phaser.GameObjects.Graphics,
  shapes: readonly Shape[],
  at: Place,
  sticker: number,
  mono?: number,
) {
  for (const shape of shapes) {
    const pts = shape.pts.map((p) => ({ x: at.x + p.x * at.k, y: at.y + p.y * at.k }));
    if (shape.kind === "fill") {
      g.fillStyle(mono ?? shape.color, mono === undefined ? (shape.alpha ?? 1) : 1);
      g.fillPoints(toVectors(pts), true);
      if (shape.outline) {
        g.lineStyle(shape.outline * at.k, mono ?? sticker, 1);
        g.strokePoints(toVectors(pts), true, true);
      }
    } else {
      if (shape.outline) {
        polyline(g, pts, (shape.width + 2 * shape.outline) * at.k, mono ?? sticker);
      }
      polyline(g, pts, shape.width * at.k, mono ?? shape.color);
    }
  }
}

/** Món ăn vặt có bóng phẳng mực nhãn dán phía dưới. */
function drawSnack(g: Phaser.GameObjects.Graphics, kind: BestBasketSnack, at: Place, ink: Ink) {
  const art = snackArt(kind);
  drawShapes(g, art, { ...at, y: at.y + SNACK_SHADOW * at.k }, ink.sticker, ink.sticker);
  drawShapes(g, art, at, ink.sticker);
}

/** Thẻ giấy dán: bóng đổ, nền thẻ, viền mực. */
function drawCard(
  g: Phaser.GameObjects.Graphics,
  ink: Ink,
  box: { x: number; y: number; w: number; h: number; r: number },
  shadow = SHADOW,
) {
  g.fillStyle(ink.sticker, 1);
  g.fillRoundedRect(box.x, box.y + shadow, box.w, box.h, box.r);
  g.fillStyle(ink.card, 1);
  g.fillRoundedRect(box.x, box.y, box.w, box.h, box.r);
  g.lineStyle(4, ink.cardFg, 1);
  g.strokeRoundedRect(box.x, box.y, box.w, box.h, box.r);
}

/** Nét đứt dọc một đường khép kín (đang dùng `lineStyle` hiện tại của `g`). */
function strokeDashed(g: Phaser.GameObjects.Graphics, pts: Pt[], dash: number, gap: number) {
  let drawing = true;
  let left = dash;
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    let at = 0;
    while (length - at > 1e-6) {
      const step = Math.min(left, length - at);
      if (drawing) {
        const t0 = at / length;
        const t1 = (at + step) / length;
        g.lineBetween(
          a.x + (b.x - a.x) * t0,
          a.y + (b.y - a.y) * t0,
          a.x + (b.x - a.x) * t1,
          a.y + (b.y - a.y) * t1,
        );
      }
      at += step;
      left -= step;
      if (left <= 1e-6) {
        drawing = !drawing;
        left = drawing ? dash : gap;
      }
    }
  });
}

/** Huy hiệu tròn ✓ (vàng) hoặc ✗ (báo lỗi). Vẽ quanh (0, 0). */
function drawMark(g: Phaser.GameObjects.Graphics, ink: Ink, ok: boolean, r: number) {
  const k = r / 28;
  g.fillStyle(ink.sticker, 1);
  g.fillCircle(0, 5 * k, r);
  g.fillStyle(ok ? ink.accent : ink.danger, 1);
  g.lineStyle(Math.max(2.5, 4 * k), ink.sticker, 1);
  g.fillCircle(0, 0, r);
  g.strokeCircle(0, 0, r);
  if (ok) {
    g.fillStyle(ink.accentFg, 1);
    const bend = { x: -3 * k, y: 11 * k };
    stroke(g, { x: -13 * k, y: 1 * k }, bend, 6.5 * k);
    stroke(g, bend, { x: 14 * k, y: -10 * k }, 6.5 * k);
  } else {
    g.fillStyle(COLORS.white, 1);
    stroke(g, { x: -11 * k, y: -11 * k }, { x: 11 * k, y: 11 * k }, 7 * k);
    stroke(g, { x: 11 * k, y: -11 * k }, { x: -11 * k, y: 11 * k }, 7 * k);
  }
}

/** Dấu phấn + − < > · → quanh (0, 0), cao khoảng `size` × 0,5. */
function drawSign(g: Phaser.GameObjects.Graphics, sign: Sign, size: number, color: number) {
  const w = size * 0.13;
  const a = size * 0.24;
  g.fillStyle(color, 1);
  switch (sign) {
    case "+":
      stroke(g, { x: -a, y: 0 }, { x: a, y: 0 }, w);
      stroke(g, { x: 0, y: -a }, { x: 0, y: a }, w);
      break;
    case "-":
      stroke(g, { x: -a, y: 0 }, { x: a, y: 0 }, w);
      break;
    case "<":
    case ">": {
      const d = sign === "<" ? 1 : -1;
      stroke(g, { x: d * a * 0.8, y: -a }, { x: -d * a * 0.8, y: 0 }, w);
      stroke(g, { x: -d * a * 0.8, y: 0 }, { x: d * a * 0.8, y: a }, w);
      break;
    }
    case "dot":
      g.fillCircle(0, 0, size * 0.08);
      break;
    case "arrow":
      stroke(g, { x: -size * 0.4, y: 0 }, { x: size * 0.38, y: 0 }, w);
      stroke(g, { x: size * 0.14, y: -size * 0.22 }, { x: size * 0.4, y: 0 }, w);
      stroke(g, { x: size * 0.14, y: size * 0.22 }, { x: size * 0.4, y: 0 }, w);
      break;
  }
}

function signWidth(sign: Sign, size: number): number {
  if (sign === "dot") return size * 0.34;
  if (sign === "arrow") return size * 0.9;
  if (sign === "<" || sign === ">") return size * 0.52;
  return size * 0.62;
}

/** Tâm giỏ `i` (Mầm: khay xếp dọc; mức khác: lưới 2×2 đọc theo hàng). */
function basketCenter(i: number, tray: boolean): Pt {
  if (tray) return { x: TRAY_X, y: TRAY_Y[i] ?? TRAY_Y[0] };
  return { x: GRID_X[i % 2] ?? GRID_X[0], y: GRID_Y[Math.floor(i / 2)] ?? GRID_Y[0] };
}

/**
 * Giỏ hời nhất — scene Phaser. Câu đầu là `bridge.startIndex` (nối lại giữa vòng). Sau lần chạm
 * đầu tiên của câu, mọi chạm khác bị bỏ qua tới câu mới.
 */
export default class BestBasketScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = true;
  private puzzle?: BestBasketPuzzle;
  private ink!: Ink;
  private reduced = false;
  private board?: Phaser.GameObjects.Container;
  private basketLayer?: Phaser.GameObjects.Container;
  private views: BasketView[] = [];

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.locked = true;
  }

  create() {
    // Phaser tự dọn tween và hẹn giờ khi scene tắt; dọn thêm tham chiếu để không giữ câu cũ.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.locked = true;
      this.tweens.killAll();
      this.time.removeAllEvents();
      this.views = [];
      this.puzzle = undefined;
    });
    void waitForFont().then(() => {
      // Hết vòng trong lúc chờ font thì scene đã bị huỷ.
      if (this.sys.isActive()) this.showPuzzle();
    });
  }

  private showPuzzle() {
    // Mọi tween đang chạy đều thuộc câu cũ (trượt, nảy, rung, nhấp nháy): dừng trước khi huỷ.
    this.tweens.killAll();
    this.board?.destroy();

    const puzzle = bestBasket.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    this.puzzle = puzzle;
    this.ink = readInk(this.game.canvas);
    this.reduced = prefersReducedMotion();
    const tray = puzzle.baskets.every((basket) => basket.length === 1);

    const top = [this.createBag(puzzle.budget), ...this.createRules(puzzle)];
    const basketLayer = this.add.container();
    this.views = puzzle.baskets.map((basket, i) => this.createBasket(basket, i, tray));
    basketLayer.add(this.views.map((view) => view.node));
    this.basketLayer = basketLayer;
    // Vùng chạm nằm trên cùng, đứng yên ở chỗ cuối (không theo hiệu ứng trượt).
    const zones = this.views.map((view) => view.zone);
    this.board = this.add.container(0, 0, [...top, basketLayer, ...zones]);
    // Chạm được ngay, không chờ giỏ trượt xong.
    this.locked = false;
  }

  // ── Dựng câu ─────────────────────────────────────────────────────────────────────────────

  /** Túi xu: thẻ góc trái trên, hình túi vải có đồng xu và số xu to. */
  private createBag(budget: number) {
    const g = this.add.graphics();
    drawCard(g, this.ink, BAG);
    const art = bagArt();
    const k = BAG_ICON.k;
    drawShapes(
      g,
      art,
      { x: BAG_ICON.x, y: BAG_ICON.y + SNACK_SHADOW * k, k },
      this.ink.sticker,
      this.ink.sticker,
    );
    drawShapes(g, art, BAG_ICON, this.ink.sticker);
    const text = this.label(String(budget), BUDGET.font, this.ink.cardFg);
    text.setPosition(BUDGET.x, text.y + BUDGET.y);
    return this.add.container(0, 0, [g, text]);
  }

  /** Thẻ luật: Khó một thẻ đi kèm; Siêu khó thẻ đi kèm trên, thẻ ưu đãi dưới. */
  private createRules(puzzle: BestBasketPuzzle): Phaser.GameObjects.Container[] {
    const { combo, deal } = puzzle;
    if (!combo && !deal) return [];
    if (combo && deal) {
      const upper = { ...RULES, h: RULE_HALF.h, r: RULE_HALF.r };
      const lower = { ...upper, y: RULES.y + RULE_HALF.h + RULE_HALF.gap };
      return [
        this.createRuleCard(upper, combo.kinds, true, this.comboTail(combo.bonus, 32, 14)),
        this.createRuleCard(lower, [deal.kind, deal.kind], false, this.dealTail(deal.discount)),
      ];
    }
    if (combo) {
      return [this.createRuleCard(RULES, combo.kinds, true, this.comboTail(combo.bonus, 40, 18))];
    }
    const only = deal!;
    return [
      this.createRuleCard(RULES, [only.kind, only.kind], false, this.dealTail(only.discount)),
    ];
  }

  private comboTail(bonus: number, size: number, r: number): Piece[] {
    return [
      { t: "sign", s: "+", size },
      { t: "num", n: bonus, size },
      { t: "star", r },
    ];
  }

  private dealTail(discount: number): Piece[] {
    return [
      { t: "coin", r: 14 },
      { t: "sign", s: "-", size: 32 },
      { t: "num", n: discount, size: 32 },
    ];
  }

  /**
   * Một thẻ luật: hình A —dây nối— hình B (đi kèm) hoặc hình C hình C (ưu đãi), mũi tên, rồi phần
   * thưởng / phần giảm. Chỉ hình và chữ số, không có chữ.
   */
  private createRuleCard(
    box: { x: number; y: number; w: number; h: number; r: number },
    kinds: readonly [BestBasketSnack, BestBasketSnack],
    linked: boolean,
    tail: Piece[],
  ) {
    const ink = this.ink;
    const tall = box.h > RULE_HALF.h;
    const g = this.add.graphics();
    drawCard(g, ink, box, tall ? SHADOW : 5);
    const cy = box.y + box.h / 2;
    // Hình A ở mép trái, phần thưởng / phần giảm sát mép phải, mũi tên nằm giữa khoảng trống còn
    // lại. Mũi tên đặt theo bố cục thẻ đi kèm ở cả hai thẻ để hai thẻ Siêu khó thẳng hàng.
    const icon = tall ? 70 : 54;
    const k = icon / 120;
    const pad = tall ? 16 : 12;
    const ax = box.x + pad + icon / 2;
    const linkGap = tall ? 40 : 50;
    const bx = ax + icon + (linked ? linkGap : 6);
    if (linked) {
      drawShapes(
        g,
        ropeArt({ x: ax + icon * 0.42, y: cy }, { x: bx - icon * 0.42, y: cy }, tall ? 10 : 6, 5),
        { x: 0, y: 0, k: 1 },
        ink.sticker,
      );
    }
    drawSnack(g, kinds[0], { x: ax, y: cy - 2, k }, ink);
    drawSnack(g, kinds[1], { x: bx, y: cy - 2, k }, ink);
    const built = this.buildRow(tail);
    const tailLeft = box.x + box.w - pad - built.width;
    const row = built.node.setPosition(tailLeft + built.width / 2, cy);
    const linkedRight = ax + icon * 1.5 + linkGap;
    const arrow = this.add.graphics({ x: (linkedRight + tailLeft) / 2, y: cy });
    drawSign(arrow, "arrow", tall ? 36 : 30, ink.cardFg);
    return this.add.container(0, 0, [g, arrow, row]);
  }

  private createBasket(basket: readonly BestBasketItem[], i: number, tray: boolean): BasketView {
    const ink = this.ink;
    const layout = tray ? TRAY : CELL;
    const { w, h, r } = layout;
    const at = basketCenter(i, tray);

    const g = this.add.graphics();
    g.fillStyle(ink.sticker, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + SHADOW, w, h, r);
    g.fillStyle(ink.card, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    const texts = tray ? this.drawTray(g, basket) : this.drawGridBasket(g, basket);
    const edge = this.add.graphics();
    edge.lineStyle(5, ink.cardFg, 1);
    edge.strokeRoundedRect(-w / 2, -h / 2, w, h, r);

    const body = this.add.container(0, 0, [g, edge, ...texts]);
    const overlay = this.add.container();
    const inner = this.add.container(0, 0, [body, overlay]);
    const node = this.add.container(at.x, at.y, [inner]);

    // Vùng chạm là cả giỏ (328 × 488; khay Mầm 672 × 320); món, thẻ giá không nhận chạm riêng.
    const zone = this.add.zone(at.x, at.y, w, h).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", () => this.choose(i));
    zone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch || this.locked) return;
      inner.setPosition(0, -HOVER_LIFT).setScale(HOVER_SCALE);
    });
    zone.on("pointerout", () => inner.setPosition(0, 0).setScale(1));

    if (!this.reduced) {
      node.setAlpha(0).setY(at.y + SLIDE_PX);
      this.tweens.add({
        targets: node,
        y: at.y,
        alpha: 1,
        duration: SLIDE_MS,
        delay: i * SLIDE_STAGGER_MS,
        ease: "Quad.easeOut",
      });
    }
    return { node, inner, body, edge, overlay, zone, w, h, r, tray };
  }

  /** Giỏ đan 2 món (Thường trở lên): quai, thân giỏ, món, vành, thẻ giá rồi thẻ sao dưới mỗi món. */
  private drawGridBasket(g: Phaser.GameObjects.Graphics, basket: readonly BestBasketItem[]) {
    const ink = this.ink;
    const origin = { x: 0, y: 0, k: 1 };
    drawShapes(g, basketBackArt(), origin, ink.sticker);
    basket.forEach((item, j) => {
      const p = CELL.items[j] ?? CELL.items[0];
      drawSnack(g, item.kind, { x: p.x, y: p.y, k: CELL.itemScale }, ink);
    });
    drawShapes(g, basketRimArt(), origin, ink.sticker);
    const texts: Phaser.GameObjects.Text[] = [];
    basket.forEach((item, j) => {
      const x = (CELL.items[j] ?? CELL.items[0]).x;
      texts.push(this.drawTag(g, x, CELL.priceY, "coin", item.price, CELL.tag));
      texts.push(this.drawTag(g, x, CELL.starY, "star", item.stars, CELL.tag));
    });
    return texts;
  }

  /** Khay Mầm: món to bên trái; thẻ giá to và hàng 1–5 ngôi sao (không ghi số) bên phải. */
  private drawTray(g: Phaser.GameObjects.Graphics, basket: readonly BestBasketItem[]) {
    const ink = this.ink;
    const item = basket[0];
    if (!item) return [];
    drawShapes(g, trayArt(), { x: 0, y: 0, k: 1 }, ink.sticker);
    drawSnack(g, item.kind, { ...TRAY.item, k: TRAY.itemScale }, ink);
    const { price, stars } = TRAY;
    const text = this.drawTag(g, price.x, price.y, "coin", item.price, price);
    const star = starArt(stars.r);
    for (let s = 0; s < item.stars; s++) {
      drawShapes(
        g,
        star,
        { x: stars.x + s * stars.step, y: stars.y + 4, k: 1 },
        ink.sticker,
        ink.sticker,
      );
      drawShapes(g, star, { x: stars.x + s * stars.step, y: stars.y, k: 1 }, ink.sticker);
    }
    return [text];
  }

  /** Thẻ giá (đồng xu + số) hoặc thẻ sao (ngôi sao + số), hình viên thuốc quanh (x, y). */
  private drawTag(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    icon: "coin" | "star",
    value: number,
    size: { w: number; h: number; icon: number; font: number },
  ) {
    const ink = this.ink;
    const left = x - size.w / 2;
    const top = y - size.h / 2;
    const radius = size.h / 2;
    g.fillStyle(ink.sticker, 1);
    g.fillRoundedRect(left, top + 4, size.w, size.h, radius);
    g.fillStyle(ink.card, 1);
    g.fillRoundedRect(left, top, size.w, size.h, radius);
    g.lineStyle(3.5, ink.cardFg, 1);
    g.strokeRoundedRect(left, top, size.w, size.h, radius);
    const iconX = left + radius * 0.5 + size.icon;
    drawShapes(
      g,
      icon === "coin" ? coinArt(size.icon) : starArt(size.icon),
      { x: iconX, y, k: 1 },
      ink.sticker,
    );
    const text = this.label(String(value), size.font, ink.cardFg);
    text.setPosition((iconX + size.icon + left + size.w) / 2, text.y + y);
    return text;
  }

  /** Chữ số Baloo 2 căn giữa theo `centerY` (tâm chữ số). */
  private label(text: string, size: number, color: number, centerY = 0) {
    const t = this.add.text(0, 0, text, {
      fontFamily: FONT_FAMILY,
      fontStyle: FONT_WEIGHT,
      fontSize: size,
      color: cssColor(color),
    });
    t.setOrigin(0.5, 0);
    t.y = centerY + DIGIT_DROP * size - t.getTextMetrics().ascent;
    return t;
  }

  /**
   * Dòng chữ số + biểu tượng căn giữa quanh (0, 0); thu nhỏ cho vừa `maxW`. Trả kèm các huy hiệu
   * ✓/✗ trong dòng (để nhấp nháy).
   */
  private buildRow(pieces: Piece[], maxW = Number.POSITIVE_INFINITY) {
    const ink = this.ink;
    const parts: Array<{ obj?: Phaser.GameObjects.Container; w: number }> = [];
    const marks: Phaser.GameObjects.Container[] = [];
    for (const piece of pieces) {
      if (piece.t === "gap") {
        parts.push({ w: piece.w });
        continue;
      }
      const c = this.add.container();
      let w = 0;
      if (piece.t === "num") {
        const text = this.label(String(piece.n), piece.size, piece.color ?? ink.cardFg);
        if (piece.faint) text.setAlpha(FAINT);
        w = text.width;
        c.add(text);
        if (piece.strike) {
          const bold = piece.strike === "bold";
          const line = this.add.graphics();
          line.fillStyle(bold ? ink.danger : ink.cardFg, 1);
          const dx = w / 2 + piece.size * 0.06;
          const dy = piece.size * 0.2;
          stroke(line, { x: -dx, y: dy }, { x: dx, y: -dy }, piece.size * (bold ? 0.12 : 0.08));
          c.add(line);
        }
      } else {
        const g = this.add.graphics();
        if (piece.t === "coin" || piece.t === "star") {
          const art = piece.t === "coin" ? coinArt(piece.r) : starArt(piece.r);
          drawShapes(g, art, { x: 0, y: 0, k: 1 }, ink.sticker);
          w = piece.r * 2;
        } else if (piece.t === "mark") {
          drawMark(g, ink, piece.ok, piece.r);
          w = piece.r * 2;
          marks.push(c);
        } else {
          drawSign(g, piece.s, piece.size, piece.color ?? ink.cardFg);
          w = signWidth(piece.s, piece.size);
        }
        c.add(g);
      }
      parts.push({ obj: c, w });
    }
    const gap = 7;
    const total = parts.reduce((sum, part) => sum + part.w, 0) + gap * (parts.length - 1);
    let x = -total / 2;
    for (const part of parts) {
      part.obj?.setX(x + part.w / 2);
      x += part.w + gap;
    }
    const node = this.add.container(
      0,
      0,
      parts.flatMap((part) => (part.obj ? [part.obj] : [])),
    );
    if (total > maxW) node.setScale(maxW / total);
    return { node, marks, width: Math.min(total, maxW) };
  }

  // ── Trả lời ──────────────────────────────────────────────────────────────────────────────

  /** Lần chạm đầu tiên của câu: gửi đáp án; mọi chạm sau đó bị bỏ qua tới câu mới. */
  private choose(choice: number) {
    const puzzle = this.puzzle;
    if (this.locked || !puzzle) return;
    this.locked = true;
    for (const view of this.views) {
      view.zone.disableInteractive(true);
      view.inner.setPosition(0, 0).setScale(1);
    }

    const index = this.index;
    const correct = bestBasket.check(puzzle, choice);
    this.bridge.submit(index, choice);
    this.index += 1;

    if (correct) {
      this.showRight(puzzle, choice);
      this.time.delayedCall(NEXT_MS, () => this.showPuzzle());
      return;
    }

    this.showMiss(puzzle, choice);
    // Hết khoá theo `lockedUntil` của server (không tự đếm 1,5 giây) để khớp huy hiệu khoá của khung.
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive()) return;
      this.time.delayedCall(ms, () => this.showPuzzle());
    });
  }

  /** Đúng: giỏ đã chọn viền vàng + ✓, dòng tổng của giỏ đó hiện thoáng, giỏ nảy nhẹ. */
  private showRight(puzzle: BestBasketPuzzle, choice: number) {
    const view = this.views[choice];
    const basket = puzzle.baskets[choice];
    if (!view || !basket) return;
    this.basketLayer?.bringToTop(view.node);
    this.frame(view, "right");
    this.cornerMark(view, true, 34);
    this.showTotals(view, puzzle, bestBasketTotals(basket, puzzle));
    if (this.reduced) return;
    this.tweens.add({
      targets: view.node,
      scale: 1.04,
      duration: 90,
      yoyo: true,
      ease: "Sine.easeOut",
    });
  }

  /**
   * Sai → khoá (mục "Hiện đáp án đúng khi sai" của đặc tả). Mọi thứ nằm trong vùng giỏ (y ≥ 256),
   * dưới dải huy hiệu khoá của khung:
   * - dòng tổng ở mọi giỏ; giỏ lố tiền mờ 50 %, viền nét đứt, số giá gạch, kèm "> 🪙túi";
   * - giỏ đúng vòng vàng dày + ✓ to; giỏ đã chạm viền nét đứt đỏ + ✗ và rung;
   * - chạm giỏ lố (bẫy): ✗ trong dòng tổng nhấp nháy hai lần; chạm giỏ vừa tiền ít sao: "★a < ★b";
   * - giỏ đủ cặp đi kèm: dây nối giữa hai món + "+2★"; giỏ ưu đãi: giá chưa giảm gạch + huy hiệu xu "−2".
   */
  private showMiss(puzzle: BestBasketPuzzle, choice: number) {
    const totals = puzzle.baskets.map((basket) => bestBasketTotals(basket, puzzle));
    const answer = puzzle.answerIndex;
    const best = totals[answer];
    if (!best) return;

    this.views.forEach((view, i) => {
      const t = totals[i];
      if (!t) return;
      const over = t.price > puzzle.budget;
      const chosen = i === choice;
      if (over) view.body.setAlpha(OVER_DIM);
      if (i === answer) this.frame(view, "right");
      else if (chosen) this.frame(view, "wrong");
      else if (over) this.frame(view, "over");
      if (t.comboApplied) this.showCombo(view);
      if (t.dealTimes > 0 && puzzle.deal) this.showDeal(view, puzzle.deal.discount);
      const compare = chosen && !over ? best.stars : undefined;
      const marks = this.showTotals(view, puzzle, t, compare);
      if (chosen && over && !this.reduced) {
        this.tweens.add({
          targets: marks,
          alpha: 0.15,
          duration: BLINK_MS,
          yoyo: true,
          repeat: 1,
        });
      }
      if (compare !== undefined && view.tray) this.underlineStars(view, t.stars, false);
      if (i === answer && totals[choice] && totals[choice].price <= puzzle.budget && view.tray) {
        this.underlineStars(view, t.stars, true);
      }
    });

    const right = this.views[answer];
    const wrong = this.views[choice];
    if (right) {
      this.cornerMark(right, true, 36);
      this.basketLayer?.bringToTop(right.node);
    }
    if (!wrong) return;
    this.cornerMark(wrong, false, 30);
    // Dấu ✗ nằm sát mép trên giỏ, có thể chạm vòng vàng của giỏ bên trên: đưa giỏ đã chạm lên trên cùng.
    this.basketLayer?.bringToTop(wrong.node);
    if (this.reduced) return;
    const x = wrong.node.x;
    this.tweens.add({
      targets: wrong.node,
      x: x + 10,
      duration: SHAKE_MS / 4,
      yoyo: true,
      repeat: 1,
      ease: "Sine.easeInOut",
    });
  }

  /** Viền trạng thái: vòng vàng dày (đúng), nét đứt đỏ (đã chạm sai), nét đứt mực (lố tiền). */
  private frame(view: BasketView, state: "right" | "wrong" | "over") {
    const ink = this.ink;
    const { w, h, r } = view;
    const g = this.add.graphics();
    if (state === "right") {
      const pad = 8;
      g.lineStyle(14, ink.sticker, 1);
      g.strokeRoundedRect(-w / 2 - pad, -h / 2 - pad, w + 2 * pad, h + 2 * pad, r + pad);
      g.lineStyle(8, ink.accent, 1);
      g.strokeRoundedRect(-w / 2 - pad, -h / 2 - pad, w + 2 * pad, h + 2 * pad, r + pad);
    } else {
      view.edge.setVisible(false);
      if (state === "wrong") g.lineStyle(6, ink.danger, 1);
      else g.lineStyle(5, ink.cardFg, 0.75);
      strokeDashed(g, roundRect(-w / 2, -h / 2, w, h, r), 18, 12);
    }
    view.overlay.add(g);
  }

  /** Huy hiệu ✓/✗ ở góc phải trên của giỏ. */
  private cornerMark(view: BasketView, ok: boolean, r: number) {
    const g = this.add.graphics({ x: view.w / 2 - 16, y: -view.h / 2 + 4 });
    drawMark(g, this.ink, ok, r);
    view.overlay.add(g);
    if (this.reduced) return;
    g.setScale(0.5);
    this.tweens.add({ targets: g, scale: 1, duration: 160, ease: "Back.easeOut" });
  }

  /**
   * Dòng tổng ở đáy giỏ, lấy từ `bestBasketTotals`: "🪙7 ✓ · ★9"; lố tiền "🪙9̶ ✗ > 🪙8 · ★8".
   * Giỏ ưu đãi thêm giá chưa giảm (gạch mảnh) trước giá sau giảm. Dòng phụ: "+2★" khi được thưởng,
   * "★6 < ★7" ở giỏ đã chạm khi vừa tiền mà ít sao hơn (`compare` = sao của giỏ đúng).
   * Khay Mầm chỉ ghi giá (sao đã vẽ thành hàng ngôi sao).
   */
  private showTotals(
    view: BasketView,
    puzzle: BestBasketPuzzle,
    t: BestBasketTotals,
    compare?: number,
  ) {
    const ink = this.ink;
    const over = t.price > puzzle.budget;
    const band = view.tray ? TRAY.band : CELL.band;
    const g = this.add.graphics();
    g.fillStyle(ink.card, 1);
    g.fillRoundedRect(band.x, band.y, band.w, band.h, 18);
    g.lineStyle(3, ink.cardFg, 0.35);
    g.strokeRoundedRect(band.x, band.y, band.w, band.h, 18);
    view.overlay.add(g);

    const size = view.tray ? 56 : 42;
    const icon = view.tray ? 22 : 16;
    const small = view.tray ? 40 : 31;
    const smallIcon = view.tray ? 16 : 12;
    const raw = t.price + (puzzle.deal?.discount ?? 0) * t.dealTimes;
    const first: Piece[] = [{ t: "coin", r: icon }];
    if (t.dealTimes > 0) first.push({ t: "num", n: raw, size: small, strike: "thin", faint: true });
    first.push({ t: "num", n: t.price, size, strike: over ? "bold" : undefined });
    first.push({ t: "mark", ok: !over, r: icon + 1 });
    const second: Piece[] = [];
    // "> 🪙túi" đi cùng dòng giá; giỏ ưu đãi đã có hai số giá nên đưa xuống dòng phụ cho khỏi chật.
    const overBudget: Piece[] = [
      { t: "sign", s: ">", size: small },
      { t: "coin", r: smallIcon },
      { t: "num", n: puzzle.budget, size: small },
    ];
    if (over && t.dealTimes > 0 && !view.tray) second.push(...overBudget);
    else if (over) first.push({ t: "gap", w: 4 }, ...overBudget);
    if (!view.tray) {
      first.push(
        { t: "sign", s: "dot", size },
        { t: "star", r: icon },
        { t: "num", n: t.stars, size },
      );
    }

    if (t.comboApplied && puzzle.combo) {
      second.push(
        { t: "sign", s: "+", size: small },
        { t: "num", n: puzzle.combo.bonus, size: small },
        { t: "star", r: smallIcon },
      );
    }
    if (compare !== undefined && !view.tray) {
      if (second.length > 0) second.push({ t: "gap", w: 14 });
      second.push(
        { t: "star", r: smallIcon },
        { t: "num", n: t.stars, size: small },
        { t: "sign", s: "<", size: small },
        { t: "star", r: smallIcon },
        { t: "num", n: compare, size: small },
      );
    }

    const maxW = band.w - 24;
    const row1 = this.buildRow(first, maxW);
    const y1 = view.tray ? TRAY.rowY : second.length > 0 ? CELL.row1Y : CELL.rowSoloY;
    row1.node.setPosition(band.x + band.w / 2, y1);
    view.overlay.add(row1.node);
    if (second.length > 0) {
      const row2 = this.buildRow(second, maxW);
      row2.node.setPosition(band.x + band.w / 2, CELL.row2Y);
      view.overlay.add(row2.node);
    }
    return row1.marks;
  }

  /** Giỏ đủ cặp đi kèm: dây nối vàng giữa hai món (chỉ hiện lúc báo đáp án). */
  private showCombo(view: BasketView) {
    if (view.tray) return;
    const g = this.add.graphics();
    const [a, b] = CELL.items;
    drawShapes(
      g,
      ropeArt({ x: a.x + 8, y: a.y + 28 }, { x: b.x - 8, y: b.y + 28 }, 12, 7),
      { x: 0, y: 0, k: 1 },
      this.ink.sticker,
    );
    view.overlay.add(g);
  }

  /** Giỏ ưu đãi: huy hiệu đồng xu "−2" giữa đôi món. */
  private showDeal(view: BasketView, discount: number) {
    if (view.tray) return;
    const ink = this.ink;
    const [a, b] = CELL.items;
    const x = (a.x + b.x) / 2;
    const y = a.y - 10;
    const g = this.add.graphics({ x, y });
    const r = 34;
    g.fillStyle(ink.sticker, 1);
    g.fillCircle(0, 5, r);
    drawShapes(
      g,
      [{ kind: "fill", pts: circle(0, 0, r, 32), color: COLORS.coin, outline: 4.5 }],
      { x: 0, y: 0, k: 1 },
      ink.sticker,
    );
    const row = this.buildRow([
      { t: "sign", s: "-", size: 34, color: ink.accentFg },
      { t: "num", n: discount, size: 34, color: ink.accentFg },
    ]);
    row.node.setPosition(x, y);
    view.overlay.add([g, row.node]);
  }

  /** Khay Mầm: gạch chân hàng sao của khay đúng (vàng) và khay đã chạm (nét đứt đỏ) để so bằng mắt. */
  private underlineStars(view: BasketView, count: number, right: boolean) {
    const ink = this.ink;
    const { stars } = TRAY;
    const x0 = stars.x - stars.r;
    const x1 = stars.x + (count - 1) * stars.step + stars.r;
    const y = stars.y + stars.r + 12;
    const g = this.add.graphics();
    if (right) {
      g.fillStyle(ink.sticker, 1);
      stroke(g, { x: x0, y }, { x: x1, y }, 14);
      g.fillStyle(ink.accent, 1);
      stroke(g, { x: x0, y }, { x: x1, y }, 8);
    } else {
      g.lineStyle(6, ink.danger, 1);
      for (let x = x0; x < x1; x += 30) g.lineBetween(x, y, Math.min(x + 18, x1), y);
    }
    view.overlay.add(g);
  }
}
