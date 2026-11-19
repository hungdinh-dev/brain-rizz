import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import {
  type Balloon,
  type NumberBalloonsAnswer,
  type NumberBalloonsPuzzle,
  numberBalloons,
} from "./number-balloons";

/** Số seed mỗi mức (≥ 10 000 theo AGENTS.md). */
const SEEDS = 10_000;

/**
 * Seed vòng trải khắp dải 32 bit, chỉ số câu 0–24. Không nhân với 0x9e3779b1 như `deriveSeed`
 * nhân chỉ số câu, kẻo hai số hạng triệt tiêu nhau qua phép XOR và nhiều seed cho cùng câu đố.
 */
function roundSeedOf(s: number): number {
  return (Math.imul(s, 0x27d4eb2f) + 0x165667b1) >>> 0;
}

function generate(s: number, d: Difficulty): NumberBalloonsPuzzle {
  return numberBalloons.generate(roundSeedOf(s), s % 25, d);
}

/** Sinh sẵn 10 000 câu mỗi mức, dùng chung cho các test. */
const SAMPLES: Record<Difficulty, NumberBalloonsPuzzle[]> = {
  0: Array.from({ length: SEEDS }, (_, s) => generate(s, 0)),
  1: Array.from({ length: SEEDS }, (_, s) => generate(s, 1)),
  2: Array.from({ length: SEEDS }, (_, s) => generate(s, 2)),
  3: Array.from({ length: SEEDS }, (_, s) => generate(s, 3)),
};

/** Thông số mỗi mức theo đặc tả (mục Độ khó). */
const SPEC: Record<
  Difficulty,
  { count: number; cols: number; rows: number; min: number; max: number; ops: number }
> = {
  0: { count: 3, cols: 2, rows: 3, min: 1, max: 20, ops: 0 },
  1: { count: 5, cols: 3, rows: 3, min: 10, max: 99, ops: 0 },
  2: { count: 5, cols: 3, rows: 3, min: -50, max: 50, ops: 0 },
  3: { count: 5, cols: 2, rows: 3, min: -15, max: 25, ops: 2 },
};

/** Gom lỗi để một vòng 10 000 seed chỉ gọi `expect` một lần (nhanh, báo vài lỗi đầu). */
function expectNoFailures(failures: string[]): void {
  expect(failures.slice(0, 5), `${failures.length} lỗi`).toEqual([]);
}

function sortedValues(p: NumberBalloonsPuzzle): number[] {
  return p.order.map((i) => p.balloons[i]!.value);
}

const tens = (v: number) => Math.trunc(Math.abs(v) / 10);
const isInt = (v: number) => Number.isInteger(v);

/** Mọi hoán vị của [0, n). */
function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (const rest of permutations(n - 1)) {
    for (let at = 0; at <= rest.length; at++)
      out.push([...rest.slice(0, at), n - 1, ...rest.slice(at)]);
  }
  return out;
}
const PERMUTATIONS: Record<number, number[][]> = { 3: permutations(3), 5: permutations(5) };

/**
 * Mô hình thời gian giải của người lớn (giây), đúng như mục Cân bằng của đặc tả.
 * Cặp dễ nhầm: hai giá trị liền kề theo thứ tự tăng dần, cách nhau ≤ 2, hoặc cùng dấu và cùng
 * hàng chục (cả hai có ≥ 2 chữ số).
 */
function modelSeconds(p: NumberBalloonsPuzzle): number {
  const read = (b: Balloon): number => {
    if (b.kind === "add") return 1.0;
    if (b.kind === "mul") return 0.9;
    if (b.kind === "sub") return b.value < 0 ? 1.4 : 1.1;
    return (Math.abs(b.value) <= 9 ? 0.25 : 0.35) + (b.value < 0 ? 0.15 : 0);
  };
  const confusable = (x: number, y: number): boolean =>
    y - x <= 2 ||
    (Math.sign(x) === Math.sign(y) &&
      Math.abs(x) >= 10 &&
      Math.abs(y) >= 10 &&
      tens(x) === tens(y));

  const n = p.balloons.length;
  const tricky = p.balloons.some((b) => b.value < 0 || b.kind !== "num");
  let t = 0.3 + 0.35 * n + (tricky ? 0.3 : 0.2) * (n - 1);
  for (const b of p.balloons) t += read(b);
  const sorted = sortedValues(p);
  for (let k = 0; k + 1 < sorted.length; k++) if (confusable(sorted[k]!, sorted[k + 1]!)) t += 0.2;
  return t;
}

function percentile(xs: readonly number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(q * (s.length - 1))]!;
}

describe("number-balloons", { timeout: 60_000 }, () => {
  it("khai báo theo CR-006: vòng 60 giây, hệ số dương và không giảm theo mức", () => {
    expect(numberBalloons.durationMs).toBe(60_000);
    const m = numberBalloons.difficultyMultiplier;
    expect(m).toBeDefined();
    const values = DIFFICULTIES.map((d) => m![d]);
    for (const v of values) expect(Number.isFinite(v) && v > 0).toBe(true);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it("tất định: cùng (seed, index, độ khó) → cùng câu đố (10 000 seed × 4 mức)", () => {
    const failures: string[] = [];
    for (const d of DIFFICULTIES) {
      SAMPLES[d].forEach((p, s) => {
        if (JSON.stringify(generate(s, d)) !== JSON.stringify(p)) failures.push(`d${d} s${s}`);
      });
    }
    expectNoFailures(failures);
    expect(numberBalloons.generate(777, 5, 3)).toEqual(numberBalloons.generate(777, 5, 3));
  });

  it("câu khác nhau theo seed và theo chỉ số câu", () => {
    for (const d of DIFFICULTIES) {
      const bySeed = new Set(SAMPLES[d].slice(0, 200).map((p) => JSON.stringify(p)));
      expect(bySeed.size).toBeGreaterThan(190);
      const byIndex = new Set(
        Array.from({ length: 50 }, (_, i) => JSON.stringify(numberBalloons.generate(42, i, d))),
      );
      expect(byIndex.size).toBe(50);
    }
  });

  it("đúng MỘT thứ tự chạm được chấp nhận, và đó là thứ tự tăng dần (10 000 seed × 4 mức)", () => {
    const failures: string[] = [];
    for (const d of DIFFICULTIES) {
      SAMPLES[d].forEach((p, s) => {
        const values = p.balloons.map((b) => b.value);
        if (new Set(values).size !== values.length) failures.push(`d${d} s${s}: giá trị trùng`);
        const sorted = sortedValues(p);
        if (!sorted.every((v, k) => k === 0 || sorted[k - 1]! < v))
          failures.push(`d${d} s${s}: order không tăng ngặt`);
        const accepted = PERMUTATIONS[p.balloons.length]!.filter((perm) =>
          numberBalloons.check(p, perm),
        );
        if (accepted.length !== 1 || JSON.stringify(accepted[0]) !== JSON.stringify(p.order))
          failures.push(`d${d} s${s}: ${accepted.length} thứ tự được nhận`);
      });
    }
    expectNoFailures(failures);
  });

  it("check nhận đáp án đúng, từ chối mảng thiếu, lệch thứ tự hoặc mảng gửi lúc chạm nhầm", () => {
    const failures: string[] = [];
    for (const d of DIFFICULTIES) {
      SAMPLES[d].forEach((p, s) => {
        const n = p.order.length;
        if (!numberBalloons.check(p, [...p.order])) failures.push(`d${d} s${s}: không nhận order`);
        for (let k = 0; k < n; k++) {
          // Phần đầu của order (chưa nổ hết) luôn sai.
          if (numberBalloons.check(p, p.order.slice(0, k)))
            failures.push(`d${d} s${s}: nhận tiền tố`);
          // Mảng client gửi khi chạm nhầm ở lần thứ k: tiền tố đúng + một quả sai.
          for (const wrong of p.order.slice(k + 1)) {
            const sent = [...p.order.slice(0, k), wrong];
            if (!numberBalloons.isAnswer(sent))
              failures.push(`d${d} s${s}: isAnswer từ chối ${sent}`);
            if (numberBalloons.check(p, sent)) failures.push(`d${d} s${s}: nhận ${sent}`);
          }
          // Đổi chỗ hai phần tử liền kề.
          if (k + 1 < n) {
            const swapped = [...p.order];
            [swapped[k], swapped[k + 1]] = [swapped[k + 1]!, swapped[k]!];
            if (numberBalloons.check(p, swapped)) failures.push(`d${d} s${s}: nhận ${swapped}`);
          }
        }
        if (numberBalloons.check(p, [...p.order, n])) failures.push(`d${d} s${s}: nhận mảng dài`);
      });
    }
    expectNoFailures(failures);
  });

  it("ràng buộc chung: số bóng, lưới, giá trị, bố cục (10 000 seed × 4 mức)", () => {
    const failures: string[] = [];
    for (const d of DIFFICULTIES) {
      const spec = SPEC[d];
      SAMPLES[d].forEach((p, s) => {
        const fail = (msg: string) => failures.push(`d${d} s${s}: ${msg}`);
        if (p.cols !== spec.cols || p.rows !== spec.rows) fail(`lưới ${p.cols}×${p.rows}`);
        if (p.balloons.length !== spec.count) fail(`${p.balloons.length} bóng`);
        if ([...p.order].sort((a, b) => a - b).join() !== p.balloons.map((_, i) => i).join())
          fail("order không phải hoán vị");

        const slots = p.balloons.map((b) => b.slot);
        const colors = p.balloons.map((b) => b.color);
        if (new Set(slots).size !== slots.length) fail("trùng ô");
        if (new Set(colors).size !== colors.length) fail("trùng màu");

        for (const b of p.balloons) {
          const all = [b.a, b.b, b.value, b.slot, b.color, b.dx, b.dy, b.phase];
          if (!all.every(isInt)) fail(`số không nguyên ${JSON.stringify(b)}`);
          if (b.value < spec.min || b.value > spec.max) fail(`giá trị ${b.value} ngoài phạm vi`);
          if (b.slot < 0 || b.slot >= p.cols * p.rows) fail(`ô ${b.slot}`);
          if (b.color < 0 || b.color > 5) fail(`màu ${b.color}`);
          if (Math.abs(b.dx) > 2 || Math.abs(b.dy) > 2) fail(`lệch ${b.dx},${b.dy}`);
          if (b.phase < 0 || b.phase > 359) fail(`pha ${b.phase}`);

          if (b.kind === "num") {
            if (b.a !== b.value || b.b !== 0) fail(`bóng số sai ${JSON.stringify(b)}`);
          } else {
            const result = b.kind === "add" ? b.a + b.b : b.kind === "sub" ? b.a - b.b : b.a * b.b;
            const hi = b.kind === "mul" ? 9 : 20;
            if (result !== b.value) fail(`phép tính sai ${JSON.stringify(b)}`);
            if (b.a < 2 || b.a > hi || b.b < 2 || b.b > hi) fail(`toán hạng ${JSON.stringify(b)}`);
          }
        }
        const ops = p.balloons.filter((b) => b.kind !== "num").length;
        if (ops !== spec.ops) fail(`${ops} bóng phép tính`);
      });
    }
    expectNoFailures(failures);
  });

  it("ràng buộc riêng từng mức (10 000 seed × 4 mức)", () => {
    const failures: string[] = [];
    for (const d of DIFFICULTIES) {
      SAMPLES[d].forEach((p, s) => {
        const fail = (msg: string) => failures.push(`d${d} s${s}: ${msg} ${sortedValues(p)}`);
        const sorted = sortedValues(p);
        const negatives = sorted.filter((v) => v < 0);
        const pairs: Array<[Balloon, Balloon]> = [];
        p.balloons.forEach((x, i) => {
          for (const y of p.balloons.slice(i + 1)) pairs.push([x, y]);
        });

        if (d === 0) {
          for (let k = 1; k < sorted.length; k++)
            if (sorted[k]! - sorted[k - 1]! < 2) fail("Mầm: hai số liền kề cách nhau < 2");
        }
        if (d === 1) {
          if (!pairs.some(([x, y]) => tens(x.value) === tens(y.value)))
            fail("Thường: thiếu cặp cùng hàng chục");
        }
        if (d === 2) {
          if (negatives.length < 2 || negatives.length > 3) fail("Khó: số lượng số âm");
          const negativePair = pairs.some(
            ([x, y]) => x.value <= -10 && y.value <= -10 && tens(x.value) === tens(y.value),
          );
          if (!negativePair) fail("Khó: thiếu cặp số âm cùng hàng chục");
        }
        if (d === 3) {
          if (negatives.length < 1) fail("Siêu khó: thiếu số âm");
          const closeWithOperation = pairs.some(
            ([x, y]) => Math.abs(x.value - y.value) <= 2 && (x.kind !== "num" || y.kind !== "num"),
          );
          if (!closeWithOperation) fail("Siêu khó: thiếu cặp cách 1–2 chứa bóng phép tính");
        }
      });
    }
    expectNoFailures(failures);
  });

  it("Siêu khó dùng đủ cả ba phép, có phép ra số âm", () => {
    const count = { add: 0, sub: 0, mul: 0, negative: 0, total: 0 };
    for (const p of SAMPLES[3]) {
      for (const b of p.balloons) {
        if (b.kind === "num") continue;
        count[b.kind]++;
        count.total++;
        if (b.value < 0) count.negative++;
      }
    }
    expect(count.total).toBe(2 * SEEDS);
    for (const share of [count.add, count.sub, count.mul, count.negative])
      expect(share / count.total).toBeGreaterThan(0.05);
  });

  it("Thường và Khó cùng seed có bóng ở cùng vị trí (bố cục không phụ thuộc độ khó)", () => {
    const layout = (p: NumberBalloonsPuzzle) =>
      p.balloons.map(({ slot, color, dx, dy, phase }) => [slot, color, dx, dy, phase]);
    const failures: string[] = [];
    for (let s = 0; s < SEEDS; s++) {
      if (JSON.stringify(layout(SAMPLES[1][s]!)) !== JSON.stringify(layout(SAMPLES[2][s]!)))
        failures.push(`s${s}`);
    }
    expectNoFailures(failures);
  });

  it("độ khó tăng thật: thời gian giải theo mô hình tăng ngặt, P90 mức dưới < P10 mức trên", () => {
    const stats = DIFFICULTIES.map((d) => {
      const times = SAMPLES[d].map(modelSeconds);
      return {
        mean: times.reduce((a, b) => a + b, 0) / times.length,
        p10: percentile(times, 0.1),
        p90: percentile(times, 0.9),
      };
    });
    for (let d = 1; d < stats.length; d++) {
      const lower = stats[d - 1]!;
      const upper = stats[d]!;
      expect(upper.mean).toBeGreaterThan(lower.mean);
      expect(lower.p90).toBeLessThan(upper.p10);
    }
    // Khớp bảng Cân bằng của đặc tả (sai lệch ≤ 0,1 s).
    const specMeans = [2.8, 4.9, 5.6, 7.1];
    stats.forEach((x, d) => {
      expect(Math.abs(x.mean - specMeans[d]!)).toBeLessThanOrEqual(0.1);
    });
  });

  it("speedAllowanceMs hữu hạn, ≥ 0, tất định, đúng 1 000 / 2 000 / 2 000 / 4 000 ms", () => {
    const expected: Record<Difficulty, number> = { 0: 1_000, 1: 2_000, 2: 2_000, 3: 4_000 };
    const allowance = numberBalloons.speedAllowanceMs!;
    const failures: string[] = [];
    for (const d of DIFFICULTIES) {
      SAMPLES[d].forEach((p, s) => {
        const ms = allowance(p, d);
        if (!Number.isFinite(ms) || ms < 0) failures.push(`d${d} s${s}: ${ms}`);
        if (ms !== expected[d]) failures.push(`d${d} s${s}: ${ms} ≠ ${expected[d]}`);
        if (allowance(generate(s, d), d) !== ms) failures.push(`d${d} s${s}: không tất định`);
      });
    }
    expectNoFailures(failures);
  });

  it("isAnswer nhận mọi thứ tự đúng và mảng hợp lệ", () => {
    for (const d of DIFFICULTIES) {
      for (const p of SAMPLES[d]) expect(numberBalloons.isAnswer(p.order)).toBe(true);
    }
    const valid: NumberBalloonsAnswer[] = [[0], [4], [2, 0], [4, 3, 2, 1, 0], [0, 1, 2, 3, 4]];
    for (const v of valid) expect(numberBalloons.isAnswer(v)).toBe(true);
  });

  it("isAnswer từ chối dữ liệu rác", () => {
    const sparse: number[] = [0, 1];
    sparse[3] = 2;
    const garbage: unknown[] = [
      undefined,
      null,
      0,
      3,
      "0,1,2",
      { 0: 0, length: 1 },
      [],
      [0, 1, 2, 3, 4, 0],
      [0, 1, 2, 3, 4, 5],
      Array.from({ length: 1_000 }, (_, i) => i),
      [1.5],
      [0, 0.5],
      [-1],
      [5],
      [0, 7],
      [Number.NaN],
      [Number.POSITIVE_INFINITY],
      [0, 0],
      [1, 2, 1],
      ["0"],
      [true],
      [null],
      [[0]],
      [{}],
      [0n],
      sparse,
    ];
    for (const value of garbage) expect(numberBalloons.isAnswer(value), String(value)).toBe(false);
  });
});
