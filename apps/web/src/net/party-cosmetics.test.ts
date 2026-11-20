import { ROOM_NAME, ServerMessage } from "@brain-rizz/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phấn, phụ kiện, thú khoá (CR-023, CR-024; kế hoạch mục 5.4) ở lớp kết nối: gửi `accessories` đã
 * làm sạch khi tạo / vào phòng, nhận `ServerMessage.Reward` vào store, tạo phiên khách trước khi
 * vào phòng nhưng không chờ quá 3 giây. Colyseus, i18n, toast, tài khoản được giả lập.
 */

const { createMock, joinMock, ensureMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  joinMock: vi.fn(),
  ensureMock: vi.fn(async (): Promise<string | null> => null),
}));

vi.mock("@colyseus/sdk", () => ({
  Client: class {
    create = createMock;
    joinById = joinMock;
    reconnect = vi.fn();
  },
  CloseCode: { CONSENTED: 4000 },
}));
vi.mock("@/i18n", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock("@/stores/auth.store", () => ({
  useAuth: { getState: () => ({ ensureSession: ensureMock }) },
}));

type Handler = (msg: unknown) => void;

function fakeRoom() {
  const handlers = new Map<string, Handler>();
  return {
    handlers,
    roomId: "ABCD",
    sessionId: "s1",
    reconnectionToken: "token",
    send: vi.fn(),
    leave: vi.fn(async (_consented?: boolean) => 1000),
    connection: { isOpen: true, close: vi.fn() },
    reconnection: { enabled: true },
    onMessage: vi.fn((type: string, handler: Handler) => {
      handlers.set(type, handler);
    }),
    onDrop: vi.fn(),
    onStateChange: vi.fn(),
    onReconnect: vi.fn(),
    onLeave: vi.fn(),
  };
}

const PROFILE = {
  name: "Lan",
  colorIndex: 2,
  avatar: "pin" as const,
  difficulty: 1 as const,
  // Món lạ và món trùng chỗ (2 món cổ) phải bị bỏ trước khi gửi.
  accessories: ["scarf", "crown", "dragon-wings", "bell"],
};

async function load() {
  const connection = await import("./connection");
  const { useGame } = await import("@/stores/game.store");
  return { ...connection, useGame };
}

describe("kết nối party: phụ kiện, phấn, phiên khách", { timeout: 30_000 }, () => {
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
    joinMock.mockReset();
    ensureMock.mockReset();
    ensureMock.mockResolvedValue(null);
    (await load()).useGame.getState().reset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("tạo phòng gửi phụ kiện đã làm sạch (đầu → mặt → cổ) cùng hồ sơ", async () => {
    createMock.mockResolvedValue(fakeRoom());
    const { createParty } = await load();
    await createParty(PROFILE);
    expect(createMock).toHaveBeenCalledWith(ROOM_NAME, {
      name: "Lan",
      colorIndex: 2,
      avatar: "pin",
      difficulty: 1,
      accessories: ["crown", "scarf"],
      accessToken: undefined,
    });
  });

  it("vào phòng bằng mã cũng gửi phụ kiện; hồ sơ chưa có phụ kiện → mảng rỗng", async () => {
    joinMock.mockResolvedValue(fakeRoom());
    const { joinParty } = await load();
    await joinParty("ABCD", PROFILE);
    expect(joinMock.mock.calls[0]?.[1]).toMatchObject({ accessories: ["crown", "scarf"] });
    const { accessories: _drop, ...noAccessories } = PROFILE;
    await joinParty("WXYZ", noAccessories);
    expect(joinMock.mock.calls[1]?.[1]).toMatchObject({ accessories: [] });
  });

  it("có phiên thì gửi token để server ghi kết quả và cộng phấn", async () => {
    ensureMock.mockResolvedValue("jwt-123");
    createMock.mockResolvedValue(fakeRoom());
    const { createParty } = await load();
    await createParty(PROFILE);
    expect(ensureMock).toHaveBeenCalledWith({ name: "Lan", avatar: "pin" });
    expect(createMock.mock.calls[0]?.[1]).toMatchObject({ accessToken: "jwt-123" });
  });

  it("tạo phiên khách treo: chờ đúng 3 giây rồi vào phòng không token", async () => {
    vi.useFakeTimers();
    ensureMock.mockImplementation(() => new Promise<string | null>(() => {}));
    createMock.mockResolvedValue(fakeRoom());
    const { createParty, ACCESS_TOKEN_WAIT_MS } = await load();
    expect(ACCESS_TOKEN_WAIT_MS).toBe(3_000);
    const done = createParty(PROFILE);
    await vi.advanceTimersByTimeAsync(2_999);
    expect(createMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0]?.[1]).toMatchObject({ accessToken: undefined });
  });

  it("tạo phiên lỗi vẫn vào phòng", async () => {
    ensureMock.mockRejectedValue(new Error("supabase down"));
    createMock.mockResolvedValue(fakeRoom());
    const { createParty, useGame } = await load();
    await createParty(PROFILE);
    expect(useGame.getState().sessionId).toBe("s1");
  });

  it("nhận Reward → store giữ số phấn; số lạ → 0; rời vinh danh thì bỏ", async () => {
    const room = fakeRoom();
    createMock.mockResolvedValue(room);
    const { createParty, useGame } = await load();
    await createParty(PROFILE);
    const reward = room.handlers.get(ServerMessage.Reward);
    expect(reward).toBeTypeOf("function");
    expect(useGame.getState().reward).toBeNull();

    // Vào vinh danh rồi mới nhận phấn (server gửi sau khi ghi kết quả).
    const party = (phase: string) => ({ phase, seed: 1 }) as never;
    useGame.getState().setParty(party("podium"));
    reward?.({ chalk: 42 });
    expect(useGame.getState().reward).toBe(42);
    reward?.({ chalk: "lots" });
    expect(useGame.getState().reward).toBe(0);
    reward?.({ chalk: 37.9 });
    expect(useGame.getState().reward).toBe(37);

    // Chơi lại → về phòng chờ: chip phấn của trận trước không còn.
    useGame.getState().setParty(party("lobby"));
    expect(useGame.getState().reward).toBeNull();
  });
});
