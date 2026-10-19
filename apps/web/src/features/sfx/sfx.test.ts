import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/lib/storage";
import { parseSfxAttr, resolveSfxKind, SFX_KINDS } from "./kinds";
import {
  DRUMROLL_SECONDS,
  drumrollRecipe,
  fanfareRecipe,
  isNoise,
  maxDurationOf,
  recipeDuration,
  recipeFor,
  SYNTH_RECIPES,
  TICK_ACCENT,
  type Tone,
} from "./recipes";
import { loadSfxEnabled, parseSfxEnabled, saveSfxEnabled } from "./settings";
import { sfxUrlsFromGlob } from "./sources";

const base = { attr: null, role: null, pressed: false, disabled: false };

describe("resolveSfxKind", () => {
  it("nút thường → click", () => {
    expect(resolveSfxKind(base)).toBe("click");
  });

  it("data-sfx ghi đè; none → im", () => {
    expect(resolveSfxKind({ ...base, attr: "confirm" })).toBe("confirm");
    expect(resolveSfxKind({ ...base, attr: "back" })).toBe("back");
    expect(resolveSfxKind({ ...base, attr: "none" })).toBeNull();
    // data-sfx thắng cả aria-pressed (vd. "Đã hiểu" là nút bật/tắt nhưng kêu confirm)
    expect(resolveSfxKind({ ...base, attr: "confirm", pressed: true })).toBe("confirm");
  });

  it("nút bật/tắt (aria-pressed) hoặc role switch/radio/tab → toggle", () => {
    expect(resolveSfxKind({ ...base, pressed: true })).toBe("toggle");
    for (const role of ["switch", "radio", "tab"]) {
      expect(resolveSfxKind({ ...base, role })).toBe("toggle");
    }
    expect(resolveSfxKind({ ...base, role: "button" })).toBe("click");
  });

  it("phần tử bị khoá → im", () => {
    expect(resolveSfxKind({ ...base, disabled: true })).toBeNull();
    expect(resolveSfxKind({ ...base, attr: "confirm", disabled: true })).toBeNull();
  });

  it("data-sfx lạ → coi như không có", () => {
    expect(parseSfxAttr("boom")).toBeNull();
    expect(resolveSfxKind({ ...base, attr: "boom" })).toBe("click");
  });
});

describe("tiếng tổng hợp", () => {
  it("đủ mọi loại, mỗi loại có nốt", () => {
    for (const kind of SFX_KINDS) expect(SYNTH_RECIPES[kind].length).toBeGreaterThan(0);
  });

  it("ngắn: tiếng bấm ≤ 150 ms, đúng/sai ≤ 300 ms, tiếng vinh danh theo nhịp màn", () => {
    for (const kind of SFX_KINDS) {
      expect(recipeDuration(SYNTH_RECIPES[kind])).toBeLessThanOrEqual(maxDurationOf(kind) + 1e-9);
    }
    expect(recipeDuration(TICK_ACCENT)).toBeLessThanOrEqual(0.15);
  });

  it("nốt hợp lệ: tần số dương, âm lượng 0–1, bộ lọc có tần số", () => {
    for (const voices of [...Object.values(SYNTH_RECIPES), TICK_ACCENT]) {
      for (const voice of voices) {
        expect(voice.peak).toBeGreaterThan(0);
        expect(voice.peak).toBeLessThanOrEqual(1);
        expect(voice.start).toBeGreaterThanOrEqual(0);
        if (isNoise(voice)) {
          for (const f of voice.filters) expect(f.freq).toBeGreaterThan(0);
          continue;
        }
        expect(voice.freq).toBeGreaterThan(0);
        if (voice.to !== undefined) expect(voice.to).toBeGreaterThan(0);
      }
    }
  });

  it("reveal đi lên, nhỏ hơn tiếng bấm", () => {
    const [a, b] = SYNTH_RECIPES.reveal as Tone[];
    expect(b?.freq).toBeGreaterThan(a?.freq ?? 0);
    expect(a?.peak).toBeLessThanOrEqual(0.25);
  });

  it("trống dồn: dài đúng 2 s, gõ nhanh dần (85 → 38 ms), to dần, xen kẽ hai tay", () => {
    const voices = drumrollRecipe();
    expect(recipeDuration(voices)).toBeCloseTo(DRUMROLL_SECONDS, 5);
    const hits = voices.filter(isNoise);
    const gaps = hits.slice(1).map((h, i) => h.start - (hits[i]?.start ?? 0));
    expect(gaps[0]).toBeCloseTo(0.085, 3);
    expect(gaps.at(-1)).toBeLessThan(0.045);
    expect(gaps.at(-1)).toBeGreaterThanOrEqual(0.038);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeLessThan(gaps[i - 1] ?? 1);
    // Trung bình 12 → 26 tiếng/giây: tổng khoảng 30–45 tiếng trong 2 s.
    expect(hits.length).toBeGreaterThan(30);
    expect(hits.length).toBeLessThan(45);
    // Tay phải mạnh hơn tay trái ở cùng một lúc; cuối to hơn đầu.
    expect(hits[0]?.peak).toBeGreaterThan(hits[1]?.peak ?? 1);
    expect(hits.at(-1)?.peak ?? 0).toBeGreaterThan(hits[1]?.peak ?? 1);
    // Rền timpani hai nốt lên dần suốt 2 s.
    const rumble = voices.filter((v): v is Tone => !isNoise(v));
    expect(rumble.map((v) => v.freq)).toEqual([73, 110]);
    for (const v of rumble) expect(v.envelope).toBe("swell");
  });

  it("kèn chiến thắng: ~1,5 s, hợp âm cuối tổng âm lượng ≤ 0,3", () => {
    const voices = fanfareRecipe();
    expect(recipeDuration(voices)).toBeLessThanOrEqual(maxDurationOf("fanfare"));
    expect(recipeDuration(voices)).toBeGreaterThan(1.2);
    const chord = voices.filter((v): v is Tone => !isNoise(v) && v.envelope === "hold");
    expect(chord).toHaveLength(8);
    expect(chord.reduce((sum, v) => sum + v.peak, 0)).toBeLessThanOrEqual(0.3 + 1e-9);
  });

  it("confirm đi lên, back đi xuống", () => {
    const [c1, c2] = SYNTH_RECIPES.confirm as Tone[];
    const [b1, b2] = SYNTH_RECIPES.back as Tone[];
    expect(c2?.freq).toBeGreaterThan(c1?.freq ?? 0);
    expect(b2?.freq).toBeLessThan(b1?.freq ?? 0);
  });

  it("tick nhấn cao hơn tick thường; accent không đổi loại khác", () => {
    const freqOf = (v: readonly unknown[]) => (v[0] as Tone | undefined)?.freq ?? 0;
    expect(freqOf(recipeFor("tick", true))).toBeGreaterThan(freqOf(recipeFor("tick")));
    expect(recipeFor("click", true)).toBe(SYNTH_RECIPES.click);
  });
});

describe("sfxUrlsFromGlob", () => {
  it("chưa có file → rỗng", () => {
    expect(sfxUrlsFromGlob({})).toEqual({});
  });

  it("nhận theo tên loại, bỏ file lạ, ưu tiên mp3", () => {
    expect(
      sfxUrlsFromGlob({
        "../../assets/sfx/click.ogg": "/a/click.ogg",
        "../../assets/sfx/click.mp3": "/a/click.mp3",
        "../../assets/sfx/Correct.wav": "/a/correct.wav",
        "../../assets/sfx/boom.mp3": "/a/boom.mp3",
        "../../assets/sfx/README.md": "/a/readme",
      }),
    ).toEqual({ click: "/a/click.mp3", correct: "/a/correct.wav" });
  });
});

describe("cài đặt bật/tắt", () => {
  it("chỉ 'off' là tắt; chưa lưu hoặc dữ liệu hỏng → bật", () => {
    expect(parseSfxEnabled("off")).toBe(false);
    expect(parseSfxEnabled("on")).toBe(true);
    expect(parseSfxEnabled(null)).toBe(true);
    expect(parseSfxEnabled("{rác")).toBe(true);
  });

  describe("lưu trên máy", () => {
    beforeEach(() => {
      const data = new Map<string, string>();
      vi.stubGlobal("localStorage", {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
        removeItem: (k: string) => void data.delete(k),
      });
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("lưu rồi đọc lại đúng, dưới khoá brain-rizz:sfx", () => {
      saveSfxEnabled(false);
      expect(localStorage.getItem(STORAGE_KEYS.sfx)).toBe("off");
      expect(STORAGE_KEYS.sfx).toBe("brain-rizz:sfx");
      expect(loadSfxEnabled()).toBe(false);
      saveSfxEnabled(true);
      expect(loadSfxEnabled()).toBe(true);
    });

    it("localStorage bị chặn → bật, không ném lỗi", () => {
      vi.stubGlobal("localStorage", {
        getItem: () => {
          throw new Error("blocked");
        },
      });
      expect(loadSfxEnabled()).toBe(true);
    });
  });
});
