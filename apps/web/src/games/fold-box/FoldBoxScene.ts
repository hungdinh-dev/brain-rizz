import {
  type FoldBoxCell,
  type FoldBoxChoiceKind,
  type FoldBoxCube,
  type FoldBoxMark,
  type FoldBoxPuzzle,
  foldBox,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import type { MinigameBridge } from "../types";

/*
 * Gấp hộp — đặc tả: docs/04-minigames/fold-box.md (mục "Ghi chú cho FE").
 * Bản mẫu: canvas Brain Rizz, trang Minigame, hàng M9 (FoldBoxMobile, FoldBoxLevels, FoldBoxStates).
 * Scene không vẽ chữ: chỉ có khối hộp, lưới trải phẳng, icon và huy hiệu ✓/✗.
 *
 * Khối mẫu và lưới vẽ bằng canvas 2D (CanvasTexture, vẽ lại mỗi câu): canvas 2D có sẵn phép biến
 * đổi affine nên ký hiệu trên mặt khối nghiêng đúng như `matrix(…)` của bản mẫu, kể cả nét viền.
 */

// ---------------------------------------------------------------- bố cục (khung 720×1280)

type Point = readonly [x: number, y: number];

/** Thẻ khối mẫu 360×360, tâm (360, 236): viền mực dày, icon con mắt ở góc trên trái, không nhận chạm. */
const MODEL = { x: 360, y: 236, size: 360, radius: 32, border: 7, shadow: 10 } as const;
/** Dải nhắc luật 220×56, tâm (360, 464): lưới chữ thập → hộp ✓, không có chữ. */
const RULES: Point = [360, 464];
/** Thẻ lựa chọn 320×320, cả thẻ là vùng chạm. Rê chuột: nhấc 4 px, viền đậm hơn. */
const CARD = { size: 320, radius: 28, border: 4, hoverBorder: 7, shadow: 8, lift: 4 } as const;
/** Thẻ bị chạm sai: viền gạch đứt. */
const MISS_BORDER = 7;
const MISS_DASH: [number, number] = [20, 12];
/** Tâm thẻ lựa chọn theo đúng thứ tự `choices` (trái → phải, trên → dưới). Mầm: thẻ thứ ba ở giữa. */
const SLOTS_4: readonly Point[] = [
  [188, 680],
  [532, 680],
  [188, 1024],
  [532, 1024],
];
const SLOTS_3: readonly Point[] = [
  [188, 680],
  [532, 680],
  [360, 1024],
];
/** Canvas của một lưới (tâm = tâm thẻ): đủ chỗ cho lưới 5 ô (280 px), viền, bóng và vòng khoanh. */
const NET_CANVAS = 336;

/** Ô lưới cạnh 56 px ở mọi mức; viền mực ngoài 6 px (3 px lộ ra ngoài ô); bóng đặc lệch xuống 7 px. */
const UNIT = 56;
const NET_OUTLINE = 6;
const NET_SHADOW = 7;
/** Đường gấp: nét đứt mực 70 %, 2,5 px, gạch 8/6, lệch 3 px để mỗi cạnh 56 px đối xứng. */
const FOLD_LINE = 2.5;
const FOLD_ALPHA = 0.7;
const FOLD_DASH = [8, 6];
const FOLD_DASH_OFFSET = -3;
/** Đường gấp sáng vàng (Mầm, đáp án): lót mực 8 px, phủ vàng 4 px gạch 8/6. */
const FOLD_GOLD_UNDER = 8;
const FOLD_GOLD = 4;
/** Ô `focus` của đáp án: viền mực 11 px, phủ vàng 5,5 px. */
const FOCUS_OK_UNDER = 11;
const FOCUS_OK = 5.5;
/** Ô `focus` của thẻ chạm sai: ô vuông thụt 3 px, bo 6, lót kem 8 px, phủ đỏ 4,5 px gạch 8/5. */
const FOCUS_BAD_INSET = 3;
const FOCUS_BAD_RADIUS = 6;
const FOCUS_BAD_UNDER = 8;
const FOCUS_BAD = 4.5;
const FOCUS_BAD_DASH = [8, 5];

/** Khối isometric, cạnh E = 136 px; k = tỉ lệ từ ký hiệu vẽ ở cỡ ô 56 px lên mặt khối. */
const CUBE_EDGE = 136;
const K = CUBE_EDGE / UNIT;
/** Nửa bề ngang hình thoi mặt trên = E·cos 30°. */
const CUBE_W = CUBE_EDGE * (Math.sqrt(3) / 2);
const CUBE_OUTLINE = 6;
const CUBE_SHADOW = 7;
/** Đỉnh khối (toạ độ khung 720×1280): tâm trên (360, 104), giữa (360, 240), đáy (360, 376). */
const CUBE_TOP_Y = 104;
const CUBE_MID_Y = 240;
const CUBE_SIDE_Y = 172;

/**
 * Khung của 3 mặt nhìn thấy: điểm (px, py) của ký hiệu (cỡ ô 56 px, đã xoay `rot`) vẽ tại
 * `tâm + px·X + py·Y`. Bắt buộc đúng như đặc tả vì `rot` của khối tính theo khung này.
 */
interface FaceFrame {
  center: Point;
  x: Point;
  y: Point;
}
const C30 = (Math.sqrt(3) / 2) * K;
const S30 = 0.5 * K;
const FACES: Record<keyof FoldBoxCube, FaceFrame> = {
  top: { center: [360, CUBE_SIDE_Y], x: [C30, -S30], y: [C30, S30] },
  left: { center: [360 - CUBE_W / 2, 274], x: [C30, S30], y: [0, K] },
  right: { center: [360 + CUBE_W / 2, 274], x: [C30, -S30], y: [0, K] },
};

/** Huy hiệu (so với tâm thẻ): ✓ ở góc trên phải; ✗ và icon loại lỗi cạnh nhau. */
const BADGE_R = 30;
const BADGE_SHADOW = 5;
const OK_AT: Point = [140, -140];
const BAD_AT: Point = [130, -130];
const KIND_AT: Point = [62, -130];
/** Icon con mắt của thẻ mẫu (so với tâm thẻ). */
const EYE_AT: Point = [-142, -142];
/** Độ mờ của các thẻ không liên quan trong lúc khoá sau câu sai. */
const DIM_ALPHA = 0.35;

// ---------------------------------------------------------------- nhịp hiệu ứng (đều ≤ 400 ms)

/** Hiện câu: mờ dần, phóng 0,96 → 1; nhận chạm ngay. */
const APPEAR_MS = 120;
const APPEAR_SCALE = 0.96;
/** Nhấn: thẻ co 0,97 rồi về. */
const PRESS_MS = 60;
const PRESS_SCALE = 0.97;
/** Đúng: lưới nảy 1 → 1,06 → 1, sang câu mới sau 350 ms (khoảng này tính vào giờ câu sau). */
const BOUNCE_MS = 200;
const BOUNCE_SCALE = 1.06;
const SOLVED_MS = 350;
/** Sai: rung ±8 px trong 200 ms; hết khoá theo server (`unlockDelay`). */
const SHAKE_MS = 200;
const SHAKE_PX = 8;
const DIM_MS = 120;

// ---------------------------------------------------------------- icon (đường SVG của bản mẫu, tâm 0,0)

const TURN_ARC = "M-12 -6 A13 13 0 1 1 -6 12";
const TURN_HEAD = "M-0.3 9.3 L-9.6 10.2 L-4.7 18.3";
const MIRROR_AXIS = "M0 -16 L0 16";
const MIRROR_ARROWS = "M-5 0 L-19 0 M-14 -5 L-19 0 L-14 5 M5 0 L19 0 M14 -5 L19 0 L14 5";
const CHECK = "M-14 1 L-4 12 L15 -11";
const CROSS = "M-11 -11 L11 11 M11 -11 L-11 11";
const EYE =
  "M-20 0 C-14 -10 -7 -13 0 -13 C7 -13 14 -10 20 0 C14 10 7 13 0 13 C-7 13 -14 10 -20 0 Z";
/** Dải nhắc luật: lưới chữ thập nhỏ, đường gấp của nó, mũi tên, dấu ✓. */
const RULE_NET = "M-67 -20 H-57 V-10 H-47 V0 H-57 V20 H-67 V0 H-77 V-10 H-67 Z";
const RULE_NET_FOLDS = "M-67 -10 H-57 M-67 0 H-57 M-67 10 H-57 M-67 -10 V0 M-57 -10 V0";
const RULE_ARROW = "M-36 0 L-12 0 M-19 -7 L-12 0 L-19 7";
const RULE_CHECK = "M52 0 L60 8 L76 -10";

// ---------------------------------------------------------------- màu

/**
 * Màu riêng của game (bản mẫu FoldBoxStates), không phải token chung: ba sắc tím của mặt khối
 * (trên sáng nhất, phải tối nhất). Giao diện sáng: mặt trái và ô lưới dùng token `--color-visualize`;
 * giao diện tối dùng các sắc sáng hơn để nổi trên thẻ #2f2a52.
 */
const FACE_TOP_LIGHT = "#9d90d4";
const FACE_RIGHT_LIGHT = "#5d508f";
const FACE_TOP_DARK = "#c6bdf0";
const FACE_LEFT_DARK = "#a99ce0";
const FACE_RIGHT_DARK = "#8a7cc6";
/** Ký hiệu: kem viền mực ở cả hai giao diện (nằm trên ô tím nên không đổi theo nền thẻ). */
const SYMBOL_FILL = "#fff8ef";
const SYMBOL_INK = "#1f1b3a";

/** Màu đọc từ token CSS lúc tạo scene (tự đổi theo sáng/tối). Chuỗi CSS để vẽ canvas 2D. */
interface Palette {
  card: string;
  cardFg: string;
  /** Mực: viền thẻ, viền khối, viền lưới. */
  border: string;
  /** Bóng đổ kiểu nhãn dán. */
  sticker: string;
  /** Nền khung chơi (bg-muted của GameFrame). */
  muted: string;
  primary: string;
  primaryFg: string;
  destructive: string;
  /** Mặt trên / trái / phải của khối; ô lưới dùng màu mặt trái. */
  faceTop: string;
  faceLeft: string;
  faceRight: string;
}

function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const dark = style.colorScheme === "dark";
  return {
    card: token("--card"),
    cardFg: token("--card-foreground"),
    border: token("--border"),
    sticker: token("--sticker"),
    muted: token("--muted"),
    primary: token("--primary"),
    primaryFg: token("--primary-foreground"),
    destructive: token("--destructive"),
    faceTop: dark ? FACE_TOP_DARK : FACE_TOP_LIGHT,
    faceLeft: dark ? FACE_LEFT_DARK : token("--color-visualize"),
    faceRight: dark ? FACE_RIGHT_DARK : FACE_RIGHT_LIGHT,
  };
}

/** Màu CSS → số màu của Phaser. */
const toColor = (css: string) => Phaser.Display.Color.ValueToColor(css).color;

/** Đọc `prefers-reduced-motion`: bỏ rung, co, phóng, nảy; giữ đổi viền, huy hiệu, làm mờ. */
function prefersReducedMotion() {
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

// ---------------------------------------------------------------- vẽ bằng canvas 2D

type Ctx = CanvasRenderingContext2D;
type CardState = "idle" | "hover" | "miss";
type BadgeKind = "ok" | "bad" | Exclude<FoldBoxChoiceKind, "answer">;

function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function polygonPath(ctx: Ctx, points: readonly Point[]) {
  ctx.beginPath();
  points.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

/** Nét đứt chia đều quanh hình vuông bo góc để chỗ nối không lệch. */
function evenDash(size: number, r: number, [dash, gap]: [number, number]): [number, number] {
  const length = 4 * (size - 2 * r) + 2 * Math.PI * r;
  const k = length / Math.max(1, Math.round(length / (dash + gap))) / (dash + gap);
  return [dash * k, gap * k];
}

function strokeIcon(ctx: Ctx, d: string, width: number, color: string, dash: number[] = []) {
  ctx.setLineDash(dash);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke(new Path2D(d));
  ctx.setLineDash([]);
}

/**
 * Một ký hiệu ở tâm (0, 0), cỡ ô 56 px, xoay `rot` phần tư vòng theo chiều kim đồng hồ
 * (theo `<g id="fb-l-…">` của FoldBoxLevels). Phép biến đổi hiện tại của `ctx` đưa nó lên ô hoặc mặt khối.
 */
function drawSymbol(ctx: Ctx, mark: FoldBoxMark) {
  ctx.save();
  ctx.rotate((mark.rot * Math.PI) / 2);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const outlined = (path: Path2D) => {
    ctx.fillStyle = SYMBOL_FILL;
    ctx.fill(path);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = SYMBOL_INK;
    ctx.stroke(path);
  };
  /** Nét kem có viền mực: vẽ nét mực dày rồi nét kem mảnh chồng lên. */
  const piped = (path: Path2D, ink: number, cream: number) => {
    ctx.lineWidth = ink;
    ctx.strokeStyle = SYMBOL_INK;
    ctx.stroke(path);
    ctx.lineWidth = cream;
    ctx.strokeStyle = SYMBOL_FILL;
    ctx.stroke(path);
  };
  switch (mark.symbol) {
    case "dot": {
      const path = new Path2D();
      path.arc(0, 0, 10.5, 0, Math.PI * 2);
      outlined(path);
      break;
    }
    case "ring": {
      const path = new Path2D();
      path.arc(0, 0, 12.5, 0, Math.PI * 2);
      piped(path, 10.5, 4);
      break;
    }
    case "plus":
      piped(new Path2D("M0 -14 L0 14 M-14 0 L14 0"), 10.5, 4);
      break;
    case "diamond":
      outlined(new Path2D("M0 -15 L15 0 L0 15 L-15 0 Z"));
      break;
    case "bar":
      piped(new Path2D("M-16 0 L16 0"), 11, 4.5);
      break;
    case "triangle":
      outlined(new Path2D("M0 -16 L14 9 L-14 9 Z"));
      break;
  }
  ctx.restore();
}

/** Toạ độ ô (đơn vị ô) → góc trên trái của ô (px), với tâm khung bao lưới ở (0, 0). */
function netLayout(cells: readonly FoldBoxCell[]) {
  let maxX = 0;
  let maxY = 0;
  for (const { x, y } of cells) {
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const ox = (-(maxX + 1) * UNIT) / 2;
  const oy = (-(maxY + 1) * UNIT) / 2;
  return (cell: FoldBoxCell): Point => [ox + cell.x * UNIT, oy + cell.y * UNIT];
}

/** Mọi cạnh chung giữa hai ô kề nhau (đường gấp), mỗi cạnh một đoạn [đầu, cuối]. */
function foldEdges(cells: readonly FoldBoxCell[], at: (cell: FoldBoxCell) => Point) {
  const has = new Set(cells.map(({ x, y }) => `${x},${y}`));
  const edges: [Point, Point][] = [];
  for (const cell of cells) {
    const [px, py] = at(cell);
    if (has.has(`${cell.x + 1},${cell.y}`))
      edges.push([
        [px + UNIT, py],
        [px + UNIT, py + UNIT],
      ]);
    if (has.has(`${cell.x},${cell.y + 1}`))
      edges.push([
        [px, py + UNIT],
        [px + UNIT, py + UNIT],
      ]);
  }
  return edges;
}

/** Vẽ từng cạnh thành một nét riêng để mẫu gạch bắt đầu lại ở mỗi cạnh (như từng `M…L…` của SVG). */
function strokeEdges(ctx: Ctx, edges: readonly [Point, Point][]) {
  for (const [[x1, y1], [x2, y2]] of edges) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

/** Trạng thái phản hồi của một lưới. */
interface NetLook {
  /** Ô viền vàng (đáp án). */
  focusOk?: readonly number[];
  /** Ô khoanh nét đứt đỏ (thẻ chạm sai). */
  focusBad?: readonly number[];
  /** Đường gấp sáng vàng (đáp án ở Mầm, khi không có ô `focus`). */
  goldFolds?: boolean;
}

/** Lưới trải phẳng, tâm khung bao ở (0, 0): bóng, viền, ô tím, đường gấp, ký hiệu, rồi lớp phản hồi. */
function drawNet(ctx: Ctx, cells: readonly FoldBoxCell[], c: Palette, look: NetLook) {
  const at = netLayout(cells);
  const grow = NET_OUTLINE / 2;
  const fillCells = (dy: number, g: number) => {
    for (const cell of cells) {
      const [px, py] = at(cell);
      ctx.fillRect(px - g, py + dy - g, UNIT + 2 * g, UNIT + 2 * g);
    }
  };
  // Ô nở thêm nửa nét viền = nét viền 6 px góc vuông, như `stroke-width="6"` của bản mẫu.
  ctx.fillStyle = c.sticker;
  fillCells(NET_SHADOW, grow);
  ctx.fillStyle = c.border;
  fillCells(0, grow);
  ctx.fillStyle = c.faceLeft;
  fillCells(0, 0);

  const edges = foldEdges(cells, at);
  ctx.lineCap = "butt";
  if (look.goldFolds) {
    ctx.lineCap = "round";
    ctx.lineWidth = FOLD_GOLD_UNDER;
    ctx.strokeStyle = c.border;
    strokeEdges(ctx, edges);
    ctx.lineCap = "butt";
    ctx.setLineDash(FOLD_DASH);
    ctx.lineDashOffset = FOLD_DASH_OFFSET;
    ctx.lineWidth = FOLD_GOLD;
    ctx.strokeStyle = c.primary;
    strokeEdges(ctx, edges);
  } else {
    ctx.setLineDash(FOLD_DASH);
    ctx.lineDashOffset = FOLD_DASH_OFFSET;
    ctx.globalAlpha = FOLD_ALPHA;
    ctx.lineWidth = FOLD_LINE;
    ctx.strokeStyle = c.border;
    strokeEdges(ctx, edges);
    ctx.globalAlpha = 1;
  }
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  for (const cell of cells) {
    if (!cell.mark) continue;
    const [px, py] = at(cell);
    ctx.save();
    ctx.translate(px + UNIT / 2, py + UNIT / 2);
    drawSymbol(ctx, cell.mark);
    ctx.restore();
  }

  const focused = (indexes: readonly number[] | undefined) =>
    (indexes ?? []).flatMap((i) => (cells[i] ? [at(cells[i])] : []));

  const ok = focused(look.focusOk);
  if (ok.length > 0) {
    ctx.lineJoin = "round";
    for (const [width, color] of [
      [FOCUS_OK_UNDER, c.border],
      [FOCUS_OK, c.primary],
    ] as const) {
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      for (const [px, py] of ok) ctx.strokeRect(px, py, UNIT, UNIT);
    }
  }

  const bad = focused(look.focusBad);
  if (bad.length > 0) {
    const size = UNIT - 2 * FOCUS_BAD_INSET;
    const box = (px: number, py: number) =>
      roundRectPath(ctx, px + FOCUS_BAD_INSET, py + FOCUS_BAD_INSET, size, size, FOCUS_BAD_RADIUS);
    ctx.lineWidth = FOCUS_BAD_UNDER;
    ctx.strokeStyle = SYMBOL_FILL;
    for (const [px, py] of bad) {
      box(px, py);
      ctx.stroke();
    }
    ctx.setLineDash(FOCUS_BAD_DASH);
    ctx.lineWidth = FOCUS_BAD;
    ctx.strokeStyle = c.destructive;
    for (const [px, py] of bad) {
      box(px, py);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
}

/** Khối mẫu isometric (toạ độ khung 720×1280, `ctx` đã dời gốc về đó): bóng, 3 mặt, ký hiệu trên mặt. */
function drawCube(ctx: Ctx, cube: FoldBoxCube, c: Palette) {
  const l = 360 - CUBE_W;
  const r = 360 + CUBE_W;
  const bottom = CUBE_MID_Y + CUBE_EDGE;
  const sideBottom = CUBE_SIDE_Y + CUBE_EDGE;
  const top: Point[] = [
    [360, CUBE_TOP_Y],
    [r, CUBE_SIDE_Y],
    [360, CUBE_MID_Y],
    [l, CUBE_SIDE_Y],
  ];
  const left: Point[] = [
    [360, CUBE_MID_Y],
    [l, CUBE_SIDE_Y],
    [l, sideBottom],
    [360, bottom],
  ];
  const right: Point[] = [
    [r, CUBE_SIDE_Y],
    [360, CUBE_MID_Y],
    [360, bottom],
    [r, sideBottom],
  ];
  const outline: Point[] = [
    [l, CUBE_SIDE_Y],
    [360, CUBE_TOP_Y],
    [r, CUBE_SIDE_Y],
    [r, sideBottom],
    [360, bottom],
    [l, sideBottom],
  ];
  const shadow = outline.map(([x, y]): Point => [x, y + CUBE_SHADOW]);

  ctx.lineJoin = "round";
  ctx.lineWidth = CUBE_OUTLINE;
  ctx.strokeStyle = c.sticker;
  polygonPath(ctx, shadow);
  ctx.fillStyle = c.sticker;
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = c.border;
  for (const [points, color] of [
    [left, c.faceLeft],
    [right, c.faceRight],
    [top, c.faceTop],
  ] as const) {
    polygonPath(ctx, points);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
  }

  for (const face of ["top", "left", "right"] as const) {
    const mark = cube[face];
    if (!mark) continue;
    const { center, x, y } = FACES[face];
    ctx.save();
    ctx.transform(x[0], x[1], y[0], y[1], center[0], center[1]);
    drawSymbol(ctx, mark);
    ctx.restore();
  }
}

function drawTurnIcon(ctx: Ctx, width: number, color: string) {
  strokeIcon(ctx, TURN_ARC, width, color);
  strokeIcon(ctx, TURN_HEAD, width, color);
}

function drawMirrorIcon(ctx: Ctx, color: string) {
  strokeIcon(ctx, MIRROR_AXIS, 3, color, [4, 3]);
  strokeIcon(ctx, MIRROR_ARROWS, 4, color);
}

/** Ô vuông nhỏ trong icon loại lỗi. */
function iconSquare(
  ctx: Ctx,
  [x, y, size]: readonly [number, number, number],
  fill: string | null,
  stroke: string,
  width: number,
  dash: number[] = [],
) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, size, size);
  }
  ctx.setLineDash(dash);
  ctx.lineWidth = width;
  ctx.strokeStyle = stroke;
  ctx.strokeRect(x, y, size, size);
  ctx.setLineDash([]);
}

// ---------------------------------------------------------------- scene

interface ChoiceView {
  /** Đặt tại tâm thẻ: mờ dần khi hiện câu, chứa lớp phủ khi bị làm mờ. */
  slot: Phaser.GameObjects.Container;
  /** Mặt thẻ: nhấc lên khi rê chuột, co khi nhấn, rung khi sai. */
  face: Phaser.GameObjects.Container;
  card: Phaser.GameObjects.Image;
  /** Lưới (CanvasTexture riêng của ô này, vẽ lại khi đổi trạng thái); nảy khi đúng. */
  net: Phaser.GameObjects.Image;
  cells: readonly FoldBoxCell[];
  hovered: boolean;
}

/** Gấp hộp — chạm vào lưới trải phẳng duy nhất gấp được đúng khối hộp ở trên. */
export default class FoldBoxScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = false;
  private colors!: Palette;
  private reducedMotion = false;
  private board?: Phaser.GameObjects.Container;
  private choices: ChoiceView[] = [];
  /** Hẹn giờ của câu hiện tại (sang câu mới); huỷ hết khi sang câu mới hoặc rời màn. */
  private timers: Phaser.Time.TimerEvent[] = [];

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.locked = false;
    this.choices = [];
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

    // Dải nhắc luật giữ nguyên suốt vòng.
    this.add.image(RULES[0], RULES[1], this.rulesTexture());
    this.showPuzzle();
  }

  // -------------------------------------------------------------- dựng câu đố

  private showPuzzle() {
    // Mọi hẹn giờ và tween đang chạy đều thuộc câu cũ: dừng trước khi huỷ.
    this.clearTimers();
    this.tweens.killAll();
    this.board?.destroy();
    this.locked = false;

    const puzzle = foldBox.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    const board = this.add.container(0, 0);

    const model = this.add.image(MODEL.x, MODEL.y, this.modelTexture(puzzle.cube));
    board.add(model);

    const slots = puzzle.choices.length > 3 ? SLOTS_4 : SLOTS_3;
    this.choices = puzzle.choices.map((choice, i) => {
      const [x, y] = slots[i] ?? SLOTS_4[0]!;
      const card = this.add.image(0, 0, this.cardTexture("idle"));
      const net = this.add.image(0, 0, this.netTexture(i, choice.cells, {}));
      const face = this.add.container(0, 0, [card, net]);
      const slot = this.add.container(x, y, [face]);
      const view: ChoiceView = { slot, face, card, net, cells: choice.cells, hovered: false };

      // Vùng chạm phủ cả thẻ 320×320; ghi nhận ở pointerdown, một chạm là chốt.
      const zone = this.add
        .zone(x, y, CARD.size, CARD.size)
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

    // Hiện câu: mờ dần + phóng nhẹ, nhận chạm ngay.
    const targets = [model, ...this.choices.map((view) => view.slot)];
    for (const target of targets) {
      target.setAlpha(0);
      if (!this.reducedMotion) target.setScale(APPEAR_SCALE);
    }
    this.tweens.add({ targets, alpha: 1, scale: 1, duration: APPEAR_MS, ease: "Quad.easeOut" });
  }

  private setHover(view: ChoiceView, on: boolean) {
    if (view.hovered === on) return;
    view.hovered = on;
    view.face.y = on ? -CARD.lift : 0;
    view.card.setTexture(this.cardTexture(on ? "hover" : "idle"));
  }

  // -------------------------------------------------------------- trả lời

  private answer(puzzle: FoldBoxPuzzle, choice: number) {
    if (this.locked) return;
    this.locked = true;

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const index = this.index;
    const correct = foldBox.check(puzzle, choice);
    this.bridge.submit(index, choice);
    this.index += 1;

    for (const view of this.choices) this.setHover(view, false);
    const picked = this.choices[choice];
    const right = this.choices[puzzle.answerIndex];
    const answer = puzzle.choices[puzzle.answerIndex];
    if (!picked || !right || !answer) return;
    if (!this.reducedMotion) {
      this.tweens.add({
        targets: picked.face,
        scale: PRESS_SCALE,
        duration: PRESS_MS / 2,
        yoyo: true,
      });
    }

    if (correct) {
      this.showRight(puzzle.answerIndex, right, answer.focus, true);
      this.after(SOLVED_MS, () => this.showPuzzle());
      return;
    }

    const wrong = puzzle.choices[choice];
    this.showMiss(choice, picked, wrong?.kind ?? "notNet", wrong?.focus ?? []);
    this.showRight(puzzle.answerIndex, right, answer.focus, false);
    for (const view of this.choices) if (view !== picked && view !== right) this.dim(view);

    // Hết khoá theo `lockedUntil` của server (không tự đếm 1,5 giây) để khớp huy hiệu khoá của khung.
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive() || this.index !== index + 1) return;
      this.after(ms, () => this.showPuzzle());
    });
  }

  /**
   * Thẻ đúng: vòng vàng + ✓; 3 ô thành mặt trên/trái/phải viền vàng (Mầm không có ô `focus`: các
   * đường gấp sáng vàng). Khi người chơi chạm đúng, lưới nảy nhẹ.
   */
  private showRight(i: number, view: ChoiceView, focus: readonly number[], bounce: boolean) {
    const look: NetLook = focus.length > 0 ? { focusOk: focus } : { goldFolds: true };
    this.netTexture(i, view.cells, look);
    view.face.addAt(this.add.image(0, 0, this.ringTexture()), 0);
    view.face.add(this.add.image(OK_AT[0], OK_AT[1], this.badgeTexture("ok")));
    if (!bounce || this.reducedMotion) return;
    this.tweens.add({
      targets: view.net,
      scale: BOUNCE_SCALE,
      duration: BOUNCE_MS / 2,
      delay: PRESS_MS,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  /**
   * Thẻ bị chạm sai: viền gạch đứt + ✗ kèm icon theo loại lỗi; các ô `focus` khoanh nét đứt đỏ;
   * rung ngang ±8 px.
   */
  private showMiss(i: number, view: ChoiceView, kind: FoldBoxChoiceKind, focus: readonly number[]) {
    view.card.setTexture(this.cardTexture("miss"));
    this.netTexture(i, view.cells, { focusBad: focus });
    if (kind !== "answer") {
      view.face.add(this.add.image(KIND_AT[0], KIND_AT[1], this.badgeTexture(kind)));
    }
    view.face.add(this.add.image(BAD_AT[0], BAD_AT[1], this.badgeTexture("bad")));
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
   * Làm mờ thẻ còn 35 % bằng lớp phủ màu nền khung (65 %). Đặt alpha cho cả nhóm thì Phaser tính
   * riêng từng lớp, bóng đổ dưới thẻ và dưới lưới sẽ lộ ra; nền khung là một màu nên phủ cho kết quả
   * giống hệt làm mờ cả nhóm.
   */
  private dim(view: ChoiceView) {
    const height = CARD.size + CARD.shadow + 4;
    const veil = this.add
      .rectangle(0, CARD.shadow / 2, CARD.size + 4, height, toColor(this.colors.muted), 1)
      .setAlpha(0);
    view.slot.add(veil);
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

  // -------------------------------------------------------------- texture

  /** Tạo texture tĩnh từ canvas 2D (gốc toạ độ ở tâm) nếu chưa có; trả về khoá. Vẽ một lần mỗi vòng. */
  private texture(name: string, width: number, height: number, draw: (ctx: Ctx) => void) {
    const key = `fold-box:${name}`;
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
   * Texture vẽ lại được (khối mẫu, lưới từng ô): tạo một lần, mỗi lần gọi xoá và vẽ lại rồi đẩy lên
   * GPU. Gốc toạ độ ở tâm. Trả về khoá.
   */
  private redraw(name: string, width: number, height: number, draw: (ctx: Ctx) => void) {
    const key = `fold-box:${name}`;
    const texture = this.textures.exists(key)
      ? (this.textures.get(key) as Phaser.Textures.CanvasTexture)
      : this.textures.createCanvas(key, width, height);
    if (!texture) return key;
    const ctx = texture.getContext();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.translate(width / 2, height / 2);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.save();
    draw(ctx);
    ctx.restore();
    texture.refresh();
    return key;
  }

  /** Lưới của ô lựa chọn thứ `i` (mỗi ô một CanvasTexture), vẽ theo trạng thái phản hồi. */
  private netTexture(i: number, cells: readonly FoldBoxCell[], look: NetLook) {
    return this.redraw(`net-${i}`, NET_CANVAS, NET_CANVAS, (ctx) =>
      drawNet(ctx, cells, this.colors, look),
    );
  }

  /** Thẻ khối mẫu: viền mực dày, bóng đổ, icon con mắt, khối hộp của câu hiện tại. */
  private modelTexture(cube: FoldBoxCube) {
    const c = this.colors;
    const { size, radius } = MODEL;
    const half = size / 2;
    const pad = 6;
    return this.redraw("model", size + 2 * pad, size + 2 * (MODEL.shadow + pad), (ctx) => {
      roundRectPath(ctx, -half, -half + MODEL.shadow, size, size, radius);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      roundRectPath(ctx, -half, -half, size, size, radius);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.lineWidth = MODEL.border;
      ctx.strokeStyle = c.border;
      ctx.stroke();

      ctx.save();
      ctx.translate(EYE_AT[0], EYE_AT[1]);
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fillStyle = c.muted;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = c.cardFg;
      ctx.stroke();
      const eye = new Path2D(EYE);
      ctx.fillStyle = c.card;
      ctx.fill(eye);
      ctx.lineWidth = 3.5;
      ctx.stroke(eye);
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fillStyle = c.faceLeft;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = c.border;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = c.border;
      ctx.fill();
      ctx.restore();

      // Khối vẽ theo toạ độ khung 720×1280 của đặc tả: dời gốc từ tâm thẻ về góc khung.
      ctx.save();
      ctx.translate(-MODEL.x, -MODEL.y);
      drawCube(ctx, cube, c);
      ctx.restore();
    });
  }

  /**
   * Thẻ lựa chọn kèm bóng đổ (chung một ảnh). Thẻ rê chuột: viền 7 và bóng lệch thêm 4 px vì mặt thẻ
   * nhấc lên 4 px còn bóng đứng yên. Thẻ chạm sai: viền gạch đứt màu lỗi thay cho viền mực.
   */
  private cardTexture(state: CardState) {
    const c = this.colors;
    const { size, radius } = CARD;
    const half = size / 2;
    const shadow = state === "hover" ? CARD.shadow + CARD.lift : CARD.shadow;
    const pad = 6;
    return this.texture(
      `card-${state}`,
      size + 2 * pad,
      size + 2 * (CARD.shadow + CARD.lift + pad),
      (ctx) => {
        roundRectPath(ctx, -half, -half + shadow, size, size, radius);
        ctx.fillStyle = c.sticker;
        ctx.fill();
        roundRectPath(ctx, -half, -half, size, size, radius);
        ctx.fillStyle = c.card;
        ctx.fill();
        if (state === "miss") {
          ctx.setLineDash(evenDash(size, radius, MISS_DASH));
          ctx.lineCap = "butt";
          ctx.lineWidth = MISS_BORDER;
          ctx.strokeStyle = c.destructive;
        } else {
          ctx.lineWidth = state === "hover" ? CARD.hoverBorder : CARD.border;
          ctx.strokeStyle = c.border;
        }
        ctx.stroke();
      },
    );
  }

  /** Dải nhắc luật: viên kem, lưới chữ thập → mũi tên → hộp ✓, không có chữ. */
  private rulesTexture() {
    const c = this.colors;
    return this.texture("rules", 228, 64, (ctx) => {
      roundRectPath(ctx, -110, -28, 220, 56, 28);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = c.border;
      ctx.stroke();

      const net = new Path2D(RULE_NET);
      ctx.fillStyle = c.faceLeft;
      ctx.fill(net);
      ctx.lineWidth = 2.5;
      ctx.stroke(net);
      ctx.lineCap = "butt";
      strokeIcon(ctx, RULE_NET_FOLDS, 1.5, c.border, [2.5, 2]);
      ctx.lineCap = "round";
      strokeIcon(ctx, RULE_ARROW, 4, c.cardFg);

      ctx.save();
      ctx.translate(18, 0);
      const h = 20 * (Math.sqrt(3) / 2);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = c.border;
      for (const [points, color] of [
        [
          [
            [0, 20],
            [0, 0],
            [-h, -10],
            [-h, 10],
          ],
          c.faceLeft,
        ],
        [
          [
            [h, 10],
            [h, -10],
            [0, 0],
            [0, 20],
          ],
          c.faceRight,
        ],
        [
          [
            [-h, -10],
            [0, 0],
            [h, -10],
            [0, -20],
          ],
          c.faceTop,
        ],
      ] as const) {
        polygonPath(ctx, points);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
      strokeIcon(ctx, RULE_CHECK, 5, c.cardFg);
    });
  }

  /** Vòng vàng viền mực quanh thẻ đúng (nằm dưới thẻ). */
  private ringTexture() {
    const c = this.colors;
    return this.texture("ring", 360, 360, (ctx) => {
      roundRectPath(ctx, -170, -170, 340, 340, 36);
      ctx.lineWidth = 14;
      ctx.strokeStyle = c.border;
      ctx.stroke();
      ctx.lineWidth = 8;
      ctx.strokeStyle = c.primary;
      ctx.stroke();
    });
  }

  /**
   * Huy hiệu tròn có bóng: ✓ (vàng), ✗ (màu lỗi), hoặc icon loại lỗi trên nền thẻ: hai ô chồng nhau
   * (không gấp được), ba ô ô giữa nét đứt (mặt đối diện), gương (soi gương), mũi tên xoay (xoay lệch).
   */
  private badgeTexture(kind: BadgeKind) {
    const c = this.colors;
    const size = 2 * (BADGE_R + BADGE_SHADOW + 4);
    return this.texture(`badge-${kind}`, size, size, (ctx) => {
      ctx.beginPath();
      ctx.arc(0, BADGE_SHADOW, BADGE_R, 0, Math.PI * 2);
      ctx.fillStyle = c.sticker;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, BADGE_R, 0, Math.PI * 2);
      ctx.fillStyle = kind === "ok" ? c.primary : kind === "bad" ? c.destructive : c.card;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.border;
      ctx.stroke();
      ctx.lineJoin = "miter";
      switch (kind) {
        case "ok":
          ctx.lineJoin = "round";
          strokeIcon(ctx, CHECK, 7, c.primaryFg);
          break;
        case "bad":
          // Dấu ✗ dùng màu nền thẻ: kem trên đỏ (sáng), tím đậm trên hồng (tối), đều đủ tương phản.
          strokeIcon(ctx, CROSS, 7, c.card);
          break;
        case "notNet":
          iconSquare(ctx, [-15, -15, 20], c.faceLeft, c.cardFg, 3);
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = c.faceTop;
          ctx.fillRect(-5, -5, 20, 20);
          ctx.globalAlpha = 1;
          iconSquare(ctx, [-5, -5, 20], null, c.cardFg, 3, [4, 3]);
          break;
        case "opposite":
          iconSquare(ctx, [-20, -6, 12], c.faceLeft, c.cardFg, 3);
          iconSquare(ctx, [-6, -6, 12], null, c.cardFg, 2.5, [3, 2.5]);
          iconSquare(ctx, [8, -6, 12], c.faceLeft, c.cardFg, 3);
          break;
        case "mirror":
          ctx.lineJoin = "round";
          drawMirrorIcon(ctx, c.cardFg);
          break;
        case "rotated":
          ctx.lineJoin = "round";
          ctx.translate(1, -2);
          drawTurnIcon(ctx, 4, c.cardFg);
          break;
      }
    });
  }
}
