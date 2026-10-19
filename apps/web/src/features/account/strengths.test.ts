import { describe, expect, it } from "vitest";
import { partyStrengths } from "./strengths";

describe("thế mạnh trong trận party", () => {
  it("chỉ có trận cũ ({}) → không có dữ liệu, không có Mạnh nhất", () => {
    const s = partyStrengths([
      { categoryScores: {}, categoryTitles: [] },
      { categoryScores: {}, categoryTitles: [] },
    ]);
    expect(s.hasData).toBe(false);
    expect(s.top).toBeNull();
    expect(s.rows).toHaveLength(5);
    expect(s.rows.every((r) => r.matches === 0 && r.titles === 0 && r.avg === 0)).toBe(true);
  });

  it("TB chỉ tính trên trận có chơi thể loại đó; trận cũ không kéo TB xuống", () => {
    const s = partyStrengths([
      { categoryScores: { compute: 1000, memorize: 0 }, categoryTitles: ["compute"] },
      { categoryScores: { compute: 2000 }, categoryTitles: [] },
      { categoryScores: {}, categoryTitles: [] },
    ]);
    const compute = s.rows.find((r) => r.category === "compute");
    const memorize = s.rows.find((r) => r.category === "memorize");
    expect(compute).toEqual({ category: "compute", titles: 1, matches: 2, avg: 1500 });
    // Chơi được 0 điểm vẫn là "đã chơi".
    expect(memorize).toEqual({ category: "memorize", titles: 0, matches: 1, avg: 0 });
    expect(s.rows.find((r) => r.category === "identify")?.matches).toBe(0);
    expect(s.top).toBe("compute");
  });

  it("Mạnh nhất: nhiều danh hiệu nhất, hoà thì TB cao hơn", () => {
    const s = partyStrengths([
      { categoryScores: { identify: 500, analyze: 900 }, categoryTitles: ["identify", "analyze"] },
      { categoryScores: { identify: 700, analyze: 300 }, categoryTitles: ["identify"] },
      { categoryScores: { analyze: 1000 }, categoryTitles: ["analyze"] },
    ]);
    // identify 2 danh hiệu, TB 600; analyze 2 danh hiệu, TB 733 → analyze.
    expect(s.top).toBe("analyze");
  });

  it("chưa có danh hiệu nào → TB cao nhất", () => {
    const s = partyStrengths([
      { categoryScores: { visualize: 300, compute: 800 }, categoryTitles: [] },
    ]);
    expect(s.top).toBe("compute");
    expect(s.hasData).toBe(true);
  });
});
