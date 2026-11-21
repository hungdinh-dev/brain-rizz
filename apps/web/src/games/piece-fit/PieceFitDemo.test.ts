import { describe, expect, it } from "vitest";
import { poseAt } from "../_shared/demo/timeline";
import { PIECE_FIT_SCRIPT } from "./PieceFitDemo";

const at = (lane: string, ms: number) => poseAt(PIECE_FIT_SCRIPT, lane, ms);

describe("kịch bản hướng dẫn động Mảnh vừa khít (CR-021)", () => {
  it("mảnh đúng bay vào khoảng trống, quay ngược 90°; bản lật gương bị ✗", () => {
    expect(at("fly", 2300)).toMatchObject({ x: 141, y: -163, r: -90, o: 1 });
    expect(at("x", 3000).o).toBe(1);
    expect(at("mir", 3100).o).toBe(1);
  });
});
