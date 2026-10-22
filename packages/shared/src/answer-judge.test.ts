import { describe, expect, it } from "vitest";
import {
  gameAnswerWindowMs,
  initialJudgeState,
  type Judgement,
  type JudgeRound,
  type JudgeState,
  judgeAnswer,
  judgeBotAnswer,
} from "./answer-judge";
import { LATE_ANSWER_GRACE_MS, MAX_ANSWERS_PER_SECOND, WRONG_ANSWER_LOCK_MS } from "./constants";
import type { Difficulty } from "./difficulty";
import { GAMES } from "./games";
import { gameMultiplier, gameSpeedAllowanceMs, pointsForCorrect } from "./scoring";

const round: JudgeRound = {
  playing: true,
  round: 2,
  gameId: "odd-one-out",
  seed: 4242,
  startAt: 100_000,
  endsAt: 145_000,
};
const D: Difficulty = 1;
const right = (index: number) => GAMES["odd-one-out"].generate(round.seed, index, D).oddIndex;
const wrong = (index: number) => (right(index) + 1) % 16;

function answer(state: JudgeState, value: unknown, now: number, over: Partial<JudgeRound> = {}) {
  return judgeAnswer(
    { ...round, ...over },
    D,
    state,
    { round: round.round, index: state.progress, answer: value },
    now,
  );
}

describe("judgeAnswer — luật chấm một câu (server + luyện tập)", () => {
  it("câu đầu tính giờ từ startAt; đúng → điểm theo pointsForCorrect, chuỗi + 1, sang câu kế", () => {
    const { outcome, next } = answer(initialJudgeState(), right(0), 102_000);
    expect(outcome).toEqual({
      result: {
        index: 0,
        correct: true,
        points: pointsForCorrect({ difficulty: D, answerMs: 2_000, streak: 0 }),
      },
      correct: true,
      points: pointsForCorrect({ difficulty: D, answerMs: 2_000, streak: 0 }),
    });
    expect(next).toMatchObject({ progress: 1, streak: 1, shownAt: 102_000, lockedUntil: 0 });
  });

  it("dùng hệ số + miễn trừ của chính game trên câu sinh lại (CR-006)", () => {
    const game = GAMES.balance;
    const d: Difficulty = 3;
    const puzzle = game.generate(round.seed, 0, d);
    const { outcome } = judgeAnswer(
      { ...round, gameId: "balance" },
      d,
      initialJudgeState(),
      { round: round.round, index: 0, answer: puzzle.answer },
      round.startAt + 5_000,
    );
    expect(outcome?.points).toBe(
      pointsForCorrect({
        difficulty: d,
        answerMs: 5_000,
        streak: 0,
        multiplier: gameMultiplier(game, d),
        allowanceMs: gameSpeedAllowanceMs(game, puzzle, d),
      }),
    );
  });

  it("sai → 0 điểm, mất chuỗi, khoá, câu kế tính giờ từ lúc hết khoá", () => {
    const first = answer(initialJudgeState(), right(0), 101_000).next;
    const { outcome, next } = answer(first, wrong(1), 103_000);
    expect(outcome?.result).toEqual({
      index: 1,
      correct: false,
      points: 0,
      lockedUntil: 103_000 + WRONG_ANSWER_LOCK_MS,
    });
    expect(next).toMatchObject({
      progress: 2,
      streak: 0,
      lockedUntil: 103_000 + WRONG_ANSWER_LOCK_MS,
      shownAt: 103_000 + WRONG_ANSWER_LOCK_MS,
    });
    // Đang khoá → bỏ qua; hết khoá → chấm.
    expect(answer(next, right(2), 104_000).outcome).toBeNull();
    const after = answer(next, right(2), 103_000 + WRONG_ANSWER_LOCK_MS);
    expect(after.outcome?.result).toMatchObject({ correct: true });
    expect(after.outcome?.points).toBe(pointsForCorrect({ difficulty: D, answerMs: 0, streak: 0 }));
  });

  it("bỏ qua, state giữ nguyên: không ở pha chơi, game lạ, sai vòng, sai index, quá giờ + dung sai", () => {
    const s = initialJudgeState();
    expect(answer(s, right(0), 101_000, { playing: false })).toEqual({ outcome: null, next: s });
    expect(answer(s, right(0), 101_000, { gameId: "tetris" })).toEqual({ outcome: null, next: s });
    const late = round.endsAt + LATE_ANSWER_GRACE_MS;
    expect(answer(s, right(0), late + 1)).toEqual({ outcome: null, next: s });
    expect(answer(s, right(0), late).outcome).not.toBeNull();
    for (const msg of [
      { round: 1, index: 0, answer: right(0) },
      { round: 2, index: 1, answer: right(1) },
    ]) {
      expect(judgeAnswer(round, D, s, msg, 101_000)).toEqual({ outcome: null, next: s });
    }
  });

  it(`chống spam: quá ${MAX_ANSWERS_PER_SECOND} đáp án/giây bị bỏ, đáp án rác cũng bị đếm`, () => {
    let s = initialJudgeState();
    for (let i = 0; i < MAX_ANSWERS_PER_SECOND; i++) {
      const out = answer(s, "rác", 110_000 + i);
      expect(out.outcome).toBeNull();
      expect(out.next.progress).toBe(0);
      s = out.next;
    }
    expect(s.recentAnswers).toHaveLength(MAX_ANSWERS_PER_SECOND);
    expect(answer(s, right(0), 110_500).outcome).toBeNull();
    // Qua 1 giây thì mốc cũ hết hạn.
    expect(answer(s, right(0), 111_010).outcome?.correct).toBe(true);
  });

  it("hàm thuần: không đổi state đầu vào, cùng đầu vào → cùng kết quả", () => {
    const s = initialJudgeState();
    const snapshot = { ...s, recentAnswers: [...s.recentAnswers] };
    const a = answer(s, right(0), 101_234);
    const b = answer(s, right(0), 101_234);
    expect(a).toEqual(b);
    expect(s).toEqual(snapshot);
  });
});

describe("judgeAnswer — hạn trả lời của game (answerWindowMs, CR-012)", () => {
  const aim = { ...round, gameId: "aim-trainer" };
  const hit = (index: number, d: Difficulty) => {
    const p = GAMES["aim-trainer"].generate(aim.seed, index, d);
    return { x: p.x, y: p.y };
  };
  const send = (state: JudgeState, d: Difficulty, value: unknown, now: number) =>
    judgeAnswer(aim, d, state, { round: aim.round, index: state.progress, answer: value }, now);

  it("đúng trong hạn + dung sai → đúng; muộn hơn 1 ms → sai, khoá như câu sai", () => {
    const life = GAMES["aim-trainer"].generate(aim.seed, 0, D).lifeMs;
    const edge = aim.startAt + life + LATE_ANSWER_GRACE_MS;
    expect(send(initialJudgeState(), D, hit(0, D), edge).outcome?.correct).toBe(true);
    const late = send(initialJudgeState(), D, hit(0, D), edge + 1);
    expect(late.outcome?.correct).toBe(false);
    expect(late.outcome?.points).toBe(0);
    expect(late.next).toMatchObject({
      progress: 1,
      streak: 0,
      lockedUntil: edge + 1 + WRONG_ANSWER_LOCK_MS,
    });
  });

  it("hạn tính từ lúc câu hiện (shownAt), không từ đầu vòng", () => {
    const first = send(initialJudgeState(), D, hit(0, D), aim.startAt + 600).next;
    const life = GAMES["aim-trainer"].generate(aim.seed, 1, D).lifeMs;
    const shown = first.shownAt as number;
    expect(send(first, D, hit(1, D), shown + life + LATE_ANSWER_GRACE_MS).outcome?.correct).toBe(
      true,
    );
    expect(
      send(first, D, hit(1, D), shown + life + LATE_ANSWER_GRACE_MS + 1).outcome?.correct,
    ).toBe(false);
  });

  it("game không khai báo hạn (Mầm Luyện ngắm, game cũ) → không giới hạn như trước", () => {
    expect(send(initialJudgeState(), 0, hit(0, 0), aim.startAt + 40_000).outcome?.correct).toBe(
      true,
    );
    expect(answer(initialJudgeState(), right(0), round.startAt + 40_000).outcome?.correct).toBe(
      true,
    );
  });

  it("gameAnswerWindowMs kẹp giá trị không hợp lệ về không giới hạn", () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
      expect(gameAnswerWindowMs({ answerWindowMs: () => bad }, null, D)).toBeUndefined();
    }
    expect(gameAnswerWindowMs({}, null, D)).toBeUndefined();
    expect(gameAnswerWindowMs({ answerWindowMs: () => 1_500 }, null, D)).toBe(1_500);
  });
});

describe("judgeBotAnswer — bot chấm cùng đường với người (CR-016)", () => {
  type GameKey = "odd-one-out" | "balance" | "aim-trainer";
  const SOLVE: Record<GameKey, (seed: number, index: number, d: Difficulty) => unknown> = {
    "odd-one-out": (s, i, d) => GAMES["odd-one-out"].generate(s, i, d).oddIndex,
    balance: (s, i, d) => GAMES.balance.generate(s, i, d).answer,
    "aim-trainer": (s, i, d) => {
      const p = GAMES["aim-trainer"].generate(s, i, d);
      return { x: p.x, y: p.y };
    },
  };
  /** Đáp án đúng kiểu nhưng sai: lấy đáp án đúng của câu khác mà `check` chấm sai. */
  function wrongFor(gameId: GameKey, seed: number, index: number, d: Difficulty): unknown {
    const game = GAMES[gameId];
    const puzzle = game.generate(seed, index, d);
    for (let k = 1; k < 200; k++) {
      const candidate = SOLVE[gameId](seed, index + k, d);
      if (
        game.isAnswer(candidate) &&
        !(game.check as (p: unknown, a: unknown) => boolean)(puzzle, candidate)
      ) {
        return candidate;
      }
    }
    throw new Error(`Không tìm được đáp án sai cho ${gameId}`);
  }

  /** Bỏ bộ đếm chống spam (bot không dùng) để so phần còn lại của state. */
  const core = ({ recentAnswers: _, ...rest }: JudgeState) => rest;

  /**
   * Chạy cùng một kịch bản (trả lời sau `afterMs` kể từ lúc câu hiện, đúng hay sai) cho người và
   * cho bot; mỗi bước kết quả và state (trừ chống spam) phải giống hệt nhau.
   */
  function replay(gameId: GameKey, d: Difficulty, steps: [afterMs: number, correct: boolean][]) {
    const r: JudgeRound = { ...round, gameId, endsAt: round.startAt + 600_000 };
    let human = initialJudgeState();
    let bot = initialJudgeState();
    const outcomes: Judgement["outcome"][] = [];
    for (const [afterMs, correct] of steps) {
      const index = human.progress;
      const now = (human.shownAt ?? r.startAt) + afterMs;
      const value = correct ? SOLVE[gameId](r.seed, index, d) : wrongFor(gameId, r.seed, index, d);
      // Kịch bản gửi ít hơn MAX_ANSWERS_PER_SECOND câu mỗi giây nên người không vướng chống spam.
      const h = judgeAnswer(r, d, human, { round: r.round, index, answer: value }, now);
      const b = judgeBotAnswer(r, d, bot, { index, correct }, now);
      expect(b.outcome).toEqual(h.outcome);
      expect(core(b.next)).toEqual(core(h.next));
      expect(b.next.recentAnswers).toEqual([]);
      outcomes.push(b.outcome);
      human = h.next;
      bot = b.next;
    }
    return outcomes;
  }

  it("combo: chuỗi đúng dài cho cùng số điểm (kể cả trần × 1,5), sai thì mất chuỗi như người", () => {
    const steps: [number, boolean][] = [
      ...Array.from({ length: 9 }, (_, i): [number, boolean] => [1_200 + i * 150, true]),
      [2_000, false],
      [1_500, true],
      [1_100, true],
    ];
    const out = replay("odd-one-out", D, steps);
    expect(out.every((o) => o !== null)).toBe(true);
    expect(out.slice(0, 9).every((o) => o?.correct && o.points > 0)).toBe(true);
    expect(out[9]).toMatchObject({ correct: false, points: 0 });
  });

  it("hệ số + miễn trừ của game (Cân thăng bằng, Siêu khó) giống hệt người", () => {
    const out = replay("balance", 3, [
      [4_000, true],
      [9_000, true],
      [3_000, false],
      [6_500, true],
    ]);
    expect(out.map((o) => o?.correct)).toEqual([true, true, false, true]);
  });

  it("game có hạn trả lời (Luyện ngắm): trong hạn đúng, muộn thì sai và khoá như người", () => {
    const life = GAMES["aim-trainer"].generate(round.seed, 0, D).lifeMs;
    expect(life).toBeGreaterThan(0);
    const out = replay("aim-trainer", D, [
      [600, true],
      [life + LATE_ANSWER_GRACE_MS + 1, true], // muộn 1 ms: kế hoạch đúng vẫn bị chấm sai
      [700, false],
      [800, true],
    ]);
    expect(out.map((o) => o?.correct)).toEqual([true, false, false, true]);
  });

  it("bỏ qua: không ở pha chơi, game lạ, sai index, quá giờ + dung sai, đang khoá; state giữ nguyên", () => {
    const s = initialJudgeState();
    const ok = { index: 0, correct: true };
    expect(judgeBotAnswer({ ...round, playing: false }, D, s, ok, 101_000)).toEqual({
      outcome: null,
      next: s,
    });
    expect(judgeBotAnswer({ ...round, gameId: "tetris" }, D, s, ok, 101_000).outcome).toBeNull();
    expect(judgeBotAnswer(round, D, s, { index: 1, correct: true }, 101_000).outcome).toBeNull();
    const late = round.endsAt + LATE_ANSWER_GRACE_MS;
    expect(judgeBotAnswer(round, D, s, ok, late + 1).outcome).toBeNull();
    expect(judgeBotAnswer(round, D, s, ok, late).outcome).not.toBeNull();

    const wrong = judgeBotAnswer(round, D, s, { index: 0, correct: false }, 101_000).next;
    const locked = { index: 1, correct: true };
    expect(judgeBotAnswer(round, D, wrong, locked, 101_000 + WRONG_ANSWER_LOCK_MS - 1)).toEqual({
      outcome: null,
      next: wrong,
    });
    expect(
      judgeBotAnswer(round, D, wrong, locked, 101_000 + WRONG_ANSWER_LOCK_MS).outcome?.correct,
    ).toBe(true);
  });

  it("không qua chống spam: nhiều câu trong 1 giây vẫn được chấm (server tự hẹn giờ cho bot)", () => {
    let s = initialJudgeState();
    for (let i = 0; i <= MAX_ANSWERS_PER_SECOND; i++) {
      const out = judgeBotAnswer(round, D, s, { index: i, correct: true }, 101_000 + i);
      expect(out.outcome?.correct).toBe(true);
      s = out.next;
    }
    expect(s.progress).toBe(MAX_ANSWERS_PER_SECOND + 1);
    expect(s.recentAnswers).toEqual([]);
  });
});
