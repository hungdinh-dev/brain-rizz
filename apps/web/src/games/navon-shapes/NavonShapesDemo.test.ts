import { describe, expect, it } from "vitest";
import { poseAt } from "../_shared/demo/timeline";
import { NAVON_SHAPES_SCRIPT } from "./NavonShapesDemo";

const at = (lane: string, ms: number) => poseAt(NAVON_SHAPES_SCRIPT, lane, ms);

describe("kịch bản hướng dẫn động Hình to hình nhỏ (CR-021)", () => {
  it("khung tròn chọn hình to, khung vuông chọn hình nhỏ", () => {
    expect(at("sel1", 2000).o).toBe(1);
    expect(at("q1", 2700).o).toBe(0);
    expect(at("q2", 3000).o).toBe(1);
    expect(at("sel2", 3700).o).toBe(1);
  });
});
