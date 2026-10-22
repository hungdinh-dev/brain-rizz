import { describe, expect, it } from "vitest";
import { gameAnswerWindowMs } from "../answer-judge";
import {
  BOT_BASE_ACCURACY,
  BOT_BASE_SOLVE_MS,
  BOT_CHAT_CHANCE,
  BOT_CHAT_DELAY_MS,
  BOT_INTRO_READY_MS,
  BOT_MAX_ACCURACY,
  BOT_MAX_BASE_ACCURACY,
  BOT_MIN_REACTION_MS,
} from "../constants";
import { DIFFICULTIES, DIFFICULTY_MULTIPLIER } from "../difficulty";
import { GAME_IDS, type GameId, getGame } from "../games";
import { createRng, deriveSeed } from "../rng";
import { gameMultiplier, gameSpeedAllowanceMs } from "../scoring";
import {
  BOT_LEVEL_SPECS,
  BOT_LEVELS,
  BOT_MODEL_IDS,
  BOT_MODELS,
  type BotLevel,
  botAnswerContext,
  botDifficulty,
  botExpectedAccuracy,
  botExpectedSolveMs,
  botSeed,
  DEFAULT_BOT_MODEL_ID,
  getBotModel,
  isBotLevel,
  isBotModelId,
  planBasicAnswer,
  planBotAnswer,
  relativeAccuracy,
} from "./index";

/**
 * Game chơi được nhưng chưa có bảng Cân bằng trong đặc tả: bot dùng ước lượng chung
 * `BOT_BASE_SOLVE_MS × hệ số game + miễn trừ`. Thêm bảng Cân bằng thì khai báo `expectedSolveMs`
 * và bỏ game khỏi danh sách này. Hiện mọi game đã khai báo (Kẻ lạc đàn khai báo ước lượng chưa đo).
 */
const ESTIMATED_GAMES: readonly GameId[] = [];

/** Game chưa có tỉ lệ đúng trong bảng Cân bằng: bot dùng mức chung `BOT_BASE_ACCURACY`. */
const DEFAULT_ACCURACY_GAMES: readonly GameId[] = [];

const listOrNone = (ids: readonly string[]) => (ids.length > 0 ? ids.join(", ") : "không có");

/**
 * Game có thời gian một câu giảm khi lên mức (Thường → Khó → Siêu khó), kèm lý do từ đặc tả.
 * Mầm không so: Mầm theo trẻ 7 tuổi nên thường chậm hơn người lớn ở Thường.
 */
const NON_MONOTONIC: Readonly<Partial<Record<GameId, string>>> = {
  "rhythm-echo": "Khó và Siêu khó cùng trần 5 phách; Siêu khó khó nhờ nghịch phách, dung sai hẹp",
  "rule-gate": "Siêu khó đã đoán ra luật thì nhanh ngang Thường; khó ở tỉ lệ sai (~26 %)",
};

const SEEDS = [1, 42, 20_261_021, 0xdeadbeef, 0xffffffff];

describe("mức bot", () => {
  it("BOT_LEVELS và isBotLevel", () => {
    expect(BOT_LEVELS).toEqual([0, 1, 2, 3]);
    for (const level of BOT_LEVELS) expect(isBotLevel(level)).toBe(true);
    for (const bad of [-1, 4, 1.5, "1", null, undefined, Number.NaN]) {
      expect(isBotLevel(bad)).toBe(false);
    }
  });

  it("mỗi mức chơi đúng độ khó cùng số, thông số hợp lệ và mạnh dần", () => {
    for (const level of BOT_LEVELS) {
      const spec = BOT_LEVEL_SPECS[level];
      expect(botDifficulty(level)).toBe(level);
      expect(spec.timeFactor).toBeGreaterThan(0);
      expect(spec.accuracy).toBeGreaterThan(0);
      expect(spec.accuracy).toBeLessThan(1);
      if (level > 0) {
        const prev = BOT_LEVEL_SPECS[(level - 1) as BotLevel];
        expect(spec.timeFactor).toBeLessThanOrEqual(prev.timeFactor);
        expect(spec.accuracy).toBeGreaterThanOrEqual(prev.accuracy);
      }
    }
  });

  it("hằng số bot hợp lệ", () => {
    expect(BOT_BASE_SOLVE_MS).toBeGreaterThan(0);
    expect(BOT_BASE_ACCURACY).toBeGreaterThan(0);
    expect(BOT_BASE_ACCURACY).toBeLessThan(BOT_MAX_BASE_ACCURACY);
    expect(BOT_MAX_BASE_ACCURACY).toBeLessThan(BOT_MAX_ACCURACY);
    expect(BOT_MAX_ACCURACY).toBeLessThan(1);
    expect(BOT_MIN_REACTION_MS).toBe(600);
    expect(BOT_INTRO_READY_MS[0]).toBeLessThanOrEqual(BOT_INTRO_READY_MS[1]);
    expect(BOT_CHAT_DELAY_MS[0]).toBeLessThanOrEqual(BOT_CHAT_DELAY_MS[1]);
    expect(BOT_CHAT_CHANCE).toBeGreaterThan(0);
    expect(BOT_CHAT_CHANCE).toBeLessThan(1);
  });
});

describe("registry model bot", () => {
  it("mặc định là basic, id lạ cũng rơi về mặc định", () => {
    expect(DEFAULT_BOT_MODEL_ID).toBe("basic");
    expect(BOT_MODEL_IDS).toContain("basic");
    expect(getBotModel()).toBe(BOT_MODELS.basic);
    expect(getBotModel("basic")).toBe(BOT_MODELS.basic);
    expect(getBotModel("không-có")).toBe(BOT_MODELS[DEFAULT_BOT_MODEL_ID]);
    expect(isBotModelId("basic")).toBe(true);
    expect(isBotModelId("toString")).toBe(false);
    expect(isBotModelId(1)).toBe(false);
  });

  it("id của model khớp khoá đăng ký", () => {
    for (const id of BOT_MODEL_IDS) expect(BOT_MODELS[id].id).toBe(id);
  });
});

describe("thời gian dự kiến của bot", () => {
  it(`mọi game chơi được có expectedSolveMs, trừ game dùng ước lượng: ${listOrNone(ESTIMATED_GAMES)}`, () => {
    const estimated = GAME_IDS.filter((id) => getGame(id).expectedSolveMs === undefined);
    expect(estimated).toEqual([...ESTIMATED_GAMES]);
  });

  it.each(GAME_IDS.filter((id) => !ESTIMATED_GAMES.includes(id)))(
    "%s: số nguyên dương, không giảm từ Thường lên Siêu khó (trừ ngoại lệ có lý do)",
    (id) => {
      const table = getGame(id).expectedSolveMs;
      expect(table).toBeDefined();
      for (const d of DIFFICULTIES) {
        const value = table?.[d] ?? 0;
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
      const adult = [table?.[1] ?? 0, table?.[2] ?? 0, table?.[3] ?? 0];
      const monotonic = adult.every((v, i) => i === 0 || v >= (adult[i - 1] ?? 0));
      expect(monotonic).toBe(NON_MONOTONIC[id] === undefined);
    },
  );

  it("BOT_BASE_SOLVE_MS gần trung vị (thời gian ở Thường − miễn trừ) của các game đã khai báo", () => {
    const active = GAME_IDS.filter((id) => !ESTIMATED_GAMES.includes(id)).map((id) => {
      const game = getGame(id);
      let allowance = 0;
      for (let s = 0; s < 100; s++) {
        allowance += gameSpeedAllowanceMs(game, game.generate(s, s % 7, 1), 1);
      }
      return (game.expectedSolveMs?.[1] ?? 0) - allowance / 100;
    });
    active.sort((a, b) => a - b);
    const median = active[Math.floor(active.length / 2)] ?? 0;
    expect(Math.abs(BOT_BASE_SOLVE_MS - median)).toBeLessThanOrEqual(300);
  });

  it("dùng số game khai báo; số không hợp lệ hoặc thiếu thì dùng ước lượng chung", () => {
    const declared = getGame("balance");
    const puzzle = declared.generate(7, 0, 2);
    expect(botExpectedSolveMs(declared, puzzle, 2)).toBe(declared.expectedSolveMs?.[2]);

    for (const id of ESTIMATED_GAMES) {
      const game = getGame(id);
      for (const d of DIFFICULTIES) {
        const p = game.generate(7, 3, d);
        expect(botExpectedSolveMs(game, p, d)).toBe(
          BOT_BASE_SOLVE_MS * gameMultiplier(game, d) + gameSpeedAllowanceMs(game, p, d),
        );
      }
    }

    const broken = {
      expectedSolveMs: { 0: 0, 1: Number.NaN, 2: -5, 3: Number.POSITIVE_INFINITY },
      speedAllowanceMs: () => 1_000,
    };
    const missing = { speedAllowanceMs: () => 1_000 };
    for (const d of DIFFICULTIES) {
      for (const game of [broken, missing]) {
        expect(botExpectedSolveMs(game, null, d)).toBe(
          BOT_BASE_SOLVE_MS * DIFFICULTY_MULTIPLIER[d] + 1_000,
        );
      }
    }
  });
});

describe("tỉ lệ đúng chuẩn của game", () => {
  it(`mọi game chơi được có expectedAccuracy, trừ game dùng mức chung: ${listOrNone(DEFAULT_ACCURACY_GAMES)}`, () => {
    const fallback = GAME_IDS.filter((id) => getGame(id).expectedAccuracy === undefined);
    expect(fallback).toEqual([...DEFAULT_ACCURACY_GAMES]);
  });

  it.each(GAME_IDS.filter((id) => !DEFAULT_ACCURACY_GAMES.includes(id)))(
    `%s: trong (0, ${BOT_MAX_BASE_ACCURACY}], người lớn không đúng nhiều hơn khi lên mức (Thường → Siêu khó)`,
    (id) => {
      const table = getGame(id).expectedAccuracy;
      expect(table).toBeDefined();
      for (const d of DIFFICULTIES) {
        const value = table?.[d] ?? 0;
        expect(value).toBeGreaterThan(0);
        // Số lớn hơn trần bị `relativeAccuracy` kẹp nên vô nghĩa; Mầm "không có cách sai" thì khai
        // báo tỉ lệ chạm trượt ước lượng của trẻ (Luyện ngắm), không khai báo 1.
        expect(value).toBeLessThanOrEqual(BOT_MAX_BASE_ACCURACY);
        expect(botExpectedAccuracy(getGame(id), d)).toBe(value);
      }
      expect(table?.[2] ?? 0).toBeLessThanOrEqual(table?.[1] ?? 0);
      expect(table?.[3] ?? 0).toBeLessThanOrEqual(table?.[2] ?? 0);
    },
  );

  it("thiếu hoặc không hợp lệ thì dùng BOT_BASE_ACCURACY", () => {
    const broken = { expectedAccuracy: { 0: 0, 1: Number.NaN, 2: 1.2, 3: -0.5 } };
    for (const d of DIFFICULTIES) {
      expect(botExpectedAccuracy(broken, d)).toBe(BOT_BASE_ACCURACY);
      expect(botExpectedAccuracy({}, d)).toBe(BOT_BASE_ACCURACY);
    }
    // 1 hợp lệ ở đây (trả nguyên số khai báo); `relativeAccuracy` mới kẹp về BOT_MAX_BASE_ACCURACY.
    expect(botExpectedAccuracy({ expectedAccuracy: { 0: 1, 1: 1, 2: 1, 3: 1 } }, 2)).toBe(1);
  });
});

describe("relativeAccuracy: tỉ lệ đúng của mức quy theo game", () => {
  it("ở game chuẩn BOT_BASE_ACCURACY thì ra đúng số danh nghĩa của mức", () => {
    for (const level of BOT_LEVELS) {
      const { accuracy } = BOT_LEVEL_SPECS[level];
      expect(relativeAccuracy(accuracy, BOT_BASE_ACCURACY)).toBeCloseTo(accuracy, 12);
    }
    // Quyết định của chủ dự án: Dễ tương đương 78 % ở game chuẩn 90 %.
    expect(relativeAccuracy(BOT_LEVEL_SPECS[0].accuracy, 0.9)).toBeCloseTo(0.78, 12);
  });

  it("giữ tỉ số tỉ lệ sai so với người chuẩn", () => {
    // Siêu sai bằng 0,8 lần người chuẩn: Lật cặp ở Siêu khó chuẩn 68 % → 74,4 %.
    expect(relativeAccuracy(0.92, 0.68)).toBeCloseTo(0.744, 12);
    // Dễ sai gấp 2,2 lần: game có Mầm chuẩn 85 % → 67 %.
    expect(relativeAccuracy(0.78, 0.85)).toBeCloseTo(0.67, 12);
    // Danh nghĩa bằng mốc chung thì ra đúng tỉ lệ chuẩn của game.
    expect(relativeAccuracy(BOT_BASE_ACCURACY, 0.7)).toBeCloseTo(0.7, 12);
  });

  it(`kẹp trong [0, ${BOT_MAX_ACCURACY}]`, () => {
    expect(relativeAccuracy(0.78, 0.5)).toBe(0);
    expect(relativeAccuracy(1, 0.6)).toBe(BOT_MAX_ACCURACY);
    expect(relativeAccuracy(1, 1)).toBe(BOT_MAX_ACCURACY);
  });

  it(`tỉ lệ chuẩn trên ${BOT_MAX_BASE_ACCURACY} bị kẹp về ${BOT_MAX_BASE_ACCURACY} trước khi nhân hệ số sai`, () => {
    for (const level of BOT_LEVELS) {
      const { accuracy } = BOT_LEVEL_SPECS[level];
      const atCap = relativeAccuracy(accuracy, BOT_MAX_BASE_ACCURACY);
      for (const base of [0.985, 0.99, 0.999, 1]) {
        expect(relativeAccuracy(accuracy, base)).toBe(atCap);
      }
    }
    // Lỗi QA (Luyện ngắm khai báo Mầm = 1): trước khi kẹp, bot Dễ ra 99 % như bot Siêu.
    expect(relativeAccuracy(BOT_LEVEL_SPECS[0].accuracy, 1)).toBeCloseTo(0.956, 12);
    expect(relativeAccuracy(BOT_LEVEL_SPECS[3].accuracy, 1)).toBeCloseTo(0.984, 12);
  });

  it("mức cao hơn không bao giờ đúng ít hơn, ở mọi tỉ lệ chuẩn", () => {
    for (let base = 0.5; base <= 1; base += 0.01) {
      for (const level of BOT_LEVELS.slice(1)) {
        const prev = BOT_LEVEL_SPECS[(level - 1) as BotLevel].accuracy;
        expect(relativeAccuracy(BOT_LEVEL_SPECS[level].accuracy, base)).toBeGreaterThanOrEqual(
          relativeAccuracy(prev, base),
        );
      }
    }
  });
});

describe("bot Dễ yếu hơn hẳn bot Siêu", () => {
  const EASY = BOT_LEVEL_SPECS[0].accuracy;
  const EXPERT = BOT_LEVEL_SPECS[3].accuracy;
  /** Dễ sai ít nhất gấp đôi Siêu (đúng tỉ số là 2,2 / 0,8 = 2,75 khi không chạm sàn 0). */
  const MIN_ERROR_RATIO = 2;
  /** Siêu đúng hơn Dễ ít nhất 2,5 điểm phần trăm (thấp nhất 1,4 × (1 − 98 %) = 2,8 điểm). */
  const MIN_GAP = 0.025;

  function expectClearlyWeaker(base: number, where: string) {
    const easy = relativeAccuracy(EASY, base);
    const expert = relativeAccuracy(EXPERT, base);
    expect(easy, `${where}: Dễ chạm trần`).toBeLessThan(BOT_MAX_ACCURACY);
    expect(1 - easy, `${where}: Dễ sai chưa gấp đôi Siêu`).toBeGreaterThanOrEqual(
      MIN_ERROR_RATIO * (1 - expert),
    );
    expect(expert - easy, `${where}: Siêu chỉ hơn Dễ chút ít`).toBeGreaterThanOrEqual(MIN_GAP);
  }

  it.each(GAME_IDS)("%s: ở mọi độ khó, cùng tỉ lệ chuẩn của game", (id) => {
    for (const d of DIFFICULTIES) {
      expectClearlyWeaker(botExpectedAccuracy(getGame(id), d), `độ khó ${d}`);
    }
  });

  it("ở mọi tỉ lệ chuẩn từ 50 % tới 100 % (kể cả game khai báo quá trần)", () => {
    for (let i = 50; i <= 100; i++) expectClearlyWeaker(i / 100, `A = ${i} %`);
  });

  it("Luyện ngắm ở Mầm (lỗi QA): bot Dễ thật sự trượt, không đúng 99 %", () => {
    const N = 4_000;
    let correct = 0;
    for (let index = 0; index < N; index++) {
      const plan = planBotAnswer({
        level: 0,
        gameId: "aim-trainer",
        roundSeed: 2_026,
        botId: "easy",
        index,
      });
      if (plan.correct) correct++;
    }
    const target = relativeAccuracy(EASY, botExpectedAccuracy(getGame("aim-trainer"), 0));
    expect(target).toBeLessThan(0.93);
    expect(Math.abs(correct / N - target)).toBeLessThan(0.02);
  });
});

describe("kế hoạch trả lời", () => {
  it("tất định: cùng (seed vòng, mã bot, câu, mức) → cùng kế hoạch, ở mọi game", () => {
    for (const gameId of GAME_IDS) {
      for (const level of BOT_LEVELS) {
        for (const roundSeed of SEEDS) {
          for (let index = 0; index < 4; index++) {
            const input = { level, gameId, roundSeed, botId: "bot-1", index };
            const a = planBotAnswer(input);
            expect(planBotAnswer({ ...input })).toEqual(a);
            expect(planBotAnswer({ ...input, modelId: "basic" })).toEqual(a);
          }
        }
      }
    }
  });

  it("hai bot khác mã trong cùng vòng chơi khác nhau", () => {
    let differ = 0;
    for (let index = 0; index < 50; index++) {
      const base = { level: 1 as BotLevel, gameId: "balance", roundSeed: 99, index };
      const a = planBotAnswer({ ...base, botId: "bot-a" });
      const b = planBotAnswer({ ...base, botId: "bot-b" });
      if (a.delayMs !== b.delayMs || a.correct !== b.correct) differ++;
    }
    expect(differ).toBeGreaterThan(45);
  });

  it("RNG của bot không làm đổi câu đố (bất biến 1)", () => {
    for (const gameId of GAME_IDS) {
      const game = getGame(gameId);
      for (const level of BOT_LEVELS) {
        const difficulty = botDifficulty(level);
        for (const roundSeed of SEEDS) {
          const before = game.generate(roundSeed, 2, difficulty);
          planBotAnswer({ level, gameId, roundSeed, botId: "bot-1", index: 2 });
          expect(game.generate(roundSeed, 2, difficulty)).toEqual(before);
          expect(botSeed(roundSeed, "bot-1", 2)).not.toBe(deriveSeed(roundSeed, 2));
        }
      }
    }
  });

  it("botSeed là uint32 và đổi theo mã bot, câu, seed vòng", () => {
    const seeds = new Set<number>();
    for (const roundSeed of SEEDS) {
      for (const botId of ["bot-1", "bot-2", "a", ""]) {
        for (let index = 0; index < 10; index++) {
          const s = botSeed(roundSeed, botId, index);
          expect(Number.isInteger(s) && s >= 0 && s <= 0xffffffff).toBe(true);
          seeds.add(s);
        }
      }
    }
    expect(seeds.size).toBe(SEEDS.length * 4 * 10);
  });

  it(`delayMs là số nguyên ≥ miễn trừ + ${BOT_MIN_REACTION_MS} ms, ở mọi game và mức`, () => {
    for (const gameId of GAME_IDS) {
      const game = getGame(gameId);
      for (const level of BOT_LEVELS) {
        const difficulty = botDifficulty(level);
        for (const roundSeed of SEEDS) {
          for (let index = 0; index < 20; index++) {
            const { delayMs } = planBotAnswer({ level, gameId, roundSeed, botId: "b", index });
            const puzzle = game.generate(roundSeed, index, difficulty);
            const floor = gameSpeedAllowanceMs(game, puzzle, difficulty) + BOT_MIN_REACTION_MS;
            expect(Number.isInteger(delayMs)).toBe(true);
            expect(delayMs).toBeGreaterThanOrEqual(Math.round(floor));
          }
        }
      }
    }
  });

  it("ngữ cảnh lấy từ câu sinh lại ở độ khó của mức", () => {
    const gameId = "aim-trainer";
    const game = getGame(gameId);
    const ctx = botAnswerContext({ level: 2, gameId, roundSeed: 5, botId: "x", index: 3 });
    const puzzle = game.generate(5, 3, 2);
    expect(ctx.difficulty).toBe(2);
    expect(ctx.expectedSolveMs).toBe(game.expectedSolveMs?.[2]);
    expect(ctx.expectedAccuracy).toBe(game.expectedAccuracy?.[2]);
    expect(ctx.allowanceMs).toBe(gameSpeedAllowanceMs(game, puzzle, 2));
    expect(ctx.answerWindowMs).toBe(gameAnswerWindowMs(game, puzzle, 2));
    expect(ctx.answerWindowMs).toBeGreaterThan(0);
  });

  it("game lạ không ném lỗi: dùng ước lượng chung, tỉ lệ đúng chung, không miễn trừ, không hạn", () => {
    const ctx = botAnswerContext({
      level: 3,
      gameId: "không-có",
      roundSeed: 1,
      botId: "x",
      index: 0,
    });
    expect(ctx.expectedSolveMs).toBe(BOT_BASE_SOLVE_MS * DIFFICULTY_MULTIPLIER[3]);
    expect(ctx.expectedAccuracy).toBe(BOT_BASE_ACCURACY);
    expect(ctx.allowanceMs).toBe(0);
    expect(ctx.answerWindowMs).toBeUndefined();
    const plan = planBotAnswer({
      level: 3,
      gameId: "không-có",
      roundSeed: 1,
      botId: "x",
      index: 0,
    });
    expect(plan.delayMs).toBeGreaterThanOrEqual(BOT_MIN_REACTION_MS);
  });

  it.each([BOT_BASE_ACCURACY, 0.7, 0.98, 1])(
    "tỉ lệ đúng và trung vị thời gian khớp thông số của mức (game chuẩn %s)",
    (expectedAccuracy) => {
      const N = 20_000;
      const expectedSolveMs = 3_000;
      for (const level of BOT_LEVELS) {
        const spec = BOT_LEVEL_SPECS[level];
        const model = getBotModel();
        let correct = 0;
        const delays: number[] = [];
        for (let i = 0; i < N; i++) {
          const plan = model.planAnswer({
            gameId: "balance",
            difficulty: spec.difficulty,
            level,
            index: i,
            expectedSolveMs,
            expectedAccuracy,
            allowanceMs: 0,
            answerWindowMs: undefined,
            rng: createRng(botSeed(123, "acc", i)),
          });
          if (plan.correct) correct++;
          delays.push(plan.delayMs);
        }
        const target = relativeAccuracy(spec.accuracy, expectedAccuracy);
        expect(Math.abs(correct / N - target)).toBeLessThan(0.01);
        delays.sort((a, b) => a - b);
        const median = delays[N / 2] ?? 0;
        expect(median / (expectedSolveMs * spec.timeFactor)).toBeCloseTo(1, 1);
        // Nhiễu cắt ở ±3σ: không câu nào nhanh hơn ~0,47 hay chậm hơn ~2,1 lần.
        expect(delays[0]).toBeGreaterThanOrEqual(
          Math.floor(expectedSolveMs * spec.timeFactor * 0.47),
        );
        expect(delays[N - 1]).toBeLessThanOrEqual(
          Math.ceil(expectedSolveMs * spec.timeFactor * 2.12),
        );
      }
    },
  );

  it("planBasicAnswer không dưới miễn trừ + phản xạ kể cả khi thời gian dự kiến quá ngắn", () => {
    for (let i = 0; i < 1_000; i++) {
      const plan = planBasicAnswer(
        { expectedSolveMs: 100, expectedAccuracy: 0.9, allowanceMs: 2_500, rng: createRng(i) },
        { timeFactor: 0.8, accuracy: 0.9 },
      );
      expect(plan.delayMs).toBe(2_500 + BOT_MIN_REACTION_MS);
    }
  });

  it(`không bao giờ đúng quá ${BOT_MAX_ACCURACY * 100} % kể cả game chuẩn 100 % và mức danh nghĩa 100 %`, () => {
    let correct = 0;
    const N = 20_000;
    for (let i = 0; i < N; i++) {
      const plan = planBasicAnswer(
        { expectedSolveMs: 1_000, expectedAccuracy: 1, allowanceMs: 0, rng: createRng(i) },
        { timeFactor: 1, accuracy: 1 },
      );
      if (plan.correct) correct++;
    }
    expect(Math.abs(correct / N - BOT_MAX_ACCURACY)).toBeLessThan(0.003);
  });
});
