import type { Difficulty } from "../difficulty";
import { createRng, deriveSeed } from "../rng";
import type { MinigameDef } from "./types";

/**
 * Kẻ lạc đàn (nhóm Nhận diện): lưới hình giống nhau, chạm vào ô duy nhất khác biệt.
 * Độ khó tăng bằng lưới lớn hơn và khác biệt tinh tế hơn.
 */

export const SHAPES = ["circle", "square", "triangle", "diamond", "star", "hexagon"] as const;
export type Shape = (typeof SHAPES)[number];

export const PALETTE = ["#E85D75", "#F2A541", "#3BB273", "#4D9DE0", "#7768AE", "#2D3047"] as const;

export interface Cell {
  shape: Shape;
  color: string;
  /** Góc xoay (độ), dùng ở độ khó cao để tạo khác biệt tinh tế. */
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

export const oddOneOut: MinigameDef<OddOneOutPuzzle, OddOneOutAnswer> = {
  id: "odd-one-out",
  title: "Kẻ lạc đàn",
  howTo: "Chạm vào hình duy nhất khác với tất cả các hình còn lại.",
  category: "identify",
  durationMs: 45_000,

  generate(roundSeed, index, difficulty) {
    const rng = createRng(deriveSeed(roundSeed, index));
    const size = GRID_BY_DIFFICULTY[difficulty];
    const count = size * size;

    const base: Cell = {
      shape: rng.pick(SHAPES),
      color: rng.pick(PALETTE),
      rotation: 0,
    };

    // Mầm/Thường: khác hình hoặc khác màu. Khó: khác màu. Siêu khó: chỉ khác góc xoay.
    const mode =
      difficulty <= 1
        ? rng.pick(["shape", "color"] as const)
        : difficulty === 2
          ? "color"
          : "rotation";

    let odd: Cell;
    if (mode === "shape") {
      odd = { ...base, shape: rng.pick(SHAPES.filter((s) => s !== base.shape)) };
    } else if (mode === "color") {
      odd = { ...base, color: rng.pick(PALETTE.filter((c) => c !== base.color)) };
    } else {
      // Hình tròn xoay không thấy khác → đổi sang hình có hướng.
      const shape: Shape =
        base.shape === "circle" || base.shape === "hexagon" ? "triangle" : base.shape;
      base.shape = shape;
      odd = { ...base, rotation: rng.pick([15, 20, 25]) };
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
