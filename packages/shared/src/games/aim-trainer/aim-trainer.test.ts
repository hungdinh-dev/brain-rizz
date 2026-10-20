import { afterEach, describe, expect, it, vi } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../difficulty";
import {
  AIM_FIELD,
  AIM_TRAINER_MISS,
  type AimPoint,
  type AimTrainerPuzzle,
  aimTrainer,
  aimTrainerHitTest,
} from "./aim-trainer";

/** Bảng mức trong đặc tả (docs/04-minigames/aim-trainer.md, mục Độ khó). */
const SPEC: Record<
  Difficulty,
  { r: number; hitR: number; lifeMs: number; shrinkTo: number; minJump: number }
> = {
  0: { r: 110, hitR: 135, lifeMs: 0, shrinkTo: 100, minJump: 250 },
  1: { r: 80, hitR: 105, lifeMs: 1_500, shrinkTo: 100, minJump: 300 },
  2: { r: 65, hitR: 90, lifeMs: 1_300, shrinkTo: 40, minJump: 500 },
  3: { r: 55, hitR: 80, lifeMs: 1_500, shrinkTo: 40, minJump: 500 },
};

const SEEDS = 10_000;
/** Số câu liên tiếp mỗi seed: phủ ranh giới khối 8 câu (7 → 8, 15 → 16). */
const RUN = 18;

const dist = (a: AimPoint, b: AimPoint) => Math.hypot(a.x - b.x, a.y - b.y);

/** Câu bắt đầu của mỗi seed: xen kẽ đầu vòng và giữa vòng (index lớn). */
const startOf = (seed: number) => (seed % 4) * 40;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("aim-trainer", { timeout: 60_000 }, () => {
  it("tất định: cùng (seed, index, độ khó) → cùng câu đố, không dùng Math.random/Date.now", () => {
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random bị gọi");
    });
    vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("Date.now bị gọi");
    });
    for (const d of DIFFICULTIES) {
      for (let seed = 0; seed < SEEDS; seed++) {
        const i = (seed * 7) % 50;
        expect(aimTrainer.generate(seed, i, d)).toEqual(aimTrainer.generate(seed, i, d));
      }
    }
    // Sinh câu i không cần biết câu trước đã sinh hay chưa (thứ tự gọi không quan trọng).
    const forward = Array.from({ length: 30 }, (_, i) => aimTrainer.generate(42, i, 3));
    const backward = Array.from({ length: 30 }, (_, i) =>
      aimTrainer.generate(42, 29 - i, 3),
    ).reverse();
    expect(backward).toEqual(forward);
  });

  it("đúng một vùng chấm đúng, mọi ràng buộc vị trí đạt (10.000 seed × 4 độ khó × 18 câu)", () => {
    // Gom lỗi rồi so một lần: gọi expect hàng chục triệu lần quá chậm.
    const errors: string[] = [];
    const ensure = (ok: boolean, at: string, what: string) => {
      if (!ok && errors.length < 20) errors.push(`${at}: ${what}`);
    };
    for (const d of DIFFICULTIES) {
      const spec = SPEC[d];
      for (let seed = 0; seed < SEEDS; seed++) {
        const start = startOf(seed);
        let prev: AimTrainerPuzzle | null =
          start > 0 ? aimTrainer.generate(seed, start - 1, d) : null;
        for (let i = start; i < start + RUN; i++) {
          const p = aimTrainer.generate(seed, i, d);
          const at = `mức ${d} seed ${seed} câu ${i}`;

          // Thông số đúng bảng mức, toạ độ nguyên.
          ensure(p.r === spec.r && p.hitR === spec.hitR, at, "r/hitR sai bảng mức");
          ensure(
            p.lifeMs === spec.lifeMs && p.shrinkTo === spec.shrinkTo,
            at,
            "lifeMs/shrinkTo sai",
          );
          for (const q of [p, ...p.decoys]) {
            ensure(Number.isInteger(q.x) && Number.isInteger(q.y), at, "toạ độ không nguyên");
            // Vùng chấm nằm trọn trong khung.
            ensure(
              q.x - p.hitR >= 0 &&
                q.y - p.hitR >= 0 &&
                q.x + p.hitR <= AIM_FIELD.width &&
                q.y + p.hitR <= AIM_FIELD.height,
              at,
              "vùng chấm ra ngoài khung",
            );
          }

          // Đúng một vùng chấm đúng.
          const h = p.hitR;
          const a = Math.ceil((h + 1) / Math.SQRT2);
          ensure(aimTrainer.check(p, { x: p.x, y: p.y }), at, "tâm bia bị chấm sai");
          ensure(aimTrainer.check(p, { x: p.x + h, y: p.y }), at, "mép vùng chấm bị chấm sai");
          for (const [dx, dy] of [
            [h + 1, 0],
            [-(h + 1), 0],
            [0, h + 1],
            [0, -(h + 1)],
            [a, a],
            [a, -a],
            [-a, a],
            [-a, -a],
          ] as const) {
            ensure(!aimTrainer.check(p, { x: p.x + dx, y: p.y + dy }), at, "ngoài hitR vẫn đúng");
          }
          ensure(!aimTrainer.check(p, AIM_TRAINER_MISS), at, "bỏ lỡ được chấm đúng");
          for (const m of p.decoys) {
            ensure(!aimTrainer.check(p, m), at, "tâm mồi được chấm đúng");
            ensure(aimTrainerHitTest(p, m.x, m.y) === "decoy", at, "hitTest mồi sai");
          }
          ensure(aimTrainerHitTest(p, p.x, p.y) === "target", at, "hitTest bia sai");

          // Mồi: chỉ Siêu khó, 1–2 mồi, cách bia thật và cách nhau ≥ 220, cách bia trước ≥ 300.
          if (d === 3) {
            ensure(p.decoys.length >= 1 && p.decoys.length <= 2, at, "số mồi ngoài 1–2");
            p.decoys.forEach((m, k) => {
              ensure(dist(m, p) >= 220, at, "mồi quá gần bia");
              for (const other of p.decoys.slice(k + 1)) {
                ensure(dist(m, other) >= 220, at, "hai mồi quá gần nhau");
              }
              ensure(!prev || dist(m, prev) >= 300, at, "mồi quá gần bia câu trước");
            });
          } else {
            ensure(p.decoys.length === 0, at, "có mồi ở mức không phải Siêu khó");
          }

          // Bia cách bia câu trước ≥ minJump, kể cả ở ranh giới khối.
          ensure(!prev || dist(p, prev) >= spec.minJump, at, "bia quá gần bia câu trước");
          prev = p;
        }
      }
    }
    expect(errors).toEqual([]);
  });

  it("Siêu khó: câu 1 mồi và câu 2 mồi mỗi loại ~50 % (lệch < 5 %)", () => {
    let two = 0;
    let total = 0;
    for (let seed = 0; seed < SEEDS; seed++) {
      for (let i = 0; i < 4; i++) {
        if (aimTrainer.generate(seed, i, 3).decoys.length === 2) two++;
        total++;
      }
    }
    expect(Math.abs(two / total - 0.5)).toBeLessThan(0.05);
  });

  it("vị trí bia phân bố đều theo 4 phần tư khung (lệch < 15 %)", () => {
    for (const d of DIFFICULTIES) {
      const counts = [0, 0, 0, 0];
      let total = 0;
      for (let seed = 0; seed < SEEDS; seed++) {
        for (let i = 0; i < 8; i++) {
          const p = aimTrainer.generate(seed, i, d);
          const q = (p.x < AIM_FIELD.width / 2 ? 0 : 1) + (p.y < AIM_FIELD.height / 2 ? 0 : 2);
          counts[q] = (counts[q] ?? 0) + 1;
          total++;
        }
      }
      for (const c of counts) expect(Math.abs(c / (total / 4) - 1)).toBeLessThan(0.15);
    }
  });

  it("khó dần đo được: bia nhỏ dần, chỉ số Fitts trung bình tăng ngặt, Siêu khó thêm mồi", () => {
    const fitts = DIFFICULTIES.map((d) => {
      let sum = 0;
      let n = 0;
      for (let seed = 0; seed < SEEDS; seed++) {
        let prev = aimTrainer.generate(seed, 0, d);
        for (let i = 1; i < 12; i++) {
          const p = aimTrainer.generate(seed, i, d);
          sum += Math.log2(dist(p, prev) / (2 * p.hitR) + 1);
          n++;
          prev = p;
        }
      }
      return sum / n;
    });
    for (let k = 1; k < fitts.length; k++) {
      expect(fitts[k]).toBeGreaterThan(fitts[k - 1] as number);
    }
    const hitR = DIFFICULTIES.map((d) => aimTrainer.generate(1, 0, d).hitR);
    expect(hitR).toEqual([...hitR].sort((a, b) => b - a));
    expect(aimTrainer.generate(1, 0, 3).decoys.length).toBeGreaterThan(0);
  });

  it("hạn trả lời = lifeMs; Mầm không giới hạn", () => {
    for (const d of DIFFICULTIES) {
      const p = aimTrainer.generate(9, 3, d);
      expect(aimTrainer.answerWindowMs?.(p, d)).toBe(d === 0 ? undefined : SPEC[d].lifeMs);
    }
  });

  it("chạm hụt vào chỗ trống phân loại là 'none' (client không gửi)", () => {
    const p = aimTrainer.generate(5, 2, 3);
    const far = { x: p.x < 500 ? 990 : 10, y: p.y < 700 ? 1390 : 10 };
    const nearDecoy = p.decoys.some((m) => dist(m, far) <= p.hitR);
    if (!nearDecoy) expect(aimTrainerHitTest(p, far.x, far.y)).toBe("none");
  });

  it("isAnswer() chỉ nhận { x, y } nguyên trong khung hoặc bỏ lỡ { -1, -1 }", () => {
    expect(aimTrainer.isAnswer({ x: 0, y: 0 })).toBe(true);
    expect(aimTrainer.isAnswer({ x: 1000, y: 1400 })).toBe(true);
    expect(aimTrainer.isAnswer({ x: -1, y: -1 })).toBe(true);
    expect(aimTrainer.isAnswer({ x: -1, y: 0 })).toBe(false);
    expect(aimTrainer.isAnswer({ x: 1001, y: 5 })).toBe(false);
    expect(aimTrainer.isAnswer({ x: 5, y: 1401 })).toBe(false);
    expect(aimTrainer.isAnswer({ x: 1.5, y: 5 })).toBe(false);
    expect(aimTrainer.isAnswer({ x: "5", y: 5 })).toBe(false);
    expect(aimTrainer.isAnswer({ x: 5 })).toBe(false);
    expect(aimTrainer.isAnswer({ x: 5, y: 5, z: 1 })).toBe(false);
    expect(aimTrainer.isAnswer([5, 5])).toBe(false);
    expect(aimTrainer.isAnswer(null)).toBe(false);
    expect(aimTrainer.isAnswer(3)).toBe(false);
    expect(aimTrainer.isAnswer({ x: Number.NaN, y: 5 })).toBe(false);
  });
});
