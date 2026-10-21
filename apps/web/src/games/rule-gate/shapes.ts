import type { RuleGateItem, RuleGateSpecies } from "@brain-rizz/shared";

/*
 * Hình của Cổng luật, dùng chung cho scene (vẽ ra canvas 2D) và hình minh hoạ SVG (màn Hướng dẫn).
 * Chỉ là chuỗi path và con số, không phụ thuộc Phaser hay React.
 *
 * Bạn vẽ theo hệ toạ độ 200×200 của bộ nhân vật app (`components/characters/specs.tsx`): cùng thân
 * tròn; tai nhọn tam giác + mảng lông mõm theo Cam (mèo), tai dài theo Mochi (thỏ), tai tròn + quầng
 * mắt theo Tròn (gấu trúc). Ba loài khác nhau ở HÌNH tai (và quầng mắt), không chỉ ở màu lông.
 * Màu lông, màu mực lấy đúng mã của bộ nhân vật đó (không thêm màu giao diện mới).
 */

/** Mực viền nhân vật (cùng mã `INK` của bộ nhân vật). */
export const INK = "#1f1b3a";
/** Viền trắng kiểu nhãn dán quanh bạn (như `.sticker-outline` của nhân vật app). */
export const STICKER_HALO = "#ffffff";

export const BODY =
  "M100 34 C144 34 168 62 168 100 C168 128 162 150 150 166 C142 178 124 184 100 184 C76 184 58 178 50 166 C38 150 32 128 32 100 C32 62 56 34 100 34 Z";

/** Điểm neo của bạn khi đặt lên khung (giữa thân). */
export const BUDDY_ANCHOR = { x: 100, y: 110 } as const;

export interface SpeciesLook {
  fill: string;
  /** Bàn chân, bàn tay. */
  limb: string;
  /** Tai (vẽ sau thân). */
  ears: string;
  earFill: string;
  /** Lòng tai. */
  earInner?: string;
  earInnerFill?: string;
  /** Mảng lông vẽ đè lên thân (mõm trắng của mèo, quầng mắt gấu trúc). */
  patch?: string;
  patchFill?: string;
  /** Ria (chỉ mèo). */
  whiskers?: string;
  eyeX: readonly [number, number];
  eyeY: number;
  /** Mắt hạt đậu (mực) hay mắt trắng trên quầng (gấu trúc). */
  eyes: "bead" | "panda";
  nose: string;
  noseFill: string;
  mouth: string;
  blush: string;
  blushX: readonly [number, number];
  blushY: number;
  /** Đuôi tròn phía sau (thỏ). */
  tail?: string;
}

export const SPECIES: Readonly<Record<RuleGateSpecies, SpeciesLook>> = {
  cat: {
    fill: "#f08a3c",
    limb: "#5a3a2e",
    ears: "M48 72 L54 22 L92 46 Z M152 72 L146 22 L108 46 Z",
    earFill: "#f08a3c",
    earInner: "M57 60 L60 34 L82 47 Z M143 60 L140 34 L118 47 Z",
    earInnerFill: "#fff1e0",
    patch:
      "M36 108 C58 112 82 112 100 126 C118 112 142 112 164 108 C162 148 134 166 100 166 C66 166 38 148 36 108 Z",
    patchFill: "#fffaf3",
    whiskers: "M76 121 L56 117 M76 127 L56 128 M124 121 L144 117 M124 127 L144 128",
    eyeX: [78, 122],
    eyeY: 100,
    eyes: "bead",
    nose: "M94 122 C94 118 106 118 106 122 C106 125 103 127 100 127 C97 127 94 125 94 122 Z",
    noseFill: INK,
    mouth: "M91 131 C93 136 98 136 100 132 C102 136 107 136 109 131",
    blush: "#f7a8b8",
    blushX: [62, 138],
    blushY: 124,
  },
  bunny: {
    fill: "#fdfaf6",
    limb: "#fdfaf6",
    ears: "M70 52 C58 30 56 8 68 4 C80 0 86 24 86 48 Z M130 52 C142 30 144 8 132 4 C120 0 114 24 114 48 Z",
    earFill: "#fdfaf6",
    earInner:
      "M72 44 C65 30 64 14 69 10 C75 9 79 26 79 44 Z M128 44 C135 30 136 14 131 10 C125 9 121 26 121 44 Z",
    earInnerFill: "#f7a8b8",
    eyeX: [78, 122],
    eyeY: 104,
    eyes: "bead",
    nose: "M96 114 L104 114 L100 119 Z",
    noseFill: "#f27d93",
    mouth: "M91 123 C93 128 98 128 100 124 C102 128 107 128 109 123",
    blush: "#f7a8b8",
    blushX: [62, 138],
    blushY: 122,
    tail: "M148 166 A12 12 0 1 0 172 166 A12 12 0 1 0 148 166 Z",
  },
  panda: {
    fill: "#fdfdfd",
    limb: "#2e2a3a",
    ears: "M41 48 A17 17 0 1 0 75 48 A17 17 0 1 0 41 48 Z M125 48 A17 17 0 1 0 159 48 A17 17 0 1 0 125 48 Z",
    earFill: "#2e2a3a",
    patch:
      "M62.76 111.04 A15 11.5 -28 1 0 89.24 96.96 A15 11.5 -28 1 0 62.76 111.04 Z M110.76 96.96 A15 11.5 28 1 0 137.24 111.04 A15 11.5 28 1 0 110.76 96.96 Z",
    patchFill: "#2e2a3a",
    eyeX: [78, 122],
    eyeY: 103,
    eyes: "panda",
    nose: "M94 117 C94 113 106 113 106 117 C106 121 102 123 100 123 C98 123 94 121 94 117 Z",
    noseFill: INK,
    mouth: "M91 128 C93 133 98 133 100 129 C102 133 107 133 109 128",
    blush: "#f7a8b8",
    blushX: [58, 142],
    blushY: 128,
  },
};

/** Hai bàn chân dưới thân. */
export const FEET =
  "M56 184 A16 8 0 1 0 88 184 A16 8 0 1 0 56 184 Z M112 184 A16 8 0 1 0 144 184 A16 8 0 1 0 112 184 Z";

// ─── Phụ kiện (cùng hình trên người bạn và trên vé) ─────────────────────────────────────────────

/** Mũ lưỡi trai: chóp mũ trên đỉnh đầu, lưỡi trai chìa sang phải. Không che hết tai. */
export const HAT = {
  crown: "M62 54 C62 14 138 14 138 54 Z",
  brim: "M118 50 C146 44 172 48 182 58 C170 64 140 62 116 58 Z",
  seam: "M100 20 L100 54",
  button: { cx: 100, cy: 19, r: 5 },
  /** Màu xanh dương nhóm Phân tích (`--color-analyze`). */
  fill: "#4d9de0",
} as const;

/** Kính tròn hai mắt, tâm ở (0, 0) giữa hai mắt (đặt theo `eyeY` của loài). */
export const GLASSES = {
  lensX: [-22, 22] as const,
  r: 17,
  bridge: "M-5 -2 C-2 -6 2 -6 5 -2",
  temples: "M-39 -2 L-60 -6 M39 -2 L60 -6",
} as const;

/** Đồ cầm trước bụng, hai tay ôm hai bên. */
export const BOOK = {
  x: 74,
  y: 132,
  w: 52,
  h: 40,
  spine: 11,
  /** Bìa xanh lá, nhãn kem (mã có sẵn trong bộ nhân vật). */
  fill: "#3bb273",
  label: "#fffaf3",
} as const;

export const BALL = {
  cx: 100,
  cy: 152,
  r: 24,
  /** Bóng cam có sọc mực (hình tròn có sọc, khác hẳn sách hình chữ nhật). */
  fill: "#f2a541",
  stripes:
    "M100 128 L100 176 M76 152 L124 152 M84 134 C94 146 94 158 84 170 M116 134 C106 146 106 158 116 170",
} as const;

/** Vị trí hai bàn tay theo đồ cầm. */
export const PAWS: Readonly<Record<RuleGateItem, readonly [number, number][]>> = {
  none: [
    [88, 166],
    [112, 166],
  ],
  book: [
    [76, 160],
    [124, 160],
  ],
  ball: [
    [78, 162],
    [122, 162],
  ],
};

/** Vòng khoanh trên người bạn lúc hiện đáp án (tâm, bán kính ngang, dọc; hệ toạ độ bạn). */
export const FEATURE_RING: Readonly<
  Record<"species" | "hat" | "glasses" | "item", { cx: number; cy: number; rx: number; ry: number }>
> = {
  species: { cx: 100, cy: 40, rx: 82, ry: 44 },
  hat: { cx: 112, cy: 38, rx: 78, ry: 32 },
  glasses: { cx: 100, cy: 102, rx: 66, ry: 28 },
  item: { cx: 100, cy: 154, rx: 42, ry: 34 },
};

// ─── Biểu tượng giao diện (hệ toạ độ riêng, tâm (0, 0)) ──────────────────────────────────────────

/** Cổng lớp nhỏ (~100 đơn vị): hai cột, xà ngang, biển quyển vở, cánh cổng mở. */
export const GATE_ICON =
  "M-34 44 L-34 -22 M34 44 L34 -22 M-46 -22 L46 -22 M-14 -22 L-14 -40 L14 -40 L14 -22 M-8 -34 L8 -34 M-34 -14 L-12 -6 L-12 48 L-34 44";
/** Ngôi nhà nhỏ (~100 đơn vị): mái, tường, cửa. */
export const HOUSE_ICON =
  "M-44 -2 L0 -40 L44 -2 M-32 -12 L-32 44 L32 44 L32 -12 M-10 44 L-10 16 L10 16 L10 44";
/** Mũi tên chỉ TRÁI (xoay 180° thành chỉ phải). */
export const ARROW_LEFT = "M28 0 L-28 0 M-10 -18 L-28 0 L-10 18";
/** Dấu ✓. */
export const TICK = "M-12 1 L-3 10 L13 -9";
/** Dấu ✗. */
export const CROSS = "M-30 -30 L30 30 M30 -30 L-30 30";
/** Dấu "?" phấn trên vé úp. */
export const QUESTION = "M-22 -28 C-22 -58 24 -58 24 -30 C24 -10 0 -10 0 12";
/** Dấu "+" (VÀ: chung một vé) và "/" (HOẶC: hai vé riêng). */
export const PLUS = "M-18 0 L18 0 M0 -18 L0 18";
export const SLASH = "M14 -30 L-14 30";
