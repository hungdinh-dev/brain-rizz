import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import { type LightTrailPuzzle, lightTrail, lightTrailRevealMs } from "./light-trail";

const SEEDS = 10_000;

/** Bảng Độ khó của đặc tả, chép lại độc lập với code để test bắt được chỗ lệch. */
const SPEC: Record<
  Difficulty,
  { n: number; L: number; reverse: boolean; litMs: number; stepMs: number; revealMs: number }
> = {
  0: { n: 3, L: 3, reverse: false, litMs: 550, stepMs: 800, revealMs: 2_900 },
  1: { n: 3, L: 4, reverse: false, litMs: 450, stepMs: 650, revealMs: 3_100 },
  2: { n: 4, L: 5, reverse: false, litMs: 360, stepMs: 520, revealMs: 3_100 },
  3: { n: 4, L: 5, reverse: true, litMs: 360, stepMs: 520, revealMs: 3_100 },
};

/** Seed vòng thứ i: trải khắp 32 bit thay vì chỉ 0…9 999. */
const roundSeedOf = (i: number) => Math.imul(i + 1, 0x9e3779b1) >>> 0;

/** Duyệt 10.000 câu của một mức: mỗi câu một seed vòng, index xoay vòng 0–19. */
function forEachPuzzle(
  d: Difficulty,
  fn: (p: LightTrailPuzzle, roundSeed: number, index: number) => void,
) {
  for (let i = 0; i < SEEDS; i++) {
    const roundSeed = roundSeedOf(i);
    const index = i % 20;
    fn(lightTrail.generate(roundSeed, index, d), roundSeed, index);
  }
}

/** Mọi chuỗi gồm `length` ô khác nhau trong [0, cells) — đúng những gì client hợp lệ có thể gửi. */
function* distinctSequences(
  cells: number,
  length: number,
  prefix: number[] = [],
): Generator<number[]> {
  if (prefix.length === length) {
    yield prefix;
    return;
  }
  for (let c = 0; c < cells; c++) {
    if (!prefix.includes(c)) yield* distinctSequences(cells, length, [...prefix, c]);
  }
}

const permutations = (n: number, k: number) => {
  let out = 1;
  for (let i = 0; i < k; i++) out *= n - i;
  return out;
};

describe("light-trail", () => {
  it("tất định: sinh hai lần ra giống hệt (10.000 seed × 4 mức)", () => {
    for (const d of DIFFICULTIES) {
      let mismatches = 0;
      forEachPuzzle(d, (p, roundSeed, index) => {
        const again = lightTrail.generate(roundSeed, index, d);
        if (JSON.stringify(again) !== JSON.stringify(p)) mismatches++;
      });
      expect(mismatches, `mức ${d}`).toBe(0);
    }
  });

  it("tất định giữa các phiên bản: câu đố cố định không đổi", () => {
    // Đổi cách sinh làm hỏng mọi trận đang chạy giữa client cũ và server mới → phải cố ý sửa ở đây.
    expect(lightTrail.generate(777, 5, 0)).toEqual({
      cols: 3,
      rows: 3,
      sequence: [0, 6, 3],
      expected: [0, 6, 3],
      reverse: false,
      leadMs: 500,
      litMs: 550,
      stepMs: 800,
    });
    expect(lightTrail.generate(777, 5, 3)).toEqual({
      cols: 4,
      rows: 4,
      sequence: [15, 7, 1, 0, 12],
      expected: [12, 0, 1, 7, 15],
      reverse: true,
      leadMs: 500,
      litMs: 360,
      stepMs: 520,
    });
    expect(lightTrail.generate(0xdeadbeef, 0, 1).sequence).toEqual([7, 4, 8, 1]);
    expect(lightTrail.generate(0xdeadbeef, 0, 2).sequence).toEqual([11, 15, 8, 0, 13]);
  });

  it("đúng MỘT đáp án: chỉ `expected` được nhận, mọi biến thể đều sai (10.000 seed × 4 mức)", () => {
    for (const d of DIFFICULTIES) {
      const failures: string[] = [];
      const fail = (msg: string, p: LightTrailPuzzle) => {
        if (failures.length < 5) failures.push(`${msg}: ${JSON.stringify(p)}`);
      };

      forEachPuzzle(d, (p) => {
        const exp = p.expected;
        const cells = p.cols * p.rows;
        const accepts = (a: number[]) => lightTrail.isAnswer(a) && lightTrail.check(p, a);

        if (!accepts([...exp])) fail("không nhận đáp án đúng", p);

        for (let i = 0; i < exp.length; i++) {
          for (let c = 0; c < cells; c++) {
            if (c === exp[i]) continue;
            // Đổi một phần tử sang ô khác.
            const changed = [...exp];
            changed[i] = c;
            if (lightTrail.check(p, changed)) fail(`nhận khi đổi vị trí ${i} thành ${c}`, p);
            // Đúng hình dạng client gửi khi chạm sai: tiền tố đúng + ô sai.
            const wrongTap = [...exp.slice(0, i), c];
            if (!lightTrail.isAnswer(wrongTap)) fail("isAnswer từ chối lần chạm sai hợp lệ", p);
            if (lightTrail.check(p, wrongTap)) fail(`nhận lần chạm sai ${wrongTap}`, p);
          }
        }
        // Đổi chỗ hai phần tử liền kề.
        for (let i = 0; i + 1 < exp.length; i++) {
          const swapped = [...exp];
          [swapped[i], swapped[i + 1]] = [exp[i + 1]!, exp[i]!];
          if (lightTrail.check(p, swapped)) fail(`nhận khi đổi chỗ ${i} và ${i + 1}`, p);
        }
        // Thiếu: mọi tiền tố ngắn hơn, kể cả bỏ phần tử cuối.
        for (let k = 1; k < exp.length; k++) {
          if (lightTrail.check(p, exp.slice(0, k))) fail(`nhận tiền tố dài ${k}`, p);
        }
        // Thừa: thêm một ô bất kỳ.
        for (let c = 0; c < cells; c++) {
          if (lightTrail.check(p, [...exp, c])) fail(`nhận khi thêm ô ${c}`, p);
        }
        // Siêu khó: chạm xuôi theo thứ tự sáng là sai.
        if (p.reverse && lightTrail.check(p, [...p.sequence])) fail("nhận chạm xuôi", p);
      });

      expect(failures, `mức ${d}`).toEqual([]);
    }
  });

  it("đúng MỘT đáp án: duyệt hết mọi chuỗi ô khác nhau ở Mầm và Thường (200 seed mỗi mức)", () => {
    for (const d of [0, 1] as const) {
      const { n, L } = SPEC[d];
      for (let i = 0; i < 200; i++) {
        const p = lightTrail.generate(roundSeedOf(i), i % 20, d);
        let accepted = 0;
        let total = 0;
        for (const a of distinctSequences(n * n, L)) {
          total++;
          if (lightTrail.check(p, a)) accepted++;
        }
        expect(total).toBe(permutations(n * n, L));
        expect(accepted, `mức ${d}, seed ${i}`).toBe(1);
      }
    }
  });

  it("đúng mọi ràng buộc của đặc tả (10.000 seed × 4 mức)", () => {
    for (const d of DIFFICULTIES) {
      const s = SPEC[d];
      const failures: string[] = [];
      const fail = (msg: string, p: LightTrailPuzzle) => {
        if (failures.length < 5) failures.push(`${msg}: ${JSON.stringify(p)}`);
      };

      forEachPuzzle(d, (p) => {
        if (p.cols !== s.n || p.rows !== s.n) fail("sai cỡ lưới", p);
        if (p.sequence.length !== s.L) fail("sai độ dài chuỗi", p);
        if (new Set(p.sequence).size !== p.sequence.length) fail("chuỗi có ô trùng", p);
        if (!p.sequence.every((c) => Number.isInteger(c) && c >= 0 && c < s.n * s.n)) {
          fail("ô ngoài lưới", p);
        }
        if (p.reverse !== s.reverse) fail("sai chiều", p);
        const want = s.reverse ? [...p.sequence].reverse() : p.sequence;
        if (JSON.stringify(p.expected) !== JSON.stringify(want)) fail("expected sai", p);
        if (s.reverse && p.expected[0] === p.sequence[0]) fail("ô chạm đầu trùng ô sáng đầu", p);

        if (p.leadMs !== 500 || p.litMs !== s.litMs || p.stepMs !== s.stepMs) {
          fail("lịch khác bảng", p);
        }
        if (![p.leadMs, p.litMs, p.stepMs].every(Number.isInteger)) {
          fail("thời gian không nguyên", p);
        }
        if (p.stepMs - p.litMs < 150) fail("khoảng tắt < 150 ms", p);
        if (p.stepMs < 400) fail("nhịp < 400 ms (quá 2,5 lần nháy/giây)", p);
        const reveal = lightTrailRevealMs(p);
        if (reveal !== s.revealMs || reveal > 3_200) fail(`revealMs = ${reveal}`, p);
        // Đèn cuối tắt hẳn trước khi được chạm.
        if (p.leadMs + (p.sequence.length - 1) * p.stepMs + p.litMs > reveal) {
          fail("đèn cuối còn sáng khi đã được chạm", p);
        }
      });

      expect(failures, `mức ${d}`).toEqual([]);
    }
  });

  it("độ khó tăng dần thật, đo được", () => {
    const params = DIFFICULTIES.map((d) => {
      const p = lightTrail.generate(1, 0, d);
      return { n: p.cols, L: p.sequence.length, step: p.stepMs, reverse: p.reverse };
    });
    // Số chuỗi có thể có = n² chỉnh hợp L.
    const space = params.map(({ n, L }) => permutations(n * n, L));
    expect(space).toEqual([504, 3_024, 524_160, 524_160]);
    expect(params.map((x) => x.reverse)).toEqual([false, false, false, true]);

    for (let d = 1; d < params.length; d++) {
      const prev = params[d - 1]!;
      const cur = params[d]!;
      // Không mức nào dễ hơn mức trước ở bất kỳ tham số nào…
      expect(cur.n).toBeGreaterThanOrEqual(prev.n);
      expect(cur.L).toBeGreaterThanOrEqual(prev.L);
      expect(cur.step).toBeLessThanOrEqual(prev.step);
      // …và khó hơn ở ít nhất một tham số.
      const harder =
        cur.n > prev.n || cur.L > prev.L || cur.step < prev.step || (cur.reverse && !prev.reverse);
      expect(harder, `mức ${d}`).toBe(true);
    }

    // Bộ sinh phủ được không gian chuỗi: số chuỗi khác nhau thấy được trên 10.000 seed tăng dần,
    // và Mầm phủ đủ cả 504 chuỗi.
    const distinct = DIFFICULTIES.map((d) => {
      const seen = new Set<string>();
      forEachPuzzle(d, (p) => seen.add(p.expected.join(",")));
      return seen.size;
    });
    expect(distinct[0]).toBe(504);
    expect(distinct[1]!).toBeGreaterThan(distinct[0]!);
    expect(distinct[2]!).toBeGreaterThan(distinct[1]!);
  });

  it("không thiên vị vị trí: ô sáng đầu tiên lệch ≤ 20 % so với trung bình (10.000 seed)", () => {
    for (const d of DIFFICULTIES) {
      const cells = SPEC[d].n ** 2;
      const counts = new Array<number>(cells).fill(0);
      forEachPuzzle(d, (p) => {
        counts[p.sequence[0]!]!++;
      });
      const mean = SEEDS / cells;
      const worst = Math.max(...counts.map((c) => Math.abs(c - mean) / mean));
      expect(worst, `mức ${d}`).toBeLessThanOrEqual(0.2);
    }
  });

  it("cùng gốc: Mầm là tiền tố của Thường, Khó và Siêu khó sáng y hệt (10.000 seed)", () => {
    let broken = 0;
    for (let i = 0; i < SEEDS; i++) {
      const [seed, index] = [roundSeedOf(i), i % 20];
      const [p0, p1, p2, p3] = DIFFICULTIES.map((d) => lightTrail.generate(seed, index, d));
      if (p1!.sequence.slice(0, 3).join() !== p0!.sequence.join()) broken++;
      if (p2!.sequence.join() !== p3!.sequence.join()) broken++;
    }
    expect(broken).toBe(0);
  });

  it("check() với ví dụ trong đặc tả", () => {
    // Siêu khó: sáng 13 → 6 → 0 → 10 → 7, phải chạm 7 → 10 → 0 → 6 → 13.
    const p: LightTrailPuzzle = {
      cols: 4,
      rows: 4,
      sequence: [13, 6, 0, 10, 7],
      expected: [7, 10, 0, 6, 13],
      reverse: true,
      leadMs: 500,
      litMs: 360,
      stepMs: 520,
    };
    expect(lightTrail.check(p, [7, 10, 0, 6, 13])).toBe(true);
    expect(lightTrail.check(p, [7, 10, 3])).toBe(false);
    expect(lightTrail.check(p, [13, 6, 0, 10, 7])).toBe(false);
    expect(lightTrail.check(p, [7, 10, 0, 6])).toBe(false);
    expect(lightTrail.check(p, [7, 10, 0, 6, 13, 1])).toBe(false);
    expect(lightTrailRevealMs(p)).toBe(3_100);
  });

  it("isAnswer() nhận mảng hợp lệ, từ chối dữ liệu rác", () => {
    for (const ok of [[0], [15], [6, 1, 5], [7, 10, 3], [0, 1, 2, 3, 4], [15, 15]]) {
      expect(lightTrail.isAnswer(ok), JSON.stringify(ok)).toBe(true);
    }

    const holey: number[] = [];
    holey[1] = 2; // [ <trống>, 2 ]
    const junk: unknown[] = [
      undefined,
      null,
      3,
      "6,1,5",
      true,
      {},
      { length: 1, 0: 1 },
      new Uint8Array([1, 2]),
      [],
      [0, 1, 2, 3, 4, 5],
      [1.5],
      [-1],
      [16],
      [Number.NaN],
      [Number.POSITIVE_INFINITY],
      ["3"],
      [[1]],
      [null],
      [undefined],
      [true],
      [1, "2"],
      new Array(3),
      holey,
    ];
    for (const bad of junk) {
      expect(lightTrail.isAnswer(bad), String(bad)).toBe(false);
    }
  });

  it("CR-006: vòng 60 s, hệ số theo mức không giảm, Thường = 1", () => {
    expect(lightTrail.durationMs).toBe(60_000);
    const m = lightTrail.difficultyMultiplier!;
    const values = DIFFICULTIES.map((d) => m[d]);
    expect(values.every((v) => Number.isFinite(v) && v > 0)).toBe(true);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(m[1]).toBe(1);
  });

  it("CR-006: speedAllowanceMs hữu hạn, ≥ 0, tất định và bằng thời gian trình chiếu (10.000 seed × 4 mức)", () => {
    const allowance = lightTrail.speedAllowanceMs!;
    for (const d of DIFFICULTIES) {
      let bad = 0;
      forEachPuzzle(d, (p, roundSeed, index) => {
        const ms = allowance(p, d);
        const again = allowance(lightTrail.generate(roundSeed, index, d), d);
        const ok =
          Number.isFinite(ms) &&
          Number.isInteger(ms) &&
          ms >= 0 &&
          ms === again &&
          ms === lightTrailRevealMs(p) &&
          ms === SPEC[d].revealMs &&
          ms < lightTrail.durationMs;
        if (!ok) bad++;
      });
      expect(bad, `mức ${d}`).toBe(0);
    }
  });
});
