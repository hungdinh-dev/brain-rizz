import type { Difficulty } from "../difficulty";

/** 5 nhóm kỹ năng. */
export type Category = "identify" | "memorize" | "analyze" | "compute" | "visualize";

export const CATEGORIES: readonly Category[] = [
  "identify",
  "memorize",
  "analyze",
  "compute",
  "visualize",
];

/**
 * Hợp đồng chung cho mọi minigame — chỉ phần logic.
 * Tên game và cách chơi (theo ngôn ngữ) nằm ở web: `apps/web/src/games/<id>/locales.ts`.
 *
 * `generate` PHẢI là hàm thuần và tất định: cùng (seed, index, difficulty) → cùng câu đố,
 * chạy giống hệt nhau trên trình duyệt và Node. Server dùng lại chính hàm này để chấm điểm.
 */
export interface MinigameDef<Puzzle, Answer> {
  id: string;
  category: Category;
  /** Thời lượng một vòng (ms). */
  durationMs: number;
  generate(roundSeed: number, index: number, difficulty: Difficulty): Puzzle;
  check(puzzle: Puzzle, answer: Answer): boolean;
  /** Kiểm tra kiểu đáp án client gửi lên trước khi chấm. */
  isAnswer(value: unknown): value is Answer;
  /**
   * Hệ số điểm theo độ khó riêng của game (CR-006). Không khai báo thì dùng
   * `DIFFICULTY_MULTIPLIER` chung. Tính từ thời gian giải dự kiến ở bảng Cân bằng của đặc tả.
   */
  difficultyMultiplier?: Readonly<Record<Difficulty, number>>;
  /**
   * Số ms trừ khỏi thời gian trả lời trước khi tính thưởng tốc độ (CR-006): thời gian trình
   * chiếu không bấm được, thời gian tối thiểu cho nhiều lần chạm… Phải tất định theo câu đố.
   */
  speedAllowanceMs?(puzzle: Puzzle, difficulty: Difficulty): number;
}

// biome-ignore lint/suspicious/noExplicitAny: registry chứa nhiều kiểu puzzle khác nhau
export type AnyMinigame = MinigameDef<any, any>;
