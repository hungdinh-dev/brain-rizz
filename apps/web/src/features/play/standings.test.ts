import { comboMultiplier, type PlayerView } from "@brain-rizz/shared";
import { describe, expect, it } from "vitest";
import { appliedComboMultiplier, hasCombo, rankByRoundScore } from "./standings";

// Ép kiểu để test không vỡ khi PlayerView có thêm trường mới không liên quan tới xếp hạng.
function player(id: string, roundScore: number): PlayerView {
  return {
    id,
    name: id,
    colorIndex: 0,
    avatar: "khoi",
    difficulty: 1,
    ready: false,
    connected: true,
    isHost: false,
    matchPoints: 0,
    roundScore,
    progress: 0,
    streak: 0,
  } as PlayerView;
}

describe("rankByRoundScore", () => {
  it("xếp theo điểm giảm dần, bằng điểm thì cùng hạng", () => {
    const ranked = rankByRoundScore([
      player("a", 100),
      player("b", 300),
      player("c", 100),
      player("d", 50),
    ]);
    expect(ranked.map((s) => [s.player.id, s.rank])).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", 2],
      ["d", 4],
    ]);
  });

  it("không đổi mảng đầu vào", () => {
    const input = [player("a", 1), player("b", 2)];
    rankByRoundScore(input);
    expect(input.map((p) => p.id)).toEqual(["a", "b"]);
  });
});

describe("combo", () => {
  it("chỉ hiện từ câu đúng liên tiếp thứ 3", () => {
    expect(hasCombo(2)).toBe(false);
    expect(hasCombo(3)).toBe(true);
  });

  it("hệ số khớp công thức tính điểm, có trần ×1,5 (CR-006)", () => {
    expect(appliedComboMultiplier(0)).toBe(1);
    expect(appliedComboMultiplier(2)).toBe(1);
    expect(appliedComboMultiplier(3)).toBe(1.1);
    expect(appliedComboMultiplier(4)).toBe(1.2);
    expect(appliedComboMultiplier(7)).toBe(1.5);
    expect(appliedComboMultiplier(12)).toBe(1.5);
  });

  it("đúng bằng hệ số server đã nhân cho câu đúng vừa rồi", () => {
    // Server chấm câu đúng với streak TRƯỚC câu đó, rồi mới tăng streak.
    for (let before = 0; before < 20; before++) {
      expect(appliedComboMultiplier(before + 1)).toBeCloseTo(comboMultiplier(before), 10);
    }
  });
});
