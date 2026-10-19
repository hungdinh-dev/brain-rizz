import { describe, expect, it } from "vitest";
import {
  applyResult,
  bestFor,
  EMPTY_RECORDS,
  mergeRemoteBests,
  parseRecords,
  playedGames,
  topBestOfGame,
} from "./records";

describe("parseRecords", () => {
  it("chưa có / JSON hỏng / sai kiểu → mặc định rỗng", () => {
    expect(parseRecords(null)).toEqual(EMPTY_RECORDS);
    expect(parseRecords("{oops")).toEqual(EMPTY_RECORDS);
    expect(parseRecords("42")).toEqual(EMPTY_RECORDS);
    expect(parseRecords('"x"')).toEqual(EMPTY_RECORDS);
  });

  it("bỏ game lạ, độ khó lạ, số âm; giữ phần hợp lệ", () => {
    const raw = JSON.stringify({
      bests: {
        "odd-one-out:1": { score: 1200, correct: 10, plays: 3, updatedAt: 5 },
        "odd-one-out:9": { score: 1, correct: 1, plays: 1 },
        "nope:1": { score: 1, correct: 1, plays: 1 },
        "balance:2": { score: -5, correct: 1, plays: 1 },
      },
      lastDifficulty: { "odd-one-out": 2, balance: 7, nope: 1 },
    });
    expect(parseRecords(raw)).toEqual({
      bests: { "odd-one-out:1": { score: 1200, correct: 10, plays: 3, updatedAt: 5 } },
      lastDifficulty: { "odd-one-out": 2 },
    });
  });
});

describe("applyResult", () => {
  it("lần đầu → kỷ lục mới (nếu > 0), 1 lượt, nhớ độ khó", () => {
    const out = applyResult(EMPTY_RECORDS, "balance", 1, 900, 7, 100);
    expect(out.isNewBest).toBe(true);
    expect(out.previous).toBeUndefined();
    expect(bestFor(out.records, "balance", 1)).toEqual({
      score: 900,
      correct: 7,
      plays: 1,
      updatedAt: 100,
    });
    expect(out.records.lastDifficulty.balance).toBe(1);
  });

  it("lần đầu 0 điểm → không phải kỷ lục mới nhưng vẫn đếm lượt", () => {
    const out = applyResult(EMPTY_RECORDS, "balance", 0, 0, 0, 1);
    expect(out.isNewBest).toBe(false);
    expect(bestFor(out.records, "balance", 0)?.plays).toBe(1);
  });

  it("thấp hơn kỷ lục → giữ kỷ lục cũ, cộng lượt", () => {
    const first = applyResult(EMPTY_RECORDS, "balance", 1, 900, 7, 1).records;
    const out = applyResult(first, "balance", 1, 500, 9, 2);
    expect(out.isNewBest).toBe(false);
    expect(out.previous?.score).toBe(900);
    expect(bestFor(out.records, "balance", 1)).toMatchObject({ score: 900, correct: 7, plays: 2 });
  });

  it("bằng điểm → giữ số câu đúng lớn hơn, không tính kỷ lục mới", () => {
    const first = applyResult(EMPTY_RECORDS, "balance", 1, 900, 7, 1).records;
    const out = applyResult(first, "balance", 1, 900, 8, 2);
    expect(out.isNewBest).toBe(false);
    expect(bestFor(out.records, "balance", 1)).toMatchObject({ score: 900, correct: 8 });
  });

  it("không đụng tới ô độ khó khác", () => {
    const first = applyResult(EMPTY_RECORDS, "balance", 1, 900, 7, 1).records;
    const out = applyResult(first, "balance", 2, 300, 2, 2);
    expect(bestFor(out.records, "balance", 1)?.score).toBe(900);
    expect(bestFor(out.records, "balance", 2)?.score).toBe(300);
  });
});

describe("topBestOfGame / playedGames", () => {
  it("lấy điểm cao nhất mọi mức", () => {
    let r = applyResult(EMPTY_RECORDS, "balance", 0, 1600, 10, 1).records;
    r = applyResult(r, "balance", 2, 1200, 9, 2).records;
    expect(topBestOfGame(r, "balance")).toMatchObject({ difficulty: 0, best: { score: 1600 } });
    expect(topBestOfGame(r, "odd-one-out")).toBeUndefined();
    expect(playedGames(r)).toEqual(["balance"]);
  });
});

describe("mergeRemoteBests", () => {
  it("lấy điểm cao hơn và số lượt lớn hơn; bỏ dòng lạ", () => {
    const local = applyResult(EMPTY_RECORDS, "balance", 1, 900, 7, 1).records;
    const merged = mergeRemoteBests(local, [
      { gameId: "balance", difficulty: 1, bestScore: 1000, bestCorrect: 8, plays: 5 },
      { gameId: "odd-one-out", difficulty: 2, bestScore: 300, bestCorrect: 3, plays: 1 },
      { gameId: "nope", difficulty: 1, bestScore: 1, bestCorrect: 1, plays: 1 },
    ]);
    expect(bestFor(merged, "balance", 1)).toMatchObject({ score: 1000, correct: 8, plays: 5 });
    expect(bestFor(merged, "odd-one-out", 2)).toMatchObject({ score: 300, plays: 1 });
    expect(Object.keys(merged.bests)).toHaveLength(2);
  });

  it("máy này cao hơn → giữ điểm trên máy", () => {
    const local = applyResult(EMPTY_RECORDS, "balance", 1, 900, 7, 1).records;
    const merged = mergeRemoteBests(local, [
      { gameId: "balance", difficulty: 1, bestScore: 400, bestCorrect: 3, plays: 0 },
    ]);
    expect(bestFor(merged, "balance", 1)).toMatchObject({ score: 900, correct: 7, plays: 1 });
  });
});
