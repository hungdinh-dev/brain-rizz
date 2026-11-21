import { describe, expect, it } from "vitest";
import { poseAt } from "../_shared/demo/timeline";
import { SHADOW_MATCH_SCRIPT } from "./ShadowMatchDemo";

const at = (lane: string, ms: number) => poseAt(SHADOW_MATCH_SCRIPT, lane, ms);

describe("kịch bản hướng dẫn động Bóng của ai (CR-021)", () => {
  it("chạm đúng bóng hai lần, bóng cá xoay về thẳng (−90°)", () => {
    expect(at("ok1", 1500).o).toBe(1);
    expect(at("ok2", 2900).o).toBe(1);
    expect(at("up2", 2700).r).toBe(0);
    expect(at("up2", 3300).r).toBe(-90);
  });
});
