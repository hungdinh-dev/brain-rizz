import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Bi rơi đâu (nhóm Phân tích): bảng cần gạt hình tam giác, mỗi chạc có một cần gạt hình mũi
 * tên chỉ đường bi; dưới đáy là các cốc A, B, C… Lần theo cần gạt, chạm cốc bi rơi vào.
 * Từ mức Khó có công tắc: cần gạt tự lật sang bên kia sau mỗi lần bi đi qua. Thả lần lượt
 * 2–3 bi, hỏi bi cuối.
 * Đặc tả: docs/04-minigames/marble-drop.md.
 *
 * Mọi thứ ngẫu nhiên đi qua `rng`; mọi giá trị là số nguyên hoặc boolean.
 */

/** Hướng cần gạt: 0 = chỉ trái, 1 = chỉ phải. */
export type MarbleDirection = 0 | 1;

/** Một cần gạt trên bảng. */
export interface MarbleLever {
  /** Hướng LÚC HIỆN CÂU (trước khi thả bi nào). */
  dir: MarbleDirection;
  /** true = công tắc: lật sang hướng kia ngay sau mỗi lần một bi đi qua. */
  toggle: boolean;
}

/**
 * Câu đố. Chạc đánh số theo (tầng `r`, vị trí `i`), tầng 0 ở trên cùng; tầng `r` có `r + 1`
 * chạc, `i` đếm từ trái. Bi ở chạc (r, i) đi theo cần gạt xuống chạc (r + 1, i + dir).
 * Dưới tầng cuối là `tiers + 1` cốc: bi ra khỏi chạc (tiers − 1, i) theo `dir` rơi vào cốc
 * `i + dir`. Cốc 0 là cốc A (trái nhất).
 */
export interface MarbleDropPuzzle {
  /** Số tầng cần gạt: 2 (Mầm), 3 (Thường), 4 (Khó, Siêu khó). */
  tiers: number;
  /** Số cốc = `tiers + 1`. */
  cups: number;
  /** `levers[r][i]`: cần gạt ở tầng `r`, vị trí `i` (0 ≤ i ≤ r). */
  levers: MarbleLever[][];
  /** Số bi thả lần lượt từ phễu: 1, 1, 2, 3. Bi được hỏi luôn là bi cuối (`balls − 1`). */
  balls: number;
  /**
   * Đường đi thật của từng bi theo thứ tự thả: `paths[b][r]` là vị trí chạc ở tầng `r`
   * (r = 0 … tiers − 1); phần tử cuối `paths[b][tiers]` là cốc bi rơi vào.
   * Dùng để vẽ đường bi lúc khoá sau câu sai. Hướng mỗi cần gạt lúc bi `b` đi qua suy ra từ
   * `paths[b][r + 1] − paths[b][r]`.
   */
  paths: number[][];
  /** Cốc bi cuối rơi vào, tức đáp án đúng (0 … cups − 1). */
  answer: number;
}

/** Đáp án = chỉ số cốc người chơi chạm (0 = A), gửi một lần mỗi câu. */
export type MarbleDropAnswer = number;

interface LevelParams {
  tiers: number;
  balls: number;
  /** Số công tắc trên bảng. */
  toggles: number;
}

/** Bảng Độ khó của đặc tả. Đổi số ở đây thì sửa đặc tả và test cho khớp. */
const LEVELS: Readonly<Record<Difficulty, LevelParams>> = {
  0: { tiers: 2, balls: 1, toggles: 0 },
  1: { tiers: 3, balls: 1, toggles: 0 },
  2: { tiers: 4, balls: 2, toggles: 2 },
  3: { tiers: 4, balls: 3, toggles: 3 },
};

/** Số cốc nhiều nhất ở mọi mức: chỉ số cốc hợp lệ nằm trong [0, MAX_CUPS). */
const MAX_CUPS = Math.max(...DIFFICULTIES.map((d) => LEVELS[d].tiers + 1));

/** Số lần thử ngẫu nhiên để trúng cốc đích trước khi nhận một câu hợp lệ bất kỳ. */
const MAX_ATTEMPTS = 400;

/**
 * Hệ số điểm riêng của game (CR-006), tính bằng mô phỏng vòng 60 s ở mục Cân bằng của đặc tả:
 * mỗi mức chọn sao cho người chơi mục tiêu được điểm vòng xấp xỉ người lớn ở Thường. Mầm tính
 * ra 1,64 cho trẻ 7 tuổi nhưng bị chặn ở 1 (quy tắc chung CR-006: Mầm = min(mô phỏng, 1)).
 * Khó và Siêu khó cao vì mỗi câu dài gấp 1,8 / 2,6 lần Thường (2 / 3 bi phải lần theo).
 */
const MULTIPLIER_BY_DIFFICULTY: Readonly<Record<Difficulty, number>> = {
  0: 1,
  1: 1,
  2: 2.65,
  3: 4.45,
};

/**
 * Miễn trừ thưởng tốc độ (CR-006): phần thời gian lần theo bi dài hơn mức Thường, tính bằng
 * thời gian giải dự kiến của mức trừ của Thường (2,5 s). Cấu trúc câu cố định theo mức.
 */
const ALLOWANCE_MS_BY_DIFFICULTY: Readonly<Record<Difficulty, number>> = {
  0: 0,
  1: 0,
  2: 2_000,
  3: 4_000,
};

/**
 * Thả lần lượt `balls` bi qua bảng, tính đường đi và cốc của từng bi. Hàm thuần: không sửa
 * `levers`. Scene có thể dùng để dựng lại trạng thái cần gạt sau mỗi bi.
 */
export function simulateMarbleDrop(
  levers: readonly (readonly MarbleLever[])[],
  balls: number,
): number[][] {
  const dirs = levers.map((row) => row.map((lever) => lever.dir as number));
  const paths: number[][] = [];
  for (let b = 0; b < balls; b++) {
    let pos = 0;
    const path = [pos];
    for (let r = 0; r < levers.length; r++) {
      const dir = dirs[r]![pos]!;
      if (levers[r]![pos]!.toggle) dirs[r]![pos] = 1 - dir;
      pos += dir;
      path.push(pos);
    }
    paths.push(path);
  }
  return paths;
}

/**
 * Hướng của mọi cần gạt ngay trước khi thả bi `ball` (0 = bi đầu, tức bảng lúc hiện câu).
 * Scene dùng để vẽ công tắc đã lật lúc khoá sau câu sai: hướng khác `levers[r][i].dir` là đã lật.
 */
export function marbleLeverDirsBefore(
  levers: readonly (readonly MarbleLever[])[],
  paths: readonly (readonly number[])[],
  ball: number,
): MarbleDirection[][] {
  return levers.map((row, r) =>
    row.map((lever, i) => {
      if (!lever.toggle) return lever.dir;
      let passes = 0;
      for (let b = 0; b < ball; b++) if (paths[b]![r] === i) passes++;
      return (passes % 2 === 1 ? 1 - lever.dir : lever.dir) as MarbleDirection;
    }),
  );
}

/**
 * Số công tắc ĐÃ LẬT (khác hướng lúc hiện câu) mà bi `ball` đi qua, tức số chỗ người chơi
 * phải nhớ lật cần gạt khi lần theo bi đó. Dùng cho luật sinh câu và để đo độ khó.
 */
export function marbleFlippedOnPath(
  levers: readonly (readonly MarbleLever[])[],
  paths: readonly (readonly number[])[],
  ball: number,
): number {
  let count = 0;
  const path = paths[ball]!;
  for (let r = 0; r < levers.length; r++) {
    const pos = path[r]!;
    if (!levers[r]![pos]!.toggle) continue;
    // Số lần bi trước đi qua chạc này; lẻ thì cần gạt đang ở hướng ngược lúc hiện câu.
    let passes = 0;
    for (let b = 0; b < ball; b++) if (paths[b]![r] === pos) passes++;
    if (passes % 2 === 1) count++;
  }
  return count;
}

/** Bảng ngẫu nhiên: mọi cần gạt chỉ hướng ngẫu nhiên, `toggles` chạc ngẫu nhiên là công tắc. */
function randomBoard(rng: Rng, level: LevelParams): MarbleLever[][] {
  const levers: MarbleLever[][] = [];
  const slots: [number, number][] = [];
  for (let r = 0; r < level.tiers; r++) {
    const row: MarbleLever[] = [];
    for (let i = 0; i <= r; i++) {
      row.push({ dir: rng.int(0, 1) as MarbleDirection, toggle: false });
      slots.push([r, i]);
    }
    levers.push(row);
  }
  for (const [r, i] of rng.shuffle(slots).slice(0, level.toggles)) levers[r]![i]!.toggle = true;
  return levers;
}

/**
 * Luật của một câu hợp lệ (đặc tả, mục Đảm bảo). Câu 1 bi luôn hợp lệ. Câu nhiều bi:
 * bi cuối đi qua ít nhất một công tắc đã lật, và rơi vào cốc khác MỌI bi trước — nên ai quên
 * công tắc (lần theo bảng lúc hiện câu, ra cốc bi 1) hay quên một bi luôn chọn sai.
 */
function isValid(levers: MarbleLever[][], paths: number[][]): boolean {
  const last = paths.length - 1;
  if (last === 0) return true;
  const tiers = levers.length;
  const answer = paths[last]![tiers]!;
  for (let b = 0; b < last; b++) if (paths[b]![tiers] === answer) return false;
  return marbleFlippedOnPath(levers, paths, last) >= 1;
}

/**
 * Câu dự phòng khi rủi ro không tìm được câu hợp lệ trong `MAX_ATTEMPTS` lần (test 10.000 seed
 * cho thấy không xảy ra). Dựng tay, đã kiểm hợp lệ trong test; `mirror` = bản lật gương.
 */
export function marbleFallbackBoard(difficulty: Difficulty, mirror: boolean): MarbleLever[][] {
  const level = LEVELS[difficulty];
  // Mọi cần gạt chỉ trái; công tắc ở (0,0), (1,0), (2,1), lấy đủ số của mức. Bi 1 rơi cốc A;
  // bi 2 bị đỉnh (đã lật) đẩy sang phải, rơi cốc B; bi 3 gặp (1,0) và (2,1) đã lật, rơi cốc C.
  const toggleSlots = [
    [0, 0],
    [1, 0],
    [2, 1],
  ].slice(0, level.toggles);
  const levers: MarbleLever[][] = [];
  for (let r = 0; r < level.tiers; r++) {
    const row: MarbleLever[] = [];
    for (let i = 0; i <= r; i++) {
      const toggle = toggleSlots.some(([tr, ti]) => tr === r && ti === i);
      row.push({ dir: 0, toggle });
    }
    // Lật gương: vị trí i ↔ r − i, hướng trái ↔ phải.
    levers.push(mirror ? row.reverse().map((l) => ({ dir: 1, toggle: l.toggle })) : row);
  }
  return levers;
}

interface Board {
  levers: MarbleLever[][];
  paths: number[][];
}

/**
 * Tính chẵn lẻ của bảng = số cần gạt chỉ phải, lấy mod 2. Câu chẵn dùng bảng chẵn, câu lẻ dùng
 * bảng lẻ, nên hai câu liền nhau không bao giờ cùng bảng (Mầm chỉ có 8 bảng; không chặn thì
 * ~14 % câu giống hệt câu vừa xong). Chặn theo chẵn lẻ chỉ cần chính `index`, không phải dựng
 * lại câu trước. Mỗi lớp chẵn / lẻ vẫn có bảng cho mọi cốc, và người chơi không nhận ra.
 */
export function marbleBoardParity(levers: readonly (readonly MarbleLever[])[]): number {
  let rights = 0;
  for (const row of levers) for (const lever of row) rights += lever.dir;
  return rights % 2;
}

/**
 * Bảng của câu thứ `index`. Chọn cốc đích trước để mọi cốc là đáp án với tần suất như nhau
 * (thả ngẫu nhiên thì cốc giữa ra nhiều hơn hẳn cốc mép, đoán "cốc giữa" sẽ lời), rồi thử bảng
 * ngẫu nhiên tới khi đúng chẵn lẻ, hợp lệ và trúng đích.
 */
function buildBoard(roundSeed: number, index: number, difficulty: Difficulty): Board {
  const level = LEVELS[difficulty];
  const parity = index % 2;
  const rng = createRng(deriveSeed(roundSeed, index));
  const target = rng.int(0, level.tiers);
  let chosen: Board | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const levers = randomBoard(rng, level);
    if (marbleBoardParity(levers) !== parity) continue;
    const paths = simulateMarbleDrop(levers, level.balls);
    if (!isValid(levers, paths)) continue;
    if (paths[level.balls - 1]![level.tiers] === target) return { levers, paths };
    chosen ??= { levers, paths };
  }
  if (chosen) return chosen;

  const levers = marbleFallbackBoard(difficulty, rng.int(0, 1) === 1);
  const paths = simulateMarbleDrop(levers, level.balls);
  if (marbleBoardParity(levers) !== parity) {
    // Đổi chẵn lẻ bằng cách lật một cần gạt không bi nào đi qua (bảng dự phòng luôn có ở tầng
    // cuối), nên đường bi và đáp án giữ nguyên.
    const r = level.tiers - 1;
    const i = levers[r]!.findIndex((_, pos) => paths.every((path) => path[r] !== pos));
    const lever = levers[r]![i]!;
    lever.dir = (1 - lever.dir) as MarbleDirection;
  }
  return { levers, paths };
}

export const marbleDrop: MinigameDef<MarbleDropPuzzle, MarbleDropAnswer> = {
  id: "marble-drop",
  category: "analyze",
  durationMs: 60_000,
  difficultyMultiplier: MULTIPLIER_BY_DIFFICULTY,

  generate(roundSeed, index, difficulty) {
    const level = LEVELS[difficulty];
    const { levers, paths } = buildBoard(roundSeed, index, difficulty);
    return {
      tiers: level.tiers,
      cups: level.tiers + 1,
      levers,
      balls: level.balls,
      paths,
      answer: paths[level.balls - 1]![level.tiers]!,
    };
  },

  check(puzzle, answer) {
    return answer === puzzle.answer;
  },

  /** Số nguyên 0 … 4 (giới hạn lấy từ số cốc nhiều nhất trong bảng tham số). */
  isAnswer(value): value is MarbleDropAnswer {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < MAX_CUPS;
  },

  /** CR-006: hằng số theo mức, không phụ thuộc câu đố. */
  speedAllowanceMs(_puzzle, difficulty) {
    return ALLOWANCE_MS_BY_DIFFICULTY[difficulty];
  },
};
