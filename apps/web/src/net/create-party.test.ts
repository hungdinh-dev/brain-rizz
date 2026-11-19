import { ROOM_NAME } from "@brain-rizz/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Chơi với máy" (CR-016): `createParty` gửi tùy chọn `bots` kèm hồ sơ khi tạo phòng, và huỷ giữa
 * chừng thì rời phòng vừa tạo thay vì vào phòng chờ. Colyseus, i18n, toast, tài khoản được giả lập.
 */

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@colyseus/sdk", () => ({
  Client: class {
    create = createMock;
    joinById = vi.fn();
    reconnect = vi.fn();
  },
}));
vi.mock("@/i18n", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock("@/stores/auth.store", () => ({
  useAuth: { getState: () => ({ ensureSession: async () => null }) },
}));

function fakeRoom() {
  return {
    roomId: "ABCD",
    sessionId: "s1",
    reconnectionToken: "token",
    send: vi.fn(),
    leave: vi.fn(async () => 1000),
    onMessage: vi.fn(),
    onDrop: vi.fn(),
    onStateChange: vi.fn(),
    onReconnect: vi.fn(),
    onLeave: vi.fn(),
  };
}

const PROFILE = { name: "Lan", colorIndex: 2, avatar: "bo" as const, difficulty: 1 as const };

async function load() {
  const connection = await import("./connection");
  const { useGame } = await import("@/stores/game.store");
  return { ...connection, useGame };
}

describe("createParty kèm bot (CR-016)", { timeout: 30_000 }, () => {
  beforeAll(() => {
    vi.stubEnv("VITE_SERVER_URL", "http://server.test");
    vi.stubGlobal("document", { addEventListener: vi.fn(), visibilityState: "visible" });
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  beforeEach(async () => {
    createMock.mockReset();
    (await load()).useGame.getState().reset();
  });

  it("gửi bots cùng hồ sơ khi tạo phòng rồi vào phòng", async () => {
    const room = fakeRoom();
    createMock.mockResolvedValue(room);
    const { createParty, useGame } = await load();
    await createParty(PROFILE, { bots: { count: 3, level: 1 } });
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith(ROOM_NAME, {
      ...PROFILE,
      accessories: [],
      bots: { count: 3, level: 1 },
      accessToken: undefined,
    });
    expect(useGame.getState().sessionId).toBe("s1");
    expect(room.leave).not.toHaveBeenCalled();
  });

  it("Tạo phòng thường không gửi trường bots", async () => {
    createMock.mockResolvedValue(fakeRoom());
    const { createParty } = await load();
    await createParty(PROFILE);
    const options = createMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(options).not.toHaveProperty("bots");
    expect(options).toMatchObject(PROFILE);
  });

  it("đóng hộp thoại khi đang tạo: phòng tạo xong thì rời ngay, không vào phòng chờ", async () => {
    const room = fakeRoom();
    const controller = new AbortController();
    createMock.mockImplementation(async () => {
      controller.abort();
      return room;
    });
    const { createParty, useGame } = await load();
    await createParty(PROFILE, { bots: { count: 7, level: 3 }, signal: controller.signal });
    expect(room.leave).toHaveBeenCalledTimes(1);
    expect(useGame.getState().sessionId).toBe("");
  });

  it("đã huỷ trước khi gọi máy chủ thì không tạo phòng", async () => {
    const controller = new AbortController();
    controller.abort();
    const { createParty } = await load();
    await createParty(PROFILE, { bots: { count: 1, level: 0 }, signal: controller.signal });
    expect(createMock).not.toHaveBeenCalled();
  });
});
