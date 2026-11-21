import { describe, expect, it } from "vitest";
import { poseAt } from "../_shared/demo/timeline";
import { CUBE_COUNT_SCRIPT } from "./CubeCountDemo";

const at = (lane: string, ms: number) => poseAt(CUBE_COUNT_SCRIPT, lane, ms);

describe("kịch bản hướng dẫn động Đếm khối (CR-021)", () => {
  it("đếm đủ 6 khối (khối bị che hiện cùng số 3) trước khi chạm thẻ 6", () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => at(`n${i}`, 2400).o)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(at("ghost", 1400).o).toBe(0);
    expect(at("ghost", 1700).o).toBe(1);
    expect(at("ok", 3300).o).toBe(1);
  });
});
