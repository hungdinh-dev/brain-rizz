import { afterEach, describe, expect, it, vi } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import {
  POUR_LINE_HEIGHT,
  POUR_LINE_MAX_HOLD_MS,
  POUR_LINE_SLICE_H,
  POUR_LINE_SLICES,
  POUR_LINE_WIDTH_MAX,
  type PourLinePuzzle,
  type PourLineShape,
  pourLine,
  pourLineFallback,
  pourLineLevelAt,
  pourLineMsToReach,
  pourLineVolumeAt,
} from "./pour-line";

/** Bảng mức trong đặc tả (docs/04-minigames/pour-line.md, mục Độ khó). */
const SPEC: Record<
  Difficulty,
  {
    shapes: readonly PourLineShape[];
    tol: number;
    target: readonly [number, number];
    fullMs: readonly [number, number];
    window: readonly [number, number];
    hideFrom: number | null;
  }
> = {
  0: {
    shapes: ["tube"],
    tol: 80,
    target: [300, 800],
    fullMs: [2_800, 3_200],
    window: [300, POUR_LINE_MAX_HOLD_MS],
    hideFrom: null,
  },
  1: {
    shapes: ["tube"],
    tol: 50,
    target: [300, 850],
    fullMs: [1_800, 2_200],
    window: [160, POUR_LINE_MAX_HOLD_MS],
    hideFrom: null,
  },
  2: {
    shapes: ["flare", "taper"],
    tol: 50,
    target: [300, 850],
    fullMs: [1_700, 2_100],
    window: [140, POUR_LINE_MAX_HOLD_MS],
    hideFrom: null,
  },
  3: {
    shapes: ["odd"],
    tol: 70,
    target: [600, 850],
    fullMs: [2_400, 3_000],
    window: [200, 450],
    hideFrom: 500,
  },
};

/** Ngưỡng chốt ở Thường cho độ rộng khoảng giữ đúng (đặc tả, mục Cách chấm). */
const MIN_WINDOW_NORMAL_MS = 160;
/** Vạch cách đáy / miệng bình (mép khoảng dung sai), đơn vị mức nước. */
const BOTTOM_GAP = 200;
const BRIM_GAP = 80;
/** Giới hạn thời gian rót hợp lý (ms). */
const HOLD_RANGE = [300, 3_000] as const;
const FULL_MAX_MS = 3_500;
/** Siêu khó: thời gian nước dâng khuất sau tấm che tới vạch (ms). */
const HIDDEN_RANGE = [300, 1_500] as const;

const SEEDS = 10_000;
/** Số seed quét từng ms mỗi mức (chia đều 10 000 seed cho 4 mức). */
const SCAN_SEEDS = SEEDS / 4;

const indexOf = (seed: number) => (seed * 7) % 40;

const hiddenMs = (p: PourLinePuzzle) =>
  p.hideFrom === null ? 0 : p.idealHoldMs - pourLineMsToReach(p.vessel, p.flow, p.hideFrom);

/** Tốc độ dâng ở vạch so với tốc độ dâng trung bình từ đáy tới vạch, |ln| (0 = ống thẳng). */
function irregularity(p: PourLinePuzzle): number {
  const w = p.vessel[Math.floor(p.target / POUR_LINE_SLICE_H)] as number;
  const avg = pourLineVolumeAt(p.vessel, p.target) / p.target;
  return Math.abs(Math.log(avg / w));
}

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pour-line", { timeout: 120_000 }, () => {
  it("tất định: cùng (seed, index, độ khó) → cùng câu đố, không dùng Math.random/Date.now", () => {
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random bị gọi");
    });
    vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("Date.now bị gọi");
    });
    for (const d of DIFFICULTIES) {
      for (let seed = 0; seed < SEEDS; seed++) {
        const i = indexOf(seed);
        expect(pourLine.generate(seed, i, d)).toEqual(pourLine.generate(seed, i, d));
      }
    }
    const forward = Array.from({ length: 20 }, (_, i) => pourLine.generate(42, i, 3));
    const backward = Array.from({ length: 20 }, (_, i) => pourLine.generate(42, 19 - i, 3));
    expect(backward.reverse()).toEqual(forward);
  });

  it("đúng MỘT khoảng giữ tay liền được chấm đúng, levelAt đơn điệu (quét từng ms, 10.000 seed chia đều 4 mức)", () => {
    // Gom lỗi rồi so một lần: gọi expect hàng triệu lần quá chậm.
    const errors: string[] = [];
    for (const d of DIFFICULTIES) {
      for (let seed = 0; seed < SCAN_SEEDS; seed++) {
        const p = pourLine.generate(seed, indexOf(seed), d);
        const tag = `d${d} seed ${seed}`;
        let prev = -1;
        let runs = 0;
        let inRun = false;
        let first = -1;
        let last = -1;
        // Quá fullMs mức nước kẹt ở 1 000 (kiểm dưới), nên quét tới fullMs + 1 là đủ.
        for (let t = 0; t <= p.fullMs + 1; t++) {
          const level = pourLineLevelAt(p, t);
          if (level < prev) errors.push(`${tag}: mức nước giảm tại ${t} ms`);
          prev = level;
          const ok = pourLine.check(p, t);
          if (ok && !inRun) {
            runs++;
            if (first < 0) first = t;
          }
          if (ok) last = t;
          inRun = ok;
        }
        if (runs !== 1) errors.push(`${tag}: ${runs} khoảng đúng`);
        if (first !== p.holdMinMs || last !== p.holdMaxMs) {
          errors.push(`${tag}: khoảng đúng [${first}, ${last}] ≠ [${p.holdMinMs}, ${p.holdMaxMs}]`);
        }
        if (pourLineLevelAt(p, POUR_LINE_MAX_HOLD_MS) !== POUR_LINE_HEIGHT) {
          errors.push(`${tag}: giữ tối đa mà chưa đầy`);
        }
        if (pourLine.check(p, POUR_LINE_MAX_HOLD_MS)) errors.push(`${tag}: tràn mà vẫn đúng`);
      }
    }
    expect(errors.slice(0, 10)).toEqual([]);
  });

  it("mọi câu đạt ràng buộc của mức (10.000 seed × 4 độ khó)", () => {
    const errors: string[] = [];
    for (const d of DIFFICULTIES) {
      const spec = SPEC[d];
      for (let seed = 0; seed < SEEDS; seed++) {
        const p = pourLine.generate(seed, indexOf(seed), d);
        const tag = `d${d} seed ${seed}`;
        const fail = (msg: string) => errors.push(`${tag}: ${msg}`);

        if (!spec.shapes.includes(p.shape)) fail(`kiểu bình ${p.shape}`);
        if (p.vessel.length !== POUR_LINE_SLICES) fail("số lát");
        if (!p.vessel.every((w) => Number.isInteger(w) && w >= 250 && w <= POUR_LINE_WIDTH_MAX)) {
          fail("bề rộng lát");
        }
        if (p.shape === "tube" && new Set(p.vessel).size !== 1) fail("ống không thẳng");
        if (!Number.isInteger(p.flow) || p.flow < 1) fail("flow");
        if (p.tol !== spec.tol) fail("tol");
        if (p.hideFrom !== spec.hideFrom) fail("hideFrom");
        if (p.target < spec.target[0] || p.target > spec.target[1] || p.target % 5 !== 0) {
          fail(`vạch ${p.target}`);
        }
        // Vạch không sát đáy, không sát miệng bình.
        if (p.target - p.tol < BOTTOM_GAP) fail("vạch sát đáy");
        if (p.target + p.tol > POUR_LINE_HEIGHT - BRIM_GAP) fail("vạch sát miệng");

        // Khoảng đúng: đủ rộng, chứa đáp án tham chiếu, hai mép đúng ngay tại biên.
        const width = p.holdMaxMs - p.holdMinMs + 1;
        if (width < spec.window[0] || width > spec.window[1]) fail(`khoảng đúng ${width} ms`);
        if (!(p.holdMinMs <= p.idealHoldMs && p.idealHoldMs <= p.holdMaxMs)) fail("ideal ngoài");
        if (!pourLine.check(p, p.idealHoldMs)) fail("ideal sai");
        if (!pourLine.check(p, p.holdMinMs) || !pourLine.check(p, p.holdMaxMs)) fail("mép sai");
        if (pourLine.check(p, p.holdMinMs - 1) || pourLine.check(p, p.holdMaxMs + 1)) {
          fail("ngoài mép vẫn đúng");
        }
        if (pourLineLevelAt(p, p.idealHoldMs) < p.target) fail("ideal chưa chạm vạch");
        if (pourLineLevelAt(p, p.idealHoldMs - 1) >= p.target) fail("ideal không phải ms đầu");

        // Thời gian rót hợp lý.
        if (p.idealHoldMs < HOLD_RANGE[0] || p.idealHoldMs > HOLD_RANGE[1])
          fail("giữ quá ngắn/dài");
        if (p.fullMs > FULL_MAX_MS || p.fullMs <= p.holdMaxMs) fail(`fullMs ${p.fullMs}`);
        if (pourLineLevelAt(p, p.fullMs) !== POUR_LINE_HEIGHT) fail("fullMs chưa đầy");
        if (pourLineLevelAt(p, p.fullMs - 1) === POUR_LINE_HEIGHT) fail("fullMs không phải ms đầu");
        // Tốc độ rót khớp thời gian rót đầy của mức (± 1 %: sai số làm tròn flow tới số nguyên).
        if (p.fullMs < spec.fullMs[0] * 0.99 || p.fullMs > spec.fullMs[1] * 1.01)
          fail("tốc độ rót");

        // Siêu khó: cả khoảng đúng nằm sau tấm che, nước dâng khuất đủ lâu nhưng không quá lâu.
        if (p.hideFrom !== null) {
          if (p.target - p.tol < p.hideFrom) fail("vạch không bị che");
          const h = hiddenMs(p);
          if (h < HIDDEN_RANGE[0] || h > HIDDEN_RANGE[1]) fail(`dâng khuất ${h} ms`);
        }
      }
    }
    expect(errors.slice(0, 10)).toEqual([]);
  });

  it(`khoảng giữ đúng ở Thường luôn ≥ ${MIN_WINDOW_NORMAL_MS} ms (lớn hơn độ trễ nhả tay 16–50 ms)`, () => {
    let min = Number.POSITIVE_INFINITY;
    for (let seed = 0; seed < SEEDS; seed++) {
      const p = pourLine.generate(seed, indexOf(seed), 1);
      min = Math.min(min, p.holdMaxMs - p.holdMinMs + 1);
    }
    expect(min).toBeGreaterThanOrEqual(MIN_WINDOW_NORMAL_MS);
    // Mọi mức: nửa khoảng đúng > 50 ms trễ nhả tay.
    for (const d of DIFFICULTIES) expect(SPEC[d].window[0] / 2).toBeGreaterThan(50);
  });

  it("độ khó tăng dần (đo được trên 10.000 seed mỗi mức)", () => {
    const window: number[] = [];
    const irregular: number[] = [];
    const hiddenShare: number[] = [];
    const shapes: Record<string, number>[] = [];
    for (const d of DIFFICULTIES) {
      const w: number[] = [];
      const irr: number[] = [];
      let hidden = 0;
      const count: Record<string, number> = {};
      for (let seed = 0; seed < SEEDS; seed++) {
        const p = pourLine.generate(seed, indexOf(seed), d);
        w.push(p.holdMaxMs - p.holdMinMs + 1);
        irr.push(irregularity(p));
        if (hiddenMs(p) > 0) hidden++;
        count[p.shape] = (count[p.shape] ?? 0) + 1;
      }
      window.push(mean(w));
      irregular.push(mean(irr));
      hiddenShare.push(hidden / SEEDS);
      shapes.push(count);
    }
    const [w0, w1, w2] = window as [number, number, number];
    const [i0, i1, i2, i3] = irregular as [number, number, number, number];
    // Mầm → Thường → Khó: khoảng giữ đúng hẹp dần (ms).
    expect(w0).toBeGreaterThan(w1);
    expect(w1).toBeGreaterThan(w2);
    // Thường → Khó: nước dâng không đều (ống thẳng = 0), Siêu khó vẫn không đều.
    expect(i0).toBe(0);
    expect(i1).toBe(0);
    expect(i2).toBeGreaterThan(0.15);
    expect(i3).toBeGreaterThan(0.1);
    // Khó → Siêu khó: mọi câu Siêu khó có đoạn nước dâng khuất, mức khác không có.
    expect(hiddenShare).toEqual([0, 0, 0, 1]);
    // Khó: loe và thót chia đều (lệch < 5 %).
    const kho = shapes[2] ?? {};
    expect(Math.abs((kho.flare ?? 0) - (kho.taper ?? 0)) / SEEDS).toBeLessThan(0.05);
  });

  it("bình lạ của Siêu khó luôn có chỗ phình và chỗ thắt", () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const v = pourLine.generate(seed, indexOf(seed), 3).vessel;
      let up = false;
      let down = false;
      for (let i = 1; i < v.length; i++) {
        if ((v[i] as number) > (v[i - 1] as number)) up = true;
        if ((v[i] as number) < (v[i - 1] as number)) down = true;
      }
      // Điểm điều khiển chênh ≥ 400; nội suy tại giữa lát làm hụt tối đa 2 × 750/20 ở hai đầu.
      expect(up && down && Math.max(...v) - Math.min(...v) >= 325).toBe(true);
    }
  });

  it("bình dự phòng của mọi mức luôn có vạch hợp lệ ở mọi tốc độ rót", () => {
    for (const d of DIFFICULTIES) {
      const [lo, hi] = SPEC[d].fullMs;
      for (let fullMs = lo; fullMs <= hi; fullMs++) {
        const fb = pourLineFallback(d, fullMs);
        expect(fb.candidates.length).toBeGreaterThan(0);
        expect(SPEC[d].shapes).toContain(fb.shape);
      }
    }
  });

  it("pourLineLevelAt: chỉ số nguyên, đổ đầy từng lát từ đáy lên", () => {
    const tube = { vessel: Array.from({ length: POUR_LINE_SLICES }, () => 500), flow: 250 };
    expect(pourLineLevelAt(tube, 0)).toBe(0);
    expect(pourLineLevelAt(tube, -5)).toBe(0);
    expect(pourLineLevelAt(tube, Number.NaN)).toBe(0);
    expect(pourLineLevelAt(tube, 1)).toBe(0);
    expect(pourLineLevelAt(tube, 2)).toBe(1);
    expect(pourLineLevelAt(tube, 100)).toBe(50);
    expect(pourLineLevelAt(tube, 100.9)).toBe(50);
    expect(pourLineLevelAt(tube, 1_999)).toBe(999);
    expect(pourLineLevelAt(tube, 2_000)).toBe(POUR_LINE_HEIGHT);
    expect(pourLineLevelAt(tube, 1e9)).toBe(POUR_LINE_HEIGHT);

    // Lát đáy rộng 1 000, các lát trên rộng 250: qua lát đáy nước dâng nhanh gấp 4.
    const flask = {
      vessel: [1_000, ...Array.from({ length: POUR_LINE_SLICES - 1 }, () => 250)],
      flow: 100,
    };
    expect(pourLineLevelAt(flask, 240)).toBe(24);
    expect(pourLineLevelAt(flask, 250)).toBe(25);
    expect(pourLineLevelAt(flask, 260)).toBe(29);
    expect(pourLineVolumeAt(flask.vessel, 25)).toBe(25_000);
    expect(pourLineVolumeAt(flask.vessel, 29)).toBe(26_000);
    expect(pourLineMsToReach(flask.vessel, flask.flow, 29)).toBe(260);

    for (const d of DIFFICULTIES) {
      for (let seed = 0; seed < 200; seed++) {
        const p = pourLine.generate(seed, 0, d);
        for (let t = 0; t <= p.fullMs; t += 37) {
          expect(Number.isInteger(pourLineLevelAt(p, t))).toBe(true);
        }
      }
    }
  });

  it("isAnswer() chỉ nhận số nguyên trong [0, giới hạn]", () => {
    expect(pourLine.isAnswer(0)).toBe(true);
    expect(pourLine.isAnswer(1_234)).toBe(true);
    expect(pourLine.isAnswer(POUR_LINE_MAX_HOLD_MS)).toBe(true);
    for (const bad of [
      -1,
      1.5,
      POUR_LINE_MAX_HOLD_MS + 1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "100",
      null,
      undefined,
      {},
      [500],
      true,
    ]) {
      expect(pourLine.isAnswer(bad)).toBe(false);
    }
  });

  it("hệ số không giảm khi lên mức, miễn trừ = thời gian giữ bắt buộc, không có hạn trả lời", () => {
    const m = pourLine.difficultyMultiplier;
    expect(m).toEqual({ 0: 1, 1: 1, 2: 1.4, 3: 2.55 });
    for (const d of DIFFICULTIES) {
      const p = pourLine.generate(7, 3, d);
      expect(pourLine.speedAllowanceMs?.(p, d)).toBe(p.holdMinMs);
    }
    expect(pourLine.answerWindowMs).toBeUndefined();
    expect(pourLine.durationMs).toBe(60_000);
  });
});
