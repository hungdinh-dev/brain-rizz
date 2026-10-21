import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import {
  HEAD_COUNT_LEVELS,
  HEAD_COUNT_MAX_IN_ROOM,
  HEAD_COUNT_MIN_IN_ROOM,
  HEAD_COUNT_OPTIONS,
  type HeadCountPuzzle,
  headCount,
  headCountEventStartMs,
  headCountInputAtMs,
  headCountTally,
} from "./head-count";

/** 2 500 câu mỗi mức × 4 mức = 10 000 câu. */
const PER_LEVEL = 2_500;

function puzzlesOf(d: Difficulty, count = PER_LEVEL, salt = 0): HeadCountPuzzle[] {
  return Array.from({ length: count }, (_, s) =>
    headCount.generate(s * 7919 + salt, (s + salt) % 37, d),
  );
}

const SAMPLES: Record<Difficulty, HeadCountPuzzle[]> = {
  0: puzzlesOf(0),
  1: puzzlesOf(1),
  2: puzzlesOf(2),
  3: puzzlesOf(3),
};

function finalCount(p: HeadCountPuzzle): number {
  return headCountTally(p).at(-1) as number;
}

function sum(p: HeadCountPuzzle, key: "in" | "out"): number {
  return p.events.reduce((a, e) => a + e[key], 0);
}

/** Thầy đi vào trừ thầy đi ra. */
function teacherNet(p: HeadCountPuzzle): number {
  return p.events.reduce((a, e) => a + (e.teacher === "in" ? 1 : e.teacher === "out" ? -1 : 0), 0);
}

/**
 * Tỉ lệ đúng kỳ vọng của một cách đoán: thẻ ghi số `guess` có mặt thì chạm thẻ đó, không có thì
 * chạm bừa một trong 4 thẻ (đúng 1/4). Đoán mò thuần = 25 %.
 */
function strategyRate(puzzles: readonly HeadCountPuzzle[], guess: (p: HeadCountPuzzle) => number) {
  let ok = 0;
  for (const p of puzzles) {
    const v = guess(p);
    if (v === finalCount(p)) ok += 1;
    else if (!p.options.includes(v)) ok += 1 / HEAD_COUNT_OPTIONS;
  }
  return ok / puzzles.length;
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

describe("head-count", () => {
  it("tất định: cùng (seed, index, độ khó) → cùng câu đố", () => {
    for (const d of DIFFICULTIES) {
      for (let s = 0; s < 500; s++) {
        expect(headCount.generate(s * 31 + 7, s % 13, d)).toEqual(
          headCount.generate(s * 31 + 7, s % 13, d),
        );
      }
    }
  });

  it("câu đố đa dạng: seed khác thì câu khác", () => {
    const minDistinct: Record<Difficulty, number> = { 0: 60, 1: 1_500, 2: 2_000, 3: 2_000 };
    for (const d of DIFFICULTIES) {
      const keys = new Set(SAMPLES[d].map((p) => JSON.stringify([p.start, p.events, p.options])));
      expect(keys.size).toBeGreaterThanOrEqual(minDistinct[d]);
    }
  });

  it("mọi câu có đúng MỘT đáp án = start + Σvào − Σra (10 000 câu, 2 500 mỗi mức)", () => {
    for (const d of DIFFICULTIES) {
      for (const p of SAMPLES[d]) {
        const answer = p.start + sum(p, "in") - sum(p, "out");
        expect(finalCount(p)).toBe(answer);
        const correct = p.options.map((_, i) => i).filter((i) => headCount.check(p, i));
        expect(correct).toEqual([p.answerIndex]);
        expect(p.options[p.answerIndex]).toBe(answer);
        expect(p.options.filter((v) => v === answer)).toHaveLength(1);
      }
    }
  });

  it("4 thẻ: số nguyên không âm, đôi một khác nhau, liên tiếp tăng dần, nhiễu lệch 1–3", () => {
    for (const d of DIFFICULTIES) {
      for (const p of SAMPLES[d]) {
        expect(p.options).toHaveLength(HEAD_COUNT_OPTIONS);
        const lo = p.options[0] as number;
        expect(p.options).toEqual([lo, lo + 1, lo + 2, lo + 3]);
        expect(new Set(p.options).size).toBe(HEAD_COUNT_OPTIONS);
        const answer = finalCount(p);
        for (const v of p.options) {
          expect(Number.isInteger(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeGreaterThanOrEqual(HEAD_COUNT_MIN_IN_ROOM);
          expect(v).toBeLessThanOrEqual(HEAD_COUNT_MAX_IN_ROOM);
          if (v !== answer) expect(Math.abs(v - answer)).toBeLessThanOrEqual(3);
        }
        // Luôn có thẻ lệch đúng 1 (lỗi đếm sót / đếm thừa một bạn hay gặp nhất).
        expect(p.options.includes(answer - 1) || p.options.includes(answer + 1)).toBe(true);
      }
    }
  });

  it("sĩ số không bao giờ âm hay quá số bàn, ở MỌI thời điểm; không lượt nào ra nhiều hơn số đang có", () => {
    for (const d of DIFFICULTIES) {
      for (const p of SAMPLES[d]) {
        let count = p.start;
        for (const e of p.events) {
          // Giữa một lượt vừa vào vừa ra: dù dòng ra đi trước hay dòng vào đi trước.
          expect(e.out).toBeLessThan(count);
          expect(count - e.out).toBeGreaterThanOrEqual(HEAD_COUNT_MIN_IN_ROOM);
          expect(count + e.in).toBeLessThanOrEqual(HEAD_COUNT_MAX_IN_ROOM);
          count += e.in - e.out;
          expect(count).toBeGreaterThanOrEqual(HEAD_COUNT_MIN_IN_ROOM);
          expect(count).toBeLessThanOrEqual(HEAD_COUNT_MAX_IN_ROOM);
        }
        const tally = headCountTally(p);
        expect(tally).toHaveLength(p.events.length + 1);
        expect(Math.min(...tally)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("lượt đúng luật của từng mức", () => {
    for (const d of DIFFICULTIES) {
      const level = HEAD_COUNT_LEVELS[d];
      for (const p of SAMPLES[d]) {
        expect(p.start).toBeGreaterThanOrEqual(level.start[0]);
        expect(p.start).toBeLessThanOrEqual(level.start[1]);
        expect(p.events.length).toBeGreaterThanOrEqual(level.events[0]);
        expect(p.events.length).toBeLessThanOrEqual(level.events[1]);
        expect(p.stepMs).toBe(level.stepMs);
        expect(p.showMs).toBe(level.showMs);

        let mixed = 0;
        let pairs = 0;
        let teacherInside = p.teacherAtStart;
        const teacherEvents = p.events.filter((e) => e.teacher !== undefined);
        for (const e of p.events) {
          for (const n of [e.in, e.out]) {
            expect(Number.isInteger(n)).toBe(true);
            expect(n).toBeGreaterThanOrEqual(0);
            expect(n).toBeLessThanOrEqual(level.maxGroup);
          }
          if (e.in > 0 && e.out > 0) {
            mixed++;
            // Vừa vào vừa ra thì lượt nào cũng đổi sĩ số: bỏ sót một dòng là sai.
            expect(e.in).not.toBe(e.out);
            expect(e.teacher).toBeUndefined();
          }
          if (e.in + e.out === 2 && (e.in === 0 || e.out === 0)) pairs++;
          if (e.teacher === undefined) {
            expect(e.in + e.out).toBeGreaterThan(0);
          } else {
            // Thầy đi luân phiên: đang trong lớp thì ra, ở ngoài thì vào; bạn đi cùng thì cùng hướng.
            expect(e.teacher).toBe(teacherInside ? "out" : "in");
            teacherInside = !teacherInside;
            if (e.teacher === "in") expect(e.out).toBe(0);
            else expect(e.in).toBe(0);
          }
        }
        expect(mixed).toBeGreaterThanOrEqual(level.mixed[0]);
        expect(mixed).toBeLessThanOrEqual(level.mixed[1]);
        expect(pairs).toBeGreaterThanOrEqual(level.minPairs);
        expect(teacherEvents.length).toBeGreaterThanOrEqual(level.teacher[0]);
        expect(teacherEvents.length).toBeLessThanOrEqual(level.teacher[1]);
        if (level.teacher[1] === 0) expect(p.teacherAtStart).toBe(false);
        if (d === 0) for (const e of p.events) expect(e.in + e.out).toBe(1);
      }
    }
  });

  it("Siêu khó: thầy luôn đi đúng một lượt, đếm cả thầy là luôn sai và thẻ bẫy thường có mặt", () => {
    let trapShown = 0;
    for (const p of SAMPLES[3]) {
      expect(p.events.filter((e) => e.teacher !== undefined)).toHaveLength(1);
      const withTeacher = finalCount(p) + teacherNet(p);
      expect(Math.abs(teacherNet(p))).toBe(1);
      expect(withTeacher).not.toBe(finalCount(p));
      if (p.options.includes(withTeacher)) trapShown++;
    }
    expect(trapShown / SAMPLES[3].length).toBeGreaterThan(0.65);
  });

  it("không có mẹo đoán: vị trí, số giữa, lấy số đầu, chỉ đếm vào, chỉ đếm ra, đếm cả thầy", () => {
    for (const d of DIFFICULTIES) {
      const sample = [...SAMPLES[d], ...puzzlesOf(d, 4_000, 104_729)];
      const n = sample.length;
      // Thẻ đúng không hay ở một vị trí (thẻ xếp tăng dần nên vị trí = thứ hạng của số).
      for (let i = 0; i < HEAD_COUNT_OPTIONS; i++) {
        const share = sample.filter((p) => p.answerIndex === i).length / n;
        expect(share).toBeGreaterThan(0.21);
        expect(share).toBeLessThan(0.29);
      }
      // Không hay là hai số giữa của 4 thẻ (đoán mò hai thẻ giữa = 50 %).
      const middle = sample.filter((p) => p.answerIndex === 1 || p.answerIndex === 2).length / n;
      expect(middle).toBeGreaterThan(0.45);
      expect(middle).toBeLessThan(0.55);
      // Các cách đếm sai không đúng hơn đoán mò (25 %) quá 5 điểm phần trăm.
      expect(strategyRate(sample, (p) => p.start)).toBeLessThan(0.3);
      expect(strategyRate(sample, (p) => p.start + sum(p, "in"))).toBeLessThan(0.3);
      expect(strategyRate(sample, (p) => p.start - sum(p, "out"))).toBeLessThan(0.3);
      if (d === 3) {
        expect(strategyRate(sample, (p) => finalCount(p) + teacherNet(p))).toBeLessThan(0.1);
      }
    }
  });

  it("khó dần theo độ khó (đo được)", () => {
    const stats = DIFFICULTIES.map((d) => {
      const s = SAMPLES[d];
      return {
        events: mean(s.map((p) => p.events.length)),
        minEvents: Math.min(...s.map((p) => p.events.length)),
        maxEvents: Math.max(...s.map((p) => p.events.length)),
        // Số lượt mỗi giây (nhịp lượt), không chồng giữa các mức vì `stepMs` cố định theo mức.
        pace: 1_000 / HEAD_COUNT_LEVELS[d].stepMs,
        // Số người qua cửa mỗi giây (kể cả thầy).
        figuresPerSec: mean(
          s.map(
            (p) =>
              (sum(p, "in") + sum(p, "out") + p.events.filter((e) => e.teacher).length) /
              ((p.events.length * p.stepMs) / 1_000),
          ),
        ),
        // Số phép cộng/trừ phải làm: mỗi dòng vào, mỗi dòng ra là một phép.
        ops: mean(
          s.map((p) => p.events.reduce((a, e) => a + (e.in > 0 ? 1 : 0) + (e.out > 0 ? 1 : 0), 0)),
        ),
        mixed: mean(s.map((p) => p.events.filter((e) => e.in > 0 && e.out > 0).length)),
        maxGroup: Math.max(...s.flatMap((p) => p.events.map((e) => Math.max(e.in, e.out)))),
        teacher: mean(s.map((p) => p.events.filter((e) => e.teacher).length)),
      };
    });
    for (let d = 1; d < stats.length; d++) {
      const prev = stats[d - 1] as (typeof stats)[number];
      const cur = stats[d] as (typeof stats)[number];
      expect(cur.minEvents).toBeGreaterThanOrEqual(prev.maxEvents);
      expect(cur.events).toBeGreaterThan(prev.events);
      expect(cur.pace).toBeGreaterThan(prev.pace);
      expect(cur.figuresPerSec).toBeGreaterThan(prev.figuresPerSec);
      expect(cur.ops).toBeGreaterThan(prev.ops);
      expect(cur.mixed).toBeGreaterThanOrEqual(prev.mixed);
      expect(cur.maxGroup).toBeGreaterThanOrEqual(prev.maxGroup);
      expect(cur.teacher).toBeGreaterThanOrEqual(prev.teacher);
    }
    // Mỗi mức thêm đúng một thứ mới: 2 bạn một lượt → vừa vào vừa ra → thầy giáo.
    expect(stats.map((s) => s.maxGroup)).toEqual([1, 2, 2, 2]);
    expect(stats[1]?.mixed).toBe(0);
    expect(stats[2]?.mixed).toBeGreaterThan(0);
    expect(stats.map((s) => s.teacher > 0)).toEqual([false, false, false, true]);
  });

  it("dòng thời gian và miễn trừ thưởng tốc độ", () => {
    for (const d of DIFFICULTIES) {
      for (const p of SAMPLES[d].slice(0, 200)) {
        const inputAt = headCountInputAtMs(p);
        expect(inputAt).toBe(p.showMs + p.events.length * p.stepMs);
        expect(headCountEventStartMs(p, 0)).toBe(p.showMs);
        expect(headCountEventStartMs(p, p.events.length)).toBe(inputAt);
        expect(headCount.speedAllowanceMs?.(p, d)).toBe(inputAt);
        expect(inputAt).toBeLessThan(headCount.durationMs / 8);
      }
    }
  });

  it("hệ số điểm không giảm khi lên mức, Thường = 1", () => {
    const m = headCount.difficultyMultiplier;
    expect(m?.[1]).toBe(1);
    for (let d = 1; d < DIFFICULTIES.length; d++) {
      expect(m?.[d as Difficulty]).toBeGreaterThanOrEqual(m?.[(d - 1) as Difficulty] as number);
    }
  });

  it("isAnswer() từ chối dữ liệu rác, check() từ chối chỉ số ngoài thẻ", () => {
    for (let i = 0; i < HEAD_COUNT_OPTIONS; i++) expect(headCount.isAnswer(i)).toBe(true);
    for (const bad of [
      -1,
      4,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "0",
      null,
      undefined,
      true,
      [],
      {},
      [0],
    ]) {
      expect(headCount.isAnswer(bad)).toBe(false);
    }
    const p = SAMPLES[1][0] as HeadCountPuzzle;
    expect(headCount.check(p, 4)).toBe(false);
    expect(headCount.check(p, -1)).toBe(false);
  });
});
