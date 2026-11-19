import {
  type AnswerResultPayload,
  BASE_CHARACTER_IDS,
  BRAIN_TEST_COUNTDOWN_MS,
  BRAIN_TEST_DIFFICULTY,
  BRAIN_TEST_GAME_COUNT,
  BRAIN_TEST_GAME_RESULT_MS,
  BRAIN_TEST_ROOM_NAME,
  BrainClientMessage,
  type BrainJoinOptions,
  brainChalkReward,
  brainTestDurationMs,
  CHALK_DAILY_CAPS,
  ClientMessage,
  COUNTDOWN_MS,
  type Difficulty,
  type ErrorPayload,
  type GameId,
  getGame,
  type JoinOptions,
  LATE_ANSWER_GRACE_MS,
  MAX_ACCESSORIES,
  parseUnlockStats,
  partyChalkReward,
  type RewardPayload,
  ROOM_NAME,
  ServerMessage,
} from "@brain-rizz/shared";
import type { Delayed } from "colyseus";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { BrainTestRoom } from "../src/rooms/BrainTestRoom";
import { OWNERSHIP_RETRY_MARGIN_MS } from "../src/rooms/loadout";
import type { PartyRoom } from "../src/rooms/PartyRoom";
import {
  COSMETICS_REFRESH_MS,
  COSMETICS_TTL_MS,
  CosmeticsCache,
} from "../src/store/cosmetics-cache";
import {
  type CosmeticsRecord,
  MemoryResultStore,
  NoopResultStore,
  setResultStore,
} from "../src/store/ResultStore";
import {
  advance,
  bootOnFreePort,
  connectTo,
  nextMessage,
  SOLVE,
  settle,
  type TestServer,
  until,
} from "./helpers";

/**
 * Thú khoá + phụ kiện trong phòng (kiểm sở hữu khi vào phòng / đổi hồ sơ) và thưởng phấn sau trận
 * party / Kiểm tra não (CR-023, CR-024; kế hoạch docs/01-product/gacha-pets-unlocks.md mục 5.2).
 */

let colyseus: TestServer;

const TOKEN_A = "jwt-cua-an";
const TOKEN_B = "jwt-cua-binh";
const TOKEN_C = "jwt-cua-chi";
const USER_A = "00000000-0000-0000-0000-00000000000a";
const USER_B = "00000000-0000-0000-0000-00000000000b";
const USER_C = "00000000-0000-0000-0000-00000000000c";

/** An đã mở `pin` (10 trận) và có vài món; Bình chưa mở gì, chưa có món; Chi đã mở `pin` + `gai`. */
function makeStore() {
  const store = new MemoryResultStore(
    new Map([
      [TOKEN_A, USER_A],
      [TOKEN_B, USER_B],
      [TOKEN_C, USER_C],
    ]),
  );
  store.cosmetics.set(USER_A, {
    stats: { party_matches: 10 },
    items: ["crown", "halo", "scarf", "sunglasses"],
  });
  store.cosmetics.set(USER_C, { stats: { party_matches: 12, party_wins: 5 }, items: ["bow"] });
  setResultStore(store);
  return store;
}

async function createParty(options: object = {}) {
  return (await colyseus.createRoom(ROOM_NAME, options)) as PartyRoom;
}

async function join(room: PartyRoom, name: string, opts: Partial<JoinOptions> = {}) {
  return connectTo(colyseus, room, { name, ...opts });
}
type TestClient = Awaited<ReturnType<typeof join>>;

const players = (room: PartyRoom) => [...room.state.players.values()];

function seat(room: PartyRoom, client: TestClient) {
  const p = room.state.players.get(client.sessionId);
  if (!p) throw new Error("Không thấy người chơi");
  return { avatar: p.avatar, accessories: [...p.accessories] };
}

/** Phần riêng của phòng (không đồng bộ) để kiểm dọn dẹp. */
function internals(room: PartyRoom) {
  return room as unknown as {
    requestedLoadouts: Map<string, unknown>;
    ownership: Map<string, unknown>;
    ownershipLoads: Map<string, unknown>;
    ownershipRetries: Map<string, Delayed>;
    pendingAuth: Map<string, unknown>;
  };
}

/**
 * Bọc `loadCosmetics` của store trong RAM bằng chính bộ đệm của `SupabaseResultStore`; giờ của đệm
 * (`time.now`) điều khiển bằng tay, tách khỏi đồng hồ phòng (`advance`).
 */
function cachedCosmetics(store: MemoryResultStore) {
  const time = { now: 1_000_000 };
  const cache = new CosmeticsCache(
    (userId) => MemoryResultStore.prototype.loadCosmetics.call(store, userId),
    COSMETICS_TTL_MS,
    () => time.now,
  );
  store.loadCosmetics = (userId, want) => cache.get(userId, want);
  return time;
}

const loadsOf = (store: MemoryResultStore, userId: string) =>
  store.cosmeticsLoads.filter((u) => u === userId).length;

/**
 * Thay `loadCosmetics` bằng bản trả lời theo tay: mỗi lần gọi thêm một hàm `resolve` vào mảng trả
 * về, test tự quyết lượt nào xong trước và trả gì (giả lập nhiều lượt nạp chạy chồng nhau).
 */
function manualCosmetics(store: MemoryResultStore) {
  const pending: ((owned: CosmeticsRecord | null) => void)[] = [];
  store.loadCosmetics = (userId: string) => {
    store.cosmeticsLoads.push(userId);
    return new Promise<CosmeticsRecord | null>((resolve) => pending.push(resolve));
  };
  return pending;
}

/** Giữ `loadCosmetics` chờ tới khi gọi hàm trả về (giả lập DB chậm). */
function holdCosmetics(store: MemoryResultStore) {
  let release = () => {};
  store.cosmeticsGate = new Promise<void>((resolve) => {
    release = () => {
      store.cosmeticsGate = null;
      resolve();
    };
  });
  return () => release();
}

/** Chơi một vòng `gameId`: `scorers` mỗi người trả lời đúng `n` câu, hết giờ → round-results. */
async function playRound(
  room: PartyRoom,
  clients: TestClient[],
  gameId: GameId,
  scorers: [TestClient, number][],
) {
  const host = clients[0] as TestClient;
  host.send(ClientMessage.PickGame, { gameId });
  await until(() => room.state.phase === "game-intro");
  for (const c of clients.slice(1)) c.send(ClientMessage.IntroReady, { ready: true });
  await until(() => players(room).every((p) => p.isHost || p.isBot || p.introReady));
  host.send(ClientMessage.StartRound, {});
  await until(() => room.state.phase === "countdown");
  advance(room, COUNTDOWN_MS);
  for (const [c, n] of scorers) {
    for (let i = 0; i < n; i++) {
      const p = room.state.players.get(c.sessionId);
      if (!p) throw new Error("Không thấy người chơi");
      const result = nextMessage<AnswerResultPayload>(c, ServerMessage.AnswerResult);
      c.send(ClientMessage.Answer, {
        round: room.state.round,
        index: p.progress,
        answer: SOLVE[gameId](room.state.seed, p.progress, p.difficulty as Difficulty),
      });
      expect((await result).correct).toBe(true);
    }
  }
  advance(room, getGame(room.state.gameId as GameId).durationMs + LATE_ANSWER_GRACE_MS);
  expect(room.state.phase).toBe("round-results");
}

/** Trận 1 vòng odd-one-out tới podium. */
async function playOneRoundMatch(
  room: PartyRoom,
  clients: TestClient[],
  scorers: [TestClient, number][],
) {
  const host = clients[0] as TestClient;
  host.send(ClientMessage.SetRounds, { totalRounds: 1 });
  await until(() => room.state.totalRounds === 1);
  for (const c of clients) c.send(ClientMessage.Ready, { ready: true });
  await until(() => players(room).every((p) => p.ready));
  host.send(ClientMessage.StartMatch, {});
  await until(() => room.state.phase === "game-select");
  await playRound(room, clients, "odd-one-out", scorers);
  host.send(ClientMessage.NextRound, {});
  await until(() => room.state.phase === "podium");
}

/** Ghi lại mọi tin `reward` một máy nhận. */
function collectRewards(client: TestClient) {
  const got: RewardPayload[] = [];
  client.onMessage(ServerMessage.Reward, (msg: RewardPayload) => got.push(msg));
  return got;
}

describe("PartyRoom + BrainTestRoom — thú khoá, phụ kiện, phấn", () => {
  beforeAll(async () => {
    colyseus = await bootOnFreePort();
  });
  afterAll(async () => {
    setResultStore(new NoopResultStore());
    await colyseus.shutdown();
  });
  beforeEach(async () => {
    await colyseus.cleanup();
  });

  // ---------------------------------------------------------------- kiểm sở hữu

  it("không token: nhân vật cũ giữ, thú khoá → khoi, bỏ phụ kiện; không nạp quyền; vẫn vào phòng", async () => {
    const store = makeStore();
    const room = await createParty();
    const a = await join(room, "An", { avatar: "pin", accessories: ["crown"] });
    const b = await join(room, "Bình", { avatar: "mochi", accessories: ["crown"] });
    expect(seat(room, a)).toEqual({ avatar: "khoi", accessories: [] });
    expect(seat(room, b)).toEqual({ avatar: "mochi", accessories: [] });
    await settle();
    expect(store.cosmeticsLoads).toEqual([]);
    expect(room.state.players.size).toBe(2);
  });

  it("token hợp lệ: vào ngay với bản an toàn, nạp xong thì đổi sang thú đã mở + món đã có", async () => {
    const store = makeStore();
    const release = holdCosmetics(store);
    const room = await createParty();
    const a = await join(room, "An", {
      avatar: "pin",
      accessories: ["halo", "crown", "scarf"],
      accessToken: TOKEN_A,
    });
    // Chưa nạp xong quyền: bản an toàn.
    expect(seat(room, a)).toEqual({ avatar: "khoi", accessories: [] });
    await until(() => store.cosmeticsLoads.length === 1);
    expect(store.cosmeticsLoads).toEqual([USER_A]);
    release();
    // halo gặp trước crown (cùng chỗ đầu) nên giữ halo.
    await until(() => seat(room, a).avatar === "pin");
    expect(seat(room, a)).toEqual({ avatar: "pin", accessories: ["halo", "scarf"] });
    // Đồng bộ xuống client đúng hình dạng PlayerView.accessories.
    await until(() => a.state.players.get(a.sessionId)?.accessories.length === 2);
    expect([...(a.state.players.get(a.sessionId)?.accessories ?? [])]).toEqual(["halo", "scarf"]);
    // Không lộ thành tích / user_id vào state.
    expect(JSON.stringify(room.state.toJSON())).not.toContain(USER_A);
  });

  it("token hợp lệ nhưng chưa mở thú / chưa có món → khoi, không phụ kiện; token sai → như khách", async () => {
    const store = makeStore();
    const room = await createParty();
    const b = await join(room, "Bình", {
      avatar: "lua",
      accessories: ["crown"],
      accessToken: TOKEN_B,
    });
    const c = await join(room, "Chi", { avatar: "lua", accessToken: TOKEN_C });
    const d = await join(room, "Dũng", { avatar: "pin", accessToken: "token-sai" });
    await until(() => store.cosmeticsLoads.length === 2);
    await settle();
    expect(seat(room, b)).toEqual({ avatar: "khoi", accessories: [] });
    // Chi mở pin + gai, chưa mở lua.
    expect(seat(room, c)).toEqual({ avatar: "khoi", accessories: [] });
    expect(seat(room, d)).toEqual({ avatar: "khoi", accessories: [] });
    expect([...store.cosmeticsLoads].sort()).toEqual([USER_B, USER_C].sort());
  });

  it("store lỗi → bản an toàn, không từ chối vào phòng; nhân vật cũ + không phụ kiện thì không nạp", async () => {
    const store = makeStore();
    store.failCosmetics = true;
    const room = await createParty();
    const a = await join(room, "An", {
      avatar: "pin",
      accessories: ["crown"],
      accessToken: TOKEN_A,
    });
    const c = await join(room, "Chi", { avatar: "cam", accessToken: TOKEN_C });
    await until(() => store.cosmeticsLoads.length === 1);
    await settle();
    expect(seat(room, a)).toEqual({ avatar: "khoi", accessories: [] });
    expect(seat(room, c)).toEqual({ avatar: "cam", accessories: [] });
    expect(store.cosmeticsLoads).toEqual([USER_A]);
    expect(room.state.players.size).toBe(2);
  });

  it("nạp xong khi người đó đã rời: bỏ kết quả, không lỗi, không để lại dữ liệu", async () => {
    const store = makeStore();
    const release = holdCosmetics(store);
    const room = await createParty();
    const host = await join(room, "Chi");
    const a = await join(room, "An", { avatar: "pin", accessToken: TOKEN_A });
    const id = a.sessionId;
    await until(() => store.cosmeticsLoads.length === 1);
    await a.leave();
    await until(() => !room.state.players.has(id));
    release();
    await settle();
    expect(room.state.players.has(id)).toBe(false);
    expect(room.state.players.size).toBe(1);
    const inner = internals(room);
    for (const map of [inner.requestedLoadouts, inner.ownership, inner.ownershipLoads]) {
      expect(map.has(id)).toBe(false);
    }
    expect(seat(room, host)).toEqual({ avatar: "khoi", accessories: [] });
  });

  it("setProfile: đổi thú / phụ kiện qua cùng bước kiểm; [] tháo hết; sai giới hạn → invalid", async () => {
    const store = makeStore();
    const room = await createParty();
    const a = await join(room, "An", { accessToken: TOKEN_A });
    await settle();
    // Nhân vật cũ, không phụ kiện: chưa cần nạp quyền.
    expect(store.cosmeticsLoads).toEqual([]);

    a.send(ClientMessage.SetProfile, { avatar: "pin" });
    await until(() => seat(room, a).avatar === "pin");
    a.send(ClientMessage.SetProfile, { accessories: ["crown", "sunglasses", "bow"] });
    await until(() => seat(room, a).accessories.length === 2);
    // bow chưa có; giữ nhân vật đang xin.
    expect(seat(room, a)).toEqual({ avatar: "pin", accessories: ["crown", "sunglasses"] });

    // Thú chưa mở → khoi, phụ kiện giữ nguyên.
    a.send(ClientMessage.SetProfile, { avatar: "lua" });
    await until(() => seat(room, a).avatar === "khoi");
    await settle();
    expect(seat(room, a)).toEqual({ avatar: "khoi", accessories: ["crown", "sunglasses"] });

    a.send(ClientMessage.SetProfile, { avatar: "bo", accessories: [] });
    await until(() => seat(room, a).accessories.length === 0);
    expect(seat(room, a)).toEqual({ avatar: "bo", accessories: [] });

    const tooMany = Array.from({ length: MAX_ACCESSORIES + 1 }, () => "crown");
    const error = nextMessage<ErrorPayload>(a, ServerMessage.Error);
    a.send(ClientMessage.SetProfile, { accessories: tooMany });
    expect((await error).code).toBe("invalid");
    expect(seat(room, a)).toEqual({ avatar: "bo", accessories: [] });
  });

  it("đổi hồ sơ khi chưa xác thực xong: áp bản an toàn, xác thực xong thì áp yêu cầu mới nhất", async () => {
    const store = makeStore();
    const release = holdCosmetics(store);
    const room = await createParty();
    const a = await join(room, "An", { avatar: "pin", accessToken: TOKEN_A });
    a.send(ClientMessage.SetProfile, { accessories: ["scarf"] });
    await until(() => store.cosmeticsLoads.length >= 1);
    await settle();
    expect(seat(room, a)).toEqual({ avatar: "khoi", accessories: [] });
    release();
    await until(() => seat(room, a).avatar === "pin");
    await settle();
    expect(seat(room, a)).toEqual({ avatar: "pin", accessories: ["scarf"] });
  });

  it("nạp quyền chồng nhau: chỉ áp lượt mới nhất (lượt cũ xong sau bị bỏ); lượt lỗi giữ quyền đã nạp", async () => {
    const store = makeStore();
    const pending = manualCosmetics(store);
    const fresh: CosmeticsRecord = {
      stats: parseUnlockStats({ party_matches: 10 }),
      items: ["halo", "crown"],
    };
    const stale: CosmeticsRecord = { stats: parseUnlockStats({}), items: [] };
    const room = await createParty();
    const a = await join(room, "An", {
      avatar: "pin",
      accessories: ["crown"],
      accessToken: TOKEN_A,
    });
    // Lượt 1: nạp ngay sau khi xác thực xong.
    await until(() => pending.length === 1);
    // Lượt 2: đổi phụ kiện khi lượt 1 chưa xong.
    a.send(ClientMessage.SetProfile, { accessories: ["halo"] });
    await until(() => pending.length === 2);
    expect(seat(room, a)).toEqual({ avatar: "khoi", accessories: [] });

    // Lượt 2 (mới) xong trước → áp.
    pending[1]?.(fresh);
    await until(() => seat(room, a).avatar === "pin");
    expect(seat(room, a)).toEqual({ avatar: "pin", accessories: ["halo"] });

    // Lượt 1 (cũ, số liệu cũ) xong sau → bị bỏ, không kéo về bản an toàn.
    pending[0]?.(stale);
    await settle();
    expect(seat(room, a)).toEqual({ avatar: "pin", accessories: ["halo"] });

    // Lượt 3 lỗi (store trả null) → giữ quyền đã nạp ở lượt 2, áp yêu cầu mới nhất.
    a.send(ClientMessage.SetProfile, { accessories: ["crown"] });
    await until(() => pending.length === 3);
    pending[2]?.(null);
    await settle();
    expect(seat(room, a)).toEqual({ avatar: "pin", accessories: ["crown"] });
    expect(store.cosmeticsLoads).toEqual([USER_A, USER_A, USER_A]);
  });

  it("đệm quyền như bản thật: đeo món vừa quay được → đọc lại DB và được dùng; spam không gọi DB quá 1 lần / 5 giây", async () => {
    const store = makeStore();
    const time = cachedCosmetics(store);
    const room = await createParty();
    const a = await join(room, "An", {
      avatar: "pin",
      accessories: ["crown"],
      accessToken: TOKEN_A,
    });
    await until(() => seat(room, a).accessories.length === 1);
    expect(seat(room, a)).toEqual({ avatar: "pin", accessories: ["crown"] });
    expect(store.cosmeticsLoads).toEqual([USER_A]);

    // 10 giây sau quay được bow (DB đổi, đệm 60 giây chưa biết) rồi đeo ngay.
    time.now += 10_000;
    store.cosmetics.get(USER_A)?.items?.push("bow");
    a.send(ClientMessage.SetProfile, { accessories: ["bow", "scarf"] });
    await until(() => seat(room, a).accessories[0] === "bow");
    expect(seat(room, a)).toEqual({ avatar: "pin", accessories: ["bow", "scarf"] });
    expect(store.cosmeticsLoads).toEqual([USER_A, USER_A]);
    // Món đã có trong đệm: không đọc lại.
    a.send(ClientMessage.SetProfile, { accessories: ["halo"] });
    await until(() => seat(room, a).accessories[0] === "halo");
    expect(store.cosmeticsLoads).toHaveLength(2);

    // Spam món chưa có (DB cũng không có) trong vòng 5 giây: dùng bản đọc gần nhất, không gọi DB.
    for (const id of ["cap", "beanie", "cap", "beanie", "cowboy"]) {
      a.send(ClientMessage.SetProfile, { accessories: [id] });
    }
    await until(() => seat(room, a).accessories.length === 0);
    await settle();
    expect(seat(room, a)).toEqual({ avatar: "pin", accessories: [] });
    expect(store.cosmeticsLoads).toHaveLength(2);
    // Hết 5 giây: được đọc lại thêm đúng một lần (lệnh mới huỷ hẹn đọc lại của đợt spam).
    time.now += COSMETICS_REFRESH_MS;
    a.send(ClientMessage.SetProfile, { accessories: ["cap"] });
    a.send(ClientMessage.SetProfile, { accessories: ["beanie"] });
    await until(() => store.cosmeticsLoads.length === 3);
    await settle();
    expect(store.cosmeticsLoads).toHaveLength(3);
    // Không bao giờ từ chối: vẫn trong phòng, chỉ bỏ món chưa có.
    expect(seat(room, a)).toEqual({ avatar: "pin", accessories: [] });
    expect(room.state.players.size).toBe(1);
  });

  it("đeo món vừa quay ngay trong cửa sổ 5 giây: hẹn đúng một lần đọc lại, hết cửa sổ thì được áp; rời trước giờ hẹn → huỷ hẹn", async () => {
    const store = makeStore();
    const time = cachedCosmetics(store);
    const retries = (room: PartyRoom) => internals(room).ownershipRetries;
    const room = await createParty();
    const a = await join(room, "An", { avatar: "pin", accessToken: TOKEN_A });
    const b = await join(room, "Bình", { accessories: ["cap"], accessToken: TOKEN_B });
    await until(() => seat(room, a).avatar === "pin" && store.cosmeticsLoads.length === 2);
    await settle();
    // Lần đọc lúc vào phòng là đọc thật (Bình chưa có cap): không hẹn.
    expect(retries(room).size).toBe(0);

    // An quay được bow rồi đeo ngay; Bình xin lại món chưa có: cả hai còn trong cửa sổ → hẹn.
    store.cosmetics.get(USER_A)?.items?.push("bow");
    a.send(ClientMessage.SetProfile, { accessories: ["bow"] });
    b.send(ClientMessage.SetProfile, { accessories: ["cap", "scarf"] });
    await until(() => retries(room).size === 2);
    expect(seat(room, a)).toEqual({ avatar: "pin", accessories: [] });
    expect(store.cosmeticsLoads).toHaveLength(2);
    // Gửi lại nhiều lần: vẫn đúng một hẹn mỗi người.
    a.send(ClientMessage.SetProfile, { accessories: ["bow"] });
    a.send(ClientMessage.SetProfile, { avatar: "pin", accessories: ["bow"] });
    await settle();
    expect(retries(room).size).toBe(2);
    expect(room.clock.delayed.filter((d) => d.active)).toHaveLength(2);

    // Bình rời trước giờ hẹn: hẹn bị huỷ, không rò.
    const bRetry = retries(room).get(b.sessionId);
    await b.leave();
    await until(() => !room.state.players.has(b.sessionId));
    expect(bRetry?.active).toBe(false);
    expect(retries(room).has(b.sessionId)).toBe(false);

    // Hết cửa sổ: đọc lại đúng một lần cho An, bow được áp.
    time.now += COSMETICS_REFRESH_MS;
    advance(room, COSMETICS_REFRESH_MS + OWNERSHIP_RETRY_MARGIN_MS);
    await until(() => seat(room, a).accessories[0] === "bow");
    expect(seat(room, a)).toEqual({ avatar: "pin", accessories: ["bow"] });
    expect(retries(room).size).toBe(0);
    // Không hẹn tiếp, không đọc thêm (kể cả cho Bình đã rời).
    advance(room, 60_000);
    await settle();
    expect(loadsOf(store, USER_A)).toBe(2);
    expect(loadsOf(store, USER_B)).toBe(1);
    expect(room.clock.delayed.filter((d) => d.active)).toHaveLength(0);
  });

  it("hẹn đọc lại bị bỏ khi đã có yêu cầu mới không cần quyền; lượt đọc lại vẫn thiếu thì không hẹn tiếp", async () => {
    const store = makeStore();
    const time = cachedCosmetics(store);
    const room = await createParty();
    const a = await join(room, "An", { accessories: ["crown"], accessToken: TOKEN_A });
    await until(() => seat(room, a).accessories.length === 1);
    // Xin món chưa có trong cửa sổ → hẹn; rồi đổi sang nhân vật cũ, không phụ kiện → huỷ hẹn.
    a.send(ClientMessage.SetProfile, { accessories: ["bow"] });
    await until(() => internals(room).ownershipRetries.size === 1);
    a.send(ClientMessage.SetProfile, { avatar: "bo", accessories: [] });
    await until(() => seat(room, a).avatar === "bo");
    expect(internals(room).ownershipRetries.size).toBe(0);
    time.now += COSMETICS_REFRESH_MS;
    advance(room, COSMETICS_REFRESH_MS + OWNERSHIP_RETRY_MARGIN_MS);
    await settle();
    expect(loadsOf(store, USER_A)).toBe(1);

    // Xin món không có (DB cũng không có) → hẹn; tới giờ đọc lại vẫn thiếu → thôi, không hẹn tiếp.
    a.send(ClientMessage.SetProfile, { accessories: ["cowboy"] });
    await settle();
    // Lần đọc gần nhất đã quá 5 giây → đọc thật ngay, không hẹn.
    expect(loadsOf(store, USER_A)).toBe(2);
    a.send(ClientMessage.SetProfile, { accessories: ["cowboy"] });
    await until(() => internals(room).ownershipRetries.size === 1);
    time.now += COSMETICS_REFRESH_MS;
    advance(room, COSMETICS_REFRESH_MS + OWNERSHIP_RETRY_MARGIN_MS);
    await until(() => loadsOf(store, USER_A) === 3);
    await settle();
    expect(internals(room).ownershipRetries.size).toBe(0);
    expect(seat(room, a)).toEqual({ avatar: "bo", accessories: [] });
    advance(room, 60_000);
    await settle();
    expect(loadsOf(store, USER_A)).toBe(3);
  });

  it("xác thực ném lỗi: vào phòng như khách, không nạp quyền, ghi trận không kẹt", async () => {
    const store = makeStore();
    store.verifyToken = async () => {
      throw new Error("Giả lập mạng lỗi khi xác thực");
    };
    const room = await createParty();
    const a = await join(room, "An", {
      avatar: "pin",
      accessories: ["crown"],
      accessToken: TOKEN_A,
    });
    const b = await join(room, "Bình");
    await settle();
    expect(seat(room, a)).toEqual({ avatar: "khoi", accessories: [] });
    expect(store.cosmeticsLoads).toEqual([]);
    // Lượt xác thực lỗi vẫn được dọn khỏi danh sách chờ (ghi trận chờ danh sách này).
    expect(internals(room).pendingAuth.size).toBe(0);

    const rewards = collectRewards(a);
    await playOneRoundMatch(room, [a, b], [[a, 1]]);
    await settle(100);
    expect(store.matchResults).toEqual([]);
    expect(store.chalkCalls).toBe(0);
    expect(rewards).toEqual([]);
  }, 30_000);

  it("bot: chỉ nhân vật cũ, không phụ kiện", async () => {
    makeStore();
    const room = await createParty({ bots: { count: 5, level: 1 } });
    await join(room, "An", { avatar: "pin", accessories: ["crown"], accessToken: TOKEN_A });
    const bots = players(room).filter((p) => p.isBot);
    expect(bots).toHaveLength(5);
    for (const bot of bots) {
      expect((BASE_CHARACTER_IDS as readonly string[]).includes(bot.avatar)).toBe(true);
      expect([...bot.accessories]).toEqual([]);
    }
  });

  // ---------------------------------------------------------------- phấn party

  it("vào podium: cộng phấn đúng người, đúng số, gửi reward riêng; khách không nhận", async () => {
    const store = makeStore();
    const room = await createParty();
    const a = await join(room, "An", { accessToken: TOKEN_A });
    const b = await join(room, "Bình");
    const c = await join(room, "Chi", { accessToken: TOKEN_C });
    const rewards = { a: collectRewards(a), b: collectRewards(b), c: collectRewards(c) };

    await playOneRoundMatch(
      room,
      [a, b, c],
      [
        [a, 2],
        [c, 1],
      ],
    );
    await until(() => rewards.a.length === 1 && rewards.c.length === 1);
    // 1 vòng, 3 người thật: nhất 10 + 5 + 20, nhì 10 + 5 + 12.
    const first = partyChalkReward({ rounds: 1, placement: 0, humans: 3 });
    const second = partyChalkReward({ rounds: 1, placement: 1, humans: 3 });
    expect([first, second]).toEqual([35, 27]);
    expect(rewards.a).toEqual([{ chalk: first }]);
    expect(rewards.c).toEqual([{ chalk: second }]);
    const ref = `${room.state.code}:${store.matchKeys[0]}`;
    expect(store.chalkGrants).toEqual(
      expect.arrayContaining([
        { userId: USER_A, source: "party", ref, amount: first, granted: first },
        { userId: USER_C, source: "party", ref, amount: second, granted: second },
      ]),
    );
    await settle();
    expect(store.chalkGrants).toHaveLength(2);
    expect(rewards.b).toEqual([]);

    // Chơi lại: trận mới có ref mới → được cộng tiếp, mỗi trận đúng một lần.
    a.send(ClientMessage.PlayAgain, {});
    await until(() => room.state.phase === "game-select");
    await playRound(room, [a, b, c], "balance", [[c, 1]]);
    a.send(ClientMessage.NextRound, {});
    await until(() => room.state.phase === "podium");
    await until(() => rewards.a.length === 2 && rewards.c.length === 2);
    await settle();
    expect(store.matchKeys).toHaveLength(2);
    const refs = new Set(store.chalkGrants.map((g) => g.ref));
    expect(refs.size).toBe(2);
    expect(store.chalkGrants).toHaveLength(4);
    expect(rewards.c[1]).toEqual({ chalk: first });
  }, 30_000);

  it("một tài khoản hai thẻ + bot: vẫn là 1 người thật → × 0,5 (không né được bằng thẻ thứ hai)", async () => {
    const store = makeStore();
    const room = await createParty({ bots: { count: 2, level: 0 } });
    const a1 = await join(room, "An", { accessToken: TOKEN_A });
    const a2 = await join(room, "An (thẻ 2)", { accessToken: TOKEN_A });
    const r1 = collectRewards(a1);
    const r2 = collectRewards(a2);
    expect(players(room).filter((p) => !p.isBot)).toHaveLength(2);

    await playOneRoundMatch(room, [a1, a2], [[a1, 3]]);
    await until(() => r1.length === 1 && r2.length === 1);
    const rows = store.matchResults[0] ?? [];
    expect(rows.map((r) => r.userId)).toEqual([USER_A, USER_A]);
    const best = Math.min(...rows.map((r) => r.placement));
    const half = partyChalkReward({ rounds: 1, placement: best, humans: 1 });
    expect(half).toBe(Math.floor(partyChalkReward({ rounds: 1, placement: best, humans: 2 }) / 2));
    expect(r1).toEqual([{ chalk: half }]);
    expect(r2).toEqual([{ chalk: half }]);
    expect(store.chalkGrants).toEqual([
      { userId: USER_A, source: "party", ref: expect.any(String), amount: half, granted: half },
    ]);

    // Có thêm một khách (chưa phiên) thật sự: 2 người thật → đủ phấn.
    a1.send(ClientMessage.BackToLobby, {});
    await until(() => room.state.phase === "lobby");
    const guest = await join(room, "Khách");
    await playOneRoundMatch(room, [a1, a2, guest], [[a1, 3]]);
    await until(() => r1.length === 2);
    const rows2 = store.matchResults[1] ?? [];
    const best2 = Math.min(...rows2.map((r) => r.placement));
    expect(r1[1]).toEqual({ chalk: partyChalkReward({ rounds: 1, placement: best2, humans: 2 }) });
  }, 30_000);

  it("số gửi là số đã kẹp trần ngày; cùng tài khoản hai thẻ chỉ nhận một lần (hạng tốt hơn)", async () => {
    const store = makeStore();
    const cap = CHALK_DAILY_CAPS.party.maxChalk ?? 0;
    // Hôm nay An đã nhận gần đủ trần party.
    await store.grantChalk(USER_A, "party", "WXYZ:truoc-do", cap - 10);
    const room = await createParty();
    const a1 = await join(room, "An", { accessToken: TOKEN_A });
    const a2 = await join(room, "An (thẻ 2)", { accessToken: TOKEN_A });
    const c = await join(room, "Chi", { accessToken: TOKEN_C });
    const r1 = collectRewards(a1);
    const r2 = collectRewards(a2);
    const rc = collectRewards(c);

    await playOneRoundMatch(
      room,
      [a1, a2, c],
      [
        [a2, 2],
        [c, 1],
      ],
    );
    await until(() => r1.length === 1 && r2.length === 1 && rc.length === 1);
    // Một lần cộng cho An (theo hạng nhất của thẻ 2), kẹp còn 10; cả hai thẻ thấy cùng số.
    expect(r1).toEqual([{ chalk: 10 }]);
    expect(r2).toEqual([{ chalk: 10 }]);
    // 3 ghế người nhưng 2 tài khoản (An hai thẻ + Chi) → 2 người thật, vẫn đủ phấn.
    expect(rc).toEqual([{ chalk: partyChalkReward({ rounds: 1, placement: 1, humans: 2 }) }]);
    const partyA = store.chalkGrants.filter(
      (g) => g.userId === USER_A && g.ref !== "WXYZ:truoc-do",
    );
    expect(partyA).toEqual([
      {
        userId: USER_A,
        source: "party",
        ref: `${room.state.code}:${store.matchKeys[0]}`,
        amount: partyChalkReward({ rounds: 1, placement: 0, humans: 2 }),
        granted: 10,
      },
    ]);
    expect(store.balance(USER_A)).toBe(cap);
    // Phòng chỉ gọi grant_chalk một lần mỗi tài khoản (lần trước trận + An + Chi).
    await settle();
    expect(store.chalkCalls).toBe(3);
  });

  it("một mình với bot: × 0,5; ghi trận lỗi / phấn lỗi → không gửi reward; chạm trần → reward 0", async () => {
    const store = makeStore();
    let room = await createParty({ bots: { count: 2, level: 0 } });
    let a = await join(room, "An", { accessToken: TOKEN_A });
    let rewards = collectRewards(a);
    await playOneRoundMatch(room, [a], [[a, 3]]);
    await until(() => rewards.length === 1);
    expect(partyChalkReward({ rounds: 1, placement: 0, humans: 1 })).toBe(Math.floor(35 / 2));
    // Bot cũng ghi điểm nên lấy hạng thật đã ghi; số phấn = một nửa (làm tròn xuống) của trận đủ người.
    const placement = store.matchResults[0]?.[0]?.placement ?? -1;
    const full = partyChalkReward({ rounds: 1, placement, humans: 2 });
    expect(rewards).toEqual([{ chalk: Math.floor(full / 2) }]);
    expect(store.matchResults[0]?.[0]?.botCount).toBe(2);
    await a.leave();

    // Ghi trận lỗi.
    store.failWrites = true;
    room = await createParty();
    a = await join(room, "An", { accessToken: TOKEN_A });
    const c = await join(room, "Chi", { accessToken: TOKEN_C });
    rewards = collectRewards(a);
    const grantsBefore = store.chalkGrants.length;
    await playOneRoundMatch(room, [a, c], [[a, 1]]);
    await settle(100);
    expect(rewards).toEqual([]);
    expect(store.chalkGrants).toHaveLength(grantsBefore);
    a.send(ClientMessage.BackToLobby, {});
    await until(() => room.state.phase === "lobby");

    // Ghi trận được nhưng phấn lỗi (store trả null): không gửi reward (web không báo "+0 · đã đủ
    // phấn"), phòng chạy tiếp.
    store.failWrites = false;
    store.failChalk = true;
    const rewardsC = collectRewards(c);
    const callsBefore = store.chalkCalls;
    await playOneRoundMatch(room, [a, c], [[a, 1]]);
    await until(() => store.chalkCalls === callsBefore + 2);
    await settle(100);
    expect(rewards).toEqual([]);
    expect(rewardsC).toEqual([]);
    a.send(ClientMessage.BackToLobby, {});
    await until(() => room.state.phase === "lobby");

    // Chạm trần ngày (ghi được, cộng 0): vẫn gửi { chalk: 0 }; người chưa chạm trần nhận đủ.
    store.failChalk = false;
    await store.grantChalk(USER_A, "party", "WXYZ:ca-ngay", CHALK_DAILY_CAPS.party.maxChalk ?? 0);
    await playOneRoundMatch(room, [a, c], [[a, 1]]);
    await until(() => rewards.length === 1 && rewardsC.length === 1);
    expect(rewards).toEqual([{ chalk: 0 }]);
    expect(rewardsC).toEqual([{ chalk: partyChalkReward({ rounds: 1, placement: 1, humans: 2 }) }]);
    a.send(ClientMessage.BackToLobby, {});
    await until(() => room.state.phase === "lobby");
  }, 30_000);

  // ---------------------------------------------------------------- Kiểm tra não

  async function startBrain(store: MemoryResultStore, opts: Partial<BrainJoinOptions> = {}) {
    setResultStore(store);
    const room = (await colyseus.createRoom(BRAIN_TEST_ROOM_NAME, {})) as BrainTestRoom;
    const client = await connectTo(colyseus, room, { name: "An", ...opts });
    return { room, client };
  }

  async function playBrain(
    room: BrainTestRoom,
    client: Awaited<ReturnType<typeof startBrain>>["client"],
  ) {
    for (let i = 0; i < BRAIN_TEST_GAME_COUNT; i++) {
      client.send(BrainClientMessage.Ready, {});
      await until(() => room.state.phase === "countdown");
      advance(room, BRAIN_TEST_COUNTDOWN_MS);
      const game = room.state.games[room.state.round - 1];
      const id = game?.gameId as GameId;
      const { seed, progress, round } = room.state;
      const result = nextMessage<AnswerResultPayload>(client, ServerMessage.AnswerResult);
      client.send(BrainClientMessage.Answer, {
        round,
        index: progress,
        answer: SOLVE[id](seed, progress, BRAIN_TEST_DIFFICULTY as Difficulty),
      });
      expect((await result).correct).toBe(true);
      advance(room, brainTestDurationMs(id) + LATE_ANSWER_GRACE_MS);
      advance(room, BRAIN_TEST_GAME_RESULT_MS);
    }
    expect(room.state.phase).toBe("finished");
  }

  it("Kiểm tra não: thú khoá cần token + đã mở; lưu xong thì cộng phấn (ref = id lượt) vào chalkEarned", async () => {
    const store = makeStore();
    // Khách: thú khoá → khoi.
    let { room, client } = await startBrain(store, { avatar: "pin" });
    expect(room.state.avatar).toBe("khoi");
    await client.leave();

    // Chưa mở → khoi.
    ({ room, client } = await startBrain(store, { avatar: "pin", accessToken: TOKEN_B }));
    await until(() => store.cosmeticsLoads.length === 1);
    await settle();
    expect(room.state.avatar).toBe("khoi");
    await client.leave();

    // Đã mở → pin; chơi xong → saved → chalkEarned.
    ({ room, client } = await startBrain(store, { avatar: "pin", accessToken: TOKEN_A }));
    await until(() => room.state.avatar === "pin");
    await playBrain(room, client);
    await until(() => room.state.saveStatus === "saved");
    const expected = brainChalkReward(room.state.brainScore);
    await until(() => room.state.chalkEarned === expected);
    expect(store.chalkGrants).toEqual([
      {
        userId: USER_A,
        source: "brain",
        ref: store.brainTestIds[0],
        amount: expected,
        granted: expected,
      },
    ]);
    await until(() => client.state.chalkEarned === expected);
  }, 30_000);

  it("Kiểm tra não: thú vừa mở mà đệm vừa đọc → hẹn đúng một lần đọc lại rồi áp; rời trước giờ hẹn → huỷ hẹn", async () => {
    const store = makeStore();
    const time = cachedCosmetics(store);
    const retryOf = (room: BrainTestRoom) =>
      (room as unknown as { avatarRetry: Delayed | null }).avatarRetry;

    // Bình chưa mở pin: lần đọc đầu là đọc thật → khoi, không hẹn.
    let { room, client } = await startBrain(store, { avatar: "pin", accessToken: TOKEN_B });
    await until(() => loadsOf(store, USER_B) === 1);
    await settle();
    expect(room.state.avatar).toBe("khoi");
    expect(retryOf(room)).toBeNull();
    await client.leave();

    // Vừa mở pin (DB đổi, đệm còn hạn chưa biết) rồi vào ngay: chưa thấy, hẹn đọc lại.
    store.cosmetics.set(USER_B, { stats: { party_matches: 10 }, items: [] });
    ({ room, client } = await startBrain(store, { avatar: "pin", accessToken: TOKEN_B }));
    await until(() => retryOf(room) !== null);
    expect(room.state.avatar).toBe("khoi");
    expect(loadsOf(store, USER_B)).toBe(1);
    time.now += COSMETICS_REFRESH_MS;
    advance(room, COSMETICS_REFRESH_MS + OWNERSHIP_RETRY_MARGIN_MS);
    await until(() => room.state.avatar === "pin");
    expect(loadsOf(store, USER_B)).toBe(2);
    expect(retryOf(room)).toBeNull();
    await client.leave();

    // Chi xin lua (chưa mở) hai lượt liền: lượt hai hẹn; rời trước giờ hẹn → huỷ, không đọc thêm.
    ({ room, client } = await startBrain(store, { avatar: "lua", accessToken: TOKEN_C }));
    await until(() => loadsOf(store, USER_C) === 1);
    await settle();
    expect(retryOf(room)).toBeNull();
    await client.leave();
    ({ room, client } = await startBrain(store, { avatar: "lua", accessToken: TOKEN_C }));
    await until(() => retryOf(room) !== null);
    const pending = retryOf(room);
    await client.leave();
    await until(() => retryOf(room) === null);
    expect(pending?.active).toBe(false);
    await settle();
    expect(loadsOf(store, USER_C)).toBe(1);
    expect(room.state.avatar).toBe("khoi");
  });

  it("Kiểm tra não: khách không nhận phấn; phấn lỗi vẫn saved, chalkEarned 0", async () => {
    const store = makeStore();
    let { room, client } = await startBrain(store);
    await playBrain(room, client);
    await settle();
    expect(room.state.saveStatus).toBe("guest");
    expect(room.state.chalkEarned).toBe(0);
    expect(store.chalkGrants).toEqual([]);
    await client.leave();

    store.failChalk = true;
    ({ room, client } = await startBrain(store, { accessToken: TOKEN_A }));
    await playBrain(room, client);
    await until(() => room.state.saveStatus === "saved");
    await settle();
    expect(room.state.chalkEarned).toBe(0);
    expect(store.brainTests).toHaveLength(1);
  }, 30_000);
});
