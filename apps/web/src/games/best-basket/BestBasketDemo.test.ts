import { describe, expect, it } from "vitest";
import { poseAt } from "../_shared/demo/timeline";
import { BEST_BASKET_SCRIPT as S } from "./BestBasketDemo";

const at = (lane: string, ms: number) => poseAt(S, lane, ms);

describe("clip hướng dẫn Giỏ hời nhất", () => {
  it("dòng tổng hiện lần lượt, giỏ lố tiền mờ, chạm giỏ đúng → ✓", () => {
    expect(["t0", "t1", "t2"].map((k) => at(k, 1300).o)).toEqual([0, 0, 0]);
    expect(["t0", "t1", "t2"].map((k) => at(k, 2700).o)).toEqual([1, 1, 1]);
    expect(at("over", 2400).o).toBeCloseTo(0.5);
    expect(at("dash", 2400).o).toBe(1);
    expect(at("ok", 4000).o).toBe(1);
  });
});
