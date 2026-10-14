import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Ai vừa biến mất (nhóm Ghi nhớ): xem khay đồ vật 3 giây, rèm che 0,4 giây, khay hiện lại với
 * một ô trống có dấu "?". Chạm vào thẻ của món đã biến mất. Thẻ mồi là món KHÔNG có trên khay
 * lúc xem. Siêu khó: các món còn lại đổi chỗ hết, và có một cặp "cùng loại khác dáng".
 * Đặc tả: docs/04-minigames/who-vanished.md.
 */

/**
 * Bộ vật (16 món). Trong game không hiện chữ: FE ánh xạ ID sang hình, mọi món vẽ cùng cỡ và
 * phân biệt được bằng DÁNG, không chỉ bằng màu. 8 món đầu dùng lại hình của Cân não.
 */
export const WHO_VANISHED_ITEMS = [
  "apple",
  "pear",
  "banana",
  "carrot",
  "mushroom",
  "grapes",
  "strawberry",
  "watermelon",
  "cherry",
  "pineapple",
  "lemon",
  "pumpkin",
  "corn",
  "apple-bitten",
  "banana-peeled",
  "watermelon-whole",
] as const;
export type WhoVanishedItem = (typeof WHO_VANISHED_ITEMS)[number];

/**
 * Cặp "cùng loại khác dáng". Ngoài cặp bẫy của Siêu khó, một câu đố không bao giờ có cả hai
 * món của cùng một cặp (trên khay lẫn trên thẻ), để các mức dưới không có chỗ nhầm vì giống hình.
 */
export const WHO_VANISHED_TWINS: readonly (readonly [WhoVanishedItem, WhoVanishedItem])[] = [
  ["apple", "apple-bitten"],
  ["banana", "banana-peeled"],
  ["watermelon", "watermelon-whole"],
];

/**
 * Câu đố. Ô khay đánh số theo hàng, ô 0 ở góc trên trái: ô `i` nằm ở hàng `Math.floor(i / cols)`,
 * cột `i % cols`.
 *
 * Lịch (ms, tính từ lúc câu hiện ra): xem `shown` trong `viewMs`, rèm che `coverMs`, rồi hiện
 * `remaining` và hàng thẻ `choices`. Người chơi được chạm từ `whoVanishedRevealMs(puzzle)`.
 */
export interface WhoVanishedPuzzle {
  /** Số cột của khay: 2 (Mầm) hoặc 3. */
  cols: number;
  /** Số hàng của khay: 2 (Mầm, Thường) hoặc 3 (Khó, Siêu khó). */
  rows: number;
  /** Khay lúc XEM, theo ô; dài `cols × rows`, các món đôi một khác nhau. */
  shown: WhoVanishedItem[];
  /** Ô của món biến mất trên khay lúc xem. */
  vanishedCell: number;
  /**
   * Khay lúc HỎI, theo ô; `null` ở đúng một ô là ô "?" (`blankCell`). Chứa đúng các món của
   * `shown` trừ món biến mất. Mầm, Thường, Khó: món còn lại giữ nguyên chỗ, ô "?" là chỗ cũ
   * của món biến mất. Siêu khó: mọi món còn lại đều sang ô khác, ô "?" cũng khác chỗ cũ.
   */
  remaining: (WhoVanishedItem | null)[];
  /** Ô có dấu "?" lúc hỏi. Sai thì món đúng hiện lại ở ô này. */
  blankCell: number;
  /** true = món còn lại đổi chỗ khi hỏi (chỉ Siêu khó). Scene hiện huy hiệu đổi chỗ. */
  shuffled: boolean;
  /** Hàng thẻ chọn, trái → phải: 3 thẻ (Mầm) hoặc 4 thẻ, đôi một khác nhau. */
  choices: WhoVanishedItem[];
  /** Chỉ số thẻ của món biến mất trong `choices`, tức đáp án đúng. */
  answerIndex: number;
  /** Thời gian xem khay (ms). */
  viewMs: number;
  /** Thời gian rèm che giữa xem và hỏi (ms). */
  coverMs: number;
}

/** Đáp án = chỉ số thẻ người chơi chạm trong `choices`, gửi một lần mỗi câu. */
export type WhoVanishedAnswer = number;

interface LevelParams {
  cols: number;
  rows: number;
  /** Số thẻ chọn (1 đáp án + thẻ mồi). */
  choices: number;
  /** Món còn lại đổi chỗ + cặp bẫy cùng loại khác dáng. */
  hard: boolean;
}

/** Bảng Độ khó của đặc tả. Đổi số ở đây thì sửa đặc tả và test cho khớp. */
const LEVELS: Readonly<Record<Difficulty, LevelParams>> = {
  0: { cols: 2, rows: 2, choices: 3, hard: false },
  1: { cols: 3, rows: 2, choices: 4, hard: false },
  2: { cols: 3, rows: 3, choices: 4, hard: false },
  3: { cols: 3, rows: 3, choices: 4, hard: true },
};

const VIEW_MS = 3_000;
const COVER_MS = 400;

/** Số thẻ nhiều nhất ở mọi mức: chỉ số thẻ hợp lệ nằm trong [0, MAX_CHOICES). */
const MAX_CHOICES = Math.max(...DIFFICULTIES.map((d) => LEVELS[d].choices));

/**
 * "Loại" vật: mỗi cặp cùng loại là một loại hai món, mỗi món còn lại là một loại một món.
 * Câu đố lấy mỗi loại tối đa một món (trừ cặp bẫy của Siêu khó).
 */
const KINDS: readonly (readonly WhoVanishedItem[])[] = [
  ...WHO_VANISHED_TWINS,
  ...WHO_VANISHED_ITEMS.filter(
    (item) => !WHO_VANISHED_TWINS.some((pair) => pair.includes(item)),
  ).map((item) => [item]),
];

/** Mỗi loại lấy một món (cặp thì chọn ngẫu nhiên một trong hai). */
function pickMembers(rng: Rng, kinds: readonly (readonly WhoVanishedItem[])[]): WhoVanishedItem[] {
  return kinds.map((kind) => rng.pick(kind));
}

/** Hoán vị vòng ngẫu nhiên (Sattolo): `perm[i] ≠ i` với mọi i, nên mọi món đều đổi chỗ. */
function cyclicPermutation(rng: Rng, n: number): number[] {
  const perm = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = rng.int(0, i - 1);
    [perm[i], perm[j]] = [perm[j] as number, perm[i] as number];
  }
  return perm;
}

/**
 * Thời điểm người chơi bắt đầu được chạm (ms, tính từ lúc câu hiện ra) = xem + che = 3 400 ms.
 * Scene và server dùng chung con số này.
 */
export function whoVanishedRevealMs(puzzle: Pick<WhoVanishedPuzzle, "viewMs" | "coverMs">): number {
  return puzzle.viewMs + puzzle.coverMs;
}

export const whoVanished: MinigameDef<WhoVanishedPuzzle, WhoVanishedAnswer> = {
  id: "who-vanished",
  category: "memorize",
  // CR-006: vòng 60 s vì mỗi câu có 3,4 s xem + che không thao tác được.
  durationMs: 60_000,

  /**
   * CR-006: mô phỏng vòng 60 s theo bảng Cân bằng của đặc tả. Hệ số để điểm vòng bằng Thường:
   * Mầm (trẻ 7 tuổi) 1,41 → giữ 1 (Mầm = min(mô phỏng, 1)); Khó 1,53; Siêu khó 2,26.
   */
  difficultyMultiplier: { 0: 1, 1: 1, 2: 1.55, 3: 2.25 },

  generate(roundSeed, index, difficulty) {
    const level = LEVELS[difficulty];
    const rng = createRng(deriveSeed(roundSeed, index));
    const cells = level.cols * level.rows;
    const decoyCount = level.choices - 1;

    let shown: WhoVanishedItem[];
    let vanished: WhoVanishedItem;
    let decoys: WhoVanishedItem[];

    if (!level.hard) {
      // Mỗi loại tối đa một món → không có hai món giống hình trong cùng câu.
      const picked = pickMembers(rng, rng.shuffle(KINDS).slice(0, cells + decoyCount));
      shown = picked.slice(0, cells);
      decoys = picked.slice(cells);
      vanished = shown[rng.int(0, cells - 1)] as WhoVanishedItem;
    } else {
      // Siêu khó: một cặp bẫy (a, b) cùng loại khác dáng, a luôn ở trên khay.
      const trap = rng.pick(WHO_VANISHED_TWINS);
      const [a, b] = rng.shuffle(trap) as [WhoVanishedItem, WhoVanishedItem];
      const others = pickMembers(rng, rng.shuffle(KINDS.filter((kind) => kind !== trap)));
      if (rng.int(0, 3) === 0) {
        // 1/4: b cũng ở trên khay và biến mất → thẻ đúng là "anh em" của a vẫn còn trên khay.
        shown = rng.shuffle([a, b, ...others.slice(0, cells - 2)]);
        vanished = b;
        decoys = others.slice(cells - 2, cells - 2 + decoyCount);
      } else {
        // 3/4: b là thẻ mồi → thẻ "anh em" của a là bẫy. Món biến mất là một món khác a.
        const rest = others.slice(0, cells - 1);
        shown = rng.shuffle([a, ...rest]);
        vanished = rng.pick(rest);
        decoys = [b, ...others.slice(cells - 1, cells - 1 + decoyCount - 1)];
      }
      // Thẻ "anh em" là đáp án đúng 1/4 số câu = đúng bằng xác suất của một thẻ bất kỳ,
      // nên không thành mẹo đoán.
    }

    const vanishedCell = shown.indexOf(vanished);
    const remaining: (WhoVanishedItem | null)[] = new Array(cells).fill(null);
    let blankCell = vanishedCell;
    if (level.hard) {
      const perm = cyclicPermutation(rng, cells);
      for (let i = 0; i < cells; i++) {
        if (i !== vanishedCell) remaining[perm[i] as number] = shown[i] as WhoVanishedItem;
      }
      blankCell = perm[vanishedCell] as number;
    } else {
      for (let i = 0; i < cells; i++) {
        if (i !== vanishedCell) remaining[i] = shown[i] as WhoVanishedItem;
      }
    }

    const choices = rng.shuffle([vanished, ...decoys]);

    return {
      cols: level.cols,
      rows: level.rows,
      shown,
      vanishedCell,
      remaining,
      blankCell,
      shuffled: level.hard,
      choices,
      answerIndex: choices.indexOf(vanished),
      viewMs: VIEW_MS,
      coverMs: COVER_MS,
    };
  },

  check(puzzle, answer) {
    return answer === puzzle.answerIndex;
  },

  /** Số nguyên 0–3 (giới hạn lấy từ bảng tham số). */
  isAnswer(value): value is WhoVanishedAnswer {
    return (
      typeof value === "number" && Number.isInteger(value) && value >= 0 && value < MAX_CHOICES
    );
  },

  /** CR-006: miễn trừ thưởng tốc độ = thời gian xem + che, lúc chưa được chạm. */
  speedAllowanceMs(puzzle) {
    return whoVanishedRevealMs(puzzle);
  },
};
