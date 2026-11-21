import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cửa tải lười của lớp kết nối: mở trang không có token nối lại thì không tải chunk `connection.ts`
 * (Colyseus, zod); có token hoặc bấm Tạo/Vào phòng thì chuyển tiếp nguyên tham số.
 */

const { factory, resumeMock, createMock, joinMock } = vi.hoisted(() => ({
  factory: vi.fn(),
  resumeMock: vi.fn(async () => true),
  createMock: vi.fn(async () => {}),
  joinMock: vi.fn(async () => {}),
}));

vi.mock("./connection", () => {
  factory();
  return { resumeParty: resumeMock, createParty: createMock, joinParty: joinMock };
});

const TOKEN_KEY = "brain-rizz:reconnect";
const PROFILE = { name: "Lan", colorIndex: 2, avatar: "bo" as const, difficulty: 1 as const };

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, String(value));
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("sessionStorage", memoryStorage());
});

describe("lazy-connection", () => {
  it("không có token nối lại → trả false, không tải chunk kết nối", async () => {
    const { resumeParty } = await import("./lazy-connection");
    await expect(resumeParty()).resolves.toBe(false);
    expect(factory).not.toHaveBeenCalled();
    expect(resumeMock).not.toHaveBeenCalled();
  });

  it("có token nối lại → tải chunk và gọi resumeParty thật", async () => {
    sessionStorage.setItem(TOKEN_KEY, "tok");
    const { resumeParty } = await import("./lazy-connection");
    await expect(resumeParty()).resolves.toBe(true);
    expect(resumeMock).toHaveBeenCalledTimes(1);
  });

  it("có token nhưng tải chunk lỗi → trả false, không ném lỗi", async () => {
    sessionStorage.setItem(TOKEN_KEY, "tok");
    vi.doMock("./connection", () => {
      throw new Error("Failed to fetch dynamically imported module");
    });
    try {
      const { resumeParty } = await import("./lazy-connection");
      await expect(resumeParty()).resolves.toBe(false);
      expect(resumeMock).not.toHaveBeenCalled();
    } finally {
      vi.doMock("./connection", () => ({
        resumeParty: resumeMock,
        createParty: createMock,
        joinParty: joinMock,
      }));
    }
  });

  it("createParty / joinParty chuyển tiếp nguyên tham số", async () => {
    const { createParty, joinParty } = await import("./lazy-connection");
    const signal = new AbortController().signal;
    await createParty(PROFILE, { bots: { count: 1, level: 2 }, signal });
    await joinParty("ABCD", PROFILE);
    expect(createMock).toHaveBeenCalledWith(PROFILE, { bots: { count: 1, level: 2 }, signal });
    expect(joinMock).toHaveBeenCalledWith("ABCD", PROFILE);
  });
});
