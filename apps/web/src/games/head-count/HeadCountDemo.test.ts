import { describe, expect, it } from "vitest";
import { poseAt } from "../_shared/demo/timeline";
import { HEAD_COUNT_SCRIPT as S } from "./HeadCountDemo";

const at = (lane: string, ms: number) => poseAt(S, lane, ms);

describe("clip hướng dẫn Đếm sĩ số", () => {
  it("tường hạ, 2 bạn vào, 1 bạn ra, cửa đóng rồi chạm 4", () => {
    expect(at("wall", 1800).y).toBe(0);
    expect(at("inA", 1600).o).toBeLessThan(1);
    expect(at("inA", 2400).o).toBe(0);
    expect(at("inB", 2600).o).toBe(0);
    expect(at("outC", 3300)).toMatchObject({ x: 190, y: 0, o: 1 });
    expect(at("shut", 3500).o).toBe(1);
    expect(at("c4", 3400).o).toBe(0);
    expect(at("ok", 4600).o).toBe(1);
  });
});
