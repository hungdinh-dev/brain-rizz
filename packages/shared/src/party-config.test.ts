import { describe, expect, it } from "vitest";
import {
  initialJudgeState,
  type JudgeRound,
  type JudgeState,
  judgeAnswer,
  judgeBotAnswer,
} from "./answer-judge";
import { DIFFICULTIES, DIFFICULTY_MULTIPLIER, type Difficulty } from "./difficulty";
import { GAME_IDS, GAMES, getGame, isGameId } from "./games";
import { rankByRound } from "./match";
import {
  BASE_POINTS,
  DEFAULT_PARTY_CONFIG,
  DEFAULT_SCORING,
  enabledGameIds,
  FAST_ANSWER_MS,
  MAX_COMBO_MULTIPLIER,
  MAX_SPEED_BONUS,
  PLACEMENT_TOP_BONUS,
  parsePartyConfig,
  parseScoringConfig,
  parseScoringJson,
  type ScoringConfig,
  ScoringConfigSchema,
  SLOW_ANSWER_MS,
  STREAK_BONUS_PER_STEP,
  STREAK_THRESHOLD,
} from "./party-config";
import { comboMultiplier, gameMultiplier, placementPoints, pointsForCorrect } from "./scoring";

/** Cấu hình hợp lệ, khác mặc định ở mọi trường. */
const CUSTOM: ScoringConfig = {
  basePoints: 200,
  maxSpeedBonus: 80,
  fastAnswerMs: 1_000,
  slowAnswerMs: 5_000,
  streakThreshold: 2,
  streakBonusPerStep: 0.2,
  maxComboMultiplier: 2,
  difficultyMultiplier: [0.5, 1, 2, 3],
  gameMultipliers: { "odd-one-out": [1, 2, 3, 4] },
  placementTopBonus: [10, 5, 0],
};

describe("DEFAULT_SCORING / DEFAULT_PARTY_CONFIG (CR-019)", () => {
  it("mặc định = các hằng số của công thức chuẩn", () => {
    expect(DEFAULT_SCORING).toEqual({
      basePoints: BASE_POINTS,
      maxSpeedBonus: MAX_SPEED_BONUS,
      fastAnswerMs: FAST_ANSWER_MS,
      slowAnswerMs: SLOW_ANSWER_MS,
      streakThreshold: STREAK_THRESHOLD,
      streakBonusPerStep: STREAK_BONUS_PER_STEP,
      maxComboMultiplier: MAX_COMBO_MULTIPLIER,
      difficultyMultiplier: DIFFICULTIES.map((d) => DIFFICULTY_MULTIPLIER[d]),
      gameMultipliers: {},
      placementTopBonus: [...PLACEMENT_TOP_BONUS],
    });
    // Giá trị cũ không đổi.
    expect([BASE_POINTS, MAX_SPEED_BONUS, FAST_ANSWER_MS, SLOW_ANSWER_MS]).toEqual([
      100, 50, 1_500, 8_000,
    ]);
    expect([STREAK_THRESHOLD, STREAK_BONUS_PER_STEP, MAX_COMBO_MULTIPLIER]).toEqual([3, 0.1, 1.5]);
    expect(DEFAULT_PARTY_CONFIG).toEqual({
      version: 0,
      scoring: DEFAULT_SCORING,
      disabledGames: [],
    });
    expect(ScoringConfigSchema.safeParse(DEFAULT_SCORING).success).toBe(true);
  });

  it("mặc định bị đóng băng; hàm parse trả bản sao sửa được", () => {
    expect(Object.isFrozen(DEFAULT_SCORING)).toBe(true);
    expect(Object.isFrozen(DEFAULT_SCORING.difficultyMultiplier)).toBe(true);
    expect(Object.isFrozen(DEFAULT_PARTY_CONFIG.disabledGames)).toBe(true);
    const copy = parseScoringConfig(undefined);
    copy.difficultyMultiplier[0] = 4;
    copy.placementTopBonus[0] = 9;
    expect(DEFAULT_SCORING.difficultyMultiplier[0]).toBe(0.8);
    expect(DEFAULT_SCORING.placementTopBonus[0]).toBe(3);
  });
});

describe("parseScoringConfig — không tin DB, kiểm từng trường", () => {
  it("cấu hình hợp lệ giữ nguyên; JSON đi về giữ nguyên", () => {
    expect(parseScoringConfig(CUSTOM)).toEqual(CUSTOM);
    expect(parseScoringJson(JSON.stringify(CUSTOM))).toEqual(CUSTOM);
    expect(ScoringConfigSchema.parse(CUSTOM)).toEqual(CUSTOM);
  });

  it("dữ liệu rác bất kỳ → mặc định, không bao giờ ném", () => {
    const throwing = {
      get basePoints(): number {
        throw new Error("getter hỏng");
      },
    };
    const trap = new Proxy(
      {},
      {
        get() {
          throw new Error("proxy hỏng");
        },
        has() {
          throw new Error("proxy hỏng");
        },
        ownKeys() {
          throw new Error("proxy hỏng");
        },
        getOwnPropertyDescriptor() {
          throw new Error("proxy hỏng");
        },
      },
    );
    for (const raw of [undefined, null, 0, "x", true, [], [1, 2], {}, throwing, trap]) {
      expect(() => parseScoringConfig(raw)).not.toThrow();
      expect(() => parsePartyConfig(raw)).not.toThrow();
      expect(parseScoringConfig(raw)).toEqual(DEFAULT_SCORING);
      expect(parsePartyConfig(raw)).toEqual(DEFAULT_PARTY_CONFIG);
    }
  });

  it("mỗi trường sai → chỉ trường đó về mặc định, các trường khác giữ", () => {
    const bad: Record<keyof ScoringConfig, unknown[]> = {
      basePoints: [9, 1_001, 150.5, "100", null, Number.NaN],
      maxSpeedBonus: [-1, 501, 2.5, Number.POSITIVE_INFINITY],
      fastAnswerMs: [-1, 10_001, 0.5],
      slowAnswerMs: [30_001, 1.5, "5000"],
      streakThreshold: [0, 11, 2.5],
      streakBonusPerStep: [-0.1, 1.01, "0.1"],
      maxComboMultiplier: [0.99, 5.01, Number.NaN],
      difficultyMultiplier: [[1, 1, 1], [0, 1, 1, 1], [1, 1, 1, 5.1], [1, 1, 1, "2"], {}],
      gameMultipliers: ["x", [1, 2, 3, 4], 5],
      placementTopBonus: [
        [1, 1],
        [1, 1, 51],
        [-1, 0, 0],
        [1, 1, 1.5],
      ],
    };
    for (const [key, values] of Object.entries(bad) as [keyof ScoringConfig, unknown[]][]) {
      for (const value of values) {
        const parsed = parseScoringConfig({ ...CUSTOM, [key]: value });
        expect(parsed, `${key} = ${JSON.stringify(value)}`).toEqual({
          ...CUSTOM,
          [key]: key === "gameMultipliers" ? {} : DEFAULT_SCORING[key],
        });
      }
      // Thiếu trường cũng vậy.
      const { [key]: _, ...missing } = CUSTOM;
      expect(parseScoringConfig(missing)).toEqual({
        ...CUSTOM,
        [key]: key === "gameMultipliers" ? {} : DEFAULT_SCORING[key],
      });
    }
  });

  it("slowAnswerMs ≤ fastAnswerMs → cả hai về mặc định; schema của form cũng từ chối", () => {
    for (const slow of [CUSTOM.fastAnswerMs, CUSTOM.fastAnswerMs - 1]) {
      const raw = { ...CUSTOM, slowAnswerMs: slow };
      expect(parseScoringConfig(raw)).toEqual({
        ...CUSTOM,
        fastAnswerMs: FAST_ANSWER_MS,
        slowAnswerMs: SLOW_ANSWER_MS,
      });
      expect(ScoringConfigSchema.safeParse(raw).success).toBe(false);
    }
    // fastAnswerMs sai về mặc định (1 500) làm slow (1 200) ≤ fast → cả hai về mặc định.
    expect(parseScoringConfig({ ...CUSTOM, fastAnswerMs: -5, slowAnswerMs: 1_200 })).toMatchObject({
      fastAnswerMs: FAST_ANSWER_MS,
      slowAnswerMs: SLOW_ANSWER_MS,
    });
  });

  it("gameMultipliers: bỏ id lạ (kể cả khoá prototype) và bộ số sai, giữ phần hợp lệ", () => {
    const raw = JSON.parse(
      JSON.stringify({
        ...CUSTOM,
        gameMultipliers: {
          balance: [1, 1.5, 2, 2.5],
          "odd-one-out": [1, 2, 3],
          tetris: [1, 1, 1, 1],
          constructor: [1, 1, 1, 1],
          "aim-trainer": [0.5, 0.5, 0.5, 0],
        },
      }).replace('"tetris"', '"__proto__"'),
    );
    const parsed = parseScoringConfig(raw);
    expect(parsed.gameMultipliers).toEqual({ balance: [1, 1.5, 2, 2.5] });
    expect(Object.keys(parsed.gameMultipliers)).toEqual(["balance"]);
    // Form admin: id lạ bị từ chối.
    expect(
      ScoringConfigSchema.safeParse({ ...CUSTOM, gameMultipliers: { tetris: [1, 1, 1, 1] } })
        .success,
    ).toBe(false);
  });

  it("parseScoringJson: JSON hỏng hoặc rỗng → mặc định", () => {
    for (const json of ["", "{", "null", "[]", '"abc"', "42"]) {
      expect(parseScoringJson(json)).toEqual(DEFAULT_SCORING);
    }
    expect(parseScoringJson('{"basePoints":300}')).toEqual({ ...DEFAULT_SCORING, basePoints: 300 });
  });
});

describe("parsePartyConfig / enabledGameIds", () => {
  it("version sai → 0; disabledGames bỏ id lạ, bỏ trùng", () => {
    const parsed = parsePartyConfig({
      version: 7,
      scoring: CUSTOM,
      disabledGames: ["balance", "tetris", 3, "balance", "constructor", "aim-trainer"],
    });
    expect(parsed).toEqual({
      version: 7,
      scoring: CUSTOM,
      disabledGames: ["balance", "aim-trainer"].sort(
        (a, b) => GAME_IDS.indexOf(a as never) - GAME_IDS.indexOf(b as never),
      ),
    });
    for (const version of [-1, 1.5, "3", null, 2 ** 31]) {
      expect(parsePartyConfig({ version, scoring: CUSTOM }).version).toBe(0);
    }
    expect(parsePartyConfig({ version: 3, disabledGames: "balance" }).disabledGames).toEqual([]);
    // scoring sai từng trường cũng về mặc định từng trường.
    expect(parsePartyConfig({ version: 1, scoring: { basePoints: 300 } }).scoring).toEqual({
      ...DEFAULT_SCORING,
      basePoints: 300,
    });
  });

  it("enabledGameIds: GAME_IDS trừ game tắt; còn < 2 game thì trả cả danh mục", () => {
    expect(enabledGameIds([])).toEqual(GAME_IDS);
    const off = ["balance", "odd-one-out", "tetris"];
    expect(enabledGameIds(off)).toEqual(GAME_IDS.filter((id) => !off.includes(id)));
    expect(enabledGameIds(GAME_IDS.slice(2))).toEqual(GAME_IDS.slice(0, 2));
    expect(enabledGameIds(GAME_IDS.slice(1))).toEqual(GAME_IDS);
    expect(enabledGameIds(GAME_IDS)).toEqual(GAME_IDS);
  });

  it("isGameId không nhận khoá của prototype", () => {
    for (const key of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(isGameId(key)).toBe(false);
    }
    expect(isGameId("balance")).toBe(true);
  });
});

describe("placementPoints — co giãn theo số người (CR-018)", () => {
  const table = (n: number, bonus?: readonly number[]) =>
    Array.from({ length: n }, (_, rank) => placementPoints(rank, n, bonus));

  it("12, 8, 2 người theo bảng của chủ dự án", () => {
    expect(table(12)).toEqual([15, 13, 11, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(table(8)).toEqual([11, 9, 7, 5, 4, 3, 2, 1]);
    expect(table(2)).toEqual([5, 3]);
  });

  it("mọi số người 2…12: giảm dần nghiêm ngặt, ai cũng có điểm; từ 4 người hạng cuối 1 điểm", () => {
    for (let n = 2; n <= 12; n++) {
      const t = table(n);
      for (let r = 1; r < n; r++) expect(t[r]).toBeLessThan(t[r - 1] as number);
      expect(t.at(-1)).toBe(n >= 4 ? 1 : 1 + (PLACEMENT_TOP_BONUS[n - 1] ?? 0));
    }
  });

  it("hoà hạng thì cùng điểm; thưởng top tuỳ chỉnh", () => {
    const ranked = rankByRound([
      { id: "a", roundScore: 300 },
      { id: "b", roundScore: 300 },
      { id: "c", roundScore: 100 },
      ...Array.from({ length: 9 }, (_, i) => ({ id: `z${i}`, roundScore: 0 })),
    ]);
    const points = ranked.map((r) => placementPoints(r.rank, ranked.length));
    expect(points.slice(0, 3)).toEqual([15, 15, 11]);
    // 9 người cùng 0 điểm → cùng hạng 3 (index) → cùng 9 điểm.
    expect(new Set(points.slice(3))).toEqual(new Set([9]));
    expect(table(4, [10, 5, 0])).toEqual([14, 8, 2, 1]);
    expect(table(3, [])).toEqual([3, 2, 1]);
  });
});

describe("gameMultiplier / pointsForCorrect / comboMultiplier với cấu hình (CR-019)", () => {
  const declared = { id: "x", difficultyMultiplier: { 0: 0.7, 1: 1.1, 2: 1.6, 3: 2.2 } };

  it("thứ tự ưu tiên: ghi đè admin → hệ số game → hệ số chung của cấu hình", () => {
    const scoring = {
      ...CUSTOM,
      gameMultipliers: { x: [4, 4, 4, 4] as ScoringConfig["difficultyMultiplier"] },
    };
    expect(gameMultiplier(declared, 2, scoring)).toBe(4);
    expect(gameMultiplier(declared, 2, CUSTOM)).toBe(1.6);
    expect(gameMultiplier({ id: "y" }, 2, CUSTOM)).toBe(2);
    expect(gameMultiplier({}, 3, CUSTOM)).toBe(3);
    // Không truyền cấu hình: như trước CR-019.
    expect(gameMultiplier(declared, 2)).toBe(1.6);
    expect(gameMultiplier({}, 3)).toBe(DIFFICULTY_MULTIPLIER[3]);
    // Giá trị sai ở mỗi tầng bị bỏ qua.
    const broken = {
      ...CUSTOM,
      difficultyMultiplier: [0, 0, 0, 0] as ScoringConfig["difficultyMultiplier"],
      gameMultipliers: { x: [0, Number.NaN, -1, 0] as ScoringConfig["difficultyMultiplier"] },
    };
    expect(gameMultiplier(declared, 1, broken)).toBe(1.1);
    expect(gameMultiplier({}, 1, broken)).toBe(DIFFICULTY_MULTIPLIER[1]);
    // Game thật: ghi đè theo id.
    const odd = getGame("odd-one-out");
    for (const d of DIFFICULTIES) expect(gameMultiplier(odd, d, CUSTOM)).toBe(d + 1);
  });

  it("pointsForCorrect dùng điểm gốc, thưởng tốc độ, hệ số chung và combo của cấu hình", () => {
    // Nhanh: trọn thưởng 80; (200 × 2 + 80) × 1 = 480.
    expect(pointsForCorrect({ difficulty: 2, answerMs: 500, streak: 0 }, CUSTOM)).toBe(480);
    // Giữa khoảng 1 000 → 5 000: 3 000 ms → thưởng 40.
    expect(pointsForCorrect({ difficulty: 1, answerMs: 3_000, streak: 0 }, CUSTOM)).toBe(240);
    // Chậm: không thưởng; chuỗi 1 trước đó với ngưỡng 2 → × 1,2.
    expect(pointsForCorrect({ difficulty: 1, answerMs: 9_000, streak: 1 }, CUSTOM)).toBe(240);
    expect(comboMultiplier(0, CUSTOM)).toBe(1);
    expect(comboMultiplier(1, CUSTOM)).toBeCloseTo(1.2, 10);
    expect(comboMultiplier(100, CUSTOM)).toBe(2);
    // Hệ số truyền vào vẫn thắng hệ số chung của cấu hình.
    expect(
      pointsForCorrect({ difficulty: 0, answerMs: 9_000, streak: 0, multiplier: 1.5 }, CUSTOM),
    ).toBe(300);
  });

  it("không truyền cấu hình = truyền DEFAULT_SCORING = cấu hình đọc lại từ JSON mặc định", () => {
    const roundTrip = parseScoringJson(JSON.stringify(DEFAULT_SCORING));
    for (const difficulty of DIFFICULTIES) {
      for (const answerMs of [0, 1_000, 2_345, 6_789, 30_000]) {
        for (let streak = 0; streak <= 8; streak++) {
          const input = { difficulty, answerMs, streak, allowanceMs: 300 };
          const base = pointsForCorrect(input);
          expect(pointsForCorrect(input, DEFAULT_SCORING)).toBe(base);
          expect(pointsForCorrect(input, roundTrip)).toBe(base);
        }
      }
    }
  });
});

describe("judgeAnswer / judgeBotAnswer với cấu hình (CR-019)", () => {
  const round: JudgeRound = {
    playing: true,
    round: 1,
    gameId: "odd-one-out",
    seed: 777,
    startAt: 100_000,
    endsAt: 160_000,
  };
  const d: Difficulty = 2;
  const right = (i: number) => GAMES["odd-one-out"].generate(round.seed, i, d).oddIndex;

  /** Trả lời đúng 4 câu liên tiếp, mỗi câu sau 2 s; trả về điểm từng câu. */
  function play(scoring?: ScoringConfig, bot = false) {
    let state: JudgeState = initialJudgeState();
    const points: number[] = [];
    for (let i = 0; i < 4; i++) {
      const now = (state.shownAt ?? round.startAt) + 2_000;
      const j = bot
        ? judgeBotAnswer(round, d, state, { index: i, correct: true }, now, scoring)
        : judgeAnswer(round, d, state, { round: 1, index: i, answer: right(i) }, now, scoring);
      points.push(j.outcome?.points ?? -1);
      state = j.next;
    }
    return points;
  }

  it("điểm theo cấu hình tuỳ chỉnh; người và bot cùng điểm", () => {
    // odd-one-out bị ghi đè hệ số [1, 2, 3, 4] → Khó × 3. 2 000 ms trong khoảng 1 000 → 5 000
    // → thưởng 80 × 3/4 = 60. (200 × 3 + 60) × combo 1 / 1,2 / 1,4 / 1,6.
    const expected = [660, 792, 924, 1_056];
    expect(play(CUSTOM)).toEqual(expected);
    expect(play(CUSTOM, true)).toEqual(expected);
  });

  it("Luyện tập / Kiểm tra não không truyền cấu hình → đúng điểm như trước", () => {
    const game = getGame("odd-one-out");
    const legacy = [0, 1, 2, 3].map((streak) =>
      pointsForCorrect({
        difficulty: d,
        answerMs: 2_000,
        streak,
        multiplier: gameMultiplier(game, d),
      }),
    );
    expect(play()).toEqual(legacy);
    expect(play(DEFAULT_SCORING)).toEqual(legacy);
    expect(play(undefined, true)).toEqual(legacy);
  });
});
