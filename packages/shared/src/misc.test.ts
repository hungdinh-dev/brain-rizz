import { describe, expect, it } from "vitest";
import { estimateClock } from "./clock";
import { createRng } from "./rng";
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  ROOM_CODE_LENGTH,
} from "./room-code";
import { BASE_POINTS, MAX_SPEED_BONUS, placementPoints, pointsForCorrect } from "./scoring";

describe("room-code", () => {
  it("sinh mã hợp lệ", () => {
    const r = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const code = generateRoomCode(r.next);
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect(isValidRoomCode(code)).toBe(true);
    }
  });

  it("chuẩn hoá mã người dùng gõ", () => {
    expect(normalizeRoomCode(" ab-cd ")).toBe("ABCD");
    expect(isValidRoomCode("AB0D")).toBe(false);
  });
});

describe("scoring", () => {
  it("trả lời nhanh được trọn thưởng tốc độ", () => {
    expect(pointsForCorrect({ difficulty: 1, answerMs: 500, streak: 0 })).toBe(
      BASE_POINTS + MAX_SPEED_BONUS,
    );
  });

  it("trả lời chậm không có thưởng tốc độ", () => {
    expect(pointsForCorrect({ difficulty: 1, answerMs: 20_000, streak: 0 })).toBe(BASE_POINTS);
  });

  it("combo bắt đầu từ câu đúng thứ 3 liên tiếp", () => {
    const slow = { difficulty: 1 as const, answerMs: 20_000 };
    expect(pointsForCorrect({ ...slow, streak: 1 })).toBe(100);
    expect(pointsForCorrect({ ...slow, streak: 2 })).toBe(110);
    expect(pointsForCorrect({ ...slow, streak: 3 })).toBe(120);
  });

  it("điểm thứ hạng giảm dần", () => {
    expect(placementPoints(0)).toBeGreaterThan(placementPoints(1));
    expect(placementPoints(20)).toBe(0);
  });
});

describe("clock", () => {
  it("chọn mẫu có RTT nhỏ nhất", () => {
    const est = estimateClock([
      { t0: 0, t1: 200, serverTime: 1_100 },
      { t0: 1_000, t1: 1_040, serverTime: 2_020 },
    ]);
    expect(est.rtt).toBe(40);
    expect(est.offset).toBe(1_000);
  });
});
