import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/lib/storage";
import {
  loadMotionPreference,
  parseMotionPreference,
  resolveReducedMotion,
  saveMotionPreference,
  systemReducesMotion,
} from "./settings";

function stubStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
  return data;
}

/** window.matchMedia giả: `reduce` = máy đang giảm chuyển động; `fire(x)` = đổi cài đặt máy. */
function stubMatchMedia(reduce: boolean) {
  const listeners: ((e: { matches: boolean }) => void)[] = [];
  vi.stubGlobal("window", {
    matchMedia: () => ({
      matches: reduce,
      addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.push(fn),
    }),
  });
  return {
    fire(matches: boolean) {
      for (const fn of listeners) fn({ matches });
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("cài đặt hiệu ứng", () => {
  it("chỉ 'on' là luôn bật; chưa lưu hoặc dữ liệu hỏng → theo hệ thống", () => {
    expect(parseMotionPreference("on")).toBe("on");
    expect(parseMotionPreference("system")).toBe("system");
    expect(parseMotionPreference(null)).toBe("system");
    expect(parseMotionPreference("{rác")).toBe("system");
  });

  it("chỉ giảm khi theo hệ thống VÀ máy báo giảm", () => {
    expect(resolveReducedMotion("system", true)).toBe(true);
    expect(resolveReducedMotion("system", false)).toBe(false);
    expect(resolveReducedMotion("on", true)).toBe(false);
    expect(resolveReducedMotion("on", false)).toBe(false);
  });

  it("không có window/matchMedia → không giảm, không ném lỗi", () => {
    expect(systemReducesMotion()).toBe(false);
    vi.stubGlobal("window", {
      matchMedia: () => {
        throw new Error("boom");
      },
    });
    expect(systemReducesMotion()).toBe(false);
  });

  describe("lưu trên máy", () => {
    beforeEach(() => {
      stubStorage();
    });

    it("lưu rồi đọc lại đúng, dưới khoá brain-rizz:motion", () => {
      expect(loadMotionPreference()).toBe("system");
      saveMotionPreference("on");
      expect(localStorage.getItem(STORAGE_KEYS.motion)).toBe("on");
      expect(STORAGE_KEYS.motion).toBe("brain-rizz:motion");
      expect(loadMotionPreference()).toBe("on");
    });

    it("localStorage bị chặn → theo hệ thống, ghi không ném lỗi", () => {
      vi.stubGlobal("localStorage", {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      });
      expect(loadMotionPreference()).toBe("system");
      expect(() => saveMotionPreference("on")).not.toThrow();
    });
  });
});

describe("prefersReducedMotion (store)", () => {
  it("máy giảm + theo hệ thống → giảm; bấm Luôn bật → không giảm, nhớ lại sau khi tải lại", async () => {
    const data = stubStorage();
    stubMatchMedia(true);
    const { prefersReducedMotion, useMotion } = await import("./motion.store");
    expect(prefersReducedMotion()).toBe(true);
    useMotion.getState().toggle();
    expect(useMotion.getState().preference).toBe("on");
    expect(prefersReducedMotion()).toBe(false);
    expect(data.get(STORAGE_KEYS.motion)).toBe("on");

    // Tải lại trang: đọc lựa chọn đã lưu.
    vi.resetModules();
    const again = await import("./motion.store");
    expect(again.useMotion.getState().preference).toBe("on");
    expect(again.prefersReducedMotion()).toBe(false);
    again.useMotion.getState().toggle();
    expect(again.prefersReducedMotion()).toBe(true);
  });

  it("đổi cài đặt máy khi đang mở → theo ngay", async () => {
    stubStorage();
    const media = stubMatchMedia(false);
    const { prefersReducedMotion } = await import("./motion.store");
    expect(prefersReducedMotion()).toBe(false);
    media.fire(true);
    expect(prefersReducedMotion()).toBe(true);
    media.fire(false);
    expect(prefersReducedMotion()).toBe(false);
  });
});
