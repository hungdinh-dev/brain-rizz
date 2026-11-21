import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/lib/storage";
import {
  adoptAccountProfile,
  loadProfile,
  mergeAccountProfile,
  type Profile,
  saveAccessories,
  saveProfile,
  useProfile,
} from "./profile";

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

describe("mergeAccountProfile (hồ sơ theo tài khoản)", () => {
  const local: Profile = {
    name: "Lan",
    colorIndex: 2,
    avatar: "op",
    difficulty: 3,
    accessories: ["crown"],
  };

  it("tài khoản có tên → tên + nhân vật của tài khoản thắng, giữ màu / độ khó / phụ kiện", () => {
    expect(mergeAccountProfile(local, { display_name: "Hùng", avatar: "mochi" })).toEqual({
      profile: { ...local, name: "Hùng", avatar: "mochi" },
      changed: true,
      push: false,
    });
  });

  it("máy chưa có tên (máy mới, xoá dữ liệu) → nhận tên tài khoản", () => {
    const empty: Profile = { ...local, name: "" };
    const merged = mergeAccountProfile(empty, { display_name: "  Hùng  ", avatar: "khoi" });
    expect(merged.profile.name).toBe("Hùng");
    expect(merged.changed).toBe(true);
  });

  it("nhân vật lạ / sai kiểu từ tài khoản → giữ nhân vật trên máy", () => {
    expect(
      mergeAccountProfile(local, { display_name: "Hùng", avatar: "dragon" }).profile.avatar,
    ).toBe("op");
    expect(mergeAccountProfile(local, { display_name: "Hùng", avatar: 7 }).profile.avatar).toBe(
      "op",
    );
  });

  it("trùng hồ sơ trên máy → không đổi, không đẩy", () => {
    expect(mergeAccountProfile(local, { display_name: "Lan", avatar: "op" })).toEqual({
      profile: local,
      changed: false,
      push: false,
    });
  });

  it("tài khoản chưa có tên → giữ hồ sơ trên máy, máy có tên thì đẩy lên", () => {
    for (const remote of [null, undefined, {}, { display_name: "   " }, { display_name: 42 }]) {
      expect(mergeAccountProfile(local, remote)).toEqual({
        profile: local,
        changed: false,
        push: true,
      });
    }
    expect(mergeAccountProfile({ ...local, name: "" }, null).push).toBe(false);
  });

  it("tên tài khoản quá dài → cắt theo MAX_NAME_LENGTH", () => {
    const merged = mergeAccountProfile(local, { display_name: "x".repeat(40) });
    expect(merged.profile.name.length).toBeLessThanOrEqual(16);
  });
});

describe("useProfile (store hồ sơ dùng chung)", () => {
  it("saveProfile cập nhật store ngay (màn đang mở thấy hồ sơ mới)", () => {
    saveProfile({ name: "Chi", colorIndex: 1, avatar: "lua", difficulty: 2, accessories: [] });
    expect(useProfile.getState().profile.name).toBe("Chi");
    saveAccessories(["halo"]);
    expect(useProfile.getState().profile.accessories).toEqual(["halo"]);
  });

  it("localStorage bị chặn → store vẫn nhớ hồ sơ trong phiên", () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    });
    saveProfile({ name: "Chi", colorIndex: 0, avatar: "khoi", difficulty: 1, accessories: [] });
    expect(useProfile.getState().profile.name).toBe("Chi");
  });

  it("adoptAccountProfile lưu hồ sơ và tăng accountRev", () => {
    const rev = useProfile.getState().accountRev;
    adoptAccountProfile({
      name: "Hùng",
      colorIndex: 0,
      avatar: "mochi",
      difficulty: 1,
      accessories: [],
    });
    expect(loadProfile().name).toBe("Hùng");
    expect(useProfile.getState().profile.avatar).toBe("mochi");
    expect(useProfile.getState().accountRev).toBe(rev + 1);
  });
});

describe("mergeAccountProfile: dấu sửa tay + chủ hồ sơ (máy dùng chung)", () => {
  const local: Profile = {
    name: "Lan",
    colorIndex: 2,
    avatar: "op",
    difficulty: 3,
    accessories: ["crown"],
  };
  const remote = { display_name: "Hùng", avatar: "mochi" };

  it("sửa tay chưa đẩy → bản trên máy thắng tên tài khoản, đẩy lên", () => {
    expect(mergeAccountProfile(local, remote, { userId: "u1", owner: "u1", edited: true })).toEqual(
      {
        profile: local,
        changed: false,
        push: true,
      },
    );
  });

  it("tài khoản chưa có tên: hồ sơ chưa gắn ai / gắn đúng tài khoản → đẩy lên", () => {
    expect(mergeAccountProfile(local, null, { userId: "u1", owner: null }).push).toBe(true);
    expect(mergeAccountProfile(local, null, { userId: "u1", owner: "u1" }).push).toBe(true);
  });

  it("tài khoản chưa có tên, hồ sơ của tài khoản khác → không đẩy, xoá tên + phụ kiện, giữ phần còn lại", () => {
    expect(mergeAccountProfile(local, null, { userId: "u1", owner: "u0" })).toEqual({
      profile: { ...local, name: "", accessories: [] },
      changed: true,
      push: false,
    });
  });

  it("tài khoản có tên, hồ sơ của tài khoản khác → nhận tên tài khoản, bỏ phụ kiện của người trước", () => {
    expect(mergeAccountProfile(local, remote, { userId: "u1", owner: "u0" }).profile).toEqual({
      ...local,
      name: "Hùng",
      avatar: "mochi",
      accessories: [],
    });
  });
});

describe("ghép hồ sơ từ store (localStorage bị chặn)", () => {
  it("đeo phụ kiện không xoá tên", () => {
    saveProfile({ name: "Chi", colorIndex: 0, avatar: "op", difficulty: 2, accessories: [] });
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    });
    saveAccessories(["halo"]);
    expect(useProfile.getState().profile).toEqual({
      name: "Chi",
      colorIndex: 0,
      avatar: "op",
      difficulty: 2,
      accessories: ["halo"],
    });
  });
});
