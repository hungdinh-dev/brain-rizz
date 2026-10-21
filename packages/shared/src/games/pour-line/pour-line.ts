import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Rót vừa vạch (nhóm Hình dung): giữ để rót nước vào bình thí nghiệm, buông tay khi nước chạm
 * vạch. Một câu = một lần giữ; đáp án là số ms người chơi giữ tay (client đo). Server tính lại mức
 * nước từ số ms đó bằng `pourLineLevelAt` (chỉ số nguyên) và so với vạch, lệch không quá dung sai.
 * Ở Khó trở lên bình loe/thót/hình lạ nên nước dâng không đều; Siêu khó che nửa trên bình.
 * Đặc tả: docs/04-minigames/pour-line.md.
 *
 * Mọi thứ ngẫu nhiên đi qua `createRng`, không dùng Math.random() hay Date.now().
 */

/** Chiều cao bình theo đơn vị mức nước: 0 = đáy, 1 000 = miệng bình. */
export const POUR_LINE_HEIGHT = 1_000;
/** Số lát cao của bình (từ đáy lên). Mỗi lát có một bề rộng nguyên. */
export const POUR_LINE_SLICES = 40;
/** Chiều cao một lát = 1 000 / 40 = 25 đơn vị mức nước (2,5 % chiều cao). */
export const POUR_LINE_SLICE_H = 25;
/** Bề rộng lớn nhất của một lát (= bề rộng vùng vẽ bình). */
export const POUR_LINE_WIDTH_MAX = 1_000;
/** Giới hạn đáp án (ms). Bình nào cũng tràn trước mốc này rất xa nên giữ lâu hơn là dữ liệu rác. */
export const POUR_LINE_MAX_HOLD_MS = 10_000;

/** Kiểu bình, để FE chọn nét vẽ: ống thẳng, cốc loe (rộng dần lên), bình thót (hẹp dần lên), bình lạ. */
export type PourLineShape = "tube" | "flare" | "taper" | "odd";

export interface PourLinePuzzle {
  shape: PourLineShape;
  /**
   * Bề rộng từng lát từ đáy lên (`POUR_LINE_SLICES` số nguyên trong 1 … `POUR_LINE_WIDTH_MAX`).
   * Lát `i` phủ mức nước `[25·i, 25·(i+1))`. Thể tích một lát = bề rộng × 25.
   */
  vessel: number[];
  /** Mức nước của vạch (đơn vị 1/1 000 chiều cao bình). */
  target: number;
  /** Dung sai: đúng khi `|mức nước − target| ≤ tol`. */
  tol: number;
  /** Thể tích rót mỗi ms (số nguyên ≥ 1, không đổi suốt lần giữ). */
  flow: number;
  /** Từ mức này trở lên bị che (Siêu khó: 500); `null` = không che. */
  hideFrom: number | null;
  /** Ms đầu tiên nước chạm vạch (mức ≥ target): đáp án tham chiếu, luôn nằm trong khoảng đúng. */
  idealHoldMs: number;
  /** Khoảng giữ tay được chấm đúng, tính cả hai đầu: `[holdMinMs, holdMaxMs]`. */
  holdMinMs: number;
  holdMaxMs: number;
  /** Ms đầu tiên nước chạm miệng bình (mức = 1 000): FE tự buông và gửi ở mốc này (chắc chắn sai). */
  fullMs: number;
}

/** Đáp án = số ms giữ tay (số nguyên, 0 … `POUR_LINE_MAX_HOLD_MS`), đo bằng đồng hồ của client. */
export type PourLineAnswer = number;

/** Vạch được chọn theo bước này (5 đơn vị = 0,5 % chiều cao). */
const TARGET_STEP = 5;
/** Số lần sinh lại bình khi không có vạch nào đạt ràng buộc (chủ yếu bình lạ của Siêu khó). */
const MAX_TRIES = 30;
/** Bề rộng nhỏ nhất của bình loe / thót / lạ, để cổ bình vẫn nhìn rõ nước. */
const NECK_MIN = 250;
/** Bình lạ: hai điểm điều khiển liền nhau chênh ít nhất ngần này mới tính là phình/thắt. */
const ODD_STEP = 150;
/** Bình lạ: chênh giữa chỗ rộng nhất và hẹp nhất ít nhất ngần này. */
const ODD_RANGE = 400;

interface Level {
  shapes: readonly PourLineShape[];
  /** Bề rộng ống thẳng [nhỏ nhất, lớn nhất] (chỉ cho `tube`). */
  tubeWidth: readonly [number, number];
  /** Thời gian rót đầy bình (ms) [nhỏ nhất, lớn nhất]; quyết định `flow`. */
  fullMs: readonly [number, number];
  tol: number;
  /** Vạch nằm trong [nhỏ nhất, lớn nhất] (đơn vị mức nước). */
  target: readonly [number, number];
  /** Khoảng giữ đúng phải rộng ít nhất ngần này ms. */
  minWindowMs: number;
  /** Khoảng giữ đúng rộng nhất (ms), để vạch ở chỗ bình phình không thành quá dễ. */
  maxWindowMs: number;
  hideFrom: number | null;
  /** Siêu khó: thời gian nước dâng khuất sau tấm che tới vạch (ms) [nhỏ nhất, lớn nhất]. */
  hiddenMs: readonly [number, number];
}

const LEVELS: Readonly<Record<Difficulty, Level>> = {
  0: {
    shapes: ["tube"],
    tubeWidth: [500, 650],
    fullMs: [2_800, 3_200],
    tol: 80,
    target: [300, 800],
    minWindowMs: 300,
    maxWindowMs: POUR_LINE_MAX_HOLD_MS,
    hideFrom: null,
    hiddenMs: [0, 0],
  },
  1: {
    shapes: ["tube"],
    tubeWidth: [400, 600],
    fullMs: [1_800, 2_200],
    tol: 50,
    target: [300, 850],
    minWindowMs: 160,
    maxWindowMs: POUR_LINE_MAX_HOLD_MS,
    hideFrom: null,
    hiddenMs: [0, 0],
  },
  2: {
    shapes: ["flare", "taper"],
    tubeWidth: [0, 0],
    fullMs: [1_700, 2_100],
    tol: 50,
    target: [300, 850],
    minWindowMs: 140,
    maxWindowMs: POUR_LINE_MAX_HOLD_MS,
    hideFrom: null,
    hiddenMs: [0, 0],
  },
  3: {
    shapes: ["odd"],
    tubeWidth: [0, 0],
    fullMs: [2_400, 3_000],
    tol: 70,
    target: [600, 850],
    minWindowMs: 200,
    maxWindowMs: 450,
    hideFrom: 500,
    hiddenMs: [300, 1_500],
  },
};

/** ⌈a / b⌉ cho số nguyên a ≥ 0, b > 0 (thương nhỏ nên phép chia số thực ra đúng phần nguyên). */
const ceilDiv = (a: number, b: number): number => Math.floor((a + b - 1) / b);

/**
 * Mức nước (0 … 1 000, số nguyên) sau `holdMs` ms giữ tay. Hàm thuần, chỉ số nguyên:
 * thể tích đã rót = `flow × ⌊holdMs⌋`, đổ đầy từng lát từ đáy lên; trong lát `i` mức nước tăng
 * 1 đơn vị mỗi `vessel[i]` thể tích (làm tròn xuống). Quá miệng bình thì giữ ở 1 000.
 * Đơn điệu không giảm theo `holdMs`. Scene dùng chính hàm này để vẽ nước (không tự viết lại).
 */
export function pourLineLevelAt(
  puzzle: Pick<PourLinePuzzle, "vessel" | "flow">,
  holdMs: number,
): number {
  if (!(holdMs > 0)) return 0;
  let rest = puzzle.flow * Math.floor(Math.min(holdMs, POUR_LINE_MAX_HOLD_MS));
  for (let i = 0; i < puzzle.vessel.length; i++) {
    const w = puzzle.vessel[i] as number;
    const cap = w * POUR_LINE_SLICE_H;
    // rest < 25·w nên thương < 25: phép chia số thực cho ra đúng phần nguyên.
    if (rest < cap) return i * POUR_LINE_SLICE_H + Math.floor(rest / w);
    rest -= cap;
  }
  return POUR_LINE_HEIGHT;
}

/** Thể tích cần rót để nước đạt đúng mức `level` (số nguyên 0 … 1 000). */
export function pourLineVolumeAt(vessel: readonly number[], level: number): number {
  const full = Math.floor(level / POUR_LINE_SLICE_H);
  let v = 0;
  for (let i = 0; i < full && i < vessel.length; i++) {
    v += (vessel[i] as number) * POUR_LINE_SLICE_H;
  }
  if (full < vessel.length) v += (vessel[full] as number) * (level - full * POUR_LINE_SLICE_H);
  return v;
}

/** Ms giữ tay ít nhất để nước đạt mức `level`: mức ≥ `level` ⟺ holdMs ≥ giá trị này. */
export function pourLineMsToReach(vessel: readonly number[], flow: number, level: number): number {
  return ceilDiv(pourLineVolumeAt(vessel, level), flow);
}

/**
 * Bề rộng 40 lát nội suy tuyến tính qua 5 điểm điều khiển ở mức 0, 250, 500, 750, 1 000
 * (lấy tại giữa mỗi lát, làm tròn). Mỗi đoạn giữa hai điểm điều khiển = 10 lát.
 */
function profile(control: readonly number[]): number[] {
  const perSeg = POUR_LINE_SLICES / (control.length - 1);
  const out: number[] = [];
  for (let i = 0; i < POUR_LINE_SLICES; i++) {
    const k = Math.floor(i / perSeg);
    const j = i - k * perSeg;
    const a = control[k] as number;
    const b = control[k + 1] as number;
    out.push(a + Math.round(((b - a) * (2 * j + 1)) / (2 * perSeg)));
  }
  return out;
}

/** Dãy điểm điều khiển có cả chỗ phình lẫn chỗ thắt rõ: dấu hiệu "bình lạ". */
function isOdd(control: readonly number[]): boolean {
  let up = false;
  let down = false;
  for (let k = 1; k < control.length; k++) {
    const d = (control[k] as number) - (control[k - 1] as number);
    if (d >= ODD_STEP) up = true;
    if (d <= -ODD_STEP) down = true;
  }
  return up && down && Math.max(...control) - Math.min(...control) >= ODD_RANGE;
}

/**
 * Bình dự phòng của từng mức (điểm điều khiển), dùng khi `MAX_TRIES` lần sinh liên tiếp không có
 * vạch nào hợp lệ. Test kiểm mỗi bình này luôn có vạch hợp lệ ở mọi tốc độ rót của mức.
 */
const FALLBACK: Readonly<Record<Difficulty, { shape: PourLineShape; control: number[] }>> = {
  0: { shape: "tube", control: [550, 550, 550, 550, 550] },
  1: { shape: "tube", control: [500, 500, 500, 500, 500] },
  2: { shape: "taper", control: [900, 750, 600, 450, 300] },
  // Bình cầu cổ dài: đáy vừa, bụng phình, cổ thắt, miệng loe nhẹ.
  3: { shape: "odd", control: [600, 1_000, 700, 450, 650] },
};

function makeVessel(
  rng: Rng,
  level: Level,
  difficulty: Difficulty,
): { shape: PourLineShape; vessel: number[] } {
  const shape = rng.pick(level.shapes);
  if (shape === "tube") {
    const w = rng.int(level.tubeWidth[0], level.tubeWidth[1]);
    return { shape, vessel: Array.from({ length: POUR_LINE_SLICES }, () => w) };
  }
  if (shape === "flare" || shape === "taper") {
    const narrow = rng.int(NECK_MIN, 400);
    const wide = rng.int(800, POUR_LINE_WIDTH_MAX);
    const [bottom, top] = shape === "flare" ? [narrow, wide] : [wide, narrow];
    const control = [0, 1, 2, 3, 4].map((k) => bottom + Math.round(((top - bottom) * k) / 4));
    return { shape, vessel: profile(control) };
  }
  // Bình lạ: 5 điểm điều khiển ngẫu nhiên, phải có chỗ phình và chỗ thắt rõ.
  for (let t = 0; t < MAX_TRIES; t++) {
    const control = Array.from({ length: 5 }, () => rng.int(NECK_MIN, POUR_LINE_WIDTH_MAX));
    if (isOdd(control)) return { shape, vessel: profile(control) };
  }
  return { shape, vessel: profile(FALLBACK[difficulty].control) };
}

interface Candidate {
  target: number;
  idealHoldMs: number;
  holdMinMs: number;
  holdMaxMs: number;
}

/** Các vạch hợp lệ của một bình + tốc độ rót, theo bước `TARGET_STEP`. */
function candidates(vessel: readonly number[], flow: number, level: Level): Candidate[] {
  const out: Candidate[] = [];
  const reachHide = level.hideFrom === null ? 0 : pourLineMsToReach(vessel, flow, level.hideFrom);
  for (let target = level.target[0]; target <= level.target[1]; target += TARGET_STEP) {
    const holdMinMs = pourLineMsToReach(vessel, flow, target - level.tol);
    const holdMaxMs = pourLineMsToReach(vessel, flow, target + level.tol + 1) - 1;
    const width = holdMaxMs - holdMinMs + 1;
    if (width < level.minWindowMs || width > level.maxWindowMs) continue;
    const idealHoldMs = pourLineMsToReach(vessel, flow, target);
    if (level.hideFrom !== null) {
      // Cả khoảng đúng nằm sau tấm che; thời gian nước dâng khuất tới vạch không quá ngắn/dài.
      if (target - level.tol < level.hideFrom) continue;
      const hidden = idealHoldMs - reachHide;
      if (hidden < level.hiddenMs[0] || hidden > level.hiddenMs[1]) continue;
    }
    out.push({ target, idealHoldMs, holdMinMs, holdMaxMs });
  }
  return out;
}

/** Tốc độ rót (thể tích/ms, số nguyên ≥ 1) để bình đầy sau khoảng `fullMs` ms. */
function flowFor(vessel: readonly number[], fullMs: number): number {
  return Math.max(1, Math.round(pourLineVolumeAt(vessel, POUR_LINE_HEIGHT) / fullMs));
}

/**
 * Bình dự phòng của mức `difficulty` với thời gian rót đầy `fullMs`, kèm danh sách vạch hợp lệ.
 * Chỉ để test kiểm nhánh dự phòng luôn sinh được câu.
 */
export function pourLineFallback(difficulty: Difficulty, fullMs: number) {
  const { shape, control } = FALLBACK[difficulty];
  const vessel = profile(control);
  const flow = flowFor(vessel, fullMs);
  return { shape, vessel, flow, candidates: candidates(vessel, flow, LEVELS[difficulty]) };
}

function build(
  shape: PourLineShape,
  vessel: number[],
  flow: number,
  level: Level,
  c: Candidate,
): PourLinePuzzle {
  return {
    shape,
    vessel,
    target: c.target,
    tol: level.tol,
    flow,
    hideFrom: level.hideFrom,
    idealHoldMs: c.idealHoldMs,
    holdMinMs: c.holdMinMs,
    holdMaxMs: c.holdMaxMs,
    fullMs: pourLineMsToReach(vessel, flow, POUR_LINE_HEIGHT),
  };
}

export const pourLine: MinigameDef<PourLinePuzzle, PourLineAnswer> = {
  id: "pour-line",
  category: "visualize",
  durationMs: 60_000,

  // Đặc tả, mục Cân bằng: mô phỏng 20 000 vòng 60 s mỗi mức. Mầm theo trần chung = min(…, 1).
  difficultyMultiplier: { 0: 1, 1: 1, 2: 1.4, 3: 2.55 },

  generate(roundSeed, index, difficulty) {
    const level = LEVELS[difficulty];
    const rng = createRng(deriveSeed(roundSeed, index));
    for (let t = 0; t < MAX_TRIES; t++) {
      const { shape, vessel } = makeVessel(rng, level, difficulty);
      const flow = flowFor(vessel, rng.int(level.fullMs[0], level.fullMs[1]));
      const list = candidates(vessel, flow, level);
      if (list.length > 0) return build(shape, vessel, flow, level, rng.pick(list));
    }
    // Không gặp khi đo 10 000 seed × 4 mức; giữ để generate luôn trả câu hợp lệ.
    const fb = pourLineFallback(difficulty, rng.int(level.fullMs[0], level.fullMs[1]));
    return build(fb.shape, fb.vessel, fb.flow, level, rng.pick(fb.candidates));
  },

  check(puzzle, answer) {
    return Math.abs(pourLineLevelAt(puzzle, answer) - puzzle.target) <= puzzle.tol;
  },

  isAnswer(value): value is PourLineAnswer {
    return (
      Number.isInteger(value) &&
      (value as number) >= 0 &&
      (value as number) <= POUR_LINE_MAX_HOLD_MS
    );
  },

  // Thời gian giữ tay bắt buộc (mép dưới khoảng đúng) không tính vào thưởng tốc độ.
  speedAllowanceMs(puzzle) {
    return puzzle.holdMinMs;
  },
};
