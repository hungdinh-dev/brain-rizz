import { enabledGameIds, GAME_IDS, type GameId, parsePartyConfig } from "@brain-rizz/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEnabledGames, enabledFromDisabledList, fetchDisabledGames } from "./enabled-games";

const [FIRST, SECOND, THIRD] = GAME_IDS as unknown as [GameId, GameId, GameId];

describe("enabledFromDisabledList", () => {
  it("bỏ game bị tắt, giữ thứ tự GAME_IDS", () => {
    expect(enabledFromDisabledList([THIRD, FIRST])).toEqual(
      GAME_IDS.filter((id) => id !== FIRST && id !== THIRD),
    );
  });

  it("bỏ id lạ, không phải chuỗi và id trùng", () => {
    expect(enabledFromDisabledList(["khong-co", 42, null, SECOND, SECOND])).toEqual(
      GAME_IDS.filter((id) => id !== SECOND),
    );
  });

  it("còn < 2 game bật → cả danh mục (cùng luật enabledGameIds của server)", () => {
    expect(enabledFromDisabledList(GAME_IDS.slice(1))).toEqual([...GAME_IDS]);
    expect(enabledFromDisabledList([...GAME_IDS])).toEqual([...GAME_IDS]);
    expect(enabledFromDisabledList([FIRST])).toEqual(enabledGameIds([FIRST]));
  });

  it("khớp luật của server (parsePartyConfig + enabledGameIds) với mọi kiểu dữ liệu", () => {
    const cases: unknown[][] = [
      [],
      [FIRST],
      [FIRST, SECOND, "khong-co", 7, null],
      [...GAME_IDS],
      GAME_IDS.slice(1),
      GAME_IDS.slice(2),
      [THIRD, THIRD, { id: FIRST }],
    ];
    for (const data of cases) {
      expect(enabledFromDisabledList(data)).toEqual(
        enabledGameIds(parsePartyConfig({ disabledGames: data }).disabledGames),
      );
    }
  });

  it("dữ liệu sai dạng → null (coi như lỗi)", () => {
    expect(enabledFromDisabledList(null)).toBeNull();
    expect(enabledFromDisabledList({ disabledGames: [FIRST] })).toBeNull();
    expect(enabledFromDisabledList("rhythm-echo")).toBeNull();
  });
});

describe("fetchDisabledGames", () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  it("gọi RPC công khai, khoá publishable chỉ ở apikey", async () => {
    const fetcher = vi.fn(async () => ok([FIRST]));
    const signal = new AbortController().signal;
    const data = await fetchDisabledGames(
      "https://x.supabase.co/",
      "sb_publishable_abc",
      signal,
      fetcher as unknown as typeof fetch,
    );
    expect(data).toEqual([FIRST]);
    expect(fetcher).toHaveBeenCalledWith("https://x.supabase.co/rest/v1/rpc/party_disabled_games", {
      headers: { apikey: "sb_publishable_abc", Accept: "application/json" },
      signal,
    });
  });

  it("anon key kiểu cũ (JWT) gửi thêm Authorization", async () => {
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) => ok([]));
    await fetchDisabledGames(
      "https://x.supabase.co",
      "eyJabc",
      new AbortController().signal,
      fetcher as unknown as typeof fetch,
    );
    expect(fetcher.mock.calls[0]?.[1].headers).toMatchObject({ Authorization: "Bearer eyJabc" });
  });

  it("HTTP lỗi (vd. DB chưa có hàm) → ném", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 404 }));
    await expect(
      fetchDisabledGames(
        "https://x.supabase.co",
        "k",
        new AbortController().signal,
        fetcher as unknown as typeof fetch,
      ),
    ).rejects.toThrow("HTTP 404");
  });
});

describe("createEnabledGames", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const quiet = () => vi.spyOn(console, "warn").mockImplementation(() => {});

  it("chưa cấu hình máy chủ dữ liệu → luôn đủ danh mục", async () => {
    const cache = createEnabledGames({ fetchDisabled: null });
    expect(cache.get()).toEqual(GAME_IDS);
    await expect(cache.refresh()).resolves.toEqual(GAME_IDS);
  });

  it("trước khi tải xong là đủ danh mục; tải xong thì ẩn game tắt và báo người nghe", async () => {
    const cache = createEnabledGames({ fetchDisabled: async () => [SECOND] });
    const listener = vi.fn();
    cache.subscribe(listener);
    expect(cache.get()).toEqual(GAME_IDS);
    const result = await cache.refresh();
    expect(result).not.toContain(SECOND);
    expect(cache.get()).toBe(result);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("hỏi cùng lúc chỉ gọi một lần; còn hạn thì không gọi lại; hết hạn thì gọi lại", async () => {
    let now = 0;
    const fetchDisabled = vi.fn(async () => [SECOND]);
    const cache = createEnabledGames({ fetchDisabled, ttlMs: 1_000, now: () => now });
    await Promise.all([cache.refresh(), cache.refresh()]);
    expect(fetchDisabled).toHaveBeenCalledTimes(1);
    now = 999;
    await cache.refresh();
    expect(fetchDisabled).toHaveBeenCalledTimes(1);
    now = 1_000;
    await cache.refresh();
    expect(fetchDisabled).toHaveBeenCalledTimes(2);
  });

  it("nội dung không đổi thì giữ tham chiếu, không báo người nghe", async () => {
    let now = 0;
    const cache = createEnabledGames({
      fetchDisabled: async () => [SECOND],
      ttlMs: 10,
      now: () => now,
    });
    const first = await cache.refresh();
    const listener = vi.fn();
    cache.subscribe(listener);
    now = 100;
    expect(await cache.refresh()).toBe(first);
    expect(listener).not.toHaveBeenCalled();
  });

  it("lỗi → giữ kết quả lần trước, không đệm (lần sau thử lại)", async () => {
    quiet();
    let now = 0;
    let fail = false;
    const fetchDisabled = vi.fn(async () => {
      if (fail) throw new Error("mạng");
      return [SECOND];
    });
    const cache = createEnabledGames({ fetchDisabled, ttlMs: 10, now: () => now });
    const loaded = await cache.refresh();
    fail = true;
    now = 100;
    expect(await cache.refresh()).toBe(loaded);
    expect(await cache.refresh()).toBe(loaded);
    expect(fetchDisabled).toHaveBeenCalledTimes(3);
  });

  it("lỗi ngay lần đầu / dữ liệu sai dạng → đủ danh mục", async () => {
    quiet();
    const failing = createEnabledGames({
      fetchDisabled: async () => {
        throw new Error("404");
      },
    });
    expect(await failing.refresh()).toEqual(GAME_IDS);
    const malformed = createEnabledGames({ fetchDisabled: async () => ({ nope: true }) });
    expect(await malformed.refresh()).toEqual(GAME_IDS);
  });

  it("quá giờ → huỷ yêu cầu, đủ danh mục, không chặn", async () => {
    quiet();
    vi.useFakeTimers();
    let aborted = false;
    const cache = createEnabledGames({
      timeoutMs: 5_000,
      fetchDisabled: (signal) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            reject(new Error("aborted"));
          });
        }),
    });
    const pending = cache.refresh();
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(pending).resolves.toEqual(GAME_IDS);
    expect(aborted).toBe(true);
  });
});
