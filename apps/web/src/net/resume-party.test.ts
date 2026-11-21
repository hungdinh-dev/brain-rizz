import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Nối lại phòng khi tải lại trang (`resumeParty`): StrictMode gọi hai lần với cùng token thì chỉ gửi
 * một yêu cầu nối lại, không xoá nhầm token mới, và state / tin muộn của phòng cũ không ghi đè phòng
 * đang chơi. Colyseus, i18n, toast, tài khoản được giả lập; `sessionStorage` là bản giả trong bộ nhớ.
 */

const { reconnectMock, joinByIdMock } = vi.hoisted(() => ({
  reconnectMock: vi.fn(),
  joinByIdMock: vi.fn(),
}));

vi.mock("@colyseus/sdk", () => ({
  Client: class {
    create = vi.fn();
    joinById = joinByIdMock;
    reconnect = reconnectMock;
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

/** Phòng giả nhớ các handler đã đăng ký để test tự bắn state / sự kiện. */
function fakeRoom(roomId: string, reconnectionToken: string) {
  const state: Listener[] = [];
  const drop: Listener[] = [];
  return {
    roomId,
    sessionId: `s-${roomId}`,
    reconnectionToken,
    send: vi.fn(),
    leave: vi.fn(async (_consented?: boolean) => 1000),
    connection: { isOpen: true, close: vi.fn() },
    reconnection: { enabled: true },
    onMessage: vi.fn(),
    onDrop: vi.fn((cb: Listener) => drop.push(cb)),
    onStateChange: vi.fn((cb: Listener) => state.push(cb)),
    onReconnect: vi.fn(),
    onLeave: vi.fn(),
    onError: vi.fn(),
    emitState(code: string) {
      for (const cb of state) cb({ toJSON: () => ({ code, phase: "lobby", seed: 1 }) });
    },
    emitDrop() {
      for (const cb of drop) cb(1006);
    },
  };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let storage: Storage;

/** Nạp lại module từ đầu: mỗi test bắt đầu khi chưa vào phòng nào. */
async function load() {
  vi.resetModules();
  const connection = await import("./connection");
  const { useGame } = await import("@/stores/game.store");
  return { ...connection, useGame };
}

describe("nối lại phòng khi tải lại trang", { timeout: 30_000 }, () => {
  beforeAll(() => {
    vi.stubEnv("VITE_SERVER_URL", "http://server.test");
    vi.stubGlobal("document", { addEventListener: vi.fn(), visibilityState: "visible" });
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    reconnectMock.mockReset();
    joinByIdMock.mockReset();
    storage = memoryStorage();
    vi.stubGlobal("sessionStorage", storage);
  });

  it("gọi hai lần liền (StrictMode) → một yêu cầu, giữ token mới của phòng", async () => {
    storage.setItem(TOKEN_KEY, "old-token");
    const room = fakeRoom("ABCD", "new-token");
    // Token chỉ dùng được một lần: lần gửi thứ hai (nếu có) bị từ chối như server thật.
    reconnectMock
      .mockResolvedValueOnce(room)
      .mockRejectedValueOnce(Object.assign(new Error("already consumed"), { code: 4003 }));
    const { resumeParty, useGame } = await load();

    const [first, second] = await Promise.all([resumeParty(), resumeParty()]);

    expect(reconnectMock).toHaveBeenCalledTimes(1);
    expect(reconnectMock).toHaveBeenCalledWith("old-token");
    expect([first, second]).toEqual([true, true]);
    expect(storage.getItem(TOKEN_KEY)).toBe("new-token");
    expect(useGame.getState().sessionId).toBe("s-ABCD");
  });

  it("qua cửa tải lười (App): gọi hai lần liền (StrictMode) → vẫn một yêu cầu, giữ token mới", async () => {
    storage.setItem(TOKEN_KEY, "old-token");
    reconnectMock
      .mockResolvedValueOnce(fakeRoom("ABCD", "new-token"))
      .mockRejectedValueOnce(Object.assign(new Error("already consumed"), { code: 4003 }));
    const { useGame } = await load();
    const lazy = await import("./lazy-connection");

    const [first, second] = await Promise.all([lazy.resumeParty(), lazy.resumeParty()]);

    expect(reconnectMock).toHaveBeenCalledTimes(1);
    expect([first, second]).toEqual([true, true]);
    expect(storage.getItem(TOKEN_KEY)).toBe("new-token");
    expect(useGame.getState().sessionId).toBe("s-ABCD");
  });

  it("không có token → không gọi máy chủ", async () => {
    const { resumeParty } = await load();
    await expect(resumeParty()).resolves.toBe(false);
    expect(reconnectMock).not.toHaveBeenCalled();
  });

  it("lần trước đã xong thì gọi lại gửi yêu cầu mới với token hiện có (không giữ kết quả cũ)", async () => {
    storage.setItem(TOKEN_KEY, "t1");
    reconnectMock.mockRejectedValueOnce(new Error("expired"));
    const { resumeParty, useGame } = await load();
    await expect(resumeParty()).resolves.toBe(false);

    storage.setItem(TOKEN_KEY, "t2");
    reconnectMock.mockResolvedValueOnce(fakeRoom("ABCD", "t3"));
    await expect(resumeParty()).resolves.toBe(true);

    expect(reconnectMock).toHaveBeenCalledTimes(2);
    expect(reconnectMock).toHaveBeenLastCalledWith("t2");
    expect(storage.getItem(TOKEN_KEY)).toBe("t3");
    expect(useGame.getState().sessionId).toBe("s-ABCD");
  });

  it("nối lại thất bại: xoá token đã dùng, nhưng không xoá token mới vừa được lưu", async () => {
    storage.setItem(TOKEN_KEY, "stale");
    reconnectMock.mockRejectedValueOnce(new Error("expired"));
    let mod = await load();
    await expect(mod.resumeParty()).resolves.toBe(false);
    expect(storage.getItem(TOKEN_KEY)).toBeNull();

    storage.setItem(TOKEN_KEY, "stale");
    const pending = deferred<never>();
    reconnectMock.mockReturnValueOnce(pending.promise);
    mod = await load();
    const result = mod.resumeParty();
    // Trong lúc chờ, một lần vào phòng khác đã lưu token của nó.
    storage.setItem(TOKEN_KEY, "fresh");
    pending.reject(new Error("already consumed"));
    await expect(result).resolves.toBe(false);
    expect(storage.getItem(TOKEN_KEY)).toBe("fresh");
  });

  it("state / rớt mạng muộn của phòng cũ không ghi đè phòng đang chơi", async () => {
    storage.setItem(TOKEN_KEY, "old-token");
    const oldRoom = fakeRoom("OLD1", "old-2");
    const newRoom = fakeRoom("NEW2", "new-1");
    reconnectMock.mockResolvedValueOnce(oldRoom);
    joinByIdMock.mockResolvedValueOnce(newRoom);
    const { resumeParty, joinParty, useGame } = await load();

    await resumeParty();
    oldRoom.emitState("OLD1");
    expect(useGame.getState().party?.code).toBe("OLD1");

    await joinParty("NEW2", PROFILE);
    newRoom.emitState("NEW2");
    oldRoom.emitState("OLD1");
    oldRoom.emitDrop();

    expect(useGame.getState().party?.code).toBe("NEW2");
    expect(useGame.getState().sessionId).toBe("s-NEW2");
    expect(useGame.getState().connection).toBe("online");
    expect(storage.getItem(TOKEN_KEY)).toBe("new-1");
  });

  it("nối lại xong khi đã vào phòng khác → rời phòng cũ, giữ phòng đang chơi", async () => {
    storage.setItem(TOKEN_KEY, "old-token");
    const oldRoom = fakeRoom("OLD1", "old-2");
    const newRoom = fakeRoom("NEW2", "new-1");
    const pending = deferred<typeof oldRoom>();
    reconnectMock.mockReturnValueOnce(pending.promise);
    joinByIdMock.mockResolvedValueOnce(newRoom);
    const { resumeParty, joinParty, useGame } = await load();

    const result = resumeParty();
    await joinParty("NEW2", PROFILE);
    pending.resolve(oldRoom);

    await expect(result).resolves.toBe(false);
    expect(oldRoom.leave).toHaveBeenCalledTimes(1);
    expect(oldRoom.leave).toHaveBeenCalledWith(true);
    expect(oldRoom.connection.close).toHaveBeenCalledWith(4000);
    expect(oldRoom.reconnection.enabled).toBe(false);
    expect(oldRoom.onStateChange).not.toHaveBeenCalled();
    expect(useGame.getState().sessionId).toBe("s-NEW2");
    expect(storage.getItem(TOKEN_KEY)).toBe("new-1");
  });
});
