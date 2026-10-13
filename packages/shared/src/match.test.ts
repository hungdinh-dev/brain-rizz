import { describe, expect, it } from "vitest";
import type { GameId } from "./games";
import { availableGames, majorityDifficulty, rankByMatch, rankByRound } from "./match";
import { placementPoints } from "./scoring";

describe("rankByRound", () => {
  it("xếp giảm dần theo điểm vòng, hạng tính từ 0", () => {
    const ranked = rankByRound([
      { id: "a", roundScore: 100 },
      { id: "b", roundScore: 300 },
      { id: "c", roundScore: 200 },
    ]);
    expect(ranked.map((r) => [r.player.id, r.rank])).toEqual([
      ["b", 0],
      ["c", 1],
      ["a", 2],
    ]);
  });

  it("hoà điểm thì cùng hạng, hạng kế tiếp bị bỏ qua", () => {
    const ranked = rankByRound([
      { id: "a", roundScore: 50 },
      { id: "b", roundScore: 200 },
      { id: "c", roundScore: 200 },
      { id: "d", roundScore: 0 },
    ]);
    expect(ranked.map((r) => [r.player.id, r.rank])).toEqual([
      ["b", 0],
      ["c", 0],
      ["a", 2],
      ["d", 3],
    ]);
    // Cùng hạng → cùng điểm trận.
    expect(ranked.map((r) => placementPoints(r.rank))).toEqual([10, 10, 6, 5]);
  });

  it("mọi người cùng điểm thì cùng hạng nhất", () => {
    const ranked = rankByRound([{ roundScore: 0 }, { roundScore: 0 }, { roundScore: 0 }]);
    expect(ranked.map((r) => r.rank)).toEqual([0, 0, 0]);
  });

  it("không đổi mảng đầu vào, mảng rỗng trả rỗng", () => {
    const input = [{ roundScore: 1 }, { roundScore: 2 }];
    rankByRound(input);
    expect(input.map((p) => p.roundScore)).toEqual([1, 2]);
    expect(rankByRound([])).toEqual([]);
  });
});

describe("rankByMatch", () => {
  it("điểm trận giảm dần; hoà điểm trận thì tổng điểm vòng cao hơn xếp trên", () => {
    const ranked = rankByMatch([
      { id: "a", matchPoints: 18, totalScore: 900 },
      { id: "b", matchPoints: 20, totalScore: 500 },
      { id: "c", matchPoints: 18, totalScore: 1_200 },
    ]);
    expect(ranked.map((r) => [r.player.id, r.rank])).toEqual([
      ["b", 0],
      ["c", 1],
      ["a", 2],
    ]);
  });

  it("hoà cả điểm trận lẫn tổng điểm vòng thì cùng hạng", () => {
    const ranked = rankByMatch([
      { id: "a", matchPoints: 10, totalScore: 300 },
      { id: "b", matchPoints: 10, totalScore: 300 },
      { id: "c", matchPoints: 4, totalScore: 900 },
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([0, 0, 2]);
  });
});

describe("availableGames", () => {
  const all = ["a", "b", "c"] as unknown as GameId[];

  it("bỏ game đã chơi, giữ thứ tự danh mục", () => {
    expect(availableGames(["b"], all)).toEqual(["a", "c"]);
    expect(availableGames([], all)).toEqual(["a", "b", "c"]);
  });

  it("chơi hết thì trả rỗng (server làm mới playedGames)", () => {
    expect(availableGames(["c", "a", "b"], all)).toEqual([]);
  });

  it("mặc định dùng toàn bộ game hệ thống", () => {
    expect(availableGames([])).toContain("odd-one-out");
    expect(availableGames(["odd-one-out"])).not.toContain("odd-one-out");
  });
});

describe("majorityDifficulty", () => {
  it("chọn mức nhiều người chọn nhất", () => {
    expect(majorityDifficulty([1, 1, 3, 0])).toBe(1);
    expect(majorityDifficulty([2])).toBe(2);
  });

  it("hoà ở vị trí cao nhất hoặc rỗng thì trả null", () => {
    expect(majorityDifficulty([1, 1, 2, 2])).toBeNull();
    expect(majorityDifficulty([0, 3])).toBeNull();
    expect(majorityDifficulty([])).toBeNull();
  });

  it("hoà ở vị trí thấp hơn không ảnh hưởng", () => {
    expect(majorityDifficulty([1, 1, 1, 0, 2])).toBe(1);
  });

  it("bỏ qua giá trị không phải độ khó", () => {
    expect(majorityDifficulty([7, 7, 7, 2])).toBe(2);
  });
});
