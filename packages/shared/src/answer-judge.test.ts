import { describe, expect, it } from "vitest";
import {
  gameAnswerWindowMs,
  initialJudgeState,
  type JudgeRound,
  type JudgeState,
  judgeAnswer,
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
