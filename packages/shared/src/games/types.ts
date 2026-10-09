import type { Difficulty } from "../difficulty";

/** 5 nhóm kỹ năng. */
export type Category = "identify" | "memorize" | "analyze" | "compute" | "visualize";

export const CATEGORY_LABELS: Record<Category, string> = {
  identify: "Nhận diện",
  memorize: "Ghi nhớ",
  analyze: "Phân tích",
  compute: "Tính toán",
  visualize: "Hình dung",
};

/**
 * Hợp đồng chung cho mọi minigame.
 *
 * `generate` PHẢI là hàm thuần và tất định: cùng (seed, index, difficulty) → cùng câu đố,
 * chạy giống hệt nhau trên trình duyệt và Node. Server dùng lại chính hàm này để chấm điểm.
 */
export interface MinigameDef<Puzzle, Answer> {
  id: string;
  /** Tên hiển thị (tiếng Việt). */
  title: string;
  /** Mô tả ngắn cách chơi. */
  howTo: string;
  category: Category;
  /** Thời lượng một vòng (ms). */
  durationMs: number;
  generate(roundSeed: number, index: number, difficulty: Difficulty): Puzzle;
  check(puzzle: Puzzle, answer: Answer): boolean;
  /** Kiểm tra kiểu đáp án client gửi lên trước khi chấm. */
  isAnswer(value: unknown): value is Answer;
}

// biome-ignore lint/suspicious/noExplicitAny: registry chứa nhiều kiểu puzzle khác nhau
export type AnyMinigame = MinigameDef<any, any>;
