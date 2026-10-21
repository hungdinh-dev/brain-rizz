import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import {
  RULE_GATE_FEATURE_ATTR,
  RULE_GATE_FEATURES,
  RULE_GATE_LEVELS,
  type RuleGateBuddy,
  type RuleGateItem,
  type RuleGatePuzzle,
  type RuleGateRule,
  type RuleGateSpecies,
  ruleGate,
  ruleGateAdmits,
  ruleGateBlock,
  ruleGateBuddyCount,
  ruleGateRule,
} from "./rule-gate";

const SEEDS = 10_000;
/** Số câu liên tiếp mỗi seed (Thường 4 khối, Khó ~5 khối, Siêu khó ~3 khối). */
const RUN = 24;

/** Không gian bạn của từng mức, dựng lại độc lập với bộ sinh. */
function space(d: Difficulty): RuleGateBuddy[] {
  const { attrs } = RULE_GATE_LEVELS[d];
  const out: RuleGateBuddy[] = [];
  for (const species of ["cat", "bunny", "panda"] as RuleGateSpecies[]) {
    for (const hat of attrs.includes("hat") ? [false, true] : [false]) {
      for (const glasses of attrs.includes("glasses") ? [false, true] : [false]) {
        const items: RuleGateItem[] = attrs.includes("item") ? ["none", "book", "ball"] : ["none"];
        for (const item of items) out.push({ species, hat, glasses, item });
      }
    }
  }
  return out;
}
const SPACE = new Map(DIFFICULTIES.map((d) => [d, space(d)]));
const buddyKey = (b: RuleGateBuddy) => `${b.species}|${b.hat}|${b.glasses}|${b.item}`;
const SPACE_KEYS = new Map(DIFFICULTIES.map((d) => [d, new Set(space(d).map(buddyKey))]));

/** Bảng chân trị của luật trên mọi bạn của mức. */
function truth(rule: RuleGateRule, d: Difficulty): string {
  return (SPACE.get(d) as RuleGateBuddy[])
    .map((b) => (ruleGateAdmits(rule, b) ? "1" : "0"))
    .join("");
}

interface Stats {
  n: number;
  ins: number;
  blocks: number;
  terms: number;
  negated: number;
  rules: number;
  /** Số lần luật đổi giữa hai câu liền nhau trong RUN câu. */
  changes: number;
  lengths: Map<number, number>;
}

function fail(seed: number, index: number, msg: string): never {
  throw new Error(`seed ${seed} câu ${index}: ${msg}`);
}

/** Kiểm từng câu (mọi câu trong RUN) và từng khối trọn vẹn (khối nằm hết trong RUN câu). */
function sweep(d: Difficulty): Stats {
  const level = RULE_GATE_LEVELS[d];
  const keys = SPACE_KEYS.get(d) as Set<string>;
  const s: Stats = {
    n: 0,
    ins: 0,
    blocks: 0,
    terms: 0,
    negated: 0,
    rules: 0,
    changes: 0,
    lengths: new Map(),
  };
  for (let seed = 0; seed < SEEDS; seed++) {
    const run: RuleGatePuzzle[] = Array.from({ length: RUN }, (_, i) =>
      ruleGate.generate(seed, i, d),
    );
    let prevRule: RuleGateRule | undefined;
    let firstRule: string | undefined;
    for (let i = 0; i < RUN; ) {
      const blk = ruleGateBlock(seed, i, d);
      if (blk.start !== i) fail(seed, i, "khối không nối tiếp");
      if (blk.length < level.minBlock || blk.length > level.maxBlock)
        fail(seed, i, "sai độ dài khối");
      const rule = ruleGateRule(seed, blk.block, d);
      const ruleJson = JSON.stringify(rule);
      const table = truth(rule, d);

      // Luật đúng dạng của mức, không hằng đúng / hằng sai.
      if (rule.op === "single" ? level.terms !== 1 : level.terms !== 2) fail(seed, i, "sai số vế");
      if (rule.terms.length !== level.terms) fail(seed, i, "sai số vế");
      const attrs = rule.terms.map((t) => RULE_GATE_FEATURE_ATTR[t.feature]);
      for (const a of attrs)
        if (!level.attrs.includes(a)) fail(seed, i, `thuộc tính ${a} không có ở mức`);
      if (attrs.length === 2 && level.attrs.indexOf(attrs[0]!) >= level.attrs.indexOf(attrs[1]!)) {
        fail(seed, i, "hai vế không theo thứ tự thuộc tính / trùng thuộc tính");
      }
      if (level.negatePct === 0 && rule.terms.some((t) => t.negated))
        fail(seed, i, "phủ định sai mức");
      if (!table.includes("0") || !table.includes("1")) fail(seed, i, "luật hằng");
      s.rules++;
      s.terms += rule.terms.length;
      s.negated += rule.terms.filter((t) => t.negated).length;

      // Luật mới khác luật cũ (bảng chân trị), Mầm giữ một luật cả vòng.
      if (firstRule === undefined) firstRule = ruleJson;
      if (!level.changes && ruleJson !== firstRule) fail(seed, i, "Mầm đổi luật");
      if (prevRule && level.changes) {
        if (truth(prevRule, d) === table) fail(seed, i, "luật mới trùng luật cũ");
        const prevAttr = RULE_GATE_FEATURE_ATTR[prevRule.terms[0].feature];
        if (level.newAttr && prevAttr === attrs[0]) fail(seed, i, "Siêu khó không đổi thuộc tính");
      }

      const end = Math.min(blk.start + blk.length, RUN);
      for (let j = blk.start; j < end; j++) {
        const p = run[j] as RuleGatePuzzle;
        const pos = j - blk.start;
        // Đúng một đáp án, khớp luật.
        const correct = (["in", "out"] as const).filter((a) => ruleGate.check(p, a));
        if (correct.length !== 1 || correct[0] !== p.answer) fail(seed, j, "không đúng một đáp án");
        if (p.answer !== (ruleGateAdmits(p.rule, p.buddy) ? "in" : "out"))
          fail(seed, j, "đáp án lệch luật");
        // Luật của câu chỉ phụ thuộc khối.
        if (JSON.stringify(p.rule) !== ruleJson) fail(seed, j, "luật khác luật của khối");
        if (!keys.has(buddyKey(p.buddy))) fail(seed, j, "bạn ngoài không gian của mức");
        if (p.ruleShown !== level.ruleShown) fail(seed, j, "sai ruleShown");
        const isNew = level.ruleShown && level.changes && blk.block > 0 && pos === 0;
        if (p.ruleIsNew !== isNew) fail(seed, j, "sai ruleIsNew");
        if (j > 0 && JSON.stringify((run[j - 1] as RuleGatePuzzle).rule) !== ruleJson) s.changes++;
        s.n++;
        if (p.answer === "in") s.ins++;
      }

      if (blk.start + blk.length <= RUN) {
        const block = run.slice(blk.start, blk.start + blk.length);
        const ins = block.filter((p) => p.answer === "in").length;
        if (ins < 2 || blk.length - ins < 2) fail(seed, i, `khối ${ins}/${blk.length} câu vào`);
        if (new Set(block.map((p) => buddyKey(p.buddy))).size !== block.length) {
          fail(seed, i, "hai bạn giống hệt nhau trong một khối");
        }
        // Câu phân định: luật cũ xử ngược luật mới trong `discriminateWithin` câu đầu khối mới.
        if (prevRule && level.changes) {
          const old = prevRule;
          const head = block.slice(0, level.discriminateWithin);
          if (!head.some((p) => ruleGateAdmits(old, p.buddy) !== (p.answer === "in"))) {
            fail(seed, i, "khối mới không có câu phân định");
          }
        }
        s.blocks++;
        s.lengths.set(blk.length, (s.lengths.get(blk.length) ?? 0) + 1);
      }
      prevRule = rule;
      i = blk.start + blk.length;
    }
  }
  return s;
}

const STATS = new Map<Difficulty, Stats>();
function stats(d: Difficulty): Stats {
  let s = STATS.get(d);
  if (!s) {
    s = sweep(d);
    STATS.set(d, s);
  }
  return s;
}

/**
 * Người học lý tưởng cho luật ẩn: giữ các luật một vế còn khớp với 4 câu gần nhất (rút ngắn cửa sổ
 * khi không luật nào khớp, tức luật vừa đổi), trả lời theo đa số, hoà thì chọn "vào". Không trượt tay.
 */
function idealLearnerErrorRate(d: Difficulty, seeds: number, questions: number): number {
  const level = RULE_GATE_LEVELS[d];
  const hyps: RuleGateRule[] = [];
  for (const a of level.attrs) {
    for (const feature of RULE_GATE_FEATURES[a]) {
      for (const negated of level.negatePct > 0 ? [false, true] : [false]) {
        hyps.push({ op: "single", terms: [{ feature, negated }] });
      }
    }
  }
  let wrong = 0;
  for (let seed = 0; seed < seeds; seed++) {
    const hist: { b: RuleGateBuddy; inside: boolean }[] = [];
    for (let i = 0; i < questions; i++) {
      const p = ruleGate.generate(seed, i, d);
      let live = hyps;
      for (let w = Math.min(4, hist.length); w >= 0; w--) {
        const ex = hist.slice(hist.length - w);
        const fit = hyps.filter((h) => ex.every((e) => ruleGateAdmits(h, e.b) === e.inside));
        if (fit.length > 0) {
          live = fit;
          break;
        }
      }
      const yes = live.filter((h) => ruleGateAdmits(h, p.buddy)).length;
      const guess = yes * 2 >= live.length ? "in" : "out";
      if (guess !== p.answer) wrong++;
      hist.push({ b: p.buddy, inside: p.answer === "in" });
    }
  }
  return wrong / (seeds * questions);
}

describe("rule-gate", () => {
  it("tất định: cùng (seed, index, độ khó) → cùng câu đố", () => {
    for (const d of DIFFICULTIES) {
      for (let seed = 0; seed < 300; seed++) {
        const index = (seed * 7) % 70;
        expect(ruleGate.generate(seed, index, d)).toEqual(ruleGate.generate(seed, index, d));
      }
    }
  });

  it("không giữ trạng thái: sinh xuôi hay ngược đều ra cùng câu", () => {
    for (const d of DIFFICULTIES) {
      for (const seed of [3, 77, 4_242]) {
        const forward = Array.from({ length: 60 }, (_, i) => ruleGate.generate(seed, i, d));
        const backward = Array.from({ length: 60 }, (_, i) =>
          ruleGate.generate(seed, 59 - i, d),
        ).reverse();
        expect(backward).toEqual(forward);
      }
    }
  });

  for (const d of DIFFICULTIES) {
    it(`mức ${d}: đúng một đáp án, luật theo khối, khối đủ vào/về, có câu phân định (${SEEDS} seed × ${RUN} câu)`, () => {
      expect(stats(d).n).toBe(SEEDS * RUN);
    }, 60_000);
  }

  it("không gian bạn: Mầm 18 bạn (không kính), các mức khác 36 bạn", () => {
    expect(DIFFICULTIES.map((d) => ruleGateBuddyCount(d))).toEqual([18, 36, 36, 36]);
    for (const d of DIFFICULTIES) expect(SPACE.get(d)).toHaveLength(ruleGateBuddyCount(d));
  });

  it("đáp án vào/về cân bằng (45–55 %) ở mọi mức", () => {
    for (const d of DIFFICULTIES) {
      const ratio = stats(d).ins / stats(d).n;
      expect(ratio).toBeGreaterThan(0.45);
      expect(ratio).toBeLessThan(0.55);
    }
  });

  it("luật đổi đúng chu kỳ: Mầm không đổi, Thường mỗi 6 câu, Khó 4–6, Siêu khó 6–8 (bốc đều)", () => {
    expect(stats(0).changes).toBe(0);
    // Thường: đổi đúng ở câu 6, 12, 18 của RUN = 24 câu.
    expect(stats(1).changes).toBe(SEEDS * 3);
    for (let seed = 0; seed < 200; seed++) {
      for (let i = 1; i < 40; i++) {
        const changed =
          JSON.stringify(ruleGate.generate(seed, i, 1).rule) !==
          JSON.stringify(ruleGate.generate(seed, i - 1, 1).rule);
        expect(changed).toBe(i % 6 === 0);
      }
    }
    for (const [d, lens] of [
      [2, [4, 5, 6]],
      [3, [6, 7, 8]],
    ] as const) {
      const s = stats(d);
      expect([...s.lengths.keys()].sort()).toEqual([...lens]);
      for (const len of lens) {
        const share = (s.lengths.get(len) ?? 0) / s.blocks;
        expect(share).toBeGreaterThan(0.3);
        expect(share).toBeLessThan(0.37);
      }
    }
  });

  it("Thường và Siêu khó cùng seed không dùng chung luật (luồng ngẫu nhiên riêng theo mức)", () => {
    let same = 0;
    for (let seed = 0; seed < 2_000; seed++) {
      if (JSON.stringify(ruleGateRule(seed, 0, 1)) === JSON.stringify(ruleGateRule(seed, 0, 3))) {
        same++;
      }
    }
    // Trùng ngẫu nhiên ~18 % (cùng cách bốc một đặc điểm); dùng chung luồng thì 100 %.
    expect(same / 2_000).toBeLessThan(0.25);
  });

  it("khó dần: mỗi bước lên mức tăng ít nhất một chỉ số đo được", () => {
    const m = DIFFICULTIES.map((d) => {
      const s = stats(d);
      const level = RULE_GATE_LEVELS[d];
      return {
        attrs: level.attrs.length,
        changes: s.changes / SEEDS,
        terms: s.terms / s.rules,
        negated: s.negated / s.terms,
        hidden: level.ruleShown ? 0 : 1,
        // Luật hiện trên bảng thì người đọc đúng luật không bao giờ buộc phải sai.
        forcedError: level.ruleShown ? 0 : idealLearnerErrorRate(d, 1_500, 30),
      };
    });
    const [seedling, normal, hard, expert] = m as [
      (typeof m)[0],
      (typeof m)[0],
      (typeof m)[0],
      (typeof m)[0],
    ];
    // Mầm → Thường: thêm thuộc tính kính, luật bắt đầu đổi.
    expect(normal.attrs).toBeGreaterThan(seedling.attrs);
    expect(normal.changes).toBeGreaterThan(seedling.changes);
    // Thường → Khó: luật hai vế, có phủ định, đổi dày hơn.
    expect(hard.terms).toBe(2);
    expect(normal.terms).toBe(1);
    expect(hard.negated).toBeGreaterThan(0.25);
    expect(hard.negated).toBeLessThan(0.35);
    expect(normal.negated).toBe(0);
    expect(hard.changes).toBeGreaterThan(normal.changes);
    // Khó → Siêu khó: luật ẩn, người học lý tưởng vẫn buộc sai ~1/4 số câu (Khó: 0).
    expect(expert.hidden).toBe(1);
    expect(hard.hidden).toBe(0);
    expect(expert.forcedError).toBeGreaterThan(0.18);
    expect(expert.forcedError).toBeLessThan(0.32);
    expect(hard.forcedError).toBe(0);
  }, 60_000);

  it("luật ẩn học được: người học lý tưởng sai ít hơn hẳn đoán mò (50 %)", () => {
    expect(idealLearnerErrorRate(3, 1_000, 40)).toBeLessThan(0.32);
  });

  it("isAnswer() từ chối dữ liệu rác", () => {
    expect(ruleGate.isAnswer("in")).toBe(true);
    expect(ruleGate.isAnswer("out")).toBe(true);
    for (const junk of ["IN", "Out", "", " in", 0, 1, true, null, undefined, {}, ["in"]]) {
      expect(ruleGate.isAnswer(junk)).toBe(false);
    }
  });

  it("check() chỉ nhận đúng đáp án của câu", () => {
    const p = ruleGate.generate(5, 3, 2);
    const other = p.answer === "in" ? "out" : "in";
    expect(ruleGate.check(p, p.answer)).toBe(true);
    expect(ruleGate.check(p, other)).toBe(false);
  });
});
