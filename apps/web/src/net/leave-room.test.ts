import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Rời phòng không chờ server đóng kết nối: qua Render/Cloudflare khung đóng của server không tới
 * trình duyệt, nên client gửi LEAVE_ROOM rồi tự đóng (CONSENTED), tắt nối lại và về menu ngay.
 * Colyseus, i18n, toast, tài khoản được giả lập; `sessionStorage` là bản giả trong bộ nhớ.
 */

const { createMock, joinByIdMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  joinByIdMock: vi.fn(),
}));

vi.mock("@colyseus/sdk", () => ({
  Client: class {
    create = createMock;
    joinById = joinByIdMock;
    reconnect = vi.fn();
  },
  CloseCode: { CONSENTED: 4000 },
}));
vi.mock("@/i18n", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock("@/stores/auth.store", () => ({
  useAuth: { getState: () => ({ ensureSession: async () => null }) },
}));

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

type Listener = (...args: unknown[]) => void;

/**
 * Phòng giả: `leave()` không bao giờ xong (như khi khung đóng của server bị giữ lại), nhớ handler
 * đã đăng ký để test tự bắn state / rớt mạng / nối lại.
 */
function fakeRoom(roomId: string) {
  const state: Listener[] = [];
  const drop: Listener[] = [];
  const reconnect: Listener[] = [];
  const leave: Listener[] = [];
  return {
    roomId,
    sessionId: `s-${roomId}`,
    reconnectionToken: `token-${roomId}`,
    send: vi.fn(),
    leave: vi.fn((_consented?: boolean) => new Promise<number>(() => {})),
    connection: { isOpen: true, close: vi.fn((_code?: number) => {}) },
    reconnection: { enabled: true, isReconnecting: false },
    onMessage: vi.fn(),
    onDrop: vi.fn((cb: Listener) => drop.push(cb)),
    onStateChange: vi.fn((cb: Listener) => state.push(cb)),
    onReconnect: vi.fn((cb: Listener) => reconnect.push(cb)),
    onLeave: vi.fn((cb: Listener) => leave.push(cb)),
    onError: vi.fn(),
    emitState(code: string) {
      for (const cb of state) cb({ toJSON: () => ({ code, phase: "lobby", seed: 1 }) });
    },
    emitDrop() {
      for (const cb of drop) cb(1006);
    },
    emitReconnect() {
      for (const cb of [...reconnect]) cb();
    },
    /** SDK gọi `onLeave` (vd. nối lại thất bại khi đã tắt nối lại, hoặc khung đóng tới muộn). */
    emitLeave(code: number) {
      for (const cb of [...leave]) cb(code);
    },
  };
}

type FakeRoom = ReturnType<typeof fakeRoom>;

/** Đã gửi LEAVE_ROOM rồi mới tự đóng bằng CONSENTED (4000), và tắt nối lại. */
function expectClosedByClient(room: FakeRoom, times = 1) {
  expect(room.leave).toHaveBeenCalledTimes(times);
  expect(room.leave).toHaveBeenLastCalledWith(true);
  expect(room.connection.close).toHaveBeenCalledTimes(times);
  expect(room.connection.close).toHaveBeenLastCalledWith(4000);
  const leaveOrder = room.leave.mock.invocationCallOrder[0] ?? Infinity;
  const closeOrder = room.connection.close.mock.invocationCallOrder[0] ?? -Infinity;
  expect(leaveOrder).toBeLessThan(closeOrder);
  expect(room.reconnection.enabled).toBe(false);
}

/** Promise xong trong vài chục ms (không chờ mạng) → "done", treo → "pending". */
function settlesQuickly(promise: Promise<unknown>) {
  return Promise.race([
    promise.then(() => "done"),
    new Promise((resolve) => setTimeout(() => resolve("pending"), 50)),
  ]);
}

let storage: Storage;

/** Nạp lại module từ đầu: mỗi test bắt đầu khi chưa vào phòng nào. */
async function load() {
  vi.resetModules();
  const connection = await import("./connection");
  const { useGame } = await import("@/stores/game.store");
  const { useNav } = await import("@/stores/nav.store");
  return { ...connection, useGame, useNav };
}

describe("rời phòng không chờ server đóng kết nối", { timeout: 30_000 }, () => {
  beforeAll(() => {
    vi.stubEnv("VITE_SERVER_URL", "http://server.test");
    vi.stubGlobal("document", { addEventListener: vi.fn(), visibilityState: "visible" });
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    createMock.mockReset();
    joinByIdMock.mockReset();
    storage = memoryStorage();
    vi.stubGlobal("sessionStorage", storage);
  });

  it("leaveParty xong ngay dù server không trả lời: gửi LEAVE, tự đóng 4000, về menu, xoá token", async () => {
    const room = fakeRoom("ABCD");
    joinByIdMock.mockResolvedValueOnce(room);
    const { joinParty, leaveParty, useGame, useNav } = await load();
    await joinParty("ABCD", PROFILE);
    room.emitState("ABCD");
    expect(storage.getItem(TOKEN_KEY)).toBe("token-ABCD");

    await expect(settlesQuickly(leaveParty())).resolves.toBe("done");

    expectClosedByClient(room);
    expect(storage.getItem(TOKEN_KEY)).toBeNull();
    expect(useNav.getState().screen).toBe("menu");
    expect(useGame.getState().party).toBeNull();
    expect(useGame.getState().sessionId).toBe("");
    expect(useGame.getState().connection).toBe("offline");
  });

  it("sau khi rời, rớt mạng / state muộn của phòng cũ không bật 'đang nối lại'", async () => {
    const room = fakeRoom("ABCD");
    joinByIdMock.mockResolvedValueOnce(room);
    const { joinParty, leaveParty, useGame } = await load();
    await joinParty("ABCD", PROFILE);
    await leaveParty();

    room.emitDrop();
    room.emitState("ABCD");

    expect(useGame.getState().connection).toBe("offline");
    expect(useGame.getState().party).toBeNull();
  });

  it("rời khi đang giữa lúc nối lại: nối lại được thì tự rời + đóng, không giành lại màn hình", async () => {
    const room = fakeRoom("ABCD");
    joinByIdMock.mockResolvedValueOnce(room);
    const { joinParty, leaveParty, useGame } = await load();
    await joinParty("ABCD", PROFILE);

    // Vừa rớt mạng, SDK đang chờ nối lại: socket chưa mở thì chưa gửi / đóng gì.
    room.emitDrop();
    room.connection.isOpen = false;
    await expect(settlesQuickly(leaveParty())).resolves.toBe("done");
    expect(room.reconnection.enabled).toBe(false);
    expect(room.leave).not.toHaveBeenCalled();
    expect(room.connection.close).not.toHaveBeenCalled();

    // Lần nối lại SDK đã hẹn vẫn chạy và thành công → rời + đóng ngay (không để "người chơi ma").
    room.connection.isOpen = true;
    room.emitReconnect();
    expectClosedByClient(room);
    expect(useGame.getState().connection).toBe("offline");
    expect(storage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("socket nối lại đã mở nhưng chưa nhận JOIN_ROOM: chưa gửi LEAVE / đóng, chờ onReconnect", async () => {
    const room = fakeRoom("ABCD");
    joinByIdMock.mockResolvedValueOnce(room);
    const { joinParty, leaveParty } = await load();
    await joinParty("ABCD", PROFILE);

    // Server chưa gắn listener tin nhắn (chưa gửi JOIN_ROOM) nên LEAVE gửi lúc này sẽ bị mất.
    room.emitDrop();
    room.reconnection.isReconnecting = true;
    room.connection.isOpen = true;
    await expect(settlesQuickly(leaveParty())).resolves.toBe("done");
    expect(room.reconnection.enabled).toBe(false);
    expect(room.leave).not.toHaveBeenCalled();
    expect(room.connection.close).not.toHaveBeenCalled();

    // SDK đặt `isReconnecting = false` ngay trước khi gọi `onReconnect` → lúc này mới rời + đóng.
    room.reconnection.isReconnecting = false;
    room.emitReconnect();
    expectClosedByClient(room);
  });

  it("rời xong mà lần nối lại cũ vẫn tới → rời + đóng thêm lần nữa", async () => {
    const room = fakeRoom("ABCD");
    joinByIdMock.mockResolvedValueOnce(room);
    const { joinParty, leaveParty } = await load();
    await joinParty("ABCD", PROFILE);
    await leaveParty();
    expectClosedByClient(room, 1);

    room.emitReconnect();
    expectClosedByClient(room, 2);
  });

  it("kết nối đã đóng (close ném lỗi) vẫn rời êm và về menu", async () => {
    const room = fakeRoom("ABCD");
    room.connection.close.mockImplementation(() => {
      throw new Error("already closed");
    });
    joinByIdMock.mockResolvedValueOnce(room);
    const { joinParty, leaveParty, useNav } = await load();
    await joinParty("ABCD", PROFILE);
    await expect(leaveParty()).resolves.toBeUndefined();
    expect(useNav.getState().screen).toBe("menu");
  });

  it("leaveBrainTest dùng cùng cách đóng, xong ngay dù server không trả lời", async () => {
    const room = fakeRoom("BRAIN");
    createMock.mockResolvedValueOnce(room);
    const { startBrainTest, leaveBrainTest, useGame } = await load();
    await startBrainTest({ name: "Lan", avatar: "bo" });
    expect(useGame.getState().sessionId).toBe("s-BRAIN");

    await expect(settlesQuickly(leaveBrainTest())).resolves.toBe("done");

    expectClosedByClient(room);
    expect(useGame.getState().sessionId).toBe("");
    expect(useGame.getState().brain).toBeNull();
    room.emitDrop();
    expect(useGame.getState().connection).toBe("offline");
  });

  it("Làm lại Kiểm tra não: rời phòng cũ (không chờ) rồi tạo phòng mới", async () => {
    const first = fakeRoom("B1");
    const second = fakeRoom("B2");
    createMock.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const { startBrainTest, useGame } = await load();
    await startBrainTest({ name: "Lan", avatar: "bo" });
    await expect(settlesQuickly(startBrainTest({ name: "Lan", avatar: "bo" }))).resolves.toBe(
      "done",
    );

    expectClosedByClient(first);
    expect(second.leave).not.toHaveBeenCalled();
    expect(useGame.getState().sessionId).toBe("s-B2");
  });

  it("bấm rời hai lần liên tiếp: chỉ gửi LEAVE + đóng một lần, lần hai vẫn về menu êm", async () => {
    const room = fakeRoom("ABCD");
    joinByIdMock.mockResolvedValueOnce(room);
    const { joinParty, leaveParty, useNav } = await load();
    await joinParty("ABCD", PROFILE);
    const handlersBefore = room.onReconnect.mock.calls.length;

    await Promise.all([leaveParty(), leaveParty()]);

    expectClosedByClient(room, 1);
    // Chỉ gắn thêm một handler "nối lại muộn thì rời + đóng".
    expect(room.onReconnect.mock.calls.length - handlersBefore).toBe(1);
    expect(useNav.getState().screen).toBe("menu");
  });

  it("rời khi đang nối lại mà nối lại thất bại (SDK gọi onLeave): không gửi gì, không đổi màn hình", async () => {
    const room = fakeRoom("ABCD");
    joinByIdMock.mockResolvedValueOnce(room);
    const { joinParty, leaveParty, useGame, useNav } = await load();
    await joinParty("ABCD", PROFILE);

    room.emitDrop();
    room.connection.isOpen = false;
    await leaveParty();
    // Đã tắt nối lại nên lần thử đang dở thất bại thì SDK gọi thẳng onLeave (1006).
    room.emitLeave(1006);

    expect(room.leave).not.toHaveBeenCalled();
    expect(room.connection.close).not.toHaveBeenCalled();
    expect(room.reconnection.enabled).toBe(false);
    expect(useNav.getState().screen).toBe("menu");
    expect(useGame.getState().connection).toBe("offline");
  });

  it("phòng cũ đã rời không đụng tới phòng mới: state / rớt mạng / nối lại / onLeave muộn đều bị bỏ qua", async () => {
    const oldRoom = fakeRoom("OLD1");
    const newRoom = fakeRoom("NEW2");
    joinByIdMock.mockResolvedValueOnce(oldRoom).mockResolvedValueOnce(newRoom);
    const { joinParty, leaveParty, useGame } = await load();
    await joinParty("OLD1", PROFILE);
    await leaveParty();
    await joinParty("NEW2", PROFILE);
    newRoom.emitState("NEW2");

    oldRoom.emitState("OLD1");
    oldRoom.emitDrop();
    oldRoom.emitReconnect();
    oldRoom.emitLeave(4000);

    // Lần nối lại muộn của phòng cũ chỉ rời + đóng phòng cũ.
    expectClosedByClient(oldRoom, 2);
    expect(newRoom.leave).not.toHaveBeenCalled();
    expect(newRoom.connection.close).not.toHaveBeenCalled();
    expect(newRoom.reconnection.enabled).toBe(true);
    expect(useGame.getState().party?.code).toBe("NEW2");
    expect(useGame.getState().sessionId).toBe("s-NEW2");
    expect(useGame.getState().connection).toBe("online");
    expect(storage.getItem(TOKEN_KEY)).toBe("token-NEW2");
  });

  it("Làm lại Kiểm tra não: phòng cũ đóng muộn (kể cả mã huỷ vì chờ lâu) không xoá phòng mới", async () => {
    const { BRAIN_TEST_IDLE_CLOSE_CODE } = await import("@brain-rizz/shared");
    const first = fakeRoom("B1");
    const second = fakeRoom("B2");
    createMock.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const { startBrainTest, useGame } = await load();
    await startBrainTest({ name: "Lan", avatar: "bo" });
    await startBrainTest({ name: "Lan", avatar: "bo" });

    first.emitDrop();
    first.emitLeave(BRAIN_TEST_IDLE_CLOSE_CODE);

    expect(useGame.getState().sessionId).toBe("s-B2");
    expect(useGame.getState().connection).toBe("online");
    expect(second.leave).not.toHaveBeenCalled();
    expect(second.connection.close).not.toHaveBeenCalled();
  });
});
