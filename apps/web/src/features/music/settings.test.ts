import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/lib/storage";
import {
  DEFAULT_MUSIC_SETTINGS,
  effectiveVolume,
  loadMusicSettings,
  parseMusicSettings,
  saveMusicSettings,
  volumeTargets,
} from "./settings";

describe("parseMusicSettings", () => {
  it("chưa lưu gì → mặc định (bật, âm lượng 0,6)", () => {
    expect(parseMusicSettings(null)).toEqual({ enabled: true, volume: 0.6, trackId: null });
  });

  it("đọc lại đúng dữ liệu hợp lệ", () => {
    const raw = JSON.stringify({ enabled: false, volume: 0.25, trackId: "02-b.mp3" });
    expect(parseMusicSettings(raw)).toEqual({ enabled: false, volume: 0.25, trackId: "02-b.mp3" });
  });

  it("JSON hỏng hoặc không phải object → mặc định", () => {
    for (const raw of ["{oops", "42", "null", '"chuỗi"', "[]"]) {
      expect(parseMusicSettings(raw)).toEqual(DEFAULT_MUSIC_SETTINGS);
    }
  });

  it("trường sai kiểu → mặc định của trường đó, giữ trường đúng", () => {
    const raw = JSON.stringify({ enabled: "yes", volume: "loud", trackId: 7 });
    expect(parseMusicSettings(raw)).toEqual(DEFAULT_MUSIC_SETTINGS);
    expect(parseMusicSettings(JSON.stringify({ enabled: false, volume: null }))).toEqual({
      enabled: false,
      volume: 0.6,
      trackId: null,
    });
  });

  it("âm lượng ngoài 0–1 bị kẹp lại", () => {
    expect(parseMusicSettings(JSON.stringify({ volume: 5 })).volume).toBe(1);
    expect(parseMusicSettings(JSON.stringify({ volume: -1 })).volume).toBe(0);
  });
});

describe("effectiveVolume", () => {
  it("giảm một nửa khi đang tập trung chơi", () => {
    expect(effectiveVolume(0.6, false)).toBe(0.6);
    expect(effectiveVolume(0.6, true)).toBeCloseTo(0.3);
  });
});

describe("volumeTargets", () => {
  it("qua Web Audio: thẻ audio để 1, gain = âm lượng × hệ số focus", () => {
    expect(volumeTargets(0.6, false, true)).toEqual({ element: 1, gain: 0.6 });
    const ducked = volumeTargets(0.6, true, true);
    expect(ducked.element).toBe(1);
    expect(ducked.gain).toBeCloseTo(0.3);
  });

  it("không có Web Audio: thẻ audio tự chỉnh, gain giữ 1", () => {
    expect(volumeTargets(0.8, false, false)).toEqual({ element: 0.8, gain: 1 });
    expect(volumeTargets(0.8, true, false).element).toBeCloseTo(0.4);
  });

  it("âm lượng lạ bị kẹp về 0–1", () => {
    expect(volumeTargets(3, false, true).gain).toBe(1);
    expect(volumeTargets(-1, true, false).element).toBe(0);
  });
});

describe("load/save", () => {
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

  it("lưu rồi đọc lại đúng, dưới khoá STORAGE_KEYS.music", () => {
    saveMusicSettings({ enabled: false, volume: 0.4, trackId: "01-a.mp3" });
    expect(localStorage.getItem(STORAGE_KEYS.music)).not.toBeNull();
    expect(loadMusicSettings()).toEqual({ enabled: false, volume: 0.4, trackId: "01-a.mp3" });
  });

  it("localStorage bị chặn → mặc định, không ném lỗi", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(loadMusicSettings()).toEqual(DEFAULT_MUSIC_SETTINGS);
  });
});
