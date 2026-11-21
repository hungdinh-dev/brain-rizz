import { describe, expect, it } from "vitest";
import { poseAt } from "../_shared/demo/timeline";
import { STACK_RECALL_SCRIPT as S } from "./StackRecallDemo";

const at = (lane: string, ms: number) => poseAt(S, lane, ms);

describe("clip hướng dẫn Xếp lại tháp", () => {
  it("tháp xếp, khăn lau xoá, xếp lại đủ 3 tầng → ✓", () => {
    expect(["t0", "t1", "t2"].map((k) => at(k, 1600).o)).toEqual([1, 1, 1]);
    expect(["t0", "t1", "t2"].map((k) => at(k, 2400).o)).toEqual([0, 0, 0]);
    expect(at("wipe", 2700).o).toBe(0);
    expect(["r0", "r1", "r2"].map((k) => at(k, 3300).o)).toEqual([0, 0, 0]);
    expect(["r0", "r1", "r2"].map((k) => at(k, 4600).o)).toEqual([1, 1, 1]);
    expect(at("ok", 4800).o).toBe(1);
  });
});
