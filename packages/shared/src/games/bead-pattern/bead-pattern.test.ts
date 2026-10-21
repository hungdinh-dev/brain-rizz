import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import {
  BEAD_DOTS_MAX,
  BEAD_DOTS_MIN,
  BEAD_OPTION_COUNT,
  BEAD_PATTERN_ATTRS,
  BEAD_PATTERN_COUNT,
  BEAD_PATTERN_LEVELS,
  BEAD_SHAPE_COUNT,
  type BeadPatternAttr,
  type BeadPatternBead,
  type BeadPatternPuzzle,
  type BeadPatternRule,
  beadPattern,
  beadPatternAttempts,
  beadPatternClues,
  beadPatternFallback,
  beadPatternIsUnique,
  beadPatternPredictions,
} from "./bead-pattern";

/** Số seed mỗi mức (4 mức → 40 000 câu, hơn mức tối thiểu 10 000). */
const SEEDS = 10_000;

const puzzlesOf = (d: Difficulty): BeadPatternPuzzle[] =>
  Array.from({ length: SEEDS }, (_, seed) => beadPattern.generate(seed, seed % 20, d));

const PUZZLES: Record<Difficulty, BeadPatternPuzzle[]> = {
  0: puzzlesOf(0),
  1: puzzlesOf(1),
  2: puzzlesOf(2),
  3: puzzlesOf(3),
};

const sameBead = (a: BeadPatternBead | null, b: BeadPatternBead | null) =>
  a !== null && b !== null && a.shape === b.shape && a.pattern === b.pattern && a.dots === b.dots;

// ---------------------------------------------------------------------------------------------
// Bộ kiểm vét cạn, viết độc lập với bộ giải tuyến tính trong bead-pattern.ts: thử mọi giá trị
// cho chỗ trống, giữ những giá trị làm cả dãy thoả một luật của thư viện.
// ---------------------------------------------------------------------------------------------

interface Law {
  name: string;
  params: number;
  holds(v: readonly number[]): boolean;
}

const every = (from: number, to: number, f: (i: number) => boolean) => {
  for (let i = from; i < to; i++) if (!f(i)) return false;
  return true;
};

function cycleLaw(p: number): Law {
  return {
    name: `cycle${p}`,
    params: p,
    holds: (v) => every(0, v.length - p, (i) => v[i] === v[i + p]),
  };
}

const NUMERIC_LAWS: readonly Law[] = [
  {
    name: "step",
    params: 2,
    holds: (v) =>
      every(
        0,
        v.length - 2,
        (i) =>
          (v[i + 2] as number) - (v[i + 1] as number) === (v[i + 1] as number) - (v[i] as number),
      ),
  },
  {
    name: "grow",
    params: 3,
    holds: (v) =>
      every(0, v.length - 3, (i) => {
        const [a, b, c, d] = [v[i], v[i + 1], v[i + 2], v[i + 3]] as number[];
        return (d as number) - 3 * (c as number) + 3 * (b as number) - (a as number) === 0;
      }),
  },
  {
    name: "ratio",
    params: 2,
    holds: (v) =>
      v.every((x) => x !== 0) &&
      every(
        0,
        v.length - 2,
        (i) => (v[i + 1] as number) ** 2 === (v[i] as number) * (v[i + 2] as number),
      ),
  },
  {
    name: "sum",
    params: 2,
    holds: (v) =>
      every(0, v.length - 2, (i) => v[i + 2] === (v[i] as number) + (v[i + 1] as number)),
  },
  {
    name: "diff",
    params: 2,
    holds: (v) =>
      every(0, v.length - 2, (i) => v[i + 2] === (v[i] as number) - (v[i + 1] as number)),
  },
];

function lawsFor(length: number, numeric: boolean): Law[] {
  const laws: Law[] = [];
  for (let p = 1; p < length; p++) laws.push(cycleLaw(p));
  if (numeric) laws.push(...NUMERIC_LAWS);
  return laws;
}

const mirrorLaw = (m: number): Law => ({
  name: "mirror",
  params: Math.ceil(m / 2),
  holds: (v) => every(0, v.length, (i) => v[i] === v[v.length - 1 - i]),
});

/**
 * Các giá trị cho chỗ trống `k` mà thư viện luật chấp nhận. Một luật chỉ được xét khi phần nó xét
 * có ≥ params + 1 giá trị đã hiện; luật chấp nhận MỌI giá trị (không suy ra được) thì bỏ qua.
 */
function acceptedValues(
  seq: readonly (number | null)[],
  k: number,
  domain: number[],
  numeric: boolean,
) {
  const accepted = new Set<number>();
  const fill = (c: number) => seq.map((x, i) => (i === k ? c : (x as number)));
  const consider = (test: (c: number) => boolean) => {
    const ok = domain.filter(test);
    if (ok.length < domain.length) for (const c of ok) accepted.add(c);
  };
  const shown = seq.length - 1;
  for (const law of [...lawsFor(seq.length, numeric), mirrorLaw(seq.length)]) {
    if (shown < law.params + 1) continue;
    consider((c) => law.holds(fill(c)));
  }
  // Xen kẽ: dãy con chứa chỗ trống theo một luật, dãy con kia (đầy đủ) theo một luật bất kỳ.
  const parity = k % 2;
  const other = seq.filter((_, i) => i % 2 !== parity) as number[];
  const otherFits = lawsFor(other.length, numeric).some(
    (law) => other.length >= law.params + 1 && law.holds(other),
  );
  if (otherFits) {
    const ownIdx = seq.map((_, i) => i).filter((i) => i % 2 === parity);
    for (const law of lawsFor(ownIdx.length, numeric)) {
      if (ownIdx.length - 1 < law.params + 1) continue;
      consider((c) => law.holds(ownIdx.map((i) => (i === k ? c : (seq[i] as number)))));
    }
  }
  return accepted;
}

const DOMAIN: Record<BeadPatternAttr, number[]> = {
  shape: Array.from({ length: BEAD_SHAPE_COUNT }, (_, i) => i),
  pattern: Array.from({ length: BEAD_PATTERN_COUNT }, (_, i) => i),
  dots: Array.from({ length: BEAD_DOTS_MAX + 1 }, (_, i) => i),
};

/** Mọi hạt mà thư viện luật chấp nhận cho chỗ trống (tích các tập giá trị của từng thuộc tính). */
function acceptedBeads(p: BeadPatternPuzzle): Record<BeadPatternAttr, number[]> {
  const out = {} as Record<BeadPatternAttr, number[]>;
  for (const attr of BEAD_PATTERN_ATTRS) {
    const seq = p.beads.map((b) => (b === null ? null : b[attr]));
    out[attr] = [...acceptedValues(seq, p.blank, DOMAIN[attr], attr === "dots")].sort();
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Chỉ số độ khó
// ---------------------------------------------------------------------------------------------

/** "Giá" của một luật: số thứ người chơi phải nắm để áp được luật. */
function ruleCost(rule: BeadPatternRule): number {
  switch (rule.kind) {
    case "same":
      return 0;
    case "cycle":
      return rule.period - 1;
    case "step":
      return 3;
    case "sum":
    case "alternate":
      return 5;
  }
}

const complexity = (p: BeadPatternPuzzle) =>
  BEAD_PATTERN_ATTRS.reduce((s, a) => s + ruleCost(p.rules[a]), 0) +
  (p.blank === p.beads.length - 1 ? 0 : 1);

const varyingAttrs = (p: BeadPatternPuzzle) =>
  BEAD_PATTERN_ATTRS.filter((a) => p.rules[a].kind !== "same").length;

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Luật `rule` sinh lại đúng dãy đầy đủ `v` (để FE dựa vào `rules` mà vẽ lời giải). */
function ruleHolds(rule: BeadPatternRule, v: readonly number[]): boolean {
  switch (rule.kind) {
    case "same":
      return v.every((x) => x === v[0]);
    case "cycle":
      return (
        every(0, v.length - rule.period, (i) => v[i] === v[i + rule.period]) &&
        !every(0, v.length - 1, (i) => v[i] === v[i + 1])
      );
    case "step":
      return every(0, v.length - 1, (i) => (v[i + 1] as number) - (v[i] as number) === rule.step);
    case "sum":
      return every(0, v.length - 2, (i) => v[i + 2] === (v[i] as number) + (v[i + 1] as number));
    case "alternate":
      return (
        ruleHolds(
          rule.even,
          v.filter((_, i) => i % 2 === 0),
        ) &&
        ruleHolds(
          rule.odd,
          v.filter((_, i) => i % 2 === 1),
        )
      );
  }
}

describe("bead-pattern", () => {
  it("tất định: cùng (seed, index, độ khó) → cùng câu đố", () => {
    for (const d of DIFFICULTIES) {
      for (let seed = 0; seed < 200; seed++) {
        expect(beadPattern.generate(seed * 7919, seed % 30, d)).toEqual(
          beadPattern.generate(seed * 7919, seed % 30, d),
        );
      }
    }
    // Khác seed thì khác câu (không trả một câu cố định).
    const distinct = new Set(PUZZLES[3].slice(0, 200).map((p) => JSON.stringify(p)));
    expect(distinct.size).toBeGreaterThan(150);
  });

  it("đúng MỘT đáp án, kiểm lại bằng cả thư viện luật (10 000 seed × 4 mức, vét cạn độc lập)", () => {
    const errors: string[] = [];
    let checked = 0;
    for (const d of DIFFICULTIES) {
      for (const [seed, p] of PUZZLES[d].entries()) {
        const fail = (why: string) => errors.push(`mức ${d}, seed ${seed}: ${why}`);
        checked++;
        const correct = p.options.filter((_, i) => beadPattern.check(p, i));
        if (correct.length !== 1) fail(`${correct.length} thẻ đúng`);
        const answer = p.options[p.answer] as BeadPatternBead;
        // Vét cạn: ở mỗi thuộc tính, thư viện chỉ chấp nhận đúng một giá trị, là giá trị của thẻ đúng.
        const accepted = acceptedBeads(p);
        for (const attr of BEAD_PATTERN_ATTRS) {
          const got = accepted[attr];
          if (got.length !== 1 || got[0] !== answer[attr])
            fail(`${attr} chấp nhận [${got}], cần ${answer[attr]}`);
        }
        // Bộ giải của bộ sinh cũng đồng ý (mọi dự đoán, kể cả phân số, bằng đáp án).
        if (!beadPatternIsUnique(p.beads, answer)) fail("bộ giải không đồng ý");
        // Không thẻ nhiễu nào được luật nào khớp chọn; 4 thẻ đôi một khác nhau.
        for (let i = 0; i < BEAD_OPTION_COUNT; i++) {
          const o = p.options[i] as BeadPatternBead;
          if (i !== p.answer && beadPatternIsUnique(p.beads, o)) fail(`thẻ nhiễu ${i} cũng khớp`);
          for (let j = i + 1; j < BEAD_OPTION_COUNT; j++) {
            if (sameBead(o, p.options[j] as BeadPatternBead)) fail(`thẻ ${i} trùng thẻ ${j}`);
          }
        }
      }
    }
    expect(checked).toBe(4 * SEEDS);
    expect(errors.slice(0, 5)).toEqual([]);
  });

  it("bộ kiểm bắt được câu nhập nhằng và câu thiếu bằng chứng", () => {
    // Dãy 1, 2, 3, _ : cộng đều → 4, cộng dồn → 5. Hai luật khớp khác nhau → bị loại.
    const b = (dots: number): BeadPatternBead => ({ shape: 0, pattern: 0, dots });
    const ambiguous = [b(1), b(2), b(3), null];
    expect(beadPatternIsUnique(ambiguous, b(4))).toBe(false);
    expect(beadPatternIsUnique(ambiguous, b(5))).toBe(false);
    expect(acceptedValues([1, 2, 3, null], 3, DOMAIN.dots, true)).toEqual(new Set([4, 5]));
    // Một luật duy nhất khớp: 2, 4, _, 8 → 6.
    expect(beadPatternIsUnique([b(2), b(4), null, b(8)], b(6))).toBe(true);
    // Hình lặp chu kỳ 2 nhưng chỉ hiện 2 hạt: chưa đủ bằng chứng → không luật nào suy ra được.
    const tooShort = [{ shape: 0, pattern: 0, dots: 0 }, { shape: 1, pattern: 0, dots: 0 }, null];
    expect(beadPatternPredictions(tooShort).shape).toEqual([]);
    expect(beadPatternIsUnique(tooShort, { shape: 0, pattern: 0, dots: 0 })).toBe(false);
  });

  it("hình dạng câu đúng mức: độ dài, chỗ trống, khoảng giá trị", () => {
    const inRange = (x: number, lo: number, hi: number) =>
      Number.isInteger(x) && x >= lo && x <= hi;
    for (const d of DIFFICULTIES) {
      const level = BEAD_PATTERN_LEVELS[d];
      // Gom lỗi rồi kiểm một lần: gọi `expect` cho từng hạt của 40 000 câu quá chậm.
      const errors: string[] = [];
      for (const [seed, p] of PUZZLES[d].entries()) {
        const fail = (why: string) => errors.push(`mức ${d}, seed ${seed}: ${why}`);
        const n = p.beads.length;
        if (d === 3 ? ![5, 6, 8].includes(n) : n !== level.length) fail(`dài ${n}`);
        if (p.beads.indexOf(null) !== p.blank || p.beads.lastIndexOf(null) !== p.blank)
          fail("chỗ trống");
        if (p.blank < 1 || (d <= 1 && p.blank !== n - 1) || (d === 3 && p.blank >= n - 1))
          fail("vị trí trống");
        if (p.options.length !== BEAD_OPTION_COUNT || !inRange(p.answer, 0, BEAD_OPTION_COUNT - 1))
          fail("thẻ");
        for (const bead of [
          ...p.beads.filter((x) => x !== null),
          ...p.options,
        ] as BeadPatternBead[]) {
          if (!inRange(bead.shape, 0, BEAD_SHAPE_COUNT - 1)) fail(`hình ${bead.shape}`);
          if (!inRange(bead.pattern, 0, BEAD_PATTERN_COUNT - 1)) fail(`hoa văn ${bead.pattern}`);
          if (level.dots ? !inRange(bead.dots, BEAD_DOTS_MIN, BEAD_DOTS_MAX) : bead.dots !== 0)
            fail(`chấm ${bead.dots}`);
        }
        // Luật khai báo trong `rules` sinh lại đúng chuỗi đầy đủ (FE dựa vào để vẽ lời giải).
        const answer = p.options[p.answer] as BeadPatternBead;
        for (const attr of BEAD_PATTERN_ATTRS) {
          const full = p.beads.map((b) => (b === null ? answer[attr] : b[attr]));
          if (!ruleHolds(p.rules[attr], full)) fail(`luật ${attr}`);
        }
        // Thuộc tính được kiểm luôn có luật đổi; gợi ý lời giải chỉ trỏ vào hạt đang hiện.
        for (const attr of p.tested) {
          const clues = beadPatternClues(p, attr);
          if (p.rules[attr].kind !== "same" && clues.length === 0) fail(`gợi ý rỗng ${attr}`);
          if (clues.some((i) => p.beads[i] === null || p.beads[i] === undefined))
            fail(`gợi ý ${attr}`);
        }
      }
      expect(errors.slice(0, 5)).toEqual([]);
      // Mức Khó có cả chỗ trống ở cuối lẫn ở giữa, theo tỉ lệ khai báo (lệch < 3 %).
      const atEnd = mean(PUZZLES[d].map((p) => (p.blank === p.beads.length - 1 ? 100 : 0)));
      expect(Math.abs(atEnd - level.blankAtEndPct)).toBeLessThan(3);
    }
  });

  it("khó dần theo độ khó (đo được)", () => {
    const stats = DIFFICULTIES.map((d) => ({
      complexity: mean(PUZZLES[d].map(complexity)),
      varying: mean(PUZZLES[d].map(varyingAttrs)),
      middle: mean(PUZZLES[d].map((p) => (p.blank < p.beads.length - 1 ? 1 : 0))),
      numeric: mean(PUZZLES[d].map((p) => (p.tested.includes("dots") ? 1 : 0))),
    }));
    for (let i = 1; i < stats.length; i++) {
      const [lo, hi] = [stats[i - 1], stats[i]] as [(typeof stats)[0], (typeof stats)[0]];
      // Độ phức tạp của luật tăng hẳn mỗi mức; các chỉ số khác không giảm.
      expect(hi.complexity).toBeGreaterThan(lo.complexity + 0.9);
      expect(hi.varying).toBeGreaterThanOrEqual(lo.varying);
      expect(hi.middle).toBeGreaterThanOrEqual(lo.middle);
      expect(hi.numeric).toBeGreaterThanOrEqual(lo.numeric);
    }
    // Mầm: 1 thuộc tính đổi; Thường: 2; từ Khó luôn phải đọc số chấm.
    expect(stats[0]?.varying).toBe(1);
    expect(stats[1]?.varying).toBe(2);
    expect(stats[2]?.numeric).toBe(1);
    expect(stats[3]?.middle).toBe(1);
  });

  it("không có mẹo đoán: vị trí thẻ đúng, thẻ lạc loài, chép hạt kề", () => {
    for (const d of DIFFICULTIES) {
      const ps = PUZZLES[d];
      // 1. Thẻ đúng phân bố đều 4 vị trí (lệch < 2 điểm %).
      for (let i = 0; i < BEAD_OPTION_COUNT; i++) {
        expect(Math.abs(mean(ps.map((p) => (p.answer === i ? 100 : 0))) - 25)).toBeLessThan(2);
      }
      let oddOneOut = 0;
      let central = 0;
      for (const p of ps) {
        const answer = p.options[p.answer] as BeadPatternBead;
        // 2. Ở mọi thuộc tính, giá trị của thẻ đúng có ở ít nhất hai thẻ: thẻ đúng không bao giờ là
        //    thẻ "khác ba thẻ còn lại".
        if (BEAD_PATTERN_ATTRS.some((a) => p.options.filter((o) => o[a] === answer[a]).length < 2))
          oddOneOut++;
        // 3. Chọn thẻ "giống các thẻ khác nhiều nhất" không lộ đáp án: thẻ nào cũng chung số giá trị
        //    như nhau với ba thẻ kia.
        const shared = p.options.map((o) =>
          p.options.reduce(
            (s, q) => s + BEAD_PATTERN_ATTRS.filter((a) => q !== o && q[a] === o[a]).length,
            0,
          ),
        );
        if (new Set(shared).size !== 1) central++;
      }
      expect(oddOneOut).toBe(0);
      expect(central).toBe(0);
      // 4. Thẻ đúng hiếm khi là thẻ DUY NHẤT có (hoặc duy nhất không có) trong chuỗi, nên mẹo "chọn
      //    hạt đã thấy" / "chọn hạt mới" không lộ đáp án (chỉ sót khi mọi số sai hợp lý đều đã có
      //    trong chuỗi).
      const familiarCue = ps.filter((p) => {
        const fam = p.options.map((o) => p.beads.some((b) => sameBead(b, o)));
        return !fam.some((f, i) => i !== p.answer && f === fam[p.answer]);
      }).length;
      expect(familiarCue / ps.length).toBeLessThan(0.02);
      // 5. Chép hạt ngay trước (hoặc ngay sau) chỗ trống không đúng quá mức may rủi (25 %).
      for (const offset of [-1, 1]) {
        let hits = 0;
        let tries = 0;
        for (const p of ps) {
          const neighbour = p.beads[p.blank + offset];
          if (neighbour === undefined || neighbour === null) continue;
          const copy = p.options.findIndex((o) => sameBead(o, neighbour));
          tries++;
          if (copy === p.answer) hits++;
        }
        if (tries > 0) expect(hits / tries).toBeLessThan(0.25);
      }
    }
  });

  it("không phải dùng câu dự phòng; câu dự phòng vẫn đúng một đáp án", () => {
    for (const d of DIFFICULTIES) {
      let maxAttempts = 0;
      for (let seed = 0; seed < 2_000; seed++) {
        const attempts = beadPatternAttempts(seed, seed % 20, d);
        expect(attempts).toBeGreaterThan(0);
        maxAttempts = Math.max(maxAttempts, attempts);
      }
      expect(maxAttempts).toBeLessThan(30);
      const p = beadPatternFallback(1, 2, d);
      const answer = p.options[p.answer] as BeadPatternBead;
      expect(beadPatternIsUnique(p.beads, answer)).toBe(true);
      const accepted = acceptedBeads(p);
      for (const attr of BEAD_PATTERN_ATTRS) expect(accepted[attr]).toEqual([answer[attr]]);
      expect(p.beads.length).toBe(BEAD_PATTERN_LEVELS[d].length);
    }
  });

  it("hệ số điểm không giảm khi lên mức; Thường = 1", () => {
    const m = beadPattern.difficultyMultiplier;
    expect(m?.[1]).toBe(1);
    for (let i = 1; i < DIFFICULTIES.length; i++) {
      expect(m?.[DIFFICULTIES[i] as Difficulty]).toBeGreaterThanOrEqual(
        m?.[DIFFICULTIES[i - 1] as Difficulty] as number,
      );
    }
    expect(beadPattern.durationMs).toBe(60_000);
  });

  it("isAnswer() từ chối dữ liệu rác", () => {
    for (const ok of [0, 1, 2, 3]) expect(beadPattern.isAnswer(ok)).toBe(true);
    for (const bad of [
      -1,
      4,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "0",
      null,
      undefined,
      [0],
      { i: 0 },
      true,
    ]) {
      expect(beadPattern.isAnswer(bad)).toBe(false);
    }
    const p = beadPattern.generate(42, 0, 1);
    expect(beadPattern.check(p, p.answer)).toBe(true);
    expect(beadPattern.check(p, (p.answer + 1) % BEAD_OPTION_COUNT)).toBe(false);
  });
});
