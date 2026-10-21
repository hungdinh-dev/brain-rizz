import type { BestBasketSnack } from "@brain-rizz/shared";

/*
 * Hình vẽ của Giỏ hời nhất, dùng chung cho scene Phaser (Graphics) và hình minh hoạ SVG ở màn
 * Hướng dẫn, để hai nơi vẽ cùng một món. File này chỉ có hình học và màu, KHÔNG import Phaser:
 * hình minh hoạ nằm trong bundle chính, còn scene thì tải lười.
 *
 * Mọi hình là đa giác tô (`fill`) hoặc nét mở đầu tròn (`line`); viền luôn là mực nhãn dán
 * (token `--sticker`), nơi vẽ tự lấy màu đó. Toạ độ của một món nằm trong ô 120 × 120 quanh tâm,
 * trục y hướng xuống.
 */

export type Pt = { x: number; y: number };

export type Shape =
  /** Đa giác khép kín; `outline` = độ dày viền mực (không có thì không viền). */
  | { kind: "fill"; pts: Pt[]; color: number; alpha?: number; outline?: number }
  /** Nét mở, đầu tròn; `outline` = độ dày viền mực mỗi bên. */
  | { kind: "line"; pts: Pt[]; color: number; width: number; outline?: number };

/**
 * Màu riêng của game, giữ nguyên ở cả giao diện sáng lẫn tối (như màu giấy tờ tiền ở Đếm tiền
 * nhanh): món nào cũng có viền mực nên nổi trên cả giỏ sáng lẫn giỏ tối. Các món khác nhau ở HÌNH,
 * màu chỉ là phụ.
 */
export const COLORS = {
  crust: 0xe2a052,
  crustDark: 0xa8662c,
  crustLight: 0xf6cf94,
  carton: 0xfdfcf8,
  cartonBlue: 0x8ec5ff,
  apple: 0xe8505f,
  stem: 0x7a4a2a,
  leaf: 0x3bb273,
  banana: 0xf7d154,
  bananaDark: 0xd39a26,
  bananaTip: 0x6b4528,
  candy: 0xf7a8b8,
  candySwirl: 0xd94f78,
  stick: 0xfdfcf8,
  cookie: 0xd9a066,
  chip: 0x5b3a22,
  glass: 0xe3f1ff,
  juice: 0xf59a2f,
  straw: 0xe85d75,
  corn: 0xf6c84c,
  cornDark: 0xc98e1f,
  husk: 0x3bb273,
  coin: 0xf2b632,
  coinDark: 0xb57d12,
  star: 0xffcd3c,
  bag: 0xd8b48a,
  bagDark: 0xa98055,
  tie: 0x7a4a2a,
  wicker: 0xc98b4f,
  wickerDark: 0x8f5a2c,
  wickerLight: 0xdda66b,
  rope: 0xffd166,
  white: 0xffffff,
} as const;

// ── Hình học ──────────────────────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Elip quanh (cx, cy), xoay `rot` độ. */
export function ellipse(cx: number, cy: number, rx: number, ry: number, rot = 0, n = 36): Pt[] {
  const c = Math.cos(rad(rot));
  const s = Math.sin(rad(rot));
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU;
    const x = rx * Math.cos(a);
    const y = ry * Math.sin(a);
    return { x: cx + x * c - y * s, y: cy + x * s + y * c };
  });
}

export const circle = (cx: number, cy: number, r: number, n = 32) => ellipse(cx, cy, r, r, 0, n);

/** Cung elip từ góc `from` tới `to` (độ, gồm cả hai đầu). */
function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number, n: number) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = rad(from + ((to - from) * i) / n);
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
}

/** Đường cong bậc ba từ `p0` (không gồm `p0`). */
export function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, steps = 10): Pt[] {
  return Array.from({ length: steps }, (_, s) => {
    const t = (s + 1) / steps;
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    };
  });
}

/** Viên thuốc (nét thẳng đầu tròn) từ `a` tới `b`, bán kính `r`. */
function capsule(a: Pt, b: Pt, r: number): Pt[] {
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const cap = (c: Pt, start: number) =>
    Array.from({ length: 9 }, (_, i) => {
      const t = start + (Math.PI * i) / 8;
      return { x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) };
    });
  return [...cap(b, angle - Math.PI / 2), ...cap(a, angle + Math.PI / 2)];
}

export function roundRect(x: number, y: number, w: number, h: number, r: number): Pt[] {
  const corners: Array<[number, number, number]> = [
    [x + w - r, y + r, -90],
    [x + w - r, y + h - r, 0],
    [x + r, y + h - r, 90],
    [x + r, y + r, 180],
  ];
  return corners.flatMap(([cx, cy, start]) => arc(cx, cy, r, r, start, start + 90, 6));
}

/** Ngôi sao 5 cánh quanh (cx, cy), cánh trên cùng hướng lên. */
export function starPoints(cx: number, cy: number, r: number, inner = 0.5): Pt[] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = rad(-90 + i * 36);
    const radius = i % 2 === 0 ? r : r * inner;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  });
}

function rotate(shapes: Shape[], deg: number): Shape[] {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  const turn = (p: Pt) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c });
  return shapes.map((shape) => ({ ...shape, pts: shape.pts.map(turn) }));
}

function shift(shapes: Shape[], dx: number, dy: number): Shape[] {
  return shapes.map((shape) => ({
    ...shape,
    pts: shape.pts.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  }));
}

const fill = (pts: Pt[], color: number, outline?: number, alpha?: number): Shape => ({
  kind: "fill",
  pts,
  color,
  outline,
  alpha,
});
const line = (pts: Pt[], color: number, width: number, outline?: number): Shape => ({
  kind: "line",
  pts,
  color,
  width,
  outline,
});
const rect = (x: number, y: number, w: number, h: number) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

// ── 8 món ăn vặt (bảng hình ở mục "Ghi chú cho FE" của đặc tả) ──────────────────────────────────

/** Bánh mì ổ dài nằm nghiêng, ba vạch chéo. */
function bun(): Shape[] {
  const cuts = [-22, 0, 22].map((cx) =>
    line(
      [
        { x: cx - 7, y: -13 },
        { x: cx + 7, y: 9 },
      ],
      COLORS.crustDark,
      6,
    ),
  );
  return rotate(
    [
      fill(capsule({ x: -36, y: 0 }, { x: 36, y: 0 }, 25), COLORS.crust, 5),
      fill(capsule({ x: -26, y: -12 }, { x: 22, y: -12 }, 5), COLORS.crustLight, undefined, 0.9),
      ...cuts,
    ],
    -16,
  );
}

/** Hộp sữa mái nhọn: thân trắng, mái và băng xanh. */
function milk(): Shape[] {
  return shift(
    [
      fill(rect(-30, -12, 60, 66), COLORS.carton, 5),
      fill(
        [
          { x: -30, y: -12 },
          { x: -19, y: -38 },
          { x: 19, y: -38 },
          { x: 30, y: -12 },
        ],
        COLORS.cartonBlue,
        5,
      ),
      fill(rect(-19, -49, 38, 11), COLORS.cartonBlue, 5),
      fill(rect(-27.5, 12, 55, 18), COLORS.cartonBlue),
      fill(circle(0, 21, 6, 20), COLORS.carton),
    ],
    0,
    -2,
  );
}

/** Táo tròn hai thuỳ, có cuống và lá. */
function apple(): Shape[] {
  const top = { x: 0, y: -26 };
  const right = { x: 46, y: 0 };
  const bottom = { x: 0, y: 46 };
  const left = { x: -46, y: 0 };
  const body = [
    top,
    ...cubic(top, { x: 16, y: -42 }, { x: 46, y: -38 }, right),
    ...cubic(right, { x: 46, y: 30 }, { x: 22, y: 54 }, bottom),
    ...cubic(bottom, { x: -22, y: 54 }, { x: -46, y: 30 }, left),
    ...cubic(left, { x: -46, y: -38 }, { x: -16, y: -42 }, top).slice(0, -1),
  ];
  return shift(
    [
      line(
        [
          { x: 0, y: -24 },
          { x: 5, y: -46 },
        ],
        COLORS.stem,
        7,
        2.5,
      ),
      fill(body, COLORS.apple, 5),
      fill(ellipse(-21, -4, 7, 12, 20, 20), COLORS.white, undefined, 0.45),
      fill(ellipse(19, -43, 15, 8, -30, 24), COLORS.leaf, 3.5),
    ],
    0,
    4,
  );
}

/** Quả chuối cong hình trăng khuyết, hai đầu nâu. */
function banana(): Shape[] {
  const outer = arc(0, -40, 56, 74, 18, 162, 24);
  const inner = arc(0, -46, 46, 58, 158, 22, 20);
  const ridge = arc(0, -43, 51, 66, 45, 135, 12);
  const leftEnd = outer[outer.length - 1]!;
  const rightEnd = outer[0]!;
  return shift(
    [
      line(
        [
          { x: rightEnd.x - 4, y: rightEnd.y - 2 },
          { x: rightEnd.x + 6, y: rightEnd.y - 14 },
        ],
        COLORS.bananaTip,
        8,
        2.5,
      ),
      fill([...outer, ...inner], COLORS.banana, 5),
      line(ridge, COLORS.bananaDark, 4),
      fill(circle(leftEnd.x + 4, leftEnd.y - 3, 6, 16), COLORS.bananaTip, 3),
    ],
    0,
    -2,
  );
}

/** Kẹo mút: đĩa kẹo hồng có xoắn ốc, que trắng. */
function candy(): Shape[] {
  const turns = 3.6 * Math.PI;
  const swirl = Array.from({ length: 49 }, (_, i) => {
    const t = (i / 48) * turns;
    const r = 3 + (31 * t) / turns;
    return { x: r * Math.cos(t), y: -12 + r * Math.sin(t) };
  });
  return [
    line(
      [
        { x: 0, y: 16 },
        { x: 0, y: 54 },
      ],
      COLORS.stick,
      10,
      3.5,
    ),
    fill(circle(0, -12, 40, 40), COLORS.candy, 5),
    line(swirl, COLORS.candySwirl, 7),
    fill(ellipse(-17, -31, 6, 10, 30, 16), COLORS.white, undefined, 0.5),
  ];
}

/** Bánh quy tròn có chấm sô-cô-la, một vết cắn ở góc phải trên. */
function cookie(): Shape[] {
  const biteAt = rad(-40);
  const biteWidth = 0.45;
  const edge = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * TAU - Math.PI;
    let delta = Math.abs(a - biteAt);
    delta = Math.min(delta, TAU - delta);
    const dent = delta < biteWidth ? 13 * (1 - (delta / biteWidth) ** 2) : 0;
    const r = 47 - dent;
    return { x: r * Math.cos(a), y: 2 + r * Math.sin(a) };
  });
  const chips: Array<[number, number, number]> = [
    [-20, -14, 6.5],
    [6, -26, 5.5],
    [-28, 14, 6],
    [2, 4, 7],
    [24, 18, 5.5],
    [-6, 31, 5.5],
    [22, -6, 5],
  ];
  return [
    fill(edge, COLORS.cookie, 5),
    ...chips.map(([x, y, r]) => fill(circle(x, y, r, 14), COLORS.chip)),
  ];
}

/** Ly nước cam có ống hút. */
function juice(): Shape[] {
  const half = (y: number) => 32 - (7 * (y + 30)) / 86;
  const juiceTop = -10;
  const juiceBottom = 53;
  return shift(
    [
      fill(
        [
          { x: -32, y: -30 },
          { x: 32, y: -30 },
          { x: 25, y: 56 },
          { x: -25, y: 56 },
        ],
        COLORS.glass,
        5,
      ),
      fill(
        [
          { x: -half(juiceTop) + 2.5, y: juiceTop },
          { x: half(juiceTop) - 2.5, y: juiceTop },
          { x: half(juiceBottom) - 2.5, y: juiceBottom },
          { x: -half(juiceBottom) + 2.5, y: juiceBottom },
        ],
        COLORS.juice,
      ),
      line(
        [
          { x: 4, y: 12 },
          { x: 13, y: -50 },
          { x: 32, y: -58 },
        ],
        COLORS.straw,
        8,
        2.5,
      ),
      fill(rect(-22, -24, 6, 30), COLORS.white, undefined, 0.6),
    ],
    0,
    2,
  );
}

/** Bắp có lưới hạt, hai lá bao ở dưới. */
function corn(): Shape[] {
  const cy = -10;
  const rx = 25;
  const ry = 46;
  const halfAt = (y: number) => rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2));
  const rows = [-40, -28, -16, -4, 8, 20].map((y) =>
    line(
      [
        { x: -halfAt(y) + 5, y },
        { x: halfAt(y) - 5, y },
      ],
      COLORS.cornDark,
      3,
    ),
  );
  const cols = [-0.48, 0, 0.48].map((c) =>
    line(
      Array.from({ length: 9 }, (_, i) => {
        const y = cy - ry + 8 + (i * (2 * ry - 16)) / 8;
        return { x: c * halfAt(y), y };
      }),
      COLORS.cornDark,
      3,
    ),
  );
  const huskLeft = [
    { x: 2, y: 56 },
    ...cubic({ x: 2, y: 56 }, { x: -24, y: 46 }, { x: -36, y: 18 }, { x: -30, y: -4 }),
    ...cubic({ x: -30, y: -4 }, { x: -16, y: 14 }, { x: -6, y: 38 }, { x: 2, y: 56 }).slice(0, -1),
  ];
  const huskRight = [
    { x: -2, y: 56 },
    ...cubic({ x: -2, y: 56 }, { x: 24, y: 46 }, { x: 38, y: 22 }, { x: 33, y: 2 }),
    ...cubic({ x: 33, y: 2 }, { x: 16, y: 18 }, { x: 6, y: 38 }, { x: -2, y: 56 }).slice(0, -1),
  ];
  return rotate(
    [
      fill(ellipse(0, cy, rx, ry, 0, 36), COLORS.corn, 5),
      ...rows,
      ...cols,
      fill(huskLeft, COLORS.husk, 4),
      fill(huskRight, COLORS.husk, 4),
    ],
    12,
  );
}

const SNACK_ART: Record<BestBasketSnack, () => Shape[]> = {
  bun,
  milk,
  apple,
  banana,
  candy,
  cookie,
  juice,
  corn,
};

const snackCache = new Map<BestBasketSnack, Shape[]>();

/** Hình một món (ô 120 × 120 quanh tâm). Tính một lần rồi giữ lại. */
export function snackArt(kind: BestBasketSnack): Shape[] {
  let shapes = snackCache.get(kind);
  if (!shapes) {
    shapes = SNACK_ART[kind]();
    snackCache.set(kind, shapes);
  }
  return shapes;
}

// ── Biểu tượng ────────────────────────────────────────────────────────────────────────────────

/** Đồng xu bán kính `r` quanh (0, 0): vành trong và khe dọc. */
export function coinArt(r: number): Shape[] {
  const ring = circle(0, 0, r * 0.62, 24);
  return [
    fill(circle(0, 0, r, 28), COLORS.coin, Math.max(2.5, r * 0.15)),
    line([...ring, ring[0]!], COLORS.coinDark, r * 0.11),
    line(
      [
        { x: 0, y: -r * 0.3 },
        { x: 0, y: r * 0.3 },
      ],
      COLORS.coinDark,
      r * 0.15,
    ),
  ];
}

/** Ngôi sao bán kính `r` quanh (0, 0). */
export function starArt(r: number): Shape[] {
  return [fill(starPoints(0, 0, r), COLORS.star, Math.max(2.5, r * 0.13))];
}

/** Túi vải buộc dây có đồng xu ở mặt trước (ô 120 × 120 quanh tâm). */
export function bagArt(): Shape[] {
  const neckL = { x: -15, y: -28 };
  const neckR = { x: 15, y: -28 };
  const body = [
    neckL,
    ...cubic(neckL, { x: -42, y: -14 }, { x: -54, y: 12 }, { x: -48, y: 34 }),
    ...cubic({ x: -48, y: 34 }, { x: -40, y: 58 }, { x: 40, y: 58 }, { x: 48, y: 34 }),
    ...cubic({ x: 48, y: 34 }, { x: 54, y: 12 }, { x: 42, y: -14 }, neckR),
  ];
  const ruffle = [
    { x: -15, y: -28 },
    { x: -28, y: -50 },
    { x: -10, y: -42 },
    { x: 0, y: -54 },
    { x: 10, y: -42 },
    { x: 28, y: -50 },
    { x: 15, y: -28 },
  ];
  const coin = shift(coinArt(18), 0, 18);
  return [
    fill(ruffle, COLORS.bag, 5),
    fill(body, COLORS.bag, 5),
    line(arc(0, 6, 34, 30, 200, 250, 6), COLORS.bagDark, 4),
    line(
      [
        { x: -19, y: -29 },
        { x: 19, y: -29 },
      ],
      COLORS.tie,
      8,
      2.5,
    ),
    ...coin,
  ];
}

// ── Giỏ, khay và bố cục bên trong (px thiết kế, quanh tâm giỏ) ───────────────────────────────────

/** Giỏ ở Thường trở lên: 328 × 488, 2 món đặt cạnh nhau, thẻ giá rồi thẻ sao dưới mỗi món. */
export const CELL = {
  w: 328,
  h: 488,
  r: 30,
  items: [
    { x: -70, y: -112 },
    { x: 70, y: -112 },
  ],
  itemScale: 1,
  priceY: 54,
  starY: 112,
  tag: { w: 116, h: 50, icon: 16, font: 38 },
  /** Dải dòng tổng lúc hiện đáp án (đặc tả: y +380 … +470 tính từ đỉnh giỏ). */
  band: { x: -152, y: 146, w: 304, h: 86 },
  row1Y: 170,
  row2Y: 210,
  rowSoloY: 189,
} as const;

/** Khay ở Mầm: 672 × 320, món to bên trái, thẻ giá to và hàng sao bên phải. */
export const TRAY = {
  w: 672,
  h: 320,
  r: 30,
  item: { x: -176, y: -18 },
  itemScale: 1.6,
  price: { x: 56, y: -88, w: 184, h: 88, icon: 28, font: 64 },
  stars: { x: -10, y: 4, r: 26, step: 62 },
  band: { x: -40, y: 52, w: 356, h: 82 },
  rowY: 93,
} as const;

/** Quai giỏ, thân giỏ đan (vẽ trước các món). */
export function basketBackArt(): Shape[] {
  const handle = [
    { x: -112, y: -60 },
    ...cubic(
      { x: -112, y: -60 },
      { x: -112, y: -232 },
      { x: 112, y: -232 },
      { x: 112, y: -60 },
      20,
    ),
  ];
  const top = -58;
  const bottom = 18;
  const body = [
    { x: -138, y: top },
    { x: 138, y: top },
    { x: 118, y: 8 },
    ...cubic({ x: 118, y: 8 }, { x: 115, y: 15 }, { x: 110, y: bottom }, { x: 102, y: bottom }, 4),
    { x: -102, y: bottom },
    ...cubic(
      { x: -102, y: bottom },
      { x: -110, y: bottom },
      { x: -115, y: 15 },
      { x: -118, y: 8 },
      4,
    ),
  ];
  const half = (y: number) => 138 - (20 * (y - top)) / 66;
  const bands = [top, -32, -6, bottom];
  const weave: Shape[] = [];
  for (const y of [-32, -6]) {
    weave.push(
      line(
        [
          { x: -half(y) + 5, y },
          { x: half(y) - 5, y },
        ],
        COLORS.wickerDark,
        3.5,
      ),
    );
  }
  for (let b = 0; b < 3; b++) {
    const y0 = bands[b]! + 6;
    const y1 = bands[b + 1]! - 6;
    const limit = half(y1) - 12;
    for (let x = (b % 2) * 14 - 112; x <= limit; x += 28) {
      if (x < -limit) continue;
      weave.push(
        line(
          [
            { x, y: y0 },
            { x, y: y1 },
          ],
          COLORS.wickerDark,
          3.5,
        ),
      );
    }
  }
  return [line(handle, COLORS.wicker, 14, 4.5), fill(body, COLORS.wicker, 5), ...weave];
}

/** Vành giỏ (vẽ sau các món, che phần đáy món như món nằm trong giỏ). */
export function basketRimArt(): Shape[] {
  const hatches: Shape[] = [];
  for (let x = -134; x <= 126; x += 16) {
    hatches.push(
      line(
        [
          { x, y: -63 },
          { x: x + 8, y: -49 },
        ],
        COLORS.wickerDark,
        3,
      ),
    );
  }
  return [fill(roundRect(-146, -68, 292, 24, 12), COLORS.wickerLight, 5), ...hatches];
}

/** Khay đan dưới món ở Mầm. */
export function trayArt(): Shape[] {
  const { x, y } = TRAY.item;
  return [
    fill(ellipse(x, y + 98, 132, 30, 0, 40), COLORS.wicker, 5),
    fill(ellipse(x, y + 93, 110, 19, 0, 36), COLORS.wickerLight),
  ];
}

/** Dây nối hai món đi kèm (đoạn võng nhẹ từ `a` tới `b`). */
export function ropeArt(a: Pt, b: Pt, sag: number, width = 6): Shape[] {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + sag };
  const pts = [
    a,
    ...cubic(
      a,
      { x: a.x + (mid.x - a.x) * 0.5, y: mid.y },
      { x: b.x - (b.x - mid.x) * 0.5, y: mid.y },
      b,
      12,
    ),
  ];
  const knot = width * 0.9;
  return [
    line(pts, COLORS.rope, width, width * 0.4),
    fill(circle(a.x, a.y, knot, 14), COLORS.rope, width * 0.4),
    fill(circle(b.x, b.y, knot, 14), COLORS.rope, width * 0.4),
  ];
}
