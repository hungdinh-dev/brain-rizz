import {
  evaluateNumberPath,
  type NumberPathOp,
  type NumberPathPuzzle,
  numberPath,
  traceNumberPath,
} from "@brain-rizz/shared";
import Phaser from "phaser";
import { prefersReducedMotion } from "@/features/motion";
import { DESIGN_WIDTH, type MinigameBridge } from "../types";

// ── Bố cục (khung 720×1280, px thiết kế; mục "Ghi chú cho FE › Bố cục" trong đặc tả) ─────────────

const CENTER_X = DESIGN_WIDTH / 2;
/** Thẻ đích: tâm (360, 290), 300 × 120, dưới dải huy hiệu khoá; hồng tâm nhỏ bên trái số đích. */
const TARGET = { y: 290, w: 300, h: 120, radius: 26, iconX: -105, numberX: 30, font: 80 };
/** Số xuất phát: vòng tròn kem tâm (360, 440). */
const START = { y: 440, r: 58, font: 60 };
/** Tâm cột (ô và cửa ra) theo số cột, tâm hàng ô theo số hàng. */
const COL_X: Record<number, number[]> = {
  2: [220, 500],
  3: [150, 360, 570],
  4: [105, 275, 445, 615],
};
const ROW_Y: Record<number, number[]> = { 2: [640, 860], 3: [600, 770, 940] };
interface CellSize {
  w: number;
  h: number;
  font: number;
}
const CELL: CellSize = { w: 150, h: 96, font: 52 };
/** Lưới 4 cột (Siêu khó) ô nhỏ hơn cho đủ khe giữa hai cột. */
const CELL_NARROW: CellSize = { w: 140, h: 92, font: 46 };
const CELL_RADIUS = 22;
/** "×(−1)" là nhãn dài nhất, nhỏ lại cho vừa ô. */
const LONG_FONT = 40;
/** Cửa ra: tâm y = 1130 dưới mỗi cột. */
const EXIT = { y: 1130, r: 62 };
/** Bóng đổ kiểu nhãn dán (thấp hơn mặt 6 px). */
const DROP = 6;
/**
 * Mặt bảng phấn sau các đường (khung chơi là thẻ giấy `bg-muted`, phấn màu không nổi trên giấy;
 * như Phấn trượt): chứa vòng xuất phát, ô, cửa ra và kết quả dưới cửa. Thẻ đích nằm trên giấy.
 */
const SLATE = { x: 18, y: 364, w: 684, h: 904, r: 36 };

/** Nét đường dày 8 px; hai đường chung ô hàng 0 đi hai nét song song cách nhau 14 px. */
const LINE_W = 8;
const SHARED_GAP = 7;
/** Hình cửa ra nét 6 px, kiểu nét thu nhỏ một nửa cho vừa hình 56 px. */
const SHAPE_W = 6;
const SHAPE_PATTERN_SCALE = 0.5;

/**
 * Vùng chạm. Đường thẳng: cả dải cột từ đỉnh ô hàng 0 tới đáy cửa ra, rộng bằng khoảng cách cột
 * trừ 10 px. Đường đan (Siêu khó): chỉ từ đỉnh ô hàng cuối, rộng 160 px (các hàng trên nét đan
 * nhau nên không nhận chạm).
 */
const ZONE_BOTTOM = 1200;
const ZONE_INSET = 10;
const WOVEN_ZONE_W = 160;

/** Lúc khoá: chip số trung gian ở khe dưới ô, lệch khỏi nét đường. */
const CHIP = { font: 34, h: 46, padX: 12, minW: 52, dx: 58, radius: 14 };
/** Kết quả của đường chọn sai: vòng nét đứt đỏ ngay dưới cửa đã chạm. */
const RESULT = { dy: EXIT.r + 36, r: 30, font: 34 };
/** Dấu ✓ ở góc phải trên cửa. */
const OK_OFFSET = { x: 48, y: -40 };

const FONT_FAMILY = '"Baloo 2", "Be Vietnam Pro", sans-serif';
const FONT_WEIGHT = "800";
/** Chân chữ đặt thấp hơn tâm 0,35 cỡ chữ thì chữ số nằm giữa theo chiều dọc (như Chạm đích). */
const DIGIT_DROP = 0.35;
/** Chờ font tối đa ngần này ms trước câu đầu, quá thì vẽ bằng font dự phòng. */
const FONT_TIMEOUT_MS = 1500;

/** Dấu trừ dài (U+2212), không dùng gạch ngắn "-". */
const MINUS = "−";
/** Viền ngoài của dấu ✗ (như Chạm đích). */
const WHITE = 0xffffff;

// ── Chuyển động ────────────────────────────────────────────────────────────────────────────

const APPEAR_MS = 140;
/** Đúng: chấm phấn chạy dọc đường đã chọn, câu mới sau 300 ms. */
const RUN_MS = 220;
const NEXT_MS = 300;
const FLASH_MS = 110;
/** Chạm cửa: lún xuống rồi về. Rê chuột: nhô lên nhẹ. */
const SINK = 6;
const SINK_MS = 70;
const HOVER_LIFT = 6;
const HOVER_SCALE = 1.05;
/** Sai: rung cửa đã chạm 200 ms; nét đôi vàng chạy dọc đường đúng. */
const SHAKE_MS = 200;
const HIGHLIGHT_MS = 450;
const DIM_ALPHA = 0.35;

type Pt = { x: number; y: number };

/** Một bước của kiểu nét: đoạn nét (độ dài giữa tâm hai đầu tròn), khoảng trống, hoặc một chấm. */
type Dash = { kind: "dash"; len: number } | { kind: "gap"; len: number } | { kind: "dot" };

/**
 * Kiểu nét của 4 đường, để không chỉ phân biệt bằng màu: 0 liền, 1 gạch dài, 2 chấm, 3 gạch chấm.
 * Đầu tròn làm đoạn nét dài thêm, khoảng trống ngắn đi một bề dày nét.
 */
const PATTERNS: Dash[][] = [
  [],
  [
    { kind: "dash", len: 26 },
    { kind: "gap", len: 20 },
  ],
  [{ kind: "dot" }, { kind: "gap", len: 20 }],
  [{ kind: "dash", len: 20 }, { kind: "gap", len: 16 }, { kind: "dot" }, { kind: "gap", len: 16 }],
];

/** Màu lấy từ token giao diện lúc vẽ câu, để mọi thứ nổi trên cả nền bảng sáng lẫn tối. */
interface Ink {
  dark: boolean;
  card: number;
  cardFg: number;
  border: number;
  sticker: number;
  danger: number;
  accent: number;
  accentFg: number;
  /** Vòng xuất phát giữ giấy kem chữ mực ở cả hai chủ đề; thẻ đích, cửa ra, chip là nền mực. */
  paper: number;
  ink: number;
  /** Hồng tâm nhỏ trên thẻ đích (màu nhóm Tính toán). */
  compute: number;
  /** Mặt bảng phấn (sáng: xanh lá, tối: tím than). */
  board: number;
  /** Phấn màu của 4 đường: vàng, hồng, xanh dương, xanh lá. */
  lines: [number, number, number, number];
}

/** Một ô phép trên lưới (ô dùng chung chỉ vẽ một lần). */
interface CellView {
  node: Phaser.GameObjects.Container;
  /** Các đường đi qua ô này. */
  paths: number[];
}

/** Một con đường của câu hiện tại. */
interface PathView {
  line: Polyline;
  /** Độ dài dọc nét (tính từ tâm số xuất phát) tới tâm từng ô của đường. */
  cellAt: number[];
  gfx: Phaser.GameObjects.Graphics;
  exit: Phaser.GameObjects.Container;
  x: number;
}

const cssColor = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/** Số âm vẽ bằng "−" dài; `String(-8)` ra gạch ngắn. */
function formatNumber(n: number): string {
  return n < 0 ? `${MINUS}${-n}` : String(n);
}

/** Nhãn phép trên ô (shared không chứa chữ; FE tự vẽ ký hiệu). */
function opLabel(op: NumberPathOp): string {
  switch (op.kind) {
    case "add":
      return `+${op.n}`;
    case "sub":
      return `${MINUS}${op.n}`;
    case "mul":
      return `×${op.n}`;
    case "div":
      return `÷${op.n}`;
    case "sq":
      return "x²";
    case "neg":
      return `×(${MINUS}1)`;
  }
}

/** Đọc token màu CSS (tự đổi theo sáng/tối) tại canvas; thiếu token thì dùng màu giao diện sáng. */
function readInk(el: Element): Ink {
  const css = getComputedStyle(el);
  const pick = (name: string, fallback: number) => {
    const value = css.getPropertyValue(name).trim();
    return value ? Phaser.Display.Color.ValueToColor(value).color : fallback;
  };
  return {
    dark: css.colorScheme === "dark",
    card: pick("--card", 0xfff8ef),
    cardFg: pick("--card-foreground", 0x1f1b3a),
    border: pick("--border", 0x1f1b3a),
    sticker: pick("--sticker", 0x1f1b3a),
    danger: pick("--destructive", 0xc93a55),
    accent: pick("--primary", 0xffd166),
    accentFg: pick("--primary-foreground", 0x1f1b3a),
    paper: pick("--color-paper", 0xfff8ef),
    ink: pick("--color-ink", 0x1f1b3a),
    compute: pick("--color-compute", 0x3bb273),
    board: pick("--board", 0x2d6a54),
    lines: [
      pick("--color-sun", 0xffd166),
      pick("--color-pink", 0xf7a8b8),
      pick("--color-sky", 0x8ec5ff),
      pick("--color-mint", 0x7fd1ae),
    ],
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
  const load = fonts.load(`${FONT_WEIGHT} 72px "Baloo 2"`, `0123456789+×÷²()x${MINUS}`).then(
    () => {},
    () => {},
  );
  return Promise.race([load, timeout]).finally(() => clearTimeout(timer));
}

// ── Hình học cho Graphics (Phaser không có nét đứt hay đầu nét tròn) ────────────────────────────

/** Đường gấp khúc có tham số độ dài, để vẽ kiểu nét liền mạch qua các khúc và chạy chấm dọc nét. */
class Polyline {
  /** `acc[i]`: độ dài từ điểm đầu tới điểm `i`. */
  readonly acc: number[] = [0];
  readonly length: number;

  constructor(readonly pts: Pt[]) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      this.acc.push(this.acc[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
    }
    this.length = this.acc[this.acc.length - 1]!;
  }

  /** Điểm ở độ dài `s` dọc nét. */
  at(s: number): Pt {
    const t = Phaser.Math.Clamp(s, 0, this.length);
    let i = 1;
    while (i < this.pts.length - 1 && this.acc[i]! < t) i++;
    const a = this.pts[i - 1]!;
    const b = this.pts[i] ?? a;
    const from = this.acc[i - 1]!;
    const seg = (this.acc[i] ?? from) - from;
    const u = seg > 0 ? (t - from) / seg : 0;
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
  }

  /** Các điểm của khúc từ `s0` tới `s1`, gồm mọi đỉnh nằm giữa. */
  slice(s0: number, s1: number): Pt[] {
    const out = [this.at(s0)];
    for (let i = 1; i < this.pts.length - 1; i++) {
      const s = this.acc[i]!;
      if (s > s0 && s < s1) out.push(this.pts[i]!);
    }
    out.push(this.at(s1));
    return out;
  }
}

/** Nét thẳng đầu tròn, vẽ bằng đa giác để tô được. */
function capsule(from: Pt, to: Pt, r: number): Pt[] {
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  const cap = (c: Pt, start: number) =>
    Array.from({ length: 9 }, (_, i) => {
      const t = start + (Math.PI * i) / 8;
      return { x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) };
    });
  return [...cap(to, a - Math.PI / 2), ...cap(from, a + Math.PI / 2)];
}

/** `fillPoints` của Phaser 4 nhận mảng Vector2. */
function fillPoly(g: Phaser.GameObjects.Graphics, pts: Pt[]) {
  g.fillPoints(
    pts.map((p) => new Phaser.Math.Vector2(p.x, p.y)),
    true,
  );
}

/** Nét liền đầu tròn qua các điểm (màu tô hiện tại của `g`), lệch `offset` px sang trái hướng đi. */
function strokeRound(g: Phaser.GameObjects.Graphics, pts: Pt[], width: number, offset = 0) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-6 && i < pts.length - 1) continue;
    const nx = len > 0 ? (-(b.y - a.y) / len) * offset : 0;
    const ny = len > 0 ? ((b.x - a.x) / len) * offset : 0;
    fillPoly(g, capsule({ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }, width / 2));
  }
}

/**
 * Vẽ nét theo kiểu `pattern` (màu tô hiện tại của `g`) trên khúc `from`…`to` của `line`. Kiểu nét
 * luôn tính từ đầu nét, nên vẽ dần (hiệu ứng) không làm các đoạn nét xê dịch.
 */
function strokePattern(
  g: Phaser.GameObjects.Graphics,
  line: Polyline,
  pattern: Dash[],
  width: number,
  from = 0,
  to = line.length,
) {
  if (pattern.length === 0) {
    strokeRound(g, line.slice(from, to), width);
    return;
  }
  const dotR = width * 0.65;
  let s = 0;
  let k = 0;
  while (s <= to) {
    const step = pattern[k % pattern.length]!;
    k += 1;
    if (step.kind === "gap") {
      s += step.len;
    } else if (step.kind === "dot") {
      if (s >= from) {
        const p = line.at(s);
        g.fillCircle(p.x, p.y, dotR);
      }
    } else {
      const a = Math.max(s, from);
      const b = Math.min(s + step.len, to);
      if (b > a) strokeRound(g, line.slice(a, b), width);
      s += step.len;
    }
  }
}

const scalePattern = (pattern: Dash[], k: number): Dash[] =>
  pattern.map((d) => (d.kind === "dot" ? d : { ...d, len: d.len * k }));

/** Hình cửa ra của đường `i` (khép kín, quanh (0, 0)): 0 ○, 1 △, 2 □, 3 ◇. */
function exitShape(i: number): Pt[] {
  switch (i % 4) {
    case 0:
      return Array.from({ length: 33 }, (_, k) => {
        const a = -Math.PI / 2 + (k * Math.PI * 2) / 32;
        return { x: 25 * Math.cos(a), y: 25 * Math.sin(a) };
      });
    case 1:
      return [
        { x: 0, y: -27 },
        { x: 28, y: 21 },
        { x: -28, y: 21 },
        { x: 0, y: -27 },
      ];
    case 2:
      return [
        { x: -23, y: -23 },
        { x: 23, y: -23 },
        { x: 23, y: 23 },
        { x: -23, y: 23 },
        { x: -23, y: -23 },
      ];
    default:
      return [
        { x: 0, y: -30 },
        { x: 30, y: 0 },
        { x: 0, y: 30 },
        { x: -30, y: 0 },
        { x: 0, y: -30 },
      ];
  }
}

/** Vòng tròn khép kín bán kính `r` quanh (0, 0). */
const circlePoints = (r: number): Pt[] =>
  Array.from({ length: 41 }, (_, k) => {
    const a = -Math.PI / 2 + (k * Math.PI * 2) / 40;
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  });

/**
 * Nét của từng đường: tâm số xuất phát → tâm các ô → tâm cửa ra (nét đi dưới vòng xuất phát, ô
 * và cửa nên chỉ thấy phần giữa). Hai đường chung ô hàng 0 lệch ±7 px trên đoạn từ số xuất phát
 * tới ô đó; ngoài đoạn này bộ sinh bảo đảm không hai đường nào đi chồng một đoạn.
 */
function pathLines(puzzle: NumberPathPuzzle, xs: number[], ys: number[]) {
  const start = { x: CENTER_X, y: START.y };
  const firstCol = puzzle.layout.map((cells) => cells[0]?.col ?? 0);
  return puzzle.layout.map((cells, i) => {
    const centers = cells.map((c) => ({ x: xs[c.col] ?? CENTER_X, y: ys[c.row] ?? START.y }));
    const first = centers[0] ?? start;
    const mates = firstCol.flatMap((col, j) => (col === firstCol[i] ? [j] : []));
    const pts: Pt[] = [];
    if (mates.length > 1) {
      const side = mates.indexOf(i) === 0 ? -1 : 1;
      const len = Math.hypot(first.x - start.x, first.y - start.y) || 1;
      const nx = (-(first.y - start.y) / len) * SHARED_GAP * side;
      const ny = ((first.x - start.x) / len) * SHARED_GAP * side;
      pts.push({ x: start.x + nx, y: start.y + ny }, { x: first.x + nx, y: first.y + ny });
    } else {
      pts.push(start);
    }
    const firstCell = pts.length;
    pts.push(...centers, { x: xs[i] ?? CENTER_X, y: EXIT.y });
    const line = new Polyline(pts);
    const cellAt = centers.map((_, k) => line.acc[firstCell + k] ?? 0);
    return { line, cellAt };
  });
}

// ── Các hình vẽ quanh (0, 0) ────────────────────────────────────────────────────────────────

/**
 * Thẻ đích: bóng đổ, nền mực chữ vàng (như ô tổng của Chạm đích), hồng tâm nhỏ bên trái. Sáng:
 * vạch kem mờ bên trong; tối: viền kem để thẻ tách khỏi bảng tím than.
 */
function drawTargetCard(g: Phaser.GameObjects.Graphics, ink: Ink) {
  const { w, h, radius } = TARGET;
  g.fillStyle(ink.sticker, 1);
  g.fillRoundedRect(-w / 2, -h / 2 + DROP, w, h, radius);
  g.fillStyle(ink.ink, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
  if (ink.dark) {
    g.lineStyle(3, ink.cardFg, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
  } else {
    g.lineStyle(2, ink.paper, 0.25);
    g.strokeRoundedRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20, radius - 6);
  }
  const x = TARGET.iconX;
  g.fillStyle(ink.compute, 1);
  g.lineStyle(4, ink.sticker, 1);
  g.fillCircle(x, 0, 32);
  g.strokeCircle(x, 0, 32);
  g.fillStyle(ink.paper, 1);
  g.lineStyle(3, ink.sticker, 1);
  g.fillCircle(x, 0, 18);
  g.strokeCircle(x, 0, 18);
  g.fillStyle(ink.ink, 1);
  g.fillCircle(x, 0, 6);
}

/** Mặt bảng phấn: viền mực, vệt sáng mờ ở mép trên như bảng thật. */
function drawSlate(g: Phaser.GameObjects.Graphics, ink: Ink) {
  const { x, y, w, h, r } = SLATE;
  g.fillStyle(ink.board, 1);
  g.lineStyle(5, ink.sticker, 1);
  g.fillRoundedRect(x, y, w, h, r);
  g.strokeRoundedRect(x, y, w, h, r);
  g.lineStyle(3, WHITE, ink.dark ? 0.06 : 0.1);
  g.strokeRoundedRect(x + 12, y + 12, w - 24, h - 24, r - 8);
}

/** Vòng xuất phát: bóng đổ, giấy kem viền mực. */
function drawStart(g: Phaser.GameObjects.Graphics, ink: Ink) {
  g.fillStyle(ink.sticker, 1);
  g.fillCircle(0, DROP, START.r);
  g.fillStyle(ink.paper, 1);
  g.lineStyle(5, ink.sticker, 1);
  g.fillCircle(0, 0, START.r);
  g.strokeCircle(0, 0, START.r);
}

/** Ô phép: thẻ giấy (tối: tím đậm) viền mực, bóng đổ. */
function drawCell(g: Phaser.GameObjects.Graphics, size: CellSize, ink: Ink) {
  const { w, h } = size;
  g.fillStyle(ink.sticker, 1);
  g.fillRoundedRect(-w / 2, -h / 2 + DROP, w, h, CELL_RADIUS);
  g.fillStyle(ink.card, 1);
  g.lineStyle(4, ink.border, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, CELL_RADIUS);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, CELL_RADIUS);
}

/** Cửa ra của đường `i`: đĩa mực, hình riêng của đường cùng màu và kiểu nét với đường. */
function drawExit(g: Phaser.GameObjects.Graphics, i: number, ink: Ink) {
  g.fillStyle(ink.sticker, 1);
  g.fillCircle(0, DROP, EXIT.r);
  g.fillStyle(ink.ink, 1);
  g.fillCircle(0, 0, EXIT.r);
  // Tối: viền kem để đĩa mực tách khỏi bảng tím than. Sáng: không thêm vòng trong (dễ lẫn với ○).
  if (ink.dark) {
    g.lineStyle(3, ink.cardFg, 1);
    g.strokeCircle(0, 0, EXIT.r);
  }
  g.fillStyle(ink.lines[i % 4]!, 1);
  const pattern = scalePattern(PATTERNS[i % 4] ?? [], SHAPE_PATTERN_SCALE);
  strokePattern(g, new Polyline(exitShape(i)), pattern, SHAPE_W);
}

/** Dấu ✗ trên cửa chọn sai: viền trắng, lõi màu báo lỗi (tối: hồng). */
function drawCross(g: Phaser.GameObjects.Graphics, ink: Ink) {
  for (const [color, width] of [
    [WHITE, 22],
    [ink.danger, 11],
  ] as const) {
    g.fillStyle(color, 1);
    strokeRound(
      g,
      [
        { x: -30, y: -30 },
        { x: 30, y: 30 },
      ],
      width,
    );
    strokeRound(
      g,
      [
        { x: 30, y: -30 },
        { x: -30, y: 30 },
      ],
      width,
    );
  }
}

/** Dấu ✓ tròn vàng (cửa đúng). */
function drawCheck(g: Phaser.GameObjects.Graphics, ink: Ink) {
  g.fillStyle(ink.sticker, 1);
  g.fillCircle(0, 5, 28);
  g.fillStyle(ink.accent, 1);
  g.lineStyle(4, ink.sticker, 1);
  g.fillCircle(0, 0, 28);
  g.strokeCircle(0, 0, 28);
  g.fillStyle(ink.accentFg, 1);
  strokeRound(
    g,
    [
      { x: -13, y: 1 },
      { x: -3, y: 11 },
      { x: 14, y: -10 },
    ],
    6.5,
  );
}

/** Chip số trung gian: nền mực chữ vàng như thẻ đích. */
function drawChip(g: Phaser.GameObjects.Graphics, w: number, ink: Ink) {
  const h = CHIP.h;
  g.fillStyle(ink.sticker, 1);
  g.fillRoundedRect(-w / 2, -h / 2 + 4, w, h, CHIP.radius);
  g.fillStyle(ink.ink, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, CHIP.radius);
  if (ink.dark) {
    g.lineStyle(2.5, ink.cardFg, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, CHIP.radius);
  }
}

/** Kết quả của đường chọn sai: nền thẻ, vòng nét đứt màu báo lỗi. */
function drawResult(g: Phaser.GameObjects.Graphics, ink: Ink) {
  g.fillStyle(ink.card, 1);
  g.fillCircle(0, 0, RESULT.r);
  g.fillStyle(ink.danger, 1);
  strokePattern(
    g,
    new Polyline(circlePoints(RESULT.r)),
    [
      { kind: "dash", len: 8 },
      { kind: "gap", len: 12 },
    ],
    5,
  );
}

/**
 * Nét đôi vàng của đường đúng (lúc khoá), vẽ tới độ dài `to`: lót mực rộng 26 px, hai ray vàng
 * 5 px lệch ±6 px. Chỗ gấp khúc nằm dưới ô nên không lộ khe.
 */
function drawHighlight(g: Phaser.GameObjects.Graphics, line: Polyline, to: number, ink: Ink) {
  g.clear();
  const pts = line.slice(0, to);
  g.fillStyle(ink.sticker, 1);
  strokeRound(g, pts, 26);
  g.fillStyle(ink.accent, 1);
  strokeRound(g, pts, 5, -6);
  strokeRound(g, pts, 5, 6);
}

/**
 * Đường số — từ số xuất phát, đi theo các ô phép tính xuống cửa ra; chạm cửa của con đường duy
 * nhất ra đúng số đích. Đặc tả: docs/04-minigames/number-path.md.
 * Mỗi câu gửi đúng một đáp án (chỉ số đường). Client chấm thử để phản hồi tức thì, server chấm lại
 * để tính điểm thật.
 */
export default class NumberPathScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = true;
  private puzzle?: NumberPathPuzzle;
  private ink!: Ink;
  private reduced = false;
  private size: CellSize = CELL;
  private xs: number[] = [];
  private ys: number[] = [];
  private paths: PathView[] = [];
  private cells: CellView[] = [];
  private slate?: Phaser.GameObjects.Graphics;
  private board?: Phaser.GameObjects.Container;
  private targetCard?: Phaser.GameObjects.Container;
  private targetFlash?: Phaser.GameObjects.Graphics;
  /** Nét đôi đường đúng (dưới ô, trên nét thường). */
  private fx?: Phaser.GameObjects.Container;
  /** ✓, ✗, chip, chấm chạy (trên ô). */
  private marks?: Phaser.GameObjects.Container;

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
      this.paths = [];
      this.cells = [];
      this.puzzle = undefined;
      this.slate = undefined;
    });
    void waitForFont().then(() => {
      // Hết vòng trong lúc chờ font thì scene đã bị huỷ.
      if (this.sys.isActive()) this.showPuzzle();
    });
  }

  private showPuzzle() {
    // Mọi tween đang chạy đều thuộc câu cũ (chấm chạy, nét đôi, rung): dừng trước khi huỷ.
    this.tweens.killAll();
    this.board?.destroy();

    const puzzle = numberPath.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    this.puzzle = puzzle;
    this.ink = readInk(this.game.canvas);
    this.reduced = prefersReducedMotion();
    this.size = puzzle.cols >= 4 ? CELL_NARROW : CELL;
    this.xs = COL_X[puzzle.cols] ?? COL_X[3]!;
    this.ys = ROW_Y[puzzle.rows] ?? ROW_Y[3]!;
    const ink = this.ink;
    // Mặt bảng ở ngoài `board` nên không nhấp nháy theo hiệu ứng hiện câu; vẽ lại theo chủ đề.
    this.slate ??= this.add.graphics().setDepth(-1);
    this.slate.clear();
    drawSlate(this.slate, ink);

    const lineLayer = this.add.container();
    this.fx = this.add.container();
    const nodes = this.add.container();
    this.marks = this.add.container();
    const zones = this.add.container();
    this.board = this.add.container(0, 0, [lineLayer, this.fx, nodes, this.marks, zones]);

    // Thẻ đích và vòng xuất phát.
    const card = this.add.graphics();
    drawTargetCard(card, ink);
    const target = this.label(formatNumber(puzzle.target), TARGET.font, ink.accent, 150);
    target.x = TARGET.numberX;
    // Loé sáng khi đúng: vòng sáng vàng quanh thẻ (không phủ lên số đích).
    this.targetFlash = this.add.graphics().setAlpha(0);
    this.targetFlash.lineStyle(10, ink.accent, 1);
    this.targetFlash.strokeRoundedRect(
      -TARGET.w / 2 - 10,
      -TARGET.h / 2 - 10,
      TARGET.w + 20,
      TARGET.h + 20,
      TARGET.radius + 8,
    );
    const startGfx = this.add.graphics();
    drawStart(startGfx, ink);
    this.targetCard = this.add.container(CENTER_X, TARGET.y, [this.targetFlash, card, target]);
    nodes.add([
      this.targetCard,
      this.add.container(CENTER_X, START.y, [
        startGfx,
        this.label(formatNumber(puzzle.start), START.font, ink.ink, START.r * 2 - 18),
      ]),
    ]);

    // Nét đường (mỗi đường một Graphics để làm mờ riêng) và cửa ra.
    this.paths = pathLines(puzzle, this.xs, this.ys).map(({ line, cellAt }, i) => {
      const gfx = this.add.graphics();
      gfx.fillStyle(ink.lines[i % 4]!, 1);
      strokePattern(gfx, line, PATTERNS[i % 4] ?? [], LINE_W);
      lineLayer.add(gfx);
      const x = this.xs[i] ?? CENTER_X;
      const exitGfx = this.add.graphics();
      drawExit(exitGfx, i, ink);
      const exit = this.add.container(x, EXIT.y, [exitGfx]);
      nodes.add(exit);
      return { line, cellAt, gfx, exit, x };
    });

    // Ô phép: mỗi (hàng, cột) một ô, ô dùng chung chỉ vẽ một lần.
    const byKey = new Map<string, CellView>();
    this.cells = [];
    puzzle.layout.forEach((cells, i) => {
      cells.forEach((c, k) => {
        const key = `${c.row}:${c.col}`;
        const found = byKey.get(key);
        if (found) {
          found.paths.push(i);
          return;
        }
        const op = puzzle.paths[i]?.[k];
        if (!op) return;
        const view = { node: this.createCell(op, c.col, c.row), paths: [i] };
        nodes.add(view.node);
        byKey.set(key, view);
        this.cells.push(view);
      });
    });

    this.createZones(puzzle, zones);

    if (!this.reduced) {
      this.board.setAlpha(0);
      this.tweens.add({ targets: this.board, alpha: 1, duration: APPEAR_MS });
    }
    // Chạm được ngay, không chờ hiệu ứng xuất hiện.
    this.locked = false;
  }

  private createCell(op: NumberPathOp, col: number, row: number) {
    const size = this.size;
    const g = this.add.graphics();
    drawCell(g, size, this.ink);
    const font = op.kind === "neg" ? LONG_FONT : size.font;
    const label = this.label(opLabel(op), font, this.ink.cardFg, size.w - 16);
    return this.add.container(this.xs[col] ?? CENTER_X, this.ys[row] ?? START.y, [g, label]);
  }

  /**
   * Vùng chạm đứng yên (không theo hiệu ứng rê chuột, lún). Đường thẳng nhận chạm cả dải cột;
   * đường đan chỉ nhận chạm ô hàng cuối và cửa ra (của riêng một đường).
   */
  private createZones(puzzle: NumberPathPuzzle, layer: Phaser.GameObjects.Container) {
    const straight = puzzle.layout.every((cells, i) => cells.every((c) => c.col === i));
    const spacing = (this.xs[1] ?? 0) - (this.xs[0] ?? 0);
    const width = straight ? spacing - ZONE_INSET : WOVEN_ZONE_W;
    const firstRow = straight ? 0 : puzzle.rows - 1;
    const top = (this.ys[firstRow] ?? START.y) - this.size.h / 2;
    this.paths.forEach((path, i) => {
      const zone = this.add
        .zone(path.x, (top + ZONE_BOTTOM) / 2, width, ZONE_BOTTOM - top)
        .setInteractive({ useHandCursor: true });
      zone.on("pointerdown", () => this.choose(i));
      // Máy tính: chỉ cửa ra nhô lên. Không làm sáng cả đường (như vậy là dò nét hộ người chơi).
      zone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
        if (!pointer.wasTouch && !this.locked) this.hover(path, true);
      });
      zone.on("pointerout", () => this.hover(path, false));
      layer.add(zone);
    });
  }

  private hover(path: PathView, on: boolean) {
    if (this.tweens.isTweening(path.exit)) return;
    path.exit.setScale(on ? HOVER_SCALE : 1).setY(on ? EXIT.y - HOVER_LIFT : EXIT.y);
  }

  /** Chữ Baloo 2 căn giữa theo tâm chữ số; quá `maxWidth` thì nhỏ lại cho vừa. */
  private label(text: string, size: number, color: number, maxWidth = Number.POSITIVE_INFINITY) {
    const make = (px: number) => {
      const t = this.add.text(0, 0, text, {
        fontFamily: FONT_FAMILY,
        fontStyle: FONT_WEIGHT,
        fontSize: px,
        color: cssColor(color),
      });
      t.setOrigin(0.5, 0);
      t.y = DIGIT_DROP * px - t.getTextMetrics().ascent;
      return t;
    };
    const t = make(size);
    if (t.width <= maxWidth) return t;
    const fitted = Math.floor((size * maxWidth) / t.width);
    t.destroy();
    return make(fitted);
  }

  /** Chạm một đường: gửi đáp án đúng một lần, rồi hiện đúng hoặc sai. */
  private choose(choice: number) {
    const puzzle = this.puzzle;
    const path = this.paths[choice];
    if (this.locked || !puzzle || !path) return;
    // Khoá ngay: chạm nhiều ngón cùng lúc vẫn chỉ gửi một đáp án.
    this.locked = true;
    for (const p of this.paths) this.hover(p, false);

    const index = this.index;
    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const correct = numberPath.check(puzzle, choice);
    this.bridge.submit(index, choice);
    this.index += 1;

    if (!this.reduced) {
      this.tweens.add({
        targets: path.exit,
        y: EXIT.y + SINK,
        duration: SINK_MS,
        yoyo: true,
        ease: "Quad.easeOut",
      });
    }

    if (correct) {
      this.complete(path);
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

  /** Dấu ✓ ở góc phải trên cửa của đường. */
  private check(path: PathView) {
    const ok = this.add.graphics({ x: path.x + OK_OFFSET.x, y: EXIT.y + OK_OFFSET.y });
    drawCheck(ok, this.ink);
    this.marks?.add(ok);
    if (!this.reduced) {
      ok.setScale(0.5);
      this.tweens.add({ targets: ok, scale: 1, duration: 160, ease: "Back.easeOut" });
    }
  }

  /** Đúng: chấm phấn chạy dọc đường đã chọn xuống cửa (không hiện số trung gian), ✓, thẻ đích loé. */
  private complete(path: PathView) {
    this.check(path);
    if (!this.reduced) {
      const dot = this.add.graphics();
      dot.fillStyle(this.ink.sticker, 1);
      dot.fillCircle(0, 0, 14);
      dot.fillStyle(this.ink.paper, 1);
      dot.fillCircle(0, 0, 10);
      const begin = path.line.at(START.r);
      dot.setPosition(begin.x, begin.y);
      // Chấm chạy dưới ô (lớp nét đôi) nên không che nhãn phép khi đi qua ô.
      this.fx?.add(dot);
      this.tweens.addCounter({
        from: START.r,
        to: path.line.length - EXIT.r,
        duration: RUN_MS,
        ease: "Sine.easeIn",
        onUpdate: (tween) => {
          const p = path.line.at(tween.getValue() ?? 0);
          dot.setPosition(p.x, p.y);
        },
      });
      if (this.targetFlash && this.targetCard) {
        this.tweens.add({
          targets: this.targetFlash,
          alpha: 1,
          duration: FLASH_MS,
          yoyo: true,
          ease: "Quad.easeOut",
        });
        this.tweens.add({
          targets: this.targetCard,
          scale: 1.05,
          duration: FLASH_MS,
          yoyo: true,
          ease: "Quad.easeOut",
        });
      }
    }
    this.time.delayedCall(NEXT_MS, () => this.showPuzzle());
  }

  /**
   * Sai → khoá (CR-006): cửa đã chạm rung, có ✗, ngay dưới là kết quả của đường đó trong vòng nét
   * đứt đỏ. Đường đúng tô nét đôi vàng chạy từ số xuất phát xuống cửa, kèm chip kết quả sau từng ô
   * (`traceNumberPath`), cửa đúng có ✓. Các đường khác (kể cả nét đường đã chọn) và ô không thuộc
   * đường đúng mờ đi. Mọi thứ nằm dưới y ≈ 230, ngoài dải huy hiệu khoá của khung.
   */
  private showMiss(puzzle: NumberPathPuzzle, choice: number) {
    const marks = this.marks;
    const fx = this.fx;
    const right = this.paths[puzzle.answer];
    const wrong = this.paths[choice];
    if (!marks || !fx || !right || !wrong) return;
    const ink = this.ink;

    // Ô và cửa mờ bằng một lớp màu bảng phủ lên (không hạ alpha), để nét bên dưới không lộ qua.
    this.paths.forEach((p, i) => {
      if (i === puzzle.answer) return;
      p.gfx.setAlpha(DIM_ALPHA);
      const veil = this.add.graphics();
      veil.fillStyle(ink.board, 1 - DIM_ALPHA);
      veil.fillCircle(0, DROP / 2, EXIT.r + DROP);
      p.exit.add(veil);
    });
    const { w, h } = this.size;
    for (const cell of this.cells) {
      if (cell.paths.includes(puzzle.answer)) continue;
      const veil = this.add.graphics();
      veil.fillStyle(ink.board, 1 - DIM_ALPHA);
      veil.fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + DROP + 6, CELL_RADIUS + 2);
      cell.node.add(veil);
    }

    // Cửa đã chạm: ✗ và kết quả của đường đó.
    const cross = this.add.graphics({ x: wrong.x, y: EXIT.y });
    drawCross(cross, ink);
    const resultGfx = this.add.graphics();
    drawResult(resultGfx, ink);
    const value = evaluateNumberPath(puzzle.start, puzzle.paths[choice] ?? []);
    const result = this.add.container(wrong.x, EXIT.y + RESULT.dy, [
      resultGfx,
      this.label(formatNumber(value), RESULT.font, ink.cardFg, RESULT.r * 2 - 10),
    ]);
    marks.add([cross, result]);
    if (!this.reduced) {
      this.tweens.add({
        targets: wrong.exit,
        x: wrong.x + 10,
        duration: SHAKE_MS / 4,
        yoyo: true,
        repeat: 1,
        ease: "Sine.easeInOut",
      });
    }

    // Đường đúng: chip kết quả sau từng ô, hiện khi nét đôi chạy qua ô đó.
    const trace = traceNumberPath(puzzle.start, puzzle.paths[puzzle.answer] ?? []);
    const chips = (puzzle.layout[puzzle.answer] ?? []).map((c, k) =>
      this.createChip(puzzle, c.col, k, trace[k] ?? 0),
    );
    marks.add(chips);

    const highlight = this.add.graphics();
    fx.add(highlight);
    const draw = (to: number) => {
      drawHighlight(highlight, right.line, to, ink);
      chips.forEach((chip, k) => {
        chip.setVisible(to >= (right.cellAt[k] ?? 0));
      });
    };
    if (this.reduced) {
      draw(right.line.length);
      this.check(right);
      return;
    }
    draw(START.r);
    this.tweens.addCounter({
      from: START.r,
      to: right.line.length,
      duration: HIGHLIGHT_MS,
      onUpdate: (tween) => draw(tween.getValue() ?? 0),
      onComplete: () => this.check(right),
    });
  }

  /**
   * Chip số trung gian sau ô hàng `row` của đường đúng: ở khe dưới ô, lệch sang phải (sang trái nếu
   * nét đi tiếp sang phải) để không đè lên nét và ô bên cạnh.
   */
  private createChip(puzzle: NumberPathPuzzle, col: number, row: number, value: number) {
    const x = this.xs[col] ?? CENTER_X;
    const y = this.ys[row] ?? START.y;
    const next = puzzle.layout[puzzle.answer]?.[row + 1];
    const nextX = next ? (this.xs[next.col] ?? x) : x;
    const nextTop = next ? (this.ys[next.row] ?? y) - this.size.h / 2 : EXIT.y - EXIT.r;
    const side = nextX > x ? -1 : 1;
    const text = this.label(formatNumber(value), CHIP.font, this.ink.accent);
    const w = Math.max(CHIP.minW, text.width + CHIP.padX * 2);
    const g = this.add.graphics();
    drawChip(g, w, this.ink);
    // Giữ chip trong mặt bảng (cột ngoài cùng của lưới 4 cột sát mép bảng).
    const margin = 8 + w / 2;
    const cx = Phaser.Math.Clamp(x + side * CHIP.dx, SLATE.x + margin, SLATE.x + SLATE.w - margin);
    return this.add.container(cx, (y + this.size.h / 2 + nextTop) / 2, [g, text]).setVisible(false);
  }
}
