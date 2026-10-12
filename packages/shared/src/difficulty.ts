/** 0 = Mầm, 1 = Thường, 2 = Khó, 3 = Siêu khó — tên hiển thị nằm ở i18n của web (khoá `difficulty.<n>`). */
export type Difficulty = 0 | 1 | 2 | 3;

export const DIFFICULTIES: readonly Difficulty[] = [0, 1, 2, 3];

/** Hệ số nhân điểm theo độ khó, giúp trẻ em và người lớn chơi chung vẫn cân bằng. */
export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  0: 0.8,
  1: 1,
  2: 1.25,
  3: 1.5,
};

export function isDifficulty(value: unknown): value is Difficulty {
  return value === 0 || value === 1 || value === 2 || value === 3;
}
