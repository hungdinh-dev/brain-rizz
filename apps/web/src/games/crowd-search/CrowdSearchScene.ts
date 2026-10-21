import {
  type Buddy,
  type CrowdSearchCard,
  type CrowdSearchForbidden,
  type CrowdSearchPuzzle,
  crowdSearch,
  crowdSearchMismatch,
  WRONG_ANSWER_LOCK_MS,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import { type Ctx, makeCanvas, roundRectPath, withHalo } from "../_shared/canvas";
import { drawSvg } from "../_shared/canvas-svg";
import type { MinigameBridge } from "../types";
import { ART, accessoryArt, accessoryBox, buddyArt, focusArea } from "./buddies";

/*
 * Tìm bạn — đặc tả: docs/04-minigames/crowd-search.md (mục "Ghi chú cho FE" và "Hiện đáp án đúng
 * khi sai"). Trên cùng là thẻ "tìm người" vẽ bạn cần tìm (Siêu khó thêm chip món bị gạch); bên dưới
 * là đám đông đứng yên theo lưới, chạm đúng bạn giống hệt thẻ. Scene không vẽ chữ.
 * Nhân vật và phụ kiện vẽ bằng code (buddies.tsx → canvas 2D → texture), không asset ngoài.
 */

// ---------------------------------------------------------------- bố cục (khung 720×1280)

/** Thẻ "tìm người": giấy, viền mực 5, viền trong cam Nhận diện, bóng đổ. */
const CARD = { x: 210, y: 92, w: 300, h: 248, radius: 30, border: 5, shadow: 8 } as const;
const CARD_INNER = { inset: 10, radius: 22, width: 7 } as const;
/** Bạn trên thẻ: hộp vuông cạnh 184, chân ở y 316; có món bị gạch thì dời sang tâm x 310. */
const CARD_BUDDY = { box: 184, x: 360, xWithNot: 310, feet: 316 } as const;
const CARD_FLOOR = { rx: 62, ry: 8 } as const;
/** Chip món bị gạch (Siêu khó): tròn Ø 100, vòng cấm + vạch chéo dày trên trái → dưới phải. */
const CHIP = { x: 440, y: 216, r: 50, ring: 9, slash: 11, item: 56 } as const;

/** Khung đám đông: giấy, viền mực, viền trong cam. */
const PANEL = { x: 24, y: 372, w: 672, h: 864, radius: 36, border: 5, shadow: 8 } as const;
const PANEL_INNER = { inset: 11, radius: 27, width: 8 } as const;
/** Đám đông xếp trong viền trong của khung; vùng chạm là cả ô của lưới này. */
const GRID_INSET = 20;
/** Hộp vẽ mỗi bạn: cạnh min(ô rộng, ô cao) × 0,82 theo ô của đặc tả (khung ÷ cột, khung ÷ hàng). */
const BOX_RATIO = 0.82;
/** Thanh khoá khi sai. */
const BAR = { x: 150, y: 1250, w: 420, h: 14 } as const;

/** Texture vẽ ở độ phân giải 1,25 × đơn vị khung, chừa lề 6 cho viền phấn. */
const RES = 1.25;
const PAD = 6;
/** Viền phấn quanh mỗi bạn ở nền tối (đơn vị khung), theo cỡ hộp. */
const haloWidth = (box: number) => Math.max(3, box * 0.03);

/** Rê chuột: ô nhấc 4 px, viền nét đứt quanh ô. */
const HOVER = { lift: 4, inset: 5, radius: 18, width: 3, dash: [12, 8] as [number, number] };
/** Vòng vàng quanh bạn đúng (bán kính theo hộp), viền mực hai bên; huy hiệu ✓. */
const RING = { ratio: 0.52, width: 9, ink: 3 } as const;
const BADGE = { ratio: 0.17, min: 18, max: 26 } as const;
/** Dấu ✗ trên bạn chạm nhầm (cạnh theo hộp). */
const CROSS_RATIO = 0.34;
/** Vòng khoanh chi tiết lệch: trắng 8 dưới, đỏ nét đứt 4 trên (đơn vị khung). */
const FOCUS = { under: 8, over: 4, dash: [8, 5] as [number, number] };

const DIM_ALPHA = 0.35;
const FLOOR_ALPHA_LIGHT = 0.12;
const FLOOR_ALPHA_DARK = 0.5;
/** Viền phấn quanh bạn ở giao diện tối (màu riêng của game, như Bóng của ai). */
const HALO_DARK = "#c9c6dc";

// ---------------------------------------------------------------- nhịp hiệu ứng

/** Câu mới: thẻ đề phóng từ 90 %, đám đông hiện lần lượt theo hàng (mỗi hàng 30 ms). */
const APPEAR_MS = 160;
const APPEAR_SCALE = 0.9;
const ROW_STAGGER_MS = 30;
const CELL_FADE_MS = 120;
/** Đúng: nảy 110 % + lắc người như vẫy trong 300 ms, thẻ đề nảy theo; câu mới sau 300 ms. */
const SOLVED_MS = 300;
const BOUNCE_MS = 300;
const BOUNCE_SCALE = 1.1;
const WAVE_DEG = 7;
const CARD_BOUNCE = 1.04;
/** Sai: bạn đúng nảy nhẹ một lần; ô sai lắc ±7 px trong 200 ms; chip cấm nháy 2 lần. */
const HINT_BOUNCE = 1.06;
const SHAKE_MS = 200;
const SHAKE_PX = 7;
const DIM_MS = 120;
const BLINK_MS = 150;
/** Thở tại chỗ: scale 100–102 %, chu kỳ 1,8 s, lệch pha theo ô. */
const BREATH_MS = 1800;
const BREATH = 0.02;
/** Vẽ sẵn câu kế tiếp: 2 bạn mỗi 40 ms (bạn đã có texture thì bỏ qua ngay). */
const PREWARM = { everyMs: 40, perTick: 2 } as const;

// ---------------------------------------------------------------- icon (tâm 0,0)

const CHECK = "M-12 1 L-3 10 L13 -9";

// ---------------------------------------------------------------- màu

interface Palette {
  dark: boolean;
  /** Giấy của thẻ đề, khung đám đông, chip: `--card` ở nền sáng, tím `--muted` (#3a3560) ở nền tối. */
  paper: string;
  /** Thanh khoá, viền nét đứt khi rê chuột: mực ở nền sáng, kem ở nền tối. */
  cardFg: string;
  /** Mực: viền thẻ, viền vòng. */
  border: string;
  sticker: string;
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
    paper: dark ? token("--muted") : token("--card"),
    cardFg: token("--card-foreground"),
    border: token("--border"),
    sticker: token("--sticker"),
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
function evenDash(length: number, [dash, gap]: [number, number]) {
  const k = length / Math.max(1, Math.round(length / (dash + gap))) / (dash + gap);
  return [dash * k, gap * k];
}

/** Chu vi elip (xấp xỉ Ramanujan). */
function ellipseLength(rx: number, ry: number) {
  const h = ((rx - ry) / (rx + ry)) ** 2;
  return Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

// ---------------------------------------------------------------- lưới đám đông

interface Grid {
  cols: number;
  rows: number;
  /** Cạnh hộp vẽ mỗi bạn. */
  box: number;
  /** Bước lưới (cũng là cỡ vùng chạm). */
  stepX: number;
  stepY: number;
}

function gridOf(cols: number, rows: number): Grid {
  return {
    cols,
    rows,
    box: Math.round(BOX_RATIO * Math.min(PANEL.w / cols, PANEL.h / rows)),
    stepX: (PANEL.w - 2 * GRID_INSET) / cols,
    stepY: (PANEL.h - 2 * GRID_INSET) / rows,
  };
}

/** Tâm ô thứ `i` (trái → phải, trên → dưới). */
function cellCenter(grid: Grid, i: number): [x: number, y: number] {
  const col = i % grid.cols;
  const row = Math.floor(i / grid.cols);
  return [
    PANEL.x + GRID_INSET + grid.stepX * (col + 0.5),
    PANEL.y + GRID_INSET + grid.stepY * (row + 0.5),
  ];
}

/** Khoá texture của một bạn: theo 4 số + cỡ hộp. */
const buddyKey = (b: Buddy, box: number) =>
  `crowd-search:buddy-${b.species}${b.hat}${b.held}${b.glasses}-${box}`;

/** Điểm (x, y) đơn vị hình → toạ độ trong hộp cạnh `box`, gốc ở chân (giữa đáy hộp). */
function artToFeet(x: number, y: number, box: number): [x: number, y: number] {
  const k = box / ART.size;
  return [(x - ART.x - ART.size / 2) * k, (y - ART.y - ART.size) * k];
}

// ---------------------------------------------------------------- scene

interface CellView {
  buddy: Buddy;
  row: number;
  /** Đặt tại chân bạn: hiện dần khi ra câu, mờ khi sai. */
  slot: Phaser.GameObjects.Container;
  /** Bạn + các vòng: nhấc khi rê chuột, lắc khi sai, nảy khi đúng (gốc ở chân). */
  face: Phaser.GameObjects.Container;
  /** Hình bạn: thở tại chỗ. */
  image: Phaser.GameObjects.Image;
  hover: Phaser.GameObjects.Image;
  hovered: boolean;
  /** Lệch pha nhịp thở. */
  phase: number;
}

/** Tìm bạn — chạm vào bạn duy nhất giống hệt thẻ (Siêu khó: không có món bị gạch). */
export default class CrowdSearchScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = false;
  private colors!: Palette;
  private reducedMotion = false;
  private board?: Phaser.GameObjects.Container;
  private card?: Phaser.GameObjects.Container;
  private chip?: Phaser.GameObjects.Image;
  private cells: CellView[] = [];
  private grid: Grid = gridOf(3, 3);
  private bar?: Phaser.GameObjects.Graphics;
  private barState = { width: 0 };
  /** Hẹn giờ của câu hiện tại (sang câu mới); huỷ hết khi sang câu mới hoặc rời màn. */
  private timers: Phaser.Time.TimerEvent[] = [];

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.locked = false;
    this.cells = [];
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

    // Khung đám đông giữ nguyên suốt vòng.
    this.add.image(
      PANEL.x + PANEL.w / 2,
      PANEL.y + (PANEL.h + PANEL.shadow) / 2,
      this.panelTexture(),
    );
    this.bar = this.add.graphics().setVisible(false).setDepth(1);
    this.showPuzzle();
  }

  override update(time: number) {
    if (this.reducedMotion) return;
    // Thở tại chỗ: chỉ đổi scale quanh chân, vị trí và vùng chạm không đổi.
    for (const cell of this.cells) {
      const d = BREATH * 0.5 * (1 - Math.cos((time / BREATH_MS) * Math.PI * 2 + cell.phase));
      cell.image.setScale((1 + d * 0.5) / RES, (1 + d) / RES);
    }
  }

  // -------------------------------------------------------------- dựng câu đố

  private showPuzzle() {
    // Mọi hẹn giờ và tween đang chạy đều thuộc câu cũ: dừng trước khi huỷ.
    this.clearTimers();
    this.tweens.killAll();
    this.board?.destroy();
    this.bar?.setVisible(false);
    this.chip = undefined;
    this.locked = false;

    const puzzle = crowdSearch.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    const grid = gridOf(puzzle.cols, puzzle.rows);
    this.grid = grid;
    const board = this.add.container(0, 0);
    const floorColor = toColor(this.colors.sticker);
    const floorAlpha = this.colors.dark ? FLOOR_ALPHA_DARK : FLOOR_ALPHA_LIGHT;

    // Thẻ "tìm người": giấy + bóng sàn + bạn cần tìm (+ chip món bị gạch).
    const cx = CARD.x + CARD.w / 2;
    const cy = CARD.y + CARD.h / 2;
    const { buddy, not } = puzzle.card;
    const bx = (not ? CARD_BUDDY.xWithNot : CARD_BUDDY.x) - cx;
    const by = CARD_BUDDY.feet - cy;
    const card = this.add.container(cx, cy, [
      this.add.image(0, CARD.shadow / 2, this.cardTexture()),
      this.add.ellipse(bx, by, CARD_FLOOR.rx * 2, CARD_FLOOR.ry * 2, floorColor, floorAlpha),
      this.buddyImage(buddy, CARD_BUDDY.box).setPosition(bx, by),
    ]);
    if (not) {
      this.chip = this.add
        .image(CHIP.x - cx, CHIP.y - cy, this.chipTexture(not, buddy.species))
        .setScale(1 / RES);
      card.add(this.chip);
    }
    board.add(card);
    this.card = card;

    // Đám đông: mỗi bạn đứng giữa ô, chân chạm đáy hộp; vùng chạm là cả ô.
    const { box } = grid;
    this.cells = puzzle.crowd.map((member, i) => {
      const [x, y] = cellCenter(grid, i);
      const image = this.buddyImage(member, box);
      const face = this.add.container(0, 0, [image]);
      const hover = this.add.image(0, -box / 2, this.hoverTexture()).setVisible(false);
      const floor = this.add.ellipse(0, -1, box * 0.56, box * 0.1, floorColor, floorAlpha);
      const slot = this.add.container(x, y + box / 2, [hover, floor, face]);
      const view: CellView = {
        buddy: member,
        row: Math.floor(i / grid.cols),
        slot,
        face,
        image,
        hover,
        hovered: false,
        phase: i * 2.4,
      };

      const zone = this.add
        .zone(x, y, grid.stepX, grid.stepY)
        .setInteractive({ useHandCursor: true });
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
    this.prewarm();

    // Câu mới: thẻ đề phóng từ 90 %, đám đông hiện theo hàng. Chạm được ngay, không chờ hiệu ứng.
    if (this.reducedMotion) return;
    card.setAlpha(0).setScale(APPEAR_SCALE);
    this.tweens.add({
      targets: card,
      alpha: 1,
      scale: 1,
      duration: APPEAR_MS,
      ease: "Back.easeOut",
    });
    for (const view of this.cells) {
      view.slot.setAlpha(0);
      this.tweens.add({
        targets: view.slot,
        alpha: 1,
        duration: CELL_FADE_MS,
        delay: ROW_STAGGER_MS * view.row,
      });
    }
  }

  /** Hình bạn, gốc ở chân (giữa đáy hộp). */
  private buddyImage(buddy: Buddy, box: number) {
    return this.add
      .image(0, 0, this.buddyTexture(buddy, box))
      .setOrigin(0.5, (PAD + box) / (box + 2 * PAD))
      .setScale(1 / RES);
  }

  private setHover(view: CellView, on: boolean) {
    if (view.hovered === on) return;
    view.hovered = on;
    view.face.y = on ? -HOVER.lift : 0;
    view.hover.setVisible(on);
  }

  // -------------------------------------------------------------- trả lời

  private answer(puzzle: CrowdSearchPuzzle, choice: number) {
    if (this.locked) return;
    this.locked = true;

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const index = this.index;
    const correct = crowdSearch.check(puzzle, choice);
    this.bridge.submit(index, choice);
    this.index += 1;

    // Đang hiện dần thì hiện hẳn để thấy kết quả.
    for (const view of this.cells) {
      this.setHover(view, false);
      this.tweens.killTweensOf(view.slot);
      view.slot.setAlpha(1);
    }
    if (this.card) {
      this.tweens.killTweensOf(this.card);
      this.card.setAlpha(1).setScale(1);
    }
    const picked = this.cells[choice];
    const right = this.cells[puzzle.answerIndex];
    if (!picked || !right) return;

    if (correct) {
      this.showRight(right, true);
      this.bounceCard();
      this.after(SOLVED_MS, () => this.showPuzzle());
      return;
    }

    for (const view of this.cells) if (view !== picked && view !== right) this.dim(view);
    this.showRight(right, false);
    this.showMiss(picked, puzzle.card);

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

  /** Bạn đúng: vòng vàng dày + ✓. Đúng thì nảy 110 % và lắc người như vẫy; sai thì nảy nhẹ. */
  private showRight(view: CellView, solved: boolean) {
    const { box } = this.grid;
    const r = box * RING.ratio;
    const badge = Math.min(BADGE.max, Math.max(BADGE.min, box * BADGE.ratio));
    view.face.addAt(this.add.image(0, -box / 2, this.ringTexture(r)), 0);
    view.face.add(this.add.image(r * 0.72, -box / 2 - r * 0.72, this.badgeTexture(badge)));
    this.board?.bringToTop(view.slot);
    if (this.reducedMotion) return;

    const face = view.face;
    this.tweens.add({
      targets: face,
      scale: solved ? BOUNCE_SCALE : HINT_BOUNCE,
      duration: BOUNCE_MS / 2,
      yoyo: true,
      ease: "Quad.easeOut",
    });
    if (!solved) return;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: BOUNCE_MS,
      onUpdate: (tween) => {
        face.angle = WAVE_DEG * Math.sin((tween.getValue() ?? 0) * Math.PI * 3);
      },
      onComplete: () => {
        face.angle = 0;
      },
    });
  }

  /**
   * Bạn chạm nhầm: ✗ đỏ viền trắng, khoanh nét đứt đỏ từng chi tiết lệch thẻ (loài: cả mặt; mũ /
   * đồ cầm / kính: vùng đó, kể cả khi bạn này thiếu món). Có món bị gạch thì chip cấm nháy 2 lần.
   */
  private showMiss(view: CellView, card: CrowdSearchCard) {
    const { box } = this.grid;
    const k = box / ART.size;
    const { buddy } = view;
    for (const attr of crowdSearchMismatch(buddy, card)) {
      // Khoanh món của bạn này nếu có, không thì chỗ món trên thẻ (chỗ đáng lẽ có món).
      const value = attr === "species" ? 0 : buddy[attr] || card.buddy[attr];
      const [ax, ay, rx, ry] = focusArea(attr, value, buddy.species);
      const [x, y] = artToFeet(ax, ay, box);
      view.face.add(this.add.image(x, y, this.focusTexture(rx * k, ry * k)));
    }
    const cross = box * CROSS_RATIO;
    view.face.add(this.add.image(box * 0.42, -box * 0.14, this.crossTexture(cross)));
    this.board?.bringToTop(view.slot);
    if (card.not && buddy[card.not.slot] === card.not.value) this.flashChip();
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

  /** Khoanh chip món bị gạch (nét đứt đỏ như chi tiết lệch) và nháy 2 lần. */
  private flashChip() {
    const chip = this.chip;
    if (!chip || !this.card) return;
    const r = CHIP.r + 2;
    this.card.add(this.add.image(chip.x, chip.y, this.focusTexture(r, r)));
    if (this.reducedMotion) return;
    this.tweens.add({
      targets: chip,
      alpha: 0.2,
      duration: BLINK_MS,
      yoyo: true,
      repeat: 1,
    });
  }

  private bounceCard() {
    if (this.reducedMotion || !this.card) return;
    this.tweens.add({
      targets: this.card,
      scale: CARD_BOUNCE,
      duration: BOUNCE_MS / 2,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  /** Bạn không liên quan mờ còn 35 % (hình bạn là một texture nên mờ cả nhóm vẫn đúng). */
  private dim(view: CellView) {
    if (this.reducedMotion) view.slot.setAlpha(DIM_ALPHA);
    else this.tweens.add({ targets: view.slot, alpha: DIM_ALPHA, duration: DIM_MS });
  }

  /**
   * Vẽ sẵn texture các bạn của câu kế tiếp (câu đố tất định nên biết trước), vài bạn mỗi nhịp trong
   * lúc người chơi đang tìm, để lúc sang câu không bị khựng vì vẽ 30 bạn cùng lúc.
   */
  private prewarm() {
    const next = crowdSearch.generate(this.bridge.seed, this.index + 1, this.bridge.difficulty);
    const { box } = gridOf(next.cols, next.rows);
    const queue: [Buddy, number][] = [
      [next.card.buddy, CARD_BUDDY.box],
      ...next.crowd.map((b): [Buddy, number] => [b, box]),
    ];
    const timer = this.time.addEvent({
      delay: PREWARM.everyMs,
      loop: true,
      callback: () => {
        let drawn = 0;
        while (drawn < PREWARM.perTick && queue.length > 0) {
          const [buddy, size] = queue.shift()!;
          if (this.textures.exists(buddyKey(buddy, size))) continue;
          this.buddyTexture(buddy, size);
          drawn += 1;
        }
        if (queue.length === 0) timer.remove(false);
      },
    });
    this.timers.push(timer);
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
    g.fillStyle(toColor(c.paper));
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
    const key = `crowd-search:${name}`;
    if (this.textures.exists(key)) return key;
    const canvas = makeCanvas(width, height, (ctx) => {
      ctx.translate(Math.ceil(width) / 2, Math.ceil(height) / 2);
      draw(ctx);
    });
    this.textures.addCanvas(key, canvas);
    return key;
  }

  /**
   * Một bạn trong hộp cạnh `box` (chân chạm đáy), khoá theo 4 số + cỡ hộp để mỗi tổ hợp chỉ vẽ
   * một lần mỗi vòng. Nền tối: thêm viền phấn quanh cả bạn.
   */
  private buddyTexture(b: Buddy, box: number) {
    const key = buddyKey(b, box);
    if (this.textures.exists(key)) return key;
    const size = (box + 2 * PAD) * RES;
    const k = (box / ART.size) * RES;
    const art = makeCanvas(size, size, (ctx) => {
      ctx.translate(PAD * RES, PAD * RES);
      ctx.scale(k, k);
      ctx.translate(-ART.x, -ART.y);
      drawSvg(ctx, buddyArt(b));
    });
    const halo = this.colors.halo;
    this.textures.addCanvas(key, halo ? withHalo(art, haloWidth(box) * RES, halo) : art);
    return key;
  }

  /** Thẻ giấy bo góc có bóng đổ, viền mực và viền trong cam (thẻ đề, khung đám đông). */
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
      ctx.fillStyle = c.paper;
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

  private cardTexture() {
    return this.paperTexture("card", CARD, CARD_INNER);
  }

  private panelTexture() {
    return this.paperTexture("panel", PANEL, PANEL_INNER);
  }

  /**
   * Chip món bị gạch: vẽ món (cùng hình như trên người bạn, loài của bạn cần tìm) trong vòng tròn,
   * đè vạch chéo dày từ trên trái xuống dưới phải. Nhận ra bằng hình vòng + vạch, không chỉ màu.
   */
  private chipTexture(not: CrowdSearchForbidden, species: number) {
    const c = this.colors;
    const { r, ring, slash } = CHIP;
    // `r` là mép ngoài cùng (Ø 100): vòng cấm đỏ, viền mực 3 mỗi bên, nằm sát mép trong.
    const mid = r - ring / 2 - 3;
    const inner = mid - ring / 2;
    const size = (2 * r + 4) * RES;
    return this.texture(`chip-${not.slot}-${not.value}-${species}`, size, size, (ctx) => {
      ctx.scale(RES, RES);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = c.paper;
      ctx.fill();

      // Món, canh giữa trong chip (nền tối: viền phấn như trên người bạn).
      const [x, y, w, h] = accessoryBox(not.slot, not.value, species);
      const fit = CHIP.item / Math.max(w, h);
      const side = 2 * r * RES;
      const art = makeCanvas(side, side, (ictx) => {
        ictx.scale(RES, RES);
        ictx.translate(r, r);
        ictx.scale(fit, fit);
        ictx.translate(-(x + w / 2), -(y + h / 2));
        drawSvg(ictx, accessoryArt(not.slot, not.value, species));
      });
      const item = c.halo ? withHalo(art, 3 * RES, c.halo) : art;
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, inner, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(item, -r, -r, 2 * r, 2 * r);
      ctx.restore();

      // Vạch chéo (lót màu giấy để tách khỏi món), rồi vòng cấm đè lên hai đầu vạch.
      const e = mid * Math.SQRT1_2;
      ctx.beginPath();
      ctx.moveTo(-e, -e);
      ctx.lineTo(e, e);
      ctx.lineCap = "butt";
      ctx.lineWidth = slash + 8;
      ctx.strokeStyle = c.paper;
      ctx.stroke();
      ctx.lineWidth = slash;
      ctx.strokeStyle = c.destructive;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, mid, 0, Math.PI * 2);
      ctx.lineWidth = ring + 6;
      ctx.strokeStyle = c.border;
      ctx.stroke();
      ctx.lineWidth = ring;
      ctx.strokeStyle = c.destructive;
      ctx.stroke();
    });
  }

  /** Viền nét đứt quanh ô khi rê chuột. */
  private hoverTexture() {
    const c = this.colors;
    const { stepX, stepY } = this.grid;
    const w = stepX - 2 * HOVER.inset;
    const h = stepY - 2 * HOVER.inset;
    const r = HOVER.radius;
    return this.texture(`hover-${Math.round(w)}x${Math.round(h)}`, w + 8, h + 8, (ctx) => {
      roundRectPath(ctx, -w / 2, -h / 2, w, h, r);
      ctx.setLineDash(evenDash(2 * (w + h - 4 * r) + 2 * Math.PI * r, HOVER.dash));
      ctx.lineCap = "butt";
      ctx.lineWidth = HOVER.width;
      ctx.strokeStyle = c.cardFg;
      ctx.stroke();
    });
  }

  /** Vòng vàng viền mực quanh bạn đúng (nằm dưới hình bạn). */
  private ringTexture(radius: number) {
    const c = this.colors;
    const r = Math.round(radius);
    const size = 2 * (r + RING.width + RING.ink + 4);
    return this.texture(`ring-${r}`, size, size, (ctx) => {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.lineWidth = RING.width + 2 * RING.ink;
      ctx.strokeStyle = c.border;
      ctx.stroke();
      ctx.lineWidth = RING.width;
      ctx.strokeStyle = c.primary;
      ctx.stroke();
    });
  }

  /** Huy hiệu ✓: tròn vàng viền mực có bóng. */
  private badgeTexture(radius: number) {
    const c = this.colors;
    const r = Math.round(radius);
    const size = 2 * (r + 8);
    return this.texture(`badge-${r}`, size, size, (ctx) => {
      ctx.beginPath();
      ctx.arc(0, 4, r, 0, Math.PI * 2);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = c.primary;
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = c.border;
      ctx.stroke();
      const s = r / 24;
      ctx.scale(s, s);
      ctx.lineWidth = 6;
      ctx.strokeStyle = c.primaryFg;
      ctx.stroke(new Path2D(CHECK));
    });
  }

  /** Dấu ✗ màu lỗi viền trắng, cạnh `size`. */
  private crossTexture(size: number) {
    const c = this.colors;
    const s = Math.round(size);
    const half = s / 2;
    const under = Math.max(10, s * 0.3);
    const over = Math.max(5, s * 0.15);
    return this.texture(`cross-${s}`, s + under + 4, s + under + 4, (ctx) => {
      ctx.beginPath();
      ctx.moveTo(-half, -half);
      ctx.lineTo(half, half);
      ctx.moveTo(half, -half);
      ctx.lineTo(-half, half);
      ctx.lineWidth = under;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.lineWidth = over;
      ctx.strokeStyle = c.destructive;
      ctx.stroke();
    });
  }

  /** Elip khoanh chi tiết lệch (đơn vị khung): trắng dưới, đỏ nét đứt trên. */
  private focusTexture(rx: number, ry: number) {
    const c = this.colors;
    const [a, b] = [Math.round(rx), Math.round(ry)];
    const pad = FOCUS.under + 4;
    return this.texture(`focus-${a}x${b}`, 2 * a + pad, 2 * b + pad, (ctx) => {
      ctx.beginPath();
      ctx.ellipse(0, 0, a, b, 0, 0, Math.PI * 2);
      ctx.lineWidth = FOCUS.under;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.setLineDash(evenDash(ellipseLength(a, b), FOCUS.dash));
      ctx.lineCap = "butt";
      ctx.lineWidth = FOCUS.over;
      ctx.strokeStyle = c.destructive;
      ctx.stroke();
    });
  }
}
