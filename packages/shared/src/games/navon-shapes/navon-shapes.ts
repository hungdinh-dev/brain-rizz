import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Hình to hình nhỏ (nhóm Nhận diện): hình Navon, một HÌNH TO ghép từ nhiều HÌNH NHỎ cùng loại.
 * Khung tròn → chạm nút có hình to; khung vuông (từ Khó) → chạm nút có hình nhỏ.
 * Mầm/Thường luôn hỏi hình to (khung tròn). Siêu khó: 5 loại hình, nút đổi chỗ mỗi câu.
 * Hai câu liền nhau không bao giờ giống hệt nhau (chuỗi O(index) từ câu 0, xem `generate`).
 * Đặc tả: docs/04-minigames/navon-shapes.md.
 */

/** Các loại hình, theo thứ tự nút cố định (Mầm dùng 3 loại đầu, Thường/Khó 4, Siêu khó 5). */
export const NAVON_SHAPES = ["circle", "square", "triangle", "plus", "heart"] as const;

export type NavonShape = (typeof NAVON_SHAPES)[number];

/** Câu hỏi về hình to (`global`, khung tròn) hay hình nhỏ (`local`, khung vuông). */
export type NavonAsk = "global" | "local";

/** Ô của mặt nạ hình to: cột 0–6 từ trái, hàng 0–6 từ trên. */
export interface NavonCell {
  col: number;
  row: number;
}

/** Hình to vẽ trên lưới NAVON_GRID × NAVON_GRID; mỗi ô có mặt nạ đặt một hình nhỏ ở tâm ô. */
export const NAVON_GRID = 7;

/** Mặt nạ dạng chữ (`#` = có hình nhỏ). Mọi hình chiếm trọn khung 7 × 7, đối xứng trái–phải. */
const MASK_ROWS: Readonly<Record<NavonShape, readonly string[]>> = {
  circle: ["..###..", ".#...#.", "#.....#", "#.....#", "#.....#", ".#...#.", "..###.."],
  square: ["#######", "#.....#", "#.....#", "#.....#", "#.....#", "#.....#", "#######"],
  triangle: ["...#...", "..#.#..", "..#.#..", ".#...#.", ".#...#.", "#.....#", "#######"],
  plus: ["...#...", "...#...", "...#...", "#######", "...#...", "...#...", "...#..."],
  heart: [".##.##.", "#..#..#", "#.....#", "#.....#", ".#...#.", "..#.#..", "...#..."],
};

function toCells(rows: readonly string[]): readonly NavonCell[] {
  const cells: NavonCell[] = [];
  rows.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      if (line[col] === "#") cells.push(Object.freeze({ col, row }));
    }
  });
  return Object.freeze(cells);
}

/** Mặt nạ của từng hình to (theo hàng, trái → phải). FE đặt một hình nhỏ vào tâm mỗi ô. */
export const NAVON_MASKS: Readonly<Record<NavonShape, readonly NavonCell[]>> = Object.freeze({
  circle: toCells(MASK_ROWS.circle),
  square: toCells(MASK_ROWS.square),
  triangle: toCells(MASK_ROWS.triangle),
  plus: toCells(MASK_ROWS.plus),
  heart: toCells(MASK_ROWS.heart),
});

export interface NavonShapesLevel {
  /** Số loại hình dùng trong mức (3 loại đầu của `NAVON_SHAPES`, rồi 4, rồi 5) = số nút. */
  shapes: number;
  /** % câu xung đột: hình nhỏ KHÁC hình to. */
  conflictPct: number;
  /** % câu hỏi hình nhỏ (khung vuông). 0 = luôn hỏi hình to. */
  localAskPct: number;
  /** Xáo thứ tự nút mỗi câu (Siêu khó); các mức khác giữ thứ tự `NAVON_SHAPES`. */
  shuffleButtons: boolean;
}

export const NAVON_SHAPES_LEVELS: Readonly<Record<Difficulty, NavonShapesLevel>> = {
  0: { shapes: 3, conflictPct: 25, localAskPct: 0, shuffleButtons: false },
  1: { shapes: 4, conflictPct: 75, localAskPct: 0, shuffleButtons: false },
  2: { shapes: 4, conflictPct: 80, localAskPct: 50, shuffleButtons: false },
  3: { shapes: 5, conflictPct: 90, localAskPct: 50, shuffleButtons: true },
};

export interface NavonShapesPuzzle {
  /** Hình to. */
  global: NavonShape;
  /** Hình nhỏ ghép nên hình to (trùng `global` ở câu không xung đột). */
  local: NavonShape;
  /** Mặt nạ của hình to (= `NAVON_MASKS[global]`): mỗi ô đặt một hình nhỏ `local`. */
  cells: readonly NavonCell[];
  /** `"global"` → khung tròn, hỏi hình to; `"local"` → khung vuông, hỏi hình nhỏ. */
  ask: NavonAsk;
  /** Loại hình trên từng nút, trái → phải; mỗi loại của mức đúng một lần. */
  buttons: readonly NavonShape[];
  /** Nút đúng: `buttons[answerIndex] === (ask === "global" ? global : local)`. */
  answerIndex: number;
}

/** Đáp án = chỉ số nút người chơi chạm (0 = nút trái nhất). */
export type NavonShapesAnswer = number;

const MAX_BUTTONS = NAVON_SHAPES.length;

/** Muối cho luồng xáo nút (Siêu khó), tách khỏi luồng hình của từng câu. */
const BUTTON_SALT = 0x4e5a;

/** Thứ tự nút cố định của từng mức (không xáo). */
const BASE_BUTTONS: Readonly<Record<Difficulty, readonly NavonShape[]>> = {
  0: Object.freeze(NAVON_SHAPES.slice(0, NAVON_SHAPES_LEVELS[0].shapes)),
  1: Object.freeze(NAVON_SHAPES.slice(0, NAVON_SHAPES_LEVELS[1].shapes)),
  2: Object.freeze(NAVON_SHAPES.slice(0, NAVON_SHAPES_LEVELS[2].shapes)),
  3: Object.freeze(NAVON_SHAPES.slice(0, NAVON_SHAPES_LEVELS[3].shapes)),
};

/** Tính chẵn lẻ của hoán vị (0 chẵn, 1 lẻ) so với thứ tự trong `NAVON_SHAPES`. */
function permutationParity(order: readonly NavonShape[]): number {
  const ranks = order.map((s) => NAVON_SHAPES.indexOf(s));
  let inversions = 0;
  for (let i = 0; i < ranks.length; i++) {
    for (let j = i + 1; j < ranks.length; j++) {
      if ((ranks[i] as number) > (ranks[j] as number)) inversions++;
    }
  }
  return inversions % 2;
}

export const navonShapes: MinigameDef<NavonShapesPuzzle, NavonShapesAnswer> = {
  id: "navon-shapes",
  category: "identify",
  durationMs: 60_000,
  // Bảng Cân bằng của đặc tả: Mầm chặn trần 1; Khó cần 1,92, Siêu khó cần 3,02 (làm tròn 0,05).
  difficultyMultiplier: { 0: 1, 1: 1, 2: 1.9, 3: 3 },
  // Không khai báo `speedAllowanceMs` / `answerWindowMs`: hình hiện là chạm được ngay, một chạm.

  generate(roundSeed, index, difficulty) {
    const level = NAVON_SHAPES_LEVELS[difficulty];
    const pool = BASE_BUTTONS[difficulty];
    const n = pool.length;

    // Đi từ câu 0 tới câu `index` (O(index), index ≤ ~60 mỗi vòng): câu j bốc từ luồng riêng
    // `createRng(deriveSeed(seed, j))`, 4 lần gọi cố định. Câu bốc ra giống hệt câu trước (cùng
    // hình to, hình nhỏ, khung) thì đẩy hình to sang loại kế tiếp, giữ nguyên xung đột và khung:
    // hai câu liền nhau không bao giờ trùng hình mà tỉ lệ xung đột, tỉ lệ khung vẫn đúng bảng mức,
    // và hình to vẫn đều các loại (phép đẩy đối xứng vòng quanh danh sách).
    let g = 0;
    let l = 0;
    let ask: NavonAsk = "global";
    for (let j = 0; j <= index; j++) {
      const rng = createRng(deriveSeed(roundSeed, j));
      let gj = rng.int(0, n - 1);
      const conflict = rng.int(0, 99) < level.conflictPct;
      // Xung đột: hình nhỏ đều trong các loại còn lại (lệch 1 … n−1 vòng quanh danh sách).
      const shift = rng.int(1, n - 1);
      const offset = conflict ? shift : 0;
      const askj: NavonAsk = rng.int(0, 99) < level.localAskPct ? "local" : "global";
      if (j > 0 && gj === g && (gj + offset) % n === l && askj === ask) gj = (gj + 1) % n;
      g = gj;
      l = (gj + offset) % n;
      ask = askj;
    }

    const global = pool[g] as NavonShape;
    const local = pool[l] as NavonShape;

    let buttons: readonly NavonShape[] = pool;
    if (level.shuffleButtons) {
      // Luồng riêng cho thứ tự nút. Câu chẵn dùng hoán vị chẵn, câu lẻ dùng hoán vị lẻ → hai câu
      // liền nhau không bao giờ cùng thứ tự nút. Đổi chỗ hai nút đầu là song ánh chẵn ↔ lẻ nên
      // vẫn đều trên mỗi nhóm.
      const shuffled = createRng(deriveSeed(roundSeed, index, BUTTON_SALT)).shuffle(pool);
      if (permutationParity(shuffled) !== index % 2) {
        [shuffled[0], shuffled[1]] = [shuffled[1] as NavonShape, shuffled[0] as NavonShape];
      }
      buttons = shuffled;
    }

    const target = ask === "global" ? global : local;
    return {
      global,
      local,
      cells: NAVON_MASKS[global],
      ask,
      buttons,
      answerIndex: buttons.indexOf(target),
    };
  },

  check(puzzle, answer) {
    return answer === puzzle.answerIndex;
  },

  isAnswer(value): value is NavonShapesAnswer {
    return Number.isInteger(value) && (value as number) >= 0 && (value as number) < MAX_BUTTONS;
  },
};
