import {
  type AnswerResultPayload,
  ClientMessage,
  COUNTDOWN_MS,
  DEFAULT_PARTY_CONFIG,
  DEFAULT_SCORING,
  type Difficulty,
  type ErrorPayload,
  GAME_IDS,
  type GameId,
  gameMultiplier,
  getGame,
  type JoinOptions,
  LATE_ANSWER_GRACE_MS,
  MAX_PLAYERS,
  type PartyConfig,
  parseScoringJson,
  placementPoints,
  pointsForCorrect,
  ROOM_NAME,
  type ScoringConfig,
  ServerMessage,
  WHEEL_RESULT_HOLD_MS,
  WHEEL_SPIN_LEAD_MS,
  WHEEL_SPIN_MS,
} from "@brain-rizz/shared";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import appConfig from "../src/app.config";
import type { PartyRoom } from "../src/rooms/PartyRoom";
import {
  invalidatePartyConfig,
  PARTY_CONFIG_WAIT_MS,
  PartyConfigCache,
  partyConfigCache,
} from "../src/store/party-config-cache";
import {
  MemoryResultStore,
  NoopResultStore,
  type ResultStore,
  setResultStore,
} from "../src/store/ResultStore";
import { advance, connectTo, freezeNow, nextMessage, SOLVE, settle, until } from "./helpers";

/** Cấu hình party của quản trị viên (CR-019) và phòng 12 người (CR-018) trên server. */

let colyseus: ColyseusTestServer<typeof appConfig>;

/** Khác mặc định ở mọi trường; odd-one-out bị ghi đè hệ số. */
const CUSTOM: ScoringConfig = {
  basePoints: 200,
  maxSpeedBonus: 80,
  fastAnswerMs: 1_000,
  slowAnswerMs: 5_000,
  streakThreshold: 2,
  streakBonusPerStep: 0.2,
  maxComboMultiplier: 2,
  difficultyMultiplier: [0.5, 1, 2, 3],
  gameMultipliers: { "odd-one-out": [1, 2, 3, 4] },
  placementTopBonus: [10, 5, 0],
};

async function join(room: PartyRoom, name: string, opts: Partial<JoinOptions> = {}) {
  return connectTo(colyseus, room, { name, ...opts });
}
type TestClient = Awaited<ReturnType<typeof join>>;

/** Dùng store trong RAM với dòng `party_settings` thô `raw` (null = chưa có dòng). */
function useStore(raw: unknown, users = new Map<string, string>()) {
  const store = new MemoryResultStore(users);
  store.partyConfig = raw;
  setResultStore(store);
  return store;
}

async function setup(names: string[], options: object = {}) {
  const room = (await colyseus.createRoom(ROOM_NAME, options)) as PartyRoom;
  const clients: TestClient[] = [];
  for (const name of names) clients.push(await join(room, name));
  return { room, clients, host: clients[0] as TestClient };
}

const players = (room: PartyRoom) => [...room.state.players.values()];

function player(room: PartyRoom, client: TestClient) {
  const p = room.state.players.get(client.sessionId);
  if (!p) throw new Error("Không thấy người chơi");
  return p;
}

async function expectError(client: TestClient, code: ErrorPayload["code"], send: () => void) {
  const error = nextMessage<ErrorPayload>(client, ServerMessage.Error);
  send();
  expect((await error).code).toBe(code);
}

async function toGameSelect(room: PartyRoom, clients: TestClient[]) {
  for (const c of clients) c.send(ClientMessage.Ready, { ready: true });
  await until(() => players(room).every((p) => p.ready));
  clients[0]?.send(ClientMessage.StartMatch, {});
  await until(() => room.state.phase === "game-select");
}

/** Đang ở game-intro: mọi người bấm Đã hiểu, chủ phòng bắt đầu, tua hết đếm ngược. */
async function introToPlaying(room: PartyRoom, clients: TestClient[]) {
  for (const c of clients.slice(1)) c.send(ClientMessage.IntroReady, { ready: true });
  await until(() => players(room).every((p) => p.isHost || p.isBot || p.introReady));
  clients[0]?.send(ClientMessage.StartRound, {});
  await until(() => room.state.phase === "countdown");
  advance(room, COUNTDOWN_MS);
  expect(room.state.phase).toBe("playing");
}

async function pick(room: PartyRoom, clients: TestClient[], gameId: GameId) {
  clients[0]?.send(ClientMessage.PickGame, { gameId });
  await until(() => room.state.phase === "game-intro");
  await introToPlaying(room, clients);
}

function finishRound(room: PartyRoom) {
  advance(room, getGame(room.state.gameId as GameId).durationMs + LATE_ANSWER_GRACE_MS);
  expect(room.state.phase).toBe("round-results");
}

async function answerCorrectly(room: PartyRoom, client: TestClient) {
  const p = player(room, client);
  const gameId = room.state.gameId as GameId;
  const result = nextMessage<AnswerResultPayload>(client, ServerMessage.AnswerResult);
  client.send(ClientMessage.Answer, {
    round: room.state.round,
    index: p.progress,
    answer: SOLVE[gameId](room.state.seed, p.progress, p.difficulty as Difficulty),
  });
  return result;
}

/** Store bản rỗng nhưng `loadPartyConfig` thay bằng `load` (kiểm bộ đệm). */
function storeLoading(load: () => Promise<PartyConfig | null>): ResultStore {
  return Object.assign(new NoopResultStore(), { loadPartyConfig: load });
}

beforeAll(async () => {
  colyseus = await boot(appConfig);
});
afterAll(async () => {
  setResultStore(new NoopResultStore());
  await colyseus.shutdown();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("PartyRoom — cấu hình party của quản trị viên (CR-019)", () => {
  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it("phòng mới nạp cấu hình vào state: disabledGames, scoringJson, configVersion", async () => {
    useStore({ version: 5, scoring: CUSTOM, disabledGames: ["balance", "tetris", "balance"] });
    const { room, host } = await setup(["An"]);
    expect(room.state.configVersion).toBe(5);
    expect(parseScoringJson(room.state.scoringJson)).toEqual(CUSTOM);
    expect([...room.state.disabledGames]).toEqual(["balance"]);
    // Đồng bộ xuống client.
    await until(() => host.state.configVersion === 5);
    expect(parseScoringJson(host.state.scoringJson)).toEqual(CUSTOM);
    expect([...host.state.disabledGames]).toEqual(["balance"]);
  });

  it("chưa có dòng cấu hình, hoặc đọc lỗi → mặc định trong code", async () => {
    const empty = new MemoryResultStore();
    const failing = new MemoryResultStore();
    failing.partyConfig = { version: 3, scoring: CUSTOM, disabledGames: ["balance"] };
    failing.failPartyConfig = true;
    for (const store of [empty, failing]) {
      setResultStore(store);
      const { room } = await setup(["An"]);
      expect(room.state.configVersion).toBe(0);
      expect(parseScoringJson(room.state.scoringJson)).toEqual(DEFAULT_SCORING);
      expect([...room.state.disabledGames]).toEqual([]);
    }
  });

  it("DB có dữ liệu hỏng: sai trường nào về mặc định trường đó", async () => {
    useStore({
      version: "7",
      scoring: { basePoints: 99_999, maxSpeedBonus: 10, gameMultipliers: { tetris: [1, 1, 1, 1] } },
      disabledGames: "balance",
    });
    const { room } = await setup(["An"]);
    expect(room.state.configVersion).toBe(0);
    expect(parseScoringJson(room.state.scoringJson)).toEqual({
      ...DEFAULT_SCORING,
      maxSpeedBonus: 10,
    });
    expect([...room.state.disabledGames]).toEqual([]);
  });

  it("cấu hình tuỳ chỉnh đổi điểm câu và điểm thứ hạng", async () => {
    useStore({ version: 2, scoring: CUSTOM, disabledGames: [] });
    const { room, clients, host } = await setup(["An", "Bình", "Cúc"]);
    const now = freezeNow();
    try {
      await toGameSelect(room, clients);
      await pick(room, clients, "odd-one-out");
      // Trả lời đúng sau 2 giây: (200 × 2 + thưởng 60) × 1 = 460 (công thức chuẩn: 146).
      now.set(room.state.startAt + 2_000);
      const d = player(room, host).difficulty as Difficulty;
      expect(d).toBe(1);
      const result = await answerCorrectly(room, host);
      const expected = pointsForCorrect(
        {
          difficulty: d,
          answerMs: 2_000,
          streak: 0,
          multiplier: gameMultiplier(getGame("odd-one-out"), d, CUSTOM),
        },
        CUSTOM,
      );
      expect(expected).toBe(460);
      expect(result).toMatchObject({ correct: true, points: 460 });
      expect(player(room, host).roundScore).toBe(460);
      expect(expected).not.toBe(
        pointsForCorrect({
          difficulty: d,
          answerMs: 2_000,
          streak: 0,
          multiplier: gameMultiplier(getGame("odd-one-out"), d),
        }),
      );

      finishRound(room);
      // 3 ghế, thưởng top [10, 5, 0]: nhất 3 + 10, hai người hoà hạng 2: 2 + 5.
      expect(player(room, host).lastPoints).toBe(13);
      for (const c of clients.slice(1)) expect(player(room, c).lastPoints).toBe(7);
      expect(player(room, host).lastPoints).toBe(placementPoints(0, 3, CUSTOM.placementTopBonus));
    } finally {
      now.restore();
    }
  });

  it("bot cũng chấm theo cấu hình của trận (cùng hàm với người)", async () => {
    useStore({ version: 1, scoring: CUSTOM, disabledGames: [] });
    const { room, clients, host } = await setup(["An"], { bots: { count: 1, level: 3 } });
    const now = freezeNow();
    try {
      await toGameSelect(room, clients);
      host.send(ClientMessage.PickGame, { gameId: "odd-one-out" });
      await until(() => room.state.phase === "game-intro");
      // Không chờ bot bấm Đã hiểu. Tua giờ server cùng đồng hồ phòng để bot trả lời đúng kế hoạch.
      host.send(ClientMessage.StartRound, {});
      await until(() => room.state.phase === "countdown");
      now.set(now.get() + COUNTDOWN_MS);
      advance(room, COUNTDOWN_MS);
      expect(room.state.phase).toBe("playing");
      for (let i = 0; i < 1_000 && room.state.phase === "playing"; i++) {
        now.set(now.get() + 200);
        advance(room, 200);
      }
      expect(room.state.phase).toBe("round-results");
      const bot = players(room).find((p) => p.isBot);
      // Bot Siêu (Siêu khó) ở odd-one-out bị ghi đè × 4: mỗi câu đúng ≥ 200 × 4 = 800 điểm.
      expect(bot?.roundCorrect).toBeGreaterThan(0);
      expect((bot?.roundScore ?? 0) / (bot?.roundCorrect ?? 1)).toBeGreaterThanOrEqual(800);
    } finally {
      now.restore();
    }
  });

  it("game bị tắt không bao giờ trúng vòng quay; chọn và bầu game bị tắt bị từ chối", async () => {
    const enabled = GAME_IDS.slice(0, 3);
    const disabled = GAME_IDS.slice(3);
    useStore({ version: 4, scoring: {}, disabledGames: disabled });
    const { room, clients, host } = await setup(["An", "Bình"]);
    const guest = clients[1] as TestClient;
    host.send(ClientMessage.SetRounds, { totalRounds: 5 });
    await until(() => room.state.totalRounds === 5);
    await toGameSelect(room, clients);

    const off = disabled[0] as GameId;
    await expectError(host, "invalid", () => host.send(ClientMessage.PickGame, { gameId: off }));
    await expectError(guest, "invalid", () => guest.send(ClientMessage.VoteGame, { gameId: off }));
    expect(room.state.votes.size).toBe(0);
    expect(room.state.phase).toBe("game-select");

    // 5 vòng với 3 game bật: chơi hết thì danh sách làm mới, vẫn chỉ trong 3 game bật.
    const spun: string[] = [];
    const randoms = [0, 0.999_999, 0.5, 0.999_999, 0];
    for (let r = 0; r < 5; r++) {
      vi.spyOn(Math, "random").mockReturnValue(randoms[r] as number);
      host.send(ClientMessage.SpinWheel, {});
      await until(() => room.state.wheelGameId !== "");
      spun.push(room.state.wheelGameId);
      vi.restoreAllMocks();
      advance(room, WHEEL_SPIN_LEAD_MS + WHEEL_SPIN_MS + WHEEL_RESULT_HOLD_MS);
      expect(room.state.phase).toBe("game-intro");
      await introToPlaying(room, clients);
      finishRound(room);
      host.send(ClientMessage.NextRound, {});
      await until(() => room.state.phase === (r < 4 ? "game-select" : "podium"));
    }
    for (const id of spun) expect(enabled).toContain(id);
    // 3 vòng đầu không lặp game; vòng 4 làm mới danh sách.
    expect(new Set(spun.slice(0, 3)).size).toBe(3);
  }, 30_000);

  it("admin đổi giữa trận: trận đang chơi giữ bản chụp; Chơi lại / trận mới nạp bản mới", async () => {
    const TOKEN = "jwt-an";
    const USER = "00000000-0000-0000-0000-00000000000a";
    const store = useStore(
      { version: 1, scoring: CUSTOM, disabledGames: [] },
      new Map([[TOKEN, USER]]),
    );
    const room = (await colyseus.createRoom(ROOM_NAME, {})) as PartyRoom;
    const a = await join(room, "An", { accessToken: TOKEN });
    const b = await join(room, "Bình");
    const clients = [a, b];
    a.send(ClientMessage.SetRounds, { totalRounds: 1 });
    await until(() => room.state.totalRounds === 1);
    await toGameSelect(room, clients);
    expect(room.state.configVersion).toBe(1);

    // Admin lưu bản mới và server được báo nạp lại giữa trận.
    store.partyConfig = {
      version: 2,
      scoring: { ...CUSTOM, placementTopBonus: [0, 0, 0] },
      disabledGames: ["odd-one-out"],
    };
    invalidatePartyConfig();

    // Trận đang chơi vẫn dùng bản 1: odd-one-out chưa bị tắt, thưởng top cũ.
    await pick(room, clients, "odd-one-out");
    await answerCorrectly(room, a);
    finishRound(room);
    expect(room.state.configVersion).toBe(1);
    expect(player(room, a).lastPoints).toBe(placementPoints(0, 2, CUSTOM.placementTopBonus));
    a.send(ClientMessage.NextRound, {});
    await until(() => room.state.phase === "podium");
    await until(() => store.matchResults.length === 1);
    expect(store.matchResults[0]?.map((r) => r.settingsVersion)).toEqual([1]);

    // Chơi lại: nạp bản 2.
    a.send(ClientMessage.PlayAgain, {});
    await until(() => room.state.phase === "game-select");
    expect(room.state.configVersion).toBe(2);
    expect([...room.state.disabledGames]).toEqual(["odd-one-out"]);
    expect(parseScoringJson(room.state.scoringJson).placementTopBonus).toEqual([0, 0, 0]);
    await expectError(a, "invalid", () =>
      a.send(ClientMessage.PickGame, { gameId: "odd-one-out" }),
    );
    await pick(room, clients, "balance");
    finishRound(room);
    // 2 ghế, không thưởng top: cả hai hoà hạng nhất → 2.
    expect(players(room).map((p) => p.lastPoints)).toEqual([2, 2]);
    a.send(ClientMessage.NextRound, {});
    await until(() => store.matchResults.length === 2);
    expect(store.matchResults[1]?.map((r) => r.settingsVersion)).toEqual([2]);
  }, 30_000);

  it("về phòng chờ rồi bắt đầu lại cũng nạp cấu hình mới", async () => {
    const store = useStore({ version: 1, scoring: {}, disabledGames: [] });
    const { room, clients, host } = await setup(["An", "Bình"]);
    await toGameSelect(room, clients);
    await pick(room, clients, "balance");
    finishRound(room);
    host.send(ClientMessage.BackToLobby, {});
    await until(() => room.state.phase === "lobby");
    store.partyConfig = { version: 9, scoring: {}, disabledGames: [] };
    invalidatePartyConfig();
    expect(room.state.configVersion).toBe(1);
    await toGameSelect(room, clients);
    expect(room.state.configVersion).toBe(9);
  });
});

/**
 * Store trong RAM mà lượt đọc cấu hình có thể bị giữ lại (giả lập Supabase chậm/treo):
 * `hold()` rồi lượt đọc kế tiếp chờ tới `release()`.
 */
class GatedStore extends MemoryResultStore {
  /** Số lần `loadPartyConfig` được gọi (tính cả lượt đang bị giữ). */
  calls = 0;
  private gate: Promise<void> | null = null;
  private open: () => void = () => {};

  hold() {
    this.gate = new Promise((resolve) => {
      this.open = resolve;
    });
  }

  release() {
    this.gate = null;
    this.open();
  }

  override async loadPartyConfig(): Promise<PartyConfig | null> {
    this.calls++;
    const gate = this.gate;
    if (gate) await gate;
    return super.loadPartyConfig();
  }
}

describe("PartyRoom — bắt đầu trận chờ nạp cấu hình (CR-019, beginMatch async)", () => {
  beforeEach(async () => {
    await colyseus.cleanup();
  });

  /** Phòng `names` người, cấu hình bản 1; mọi người sẵn sàng; admin vừa lưu bản 2 và DB đang chậm. */
  async function readyRoomWithSlowConfig(names: string[], options: object = {}) {
    const store = new GatedStore();
    store.partyConfig = { version: 1, scoring: {}, disabledGames: [] };
    setResultStore(store);
    const { room, clients, host } = await setup(names, options);
    expect(room.state.configVersion).toBe(1);
    for (const c of clients) c.send(ClientMessage.Ready, { ready: true });
    await until(() => players(room).every((p) => p.ready));
    store.partyConfig = { version: 2, scoring: {}, disabledGames: ["balance"] };
    invalidatePartyConfig();
    store.hold();
    return { store, room, clients, host };
  }

  it("chủ phòng bấm Bắt đầu hai lần trong lúc chờ: chỉ một lượt đọc, chỉ vào chọn game một lần", async () => {
    const { store, room, host } = await readyRoomWithSlowConfig(["An", "Bình"]);
    const enterGameSelect = vi.spyOn(
      room as unknown as { enterGameSelect: () => void },
      "enterGameSelect",
    );
    const before = store.calls;
    host.send(ClientMessage.StartMatch, {});
    host.send(ClientMessage.StartMatch, {});
    await settle(100);
    // Còn chờ DB: chưa đổi pha, cấu hình chưa đổi, chỉ một lượt đọc.
    expect(room.state.phase).toBe("lobby");
    expect(room.state.configVersion).toBe(1);
    expect(store.calls).toBe(before + 1);

    store.release();
    await until(() => room.state.phase === "game-select");
    await settle(50);
    expect(enterGameSelect).toHaveBeenCalledTimes(1);
    expect(room.state.round).toBe(1);
    expect(room.state.configVersion).toBe(2);
    expect([...room.state.disabledGames]).toEqual(["balance"]);
    expect(store.calls).toBe(before + 1);
  });

  it("người chơi bỏ sẵn sàng trong lúc chờ → không bắt đầu, báo chủ phòng not-ready, giữ cấu hình cũ; bấm lại thì bắt đầu", async () => {
    const { store, room, clients, host } = await readyRoomWithSlowConfig(["An", "Bình", "Cúc"]);
    const guest = clients[1] as TestClient;
    host.send(ClientMessage.StartMatch, {});
    await settle(50);
    guest.send(ClientMessage.Ready, { ready: false });
    await until(() => !player(room, guest).ready);
    await expectError(host, "not-ready", () => store.release());
    await settle(50);
    expect(room.state.phase).toBe("lobby");
    expect(room.state.round).toBe(0);
    expect(room.state.configVersion).toBe(1);

    guest.send(ClientMessage.Ready, { ready: true });
    await until(() => player(room, guest).ready);
    host.send(ClientMessage.StartMatch, {});
    await until(() => room.state.phase === "game-select");
    expect(room.state.configVersion).toBe(2);
  });

  it("người khác rời phòng trong lúc chờ (còn 1 người) → không bắt đầu, báo chủ phòng not-ready", async () => {
    const { store, room, clients, host } = await readyRoomWithSlowConfig(["An", "Bình"]);
    host.send(ClientMessage.StartMatch, {});
    await settle(50);
    await (clients[1] as TestClient).leave(true);
    await until(() => room.state.players.size === 1);
    await expectError(host, "not-ready", () => store.release());
    await settle(50);
    expect(room.state.phase).toBe("lobby");
    expect(room.state.configVersion).toBe(1);
  });

  it("người vào thêm trong lúc chờ (chưa sẵn sàng) → không bắt đầu, báo chủ phòng not-ready", async () => {
    const { store, room, host } = await readyRoomWithSlowConfig(["An", "Bình"]);
    host.send(ClientMessage.StartMatch, {});
    await settle(50);
    const late = await join(room, "Cúc");
    expect(room.state.players.size).toBe(3);
    // Chỉ chủ phòng (người bấm Bắt đầu) nhận lỗi.
    const lateErrors: ErrorPayload[] = [];
    late.onMessage(ServerMessage.Error, (e: ErrorPayload) => lateErrors.push(e));
    await expectError(host, "not-ready", () => store.release());
    await settle(50);
    expect(room.state.phase).toBe("lobby");
    expect(lateErrors).toEqual([]);
  });

  it("phòng đóng trong lúc chờ (người cuối rời, còn bot) → không lỗi, không hẹn giờ nào còn lại", async () => {
    const { store, room, host } = await readyRoomWithSlowConfig(["An"], {
      bots: { count: 1, level: 1 },
    });
    expect(room.state.players.size).toBe(2);
    host.send(ClientMessage.StartMatch, {});
    await settle(50);
    await host.leave(true);
    await until(() => room.state.players.size === 0);
    store.release();
    await settle(100);
    expect(room.state.phase).toBe("lobby");
    expect(room.clock.delayed).toHaveLength(0);
  });

  /** Phòng 2 người, trận 1 vòng đã xong (đang vinh danh); admin vừa lưu bản 2 và DB đang chậm. */
  async function podiumWithSlowConfig() {
    const store = new GatedStore();
    store.partyConfig = { version: 1, scoring: {}, disabledGames: [] };
    setResultStore(store);
    const { room, clients, host } = await setup(["An", "Bình"]);
    host.send(ClientMessage.SetRounds, { totalRounds: 1 });
    await until(() => room.state.totalRounds === 1);
    await toGameSelect(room, clients);
    await pick(room, clients, "balance");
    finishRound(room);
    host.send(ClientMessage.NextRound, {});
    await until(() => room.state.phase === "podium");

    store.partyConfig = { version: 2, scoring: {}, disabledGames: [] };
    invalidatePartyConfig();
    store.hold();
    return { store, room, clients, host };
  }

  it("Chơi lại rồi Về phòng chờ trong lúc chờ → ở lại phòng chờ, không bắt đầu trận, không báo lỗi", async () => {
    const { store, room, host } = await podiumWithSlowConfig();
    const errors: ErrorPayload[] = [];
    host.onMessage(ServerMessage.Error, (e: ErrorPayload) => errors.push(e));
    host.send(ClientMessage.PlayAgain, {});
    await settle(50);
    host.send(ClientMessage.BackToLobby, {});
    await until(() => room.state.phase === "lobby");
    store.release();
    await settle(100);
    expect(room.state.phase).toBe("lobby");
    expect(room.state.round).toBe(0);
    expect(room.state.configVersion).toBe(1);
    // Chủ phòng tự huỷ (Về phòng chờ) nên không có lỗi nào.
    expect(errors).toEqual([]);
  });

  it("Chơi lại → Về phòng chờ → Bắt đầu, tất cả trong lúc chờ → lệnh Bắt đầu không bị bỏ qua", async () => {
    const { store, room, clients, host } = await podiumWithSlowConfig();
    const before = store.calls;
    host.send(ClientMessage.PlayAgain, {});
    await settle(50);
    host.send(ClientMessage.BackToLobby, {});
    await until(() => room.state.phase === "lobby");
    for (const c of clients) c.send(ClientMessage.Ready, { ready: true });
    await until(() => players(room).every((p) => p.ready));
    host.send(ClientMessage.StartMatch, {});
    await settle(50);
    // Vẫn đang chờ lượt đọc của Chơi lại: chưa bắt đầu, không đọc thêm lượt nào.
    expect(room.state.phase).toBe("lobby");
    expect(store.calls).toBe(before + 1);

    store.release();
    await until(() => room.state.phase === "game-select");
    expect(room.state.round).toBe(1);
    expect(room.state.configVersion).toBe(2);
    expect(store.calls).toBe(before + 1);
  });

  it("lỗi khi bắt đầu trận sau lúc chờ → chỉ log, không unhandled rejection; bấm lại vẫn chạy", async () => {
    setResultStore(new MemoryResultStore());
    const { room, clients, host } = await setup(["An", "Bình"]);
    for (const c of clients) c.send(ClientMessage.Ready, { ready: true });
    await until(() => players(room).every((p) => p.ready));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const apply = vi
      .spyOn(room as unknown as { applyConfig: () => void }, "applyConfig")
      .mockImplementationOnce(() => {
        throw new Error("hỏng");
      });
    host.send(ClientMessage.StartMatch, {});
    await until(() => log.mock.calls.length > 0);
    expect(String(log.mock.calls[0]?.[0])).toContain(room.state.code);
    expect(room.state.phase).toBe("lobby");

    // Cờ chờ đã được gỡ: lệnh sau chạy bình thường.
    host.send(ClientMessage.StartMatch, {});
    await until(() => room.state.phase === "game-select");
    expect(apply).toHaveBeenCalledTimes(2);
  });

  it(`DB treo quá ${PARTY_CONFIG_WAIT_MS} ms → vẫn bắt đầu bằng cấu hình đang có; bản về muộn không đổi trận đang chơi`, async () => {
    const { store, room, host } = await readyRoomWithSlowConfig(["An", "Bình"]);
    const started = Date.now();
    host.send(ClientMessage.StartMatch, {});
    await until(() => room.state.phase === "game-select", PARTY_CONFIG_WAIT_MS + 3_000);
    expect(Date.now() - started).toBeGreaterThanOrEqual(PARTY_CONFIG_WAIT_MS - 100);
    expect(room.state.configVersion).toBe(1);
    expect([...room.state.disabledGames]).toEqual([]);
    store.release();
    await settle(50);
    // Bản 2 về muộn vào đệm (trận sau dùng) nhưng trận này giữ bản chụp 1.
    expect(partyConfigCache().peek().version).toBe(2);
    expect(room.state.configVersion).toBe(1);
  }, 10_000);
});

describe("PartyConfigCache — đệm 30 giây (CR-019)", () => {
  const v = (version: number): PartyConfig => ({ ...DEFAULT_PARTY_CONFIG, version });

  it("còn hạn thì không đọc lại; hết hạn đọc lại; nhiều lời gọi cùng lúc chỉ đọc một lần", async () => {
    let t = 1_000;
    const store = new MemoryResultStore();
    store.partyConfig = v(1);
    const cache = new PartyConfigCache(store, 30_000, () => t);
    expect(cache.peek()).toEqual(DEFAULT_PARTY_CONFIG);
    const [a, b] = await Promise.all([cache.get(), cache.get()]);
    expect([a.version, b.version, store.partyConfigLoads]).toEqual([1, 1, 1]);

    store.partyConfig = v(2);
    t += 29_999;
    expect((await cache.get()).version).toBe(1);
    expect(store.partyConfigLoads).toBe(1);
    t += 1;
    expect((await cache.get()).version).toBe(2);
    expect(store.partyConfigLoads).toBe(2);
  });

  it("đọc ra null hoặc lỗi → giữ bản đã có; lỗi cũng được đệm", async () => {
    let t = 0;
    const store = new MemoryResultStore();
    store.partyConfig = v(3);
    const cache = new PartyConfigCache(store, 30_000, () => t);
    expect((await cache.get()).version).toBe(3);
    store.failPartyConfig = true;
    t += 30_000;
    expect((await cache.get()).version).toBe(3);
    expect((await cache.get()).version).toBe(3);
    expect(store.partyConfigLoads).toBe(2);

    // Store ném lỗi (không đúng hợp đồng) cũng không làm hỏng phòng.
    const broken = storeLoading(() => Promise.reject(new Error("hỏng")));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await new PartyConfigCache(broken).get()).toEqual(DEFAULT_PARTY_CONFIG);
  });

  it("invalidate: lần sau đọc lại ngay; lượt đọc cũ đang chạy không ghi đè", async () => {
    let release: (c: PartyConfig | null) => void = () => {};
    let calls = 0;
    const slow = storeLoading(() => {
      calls++;
      if (calls === 1) return new Promise<PartyConfig | null>((r) => (release = r));
      return Promise.resolve(v(5));
    });
    const cache = new PartyConfigCache(slow, 30_000, () => 0);
    const stale = cache.get();
    cache.invalidate();
    expect((await cache.get()).version).toBe(5);
    release(v(4));
    expect((await stale).version).toBe(4);
    // Bản cũ về muộn không thay bản mới trong đệm.
    expect(cache.peek().version).toBe(5);
    expect((await cache.reload()).version).toBe(5);
    expect(calls).toBe(3);
  });

  it("chờ tối đa maxWaitMs rồi dùng bản đang có; lượt đọc chạy nền vẫn cập nhật đệm", async () => {
    let release: (c: PartyConfig | null) => void = () => {};
    const slow = storeLoading(() => new Promise<PartyConfig | null>((r) => (release = r)));
    const cache = new PartyConfigCache(slow, 30_000, () => 0);
    const started = Date.now();
    expect(await cache.get(20)).toEqual(DEFAULT_PARTY_CONFIG);
    expect(Date.now() - started).toBeLessThan(1_000);
    release(v(8));
    await settle(10);
    expect(cache.peek().version).toBe(8);
  });

  it("bộ đệm dùng chung gắn với store hiện tại", () => {
    const first = new MemoryResultStore();
    setResultStore(first);
    const cache = partyConfigCache();
    expect(partyConfigCache()).toBe(cache);
    setResultStore(new MemoryResultStore());
    expect(partyConfigCache()).not.toBe(cache);
    setResultStore(new NoopResultStore());
  });
});

describe(`PartyRoom — phòng ${MAX_PLAYERS} người (CR-018)`, () => {
  beforeEach(async () => {
    setResultStore(new NoopResultStore());
    await colyseus.cleanup();
  });

  it(`${MAX_PLAYERS} người vào được, mỗi người một màu; người thứ ${MAX_PLAYERS + 1} bị từ chối; điểm thứ hạng theo ${MAX_PLAYERS} ghế`, async () => {
    expect(MAX_PLAYERS).toBe(12);
    const names = Array.from({ length: MAX_PLAYERS }, (_, i) => `P${i + 1}`);
    // Ai cũng chọn màu 0: server phát màu trống, đủ 12 màu.
    const room = (await colyseus.createRoom(ROOM_NAME, {})) as PartyRoom;
    const clients: TestClient[] = [];
    for (const name of names) clients.push(await join(room, name, { colorIndex: 0 }));
    expect(room.state.players.size).toBe(MAX_PLAYERS);
    expect(new Set(players(room).map((p) => p.colorIndex)).size).toBe(MAX_PLAYERS);
    await expect(colyseus.connectTo(room, { name: "Thừa" })).rejects.toBeDefined();
    expect(room.state.players.size).toBe(MAX_PLAYERS);

    await toGameSelect(room, clients);
    await pick(room, clients, "odd-one-out");
    await answerCorrectly(room, clients[3] as TestClient);
    finishRound(room);
    // Một người đúng → nhất 12 + 3 = 15; 11 người hoà hạng 2 → 11 + 2 = 13.
    const points = players(room).map((p) => p.lastPoints);
    expect(points.filter((x) => x === 15)).toHaveLength(1);
    expect(points.filter((x) => x === 13)).toHaveLength(MAX_PLAYERS - 1);
    expect(player(room, clients[3] as TestClient).lastPoints).toBe(15);
  }, 30_000);

  it(`bot nhường ghế ở ${MAX_PLAYERS}: phòng đầy bot thì người thật vẫn vào được tới ${MAX_PLAYERS} người`, async () => {
    const { room } = await setup(["Chủ"], { bots: { count: MAX_PLAYERS - 1, level: 1 } });
    expect(room.state.players.size).toBe(MAX_PLAYERS);
    for (let i = 2; i <= MAX_PLAYERS; i++) {
      await join(room, `P${i}`);
      expect(room.state.players.size).toBe(MAX_PLAYERS);
      expect(players(room).filter((p) => p.isBot)).toHaveLength(MAX_PLAYERS - i);
    }
    expect(players(room).every((p) => !p.isBot)).toBe(true);
    await expect(colyseus.connectTo(room, { name: "Thừa" })).rejects.toBeDefined();
  }, 30_000);
});
