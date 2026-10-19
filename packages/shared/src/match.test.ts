import { describe, expect, it } from "vitest";
import type { GameId } from "./games";
import type { Category } from "./games/types";
import {
  availableGames,
  categoryLeaders,
  majorityDifficulty,
  playedCategories,
  rankByMatch,
  rankByRound,
} from "./match";
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

describe("playedCategories", () => {
  it("theo thứ tự CATEGORIES, không trùng, bỏ id lạ", () => {
    expect(
      playedCategories(["rotate-match", "odd-one-out", "top-view", "khong-co", "balance"]),
    ).toEqual(["identify", "analyze", "visualize"]);
    expect(playedCategories([])).toEqual([]);
  });
});

describe("categoryLeaders", () => {
  const p = (id: string, categoryScores: Partial<Record<Category, number>>) => ({
    id,
    categoryScores,
  });

  it("người điểm cao nhất mỗi thể loại, kết quả theo thứ tự CATEGORIES", () => {
    const players = [
      p("a", { visualize: 300, identify: 100 }),
      p("b", { visualize: 200, identify: 400 }),
    ];
    expect(categoryLeaders(players, ["visualize", "identify"])).toEqual([
      { category: "identify", leaderIds: ["b"], score: 400 },
      { category: "visualize", leaderIds: ["a"], score: 300 },
    ]);
  });

  it("hoà điểm cao nhất thì cùng nhận, giữ thứ tự đầu vào", () => {
    const players = [p("a", { compute: 50 }), p("b", { compute: 200 }), p("c", { compute: 200 })];
    expect(categoryLeaders(players, ["compute"])).toEqual([
      { category: "compute", leaderIds: ["b", "c"], score: 200 },
    ]);
  });

  it("mọi người 0 điểm (hoặc thiếu khoá) thì không ai nhận, thể loại bị bỏ", () => {
    const players = [p("a", { memorize: 0 }), p("b", {}), p("c", { memorize: 0, analyze: 10 })];
    expect(categoryLeaders(players, ["memorize", "analyze"])).toEqual([
      { category: "analyze", leaderIds: ["c"], score: 10 },
    ]);
  });

  it("thể loại chưa chơi thì bỏ qua dù có điểm; played trùng không nhân đôi", () => {
    const players = [p("a", { identify: 100, compute: 90 })];
    expect(categoryLeaders(players, ["compute", "compute"])).toEqual([
      { category: "compute", leaderIds: ["a"], score: 90 },
    ]);
    expect(categoryLeaders(players, [])).toEqual([]);
  });

  it("một người chơi có điểm thì nhận mọi thể loại đã chơi", () => {
    const players = [p("solo", { identify: 1, analyze: 2 })];
    expect(categoryLeaders(players, ["analyze", "identify"]).map((l) => l.leaderIds)).toEqual([
      ["solo"],
      ["solo"],
    ]);
    expect(categoryLeaders([], ["identify"])).toEqual([]);
  });

  it("8 người, đủ 5 thể loại", () => {
    const players = Array.from({ length: 8 }, (_, i) =>
      p(`p${i}`, {
        identify: i * 10, // p7 nhất
        memorize: (7 - i) * 10, // p0 nhất
        analyze: i % 2 === 0 ? 500 : 100, // p0, p2, p4, p6 hoà
        compute: i === 3 ? 999 : 0, // p3
        visualize: 0, // không ai
      }),
    );
    expect(
      categoryLeaders(players, ["identify", "memorize", "analyze", "compute", "visualize"]),
    ).toEqual([
      { category: "identify", leaderIds: ["p7"], score: 70 },
      { category: "memorize", leaderIds: ["p0"], score: 70 },
      { category: "analyze", leaderIds: ["p0", "p2", "p4", "p6"], score: 500 },
      { category: "compute", leaderIds: ["p3"], score: 999 },
    ]);
  });
});
