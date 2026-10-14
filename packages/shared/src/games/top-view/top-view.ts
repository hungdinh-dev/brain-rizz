import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";
import { isoCountInterpretations, isoHiddenTopHalves, isoPicture, samePicture } from "./iso";
import {
  edgePairs,
  type Grid,
  getPool4,
  getShiftPool,
  getTetrominoPlacements,
  MIRROR,
  popcount,
  ROTATE_CCW,
  ROTATE_CW,
  TETROMINO_CLASSES,
  transformGrid,
} from "./patterns";

/**
 * Nhìn từ trên (nhóm Hình dung): trên cùng là mô hình khối lập phương xếp trên bệ vuông, vẽ
 * isometric, mép trước của bệ tô cam. Người chơi chạm vào hình chiếu nhìn thẳng từ trên xuống
 * (mép trước ở dưới). Đặc tả: docs/04-minigames/top-view.md.
 *
 * Mọi thứ ngẫu nhiên đi qua `rng`. Bộ sinh có vòng thử lại (tối đa `MAX_ATTEMPTS` lần) để mô hình
 * đạt luật "nhìn là hiểu"; số lần gọi `rng` vì thế đổi theo seed nhưng vẫn tất định.
 */

/**
 * Lựa chọn là gì so với hình chiếu đúng (FE dùng để chọn phản hồi khi sai; không được hiện trước
 * khi chạm):
 * - `"answer"`: hình chiếu đúng.
 * - `"mirror"`: hình chiếu đúng lật gương trái–phải (từ Thường).
 * - `"rotation"`: hình chiếu đúng xoay 90° (Khó); `"rotation-mirror"`: gương của nó.
 * - `"shifted"`: hình chiếu đúng dời một ô sang ô trống liền cạnh (Thường); `"shifted-mirror"`.
 * - `"swapped"`: hình chiếu đúng đổi số tầng của hai ô liền cạnh (Siêu khó); `"swapped-mirror"`.
 * - `"other"`: hình 4 ô khác họ (Mầm).
 */
export type TopViewChoiceKind =
  | "answer"
  | "mirror"
  | "rotation"
  | "rotation-mirror"
  | "shifted"
  | "shifted-mirror"
  | "swapped"
  | "swapped-mirror"
  | "other";

export interface TopViewChoice {
  /**
   * Lưới hình chiếu `grid[r][c]`, cùng cỡ với bệ; hàng r = n − 1 nằm sát vạch cam (mép trước).
   * 0 = ô trống. Ô có khối: Mầm, Thường luôn là 1 (chỉ tô ô); Khó, Siêu khó là số tầng để ghi
   * lên ô.
   */
  grid: number[][];
  kind: TopViewChoiceKind;
}

export interface TopViewPuzzle {
  /** Cạnh bệ (số ô): 3 ở Mầm, Thường; 4 ở Khó, Siêu khó. */
  size: number;
  /**
   * Mô hình: `heights[r][c]` = số khối chồng ở ô (c, r), 0 là ô trống. c tính từ trái sang phải
   * khi đứng ở mép trước nhìn vào; r = 0 là hàng xa nhất, r = size − 1 là hàng sát mép trước.
   */
  heights: number[][];
  /** Thẻ lựa chọn có ghi số tầng không (Khó, Siêu khó). */
  showHeights: boolean;
  /** 3 lựa chọn (Mầm) hoặc 4, theo thứ tự trên màn hình: trái → phải, trên → dưới. */
  choices: TopViewChoice[];
  /** Chỉ số lựa chọn đúng trong `choices`. */
  answerIndex: number;
}

/** Đáp án = chỉ số thẻ người chơi chạm (số nguyên 0–3). */
export type TopViewAnswer = number;

export const TOP_VIEW_MAX_CHOICES = 4;

export interface TopViewLevel {
  /** Cạnh bệ. */
  size: number;
  /** Số tầng cao nhất; mô hình nào cũng có ít nhất một cột cao đúng chừng này. */
  maxHeight: number;
  /** Số cột (ô có khối) nhỏ nhất và lớn nhất. */
  minColumns: number;
  maxColumns: number;
  /** Số lựa chọn. */
  choices: number;
  showHeights: boolean;
}

export const TOP_VIEW_LEVELS: Readonly<Record<Difficulty, TopViewLevel>> = {
  0: { size: 3, maxHeight: 2, minColumns: 4, maxColumns: 4, choices: 3, showHeights: false },
  1: { size: 3, maxHeight: 3, minColumns: 5, maxColumns: 6, choices: 4, showHeights: false },
  2: { size: 4, maxHeight: 3, minColumns: 8, maxColumns: 10, choices: 4, showHeights: true },
  3: { size: 4, maxHeight: 4, minColumns: 11, maxColumns: 13, choices: 4, showHeights: true },
};

/**
 * Khi đếm cách hiểu khác của hình vẽ, cho mỗi cột cao tới số tầng cao nhất của mức + 1, để chắc
 * chắn người chơi không hiểu nhầm cả khi tưởng có cột cao hơn mức cho phép.
 */
const INTERPRETATION_SLACK = 1;

/** Số lần thử sinh mô hình trước khi dùng mô hình dự phòng (thực tế không bao giờ tới). */
const MAX_ATTEMPTS = 40;

/** Một khối để vẽ: ô (c, r), tầng h (0 là tầng sát bệ). */
export interface TopViewCube {
  c: number;
  r: number;
  h: number;
}

/**
 * Các khối của mô hình theo đúng thứ tự vẽ (thuật toán người hoạ sĩ): độ sâu c + r + h tăng dần,
 * cùng độ sâu thì theo r, rồi c. Khối vẽ sau đè khối vẽ trước. FE vẽ bệ trước rồi lần lượt từng khối.
 */
export function topViewCubes(heights: readonly (readonly number[])[]): TopViewCube[] {
  const out: TopViewCube[] = [];
  for (let r = 0; r < heights.length; r++) {
    for (let c = 0; c < heights.length; c++) {
      for (let h = 0; h < heights[r]![c]!; h++) out.push({ c, r, h });
    }
  }
  return out.sort((a, b) => a.c + a.r + a.h - (b.c + b.r + b.h) || a.r - b.r || a.c - b.c);
}

function emptyGrid(n: number): Grid {
  return Array.from({ length: n }, () => new Array<number>(n).fill(0));
}

function maskToGrid(mask: number, n: number): Grid {
  const g = emptyGrid(n);
  for (let i = 0; i < n * n; i++) if ((mask >> i) & 1) g[Math.floor(i / n)]![i % n] = 1;
  return g;
}

function occupancy(heights: Grid): Grid {
  return heights.map((row) => row.map((h) => (h > 0 ? 1 : 0)));
}

/**
 * Gán số tầng cho các ô của `mask`, từ ô gần người nhìn nhất (c + r lớn) vào trong: mỗi ô chọn ngẫu
 * nhiên trong các chiều cao làm mặt trên của nó lộ ít nhất một nửa, xét các ô phía trước đã gán
 * (chỉ ô phía trước mới che được). Chiều cao `maxHeight` luôn hợp lệ nên luôn chọn được.
 */
function assignHeights(rng: Rng, mask: number, n: number, maxHeight: number): Grid {
  const g = emptyGrid(n);
  const order: number[] = [];
  for (let i = 0; i < n * n; i++) if ((mask >> i) & 1) order.push(i);
  order.sort((a, b) => (b % n) + Math.floor(b / n) - ((a % n) + Math.floor(a / n)) || a - b);
  for (const i of order) {
    const c = i % n;
    const r = Math.floor(i / n);
    const ok: number[] = [];
    for (let h = 1; h <= maxHeight; h++) if (isoHiddenTopHalves(g, c, r, h) < 2) ok.push(h);
    g[r]![c] = rng.pick(ok);
  }
  return g;
}

/** Mô hình đạt luật: có cột cao đúng `maxHeight`, và hình vẽ chỉ hiểu được một cách. */
function isClearModel(heights: Grid, maxHeight: number): boolean {
  let top = 0;
  for (const row of heights) for (const h of row) if (h > top) top = h;
  if (top !== maxHeight) return false;
  return isoCountInterpretations(heights, maxHeight + INTERPRETATION_SLACK) === 1;
}

/**
 * Mô hình dự phòng mỗi mức, đã kiểm trong test là đạt luật. Chỉ dùng nếu `MAX_ATTEMPTS` lần thử
 * đều hỏng (xác suất không đáng kể), để `generate` luôn kết thúc.
 */
const FALLBACK_MODELS: Readonly<Record<Difficulty, Grid>> = {
  0: [
    [2, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
  ],
  1: [
    [0, 3, 2],
    [1, 1, 0],
    [0, 1, 0],
  ],
  2: [
    [3, 2, 1, 0],
    [2, 0, 1, 0],
    [1, 1, 1, 0],
    [1, 0, 0, 0],
  ],
  3: [
    [4, 3, 2, 1],
    [3, 0, 2, 0],
    [2, 1, 1, 1],
    [1, 1, 0, 0],
  ],
};

function arrange(
  rng: Rng,
  n: number,
  heights: Grid,
  showHeights: boolean,
  list: TopViewChoice[],
): TopViewPuzzle {
  const order = rng.shuffle(list.map((_, i) => i));
  return {
    size: n,
    heights,
    showHeights,
    choices: order.map((i) => list[i]!),
    answerIndex: order.indexOf(0),
  };
}

/** Mầm: mô hình là hình 4 ô họ L, T hoặc S; hai lựa chọn còn lại là hai họ kia. */
function generateSeedling(rng: Rng, attempts: number): TopViewPuzzle {
  const { size: n, maxHeight } = TOP_VIEW_LEVELS[0];
  const placements = getTetrominoPlacements();
  let heights: Grid | undefined;
  // Chọn họ một lần, ngoài vòng thử lại, để ba họ làm đáp án đều nhau.
  let cls = rng.pick(TETROMINO_CLASSES);
  for (let a = 0; a < attempts && !heights; a++) {
    const h = assignHeights(rng, rng.pick(placements[cls]), n, maxHeight);
    if (isClearModel(h, maxHeight)) heights = h;
  }
  if (!heights) {
    heights = FALLBACK_MODELS[0].map((row) => [...row]);
    cls = "L";
  }
  const list: TopViewChoice[] = [{ grid: occupancy(heights), kind: "answer" }];
  for (const other of TETROMINO_CLASSES) {
    if (other !== cls)
      list.push({ grid: maskToGrid(rng.pick(placements[other]), n), kind: "other" });
  }
  return arrange(rng, n, heights, false, list);
}

/** Thường: hai cặp gương, (đáp án, gương) và (đáp án dời 1 ô, gương của nó). */
function generateNormal(rng: Rng, attempts: number): TopViewPuzzle {
  const { size: n, maxHeight, minColumns, maxColumns } = TOP_VIEW_LEVELS[1];
  let heights: Grid | undefined;
  let moves: [number, number][] = [];
  const pool = getShiftPool(rng.int(minColumns, maxColumns));
  for (let a = 0; a < attempts && !heights; a++) {
    const pattern = rng.pick(pool);
    const h = assignHeights(rng, pattern.mask, n, maxHeight);
    if (isClearModel(h, maxHeight)) {
      heights = h;
      moves = pattern.moves;
    }
  }
  if (!heights) {
    heights = FALLBACK_MODELS[1].map((row) => [...row]);
    const mask = toMask(heights);
    moves = getShiftPool(popcount(mask)).find((p) => p.mask === mask)!.moves;
  }
  const answer = occupancy(heights);
  const [from, to] = rng.pick(moves);
  const shifted = answer.map((row) => [...row]);
  shifted[Math.floor(from / n)]![from % n] = 0;
  shifted[Math.floor(to / n)]![to % n] = 1;
  return arrange(rng, n, heights, false, [
    { grid: answer, kind: "answer" },
    { grid: transformGrid(answer, MIRROR), kind: "mirror" },
    { grid: shifted, kind: "shifted" },
    { grid: transformGrid(shifted, MIRROR), kind: "shifted-mirror" },
  ]);
}

function toMask(heights: Grid): number {
  const n = heights.length;
  let mask = 0;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) if (heights[r]![c]! > 0) mask |= 1 << (r * n + c);
  return mask;
}

/**
 * Sinh mô hình 4 × 4 cho Khó, Siêu khó. `extra` kiểm thêm điều kiện riêng của mức và trả về dữ liệu
 * kèm theo (undefined = mô hình hỏng, thử lại).
 */
function model4<T>(
  rng: Rng,
  difficulty: 2 | 3,
  attempts: number,
  extra: (h: Grid) => T | undefined,
): [Grid, T] {
  const { size: n, maxHeight, minColumns, maxColumns } = TOP_VIEW_LEVELS[difficulty];
  const pool = getPool4(rng.int(minColumns, maxColumns));
  for (let a = 0; a < attempts; a++) {
    const mask = rng.pick(pool);
    const h = assignHeights(rng, mask, n, maxHeight);
    if (!isClearModel(h, maxHeight)) continue;
    const data = extra(h);
    if (data !== undefined) return [h, data];
  }
  const h = FALLBACK_MODELS[difficulty].map((row) => [...row]);
  const data = extra(h);
  if (data === undefined) throw new Error("top-view: mô hình dự phòng không đạt luật");
  return [h, data];
}

/** Mọi lựa chọn sai, coi như một mô hình, đều phải vẽ ra khác mô hình thật. */
function drawsDifferently(heights: Grid, others: Grid[]): boolean {
  const picture = isoPicture(heights);
  return others.every((g) => !samePicture(picture, isoPicture(g)));
}

/** Khó: (đáp án, gương) và (đáp án xoay 90°, gương của nó); chiều xoay ngẫu nhiên. */
function generateHard(rng: Rng, attempts: number): TopViewPuzzle {
  const [heights] = model4(rng, 2, attempts, (h) =>
    drawsDifferently(
      h,
      [MIRROR, ROTATE_CW, ROTATE_CCW, MIRROR + ROTATE_CW, MIRROR + ROTATE_CCW].map((t) =>
        transformGrid(h, t),
      ),
    )
      ? true
      : undefined,
  );
  const turn = rng.int(0, 1) === 0 ? ROTATE_CW : ROTATE_CCW;
  const rotated = transformGrid(heights, turn);
  return arrange(rng, 4, heights, true, [
    { grid: heights.map((row) => [...row]), kind: "answer" },
    { grid: transformGrid(heights, MIRROR), kind: "mirror" },
    { grid: rotated, kind: "rotation" },
    { grid: transformGrid(rotated, MIRROR), kind: "rotation-mirror" },
  ]);
}

function swap(heights: Grid, i: number, j: number): Grid {
  const n = heights.length;
  const out = heights.map((row) => [...row]);
  out[Math.floor(i / n)]![i % n] = heights[Math.floor(j / n)]![j % n]!;
  out[Math.floor(j / n)]![j % n] = heights[Math.floor(i / n)]![i % n]!;
  return out;
}

/**
 * Chọn cặp ô để đổi số tầng: hai ô liền cạnh, đều có khối, khác số tầng (`rng.pick` theo thứ tự
 * `edgePairs`). Cặp nào đổi xong vẽ ra y hệt mô hình thì bỏ, chọn lại. Không còn cặp nào: undefined.
 */
function pickSwap(rng: Rng, heights: Grid): Grid | undefined {
  const n = heights.length;
  const at = (i: number) => heights[Math.floor(i / n)]![i % n]!;
  const pairs = edgePairs(n).filter(([i, j]) => at(i) > 0 && at(j) > 0 && at(i) !== at(j));
  while (pairs.length > 0) {
    const k = rng.int(0, pairs.length - 1);
    const [i, j] = pairs[k]!;
    const swapped = swap(heights, i, j);
    if (drawsDifferently(heights, [swapped, transformGrid(swapped, MIRROR)])) return swapped;
    pairs.splice(k, 1);
  }
  return undefined;
}

/** Siêu khó: (đáp án, gương) và (đáp án đổi số tầng hai ô liền cạnh, gương của nó). */
function generateExpert(rng: Rng, attempts: number): TopViewPuzzle {
  const [heights, swapped] = model4(rng, 3, attempts, (h) =>
    drawsDifferently(h, [transformGrid(h, MIRROR)]) ? pickSwap(rng, h) : undefined,
  );
  return arrange(rng, 4, heights, true, [
    { grid: heights.map((row) => [...row]), kind: "answer" },
    { grid: transformGrid(heights, MIRROR), kind: "mirror" },
    { grid: swapped, kind: "swapped" },
    { grid: transformGrid(swapped, MIRROR), kind: "swapped-mirror" },
  ]);
}

/** Sinh câu đố; `attempts` chỉ để test ép dùng mô hình dự phòng. */
export function generateTopView(
  roundSeed: number,
  index: number,
  difficulty: Difficulty,
  attempts = MAX_ATTEMPTS,
): TopViewPuzzle {
  const rng = createRng(deriveSeed(roundSeed, index));
  switch (difficulty) {
    case 0:
      return generateSeedling(rng, attempts);
    case 1:
      return generateNormal(rng, attempts);
    case 2:
      return generateHard(rng, attempts);
    default:
      return generateExpert(rng, attempts);
  }
}

export const topView: MinigameDef<TopViewPuzzle, TopViewAnswer> = {
  id: "top-view",
  category: "visualize",
  // CR-006: vòng 60 giây cho game mới, để Siêu khó vẫn còn ≥ 8 câu mỗi vòng.
  durationMs: 60_000,
  // CR-006: mô phỏng từ bảng Cân bằng của đặc tả; Mầm = min(mô phỏng cho trẻ 7 tuổi, 1).
  difficultyMultiplier: { 0: 0.75, 1: 1, 2: 1.85, 3: 2.9 },
  // Không khai báo `speedAllowanceMs`: không có pha trình chiếu, một chạm là xong (đặc tả).

  generate(roundSeed, index, difficulty) {
    return generateTopView(roundSeed, index, difficulty);
  },

  check(puzzle, answer) {
    return answer === puzzle.answerIndex;
  },

  isAnswer(value): value is TopViewAnswer {
    return (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value < TOP_VIEW_MAX_CHOICES
    );
  },
};
