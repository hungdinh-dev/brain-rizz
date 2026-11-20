import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phòng đóng ngoài ý muốn khi khung đóng WebSocket bị Render/Cloudflare nuốt cả hai chiều:
 * - phòng party mất (server khởi động lại, nối lại thất bại) → về menu, báo một toast;
 * - nối lại bị server từ chối (Protocol.ERROR tới được) → thôi nối lại, tự đóng 4003 ngay;
 * - tin `closing` báo trước mã đóng → `onLeave` dùng mã đó dù sự kiện đóng chỉ còn 1006.
 * Colyseus, i18n, toast, tài khoản được giả lập; `sessionStorage` là bản giả trong bộ nhớ.
 */

const { createMock, joinByIdMock, toastMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  joinByIdMock: vi.fn(),
  toastMock: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock("@colyseus/sdk", () => ({
  Client: class {
    create = createMock;
    joinById = joinByIdMock;
    reconnect = vi.fn();
  },
  CloseCode: { CONSENTED: 4000, FAILED_TO_RECONNECT: 4003 },
}));
vi.mock("@/i18n", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/stores/auth.store", () => ({
  useAuth: { getState: () => ({ ensureSession: async () => null }) },
}));

const TOKEN_KEY = "brain-rizz:reconnect";
const PROFILE = { name: "Lan", colorIndex: 2, avatar: "bo" as const, difficulty: 1 as const };
const BRAIN = { name: "Lan", avatar: "bo" as const };

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

/** Phòng giả nhớ handler đã đăng ký để test tự bắn state / tin nhắn / lỗi / rời phòng. */
function fakeRoom(roomId: string) {
  const state: Listener[] = [];
  const drop: Listener[] = [];
  const leave: Listener[] = [];
  const error: Listener[] = [];
  const messages = new Map<string, Listener[]>();
  return {
    roomId,
    sessionId: `s-${roomId}`,
    reconnectionToken: `token-${roomId}`,
    send: vi.fn(),
    leave: vi.fn((_consented?: boolean) => new Promise<number>(() => {})),
    connection: { isOpen: true, close: vi.fn((_code?: number) => {}) },
    reconnection: { enabled: true, isReconnecting: false },
    onMessage: vi.fn((type: string, cb: Listener) => {
      messages.set(type, [...(messages.get(type) ?? []), cb]);
    }),
    onDrop: vi.fn((cb: Listener) => drop.push(cb)),
    onStateChange: vi.fn((cb: Listener) => state.push(cb)),
    onReconnect: vi.fn(),
    onLeave: vi.fn((cb: Listener) => leave.push(cb)),
    onError: vi.fn((cb: Listener) => error.push(cb)),
    emitPartyState(code: string) {
      for (const cb of state) cb({ toJSON: () => ({ code, phase: "lobby", seed: 1 }) });
    },
    emitBrainState() {
      for (const cb of state) cb({ toJSON: () => ({ phase: "intro", seed: 1 }) });
    },
    emitMessage(type: string, payload: unknown) {
      for (const cb of messages.get(type) ?? []) cb(payload);
    },
    /** Protocol.ERROR từ server có mã số; sự kiện `error` của socket thì không có mã. */
    emitError(code?: number, message?: string) {
      for (const cb of error) cb(code, message);
    },
    emitDrop(code = 1006) {
      for (const cb of drop) cb(code);
    },
    /** SDK gọi `onLeave` (sự kiện đóng, hoặc nối lại thất bại khi đã tắt nối lại). */
    emitLeave(code: number) {
      for (const cb of [...leave]) cb(code);
    },
  };
}

let storage: Storage;

/** Nạp lại module từ đầu: mỗi test bắt đầu khi chưa vào phòng nào. */
async function load() {
  vi.resetModules();
  const connection = await import("./connection");
  const { useGame } = await import("@/stores/game.store");
  const { useChat } = await import("@/stores/chat.store");
  const { useNav } = await import("@/stores/nav.store");
  const shared = await import("@brain-rizz/shared");
  return { ...connection, useGame, useChat, useNav, shared };
}

/** Toast "mất kết nối với phòng" đã hiện đúng một lần. */
function expectRoomLostToast() {
  const calls = toastMock.mock.calls.filter(([text]) => text === "connection.roomLost");
  expect(calls).toHaveLength(1);
}

describe("phòng đóng ngoài ý muốn khi khung đóng bị nuốt", { timeout: 30_000 }, () => {
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
    toastMock.mockClear();
    toastMock.error.mockClear();
    storage = memoryStorage();
    vi.stubGlobal("sessionStorage", storage);
  });

  // ------------------------------------------------------------- A. mất phòng party

  it("onLeave ngoài ý muốn của phòng party: về menu, xoá token, reset store, báo toast", async () => {
    const room = fakeRoom("ABCD");
    joinByIdMock.mockResolvedValueOnce(room);
    const { joinParty, send, useGame, useChat, useNav, shared } = await load();
    await joinParty("ABCD", PROFILE);
    room.emitPartyState("ABCD");
    expect(useNav.getState().screen).not.toBe("menu");
    expect(storage.getItem(TOKEN_KEY)).toBe("token-ABCD");
    expect(useChat.getState().roomCode).toBe("ABCD");

    // SDK bỏ cuộc nối lại (hoặc server đóng phòng): sự kiện đóng chỉ còn 1006.
    room.emitDrop();
    room.emitLeave(1006);

    expect(useNav.getState().screen).toBe("menu");
    expect(storage.getItem(TOKEN_KEY)).toBeNull();
    expect(useGame.getState().party).toBeNull();
    expect(useGame.getState().sessionId).toBe("");
    expect(useGame.getState().connection).toBe("offline");
    expect(useChat.getState().roomCode).toBe("");
    expectRoomLostToast();
    // Không gửi gì lên phòng đã mất (đã bỏ `room`).
    send(shared.ClientMessage.Ready);
    expect(room.send).not.toHaveBeenCalled();
    // Mất phòng thì không gửi LEAVE / tự đóng thêm.
    expect(room.leave).not.toHaveBeenCalled();
  });

  it("onLeave lặp lại của cùng phòng chỉ báo một lần", async () => {
    const room = fakeRoom("ABCD");
    joinByIdMock.mockResolvedValueOnce(room);
    const { joinParty } = await load();
    await joinParty("ABCD", PROFILE);

    room.emitLeave(1006);
    room.emitLeave(4003);

    expectRoomLostToast();
  });

  it("leaveParty rồi onLeave muộn: không báo mất phòng, không đụng phòng mới", async () => {
    const oldRoom = fakeRoom("OLD1");
    const newRoom = fakeRoom("NEW2");
    joinByIdMock.mockResolvedValueOnce(oldRoom).mockResolvedValueOnce(newRoom);
    const { joinParty, leaveParty, useGame, useNav } = await load();
    await joinParty("OLD1", PROFILE);
    await leaveParty();
    oldRoom.emitLeave(4000);
    expect(toastMock).not.toHaveBeenCalled();
    expect(useNav.getState().screen).toBe("menu");

    await joinParty("NEW2", PROFILE);
    newRoom.emitPartyState("NEW2");
    oldRoom.emitLeave(1006);

    expect(toastMock).not.toHaveBeenCalled();
    expect(useGame.getState().party?.code).toBe("NEW2");
    expect(useGame.getState().sessionId).toBe("s-NEW2");
    expect(useGame.getState().connection).toBe("online");
    expect(storage.getItem(TOKEN_KEY)).toBe("token-NEW2");
  });

  it("Kiểm tra não không theo nhánh party: đóng giữa lượt chỉ đặt 'offline', không về menu", async () => {
    const room = fakeRoom("BRAIN");
    createMock.mockResolvedValueOnce(room);
    const { startBrainTest, useGame, useNav } = await load();
    await startBrainTest(BRAIN);
    room.emitBrainState();

    room.emitDrop();
    room.emitLeave(1006);

    expect(useGame.getState().connection).toBe("offline");
    expect(useGame.getState().brain).not.toBeNull();
    expect(useGame.getState().sessionId).toBe("s-BRAIN");
    expect(useNav.getState().screen).not.toBe("menu");
    expect(toastMock).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------- B. nối lại bị từ chối

  it("lỗi server khi đang nối lại: tắt nối lại, tự đóng 4003; SDK gọi onLeave → về menu", async () => {
    const room = fakeRoom("ABCD");
    joinByIdMock.mockResolvedValueOnce(room);
    const { joinParty, useNav } = await load();
    await joinParty("ABCD", PROFILE);

    room.emitDrop();
    room.reconnection.isReconnecting = true;
    // Server: phòng không còn → Protocol.ERROR (MATCHMAKE_EXPIRED) rồi đóng 4003 (khung bị nuốt).
    room.emitError(4212, "seat reservation expired.");

    expect(room.reconnection.enabled).toBe(false);
    expect(room.connection.close).toHaveBeenCalledTimes(1);
    expect(room.connection.close).toHaveBeenCalledWith(4003);
    expect(room.leave).not.toHaveBeenCalled();

    // Đã tắt nối lại nên sự kiện đóng (dù là 1006) đi thẳng tới onLeave.
    room.emitLeave(1006);
    expect(useNav.getState().screen).toBe("menu");
    expectRoomLostToast();
  });

  it("lỗi server khi không nối lại: bỏ qua như cũ", async () => {
    const room = fakeRoom("ABCD");
    joinByIdMock.mockResolvedValueOnce(room);
    const { joinParty, useGame } = await load();
    await joinParty("ABCD", PROFILE);
    room.emitPartyState("ABCD");

    room.emitError(4212, "something");

    expect(room.reconnection.enabled).toBe(true);
    expect(room.connection.close).not.toHaveBeenCalled();
    expect(useGame.getState().party?.code).toBe("ABCD");
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("lỗi socket không có mã khi đang nối lại (mất mạng giữa lần thử): để SDK thử tiếp", async () => {
    const room = fakeRoom("ABCD");
    joinByIdMock.mockResolvedValueOnce(room);
    const { joinParty } = await load();
    await joinParty("ABCD", PROFILE);

    room.emitDrop();
    room.reconnection.isReconnecting = true;
    room.emitError(undefined);

    expect(room.reconnection.enabled).toBe(true);
    expect(room.connection.close).not.toHaveBeenCalled();
  });

  it("đóng ném lỗi (socket đã đóng) khi nối lại bị từ chối: vẫn tắt nối lại, không văng lỗi", async () => {
    const room = fakeRoom("ABCD");
    room.connection.close.mockImplementation(() => {
      throw new Error("already closed");
    });
    joinByIdMock.mockResolvedValueOnce(room);
    const { joinParty } = await load();
    await joinParty("ABCD", PROFILE);

    room.reconnection.isReconnecting = true;
    expect(() => room.emitError(4212)).not.toThrow();
    expect(room.reconnection.enabled).toBe(false);
  });

  // ------------------------------------------------------------- C. tin `closing`

  it("`closing` mã huỷ vì chờ lâu trên phòng Kiểm tra não: nhánh idle chạy dù sự kiện đóng là 1006", async () => {
    const room = fakeRoom("BRAIN");
    createMock.mockResolvedValueOnce(room);
    const { startBrainTest, sendBrain, useGame, shared } = await load();
    await startBrainTest(BRAIN);
    room.emitBrainState();
    const code = shared.BRAIN_TEST_IDLE_CLOSE_CODE;

    room.emitMessage(shared.ServerMessage.Closing, { code });

    expect(room.reconnection.enabled).toBe(false);
    expect(room.connection.close).toHaveBeenCalledWith(code);

    // Khung đóng 4100 của server bị nuốt: SDK thấy 1006, đã tắt nối lại nên gọi thẳng onLeave.
    room.emitDrop();
    room.emitLeave(1006);

    expect(useGame.getState().brain).toBeNull();
    expect(useGame.getState().sessionId).toBe("");
    expect(useGame.getState().connection).toBe("offline");
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith("brainTest.idleCancelled", expect.anything());
    sendBrain(shared.BrainClientMessage.Ready);
    expect(room.send).not.toHaveBeenCalled();
  });

  it("`closing` trên phòng party: tự đóng bằng mã đó, onLeave → về menu + toast", async () => {
    const room = fakeRoom("ABCD");
    joinByIdMock.mockResolvedValueOnce(room);
    const { joinParty, useGame, useNav, shared } = await load();
    await joinParty("ABCD", PROFILE);
    room.emitPartyState("ABCD");

    room.emitMessage(shared.ServerMessage.Closing, { code: 4100 });
    expect(room.reconnection.enabled).toBe(false);
    expect(room.connection.close).toHaveBeenCalledWith(4100);

    room.emitLeave(1006);
    expect(useNav.getState().screen).toBe("menu");
    expect(useGame.getState().party).toBeNull();
    expect(storage.getItem(TOKEN_KEY)).toBeNull();
    expectRoomLostToast();
  });

  it("`closing` với mã client không được gửi: tự đóng bằng CONSENTED (4000)", async () => {
    const room = fakeRoom("ABCD");
    joinByIdMock.mockResolvedValueOnce(room);
    const { joinParty, shared } = await load();
    await joinParty("ABCD", PROFILE);

    room.emitMessage(shared.ServerMessage.Closing, { code: 1006 });
    expect(room.connection.close).toHaveBeenLastCalledWith(4000);

    const other = fakeRoom("EFGH");
    joinByIdMock.mockResolvedValueOnce(other);
    await joinParty("EFGH", PROFILE);
    other.emitMessage(shared.ServerMessage.Closing, {});
    expect(other.reconnection.enabled).toBe(false);
    expect(other.connection.close).toHaveBeenLastCalledWith(4000);
  });

  it("`closing` / nối lại bị từ chối trên phòng cũ đã rời: chỉ đóng phòng cũ, không đụng phòng mới", async () => {
    const oldRoom = fakeRoom("OLD1");
    const newRoom = fakeRoom("NEW2");
    joinByIdMock.mockResolvedValueOnce(oldRoom).mockResolvedValueOnce(newRoom);
    const { joinParty, leaveParty, useGame, useChat, shared } = await load();
    await joinParty("OLD1", PROFILE);
    await leaveParty();
    await joinParty("NEW2", PROFILE);
    newRoom.emitPartyState("NEW2");
    oldRoom.connection.close.mockClear();

    // Lần nối lại SDK đã hẹn trước khi rời vẫn chạy và bị từ chối: đóng ngay phòng cũ.
    oldRoom.reconnection.isReconnecting = true;
    oldRoom.emitError(4212, "seat reservation expired.");
    expect(oldRoom.connection.close).toHaveBeenLastCalledWith(4003);
    // Tin `closing` muộn của phòng cũ: cũng chỉ đóng phòng cũ.
    oldRoom.emitMessage(shared.ServerMessage.Closing, { code: 4100 });
    oldRoom.emitLeave(1006);

    expect(newRoom.connection.close).not.toHaveBeenCalled();
    expect(newRoom.reconnection.enabled).toBe(true);
    expect(useGame.getState().party?.code).toBe("NEW2");
    expect(useGame.getState().connection).toBe("online");
    expect(useChat.getState().roomCode).toBe("NEW2");
    expect(storage.getItem(TOKEN_KEY)).toBe("token-NEW2");
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("Kiểm tra não: nối lại bị từ chối → tự đóng 4003, onLeave chỉ đặt 'offline' (không phải nhánh idle)", async () => {
    const room = fakeRoom("BRAIN");
    createMock.mockResolvedValueOnce(room);
    const { startBrainTest, useGame, useNav } = await load();
    await startBrainTest(BRAIN);
    room.emitBrainState();

    room.emitDrop();
    room.reconnection.isReconnecting = true;
    room.emitError(4212, "seat reservation expired.");
    expect(room.reconnection.enabled).toBe(false);
    expect(room.connection.close).toHaveBeenCalledWith(4003);

    room.emitLeave(1006);
    expect(useGame.getState().connection).toBe("offline");
    expect(useGame.getState().brain).not.toBeNull();
    expect(useNav.getState().screen).not.toBe("menu");
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("không có `closing` thì Kiểm tra não vẫn đọc mã của sự kiện đóng như cũ", async () => {
    const room = fakeRoom("BRAIN");
    createMock.mockResolvedValueOnce(room);
    const { startBrainTest, useGame, shared } = await load();
    await startBrainTest(BRAIN);
    room.emitBrainState();

    room.emitLeave(shared.BRAIN_TEST_IDLE_CLOSE_CODE);

    expect(useGame.getState().brain).toBeNull();
    expect(toastMock).toHaveBeenCalledWith("brainTest.idleCancelled", expect.anything());
  });
});
