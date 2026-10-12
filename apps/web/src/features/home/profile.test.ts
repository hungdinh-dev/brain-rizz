import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/lib/storage";
import { loadProfile, saveProfile } from "./profile";

/** localStorage giả trong bộ nhớ (vitest chạy môi trường node, không có DOM). */
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
}

let storage: ReturnType<typeof memoryStorage>;
const store = (value: unknown) =>
  storage.setItem(STORAGE_KEYS.profile, typeof value === "string" ? value : JSON.stringify(value));

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal("localStorage", storage);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadProfile", () => {
  it("chưa lưu gì → hồ sơ mặc định, nhân vật khoi", () => {
    expect(loadProfile()).toEqual({ name: "", colorIndex: 0, avatar: "khoi", difficulty: 1 });
  });

  it("đọc lại đúng nhân vật đã chọn", () => {
    store({ name: "An", colorIndex: 2, avatar: "mochi", difficulty: 3 });
    expect(loadProfile()).toEqual({ name: "An", colorIndex: 2, avatar: "mochi", difficulty: 3 });
  });

  it("nhân vật lạ → về khoi, giữ nguyên các trường khác", () => {
    store({ name: "An", colorIndex: 2, avatar: "dragon", difficulty: 2 });
    expect(loadProfile()).toEqual({ name: "An", colorIndex: 2, avatar: "khoi", difficulty: 2 });
  });

  it("hồ sơ bản cũ (chưa có avatar) vẫn đọc được tên", () => {
    store({ name: "Bình", colorIndex: 1, difficulty: 0 });
    expect(loadProfile()).toEqual({ name: "Bình", colorIndex: 1, avatar: "khoi", difficulty: 0 });
  });

  it("dữ liệu hỏng / sai kiểu → không vỡ app", () => {
    store("{not json");
    expect(loadProfile().avatar).toBe("khoi");
    store({ name: 42, avatar: 7, difficulty: 9, colorIndex: "x" });
    expect(loadProfile()).toEqual({ name: "", colorIndex: 0, avatar: "khoi", difficulty: 1 });
  });

  it("localStorage bị chặn → hồ sơ mặc định", () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("blocked");
      },
    });
    expect(loadProfile().name).toBe("");
  });
});

describe("saveProfile", () => {
  it("lưu rồi đọc lại giữ nguyên hồ sơ", () => {
    const p = { name: "Chi", colorIndex: 4, avatar: "tron", difficulty: 2 } as const;
    saveProfile(p);
    expect(loadProfile()).toEqual(p);
  });
});
