import { POUR_LINE_MAX_HOLD_MS, pourLine } from "@brain-rizz/shared";
import { describe, expect, it } from "vitest";
import { formatDelta, holdAnswer, sameClock } from "./hold";

describe("đo thời gian giữ tay", () => {
  it("làm tròn hiệu hai timeStamp thành số nguyên ms", () => {
    expect(holdAnswer(1000.2, 1840.7, 3000)).toBe(841);
    expect(holdAnswer(1000, 1000.4, 3000)).toBe(0);
  });

  it("nhả trước lúc nhấn hay số lạ thì gửi 0", () => {
    expect(holdAnswer(2000, 1500, 3000)).toBe(0);
    expect(holdAnswer(Number.NaN, 1500, 3000)).toBe(0);
  });

  it("giữ tới hay quá fullMs thì gửi đúng fullMs (tràn), không quá giới hạn của shared", () => {
    expect(holdAnswer(0, 2500, 2500)).toBe(2500);
    expect(holdAnswer(0, 9000, 2500)).toBe(2500);
    expect(holdAnswer(0, 50_000, 50_000)).toBe(POUR_LINE_MAX_HOLD_MS);
  });

  it("số gửi đi luôn là đáp án hợp lệ của shared; giữ đúng idealHoldMs thì đúng, tràn thì sai", () => {
    for (const difficulty of [0, 1, 2, 3] as const) {
      for (let i = 0; i < 100; i++) {
        const puzzle = pourLine.generate(777, i, difficulty);
        const ideal = holdAnswer(100, 100 + puzzle.idealHoldMs, puzzle.fullMs);
        expect(pourLine.isAnswer(ideal)).toBe(true);
        expect(pourLine.check(puzzle, ideal)).toBe(true);
        const full = holdAnswer(100, 100 + puzzle.fullMs + 37, puzzle.fullMs);
        expect(full).toBe(puzzle.fullMs);
        expect(pourLine.isAnswer(full)).toBe(true);
        expect(pourLine.check(puzzle, full)).toBe(false);
      }
    }
  });

  it("timeStamp khác gốc performance.now() (giờ epoch của trình duyệt cũ) thì không dùng", () => {
    expect(sameClock(5_000, 5_020)).toBe(true);
    expect(sameClock(1_760_000_000_000, 5_020)).toBe(false);
    expect(sameClock(0, 5_020)).toBe(false);
    expect(sameClock(Number.NaN, 5_020)).toBe(false);
  });
});

describe("số giây lệch lúc hiện đáp án", () => {
  it("dấu trừ thật, dấu thập phân theo ngôn ngữ", () => {
    expect(formatDelta(-240, "vi", "s")).toBe("−0,24 s");
    expect(formatDelta(316, "vi", "s")).toBe("+0,32 s");
    expect(formatDelta(-1234, "en", "s")).toBe("−1.23 s");
    expect(formatDelta(80, "en", "s")).toBe("+0.08 s");
  });
});
