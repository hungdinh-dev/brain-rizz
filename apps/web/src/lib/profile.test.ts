import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/lib/storage";
import { loadProfile, saveAccessories, saveProfile } from "./profile";

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
    expect(loadProfile()).toEqual({
      name: "",
      colorIndex: 0,
      avatar: "khoi",
      difficulty: 1,
      accessories: [],
    });
  });

  it("đọc lại đúng nhân vật đã chọn", () => {
    store({ name: "An", colorIndex: 2, avatar: "mochi", difficulty: 3 });
    expect(loadProfile()).toEqual({
      name: "An",
      colorIndex: 2,
      avatar: "mochi",
      difficulty: 3,
      accessories: [],
    });
  });

  it("nhân vật lạ → về khoi, giữ nguyên các trường khác", () => {
    store({ name: "An", colorIndex: 2, avatar: "dragon", difficulty: 2 });
    expect(loadProfile()).toEqual({
      name: "An",
      colorIndex: 2,
      avatar: "khoi",
      difficulty: 2,
      accessories: [],
    });
  });

  it("hồ sơ bản cũ (chưa có avatar) vẫn đọc được tên", () => {
    store({ name: "Bình", colorIndex: 1, difficulty: 0 });
    expect(loadProfile()).toEqual({
      name: "Bình",
      colorIndex: 1,
      avatar: "khoi",
      difficulty: 0,
      accessories: [],
    });
  });

  it("dữ liệu hỏng / sai kiểu → không vỡ app", () => {
    store("{not json");
    expect(loadProfile().avatar).toBe("khoi");
    store({ name: 42, avatar: 7, difficulty: 9, colorIndex: "x", accessories: 3 });
    expect(loadProfile()).toEqual({
      name: "",
      colorIndex: 0,
      avatar: "khoi",
      difficulty: 1,
      accessories: [],
    });
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
    const p = {
      name: "Chi",
      colorIndex: 4,
      avatar: "tron" as const,
      difficulty: 2 as const,
      accessories: ["crown", "scarf"],
    };
    saveProfile(p);
    expect(loadProfile()).toEqual(p);
  });

  it("thú mới (CR-024) đọc lại được như nhân vật cũ", () => {
    saveProfile({ name: "Chi", colorIndex: 1, avatar: "lua", difficulty: 1, accessories: [] });
    expect(loadProfile().avatar).toBe("lua");
  });
});

describe("phụ kiện trong hồ sơ (CR-023)", () => {
  it("hồ sơ bản cũ (chưa có accessories) → không đeo gì", () => {
    store({ name: "An", colorIndex: 1, avatar: "bo", difficulty: 1 });
    expect(loadProfile().accessories).toEqual([]);
  });

  it("làm sạch khi đọc: bỏ id lạ, mỗi chỗ một món, thứ tự đầu → mặt → cổ", () => {
    store({
      name: "An",
      avatar: "pin",
      accessories: ["scarf", "dragon-wings", "crown", "beanie", 42, "sunglasses"],
    });
    const p = loadProfile();
    expect(p.avatar).toBe("pin");
    expect(p.accessories).toEqual(["crown", "sunglasses", "scarf"]);
    store({ name: "An", accessories: "crown" });
    expect(loadProfile().accessories).toEqual([]);
  });

  it("làm sạch khi lưu", () => {
    saveProfile({
      name: "An",
      colorIndex: 0,
      avatar: "khoi",
      difficulty: 1,
      accessories: ["bell", "scarf", "x"],
    });
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.profile) ?? "{}").accessories).toEqual(["bell"]);
  });

  it("saveAccessories giữ nguyên tên / nhân vật / độ khó, trả danh sách đã lưu", () => {
    saveProfile({ name: "Chi", colorIndex: 3, avatar: "op", difficulty: 2, accessories: [] });
    expect(saveAccessories(["halo", "bell", "nope"])).toEqual(["halo", "bell"]);
    expect(loadProfile()).toEqual({
      name: "Chi",
      colorIndex: 3,
      avatar: "op",
      difficulty: 2,
      accessories: ["halo", "bell"],
    });
    expect(saveAccessories([])).toEqual([]);
    expect(loadProfile().accessories).toEqual([]);
  });
});
