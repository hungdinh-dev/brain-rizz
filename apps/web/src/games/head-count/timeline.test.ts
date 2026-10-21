import { DIFFICULTIES, headCount, headCountInputAtMs } from "@brain-rizz/shared";
import { describe, expect, it } from "vitest";
import {
  GAP,
  LANE_Y,
  poseAt,
  stageAt,
  teacherInsideAtEnd,
  WALK_SHARE,
  WALL_DROP_MS,
  walkersOf,
} from "./timeline";

describe("Đếm sĩ số: dòng thời gian trình chiếu", () => {
  const puzzle = headCount.generate(42, 0, 1);

  it("suy ra đúng pha từ t: xem lớp, từng lượt, chờ chọn", () => {
    expect(stageAt(puzzle, 0)).toEqual({ kind: "show", wall: 0 });
    expect(stageAt(puzzle, puzzle.showMs - WALL_DROP_MS / 2)).toEqual({ kind: "show", wall: 0.5 });
    expect(stageAt(puzzle, puzzle.showMs)).toEqual({ kind: "step", k: 0, walk: 0 });
    const mid = stageAt(
      puzzle,
      puzzle.showMs + 2 * puzzle.stepMs + (puzzle.stepMs * WALK_SHARE) / 2,
    );
    expect(mid.kind === "step" && mid.k).toBe(2);
    expect(mid.kind === "step" && mid.walk).toBeCloseTo(0.5);
    // 30 % cuối của lượt: đã đi xong, đang nghỉ.
    const rest = puzzle.showMs + 3 * puzzle.stepMs - 1;
    expect(stageAt(puzzle, rest)).toEqual({ kind: "step", k: 2, walk: 1 });
    const inputAt = headCountInputAtMs(puzzle);
    expect(stageAt(puzzle, inputAt - 0.01).kind).toBe("step");
    expect(stageAt(puzzle, inputAt)).toEqual({ kind: "input", sinceMs: 0 });
    // Rớt khung: nhảy thẳng tới đúng pha, không trễ dần.
    expect(stageAt(puzzle, inputAt + 5_000)).toEqual({ kind: "input", sinceMs: 5_000 });
  });

  it("mỗi lượt: đủ người, thầy đi cuối nhóm cùng hướng", () => {
    expect(walkersOf({ in: 2, out: 1 })).toEqual([
      { dir: "in", teacher: false, slot: 0, group: 2 },
      { dir: "in", teacher: false, slot: 1, group: 2 },
      { dir: "out", teacher: false, slot: 0, group: 1 },
    ]);
    expect(walkersOf({ in: 0, out: 1, teacher: "out" })).toEqual([
      { dir: "out", teacher: false, slot: 0, group: 2 },
      { dir: "out", teacher: true, slot: 1, group: 2 },
    ]);
    expect(walkersOf({ in: 0, out: 0, teacher: "in" })).toEqual([
      { dir: "in", teacher: true, slot: 0, group: 1 },
    ]);
  });

  it("người đi: khuất ở đầu và cuối lượt, cả nhóm cùng lúc ở hành lang, cách nhau so le", () => {
    for (const dir of ["in", "out"] as const) {
      const [lead, next] = walkersOf(dir === "in" ? { in: 2, out: 0 } : { in: 0, out: 2 });
      if (!lead || !next) throw new Error("thiếu người");
      expect(poseAt(lead, 0)).toBeNull();
      expect(poseAt(next, 1)).toBeNull();
      const a = poseAt(lead, 0.5);
      const b = poseAt(next, 0.5);
      expect(a?.alpha).toBe(1);
      expect(b?.alpha).toBe(1);
      expect(a?.y).toBe(LANE_Y);
      // Người sau lùi vào trong hàng 24 px và cách người trước đúng GAP theo chiều đi.
      expect((a?.y ?? 0) - (b?.y ?? 0)).toBe(24);
      expect(Math.abs((a?.x ?? 0) - (b?.x ?? 0))).toBeCloseTo(GAP);
      // Vào: bên trái cửa; ra: bên phải cửa.
      if (dir === "in") expect(a?.x).toBeLessThan(360);
      else expect(a?.x).toBeGreaterThan(360);
    }
  });

  it("thầy còn trong lớp lúc cửa đóng theo lượt cuối có thầy", () => {
    expect(teacherInsideAtEnd({ teacherAtStart: true, events: [{ in: 1, out: 0 }] })).toBe(true);
    expect(
      teacherInsideAtEnd({ teacherAtStart: true, events: [{ in: 0, out: 0, teacher: "out" }] }),
    ).toBe(false);
    expect(
      teacherInsideAtEnd({ teacherAtStart: false, events: [{ in: 1, out: 0, teacher: "in" }] }),
    ).toBe(true);
  });

  it("mọi mức: trình chiếu kết thúc đúng mốc chạm của shared", () => {
    for (const d of DIFFICULTIES) {
      for (let i = 0; i < 50; i++) {
        const p = headCount.generate(7, i, d);
        const end = headCountInputAtMs(p);
        expect(stageAt(p, end - 1).kind).toBe("step");
        expect(stageAt(p, end).kind).toBe("input");
      }
    }
  });
});
