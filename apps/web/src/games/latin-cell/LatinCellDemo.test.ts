import { describe, expect, it } from "vitest";
import { poseAt } from "../_shared/demo/timeline";
import { LATIN_CELL_SCRIPT as S } from "./LatinCellDemo";

const at = (lane: string, ms: number) => poseAt(S, lane, ms);

describe("clip hướng dẫn Ô bí ẩn", () => {
  it("loại ● ▲ ■ ở bước ②, ★ bay vào ô ?", () => {
    expect(["c0", "c1", "c2"].map((k) => at(k, 1500).o)).toEqual([1, 1, 1]);
    expect(["c0", "c1", "c2"].map((k) => at(k, 2900).o)).toEqual([0.3, 0.3, 0.3]);
    expect(at("fly", 4000)).toMatchObject({ x: 0, y: 0, sx: 1, o: 1 });
    expect(at("q", 4000).o).toBe(0);
    expect(at("ok", 4000).o).toBe(1);
  });
});
