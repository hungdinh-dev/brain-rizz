import { describe, expect, it } from "vitest";
import { BALANCE_SCRIPT } from "../../balance/BalanceDemo";
import { LIGHT_TRAIL_SCRIPT } from "../../light-trail/LightTrailDemo";
import { NUMBER_BALLOONS_SCRIPT } from "../../number-balloons/NumberBalloonsDemo";
import { ODD_ONE_OUT_SCRIPT } from "../../odd-one-out/OddOneOutDemo";
import { ROTATE_MATCH_SCRIPT } from "../../rotate-match/RotateMatchDemo";
import { type DemoScript, sample, scriptCss } from "./timeline";

/** Vòng lặp và mốc 3 bước theo UI-UX 6.11 (kịch bản 5 game MVP). */
const SPEC: [string, DemoScript, number, [number, number, number]][] = [
  ["odd-one-out", ODD_ONE_OUT_SCRIPT, 4800, [0, 1000, 2400]],
  ["light-trail", LIGHT_TRAIL_SCRIPT, 6000, [0, 2150, 4300]],
  ["balance", BALANCE_SCRIPT, 5400, [0, 1900, 2900]],
  ["number-balloons", NUMBER_BALLOONS_SCRIPT, 6200, [0, 1000, 3000]],
  ["rotate-match", ROTATE_MATCH_SCRIPT, 5500, [0, 1000, 2700]],
];

const at = (script: DemoScript, name: string, ms: number) => {
  const t = script.tracks[name];
  if (!t) throw new Error(`Thiếu làn ${name}`);
  return sample(t, ms);
};

describe("kịch bản 5 game", () => {
  it.each(SPEC)("%s: vòng lặp, bước, mờ vào/ra", (_name, script, T, steps) => {
    expect(script.T).toBe(T);
    expect([...script.steps]).toEqual(steps);
    expect(at(script, "scene", 0).o).toBe(0);
    expect(at(script, "scene", 300).o).toBe(1);
    expect(at(script, "scene", T - 600).o).toBe(1);
    expect(at(script, "scene", T - 300).o).toBe(0);
    // Tay rút ra ngoài sân khấu trước khi mờ ra.
    expect(at(script, "hand", T - 600)).toMatchObject({ x: 700, y: 430 });
    expect(() => scriptCss(script)).not.toThrow();
  });

  it("tiền tố keyframes không trùng giữa các game", () => {
    const ids = SPEC.map(([, s]) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Kẻ lạc đàn: khung 2.700 ms có ✓ + ⚡ của câu 2", () => {
    const s = ODD_ONE_OUT_SCRIPT;
    expect(at(s, "q1", 2700).o).toBe(0);
    expect(at(s, "q2", 2700).o).toBe(1);
    expect(at(s, "ok2", 2700).o).toBe(1);
    expect(at(s, "bolt", 2700).o).toBe(1);
    expect(at(s, "hand", 2700)).toMatchObject({ x: 252, y: 264 });
  });

  it("Theo dấu ánh đèn: đèn nhịp 550 ms, số đảo ngược ở cuối", () => {
    const s = LIGHT_TRAIL_SCRIPT;
    expect([700, 1250, 1800].map((ms, i) => at(s, `L${i}`, ms).o)).toEqual([1, 1, 1]);
    expect(at(s, "L0", 1050).o).toBe(0);
    expect(at(s, "ok", 4100).o).toBe(1);
    expect(["v0", "v1", "v2", "rew"].map((k) => at(s, k, 4900).o)).toEqual([1, 1, 1, 1]);
    expect(at(s, "n0", 4900).o).toBe(0);
  });

  it("Cân não: đòn nghiêng 14°, đĩa lệch 19,35", () => {
    const s = BALANCE_SCRIPT;
    expect(at(s, "abeam", 480).r).toBe(-14);
    expect(at(s, "bbeam", 480).r).toBe(14);
    expect(at(s, "apl", 480).y).toBeCloseTo(19.35);
    expect(at(s, "ok", 3900).o).toBe(1);
  });

  it("Bóng bay số: chạm nhầm 7 → ✗, khoá rút hết sau 1,2 s", () => {
    const s = NUMBER_BALLOONS_SCRIPT;
    expect(["B3", "B5", "B8", "B12"].map((k) => at(s, k, 2600).o)).toEqual([0, 0, 0, 0]);
    expect(["F3", "F5", "F8", "F12"].map((k) => at(s, k, 2600).o)).toEqual([1, 1, 1, 1]);
    expect(at(s, "x7", 4200).o).toBe(1);
    expect(at(s, "dim", 4200).o).toBeCloseTo(0.6);
    expect(at(s, "lkb", 4100).sx).toBe(1);
    expect(at(s, "lkb", 5300).sx).toBe(0);
  });

  it("Xoay hình: bóng ma xoay 90° rồi −90° (chiều gần nhất)", () => {
    const s = ROTATE_MATCH_SCRIPT;
    expect(at(s, "g1", 2000).r).toBe(90);
    expect(at(s, "g2", 3700).r).toBe(-90);
    expect(at(s, "x2", 3500).o).toBe(1);
    expect(at(s, "ok2", 3600).o).toBe(1);
  });
});
