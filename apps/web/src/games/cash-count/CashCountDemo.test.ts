import { describe, expect, it } from "vitest";
import { poseAt } from "../_shared/demo/timeline";
import { CASH_COUNT_SCRIPT as S } from "./CashCountDemo";

const at = (lane: string, ms: number) => poseAt(S, lane, ms);

describe("clip hướng dẫn Đếm tiền nhanh", () => {
  it("câu 1 đúng → ✓; câu 2 chạm nhầm → ✗, khoanh thẻ đúng, khoá rút hết", () => {
    expect(at("ok1", 2700).o).toBe(1);
    expect(at("q1", 3000).o).toBe(0);
    expect(at("x2", 4300).o).toBe(1);
    expect(at("ring2", 4400).o).toBe(1);
    expect(at("lkb", 5400).sx).toBe(0);
  });
});
