import type { ShadowItem, ShadowPart } from "@brain-rizz/shared";

/*
 * Hình 8 đồ vật của Bóng của ai, dùng chung cho scene (vẽ ra canvas bằng Path2D) và hình minh hoạ
 * (SVG). Đặc tả: docs/04-minigames/shadow-match.md (mục Bộ vật, Ghi chú cho FE).
 *
 * - Đường nét lấy từ bản mẫu M14 (ShadowMatchItems). Phần bộ sinh có mà bản mẫu chưa vẽ (vd. ria
 *   mèo, vây hậu môn, dây buộc ô, đèn bàn đối xứng) do frontend-dev vẽ theo cùng kiểu, chờ
 *   ui-designer duyệt.
 * - Toạ độ trong khung vuông `FRAME` tâm (0, 0), đơn vị khung (thẻ đề vẽ scale 2).
 * - Mỗi khoá phần hình `"<tên>@<phía>"` có MỘT hình vẽ ở phía `side`; phía còn lại là ảnh gương
 *   chính xác qua trục dọc x = 0 (điều kiện để "lật gương = đổi phía" đúng). Phần `@C` tự đối xứng.
 * - Màu thân vật giống nhau ở nền sáng và tối; màu viền (mực) do nơi vẽ quyết định.
 */

/** Cạnh khung vẽ một vật (đơn vị khung): đủ chỗ để xoay 90° không tràn thẻ. */
export const FRAME = 200;

/** Một nét của phần hình: mảng tô (viền mực 6) hoặc nét mảnh (vd. ria mèo). */
export type ArtShape =
  | { kind: "fill"; d: string; fill: string }
  | { kind: "line"; d: string; width: number };

export interface PartArt {
  /** Phía của hình vẽ dưới đây; khoá phía kia vẽ bằng ảnh gương qua x = 0. */
  side: "L" | "R" | "C";
  /** Thứ tự vẽ khi tô màu (nhỏ vẽ trước). Bóng đen không phụ thuộc thứ tự. */
  z: number;
  shapes: readonly ArtShape[];
  /** Vòng khoanh khi phần này thiếu/thừa so với hình gốc: [tâm x, tâm y, bán kính], ở phía `side`. */
  ring: readonly [cx: number, cy: number, r: number];
}

/** Nét trang trí chỉ có ở đồ vật có màu (mắt, sọc, vệt sáng); `ink` = màu mực của nơi vẽ. */
export type DecorShape =
  | { kind: "fill"; d: string; fill: string | "ink" }
  | { kind: "line"; d: string; color: string | "ink"; width: number; opacity?: number };

export interface ItemArt {
  /** Dời cả vật để hộp bao nằm giữa khung (đặt NGOÀI phép gương của từng phần). */
  offset: readonly [x: number, y: number];
  parts: Readonly<Record<string, PartArt>>;
  decor: readonly DecorShape[];
}

// ---------------------------------------------------------------- tiện ích

const fill = (d: string, color: string): ArtShape => ({ kind: "fill", d, fill: color });
const line = (d: string, width: number): ArtShape => ({ kind: "line", d, width });
const part = (
  side: PartArt["side"],
  z: number,
  ring: PartArt["ring"],
  ...shapes: ArtShape[]
): PartArt => ({ side, z, ring, shapes });
const dot = (d: string, color: string | "ink"): DecorShape => ({ kind: "fill", d, fill: color });
const stroke = (d: string, color: string | "ink", width: number, opacity?: number): DecorShape => ({
  kind: "line",
  d,
  color,
  width,
  opacity,
});

/** Đường tròn dạng path SVG. */
function circle(cx: number, cy: number, r: number) {
  return `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
}

/** Elip dạng path SVG (không xoay). */
function ellipse(cx: number, cy: number, rx: number, ry: number) {
  return `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
}

const CREAM = "#fff8ef";
const WHITE = "#ffffff";

// ---------------------------------------------------------------- 8 đồ vật

/** Ấm trà xanh: bản mẫu vẽ vòi bên trái nên hình vòi/quai đặt ở phía ngược với hình gốc. */
const TEAPOT: ItemArt = {
  offset: [0, 4],
  parts: {
    body: part(
      "C",
      3,
      [0, 6, 40],
      fill(
        "M-50 6 C-50 -26 -26 -34 0 -34 C26 -34 50 -26 50 6 C50 34 28 44 0 44 C-28 44 -50 34 -50 6 Z",
        "#4d9de0",
      ),
    ),
    lid: part("C", 4, [0, -38, 22], fill("M-30 -30 C-28 -46 28 -46 30 -30 Z", "#8cc8f2")),
    "lid-tall": part(
      "C",
      4,
      [0, -44, 24],
      fill("M-30 -30 C-30 -54 -18 -58 0 -58 C18 -58 30 -54 30 -30 Z", "#8cc8f2"),
    ),
    knob: part(
      "C",
      5,
      [0, -53, 16],
      fill("M-11 -50 C-11 -62 11 -62 11 -50 C11 -43 -11 -43 -11 -50 Z", "#ffd166"),
    ),
    foot: part("C", 2, [0, 48, 20], fill("M-26 40 L26 40 L22 54 L-22 54 Z", "#2f6fb0")),
    spout: part(
      "L",
      1,
      [-62, -18, 26],
      fill(
        "M-46 2 C-58 -2 -66 -16 -76 -34 C-79 -40 -71 -44 -68 -38 C-60 -24 -54 -18 -44 -16 Z",
        "#4d9de0",
      ),
    ),
    "spout-short": part(
      "L",
      1,
      [-58, -10, 18],
      fill(
        "M-46 2 C-54 0 -58 -6 -62 -14 C-64 -20 -56 -23 -54 -18 C-51 -12 -48 -12 -44 -14 Z",
        "#4d9de0",
      ),
    ),
    handle: part(
      "R",
      1,
      [62, 6, 26],
      fill(
        "M44 -18 C70 -24 80 6 64 24 C58 30 50 32 44 30 L46 20 C52 20 58 16 60 8 C62 -6 54 -10 46 -6 Z",
        "#4d9de0",
      ),
    ),
  },
  decor: [
    stroke("M-46 -4 C-20 6 20 6 46 -4", CREAM, 5),
    dot(`${circle(-22, 20, 5)} ${circle(0, 26, 5)} ${circle(22, 20, 5)}`, CREAM),
  ],
};

/** Cá cam quay đầu sang phải. */
const FISH: ItemArt = {
  offset: [15, 3],
  parts: {
    body: part(
      "R",
      4,
      [0, 0, 40],
      fill("M-44 0 C-30 -30 16 -36 48 -4 C50 -2 50 2 48 4 C16 36 -30 30 -44 0 Z", "#f28c38"),
    ),
    tail: part("L", 1, [-62, 0, 30], fill("M-40 0 L-76 -32 L-64 0 L-76 32 Z", "#ffd166")),
    "tail-round": part(
      "L",
      1,
      [-62, 0, 30],
      fill("M-40 0 C-56 -32 -82 -30 -80 0 C-82 30 -56 32 -40 0 Z", "#ffd166"),
    ),
    "fin-top": part("R", 1, [2, -38, 20], fill("M-18 -24 C-12 -50 14 -52 22 -26 Z", "#ffd166")),
    "fin-top-small": part("R", 1, [3, -32, 14], fill("M-4 -26 C-2 -38 6 -38 10 -27 Z", "#ffd166")),
    "fin-belly": part("R", 1, [6, 33, 15], fill("M-6 22 L2 44 L18 22 Z", "#ffd166")),
    "fin-anal": part("R", 1, [-30, 26, 15], fill("M-34 14 L-40 36 L-20 18 Z", "#ffd166")),
  },
  decor: [
    stroke("M-10 -22 C-16 -8 -16 8 -10 22 M-26 -14 C-30 -5 -30 5 -26 14", "#ffd166", 5),
    stroke("M18 -18 C11 -7 11 7 18 18", "ink", 4),
    dot(circle(32, -6, 6), "ink"),
    dot(circle(30, -8, 2), WHITE),
  ],
};

/** Mèo cam ngồi nhìn thẳng, đuôi cong bên phải. */
const CAT: ItemArt = {
  offset: [-9, 11],
  parts: {
    body: part(
      "C",
      2,
      [0, 20, 40],
      fill("M-30 52 C-42 24 -34 -4 -16 -14 L16 -14 C34 -4 42 24 30 52 Z", "#f08a3c"),
    ),
    head: part(
      "C",
      5,
      [0, -35, 28],
      fill(
        "M-26 -34 C-26 -50 -14 -60 0 -60 C14 -60 26 -50 26 -34 C26 -20 14 -10 0 -10 C-14 -10 -26 -20 -26 -34 Z",
        "#f08a3c",
      ),
    ),
    ear: part("L", 4, [-16, -62, 15], fill("M-24 -44 L-24 -74 L-6 -58 Z", "#f08a3c")),
    tail: part(
      "R",
      1,
      [52, 22, 26],
      fill("M26 46 C54 48 66 22 58 4 C55 -4 46 -2 49 6 C55 20 48 36 28 36 Z", "#f08a3c"),
    ),
    "tail-short": part(
      "R",
      1,
      [42, 36, 16],
      fill("M26 46 C42 48 50 38 50 28 C50 22 42 22 42 28 C42 34 36 38 28 36 Z", "#f08a3c"),
    ),
    whiskers: part(
      "C",
      6,
      [0, -28, 50],
      line("M-16 -29 L-46 -35 M-16 -24 L-46 -21 M16 -29 L46 -35 M16 -24 L46 -21", 4),
    ),
    bell: part(
      "C",
      3,
      [0, 0, 44],
      // Vòng cổ rộng hơn thân để thấy được trên bóng, chuông treo giữa.
      fill("M-38 -8 L38 -8 C43 -8 43 0 38 0 L-38 0 C-43 0 -43 -8 -38 -8 Z", "#e8546b"),
      fill(circle(0, 8, 8), "#ffd166"),
    ),
  },
  decor: [
    dot("M-14 49 C-18 24 -10 8 0 6 C10 8 18 24 14 49 Z", "#fff1e0"),
    dot("M-19 -52 L-19 -64 L-11 -58 Z M19 -52 L19 -64 L11 -58 Z", "#f7a8b8"),
    dot(`${ellipse(-10, -36, 4, 5.5)} ${ellipse(10, -36, 4, 5.5)}`, "ink"),
    dot("M-4 -26 L4 -26 L0 -21 Z", "#f27d93"),
    stroke("M-6 -56 L-4 -49 M6 -56 L4 -49 M52 28 L60 26 M56 14 L63 16", "ink", 3.5),
  ],
};

/** Xương rồng trong chậu: nhánh cao trái, nhánh thấp phải. */
const CACTUS: ItemArt = {
  offset: [0, 1],
  parts: {
    stem: part(
      "C",
      3,
      [0, -10, 30],
      fill("M-14 34 L-14 -44 C-14 -62 14 -62 14 -44 L14 34 Z", "#3bb273"),
    ),
    "arm-high": part(
      "L",
      1,
      [-36, -24, 24],
      fill(
        "M-14 -2 L-28 -2 C-38 -2 -42 -8 -42 -16 L-42 -36 C-42 -46 -30 -46 -30 -36 L-30 -14 L-14 -14 Z",
        "#3bb273",
      ),
    ),
    "arm-high-short": part(
      "L",
      1,
      [-36, -24, 24],
      fill(
        "M-14 -2 L-28 -2 C-38 -2 -42 -8 -42 -16 C-42 -24 -30 -24 -30 -16 L-30 -14 L-14 -14 Z",
        "#3bb273",
      ),
    ),
    "arm-low": part(
      "R",
      1,
      [34, -4, 22],
      fill("M14 14 L30 14 C38 14 42 8 42 0 L42 -14 C42 -24 30 -24 30 -14 L30 2 L14 2 Z", "#3bb273"),
    ),
    flower: part("C", 4, [0, -64, 15], fill(circle(0, -62, 9), "#f7a8b8")),
    bud: part(
      "R",
      2,
      [26, -29, 15],
      fill("M12 -36 L22 -36 A8 8 0 1 1 22 -22 L12 -22 Z", "#3bb273"),
    ),
    pot: part(
      "C",
      5,
      [0, 54, 34],
      fill("M-34 30 L34 30 L34 42 L28 42 L22 68 L-22 68 L-28 42 L-34 42 Z", "#c8693a"),
    ),
    "pot-straight": part(
      "C",
      5,
      [0, 54, 34],
      fill("M-34 30 L34 30 L34 42 L28 42 L28 68 L-28 68 L-28 42 L-34 42 Z", "#c8693a"),
    ),
  },
  decor: [
    stroke(
      "M-6 -40 L-2 -36 M6 -22 L2 -18 M-6 -4 L-2 0 M6 14 L2 18 M-37 -30 L-34 -27 M37 -8 L34 -5",
      CREAM,
      3,
    ),
    stroke("M-24 54 L24 54", "#f2a541", 5),
  ],
};

/** Ô tím: cán móc sang phải, dây buộc thõng bên trái. */
const UMBRELLA: ItemArt = {
  offset: [0, 8],
  parts: {
    canopy: part(
      "C",
      3,
      [0, -12, 44],
      fill(
        "M-76 -4 C-72 -44 -40 -62 0 -62 C40 -62 72 -44 76 -4 Q57 -40 38 -4 Q19 -40 0 -4 Q-19 -40 -38 -4 Q-57 -40 -76 -4 Z",
        "#7768ae",
      ),
    ),
    "canopy-flat": part(
      "C",
      3,
      [0, -12, 44],
      fill("M-76 -4 C-72 -44 -40 -62 0 -62 C40 -62 72 -44 76 -4 Z", "#7768ae"),
    ),
    tip: part(
      "C",
      4,
      [0, -70, 14],
      fill("M-5 -58 L-3 -78 C-3 -83 3 -83 3 -78 L5 -58 Z", "#ffd166"),
    ),
    shaft: part("C", 1, [0, 14, 30], fill("M-4 -16 L4 -16 L4 44 L-4 44 Z", "#c8693a")),
    hook: part(
      "R",
      1,
      [16, 56, 22],
      fill(
        "M-4 40 L-4 52 C-4 72 32 72 32 52 L32 46 C32 40 22 40 22 46 L22 52 C22 61 4 61 4 52 L4 40 Z",
        "#c8693a",
      ),
    ),
    "hook-small": part(
      "R",
      1,
      [10, 52, 16],
      fill(
        "M-4 40 L-4 48 C-4 60 16 60 16 48 L16 46 C16 41 10 41 10 46 L10 48 C10 52 4 52 4 48 L4 40 Z",
        "#c8693a",
      ),
    ),
    strap: part(
      "L",
      2,
      [-16, 22, 20],
      fill("M-4 4 L-14 8 L-26 34 L-18 38 L-8 16 L-4 14 Z", "#f7a8b8"),
    ),
  },
  decor: [
    stroke("M0 -58 L0 -8 M-6 -58 C-24 -46 -34 -28 -38 -8 M6 -58 C24 -46 34 -28 38 -8", "ink", 4),
    stroke("M-30 -44 C-22 -52 -14 -55 -6 -56", WHITE, 5, 0.55),
  ],
};

/** Gà vàng quay đầu sang phải, đuôi bên trái. */
const CHICKEN: ItemArt = {
  offset: [2, 1],
  parts: {
    body: part(
      "R",
      3,
      [0, -10, 44],
      fill("M-44 -6 C-44 -34 -10 -40 18 -30 C40 -22 46 4 38 22 C28 42 -30 44 -44 18 Z", "#ffd166"),
      fill(circle(34, -40, 18), "#ffd166"),
    ),
    comb: part(
      "R",
      2,
      [36, -62, 15],
      fill(
        "M22 -54 C19 -68 31 -71 32 -60 C32 -74 44 -74 43 -59 C45 -70 56 -65 49 -51 Z",
        "#e8546b",
      ),
    ),
    beak: part("R", 2, [60, -38, 13], fill("M49 -46 L70 -38 L49 -30 Z", "#f28c38")),
    "beak-open": part(
      "R",
      2,
      [62, -38, 17],
      fill("M49 -46 L72 -54 L58 -38 L72 -24 L49 -30 Z", "#f28c38"),
    ),
    wattle: part("R", 2, [46, -18, 13], fill("M44 -30 C56 -14 38 -6 38 -26 Z", "#e8546b")),
    tail: part(
      "L",
      1,
      [-52, -38, 28],
      fill("M-40 -6 L-74 -40 L-58 -40 L-68 -62 L-50 -52 L-46 -70 L-28 -32 Z", "#c8693a"),
    ),
    "wing-up": part(
      "R",
      2,
      [-10, -52, 22],
      fill("M-24 -28 C-30 -58 -10 -72 6 -62 C0 -52 -2 -40 0 -30 Z", "#ffd166"),
    ),
    legs: part(
      "R",
      0,
      [-5, 54, 22],
      fill(
        "M-15 34 L-8 34 L-8 60 L5 62 L5 69 L-15 69 Z M8 34 L15 34 L15 60 L28 62 L28 69 L8 69 Z",
        "#f28c38",
      ),
    ),
    "leg-one": part(
      "R",
      0,
      [-5, 54, 22],
      fill("M8 34 L15 34 L15 60 L28 62 L28 69 L8 69 Z", "#f28c38"),
    ),
  },
  decor: [
    stroke("M-22 -2 C-10 14 10 16 20 4", "ink", 4.5),
    dot(circle(40, -43, 5), "ink"),
    dot(circle(38.5, -44.5, 1.8), WHITE),
  ],
};

/** Giày thể thao đỏ, mũi giày sang phải. */
const SHOE: ItemArt = {
  offset: [4, -3],
  parts: {
    upper: part(
      "R",
      2,
      [-44, -40, 30],
      fill("M-32 -18 C-32 -36 -22 -44 -11 -42 C-2 -40 -2 -28 -6 -12 Z", "#ffd166"),
      fill(
        "M-70 36 L-70 -10 C-70 -22 -60 -26 -50 -24 L-20 -18 C-4 -14 10 2 30 8 C56 14 76 18 76 36 Z",
        "#e8546b",
      ),
    ),
    "upper-high": part(
      "R",
      2,
      [-44, -40, 30],
      fill(
        "M-70 36 L-70 -56 C-70 -63 -65 -66 -58 -66 L-26 -66 C-21 -66 -18 -62 -18 -56 L-16 -6 C-2 0 12 4 30 8 C56 14 76 18 76 36 Z",
        "#e8546b",
      ),
    ),
    sole: part(
      "R",
      4,
      [-50, 60, 22],
      fill("M-74 34 L74 34 C82 34 82 50 74 50 L-70 50 C-78 50 -78 34 -74 34 Z", CREAM),
    ),
    "sole-heel": part(
      "R",
      4,
      [-50, 60, 22],
      fill(
        "M-74 34 L74 34 C82 34 82 50 74 50 L-30 50 L-34 72 L-70 72 L-70 50 C-78 50 -78 34 -74 34 Z",
        CREAM,
      ),
    ),
    "heel-tab": part(
      "L",
      1,
      [-78, -18, 14],
      fill("M-70 -6 L-84 -14 C-89 -19 -84 -28 -77 -25 L-66 -20 Z", "#ffd166"),
    ),
    laces: part(
      "R",
      5,
      [14, -14, 20],
      fill("M12 -2 C2 -34 -12 -24 8 2 Z M12 -2 C24 -34 38 -22 16 2 Z", CREAM),
    ),
    "laces-long": part(
      "R",
      5,
      [16, -20, 28],
      fill("M12 -2 C2 -34 -12 -24 8 2 Z M12 -2 C24 -34 38 -22 16 2 Z", CREAM),
      fill("M10 0 L-2 -42 L5 -44 L15 -2 Z M16 0 L38 -38 L44 -34 L20 2 Z", CREAM),
    ),
    cleats: part(
      "R",
      3,
      [0, 58, 40],
      fill(
        "M-62 48 L-56 62 L-48 48 Z M-30 48 L-24 62 L-16 48 Z M6 48 L12 62 L20 48 Z M40 48 L46 62 L54 48 Z",
        CREAM,
      ),
    ),
  },
  decor: [
    stroke("M-50 22 C-30 6 -6 8 14 24", CREAM, 6),
    stroke("M-22 -10 L-14 -2 M-12 -6 L-4 2", CREAM, 5),
  ],
};

/**
 * Đèn bàn xanh: đế đối xứng tâm x = 0 (khác bản mẫu, để phần `@C` đúng là tự đối xứng), cần gập và
 * chụp hướng sang phải, nút và dây điện bên trái.
 */
const LAMP: ItemArt = {
  offset: [-15, 4],
  parts: {
    base: part(
      "C",
      3,
      [0, 50, 42],
      fill("M-40 54 C-40 42 -24 38 0 38 C24 38 40 42 40 54 L40 60 L-40 60 Z", "#3bb273"),
    ),
    "base-tall": part("C", 3, [0, 40, 42], fill("M-34 18 L34 18 L34 60 L-34 60 Z", "#3bb273")),
    arm: part(
      "R",
      1,
      [30, -14, 40],
      fill("M-6 42 L24 -16 L36 -10 L6 46 Z", "#3bb273"),
      fill("M24 -18 L56 -58 L66 -50 L36 -8 Z", "#3bb273"),
    ),
    "arm-straight": part(
      "C",
      1,
      [0, -24, 46],
      fill("M-5 40 L-5 -58 L-52 -58 L-52 -66 L52 -66 L52 -58 L5 -58 Z", "#3bb273"),
    ),
    joint: part("R", 5, [30, -13, 19], fill(circle(30, -13, 14), "#ffd166")),
    shade: part(
      "R",
      4,
      [75, -40, 30],
      fill("M50 -60 C56 -73 74 -71 78 -58 L102 -18 L48 -18 Z", "#3bb273"),
    ),
    bulb: part("R", 3, [75, -12, 15], fill("M64 -18 A11 11 0 0 0 86 -18 Z", "#ffd166")),
    switch: part("L", 2, [-24, 32, 14], fill("M-30 42 L-30 24 L-18 24 L-18 42 Z", "#ffd166")),
    cord: part(
      "L",
      0,
      [-56, 56, 18],
      fill("M-38 54 C-52 54 -58 64 -72 64 L-72 58 C-62 58 -56 48 -38 48 Z", "#7768ae"),
    ),
  },
  decor: [
    stroke("M58 -58 C62 -64 68 -65 72 -62", WHITE, 5, 0.55),
    stroke("M-30 50 L30 50", CREAM, 4, 0.7),
  ],
};

export const ITEM_ART: Readonly<Record<ShadowItem, ItemArt>> = {
  teapot: TEAPOT,
  fish: FISH,
  cat: CAT,
  cactus: CACTUS,
  umbrella: UMBRELLA,
  chicken: CHICKEN,
  shoe: SHOE,
  lamp: LAMP,
};

// ---------------------------------------------------------------- tra cứu phần hình

export interface PlacedPart {
  art: PartArt;
  /** Vẽ ảnh gương qua x = 0 (khoá ở phía ngược với hình vẽ). */
  mirror: boolean;
}

/** Hình vẽ của một khoá phần hình; lỗi nếu bộ vật trong shared có khoá chưa được vẽ. */
export function placePart(item: ShadowItem, key: ShadowPart): PlacedPart {
  const at = key.lastIndexOf("@");
  const name = key.slice(0, at);
  const side = key.slice(at + 1);
  const art = ITEM_ART[item].parts[name];
  if (!art) throw new Error(`shadow-match: chưa vẽ phần ${item}/${key}`);
  return { art, mirror: art.side !== "C" && side !== art.side };
}

/** Các phần đã sắp theo thứ tự vẽ. */
export function placeParts(item: ShadowItem, keys: readonly ShadowPart[]): PlacedPart[] {
  return keys.map((key) => placePart(item, key)).sort((a, b) => a.art.z - b.art.z);
}

/**
 * Vòng bao các chi tiết khác nhau (toạ độ khung, đã cộng `offset`), hoặc null khi không có.
 * Nhiều chi tiết (vd. thiếu đuôi chẻ + thừa đuôi tròn) gộp thành một vòng bao ngoài.
 */
export function diffRing(
  item: ShadowItem,
  keys: readonly ShadowPart[],
): readonly [cx: number, cy: number, r: number] | null {
  if (keys.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const key of keys) {
    const { art, mirror } = placePart(item, key);
    const [x, y, r] = art.ring;
    const cx = mirror ? -x : x;
    minX = Math.min(minX, cx - r);
    maxX = Math.max(maxX, cx + r);
    minY = Math.min(minY, y - r);
    maxY = Math.max(maxY, y + r);
  }
  const [ox, oy] = ITEM_ART[item].offset;
  return [(minX + maxX) / 2 + ox, (minY + maxY) / 2 + oy, Math.max(maxX - minX, maxY - minY) / 2];
}
