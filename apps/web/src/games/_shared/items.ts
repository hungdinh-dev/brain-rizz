import type { BalanceItem } from "@brain-rizz/shared";

/**
 * Hình 8 vật của Cân não, dùng chung cho scene (vẽ ra canvas) và hình minh hoạ (SVG); Lật cặp và
 * Ai vừa biến mất dùng lại đúng bộ hình này.
 * Nguồn: bản mẫu BalanceLevels / BalanceStates (canvas Brain Rizz, trang Minigame).
 *
 * Đổi bộ vật (vd. sang khối gỗ khắc hình sau chơi thử): chỉ thay `FOOD` và `ITEM_ART`, giữ khoá
 * theo `BALANCE_ITEMS` của shared. Scene và hình minh hoạ không cần sửa.
 *
 * Toạ độ trong hộp vuông `ITEM_BOX` có tâm (0, 0); mọi vật cao khoảng 100 đơn vị (vẽ cùng cỡ,
 * không để lộ khối lượng ẩn). Màu nét viền do nơi vẽ quyết định (token `--sticker`).
 */

/** Cạnh hộp vẽ một vật (đơn vị hình). Vật ở cỡ 1 chiếm ~100 × 100. */
export const ITEM_BOX = 112;

/** Bảng màu riêng của bộ vật (theo bản mẫu), giống nhau ở nền sáng và tối. */
const FOOD = {
  red: "#e8504f",
  leaf: "#3bb273",
  shine: "#ffffff",
  pear: "#cbd94a",
  stalk: "#8a6a3a",
  banana: "#ffd84d",
  carrot: "#f28c38",
  cap: "#b8693a",
  cream: "#fff1d6",
  grape: "#8e5bd6",
  berry: "#ec4f6a",
  seed: "#ffe7a3",
  rind: "#e9fbd9",
  flesh: "#f2545b",
  pip: "#1f1b3a",
} as const;

/** Một nét của hình vật. `outline` là độ dày viền (không có = không viền). */
export type ArtPart =
  | { kind: "path"; d: string; fill?: string; outline?: number; opacity?: number }
  | { kind: "circle"; cx: number; cy: number; r: number; fill: string; outline?: number }
  | {
      kind: "ellipse";
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      /** Góc xoay (độ). */
      rotate?: number;
      fill: string;
      opacity?: number;
    };

const path = (d: string, fill?: string, outline?: number, opacity?: number): ArtPart => ({
  kind: "path",
  d,
  fill,
  outline,
  opacity,
});

const dots = (fill: string, r: number, points: [number, number][], outline?: number): ArtPart[] =>
  points.map(([cx, cy]) => ({ kind: "circle", cx, cy, r, fill, outline }));

const pips = (fill: string, points: [number, number, number, number][]): ArtPart[] =>
  points.map(([cx, cy, rx, ry]) => ({ kind: "ellipse", cx, cy, rx, ry, fill }));

/** Dáng nhận diện của từng vật (đặc tả balance.md, bảng Danh mục vật). */
export const ITEM_ART: Record<BalanceItem, readonly ArtPart[]> = {
  // Tròn, lõm ở đỉnh, cuống + một lá
  apple: [
    path(
      "M0 -22 C-10 -30 -32 -30 -38 -10 C-44 10 -30 42 -12 42 C-6 42 -3 39 0 39 C3 39 6 42 12 42 C30 42 44 10 38 -10 C32 -30 10 -30 0 -22 Z",
      FOOD.red,
      6,
    ),
    path("M0 -22 C0 -32 3 -40 8 -44", undefined, 6),
    path("M5 -33 C13 -45 27 -45 31 -39 C25 -31 13 -29 5 -33 Z", FOOD.leaf, 5),
    { kind: "ellipse", cx: -22, cy: -6, rx: 5, ry: 9, rotate: 20, fill: FOOD.shine, opacity: 0.55 },
  ],
  // Giọt nước bầu dưới, cuống dài
  pear: [
    path(
      "M0 -34 C-8 -34 -10 -24 -12 -14 C-14 -2 -32 6 -34 22 C-36 40 -18 48 0 48 C18 48 36 40 34 22 C32 6 14 -2 12 -14 C10 -24 8 -34 0 -34 Z",
      FOOD.pear,
      6,
    ),
    path("M0 -34 C0 -42 3 -47 8 -50", undefined, 6),
    { kind: "ellipse", cx: -17, cy: 22, rx: 5, ry: 9, rotate: 15, fill: FOOD.shine, opacity: 0.5 },
  ],
  // Lưỡi liềm, hai đầu thon
  banana: [
    path("M-27 -35 L-31 -47 L-19 -49 L-16 -36", FOOD.stalk, 5),
    path(
      "M-26 -36 C-46 -6 -34 32 4 42 C20 46 36 42 44 34 C46 30 42 26 38 28 C10 34 -14 18 -14 -34 Z",
      FOOD.banana,
      6,
    ),
    path("M-23 -16 C-25 8 -12 25 14 33", undefined, 3.5, 0.5),
  ],
  // Nón ngược có vạch ngang, chùm lá ở trên
  carrot: [
    path(
      "M-2 -26 C-10 -40 -20 -46 -26 -44 C-20 -36 -12 -30 -6 -26 Z M0 -27 C-2 -40 2 -50 8 -50 C10 -42 6 -32 3 -27 Z M3 -26 C12 -38 22 -42 28 -38 C22 -30 12 -26 6 -24 Z",
      FOOD.leaf,
      4.5,
    ),
    path("M-16 -22 C-10 -28 10 -28 16 -22 C14 0 6 24 0 46 C-6 24 -14 0 -16 -22 Z", FOOD.carrot, 6),
    path("M-10 -8 L-2 -8 M2 6 L9 6 M-6 20 L1 20", undefined, 4),
  ],
  // Mũ vòm có chấm, chân trụ
  mushroom: [
    path("M-15 4 C-18 22 -20 36 -15 44 C-8 49 8 49 15 44 C20 36 18 22 15 4 Z", FOOD.cream, 6),
    path("M-44 6 C-46 -26 -24 -44 0 -44 C24 -44 46 -26 44 6 C30 12 -30 12 -44 6 Z", FOOD.cap, 6),
    ...dots(FOOD.cream, 7, [
      [-22, -16],
      [24, -10],
    ]),
    { kind: "circle", cx: 4, cy: -30, r: 6, fill: FOOD.cream },
    { kind: "circle", cx: 0, cy: -6, r: 4.5, fill: FOOD.cream },
  ],
  // Chùm quả tròn xếp tam giác ngược, một lá
  grapes: [
    path("M0 -24 L2 -38", undefined, 5),
    path("M2 -34 C10 -46 24 -46 28 -40 C22 -32 10 -30 2 -34 Z", FOOD.leaf, 4.5),
    ...dots(
      FOOD.grape,
      9,
      [
        [-27, -14],
        [-9, -14],
        [9, -14],
        [27, -14],
        [-18, 2],
        [0, 2],
        [18, 2],
        [-9, 18],
        [9, 18],
        [0, 34],
      ],
      4.5,
    ),
  ],
  // Trái tim ngược, chấm hạt, vương miện lá
  strawberry: [
    path(
      "M0 46 C-24 34 -42 8 -40 -12 C-38 -26 -26 -32 -12 -30 C-6 -29 -2 -27 0 -26 C2 -27 6 -29 12 -30 C26 -32 38 -26 40 -12 C42 8 24 34 0 46 Z",
      FOOD.berry,
      6,
    ),
    ...pips(FOOD.seed, [
      [-20, -10, 3, 4.5],
      [0, -12, 3, 4.5],
      [20, -10, 3, 4.5],
      [-12, 8, 3, 4.5],
      [12, 8, 3, 4.5],
      [0, 26, 3, 4.5],
      [-27, 4, 2.6, 4],
      [27, 4, 2.6, 4],
    ]),
    path(
      "M-28 -28 L-18 -42 L-8 -32 L0 -48 L8 -32 L18 -42 L28 -28 C14 -20 -14 -20 -28 -28 Z",
      FOOD.leaf,
      4.5,
    ),
  ],
  // Múi hình quạt, viền vỏ dày, hạt chấm
  watermelon: [
    path("M0 -44 L-48 28 C-30 50 30 50 48 28 Z", FOOD.leaf, 6),
    path("M0 -33 L-38 23 C-24 39 24 39 38 23 Z", FOOD.rind),
    path("M0 -29 L-33 19 C-20 32 20 32 33 19 Z", FOOD.flesh),
    ...pips(FOOD.pip, [
      [0, -10, 3, 5],
      [-10, 7, 3, 5],
      [10, 7, 3, 5],
      [-19, 19, 3, 4.5],
      [0, 21, 3, 4.5],
      [19, 19, 3, 4.5],
    ]),
  ],
};

/** Khoá ổn định cho một nét (dùng làm `key` khi render SVG). */
export function partKey(part: ArtPart): string {
  return part.kind === "path" ? part.d : `${part.kind}:${part.cx},${part.cy}`;
}
