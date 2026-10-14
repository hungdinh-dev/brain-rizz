import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import { createRng, deriveSeed } from "../../rng";
import {
  CUBE_COUNT_LEVELS,
  CUBE_COUNT_OPTIONS,
  type CubeCountHeights,
  type CubeCountPuzzle,
  cubeCount,
  cubeCountStats,
  isValidCubeCountModel,
} from "./cube-count";
import { CUBE_COUNT_FALLBACK, CUBE_COUNT_MAX_ATTEMPTS, sampleCubeCountHeights } from "./model";

const SEEDS = 10_000;
/** Test chạy hết 10.000 seed × 4 mức cần hơn 5 giây mặc định. */
const SLOW = 60_000;
const seedOf = (i: number) => Math.imul(i + 1, 0x9e3779b1) >>> 0;

/** Mọi câu của 10.000 seed ở một mức (ghi nhớ để các test dùng chung). */
const cache = new Map<Difficulty, CubeCountPuzzle[]>();
function puzzles(d: Difficulty): CubeCountPuzzle[] {
  let list = cache.get(d);
  if (!list) {
    list = [];
    for (let i = 0; i < SEEDS; i++) list.push(cubeCount.generate(seedOf(i), i % 25, d));
    cache.set(d, list);
  }
  return list;
}

// ---------------------------------------------------------------------------------------------
// Vẽ thử bằng lưới tam giác isometric: mỗi mặt khối là hình thoi = 2 tam giác đơn vị. Toạ độ màn
// hình X (đơn vị 48,5 px), Y (đơn vị 28 px): +c → (+1, +1), +r → (−1, +1), +k → (0, −2). Mỗi tam
// giác được gọi bằng trọng tâm (3X, Y) nguyên. Vẽ bệ trước, rồi các khối theo c + r + k tăng dần
// (khối gần mắt vẽ sau, đè lên), như FE sẽ vẽ.
// ---------------------------------------------------------------------------------------------

type Face = "floor" | "top" | "left" | "right";
interface Pixel {
  face: Face;
  /** Khối sở hữu tam giác: "r,c,k"; bệ là "floor". */
  owner: string;
}

function faceTriangles(
  r: number,
  c: number,
  k: number,
): Record<"top" | "left" | "right", string[]> {
  const x = c - r;
  const y = c + r - 2 * k;
  return {
    top: [`${3 * x - 1},${y - 1}`, `${3 * x + 1},${y - 1}`],
    left: [`${3 * x - 2},${y}`, `${3 * x - 1},${y + 1}`],
    right: [`${3 * x + 2},${y}`, `${3 * x + 1},${y + 1}`],
  };
}

function render(h: CubeCountHeights): Map<string, Pixel> {
  const depth = h.length;
  const width = h[0]!.length;
  const img = new Map<string, Pixel>();
  for (let r = 0; r < depth; r++) {
    for (let c = 0; c < width; c++) {
      // Mặt bệ của ô (r, c) = mặt trên của một khối ảo ở tầng −1.
      for (const t of faceTriangles(r, c, -1).top) img.set(t, { face: "floor", owner: "floor" });
    }
  }
  const cubes: [number, number, number][] = [];
  for (let r = 0; r < depth; r++) {
    for (let c = 0; c < width; c++) {
      for (let k = 0; k < h[r]![c]!; k++) cubes.push([r, c, k]);
    }
  }
  cubes.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  for (const [r, c, k] of cubes) {
    const tri = faceTriangles(r, c, k);
    for (const face of ["top", "left", "right"] as const) {
      for (const t of tri[face]) img.set(t, { face, owner: `${r},${c},${k}` });
    }
  }
  return img;
}

/** Hình người chơi thấy: loại mặt (màu) ở từng tam giác. */
function signature(h: CubeCountHeights): string {
  return [...render(h).entries()]
    .map(([t, p]) => `${t}:${p.face}`)
    .sort()
    .join("|");
}

/** Mọi mô hình bậc thang trên bệ depth × width, cột cao tối đa maxH. */
function allStaircases(depth: number, width: number, maxH: number): number[][][] {
  const out: number[][][] = [];
  const h = Array.from({ length: depth }, () => new Array<number>(width).fill(0));
  const rec = (i: number) => {
    if (i === depth * width) {
      out.push(h.map((row) => row.slice()));
      return;
    }
    const r = Math.floor(i / width);
    const c = i % width;
    const m = Math.min(r > 0 ? h[r - 1]![c]! : maxH, c > 0 ? h[r]![c - 1]! : maxH);
    for (let v = 0; v <= m; v++) {
      h[r]![c] = v;
      rec(i + 1);
    }
    h[r]![c] = 0;
  };
  rec(0);
  return out;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("cube-count: mô hình", () => {
  it("câu ví dụ trong đặc tả (bản mẫu M12, mức Thường): 11 khối, 4 bị che, 7 thấy", () => {
    const h = [
      [3, 2, 1],
      [2, 1, 0],
      [1, 1, 0],
    ];
    expect(cubeCountStats(h)).toEqual({
      total: 11,
      hidden: 4,
      visible: 7,
      columns: 7,
      empty: 2,
      tallest: 3,
    });
    expect(isValidCubeCountModel(h, 1)).toBe(true);
  });

  it("mô hình dự phòng (các câu ví dụ của bản mẫu) thoả ràng buộc của mức", () => {
    for (const d of DIFFICULTIES)
      expect(isValidCubeCountModel(CUBE_COUNT_FALLBACK[d], d)).toBe(true);
    expect(DIFFICULTIES.map((d) => cubeCountStats(CUBE_COUNT_FALLBACK[d]).total)).toEqual([
      5, 11, 17, 23,
    ]);
  });

  it("isValidCubeCountModel từ chối khối lơ lửng / cột trước cao hơn cột sau", () => {
    const base = [
      [3, 2, 1],
      [2, 1, 0],
      [1, 1, 0],
    ];
    expect(isValidCubeCountModel(base, 1)).toBe(true);
    const taller = base.map((row) => row.slice());
    taller[2]![2] = 1; // ô (2,2) cao hơn ô sau nó (1,2) = 0
    expect(isValidCubeCountModel(taller, 1)).toBe(false);
    const wrongSize = [
      [3, 2],
      [2, 1],
    ];
    expect(isValidCubeCountModel(wrongSize, 1)).toBe(false);
  });

  it(
    "số khối bị che khớp với hình vẽ thật; mặt trên mọi cột luôn thấy trọn (2.000 seed × 4 mức)",
    () => {
      const bad: string[] = [];
      for (const d of DIFFICULTIES) {
        for (const p of puzzles(d).slice(0, 2_000)) {
          const img = render(p.heights);
          const seen = new Set([...img.values()].map((px) => px.owner));
          seen.delete("floor");
          if (seen.size !== cubeCountStats(p.heights).visible) bad.push(`visible ${p.heights}`);
          p.heights.forEach((row, r) => {
            row.forEach((h, c) => {
              if (h === 0) return;
              for (const t of faceTriangles(r, c, h - 1).top) {
                const px = img.get(t);
                if (px?.face !== "top" || px.owner !== `${r},${c},${h - 1}`)
                  bad.push(`top ${p.heights}`);
              }
            });
          });
        }
      }
      expect(bad).toEqual([]);
    },
    SLOW,
  );

  it(
    "mỗi hình vẽ ứng với đúng một mô hình: mọi mô hình bậc thang trên bệ của Mầm, Thường, Khó cho hình khác nhau",
    () => {
      for (const d of [0, 1, 2] as const) {
        const lv = CUBE_COUNT_LEVELS[d];
        const models = allStaircases(lv.depth, lv.width, lv.maxHeight);
        const sigs = new Set(models.map(signature));
        expect(sigs.size).toBe(models.length);
      }
    },
    SLOW,
  );
});

describe("cube-count: tất định", () => {
  it(
    "cùng (seed, index, độ khó) → cùng câu đố, không phụ thuộc thứ tự gọi (10.000 seed × 4 mức)",
    () => {
      let mismatches = 0;
      for (const d of [...DIFFICULTIES].reverse()) {
        const first = puzzles(d);
        for (let i = 0; i < SEEDS; i++) {
          const again = cubeCount.generate(seedOf(i), i % 25, d);
          if (JSON.stringify(again) !== JSON.stringify(first[i])) mismatches++;
        }
      }
      expect(mismatches).toBe(0);
    },
    SLOW,
  );

  it("index khác → câu khác (đa dạng)", () => {
    for (const d of DIFFICULTIES) {
      const keys = new Set(
        Array.from({ length: 30 }, (_, i) => JSON.stringify(cubeCount.generate(99, i, d))),
      );
      // Mầm chỉ có 11 mô hình nên ngưỡng thấp hơn; thẻ số vẫn đổi theo câu.
      expect(keys.size).toBeGreaterThan(d === 0 ? 12 : 25);
    }
  });

  it("sửa câu đố đã trả về không làm đổi câu đố sau", () => {
    const a = cubeCount.generate(7, 1, 3);
    a.heights[0]![0] = 99;
    a.options.push(1);
    expect(cubeCount.generate(7, 1, 3).heights[0]![0]).not.toBe(99);
    expect(cubeCount.generate(7, 1, 3).options).toHaveLength(4);
  });

  it("đầu ra cố định (đổi thứ tự gọi rng là đổi câu đố của mọi seed)", () => {
    expect(cubeCount.generate(42, 3, 0)).toEqual({
      depth: 2,
      width: 3,
      heights: [
        [2, 2, 1],
        [1, 0, 0],
      ],
      options: [4, 5, 6, 8],
      kinds: ["near", "visible", "answer", "near"],
      answerIndex: 2,
    });
    expect(cubeCount.generate(42, 3, 2)).toEqual({
      depth: 3,
      width: 4,
      heights: [
        [3, 2, 2, 0],
        [3, 2, 1, 0],
        [2, 2, 1, 0],
      ],
      options: [12, 18, 20, 24],
      kinds: ["visible", "answer", "near", "double"],
      answerIndex: 1,
    });
  });
});

describe("cube-count: 10.000 seed mỗi mức", () => {
  /** Kiểm từng câu, gom lỗi rồi so một lần (expect trong vòng lặp 40.000 câu quá chậm). */
  function failures(
    check: (p: CubeCountPuzzle, d: Difficulty, i: number) => string | null,
  ): string[] {
    const out: string[] = [];
    for (const d of DIFFICULTIES) {
      puzzles(d).forEach((p, i) => {
        const msg = check(p, d, i);
        if (msg && out.length < 5) out.push(`mức ${d}, seed #${i}: ${msg} ${JSON.stringify(p)}`);
      });
    }
    return out;
  }

  it(
    "đúng MỘT đáp án, là tổng số khối; 4 thẻ khác nhau, ≥ 1, tăng dần",
    () => {
      const bad = failures((p) => {
        const s = cubeCountStats(p.heights);
        if (p.options.length !== CUBE_COUNT_OPTIONS || p.kinds.length !== CUBE_COUNT_OPTIONS)
          return "số thẻ";
        for (let i = 1; i < p.options.length; i++) {
          if (!(p.options[i]! > p.options[i - 1]!)) return "không tăng dần";
        }
        if (!p.options.every((v) => Number.isInteger(v) && v >= 1)) return "số không hợp lệ";
        const correct = p.options.map((_, i) => i).filter((i) => cubeCount.check(p, i));
        if (correct.length !== 1 || correct[0] !== p.answerIndex) return "không đúng một đáp án";
        if (p.options[p.answerIndex] !== s.total) return "đáp án khác tổng số khối";
        return null;
      });
      expect(bad).toEqual([]);
    },
    SLOW,
  );

  it(
    "mô hình thoả mọi ràng buộc của mức, không bao giờ phải dùng mô hình dự phòng",
    () => {
      const maxAttempts = [0, 0, 0, 0];
      const bad = failures((p, d, i) => {
        const lv = CUBE_COUNT_LEVELS[d];
        if (p.depth !== lv.depth || p.width !== lv.width) return "cỡ bệ";
        if (!isValidCubeCountModel(p.heights, d)) return "sai ràng buộc";
        const replay = sampleCubeCountHeights(createRng(deriveSeed(seedOf(i), i % 25)), d);
        if (JSON.stringify(replay.heights) !== JSON.stringify(p.heights)) return "phát lại khác";
        maxAttempts[d] = Math.max(maxAttempts[d]!, replay.attempts);
        return null;
      });
      expect(bad).toEqual([]);
      for (const n of maxAttempts) expect(n).toBeLessThan(CUBE_COUNT_MAX_ATTEMPTS / 2);
    },
    SLOW,
  );

  it("loại thẻ đúng: 'visible' = số khối thấy, có khi đáp án không phải số nhỏ nhất; 'double' = tổng + số khối che", () => {
    const bad = failures((p) => {
      const s = cubeCountStats(p.heights);
      for (let i = 0; i < p.options.length; i++) {
        const v = p.options[i]!;
        const kind = p.kinds[i];
        if (v === s.total) {
          if (kind !== "answer") return "answer";
        } else if (v === s.visible) {
          if (kind !== "visible") return "visible";
        } else if (kind === "double") {
          if (v !== s.total + s.hidden || s.hidden < 3) return "double";
        } else if (kind !== "near" || Math.abs(v - s.total) > 3) return "near";
      }
      if (p.kinds.includes("visible") !== p.answerIndex >= 1) return "thẻ số khối thấy";
      return null;
    });
    expect(bad).toEqual([]);
  });

  it("không thiên vị vị trí: đáp án ở mỗi ô lệch ≤ 10 % so với 1/4", () => {
    for (const d of DIFFICULTIES) {
      const count = [0, 0, 0, 0];
      for (const p of puzzles(d)) count[p.answerIndex]!++;
      for (const n of count) expect(Math.abs(n - SEEDS / 4)).toBeLessThan(SEEDS / 40);
    }
  });

  it("độ khó tăng dần, đo được: tổng khối, khối bị che, số cột tăng; khoảng tổng và khối che không chồng nhau", () => {
    const stat = DIFFICULTIES.map((d) => puzzles(d).map((p) => cubeCountStats(p.heights)));
    for (const key of ["total", "hidden", "columns", "tallest"] as const) {
      const means = stat.map((list) => mean(list.map((s) => s[key])));
      for (let i = 1; i < means.length; i++) expect(means[i]!).toBeGreaterThan(means[i - 1]!);
    }
    for (let d = 1; d < stat.length; d++) {
      const prev = stat[d - 1]!;
      const cur = stat[d]!;
      expect(Math.min(...cur.map((s) => s.total))).toBeGreaterThan(
        Math.max(...prev.map((s) => s.total)),
      );
      expect(Math.min(...cur.map((s) => s.hidden))).toBeGreaterThan(
        Math.max(...prev.map((s) => s.hidden)),
      );
    }
    // Siêu khó luôn có ô trống trên bệ.
    expect(Math.min(...stat[3]!.map((s) => s.empty))).toBeGreaterThanOrEqual(1);
  });
});

describe("cube-count: chấm và kiểm kiểu", () => {
  it("isAnswer() chỉ nhận số nguyên 0–3", () => {
    for (const v of [0, 1, 2, 3]) expect(cubeCount.isAnswer(v)).toBe(true);
    for (const v of [
      -1,
      4,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "0",
      null,
      undefined,
      [0],
      {},
    ]) {
      expect(cubeCount.isAnswer(v)).toBe(false);
    }
  });

  it("check() chỉ nhận đúng chỉ số đáp án", () => {
    const p = cubeCount.generate(5, 0, 1);
    for (let i = 0; i < CUBE_COUNT_OPTIONS; i++) {
      expect(cubeCount.check(p, i)).toBe(i === p.answerIndex);
    }
  });

  it("khai báo CR-006: vòng 60 giây, hệ số theo mức không giảm, Thường = 1, không miễn trừ tốc độ", () => {
    expect(cubeCount.durationMs).toBe(60_000);
    expect(cubeCount.difficultyMultiplier).toEqual({ 0: 1, 1: 1, 2: 1.7, 3: 2.45 });
    const m = DIFFICULTIES.map((d) => cubeCount.difficultyMultiplier![d]);
    for (let i = 1; i < m.length; i++) expect(m[i]!).toBeGreaterThanOrEqual(m[i - 1]!);
    expect(cubeCount.speedAllowanceMs).toBeUndefined();
  });
});
