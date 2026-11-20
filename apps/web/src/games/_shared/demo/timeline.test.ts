import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checkTrack,
  cubicBezier,
  defineScript,
  EASE_POINTS,
  HAND_OFF,
  handTracks,
  keyframesCss,
  loopAt,
  popIn,
  ripple,
  sample,
  sceneTrack,
  scriptCss,
  stepAt,
  stepTracks,
  track,
} from "./timeline";

describe("đường cong", () => {
  it("khớp token --ease-* trong globals.css", () => {
    const css = readFileSync(new URL("../../../styles/globals.css", import.meta.url), "utf8");
    for (const [name, points] of Object.entries(EASE_POINTS)) {
      const match = new RegExp(`--ease-${name}:\\s*cubic-bezier\\(([^)]*)\\)`).exec(css);
      expect(match, `--ease-${name}`).not.toBeNull();
      expect((match?.[1] ?? "").split(",").map(Number)).toEqual([...points]);
    }
  });

  it("cubic-bezier đi qua 0 và 1, pop vượt quá 1", () => {
    const pop = cubicBezier(...EASE_POINTS.pop);
    expect(pop(0)).toBe(0);
    expect(pop(1)).toBe(1);
    expect(Math.max(...[0.5, 0.6, 0.7, 0.8].map(pop))).toBeGreaterThan(1);
    const linear = cubicBezier(0, 0, 1, 1);
    expect(linear(0.3)).toBeCloseTo(0.3, 5);
  });
});

describe("dựng làn", () => {
  it("giữ nguyên tới mốc bắt đầu rồi mới chuyển", () => {
    const t = track({ o: 0 }).fade(500, 100).build();
    expect(t.map((s) => s.t)).toEqual([0, 500, 600]);
    expect(t[1]?.pose.o).toBe(0);
    expect(t[1]?.ease).toBe("settle");
    expect(t[2]?.pose.o).toBe(1);
  });

  it("sự kiện bắt đầu đúng mốc đầu thì gắn đường cong vào mốc đó", () => {
    const t = sceneTrack(4800);
    expect(t.map((s) => [s.t, s.pose.o, s.ease])).toEqual([
      [0, 0, "settle"],
      [300, 1, "linear"],
      [4200, 1, "settle"],
      [4500, 0, "linear"],
    ]);
  });

  it("báo lỗi khi mốc lùi", () => {
    expect(() => track().fade(500, 100).fade(550, 100)).toThrow();
  });

  it("sóng chạm hiện đậm ngay lúc chạm rồi loang ra", () => {
    const t = ripple(1100).build();
    expect(sample(t, 1099).o).toBe(0);
    expect(sample(t, 1101).o).toBeCloseTo(0.95);
    expect(sample(t, 1550)).toMatchObject({ sx: 1.3, o: 0 });
  });

  it("nảy vào từ 0,2 tới 1 trong 240 ms", () => {
    const t = popIn(700).build();
    expect(sample(t, 700)).toMatchObject({ sx: 0.2, o: 0 });
    expect(sample(t, 940)).toMatchObject({ sx: 1, o: 1 });
  });

  it("rung ngang ±6 trong 240 ms rồi về chỗ", () => {
    const t = track().shake(3160).build();
    expect(sample(t, 3220).x).toBe(6);
    expect(sample(t, 3280).x).toBe(-6);
    expect(sample(t, 3400).x).toBe(0);
  });
});

describe("tra tư thế", () => {
  const t = track({ x: 0 }).to(100, 100, { x: 10 }, "linear").build();

  it("đúng mốc, giữa đoạn và ngoài hai đầu", () => {
    expect(sample(t, 0).x).toBe(0);
    expect(sample(t, 150).x).toBe(5);
    expect(sample(t, 200).x).toBe(10);
    expect(sample(t, 9999).x).toBe(10);
    expect(sample(t, -5).x).toBe(0);
  });
});

describe("huy hiệu bước", () => {
  it("mỗi lúc đúng một số hiện", () => {
    const starts = [0, 1000, 2400] as const;
    const [s1, s2, s3] = stepTracks(starts);
    for (const ms of [0, 999, 1200, 2399, 2600, 4800]) {
      const visible = [s1, s2, s3].map((s) => sample(s, ms).o);
      expect(visible.filter((o) => o === 1)).toHaveLength(1);
      expect(visible.indexOf(1) + 1).toBe(stepAt(starts, ms));
    }
  });
});

describe("con trỏ", () => {
  const h = handTracks({
    moves: [
      [500, 500, [392, 186]],
      [2900, 400, null],
    ],
    taps: [1100],
  });

  it("chờ ngoài sân khấu, tới điểm chạm + (4, 6), rồi rút ra", () => {
    expect(sample(h.hand, 0)).toMatchObject(HAND_OFF);
    expect(sample(h.hand, 1100)).toMatchObject({ x: 396, y: 192 });
    expect(sample(h.hand, 3300)).toMatchObject(HAND_OFF);
  });

  it("nhấn 0,86 (chuột 0,9) sau 90 ms rồi bật lại", () => {
    expect(sample(h.press, 1190).sx).toBe(0.86);
    expect(sample(h.pressMouse, 1190).sx).toBe(0.9);
    expect(sample(h.press, 1350).sx).toBe(1);
    expect(sample(h.shadow, 1190)).toMatchObject({ x: -3, y: -4, o: 0.45 });
  });
});

describe("vòng lặp", () => {
  it("đếm vòng và mốc trong vòng, xong sau đủ số vòng", () => {
    expect(loopAt(0, 4800, 3)).toEqual({ loop: 0, ms: 0, done: false });
    expect(loopAt(5000, 4800, 3)).toEqual({ loop: 1, ms: 200, done: false });
    expect(loopAt(14400, 4800, 3)).toEqual({ loop: 2, ms: 4800, done: true });
    expect(loopAt(1e9, 4800).done).toBe(false);
  });
});

describe("sinh CSS", () => {
  it("đủ khung 0% và 100%, mốc % = ms ÷ T", () => {
    const css = keyframesCss("k", track({ o: 0 }).fade(1200, 240).build(), 4800);
    expect(css.startsWith("@keyframes k{0%{")).toBe(true);
    expect(css).toContain("25%{");
    expect(css).toContain("30%{");
    expect(css).toContain("100%{");
    expect(css).toContain("animation-timing-function:cubic-bezier(0.2,0.7,0.3,1)");
    expect(css).toContain("transform:translate(0px,0px) rotate(0deg) scale(1,1);opacity:1");
  });

  it("báo lỗi khi làn vượt quá vòng lặp", () => {
    expect(() => checkTrack(track().fade(4700, 200, 0).build(), 4800)).toThrow();
  });

  it("kịch bản thêm làn chung và gắn tên keyframes theo game", () => {
    const script = defineScript({
      id: "zz",
      T: 3000,
      steps: [0, 1000, 2000],
      hand: { moves: [[100, 200, [10, 10]]], taps: [400] },
      tracks: { a: popIn(500) },
    });
    expect(Object.keys(script.tracks).sort()).toEqual(
      ["a", "hand", "hp", "hpm", "hs", "s1", "s2", "s3", "scene"].sort(),
    );
    const css = scriptCss(script);
    expect(css).toContain(".demo-zz .dk{animation-duration:3000ms}");
    expect(css).toContain(".demo-zz .dk-a{animation-name:dk-zz-a}");
    expect(css).toContain("@keyframes dk-zz-scene{");
  });
});
