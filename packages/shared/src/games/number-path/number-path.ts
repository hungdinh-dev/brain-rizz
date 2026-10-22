import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Đường số (nhóm Tính toán): từ số xuất phát, vài con đường đã vẽ sẵn đi qua các ô phép tính
 * (+3, ×2, ÷3, x², đổi dấu…). Chạm cửa ra của con đường duy nhất cho ra đúng số đích.
 * Đặc tả: docs/04-minigames/number-path.md.
 *
 * Khác Chạm đích (chọn tập thẻ có tổng bằng đích) và Bóng bay số (so thứ tự): ở đây là **theo dõi
 * một chuỗi phép tính nối tiếp**, giữ kết quả trung gian trong đầu, và (Siêu khó) dò nét các
 * đường đan nhau.
 *
 * Mọi thứ ngẫu nhiên đi qua `createRng`, không dùng Math.random() hay Date.now(). Chỉ số nguyên.
 */

/** Loại phép: cộng, trừ, nhân, chia (luôn chia hết), bình phương, đổi dấu. */
export type NumberPathOpKind = "add" | "sub" | "mul" | "div" | "sq" | "neg";

export interface NumberPathOp {
  kind: NumberPathOpKind;
  /** Toán hạng: số nguyên dương với `add`/`sub`/`mul`/`div`; luôn 0 với `sq` và `neg`. */
  n: number;
}

/** Ô trên lưới: cột 0 … `cols − 1` từ trái sang, hàng 0 … `rows − 1` từ trên xuống. */
export interface NumberPathCell {
  col: number;
  row: number;
}

export interface NumberPathPuzzle {
  /** Số xuất phát (trên đỉnh lưới). Số nguyên. */
  start: number;
  /** Số đích. Đúng một đường cho ra số này. */
  target: number;
  /** Số cột của lưới = số đường = số cửa ra: Mầm 2, Thường 3, Khó 3, Siêu khó 4. */
  cols: number;
  /** Số hàng ô = số phép trên mỗi đường: Mầm 2, ba mức còn lại 3. */
  rows: number;
  /**
   * `paths[i]`: các phép của đường `i`, theo thứ tự đi từ số xuất phát xuống cửa ra. Đường `i`
   * ra ở cửa cột `i`. Phép cuối của mọi đường luôn là cộng hoặc trừ.
   */
  paths: NumberPathOp[][];
  /**
   * `layout[i][k]`: ô chứa phép `paths[i][k]`, luôn ở hàng `k`; hai ô liền nhau trên một đường
   * lệch nhau tối đa một cột. Mầm, Thường, Khó: đường `i` đi thẳng dọc cột `i`. Siêu khó: các
   * đường đan chéo nhau và có 1–2 ô dùng chung (hai đường cùng đi qua một ô thì cùng áp phép của
   * ô đó); hàng cuối mỗi đường một ô riêng, `layout[i][rows − 1].col === i`.
   */
  layout: NumberPathCell[][];
  /** Chỉ số đường duy nhất ra `target`. Scene dùng để tô đường đúng khi người chơi sai. */
  answer: number;
}

/** Đáp án = chỉ số đường (cũng là cột cửa ra) người chơi chạm. Gửi một lần mỗi câu. */
export type NumberPathAnswer = number;

/** Số đường nhiều nhất (Siêu khó), cho `isAnswer`. */
const MAX_PATHS = 4;

/** Áp một phép lên giá trị đang có. Không bao giờ trả về −0. */
export function applyNumberPathOp(value: number, op: NumberPathOp): number {
  switch (op.kind) {
    case "add":
      return value + op.n;
    case "sub":
      return value - op.n;
    case "mul":
      return value === 0 ? 0 : value * op.n;
    case "div":
      return value === 0 ? 0 : value / op.n;
    case "sq":
      return value * value;
    case "neg":
      return value === 0 ? 0 : -value;
  }
}

/**
 * Các giá trị trên đường: phần tử `k` là kết quả sau phép `k` (không gồm số xuất phát).
 * Scene dùng để hiện kết quả trung gian dọc đường đúng khi người chơi sai.
 */
export function traceNumberPath(start: number, ops: readonly NumberPathOp[]): number[] {
  const out: number[] = [];
  let v = start;
  for (const op of ops) {
    v = applyNumberPathOp(v, op);
    out.push(v);
  }
  return out;
}

/** Kết quả cuối của một đường. Dùng chung cho bộ sinh, `check` và test. */
export function evaluateNumberPath(start: number, ops: readonly NumberPathOp[]): number {
  let v = start;
  for (const op of ops) v = applyNumberPathOp(v, op);
  return v;
}

// ---------------------------------------------------------------------------------------------
// Mô hình thời gian giải (đặc tả, mục Cân bằng). Bộ sinh dùng để giữ mỗi mức trong khoảng thời
// gian riêng (các mức không chồng nhau); test và mô phỏng điểm dùng lại đúng hàm này.
// ---------------------------------------------------------------------------------------------

const digits = (v: number): number => String(Math.abs(v)).length;

/** Thời gian (giây) tính một phép trong đầu, từ giá trị `v` ra `w`. */
function opSeconds(v: number, op: NumberPathOp, w: number): number {
  const negative = v < 0 || w < 0;
  switch (op.kind) {
    case "add":
    case "sub": {
      const base = Math.max(digits(v), digits(op.n), digits(w)) === 1 ? 0.3 : 0.45;
      if (negative) return base + 0.25;
      return base + (Math.floor(v / 10) !== Math.floor(w / 10) ? 0.1 : 0); // có nhớ / mượn
    }
    case "mul": {
      const small = Math.abs(v) <= 9;
      return (op.n === 2 ? (small ? 0.35 : 0.5) : small ? 0.45 : 0.65) + (v < 0 ? 0.2 : 0);
    }
    case "div": {
      const small = Math.abs(v) <= 20;
      return (op.n === 2 ? (small ? 0.45 : 0.6) : small ? 0.6 : 0.75) + (v < 0 ? 0.2 : 0);
    }
    case "sq":
      return 0.35 + (v < 0 ? 0.2 : 0);
    case "neg":
      return 0.25;
  }
}

const readSeconds = (v: number): number => (digits(v) >= 2 ? 0.35 : 0.25) + (v < 0 ? 0.1 : 0);

/** Mọi thứ tự duyệt `n` đường. */
function orders(n: number): number[][] {
  if (n <= 1) return [[0]];
  const out: number[][] = [];
  for (const o of orders(n - 1)) {
    for (let i = 0; i <= o.length; i++) out.push([...o.slice(0, i), n - 1, ...o.slice(i)]);
  }
  return out;
}
const ORDERS: Readonly<Record<number, number[][]>> = { 2: orders(2), 3: orders(3), 4: orders(4) };

/**
 * Thời gian dò nét đường `i` (giây): đường thẳng 0,1 s mỗi ô; đường đan 0,2 s mỗi ô, thêm 0,25 s
 * mỗi ô chung với một đường tới từ ô khác (nét cắt nhau trong ô, phải nhìn kỹ nét nào đi tiếp),
 * thêm 0,15 s mỗi lần tách khỏi một đường đi chung từ đầu.
 */
function trackSeconds(p: NumberPathPuzzle, i: number): number {
  const me = p.layout[i]!;
  const woven = p.layout.some((cells, j) => cells.some((c) => c.col !== j));
  if (!woven) return 0.1 * me.length;
  let s = 0.2 * me.length;
  let together = false;
  for (const [r, cell] of me.entries()) {
    let cross = false;
    let same = false;
    for (const [j, other] of p.layout.entries()) {
      if (j === i || other[r]!.col !== cell.col) continue;
      if (other.slice(0, r).every((o, k) => o.col === me[k]!.col)) same = true;
      else cross = true;
    }
    if (cross) s += 0.25;
    if (together && !same) s += 0.15;
    together = same;
  }
  return s;
}

/**
 * Thời gian giải dự kiến của một người lớn (giây), kiểu KLM: định hướng 0,3 s; đọc số xuất phát
 * và số đích; tính lần lượt từng đường (dò nét + từng phép + so với đích 0,2 s) tới khi gặp đường
 * ra đích; nếu mọi đường khác đã sai thì đường còn lại chỉ tính nửa (nửa số người chọn luôn, nửa
 * kiểm lại); chạm 0,35 s. Phép đã tính ở đường trước với cùng phần đầu (ô dùng chung từ đầu) thì
 * không tính lại. Lấy trung bình trên mọi thứ tự duyệt đường, để số không phụ thuộc vị trí đáp án.
 */
export function numberPathSolveSeconds(p: NumberPathPuzzle): number {
  const n = p.paths.length;
  const traces = p.paths.map((ops) => traceNumberPath(p.start, ops));
  const pathSeconds = (i: number, known: Set<string>): number => {
    let s = trackSeconds(p, i) + 0.2;
    let prefix = "";
    let v = p.start;
    for (const [k, op] of p.paths[i]!.entries()) {
      prefix += `${p.layout[i]![k]!.col}:${op.kind}${op.n},`;
      const w = traces[i]![k]!;
      if (!known.has(prefix)) s += opSeconds(v, op, w);
      known.add(prefix);
      v = w;
    }
    return s;
  };
  const all = ORDERS[n] ?? orders(n);
  let total = 0;
  for (const order of all) {
    const known = new Set<string>();
    for (const [k, i] of order.entries()) {
      if (k === n - 1) {
        total += 0.5 * pathSeconds(i, known);
        break;
      }
      total += pathSeconds(i, known);
      if (i === p.answer) break;
    }
  }
  return 0.3 + readSeconds(p.start) + readSeconds(p.target) + total / all.length + 0.35;
}

// ---------------------------------------------------------------------------------------------
// Tham số từng mức (đặc tả, mục Độ khó).
// ---------------------------------------------------------------------------------------------

/**
 * Khuôn phép cho phần đầu đường (mọi phép trừ phép cuối) ở Mầm, Thường, Khó: xáo thứ tự rồi
 * điền toán hạng. "pm" = cộng hoặc trừ; "mulpm" = nhân hoặc cộng/trừ (bốc đều loại trước).
 */
type Slot = "pm" | "mul" | "div" | "mulpm";

interface Level {
  /** Số đường = số cột. */
  paths: number;
  /** Số phép mỗi đường = số hàng. */
  rows: number;
  /** Khoảng số xuất phát. */
  start: readonly [number, number];
  /** Mọi giá trị trên đường (xuất phát, trung gian, đích, kết quả đường nhiễu) nằm trong khoảng này. */
  range: readonly [number, number];
  /** Toán hạng cộng/trừ: 1 … `pmMax`. */
  pmMax: number;
  /** Số nhân được dùng. */
  mulBy: readonly number[];
  /** Số chia được dùng. */
  divBy: readonly number[];
  /** Bình phương chỉ áp cho giá trị có trị tuyệt đối trong khoảng này. */
  sqAbs: readonly [number, number];
  /** Kết quả đường nhiễu lệch đích 1 … `near` (đôi một khác nhau). */
  near: number;
  /** Khoảng thời gian giải theo mô hình (giây, tính cả hai đầu); câu ngoài khoảng bị bỏ. */
  seconds: readonly [number, number];
  /** Khuôn phần đầu đường (Mầm, Thường, Khó). Siêu khó không dùng: mỗi ô bốc phép theo trọng số. */
  template?: readonly Slot[];
  /** Siêu khó: đường đan nhau; số ô dùng chung cho phép (tính cả hai đầu). */
  woven?: { shared: readonly [number, number] };
}

const LEVELS: Readonly<Record<Difficulty, Level>> = {
  // Mầm: 2 đường thẳng, mỗi đường 2 phép cộng/trừ, mọi số trong 0–20.
  0: {
    paths: 2,
    rows: 2,
    start: [2, 12],
    range: [0, 20],
    pmMax: 9,
    mulBy: [],
    divBy: [],
    sqAbs: [0, -1],
    near: 3,
    seconds: [0, 3.6],
    template: ["pm"],
  },
  // Thường: 3 đường thẳng, 3 phép, mỗi đường đúng một ×2 (không ở cuối), mọi số trong 0–40.
  1: {
    paths: 3,
    rows: 3,
    start: [1, 12],
    range: [0, 40],
    pmMax: 9,
    mulBy: [2],
    divBy: [],
    sqAbs: [0, -1],
    near: 4,
    seconds: [3.7, 4.95],
    template: ["mul", "pm"],
  },
  // Khó: 3 đường thẳng, 3 phép: đúng một ÷ (chia hết), một × (×2, ×3) hoặc cộng/trừ, phép cuối
  // cộng/trừ; số xuất phát luôn âm; mọi số trong −20…20.
  2: {
    paths: 3,
    rows: 3,
    start: [-12, -2],
    range: [-20, 20],
    pmMax: 9,
    mulBy: [2, 3],
    divBy: [2, 3],
    sqAbs: [0, -1],
    near: 4,
    seconds: [5.05, 6.05],
    template: ["div", "mulpm"],
  },
  // Siêu khó: 4 đường đan nhau, 1–2 ô dùng chung, 3 phép, mỗi đường có bình phương hoặc đổi dấu;
  // mọi số trong −20…20.
  3: {
    paths: 4,
    rows: 3,
    start: [-9, 9],
    range: [-20, 20],
    pmMax: 9,
    mulBy: [2, 3],
    divBy: [2, 3],
    sqAbs: [2, 4],
    near: 5,
    seconds: [6.15, 7.3],
    woven: { shared: [1, 2] },
  },
};

/** Trọng số loại phép cho mỗi ô (trừ hàng cuối) ở Siêu khó. */
const WOVEN_WEIGHTS: readonly (readonly [Exclude<Slot, "mulpm"> | "sq" | "neg", number])[] = [
  ["pm", 4],
  ["mul", 1],
  ["div", 1],
  ["sq", 1.5],
  ["neg", 1.5],
];

/**
 * Số lần thử nhiều nhất để có một câu hợp lệ trong khoảng thời gian của mức. Đo 10 000 seed mỗi
 * mức: trung bình 1,1 / 1,5 / 2,2 / 8,4 lần, nhiều nhất 5 / 8 / 15 / 105 (đặc tả, mục Cách sinh).
 * Hết lượt thì dùng câu dự phòng của mức, nên vòng lặp luôn dừng.
 */
const MAX_ATTEMPTS = 400;
/** Số lần bốc lại phần đầu một đường (Mầm, Thường, Khó) trước khi bỏ cả câu. */
const PATH_TRIES = 40;
/** Số lần bốc lại một hàng của lưới đan (Siêu khó) trước khi bỏ cả câu. */
const ROW_TRIES = 40;

const inRange = (lv: Level, v: number): boolean => v >= lv.range[0] && v <= lv.range[1];

const INVERSE: Readonly<Partial<Record<NumberPathOpKind, NumberPathOpKind>>> = {
  add: "sub",
  sub: "add",
  mul: "div",
  div: "mul",
  neg: "neg",
};

/** `op` có triệt tiêu phép ngay trước nó trên cùng đường không (×2 rồi ÷2, +5 rồi −5, đổi dấu hai lần). */
function undoes(prev: NumberPathOp | undefined, op: NumberPathOp): boolean {
  return prev !== undefined && INVERSE[op.kind] === prev.kind && prev.n === op.n;
}

/**
 * Mọi phép hợp lệ thuộc `kind` khi áp cho TẤT CẢ các giá trị `values` (ô dùng chung có 2 giá trị),
 * và không triệt tiêu phép ngay trước đó (`prevs`, cùng thứ tự với `values`) của đường nào.
 */
function candidates(
  lv: Level,
  kind: Exclude<Slot, "mulpm"> | "sq" | "neg",
  values: readonly number[],
  prevs: readonly (NumberPathOp | undefined)[] = [],
): NumberPathOp[] {
  const ok = (op: NumberPathOp) => values.every((v) => inRange(lv, applyNumberPathOp(v, op)));
  const out: NumberPathOp[] = [];
  switch (kind) {
    case "pm":
      for (let n = 1; n <= lv.pmMax; n++) {
        for (const k of ["add", "sub"] as const) {
          const op = { kind: k, n };
          if (ok(op)) out.push(op);
        }
      }
      break;
    case "mul":
      if (values.some((v) => v === 0)) break;
      for (const n of lv.mulBy) {
        const op = { kind: "mul" as const, n };
        if (ok(op)) out.push(op);
      }
      break;
    case "div":
      // Chỉ chia số khác 0, chia hết, và thương khác ±1 để phép chia có nghĩa.
      for (const n of lv.divBy) {
        if (values.every((v) => v !== 0 && v % n === 0 && Math.abs(v) > n)) {
          out.push({ kind: "div", n });
        }
      }
      break;
    case "sq":
      if (values.every((v) => Math.abs(v) >= lv.sqAbs[0] && Math.abs(v) <= lv.sqAbs[1])) {
        const op = { kind: "sq" as const, n: 0 };
        if (ok(op)) out.push(op);
      }
      break;
    case "neg":
      if (values.every((v) => v !== 0)) {
        const op = { kind: "neg" as const, n: 0 };
        if (ok(op)) out.push(op);
      }
      break;
  }
  return out.filter((op) => !prevs.some((prev) => undoes(prev, op)));
}

/** Bốc phần đầu (mọi phép trừ phép cuối) của một đường thẳng theo khuôn của mức. */
function lanePrefix(rng: Rng, lv: Level, start: number): NumberPathOp[] | null {
  const ops: NumberPathOp[] = [];
  let v = start;
  for (const slot of rng.shuffle(lv.template ?? [])) {
    const kinds = slot === "mulpm" ? rng.shuffle(["mul", "pm"] as const) : [slot];
    const options =
      kinds.map((k) => candidates(lv, k, [v], [ops[ops.length - 1]])).find((o) => o.length > 0) ??
      [];
    if (options.length === 0) return null;
    const op = rng.pick(options);
    ops.push(op);
    v = applyNumberPathOp(v, op);
  }
  return ops;
}

/**
 * Phép cuối cộng/trừ đưa `from` tới đúng `to`, hoặc null nếu toán hạng ngoài 1 … pmMax hay phép
 * đó triệt tiêu phép ngay trước (`prev`).
 */
function closingOp(
  lv: Level,
  from: number,
  to: number,
  prev: NumberPathOp | undefined,
): NumberPathOp | null {
  const d = to - from;
  if (d === 0 || Math.abs(d) > lv.pmMax) return null;
  const op: NumberPathOp = d > 0 ? { kind: "add", n: d } : { kind: "sub", n: -d };
  return undoes(prev, op) ? null : op;
}

const opsKey = (ops: readonly NumberPathOp[]) => ops.map((o) => `${o.kind}${o.n}`).join(",");

/**
 * Độ lệch kết quả so với đích của từng đường: 0 cho đường đúng, mỗi đường nhiễu một độ lệch
 * khác nhau trong ±1 … ±near (kết quả vẫn nằm trong khoảng của mức). Gán TRƯỚC khi sinh đường,
 * để mọi đường (kể cả đường đúng) khép theo đúng một luật và phép cuối của đường đúng không khác
 * gì đường nhiễu. Trả về null nếu không đủ độ lệch.
 */
function shiftsFor(
  lv: Level,
  offsets: readonly number[],
  target: number,
  answer: number,
): number[] | null {
  const free = offsets.filter((d) => inRange(lv, target + d));
  if (free.length < lv.paths - 1) return null;
  let k = 0;
  return Array.from({ length: lv.paths }, (_, i) => (i === answer ? 0 : free[k++]!));
}

/** ±1 … ±near theo thứ tự xáo trộn: thứ tự gán độ lệch cho các đường nhiễu. */
function shuffledOffsets(rng: Rng, lv: Level): number[] {
  const out: number[] = [];
  for (let d = 1; d <= lv.near; d++) out.push(d, -d);
  return rng.shuffle(out);
}

/**
 * Mầm, Thường, Khó: các đường thẳng độc lập, đường `i` dọc cột `i`.
 *
 * Chọn số đích và độ lệch từng đường trước, rồi mọi đường sinh theo cùng một cách: phần đầu bốc
 * theo khuôn (khác mọi phần đầu đã có), phép cuối cộng/trừ đưa kết quả tới `đích + độ lệch`.
 * Đường đúng sinh trước để vị trí đáp án không ảnh hưởng tỉ lệ sinh hỏng. Đường nhiễu lệch đích
 * rất gần nên không loại được bằng ước lượng.
 */
function tryLanes(rng: Rng, lv: Level): NumberPathPuzzle | null {
  const start = rng.int(lv.start[0], lv.start[1]);
  const answer = rng.int(0, lv.paths - 1);
  const target = rng.int(lv.range[0], lv.range[1]);
  const shifts = shiftsFor(lv, shuffledOffsets(rng, lv), target, answer);
  if (!shifts) return null;

  const used = new Set<string>();
  const paths: NumberPathOp[][] = new Array(lv.paths);
  const others = Array.from({ length: lv.paths }, (_, i) => i).filter((i) => i !== answer);
  for (const i of [answer, ...others]) {
    let found: NumberPathOp[] | null = null;
    for (let t = 0; t < PATH_TRIES && !found; t++) {
      const prefix = lanePrefix(rng, lv, start);
      if (!prefix || used.has(opsKey(prefix))) continue;
      const w = evaluateNumberPath(start, prefix);
      const last = closingOp(lv, w, target + shifts[i]!, prefix[prefix.length - 1]);
      if (!last) continue;
      found = [...prefix, last];
      used.add(opsKey(prefix));
    }
    if (!found) return null;
    paths[i] = found;
  }

  const layout = paths.map((_, i) =>
    Array.from({ length: lv.rows }, (_, row) => ({ col: i, row })),
  );
  return { start, target, cols: lv.paths, rows: lv.rows, paths, layout, answer };
}

/** Bước lệch cột mỗi hàng khi vẽ đường đan, có trọng số: đi thẳng gấp đôi đi chéo cho nét gọn. */
const WEAVE_MOVES: readonly number[] = [-1, 0, 0, 1];

/**
 * Siêu khó, bước 1: vẽ đường đan. Đi ngược từ cửa ra (đường `p` ra ở cột `p`) lên hàng 0, mỗi
 * hàng lệch tối đa một cột. Một ô chứa tối đa 2 đường; hai đường đã chung một ô thì không chung
 * ô ở hàng kế tiếp (không đi chồng lên cùng một đoạn nét). Trả về `cols[p][row]`.
 */
function weave(rng: Rng, paths: number, rows: number): number[][] | null {
  const cols = Array.from({ length: paths }, (_, p) => {
    const c = new Array<number>(rows).fill(0);
    c[rows - 1] = p;
    return c;
  });
  for (let r = rows - 2; r >= 0; r--) {
    let ok = false;
    for (let t = 0; t < ROW_TRIES && !ok; t++) {
      for (let p = 0; p < paths; p++) {
        const below = cols[p]![r + 1]!;
        const moves = WEAVE_MOVES.filter((d) => below + d >= 0 && below + d < paths);
        cols[p]![r] = below + rng.pick(moves);
      }
      ok = true;
      const count = new Array<number>(paths).fill(0);
      for (let p = 0; p < paths && ok; p++) {
        const c = cols[p]![r]!;
        count[c]!++;
        if (count[c]! > 2) ok = false;
        for (let q = 0; q < p && ok; q++) {
          if (cols[q]![r] === c && cols[q]![r + 1] === cols[p]![r + 1]) ok = false;
        }
      }
    }
    if (!ok) return null;
  }
  return cols;
}

/** Số ô dùng chung (ô có hai đường đi qua) của một lưới đan. */
function sharedCells(cols: readonly (readonly number[])[], rows: number): number {
  let shared = 0;
  for (let r = 0; r < rows; r++) {
    const seen = new Set<number>();
    for (const c of cols) {
      if (seen.has(c[r]!)) shared++;
      seen.add(c[r]!);
    }
  }
  return shared;
}

/** Phép đặc biệt của Siêu khó: mỗi đường có ít nhất một. */
const isSpecial = (kind: string): boolean => kind === "sq" || kind === "neg";

/**
 * Bốc một phép theo trọng số `WOVEN_WEIGHTS` trong các loại còn phép hợp lệ cho mọi giá trị vào
 * ô. `onlySpecial`: chỉ bốc bình phương hoặc đổi dấu (ô cuối cùng còn đặt được phép đặc biệt cho
 * một đường chưa có).
 */
function wovenOp(
  rng: Rng,
  lv: Level,
  values: readonly number[],
  prevs: readonly (NumberPathOp | undefined)[],
  onlySpecial: boolean,
): NumberPathOp | null {
  const pool = WOVEN_WEIGHTS.filter(([kind]) => !onlySpecial || isSpecial(kind))
    .map(([kind, w]) => ({ w, ops: candidates(lv, kind, values, prevs) }))
    .filter((x) => x.ops.length > 0);
  const total = pool.reduce((s, x) => s + x.w, 0);
  if (total === 0) return null;
  let roll = rng.next() * total;
  for (const x of pool) {
    roll -= x.w;
    if (roll < 0) return rng.pick(x.ops);
  }
  return rng.pick(pool[pool.length - 1]!.ops);
}

/**
 * Chọn số đích và phép cuối cho mọi đường khi đã biết giá trị trước hàng cuối (`values`). Như ở
 * `tryLanes`, mọi đường khép theo cùng một luật: phép cuối cộng/trừ đưa giá trị tới
 * `đích + độ lệch` (`shiftsFor`). Thử các số đích trong khoảng của mức theo thứ tự xáo trộn,
 * lấy số đầu tiên mà mọi đường đều khép được. Trả về null nếu không số nào được.
 */
function closeAll(
  rng: Rng,
  lv: Level,
  values: readonly number[],
  prevs: readonly (NumberPathOp | undefined)[],
  answer: number,
): { target: number; last: NumberPathOp[] } | null {
  const offsets = shuffledOffsets(rng, lv);
  const targets: number[] = [];
  for (let t = lv.range[0]; t <= lv.range[1]; t++) targets.push(t);
  for (const target of rng.shuffle(targets)) {
    const shifts = shiftsFor(lv, offsets, target, answer);
    if (!shifts) continue;
    const last = values.map((w, p) => closingOp(lv, w, target + shifts[p]!, prevs[p]));
    if (last.every((op) => op !== null)) return { target, last: last as NumberPathOp[] };
  }
  return null;
}

/** Siêu khó: 4 đường đan nhau, có ô dùng chung. */
function tryWoven(rng: Rng, lv: Level): NumberPathPuzzle | null {
  const { paths: n, rows } = lv;
  const start = rng.int(lv.start[0], lv.start[1]);
  const answer = rng.int(0, n - 1);

  // 1. Vẽ đường đan, giữ số ô dùng chung trong khoảng của mức.
  const cols = weave(rng, n, rows);
  if (!cols) return null;
  const shared = sharedCells(cols, rows);
  if (shared < lv.woven!.shared[0] || shared > lv.woven!.shared[1]) return null;

  // 2. Điền phép từng hàng (trừ hàng cuối), từng ô; ô dùng chung phải hợp lệ cho giá trị của cả
  //    hai đường. Đường nào tới hàng áp chót mà chưa có phép đặc biệt thì ô đó chỉ bốc phép đặc biệt.
  const values = new Array<number>(n).fill(start);
  const paths: NumberPathOp[][] = Array.from({ length: n }, () => []);
  const special = new Array<boolean>(n).fill(false);
  for (let r = 0; r < rows - 1; r++) {
    const byCol = new Map<number, number[]>();
    for (let p = 0; p < n; p++) {
      const c = cols[p]![r]!;
      byCol.set(c, [...(byCol.get(c) ?? []), p]);
    }
    for (const c of [...byCol.keys()].sort((a, b) => a - b)) {
      const members = byCol.get(c)!;
      const force = r === rows - 2 && members.some((p) => !special[p]);
      const op = wovenOp(
        rng,
        lv,
        members.map((p) => values[p]!),
        members.map((p) => paths[p]![r - 1]),
        force,
      );
      if (!op) return null;
      for (const p of members) {
        paths[p]!.push(op);
        values[p] = applyNumberPathOp(values[p]!, op);
        if (isSpecial(op.kind)) special[p] = true;
      }
    }
  }
  // Cả câu có đủ hai loại phép đặc biệt.
  const kinds = new Set(paths.flat().map((o) => o.kind));
  if (!kinds.has("sq") || !kinds.has("neg")) return null;

  // 3. Hàng cuối (mỗi đường một ô riêng): đường đúng ra đích, đường nhiễu lệch đích một chút.
  const closed = closeAll(
    rng,
    lv,
    values,
    paths.map((ops) => ops[ops.length - 1]),
    answer,
  );
  if (!closed) return null;
  for (const [p, last] of closed.last.entries()) paths[p]!.push(last);

  const layout = cols.map((c) => c.map((col, row) => ({ col, row })));
  return { start, target: closed.target, cols: n, rows, paths, layout, answer };
}

/**
 * Kiểm lại câu vừa sinh bằng chính `evaluateNumberPath` (đúng một đường ra đích, kết quả các
 * đường đôi một khác nhau) và giữ thời gian giải theo mô hình trong khoảng của mức.
 */
function accepted(p: NumberPathPuzzle, lv: Level): boolean {
  const ends = p.paths.map((ops) => evaluateNumberPath(p.start, ops));
  if (ends[p.answer] !== p.target || new Set(ends).size !== ends.length) return false;
  const s = numberPathSolveSeconds(p);
  return s >= lv.seconds[0] && s <= lv.seconds[1];
}

const op = (kind: NumberPathOpKind, n = 0): NumberPathOp => ({ kind, n });

const straight = (start: number, paths: NumberPathOp[][], answer: number): NumberPathPuzzle => {
  const rows = paths[0]!.length;
  return {
    start,
    target: evaluateNumberPath(start, paths[answer]!),
    cols: paths.length,
    rows,
    paths,
    layout: paths.map((_, i) => Array.from({ length: rows }, (_, row) => ({ col: i, row }))),
    answer,
  };
};

/**
 * Câu dự phòng của từng mức, chỉ dùng nếu `MAX_ATTEMPTS` lần thử đều hỏng (đo 10 000 seed mỗi
 * mức: chưa từng xảy ra). Test kiểm câu dự phòng đủ mọi ràng buộc của mức như câu sinh ra.
 */
export function numberPathFallback(difficulty: Difficulty): NumberPathPuzzle {
  switch (difficulty) {
    case 0: // 7 + 5 − 3 = 9 (đích) · 7 − 2 + 6 = 11
      return straight(
        7,
        [
          [op("add", 5), op("sub", 3)],
          [op("sub", 2), op("add", 6)],
        ],
        0,
      );
    case 1: // 6 × 2 + 5 − 3 = 14 · (6 + 4) × 2 − 4 = 16 (đích) · (6 − 1) × 2 + 3 = 13
      return straight(
        6,
        [
          [op("mul", 2), op("add", 5), op("sub", 3)],
          [op("add", 4), op("mul", 2), op("sub", 4)],
          [op("sub", 1), op("mul", 2), op("add", 3)],
        ],
        1,
      );
    case 2: // −6 ÷ 3 × 2 + 9 = 5 (đích) · (−6 + 2) ÷ 2 + 5 = 3 · −6 ÷ 2 − 5 + 9 = 1
      return straight(
        -6,
        [
          [op("div", 3), op("mul", 2), op("add", 9)],
          [op("add", 2), op("div", 2), op("add", 5)],
          [op("div", 2), op("sub", 5), op("add", 9)],
        ],
        0,
      );
    case 3:
      // Ô (hàng 0, cột 2) chung cho đường 1 và 2 (cùng đi từ số xuất phát); ô (hàng 1, cột 1)
      // chung cho đường 0 và 1 (tới từ hai ô khác nhau, nét cắt nhau trong ô).
      // Đường 0: −3 → x² 9 → +8 17 → −9 8 · Đường 1: −3 → ×(−1) 3 → +8 11 → −2 9
      // Đường 2: −3 → ×(−1) 3 → x² 9 → −4 5 (đích) · Đường 3: −3 → −4 −7 → ×(−1) 7 → −6 1
      return {
        start: -3,
        target: 5,
        cols: 4,
        rows: 3,
        paths: [
          [op("sq"), op("add", 8), op("sub", 9)],
          [op("neg"), op("add", 8), op("sub", 2)],
          [op("neg"), op("sq"), op("sub", 4)],
          [op("sub", 4), op("neg"), op("sub", 6)],
        ],
        layout: [
          [
            { col: 0, row: 0 },
            { col: 1, row: 1 },
            { col: 0, row: 2 },
          ],
          [
            { col: 2, row: 0 },
            { col: 1, row: 1 },
            { col: 1, row: 2 },
          ],
          [
            { col: 2, row: 0 },
            { col: 2, row: 1 },
            { col: 2, row: 2 },
          ],
          [
            { col: 3, row: 0 },
            { col: 3, row: 1 },
            { col: 3, row: 2 },
          ],
        ],
        answer: 2,
      };
  }
}

/**
 * Sinh câu đố, hoặc null nếu cả `MAX_ATTEMPTS` lần thử đều hỏng (khi đó `generate` dùng câu dự
 * phòng). Tách riêng để test kiểm được là câu dự phòng không bao giờ cần tới.
 */
export function numberPathTryGenerate(
  roundSeed: number,
  index: number,
  difficulty: Difficulty,
): NumberPathPuzzle | null {
  const rng = createRng(deriveSeed(roundSeed, index));
  const lv = LEVELS[difficulty];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const p = lv.woven ? tryWoven(rng, lv) : tryLanes(rng, lv);
    if (p && accepted(p, lv)) return p;
  }
  return null;
}

export const numberPath: MinigameDef<NumberPathPuzzle, NumberPathAnswer> = {
  id: "number-path",
  category: "compute",
  durationMs: 60_000,
  // Đặc tả mục Cân bằng: mô phỏng 4 000 vòng mỗi mức, cho điểm vòng ≈ người lớn ở Thường.
  difficultyMultiplier: { 0: 1, 1: 1, 2: 1.5, 3: 1.95 },
  // Bot (CR-016): thời gian một câu chép từ bảng Cân bằng của đặc tả (Mầm theo trẻ 7 tuổi): trung
  // bình + 0,3 s hiệu ứng chuyển câu.
  expectedSolveMs: { 0: 5_400, 1: 4_800, 2: 5_900, 3: 6_900 },
  // Bot (CR-016): tỉ lệ đúng = 1 − tỉ lệ sai ở bảng Cân bằng của đặc tả (Mầm theo trẻ 7 tuổi).
  expectedAccuracy: { 0: 0.9, 1: 0.92, 2: 0.9, 3: 0.87 },

  generate(roundSeed, index, difficulty) {
    return numberPathTryGenerate(roundSeed, index, difficulty) ?? numberPathFallback(difficulty);
  },

  check(puzzle, answer) {
    const ops = puzzle.paths[answer];
    return ops !== undefined && evaluateNumberPath(puzzle.start, ops) === puzzle.target;
  },

  isAnswer(value): value is NumberPathAnswer {
    return Number.isInteger(value) && (value as number) >= 0 && (value as number) < MAX_PATHS;
  },
};
