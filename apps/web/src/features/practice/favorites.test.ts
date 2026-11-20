import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/lib/storage";

/** Máy chủ dữ liệu giả: bật/tắt cấu hình, phiên và kết quả từng RPC theo từng test. */
const env = vi.hoisted(() => ({
  configured: true,
  session: true,
  /** `fetchSessionUserId`: tài khoản của phiên đang có trên máy. */
  user: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  merge: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  get SUPABASE_CONFIGURED() {
    return env.configured;
  },
  hasStoredSession: () => env.session,
}));

vi.mock("@/net/data-api", () => ({
  fetchSessionUserId: env.user,
  fetchPracticeFavorites: env.get,
  setPracticeFavorite: env.set,
  mergePracticeFavorites: env.merge,
}));

import {
  EMPTY_FAVORITES,
  loadFavorites,
  normalizeIds,
  parseFavorites,
  saveFavorites,
  syncMode,
  toggleId,
  useFavorites,
  whenFavoritesIdle,
} from "./favorites";

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
const stored = () => JSON.parse(storage.getItem(STORAGE_KEYS.favorites) ?? "null");
const ok = <T>(data: T) => ({ ok: true as const, data });
const failed = { ok: false as const, reason: "error" as const };

describe("đọc / ghi trên máy", () => {
  it("chưa có / JSON hỏng / sai kiểu → rỗng, đã khớp, chưa từng đồng bộ", () => {
    expect(parseFavorites(null)).toEqual(EMPTY_FAVORITES);
    expect(parseFavorites("{oops")).toEqual(EMPTY_FAVORITES);
    expect(parseFavorites("42")).toEqual(EMPTY_FAVORITES);
    expect(parseFavorites('{"ids":"balance"}')).toEqual({ ids: [], synced: true, userId: null });
    expect(EMPTY_FAVORITES.userId).toBeNull();
  });

  it("bỏ id không có trong GAME_IDS, bỏ trùng, giữ thứ tự thêm", () => {
    const raw = JSON.stringify({
      ids: ["balance", "khong-co", 7, "odd-one-out", "balance", "constructor"],
      synced: false,
      userId: "user-a",
    });
    expect(parseFavorites(raw)).toEqual({
      ids: ["balance", "odd-one-out"],
      synced: false,
      userId: "user-a",
    });
    expect(normalizeIds(null)).toEqual([]);
  });

  it("dữ liệu cũ chưa có userId (hoặc sai kiểu) → userId = null", () => {
    expect(parseFavorites('{"ids":["balance"],"synced":true}')).toEqual({
      ids: ["balance"],
      synced: true,
      userId: null,
    });
    expect(parseFavorites('{"ids":[],"synced":true,"userId":42}').userId).toBeNull();
    expect(parseFavorites('{"ids":[],"synced":true,"userId":""}').userId).toBeNull();
  });

  it("syncMode: chưa từng / cùng tài khoản còn ⭐ chưa gửi → gộp; cùng đã khớp / khác tài khoản → lấy", () => {
    const local = (synced: boolean, userId: string | null) => ({ ids: [], synced, userId });
    expect(syncMode(local(true, null), "user-a")).toBe("merge");
    expect(syncMode(local(false, null), "user-a")).toBe("merge");
    expect(syncMode(local(false, "user-a"), "user-a")).toBe("merge");
    expect(syncMode(local(true, "user-a"), "user-a")).toBe("get");
    expect(syncMode(local(true, "user-a"), "user-b")).toBe("get");
    expect(syncMode(local(false, "user-a"), "user-b")).toBe("get");
  });

  it("toggleId: chưa có thì thêm vào cuối, có rồi thì bỏ", () => {
    expect(toggleId(["balance"], "odd-one-out")).toEqual(["balance", "odd-one-out"]);
    expect(toggleId(["balance", "odd-one-out"], "balance")).toEqual(["odd-one-out"]);
  });

  it("lưu rồi đọc lại đúng khoá brain-rizz:favorites", () => {
    storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    saveFavorites({ ids: ["rotate-match", "balance"], synced: false, userId: "user-a" });
    expect(storage.getItem("brain-rizz:favorites")).toBe(
      '{"ids":["rotate-match","balance"],"synced":false,"userId":"user-a"}',
    );
    expect(loadFavorites()).toEqual({
      ids: ["rotate-match", "balance"],
      synced: false,
      userId: "user-a",
    });
    saveFavorites(EMPTY_FAVORITES);
    expect(storage.getItem("brain-rizz:favorites")).toBe('{"ids":[],"synced":true,"userId":null}');
    vi.unstubAllGlobals();
  });
});

describe("useFavorites: bấm ⭐ và đồng bộ tài khoản (mục 3.1)", () => {
  /** Đặt dữ liệu trên máy rồi nạp lại store từ đó (mặc định đã đồng bộ với tài khoản A). */
  const seed = (ids: string[], synced: boolean, userId: string | null = "user-a") => {
    storage.setItem(STORAGE_KEYS.favorites, JSON.stringify({ ids, synced, userId }));
    useFavorites.setState(loadFavorites());
  };
  const state = () => ({
    ids: useFavorites.getState().ids,
    synced: useFavorites.getState().synced,
  });
  /** Chờ hàng đợi lời gọi tài khoản chạy hết. */
  const flush = () => whenFavoritesIdle();

  beforeEach(() => {
    storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    env.configured = true;
    env.session = true;
    env.user.mockReset().mockResolvedValue(ok("user-a"));
    env.get.mockReset().mockResolvedValue(ok([]));
    env.set.mockReset().mockResolvedValue(ok(null));
    env.merge.mockReset().mockResolvedValue(ok([]));
    useFavorites.setState(EMPTY_FAVORITES);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("không có phiên: chỉ lưu máy, synced = false, không gọi máy chủ (không tạo phiên)", async () => {
    env.session = false;
    seed([], true);
    expect(useFavorites.getState().toggle("balance")).toBe(true);
    expect(state()).toEqual({ ids: ["balance"], synced: false });
    expect(stored()).toEqual({ ids: ["balance"], synced: false, userId: "user-a" });
    await useFavorites.getState().sync();
    expect(env.user).not.toHaveBeenCalled();
    expect(env.get).not.toHaveBeenCalled();
    expect(env.merge).not.toHaveBeenCalled();
    expect(env.set).not.toHaveBeenCalled();
    expect(state()).toEqual({ ids: ["balance"], synced: false });
  });

  it("chưa cấu hình Supabase: chỉ lưu máy, không gọi máy chủ", async () => {
    env.configured = false;
    useFavorites.getState().toggle("odd-one-out");
    await flush();
    expect(state().ids).toEqual(["odd-one-out"]);
    expect(env.set).not.toHaveBeenCalled();
    expect(env.get).not.toHaveBeenCalled();
  });

  it("có phiên: bấm ⭐ đổi ngay rồi gửi practice_favorites_set; bỏ thì gửi false", async () => {
    seed(["odd-one-out"], true);
    expect(useFavorites.getState().toggle("balance")).toBe(true);
    expect(state()).toEqual({ ids: ["odd-one-out", "balance"], synced: true });
    expect(useFavorites.getState().toggle("odd-one-out")).toBe(false);
    expect(state().ids).toEqual(["balance"]);
    await flush();
    expect(env.set.mock.calls).toEqual([
      ["balance", true],
      ["odd-one-out", false],
    ]);
  });

  it("gửi lỗi (mất mạng, DB chưa có hàm…) → synced = false, không hoàn tác trên máy", async () => {
    seed([], true);
    env.set.mockResolvedValue(failed);
    useFavorites.getState().toggle("balance");
    await flush();
    expect(state()).toEqual({ ids: ["balance"], synced: false });
    expect(stored()).toEqual({ ids: ["balance"], synced: false, userId: "user-a" });
  });

  it("mở Luyện tập, cùng tài khoản, synced = true → lấy danh sách tài khoản thay danh sách máy", async () => {
    seed(["balance"], true);
    env.get.mockResolvedValue(ok(["rotate-match", "khong-co", "odd-one-out"]));
    await useFavorites.getState().sync();
    expect(env.merge).not.toHaveBeenCalled();
    expect(state()).toEqual({ ids: ["rotate-match", "odd-one-out"], synced: true });
    expect(stored()).toEqual({
      ids: ["rotate-match", "odd-one-out"],
      synced: true,
      userId: "user-a",
    });
  });

  it("mở Luyện tập, cùng tài khoản, synced = false → gộp danh sách máy vào tài khoản, đặt synced = true", async () => {
    seed(["balance", "odd-one-out"], false);
    env.merge.mockResolvedValue(ok(["rotate-match", "balance", "odd-one-out"]));
    await useFavorites.getState().sync();
    expect(env.merge).toHaveBeenCalledWith(["balance", "odd-one-out"]);
    expect(env.get).not.toHaveBeenCalled();
    expect(state()).toEqual({ ids: ["rotate-match", "balance", "odd-one-out"], synced: true });
  });

  it("đổi tài khoản: máy đang khớp A → mở bằng B lấy danh sách B, không gộp ⭐ của A; lưu userId B", async () => {
    seed(["balance", "odd-one-out"], true, "user-a");
    env.user.mockResolvedValue(ok("user-b"));
    env.get.mockResolvedValue(ok(["rotate-match"]));
    await useFavorites.getState().sync();
    expect(env.merge).not.toHaveBeenCalled();
    expect(env.get).toHaveBeenCalledTimes(1);
    expect(state()).toEqual({ ids: ["rotate-match"], synced: true });
    expect(stored()).toEqual({ ids: ["rotate-match"], synced: true, userId: "user-b" });

    // Lần mở sau cùng tài khoản B, đã khớp → vẫn chỉ lấy.
    await useFavorites.getState().sync();
    expect(env.merge).not.toHaveBeenCalled();
    expect(env.get).toHaveBeenCalledTimes(2);
  });

  it("đổi tài khoản khi A còn ⭐ chưa gửi được (synced = false) → vẫn lấy danh sách B, không gộp", async () => {
    seed(["balance"], false, "user-a");
    env.user.mockResolvedValue(ok("user-b"));
    env.get.mockResolvedValue(ok([]));
    await useFavorites.getState().sync();
    expect(env.merge).not.toHaveBeenCalled();
    expect(stored()).toEqual({ ids: [], synced: true, userId: "user-b" });
  });

  it("lần đầu đăng nhập (userId = null) → gộp ⭐ trên máy vào tài khoản, lưu userId", async () => {
    seed(["balance"], true, null);
    env.merge.mockResolvedValue(ok(["odd-one-out", "balance"]));
    await useFavorites.getState().sync();
    expect(env.merge).toHaveBeenCalledWith(["balance"]);
    expect(env.get).not.toHaveBeenCalled();
    expect(stored()).toEqual({ ids: ["odd-one-out", "balance"], synced: true, userId: "user-a" });
  });

  it("dữ liệu cũ chưa có userId → coi như chưa từng đồng bộ: gộp, rồi ghi userId", async () => {
    storage.setItem(STORAGE_KEYS.favorites, JSON.stringify({ ids: ["balance"], synced: true }));
    env.merge.mockResolvedValue(ok(["balance", "rotate-match"]));
    await useFavorites.getState().sync();
    expect(env.merge).toHaveBeenCalledWith(["balance"]);
    expect(env.get).not.toHaveBeenCalled();
    expect(stored()).toEqual({ ids: ["balance", "rotate-match"], synced: true, userId: "user-a" });
  });

  it("không đọc được phiên (mất phiên, lỗi mạng) → giữ máy, không gọi lấy / gộp", async () => {
    seed(["balance"], false, null);
    env.user.mockResolvedValue({ ok: false, reason: "no-session" });
    await useFavorites.getState().sync();
    expect(env.get).not.toHaveBeenCalled();
    expect(env.merge).not.toHaveBeenCalled();
    expect(stored()).toEqual({ ids: ["balance"], synced: false, userId: null });
  });

  it("bấm ⭐ lúc đang lấy danh sách tài khoản mới → giữ userId cũ, lần sau vẫn lấy (không gộp ⭐ của A)", async () => {
    seed(["balance"], true, "user-a");
    env.user.mockResolvedValue(ok("user-b"));
    let answer: (v: unknown) => void = () => {};
    env.get.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const pending = useFavorites.getState().sync();
    await vi.waitFor(() => expect(env.get).toHaveBeenCalled());
    useFavorites.getState().toggle("odd-one-out");
    answer(ok(["rotate-match"]));
    await pending;
    await flush();
    expect(stored()).toEqual({ ids: ["balance", "odd-one-out"], synced: false, userId: "user-a" });
    // Lời bật ⭐ đã gửi lên tài khoản B; lần mở sau lấy danh sách B (có sẵn game vừa bật).
    expect(env.set).toHaveBeenCalledWith("odd-one-out", true);
    env.get.mockResolvedValue(ok(["rotate-match", "odd-one-out"]));
    await useFavorites.getState().sync();
    expect(env.merge).not.toHaveBeenCalled();
    expect(stored()).toEqual({
      ids: ["rotate-match", "odd-one-out"],
      synced: true,
      userId: "user-b",
    });
  });

  it("lấy / gộp lỗi → giữ nguyên trên máy, không báo lỗi", async () => {
    seed(["balance"], false);
    env.merge.mockResolvedValue(failed);
    await useFavorites.getState().sync();
    expect(state()).toEqual({ ids: ["balance"], synced: false });
    seed(["balance"], true);
    env.get.mockResolvedValue(failed);
    await useFavorites.getState().sync();
    expect(state()).toEqual({ ids: ["balance"], synced: true });
  });

  it("bấm ⭐ lúc đang đồng bộ → giữ bản trên máy, lần sau gộp lại", async () => {
    seed(["balance"], true);
    let answer: (v: unknown) => void = () => {};
    env.get.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const pending = useFavorites.getState().sync();
    // Chờ lời gọi lấy danh sách thật sự bắt đầu.
    await vi.waitFor(() => expect(env.get).toHaveBeenCalled());
    useFavorites.getState().toggle("odd-one-out");
    answer(ok(["rotate-match"]));
    await pending;
    await flush();
    expect(state().ids).toEqual(["balance", "odd-one-out"]);
    expect(state().synced).toBe(false);
    // Bật ⭐ gửi sau khi lấy danh sách xong (đúng thứ tự).
    expect(env.set).toHaveBeenCalledWith("odd-one-out", true);
  });

  it("bật rồi tắt nhanh khi lời gửi đầu còn chậm → lời sau chờ lời trước xong (đúng thứ tự)", async () => {
    seed([], true);
    let finishFirst: (v: unknown) => void = () => {};
    env.set.mockReturnValueOnce(new Promise((resolve) => (finishFirst = resolve)));
    useFavorites.getState().toggle("balance");
    useFavorites.getState().toggle("balance");
    // Trên máy đổi ngay cả hai lần.
    expect(state()).toEqual({ ids: [], synced: true });
    await vi.waitFor(() => expect(env.set).toHaveBeenCalledTimes(1));
    // Lời bật chưa xong thì lời tắt chưa được gửi (máy chủ không thể nhận đảo thứ tự).
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(env.set).toHaveBeenCalledTimes(1);
    finishFirst(ok(null));
    await flush();
    expect(env.set.mock.calls).toEqual([
      ["balance", true],
      ["balance", false],
    ]);
    expect(state()).toEqual({ ids: [], synced: true });
  });

  it("một lời gọi ném lỗi không làm kẹt hàng đợi: lần bấm sau vẫn được gửi", async () => {
    seed([], true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    env.set.mockRejectedValueOnce(new Error("mất mạng"));
    useFavorites.getState().toggle("balance");
    useFavorites.getState().toggle("odd-one-out");
    await flush();
    expect(env.set.mock.calls).toEqual([
      ["balance", true],
      ["odd-one-out", true],
    ]);
    expect(state().ids).toEqual(["balance", "odd-one-out"]);
    warn.mockRestore();
  });

  it("mở lại màn khi lần trước chưa xong → chỉ một lời gọi", async () => {
    seed([], true);
    const a = useFavorites.getState().sync();
    const b = useFavorites.getState().sync();
    expect(a).toBe(b);
    await a;
    expect(env.get).toHaveBeenCalledTimes(1);
  });
});
