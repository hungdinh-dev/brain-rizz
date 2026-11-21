import { describe, expect, it } from "vitest";
import { poseAt } from "../_shared/demo/timeline";
import { TOP_VIEW_SCRIPT } from "./TopViewDemo";

const at = (lane: string, ms: number) => poseAt(TOP_VIEW_SCRIPT, lane, ms);

describe("kịch bản hướng dẫn động Nhìn từ trên (CR-021)", () => {
  it("bước ② khoanh mép cam, bước ③ chạm thẻ đúng → ✓", () => {
    expect(at("edge", 1500).o).toBe(1);
    expect(at("e0", 1700).o).toBe(1);
    expect(at("edge", 2600).o).toBe(0);
    expect(at("ok", 3200).o).toBe(1);
  });
});
