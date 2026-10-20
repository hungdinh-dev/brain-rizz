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
  /**
   * Hạn trả lời của câu (ms), tính từ lúc câu bắt đầu theo đồng hồ server (CR-012): câu trả lời
   * tới muộn hơn hạn này cộng dung sai mạng của server thì bị chấm sai dù `check` đúng. Dùng cho
   * game có vật biến mất (Luyện ngắm, Đập đúng hình). Không khai báo, hoặc trả `undefined`, thì
   * không giới hạn như mọi game cũ. Phải tất định theo câu đố.
   */
  answerWindowMs?(puzzle: Puzzle, difficulty: Difficulty): number | undefined;
}

// biome-ignore lint/suspicious/noExplicitAny: registry chứa nhiều kiểu puzzle khác nhau
export type AnyMinigame = MinigameDef<any, any>;
