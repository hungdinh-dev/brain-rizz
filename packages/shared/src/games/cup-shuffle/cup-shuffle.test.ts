import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import {
  CUP_SHUFFLE_LEVELS,
  type CupShuffleMove,
  type CupShufflePuzzle,
  cupShuffle,
  cupShuffleCupOrder,
  cupShuffleInputAtMs,
  cupShuffleItemSlots,
  cupShuffleMoveStartMs,
} from "./cup-shuffle";

const SEEDS_PER_LEVEL = 10_000;

const seedOf = (i: number) => i * 7919 + 13;

/** 10 000 câu mỗi mức (seed khác nhau, chỉ số câu 0–29), sinh một lần cho mọi test. */
const PUZZLES = new Map<Difficulty, CupShufflePuzzle[]>(
  DIFFICULTIES.map((d) => [
    d,
    Array.from({ length: SEEDS_PER_LEVEL }, (_, i) => cupShuffle.generate(seedOf(i), i % 30, d)),
  ]),
);

function puzzlesOf(d: Difficulty): CupShufflePuzzle[] {
  return PUZZLES.get(d) ?? [];
}

/**
 * Gom lỗi thay cho gọi `expect` trong vòng lặp 40 000 câu (chậm): mỗi điều kiện sai ghi một
 * dòng kèm câu đố, cuối test so với mảng rỗng.
 */
function collector() {
  const errors: string[] = [];
  return {
    errors,
    ok(cond: boolean, what: string, p: unknown) {
      if (!cond && errors.length < 20) errors.push(`${what}: ${JSON.stringify(p)}`);
    },
  };
}

/**
 * Tính lại ô cuối của từng vật bằng cách khác `cupShuffleApplyMove`: theo dõi từng chiếc cốc
 * (`cupAt[ô] = số hiệu cốc`), vật nằm yên dưới chiếc cốc úp nó từ đầu.
 */
function trackByCups(p: Pick<CupShufflePuzzle, "cups" | "start" | "moves">): number[] {
  let cupAt = Array.from({ length: p.cups }, (_, i) => i);
  for (const m of p.moves) {
    const next = [...cupAt];
    for (let k = 0; k < m.length; k++) {
      const from = m[k] as number;
      const to = m[(k + 1) % m.length] as number;
      next[to] = cupAt[from] as number;
    }
    cupAt = next;
  }
  return p.start.map((cup) => cupAt.indexOf(cup));
}

/** Với từng vật: lượt nào chạm cốc đang úp vật đó (`touched[j][k]`). */
function touchedByMove(p: CupShufflePuzzle): boolean[][] {
  const before = p.moves.map((_, k) => trackByCups({ ...p, moves: p.moves.slice(0, k) }));
  return p.start.map((_, j) => p.moves.map((m, k) => m.includes(before[k]?.[j] as number)));
}

/** Số lượt mỗi chiếc cốc bị di chuyển (theo số hiệu cốc = ô ban đầu). */
function movesPerCup(p: Pick<CupShufflePuzzle, "cups" | "moves">): number[] {
  const count = Array<number>(p.cups).fill(0);
  p.moves.forEach((m, k) => {
    const order = cupShuffleCupOrder(p, k);
    for (const slot of m) {
      const cup = order[slot] as number;
      count[cup] = (count[cup] as number) + 1;
    }
  });
  return count;
}

const count = (xs: boolean[]) => xs.filter(Boolean).length;

const sameSet = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((s) => b.includes(s));

/** Mẫu chữ của một dãy đổi chỗ: cặp ô thứ nhất xuất hiện là `A`, thứ hai `B`, thứ ba `C`. */
function patternOf(moves: readonly CupShuffleMove[]): string {
  const seen: string[] = [];
  return moves
    .map((m) => {
      const key = m.join(",");
      if (!seen.includes(key)) seen.push(key);
      return String.fromCharCode(65 + seen.indexOf(key));
    })
    .join("");
}

/**
 * Tỉ lệ đúng của chiến lược tốt nhất chỉ dựa vào QUAN HỆ của mỗi cốc với ô đầu của vật được
 * hỏi (`S`), ô đầu của vật kia (`O`) và lượt tráo cuối (`L`), không theo dõi vật. Mỗi câu chia
 * cốc thành các lớp; với mỗi kiểu chia, chọn lớp có tỉ lệ trúng mỗi cốc cao nhất.
 */
function bestStartLastRate(puzzles: readonly CupShufflePuzzle[]): number {
  const byConfig = new Map<string, Map<string, { hits: number; size: number }>>();
  for (const p of puzzles) {
    const s = p.start[p.target] as number;
    const o = p.start.length > 1 ? (p.start[1 - p.target] as number) : -1;
    const last: readonly number[] = p.moves[p.moves.length - 1] ?? [];
    const labels = Array.from(
      { length: p.cups },
      (_, c) => `${c === s ? "S" : c === o ? "O" : "-"}${last.includes(c) ? "L" : "-"}`,
    );
    const config = [...labels].sort().join(",");
    let classes = byConfig.get(config);
    if (!classes) {
      classes = new Map();
      for (const l of new Set(labels)) {
        classes.set(l, { hits: 0, size: labels.filter((x) => x === l).length });
      }
      byConfig.set(config, classes);
    }
    const hit = classes.get(labels[p.answer] as string);
    if (hit) hit.hits++;
  }
  let best = 0;
  for (const classes of byConfig.values()) {
    best += Math.max(...[...classes.values()].map((c) => c.hits / c.size));
  }
  return best / puzzles.length;
}

/** Danh mục đầy đủ của một mức 3 cốc, dựng lại độc lập từ bảng mẫu: (ô đầu, dãy, trọng số). */
function catalogFromPatterns(d: Difficulty) {
  const pairs: CupShuffleMove[] = [
    [0, 1],
    [0, 2],
    [1, 2],
  ];
  const perms = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  const out: { start: number; moves: CupShuffleMove[]; weight: number }[] = [];
  for (const { pattern, weight } of CUP_SHUFFLE_LEVELS[d].patterns ?? []) {
    for (const perm of perms) {
      const moves = [...pattern].map((ch) => pairs[perm[ch.charCodeAt(0) - 65] as number]);
      for (let start = 0; start < 3; start++) {
        out.push({ start, moves: moves as CupShuffleMove[], weight });
      }
    }
  }
  return out;
}

/**
 * Liệt kê CHÍNH XÁC (theo trọng số) tỉ lệ đúng của chiến lược tốt nhất chỉ biết `view` của câu
 * (ô đầu + vài lượt), trả về [tổng trọng số trúng, tổng trọng số] để so bằng số nguyên.
 */
function exactBest(
  d: Difficulty,
  view: (start: number, moves: readonly CupShuffleMove[]) => string,
): [number, number] {
  const table = new Map<string, number[]>();
  let total = 0;
  for (const e of catalogFromPatterns(d)) {
    const answer = trackByCups({ cups: 3, start: [e.start], moves: e.moves })[0] as number;
    const key = view(e.start, e.moves);
    const row = table.get(key) ?? [0, 0, 0];
    row[answer] = (row[answer] as number) + e.weight;
    table.set(key, row);
    total += e.weight;
  }
  let hits = 0;
  for (const row of table.values()) hits += Math.max(...row);
  return [hits, total];
}

/** Các góc nhìn "không theo dõi vật": ô đầu, cộng tối đa hai lượt đầu hoặc hai lượt cuối. */
const VIEWS: Record<string, (s: number, m: readonly CupShuffleMove[]) => string> = {
  "ô đầu": (s) => `${s}`,
  "ô đầu + lượt cuối": (s, m) => `${s}|${m.at(-1)}`,
  "ô đầu + 2 lượt cuối": (s, m) => `${s}|${m.at(-2)}|${m.at(-1)}`,
  "ô đầu + lượt đầu": (s, m) => `${s}|${m[0]}`,
  "ô đầu + 2 lượt đầu": (s, m) => `${s}|${m[0]}|${m[1]}`,
  "ô đầu + lượt đầu + lượt cuối": (s, m) => `${s}|${m[0]}|${m.at(-1)}`,
};

describe("cup-shuffle", () => {
  it("tất định: cùng (seed, index, độ khó) → cùng câu đố (10 000 seed × 4 độ khó)", () => {
    const c = collector();
    for (const d of DIFFICULTIES) {
      puzzlesOf(d).forEach((p, i) => {
        const again = cupShuffle.generate(seedOf(i), i % 30, d);
        c.ok(JSON.stringify(again) === JSON.stringify(p), `seed ${seedOf(i)} mức ${d}`, p);
      });
    }
    expect(c.errors).toEqual([]);
  });

  it("giá trị cố định cho vài seed (bắt thay đổi vô tình ở bộ sinh hoặc ở rng)", () => {
    expect(cupShuffle.generate(123_456, 7, 0)).toEqual(GOLDEN_EASY);
    expect(cupShuffle.generate(123_456, 7, 1)).toEqual(GOLDEN_NORMAL);
    expect(cupShuffle.generate(123_456, 7, 3)).toEqual(GOLDEN_SUPER);
  });

  it("mọi câu đố có đúng MỘT đáp án, khớp cách tính độc lập (10 000 seed × 4 độ khó)", () => {
    const c = collector();
    for (const d of DIFFICULTIES) {
      for (const p of puzzlesOf(d)) {
        const correct = [-1, 0, 1, 2, 3, 4, 5].filter((i) => cupShuffle.check(p, i));
        c.ok(correct.length === 1 && correct[0] === p.answer, "đúng một đáp án", p);
        c.ok(p.answer >= 0 && p.answer < p.cups, "đáp án trong hàng cốc", p);
        const bySlots = cupShuffleItemSlots(p);
        c.ok(JSON.stringify(trackByCups(p)) === JSON.stringify(bySlots), "khớp theo dõi cốc", p);
        c.ok(bySlots[p.target] === p.answer, "đáp án = ô của vật cần tìm", p);
        // Vật nằm dưới đúng chiếc cốc úp nó từ đầu.
        const order = cupShuffleCupOrder(p);
        c.ok(
          p.start.every((s, j) => order.indexOf(s) === bySlots[j]),
          "vật đi theo cốc của nó",
          p,
        );
        // Hai vật luôn ở hai cốc khác nhau → hỏi vật nào cũng chỉ một cốc đúng.
        c.ok(new Set(bySlots).size === p.start.length, "hai vật khác cốc", p);
      }
    }
    expect(c.errors).toEqual([]);
  });

  it("bất biến: đúng bảng Độ khó, lượt hợp lệ, không lượt nào 'không làm gì' hay hoàn tác lượt trước", () => {
    const c = collector();
    for (const d of DIFFICULTIES) {
      const level = CUP_SHUFFLE_LEVELS[d];
      const patterns = new Set((level.patterns ?? []).map((x) => x.pattern));
      for (const p of puzzlesOf(d)) {
        c.ok(p.cups === level.cups, "số cốc", p);
        c.ok(p.moves.length === level.moves, "số lượt", p);
        c.ok(p.moveMs === level.moveMs && p.showMs === level.showMs, "nhịp", p);
        c.ok(p.coverMs === 300, "thời gian úp", p);
        c.ok(p.start.length === level.items, "số vật", p);
        c.ok(new Set(p.start).size === level.items, "vật khác ô", p);
        c.ok(
          p.start.every((s) => Number.isInteger(s) && s >= 0 && s < p.cups),
          "ô đầu",
          p,
        );
        c.ok(Number.isInteger(p.target) && p.target >= 0 && p.target < level.items, "vật hỏi", p);

        let rotations = 0;
        p.moves.forEach((m, k) => {
          c.ok(m.length === 2 || m.length === 3, "lượt 2 hoặc 3 cốc", p);
          // Mọi ô trong lượt khác nhau → lượt nào cũng làm đổi chỗ cốc thật.
          c.ok(new Set(m).size === m.length, "ô trong lượt khác nhau", p);
          c.ok(
            m.every((s) => Number.isInteger(s) && s >= 0 && s < p.cups),
            "ô trong hàng",
            p,
          );
          if (m.length === 2) c.ok((m[0] as number) < (m[1] as number), "đổi chỗ a < b", p);
          const prev = p.moves[k - 1];
          if (m.length === 3) {
            rotations++;
            c.ok(
              (m[0] as number) < Math.min(m[1] as number, m[2] as number),
              "xoay: a nhỏ nhất",
              p,
            );
            c.ok(prev === undefined || prev.length === 2, "không hai lượt xoay liền nhau", p);
          }
          if (prev) c.ok(!sameSet(m, prev), "không lặp hoặc hoàn tác lượt trước", p);
        });
        c.ok(rotations >= level.rotations[0] && rotations <= level.rotations[1], "số lượt xoay", p);
        c.ok(Math.min(...movesPerCup(p)) >= level.minCupMoves, "mỗi cốc đi đủ lượt", p);
        if (level.patterns) c.ok(patterns.has(patternOf(p.moves)), "dãy thuộc bảng mẫu", p);
      }
    }
    expect(c.errors).toEqual([]);
  });

  it("dãy dự phòng (mức sinh ngẫu nhiên) cũng thoả mọi bất biến", () => {
    for (const d of DIFFICULTIES) {
      const level = CUP_SHUFFLE_LEVELS[d];
      if (level.patterns) {
        expect(level.fallback).toBeUndefined();
        continue;
      }
      const moves = (level.fallback ?? []) as CupShuffleMove[];
      expect(moves).toHaveLength(level.moves);
      const rotations = moves.filter((m) => m.length === 3).length;
      expect(rotations).toBeGreaterThanOrEqual(level.rotations[0]);
      expect(rotations).toBeLessThanOrEqual(level.rotations[1]);
      moves.forEach((m, k) => {
        expect(new Set(m).size).toBe(m.length);
        expect(m.every((s) => s >= 0 && s < level.cups)).toBe(true);
        const prev = moves[k - 1];
        if (prev) {
          expect(sameSet(m, prev)).toBe(false);
          expect(m.length === 3 && prev.length === 3).toBe(false);
        }
      });
      expect(Math.min(...movesPerCup({ cups: level.cups, moves }))).toBeGreaterThanOrEqual(
        level.minCupMoves,
      );
    }
  });

  describe("chống đoán mò và lặp câu (3 lỗi của bản nháp)", () => {
    /**
     * Lỗi 1 của bản nháp: chạm cốc úp phấn lúc đầu đúng 57,8 % ở Mầm (đoán mò 33 %).
     * Lỗi 3: đáp án nằm trong 2 cốc của lượt cuối ở 83 % câu Mầm, 65 % câu Thường (nền 67 %).
     */
    it("chiến lược 'chạm ô đầu' và 'chạm cốc trong lượt cuối' ≈ đoán mò (10 000 câu mỗi mức)", () => {
      for (const d of DIFFICULTIES) {
        const ps = puzzlesOf(d);
        const guess = 1 / CUP_SHUFFLE_LEVELS[d].cups;
        const tapStart = ps.filter((p) => p.answer === p.start[p.target]).length / ps.length;
        // Chạm ngẫu nhiên một cốc của lượt cuối: trúng với xác suất [đáp án ∈ lượt cuối] / số cốc.
        const tapLast =
          ps.reduce((sum, p) => {
            const last: readonly number[] = p.moves[p.moves.length - 1] ?? [];
            return sum + (last.includes(p.answer) ? 1 / last.length : 0);
          }, 0) / ps.length;
        expect(Math.abs(tapStart - guess), `mức ${d} chạm ô đầu ${tapStart}`).toBeLessThan(0.025);
        expect(Math.abs(tapLast - guess), `mức ${d} chạm lượt cuối ${tapLast}`).toBeLessThan(0.025);
      }
    });

    it("chiến lược tốt nhất chỉ dựa vào ô đầu + lượt cuối gần đoán mò (Mầm: giới hạn đã biết)", () => {
      // Mầm chỉ 3 lượt: với 3 cốc, hai lượt đổi chỗ khác nhau liền nhau không bao giờ đưa phấn
      // về chỗ cũ, nên ai thấy ô đầu và lượt cuối loại được một cốc (đúng 50 %). Không bộ trọng
      // số nào sửa được khi chỉ có 3 lượt (đặc tả, mục Cân bằng).
      const limit: Record<Difficulty, number> = { 0: 0.5 + 0.025, 1: 0.36, 2: 0.28, 3: 0.23 };
      for (const d of DIFFICULTIES) {
        const rate = bestStartLastRate(puzzlesOf(d));
        expect(rate, `mức ${d}: ${rate}`).toBeLessThan(limit[d]);
      }
    });

    it("mức 3 cốc, liệt kê chính xác: chiến lược không theo dõi vật đúng đúng 1/3", () => {
      // Thường: mọi góc nhìn ô đầu + tối đa 2 lượt đầu/cuối đều đúng đúng 1/3.
      for (const [name, view] of Object.entries(VIEWS)) {
        const [hits, total] = exactBest(1, view);
        expect(hits * 3, `Thường, ${name}`).toBe(total);
      }
      // Mầm: chạm ô đầu và chạm cốc lượt cuối đúng 1/3; ô đầu + lượt cuối đúng 1/2 (đã biết).
      const [h0, t0] = exactBest(0, VIEWS["ô đầu"] as (typeof VIEWS)[string]);
      expect(h0 * 3).toBe(t0);
      const [h1, t1] = exactBest(0, VIEWS["ô đầu + lượt cuối"] as (typeof VIEWS)[string]);
      expect(h1 * 2).toBe(t1);
      for (const d of [0, 1] as const) {
        let inLast = 0;
        let total = 0;
        for (const e of catalogFromPatterns(d)) {
          const a = trackByCups({ cups: 3, start: [e.start], moves: e.moves })[0] as number;
          if (e.moves[e.moves.length - 1]?.includes(a)) inLast += e.weight;
          total += e.weight;
        }
        // Đáp án nằm trong 2 cốc của lượt cuối đúng 2/3 số câu = đúng bằng 2 trên 3 cốc.
        expect(inLast * 3).toBe(total * 2);
      }
    });

    it("tần suất từng mẫu dãy khớp trọng số (mức 3 cốc, 10 000 câu)", () => {
      for (const d of [0, 1] as const) {
        const patterns = CUP_SHUFFLE_LEVELS[d].patterns ?? [];
        const sum = patterns.reduce((s, x) => s + x.weight, 0);
        const seen = new Map<string, number>();
        for (const p of puzzlesOf(d)) {
          const key = patternOf(p.moves);
          seen.set(key, (seen.get(key) ?? 0) + 1);
        }
        for (const { pattern, weight } of patterns) {
          const expected = (SEEDS_PER_LEVEL * weight) / sum;
          const got = seen.get(pattern) ?? 0;
          expect(Math.abs(got - expected), `mức ${d} mẫu ${pattern}`).toBeLessThan(expected * 0.12);
        }
      }
    });

    /** Lỗi 2 của bản nháp: Mầm chỉ 30 câu, Thường 126 câu khác nhau, một vòng ~15 câu gần như chắc lặp. */
    it("đủ câu khác nhau; trong một vòng không câu nào lặp lại", () => {
      const key = (p: CupShufflePuzzle) => JSON.stringify([p.start, p.target, p.moves]);
      const distinct = DIFFICULTIES.map((d) => new Set(puzzlesOf(d).map(key)).size);
      // Mầm và Thường dùng hết danh mục (3 lượt: 12 dãy × 3 ô; 5 lượt: 48 dãy × 3 ô).
      expect(distinct[0]).toBe(36);
      expect(distinct[1]).toBe(144);
      expect(distinct[2]).toBeGreaterThan(SEEDS_PER_LEVEL * 0.98);
      expect(distinct[3]).toBeGreaterThan(SEEDS_PER_LEVEL * 0.995);

      // 30 câu đầu của 500 vòng (một vòng 60 s có ≤ ~15 câu): không câu nào trùng câu khác.
      const c = collector();
      for (const d of DIFFICULTIES) {
        for (let r = 0; r < 500; r++) {
          const seed = 900_001 + r * 104_729;
          const round = Array.from({ length: 30 }, (_, i) => key(cupShuffle.generate(seed, i, d)));
          c.ok(new Set(round).size === round.length, `mức ${d} vòng seed ${seed}`, round);
        }
      }
      expect(c.errors).toEqual([]);
    });
  });

  it("đáp án trải đều các cốc, vật cần tìm trải đều phấn/tẩy", () => {
    for (const d of DIFFICULTIES) {
      const counts = Array<number>(CUP_SHUFFLE_LEVELS[d].cups).fill(0);
      const targets = [0, 0];
      for (const p of puzzlesOf(d)) {
        counts[p.answer] = (counts[p.answer] as number) + 1;
        targets[p.target] = (targets[p.target] as number) + 1;
      }
      const even = SEEDS_PER_LEVEL / counts.length;
      for (const n of counts) {
        expect(n).toBeGreaterThan(even * 0.9);
        expect(n).toBeLessThan(even * 1.1);
      }
      if (CUP_SHUFFLE_LEVELS[d].items === 2) {
        expect(targets[0]).toBeGreaterThan(SEEDS_PER_LEVEL * 0.47);
        expect(targets[1]).toBeGreaterThan(SEEDS_PER_LEVEL * 0.47);
      } else {
        expect(targets[1]).toBe(0);
      }
    }
  });

  it("khó dần theo độ khó (đo được trên 10 000 câu mỗi mức)", () => {
    const stats = DIFFICULTIES.map((d) => {
      let cups = 0;
      let rate = 0;
      let motion = 0;
      let load = 0;
      let minTouch = Number.POSITIVE_INFINITY;
      let rotations = 0;
      for (const p of puzzlesOf(d)) {
        const touched = touchedByMove(p).map(count);
        cups += p.cups;
        rate += 1000 / p.moveMs;
        motion += p.moves.reduce((s, m) => s + m.length, 0);
        load += touched.reduce((s, x) => s + x, 0);
        minTouch = Math.min(minTouch, ...touched);
        rotations += p.moves.filter((m) => m.length === 3).length;
      }
      const n = SEEDS_PER_LEVEL;
      return {
        cups: cups / n,
        rate: rate / n,
        motion: motion / n,
        load: load / n,
        minTouch,
        rotations: rotations / n,
      };
    });
    const rising = (xs: number[], strict: boolean) =>
      xs.every((x, i) => {
        const prev = xs[i - 1];
        return prev === undefined || (strict ? x > prev : x >= prev);
      });
    // Số cốc (số lựa chọn) không giảm: 3, 3, 4, 5 → đoán mò 33, 33, 25, 20 %.
    expect(
      rising(
        stats.map((s) => s.cups),
        false,
      ),
    ).toBe(true);
    // Nhịp tráo (lượt/giây) tăng hẳn: 1,43 → 2 → 2,38 → 2,78.
    expect(
      rising(
        stats.map((s) => s.rate),
        true,
      ),
    ).toBe(true);
    // Số lần cốc chuyển chỗ mỗi câu tăng hẳn: 6 → 10 → ~13,5 → ~16,5.
    expect(
      rising(
        stats.map((s) => s.motion),
        true,
      ),
    ).toBe(true);
    // Tải theo dõi (tổng số lượt chạm cốc có vật phải nhớ): 2 → 3,34 → 3,36 → 6,6. Khó chỉ
    // ngang Thường ở chỉ số này; Khó khó hơn nhờ 4 cốc, xoay vòng và nhịp nhanh hơn.
    const [l0, l1, l2, l3] = stats.map((s) => s.load) as [number, number, number, number];
    expect(l1).toBeGreaterThan(l0);
    expect(l2).toBeGreaterThanOrEqual(l1);
    expect(l3).toBeGreaterThan(l2 * 1.5);
    // Phấn bị chạm ít nhất 1 lượt ở Mầm, 2 lượt từ Thường (mỗi vật).
    expect(stats.map((s) => s.minTouch)).toEqual([1, 2, 2, 2]);
    // Xoay vòng chỉ có từ Khó.
    expect(stats.map((s) => s.rotations > 0)).toEqual([false, false, true, true]);
  });

  it("dòng thời gian và miễn trừ thưởng tốc độ", () => {
    const expected: Record<Difficulty, number> = { 0: 3300, 1: 3400, 2: 3420, 3: 3720 };
    for (const d of DIFFICULTIES) {
      const p = cupShuffle.generate(42, 3, d);
      expect(cupShuffleInputAtMs(p)).toBe(expected[d]);
      expect(cupShuffle.speedAllowanceMs?.(p, d)).toBe(expected[d]);
      expect(cupShuffleMoveStartMs(p, 0)).toBe(p.showMs + p.coverMs);
      expect(cupShuffleMoveStartMs(p, p.moves.length)).toBe(expected[d]);
      expect(expected[d]).toBeLessThan(cupShuffle.durationMs);
    }
  });

  it("hệ số điểm: Thường = 1, không giảm khi lên mức", () => {
    const m = cupShuffle.difficultyMultiplier;
    const values = DIFFICULTIES.map((d) => m?.[d] ?? Number.NaN);
    expect(values[1]).toBe(1);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it("isAnswer() từ chối dữ liệu rác", () => {
    for (const ok of [0, 1, 2, 3, 4]) expect(cupShuffle.isAnswer(ok)).toBe(true);
    for (const bad of [
      -1,
      5,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "0",
      null,
      undefined,
      true,
      [0],
      {},
    ]) {
      expect(cupShuffle.isAnswer(bad)).toBe(false);
    }
  });
});

/** Mầm, mẫu ABC: phấn ở ô 1 → (0,1) sang ô 0 → (0,2) sang ô 2 → (1,2) sang ô 1. */
const GOLDEN_EASY: CupShufflePuzzle = {
  cups: 3,
  start: [1],
  target: 0,
  moves: [
    [0, 1],
    [0, 2],
    [1, 2],
  ],
  showMs: 900,
  coverMs: 300,
  moveMs: 700,
  answer: 1,
};

/** Thường, mẫu ABABC: phấn 0 → 2 → 1 → 1 (lượt mồi) → 2 → 2 (lượt mồi). */
const GOLDEN_NORMAL: CupShufflePuzzle = {
  cups: 3,
  start: [0],
  target: 0,
  moves: [
    [0, 2],
    [1, 2],
    [0, 2],
    [1, 2],
    [0, 1],
  ],
  showMs: 600,
  coverMs: 300,
  moveMs: 500,
  answer: 2,
};

/** Siêu khó: phấn 1 → 1 → 1 → 3 → 2 → 2 → 2 → 2; tẩy 3 → 4 → 2 → 2 → 0 → 0 → 3 → 3. Hỏi phấn. */
const GOLDEN_SUPER: CupShufflePuzzle = {
  cups: 5,
  start: [1, 3],
  target: 0,
  moves: [
    [0, 3, 4],
    [2, 4],
    [1, 3],
    [0, 3, 2],
    [3, 4],
    [0, 3, 1],
    [1, 4],
  ],
  showMs: 900,
  coverMs: 300,
  moveMs: 360,
  answer: 2,
};
