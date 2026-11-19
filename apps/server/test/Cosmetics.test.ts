import {
  BASE_CHARACTER_IDS,
  CHALK_DAILY_CAPS,
  emptyUnlockStats,
  PET_CHARACTER_IDS,
  parseUnlockStats,
} from "@brain-rizz/shared";
import { describe, expect, it } from "vitest";
import {
  FALLBACK_CHARACTER,
  needsOwnership,
  ownsRequested,
  resolveLoadout,
} from "../src/rooms/loadout";
import {
  COSMETICS_REFRESH_MS,
  COSMETICS_TTL_MS,
  CosmeticsCache,
  type CosmeticsWant,
} from "../src/store/cosmetics-cache";
import { type CosmeticsRecord, MemoryResultStore, NoopResultStore } from "../src/store/ResultStore";

/** Kiểm sở hữu thú khoá + phụ kiện, bộ đệm quyền, phấn của store trong RAM (CR-023, CR-024). */

const PIN_UNLOCKED: CosmeticsRecord = {
  // `pin` mở khi chơi xong 10 trận party.
  stats: parseUnlockStats({ party_matches: 10 }),
  items: ["crown", "halo", "scarf", "sunglasses"],
};
const NOTHING: CosmeticsRecord = { stats: emptyUnlockStats(), items: [] };

describe("resolveLoadout", () => {
  it("6 nhân vật cũ luôn được, kể cả khi chưa có quyền", () => {
    for (const avatar of BASE_CHARACTER_IDS) {
      expect(resolveLoadout({ avatar, accessories: [] }, null).avatar).toBe(avatar);
      expect(resolveLoadout({ avatar, accessories: [] }, NOTHING).avatar).toBe(avatar);
    }
  });

  it("thú khoá: chưa có quyền / chưa mở → khoi; đã mở → được", () => {
    for (const avatar of PET_CHARACTER_IDS) {
      expect(resolveLoadout({ avatar, accessories: [] }, null).avatar).toBe(FALLBACK_CHARACTER);
      expect(resolveLoadout({ avatar, accessories: [] }, undefined).avatar).toBe("khoi");
      expect(resolveLoadout({ avatar, accessories: [] }, NOTHING).avatar).toBe("khoi");
    }
    expect(resolveLoadout({ avatar: "pin", accessories: [] }, PIN_UNLOCKED).avatar).toBe("pin");
    // Mở `pin` không mở thú khác.
    expect(resolveLoadout({ avatar: "lua", accessories: [] }, PIN_UNLOCKED).avatar).toBe("khoi");
  });

  it("phụ kiện: chưa có quyền → không đeo; có quyền → chỉ món đã có, mỗi chỗ một món, đầu → mặt → cổ", () => {
    const wanted = ["scarf", "crown", "halo", "khong-co", "monocle", "sunglasses"];
    expect(resolveLoadout({ avatar: "bo", accessories: wanted }, null).accessories).toEqual([]);
    expect(resolveLoadout({ avatar: "bo", accessories: wanted }, NOTHING).accessories).toEqual([]);
    // crown gặp trước halo (cùng chỗ đầu); monocle chưa có; id lạ bỏ.
    expect(resolveLoadout({ avatar: "bo", accessories: wanted }, PIN_UNLOCKED)).toEqual({
      avatar: "bo",
      accessories: ["crown", "sunglasses", "scarf"],
    });
  });

  it("ownsRequested: đủ khi thú đã mở và mọi phụ kiện sẽ hiện đều đã có", () => {
    expect(ownsRequested({ avatar: "bo", accessories: [] }, NOTHING)).toBe(true);
    expect(ownsRequested({ avatar: "pin", accessories: [] }, NOTHING)).toBe(false);
    expect(ownsRequested({ avatar: "pin", accessories: ["crown"] }, PIN_UNLOCKED)).toBe(true);
    // Thú khác chưa mở / món chưa có → thiếu.
    expect(ownsRequested({ avatar: "lua", accessories: [] }, PIN_UNLOCKED)).toBe(false);
    expect(ownsRequested({ avatar: "bo", accessories: ["bow"] }, PIN_UNLOCKED)).toBe(false);
    // crown (chưa có) gặp trước halo cùng chỗ đầu → vẫn thiếu; id lạ không tính.
    const halo = { stats: emptyUnlockStats(), items: ["halo"] };
    expect(ownsRequested({ avatar: "bo", accessories: ["crown", "halo"] }, halo)).toBe(false);
    expect(ownsRequested({ avatar: "bo", accessories: ["khong-co", "halo"] }, halo)).toBe(true);
  });

  it("chỉ cần nạp quyền khi xin thú khoá hoặc có phụ kiện", () => {
    expect(needsOwnership({ avatar: "khoi", accessories: [] })).toBe(false);
    expect(needsOwnership({ avatar: "pin", accessories: [] })).toBe(true);
    expect(needsOwnership({ avatar: "khoi", accessories: ["crown"] })).toBe(true);
  });
});

describe("CosmeticsCache (đệm 60 giây theo người)", () => {
  function setup() {
    let now = 1_000;
    const calls: string[] = [];
    let result: CosmeticsRecord | null | Error = PIN_UNLOCKED;
    const cache = new CosmeticsCache(
      async (userId) => {
        calls.push(userId);
        if (result instanceof Error) throw result;
        return result;
      },
      COSMETICS_TTL_MS,
      () => now,
      3,
    );
    return {
      cache,
      calls,
      tick: (ms: number) => {
        now += ms;
      },
      setResult: (r: CosmeticsRecord | null | Error) => {
        result = r;
      },
    };
  }

  it("còn hạn → không đọc lại; hết hạn → đọc lại; mỗi người một đệm", async () => {
    const { cache, calls, tick } = setup();
    expect(await cache.get("u1")).toEqual(PIN_UNLOCKED);
    expect(await cache.get("u1")).toEqual(PIN_UNLOCKED);
    tick(COSMETICS_TTL_MS - 1);
    await cache.get("u1");
    expect(calls).toEqual(["u1"]);
    await cache.get("u2");
    expect(calls).toEqual(["u1", "u2"]);
    tick(1);
    await cache.get("u1");
    expect(calls).toEqual(["u1", "u2", "u1"]);
  });

  it("hỏi cùng lúc chỉ đọc một lần", async () => {
    const { cache, calls } = setup();
    const [a, b] = await Promise.all([cache.get("u1"), cache.get("u1")]);
    expect(a).toBe(b);
    expect(calls).toEqual(["u1"]);
  });

  it("lỗi (null hoặc ném) → trả null, không đệm, lần sau đọc lại", async () => {
    const { cache, calls, setResult } = setup();
    setResult(null);
    expect(await cache.get("u1")).toBeNull();
    setResult(new Error("mạng"));
    expect(await cache.get("u1")).toBeNull();
    setResult(PIN_UNLOCKED);
    expect(await cache.get("u1")).toEqual(PIN_UNLOCKED);
    expect(calls).toEqual(["u1", "u1", "u1"]);
    expect(cache.size).toBe(1);
  });

  it("invalidate: bỏ đệm; lượt đọc đang chạy lúc đó không ghi đè đệm", async () => {
    const { cache, calls, setResult } = setup();
    await cache.get("u1");
    cache.invalidate("u1");
    const stale = cache.get("u1");
    cache.invalidate("u1");
    expect(await stale).toEqual(PIN_UNLOCKED);
    expect(cache.size).toBe(0);
    setResult(NOTHING);
    expect(await cache.get("u1")).toEqual(NOTHING);
    expect(calls).toHaveLength(3);
  });

  it("giữ RAM có hạn: quá số người thì bỏ bản cũ nhất", async () => {
    const { cache } = setup();
    for (const id of ["a", "b", "c", "d", "e"]) await cache.get(id);
    expect(cache.size).toBe(3);
  });

  /** Xin một món; ghi lại mọi lần bị hoãn (số ms còn lại tới khi được đọc lại). */
  function wants(item: string, deferred: number[] = []): CosmeticsWant {
    return {
      isEnough: (o) => o.items.includes(item),
      onDeferred: (ms) => deferred.push(ms),
    };
  }
  const hasCrown = wants("crown");
  const hasBow = wants("bow");

  it("xin món bản đệm chưa có (vừa quay gacha) → đọc lại DB bỏ qua đệm, dùng và đệm bản mới", async () => {
    const { cache, calls, tick, setResult } = setup();
    setResult(NOTHING);
    expect(await cache.get("u1")).toEqual(NOTHING);
    // Quay được crown: DB đổi, bản đệm (còn hạn) chưa biết.
    setResult(PIN_UNLOCKED);
    tick(COSMETICS_REFRESH_MS);
    // Không xin gì mới → vẫn dùng đệm.
    expect(await cache.get("u1")).toEqual(NOTHING);
    expect(await cache.get("u1", { isEnough: () => true })).toEqual(NOTHING);
    expect(calls).toEqual(["u1"]);
    // Xin crown → đọc lại một lần, được dùng.
    expect(await cache.get("u1", hasCrown)).toEqual(PIN_UNLOCKED);
    expect(calls).toEqual(["u1", "u1"]);
    // Bản mới đã vào đệm.
    expect(await cache.get("u1", hasCrown)).toEqual(PIN_UNLOCKED);
    expect(await cache.get("u1")).toEqual(PIN_UNLOCKED);
    expect(calls).toHaveLength(2);
  });

  it("chống dồn: tối đa 1 lần đọc lại mỗi người mỗi 5 giây; đang đọc thì đợi lượt đó", async () => {
    const { cache, calls, tick } = setup();
    await cache.get("u1");
    // Vừa đọc (< 5 giây): xin món chưa có (DB cũng chưa có) → dùng bản đệm, không gọi DB, báo hoãn
    // kèm số ms còn lại của cửa sổ.
    const deferred: number[] = [];
    for (let i = 0; i < 9; i++) {
      tick(COSMETICS_REFRESH_MS / 10);
      expect(await cache.get("u1", wants("bow", deferred))).toEqual(PIN_UNLOCKED);
    }
    expect(calls).toHaveLength(1);
    expect(deferred).toEqual(
      Array.from(
        { length: 9 },
        (_, i) => COSMETICS_REFRESH_MS - ((i + 1) * COSMETICS_REFRESH_MS) / 10,
      ),
    );
    tick(COSMETICS_REFRESH_MS / 10);
    // Nhiều phòng / nhiều lệnh cùng lúc → chung một lượt đọc lại, không lệnh nào bị báo hoãn.
    deferred.length = 0;
    const burst = await Promise.all(
      [1, 2, 3, 4].map(() => cache.get("u1", wants("bow", deferred))),
    );
    expect(burst.every((r) => r !== null && r.items.length === 4)).toBe(true);
    expect(calls).toHaveLength(2);
    expect(deferred).toEqual([]);
    tick(COSMETICS_REFRESH_MS - 1);
    await cache.get("u1", hasBow);
    expect(calls).toHaveLength(2);
    tick(1);
    await cache.get("u1", hasBow);
    expect(calls).toHaveLength(3);
    // Mỗi người một hạn riêng.
    await cache.get("u2", hasBow);
    expect(calls).toEqual(["u1", "u1", "u1", "u2"]);
  });

  it("đọc lại lỗi → trả bản đệm cũ và vẫn tính lượt; invalidate trong lúc đọc lại → không ghi đệm", async () => {
    const { cache, calls, tick, setResult } = setup();
    await cache.get("u1");
    tick(COSMETICS_REFRESH_MS);
    setResult(new Error("mạng"));
    expect(await cache.get("u1", hasBow)).toEqual(PIN_UNLOCKED);
    expect(await cache.get("u1", hasBow)).toEqual(PIN_UNLOCKED);
    expect(calls).toHaveLength(2);
    expect(cache.size).toBe(1);

    tick(COSMETICS_REFRESH_MS);
    setResult(NOTHING);
    const refreshing = cache.get("u1", hasBow);
    cache.invalidate("u1");
    expect(await refreshing).toEqual(NOTHING);
    expect(cache.size).toBe(0);
  });

  it("vừa invalidate (ghi trận xong) hoặc đệm hết hạn: xin món chưa có → đọc DB ngay, không báo hoãn", async () => {
    const { cache, calls, tick, setResult } = setup();
    setResult(NOTHING);
    await cache.get("u1");
    // Ghi trận xong ngay sau đó (< 5 giây): thành tích đổi, đệm bị bỏ → đọc lại ngay.
    tick(1);
    cache.invalidate("u1");
    setResult(PIN_UNLOCKED);
    const deferred: number[] = [];
    expect(await cache.get("u1", wants("crown", deferred))).toEqual(PIN_UNLOCKED);
    expect(calls).toHaveLength(2);
    expect(deferred).toEqual([]);
    // Đệm hết hạn: đọc thường (không xét cửa sổ chống dồn), không báo hoãn.
    tick(COSMETICS_TTL_MS);
    setResult(NOTHING);
    expect(await cache.get("u1", wants("bow", deferred))).toEqual(NOTHING);
    expect(calls).toHaveLength(3);
    expect(deferred).toEqual([]);
    // Bản vừa đọc vẫn thiếu món: lần xin ngay sau đó bị hoãn trọn cửa sổ.
    expect(await cache.get("u1", wants("bow", deferred))).toEqual(NOTHING);
    expect(calls).toHaveLength(3);
    expect(deferred).toEqual([COSMETICS_REFRESH_MS]);
  });
});

describe("MemoryResultStore / NoopResultStore — phụ kiện + phấn", () => {
  it("loadCosmetics đọc JSON snake_case như bản thật; lỗi → null", async () => {
    const store = new MemoryResultStore();
    store.cosmetics.set("u1", { stats: { party_matches: 10 }, items: ["crown"] });
    expect(await store.loadCosmetics("u1")).toEqual({
      stats: { ...emptyUnlockStats(), partyMatches: 10 },
      items: ["crown"],
    });
    expect(await store.loadCosmetics("u2")).toEqual(NOTHING);
    store.failCosmetics = true;
    expect(await store.loadCosmetics("u1")).toBeNull();
    expect(store.cosmeticsLoads).toEqual(["u1", "u2", "u1"]);
  });

  it("grantChalk: idempotent theo (người, nguồn, ref), kẹp trần ngày → 0, lỗi → null", async () => {
    const store = new MemoryResultStore();
    expect(await store.grantChalk("u1", "party", "ABCD:m1", 45)).toBe(45);
    // Gọi lại cùng ref (vd. sau lỗi mạng): không cộng thêm, trả đúng số lần đầu như grant_chalk.
    expect(await store.grantChalk("u1", "party", "ABCD:m1", 45)).toBe(45);
    expect(store.balance("u1")).toBe(45);
    // Cùng ref nhưng người khác / nguồn khác thì vẫn được.
    expect(await store.grantChalk("u2", "party", "ABCD:m1", 37)).toBe(37);
    expect(await store.grantChalk("u1", "brain", "ABCD:m1", 50)).toBe(50);
    // Trần party 300 phấn mỗi ngày: còn 255 → lần 300 chỉ được 255.
    const cap = CHALK_DAILY_CAPS.party.maxChalk ?? 0;
    expect(await store.grantChalk("u1", "party", "ABCD:m2", 300)).toBe(cap - 45);
    expect(await store.grantChalk("u1", "party", "ABCD:m3", 10)).toBe(0);
    expect(store.balance("u1")).toBe(cap + 50);
    store.failChalk = true;
    expect(await store.grantChalk("u3", "party", "x", 10)).toBeNull();
    expect(store.balance("u3")).toBe(0);
  });

  it("bản rỗng: không có quyền, không cộng phấn (null, không phải chạm trần)", async () => {
    const store = new NoopResultStore();
    expect(await store.loadCosmetics()).toBeNull();
    expect(await store.grantChalk()).toBeNull();
  });
});
