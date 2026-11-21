import { describe, expect, it } from "vitest";
import { poseAt } from "../_shared/demo/timeline";
import { PAIR_FLIP_SCRIPT } from "./PairFlipDemo";

const at = (lane: string, ms: number) => poseAt(PAIR_FLIP_SCRIPT, lane, ms);

describe("kịch bản hướng dẫn động Lật cặp (CR-021)", () => {
  it("xem cả bàn ngửa, úp hết, thẻ đề ngửa lại, thẻ được chạm lật ra cặp", () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => at(`F${i}`, 1000).sx)).toEqual([1, 1, 1, 1, 1, 1]);
    expect([1, 2, 3, 4, 5].map((i) => at(`F${i}`, 2000).sx)).toEqual([0, 0, 0, 0, 0]);
    expect(at("F0", 2000).sx).toBe(1);
    expect(at("K4", 2000).sx).toBe(1);
    expect(at("F4", 3400).sx).toBe(1);
    expect(at("K4", 3400).sx).toBe(0);
    expect(at("ok", 3500).o).toBe(1);
  });
});
