import { describe, expect, it } from "vitest";
import { poseAt } from "../_shared/demo/timeline";
import { NUMBER_PATH_SCRIPT as S } from "./NumberPathDemo";

const at = (lane: string, ms: number) => poseAt(S, lane, ms);

describe("clip hướng dẫn Đường số", () => {
  it("tính hai đường, gạch 18, chạm cửa ra đường trái → ✓", () => {
    expect(at("n13", 3100).o).toBe(1);
    expect(at("cut", 3100).o).toBe(1);
    expect(at("dimR", 4000).o).toBeCloseTo(0.4);
    expect(at("ok", 4000).o).toBe(1);
  });
});
