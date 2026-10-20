import {
  type Difficulty,
  type GameId,
  type JudgeRound,
  LATE_ANSWER_GRACE_MS,
  WRONG_ANSWER_LOCK_MS,
} from "@brain-rizz/shared";
import { describe, expect, it } from "vitest";
import { AnswerJudge, type Contestant } from "../src/rooms/AnswerJudge";
import { SOLVE, wrongAnswer } from "./helpers";

/** Bia Thường của Luyện ngắm sống 1,5 giây (aim-trainer.md); Mầm không giới hạn. */
const LIFE_MS = 1_500;
const EDGE = LIFE_MS + LATE_ANSWER_GRACE_MS;
const SEED = 12_345;
const START = 1_000_000;

function roundOf(gameId: GameId, playing = true): JudgeRound {
  return { playing, round: 1, gameId, seed: SEED, startAt: START, endsAt: START + 60_000 };
}

function contestant(difficulty: Difficulty): Contestant {
  return { difficulty, progress: 0, streak: 0 };
}

/** Trả lời đúng câu đang làm của `who` lúc `at`. */
function answerRight(judge: AnswerJudge, who: Contestant, round: JudgeRound, at: number) {
  const answer = SOLVE[round.gameId as GameId](SEED, who.progress, who.difficulty as Difficulty);
  return judge.judge("p", who, round, { round: 1, index: who.progress, answer }, at);
}

describe("AnswerJudge.resume — nối lại giữa vòng", () => {
  it("game có hạn trả lời: câu đang làm tính giờ hiện lại từ lúc nối lại", () => {
    const round = roundOf("aim-trainer");
    const judge = new AnswerJudge();
    const who = contestant(1);
    expect(answerRight(judge, who, round, START + 100)?.correct).toBe(true);

    // Rớt mạng 10 giây: không nối lại thì câu 1 chắc chắn bị chấm muộn.
    const back = START + 100 + 10_000;
    const twin = new AnswerJudge();
    const twinWho = contestant(1);
    answerRight(twin, twinWho, round, START + 100);
    expect(answerRight(twin, twinWho, round, back + EDGE)?.correct).toBe(false);

    judge.resume("p", who, round, back);
    expect(answerRight(judge, who, round, back + EDGE)?.correct).toBe(true);
  });

  it("game có hạn trả lời: muộn quá hạn tính từ lúc nối lại vẫn bị chấm sai", () => {
    const round = roundOf("aim-trainer");
    const judge = new AnswerJudge();
    const who = contestant(1);
    judge.resume("p", who, round, START + 5_000);
    expect(answerRight(judge, who, round, START + 5_000 + EDGE + 1)?.correct).toBe(false);
  });

  it("đang bị khoá sau câu sai: giờ hiện là lúc hết khoá, không sớm hơn", () => {
    const round = roundOf("aim-trainer");
    const judge = new AnswerJudge();
    const who = contestant(1);
    const wrong = wrongAnswer("aim-trainer", SEED, 0, 1);
    const at = START + 100;
    const outcome = judge.judge("p", who, round, { round: 1, index: 0, answer: wrong }, at);
    expect(outcome?.result.lockedUntil).toBe(at + WRONG_ANSWER_LOCK_MS);

    judge.resume("p", who, round, at + 50);
    const unlock = at + WRONG_ANSWER_LOCK_MS;
    const twin = new AnswerJudge();
    const twinWho = contestant(1);
    twin.judge("p", twinWho, round, { round: 1, index: 0, answer: wrong }, at);
    // Cùng kết quả như không nối lại: hạn đếm từ lúc hết khoá.
    expect(answerRight(judge, who, round, unlock + EDGE)?.correct).toBe(true);
    expect(answerRight(twin, twinWho, round, unlock + EDGE)?.correct).toBe(true);
  });

  it("nối lại trong lúc đếm ngược: câu đầu vẫn tính từ lúc vòng bắt đầu", () => {
    const round = roundOf("aim-trainer");
    const judge = new AnswerJudge();
    const who = contestant(1);
    judge.resume("p", who, round, START - 2_000);
    expect(answerRight(judge, who, round, START + EDGE)?.correct).toBe(true);
  });

  it.each<[string, GameId, Difficulty, boolean]>([
    ["game không có hạn trả lời", "odd-one-out", 1, true],
    ["Luyện ngắm ở Mầm (không giới hạn)", "aim-trainer", 0, true],
    ["không ở pha chơi", "aim-trainer", 1, false],
  ])("%s: không đổi giờ hiện câu, điểm tốc độ như không rớt mạng", (_, gameId, d, playing) => {
    const live = roundOf(gameId);
    const judge = new AnswerJudge();
    const twin = new AnswerJudge();
    const who = contestant(d);
    const twinWho = contestant(d);
    answerRight(judge, who, live, START + 300);
    answerRight(twin, twinWho, live, START + 300);

    judge.resume("p", who, roundOf(gameId, playing), START + 4_000);
    const a = answerRight(judge, who, live, START + 4_200);
    const b = answerRight(twin, twinWho, live, START + 4_200);
    expect(a).toEqual(b);
  });
});
