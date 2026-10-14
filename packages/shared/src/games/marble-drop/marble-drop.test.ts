import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import {
  type MarbleDropPuzzle,
  type MarbleLever,
  marbleBoardParity,
  marbleDrop,
  marbleFallbackBoard,
  marbleFlippedOnPath,
  marbleLeverDirsBefore,
  simulateMarbleDrop,
} from "./marble-drop";

/** 2 500 seed × 4 mức = 10 000 câu. */
const SEEDS = 2_500;
const seedOf = (s: number) => (s * 2_654_435_761) >>> 0;

/** Bảng tham số theo đặc tả (mục Độ khó). */
const SPEC: Record<Difficulty, { tiers: number; balls: number; toggles: number }> = {
  0: { tiers: 2, balls: 1, toggles: 0 },
  1: { tiers: 3, balls: 1, toggles: 0 },
  2: { tiers: 4, balls: 2, toggles: 2 },
  3: { tiers: 4, balls: 3, toggles: 3 },
};

/** Mô phỏng độc lập (viết lại, không dùng code của game) để đối chiếu đáp án. */
function referenceCups(levers: MarbleLever[][], balls: number): number[] {
  const state = levers.map((row) => row.map((l) => ({ ...l })));
  const cups: number[] = [];
  for (let b = 0; b < balls; b++) {
    let x = 0;
    for (const row of state) {
      const lever = row[x]!;
      const goRight = lever.dir === 1;
      if (lever.toggle) lever.dir = goRight ? 0 : 1;
      if (goRight) x++;
    }
    cups.push(x);
  }
  return cups;
}

function forEachPuzzle(fn: (p: MarbleDropPuzzle, d: Difficulty, index: number) => void) {
  for (const d of DIFFICULTIES) {
    for (let s = 0; s < SEEDS; s++) {
      const seed = seedOf(s);
      fn(marbleDrop.generate(seed, s % 20, d), d, s % 20);
    }
  }
}

// Duyệt hàng nghìn câu: nới thời gian chờ để không trượt khi máy bận chạy song song các file test.
describe("marble-drop", { timeout: 60_000 }, () => {
  it("tất định: cùng (seed, index, độ khó) → cùng câu đố", () => {
    for (const d of DIFFICULTIES) {
      for (let s = 0; s < 200; s++) {
        expect(marbleDrop.generate(seedOf(s), s % 25, d)).toEqual(
          marbleDrop.generate(seedOf(s), s % 25, d),
        );
      }
    }
  });

  it("câu cố định không đổi (đổi cách sinh câu đố phải là cố ý)", () => {
    // Ký hiệu: L/R = chỉ trái/phải, T = công tắc; mỗi chuỗi là một tầng, từ trái sang phải.
    const short = (p: MarbleDropPuzzle) =>
      p.levers.map((row) => row.map((l) => (l.toggle ? "T" : "") + (l.dir ? "R" : "L")).join(" "));
    const mam = marbleDrop.generate(777, 5, 0);
    expect(short(mam)).toEqual(["R", "R R"]);
    expect(mam.paths).toEqual([[0, 1, 2]]);
    expect(mam.answer).toBe(2);
    const sieuKho = marbleDrop.generate(777, 5, 3);
    expect(short(sieuKho)).toEqual(["TR", "L TL", "R L R", "R L L TR"]);
    expect(sieuKho.paths).toEqual([
      [0, 1, 1, 1, 1],
      [0, 0, 0, 1, 1],
      [0, 1, 2, 3, 4],
    ]);
    expect(sieuKho.answer).toBe(4);
  });

  // Các ca 10.000 câu gom lỗi bằng JS thường rồi so một lần: gọi `expect` hàng trăm nghìn lần
  // làm test chậm gấp chục lần.
  it("mọi câu đố có đúng MỘT đáp án, khớp mô phỏng độc lập (10.000 câu)", () => {
    const errors: string[] = [];
    forEachPuzzle((p, d, index) => {
      const where = `mức ${d}, câu ${index}`;
      // Thử mọi cốc 0–4, cả cốc không có trên bảng (vd. cốc 4 ở Thường).
      const correct = [0, 1, 2, 3, 4].filter((i) => marbleDrop.check(p, i));
      if (correct.length !== 1 || correct[0] !== p.answer) errors.push(`${where}: ${correct}`);
      if (!marbleDrop.isAnswer(p.answer)) errors.push(`${where}: isAnswer từ chối đáp án`);
      const cups = referenceCups(p.levers, p.balls);
      if (p.answer !== cups[p.balls - 1]) errors.push(`${where}: lệch mô phỏng độc lập`);
      if (p.paths.some((path, b) => path[p.tiers] !== cups[b])) errors.push(`${where}: paths`);
    });
    expect(errors).toEqual([]);
  });

  it("hình dạng câu đố đúng bảng tham số", () => {
    const errors: string[] = [];
    forEachPuzzle((p, d, index) => {
      const spec = SPEC[d];
      const where = `mức ${d}, câu ${index}`;
      if (p.tiers !== spec.tiers || p.cups !== spec.tiers + 1 || p.balls !== spec.balls) {
        errors.push(`${where}: tham số`);
      }
      const rowsOk =
        p.levers.length === spec.tiers &&
        p.levers.every(
          (row, r) => row.length === r + 1 && row.every((l) => l.dir === 0 || l.dir === 1),
        );
      if (!rowsOk) errors.push(`${where}: hình bảng`);
      if (p.levers.flat().filter((l) => l.toggle).length !== spec.toggles) {
        errors.push(`${where}: số công tắc`);
      }
      // Câu chẵn dùng bảng chẵn, câu lẻ dùng bảng lẻ (chống hai câu liền nhau trùng bảng).
      if (marbleBoardParity(p.levers) !== index % 2) errors.push(`${where}: chẵn lẻ`);
      // Đường đi: bắt đầu ở chạc đỉnh, mỗi tầng đi xuống trái (+0) hoặc phải (+1).
      const pathsOk =
        p.paths.length === spec.balls &&
        p.paths.every(
          (path) =>
            path.length === spec.tiers + 1 &&
            path[0] === 0 &&
            path.slice(1).every((x, r) => x - path[r]! === 0 || x - path[r]! === 1),
        );
      if (!pathsOk) errors.push(`${where}: hình đường đi`);
      if (JSON.stringify(p.paths) !== JSON.stringify(simulateMarbleDrop(p.levers, p.balls))) {
        errors.push(`${where}: paths khác simulateMarbleDrop`);
      }
    });
    expect(errors).toEqual([]);
  });

  it("nhiều bi: bi được hỏi qua ≥ 1 công tắc đã lật và rơi khác cốc mọi bi trước", () => {
    const errors: string[] = [];
    forEachPuzzle((p, d, index) => {
      if (p.balls === 1) return;
      const where = `mức ${d}, câu ${index}`;
      const last = p.balls - 1;
      if (marbleFlippedOnPath(p.levers, p.paths, last) < 1) errors.push(`${where}: không lật`);
      if (p.paths.slice(0, last).some((path) => path[p.tiers] === p.answer)) {
        errors.push(`${where}: trùng cốc bi trước`);
      }
      // Hướng cần gạt trước mỗi bi khớp đường đi của bi đó.
      for (let b = 0; b < p.balls; b++) {
        const dirs = marbleLeverDirsBefore(p.levers, p.paths, b);
        const path = p.paths[b]!;
        if (path.slice(1).some((x, r) => x - path[r]! !== dirs[r]![path[r]!])) {
          errors.push(`${where}: marbleLeverDirsBefore lệch bi ${b}`);
        }
      }
      // Bẫy "quên công tắc": lần theo bảng lúc hiện câu luôn ra cốc sai.
      const frozen = p.levers.map((row) => row.map((l) => ({ dir: l.dir, toggle: false })));
      if (referenceCups(frozen, 1)[0] === p.answer) errors.push(`${where}: quên công tắc vẫn đúng`);
    });
    expect(errors).toEqual([]);
  });

  it("hai câu liền nhau không bao giờ cùng bảng", () => {
    let repeats = 0;
    for (const d of DIFFICULTIES) {
      for (let s = 0; s < 300; s++) {
        let prev = JSON.stringify(marbleDrop.generate(seedOf(s), 0, d).levers);
        for (let i = 1; i < 25; i++) {
          const cur = JSON.stringify(marbleDrop.generate(seedOf(s), i, d).levers);
          if (cur === prev) repeats++;
          prev = cur;
        }
      }
    }
    expect(repeats).toBe(0);
  });

  it("không thiên vị cốc: mỗi cốc là đáp án lệch ≤ 15 % so với trung bình", () => {
    for (const d of DIFFICULTIES) {
      const counts = new Array<number>(SPEC[d].tiers + 1).fill(0);
      for (let s = 0; s < 10_000; s++) counts[marbleDrop.generate(seedOf(s), s % 20, d).answer]!++;
      const mean = 10_000 / counts.length;
      for (const c of counts) expect(Math.abs(c - mean) / mean).toBeLessThanOrEqual(0.15);
    }
  });

  it("khó dần theo độ khó (đo được)", () => {
    const stats = DIFFICULTIES.map((d) => {
      let decisions = 0;
      let togglesTouched = 0;
      const boards = new Set<string>();
      for (let s = 0; s < SEEDS; s++) {
        const p = marbleDrop.generate(seedOf(s), s % 20, d);
        // Số lần đọc cần gạt khi lần theo mọi bi.
        decisions += p.balls * p.tiers;
        for (let r = 0; r < p.tiers; r++) {
          p.levers[r]!.forEach((lever, i) => {
            if (lever.toggle && p.paths.some((path) => path[r] === i)) togglesTouched++;
          });
        }
        boards.add(JSON.stringify(p.levers));
      }
      return {
        cups: SPEC[d].tiers + 1,
        decisions: decisions / SEEDS,
        togglesTouched: togglesTouched / SEEDS,
        boards: boards.size,
      };
    });
    for (let d = 1; d < stats.length; d++) {
      const prev = stats[d - 1]!;
      const cur = stats[d]!;
      expect(cur.cups).toBeGreaterThanOrEqual(prev.cups);
      expect(cur.decisions).toBeGreaterThan(prev.decisions);
      expect(cur.togglesTouched).toBeGreaterThanOrEqual(prev.togglesTouched);
      expect(cur.boards).toBeGreaterThanOrEqual(prev.boards);
    }
    // Siêu khó phải ghi nhớ nhiều lần lật công tắc hơn hẳn Khó.
    expect(stats[3]!.togglesTouched).toBeGreaterThan(stats[2]!.togglesTouched + 0.5);
  });

  it("bảng dự phòng hợp lệ ở mọi mức, cả hai chiều gương", () => {
    for (const d of DIFFICULTIES) {
      for (const mirror of [false, true]) {
        const levers = marbleFallbackBoard(d, mirror);
        const { balls, toggles, tiers } = SPEC[d];
        expect(levers.flat().filter((l) => l.toggle)).toHaveLength(toggles);
        const paths = simulateMarbleDrop(levers, balls);
        const cups = paths.map((path) => path[tiers]);
        expect(new Set(cups).size).toBe(balls);
        if (balls > 1) expect(marbleFlippedOnPath(levers, paths, balls - 1)).toBeGreaterThan(0);
        // Tầng cuối luôn có cần gạt không bi nào đi qua, để đổi chẵn lẻ mà giữ nguyên đáp án.
        const r = tiers - 1;
        expect(levers[r]!.some((_, pos) => paths.every((path) => path[r] !== pos))).toBe(true);
      }
    }
  });

  it("simulateMarbleDrop không sửa bảng đầu vào", () => {
    const p = marbleDrop.generate(42, 3, 3);
    const before = JSON.stringify(p.levers);
    simulateMarbleDrop(p.levers, 3);
    expect(JSON.stringify(p.levers)).toBe(before);
  });

  it("isAnswer() chỉ nhận số nguyên 0–4", () => {
    for (const ok of [0, 1, 2, 3, 4]) expect(marbleDrop.isAnswer(ok)).toBe(true);
    for (const bad of [
      -1,
      5,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "0",
      null,
      undefined,
      [0],
      {},
    ]) {
      expect(marbleDrop.isAnswer(bad)).toBe(false);
    }
  });

  it("hệ số và miễn trừ thời gian hợp lệ (CR-006)", () => {
    const m = marbleDrop.difficultyMultiplier!;
    for (let d = 1; d < 4; d++) {
      expect(m[d as Difficulty]).toBeGreaterThanOrEqual(m[(d - 1) as Difficulty]);
    }
    expect(m[1]).toBe(1);
    for (const d of DIFFICULTIES) {
      const ms = marbleDrop.speedAllowanceMs!(marbleDrop.generate(1, 0, d), d);
      expect(Number.isInteger(ms)).toBe(true);
      expect(ms).toBeGreaterThanOrEqual(0);
      expect(ms).toBeLessThan(marbleDrop.durationMs);
    }
  });
});
