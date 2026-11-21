import { describe, expect, it } from "vitest";
import { poseAt } from "../_shared/demo/timeline";
import { BEAD_PATTERN_SCRIPT as S } from "./BeadPatternDemo";

const at = (lane: string, ms: number) => poseAt(S, lane, ms);

describe("clip hướng dẫn Chuỗi quy luật", () => {
  it("hạt của thẻ đúng bay vào chỗ trống, ba thẻ còn lại mờ", () => {
    expect(at("fly", 3000).o).toBe(0);
    expect(at("fly", 3900)).toMatchObject({ x: 0, y: 0, sx: 1, o: 1 });
    expect(at("blank", 3900).o).toBe(0);
    expect(at("rest", 3900).o).toBeCloseTo(0.45);
    expect(at("ok", 3900).o).toBe(1);
  });
});
