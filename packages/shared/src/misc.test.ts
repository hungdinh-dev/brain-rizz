import { describe, expect, it } from "vitest";
import { estimateClock } from "./clock";
import { CHARACTER_IDS, isCharacterId } from "./constants";
import { DIFFICULTIES, DIFFICULTY_MULTIPLIER, type Difficulty } from "./difficulty";
import {
  EmptyPayloadSchema,
  JoinOptionsSchema,
  NudgeDifficultySchema,
  PickGameSchema,
  SetDifficultySchema,
  SetPickModeSchema,
  SetProfileSchema,
  SetRoundsSchema,
  VoteGameSchema,
} from "./protocol";
import { createRng } from "./rng";
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  ROOM_CODE_LENGTH,
} from "./room-code";
import {
  BASE_POINTS,
  comboMultiplier,
  FAST_ANSWER_MS,
  gameMultiplier,
  gameSpeedAllowanceMs,
  MAX_COMBO_MULTIPLIER,
  MAX_SPEED_BONUS,
  placementPoints,
  pointsForCorrect,
  SLOW_ANSWER_MS,
} from "./scoring";

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

  it(`combo có trần × ${MAX_COMBO_MULTIPLIER}: từ câu đúng liên tiếp thứ 7 không tăng nữa`, () => {
    const slow = { difficulty: 1 as const, answerMs: 20_000 };
    expect(pointsForCorrect({ ...slow, streak: 5 })).toBe(140);
    expect(pointsForCorrect({ ...slow, streak: 6 })).toBe(150);
    expect(pointsForCorrect({ ...slow, streak: 7 })).toBe(150);
    expect(pointsForCorrect({ ...slow, streak: 19 })).toBe(150); // trước CR-006: 280
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(1000)).toBe(MAX_COMBO_MULTIPLIER);
  });

  it("không truyền hệ số / miễn trừ: điểm giữ nguyên như trước CR-006, chỉ khác phần trần combo", () => {
    // Công thức cũ (trước CR-006), chép lại để so.
    const legacy = (difficulty: Difficulty, answerMs: number, streak: number) => {
      const t = Math.min(Math.max(answerMs, FAST_ANSWER_MS), SLOW_ANSWER_MS);
      const speed = Math.round(
        (MAX_SPEED_BONUS * (SLOW_ANSWER_MS - t)) / (SLOW_ANSWER_MS - FAST_ANSWER_MS),
      );
      const combo = 1 + Math.max(0, streak - 1) * 0.1;
      return Math.round((BASE_POINTS * DIFFICULTY_MULTIPLIER[difficulty] + speed) * combo);
    };
    for (const difficulty of DIFFICULTIES) {
      for (const answerMs of [-5_000, 0, 1_000, 1_500, 2_345, 4_000, 6_789, 8_000, 30_000]) {
        for (let streak = 0; streak <= 5; streak++) {
          const input = { difficulty, answerMs, streak };
          expect(pointsForCorrect(input)).toBe(legacy(difficulty, answerMs, streak));
          // Truyền đúng giá trị mặc định cũng ra cùng kết quả.
          expect(
            pointsForCorrect({
              ...input,
              multiplier: DIFFICULTY_MULTIPLIER[difficulty],
              allowanceMs: 0,
            }),
          ).toBe(legacy(difficulty, answerMs, streak));
        }
      }
    }
  });

  it("miễn trừ thời gian được trừ trước khi tính thưởng tốc độ", () => {
    const base = { difficulty: 1 as const, streak: 0 };
    // 4,5 s − 3 s miễn trừ = 1,5 s → trọn thưởng.
    expect(pointsForCorrect({ ...base, answerMs: 4_500, allowanceMs: 3_000 })).toBe(
      BASE_POINTS + MAX_SPEED_BONUS,
    );
    expect(pointsForCorrect({ ...base, answerMs: 4_500 })).toBeLessThan(
      BASE_POINTS + MAX_SPEED_BONUS,
    );
    // Phần tuyến tính dịch đúng bằng miễn trừ.
    expect(pointsForCorrect({ ...base, answerMs: 6_000, allowanceMs: 1_000 })).toBe(
      pointsForCorrect({ ...base, answerMs: 5_000 }),
    );
    // Miễn trừ lớn hơn thời gian trả lời: coi như trả lời tức thì, không âm, không vượt trọn thưởng.
    expect(pointsForCorrect({ ...base, answerMs: 2_000, allowanceMs: 5_000 })).toBe(
      BASE_POINTS + MAX_SPEED_BONUS,
    );
    // Quá chậm dù đã trừ miễn trừ thì vẫn hết thưởng.
    expect(pointsForCorrect({ ...base, answerMs: 20_000, allowanceMs: 3_000 })).toBe(BASE_POINTS);
  });

  it("hệ số riêng của game thay cho hệ số chung", () => {
    expect(pointsForCorrect({ difficulty: 3, answerMs: 20_000, streak: 0, multiplier: 2.4 })).toBe(
      240,
    );
    expect(pointsForCorrect({ difficulty: 0, answerMs: 500, streak: 0, multiplier: 0.6 })).toBe(
      60 + MAX_SPEED_BONUS,
    );
    // Hệ số nhân phần gốc, combo nhân cả tổng.
    expect(pointsForCorrect({ difficulty: 2, answerMs: 20_000, streak: 6, multiplier: 2 })).toBe(
      300,
    );
  });

  it("gameMultiplier: dùng hệ số game khai báo, sai hoặc thiếu thì về hệ số chung", () => {
    const custom = { difficultyMultiplier: { 0: 0.7, 1: 1, 2: 1.6, 3: 2.2 } } as const;
    expect(gameMultiplier(custom, 3)).toBe(2.2);
    expect(gameMultiplier({}, 3)).toBe(DIFFICULTY_MULTIPLIER[3]);
    for (const bad of [Number.NaN, 0, -1, Number.POSITIVE_INFINITY]) {
      const game = { difficultyMultiplier: { 0: bad, 1: bad, 2: bad, 3: bad } };
      for (const d of DIFFICULTIES) expect(gameMultiplier(game, d)).toBe(DIFFICULTY_MULTIPLIER[d]);
    }
  });

  it("gameSpeedAllowanceMs: tính theo câu đố + độ khó, kẹp về số hữu hạn ≥ 0", () => {
    const game = {
      speedAllowanceMs: (puzzle: { steps: number }, difficulty: Difficulty) =>
        puzzle.steps * 400 + difficulty * 100,
    };
    expect(gameSpeedAllowanceMs(game, { steps: 5 }, 2)).toBe(2_200);
    expect(gameSpeedAllowanceMs({}, { steps: 5 }, 2)).toBe(0);
    for (const bad of [Number.NaN, -1_000, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(gameSpeedAllowanceMs({ speedAllowanceMs: () => bad }, null, 1)).toBe(0);
    }
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

describe("nhân vật", () => {
  it("isCharacterId nhận đúng id hợp lệ", () => {
    for (const id of CHARACTER_IDS) expect(isCharacterId(id)).toBe(true);
    expect(isCharacterId("dragon")).toBe(false);
    expect(isCharacterId("")).toBe(false);
    expect(isCharacterId(0)).toBe(false);
    expect(isCharacterId(undefined)).toBe(false);
  });

  it("join không gửi avatar thì mặc định khoi; avatar lạ bị từ chối", () => {
    expect(JoinOptionsSchema.parse({ name: "An" }).avatar).toBe("khoi");
    expect(JoinOptionsSchema.safeParse({ name: "An", avatar: "dragon" }).success).toBe(false);
  });

  it("setProfile không tự điền mặc định cho trường không gửi", () => {
    expect(SetProfileSchema.parse({ name: "An" })).toEqual({ name: "An" });
    expect(SetProfileSchema.parse({ avatar: "mochi" })).toEqual({ avatar: "mochi" });
  });

  it("setProfile vẫn chặn giá trị sai như JoinOptions", () => {
    const bad = [
      { avatar: "dragon" },
      { avatar: 1 },
      { name: "" },
      { name: "   " },
      { name: "x".repeat(100) },
      { colorIndex: -1 },
      { colorIndex: 1.5 },
      { colorIndex: 999 },
      { difficulty: 4 },
      { difficulty: "1" },
      null,
      "khoi",
    ];
    for (const payload of bad) expect(SetProfileSchema.safeParse(payload).success).toBe(false);
  });

  it("setProfile bỏ trường lạ, không lọt sang server", () => {
    expect(SetProfileSchema.parse({ avatar: "bo", score: 9999, isHost: true })).toEqual({
      avatar: "bo",
    });
    expect(SetProfileSchema.parse({})).toEqual({});
  });
});

describe("giao thức luồng trận (CR-005)", () => {
  it("tin không nội dung chấp nhận {}, undefined, null và bỏ trường lạ", () => {
    expect(EmptyPayloadSchema.parse(undefined)).toEqual({});
    expect(EmptyPayloadSchema.parse(null)).toEqual({});
    expect(EmptyPayloadSchema.parse({ gameId: "odd-one-out", totalRounds: 3 })).toEqual({});
    expect(EmptyPayloadSchema.safeParse("start").success).toBe(false);
    expect(EmptyPayloadSchema.safeParse(1).success).toBe(false);
  });

  it("setRounds chỉ nhận số nguyên 1–10", () => {
    expect(SetRoundsSchema.safeParse({ totalRounds: 1 }).success).toBe(true);
    expect(SetRoundsSchema.safeParse({ totalRounds: 10 }).success).toBe(true);
    for (const totalRounds of [0, 11, 2.5, "3", null]) {
      expect(SetRoundsSchema.safeParse({ totalRounds }).success).toBe(false);
    }
  });

  it("voteGame nhận game hợp lệ hoặc null (bỏ phiếu)", () => {
    expect(VoteGameSchema.parse({ gameId: "odd-one-out" })).toEqual({ gameId: "odd-one-out" });
    expect(VoteGameSchema.parse({ gameId: null })).toEqual({ gameId: null });
    expect(VoteGameSchema.safeParse({ gameId: "tetris" }).success).toBe(false);
    expect(VoteGameSchema.safeParse({}).success).toBe(false);
  });

  it("pickGame, setPickMode, setDifficulty, nudgeDifficulty chặn giá trị lạ", () => {
    expect(PickGameSchema.safeParse({ gameId: null }).success).toBe(false);
    expect(PickGameSchema.safeParse({ gameId: "tetris" }).success).toBe(false);
    expect(SetPickModeSchema.safeParse({ mode: "wheel" }).success).toBe(true);
    expect(SetPickModeSchema.safeParse({ mode: "random" }).success).toBe(false);
    expect(SetDifficultySchema.safeParse({ difficulty: 3 }).success).toBe(true);
    expect(SetDifficultySchema.safeParse({ difficulty: 4 }).success).toBe(false);
    expect(NudgeDifficultySchema.safeParse({ playerId: "" }).success).toBe(false);
    expect(NudgeDifficultySchema.safeParse({ playerId: "x".repeat(65) }).success).toBe(false);
  });
});
