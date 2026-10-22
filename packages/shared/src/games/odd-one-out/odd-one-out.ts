import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Kẻ lạc đàn (nhóm Nhận diện): lưới hình giống nhau, chạm vào ô duy nhất khác biệt.
 * Độ khó tăng bằng lưới lớn hơn và khác biệt tinh tế hơn.
 */

export const SHAPES = ["circle", "square", "triangle", "diamond", "star", "hexagon"] as const;
export type Shape = (typeof SHAPES)[number];

/** Bảng màu mức Mầm/Thường (ô lạc khác hẳn màu). */
export const PALETTE = ["#E85D75", "#F2A541", "#3BB273", "#4D9DE0", "#7768AE", "#2D3047"] as const;

/**
 * Màu gốc mức Khó/Siêu khó, theo HSL: sắc độ `h`, độ bão hoà `s` và dải độ sáng [minL, maxL].
 * Dải độ sáng chọn sao cho mọi biến thể đều nổi trên nền khung game ở cả hai giao diện
 * (sáng `--muted` #f3eadf, tối `--muted` #3a3560): độ chói tương đối ~0,11–0,42, tức
 * tương phản ≥ ~1,8:1 với cả hai nền. Bỏ vàng vì dải hợp lệ quá hẹp (vàng tối thành ô liu).
 */
const SHADE_BASES = [
  { h: 350, s: 75, minL: 42, maxL: 74 }, // hồng
  { h: 25, s: 85, minL: 34, maxL: 63 }, // cam
  { h: 140, s: 55, minL: 28, maxL: 49 }, // xanh lá
  { h: 210, s: 70, minL: 39, maxL: 68 }, // xanh dương
  { h: 265, s: 55, minL: 52, maxL: 76 }, // tím
  { h: 300, s: 50, minL: 41, maxL: 71 }, // tím hồng
] as const;

/** Độ lệch độ sáng HSL (điểm %) của ô lạc so với ô gốc, theo độ khó (cả hai đầu). */
const SHADE_DELTA_HARD = [14, 18] as const;
const SHADE_DELTA_EXPERT = [7, 9] as const;

export interface Cell {
  shape: Shape;
  /** Mã hex `#RRGGBB`. */
  color: string;
  /** Góc xoay (độ). Hiện mọi ô luôn là 0; giữ trường để mở rộng sau. */
  rotation: number;
}

export interface OddOneOutPuzzle {
  cols: number;
  rows: number;
  cells: Cell[];
  oddIndex: number;
}

/** Đáp án = chỉ số ô người chơi chạm. */
export type OddOneOutAnswer = number;

const GRID_BY_DIFFICULTY: Record<Difficulty, number> = { 0: 3, 1: 4, 2: 5, 3: 6 };

/** HSL (h độ, s và l theo %) → `#RRGGBB`. Hàm thuần, tất định. */
function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase();
}

export const oddOneOut: MinigameDef<OddOneOutPuzzle, OddOneOutAnswer> = {
  id: "odd-one-out",
  category: "identify",
  durationMs: 45_000,
  // Bot (CR-016): ước lượng CHƯA ĐO (đặc tả › Cân bằng). Thường 1,3 s theo GDD, các mức khác tỉ lệ
  // với số ô của `GRID_BY_DIFFICULTY` so với lưới 4×4; Mầm theo trẻ 7 tuổi (× 2,6 người lớn); cộng
  // 0,2 s hiệu ứng chuyển câu; làm tròn tới 50 ms.
  expectedSolveMs: { 0: 2_100, 1: 1_500, 2: 2_250, 3: 3_150 },
  // Bot (CR-016): ước lượng chưa đo, 1 − tỉ lệ sai ở đặc tả › Cân bằng. Thường 96 % theo GDD
  // (Kiểm tra não); Mầm, Khó, Siêu khó theo các game Nhận diện khác (khác biệt chỉ còn ở độ sáng).
  expectedAccuracy: { 0: 0.9, 1: 0.96, 2: 0.9, 3: 0.85 },

  generate(roundSeed, index, difficulty) {
    const rng = createRng(deriveSeed(roundSeed, index));
    const size = GRID_BY_DIFFICULTY[difficulty];
    const count = size * size;
    const shape = rng.pick(SHAPES);

    let base: Cell;
    let odd: Cell;
    if (difficulty <= 1) {
      // Mầm/Thường: khác hình hoặc khác màu. Giữ đúng thứ tự gọi rng như cũ để câu đố
      // (và điểm chuẩn Kiểm tra não chơi ở mức Thường) không đổi.
      base = { shape, color: rng.pick(PALETTE), rotation: 0 };
      const mode = rng.pick(["shape", "color"] as const);
      odd =
        mode === "shape"
          ? { ...base, shape: rng.pick(SHAPES.filter((s) => s !== base.shape)) }
          : { ...base, color: rng.pick(PALETTE.filter((c) => c !== base.color)) };
    } else {
      // Khó/Siêu khó: cùng hình, cùng sắc độ, chỉ khác độ sáng (sáng hơn hoặc tối hơn).
      const tone = rng.pick(SHADE_BASES);
      const [minDelta, maxDelta] = difficulty === 2 ? SHADE_DELTA_HARD : SHADE_DELTA_EXPERT;
      const delta = rng.int(minDelta, maxDelta);
      const dir = rng.pick([-1, 1] as const);
      // Chọn độ sáng gốc sao cho cả ô gốc lẫn ô lạc nằm trong dải hợp lệ của màu.
      const baseL =
        dir > 0 ? rng.int(tone.minL, tone.maxL - delta) : rng.int(tone.minL + delta, tone.maxL);
      base = { shape, color: hslToHex(tone.h, tone.s, baseL), rotation: 0 };
      odd = { ...base, color: hslToHex(tone.h, tone.s, baseL + dir * delta) };
    }

    const oddIndex = rng.int(0, count - 1);
    const cells = Array.from({ length: count }, (_, i) => (i === oddIndex ? odd : { ...base }));

    return { cols: size, rows: size, cells, oddIndex };
  },

  check(puzzle, answer) {
    return answer === puzzle.oddIndex;
  },

  isAnswer(value): value is OddOneOutAnswer {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 64;
  },
};
