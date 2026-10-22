import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Nối mạch (nhóm Hình dung): lưới mảnh dây nối pin tới bóng đèn, còn thiếu 1 ô (Siêu khó: 2 ô).
 * Chọn thẻ mảnh dây (Siêu khó: cặp mảnh) làm đèn sáng; đúng một thẻ làm được.
 * Đặc tả: docs/04-minigames/circuit-link.md.
 *
 * Mảnh dây là bitmask cổng (số nguyên): Bắc 1, Đông 2, Nam 4, Tây 8. Hai ô kề nhau thông khi cả
 * hai cùng mở cổng về phía nhau. Mọi thứ ngẫu nhiên đi qua `rng`; mọi giá trị là số nguyên.
 */

/** Cổng Bắc (lên). */
export const CIRCUIT_N = 1;
/** Cổng Đông (phải). */
export const CIRCUIT_E = 2;
/** Cổng Nam (xuống). */
export const CIRCUIT_S = 4;
/** Cổng Tây (trái). */
export const CIRCUIT_W = 8;

const DIRS: readonly number[] = [CIRCUIT_N, CIRCUIT_E, CIRCUIT_S, CIRCUIT_W];

/** Loại mảnh theo số cổng: `blank` = ô không có dây (0), `end` = đầu cụt (1 cổng). */
export type CircuitTileKind = "blank" | "end" | "straight" | "corner" | "tee" | "cross";

/** Pin hoặc bóng đèn: gắn ở mép lưới, cạnh ô `cell`, phía `side` (một cổng hướng ra ngoài lưới). */
export interface CircuitLinkTerminal {
  cell: number;
  side: number;
}

export interface CircuitLinkPuzzle {
  /** Cạnh lưới: 3 (Mầm), 4 (Thường), 5 (Khó, Siêu khó). */
  size: number;
  /**
   * `size × size` mảnh, theo hàng: ô (x, y) ở `tiles[y * size + x]`, (0, 0) ở góc trên trái.
   * Bitmask cổng; 0 = ô không có dây. Ô thiếu (`missing`) cũng là 0.
   */
  tiles: number[];
  battery: CircuitLinkTerminal;
  bulb: CircuitLinkTerminal;
  /** Ô thiếu: 1 ô (Mầm–Khó) hoặc 2 ô (Siêu khó), theo thứ tự dọc đường từ pin tới đèn. */
  missing: number[];
  /**
   * Thẻ đáp án: 3 (Mầm) hoặc 4. Mỗi thẻ là mảng `missing.length` mảnh: `options[k][j]` đặt
   * vào ô `missing[j]`. Thứ tự thẻ là thứ tự trên màn hình.
   */
  options: number[][];
  /** Thẻ duy nhất làm đèn sáng. */
  answerIndex: number;
  /** Các ô của đường chính theo thứ tự pin → đèn (kể cả ô thiếu), để FE vẽ dòng điện chạy. */
  path: number[];
}

/** Đáp án = chỉ số thẻ người chơi chạm (0–3), gửi một lần mỗi câu. */
export type CircuitLinkAnswer = number;

/** Số thẻ nhiều nhất ở mọi mức. */
export const CIRCUIT_LINK_MAX_OPTIONS = 4;

const STRAIGHTS = [CIRCUIT_N | CIRCUIT_S, CIRCUIT_E | CIRCUIT_W] as const;
const CORNERS = [
  CIRCUIT_N | CIRCUIT_E,
  CIRCUIT_E | CIRCUIT_S,
  CIRCUIT_S | CIRCUIT_W,
  CIRCUIT_W | CIRCUIT_N,
] as const;
/** Ngã ba, thiếu lần lượt cổng N, E, S, W. */
const TEES = [14, 13, 11, 7] as const;
const ENDS = DIRS;

interface LevelParams {
  size: number;
  /** Số ô của đường chính [min, max]. */
  pathLen: readonly [number, number];
  /** Số khúc cua trên đường chính [min, max], tính cả ô đầu và ô cuối. */
  corners: readonly [number, number];
  /** Xác suất (%) đi thẳng khi đi thẳng được, lúc vẽ đường. */
  straightBias: number;
  /** Số nhánh cụt mọc từ một ô 2 cổng của đường chính (không phải ô thiếu) [min, max]. */
  branches: readonly [number, number];
  /** Xác suất (%) mỗi ô thiếu mọc thêm một nhánh cụt (đáp án ở ô đó thành ngã ba). */
  teeGapChance: number;
  /** Số ô thiếu. */
  gaps: 1 | 2;
  /** Số thẻ. */
  options: number;
  /** Số lần thử đặt mảnh nhiễu vào ô trống. */
  noise: number;
  /** Kho mảnh nhiễu. */
  noiseTiles: readonly number[];
  /** Mảnh nhiễu không được chạm dây khác hay chĩa vào ô thiếu (chỉ để lưới bớt trống). */
  isolatedNoise: boolean;
  /** Ô thiếu luôn là khúc cua (Thường). */
  cornerGap: boolean;
  /** Mỗi ô thiếu có ≥ 1 cổng mồi: dây chĩa vào ô thiếu nhưng không nối về pin hay đèn. */
  decoy: boolean;
  /** Kho mảnh để chọn thẻ nhiễu. */
  optionPool: readonly number[];
  /**
   * Cách chọn thẻ nhiễu sao cho không đoán được bằng cách đếm loại mảnh trên thẻ:
   * - `mix2` (Mầm): 3 thẻ thuộc 2 loại; thẻ lẻ loại là đáp án đúng 1/3 số câu.
   * - `corners` (Thường): đủ 4 hướng khúc cua.
   * - `mix3` (Khó): 4 thẻ đủ 3 loại (thẳng, cua, ngã ba), một loại có 2 thẻ; đáp án nằm trong
   *   cặp cùng loại đúng 1/2 số câu.
   * - `pairs` (Siêu khó): bảng 2 × 2 (đáp án hoặc mảnh sai ở mỗi ô thiếu).
   */
  optionMode: "mix2" | "corners" | "mix3" | "pairs";
}

/** Bảng Độ khó của đặc tả. Đổi số ở đây thì sửa đặc tả và test cho khớp. */
const LEVELS: Readonly<Record<Difficulty, LevelParams>> = {
  0: {
    size: 3,
    pathLen: [3, 5],
    corners: [0, 1],
    straightBias: 70,
    branches: [0, 0],
    teeGapChance: 0,
    gaps: 1,
    options: 3,
    noise: 0,
    noiseTiles: [],
    isolatedNoise: true,
    cornerGap: false,
    decoy: false,
    optionPool: [...STRAIGHTS, ...CORNERS],
    optionMode: "mix2",
  },
  1: {
    size: 4,
    pathLen: [6, 10],
    corners: [3, 4],
    straightBias: 50,
    branches: [0, 0],
    teeGapChance: 0,
    gaps: 1,
    options: 4,
    noise: 2,
    noiseTiles: [...STRAIGHTS, ...CORNERS],
    isolatedNoise: true,
    cornerGap: true,
    decoy: false,
    optionPool: CORNERS,
    optionMode: "corners",
  },
  2: {
    size: 5,
    pathLen: [8, 12],
    corners: [4, 5],
    straightBias: 45,
    branches: [1, 2],
    teeGapChance: 30,
    gaps: 1,
    options: 4,
    noise: 5,
    noiseTiles: [...ENDS, ...STRAIGHTS, ...CORNERS, ...TEES],
    isolatedNoise: false,
    cornerGap: false,
    decoy: true,
    optionPool: [...STRAIGHTS, ...CORNERS, ...TEES],
    optionMode: "mix3",
  },
  3: {
    size: 5,
    pathLen: [9, 13],
    corners: [5, 6],
    straightBias: 40,
    branches: [1, 2],
    teeGapChance: 25,
    gaps: 2,
    options: 4,
    noise: 6,
    noiseTiles: [...ENDS, ...STRAIGHTS, ...CORNERS, ...TEES],
    isolatedNoise: false,
    cornerGap: false,
    decoy: true,
    optionPool: [...STRAIGHTS, ...CORNERS, ...TEES],
    optionMode: "pairs",
  },
};

/**
 * Số lần thử ngẫu nhiên trước khi dùng câu dự phòng. Đo 200 000 seed mỗi mức: trung bình 3–16 lần,
 * nhiều nhất 181 lần (Siêu khó), chưa lần nào phải dùng câu dự phòng.
 */
const MAX_ATTEMPTS = 400;

/**
 * Hệ số điểm riêng của game (CR-006), tính bằng mô phỏng vòng 60 s ở mục Cân bằng của đặc tả:
 * mỗi mức chọn sao cho người chơi mục tiêu được điểm vòng xấp xỉ người lớn ở Thường. Mầm tính
 * ra hơn 1 cho trẻ 7 tuổi nên bị chặn ở 1 (Mầm = min(mô phỏng, 1)).
 */
const MULTIPLIER_BY_DIFFICULTY: Readonly<Record<Difficulty, number>> = {
  0: 1,
  1: 1,
  2: 1.95,
  3: 3.25,
};

/** Cổng đối diện: N ↔ S, E ↔ W. */
function opposite(d: number): number {
  return d < CIRCUIT_S ? d << 2 : d >> 2;
}

/** Ô kề phía `d` của ô `cell`, hoặc −1 nếu ra ngoài lưới. */
function neighbor(size: number, cell: number, d: number): number {
  const x = cell % size;
  const y = (cell - x) / size;
  if (d === CIRCUIT_N) return y > 0 ? cell - size : -1;
  if (d === CIRCUIT_S) return y < size - 1 ? cell + size : -1;
  if (d === CIRCUIT_E) return x < size - 1 ? cell + 1 : -1;
  return x > 0 ? cell - 1 : -1;
}

/** Hướng từ ô `from` sang ô kề `to`. */
function dirTo(size: number, from: number, to: number): number {
  return DIRS.find((d) => neighbor(size, from, d) === to) ?? 0;
}

function popcount(t: number): number {
  let n = 0;
  for (const d of DIRS) if (t & d) n++;
  return n;
}

/** Loại mảnh theo bitmask cổng. */
export function circuitTileKind(tile: number): CircuitTileKind {
  const n = popcount(tile);
  if (n === 0) return "blank";
  if (n === 1) return "end";
  if (n === 3) return "tee";
  if (n === 4) return "cross";
  return tile === 5 || tile === 10 ? "straight" : "corner";
}

/**
 * Các ô có điện khi nối từ `terminal` (pin hoặc đèn): loang qua những cặp ô kề nhau cùng mở cổng
 * về phía nhau. Ô gắn `terminal` phải mở cổng `terminal.side`. FE dùng để vẽ dòng điện dừng ở đâu.
 */
export function circuitLinkPowered(
  size: number,
  tiles: readonly number[],
  terminal: CircuitLinkTerminal,
): boolean[] {
  const powered = new Array<boolean>(size * size).fill(false);
  if ((tiles[terminal.cell]! & terminal.side) === 0) return powered;
  powered[terminal.cell] = true;
  const stack = [terminal.cell];
  while (stack.length > 0) {
    const c = stack.pop()!;
    const t = tiles[c]!;
    for (const d of DIRS) {
      if ((t & d) === 0) continue;
      const n = neighbor(size, c, d);
      if (n < 0 || powered[n] || (tiles[n]! & opposite(d)) === 0) continue;
      powered[n] = true;
      stack.push(n);
    }
  }
  return powered;
}

interface Board {
  size: number;
  battery: CircuitLinkTerminal;
  bulb: CircuitLinkTerminal;
  missing: readonly number[];
}

function isLit(b: Board, tiles: readonly number[]): boolean {
  return (
    (tiles[b.bulb.cell]! & b.bulb.side) !== 0 &&
    circuitLinkPowered(b.size, tiles, b.battery)[b.bulb.cell] === true
  );
}

function placed(b: Board, tiles: readonly number[], fills: readonly number[]): number[] {
  const out = tiles.slice();
  b.missing.forEach((cell, j) => {
    out[cell] = fills[j] ?? 0;
  });
  return out;
}

/** Lưới sau khi đặt các mảnh `fills` vào ô thiếu (`fills[j]` vào `missing[j]`). */
export function circuitLinkFill(puzzle: CircuitLinkPuzzle, fills: readonly number[]): number[] {
  return placed(puzzle, puzzle.tiles, fills);
}

/** Đèn có sáng không khi đặt `fills` vào các ô thiếu. */
export function circuitLinkLights(puzzle: CircuitLinkPuzzle, fills: readonly number[]): boolean {
  return isLit(puzzle, circuitLinkFill(puzzle, fills));
}

/**
 * Cổng mồi của ô thiếu thứ `j`: các hướng có ô kề chĩa dây vào ô thiếu nhưng không nối về pin
 * hay đèn (các ô thiếu khác đặt đúng đáp án). Dùng để đo độ khó và cho FE đánh dấu dây cụt.
 */
export function circuitLinkDecoyPorts(
  puzzle: Pick<CircuitLinkPuzzle, "size" | "tiles" | "battery" | "bulb" | "missing">,
  answer: readonly number[],
  j: number,
): number[] {
  const gap = puzzle.missing[j]!;
  const tiles = placed(puzzle, puzzle.tiles, answer);
  tiles[gap] = 0;
  const fromBattery = circuitLinkPowered(puzzle.size, tiles, puzzle.battery);
  const fromBulb = circuitLinkPowered(puzzle.size, tiles, puzzle.bulb);
  return DIRS.filter((d) => {
    const n = neighbor(puzzle.size, gap, d);
    return (
      n >= 0 && (tiles[n]! & opposite(d)) !== 0 && fromBattery[n] !== true && fromBulb[n] !== true
    );
  });
}

/** Các cổng của ô `cell` hướng ra ngoài lưới (chỉ pin và đèn được nối ra ngoài). */
function outward(size: number, cell: number): number {
  return DIRS.filter((d) => neighbor(size, cell, d) < 0).reduce((m, d) => m | d, 0);
}

/** Mọi chỗ gắn pin/đèn ở mép lưới: (ô mép, phía hướng ra ngoài). */
function borderSlots(size: number): CircuitLinkTerminal[] {
  const slots: CircuitLinkTerminal[] = [];
  for (let cell = 0; cell < size * size; cell++) {
    for (const side of DIRS) if (neighbor(size, cell, side) < 0) slots.push({ cell, side });
  }
  return slots;
}

interface Route {
  cells: number[];
  entry: number;
  exit: number;
}

/** Đường chính: đi ngẫu nhiên không cắt mình từ một chỗ gắn pin tới một ô mép. */
function randomRoute(rng: Rng, level: LevelParams): Route | null {
  const { size } = level;
  const start = rng.pick(borderSlots(size));
  const len = rng.int(level.pathLen[0], level.pathLen[1]);
  const visited = new Array<boolean>(size * size).fill(false);
  const cells = [start.cell];
  visited[start.cell] = true;
  let heading = opposite(start.side);
  while (cells.length < len) {
    const cur = cells[cells.length - 1]!;
    const free = DIRS.filter((d) => {
      const n = neighbor(size, cur, d);
      return n >= 0 && !visited[n];
    });
    if (free.length === 0) return null;
    const turns = free.filter((d) => d !== heading);
    const straight = free.includes(heading);
    const d =
      straight && (turns.length === 0 || rng.int(0, 99) < level.straightBias)
        ? heading
        : rng.pick(turns);
    const next = neighbor(size, cur, d);
    visited[next] = true;
    cells.push(next);
    heading = d;
  }
  const last = cells[cells.length - 1]!;
  const outs = DIRS.filter((d) => neighbor(size, last, d) < 0);
  if (outs.length === 0) return null;
  const exit = rng.pick(outs);
  return { cells, entry: start.side, exit };
}

/** Mảnh của từng ô trên đường chính (cổng về ô trước + cổng sang ô sau). */
function routeTiles(size: number, route: Route): number[] {
  const tiles = new Array<number>(size * size).fill(0);
  const { cells } = route;
  cells.forEach((c, i) => {
    const back = i === 0 ? route.entry : dirTo(size, c, cells[i - 1]!);
    const fwd = i === cells.length - 1 ? route.exit : dirTo(size, c, cells[i + 1]!);
    tiles[c] = back | fwd;
  });
  return tiles;
}

/** Cổng của ô `cell` có dây chĩa vào: ô kề mở cổng về phía nó, hoặc pin/đèn gắn ở phía đó. */
function inboundPorts(b: Board, tiles: readonly number[], cell: number): number {
  let mask = 0;
  for (const d of DIRS) {
    const n = neighbor(b.size, cell, d);
    const wired =
      n >= 0
        ? (tiles[n]! & opposite(d)) !== 0
        : (b.battery.cell === cell && b.battery.side === d) ||
          (b.bulb.cell === cell && b.bulb.side === d);
    if (wired) mask |= d;
  }
  return mask;
}

/**
 * Chọn `n` thẻ nhiễu khác nhau trong `cands`, ưu tiên thẻ chạm ≥ 1 dây chĩa vào ô thiếu (`inb`)
 * để thẻ nào cũng đáng cân nhắc. `null` nếu không đủ.
 */
function pickFrom(rng: Rng, cands: readonly number[], inb: number, n: number): number[] | null {
  if (cands.length < n) return null;
  const touching = cands.filter((t) => (t & inb) !== 0);
  return rng.shuffle(touching.length >= n ? touching : cands).slice(0, n);
}

/** Thẻ nhiễu cho câu 1 ô thiếu, theo `optionMode` (xem `LevelParams`). */
function pickSingleDistractors(
  rng: Rng,
  level: LevelParams,
  ans: number,
  failing: readonly number[],
  inb: number,
): number[] | null {
  const of = (kind: CircuitTileKind) => failing.filter((t) => circuitTileKind(t) === kind);
  const ansKind = circuitTileKind(ans);
  if (level.optionMode === "corners") {
    return failing.length === level.options - 1 ? rng.shuffle(failing) : null;
  }
  if (level.optionMode === "mix2") {
    const other = of(ansKind === "straight" ? "corner" : "straight");
    if (rng.int(0, 2) === 0) return pickFrom(rng, other, inb, 2);
    const same = pickFrom(rng, of(ansKind), inb, 1);
    const diff = pickFrom(rng, other, inb, 1);
    return same && diff ? [...same, ...diff] : null;
  }
  // mix3: đủ 3 loại, một loại 2 thẻ.
  const [x, y] = rng.shuffle(
    (["straight", "corner", "tee"] as const).filter((k) => k !== ansKind),
  ) as [CircuitTileKind, CircuitTileKind];
  if (rng.int(0, 1) === 0) {
    const picks = [of(ansKind), of(x), of(y)].map((c) => pickFrom(rng, c, inb, 1));
    return picks.every((p) => p !== null) ? picks.flatMap((p) => p ?? []) : null;
  }
  // Đáp án lẻ loại: loại `x` có 2 thẻ (đổi sang `y` nếu `x` không đủ).
  const [two, one] = of(x).length >= 2 ? [x, y] : [y, x];
  const pair = pickFrom(rng, of(two), inb, 2);
  const single = pickFrom(rng, of(one), inb, 1);
  return pair && single ? [...pair, ...single] : null;
}

/**
 * Mảnh sai cho một ô thiếu ở Siêu khó. Đáp án là ngã ba: mảnh sai cùng loại 1/2. Đáp án 2 cổng:
 * ngã ba 1/5, cùng loại 2/5, loại 2 cổng còn lại 2/5. Tỉ lệ này giữ cho "chọn cặp nhiều cổng
 * nhất" hay "ít cổng nhất" không đoán trúng hơn hẳn 1/4. `null` nếu không có mảnh hợp.
 */
function pickPairWrong(
  rng: Rng,
  ans: number,
  failing: readonly number[],
  inb: number,
): number | null {
  const ansKind = circuitTileKind(ans);
  let kinds: CircuitTileKind[];
  if (ansKind === "tee") {
    kinds = rng.int(0, 1) === 0 ? ["tee"] : ["straight", "corner"];
  } else {
    const r = rng.int(0, 4);
    const other = ansKind === "straight" ? "corner" : "straight";
    kinds = r === 0 ? ["tee"] : r <= 2 ? [ansKind] : [other];
  }
  const cands = failing.filter((t) => kinds.includes(circuitTileKind(t)));
  return pickFrom(rng, cands, inb, 1)?.[0] ?? null;
}

/** Một lần thử sinh câu; `null` nếu không thoả luật (gọi lại với cùng `rng`). */
function attempt(rng: Rng, level: LevelParams): CircuitLinkPuzzle | null {
  const { size } = level;
  const route = randomRoute(rng, level);
  if (!route) return null;
  const path = route.cells;
  const tiles = routeTiles(size, route);
  const corners = path.filter((c) => circuitTileKind(tiles[c]!) === "corner").length;
  if (corners < level.corners[0] || corners > level.corners[1]) return null;

  const occupied = new Array<boolean>(size * size).fill(false);
  for (const c of path) occupied[c] = true;
  const blankNeighbors = (cell: number) =>
    DIRS.filter((d) => {
      const n = neighbor(size, cell, d);
      return n >= 0 && !occupied[n];
    });

  // 1. Ô thiếu, sắp theo thứ tự trên đường.
  const order = path.map((_, i) => i);
  let gapIdx: number[];
  if (level.cornerGap) {
    const cornerIdx = order.filter((i) => circuitTileKind(tiles[path[i]!]!) === "corner");
    gapIdx = [rng.pick(cornerIdx)];
  } else {
    gapIdx = rng
      .shuffle(order)
      .slice(0, level.gaps)
      .sort((a, b) => a - b);
  }
  const missing = gapIdx.map((i) => path[i]!);

  // 2. Nhánh cụt: biến một ô 2 cổng thành ngã ba, mọc ra 1–2 ô trống, ô cuối là đầu cụt.
  const grow = (root: number): void => {
    const free = blankNeighbors(root);
    if (popcount(tiles[root]!) !== 2 || free.length === 0) return;
    let d = rng.pick(free);
    tiles[root]! |= d;
    let cur = neighbor(size, root, d);
    const len = rng.int(1, 2);
    for (let k = 0; ; k++) {
      occupied[cur] = true;
      tiles[cur] = opposite(d);
      const more = blankNeighbors(cur);
      if (k + 1 >= len || more.length === 0) break;
      d = rng.pick(more);
      tiles[cur]! |= d;
      cur = neighbor(size, cur, d);
    }
  };
  if (level.teeGapChance > 0) {
    for (const gap of missing) if (rng.int(0, 99) < level.teeGapChance) grow(gap);
  }
  const branchCount = rng.int(level.branches[0], level.branches[1]);
  for (let b = 0; b < branchCount; b++) {
    const roots = path.filter(
      (c) => popcount(tiles[c]!) === 2 && !missing.includes(c) && blankNeighbors(c).length > 0,
    );
    if (roots.length === 0) break;
    grow(rng.pick(roots));
  }

  const answer = missing.map((c) => tiles[c]!);
  const board: Board = {
    size,
    battery: { cell: path[0]!, side: route.entry },
    bulb: { cell: path[path.length - 1]!, side: route.exit },
    missing,
  };
  const grid = tiles.slice();
  for (const c of missing) grid[c] = 0;

  /** Luật bất biến: đáp án làm đèn sáng, bỏ trống bất kỳ ô thiếu nào thì đèn tắt. */
  const valid = () =>
    isLit(board, placed(board, grid, answer)) &&
    missing.every(
      (_, j) =>
        !isLit(
          board,
          placed(
            board,
            grid,
            answer.map((t, k) => (k === j ? 0 : t)),
          ),
        ),
    );
  if (!valid()) return null;

  /** Mảnh nhiễu Thường: không chĩa vào ô có dây hay ô thiếu, không ô nào chĩa vào nó. */
  const isolated = (cell: number): boolean =>
    DIRS.every((d) => {
      const n = neighbor(size, cell, d);
      if (n < 0) return true;
      if ((grid[cell]! & d) !== 0 && (grid[n] !== 0 || missing.includes(n))) return false;
      return (grid[n]! & opposite(d)) === 0;
    });

  // 3. Mảnh nhiễu ở ô trống.
  for (let k = 0; k < level.noise; k++) {
    const blanks = grid.map((_, c) => c).filter((c) => !occupied[c]);
    if (blanks.length === 0) break;
    const cell = rng.pick(blanks);
    grid[cell] = rng.pick(level.noiseTiles);
    const offGrid = (grid[cell]! & outward(size, cell)) !== 0;
    if (offGrid || (level.isolatedNoise && !isolated(cell)) || !valid()) grid[cell] = 0;
    else occupied[cell] = true;
  }

  // 4. Cổng mồi: ô thiếu nào chưa có thì đặt một mảnh 2 cổng ở ô trống kề, chĩa vào ô thiếu.
  if (level.decoy) {
    const probe = { size, tiles: grid, battery: board.battery, bulb: board.bulb, missing };
    for (let j = 0; j < missing.length; j++) {
      if (circuitLinkDecoyPorts(probe, answer, j).length > 0) continue;
      for (const d of rng.shuffle(blankNeighbors(missing[j]!))) {
        const cell = neighbor(size, missing[j]!, d);
        const back = opposite(d);
        grid[cell] =
          back | rng.pick(DIRS.filter((x) => x !== back && neighbor(size, cell, x) >= 0));
        if (valid() && circuitLinkDecoyPorts(probe, answer, j).includes(d)) {
          occupied[cell] = true;
          break;
        }
        grid[cell] = 0;
      }
      if (circuitLinkDecoyPorts(probe, answer, j).length === 0) return null;
    }
  }

  // 5. Thẻ: thẻ nhiễu chỉ lấy trong các mảnh đã thử bằng BFS là không làm đèn sáng.
  const lights = (fills: readonly number[]) => isLit(board, placed(board, grid, fills));
  let options: number[][];
  if (level.gaps === 1) {
    const ans = answer[0]!;
    const failing = level.optionPool.filter((t) => t !== ans && !lights([t]));
    const inb = inboundPorts(board, grid, missing[0]!);
    const picked = pickSingleDistractors(rng, level, ans, failing, inb);
    if (!picked || picked.length !== level.options - 1) return null;
    options = [ans, ...picked].map((t) => [t]);
  } else {
    // Siêu khó: bảng 2 × 2 gồm đáp án và 1 mảnh sai cho mỗi ô thiếu, nên mảnh nào cũng xuất
    // hiện đúng 2 lần, không đoán được bằng cách đếm mảnh lặp lại.
    const wrong = answer.map((a, j) => {
      const others = answer.map((x, k) => (k === j ? 0 : x));
      const inb = inboundPorts(board, placed(board, grid, others), missing[j]!);
      const failing = level.optionPool.filter(
        (t) => t !== a && !lights(answer.map((x, k) => (k === j ? t : x))),
      );
      return pickPairWrong(rng, a, failing, inb);
    });
    const [a0, a1] = answer as [number, number];
    const [w0, w1] = wrong;
    if (w0 == null || w1 == null) return null;
    options = [
      [a0, a1],
      [a0, w1],
      [w0, a1],
      [w0, w1],
    ];
  }
  if (options.slice(1).some((o) => lights(o))) return null;

  const shuffled = rng.shuffle(options.map((_, i) => i));
  return {
    size,
    tiles: grid,
    battery: board.battery,
    bulb: board.bulb,
    missing,
    options: shuffled.map((i) => options[i]!),
    answerIndex: shuffled.indexOf(0),
    path,
  };
}

/**
 * Câu dự phòng khi rủi ro không sinh được câu hợp lệ trong `MAX_ATTEMPTS` lần (chưa xảy ra ở
 * 200 000 seed mỗi mức). Chép cố định từ chính bộ sinh (seed 42, câu 0); test kiểm vẫn đúng luật.
 */
const FALLBACK: Readonly<Record<Difficulty, CircuitLinkPuzzle>> = {
  0: {
    size: 3,
    tiles: [10, 10, 0, 0, 0, 0, 0, 0, 0],
    battery: { cell: 0, side: CIRCUIT_W },
    bulb: { cell: 2, side: CIRCUIT_E },
    missing: [2],
    options: [[10], [6], [12]],
    answerIndex: 0,
    path: [0, 1, 2],
  },
  1: {
    size: 4,
    tiles: [6, 9, 0, 0, 5, 0, 0, 0, 0, 10, 10, 10, 0, 0, 0, 0],
    battery: { cell: 1, side: CIRCUIT_N },
    bulb: { cell: 11, side: CIRCUIT_E },
    missing: [8],
    options: [[9], [6], [3], [12]],
    answerIndex: 2,
    path: [1, 0, 4, 8, 9, 10, 11],
  },
  2: {
    size: 5,
    tiles: [0, 0, 0, 10, 0, 0, 6, 9, 0, 0, 1, 7, 14, 12, 9, 0, 1, 1, 5, 0, 0, 0, 0, 3, 10],
    battery: { cell: 24, side: CIRCUIT_E },
    bulb: { cell: 2, side: CIRCUIT_N },
    missing: [2],
    options: [[5], [11], [14], [6]],
    answerIndex: 0,
    path: [24, 23, 18, 13, 12, 11, 6, 7, 2],
  },
  3: {
    size: 5,
    tiles: [5, 0, 12, 0, 0, 5, 5, 0, 0, 0, 3, 0, 14, 10, 8, 1, 6, 9, 4, 0, 3, 0, 14, 9, 0],
    battery: { cell: 0, side: CIRCUIT_N },
    bulb: { cell: 22, side: CIRCUIT_S },
    missing: [11, 21],
    options: [
      [10, 3],
      [7, 9],
      [10, 9],
      [7, 3],
    ],
    answerIndex: 0,
    path: [0, 5, 10, 11, 12, 17, 16, 21, 22],
  },
};

/** Bản sao câu dự phòng của mức `difficulty` (chưa xáo thẻ). */
export function circuitLinkFallback(difficulty: Difficulty): CircuitLinkPuzzle {
  const p = FALLBACK[difficulty];
  return {
    ...p,
    tiles: p.tiles.slice(),
    battery: { ...p.battery },
    bulb: { ...p.bulb },
    missing: p.missing.slice(),
    options: p.options.map((o) => o.slice()),
    path: p.path.slice(),
  };
}

/** Sinh câu kèm số lần thử (để test đo; `attempts > MAX_ATTEMPTS` = đã dùng câu dự phòng). */
export function circuitLinkGenerateWithStats(
  roundSeed: number,
  index: number,
  difficulty: Difficulty,
): { puzzle: CircuitLinkPuzzle; attempts: number } {
  const rng = createRng(deriveSeed(roundSeed, index));
  const level = LEVELS[difficulty];
  for (let n = 1; n <= MAX_ATTEMPTS; n++) {
    const puzzle = attempt(rng, level);
    if (puzzle) return { puzzle, attempts: n };
  }
  const puzzle = circuitLinkFallback(difficulty);
  const order = rng.shuffle(puzzle.options.map((_, i) => i));
  const answer = puzzle.options[puzzle.answerIndex]!;
  puzzle.options = order.map((i) => puzzle.options[i]!);
  puzzle.answerIndex = puzzle.options.indexOf(answer);
  return { puzzle, attempts: MAX_ATTEMPTS + 1 };
}

export const circuitLink: MinigameDef<CircuitLinkPuzzle, CircuitLinkAnswer> = {
  id: "circuit-link",
  category: "visualize",
  durationMs: 60_000,
  difficultyMultiplier: MULTIPLIER_BY_DIFFICULTY,
  // Bot (CR-016): thời gian một câu chép từ bảng Cân bằng của đặc tả (Mầm theo trẻ 7 tuổi): giữa
  // khoảng + 0,3 s hiệu ứng chuyển câu.
  expectedSolveMs: { 0: 3_550, 1: 3_100, 2: 4_500, 3: 6_200 },
  // Bot (CR-016): tỉ lệ đúng = 1 − tỉ lệ sai ở bảng Cân bằng của đặc tả (Mầm theo trẻ 7 tuổi).
  expectedAccuracy: { 0: 0.88, 1: 0.92, 2: 0.88, 3: 0.85 },

  generate(roundSeed, index, difficulty) {
    return circuitLinkGenerateWithStats(roundSeed, index, difficulty).puzzle;
  },

  check(puzzle, answer) {
    return answer === puzzle.answerIndex;
  },

  isAnswer(value): value is CircuitLinkAnswer {
    return (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value < CIRCUIT_LINK_MAX_OPTIONS
    );
  },
};
