import { emptyUnlockStats, type UnlockStats } from "@brain-rizz/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/lib/storage";
import type { DataResult } from "@/net/data-api";

/**
 * Tiến độ mở khoá + hộp chúc mừng (CR-024, ui-ux 6.12): chỉ chúc mừng thú MỚI mở so với danh sách
 * đã thấy trên máy; lần đầu có số liệu thì ghi lại, không chúc mừng thú mở sẵn. RPC giả lập.
 */

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn<() => Promise<DataResult<UnlockStats>>>(),
}));
vi.mock("@/net/unlocks-api", () => ({ fetchUnlockStats: fetchMock }));

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const stats = (patch: Partial<UnlockStats>): UnlockStats => ({ ...emptyUnlockStats(), ...patch });
const ok = (s: UnlockStats): DataResult<UnlockStats> => ({ ok: true, data: s });
/** `pin` mở (10 trận), `gai` mở (5 trận nhất). */
const PIN = stats({ partyMatches: 12 });
const PIN_GAI = stats({ partyMatches: 14, partyWins: 5 });

let storage: ReturnType<typeof memoryStorage>;

/**
 * Nạp lại store với phiên đã đọc xong: mặc định khách `g1` (biến môi trường test có thể bật Supabase,
 * khi đó phiên bắt đầu ở `unknown`).
 */
async function load(user: string | null = "g1") {
  vi.resetModules();
  const store = await import("./pets.store");
  const seen = await import("./seen");
  const { useAuth } = await import("@/stores/auth.store");
  useAuth.setState({ status: user ? "guest" : "signed-out", userId: user });
  return { ...store, ...seen, useAuth };
}

/** Bản lưu danh sách đã thấy (kèm người dùng). */
const record = (user: string | null, ids: string[]) => JSON.stringify({ user, ids });
const stored = () => JSON.parse(storage.getItem(STORAGE_KEYS.petsSeen) ?? "null");

describe("tiến độ mở khoá và hộp chúc mừng", { timeout: 30_000 }, () => {
  beforeEach(() => {
    storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lần đầu có số liệu: ghi thú đang mở là đã thấy, không chúc mừng", async () => {
    fetchMock.mockResolvedValue(ok(PIN));
    const { usePetUnlockStore, unlockedPetsOf, pendingCelebrations } = await load();
    expect(usePetUnlockStore.getState().seen).toBeNull();
    await usePetUnlockStore.getState().refresh();
    const s = usePetUnlockStore.getState();
    expect(s.load).toBe("ready");
    expect(s.fromServer).toBe(true);
    expect(s.seen).toEqual(["pin"]);
    expect(stored()).toEqual({ user: "g1", ids: ["pin"] });
    expect(pendingCelebrations(unlockedPetsOf(s.stats), s.seen)).toEqual([]);
  });

  it("thú mới mở sau đó → chúc mừng đúng thú đó; xem xong thì thôi", async () => {
    storage.setItem(STORAGE_KEYS.petsSeen, record("g1", ["pin"]));
    fetchMock.mockResolvedValue(ok(PIN_GAI));
    const { usePetUnlockStore, unlockedPetsOf, pendingCelebrations } = await load();
    await usePetUnlockStore.getState().refresh();
    let s = usePetUnlockStore.getState();
    expect(pendingCelebrations(unlockedPetsOf(s.stats), s.seen)).toEqual(["gai"]);
    s.markSeen(["gai"]);
    s = usePetUnlockStore.getState();
    expect(pendingCelebrations(unlockedPetsOf(s.stats), s.seen)).toEqual([]);
    expect(stored()).toEqual({ user: "g1", ids: ["pin", "gai"] });
  });

  it("nhiều thú cùng lúc → lần lượt theo thứ tự thú; bản lưu hỏng / kiểu cũ coi như lần đầu", async () => {
    const { pendingCelebrations, loadSeenPets, loadSeenRecord } = await load();
    expect(pendingCelebrations(["lua", "pin", "op"], [])).toEqual(["pin", "op", "lua"]);
    expect(pendingCelebrations(["pin"], null)).toEqual([]);
    storage.setItem(STORAGE_KEYS.petsSeen, "{oops");
    expect(loadSeenRecord()).toBeNull();
    // Kiểu cũ (mảng, không biết của ai) → chưa có.
    storage.setItem(STORAGE_KEYS.petsSeen, JSON.stringify(["pin"]));
    expect(loadSeenRecord()).toBeNull();
    storage.setItem(STORAGE_KEYS.petsSeen, JSON.stringify({ user: 7, ids: ["pin"] }));
    expect(loadSeenRecord()).toBeNull();
    storage.setItem(STORAGE_KEYS.petsSeen, record("u1", ["gai", "dragon", "khoi", "gai"]));
    expect(loadSeenPets("u1")).toEqual(["gai"]);
    expect(loadSeenPets("u2")).toBeNull();
    expect(loadSeenPets(null)).toBeNull();
  });

  it("đổi tài khoản trên cùng máy: người mới không bị chúc mừng dồn thú đã mở sẵn", async () => {
    storage.setItem(STORAGE_KEYS.petsSeen, record("u1", ["pin"]));
    fetchMock.mockResolvedValue(ok(PIN_GAI));
    const { ensurePetUnlocks, usePetUnlockStore, unlockedPetsOf, pendingCelebrations, useAuth } =
      await load();
    useAuth.setState({ status: "google", userId: "u1" });
    ensurePetUnlocks();
    await usePetUnlockStore.getState().refresh();
    let s = usePetUnlockStore.getState();
    // Cùng người: Gai vừa mở → chúc mừng.
    expect(pendingCelebrations(unlockedPetsOf(s.stats), s.seen)).toEqual(["gai"]);

    // Người khác đăng nhập (đã mở Pin, Gai từ trước): đánh dấu đã thấy hết, không hộp nào.
    useAuth.setState({ status: "google", userId: "u2" });
    await usePetUnlockStore.getState().refresh();
    s = usePetUnlockStore.getState();
    expect(s.seenUser).toBe("u2");
    expect(pendingCelebrations(unlockedPetsOf(s.stats), s.seen)).toEqual([]);
    expect(stored()).toEqual({ user: "u2", ids: ["pin", "gai"] });
    // Hộp đã xem ghi cho đúng người.
    s.markSeen(["op"]);
    expect(stored()).toEqual({ user: "u2", ids: ["pin", "op", "gai"] });
  });

  it("số liệu về trước khi đọc xong phiên → chưa so, chưa ghi; đọc xong thì so đúng người", async () => {
    storage.setItem(STORAGE_KEYS.petsSeen, record("u1", ["pin"]));
    fetchMock.mockResolvedValue(ok(PIN_GAI));
    const { ensurePetUnlocks, usePetUnlockStore, unlockedPetsOf, pendingCelebrations, useAuth } =
      await load();
    useAuth.setState({ status: "unknown", userId: null });
    ensurePetUnlocks();
    await usePetUnlockStore.getState().refresh();
    let s = usePetUnlockStore.getState();
    expect(s.load).toBe("ready");
    expect(s.seen).toBeNull();
    expect(pendingCelebrations(unlockedPetsOf(s.stats), s.seen)).toEqual([]);
    expect(stored()).toEqual({ user: "u1", ids: ["pin"] });

    useAuth.setState({ status: "google", userId: "u1" });
    await usePetUnlockStore.getState().refresh();
    s = usePetUnlockStore.getState();
    expect(pendingCelebrations(unlockedPetsOf(s.stats), s.seen)).toEqual(["gai"]);
  });

  it("chưa có phiên → số 0, không ghi danh sách đã thấy (đăng nhập sau không chúc mừng dồn)", async () => {
    fetchMock.mockResolvedValue({ ok: false, reason: "no-session" });
    const { usePetUnlockStore } = await load(null);
    await usePetUnlockStore.getState().refresh();
    const s = usePetUnlockStore.getState();
    expect(s.load).toBe("ready");
    expect(s.fromServer).toBe(false);
    expect(s.stats).toEqual(emptyUnlockStats());
    expect(s.seen).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.petsSeen)).toBeNull();
  });

  it("lỗi / DB chưa có hàm → 'chưa có dữ liệu'; lỗi khi làm mới thì giữ số cũ", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, reason: "error" });
    const { usePetUnlockStore } = await load();
    await usePetUnlockStore.getState().refresh();
    expect(usePetUnlockStore.getState().load).toBe("unavailable");

    fetchMock.mockResolvedValueOnce(ok(PIN));
    await usePetUnlockStore.getState().refresh();
    fetchMock.mockResolvedValueOnce({ ok: false, reason: "error" });
    await usePetUnlockStore.getState().refresh();
    const s = usePetUnlockStore.getState();
    expect(s.load).toBe("ready");
    expect(s.stats).toEqual(PIN);
  });

  it("gọi làm mới khi đang tải → tải thêm một lần nữa sau đó (không chồng lời gọi)", async () => {
    let release: (v: DataResult<UnlockStats>) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise((r) => (release = r)));
    fetchMock.mockResolvedValueOnce(ok(PIN_GAI));
    const { usePetUnlockStore } = await load();
    const first = usePetUnlockStore.getState().refresh();
    expect(usePetUnlockStore.getState().load).toBe("loading");
    const second = usePetUnlockStore.getState().refresh();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release(ok(PIN));
    await Promise.all([first, second]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(usePetUnlockStore.getState().stats).toEqual(PIN_GAI);
  });

  it("làm mới khi rời phòng và khi nhận phấn sau trận", async () => {
    fetchMock.mockResolvedValue(ok(PIN));
    const { ensurePetUnlocks, usePetUnlockStore } = await load();
    const { useGame } = await import("@/stores/game.store");
    ensurePetUnlocks();
    await usePetUnlockStore.getState().refresh();
    const before = fetchMock.mock.calls.length;
    useGame.setState({ party: { phase: "podium" } as never });
    useGame.getState().setReward(40);
    useGame.getState().reset();
    await usePetUnlockStore.getState().refresh();
    // Nhận phấn + rời phòng (gộp được khi đang tải) + lần gọi tay cuối.
    expect(fetchMock.mock.calls.length).toBeGreaterThan(before + 1);
  });
});
