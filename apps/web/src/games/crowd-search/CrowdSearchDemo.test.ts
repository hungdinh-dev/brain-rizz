import { describe, expect, it } from "vitest";
import { poseAt } from "../_shared/demo/timeline";
import { CROWD_SEARCH_SCRIPT } from "./CrowdSearchDemo";

const at = (lane: string, ms: number) => poseAt(CROWD_SEARCH_SCRIPT, lane, ms);

describe("kịch bản hướng dẫn động Tìm bạn (CR-021)", () => {
  it("bạn gần giống bị ✗ và mờ, rồi chạm đúng bạn → ✓", () => {
    expect(at("x", 2000).o).toBe(1);
    expect(at("miss", 2000).o).toBeCloseTo(0.4);
    expect(at("scan", 2600).o).toBe(0);
    expect(at("ok", 3300).o).toBe(1);
  });
});
