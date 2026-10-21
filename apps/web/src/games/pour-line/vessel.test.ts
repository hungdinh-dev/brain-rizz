import { pourLine } from "@brain-rizz/shared";
import { describe, expect, it } from "vitest";
import {
  HALF_PX_PER_WIDTH,
  halfWidthAt,
  levelY,
  sectionPoints,
  VESSEL,
  wallPoints,
} from "./vessel";

const ramp = Array.from({ length: 40 }, (_, i) => 250 + i * 10);

describe("bình Rót vừa vạch → px", () => {
  it("mức 0 ở đáy (y 1000), mức 1 000 ở miệng (y 360), 0,64 px mỗi đơn vị", () => {
    expect(levelY(0)).toBe(VESSEL.bottom);
    expect(levelY(1000)).toBe(VESSEL.top);
    expect(levelY(500)).toBeCloseTo(680);
  });

  it("nửa bề rộng = 0,18 × bề rộng lát tại tâm lát, giữ nguyên dưới tâm lát đầu và trên tâm lát cuối", () => {
    expect(halfWidthAt(ramp, 0)).toBeCloseTo(HALF_PX_PER_WIDTH * 250);
    expect(halfWidthAt(ramp, 12.5)).toBeCloseTo(HALF_PX_PER_WIDTH * 250);
    expect(halfWidthAt(ramp, 25 * 7 + 12.5)).toBeCloseTo(HALF_PX_PER_WIDTH * 320);
    expect(halfWidthAt(ramp, 1000)).toBeCloseTo(HALF_PX_PER_WIDTH * 640);
    // Giữa tâm hai lát: nội suy tuyến tính.
    expect(halfWidthAt(ramp, 25)).toBeCloseTo(HALF_PX_PER_WIDTH * 255);
  });

  it("bình rộng nhất (1 000) vừa khít khung x 180–540", () => {
    const wide = Array.from({ length: 40 }, () => 1000);
    for (const p of wallPoints(wide, -1)) expect(p.x).toBeCloseTo(180);
    for (const p of wallPoints(wide, 1)) expect(p.x).toBeCloseTo(540);
  });

  it("đa giác lòng bình đi từ mức thấp lên mức cao bên trái rồi xuống bên phải", () => {
    const points = sectionPoints(ramp, 300, 700);
    const first = points[0];
    const last = points[points.length - 1];
    expect(first?.y).toBeCloseTo(levelY(300));
    expect(last?.y).toBeCloseTo(levelY(300));
    expect(first?.x).toBeLessThan(VESSEL.cx);
    expect(last?.x).toBeGreaterThan(VESSEL.cx);
    const ys = points.map((p) => p.y);
    expect(Math.min(...ys)).toBeCloseTo(levelY(700));
    // Đổi chỗ hai mức vẫn cho cùng đa giác.
    expect(sectionPoints(ramp, 700, 300)).toEqual(points);
  });

  it("mọi câu thật đều nằm trong khung bình, dải vạch nằm trong bình", () => {
    for (const difficulty of [0, 1, 2, 3] as const) {
      for (let i = 0; i < 200; i++) {
        const puzzle = pourLine.generate(12345, i, difficulty);
        for (const side of [-1, 1] as const) {
          for (const p of wallPoints(puzzle.vessel, side)) {
            expect(p.x).toBeGreaterThanOrEqual(180 - 1e-9);
            expect(p.x).toBeLessThanOrEqual(540 + 1e-9);
            expect(p.y).toBeGreaterThanOrEqual(VESSEL.top);
            expect(p.y).toBeLessThanOrEqual(VESSEL.bottom);
          }
        }
        expect(levelY(puzzle.target + puzzle.tol)).toBeGreaterThan(VESSEL.top);
        if (puzzle.hideFrom !== null) expect(levelY(puzzle.hideFrom)).toBeCloseTo(680);
      }
    }
  });
});
