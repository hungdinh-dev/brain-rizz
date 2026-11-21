import { describe, expect, it } from "vitest";
import { poseAt } from "../_shared/demo/timeline";
import { FOLD_BOX_SCRIPT } from "./FoldBoxDemo";

const at = (lane: string, ms: number) => poseAt(FOLD_BOX_SCRIPT, lane, ms);

describe("kịch bản hướng dẫn động Gấp hộp (CR-021)", () => {
  it("chạm lưới đúng → ✓, lưới sai có ✗ + icon mặt đối diện ở bước ③", () => {
    expect(at("ok", 1800).o).toBe(1);
    expect(at("x", 2300).o).toBe(0);
    expect(at("x", 3100).o).toBe(1);
    expect(at("opp", 3100).o).toBe(1);
  });
});
