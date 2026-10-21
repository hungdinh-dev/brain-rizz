import type { WhoVanishedItem } from "@brain-rizz/shared";
import { type ArtPart, ITEM_ART as BALANCE_ART } from "../_shared/items";

/**
 * Hình 16 món của Ai vừa biến mất, dùng chung cho scene (vẽ ra canvas) và hình minh hoạ (SVG).
 * - 8 món đầu dùng lại đúng hình của Cân não (_shared/items.ts), như đặc tả yêu cầu.
 * - cherry, pineapple, lemon, pumpkin, apple-bitten lấy từ bản mẫu M10 (WhoVanishedStates, "Bộ vật").
 * - corn, banana-peeled, watermelon-whole chưa có trong bản mẫu: frontend-dev vẽ theo cùng kiểu
 *   (hộp 112, cao ~100, viền mực 6), chờ ui-designer duyệt.
 *
 * Toạ độ trong hộp vuông `ITEM_BOX` có tâm (0, 0). Màu nét viền do nơi vẽ quyết định (token
 * `--sticker`); màu thân vật giống nhau ở nền sáng và tối.
 */

/** Cạnh hộp vẽ một vật (đơn vị hình). */
export const ITEM_BOX = 112;

/**
 * Một nét của hình vật: các kiểu của Cân não, thêm `stroke` là nét có màu riêng (không theo màu
 * viền), vd. vết cắn kem của táo cắn dở, sọc của quả dưa hấu.
 */
export type ItemPart =
  | ArtPart
  | { kind: "stroke"; d: string; color: string; width: number; opacity?: number };

/** Bảng màu riêng của các món mới (theo bản mẫu M10). */
const FOOD = {
  leaf: "#3bb273",
  shine: "#ffffff",
  stalk: "#8a6a3a",
  cream: "#fff1d6",
  cherry: "#c22d4a",
  pineapple: "#f6b93b",
  lemon: "#ffe14d",
  pumpkin: "#f39a3c",
  greenApple: "#8fd14f",
  banana: "#ffd84d",
  bananaInside: "#f6c443",
  corn: "#ffd84d",
  melonStripe: "#1d7a48",
} as const;

const path = (d: string, fill?: string, outline?: number, opacity?: number): ItemPart => ({
  kind: "path",
  d,
  fill,
  outline,
  opacity,
});

const shine = (cx: number, cy: number, rx: number, ry: number, rotate = 0): ItemPart => ({
  kind: "ellipse",
  cx,
  cy,
  rx,
  ry,
  rotate,
  fill: FOOD.shine,
  opacity: 0.55,
});

/** Dáng nhận diện của từng món. Cặp cùng loại khác nhau ở dáng: vết cắn, vỏ xoè, tròn / tam giác. */
export const ITEM_ART: Record<WhoVanishedItem, readonly ItemPart[]> = {
  apple: BALANCE_ART.apple,
  pear: BALANCE_ART.pear,
  banana: BALANCE_ART.banana,
  carrot: BALANCE_ART.carrot,
  mushroom: BALANCE_ART.mushroom,
  grapes: BALANCE_ART.grapes,
  strawberry: BALANCE_ART.strawberry,
  watermelon: BALANCE_ART.watermelon,
  // Hai quả tròn chung một cuống chữ V, một lá
  cherry: [
    path("M-18 6 C-14 -14 -4 -32 8 -42 M21 10 C19 -10 14 -28 8 -42", undefined, 5),
    path("M8 -42 C16 -52 32 -52 38 -44 C30 -36 16 -36 8 -42 Z", FOOD.leaf, 4.5),
    { kind: "circle", cx: -19, cy: 24, r: 19, fill: FOOD.cherry, outline: 6 },
    { kind: "circle", cx: 21, cy: 28, r: 19, fill: FOOD.cherry, outline: 6 },
    shine(-26, 17, 4, 6, 25),
    shine(14, 21, 4, 6, 25),
  ],
  // Thân bầu dục có vân chéo, vương miện lá nhọn
  pineapple: [
    path("M-16 -18 L-24 -40 L-8 -30 L0 -52 L8 -30 L24 -40 L16 -18 Z", FOOD.leaf, 4.5),
    path("M-28 12 A28 34 0 1 0 28 12 A28 34 0 1 0 -28 12 Z", FOOD.pineapple, 6),
    path(
      "M-18 -8 L18 28 M-26 8 L4 38 M-6 -20 L24 10 M18 -8 L-18 28 M26 8 L-4 38 M6 -20 L-24 10",
      undefined,
      3,
      0.5,
    ),
  ],
  // Bầu dục nằm ngang, hai đầu nhọn, một lá
  lemon: [
    path("M4 -30 C8 -44 22 -50 30 -46 C26 -36 16 -30 4 -30 Z", FOOD.leaf, 4.5),
    path(
      "M-46 2 C-42 -4 -38 -10 -34 -15 C-25 -27 -12 -31 0 -31 C14 -31 28 -25 35 -14 C38 -9 42 -4 46 -2 C42 4 38 9 35 14 C28 25 14 31 0 31 C-12 31 -25 27 -34 17 C-38 12 -42 7 -46 2 Z",
      FOOD.lemon,
      6,
    ),
    shine(-14, -14, 12, 5, -12),
  ],
  // Quả dẹt có múi dọc, cuống gỗ, một lá
  pumpkin: [
    path("M-6 -24 L-6 -38 C-6 -44 2 -46 6 -42 L6 -24 Z", FOOD.stalk, 4.5),
    path("M4 -38 C12 -48 26 -48 30 -40 C24 -33 12 -33 4 -38 Z", FOOD.leaf, 4.5),
    path(
      "M0 -24 C-12 -30 -30 -28 -40 -16 C-50 -4 -50 24 -38 36 C-28 46 -12 44 0 40 C12 44 28 46 38 36 C50 24 50 -4 40 -16 C30 -28 12 -30 0 -24 Z",
      FOOD.pumpkin,
      6,
    ),
    path("M-15 -25 C-29 -9 -29 25 -15 41 M15 -25 C29 -9 29 25 15 41", undefined, 4, 0.5),
    { kind: "ellipse", cx: -30, cy: 4, rx: 4, ry: 9, fill: FOOD.shine, opacity: 0.45 },
  ],
  // Táo xanh, mép phải có vết cắn lõm ba nấc, lõi kem lộ ra
  "apple-bitten": [
    path(
      "M0 -22 C-10 -30 -32 -30 -38 -10 C-44 10 -30 42 -12 42 C-6 42 -3 39 0 39 C3 39 6 42 12 42 C22 42 31 36 36 24 A9 9 0 0 1 30 11 A9 9 0 0 1 32 -2 A8 8 0 0 1 38 -11 C32 -30 10 -30 0 -22 Z",
      FOOD.greenApple,
      6,
    ),
    {
      kind: "stroke",
      d: "M30 21 A9 9 0 0 1 24 11 A9 9 0 0 1 26 -1 A8 8 0 0 1 31 -8",
      color: FOOD.cream,
      width: 5,
    },
    path("M0 -22 C0 -32 3 -40 8 -44", undefined, 6),
    path("M5 -33 C13 -45 27 -45 31 -39 C25 -31 13 -29 5 -33 Z", FOOD.leaf, 5),
    shine(-22, -6, 5, 9, 20),
  ],
  // Bắp dựng đứng, lưới hạt, hai bẹ lá ôm hai bên chân
  corn: [
    path(
      "M0 -46 C14 -46 20 -30 20 -6 C20 18 14 34 0 34 C-14 34 -20 18 -20 -6 C-20 -30 -14 -46 0 -46 Z",
      FOOD.corn,
      6,
    ),
    path(
      "M-12 -32 L12 -32 M-17 -18 L17 -18 M-19 -4 L19 -4 M-18 10 L18 10 M-7 -42 C-10 -20 -10 8 -7 28 M7 -42 C10 -20 10 8 7 28",
      undefined,
      3,
      0.45,
    ),
    path("M-2 48 C-28 42 -38 16 -32 -14 C-24 4 -14 22 2 30 Z", FOOD.leaf, 5),
    path("M2 48 C28 42 38 16 32 -14 C24 4 14 22 -2 30 Z", FOOD.leaf, 5),
  ],
  // Chuối dựng đứng, ruột kem lộ trên đỉnh, vỏ xoè ba cánh rủ xuống
  "banana-peeled": [
    path("M-12 -8 C-12 -32 -6 -46 0 -46 C6 -46 12 -32 12 -8 Z", FOOD.cream, 6),
    path("M-16 -8 C-18 14 -14 34 -8 46 L8 46 C14 34 18 14 16 -8 Z", FOOD.banana, 6),
    path("M-5 46 L-5 52 L5 52 L5 46", FOOD.stalk, 4.5),
    path("M-16 -8 C-30 -10 -42 0 -44 18 C-36 10 -26 8 -14 10 Z", FOOD.banana, 5),
    path("M16 -8 C30 -10 42 0 44 18 C36 10 26 8 14 10 Z", FOOD.banana, 5),
    path("M-11 -8 C-9 6 -4 18 0 26 C4 18 9 6 11 -8 Z", FOOD.bananaInside, 4.5),
  ],
  // Quả tròn nguyên, sọc dọc đậm, cuống xoăn
  "watermelon-whole": [
    path("M-46 4 A46 40 0 1 0 46 4 A46 40 0 1 0 -46 4 Z", FOOD.leaf, 6),
    {
      kind: "stroke",
      d: "M-26 -26 C-33 -8 -33 16 -26 34 M0 -33 C-5 -12 -5 20 0 41 M26 -26 C33 -8 33 16 26 34",
      color: FOOD.melonStripe,
      width: 7,
    },
    // Viền vẽ lại trên sọc để đầu sọc nằm gọn dưới viền (bắt đầu từ phía kia để khoá SVG khác nét nền).
    path("M46 4 A46 40 0 1 1 -46 4 A46 40 0 1 1 46 4 Z", undefined, 6),
    path("M0 -36 C0 -42 4 -46 9 -46", undefined, 5),
    shine(-28, -12, 5, 10, 35),
  ],
};

/** Khoá ổn định cho một nét (dùng làm `key` khi render SVG). */
export function partKey(part: ItemPart): string {
  return part.kind === "path" || part.kind === "stroke"
    ? part.d
    : `${part.kind}:${part.cx},${part.cy}`;
}
