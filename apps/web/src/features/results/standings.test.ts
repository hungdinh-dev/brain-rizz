import type { PlayerView } from "@brain-rizz/shared";
import { describe, expect, it } from "vitest";
import { biggestClimber, matchRows, podiumGroups, roundWinners } from "./standings";

// Ép kiểu để test không vỡ khi PlayerView có thêm trường không liên quan.
function player(
  id: string,
  matchPoints: number,
  lastPoints: number,
  roundScore = 0,
  totalScore = 0,
): PlayerView {
  return { id, name: id, matchPoints, lastPoints, roundScore, totalScore } as PlayerView;
}

describe("bảng tổng điểm", () => {
  it("tính hạng trước vòng để biết ai leo, ai tụt", () => {
    // Trước vòng: hung 10, minh 8, na 5. Vòng này: na +10, hung +8, minh +6.
    const rows = matchRows([
      player("hung", 18, 8, 900, 1900),
      player("minh", 14, 6, 700, 1600),
      player("na", 15, 10, 1000, 1500),
    ]);
    expect(rows.map((r) => [r.player.id, r.rank, r.prevRank])).toEqual([
      ["hung", 0, 0],
      ["na", 1, 2],
      ["minh", 2, 1],
    ]);
    expect(biggestClimber(rows)?.player.id).toBe("na");
  });

  it("vòng đầu: mọi người cùng hạng trước vòng nên không ai 'leo' ngoài người đứng đầu", () => {
    const rows = matchRows([player("a", 10, 10, 500, 500), player("b", 8, 8, 300, 300)]);
    expect(rows.map((r) => r.prevRank)).toEqual([0, 0]);
    expect(biggestClimber(rows)).toBeNull();
  });
});

describe("nhất vòng và bục vinh danh", () => {
  it("hoà điểm vòng thì cùng nhất", () => {
    const winners = roundWinners([
      player("a", 0, 0, 500),
      player("b", 0, 0, 500),
      player("c", 0, 0, 100),
    ]);
    expect(winners.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("đồng hạng đứng chung bục, từ hạng 4 vào danh sách", () => {
    const { podium, rest } = podiumGroups([
      player("a", 20, 0, 0, 100),
      player("b", 20, 0, 0, 100),
      player("c", 15, 0, 0, 50),
      player("d", 10, 0, 0, 10),
      player("e", 5, 0, 0, 5),
    ]);
    expect(podium.map((g) => g.map((p) => p.id))).toEqual([["a", "b"], [], ["c"]]);
    expect(rest.map((r) => [r.player.id, r.rank])).toEqual([
      ["d", 3],
      ["e", 4],
    ]);
  });
});
