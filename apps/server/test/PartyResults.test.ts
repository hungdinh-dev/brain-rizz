import {
  type AnswerResultPayload,
  ClientMessage,
  COUNTDOWN_MS,
  type Difficulty,
  type GameId,
  getGame,
  type JoinOptions,
  LATE_ANSWER_GRACE_MS,
  ROOM_NAME,
  ServerMessage,
} from "@brain-rizz/shared";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import appConfig from "../src/app.config";
import type { PartyRoom } from "../src/rooms/PartyRoom";
import { MemoryResultStore, NoopResultStore, setResultStore } from "../src/store/ResultStore";
import {
  advance,
  connectTo,
  ignoreServerMessages,
  nextMessage,
  SOLVE,
  settle,
  until,
} from "./helpers";

/** Ghi kết quả trận party vào tài khoản (FR-MR-10, ADR 0011). */

let colyseus: ColyseusTestServer<typeof appConfig>;

const TOKEN_A = "jwt-cua-an";
const TOKEN_C = "jwt-cua-chi";
const USER_A = "00000000-0000-0000-0000-00000000000a";
const USER_C = "00000000-0000-0000-0000-00000000000c";

async function join(room: PartyRoom, name: string, opts: Partial<JoinOptions> = {}) {
  return connectTo(colyseus, room, { name, ...opts });
}
type TestClient = Awaited<ReturnType<typeof join>>;

const players = (room: PartyRoom) => [...room.state.players.values()];

/** Chơi một vòng game `gameId`: `scorers` mỗi người trả lời đúng `n` câu, rồi hết giờ → round-results. */
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
  await until(() => players(room).every((p) => p.isHost || p.introReady));
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

/** Giả lập tải lại trang: rớt kết nối rồi nối lại bằng reconnection token. */
async function reload(room: PartyRoom, client: TestClient): Promise<TestClient> {
  const id = client.sessionId;
  const token = client.reconnectionToken;
  client.reconnection.enabled = false;
  await client.leave(false);
  await until(() => room.state.players.get(id)?.connected === false);
  const back = ignoreServerMessages((await colyseus.sdk.reconnect(token)) as unknown as TestClient);
  await until(() => room.state.players.get(id)?.connected === true);
  return back;
}

describe("PartyRoom — kết quả trận", () => {
  beforeAll(async () => {
    colyseus = await boot(appConfig);
  });
  afterAll(async () => {
    setResultStore(new NoopResultStore());
    await colyseus.shutdown();
  });
  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it("ghi match_results đúng một lần khi vào podium, chỉ cho người có token hợp lệ; chơi lại thì trận mới ghi tiếp", async () => {
    const store = new MemoryResultStore(
      new Map([
        [TOKEN_A, USER_A],
        [TOKEN_C, USER_C],
      ]),
    );
    setResultStore(store);
    const room = (await colyseus.createRoom(ROOM_NAME, {})) as PartyRoom;
    let a = await join(room, "An", { accessToken: TOKEN_A });
    const b = await join(room, "Bình", { accessToken: "token-sai" });
    const c = await join(room, "Chi", { accessToken: TOKEN_C });
    const d = await join(room, "Dũng");
    const clients = () => [a, b, c, d];

    // Token không bao giờ nằm trong state.
    const json = JSON.stringify(room.state.toJSON());
    for (const secret of [TOKEN_A, TOKEN_C, USER_A, USER_C, "token-sai"]) {
      expect(json).not.toContain(secret);
    }

    a.send(ClientMessage.SetRounds, { totalRounds: 2 });
    await until(() => room.state.totalRounds === 2);
    for (const cl of clients()) cl.send(ClientMessage.Ready, { ready: true });
    await until(() => players(room).every((p) => p.ready));
    a.send(ClientMessage.StartMatch, {});
    await until(() => room.state.phase === "game-select");

    // Vòng 1: Chi nhất (2 câu), An nhì (1 câu). Vòng 2 chưa xong thì chưa ghi gì.
    await playRound(room, clients(), "odd-one-out", [
      [c, 2],
      [a, 1],
    ]);
    a.send(ClientMessage.NextRound, {});
    await until(() => room.state.phase === "game-select");
    // An tải lại trang giữa trận: user_id vẫn giữ.
    a = await reload(room, a);
    await playRound(room, clients(), "rotate-match", [[c, 1]]);
    await settle();
    expect(store.matchResults).toEqual([]);

    a.send(ClientMessage.NextRound, {});
    await until(() => room.state.phase === "podium");
    await until(() => store.matchResults.length === 1);
    const rows = store.matchResults[0] ?? [];
    const pa = room.state.players.get(a.sessionId);
    const pc = room.state.players.get(c.sessionId);
    const cats = (pl: typeof pa) => Object.fromEntries(pl?.categoryScores.entries() ?? []);
    // Vòng 1 odd-one-out (identify): Chi 2 câu, An 1 câu; vòng 2 rotate-match (visualize): Chi 1 câu.
    expect(Object.keys(cats(pa))).toEqual(["identify", "visualize"]);
    expect(cats(pa).visualize).toBe(0);
    expect(rows).toEqual([
      {
        userId: USER_C,
        roomCode: room.state.code,
        placement: 0,
        players: 4,
        botCount: 0,
        matchPoints: pc?.matchPoints,
        totalScore: pc?.totalScore,
        rounds: 2,
        games: ["odd-one-out", "rotate-match"],
        categoryScores: cats(pc),
        // Chi dẫn đầu cả hai thể loại (CR-010).
        categoryTitles: ["identify", "visualize"],
        // Chưa cấu hình party (CR-019): version 0.
        settingsVersion: 0,
      },
      {
        userId: USER_A,
        roomCode: room.state.code,
        placement: 1,
        players: 4,
        botCount: 0,
        matchPoints: pa?.matchPoints,
        totalScore: pa?.totalScore,
        rounds: 2,
        games: ["odd-one-out", "rotate-match"],
        categoryScores: cats(pa),
        categoryTitles: [],
        settingsVersion: 0,
      },
    ]);
    await settle();
    expect(store.matchResults).toHaveLength(1);

    // Chơi lại: trận mới (giữ 2 vòng), vào podium lần nữa thì ghi thêm đúng một lần.
    a.send(ClientMessage.PlayAgain, {});
    await until(() => room.state.phase === "game-select");
    await playRound(room, clients(), "odd-one-out", [[a, 1]]);
    a.send(ClientMessage.NextRound, {});
    await until(() => room.state.phase === "game-select");
    await playRound(room, clients(), "balance", []);
    a.send(ClientMessage.NextRound, {});
    await until(() => room.state.phase === "podium");
    await until(() => store.matchResults.length === 2);
    expect(store.matchResults[1]?.map((r) => r.games)).toEqual([
      ["odd-one-out", "balance"],
      ["odd-one-out", "balance"],
    ]);
    expect(store.matchResults[1]?.map((r) => [r.userId, r.placement])).toEqual([
      [USER_A, 0],
      [USER_C, 1],
    ]);
    // Trận mới tính lại từ đầu: An giành identify; balance (analyze) không ai có điểm → không ai nhận.
    expect(store.matchResults[1]?.map((r) => [r.categoryTitles, r.categoryScores.analyze])).toEqual(
      [
        [["identify"], 0],
        [[], 0],
      ],
    );
    expect(store.matchResults[1]?.[1]?.categoryScores.identify).toBe(0);
  }, 30_000);

  it("trận có bot: players tính cả bot, botCount = số bot, bot không có dòng riêng (CR-016)", async () => {
    const store = new MemoryResultStore(new Map([[TOKEN_A, USER_A]]));
    setResultStore(store);
    const room = (await colyseus.createRoom(ROOM_NAME, {
      bots: { count: 2, level: 1 },
    })) as PartyRoom;
    const a = await join(room, "An", { accessToken: TOKEN_A });
    expect(players(room).filter((p) => p.isBot)).toHaveLength(2);
    a.send(ClientMessage.SetRounds, { totalRounds: 1 });
    await until(() => room.state.totalRounds === 1);
    a.send(ClientMessage.Ready, { ready: true });
    await until(() => players(room).every((p) => p.ready));
    a.send(ClientMessage.StartMatch, {});
    await until(() => room.state.phase === "game-select");
    await playRound(room, [a], "odd-one-out", [[a, 1]]);
    a.send(ClientMessage.NextRound, {});
    await until(() => room.state.phase === "podium");
    await until(() => store.matchResults.length === 1);
    expect(store.matchResults[0]?.map((r) => [r.userId, r.players, r.botCount])).toEqual([
      [USER_A, 3, 2],
    ]);
  });

  it("ghi lỗi chỉ log, trận vẫn chạy; không có máy chủ dữ liệu thì bỏ qua", async () => {
    const store = new MemoryResultStore(new Map([[TOKEN_A, USER_A]]));
    store.failWrites = true;
    setResultStore(store);
    const room = (await colyseus.createRoom(ROOM_NAME, {})) as PartyRoom;
    const a = await join(room, "An", { accessToken: TOKEN_A });
    const b = await join(room, "Bình");
    a.send(ClientMessage.SetRounds, { totalRounds: 1 });
    await until(() => room.state.totalRounds === 1);
    for (const cl of [a, b]) cl.send(ClientMessage.Ready, { ready: true });
    await until(() => players(room).every((p) => p.ready));
    a.send(ClientMessage.StartMatch, {});
    await until(() => room.state.phase === "game-select");
    await playRound(room, [a, b], "odd-one-out", [[a, 1]]);
    a.send(ClientMessage.NextRound, {});
    await until(() => room.state.phase === "podium");
    await settle();
    expect(store.matchResults).toEqual([]);
    // Phòng vẫn dùng tiếp được.
    a.send(ClientMessage.BackToLobby, {});
    await until(() => room.state.phase === "lobby");
  });
});
