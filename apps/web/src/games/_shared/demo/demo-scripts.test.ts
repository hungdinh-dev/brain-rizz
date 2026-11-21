import { describe, expect, it } from "vitest";
import { AIM_TRAINER_SCRIPT } from "../../aim-trainer/AimTrainerDemo";
import { BALANCE_SCRIPT } from "../../balance/BalanceDemo";
import { BEAD_PATTERN_SCRIPT } from "../../bead-pattern/BeadPatternDemo";
import { BEST_BASKET_SCRIPT } from "../../best-basket/BestBasketDemo";
import { CASH_COUNT_SCRIPT } from "../../cash-count/CashCountDemo";
import { CHALK_ARROWS_SCRIPT } from "../../chalk-arrows/ChalkArrowsDemo";
import { CIRCUIT_LINK_SCRIPT } from "../../circuit-link/CircuitLinkDemo";
import { CROWD_SEARCH_SCRIPT } from "../../crowd-search/CrowdSearchDemo";
import { CUBE_COUNT_SCRIPT } from "../../cube-count/CubeCountDemo";
import { CUP_SHUFFLE_SCRIPT } from "../../cup-shuffle/CupShuffleDemo";
import { FOLD_BOX_SCRIPT } from "../../fold-box/FoldBoxDemo";
import { HEAD_COUNT_SCRIPT } from "../../head-count/HeadCountDemo";
import { HIT_TARGET_SCRIPT } from "../../hit-target/HitTargetDemo";
import { LATIN_CELL_SCRIPT } from "../../latin-cell/LatinCellDemo";
import { LIGHT_TRAIL_SCRIPT } from "../../light-trail/LightTrailDemo";
import { MARBLE_DROP_SCRIPT } from "../../marble-drop/MarbleDropDemo";
import { NAVON_SHAPES_SCRIPT } from "../../navon-shapes/NavonShapesDemo";
import { NUMBER_BALLOONS_SCRIPT } from "../../number-balloons/NumberBalloonsDemo";
import { NUMBER_PATH_SCRIPT } from "../../number-path/NumberPathDemo";
import { ODD_ONE_OUT_SCRIPT } from "../../odd-one-out/OddOneOutDemo";
import { PAIR_FLIP_SCRIPT } from "../../pair-flip/PairFlipDemo";
import { PIECE_FIT_SCRIPT } from "../../piece-fit/PieceFitDemo";
import { POUR_LINE_SCRIPT } from "../../pour-line/PourLineDemo";
import { RHYTHM_ECHO_SCRIPT } from "../../rhythm-echo/RhythmEchoDemo";
import { ROTATE_MATCH_SCRIPT } from "../../rotate-match/RotateMatchDemo";
import { RULE_GATE_SCRIPT } from "../../rule-gate/RuleGateDemo";
import { SHADOW_MATCH_SCRIPT } from "../../shadow-match/ShadowMatchDemo";
import { STACK_RECALL_SCRIPT } from "../../stack-recall/StackRecallDemo";
import { TOP_VIEW_SCRIPT } from "../../top-view/TopViewDemo";
import { WHO_VANISHED_SCRIPT } from "../../who-vanished/WhoVanishedDemo";
import { type DemoScript, HAND_OFF, poseAt, RESERVED_LANES, scriptCss } from "./timeline";

/**
 * Vòng lặp T và mốc 3 bước của mọi clip (UI-UX 6.11, đặc tả từng game). Thêm clip mới thì thêm một
 * dòng ở đây: luật chung của khung (mờ vào/ra, tay rút trước khi mờ, tiền tố không trùng) được kiểm
 * cho mọi dòng; test riêng của game (`<Name>Demo.test.ts`) chỉ kiểm khung hình đặc trưng.
 */
const SPEC: [string, DemoScript, number, [number, number, number]][] = [
  ["aim-trainer", AIM_TRAINER_SCRIPT, 4600, [0, 1250, 2200]],
  ["balance", BALANCE_SCRIPT, 5400, [0, 1900, 2900]],
  ["bead-pattern", BEAD_PATTERN_SCRIPT, 5400, [0, 1400, 2800]],
  ["best-basket", BEST_BASKET_SCRIPT, 6000, [0, 1200, 3000]],
  ["cash-count", CASH_COUNT_SCRIPT, 6200, [0, 1700, 3000]],
  ["chalk-arrows", CHALK_ARROWS_SCRIPT, 4800, [0, 1950, 2900]],
  ["circuit-link", CIRCUIT_LINK_SCRIPT, 6200, [0, 1200, 3000]],
  ["crowd-search", CROWD_SEARCH_SCRIPT, 4800, [0, 1000, 2400]],
  ["cube-count", CUBE_COUNT_SCRIPT, 5000, [0, 1000, 2400]],
  ["cup-shuffle", CUP_SHUFFLE_SCRIPT, 5400, [0, 1300, 3000]],
  ["fold-box", FOLD_BOX_SCRIPT, 4800, [0, 1000, 2300]],
  ["head-count", HEAD_COUNT_SCRIPT, 6200, [0, 1500, 3500]],
  ["hit-target", HIT_TARGET_SCRIPT, 5000, [0, 1000, 2100]],
  ["latin-cell", LATIN_CELL_SCRIPT, 5400, [0, 1500, 2900]],
  ["light-trail", LIGHT_TRAIL_SCRIPT, 6000, [0, 2150, 4300]],
  ["marble-drop", MARBLE_DROP_SCRIPT, 5200, [0, 1700, 2900]],
  ["navon-shapes", NAVON_SHAPES_SCRIPT, 5200, [0, 1000, 2700]],
  ["number-balloons", NUMBER_BALLOONS_SCRIPT, 6200, [0, 1000, 3000]],
  ["number-path", NUMBER_PATH_SCRIPT, 5600, [0, 1300, 3000]],
  ["odd-one-out", ODD_ONE_OUT_SCRIPT, 4800, [0, 1000, 2400]],
  ["pair-flip", PAIR_FLIP_SCRIPT, 5000, [0, 1500, 2400]],
  ["piece-fit", PIECE_FIT_SCRIPT, 4800, [0, 1000, 2500]],
  ["pour-line", POUR_LINE_SCRIPT, 4800, [0, 2100, 2850]],
  ["rhythm-echo", RHYTHM_ECHO_SCRIPT, 5400, [0, 2200, 3950]],
  ["rotate-match", ROTATE_MATCH_SCRIPT, 5500, [0, 1000, 2700]],
  ["rule-gate", RULE_GATE_SCRIPT, 6000, [0, 1400, 3200]],
  ["shadow-match", SHADOW_MATCH_SCRIPT, 5000, [0, 1000, 2000]],
  ["stack-recall", STACK_RECALL_SCRIPT, 6200, [0, 1700, 2700]],
  ["top-view", TOP_VIEW_SCRIPT, 4800, [0, 1000, 2300]],
  ["who-vanished", WHO_VANISHED_SCRIPT, 5000, [0, 1550, 2450]],
];

/** Mọi thư mục game có `<Name>Demo.tsx` phải có mặt trong SPEC (không sót clip mới). */
const DEMO_FILES = Object.keys(import.meta.glob("../../*/*Demo.tsx"));

describe("kịch bản clip hướng dẫn", () => {
  it("SPEC đủ mọi clip", () => {
    const games = DEMO_FILES.map((path) => path.split("/")[2]).sort();
    expect(SPEC.map(([name]) => name).sort()).toEqual(games);
  });

  it.each(SPEC)(
    "%s: vòng lặp, bước, mờ vào/ra, tay rút trước khi mờ",
    (_name, script, T, steps) => {
      const at = (lane: string, ms: number) => poseAt(script, lane, ms);
      expect(script.T).toBe(T);
      expect([...script.steps]).toEqual(steps);
      expect(at("scene", 0).o).toBe(0);
      expect(at("scene", 300).o).toBe(1);
      expect(at("scene", T - 600).o).toBe(1);
      expect(at("scene", T - 300).o).toBe(0);
      expect(at("hand", T - 600)).toMatchObject(HAND_OFF);
      expect(() => scriptCss(script)).not.toThrow();
    },
  );

  it("đủ làn dành sẵn của khung (con trỏ, huy hiệu bước, mờ vào/ra)", () => {
    for (const [name, script] of SPEC) {
      for (const lane of RESERVED_LANES)
        expect(script.tracks[lane], `${name}: ${lane}`).toBeDefined();
    }
  });

  it("tiền tố không trùng, không chồng nhau, tên keyframes không trùng giữa các game", () => {
    const ids = SPEC.map(([, s]) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    // `demo-base` là thẻ <style> chung của khung.
    expect(ids).not.toContain("base");
    // Tiền tố `a` và `a-b` có thể sinh cùng tên `dk-a-b-x` (làn `b-x` của a, làn `x` của a-b).
    for (const a of ids) {
      for (const b of ids) if (a !== b) expect(a.startsWith(`${b}-`), `${a} / ${b}`).toBe(false);
    }
    const names = SPEC.flatMap(([, s]) => Object.keys(s.tracks).map((k) => `dk-${s.id}-${k}`));
    expect(new Set(names).size).toBe(names.length);
  });

  it("tên làn và tiền tố là định danh CSS gọn (chữ, số, gạch ngang)", () => {
    for (const [name, script] of SPEC) {
      expect(script.id, name).toMatch(/^[a-z][a-z0-9-]*$/);
      for (const lane of Object.keys(script.tracks)) expect(lane, name).toMatch(/^[A-Za-z0-9-]+$/);
    }
  });
});

describe("khung đặc trưng 5 game MVP", () => {
  it("Kẻ lạc đàn: khung 2.700 ms có ✓ + ⚡ của câu 2", () => {
    const at = (lane: string, ms: number) => poseAt(ODD_ONE_OUT_SCRIPT, lane, ms);
    expect(at("q1", 2700).o).toBe(0);
    expect(at("q2", 2700).o).toBe(1);
    expect(at("ok2", 2700).o).toBe(1);
    expect(at("bolt", 2700).o).toBe(1);
    expect(at("hand", 2700)).toMatchObject({ x: 252, y: 264 });
  });

  it("Theo dấu ánh đèn: đèn nhịp 550 ms, số đảo ngược ở cuối", () => {
    const at = (lane: string, ms: number) => poseAt(LIGHT_TRAIL_SCRIPT, lane, ms);
    expect([700, 1250, 1800].map((ms, i) => at(`L${i}`, ms).o)).toEqual([1, 1, 1]);
    expect(at("L0", 1050).o).toBe(0);
    expect(at("ok", 4100).o).toBe(1);
    expect(["v0", "v1", "v2", "rew"].map((k) => at(k, 4900).o)).toEqual([1, 1, 1, 1]);
    expect(at("n0", 4900).o).toBe(0);
  });

  it("Cân não: đòn nghiêng 14°, đĩa lệch 19,35", () => {
    const at = (lane: string, ms: number) => poseAt(BALANCE_SCRIPT, lane, ms);
    expect(at("abeam", 480).r).toBe(-14);
    expect(at("bbeam", 480).r).toBe(14);
    expect(at("apl", 480).y).toBeCloseTo(19.35);
    expect(at("ok", 3900).o).toBe(1);
  });

  it("Bóng bay số: chạm nhầm 7 → ✗, khoá rút hết sau 1,2 s", () => {
    const at = (lane: string, ms: number) => poseAt(NUMBER_BALLOONS_SCRIPT, lane, ms);
    expect(["B3", "B5", "B8", "B12"].map((k) => at(k, 2600).o)).toEqual([0, 0, 0, 0]);
    expect(["F3", "F5", "F8", "F12"].map((k) => at(k, 2600).o)).toEqual([1, 1, 1, 1]);
    expect(at("x7", 4200).o).toBe(1);
    expect(at("dim", 4200).o).toBeCloseTo(0.6);
    expect(at("lkb", 4100).sx).toBe(1);
    expect(at("lkb", 5300).sx).toBe(0);
  });

  it("Xoay hình: bóng ma xoay 90° rồi −90° (chiều gần nhất)", () => {
    const at = (lane: string, ms: number) => poseAt(ROTATE_MATCH_SCRIPT, lane, ms);
    expect(at("g1", 2000).r).toBe(90);
    expect(at("g2", 3700).r).toBe(-90);
    expect(at("x2", 3500).o).toBe(1);
    expect(at("ok2", 3600).o).toBe(1);
  });
});
