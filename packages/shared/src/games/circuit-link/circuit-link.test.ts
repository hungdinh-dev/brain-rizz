import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import {
  CIRCUIT_LINK_MAX_OPTIONS,
  type CircuitLinkPuzzle,
  circuitLink,
  circuitLinkFallback,
  circuitLinkGenerateWithStats,
  circuitLinkLights,
  circuitLinkPowered,
} from "./circuit-link";

/** 2 500 seed × 4 mức = 10 000 câu. */
const SEEDS = 2_500;
/**
 * Seed vòng trải khắp 32 bit. Không nhân với 0x9e3779b1 (= 2 654 435 761) như `deriveSeed`: XOR với
 * phần chỉ số câu làm vài câu trùng nhau.
 */
const seedOf = (s: number) => (Math.imul(s, 0x27d4eb2f) + 0x165667b1) >>> 0;

/** Bảng Độ khó của đặc tả. */
const SPEC: Record<Difficulty, { size: number; options: number; gaps: number }> = {
  0: { size: 3, options: 3, gaps: 1 },
  1: { size: 4, options: 4, gaps: 1 },
  2: { size: 5, options: 4, gaps: 1 },
  3: { size: 5, options: 4, gaps: 2 },
};

// ------------------------------------------------ Mô hình độc lập (không dùng code của game)

const N = 1;
const E = 2;
const S = 4;
const W = 8;
/** Hướng → (dx, dy, cổng đối diện). */
const STEP: Record<number, [number, number, number]> = {
  [N]: [0, -1, S],
  [E]: [1, 0, W],
  [S]: [0, 1, N],
  [W]: [-1, 0, E],
};
const SIDES = [N, E, S, W];

const ports = (t: number) => SIDES.filter((d) => (t & d) !== 0).length;
type Kind = "blank" | "end" | "straight" | "corner" | "tee" | "cross";
function kind(t: number): Kind {
  const n = ports(t);
  if (n === 2) return t === (N | S) || t === (E | W) ? "straight" : "corner";
  return (["blank", "end", "", "tee", "cross"] as const)[n] as Kind;
}

/** Ô kề phía `d`, hoặc −1 nếu ra ngoài lưới. */
function step(size: number, cell: number, d: number): number {
  const [dx, dy] = STEP[d]!;
  const x = (cell % size) + dx;
  const y = Math.floor(cell / size) + dy;
  return x < 0 || y < 0 || x >= size || y >= size ? -1 : y * size + x;
}

/** BFS: các ô nối được với cực `from` (pin hoặc đèn) qua những cặp cổng khớp hai phía. */
function reach(
  size: number,
  tiles: readonly number[],
  from: { cell: number; side: number },
): Set<number> {
  const seen = new Set<number>();
  if ((tiles[from.cell]! & from.side) === 0) return seen;
  const queue = [from.cell];
  seen.add(from.cell);
  while (queue.length > 0) {
    const c = queue.shift()!;
    for (const d of SIDES) {
      if ((tiles[c]! & d) === 0) continue;
      const n = step(size, c, d);
      if (n < 0 || seen.has(n) || (tiles[n]! & STEP[d]![2]) === 0) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return seen;
}

function fill(p: CircuitLinkPuzzle, fills: readonly number[]): number[] {
  const out = p.tiles.slice();
  p.missing.forEach((c, j) => {
    out[c] = fills[j] ?? 0;
  });
  return out;
}

function lit(p: CircuitLinkPuzzle, fills: readonly number[]): boolean {
  const tiles = fill(p, fills);
  return (
    (tiles[p.bulb.cell]! & p.bulb.side) !== 0 && reach(p.size, tiles, p.battery).has(p.bulb.cell)
  );
}

/** Cổng mồi của ô thiếu `j`: dây chĩa vào ô đó nhưng không nối về pin hay đèn. */
function decoys(p: CircuitLinkPuzzle, j: number): number {
  const answer = p.options[p.answerIndex]!;
  const tiles = fill(
    p,
    answer.map((t, k) => (k === j ? 0 : t)),
  );
  const fromBattery = reach(p.size, tiles, p.battery);
  const fromBulb = reach(p.size, tiles, p.bulb);
  const gap = p.missing[j]!;
  return SIDES.filter((d) => {
    const n = step(p.size, gap, d);
    return n >= 0 && (tiles[n]! & STEP[d]![2]) !== 0 && !fromBattery.has(n) && !fromBulb.has(n);
  }).length;
}

/** Số khúc rẽ trên đường chính (tính cả chỗ vào từ pin và chỗ ra đèn), khi đã đặt đáp án. */
function turns(p: CircuitLinkPuzzle): number {
  const dirs: number[] = [STEP[p.battery.side]![2]];
  for (let i = 1; i < p.path.length; i++) {
    dirs.push(SIDES.find((d) => step(p.size, p.path[i - 1]!, d) === p.path[i])!);
  }
  dirs.push(p.bulb.side);
  return dirs.slice(1).filter((d, i) => d !== dirs[i]).length;
}

function forEachPuzzle(fn: (p: CircuitLinkPuzzle, d: Difficulty, where: string) => void) {
  for (const d of DIFFICULTIES) {
    for (let s = 0; s < SEEDS; s++) {
      fn(circuitLink.generate(seedOf(s), s % 20, d), d, `mức ${d}, seed ${s}`);
    }
  }
}

/** Mọi luật của một câu; trả về danh sách lỗi. */
function violations(p: CircuitLinkPuzzle, d: Difficulty): string[] {
  const errors: string[] = [];
  const spec = SPEC[d];
  const cells = p.size * p.size;
  if (p.size !== spec.size) errors.push("sai cỡ lưới");
  if (p.tiles.length !== cells) errors.push("sai số ô");
  if (p.tiles.some((t) => !Number.isInteger(t) || t < 0 || t > 15)) errors.push("mảnh lạ");
  if (p.options.length !== spec.options) errors.push("sai số thẻ");
  if (p.missing.length !== spec.gaps || new Set(p.missing).size !== spec.gaps) {
    errors.push("sai số ô thiếu");
  }
  if (p.missing.some((c) => p.tiles[c] !== 0)) errors.push("ô thiếu không trống");
  for (const t of [p.battery, p.bulb]) {
    if (!SIDES.includes(t.side) || step(p.size, t.cell, t.side) !== -1) {
      errors.push("pin/đèn không ở mép");
    }
  }
  if (p.path[0] !== p.battery.cell || p.path.at(-1) !== p.bulb.cell) errors.push("sai đầu đường");
  if (p.missing.some((c) => !p.path.includes(c))) errors.push("ô thiếu ngoài đường chính");
  if (p.path.slice(1).some((c, i) => !SIDES.some((x) => step(p.size, p.path[i]!, x) === c))) {
    errors.push("đường chính đứt");
  }
  if (!Number.isInteger(p.answerIndex) || p.answerIndex < 0 || p.answerIndex >= p.options.length) {
    errors.push("answerIndex ngoài khoảng");
  }
  // Thẻ: đúng số mảnh, mảnh 2–3 cổng, đôi một khác nhau.
  if (p.options.some((o) => o.length !== spec.gaps)) errors.push("thẻ sai số mảnh");
  if (p.options.flat().some((t) => ports(t) < 2 || ports(t) > 3)) errors.push("thẻ có mảnh lạ");
  if (new Set(p.options.map((o) => o.join(","))).size !== p.options.length) {
    errors.push("thẻ trùng nhau");
  }
  // Đúng một thẻ làm đèn sáng, đúng là answerIndex; chưa đặt thẻ thì đèn tắt.
  const winners = p.options.map((o, i) => (lit(p, o) ? i : -1)).filter((i) => i >= 0);
  if (winners.length !== 1 || winners[0] !== p.answerIndex) {
    errors.push(`số thẻ làm đèn sáng: ${winners.length}`);
  }
  if (lit(p, [])) errors.push("chưa đặt thẻ đèn đã sáng");
  const answer = p.options[p.answerIndex] ?? [];
  answer.forEach((_, j) => {
    if (
      lit(
        p,
        answer.map((t, k) => (k === j ? 0 : t)),
      )
    )
      errors.push("thiếu 1 mảnh đèn vẫn sáng");
  });
  // Đường chính có điện khi đặt đáp án.
  const full = fill(p, answer);
  const powered = reach(p.size, full, p.battery);
  if (p.path.some((c) => !powered.has(c))) errors.push("đường chính không có điện");
  // Chỉ pin và đèn nối ra ngoài lưới: không mảnh nào khác có cổng chĩa ra mép.
  full.forEach((t, c) => {
    for (const d of SIDES) {
      if ((t & d) === 0 || step(p.size, c, d) !== -1) continue;
      const terminal = [p.battery, p.bulb].some((x) => x.cell === c && x.side === d);
      if (!terminal) errors.push(`ô ${c} có dây chĩa ra ngoài lưới`);
    }
  });
  return errors;
}

describe("circuit-link", () => {
  it("khai báo theo đặc tả", () => {
    expect(circuitLink.id).toBe("circuit-link");
    expect(circuitLink.category).toBe("visualize");
    expect(circuitLink.durationMs).toBe(60_000);
    expect(circuitLink.difficultyMultiplier).toEqual({ 0: 1, 1: 1, 2: 1.95, 3: 3.25 });
    expect(circuitLink.speedAllowanceMs).toBeUndefined();
  });

  it("tất định: cùng (seed, index, độ khó) → cùng câu đố", () => {
    for (const d of DIFFICULTIES) {
      for (let s = 0; s < 200; s++) {
        const a = circuitLink.generate(seedOf(s), s % 7, d);
        expect(circuitLink.generate(seedOf(s), s % 7, d)).toEqual(a);
      }
    }
    // Hai câu liền nhau của một vòng hầu như không trùng lưới.
    let same = 0;
    for (const d of DIFFICULTIES) {
      for (let i = 0; i < 100; i++) {
        const a = circuitLink.generate(42, i, d);
        const b = circuitLink.generate(42, i + 1, d);
        if (JSON.stringify(a.tiles) === JSON.stringify(b.tiles)) same++;
      }
    }
    expect(same).toBeLessThan(8);
  });

  it("10 000 câu: đúng MỘT thẻ làm đèn sáng (BFS độc lập), đúng luật từng mức", () => {
    const errors: string[] = [];
    forEachPuzzle((p, d, where) => {
      for (const e of violations(p, d)) errors.push(`${where}: ${e}`);
      p.options.forEach((_, i) => {
        if (circuitLink.check(p, i) !== (i === p.answerIndex)) errors.push(`${where}: check lệch`);
        if (circuitLinkLights(p, p.options[i]!) !== lit(p, p.options[i]!)) {
          errors.push(`${where}: circuitLinkLights lệch BFS độc lập`);
        }
      });
    });
    expect(errors.slice(0, 20)).toEqual([]);
  });

  it("luật riêng từng mức (mồi, nhánh cụt, loại thẻ)", () => {
    const errors: string[] = [];
    forEachPuzzle((p, d, where) => {
      const kinds = p.options.map((o) => o.map(kind).join("+"));
      const full = fill(p, p.options[p.answerIndex]!);
      if (d === 0) {
        if (turns(p) > 1) errors.push(`${where}: Mầm quá 1 khúc cua`);
        if (p.options.flat().some((t) => ports(t) !== 2)) errors.push(`${where}: Mầm có ngã ba`);
      }
      if (d === 1) {
        const t = turns(p);
        if (t < 3 || t > 4) errors.push(`${where}: Thường có ${t} khúc cua`);
        if (kinds.some((k) => k !== "corner")) errors.push(`${where}: Thường thẻ không cùng loại`);
        if (decoys(p, 0) !== 0) errors.push(`${where}: Thường có mồi`);
      }
      if (d >= 2) {
        p.missing.forEach((_, j) => {
          if (decoys(p, j) < 1) errors.push(`${where}: ô thiếu ${j} không có dây mồi`);
        });
        if (!full.some((t) => kind(t) === "end")) errors.push(`${where}: không có nhánh cụt`);
        if (!full.some((t) => kind(t) === "tee")) errors.push(`${where}: không có ngã ba`);
      }
      if (d === 2) {
        const set = new Set(kinds);
        if (set.size !== 3 || !set.has("tee")) errors.push(`${where}: Khó thẻ không đủ 3 loại`);
      }
      if (d === 3) {
        // Bảng 2 × 2: mỗi ô thiếu có đúng 2 mảnh, mỗi mảnh nằm trên đúng 2 thẻ.
        for (let j = 0; j < 2; j++) {
          const col = p.options.map((o) => o[j]!);
          const uniq = [...new Set(col)];
          if (uniq.length !== 2 || uniq.some((t) => col.filter((x) => x === t).length !== 2)) {
            errors.push(`${where}: Siêu khó không phải bảng 2 × 2`);
          }
        }
      }
    });
    expect(errors.slice(0, 20)).toEqual([]);
  });

  it("khó dần theo độ khó (đo được)", () => {
    const avg = DIFFICULTIES.map((d) => {
      const m = { wired: 0, path: 0, turns: 0, decoys: 0, cards: 0, gaps: 0 };
      for (let s = 0; s < SEEDS; s++) {
        const p = circuitLink.generate(seedOf(s), s % 20, d);
        m.wired += p.tiles.filter((t) => t !== 0).length;
        m.path += p.path.length;
        m.turns += turns(p);
        m.decoys += p.missing.reduce((x, _, j) => x + decoys(p, j), 0);
        m.cards += p.options.length;
        m.gaps += p.missing.length;
      }
      return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v / SEEDS])) as typeof m;
    });
    const strictly = (xs: number[]) => xs.every((x, i) => i === 0 || x > xs[i - 1]!);
    const atLeast = (xs: number[]) => xs.every((x, i) => i === 0 || x >= xs[i - 1]!);
    expect(strictly(avg.map((a) => a.wired))).toBe(true);
    expect(strictly(avg.map((a) => a.path))).toBe(true);
    expect(atLeast(avg.map((a) => a.turns))).toBe(true);
    expect(avg[1]!.turns).toBeGreaterThan(avg[0]!.turns + 2);
    expect(avg.map((a) => a.decoys > 0)).toEqual([false, false, true, true]);
    expect(avg[3]!.decoys).toBeGreaterThan(avg[2]!.decoys);
    expect(avg.map((a) => a.cards)).toEqual([3, 4, 4, 4]);
    expect(avg.map((a) => a.gaps)).toEqual([1, 1, 1, 2]);
  });

  it("không có mẹo đoán: vị trí đều, đếm loại mảnh hay số cổng không đoán được", () => {
    for (const d of DIFFICULTIES) {
      const n = SPEC[d].options;
      const pos = new Array<number>(n).fill(0);
      const guess = { rare: 0, common: 0, most: 0, fewest: 0 };
      let oddAnswer = 0;
      for (let s = 0; s < SEEDS; s++) {
        const p = circuitLink.generate(seedOf(s), s % 20, d);
        pos[p.answerIndex]!++;
        const key = p.options.map((o) => o.map(kind).join("+"));
        const count = key.map((k) => key.filter((x) => x === k).length);
        const port = p.options.map((o) => o.reduce((x, t) => x + ports(t), 0));
        /** Chọn ngẫu nhiên trong các thẻ có điểm cao/thấp nhất: xác suất trúng đáp án. */
        const hit = (score: number[], max: boolean) => {
          const best = max ? Math.max(...score) : Math.min(...score);
          const top = score.flatMap((v, i) => (v === best ? [i] : []));
          return top.includes(p.answerIndex) ? 1 / top.length : 0;
        };
        guess.rare += hit(count, false);
        guess.common += hit(count, true);
        guess.most += hit(port, true);
        guess.fewest += hit(port, false);
        // Thẻ đúng là thẻ duy nhất khác loại.
        if (count[p.answerIndex] === 1 && count.filter((c) => c === 1).length === 1) oddAnswer++;
      }
      for (const c of pos) expect(Math.abs(c / SEEDS - 1 / n)).toBeLessThan(0.04);
      for (const g of Object.values(guess)) expect(g / SEEDS).toBeLessThan(1 / n + 0.06);
      if (d === 0) expect(Math.abs(oddAnswer / SEEDS - 1 / 3)).toBeLessThan(0.05);
      else expect(oddAnswer).toBe(0);
    }
  });

  it("câu dự phòng đúng luật, và 10 000 seed không phải dùng tới", () => {
    for (const d of DIFFICULTIES) {
      expect(violations(circuitLinkFallback(d), d)).toEqual([]);
      for (let s = 0; s < SEEDS; s++) {
        expect(circuitLinkGenerateWithStats(seedOf(s), s % 20, d).attempts).toBeLessThan(400);
      }
    }
  });

  it("circuitLinkPowered: đặt đáp án thì có điện tới đèn, cả từ phía đèn", () => {
    for (const d of DIFFICULTIES) {
      const p = circuitLink.generate(7, 3, d);
      const full = fill(p, p.options[p.answerIndex]!);
      expect(circuitLinkPowered(p.size, full, p.battery)[p.bulb.cell]).toBe(true);
      expect(circuitLinkPowered(p.size, full, p.bulb)[p.battery.cell]).toBe(true);
      expect(circuitLinkPowered(p.size, p.tiles, p.battery)[p.bulb.cell]).toBe(false);
    }
  });

  it("isAnswer() từ chối dữ liệu rác", () => {
    for (let i = 0; i < CIRCUIT_LINK_MAX_OPTIONS; i++) expect(circuitLink.isAnswer(i)).toBe(true);
    for (const junk of [-1, 4, 1.5, Number.NaN, Infinity, "0", null, undefined, [0], { i: 0 }]) {
      expect(circuitLink.isAnswer(junk)).toBe(false);
    }
    // Mầm có 3 thẻ: gửi 3 hợp kiểu nhưng chấm sai.
    expect(circuitLink.check(circuitLink.generate(1, 0, 0), 3)).toBe(false);
  });
});
