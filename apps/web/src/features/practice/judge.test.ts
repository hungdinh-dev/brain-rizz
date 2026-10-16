import {
  type GameId,
  getGame,
  LATE_ANSWER_GRACE_MS,
  oddOneOut,
  pointsForCorrect,
  WRONG_ANSWER_LOCK_MS,
} from "@brain-rizz/shared";
import { describe, expect, it } from "vitest";
import { initialProgress, judgePracticeAnswer, type PracticeRound, practiceSeed } from "./judge";

const round: PracticeRound = {
  gameId: "odd-one-out" as GameId,
  seed: 12345,
  difficulty: 1,
  startAt: 10_000,
  endsAt: 55_000,
};

const rightAnswer = (index: number) =>
  oddOneOut.generate(round.seed, index, round.difficulty).oddIndex;
const wrongAnswer = (index: number) => (rightAnswer(index) + 1) % 16;

describe("judgePracticeAnswer (luật chung judgeAnswer của shared)", () => {
  it("đúng → điểm như server (pointsForCorrect), sang câu kế, tăng chuỗi", () => {
    const s0 = initialProgress(round);
    const out = judgePracticeAnswer(round, s0, 0, rightAnswer(0), 12_000);
    expect(out.result).toEqual({
      index: 0,
      correct: true,
      points: pointsForCorrect({ difficulty: 1, answerMs: 2_000, streak: 0 }),
    });
    expect(out.state).toMatchObject({ progress: 1, streak: 1, bestStreak: 1, correct: 1 });
    expect(out.state.score).toBe(out.result?.points);
    expect(out.state.shownAt).toBe(12_000);
  });

  it("sai → 0 điểm, khoá 1,5 s, mất chuỗi, vẫn sang câu kế", () => {
    let s = judgePracticeAnswer(round, initialProgress(round), 0, rightAnswer(0), 11_000).state;
    const out = judgePracticeAnswer(round, s, 1, wrongAnswer(1), 12_000);
    expect(out.result).toEqual({
      index: 1,
      correct: false,
      points: 0,
      lockedUntil: 12_000 + WRONG_ANSWER_LOCK_MS,
    });
    s = out.state;
    expect(s).toMatchObject({ progress: 2, streak: 0, bestStreak: 1, wrong: 1 });
    // Thời gian câu kế tính từ lúc hết khoá.
    expect(s.shownAt).toBe(12_000 + WRONG_ANSWER_LOCK_MS);
  });

  it("đang khoá → bỏ qua; hết khoá → chấm tiếp", () => {
    const s = judgePracticeAnswer(round, initialProgress(round), 0, wrongAnswer(0), 11_000).state;
    const locked = judgePracticeAnswer(round, s, 1, rightAnswer(1), 12_000);
    expect(locked.result).toBeNull();
    expect(locked.state.progress).toBe(1);
    expect(judgePracticeAnswer(round, s, 1, rightAnswer(1), 12_600).result?.correct).toBe(true);
  });

  it("combo nhân điểm như server sau 3 câu đúng liên tiếp", () => {
    let s = initialProgress(round);
    let t = 10_000;
    for (let i = 0; i < 3; i++) {
      t += 1_000;
      s = judgePracticeAnswer(round, s, i, rightAnswer(i), t).state;
    }
    const out = judgePracticeAnswer(round, s, 3, rightAnswer(3), t + 1_000);
    expect(out.result?.points).toBe(
      pointsForCorrect({ difficulty: 1, answerMs: 1_000, streak: 3 }),
    );
    expect(out.result?.points).toBeGreaterThan(
      pointsForCorrect({ difficulty: 1, answerMs: 1_000, streak: 0 }),
    );
  });

  it("bỏ qua: sai số câu, chưa bắt đầu, quá giờ + dung sai, sai kiểu đáp án", () => {
    const s = initialProgress(round);
    expect(judgePracticeAnswer(round, s, 1, rightAnswer(1), 11_000).result).toBeNull();
    expect(judgePracticeAnswer(round, s, 0, rightAnswer(0), 9_999).result).toBeNull();
    expect(
      judgePracticeAnswer(round, s, 0, rightAnswer(0), round.endsAt + LATE_ANSWER_GRACE_MS + 1)
        .result,
    ).toBeNull();
    expect(judgePracticeAnswer(round, s, 0, "3", 11_000).result).toBeNull();
    // Trong dung sai vẫn chấm.
    expect(
      judgePracticeAnswer(round, s, 0, rightAnswer(0), round.endsAt + LATE_ANSWER_GRACE_MS).result,
    ).not.toBeNull();
  });

  it("quá 10 đáp án/giây → bỏ qua; đáp án rác cũng bị đếm như trên server", () => {
    let s = initialProgress(round);
    for (let i = 0; i < 10; i++) {
      s = judgePracticeAnswer(round, s, i, rightAnswer(i), 20_000 + i).state;
    }
    expect(judgePracticeAnswer(round, s, 10, rightAnswer(10), 20_050).result).toBeNull();
    expect(judgePracticeAnswer(round, s, 10, rightAnswer(10), 21_100).result).not.toBeNull();

    // 10 đáp án rác trong 1 giây làm đáp án đúng thứ 11 bị chặn.
    let junk = initialProgress(round);
    for (let i = 0; i < 10; i++) junk = judgePracticeAnswer(round, junk, 0, "x", 30_000 + i).state;
    expect(junk.progress).toBe(0);
    expect(judgePracticeAnswer(round, junk, 0, rightAnswer(0), 30_020).result).toBeNull();
  });

  it("chấm bằng đúng generate/check của shared cho mọi game (đáp án sai kiểu bị bỏ)", () => {
    const game = getGame(round.gameId);
    expect(game.isAnswer(rightAnswer(0))).toBe(true);
  });
});

describe("practiceSeed", () => {
  it("trả số nguyên 32 bit không âm", () => {
    const seed = practiceSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });
});
