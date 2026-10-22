import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import { createRng, deriveSeed } from "../../rng";
import { BALANCE_ITEMS, type BalanceItem } from "../balance/balance";
import type { MinigameDef } from "../types";

/**
 * Lật cặp (nhóm Ghi nhớ), biến thể "thẻ đề": đầu mỗi bàn xem trước toàn bộ thẻ rồi úp lại.
 * Mỗi câu game lật sẵn một thẻ đề, người chơi chạm thẻ úp giống nó. Bàn N cặp có N − 1 câu;
 * cặp cuối tự lật, không tính câu. Đặc tả: docs/04-minigames/pair-flip.md.
 *
 * Bàn và thứ tự đề chỉ phụ thuộc (roundSeed, số thứ tự bàn, độ khó), nên câu thứ `index`
 * luôn sinh lại được mà server không cần lưu trạng thái bàn của từng người. Câu trả lời sai
 * vẫn "tiêu" cặp đề: câu sau giống hệt dù câu trước đúng hay sai.
 */

/** Mặt ngửa dùng chung bộ vật của Cân não (cùng ID, cùng hình). Cần ≥ 8 vật cho bàn 4×4. */
export const PAIR_FLIP_ITEMS = BALANCE_ITEMS;
export type PairFlipItem = BalanceItem;

/**
 * Lịch trình chiếu chung (ms). Thời điểm tính từ lúc câu hiện ra, tức lúc server bắt đầu
 * đếm giờ câu này (ngay khi trả lời đúng câu trước, hoặc khi hết khoá nếu sai).
 */
export const PAIR_FLIP_TIMING = {
  /** Câu đầu của bàn thứ 2 trở đi: cặp cuối của bàn trước tự lật, giữ rồi mới chia bàn mới. */
  boardGapMs: 600,
  /** Câu đầu của mỗi bàn: chia thẻ (ngửa sẵn). */
  dealMs: 400,
  /** Câu đầu của mỗi bàn: úp toàn bộ thẻ sau khi xem. */
  hideMs: 300,
  /** Mọi câu: lật thẻ đề. Người chơi được chạm khi thẻ đề lật xong. */
  promptMs: 300,
} as const;

/**
 * Câu đố. Ô đánh số theo hàng, ô 0 ở góc trên trái: ô `i` nằm ở hàng `Math.floor(i / cols)`,
 * cột `i % cols`.
 *
 * Lịch (ms, tính từ lúc câu hiện ra), các pha nối tiếp nhau; pha nào không có thì bằng 0:
 * `gapMs` (cặp cuối bàn trước) → `dealMs` (chia thẻ ngửa) → `previewMs` (xem) → `hideMs` (úp)
 * → `promptMs` (lật thẻ đề). Được chạm từ `pairFlipInputMs(puzzle)`.
 */
export interface PairFlipPuzzle {
  /** Số cột: 3 (Mầm) hoặc 4. */
  cols: number;
  /** Số hàng: 2, 3 hoặc 4. */
  rows: number;
  /** Vật in trên mặt ngửa của từng ô, theo thứ tự ô. Mỗi vật xuất hiện đúng 2 lần. */
  cards: PairFlipItem[];
  /** Bàn thứ mấy trong vòng (đếm từ 0). Bàn mới sau mỗi `steps` câu. */
  board: number;
  /** Câu thứ mấy trong bàn (đếm từ 0, < `steps`). `step === 0` là câu có xem trước. */
  step: number;
  /** Số câu của bàn = số cặp − 1. */
  steps: number;
  /** Các ô đã xong (ngửa, mờ), tăng dần: cả hai thẻ của mọi cặp đề trước, khớp hay bỏ lỡ. */
  cleared: number[];
  /** Ô của thẻ đề (lật sẵn, vòng vàng). Không phải đáp án. */
  prompt: number;
  /** Ô của thẻ còn lại cùng vật với thẻ đề: đáp án đúng duy nhất. */
  answer: number;
  gapMs: number;
  dealMs: number;
  previewMs: number;
  hideMs: number;
  promptMs: number;
}

/** Đáp án = chỉ số ô người chơi chạm (một lần chạm mỗi câu). */
export type PairFlipAnswer = number;

interface LevelParams {
  cols: number;
  rows: number;
  /** Thời gian xem trước toàn bộ thẻ ở đầu mỗi bàn (ms). */
  previewMs: number;
}

/** Bảng Độ khó của đặc tả. Đổi số ở đây thì sửa đặc tả và test cho khớp. */
const LEVELS: Readonly<Record<Difficulty, LevelParams>> = {
  0: { cols: 3, rows: 2, previewMs: 3_000 },
  1: { cols: 4, rows: 2, previewMs: 3_000 },
  2: { cols: 4, rows: 3, previewMs: 4_000 },
  3: { cols: 4, rows: 4, previewMs: 4_000 },
};

/** Số ô của bàn lớn nhất: chỉ số ô hợp lệ nằm trong [0, MAX_CARDS). */
const MAX_CARDS = Math.max(...DIFFICULTIES.map((d) => LEVELS[d].cols * LEVELS[d].rows));

/** Muối riêng cho seed của bàn, để không trùng dòng số với `deriveSeed(roundSeed, index)`. */
const BOARD_SALT = 0x5f1;

/** Số cặp và số câu mỗi bàn ở một mức. */
export function pairFlipBoardSize(difficulty: Difficulty): { pairs: number; steps: number } {
  const { cols, rows } = LEVELS[difficulty];
  const pairs = (cols * rows) / 2;
  return { pairs, steps: pairs - 1 };
}

/**
 * Thời điểm người chơi bắt đầu được chạm (ms, tính từ lúc câu hiện ra) = hết mọi pha trình chiếu.
 * Scene và server dùng chung con số này. Câu đầu bàn: Mầm, Thường 4 000 ms (bàn đầu) hoặc
 * 4 600 ms (bàn sau); Khó, Siêu khó 5 000 / 5 600 ms. Các câu khác: 300 ms.
 */
export function pairFlipInputMs(
  puzzle: Pick<PairFlipPuzzle, "gapMs" | "dealMs" | "previewMs" | "hideMs" | "promptMs">,
): number {
  return puzzle.gapMs + puzzle.dealMs + puzzle.previewMs + puzzle.hideMs + puzzle.promptMs;
}

/**
 * Hai ô của cặp tự lật khi bàn xong (chỉ có ở câu cuối bàn, `step === steps − 1`): các ô chưa
 * xong, không phải thẻ đề hay đáp án. Câu khác trả về mảng rỗng.
 */
export function pairFlipLastPair(puzzle: PairFlipPuzzle): number[] {
  if (puzzle.step !== puzzle.steps - 1) return [];
  const done = new Set([...puzzle.cleared, puzzle.prompt, puzzle.answer]);
  return puzzle.cards.map((_, i) => i).filter((i) => !done.has(i));
}

export const pairFlip: MinigameDef<PairFlipPuzzle, PairFlipAnswer> = {
  id: "pair-flip",
  category: "memorize",
  // CR-006: mặc định cho game mới; mỗi bàn có 3–4 s xem trước không thao tác được.
  durationMs: 60_000,

  /**
   * CR-006: mô phỏng vòng 60 s theo bảng Cân bằng của đặc tả. Hệ số cần để điểm vòng bằng
   * Thường: Mầm (trẻ 7 tuổi) 1,82; Khó 1,46; Siêu khó 1,96. Mầm lấy min(1,82; 1) = 1 theo luật
   * chung (người lớn chọn Mầm đã được 108 % điểm Thường với hệ số 1).
   */
  difficultyMultiplier: { 0: 1, 1: 1, 2: 1.45, 3: 1.95 },
  // Bot (CR-016): thời gian một câu chép từ bảng Cân bằng của đặc tả (Mầm theo trẻ 7 tuổi): trung
  // bình mỗi câu kể cả chia và xem bàn (câu sau bắt đầu ngay).
  expectedSolveMs: { 0: 4_800, 1: 3_400, 2: 3_600, 3: 3_700 },
  // Bot (CR-016): tỉ lệ đúng chép từ bảng Cân bằng của đặc tả (Mầm theo trẻ 7 tuổi).
  expectedAccuracy: { 0: 0.85, 1: 0.88, 2: 0.78, 3: 0.68 },

  generate(roundSeed, index, difficulty) {
    const level = LEVELS[difficulty];
    const { pairs, steps } = pairFlipBoardSize(difficulty);
    const board = Math.floor(index / steps);
    const step = index % steps;

    // Mọi câu của cùng một bàn dùng chung seed bàn và rút số y hệt nhau (không phụ thuộc `step`),
    // nên bàn, thứ tự đề và thẻ đề của từng cặp luôn khớp giữa các câu.
    const rng = createRng(deriveSeed(roundSeed, board, BOARD_SALT));
    const items = rng.shuffle(PAIR_FLIP_ITEMS).slice(0, pairs);
    const cards = rng.shuffle([...items, ...items]);
    const order = rng.shuffle(items);
    // Thẻ nào của cặp làm thẻ đề: 0 = thẻ đứng trước theo thứ tự ô, 1 = thẻ đứng sau.
    const promptSide = order.map(() => rng.int(0, 1));

    const positionsOf = (item: PairFlipItem): [number, number] => {
      const first = cards.indexOf(item);
      return [first, cards.indexOf(item, first + 1)];
    };

    const cleared = order
      .slice(0, step)
      .flatMap(positionsOf)
      .sort((a, b) => a - b);
    const [a, b] = positionsOf(order[step] as PairFlipItem);
    const [prompt, answer] = promptSide[step] === 0 ? [a, b] : [b, a];

    const opening = step === 0;
    return {
      cols: level.cols,
      rows: level.rows,
      cards,
      board,
      step,
      steps,
      cleared,
      prompt,
      answer,
      gapMs: opening && board > 0 ? PAIR_FLIP_TIMING.boardGapMs : 0,
      dealMs: opening ? PAIR_FLIP_TIMING.dealMs : 0,
      previewMs: opening ? level.previewMs : 0,
      hideMs: opening ? PAIR_FLIP_TIMING.hideMs : 0,
      promptMs: PAIR_FLIP_TIMING.promptMs,
    };
  },

  /** Đúng khi và chỉ khi chạm đúng ô `answer`. Thẻ đề, ô đã xong hay ô khác đều sai. */
  check(puzzle, answer) {
    return answer === puzzle.answer;
  },

  /** Số nguyên 0–15 (giới hạn lấy từ bàn lớn nhất). */
  isAnswer(value): value is PairFlipAnswer {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < MAX_CARDS;
  },

  /** CR-006: miễn trừ thưởng tốc độ = phần trình chiếu chưa được chạm. */
  speedAllowanceMs(puzzle) {
    return pairFlipInputMs(puzzle);
  },
};
