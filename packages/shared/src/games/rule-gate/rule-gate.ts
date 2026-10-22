import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed, type Rng } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * Cổng luật (nhóm Phân tích): từng bạn đi tới cổng lớp. Luật vẽ bằng biểu tượng trên bảng nói bạn
 * nào được vào; cho vào (vuốt trái) hoặc mời về (vuốt phải). Luật là điều kiện trên đặc điểm của
 * bạn (loài, mũ, kính, đồ cầm tay), đổi theo khối câu. Siêu khó giấu luật, chỉ biết qua đúng/sai.
 * Đặc tả: docs/04-minigames/rule-gate.md.
 *
 * Không giữ trạng thái: luật của câu `index` chỉ phụ thuộc khối chứa câu đó, mà ranh giới khối và
 * luật từng khối đều tính lại từ seed vòng (chuỗi O(số khối), mỗi vòng chỉ ~5–15 khối).
 */

export type RuleGateSpecies = "cat" | "bunny" | "panda";
export type RuleGateItem = "none" | "book" | "ball";

/** Một bạn đi tới cổng. Mọi thuộc tính vẽ bằng hình (tai, mũ, kính, đồ cầm), không chỉ bằng màu. */
export interface RuleGateBuddy {
  /** Loài: mèo (tai nhọn), thỏ (tai dài), gấu trúc (tai tròn, quầng mắt). */
  species: RuleGateSpecies;
  /** Đội mũ lưỡi trai. */
  hat: boolean;
  /** Đeo kính tròn. Mầm luôn `false`. */
  glasses: boolean;
  /** Đồ cầm tay. */
  item: RuleGateItem;
}

/** Thuộc tính của bạn. */
export type RuleGateAttr = "species" | "hat" | "glasses" | "item";

/** Đặc điểm = một biểu tượng trên bảng luật; mỗi đặc điểm thuộc đúng một thuộc tính. */
export type RuleGateFeature = "cat" | "bunny" | "panda" | "hat" | "glasses" | "book" | "ball";

/** Các đặc điểm của từng thuộc tính (thứ tự cố định, dùng khi sinh luật). */
export const RULE_GATE_FEATURES: Readonly<Record<RuleGateAttr, readonly RuleGateFeature[]>> = {
  species: ["cat", "bunny", "panda"],
  hat: ["hat"],
  glasses: ["glasses"],
  item: ["book", "ball"],
};

export const RULE_GATE_FEATURE_ATTR: Readonly<Record<RuleGateFeature, RuleGateAttr>> = {
  cat: "species",
  bunny: "species",
  panda: "species",
  hat: "hat",
  glasses: "glasses",
  book: "item",
  ball: "item",
};

/** Một vế của luật: bạn có đặc điểm `feature` (hoặc KHÔNG có, khi `negated`). */
export interface RuleGateTerm {
  feature: RuleGateFeature;
  negated: boolean;
}

/**
 * Luật = điều kiện để được VÀO; không thoả thì mời về. Một vế, hoặc hai vế trên hai thuộc tính
 * khác nhau nối bằng VÀ / HOẶC. Hai vế luôn xếp theo thứ tự thuộc tính của `RULE_GATE_LEVELS.attrs`.
 */
export type RuleGateRule =
  | { op: "single"; terms: [RuleGateTerm] }
  | { op: "and" | "or"; terms: [RuleGateTerm, RuleGateTerm] };

/** Đáp án = cho vào (`"in"`, vuốt trái) hoặc mời về (`"out"`, vuốt phải). */
export type RuleGateAnswer = "in" | "out";

export interface RuleGatePuzzle {
  buddy: RuleGateBuddy;
  /** Luật của khối chứa câu này. Có cả khi `ruleShown = false` (để FE hiện gợi ý, xem đặc tả). */
  rule: RuleGateRule;
  /** Vẽ luật lên bảng không. Siêu khó: `false` (luật ẩn). */
  ruleShown: boolean;
  /** Câu đầu của khối mới (luật vừa đổi) ở mức hiện luật: FE báo "luật mới". Siêu khó luôn `false`. */
  ruleIsNew: boolean;
  /** Đáp án đúng = `ruleGateAdmits(rule, buddy) ? "in" : "out"`. */
  answer: RuleGateAnswer;
}

export interface RuleGateLevel {
  /** Thuộc tính thay đổi giữa các bạn; thuộc tính còn lại giữ mặc định (không kính, không cầm gì). */
  attrs: readonly RuleGateAttr[];
  /** Số vế của luật. */
  terms: 1 | 2;
  /** % mỗi vế bị phủ định ("không có …"). */
  negatePct: number;
  /** Luật đổi theo khối không (Mầm: một luật cả vòng). */
  changes: boolean;
  /** Độ dài khối (số câu), bốc đều trong [minBlock, maxBlock] cho từng khối. */
  minBlock: number;
  maxBlock: number;
  /**
   * Khối mới có một "câu phân định" (luật cũ cho đáp án khác luật mới), đặt ngẫu nhiên trong
   * `discriminateWithin` câu đầu khối. 0 = không có (Mầm).
   */
  discriminateWithin: number;
  ruleShown: boolean;
  /** Luật mới phải dùng thuộc tính khác luật cũ (Siêu khó, như Wisconsin đổi chiều phân loại). */
  newAttr: boolean;
}

export const RULE_GATE_LEVELS: Readonly<Record<Difficulty, RuleGateLevel>> = {
  0: {
    attrs: ["species", "hat", "item"],
    terms: 1,
    negatePct: 0,
    changes: false,
    minBlock: 6,
    maxBlock: 6,
    discriminateWithin: 0,
    ruleShown: true,
    newAttr: false,
  },
  1: {
    attrs: ["species", "hat", "glasses", "item"],
    terms: 1,
    negatePct: 0,
    changes: true,
    minBlock: 6,
    maxBlock: 6,
    discriminateWithin: 3,
    ruleShown: true,
    newAttr: false,
  },
  2: {
    attrs: ["species", "hat", "glasses", "item"],
    terms: 2,
    negatePct: 30,
    changes: true,
    minBlock: 4,
    maxBlock: 6,
    discriminateWithin: 3,
    ruleShown: true,
    newAttr: false,
  },
  3: {
    attrs: ["species", "hat", "glasses", "item"],
    terms: 1,
    // Luật ẩn không phủ định: các bạn được vào luôn chung một đặc điểm nhìn thấy được (dễ "à ra
    // thế" hơn là chung một thứ không có). Có phủ định thì người học lý tưởng sai 31 % thay vì 25 %.
    negatePct: 0,
    changes: true,
    minBlock: 6,
    maxBlock: 8,
    discriminateWithin: 1,
    ruleShown: false,
    newAttr: true,
  },
};

/**
 * Muối tách các luồng ngẫu nhiên: độ dài khối, luật khối, phân câu trong khối. Cộng thêm độ khó
 * (0–3) để hai người cùng phòng chọn hai mức khác nhau không thấy chung luật (người Siêu khó
 * không nhìn trộm được luật ẩn trên máy người chơi Thường).
 */
const LENGTH_SALT = 0x6a70;
const RULE_SALT = 0x6a80;
const PLAN_SALT = 0x6a90;
/** Số lần bốc lại luật khi trùng luật cũ trước khi dùng cách thay tất định. */
const MAX_RULE_TRIES = 8;

/** Bạn có đặc điểm này không. */
export function ruleGateHas(buddy: RuleGateBuddy, feature: RuleGateFeature): boolean {
  switch (feature) {
    case "hat":
      return buddy.hat;
    case "glasses":
      return buddy.glasses;
    case "book":
    case "ball":
      return buddy.item === feature;
    default:
      return buddy.species === feature;
  }
}

/** Vế luật đúng với bạn này không (FE dùng để đánh dấu từng vế khi hiện đáp án). */
export function ruleGateTermHolds(buddy: RuleGateBuddy, term: RuleGateTerm): boolean {
  return ruleGateHas(buddy, term.feature) !== term.negated;
}

/** Luật cho bạn này vào không. */
export function ruleGateAdmits(rule: RuleGateRule, buddy: RuleGateBuddy): boolean {
  const first = ruleGateTermHolds(buddy, rule.terms[0]);
  if (rule.op === "single") return first;
  const second = ruleGateTermHolds(buddy, rule.terms[1]);
  return rule.op === "and" ? first && second : first || second;
}

/** Mọi bạn có thể gặp ở một mức (thứ tự cố định). Mầm 18 bạn, các mức khác 36 bạn. */
function buddySpace(attrs: readonly RuleGateAttr[]): readonly RuleGateBuddy[] {
  const hats = attrs.includes("hat") ? [false, true] : [false];
  const glasses = attrs.includes("glasses") ? [false, true] : [false];
  const items: RuleGateItem[] = attrs.includes("item") ? ["none", "book", "ball"] : ["none"];
  const out: RuleGateBuddy[] = [];
  for (const species of RULE_GATE_FEATURES.species as RuleGateSpecies[]) {
    for (const hat of hats) {
      for (const g of glasses) {
        for (const item of items) out.push({ species, hat, glasses: g, item });
      }
    }
  }
  return out;
}

const SPACES: Readonly<Record<Difficulty, readonly RuleGateBuddy[]>> = {
  0: buddySpace(RULE_GATE_LEVELS[0].attrs),
  1: buddySpace(RULE_GATE_LEVELS[1].attrs),
  2: buddySpace(RULE_GATE_LEVELS[2].attrs),
  3: buddySpace(RULE_GATE_LEVELS[3].attrs),
};

/** Số bạn khác nhau có thể gặp ở mức này. */
export function ruleGateBuddyCount(difficulty: Difficulty): number {
  return SPACES[difficulty].length;
}

export interface RuleGateBlock {
  /** Số thứ tự khối (0, 1, 2…). */
  block: number;
  /** Chỉ số câu đầu khối. */
  start: number;
  /** Số câu của khối. */
  length: number;
}

function blockLength(roundSeed: number, block: number, difficulty: Difficulty): number {
  const level = RULE_GATE_LEVELS[difficulty];
  if (level.minBlock === level.maxBlock) return level.minBlock;
  return createRng(deriveSeed(roundSeed, block, LENGTH_SALT + difficulty)).int(
    level.minBlock,
    level.maxBlock,
  );
}

/**
 * Khối chứa câu `index`. Độ dài khối thứ j bốc từ `deriveSeed(seed, j, muối + độ khó)`, nên ranh giới
 * khối là một dãy cố định theo seed vòng: không phụ thuộc thứ tự sinh câu. Chỉ dùng cho test và mô
 * phỏng; FE không được dùng để báo đổi luật ở Siêu khó (luật đổi ngầm).
 */
export function ruleGateBlock(
  roundSeed: number,
  index: number,
  difficulty: Difficulty,
): RuleGateBlock {
  const level = RULE_GATE_LEVELS[difficulty];
  const i = Math.max(0, Math.floor(index));
  if (level.minBlock === level.maxBlock) {
    const block = Math.floor(i / level.minBlock);
    return { block, start: block * level.minBlock, length: level.minBlock };
  }
  let start = 0;
  for (let block = 0; ; block++) {
    const length = blockLength(roundSeed, block, difficulty);
    if (i < start + length) return { block, start, length };
    start += length;
  }
}

function attrOf(rule: RuleGateRule): RuleGateAttr {
  return RULE_GATE_FEATURE_ATTR[rule.terms[0].feature];
}

function sameTerm(a: RuleGateTerm, b: RuleGateTerm): boolean {
  return a.feature === b.feature && a.negated === b.negated;
}

/**
 * Hai luật dạng chuẩn có cùng chữ không. Ở dạng chuẩn (vế xếp theo thuộc tính, hai vế khác thuộc
 * tính, mỗi vế không hằng đúng/hằng sai) khác chữ ⇔ khác bảng chân trị; test kiểm lại bằng bảng chân trị.
 */
function sameRule(a: RuleGateRule, b: RuleGateRule): boolean {
  if (a.op !== b.op) return false;
  if (a.op === "single" || b.op === "single") return sameTerm(a.terms[0], b.terms[0]);
  return sameTerm(a.terms[0], b.terms[0]) && sameTerm(a.terms[1], b.terms[1]);
}

function drawTerm(rng: Rng, attr: RuleGateAttr, negatePct: number): RuleGateTerm {
  const feature = rng.pick(RULE_GATE_FEATURES[attr]);
  return { feature, negated: rng.int(0, 99) < negatePct };
}

function drawRawRule(rng: Rng, level: RuleGateLevel): RuleGateRule {
  if (level.terms === 1) {
    return { op: "single", terms: [drawTerm(rng, rng.pick(level.attrs), level.negatePct)] };
  }
  // Hai thuộc tính khác nhau, xếp theo thứ tự của `level.attrs` (dạng chuẩn).
  const [x, y] = rng.shuffle(level.attrs.map((_, k) => k)) as [number, number];
  const a = level.attrs[Math.min(x, y)] as RuleGateAttr;
  const b = level.attrs[Math.max(x, y)] as RuleGateAttr;
  const op = rng.int(0, 1) === 0 ? "and" : "or";
  return {
    op,
    terms: [drawTerm(rng, a, level.negatePct), drawTerm(rng, b, level.negatePct)],
  };
}

function acceptable(rule: RuleGateRule, prev: RuleGateRule, level: RuleGateLevel): boolean {
  if (sameRule(rule, prev)) return false;
  return !level.newAttr || attrOf(rule) !== attrOf(prev);
}

/** Luật thay tất định khi bốc lại `MAX_RULE_TRIES` lần vẫn trùng (hầu như không xảy ra). */
function fallbackRule(prev: RuleGateRule, level: RuleGateLevel): RuleGateRule {
  if (prev.op !== "single") {
    // Cùng hai vế, đổi VÀ ↔ HOẶC: hai vế không hằng trên hai thuộc tính độc lập nên luôn khác luật.
    return {
      op: prev.op === "and" ? "or" : "and",
      terms: [{ ...prev.terms[0] }, { ...prev.terms[1] }],
    };
  }
  const at = level.attrs.indexOf(attrOf(prev));
  const attr = level.attrs[(at + 1) % level.attrs.length] as RuleGateAttr;
  return {
    op: "single",
    terms: [{ feature: RULE_GATE_FEATURES[attr][0] as RuleGateFeature, negated: false }],
  };
}

/** Luật khối `block` và luật khối trước (nếu luật vừa đổi). Chuỗi tính lại từ khối 0. */
function ruleChain(
  roundSeed: number,
  block: number,
  difficulty: Difficulty,
): { rule: RuleGateRule; prev?: RuleGateRule } {
  const level = RULE_GATE_LEVELS[difficulty];
  const salt = RULE_SALT + difficulty;
  let rule = drawRawRule(createRng(deriveSeed(roundSeed, 0, salt)), level);
  if (!level.changes) return { rule };
  let prev: RuleGateRule | undefined;
  for (let j = 1; j <= block; j++) {
    const rng = createRng(deriveSeed(roundSeed, j, salt));
    let next: RuleGateRule | undefined;
    for (let t = 0; t < MAX_RULE_TRIES && !next; t++) {
      const candidate = drawRawRule(rng, level);
      if (acceptable(candidate, rule, level)) next = candidate;
    }
    prev = rule;
    rule = next ?? fallbackRule(rule, level);
  }
  return { rule, prev };
}

/** Luật của khối `block` (để test, mô phỏng và màn xem lại). */
export function ruleGateRule(
  roundSeed: number,
  block: number,
  difficulty: Difficulty,
): RuleGateRule {
  return ruleChain(roundSeed, Math.max(0, Math.floor(block)), difficulty).rule;
}

/** Lấy `k` phần tử khác nhau (xáo một phần Fisher–Yates); thiếu thì quay vòng (không xảy ra). */
function pickDistinct(rng: Rng, list: readonly number[], k: number): number[] {
  const arr = list.slice();
  const out: number[] = [];
  for (let i = 0; i < k; i++) {
    const n = arr.length;
    if (i < n) {
      const j = rng.int(i, n - 1);
      [arr[i], arr[j]] = [arr[j] as number, arr[i] as number];
    }
    out.push(arr[i % n] as number);
  }
  return out;
}

/**
 * Phân câu trong một khối: đáp án và bạn của từng vị trí.
 * - Khối có từ 2 câu "vào" trở lên và từ 2 câu "về" trở lên (số câu "vào" bốc đều trong [2, L − 2]).
 * - Khối mới (luật vừa đổi) có một câu phân định ở một trong `discriminateWithin` câu đầu: bạn ở câu
 *   đó được luật cũ xử ngược luật mới, nên ai không theo luật mới chắc chắn sai câu này.
 * - Không có hai bạn giống hệt nhau trong một khối.
 */
function planBlock(
  roundSeed: number,
  blk: RuleGateBlock,
  difficulty: Difficulty,
): { rule: RuleGateRule; buddies: number[] } {
  const level = RULE_GATE_LEVELS[difficulty];
  const space = SPACES[difficulty];
  const { rule, prev } = ruleChain(roundSeed, blk.block, difficulty);
  const rng = createRng(deriveSeed(roundSeed, blk.block, PLAN_SALT + difficulty));
  const len = blk.length;

  const inList: number[] = [];
  const outList: number[] = [];
  space.forEach((b, i) => {
    (ruleGateAdmits(rule, b) ? inList : outList).push(i);
  });

  const buddies: number[] = new Array(len).fill(0);
  let fixedPos = -1;
  let fixedIn = false;
  let fixedBuddy = -1;
  if (prev && level.discriminateWithin > 0) {
    // Luật khác nhau (đã kiểm khi sinh) nên ít nhất một trong hai tập khác rỗng.
    const newInOldOut = inList.filter((i) => !ruleGateAdmits(prev, space[i] as RuleGateBuddy));
    const newOutOldIn = outList.filter((i) => ruleGateAdmits(prev, space[i] as RuleGateBuddy));
    const coin = rng.int(0, 1);
    fixedIn = newInOldOut.length > 0 && (newOutOldIn.length === 0 || coin === 0);
    const pool = fixedIn ? newInOldOut : newOutOldIn;
    fixedPos = rng.int(0, Math.min(level.discriminateWithin, len) - 1);
    fixedBuddy = pool[rng.int(0, pool.length - 1)] as number;
    buddies[fixedPos] = fixedBuddy;
  }

  const inCount = rng.int(2, len - 2);
  const free = Array.from({ length: len }, (_, i) => i).filter((i) => i !== fixedPos);
  const restIn = inCount - (fixedIn ? 1 : 0);
  const order = rng.shuffle(free);
  const without = (list: number[]) => {
    const rest = list.filter((i) => i !== fixedBuddy);
    return rest.length > 0 ? rest : list;
  };
  const ins = pickDistinct(rng, without(inList), restIn);
  const outs = pickDistinct(rng, without(outList), order.length - restIn);
  order.forEach((pos, k) => {
    buddies[pos] = (k < restIn ? ins[k] : outs[k - restIn]) as number;
  });
  return { rule, buddies };
}

function cloneRule(rule: RuleGateRule): RuleGateRule {
  return rule.op === "single"
    ? { op: "single", terms: [{ ...rule.terms[0] }] }
    : { op: rule.op, terms: [{ ...rule.terms[0] }, { ...rule.terms[1] }] };
}

export const ruleGate: MinigameDef<RuleGatePuzzle, RuleGateAnswer> = {
  id: "rule-gate",
  category: "analyze",
  durationMs: 60_000,
  // Bảng Cân bằng của đặc tả (mô phỏng 200 000 vòng mỗi mức, làm tròn 0,05): trẻ 7 tuổi ở Mầm cần
  // 2,24 → chặn trần 1; Khó cần 2,05; Siêu khó cần 2,39 (có gợi ý luật sau 2 câu sai liền ở FE).
  difficultyMultiplier: { 0: 1, 1: 1, 2: 2.05, 3: 2.4 },
  // Bot (CR-016): thời gian một câu chép từ bảng Cân bằng của đặc tả (Mầm theo trẻ 7 tuổi): giữa
  // khoảng (gồm câu đầu khối) + 0,3 s hiệu ứng chuyển câu.
  expectedSolveMs: { 0: 2_500, 1: 1_550, 2: 2_250, 3: 1_600 },
  // Bot (CR-016): tỉ lệ đúng = 1 − tỉ lệ sai chung (gồm câu đầu khối) ở bảng Cân bằng của đặc tả
  // (Mầm theo trẻ 7 tuổi).
  expectedAccuracy: { 0: 0.92, 1: 0.95, 2: 0.91, 3: 0.74 },
  // Không khai báo `speedAllowanceMs` / `answerWindowMs`: bạn hiện là chạm được ngay, không có pha
  // trình chiếu, không có vật biến mất.

  generate(roundSeed, index, difficulty) {
    const level = RULE_GATE_LEVELS[difficulty];
    const blk = ruleGateBlock(roundSeed, index, difficulty);
    const plan = planBlock(roundSeed, blk, difficulty);
    const pos = Math.max(0, Math.floor(index)) - blk.start;
    const buddy = { ...(SPACES[difficulty][plan.buddies[pos] as number] as RuleGateBuddy) };
    return {
      buddy,
      rule: cloneRule(plan.rule),
      ruleShown: level.ruleShown,
      ruleIsNew: level.ruleShown && level.changes && blk.block > 0 && pos === 0,
      answer: ruleGateAdmits(plan.rule, buddy) ? "in" : "out",
    };
  },

  check(puzzle, answer) {
    return answer === puzzle.answer;
  },

  isAnswer(value): value is RuleGateAnswer {
    return value === "in" || value === "out";
  },
};
