import {
  type AnswerResultPayload,
  BRAIN_TEST_COUNTDOWN_MS,
  BRAIN_TEST_DIFFICULTY,
  BRAIN_TEST_GAME_COUNT,
  BRAIN_TEST_GAME_RESULT_MS,
  BRAIN_TEST_IDLE_CLOSE_CODE,
  BRAIN_TEST_INTRO_IDLE_MS,
  BRAIN_TEST_ROOM_NAME,
  BRAIN_TEST_RULES_VERSION,
  BrainClientMessage,
  type BrainGameView,
  type BrainJoinOptions,
  type BrainStateView,
  brainTestDurationMs,
  CATEGORIES,
  type ClosingPayload,
  computeBrainResult,
  type Difficulty,
  type ErrorPayload,
  type GameId,
  getGame,
  LATE_ANSWER_GRACE_MS,
  type RoundStartPayload,
  ServerMessage,
  WRONG_ANSWER_LOCK_MS,
} from "@brain-rizz/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { BrainTestRoom } from "../src/rooms/BrainTestRoom";
import {
  MemoryResultStore,
  NoopResultStore,
  type ResultStore,
  setResultStore,
} from "../src/store/ResultStore";
import {
  advance,
  bootOnFreePort,
  connectTo,
  freezeNow,
  ignoreServerMessages,
  nextMessage,
  SOLVE,
  settle,
  type TestServer,
  until,
  wrongAnswer,
} from "./helpers";

let colyseus: TestServer;

const TOKEN = "jwt-hop-le-cua-an";
const USER_ID = "00000000-0000-0000-0000-00000000000a";

// ------------------------------------------------------------------ helpers

/** Tạo phòng Kiểm tra não với `store`, rồi vào phòng bằng join options. */
async function start(store: ResultStore, opts: Partial<BrainJoinOptions> = {}) {
  setResultStore(store);
  const room = (await colyseus.createRoom(BRAIN_TEST_ROOM_NAME, {})) as BrainTestRoom;
  const client = await connectTo(colyseus, room, { name: "An", ...opts });
  return { room, client };
}
type TestClient = Awaited<ReturnType<typeof start>>["client"];

function current(room: BrainTestRoom) {
  const game = room.state.games[room.state.round - 1];
  if (!game) throw new Error("Không có game hiện tại");
  return { game, id: game.gameId as GameId };
}

/** intro → (brainReady) → countdown → (tua 3 giây) → playing. */
async function readyToPlaying(room: BrainTestRoom, client: TestClient) {
  expect(room.state.phase).toBe("intro");
  client.send(BrainClientMessage.Ready, {});
  await until(() => room.state.phase === "countdown");
  advance(room, BRAIN_TEST_COUNTDOWN_MS);
  expect(room.state.phase).toBe("playing");
}

/** Trả lời câu đang làm, chờ kết quả. */
async function answer(room: BrainTestRoom, client: TestClient, correct: boolean) {
  const { id } = current(room);
  const { seed, progress, round } = room.state;
  const d = BRAIN_TEST_DIFFICULTY as Difficulty;
  const value = correct ? SOLVE[id](seed, progress, d) : wrongAnswer(id, seed, progress, d);
  const result = nextMessage<AnswerResultPayload>(client, ServerMessage.AnswerResult);
  client.send(BrainClientMessage.Answer, { round, index: progress, answer: value });
  return result;
}

/** Hết giờ game hiện tại → game-result → (tua) → game kế / finished. */
function finishGame(room: BrainTestRoom) {
  advance(room, brainTestDurationMs(current(room).id) + LATE_ANSWER_GRACE_MS);
  expect(room.state.phase).toBe("game-result");
  advance(room, BRAIN_TEST_GAME_RESULT_MS);
}

/** Chơi đủ 5 game, mỗi game trả lời đúng 1 câu. */
async function playAll(room: BrainTestRoom, client: TestClient) {
  for (let i = 0; i < BRAIN_TEST_GAME_COUNT; i++) {
    await readyToPlaying(room, client);
    expect((await answer(room, client, true)).correct).toBe(true);
    finishGame(room);
  }
  expect(room.state.phase).toBe("finished");
}

async function expectError(client: TestClient, code: ErrorPayload["code"], send: () => void) {
  const error = nextMessage<ErrorPayload>(client, ServerMessage.Error);
  send();
  expect((await error).code).toBe(code);
}

/** Chờ server xử lý hết các tin đã gửi trước đó (tin của một máy được xử lý theo thứ tự). */
async function barrier(client: TestClient) {
  const pong = nextMessage(client, ServerMessage.Pong);
  client.send(BrainClientMessage.Ping, { clientTime: 0 });
  await pong;
}

const isConnected = (room: BrainTestRoom) => (room as unknown as { connected: boolean }).connected;

/** Rớt mạng (không chủ ý) rồi nối lại bằng reconnection token. */
async function drop(room: BrainTestRoom, client: TestClient) {
  const token = client.reconnectionToken;
  client.reconnection.enabled = false;
  await client.leave(false);
  await until(() => !isConnected(room));
  return async () => {
    const back = ignoreServerMessages(
      (await colyseus.sdk.reconnect(token)) as unknown as TestClient,
    );
    await until(() => isConnected(room));
    return back;
  };
}

// ------------------------------------------------------------------ tests

describe("BrainTestRoom", () => {
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

  it("state khớp hình dạng BrainStateView / BrainGameView (bất biến 5); 5 game, mỗi nhóm một game", async () => {
    const ROOM_KEYS = {
      phase: true,
      name: true,
      avatar: true,
      difficulty: true,
      games: true,
      round: true,
      gameId: true,
      seed: true,
      startAt: true,
      endsAt: true,
      resultEndsAt: true,
      progress: true,
      streak: true,
      brainScore: true,
      skills: true,
      saveStatus: true,
      chalkEarned: true,
    } satisfies Record<keyof BrainStateView, true>;
    const GAME_KEYS = {
      gameId: true,
      category: true,
      score: true,
      correct: true,
    } satisfies Record<keyof BrainGameView, true>;

    const { room } = await start(new NoopResultStore(), { avatar: "mochi" });
    const json = room.state.toJSON() as unknown as BrainStateView;
    expect(Object.keys(json).sort()).toEqual(Object.keys(ROOM_KEYS).sort());
    expect(Object.keys(json.games[0] ?? {}).sort()).toEqual(Object.keys(GAME_KEYS).sort());

    expect(json.games).toHaveLength(BRAIN_TEST_GAME_COUNT);
    expect(json.games.map((g) => g.category)).toEqual([...CATEGORIES]);
    for (const g of json.games) expect(getGame(g.gameId).category).toBe(g.category);
    expect(json).toMatchObject({
      phase: "intro",
      name: "An",
      avatar: "mochi",
      difficulty: BRAIN_TEST_DIFFICULTY,
      round: 1,
      gameId: json.games[0]?.gameId,
      seed: 0,
      brainScore: 0,
      skills: {},
      saveStatus: "no-db",
      chalkEarned: 0,
    });
  });

  it("đủ 5 game: đếm ngược, chấm đúng/sai, khoá khi sai, hết giờ đúng mốc, tạm kết quả, Điểm Não", async () => {
    const store = new MemoryResultStore(new Map([[TOKEN, USER_ID]]));
    const { room, client } = await start(store, { accessToken: TOKEN });
    const seeds = new Set<number>();
    // Giờ server giả: mỗi câu cách nhau 1,1 giây (dưới mức chống spam), khoá sau câu sai hết hạn đúng lúc.
    const clock = freezeNow();
    const tick = () => clock.set(clock.get() + 1_100);
    try {
      for (let i = 0; i < BRAIN_TEST_GAME_COUNT; i++) {
        const round = i + 1;
        const { game, id } = current(room);
        expect(room.state.round).toBe(round);
        expect(room.state.gameId).toBe(id);
        expect(room.state.progress).toBe(0);
        expect(room.state.streak).toBe(0);

        const started = nextMessage<RoundStartPayload>(client, ServerMessage.RoundStart);
        client.send(BrainClientMessage.Ready, {});
        const payload = await started;
        expect(room.state.phase).toBe("countdown");
        expect(payload).toEqual({
          round,
          gameId: id,
          seed: room.state.seed,
          startAt: room.state.startAt,
          durationMs: brainTestDurationMs(id),
        });
        expect(room.state.endsAt - room.state.startAt).toBe(brainTestDurationMs(id));
        seeds.add(room.state.seed);

        clock.set(room.state.startAt);
        // Trả lời khi chưa vào playing: bị bỏ qua.
        client.send(BrainClientMessage.Answer, { round, index: 0, answer: 0 });
        await barrier(client);
        advance(room, BRAIN_TEST_COUNTDOWN_MS);
        expect(room.state.phase).toBe("playing");
        expect(room.state.progress).toBe(0);

        // Đúng 2 câu → chuỗi 2; sai 1 câu → chuỗi 0, bị khoá, vẫn sang câu kế.
        tick();
        const first = await answer(room, client, true);
        expect(first).toMatchObject({ index: 0, correct: true });
        expect(first.points).toBeGreaterThan(0);
        tick();
        const second = await answer(room, client, true);
        expect(second.correct).toBe(true);
        expect(room.state.streak).toBe(2);
        tick();
        const wrong = await answer(room, client, false);
        expect(wrong).toMatchObject({ index: 2, correct: false, points: 0 });
        expect(wrong.lockedUntil).toBe(clock.get() + WRONG_ANSWER_LOCK_MS);
        expect(room.state.streak).toBe(0);
        expect(room.state.progress).toBe(3);
        expect(game.score).toBe(first.points + second.points);
        expect(game.correct).toBe(2);

        // Hết giờ đúng mốc của game: 100 ms trước vẫn chơi, 100 ms sau sang game-result.
        const end = room.clock.delayed.find((d) => d.active);
        if (!end) throw new Error("Không còn hẹn giờ hết game");
        expect(end.time).toBe(brainTestDurationMs(id) + LATE_ANSWER_GRACE_MS);
        advance(room, end.time - end.elapsedTime - 100);
        expect(room.state.phase).toBe("playing");
        advance(room, 200);
        expect(room.state.phase).toBe("game-result");
        expect(room.state.resultEndsAt).toBeGreaterThan(0);

        // Đáp án đến sau khi hết game: bị bỏ qua, điểm giữ nguyên.
        clock.set(room.state.endsAt + LATE_ANSWER_GRACE_MS + 1);
        client.send(BrainClientMessage.Answer, { round, index: 3, answer: SOLVE[id](0, 3, 1) });
        await barrier(client);
        expect(game.correct).toBe(2);

        advance(room, BRAIN_TEST_GAME_RESULT_MS);
      }
    } finally {
      clock.restore();
    }

    expect(room.state.phase).toBe("finished");
    expect(seeds.size).toBe(BRAIN_TEST_GAME_COUNT);
    const expected = computeBrainResult(
      room.state.games.map((g) => ({
        gameId: g.gameId as GameId,
        score: g.score,
        correct: g.correct,
      })),
    );
    expect(room.state.brainScore).toBe(expected.brainScore);
    expect(room.state.skills.toJSON()).toEqual(expected.skills);

    await until(() => room.state.saveStatus === "saved");
    expect(store.brainTests).toHaveLength(1);
    expect(store.brainTests[0]).toEqual({
      userId: USER_ID,
      brainScore: expected.brainScore,
      difficulty: BRAIN_TEST_DIFFICULTY,
      rulesVersion: BRAIN_TEST_RULES_VERSION,
      skills: expected.skills,
      games: room.state.games.map((g) => ({
        gameId: g.gameId,
        category: g.category,
        score: g.score,
        correct: g.correct,
      })),
    });

    // Token không bao giờ nằm trong state.
    expect(JSON.stringify(room.state.toJSON())).not.toContain(TOKEN);
    expect(JSON.stringify(room.state.toJSON())).not.toContain(USER_ID);
  }, 30_000);

  it("không gửi token → guest ngay từ đầu, không lưu", async () => {
    const store = new MemoryResultStore(new Map([[TOKEN, USER_ID]]));
    const { room, client } = await start(store);
    expect(room.state.saveStatus).toBe("guest");
    await playAll(room, client);
    await settle();
    expect(room.state.saveStatus).toBe("guest");
    expect(store.brainTests).toEqual([]);
  });

  it("token sai, hoặc sai kiểu / quá dài (bị bỏ): vẫn chơi được, guest", async () => {
    const store = new MemoryResultStore(new Map([[TOKEN, USER_ID]]));
    for (const accessToken of ["sai-token", 42, "x".repeat(5_000)]) {
      const { room, client } = await start(store, { accessToken } as Partial<BrainJoinOptions>);
      await until(() => room.state.saveStatus === "guest");
      await readyToPlaying(room, client);
      await client.leave();
    }
    expect(store.brainTests).toEqual([]);
  });

  it("thiếu máy chủ dữ liệu → no-db, vẫn chơi hết và có Điểm Não", async () => {
    const { room, client } = await start(new NoopResultStore(), { accessToken: TOKEN });
    await playAll(room, client);
    await settle();
    expect(room.state.saveStatus).toBe("no-db");
    expect(room.state.brainScore).toBeGreaterThan(0);
  });

  it("ghi lỗi → failed", async () => {
    const store = new MemoryResultStore(new Map([[TOKEN, USER_ID]]));
    store.failWrites = true;
    const { room, client } = await start(store, { accessToken: TOKEN });
    await playAll(room, client);
    await until(() => room.state.saveStatus === "failed");
  });

  it("thoát giữa chừng: huỷ lượt, không lưu", async () => {
    const store = new MemoryResultStore(new Map([[TOKEN, USER_ID]]));
    const { room, client } = await start(store, { accessToken: TOKEN });
    await readyToPlaying(room, client);
    await answer(room, client, true);
    finishGame(room);
    await readyToPlaying(room, client);
    await client.leave();
    await settle();
    expect(store.brainTests).toEqual([]);
  });

  it("chờ quá lâu ở intro (cả game đầu lẫn game sau): huỷ lượt, báo tin closing rồi đóng phòng với mã riêng, không lưu", async () => {
    const store = new MemoryResultStore(new Map([[TOKEN, USER_ID]]));
    const { room, client } = await start(store, { accessToken: TOKEN });

    // Game 1: gần hết hạn vẫn ở intro, bấm Sẵn sàng là huỷ hẹn giờ chờ.
    advance(room, BRAIN_TEST_INTRO_IDLE_MS - 1_000);
    expect(room.state.phase).toBe("intro");
    await readyToPlaying(room, client);
    // Chỉ còn hẹn giờ hết game.
    expect(room.clock.delayed.filter((d) => d.active).map((d) => d.time)).toEqual([
      brainTestDurationMs(current(room).id) + LATE_ANSWER_GRACE_MS,
    ]);
    finishGame(room);

    // Game 2: không bấm Sẵn sàng → hết hạn thì phòng đóng. Trước khung đóng có tin `closing` cùng mã
    // (qua Render khung đóng không tới trình duyệt, client dựa vào tin này).
    expect(room.state.phase).toBe("intro");
    expect(room.state.round).toBe(2);
    const events: unknown[] = [];
    client.onMessage(ServerMessage.Closing, (msg: ClosingPayload) => events.push(msg));
    const closed = new Promise<number>((resolve) =>
      client.onLeave((code) => {
        events.push(`leave ${code}`);
        resolve(code);
      }),
    );
    advance(room, BRAIN_TEST_INTRO_IDLE_MS);
    expect(await closed).toBe(BRAIN_TEST_IDLE_CLOSE_CODE);
    expect(events).toEqual([
      { code: BRAIN_TEST_IDLE_CLOSE_CODE },
      `leave ${BRAIN_TEST_IDLE_CLOSE_CODE}`,
    ]);
    await settle();
    expect(store.brainTests).toEqual([]);
  });

  it("rớt mạng giữa game: giữ chỗ, đồng hồ vẫn chạy, nối lại chơi tiếp được", async () => {
    const store = new MemoryResultStore(new Map([[TOKEN, USER_ID]]));
    const { room, client } = await start(store, { accessToken: TOKEN });
    await readyToPlaying(room, client);
    await answer(room, client, true);
    const reconnect = await drop(room, client);
    expect(room.state.phase).toBe("playing");
    const back = await reconnect();
    expect(room.state.progress).toBe(1);
    expect((await answer(room, back, true)).index).toBe(1);
    expect(current(room).game.correct).toBe(2);
  });

  it("xong lượt lúc đang rớt mạng: chỉ lưu khi nối lại kịp", async () => {
    const store = new MemoryResultStore(new Map([[TOKEN, USER_ID]]));
    const { room, client } = await start(store, { accessToken: TOKEN });
    for (let i = 0; i < BRAIN_TEST_GAME_COUNT - 1; i++) {
      await readyToPlaying(room, client);
      finishGame(room);
    }
    await readyToPlaying(room, client);
    const reconnect = await drop(room, client);
    finishGame(room);
    expect(room.state.phase).toBe("finished");
    await settle();
    expect(store.brainTests).toEqual([]);
    expect(room.state.saveStatus).toBe("pending");

    await reconnect();
    await until(() => room.state.saveStatus === "saved");
    expect(store.brainTests).toHaveLength(1);
  });

  it("tin nhắn sai schema (invalid), sai pha (bad-phase); tên sai bị từ chối; chỉ một người", async () => {
    const { room, client } = await start(new NoopResultStore());
    await expectError(client, "invalid", () => client.send(BrainClientMessage.Ready, "now"));
    await expectError(client, "invalid", () =>
      client.send(BrainClientMessage.Answer, { round: "1", index: 0, answer: 0 }),
    );
    await expectError(client, "invalid", () => client.send(BrainClientMessage.Answer, {}));
    expect(room.state.phase).toBe("intro");

    client.send(BrainClientMessage.Ready, {});
    await until(() => room.state.phase === "countdown");
    await expectError(client, "bad-phase", () => client.send(BrainClientMessage.Ready, {}));
    expect(room.state.phase).toBe("countdown");

    // Phòng một người: không ai vào thêm được.
    await expect(colyseus.connectTo(room, { name: "Bình" })).rejects.toBeDefined();

    const other = await colyseus.createRoom(BRAIN_TEST_ROOM_NAME, {});
    await expect(colyseus.connectTo(other, { name: "" })).rejects.toBeDefined();
  });
});
