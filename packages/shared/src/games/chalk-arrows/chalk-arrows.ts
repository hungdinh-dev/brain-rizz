import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Phấn trượt (nhóm Phân tích): một nhóm mũi tên phấn cùng màu, cùng hướng chỉ, cùng hướng trượt.
 * Phấn trắng → vuốt theo hướng mũi tên CHỈ; phấn vàng → vuốt theo hướng mũi tên TRƯỢT.
 * Siêu khó có thêm mũi tên bị tẩy mờ (nhiễu, luật không xét).
 * Đặc tả: docs/04-minigames/chalk-arrows.md.
 */

/** Hướng: 0 lên, 1 phải, 2 xuống, 3 trái (theo chiều kim đồng hồ). */
export type ChalkDir = 0 | 1 | 2 | 3;

export type ChalkColor = "white" | "yellow";

/** Khung bảng (đơn vị logic): gốc góc trên trái, lưới 5 × 6 ô 200 × 200, nối vòng ở mép. */
export const CHALK_FIELD = { width: 1000, height: 1200, cols: 5, rows: 6, cell: 200 } as const;

/** Mũi tên dài 120 × rộng 64 đơn vị (để FE vẽ cùng tỉ lệ với khoảng cách tối thiểu 140). */
export const CHALK_ARROW_SIZE = { length: 120, width: 64 } as const;

/** Lệch tối đa của tâm mũi tên so với tâm ô, mỗi trục. */
export const CHALK_JITTER = 30;

export interface ChalkPoint {
  x: number;
  y: number;
}

export interface ChalkSmudge extends ChalkPoint {
  point: ChalkDir;
  slide: ChalkDir;
}

export interface ChalkArrowsPuzzle {
  /** Màu phấn của mọi mũi tên rõ trong câu. */
  color: ChalkColor;
  /** Hướng mũi tên chỉ (mọi mũi tên rõ). */
  point: ChalkDir;
  /** Hướng trượt (mọi mũi tên rõ). */
  slide: ChalkDir;
  /** Tốc độ trượt, đơn vị khung/giây. */
  speed: number;
  /** Vị trí tâm lúc câu hiện của các mũi tên rõ. */
  arrows: ChalkPoint[];
  /** Mũi tên bị tẩy mờ (nhiễu), mỗi cái một hướng riêng. Rỗng trừ Siêu khó. */
  smudges: ChalkSmudge[];
  /** Bảng màu "gần nhau" (Siêu khó). */
  subtle: boolean;
  /** Đáp án: `color === "white" ? point : slide`. */
  answer: ChalkDir;
}

/** Đáp án = hướng vuốt (0 lên, 1 phải, 2 xuống, 3 trái). */
export type ChalkArrowsAnswer = number;

export interface ChalkArrowsLevel {
  arrows: number;
  smudges: number;
  speed: number;
  /** Có phấn vàng không (Mầm chỉ phấn trắng). */
  twoColors: boolean;
  /** % đổi màu giữa hai câu liền nhau. */
  switchPct: number;
  /** % câu có hướng trượt trùng hướng chỉ. */
  samePct: number;
  /** % câu vuông góc (phần còn lại là ngược hướng). */
  perpPct: number;
  subtle: boolean;
}

export const CHALK_ARROWS_LEVELS: Readonly<Record<Difficulty, ChalkArrowsLevel>> = {
  0: {
    arrows: 5,
    smudges: 0,
    speed: 100,
    twoColors: false,
    switchPct: 0,
    samePct: 60,
    perpPct: 40,
    subtle: false,
  },
  1: {
    arrows: 7,
    smudges: 0,
    speed: 160,
    twoColors: true,
    switchPct: 30,
    samePct: 50,
    perpPct: 30,
    subtle: false,
  },
  2: {
    arrows: 10,
    smudges: 0,
    speed: 200,
    twoColors: true,
    switchPct: 60,
    samePct: 10,
    perpPct: 30,
    subtle: false,
  },
  3: {
    arrows: 10,
    smudges: 3,
    speed: 320,
    twoColors: true,
    switchPct: 60,
    samePct: 10,
    perpPct: 40,
    subtle: true,
  },
};

/** Muối cho chuỗi đổi màu: tách khỏi `rng` của từng câu. */
const COLOR_SALT = 0xc4a1;

/** Tâm 30 ô lưới, theo hàng. */
const CELL_CENTERS: readonly ChalkPoint[] = Array.from(
  { length: CHALK_FIELD.cols * CHALK_FIELD.rows },
  (_, i) => ({
    x: (i % CHALK_FIELD.cols) * CHALK_FIELD.cell + CHALK_FIELD.cell / 2,
    y: Math.floor(i / CHALK_FIELD.cols) * CHALK_FIELD.cell + CHALK_FIELD.cell / 2,
  }),
);

const toDir = (d: number): ChalkDir => (((d % 4) + 4) % 4) as ChalkDir;

/**
 * Màu phấn của câu `index`. Màu câu 0 bốc 50/50; mỗi câu sau đổi màu so với câu trước với xác suất
 * `switchPct`, mỗi bước một `createRng` riêng (không phụ thuộc `rng` của câu). O(index).
 */
export function chalkArrowsColor(
  roundSeed: number,
  index: number,
  difficulty: Difficulty,
): ChalkColor {
  const { twoColors, switchPct } = CHALK_ARROWS_LEVELS[difficulty];
  if (!twoColors) return "white";
  let yellow = createRng(deriveSeed(roundSeed, 0, COLOR_SALT)).int(0, 1) === 1;
  for (let j = 1; j <= index; j++) {
    if (createRng(deriveSeed(roundSeed, j, COLOR_SALT)).int(0, 99) < switchPct) yellow = !yellow;
  }
  return yellow ? "yellow" : "white";
}

export const chalkArrows: MinigameDef<ChalkArrowsPuzzle, ChalkArrowsAnswer> = {
  id: "chalk-arrows",
  category: "analyze",
  durationMs: 60_000,
  // Bảng Cân bằng của đặc tả: Mầm chặn trần 1; Khó cần 1,96, Siêu khó cần 2,89 (làm tròn 0,05).
  difficultyMultiplier: { 0: 1, 1: 1, 2: 1.95, 3: 2.9 },
  // Không khai báo `speedAllowanceMs`: mũi tên trượt ngay từ khung hình đầu, không có pha trình chiếu.

  generate(roundSeed, index, difficulty) {
    const level = CHALK_ARROWS_LEVELS[difficulty];
    const rng = createRng(deriveSeed(roundSeed, index));
    const color = chalkArrowsColor(roundSeed, index, difficulty);

    // Số lần gọi `rng` cố định theo mức: point, quan hệ, dấu vuông góc, xáo ô, lệch, hướng nhiễu.
    const point = toDir(rng.int(0, 3));
    const u = rng.int(0, 99);
    const sign = rng.int(0, 1) === 0 ? -1 : 1;
    let slide: ChalkDir;
    if (u < level.samePct) slide = point;
    else if (u < level.samePct + level.perpPct) slide = toDir(point + sign);
    else slide = toDir(point + 2);

    // Mỗi mũi tên một ô riêng; lệch ≤ 30 mỗi trục nên hai tâm cách nhau ≥ 140 theo ít nhất một trục.
    const cells = rng.shuffle(CELL_CENTERS);
    const place = (i: number): ChalkPoint => {
      const c = cells[i] as ChalkPoint;
      return {
        x: c.x + rng.int(-CHALK_JITTER, CHALK_JITTER),
        y: c.y + rng.int(-CHALK_JITTER, CHALK_JITTER),
      };
    };
    const arrows = Array.from({ length: level.arrows }, (_, i) => place(i));
    const smudges = Array.from({ length: level.smudges }, (_, i): ChalkSmudge => {
      const at = place(level.arrows + i);
      return { ...at, point: toDir(rng.int(0, 3)), slide: toDir(rng.int(0, 3)) };
    });

    return {
      color,
      point,
      slide,
      speed: level.speed,
      arrows,
      smudges,
      subtle: level.subtle,
      answer: color === "white" ? point : slide,
    };
  },

  check(puzzle, answer) {
    return answer === puzzle.answer;
  },

  isAnswer(value): value is ChalkArrowsAnswer {
    return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 3;
  },
};
