import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Chuỗi quy luật (nhóm Phân tích): chuỗi hạt xâu theo quy luật, có một chỗ trống; chọn hạt đúng
 * trong 4 thẻ. Hạt có 3 thuộc tính: hình, hoa văn (trơn / sọc / ca-rô) và số chấm (1–9, từ mức Khó).
 * Đặc tả: docs/04-minigames/bead-pattern.md.
 *
 * Đúng một đáp án: mỗi câu nháp được chạy lại qua CẢ thư viện luật (`beadPatternPredictions`).
 * Mọi luật khớp phần đã hiện và suy ra được chỗ trống phải cho cùng một hạt, không thì bỏ câu
 * nháp, sinh câu khác bằng chính `rng`. Mọi thứ ngẫu nhiên đi qua `rng`; mọi giá trị là số nguyên.
 */

/** Số loại hình: 0 tròn, 1 vuông, 2 tam giác, 3 tim, 4 sao. */
export const BEAD_SHAPE_COUNT = 5;
/** Số loại hoa văn: 0 trơn, 1 sọc, 2 ca-rô. */
export const BEAD_PATTERN_COUNT = 3;
/** Số chấm khi thuộc tính này được dùng (Khó, Siêu khó). Mầm, Thường: 0 = không vẽ chấm. */
export const BEAD_DOTS_MIN = 1;
export const BEAD_DOTS_MAX = 9;
/** Số thẻ đáp án ở mọi mức. */
export const BEAD_OPTION_COUNT = 4;

export type BeadPatternAttr = "shape" | "pattern" | "dots";
export const BEAD_PATTERN_ATTRS: readonly BeadPatternAttr[] = ["shape", "pattern", "dots"];

export interface BeadPatternBead {
  /** 0 tròn, 1 vuông, 2 tam giác, 3 tim, 4 sao. */
  shape: number;
  /** 0 trơn, 1 sọc, 2 ca-rô. */
  pattern: number;
  /** Số chấm trên nhãn của hạt, 1–9; 0 = hạt không có nhãn chấm (Mầm, Thường). */
  dots: number;
}

/** Luật đã dùng để sinh một thuộc tính. FE dùng để vẽ lời giải khi trả lời sai. */
export type BeadPatternRule =
  /** Không đổi trong cả chuỗi. */
  | { kind: "same" }
  /** Lặp lại sau mỗi `period` hạt. */
  | { kind: "cycle"; period: number }
  /** Số chấm cộng đều `step` (âm = giảm). */
  | { kind: "step"; step: number }
  /** Số chấm bằng tổng hai hạt liền trước (kiểu Fibonacci). */
  | { kind: "sum" }
  /** Vị trí chẵn (0, 2, 4…) theo `even`, vị trí lẻ theo `odd` (mỗi bên là `same` hoặc `step`). */
  | { kind: "alternate"; even: BeadPatternRule; odd: BeadPatternRule };

export interface BeadPatternPuzzle {
  /** Chuỗi hạt từ trái sang phải; `null` là chỗ trống. */
  beads: (BeadPatternBead | null)[];
  /** Vị trí chỗ trống trong `beads`. */
  blank: number;
  /** 4 thẻ, đôi một khác nhau; đúng một thẻ là hạt cần điền. */
  options: BeadPatternBead[];
  /** Chỉ số thẻ đúng trong `options` (0–3). */
  answer: number;
  /**
   * Hai thuộc tính mà các thẻ khác nhau (thẻ xếp kiểu lưới 2 × 2: mỗi giá trị có ở đúng hai thẻ).
   * Thuộc tính còn lại giống nhau ở cả 4 thẻ.
   */
  tested: readonly [BeadPatternAttr, BeadPatternAttr];
  /** Luật sinh từng thuộc tính. */
  rules: Readonly<Record<BeadPatternAttr, BeadPatternRule>>;
}

/** Đáp án = chỉ số thẻ người chơi chạm (0–3). */
export type BeadPatternAnswer = number;

export interface BeadPatternLevel {
  /** Số hạt trong chuỗi, tính cả chỗ trống (Siêu khó kiểu cộng dồn: 5–6 hạt). */
  length: number;
  /** Có dùng số chấm không. */
  dots: boolean;
  /** % câu có chỗ trống ở cuối chuỗi; còn lại ở giữa (không bao giờ ở hạt đầu). */
  blankAtEndPct: number;
}

export const BEAD_PATTERN_LEVELS: Readonly<Record<Difficulty, BeadPatternLevel>> = {
  0: { length: 6, dots: false, blankAtEndPct: 100 },
  1: { length: 7, dots: false, blankAtEndPct: 100 },
  2: { length: 7, dots: true, blankAtEndPct: 40 },
  3: { length: 8, dots: true, blankAtEndPct: 0 },
};

/** Hệ số điểm theo mức (CR-006), từ mô phỏng ở mục Cân bằng của đặc tả. */
const MULTIPLIER_BY_DIFFICULTY: Readonly<Record<Difficulty, number>> = {
  0: 1,
  1: 1,
  2: 2.05,
  3: 3.35,
};

/** Số câu nháp thử tối đa trước khi dùng câu dự phòng (10 000 seed mỗi mức chưa từng chạm tới). */
const MAX_ATTEMPTS = 60;

// ---------------------------------------------------------------------------------------------
// Thư viện luật và bộ kiểm "mọi luật khớp đều cho cùng một hạt"
// ---------------------------------------------------------------------------------------------

/** Dãy giá trị của một thuộc tính; `null` là chỗ trống (nhiều nhất một). */
type Seq = readonly (number | null)[];

/** Kết quả khớp một luật: mâu thuẫn, khớp mà không suy ra được chỗ trống, hoặc suy ra `num / den`. */
type Fit = { kind: "none" } | { kind: "free" } | { kind: "value"; num: number; den: number };

const NONE: Fit = { kind: "none" };
const FREE: Fit = { kind: "free" };
const valueFit = (v: number): Fit => ({ kind: "value", num: v, den: 1 });

/** Một luật cơ bản: áp lên cả chuỗi, hoặc lên dãy con chẵn / lẻ của luật xen kẽ. */
interface BaseRule {
  name: string;
  /** Số tham số tự do. Luật chỉ được xét khi phần nó xét có ít nhất `params + 1` giá trị đã hiện. */
  params: number;
  /** `k` = vị trí chỗ trống, −1 = dãy đầy đủ (chỉ kiểm khớp: `free` = khớp). */
  fit(seq: Seq, k: number): Fit;
}

/** Lặp chu kỳ `p`: mọi hạt cùng lớp `i mod p` giống nhau. */
function cycleRule(p: number): BaseRule {
  return {
    name: `cycle${p}`,
    params: p,
    fit(seq, k) {
      const first: (number | null)[] = new Array<number | null>(p).fill(null);
      for (let i = 0; i < seq.length; i++) {
        const v = seq[i];
        if (v === null || v === undefined) continue;
        const seen = first[i % p];
        if (seen === null || seen === undefined) first[i % p] = v;
        else if (seen !== v) return NONE;
      }
      if (k < 0) return FREE;
      const v = first[k % p];
      return v === null || v === undefined ? FREE : valueFit(v);
    },
  };
}

/**
 * Giải ràng buộc tuyến tính `Σ c[j]·v[m+j] = 0` trên mọi cửa sổ liên tiếp, ẩn là chỗ trống `k`.
 * Trả `value` dạng phân số (có thể không nguyên, vẫn tính là một dự đoán).
 */
function solveLinear(seq: Seq, k: number, coeffs: readonly number[]): Fit {
  const t = coeffs.length - 1;
  let found = false;
  let num = 0;
  let den = 1;
  for (let m = 0; m + t < seq.length; m++) {
    let sum = 0;
    let cx = 0;
    for (let j = 0; j <= t; j++) {
      const c = coeffs[j] as number;
      if (m + j === k) cx += c;
      else sum += c * (seq[m + j] as number);
    }
    if (cx === 0) {
      if (sum !== 0) return NONE;
      continue;
    }
    // cx·x + sum = 0 → x = −sum / cx
    const n = cx < 0 ? sum : -sum;
    const d = Math.abs(cx);
    if (!found) {
      found = true;
      num = n;
      den = d;
    } else if (num * d !== n * den) {
      return NONE;
    }
  }
  return found ? { kind: "value", num, den } : FREE;
}

function linearRule(name: string, params: number, coeffs: readonly number[]): BaseRule {
  return { name, params, fit: (seq, k) => solveLinear(seq, k, coeffs) };
}

/** Cấp số nhân: tỉ số lấy từ cặp hạt liền nhau đầu tiên đã hiện (hai số khác 0). */
const ratioRule: BaseRule = {
  name: "ratio",
  params: 2,
  fit(seq, k) {
    for (let i = 0; i + 1 < seq.length; i++) {
      const a = seq[i];
      const b = seq[i + 1];
      if (a === null || a === undefined || b === null || b === undefined) continue;
      if (a === 0 || b === 0) return NONE;
      // v[m+1] / v[m] = b / a  ⇔  −b·v[m] + a·v[m+1] = 0
      return solveLinear(seq, k, [-b, a]);
    }
    return NONE;
  },
};

/** Luật chỉ áp cho số chấm (hình và hoa văn không có thứ tự). */
const NUMERIC_RULES: readonly BaseRule[] = [
  // Cộng đều: hiệu hai hạt liền nhau không đổi.
  linearRule("step", 2, [1, -2, 1]),
  // Bước tăng đều (hiệu bậc hai không đổi), vd. 1, 2, 4, 7.
  linearRule("grow", 3, [-1, 3, -3, 1]),
  ratioRule,
  // Cộng dồn: v[m+2] = v[m] + v[m+1].
  linearRule("sum", 2, [1, 1, -1]),
  // Cộng dồn đọc từ phải sang: v[m+2] = v[m] − v[m+1].
  linearRule("diff", 2, [1, -1, -1]),
];

/** Các luật cơ bản cho một dãy dài `length`: lặp chu kỳ 1 … length − 1, cộng thêm luật số. */
function baseRules(length: number, numeric: boolean): BaseRule[] {
  const rules: BaseRule[] = [];
  for (let p = 1; p < length; p++) rules.push(cycleRule(p));
  if (numeric) rules.push(...NUMERIC_RULES);
  return rules;
}

/** Đối xứng gương: hạt thứ i giống hạt thứ i tính từ cuối. Chỉ áp lên cả chuỗi. */
function mirrorFit(seq: Seq, k: number): Fit {
  const m = seq.length;
  for (let i = 0; i < m - 1 - i; i++) {
    const a = seq[i];
    const b = seq[m - 1 - i];
    if (a === null || b === null) continue;
    if (a !== b) return NONE;
  }
  if (k < 0) return FREE;
  const partner = m - 1 - k;
  const v = seq[partner];
  return partner === k || v === null || v === undefined ? FREE : valueFit(v);
}

function visibleCount(seq: Seq): number {
  return seq.reduce<number>((n, v) => (v === null ? n : n + 1), 0);
}

/** Dãy đầy đủ (không có chỗ trống) khớp ít nhất một luật cơ bản có đủ bằng chứng. */
function fitsSomeRule(seq: Seq, numeric: boolean): boolean {
  return baseRules(seq.length, numeric).some(
    (rule) => seq.length >= rule.params + 1 && rule.fit(seq, -1).kind === "free",
  );
}

/** Một dự đoán cho chỗ trống: phân số `num / den` (den > 0) và tên luật đưa ra nó. */
export interface BeadPrediction {
  rule: string;
  num: number;
  den: number;
}

function pushBase(out: BeadPrediction[], seq: Seq, k: number, numeric: boolean, prefix: string) {
  const shown = visibleCount(seq);
  for (const rule of baseRules(seq.length, numeric)) {
    if (shown < rule.params + 1) continue;
    const fit = rule.fit(seq, k);
    if (fit.kind === "value") out.push({ rule: prefix + rule.name, num: fit.num, den: fit.den });
  }
}

/**
 * Mọi dự đoán cho chỗ trống `k` của một dãy theo cả thư viện luật:
 * - luật cơ bản trên cả chuỗi (lặp chu kỳ 1 … n − 1; với số chấm thêm cộng đều, bước tăng đều,
 *   nhân đều, cộng dồn xuôi và ngược);
 * - đối xứng gương;
 * - xen kẽ: dãy con cùng chẵn lẻ với chỗ trống theo một luật cơ bản, dãy con còn lại theo một luật
 *   cơ bản bất kỳ.
 * Luật chỉ được tính khi phần nó xét có ít nhất `params + 1` giá trị đã hiện (được kiểm chứng ít
 * nhất một lần); luật khớp mà không suy ra được chỗ trống thì bỏ qua.
 */
export function beadSequencePredictions(seq: Seq, k: number, numeric: boolean): BeadPrediction[] {
  const out: BeadPrediction[] = [];
  pushBase(out, seq, k, numeric, "");

  if (visibleCount(seq) >= Math.ceil(seq.length / 2) + 1) {
    const fit = mirrorFit(seq, k);
    if (fit.kind === "value") out.push({ rule: "mirror", num: fit.num, den: fit.den });
  }

  const parity = k % 2;
  const own = seq.filter((_, i) => i % 2 === parity);
  const other = seq.filter((_, i) => i % 2 !== parity);
  if (fitsSomeRule(other, numeric)) pushBase(out, own, (k - parity) / 2, numeric, "alt-");
  return out;
}

export type BeadPatternPredictions = Record<BeadPatternAttr, BeadPrediction[]>;

/** Chạy cả thư viện luật trên các hạt đang hiện (đúng một chỗ trống `null`). */
export function beadPatternPredictions(
  beads: readonly (BeadPatternBead | null)[],
): BeadPatternPredictions {
  const k = beads.indexOf(null);
  if (k < 0 || beads.lastIndexOf(null) !== k)
    throw new Error("bead-pattern: cần đúng một chỗ trống");
  const pick = (attr: BeadPatternAttr): Seq => beads.map((b) => (b === null ? null : b[attr]));
  return {
    shape: beadSequencePredictions(pick("shape"), k, false),
    pattern: beadSequencePredictions(pick("pattern"), k, false),
    dots: beadSequencePredictions(pick("dots"), k, true),
  };
}

/**
 * Câu có đúng một hạt được mọi luật khớp suy ra, và hạt đó là `answer`: ở mỗi thuộc tính có ít
 * nhất một dự đoán, và mọi dự đoán (kể cả phân số, số ngoài khoảng) đều bằng giá trị của `answer`.
 */
export function beadPatternIsUnique(
  beads: readonly (BeadPatternBead | null)[],
  answer: BeadPatternBead,
): boolean {
  const preds = beadPatternPredictions(beads);
  return BEAD_PATTERN_ATTRS.every((attr) => {
    const list = preds[attr];
    return list.length > 0 && list.every((p) => p.num === answer[attr] * p.den);
  });
}

// ---------------------------------------------------------------------------------------------
// Sinh câu đố
// ---------------------------------------------------------------------------------------------

interface Draft {
  seqs: Record<BeadPatternAttr, number[]>;
  blank: number;
  rules: Record<BeadPatternAttr, BeadPatternRule>;
  /** Thuộc tính thẻ nhiễu làm sai: [thuộc tính chính, thuộc tính phụ]. */
  tested: readonly [BeadPatternAttr, BeadPatternAttr];
  /** Số chấm sai hợp lý (khi `tested` có "dots"), đã lọc trong 1–9 và khác đáp án. */
  dotMistakes: number[];
}

type Categorical = "shape" | "pattern";

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const countOf = (attr: Categorical): number =>
  attr === "shape" ? BEAD_SHAPE_COUNT : BEAD_PATTERN_COUNT;
const otherCategorical = (attr: Categorical): Categorical =>
  attr === "shape" ? "pattern" : "shape";

/** Mẫu chu kỳ 4 (giá trị là chỉ số trong danh sách đã xáo), chu kỳ nhỏ nhất đều là 4. */
const PERIOD4_TEMPLATES: readonly (readonly number[])[] = [
  [0, 0, 1, 1],
  [0, 1, 0, 2],
  [0, 1, 2, 1],
  [0, 1, 2, 3],
];

/** Mẫu lặp có chu kỳ nhỏ nhất đúng bằng `period`. Chu kỳ 3: 1/4 số câu dạng x x y (xoay vòng). */
function makeMotif(rng: Rng, count: number, period: number): number[] {
  const pool = rng.shuffle(range(count));
  if (period === 3 && rng.int(0, 3) === 0) {
    const base = [pool[0], pool[0], pool[1]] as number[];
    const r = rng.int(0, 2);
    return range(3).map((i) => base[(i + r) % 3] as number);
  }
  if (period === 4) {
    const t = rng.pick(PERIOD4_TEMPLATES.filter((tpl) => Math.max(...tpl) < count));
    const r = rng.int(0, 3);
    return range(4).map((i) => pool[t[(i + r) % 4] as number] as number);
  }
  return pool.slice(0, period);
}

function repeatMotif(motif: readonly number[], length: number): number[] {
  return range(length).map((i) => motif[i % motif.length] as number);
}

function motifRule(period: number): BeadPatternRule {
  return period === 1 ? { kind: "same" } : { kind: "cycle", period };
}

function stepRule(step: number): BeadPatternRule {
  return step === 0 ? { kind: "same" } : { kind: "step", step };
}

/** Một thuộc tính hình / hoa văn lặp chu kỳ `period`. */
function categoricalSeq(rng: Rng, attr: Categorical, period: number, length: number) {
  return {
    seq: repeatMotif(makeMotif(rng, countOf(attr), period), length),
    rule: motifRule(period),
  };
}

/** Lọc số sai hợp lý: số nguyên trong 1–9, khác đáp án, không trùng. */
function cleanMistakes(list: readonly (number | undefined)[], ans: number): number[] {
  const out: number[] = [];
  for (const x of list) {
    if (x === undefined || !Number.isInteger(x) || x === ans) continue;
    if (x < BEAD_DOTS_MIN || x > BEAD_DOTS_MAX || out.includes(x)) continue;
    out.push(x);
  }
  // Luôn còn ít nhất một số sai (đáp án trong 1–9 nên ans ± 1 có ít nhất một số hợp lệ).
  if (out.length === 0) out.push(ans < BEAD_DOTS_MAX ? ans + 1 : ans - 1);
  return out;
}

/** Số chấm sai hợp lý cho chỗ trống `k` của dãy `v` (đầy đủ), theo luật đã sinh. */
function dotMistakes(v: readonly number[], k: number, rule: BeadPatternRule): number[] {
  const ans = v[k] as number;
  const prev = v[k - 1];
  const prev2 = v[k - 2];
  const next = v[k + 1];
  switch (rule.kind) {
    case "step":
      // Lố một bước (hoặc lấy hạt kề sau), chép hạt kề trước, lệch hai bước.
      return cleanMistakes([ans + rule.step, ans - rule.step, ans + 2 * rule.step], ans);
    case "sum": {
      // Tưởng là cộng đều theo hai hạt trước; lệch 1.
      const arith = prev !== undefined && prev2 !== undefined ? 2 * prev - prev2 : undefined;
      return cleanMistakes([arith, ans + 1, ans - 1], ans);
    }
    case "alternate": {
      // Lẫn hai dãy: lấy số của hạt kề (thuộc dãy kia); lệch 1 trong dãy của mình.
      return cleanMistakes([prev, next, ans + 1, ans - 1], ans);
    }
    default: {
      // Lặp chu kỳ: số chấm của hạt khác lớp trong chu kỳ; đếm lệch 1.
      const others = [...new Set(v)].filter((x) => x !== ans);
      return cleanMistakes([...others.slice(0, 2), ans + 1, ans - 1], ans);
    }
  }
}

const zeros = (n: number): number[] => new Array<number>(n).fill(0);

/** Mầm: một thuộc tính (hình 2/3 số câu, hoa văn 1/3) lặp chu kỳ 2, thuộc tính kia không đổi. */
function draftSprout(rng: Rng): Draft {
  const { length: n } = BEAD_PATTERN_LEVELS[0];
  const varying: Categorical = rng.int(0, 2) < 2 ? "shape" : "pattern";
  const fixed = otherCategorical(varying);
  const a = categoricalSeq(rng, varying, 2, n);
  const b = categoricalSeq(rng, fixed, 1, n);
  return {
    seqs: { [varying]: a.seq, [fixed]: b.seq, dots: zeros(n) } as Draft["seqs"],
    blank: n - 1,
    rules: { [varying]: a.rule, [fixed]: b.rule, dots: { kind: "same" } } as Draft["rules"],
    tested: [varying, fixed],
    dotMistakes: [],
  };
}

/** Thường: hình và hoa văn đổi độc lập, một bên chu kỳ 2, bên kia chu kỳ 3; chỗ trống ở cuối. */
function draftNormal(rng: Rng): Draft {
  const { length: n } = BEAD_PATTERN_LEVELS[1];
  const shapePeriod = rng.int(2, 3);
  const shape = categoricalSeq(rng, "shape", shapePeriod, n);
  const pattern = categoricalSeq(rng, "pattern", 5 - shapePeriod, n);
  return {
    seqs: { shape: shape.seq, pattern: pattern.seq, dots: zeros(n) },
    blank: n - 1,
    rules: { shape: shape.rule, pattern: pattern.rule, dots: { kind: "same" } },
    tested: shapePeriod === 3 ? ["shape", "pattern"] : ["pattern", "shape"],
    dotMistakes: [],
  };
}

/** Chỗ trống: ở cuối với xác suất `blankAtEndPct`, còn lại ở giữa (1 … n − 2). */
function pickBlank(rng: Rng, n: number, blankAtEndPct: number): number {
  return rng.int(0, 99) < blankAtEndPct ? n - 1 : rng.int(1, n - 2);
}

/** Khó: số chấm cộng / trừ đều 1, hoặc lặp chu kỳ 2–3; một thuộc tính hình / hoa văn lặp 2–3. */
function draftHard(rng: Rng): Draft {
  const { length: n, blankAtEndPct } = BEAD_PATTERN_LEVELS[2];
  const blank = pickBlank(rng, n, blankAtEndPct);

  let dots: number[];
  let dotsRule: BeadPatternRule;
  const roll = rng.int(0, 99);
  if (roll < 50) {
    const up = rng.int(0, 9) < 6;
    const span = n - 1;
    const start = up
      ? rng.int(BEAD_DOTS_MIN, BEAD_DOTS_MAX - span)
      : rng.int(BEAD_DOTS_MIN + span, BEAD_DOTS_MAX);
    const step = up ? 1 : -1;
    dots = range(n).map((i) => start + step * i);
    dotsRule = { kind: "step", step };
  } else {
    const period = roll < 75 ? 2 : 3;
    const motif = makeMotif(rng, BEAD_DOTS_MAX, period).map((x) => x + 1);
    dots = repeatMotif(motif, n);
    dotsRule = { kind: "cycle", period };
  }

  const varying: Categorical = rng.int(0, 1) === 0 ? "shape" : "pattern";
  const fixed = otherCategorical(varying);
  const a = categoricalSeq(rng, varying, rng.int(2, 3), n);
  const b = categoricalSeq(rng, fixed, 1, n);
  return {
    seqs: { [varying]: a.seq, [fixed]: b.seq, dots } as Draft["seqs"],
    blank,
    rules: { [varying]: a.rule, [fixed]: b.rule, dots: dotsRule } as Draft["rules"],
    tested: ["dots", varying],
    dotMistakes: dotMistakes(dots, blank, dotsRule),
  };
}

const ALTERNATE_STEPS = [-2, -1, 0, 1, 2] as const;

/** Số đầu của một dãy cộng đều `terms` số, bước `step`, nằm gọn trong 1–9. */
function startRange(step: number, terms: number): [number, number] {
  const span = step * (terms - 1);
  return [
    Math.max(BEAD_DOTS_MIN, BEAD_DOTS_MIN - span),
    Math.min(BEAD_DOTS_MAX, BEAD_DOTS_MAX - span),
  ];
}

/** Dãy cộng dồn nằm gọn trong 1–9, đủ dài để có chỗ trống ở giữa (5–6 hạt). */
const SUM_SEQUENCES: readonly (readonly number[])[] = [
  [1, 1, 2, 3, 5, 8],
  [1, 1, 2, 3, 5],
  [1, 2, 3, 5, 8],
  [2, 1, 3, 4, 7],
  [3, 1, 4, 5, 9],
];

/**
 * Siêu khó: 3/4 số câu là hai dãy số chấm xen kẽ (vị trí chẵn / lẻ, mỗi dãy cộng đều −2 … 2),
 * 1/4 là cộng dồn kiểu Fibonacci (5–6 hạt); hình / hoa văn lặp chu kỳ 3–4; chỗ trống ở giữa.
 */
function draftSuper(rng: Rng): Draft {
  let dots: number[];
  let dotsRule: BeadPatternRule;
  let period: number;
  if (rng.int(0, 3) > 0) {
    const n = BEAD_PATTERN_LEVELS[3].length;
    const half = n / 2;
    const a = rng.pick(ALTERNATE_STEPS);
    // Không cho cả hai dãy đứng yên (thành lặp chu kỳ 2).
    const b = rng.pick(ALTERNATE_STEPS.filter((s) => a !== 0 || s !== 0));
    const [eLo, eHi] = startRange(a, half);
    const e0 = rng.int(eLo, eHi);
    const [oLo, oHi] = startRange(b, half);
    // Bỏ số đầu làm cả chuỗi thành một dãy cộng đều (vd. 1, 2, 3 … 8).
    const merged = a === b && a % 2 === 0 ? e0 + a / 2 : undefined;
    const o0 = rng.pick(
      range(oHi - oLo + 1)
        .map((i) => oLo + i)
        .filter((x) => x !== merged),
    );
    dots = range(n).map((i) => (i % 2 === 0 ? e0 + a * (i / 2) : o0 + b * ((i - 1) / 2)));
    dotsRule = { kind: "alternate", even: stepRule(a), odd: stepRule(b) };
    period = rng.int(3, 4);
  } else {
    dots = [
      ...(rng.int(0, 4) < 2 ? (SUM_SEQUENCES[0] as number[]) : rng.pick(SUM_SEQUENCES.slice(1))),
    ];
    dotsRule = { kind: "sum" };
    // Chuỗi ngắn: chu kỳ 3 chỉ khi đủ 6 hạt để lặp được hai lần.
    period = dots.length >= 6 ? rng.int(2, 3) : 2;
  }
  const n = dots.length;
  const blank = rng.int(1, n - 2);
  const varying: Categorical = rng.int(0, 1) === 0 ? "shape" : "pattern";
  const fixed = otherCategorical(varying);
  const a = categoricalSeq(rng, varying, period, n);
  const b = categoricalSeq(rng, fixed, 1, n);
  return {
    seqs: { [varying]: a.seq, [fixed]: b.seq, dots } as Draft["seqs"],
    blank,
    rules: { [varying]: a.rule, [fixed]: b.rule, dots: dotsRule } as Draft["rules"],
    tested: ["dots", varying],
    dotMistakes: dotMistakes(dots, blank, dotsRule),
  };
}

const DRAFTERS: Readonly<Record<Difficulty, (rng: Rng) => Draft>> = {
  0: draftSprout,
  1: draftNormal,
  2: draftHard,
  3: draftSuper,
};

/** Câu dự phòng dựng tay cho từng mức (test kiểm câu này đúng một đáp án). */
function fallbackDraft(difficulty: Difficulty): Draft {
  const n = BEAD_PATTERN_LEVELS[difficulty].length;
  const same = (x: number) => new Array<number>(n).fill(x);
  switch (difficulty) {
    case 0:
      return {
        seqs: { shape: repeatMotif([0, 1], n), pattern: same(1), dots: zeros(n) },
        blank: n - 1,
        rules: {
          shape: { kind: "cycle", period: 2 },
          pattern: { kind: "same" },
          dots: { kind: "same" },
        },
        tested: ["shape", "pattern"],
        dotMistakes: [],
      };
    case 1:
      return {
        seqs: { shape: repeatMotif([2, 4], n), pattern: repeatMotif([0, 1, 2], n), dots: zeros(n) },
        blank: n - 1,
        rules: {
          shape: { kind: "cycle", period: 2 },
          pattern: { kind: "cycle", period: 3 },
          dots: { kind: "same" },
        },
        tested: ["pattern", "shape"],
        dotMistakes: [],
      };
    case 2: {
      const dots = range(n).map((i) => 2 + i);
      const rule: BeadPatternRule = { kind: "step", step: 1 };
      return {
        seqs: { shape: repeatMotif([1, 3], n), pattern: same(2), dots },
        blank: 3,
        rules: { shape: { kind: "cycle", period: 2 }, pattern: { kind: "same" }, dots: rule },
        tested: ["dots", "shape"],
        dotMistakes: dotMistakes(dots, 3, rule),
      };
    }
    default: {
      // 1 9 3 8 5 7 7 6, trống ở hạt thứ 3 (số 3). Trống ở hạt thứ 5 thì nhập nhằng:
      // dãy chẵn 1, 3, _, 7 khớp cả cộng đều (5) lẫn cộng dồn (4).
      const dots = range(n).map((i) => (i % 2 === 0 ? 1 + i : 9 - (i - 1) / 2));
      const rule: BeadPatternRule = {
        kind: "alternate",
        even: { kind: "step", step: 2 },
        odd: { kind: "step", step: -1 },
      };
      return {
        seqs: { shape: same(4), pattern: repeatMotif([0, 1, 2], n), dots },
        blank: 2,
        rules: { shape: { kind: "same" }, pattern: { kind: "cycle", period: 3 }, dots: rule },
        tested: ["dots", "pattern"],
        dotMistakes: dotMistakes(dots, 2, rule),
      };
    }
  }
}

function beadAt(d: Draft, i: number): BeadPatternBead {
  return {
    shape: d.seqs.shape[i] as number,
    pattern: d.seqs.pattern[i] as number,
    dots: d.seqs.dots[i] as number,
  };
}

function shownBeads(d: Draft): (BeadPatternBead | null)[] {
  return d.seqs.shape.map((_, i) => (i === d.blank ? null : beadAt(d, i)));
}

/**
 * Các giá trị sai hợp lý cho một thuộc tính được kiểm. Hình / hoa văn: giá trị khác có trong
 * chuỗi (thẻ "trông quen"); thuộc tính không đổi thì lấy giá trị không có trong chuỗi.
 * Số chấm: ba lỗi hay gặp đầu tiên của luật.
 */
function wrongCandidates(d: Draft, attr: BeadPatternAttr, answer: BeadPatternBead): number[] {
  if (attr === "dots") return d.dotMistakes.slice(0, 3);
  const correct = answer[attr];
  const inChain = [...new Set(d.seqs[attr])].filter((x) => x !== correct);
  if (inChain.length > 0) return inChain;
  return range(countOf(attr)).filter((x) => x !== correct);
}

/** Bốn thẻ lưới 2 × 2: đáp án, sai thuộc tính chính, sai thuộc tính phụ, sai cả hai. */
function gridCards(answer: BeadPatternBead, d: Draft, wa: number, wb: number): BeadPatternBead[] {
  const [first, second] = d.tested;
  return [
    answer,
    { ...answer, [first]: wa },
    { ...answer, [second]: wb },
    { ...answer, [first]: wa, [second]: wb },
  ];
}

/**
 * Dựng 4 thẻ kiểu lưới 2 × 2 trên hai thuộc tính được kiểm. Mỗi giá trị có mặt ở đúng hai thẻ,
 * nên không đoán được đáp án bằng cách tìm thẻ "khác ba thẻ kia" hay thẻ "giống nhiều thẻ nhất";
 * phải giải cả hai thuộc tính. Cặp giá trị sai được chọn sao cho thẻ đúng không phải thẻ DUY NHẤT
 * có (hoặc duy nhất không có) trong chuỗi, để mẹo "chọn hạt đã thấy" / "chọn hạt mới" không lộ
 * đáp án.
 */
function finalize(rng: Rng, d: Draft): BeadPatternPuzzle {
  const answerBead = beadAt(d, d.blank);
  const [first, second] = d.tested;
  const shown = shownBeads(d);
  const familiar = (card: BeadPatternBead) =>
    shown.some(
      (b) =>
        b !== null && b.shape === card.shape && b.pattern === card.pattern && b.dots === card.dots,
    );
  const pairs: [number, number][] = [];
  const fair: [number, number][] = [];
  for (const wa of wrongCandidates(d, first, answerBead)) {
    for (const wb of wrongCandidates(d, second, answerBead)) {
      pairs.push([wa, wb]);
      const flags = gridCards(answerBead, d, wa, wb).map(familiar);
      if (flags.slice(1).includes(flags[0] as boolean)) fair.push([wa, wb]);
    }
  }
  const [wa, wb] = rng.pick(fair.length > 0 ? fair : pairs);
  const cards = gridCards(answerBead, d, wa, wb);
  const order = rng.shuffle(range(BEAD_OPTION_COUNT));
  return {
    beads: shownBeads(d),
    blank: d.blank,
    options: order.map((i) => cards[i] as BeadPatternBead),
    answer: order.indexOf(0),
    tested: d.tested,
    rules: d.rules,
  };
}

/** Sinh câu nháp đến khi qua kiểm tra; trả số lần thử (−1 = dùng câu dự phòng). */
function draftUnique(rng: Rng, difficulty: Difficulty): { draft: Draft; attempts: number } {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const draft = DRAFTERS[difficulty](rng);
    if (beadPatternIsUnique(shownBeads(draft), beadAt(draft, draft.blank))) {
      return { draft, attempts: attempt };
    }
  }
  return { draft: fallbackDraft(difficulty), attempts: -1 };
}

/** Số câu nháp đã thử cho câu này (−1 = dùng câu dự phòng). Dùng cho test và số liệu đặc tả. */
export function beadPatternAttempts(
  roundSeed: number,
  index: number,
  difficulty: Difficulty,
): number {
  return draftUnique(createRng(deriveSeed(roundSeed, index)), difficulty).attempts;
}

/** Câu dự phòng của một mức (thẻ vẫn xáo theo seed). Dùng cho test. */
export function beadPatternFallback(
  roundSeed: number,
  index: number,
  difficulty: Difficulty,
): BeadPatternPuzzle {
  return finalize(createRng(deriveSeed(roundSeed, index)), fallbackDraft(difficulty));
}

/**
 * Các hạt FE khoanh khi hiện lời giải cho một thuộc tính (CR-006): hạt mà luật dựa vào để suy ra
 * chỗ trống, gần chỗ trống nhất trước. Rỗng khi thuộc tính không đổi.
 */
export function beadPatternClues(puzzle: BeadPatternPuzzle, attr: BeadPatternAttr): number[] {
  const n = puzzle.beads.length;
  const k = puzzle.blank;
  const shown = (i: number) => i >= 0 && i < n && i !== k;
  const byDistance = (list: number[]) =>
    list.filter(shown).sort((x, y) => Math.abs(x - k) - Math.abs(y - k) || x - y);
  const rule = puzzle.rules[attr];
  switch (rule.kind) {
    case "same":
      return [];
    case "cycle":
      return byDistance(range(n).filter((i) => (i - k) % rule.period === 0));
    case "step":
      return shown(k + 1) ? byDistance([k - 1, k + 1]) : [k - 2, k - 1];
    case "sum":
      if (k >= 2) return [k - 2, k - 1];
      return [k + 1, k + 2];
    case "alternate":
      return byDistance(range(n).filter((i) => (i - k) % 2 === 0));
  }
}

export const beadPattern: MinigameDef<BeadPatternPuzzle, BeadPatternAnswer> = {
  id: "bead-pattern",
  category: "analyze",
  durationMs: 60_000,
  difficultyMultiplier: MULTIPLIER_BY_DIFFICULTY,
  // Bot (CR-016): thời gian một câu chép từ bảng Cân bằng của đặc tả (Mầm theo trẻ 7 tuổi): giữa
  // khoảng + 0,3 s hiệu ứng chuyển câu.
  expectedSolveMs: { 0: 4_100, 1: 3_300, 2: 4_900, 3: 6_700 },
  // Bot (CR-016): tỉ lệ đúng = 1 − tỉ lệ sai ở bảng Cân bằng của đặc tả (Mầm theo trẻ 7 tuổi).
  expectedAccuracy: { 0: 0.9, 1: 0.92, 2: 0.88, 3: 0.85 },

  generate(roundSeed, index, difficulty) {
    const rng = createRng(deriveSeed(roundSeed, index));
    const { draft } = draftUnique(rng, difficulty);
    return finalize(rng, draft);
  },

  check(puzzle, answer) {
    return answer === puzzle.answer;
  },

  isAnswer(value): value is BeadPatternAnswer {
    return (
      Number.isInteger(value) && (value as number) >= 0 && (value as number) < BEAD_OPTION_COUNT
    );
  },

  // Không khai báo `speedAllowanceMs`: chuỗi và thẻ hiện đủ ngay, chạm được từ khung hình đầu,
  // một chạm là chốt (đặc tả, mục Cân bằng).
};
