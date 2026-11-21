import { describe, expect, it } from "vitest";
import { poseAt } from "../_shared/demo/timeline";
import { CIRCUIT_LINK_SCRIPT as S } from "./CircuitLinkDemo";

const at = (lane: string, ms: number) => poseAt(S, lane, ms);

describe("clip hướng dẫn Nối mạch", () => {
  it("câu 1 mảnh vào ô, đèn sáng; câu 2 dây cụt → ✗, khoá", () => {
    expect(at("fly1", 2200)).toMatchObject({ x: 0, y: 0, o: 1 });
    expect(at("bulb", 2500).o).toBe(1);
    expect(at("ok1", 2700).o).toBe(1);
    expect(at("x2", 4400).o).toBe(1);
    expect(at("fly2", 4700).o).toBe(0);
    expect(at("ring2", 4500).o).toBe(1);
    expect(at("lkb", 5400).sx).toBe(0);
  });
});
