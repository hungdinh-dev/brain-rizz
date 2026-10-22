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
  /**
   * Thời gian một câu (ms) của người chơi mục tiêu ở mỗi mức, chép từ bảng Cân bằng của đặc tả
   * (CR-016): trung vị hoặc giữa khoảng, **tính cả trình chiếu và hiệu ứng chuyển câu** vì server
   * đo từ lúc trả lời câu trước, không tính khoá sau câu sai. Mầm theo trẻ 7 tuổi, các mức khác
   * theo người lớn chọn đúng sức. Bot dùng số này để hẹn giờ trả lời (`src/bots/`). Không khai
   * báo thì bot dùng ước lượng chung `BOT_BASE_SOLVE_MS × hệ số game + miễn trừ`.
   */
  expectedSolveMs?: Readonly<Record<Difficulty, number>>;
  /**
   * Tỉ lệ đúng (0–1] của người chơi mục tiêu chơi đúng sức ở mỗi mức, chép từ bảng Cân bằng của
   * đặc tả (CR-016): người lớn ở Thường, Khó, Siêu khó; Mầm theo trẻ 7 tuổi như `expectedSolveMs`.
   * Đặc tả ghi tỉ lệ sai thì lấy 1 − tỉ lệ sai. Bot quy tỉ lệ đúng của mức theo số này
   * (`relativeAccuracy` trong `src/bots/levels.ts`): game có Siêu khó chỉ đúng ~70 % thì bot Siêu
   * cũng sai nhiều tương ứng. Không khai báo thì bot dùng mức chung `BOT_BASE_ACCURACY` (90 %).
   * Khai báo không quá `BOT_MAX_BASE_ACCURACY` (98 %): số lớn hơn bị kẹp. Mức "không có cách sai"
   * (vd. Mầm của Luyện ngắm) thì ước lượng tỉ lệ chạm trượt của người chơi mục tiêu, không ghi 1.
   */
  expectedAccuracy?: Readonly<Record<Difficulty, number>>;
}

// biome-ignore lint/suspicious/noExplicitAny: registry chứa nhiều kiểu puzzle khác nhau
export type AnyMinigame = MinigameDef<any, any>;
