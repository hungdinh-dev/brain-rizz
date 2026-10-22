import {
  type Difficulty,
  type GameId,
  type JudgeRound,
  LATE_ANSWER_GRACE_MS,
  MAX_ANSWERS_PER_SECOND,
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

describe("AnswerJudge.judgeBot — bot chấm cùng luật với người (CR-016)", () => {
  it("giờ hiện câu: câu đầu là startAt, câu đúng thì là lúc trả lời; cập nhật progress/streak", () => {
    const round = roundOf("odd-one-out");
    const judge = new AnswerJudge();
    const bot = contestant(1);
    expect(judge.shownAtOf("bot-1", round)).toBe(START);

    const at = START + 2_000;
    const outcome = judge.judgeBot("bot-1", bot, round, { index: 0, correct: true }, at);
    expect(outcome?.correct).toBe(true);
    expect(outcome?.points).toBeGreaterThan(0);
    expect(bot).toMatchObject({ progress: 1, streak: 1 });
    expect(judge.shownAtOf("bot-1", round)).toBe(at);
  });

  it("câu sai: khoá WRONG_ANSWER_LOCK_MS, trả lời trong lúc khoá bị bỏ qua, câu kế hiện lúc hết khoá", () => {
    const round = roundOf("odd-one-out");
    const judge = new AnswerJudge();
    const bot = contestant(1);
    const at = START + 1_000;
    const wrong = judge.judgeBot("bot-1", bot, round, { index: 0, correct: false }, at);
    expect(wrong?.correct).toBe(false);
    expect(wrong?.result.lockedUntil).toBe(at + WRONG_ANSWER_LOCK_MS);
    expect(bot).toMatchObject({ progress: 1, streak: 0 });
    expect(judge.shownAtOf("bot-1", round)).toBe(at + WRONG_ANSWER_LOCK_MS);

    // Đang khoá: bỏ qua, không đổi tiến độ.
    expect(judge.judgeBot("bot-1", bot, round, { index: 1, correct: true }, at + 10)).toBeNull();
    expect(bot.progress).toBe(1);
    // Hết khoá thì chấm bình thường.
    const after = at + WRONG_ANSWER_LOCK_MS + 500;
    expect(judge.judgeBot("bot-1", bot, round, { index: 1, correct: true }, after)?.correct).toBe(
      true,
    );
  });

  it("bỏ qua khi index khác câu đang làm, ngoài pha chơi hoặc quá endsAt + LATE_ANSWER_GRACE_MS", () => {
    const round = roundOf("odd-one-out");
    const judge = new AnswerJudge();
    const bot = contestant(1);
    expect(judge.judgeBot("bot-1", bot, round, { index: 3, correct: true }, START + 1)).toBeNull();
    expect(
      judge.judgeBot(
        "bot-1",
        bot,
        roundOf("odd-one-out", false),
        { index: 0, correct: true },
        START + 1,
      ),
    ).toBeNull();
    const tooLate = round.endsAt + LATE_ANSWER_GRACE_MS + 1;
    expect(judge.judgeBot("bot-1", bot, round, { index: 0, correct: true }, tooLate)).toBeNull();
    expect(bot).toMatchObject({ progress: 0, streak: 0 });
  });

  it("game có hạn trả lời: kế hoạch đúng nhưng tới quá hạn vẫn bị chấm sai như người", () => {
    const round = roundOf("aim-trainer");
    const judge = new AnswerJudge();
    const bot = contestant(1);
    const late = judge.judgeBot("bot-1", bot, round, { index: 0, correct: true }, START + EDGE + 1);
    expect(late?.correct).toBe(false);
    expect(late?.points).toBe(0);

    const twin = new AnswerJudge();
    const twinBot = contestant(1);
    const inTime = twin.judgeBot(
      "bot-1",
      twinBot,
      round,
      { index: 0, correct: true },
      START + EDGE,
    );
    expect(inTime?.correct).toBe(true);
  });

  it.each<[GameId, Difficulty]>([
    ["odd-one-out", 1],
    ["aim-trainer", 2],
    ["balance", 3],
  ])("%s mức %i: cùng giờ trả lời và cùng đúng → bot được đúng số điểm của người", (gameId, d) => {
    const round = roundOf(gameId);
    const human = new AnswerJudge();
    const bots = new AnswerJudge();
    const who = contestant(d);
    const bot = contestant(d);
    let at = START;
    for (let i = 0; i < 6; i++) {
      at += 700 + i * 150;
      const a = answerRight(human, who, round, at);
      const b = bots.judgeBot("bot-1", bot, round, { index: i, correct: true }, at);
      expect(b).toEqual(a);
    }
    expect(bot).toEqual(who);
  });

  it("không qua bộ chống spam của người (server tự hẹn giờ, mỗi câu một lần)", () => {
    const round = roundOf("odd-one-out");
    const judge = new AnswerJudge();
    const bot = contestant(0);
    const n = MAX_ANSWERS_PER_SECOND + 5;
    for (let i = 0; i < n; i++) {
      const outcome = judge.judgeBot("bot-1", bot, round, { index: i, correct: true }, START + i);
      expect(outcome).not.toBeNull();
    }
    expect(bot.progress).toBe(n);
  });
});
