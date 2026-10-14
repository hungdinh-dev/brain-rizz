import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/lib/storage";
import { parseSfxAttr, resolveSfxKind, SFX_KINDS } from "./kinds";
import { maxDurationOf, recipeDuration, recipeFor, SYNTH_RECIPES, TICK_ACCENT } from "./recipes";
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
  it("đủ 8 loại, mỗi loại có nốt", () => {
    for (const kind of SFX_KINDS) expect(SYNTH_RECIPES[kind].length).toBeGreaterThan(0);
  });

  it("ngắn: tiếng bấm ≤ 150 ms, đúng/sai ≤ 300 ms", () => {
    for (const kind of SFX_KINDS) {
      expect(recipeDuration(SYNTH_RECIPES[kind])).toBeLessThanOrEqual(maxDurationOf(kind) + 1e-9);
    }
    expect(recipeDuration(TICK_ACCENT)).toBeLessThanOrEqual(0.15);
  });

  it("nốt hợp lệ: tần số dương, âm lượng 0–1", () => {
    for (const tones of [...Object.values(SYNTH_RECIPES), TICK_ACCENT]) {
      for (const tone of tones) {
        expect(tone.freq).toBeGreaterThan(0);
        if (tone.to !== undefined) expect(tone.to).toBeGreaterThan(0);
        expect(tone.peak).toBeGreaterThan(0);
        expect(tone.peak).toBeLessThanOrEqual(1);
      }
    }
  });

  it("confirm đi lên, back đi xuống", () => {
    const [c1, c2] = SYNTH_RECIPES.confirm;
    const [b1, b2] = SYNTH_RECIPES.back;
    expect(c2?.freq).toBeGreaterThan(c1?.freq ?? 0);
    expect(b2?.freq).toBeLessThan(b1?.freq ?? 0);
  });

  it("tick nhấn cao hơn tick thường; accent không đổi loại khác", () => {
    expect(recipeFor("tick", true)[0]?.freq).toBeGreaterThan(recipeFor("tick")[0]?.freq ?? 0);
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
