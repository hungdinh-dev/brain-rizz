import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Tráo cốc (nhóm Nhận diện): cục phấn được úp dưới một chiếc cốc, các cốc tráo chỗ; hết tráo
 * thì chạm vào cốc có phấn. Siêu khó giấu thêm cục tẩy, hết tráo mới hỏi tìm vật nào.
 * Đặc tả: docs/04-minigames/cup-shuffle.md.
 *
 * Nguyên tắc chống đoán mò: dãy tráo luôn được chọn TRƯỚC và KHÔNG phụ thuộc vào chỗ giấu vật;
 * ô giấu vật chọn đều, độc lập với dãy. Nhờ vậy nhìn lượt tráo nào cũng không đoán được vật ở
 * đâu nếu không theo dõi vật. Ràng buộc chất lượng (mỗi cốc đều phải di chuyển đủ số lần) chỉ
 * xét dãy tráo, áp cho mọi cốc như nhau, nên không làm lộ chỗ giấu.
 */

/**
 * Một lượt tráo, theo ô (vị trí đếm từ trái sang, bắt đầu từ 0):
 * - `[a, b]`: đổi chỗ hai cốc ở ô `a` và ô `b` (`a < b`).
 * - `[a, b, c]`: xoay vòng ba cốc cùng lúc: cốc ở ô `a` sang ô `b`, cốc ở `b` sang `c`,
 *   cốc ở `c` sang `a`. Ba ô khác nhau, `a` nhỏ nhất, `b` và `c` theo một trong hai chiều.
 */
export type CupShuffleMove = [number, number] | [number, number, number];

/** Vật giấu dưới cốc, theo chỉ số trong `start`: 0 = cục phấn, 1 = cục tẩy (chỉ Siêu khó). */
export const CUP_SHUFFLE_ITEMS = ["chalk", "eraser"] as const;
export type CupShuffleItem = (typeof CUP_SHUFFLE_ITEMS)[number];

/**
 * Câu đố. Dòng thời gian (ms, tính từ lúc scene hiện câu), scene vẽ theo đúng các mốc này,
 * không đếm khung hình:
 * - `[0, showMs)`: cốc nhấc lên, thấy vật nằm dưới cốc nào.
 * - `[showMs, showMs + coverMs)`: cốc úp xuống.
 * - lượt tráo `k` (đếm từ 0) chạy trong `[cupShuffleMoveStartMs(p, k), … + moveMs)`.
 * - từ `cupShuffleInputAtMs(p)`: hết tráo, được chạm (Siêu khó: hiện vật được hỏi).
 */
export interface CupShufflePuzzle {
  /** Số cốc (3–5), xếp một hàng ngang. */
  cups: number;
  /** `start[j]` = ô ban đầu của vật `j` (xem `CUP_SHUFFLE_ITEMS`). Dài 1, hoặc 2 ở Siêu khó. */
  start: number[];
  /** Vật phải tìm (chỉ số trong `start`). Luôn 0 khi chỉ có một vật. */
  target: number;
  /** Các lượt tráo theo thứ tự. */
  moves: CupShuffleMove[];
  /** Thời gian cốc nhấc lên cho thấy vật (ms). */
  showMs: number;
  /** Thời gian cốc úp xuống (ms). */
  coverMs: number;
  /** Thời gian một lượt tráo (ms), mọi lượt như nhau. */
  moveMs: number;
  /** Ô có vật `target` sau lượt tráo cuối: đáp án đúng duy nhất. */
  answer: number;
}

/** Đáp án = ô (vị trí từ trái sang, từ 0) của cốc người chơi chạm. Gửi một lần mỗi câu. */
export type CupShuffleAnswer = number;

/**
 * Mẫu dãy tráo cho mức 3 cốc: mỗi chữ là một lượt đổi chỗ, `A`, `B`, `C` là ba cặp ô khác nhau
 * (gán theo cả 6 cách, nên mỗi mẫu cho 6 dãy). Hai chữ liền nhau luôn khác nhau: không lượt nào
 * hoàn tác lượt trước. `weight` = trọng số của mỗi dãy thuộc mẫu (số nguyên ≥ 1).
 */
export interface CupShufflePattern {
  pattern: string;
  weight: number;
}

interface LevelParams {
  cups: number;
  moves: number;
  moveMs: number;
  showMs: number;
  /** Số vật giấu: 1, hoặc 2 (phấn và tẩy). */
  items: 1 | 2;
  /** Mức 3 cốc: lấy từ danh mục mẫu (xem `CupShufflePattern`); không có thì sinh ngẫu nhiên. */
  patterns?: readonly CupShufflePattern[];
  /** Số lượt xoay vòng 3 cốc [ít nhất, nhiều nhất]; không bao giờ hai lượt xoay liền nhau. */
  rotations: readonly [number, number];
  /** Mỗi chiếc cốc phải di chuyển ít nhất ngần này lượt (áp cho mọi cốc, không riêng cốc có vật). */
  minCupMoves: number;
  /** Mức sinh ngẫu nhiên: dãy dự phòng hợp lệ nếu thử `MAX_ATTEMPTS` lần vẫn chưa đạt. */
  fallback?: readonly CupShuffleMove[];
}

/** Thời gian cốc úp xuống, như nhau ở mọi mức. */
const COVER_MS = 300;

/** Số lần thử dãy ngẫu nhiên trước khi dùng dãy dự phòng (tỉ lệ đạt mỗi lần ≥ 60 %). */
const MAX_ATTEMPTS = 64;

/** Muối của luồng ngẫu nhiên dùng để xếp danh mục theo vòng (mức 3 cốc). */
const CATALOG_SALT = 0x0c5;

/**
 * Bảng Độ khó của đặc tả. Đổi số ở đây thì sửa đặc tả, test và tính lại hệ số điểm.
 *
 * Trọng số mẫu Thường là nghiệm nguyên nhỏ nhất để mọi chiến lược chỉ dựa vào ô đầu cộng tối đa
 * hai lượt đầu hoặc hai lượt cuối (không theo dõi vật) đều đúng đúng 1/3 (test kiểm bằng liệt kê).
 */
export const CUP_SHUFFLE_LEVELS: Readonly<Record<Difficulty, Readonly<LevelParams>>> = {
  0: {
    cups: 3,
    moves: 3,
    moveMs: 700,
    showMs: 900,
    items: 1,
    patterns: [
      { pattern: "ABA", weight: 1 },
      { pattern: "ABC", weight: 1 },
    ],
    rotations: [0, 0],
    minCupMoves: 1,
  },
  1: {
    cups: 3,
    moves: 5,
    moveMs: 500,
    showMs: 600,
    items: 1,
    patterns: [
      { pattern: "ABABA", weight: 4 },
      { pattern: "ABABC", weight: 2 },
      { pattern: "ABACA", weight: 1 },
      { pattern: "ABACB", weight: 1 },
      { pattern: "ABCAB", weight: 3 },
      { pattern: "ABCAC", weight: 1 },
      { pattern: "ABCBA", weight: 1 },
      { pattern: "ABCBC", weight: 2 },
    ],
    rotations: [0, 0],
    minCupMoves: 2,
  },
  2: {
    cups: 4,
    moves: 6,
    moveMs: 420,
    showMs: 600,
    items: 1,
    rotations: [1, 2],
    minCupMoves: 2,
    fallback: [
      [0, 1],
      [2, 3],
      [0, 2, 1],
      [1, 3],
      [0, 2],
      [1, 2, 3],
    ],
  },
  3: {
    cups: 5,
    moves: 7,
    moveMs: 360,
    showMs: 900,
    items: 2,
    rotations: [2, 3],
    minCupMoves: 2,
    fallback: [
      [0, 1],
      [2, 3, 4],
      [0, 2],
      [1, 3],
      [0, 4, 2],
      [1, 4],
      [2, 3],
    ],
  },
};

/** Số cốc nhiều nhất ở mọi mức: đáp án hợp lệ nằm trong [0, MAX_CUPS). */
const MAX_CUPS = Math.max(...Object.values(CUP_SHUFFLE_LEVELS).map((l) => l.cups));

/** Ô mới của vật đang ở ô `slot` sau lượt tráo `move`. */
export function cupShuffleApplyMove(slot: number, move: CupShuffleMove): number {
  const i = move.indexOf(slot);
  if (i < 0) return slot;
  return move[(i + 1) % move.length] as number;
}

/** Ô của từng vật (theo thứ tự `start`) sau `steps` lượt tráo đầu (mặc định: tráo hết). */
export function cupShuffleItemSlots(
  puzzle: Pick<CupShufflePuzzle, "start" | "moves">,
  steps = puzzle.moves.length,
): number[] {
  return puzzle.start.map((s) =>
    puzzle.moves.slice(0, steps).reduce((slot, m) => cupShuffleApplyMove(slot, m), s),
  );
}

/**
 * Chiếc cốc nào đang ở ô nào sau `steps` lượt tráo đầu: `order[ô]` = số hiệu cốc, đặt theo ô
 * ban đầu của cốc (cốc 0 đứng ở ô 0 lúc đầu). Scene dùng để biết hình cốc nào phải di chuyển.
 */
export function cupShuffleCupOrder(
  puzzle: Pick<CupShufflePuzzle, "cups" | "moves">,
  steps = puzzle.moves.length,
): number[] {
  let order = Array.from({ length: puzzle.cups }, (_, i) => i);
  for (const move of puzzle.moves.slice(0, steps)) {
    const next = [...order];
    move.forEach((from, k) => {
      next[move[(k + 1) % move.length] as number] = order[from] as number;
    });
    order = next;
  }
  return order;
}

/** Mốc bắt đầu lượt tráo `k` (ms, tính từ lúc scene hiện câu). */
export function cupShuffleMoveStartMs(
  puzzle: Pick<CupShufflePuzzle, "showMs" | "coverMs" | "moveMs">,
  k: number,
): number {
  return puzzle.showMs + puzzle.coverMs + k * puzzle.moveMs;
}

/**
 * Mốc hết tráo, bắt đầu được chạm (ms, tính từ lúc scene hiện câu). Scene và server dùng chung:
 * Mầm 3 300, Thường 3 400, Khó 3 420, Siêu khó 3 720.
 */
export function cupShuffleInputAtMs(
  puzzle: Pick<CupShufflePuzzle, "showMs" | "coverMs" | "moveMs" | "moves">,
): number {
  return cupShuffleMoveStartMs(puzzle, puzzle.moves.length);
}

/** Cùng tập ô (bất kể chiều): dùng để cấm lượt sau lặp lại hoặc hoàn tác lượt trước. */
function sameSlots(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((s) => b.includes(s));
}

/** Số lượt mà chiếc cốc ít được di chuyển nhất phải đi (theo dõi từng chiếc cốc). */
function minCupMoves(cups: number, moves: readonly CupShuffleMove[]): number {
  let order = Array.from({ length: cups }, (_, i) => i);
  const count = Array<number>(cups).fill(0);
  for (const move of moves) {
    const next = [...order];
    move.forEach((from, k) => {
      const cup = order[from] as number;
      count[cup] = (count[cup] as number) + 1;
      next[move[(k + 1) % move.length] as number] = cup;
    });
    order = next;
  }
  return Math.min(...count);
}

/** Mọi lượt tráo có thể có với `cups` cốc: đổi chỗ (a < b), rồi xoay vòng (cả hai chiều). */
function allMoves(cups: number): { swaps: CupShuffleMove[]; rotations: CupShuffleMove[] } {
  const swaps: CupShuffleMove[] = [];
  const rotations: CupShuffleMove[] = [];
  for (let a = 0; a < cups; a++) {
    for (let b = a + 1; b < cups; b++) {
      swaps.push([a, b]);
      for (let c = b + 1; c < cups; c++) {
        rotations.push([a, b, c], [a, c, b]);
      }
    }
  }
  return { swaps, rotations };
}

/** `k` vị trí đôi một không liền nhau trong [0, n), chọn đều (k ≤ ⌈n / 2⌉). */
function spreadPositions(rng: Rng, n: number, k: number): number[] {
  const picks = rng
    .shuffle(Array.from({ length: n - k + 1 }, (_, i) => i))
    .slice(0, k)
    .sort((a, b) => a - b);
  return picks.map((p, i) => p + i);
}

/** Một mục của danh mục 3 cốc: dãy tráo + ô giấu phấn, kèm trọng số. */
interface CatalogEntry {
  start: number;
  moves: CupShuffleMove[];
  weight: number;
}

interface Catalog {
  entries: CatalogEntry[];
  /** Tổng trọng số. */
  total: number;
  /** Số câu liền nhau chắc chắn không lặp (một "khối"). */
  blockSize: number;
  /** Khoảng cách giữa hai điểm lấy mẫu trên vòng trọng số, ≥ trọng số lớn nhất. */
  step: number;
}

/** Ba cặp ô của 3 cốc, và 6 cách gán chúng cho `A`, `B`, `C`. */
const SWAPS_3: readonly CupShuffleMove[] = [
  [0, 1],
  [0, 2],
  [1, 2],
];
const ASSIGNMENTS_3: readonly (readonly number[])[] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

/** Dựng danh mục từ mẫu: mỗi mẫu × 6 cách gán cặp ô × 3 ô giấu phấn. */
function buildCatalog(patterns: readonly CupShufflePattern[]): Catalog {
  const entries: CatalogEntry[] = [];
  for (const { pattern, weight } of patterns) {
    for (const assign of ASSIGNMENTS_3) {
      const moves = [...pattern].map((ch) => {
        const swap = SWAPS_3[assign[ch.charCodeAt(0) - 65] as number] as CupShuffleMove;
        return [...swap] as CupShuffleMove;
      });
      for (let start = 0; start < 3; start++) entries.push({ start, moves, weight });
    }
  }
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  const maxWeight = Math.max(...entries.map((e) => e.weight));
  const blockSize = Math.floor(total / maxWeight);
  return { entries, total, blockSize, step: Math.floor(total / blockSize) };
}

const catalogs = new Map<Difficulty, Catalog>();

function catalogOf(difficulty: Difficulty, patterns: readonly CupShufflePattern[]): Catalog {
  let catalog = catalogs.get(difficulty);
  if (!catalog) {
    catalog = buildCatalog(patterns);
    catalogs.set(difficulty, catalog);
  }
  return catalog;
}

/**
 * Lấy mẫu hệ thống theo vòng: mỗi khối `blockSize` câu xếp danh mục theo một thứ tự ngẫu nhiên
 * (theo `roundSeed`), trải trọng số các mục nối nhau trên một vòng tròn dài `total`, rồi lấy các
 * điểm `u + k × step` (u ngẫu nhiên). Mỗi câu riêng lẻ ra mục `e` với xác suất đúng bằng
 * `e.weight / total`, và vì `step` ≥ mọi trọng số nên trong một khối không mục nào ra hai lần.
 */
function pickFromCatalog(catalog: Catalog, roundSeed: number, index: number): CatalogEntry {
  const i = Math.max(0, Math.floor(index));
  const block = Math.floor(i / catalog.blockSize);
  const k = i % catalog.blockSize;
  const rng = createRng(deriveSeed(roundSeed, block, CATALOG_SALT));
  const order = rng.shuffle(catalog.entries);
  const x = (rng.int(0, catalog.total - 1) + k * catalog.step) % catalog.total;
  let acc = 0;
  for (const entry of order) {
    acc += entry.weight;
    if (x < acc) return entry;
  }
  // Không xảy ra: x < total = tổng trọng số.
  return order[order.length - 1] as CatalogEntry;
}

/**
 * Mức 4–5 cốc: dãy ngẫu nhiên, đặt trước các lượt xoay (không liền nhau), mỗi lượt khác tập ô với
 * lượt trước. Thử lại tới khi mọi chiếc cốc đều di chuyển ≥ `minCupMoves` lượt.
 */
function randomMoves(rng: Rng, level: LevelParams): CupShuffleMove[] {
  const { swaps, rotations } = allMoves(level.cups);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const count = rng.int(level.rotations[0], level.rotations[1]);
    const rotateAt = new Set(spreadPositions(rng, level.moves, count));
    const moves: CupShuffleMove[] = [];
    for (let i = 0; i < level.moves; i++) {
      const prev = moves[i - 1];
      const pool = (rotateAt.has(i) ? rotations : swaps).filter(
        (m) => !prev || !sameSlots(m, prev),
      );
      moves.push(rng.pick(pool));
    }
    if (minCupMoves(level.cups, moves) >= level.minCupMoves) return moves;
  }
  return (level.fallback ?? []).map((m) => [...m] as CupShuffleMove);
}

export const cupShuffle: MinigameDef<CupShufflePuzzle, CupShuffleAnswer> = {
  id: "cup-shuffle",
  category: "identify",
  durationMs: 60_000,

  /**
   * CR-006: mô phỏng 50 000 vòng 60 s mỗi mức theo bảng Cân bằng của đặc tả. Hệ số để điểm
   * vòng bằng Thường: Khó cần 1,46 → 1,45; Siêu khó cần 2,34 → 2,35. Mầm (trẻ 7 tuổi cần 1,40)
   * giữ 1 để hệ số không giảm khi lên mức.
   */
  difficultyMultiplier: { 0: 1, 1: 1, 2: 1.45, 3: 2.35 },

  generate(roundSeed, index, difficulty) {
    const level = CUP_SHUFFLE_LEVELS[difficulty];
    let start: number[];
    let moves: CupShuffleMove[];
    let target = 0;

    if (level.patterns) {
      const entry = pickFromCatalog(catalogOf(difficulty, level.patterns), roundSeed, index);
      start = [entry.start];
      moves = entry.moves.map((m) => [...m] as CupShuffleMove);
    } else {
      const rng = createRng(deriveSeed(roundSeed, index));
      // Dãy tráo trước, chỗ giấu sau: chỗ giấu không ảnh hưởng gì tới dãy.
      moves = randomMoves(rng, level);
      start = rng.shuffle(Array.from({ length: level.cups }, (_, i) => i)).slice(0, level.items);
      target = level.items > 1 ? rng.int(0, level.items - 1) : 0;
    }

    const slots = cupShuffleItemSlots({ start, moves });
    return {
      cups: level.cups,
      start,
      target,
      moves,
      showMs: level.showMs,
      coverMs: COVER_MS,
      moveMs: level.moveMs,
      answer: slots[target] as number,
    };
  },

  check(puzzle, answer) {
    return answer === puzzle.answer;
  },

  /** Số nguyên 0–4 (ô của cốc, 5 cốc ở mức nhiều nhất). */
  isAnswer(value): value is CupShuffleAnswer {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < MAX_CUPS;
  },

  /** CR-006: miễn trừ thưởng tốc độ = toàn bộ phần xem và tráo, lúc chưa được chạm. */
  speedAllowanceMs(puzzle) {
    return cupShuffleInputAtMs(puzzle);
  },
};
