import { describe, expect, it } from "vitest";
import {
  blurForSpeed,
  centerRow,
  DRUM_MIN_SPIN_ROWS,
  drumFrame,
  drumRadius,
  drumRows,
  easeOutQuart,
  idlePos,
  mod,
  spinEnd,
  spinSpeed,
} from "./drum";

const SPIN_MS = 4_000;

describe("trống quay dọc: hình học (ui-ux 6.7)", () => {
  it("bán kính trụ theo cao dòng: 183 px (dòng 64), 149 px (dòng 52)", () => {
    expect(drumRadius(64)).toBeCloseTo(183.3, 1);
    expect(drumRadius(52)).toBeCloseTo(149, 0);
  });

  it("dòng giữa ở tâm, các dòng cách 20°, chỉ vẽ |θ| ≤ 80°", () => {
    const rows = drumRows(10, 29, 64);
    expect(rows.map((r) => r.key)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14]);
    const mid = rows.find((r) => r.key === 10)!;
    expect(mid.d).toBe(0);
    expect(mid.deg).toBe(0);
    expect(mid.y).toBeCloseTo(0, 6);
    expect(mid.opacity).toBe(1);
    for (const r of rows) expect(Math.abs(r.deg)).toBeLessThanOrEqual(80);
    // Lệch nửa dòng: dòng ±4,5 (90°) không vẽ.
    expect(drumRows(10.5, 29, 64).map((r) => r.key)).toEqual([7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it("y = R·sin θ, phía trên âm; độ mờ cos(θ)^1,5: ±1 → 0,91, ±2 → 0,67, ±3 → 0,35", () => {
    const rows = drumRows(0, 29, 64);
    const at = (d: number) => rows.find((r) => r.d === d)!;
    expect(at(-1).y).toBeLessThan(0);
    expect(at(1).y).toBeCloseTo(drumRadius(64) * Math.sin((20 * Math.PI) / 180), 6);
    expect(at(1).y).toBeCloseTo(-at(-1).y, 6);
    expect(at(1).opacity).toBeCloseTo(0.91, 2);
    expect(at(-2).opacity).toBeCloseTo(0.67, 2);
    expect(at(3).opacity).toBeCloseTo(0.35, 2);
  });

  it("dòng âm và dòng vượt N vẫn ra game hợp lệ (cuộn vô hạn)", () => {
    expect(mod(-1, 29)).toBe(28);
    expect(mod(58, 29)).toBe(0);
    const rows = drumRows(0.2, 5, 52);
    for (const r of rows) {
      expect(r.index).toBeGreaterThanOrEqual(0);
      expect(r.index).toBeLessThan(5);
      expect(r.index).toBe(mod(r.key, 5));
    }
    // Trống ít game: một game hiện nhiều lần nhưng khoá dòng không trùng.
    const few = drumRows(3, 2, 52);
    expect(new Set(few.map((r) => r.key)).size).toBe(few.length);
  });

  it("không có game thì không có dòng", () => {
    expect(drumRows(0, 0, 64)).toEqual([]);
    expect(drumRows(Number.NaN, 29, 64)).toEqual([]);
  });
});

describe("trống quay dọc: chuyển động theo giờ server", () => {
  it("chờ quay: trôi 0,8 dòng/giây, cùng giờ server thì cùng vị trí", () => {
    expect(idlePos(0, 29)).toBe(0);
    expect(idlePos(1_250, 29)).toBeCloseTo(1, 9);
    expect(idlePos(10_000, 29) - idlePos(8_750, 29)).toBeCloseTo(1, 9);
    expect(idlePos(29 * 1_250, 29)).toBeCloseTo(0, 6);
    const now = 1_795_000_123_456;
    expect(idlePos(now, 29)).toBe(idlePos(now, 29));
    expect(idlePos(now, 29)).toBeGreaterThanOrEqual(0);
    expect(idlePos(now, 29)).toBeLessThan(29);
  });

  it("điểm dừng: game trúng ở giữa dải, quãng quay 45 → 45 + N − 1 dòng", () => {
    for (const count of [2, 7, 29]) {
      for (let target = 0; target < count; target++) {
        for (const start of [0, 0.4, 3.7, count - 0.01]) {
          const end = spinEnd(start, target, count);
          expect(mod(end, count)).toBeCloseTo(target, 9);
          expect(end - start).toBeGreaterThanOrEqual(DRUM_MIN_SPIN_ROWS);
          expect(end - start).toBeLessThan(DRUM_MIN_SPIN_ROWS + count);
        }
      }
    }
  });

  it("easeOutQuart: 0 → 1, chậm dần", () => {
    expect(easeOutQuart(0)).toBe(0);
    expect(easeOutQuart(1)).toBe(1);
    expect(easeOutQuart(0.5)).toBeCloseTo(0.9375, 9);
  });

  it("tốc độ và nhoè: nhanh lúc đầu (2,5 px), chậm dần (1,2 px), cuối thì nét", () => {
    // Quãng 58 dòng trong 4 giây: đầu vòng 58 dòng/giây.
    expect(spinSpeed(0, 58, 0, SPIN_MS)).toBeCloseTo(58, 9);
    expect(spinSpeed(0, 58, 1, SPIN_MS)).toBe(0);
    expect(blurForSpeed(58)).toBe(2.5);
    expect(blurForSpeed(25)).toBe(2.5);
    expect(blurForSpeed(24.9)).toBe(1.2);
    expect(blurForSpeed(10)).toBe(1.2);
    expect(blurForSpeed(9.9)).toBe(0);
  });

  it("một lần quay: trước giờ quay vẫn trôi, quay liền mạch, dừng đúng game; vào giữa chừng ra đúng chỗ", () => {
    const count = 29;
    const target = 17;
    const spinAt = 1_795_000_000_000;
    const input = { spinAt, spinMs: SPIN_MS, count, target, reduced: false };

    const idle = drumFrame(spinAt - 1_000, { ...input, spinAt: 0 });
    expect(idle.phase).toBe("idle");
    expect(idle.pos).toBeCloseTo(idlePos(spinAt - 1_000, count), 9);

    const lead = drumFrame(spinAt - 100, input);
    expect(lead.phase).toBe("spinning");
    expect(lead.pos).toBeCloseTo(idlePos(spinAt - 100, count), 9);

    const start = idlePos(spinAt, count);
    expect(drumFrame(spinAt + 1, input).pos).toBeCloseTo(start, 0);

    let prev = start;
    for (let t = 100; t < SPIN_MS; t += 100) {
      const f = drumFrame(spinAt + t, input);
      expect(f.phase).toBe("spinning");
      expect(f.pos).toBeGreaterThan(prev);
      prev = f.pos;
    }
    expect(drumFrame(spinAt + 50, input).blur).toBe(2.5);

    const landed = drumFrame(spinAt + SPIN_MS, input);
    expect(landed.phase).toBe("landed");
    expect(landed.blur).toBe(0);
    expect(mod(centerRow(landed.pos), count)).toBe(target);
    expect(landed.pos).toBe(spinEnd(start, target, count));
    // Vào lại sau khi đã quay xong: hiện thẳng kết quả.
    expect(drumFrame(spinAt + 60_000, input)).toEqual(landed);
  });

  it("giảm chuyển động: đứng yên ở 0, tới giờ thì nhảy thẳng tới game trúng", () => {
    const input = { spinAt: 5_000, spinMs: SPIN_MS, count: 29, target: 8, reduced: true };
    expect(drumFrame(1_000, { ...input, spinAt: 0 })).toEqual({ phase: "idle", pos: 0, blur: 0 });
    expect(drumFrame(6_000, input)).toEqual({ phase: "spinning", pos: 0, blur: 0 });
    expect(drumFrame(9_000, input)).toEqual({ phase: "landed", pos: 8, blur: 0 });
  });

  it("dòng giữa dải đổi đúng lúc một dòng đi qua kim (tiếng tick)", () => {
    expect(centerRow(3.49)).toBe(3);
    expect(centerRow(3.5)).toBe(4);
    expect(centerRow(-0.4)).toBe(0);
  });
});
