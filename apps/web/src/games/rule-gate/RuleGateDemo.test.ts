import { describe, expect, it } from "vitest";
import { poseAt } from "../_shared/demo/timeline";
import { RULE_GATE_SCRIPT as S } from "./RuleGateDemo";

const at = (lane: string, ms: number) => poseAt(S, lane, ms);

describe("clip hướng dẫn Cổng luật", () => {
  it("ấn giữ khi vuốt; thỏ vào cổng, mèo về nhà, mỗi lượt một ✓", () => {
    expect(at("hp", 2100).sx).toBe(0.86);
    expect(at("hp", 2600).sx).toBe(1);
    expect(at("hand", 2250)).toMatchObject({ x: 204, y: 256 });
    expect(at("bunny", 2600).o).toBe(0);
    expect(at("ok1", 2800).o).toBe(1);
    expect(at("cat", 3600).o).toBe(1);
    expect(at("cat", 4400).o).toBe(0);
    expect(at("ok2", 4600).o).toBe(1);
  });
});
