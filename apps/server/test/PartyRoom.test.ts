import {
  AIM_TRAINER_MISS,
  type AnswerResultPayload,
  type AnyMinigame,
  availableGames,
  ClientMessage,
  COUNTDOWN_MS,
  DEFAULT_SCORING,
  type Difficulty,
  type ErrorPayload,
  GAME_IDS,
  GAMES,
  type GameId,
  getGame,
  INTRO_AUTO_START_MS,
  type JoinOptions,
  LATE_ANSWER_GRACE_MS,
  MAX_TOTAL_ROUNDS,
  MIN_PLAYERS_TO_START,
  NUDGE_COOLDOWN_MS,
  type NudgePayload,
  type PartyStateView,
  type PlayerView,
  parseScoringJson,
  pourLineLevelAt,
  type RhythmEchoHit,
  ROOM_NAME,
  type RoundStartPayload,
  ServerMessage,
  WHEEL_RESULT_HOLD_MS,
  WHEEL_SPIN_LEAD_MS,
  WHEEL_SPIN_MS,
  WRONG_ANSWER_LOCK_MS,
} from "@brain-rizz/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TRANSPORT_PING_INTERVAL_MS, TRANSPORT_PING_MAX_RETRIES } from "../src/app.config";
import type { PartyRoom } from "../src/rooms/PartyRoom";
import { bootOnFreePort, connectTo, ignoreServerMessages, SOLVE, type TestServer } from "./helpers";

let colyseus: TestServer;

// ------------------------------------------------------------------ helpers

async function join(room: PartyRoom, name: string, opts: Partial<JoinOptions> = {}) {
  // Gắn handler trước khi chờ state để SDK không cảnh báo tin chưa có handler (vd. chatHistory).
  return connectTo(colyseus, room, { name, ...opts });
}
type TestClient = Awaited<ReturnType<typeof join>>;
type ClientMessageType = (typeof ClientMessage)[keyof typeof ClientMessage];

/** Tạo phòng với danh sách người chơi; người đầu tiên là chủ phòng. */
async function setup(names: string[], opts: Partial<JoinOptions>[] = []) {
  const room = (await colyseus.createRoom(ROOM_NAME, {})) as PartyRoom;
  const clients: TestClient[] = [];
  for (const [i, name] of names.entries()) clients.push(await join(room, name, opts[i]));
  return { room, clients, host: clients[0] as TestClient };
}

/** Chờ tới khi điều kiện trên state của server đúng (tin nhắn từ client tới không đồng bộ). */
async function until(check: () => boolean, timeoutMs = 3_000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error("Hết thời gian chờ điều kiện");
    await new Promise((r) => setTimeout(r, 5));
  }
}

function nextMessage<T>(client: TestClient, type: string, timeoutMs = 3_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(new Error(`Không nhận được tin ${type}`));
    }, timeoutMs);
    const off = client.onMessage(type, (msg: T) => {
      clearTimeout(timer);
      off();
      resolve(msg);
    });
  });
}

/** Gửi một tin và chờ server trả lỗi đúng mã. */
async function expectError(client: TestClient, code: ErrorPayload["code"], send: () => void) {
  const error = nextMessage<ErrorPayload>(client, ServerMessage.Error);
  send();
  expect((await error).code).toBe(code);
}

/** Tua nhanh đồng hồ của room (mọi hẹn giờ đang chờ) thêm `ms` rồi chạy những hẹn giờ đã tới hạn. */
function advance(room: PartyRoom, ms: number) {
  for (const d of room.clock.delayed) d.elapsedTime += ms;
  room.clock.tick();
}

function player(room: PartyRoom, client: TestClient) {
  const p = room.state.players.get(client.sessionId);
  if (!p) throw new Error("Không thấy người chơi");
  return p;
}

const players = (room: PartyRoom) => [...room.state.players.values()];

async function toGameSelect(room: PartyRoom, clients: TestClient[]) {
  for (const c of clients) c.send(ClientMessage.Ready, { ready: true });
  await until(() => players(room).every((p) => p.ready));
  clients[0]?.send(ClientMessage.StartMatch, {});
  await until(() => room.state.phase === "game-select");
}

async function toGameIntro(room: PartyRoom, clients: TestClient[]) {
  await toGameSelect(room, clients);
  clients[0]?.send(ClientMessage.PickGame, { gameId: "odd-one-out" });
  await until(() => room.state.phase === "game-intro");
}

/** Từ game-intro: mọi người bấm Đã hiểu, chủ phòng bắt đầu, tua hết đếm ngược. */
async function introToPlaying(room: PartyRoom, clients: TestClient[]) {
  for (const c of clients.slice(1)) c.send(ClientMessage.IntroReady, { ready: true });
  await until(() => players(room).every((p) => p.isHost || p.introReady));
  clients[0]?.send(ClientMessage.StartRound, {});
  await until(() => room.state.phase === "countdown");
  advance(room, COUNTDOWN_MS);
  expect(room.state.phase).toBe("playing");
}

async function toPlaying(room: PartyRoom, clients: TestClient[]) {
  await toGameIntro(room, clients);
  await introToPlaying(room, clients);
}

/** Tua hết giờ vòng đang chơi (theo thời lượng của chính game vòng này). */
function finishRound(room: PartyRoom) {
  advance(room, getGame(room.state.gameId as GameId).durationMs + LATE_ANSWER_GRACE_MS);
}

/** Số hẹn giờ còn hiệu lực trên đồng hồ của room. */
function activeTimers(room: PartyRoom) {
  return room.clock.delayed.filter((d) => d.active).length;
}

/**
 * Giả lập tải lại trang: đóng kết nối không chủ ý (server giữ chỗ, `connected = false`),
 * rồi nối lại bằng reconnection token như `resumeParty()` của web.
 */
async function reload(room: PartyRoom, client: TestClient): Promise<TestClient> {
  const id = client.sessionId;
  const token = client.reconnectionToken;
  // SDK tự nối lại chỉ khi phòng đã sống ≥ 5 giây; ở đây tắt đi và nối tay cho nhanh, tất định.
  client.reconnection.enabled = false;
  await client.leave(false);
  await until(() => room.state.players.get(id)?.connected === false);
  const back = ignoreServerMessages((await colyseus.sdk.reconnect(token)) as unknown as TestClient);
  await until(() => room.state.players.get(id)?.connected === true);
  return back;
}

async function answerCorrectly(room: PartyRoom, client: TestClient) {
  const p = player(room, client);
  const puzzle = getGame("odd-one-out").generate(
    room.state.seed,
    p.progress,
    p.difficulty as 0 | 1 | 2 | 3,
  );
  const result = nextMessage<AnswerResultPayload>(client, ServerMessage.AnswerResult);
  client.send(ClientMessage.Answer, {
    round: room.state.round,
    index: p.progress,
    answer: puzzle.oddIndex,
  });
  return result;
}

// ------------------------------------------------------------------ tests

describe("PartyRoom", () => {
  beforeAll(async () => {
    colyseus = await bootOnFreePort();
  });
  afterAll(async () => {
    await colyseus.shutdown();
  });
  beforeEach(async () => {
    await colyseus.cleanup();
  });

  describe("phòng chờ", () => {
    it("tạo phòng với mã 4 ký tự, người đầu tiên là chủ phòng", async () => {
      const { room, clients } = await setup(["An", "Bình"]);
      const [a, b] = clients as [TestClient, TestClient];

      expect(room.roomId).toMatch(/^[A-Z2-9]{4}$/);
      expect(room.state.code).toBe(room.roomId);
      expect(room.state.hostId).toBe(a.sessionId);
      expect(room.state.players.get(b.sessionId)?.isHost).toBe(false);
    });

    it("state khớp hình dạng PartyStateView / PlayerView (bất biến 5)", async () => {
      const ROOM_KEYS = {
        code: true,
        phase: true,
        hostId: true,
        gameId: true,
        round: true,
        totalRounds: true,
        seed: true,
        startAt: true,
        endsAt: true,
        pickMode: true,
        votes: true,
        playedGames: true,
        wheelGameId: true,
        wheelSpinAt: true,
        wheelSpinMs: true,
        introEndsAt: true,
        chatEnabled: true,
        disabledGames: true,
        scoringJson: true,
        configVersion: true,
        players: true,
      } satisfies Record<keyof PartyStateView, true>;
      const PLAYER_KEYS = {
        id: true,
        name: true,
        colorIndex: true,
        avatar: true,
        accessories: true,
        difficulty: true,
        ready: true,
        introReady: true,
        connected: true,
        isHost: true,
        matchPoints: true,
        lastPoints: true,
        totalScore: true,
        categoryScores: true,
        roundScore: true,
        roundCorrect: true,
        progress: true,
        streak: true,
        isBot: true,
        botLevel: true,
      } satisfies Record<keyof PlayerView, true>;

      const { room, host } = await setup(["An"]);
      const json = room.state.toJSON() as unknown as PartyStateView;
      expect(Object.keys(json).sort()).toEqual(Object.keys(ROOM_KEYS).sort());
      expect(Object.keys(json.players[host.sessionId] ?? {}).sort()).toEqual(
        Object.keys(PLAYER_KEYS).sort(),
      );
      // Người thật: không phải bot, mức 0 (CR-016); chưa đeo phụ kiện (CR-023).
      expect(json.players[host.sessionId]).toMatchObject({
        isBot: false,
        botLevel: 0,
        accessories: [],
      });
      expect(json.pickMode).toBe("wheel");
      expect(json.votes).toEqual({});
      expect(json.playedGames).toEqual([]);
      expect(json.wheelGameId).toBe("");
      // Chưa cấu hình Supabase: cấu hình party mặc định (CR-019).
      expect(json.disabledGames).toEqual([]);
      expect(parseScoringJson(json.scoringJson)).toEqual(DEFAULT_SCORING);
      expect(json.configVersion).toBe(0);
    });

    it("từ chối tên không hợp lệ", async () => {
      const room = await colyseus.createRoom(ROOM_NAME, {});
      await expect(colyseus.connectTo(room, { name: "" })).rejects.toBeDefined();
    });

    it("lưu nhân vật khi vào phòng, mặc định khoi nếu không gửi", async () => {
      const { room, clients } = await setup(["An", "Bình"], [{ avatar: "mochi" }]);
      const [a, b] = clients as [TestClient, TestClient];
      expect(player(room, a).avatar).toBe("mochi");
      expect(player(room, b).avatar).toBe("khoi");
    });

    it("setProfile đổi nhân vật mà không reset màu/độ khó và không huỷ sẵn sàng", async () => {
      const { room, host } = await setup(["An"], [{ colorIndex: 3, difficulty: 2 }]);

      host.send(ClientMessage.Ready, { ready: true });
      host.send(ClientMessage.SetProfile, { avatar: "tron" });
      await until(() => player(room, host).avatar === "tron");
      const p = player(room, host);
      expect(p.colorIndex).toBe(3);
      expect(p.difficulty).toBe(2);
      expect(p.ready).toBe(true);

      // Đổi tên không làm reset nhân vật.
      host.send(ClientMessage.SetProfile, { name: "An mới" });
      await until(() => player(room, host).name === "An mới");
      expect(player(room, host).avatar).toBe("tron");
    });

    it("từ chối nhân vật lạ khi vào phòng và khi setProfile", async () => {
      const room = (await colyseus.createRoom(ROOM_NAME, {})) as PartyRoom;
      // Vào trước một người hợp lệ để phòng không tự huỷ khi lượt vào sai bị từ chối.
      const b = await join(room, "Bình", { avatar: "cam" });
      await expect(
        colyseus.connectTo(room, { name: "An", avatar: "dragon" }),
      ).rejects.toBeDefined();
      expect(room.state.players.size).toBe(1);

      await expectError(b, "invalid", () =>
        b.send(ClientMessage.SetProfile, { avatar: "dragon", name: "Hacker" }),
      );
      const p = player(room, b);
      expect(p.avatar).toBe("cam");
      expect(p.name).toBe("Bình");
    });

    it("chỉ chủ phòng đặt số vòng, trong khoảng 1–10", async () => {
      const { room, clients, host } = await setup(["An", "Bình"]);
      const guest = clients[1] as TestClient;

      host.send(ClientMessage.SetRounds, { totalRounds: 5 });
      await until(() => room.state.totalRounds === 5);
      await expectError(guest, "not-host", () =>
        guest.send(ClientMessage.SetRounds, { totalRounds: 2 }),
      );
      await expectError(host, "invalid", () =>
        host.send(ClientMessage.SetRounds, { totalRounds: 11 }),
      );
      expect(room.state.totalRounds).toBe(5);
    });

    it("không bắt đầu trận khi chưa đủ người hoặc chưa ai cũng sẵn sàng", async () => {
      // Một người: chưa đủ MIN_PLAYERS_TO_START.
      const solo = await setup(["An"]);
      solo.host.send(ClientMessage.Ready, { ready: true });
      await expectError(solo.host, "not-ready", () => solo.host.send(ClientMessage.StartMatch, {}));
      expect(solo.room.state.phase).toBe("lobby");

      // Hai người: khách sẵn sàng nhưng chủ phòng chưa.
      const { room, clients, host } = await setup(["Cúc", "Dũng"]);
      const guest = clients[1] as TestClient;
      guest.send(ClientMessage.Ready, { ready: true });
      await until(() => player(room, guest).ready);
      await expectError(host, "not-ready", () => host.send(ClientMessage.StartMatch, {}));
      await expectError(guest, "not-host", () => guest.send(ClientMessage.StartMatch, {}));
      expect(room.state.phase).toBe("lobby");

      // Đủ điều kiện → vào chọn game vòng 1.
      host.send(ClientMessage.Ready, { ready: true });
      await until(() => player(room, host).ready);
      host.send(ClientMessage.StartMatch);
      await until(() => room.state.phase === "game-select");
      expect(room.state.round).toBe(1);
      expect(room.state.pickMode).toBe("wheel");
    });
  });

  describe("chọn game", () => {
    it("chỉ chủ phòng đổi chế độ, quay và chọn game", async () => {
      const { room, clients } = await setup(["An", "Bình"]);
      const guest = clients[1] as TestClient;
      await toGameSelect(room, clients);

      await expectError(guest, "not-host", () =>
        guest.send(ClientMessage.SetPickMode, { mode: "pick" }),
      );
      await expectError(guest, "not-host", () => guest.send(ClientMessage.SpinWheel, {}));
      await expectError(guest, "not-host", () =>
        guest.send(ClientMessage.PickGame, { gameId: "odd-one-out" }),
      );
      expect(room.state.phase).toBe("game-select");
      expect(room.state.wheelGameId).toBe("");
    });

    it("vòng quay: server chọn kết quả, khoá thao tác khi đang quay, rồi tự vào game-intro", async () => {
      const { room, clients, host } = await setup(["An", "Bình"]);
      await toGameSelect(room, clients);

      const before = Date.now();
      host.send(ClientMessage.SpinWheel, {});
      await until(() => room.state.wheelGameId !== "");
      // Không gắn cứng id: khi có nhiều game, kết quả là một game bất kỳ còn trong vòng quay.
      const picked = room.state.wheelGameId;
      expect(GAME_IDS as readonly string[]).toContain(picked);
      expect(room.state.wheelSpinAt).toBeGreaterThanOrEqual(before + WHEEL_SPIN_LEAD_MS);
      expect(room.state.wheelSpinMs).toBe(WHEEL_SPIN_MS);

      await expectError(host, "bad-phase", () => host.send(ClientMessage.SpinWheel, {}));
      await expectError(host, "bad-phase", () =>
        host.send(ClientMessage.PickGame, { gameId: "odd-one-out" }),
      );
      await expectError(host, "bad-phase", () =>
        host.send(ClientMessage.SetPickMode, { mode: "pick" }),
      );

      const total = WHEEL_SPIN_LEAD_MS + WHEEL_SPIN_MS + WHEEL_RESULT_HOLD_MS;
      advance(room, total - 1_000);
      expect(room.state.phase).toBe("game-select");
      advance(room, 1_000);
      expect(room.state.phase).toBe("game-intro");
      expect(room.state.gameId).toBe(picked);
      expect(room.state.introEndsAt).toBeGreaterThan(Date.now());
    });

    it("bình chọn: mỗi người một phiếu, null là bỏ, chủ phòng không bầu, xoá khi bắt đầu vòng", async () => {
      const { room, clients, host } = await setup(["An", "Bình", "Cúc"]);
      const [, b, c] = clients as [TestClient, TestClient, TestClient];
      await toGameSelect(room, clients);

      host.send(ClientMessage.SetPickMode, { mode: "pick" });
      await until(() => room.state.pickMode === "pick");

      b.send(ClientMessage.VoteGame, { gameId: "odd-one-out" });
      c.send(ClientMessage.VoteGame, { gameId: "odd-one-out" });
      await until(() => room.state.votes.size === 2);
      expect(room.state.votes.get(b.sessionId)).toBe("odd-one-out");

      await expectError(host, "invalid", () =>
        host.send(ClientMessage.VoteGame, { gameId: "odd-one-out" }),
      );
      await expectError(b, "invalid", () => b.send(ClientMessage.VoteGame, { gameId: "tetris" }));

      c.send(ClientMessage.VoteGame, { gameId: null });
      await until(() => room.state.votes.size === 1);
      expect(room.state.votes.has(c.sessionId)).toBe(false);

      host.send(ClientMessage.PickGame, { gameId: "odd-one-out" });
      await until(() => room.state.phase === "game-intro");
      await introToPlaying(room, clients);
      expect(room.state.votes.size).toBe(0);
    });

    it("chủ phòng rời ở game-select: người nhận quyền mất phiếu và quay được", async () => {
      const { room, clients, host } = await setup(["An", "Bình", "Cúc"]);
      const [, b, c] = clients as [TestClient, TestClient, TestClient];
      await toGameSelect(room, clients);
      b.send(ClientMessage.VoteGame, { gameId: "odd-one-out" });
      c.send(ClientMessage.VoteGame, { gameId: "odd-one-out" });
      await until(() => room.state.votes.size === 2);

      await host.leave();
      await until(() => room.state.hostId === b.sessionId);
      expect(room.state.votes.has(b.sessionId)).toBe(false);
      expect(room.state.votes.has(c.sessionId)).toBe(true);

      b.send(ClientMessage.SpinWheel, {});
      await until(() => room.state.wheelGameId !== "");
    });

    it("không chọn/bầu game đã chơi; chơi hết game thì danh sách được làm mới", async () => {
      const { room, clients, host } = await setup(["An", "Bình"]);
      const guest = clients[1] as TestClient;
      // Số game có thể nhiều hơn số vòng tối đa của một trận: đánh dấu sẵn vài game là đã chơi, phần
      // còn lại chơi thật, rồi sang thêm một vòng (đúng với bất kỳ số game nào).
      const playable = Math.min(GAME_IDS.length, MAX_TOTAL_ROUNDS - 1);
      const preplayed = GAME_IDS.slice(0, GAME_IDS.length - playable);
      const rounds = playable + 1;
      host.send(ClientMessage.SetRounds, { totalRounds: rounds });
      await until(() => room.state.totalRounds === rounds);
      await toGameSelect(room, clients);
      for (const g of preplayed) room.state.playedGames.push(g);

      const seen: string[] = [...preplayed];
      for (let i = 0; i < playable; i++) {
        expect(room.state.round).toBe(i + 1);
        const played = [...room.state.playedGames];
        expect(played).toEqual(seen);
        // Game đã chơi bị từ chối (chỉ kiểm được khi đã có game chơi rồi mà chưa làm mới).
        const replay = played[0] as GameId | undefined;
        if (replay) {
          await expectError(host, "invalid", () =>
            host.send(ClientMessage.PickGame, { gameId: replay }),
          );
        }
        const next = availableGames(played)[0] as GameId;
        expect(seen).not.toContain(next);
        host.send(ClientMessage.PickGame, { gameId: next });
        await until(() => room.state.phase === "game-intro");
        await introToPlaying(room, clients);
        seen.push(next);
        expect([...room.state.playedGames]).toEqual(seen);
        advance(room, getGame(next).durationMs + LATE_ANSWER_GRACE_MS);
        expect(room.state.phase).toBe("round-results");
        host.send(ClientMessage.NextRound, {});
        await until(() => room.state.phase === "game-select");
      }

      // Đã chơi đủ mọi game, không game nào lặp → vào vòng kế tiếp thì danh sách được làm mới.
      expect(new Set(seen).size).toBe(GAME_IDS.length);
      expect(room.state.round).toBe(playable + 1);
      expect([...room.state.playedGames]).toEqual([]);

      // Giả lập game đã chơi trong trận (khi có nhiều game) → server từ chối chọn và bầu.
      room.state.playedGames.push("odd-one-out");
      await expectError(host, "invalid", () =>
        host.send(ClientMessage.PickGame, { gameId: "odd-one-out" }),
      );
      await expectError(guest, "invalid", () =>
        guest.send(ClientMessage.VoteGame, { gameId: "odd-one-out" }),
      );
      expect(room.state.phase).toBe("game-select");
    });
  });

  describe("hướng dẫn + độ khó", () => {
    it("chủ phòng chỉ bắt đầu được khi mọi người đã bấm Đã hiểu", async () => {
      const { room, clients, host } = await setup(["An", "Bình"]);
      const guest = clients[1] as TestClient;
      await toGameIntro(room, clients);

      await expectError(host, "not-ready", () => host.send(ClientMessage.StartRound, {}));
      await expectError(guest, "not-host", () => guest.send(ClientMessage.StartRound, {}));

      const start = nextMessage<RoundStartPayload>(guest, ServerMessage.RoundStart);
      guest.send(ClientMessage.IntroReady, { ready: true });
      await until(() => player(room, guest).introReady);
      host.send(ClientMessage.StartRound, {});
      const s = await start;
      expect(room.state.phase).toBe("countdown");
      expect(s.gameId).toBe("odd-one-out");
      expect(s.startAt - Date.now()).toBeGreaterThan(COUNTDOWN_MS - 500);
      expect(room.state.introEndsAt).toBe(0);
    });

    it("mỗi người tự chọn độ khó ở game-intro, không đổi được khi đã vào đếm ngược", async () => {
      const { room, clients } = await setup(["An", "Bình"], [{}, { difficulty: 0 }]);
      const guest = clients[1] as TestClient;
      await toGameIntro(room, clients);
      expect(player(room, guest).difficulty).toBe(0); // mặc định là mức lần trước

      guest.send(ClientMessage.SetDifficulty, { difficulty: 3 });
      await until(() => player(room, guest).difficulty === 3);

      await introToPlaying(room, clients);
      await expectError(guest, "bad-phase", () =>
        guest.send(ClientMessage.SetDifficulty, { difficulty: 1 }),
      );
      expect(player(room, guest).difficulty).toBe(3);
    });

    it(`tự bắt đầu vòng sau ${INTRO_AUTO_START_MS / 1000} giây dù chưa ai bấm Đã hiểu`, async () => {
      const { room, clients } = await setup(["An", "Bình"]);
      await toGameIntro(room, clients);
      const start = nextMessage<RoundStartPayload>(
        clients[1] as TestClient,
        ServerMessage.RoundStart,
      );

      advance(room, INTRO_AUTO_START_MS - 1_000);
      expect(room.state.phase).toBe("game-intro");
      advance(room, 1_000);
      expect(room.state.phase).toBe("countdown");
      expect((await start).round).toBe(1);
    });

    it("chủ phòng rời ở game-intro: quyền được chuyển, vẫn tự bắt đầu đúng hạn", async () => {
      const { room, clients, host } = await setup(["An", "Bình", "Cúc"]);
      const b = clients[1] as TestClient;
      await toGameIntro(room, clients);

      await host.leave();
      await until(() => room.state.players.size === 2);
      expect(room.state.hostId).toBe(b.sessionId);
      advance(room, INTRO_AUTO_START_MS);
      expect(room.state.phase).toBe("countdown");
    });

    it("nhắc độ khó: gửi mức đa số cho người được nhắc, tối đa 1 lần / 10 giây / người", async () => {
      const { room, clients, host } = await setup(
        ["An", "Bình", "Cúc"],
        [{ difficulty: 1 }, { difficulty: 3 }, { difficulty: 1 }],
      );
      const [, b, c] = clients as [TestClient, TestClient, TestClient];
      await toGameIntro(room, clients);

      const nudge = nextMessage<NudgePayload>(b, ServerMessage.Nudge);
      host.send(ClientMessage.NudgeDifficulty, { playerId: b.sessionId });
      expect((await nudge).difficulty).toBe(1);

      await expectError(host, "rate-limited", () =>
        host.send(ClientMessage.NudgeDifficulty, { playerId: b.sessionId }),
      );
      // Giới hạn tính riêng từng người.
      const nudgeC = nextMessage<NudgePayload>(c, ServerMessage.Nudge);
      host.send(ClientMessage.NudgeDifficulty, { playerId: c.sessionId });
      await nudgeC;

      await expectError(host, "invalid", () =>
        host.send(ClientMessage.NudgeDifficulty, { playerId: host.sessionId }),
      );
      await expectError(b, "not-host", () =>
        b.send(ClientMessage.NudgeDifficulty, { playerId: c.sessionId }),
      );

      // Qua thời gian chờ thì nhắc lại được.
      const realNow = Date.now.bind(Date);
      const spy = vi.spyOn(Date, "now").mockImplementation(() => realNow() + NUDGE_COOLDOWN_MS + 1);
      try {
        const again = nextMessage<NudgePayload>(b, ServerMessage.Nudge);
        host.send(ClientMessage.NudgeDifficulty, { playerId: b.sessionId });
        await again;
      } finally {
        spy.mockRestore();
      }
    });

    it("nhắc độ khó bị từ chối khi các mức hoà nhau (không có đa số)", async () => {
      const { room, clients, host } = await setup(
        ["An", "Bình"],
        [{ difficulty: 1 }, { difficulty: 3 }],
      );
      const guest = clients[1] as TestClient;
      await toGameIntro(room, clients);
      await expectError(host, "invalid", () =>
        host.send(ClientMessage.NudgeDifficulty, { playerId: guest.sessionId }),
      );
    });
  });

  describe("chơi + kết quả", () => {
    it("cả hai máy nhận cùng seed và chấm đúng đáp án", async () => {
      const { room, clients, host } = await setup(
        ["An", "Bình"],
        [{ difficulty: 1 }, { difficulty: 3 }],
      );
      const guest = clients[1] as TestClient;
      await toGameIntro(room, clients);

      const hostStart = nextMessage<RoundStartPayload>(host, ServerMessage.RoundStart);
      const guestStart = nextMessage<RoundStartPayload>(guest, ServerMessage.RoundStart);
      await introToPlaying(room, clients);
      const [s1, s2] = await Promise.all([hostStart, guestStart]);
      expect(s1.seed).toBe(s2.seed);

      // Client tự sinh câu đố từ seed rồi gửi đáp án đúng.
      const puzzle = getGame("odd-one-out").generate(s1.seed, 0, 1);
      const result = nextMessage<AnswerResultPayload>(host, ServerMessage.AnswerResult);
      host.send(ClientMessage.Answer, { round: 1, index: 0, answer: puzzle.oddIndex });

      const r = await result;
      expect(r.correct).toBe(true);
      expect(r.points).toBeGreaterThan(0);
      const p = player(room, host);
      expect(p.progress).toBe(1);
      expect(p.roundCorrect).toBe(1);
    });

    it("chấm bằng hệ số và miễn trừ thời gian của chính game, trên câu server sinh lại (CR-006)", async () => {
      // Tạm khai báo hệ số + miễn trừ cho odd-one-out (registry thật không đổi, trả lại ở finally).
      const registry = GAMES as Record<GameId, AnyMinigame>;
      const original = registry["odd-one-out"];
      const calls: { puzzle: unknown; difficulty: Difficulty }[] = [];
      let allowance = 9_000;
      registry["odd-one-out"] = {
        ...original,
        difficultyMultiplier: { 0: 1, 1: 1, 2: 2, 3: 3 },
        speedAllowanceMs(puzzle: unknown, difficulty: Difficulty) {
          calls.push({ puzzle, difficulty });
          return allowance;
        },
      };
      // Giờ server giả: trả lời đúng 10 giây sau khi câu hiện (không miễn trừ thì hết thưởng tốc độ).
      const realNow = Date.now.bind(Date);
      let offset = 0;
      const spy = vi.spyOn(Date, "now").mockImplementation(() => realNow() + offset);
      try {
        const { room, clients, host } = await setup(["An", "Bình"], [{ difficulty: 2 }]);
        await toPlaying(room, clients);
        offset = room.state.startAt + 10_000 - realNow();

        // 10 s − 9 s miễn trừ ≈ 1 s → trọn thưởng; hệ số game × 2 thay cho × 1,25 chung → 200 + 50.
        const first = await answerCorrectly(room, host);
        expect(first.correct).toBe(true);
        expect(first.points).toBe(250);
        expect(calls).toEqual([
          { puzzle: original.generate(room.state.seed, 0, 2), difficulty: 2 },
        ]);

        // Game trả về miễn trừ sai (NaN) → coi như 0: 10 s → hết thưởng, chỉ còn 200.
        allowance = Number.NaN;
        offset += 10_000;
        const second = await answerCorrectly(room, host);
        expect(second.points).toBe(200);
        expect(player(room, host).roundScore).toBe(450);
      } finally {
        spy.mockRestore();
        registry["odd-one-out"] = original;
      }
    });

    it("hoà điểm vòng thì cùng hạng, cùng điểm trận", async () => {
      const { room, clients, host } = await setup(["An", "Bình", "Cúc"]);
      const [, b, c] = clients as [TestClient, TestClient, TestClient];
      await toPlaying(room, clients);

      const r = await answerCorrectly(room, host);
      expect(r.correct).toBe(true);
      finishRound(room);

      expect(room.state.phase).toBe("round-results");
      const h = player(room, host);
      // 3 người (CR-018): nhất 3 + 3, nhì 2 + 2.
      expect(h.lastPoints).toBe(6);
      expect(h.matchPoints).toBe(6);
      expect(h.totalScore).toBe(h.roundScore);
      expect(h.totalScore).toBeGreaterThan(0);
      // Bình và Cúc cùng 0 điểm → cùng hạng 2 → cùng +4.
      for (const guest of [b, c]) {
        expect(player(room, guest).lastPoints).toBe(4);
        expect(player(room, guest).matchPoints).toBe(4);
      }
    });

    it("vòng cuối vẫn qua round-results; nextRound → podium; playAgain chơi lại từ vòng 1", async () => {
      const { room, clients, host } = await setup(["An", "Bình"]);
      const guest = clients[1] as TestClient;
      host.send(ClientMessage.SetRounds, { totalRounds: 1 });
      await until(() => room.state.totalRounds === 1);

      await toPlaying(room, clients);
      await answerCorrectly(room, guest);
      finishRound(room);
      expect(room.state.phase).toBe("round-results");
      // 2 người: nhất 2 + 3.
      expect(player(room, guest).matchPoints).toBe(5);

      await expectError(guest, "not-host", () => guest.send(ClientMessage.NextRound, {}));
      host.send(ClientMessage.NextRound, {});
      await until(() => room.state.phase === "podium");

      await expectError(guest, "not-host", () => guest.send(ClientMessage.PlayAgain, {}));
      host.send(ClientMessage.PlayAgain, {});
      await until(() => room.state.phase === "game-select");
      expect(room.state.round).toBe(1);
      expect(room.state.totalRounds).toBe(1);
      expect(room.state.players.size).toBe(2);
      expect([...room.state.playedGames]).toEqual([]);
      for (const p of players(room)) {
        expect(p.matchPoints).toBe(0);
        expect(p.totalScore).toBe(0);
        expect(p.lastPoints).toBe(0);
        expect(p.roundScore).toBe(0);
      }
    });

    it(`chơi lại cần ≥ ${MIN_PLAYERS_TO_START} người: còn 2 thì chơi được, còn 1 thì bị từ chối (not-ready)`, async () => {
      const { room, clients, host } = await setup(["An", "Bình", "Cúc"]);
      const [, b, c] = clients as [TestClient, TestClient, TestClient];
      host.send(ClientMessage.SetRounds, { totalRounds: 1 });
      await until(() => room.state.totalRounds === 1);
      await toPlaying(room, clients);
      finishRound(room);
      host.send(ClientMessage.NextRound, {});
      await until(() => room.state.phase === "podium");

      // Còn 2 người (= MIN_PLAYERS_TO_START): chơi lại bình thường.
      await c.leave();
      await until(() => room.state.players.size === 2);
      host.send(ClientMessage.PlayAgain, {});
      await until(() => room.state.phase === "game-select");
      expect(room.state.round).toBe(1);

      // Chơi hết trận mới rồi chỉ còn chủ phòng: bị từ chối, trận giữ nguyên ở podium.
      host.send(ClientMessage.PickGame, { gameId: "odd-one-out" });
      await until(() => room.state.phase === "game-intro");
      await introToPlaying(room, [host, b]);
      finishRound(room);
      host.send(ClientMessage.NextRound, {});
      await until(() => room.state.phase === "podium");
      await b.leave();
      await until(() => room.state.players.size === 1);
      await expectError(host, "not-ready", () => host.send(ClientMessage.PlayAgain, {}));
      expect(room.state.phase).toBe("podium");
      expect(room.state.round).toBe(1);
      expect(activeTimers(room)).toBe(0);

      // Chủ phòng vẫn về phòng chờ được để chờ thêm người.
      host.send(ClientMessage.BackToLobby, {});
      await until(() => room.state.phase === "lobby");
    });

    it("điểm theo thể loại: cộng dồn qua các vòng, có khoá cả khi 0 điểm; chơi lại / về phòng chờ thì xoá (CR-010)", async () => {
      const { room, clients, host } = await setup(["An", "Bình", "Cúc"]);
      const [, b, c] = clients as [TestClient, TestClient, TestClient];
      host.send(ClientMessage.SetRounds, { totalRounds: 3 });
      await until(() => room.state.totalRounds === 3);
      await toGameSelect(room, clients);

      const scores = (cl: TestClient) =>
        Object.fromEntries(player(room, cl).categoryScores.entries());
      /** Chơi một vòng `gameId`; trả điểm vòng của từng người (theo thứ tự `clients`). */
      const round = async (gameId: GameId, scorers: [TestClient, number][]) => {
        host.send(ClientMessage.PickGame, { gameId });
        await until(() => room.state.phase === "game-intro");
        await introToPlaying(room, clients);
        for (const [cl, n] of scorers) {
          for (let i = 0; i < n; i++) {
            const p = player(room, cl);
            const result = nextMessage<AnswerResultPayload>(cl, ServerMessage.AnswerResult);
            cl.send(ClientMessage.Answer, {
              round: room.state.round,
              index: p.progress,
              answer: SOLVE[gameId](room.state.seed, p.progress, p.difficulty as Difficulty),
            });
            expect((await result).correct).toBe(true);
          }
        }
        finishRound(room);
        expect(room.state.phase).toBe("round-results");
        return clients.map((cl) => player(room, cl).roundScore);
      };

      // Vòng 1 + 2 cùng thể loại visualize, vòng 3 identify.
      const r1 = await round("rotate-match", [[b, 2]]);
      expect(scores(b)).toEqual({ visualize: r1[1] });
      expect(scores(host)).toEqual({ visualize: 0 });
      host.send(ClientMessage.NextRound, {});
      await until(() => room.state.phase === "game-select");
      const r2 = await round("top-view", [
        [b, 1],
        [c, 1],
      ]);
      host.send(ClientMessage.NextRound, {});
      await until(() => room.state.phase === "game-select");
      const r3 = await round("odd-one-out", [[host, 1]]);

      expect(scores(host)).toEqual({ visualize: 0, identify: r3[0] });
      expect(scores(b)).toEqual({ visualize: (r1[1] ?? 0) + (r2[1] ?? 0), identify: 0 });
      expect(scores(c)).toEqual({ visualize: r2[2], identify: 0 });
      // Tổng các thể loại = tổng điểm vòng cả trận.
      for (const cl of clients) {
        const sum = Object.values(scores(cl)).reduce((a, v) => a + v, 0);
        expect(sum).toBe(player(room, cl).totalScore);
      }
      // Đồng bộ xuống client đúng hình dạng PlayerView.categoryScores.
      const json = room.state.toJSON() as unknown as PartyStateView;
      expect(json.players[b.sessionId]?.categoryScores).toEqual(scores(b));

      host.send(ClientMessage.NextRound, {});
      await until(() => room.state.phase === "podium");
      host.send(ClientMessage.PlayAgain, {});
      await until(() => room.state.phase === "game-select");
      for (const cl of clients) expect(scores(cl)).toEqual({});

      await round("balance", [[c, 1]]);
      expect(scores(c)).toEqual({ analyze: player(room, c).roundScore });
      host.send(ClientMessage.BackToLobby, {});
      await until(() => room.state.phase === "lobby");
      for (const cl of clients) expect(scores(cl)).toEqual({});
    }, 20_000);

    it("về phòng chờ từ podium: xoá điểm, sẵn sàng, game đã chơi", async () => {
      const { room, clients, host } = await setup(["An", "Bình"]);
      host.send(ClientMessage.SetRounds, { totalRounds: 1 });
      await until(() => room.state.totalRounds === 1);
      await toPlaying(room, clients);
      finishRound(room);
      host.send(ClientMessage.NextRound, {});
      await until(() => room.state.phase === "podium");

      host.send(ClientMessage.BackToLobby, {});
      await until(() => room.state.phase === "lobby");
      expect(room.state.round).toBe(0);
      expect([...room.state.playedGames]).toEqual([]);
      for (const p of players(room)) {
        expect(p.ready).toBe(false);
        expect(p.matchPoints).toBe(0);
      }
    });

    it("không về phòng chờ hay chơi lại sai pha", async () => {
      const { room, clients, host } = await setup(["An", "Bình"]);
      await toGameSelect(room, clients);
      await expectError(host, "bad-phase", () => host.send(ClientMessage.BackToLobby, {}));
      await expectError(host, "bad-phase", () => host.send(ClientMessage.PlayAgain, {}));
      await expectError(host, "bad-phase", () => host.send(ClientMessage.NextRound, {}));
      expect(room.state.phase).toBe("game-select");
    });
  });

  describe("luồng dễ sai (QA)", () => {
    it("bấm Bắt đầu chơi thì huỷ hẹn tự bắt đầu: không sinh vòng thứ hai, seed giữ nguyên", async () => {
      const { room, clients, host } = await setup(["An", "Bình"]);
      const guest = clients[1] as TestClient;
      await toGameIntro(room, clients);
      let starts = 0;
      guest.onMessage(ServerMessage.RoundStart, () => {
        starts += 1;
      });

      guest.send(ClientMessage.IntroReady, { ready: true });
      await until(() => player(room, guest).introReady);
      host.send(ClientMessage.StartRound, {});
      await until(() => room.state.phase === "countdown");
      const { seed, startAt } = room.state;

      // Tua qua mốc 20 giây của màn hướng dẫn: hẹn cũ phải đã bị huỷ, chỉ đếm ngược chạy.
      advance(room, INTRO_AUTO_START_MS);
      expect(room.state.phase).toBe("playing");
      expect(room.state.seed).toBe(seed);
      expect(room.state.startAt).toBe(startAt);
      expect(activeTimers(room)).toBe(1); // chỉ còn hẹn hết vòng
      await new Promise((r) => setTimeout(r, 50));
      expect(starts).toBe(1);
    });

    it("người chưa bấm Đã hiểu rời phòng ở game-intro: chủ phòng bắt đầu được ngay", async () => {
      const { room, clients, host } = await setup(["An", "Bình", "Cúc"]);
      const [, b, c] = clients as [TestClient, TestClient, TestClient];
      await toGameIntro(room, clients);
      b.send(ClientMessage.IntroReady, { ready: true });
      await until(() => player(room, b).introReady);
      await expectError(host, "not-ready", () => host.send(ClientMessage.StartRound, {}));

      await c.leave();
      await until(() => room.state.players.size === 2);
      host.send(ClientMessage.StartRound, {});
      await until(() => room.state.phase === "countdown");
    });

    it("chủ phòng rời khi vòng quay đang quay: người nhận quyền không quay lại được, vẫn vào đúng game", async () => {
      const { room, clients, host } = await setup(["An", "Bình", "Cúc"]);
      const b = clients[1] as TestClient;
      await toGameSelect(room, clients);
      host.send(ClientMessage.SpinWheel, {});
      await until(() => room.state.wheelGameId !== "");
      const picked = room.state.wheelGameId;

      await host.leave();
      await until(() => room.state.hostId === b.sessionId);
      await expectError(b, "bad-phase", () => b.send(ClientMessage.SpinWheel, {}));
      await expectError(b, "bad-phase", () =>
        b.send(ClientMessage.PickGame, { gameId: GAME_IDS[0] }),
      );

      advance(room, WHEEL_SPIN_LEAD_MS + WHEEL_SPIN_MS + WHEEL_RESULT_HOLD_MS);
      expect(room.state.phase).toBe("game-intro");
      expect(room.state.gameId).toBe(picked);
    });

    it("chủ phòng rời lúc đếm ngược: vẫn vào chơi, hết giờ sang round-results, chủ mới bấm tiếp", async () => {
      const { room, clients, host } = await setup(["An", "Bình", "Cúc"]);
      const [, b, c] = clients as [TestClient, TestClient, TestClient];
      host.send(ClientMessage.SetRounds, { totalRounds: 2 });
      await until(() => room.state.totalRounds === 2);
      await toGameIntro(room, clients);
      for (const g of [b, c]) g.send(ClientMessage.IntroReady, { ready: true });
      await until(() => player(room, b).introReady && player(room, c).introReady);
      host.send(ClientMessage.StartRound, {});
      await until(() => room.state.phase === "countdown");

      await host.leave();
      await until(() => room.state.hostId === b.sessionId);
      advance(room, COUNTDOWN_MS);
      expect(room.state.phase).toBe("playing");
      finishRound(room);
      expect(room.state.phase).toBe("round-results");
      // Chỉ người còn trong phòng được xếp hạng (2 ghế): hai người cùng 0 điểm → cùng nhất, cùng +5.
      expect(players(room).map((p) => p.lastPoints)).toEqual([5, 5]);

      b.send(ClientMessage.NextRound, {});
      await until(() => room.state.phase === "game-select");
      expect(room.state.round).toBe(2);
    });

    it("về phòng chờ từ round-results giữa trận: xoá sạch trận, không còn hẹn giờ, phải sẵn sàng lại", async () => {
      const { room, clients, host } = await setup(["An", "Bình"]);
      host.send(ClientMessage.SetRounds, { totalRounds: 3 });
      await until(() => room.state.totalRounds === 3);
      await toPlaying(room, clients);
      await answerCorrectly(room, host);
      finishRound(room);
      expect(room.state.phase).toBe("round-results");
      expect(activeTimers(room)).toBe(0);

      host.send(ClientMessage.BackToLobby, {});
      await until(() => room.state.phase === "lobby");
      expect(room.state.round).toBe(0);
      expect(room.state.totalRounds).toBe(3); // giữ thiết lập số vòng
      expect(room.state.gameId).toBe("");
      expect(room.state.seed).toBe(0);
      expect([...room.state.playedGames]).toEqual([]);
      expect(room.state.votes.size).toBe(0);
      expect(room.state.wheelGameId).toBe("");
      expect(room.state.introEndsAt).toBe(0);
      for (const p of players(room)) {
        expect(p.ready).toBe(false);
        expect(p.introReady).toBe(false);
        expect([p.matchPoints, p.lastPoints, p.totalScore]).toEqual([0, 0, 0]);
        expect([p.roundScore, p.roundCorrect, p.progress, p.streak]).toEqual([0, 0, 0, 0]);
      }
      expect(activeTimers(room)).toBe(0);
      await expectError(host, "not-ready", () => host.send(ClientMessage.StartMatch, {}));

      // Phòng chờ mở cửa lại cho người mới.
      await join(room, "Cúc");
      expect(room.state.players.size).toBe(3);
    });

    it("nhiều vòng: điểm trận cộng dồn, lastPoints của vòng gần nhất; vòng mới xoá phiếu, Đã hiểu, vòng quay", async () => {
      const { room, clients, host } = await setup(["An", "Bình", "Cúc"]);
      const [, b, c] = clients as [TestClient, TestClient, TestClient];
      host.send(ClientMessage.SetRounds, { totalRounds: 2 });
      await until(() => room.state.totalRounds === 2);

      // Vòng 1 (3 người): chỉ An đúng 1 câu → An +6, Bình và Cúc cùng hạng 2 → +4.
      await toPlaying(room, clients);
      await answerCorrectly(room, host);
      finishRound(room);
      const anRound1 = player(room, host).roundScore;
      expect(anRound1).toBeGreaterThan(0);

      host.send(ClientMessage.NextRound, {});
      await until(() => room.state.phase === "game-select");
      expect(room.state.round).toBe(2);
      expect(room.state.wheelGameId).toBe("");
      expect(room.state.wheelSpinAt).toBe(0);
      expect(room.state.introEndsAt).toBe(0);
      for (const p of players(room)) expect(p.introReady).toBe(false);

      // Vòng 2: bình chọn rồi chủ phòng chọn; không ai trả lời → cả ba cùng nhất, cùng +6.
      host.send(ClientMessage.SetPickMode, { mode: "pick" });
      await until(() => room.state.pickMode === "pick");
      const next = availableGames([...room.state.playedGames])[0] as GameId;
      b.send(ClientMessage.VoteGame, { gameId: next });
      await until(() => room.state.votes.size === 1);
      host.send(ClientMessage.PickGame, { gameId: next });
      await until(() => room.state.phase === "game-intro");
      await introToPlaying(room, clients);
      expect(room.state.votes.size).toBe(0);
      for (const p of players(room)) expect([p.roundScore, p.progress]).toEqual([0, 0]);
      finishRound(room);
      expect(room.state.phase).toBe("round-results");

      const an = player(room, host);
      expect([an.matchPoints, an.lastPoints, an.totalScore]).toEqual([12, 6, anRound1]);
      for (const g of [b, c]) {
        const p = player(room, g);
        expect([p.matchPoints, p.lastPoints, p.totalScore]).toEqual([10, 6, 0]);
      }

      host.send(ClientMessage.NextRound, {});
      await until(() => room.state.phase === "podium");
      expect(activeTimers(room)).toBe(0);
    });

    it("tin nhắn sai schema ở các lệnh mới bị từ chối (invalid), state không đổi", async () => {
      const { room, clients, host } = await setup(["An", "Bình"]);
      const guest = clients[1] as TestClient;
      await toGameSelect(room, clients);

      const badSelect: [TestClient, ClientMessageType, unknown][] = [
        [host, ClientMessage.SetPickMode, { mode: "random" }],
        [host, ClientMessage.SpinWheel, "now"],
        [host, ClientMessage.PickGame, { gameId: "tetris" }],
        [host, ClientMessage.PickGame, undefined],
        [guest, ClientMessage.VoteGame, { gameId: 1 }],
        [guest, ClientMessage.VoteGame, {}],
      ];
      for (const [c, type, payload] of badSelect) {
        await expectError(c, "invalid", () => c.send(type, payload));
      }
      expect(room.state.phase).toBe("game-select");
      expect(room.state.pickMode).toBe("wheel");
      expect(room.state.wheelGameId).toBe("");
      expect(room.state.votes.size).toBe(0);

      host.send(ClientMessage.PickGame, { gameId: GAME_IDS[0] });
      await until(() => room.state.phase === "game-intro");
      const badIntro: [TestClient, ClientMessageType, unknown][] = [
        [guest, ClientMessage.SetDifficulty, { difficulty: 7 }],
        [guest, ClientMessage.SetDifficulty, { difficulty: "3" }],
        [guest, ClientMessage.IntroReady, { ready: "yes" }],
        [host, ClientMessage.NudgeDifficulty, { playerId: "" }],
        [host, ClientMessage.NudgeDifficulty, {}],
        [host, ClientMessage.StartRound, 42],
      ];
      for (const [c, type, payload] of badIntro) {
        await expectError(c, "invalid", () => c.send(type, payload));
      }
      expect(room.state.phase).toBe("game-intro");
      expect(player(room, guest).difficulty).toBe(1);
      expect(player(room, guest).introReady).toBe(false);
    });

    it("lệnh sai pha bị từ chối (bad-phase), state không đổi", async () => {
      const { room, clients, host } = await setup(["An", "Bình"]);
      const guest = clients[1] as TestClient;
      const odd = GAME_IDS[0];

      // Phòng chờ: chưa chọn game, chưa có màn hướng dẫn.
      await expectError(guest, "bad-phase", () =>
        guest.send(ClientMessage.VoteGame, { gameId: odd }),
      );
      await expectError(guest, "bad-phase", () =>
        guest.send(ClientMessage.IntroReady, { ready: true }),
      );
      await expectError(host, "bad-phase", () => host.send(ClientMessage.SpinWheel, {}));
      await expectError(host, "bad-phase", () => host.send(ClientMessage.StartRound, {}));

      // Chọn game: hết đổi hồ sơ, sẵn sàng, số vòng; chưa tới lúc chọn độ khó.
      await toGameSelect(room, clients);
      await expectError(guest, "bad-phase", () =>
        guest.send(ClientMessage.SetProfile, { avatar: "bo" }),
      );
      await expectError(guest, "bad-phase", () =>
        guest.send(ClientMessage.Ready, { ready: false }),
      );
      await expectError(host, "bad-phase", () =>
        host.send(ClientMessage.SetRounds, { totalRounds: 5 }),
      );
      await expectError(host, "bad-phase", () => host.send(ClientMessage.StartMatch, {}));
      await expectError(guest, "bad-phase", () =>
        guest.send(ClientMessage.SetDifficulty, { difficulty: 0 }),
      );
      await expectError(guest, "bad-phase", () =>
        guest.send(ClientMessage.IntroReady, { ready: true }),
      );
      await expectError(host, "bad-phase", () =>
        host.send(ClientMessage.NudgeDifficulty, { playerId: guest.sessionId }),
      );

      // Hướng dẫn: hết bình chọn, quay, chọn game.
      host.send(ClientMessage.PickGame, { gameId: odd });
      await until(() => room.state.phase === "game-intro");
      await expectError(guest, "bad-phase", () =>
        guest.send(ClientMessage.VoteGame, { gameId: odd }),
      );
      await expectError(host, "bad-phase", () => host.send(ClientMessage.SpinWheel, {}));
      await expectError(host, "bad-phase", () =>
        host.send(ClientMessage.PickGame, { gameId: odd }),
      );
      await expectError(host, "bad-phase", () => host.send(ClientMessage.NextRound, {}));

      const g = player(room, guest);
      expect([g.avatar, g.ready, g.difficulty]).toEqual(["khoi", true, 1]);
      expect(room.state.totalRounds).toBe(3);
      expect(room.state.votes.size).toBe(0);
    });

    it("không vào được phòng khi trận đang diễn ra", async () => {
      const { room, clients } = await setup(["An", "Bình"]);
      await toGameSelect(room, clients);
      await expect(colyseus.connectTo(room, { name: "Muộn" })).rejects.toBeDefined();
      expect(room.state.players.size).toBe(2);
    });

    it("tải lại trang ở game-select (đang quay), game-intro, round-results: vào lại đúng chỗ, đúng pha", async () => {
      const { room, clients, host } = await setup(["An", "Bình"]);
      let guest = clients[1] as TestClient;
      const id = guest.sessionId;
      await toGameSelect(room, clients);

      // Đang quay: máy tải lại nhận kết quả + giờ quay của server để quay tiếp/hiện kết quả.
      host.send(ClientMessage.SpinWheel, {});
      await until(() => room.state.wheelGameId !== "");
      guest = await reload(room, guest);
      expect(guest.sessionId).toBe(id);
      await until(() => guest.state.phase === "game-select");
      expect(guest.state.wheelGameId).toBe(room.state.wheelGameId);
      expect(guest.state.wheelSpinAt).toBe(room.state.wheelSpinAt);
      expect(guest.state.wheelSpinMs).toBe(room.state.wheelSpinMs);

      // Hướng dẫn: giữ độ khó vừa chọn và trạng thái "Đã hiểu".
      advance(room, WHEEL_SPIN_LEAD_MS + WHEEL_SPIN_MS + WHEEL_RESULT_HOLD_MS);
      expect(room.state.phase).toBe("game-intro");
      guest.send(ClientMessage.SetDifficulty, { difficulty: 2 });
      guest.send(ClientMessage.IntroReady, { ready: true });
      await until(() => player(room, guest).introReady && player(room, guest).difficulty === 2);
      guest = await reload(room, guest);
      await until(() => guest.state.phase === "game-intro");
      expect(guest.state.introEndsAt).toBe(room.state.introEndsAt);
      expect(player(room, guest).introReady).toBe(true);
      expect(player(room, guest).difficulty).toBe(2);
      host.send(ClientMessage.StartRound, {});
      await until(() => room.state.phase === "countdown");
      advance(room, COUNTDOWN_MS);
      finishRound(room);

      // Kết quả vòng: điểm trận vẫn nguyên sau khi tải lại.
      expect(room.state.phase).toBe("round-results");
      const points = player(room, guest).matchPoints;
      expect(points).toBe(5);
      guest = await reload(room, guest);
      await until(() => guest.state.phase === "round-results");
      expect(player(room, guest).matchPoints).toBe(points);
      expect(player(room, guest).lastPoints).toBe(points);
    });

    it("tải lại trang giữa pha playing: không nhận lại roundStart nhưng state đủ seed, giờ, tiến độ; sinh câu từ state và trả lời tiếp được chấm đúng", async () => {
      const { room, clients } = await setup(["An", "Bình"]);
      let guest = clients[1] as TestClient;
      await toPlaying(room, clients);
      expect((await answerCorrectly(room, guest)).correct).toBe(true);
      const before = { ...player(room, guest).toJSON() };
      expect(before.progress).toBe(1);

      guest = await reload(room, guest);
      let gotRoundStart = false;
      guest.onMessage(ServerMessage.RoundStart, () => {
        gotRoundStart = true;
      });
      await until(() => guest.state.players?.get(guest.sessionId)?.progress === 1);

      // Đúng những gì PlayScreen đọc sau khi tải lại: seed, vòng, giờ bắt đầu/kết thúc, tiến độ, điểm.
      expect(guest.state.phase).toBe("playing");
      expect(guest.state.seed).toBe(room.state.seed);
      expect(guest.state.round).toBe(room.state.round);
      expect(guest.state.startAt).toBe(room.state.startAt);
      expect(guest.state.endsAt).toBe(room.state.endsAt);
      const me = guest.state.players.get(guest.sessionId);
      if (!me) throw new Error("Máy tải lại không thấy chính mình trong state");
      expect(me.roundScore).toBe(before.roundScore);
      expect(me.difficulty).toBe(before.difficulty);

      // Máy tải lại sinh câu từ seed trong state (không có tin roundStart) → server chấm đúng.
      const puzzle = getGame("odd-one-out").generate(
        guest.state.seed,
        me.progress,
        me.difficulty as Difficulty,
      );
      const result = nextMessage<AnswerResultPayload>(guest, ServerMessage.AnswerResult);
      guest.send(ClientMessage.Answer, {
        round: guest.state.round,
        index: me.progress,
        answer: puzzle.oddIndex,
      });
      expect((await result).correct).toBe(true);
      await until(() => player(room, guest).progress === 2);
      expect(gotRoundStart).toBe(false);
    });

    const dropDetectMs = TRANSPORT_PING_INTERVAL_MS * (TRANSPORT_PING_MAX_RETRIES + 1);
    it(`máy thôi trả lời ping (mất sóng, không có khung đóng): server thấy rớt trong ${dropDetectMs / 1000} giây, giữ chỗ; máy còn sống không bị cắt`, async () => {
      // Mục tiêu: thấy rớt trong ≤ 4,5 s (mặc định của transport mất ~10 s qua Render).
      expect(dropDetectMs).toBeLessThanOrEqual(4_500);
      const { room, clients } = await setup(["An", "Bình"]);
      const [host, guest] = clients as [TestClient, TestClient];
      // Chỉ đo lúc server phát hiện rớt: không để SDK tự nối lại sau khi bị cắt.
      guest.reconnection.enabled = false;
      // Giả lập mất sóng như qua Render: không có khung đóng nào tới, và với server máy này không còn
      // trả lời ping (bỏ bộ xử lý pong của transport trên kết nối phía server).
      const ref = room.clients.find((c) => c.sessionId === guest.sessionId)?.ref;
      if (!ref) throw new Error("Không thấy kết nối của máy khách trên server");
      ref.removeAllListeners("pong");
      const start = Date.now();
      await until(() => player(room, guest).connected === false, dropDetectMs + 3_000);
      // Transport thật dùng đúng hai hằng trên (mặc định 3000 ms × 2 cần ít nhất 6 s, quá trần này).
      expect(Date.now() - start).toBeLessThanOrEqual(dropDetectMs + 1_000);
      // Rớt mạng (onDrop) chứ không phải rời phòng: vẫn giữ chỗ chờ nối lại.
      expect(room.state.players.has(guest.sessionId)).toBe(true);
      // Máy còn trả lời ping không bị cắt oan dù nhịp ping dày hơn.
      expect(player(room, host).connected).toBe(true);
    });

    it("transport tự dựng (chỉ đổi nhịp ping) vẫn giữ Express (/healthz) và mặc định của ws-transport", async () => {
      // `defineServer({ transport })` thay cho transport mặc định: không được mất route Express hay
      // giới hạn gói tin / tắt nén mà transport mặc định vẫn có.
      const port = (colyseus.server as unknown as { port: number }).port;
      const res = await fetch(`http://127.0.0.1:${port}/healthz`);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ ok: true });

      const transport = colyseus.server.transport as unknown as {
        pingIntervalMS: number;
        pingMaxRetries: number;
        wss: { options: { maxPayload?: number; perMessageDeflate?: unknown } };
      };
      expect(transport.pingIntervalMS).toBe(TRANSPORT_PING_INTERVAL_MS);
      expect(transport.pingMaxRetries).toBe(TRANSPORT_PING_MAX_RETRIES);
      expect(transport.wss.options.maxPayload).toBe(4 * 1024);
      expect(transport.wss.options.perMessageDeflate).toBe(false);
    });
  });

  describe("5 minigame MVP trên server (QA đợt 3, CR-006)", () => {
    /** Miễn trừ của câu đầu (ms): hằng số, hoặc tính theo câu 0 của seed vòng khi đặc tả cho công thức. */
    type Allowance = number | ((seed: number, d: Difficulty) => number);
    interface ServerCase {
      id: GameId;
      durationMs: number;
      /** [miễn trừ câu đầu, điểm câu đầu] ở Mầm. */
      seedling: [Allowance, number];
      /** [miễn trừ câu đầu, điểm câu đầu] ở Siêu khó. */
      expert: [Allowance, number];
      /** Hạn trả lời mỗi câu ở Siêu khó (ms, đặc tả); không ghi = không giới hạn (CR-012). */
      expertWindowMs?: number;
      /** Đáp án rác riêng của game, thêm vào bộ rác chung theo kiểu đáp án (CR-013, CR-014). */
      junk?: readonly unknown[];
    }

    /**
     * Số liệu chép từ đặc tả (độc lập với code): thời lượng vòng, rồi [miễn trừ của câu đầu, điểm câu
     * đầu] ở Mầm và Siêu khó khi trả lời đúng 1 giây sau mốc miễn trừ (trọn thưởng tốc độ 50):
     * điểm = 100 × hệ số của game + 50. Kẻ lạc đàn không khai báo gì nên giữ hệ số chung 0,8 / 1,5.
     */
    const CASES: ServerCase[] = [
      { id: "odd-one-out", durationMs: 45_000, seedling: [0, 130], expert: [0, 200] },
      { id: "light-trail", durationMs: 60_000, seedling: [2_900, 150], expert: [3_100, 270] },
      { id: "balance", durationMs: 60_000, seedling: [0, 150], expert: [3_000, 335] },
      { id: "number-balloons", durationMs: 60_000, seedling: [1_000, 150], expert: [4_000, 250] },
      { id: "rotate-match", durationMs: 60_000, seedling: [0, 135], expert: [0, 380] },
    ];

    /** Đếm tiền nhanh (đặc tả, mục Miễn trừ): 500 ms mỗi tờ từ tờ thứ 3, thêm 2 000 ms nếu là câu tiền thối. */
    const cashAllowance = (seed: number, d: Difficulty) => {
      const p = GAMES["cash-count"].generate(seed, 0, d);
      return 500 * Math.max(0, p.bills.length - 2) + (p.mode === "change" ? 2_000 : 0);
    };

    /** 9 game GĐ 2–3 (gồm Bóng của ai), số liệu chép từ bảng hệ số + miễn trừ trong đặc tả từng game (CR-006). */
    const NEW_CASES: ServerCase[] = [
      { id: "hit-target", durationMs: 60_000, seedling: [500, 150], expert: [1_000, 225] },
      {
        id: "cash-count",
        durationMs: 60_000,
        seedling: [cashAllowance, 150],
        expert: [cashAllowance, 230],
      },
      { id: "top-view", durationMs: 60_000, seedling: [0, 125], expert: [0, 340] },
      { id: "fold-box", durationMs: 60_000, seedling: [0, 135], expert: [0, 375] },
      { id: "who-vanished", durationMs: 60_000, seedling: [3_400, 150], expert: [3_400, 275] },
      // Câu đầu của bàn đầu: chia + xem + úp + lật thẻ đề = 4 000 ms (Mầm), 5 000 ms (Siêu khó).
      { id: "pair-flip", durationMs: 60_000, seedling: [4_000, 150], expert: [5_000, 245] },
      { id: "cube-count", durationMs: 60_000, seedling: [0, 150], expert: [0, 295] },
      { id: "marble-drop", durationMs: 60_000, seedling: [0, 150], expert: [4_000, 495] },
      // M14 Bóng của ai (shadow-match.md): hệ số Mầm 1, Siêu khó 4, không có miễn trừ.
      { id: "shadow-match", durationMs: 60_000, seedling: [0, 150], expert: [0, 450] },
    ];

    /**
     * Game GĐ 4 (CR-012), tách nhóm riêng vì NEW_CASES đã đủ MAX_TOTAL_ROUNDS khi thêm game mới.
     * M16 Luyện ngắm (aim-trainer.md): hệ số Mầm 1, Siêu khó 2,55, không có miễn trừ; bia Siêu khó
     * sống 1 500 ms (Mầm không giới hạn).
     * M17 Phấn trượt (chalk-arrows.md): hệ số Mầm 1, Siêu khó 2,9, không có miễn trừ, không có hạn.
     */
    const CR012_CASES: ServerCase[] = [
      {
        id: "aim-trainer",
        durationMs: 60_000,
        seedling: [0, 150],
        expert: [0, 305],
        expertWindowMs: 1_500,
      },
      { id: "chalk-arrows", durationMs: 60_000, seedling: [0, 150], expert: [0, 340] },
    ];

    /** Đếm sĩ số (head-count.md, Dòng thời gian): xem lớp + số lượt × thời gian mỗi lượt (Mầm 3–4 lượt). */
    const headCountAllowance = (seed: number, d: Difficulty) => {
      const p = GAMES["head-count"].generate(seed, 0, d);
      return p.showMs + p.events.length * p.stepMs;
    };

    /**
     * 7 game đợt đầu mở rộng (CR-013), mọi game vòng 60 s, không game nào có hạn trả lời. Hệ số Mầm
     * và Siêu khó, miễn trừ lấy từ bảng "Hệ số điểm và miễn trừ thời gian" trong đặc tả từng game:
     * - Tráo cốc (cup-shuffle.md): 1 / 2,35; miễn trừ = xem + úp + mọi lượt tráo, 3 300 / 3 720 ms.
     * - Xếp lại tháp (stack-recall.md): 1 / 2,2; miễn trừ = xem + che + 300 ms mỗi lần chạm sau lần
     *   đầu, 3 200 / 3 600 ms.
     * - Chuỗi quy luật (bead-pattern.md): 1 / 3,35, không có miễn trừ.
     * - Đếm sĩ số (head-count.md): 1 / 1,75, miễn trừ theo số lượt của câu (`headCountAllowance`).
     * - Mảnh vừa khít (piece-fit.md): 1 / 3,2, không có miễn trừ.
     * - Ô bí ẩn (latin-cell.md): 1 / 3,1, không có miễn trừ.
     * - Nối mạch (circuit-link.md): 1 / 3,25, không có miễn trừ.
     * Rác riêng: chỉ số đầu tiên ngoài khoảng đáp án (số cốc, số thẻ, số hình nhiều nhất ở mọi mức).
     */
    const CR013_CASES: ServerCase[] = [
      {
        id: "cup-shuffle",
        durationMs: 60_000,
        seedling: [3_300, 150],
        expert: [3_720, 285],
        junk: [5], // 5 cốc ở Siêu khó: ô 0–4.
      },
      {
        id: "stack-recall",
        durationMs: 60_000,
        seedling: [3_200, 150],
        expert: [3_600, 270],
        // Loại khối ngoài 0–7, số thực, lẫn chuỗi/null, dài hơn tháp cao nhất (5 tầng).
        junk: [[8], [0, 8], [1.5], [0, "1"], [0, null], [0, -1], [0, 1, 0, 1, 0, 1]],
      },
      {
        id: "bead-pattern",
        durationMs: 60_000,
        seedling: [0, 150],
        expert: [0, 385],
        junk: [4], // 4 thẻ.
      },
      {
        id: "head-count",
        durationMs: 60_000,
        seedling: [headCountAllowance, 150],
        expert: [headCountAllowance, 225],
        junk: [4], // 4 thẻ.
      },
      {
        id: "piece-fit",
        durationMs: 60_000,
        seedling: [0, 150],
        expert: [0, 370],
        junk: [4], // 4 thẻ.
      },
      {
        id: "latin-cell",
        durationMs: 60_000,
        seedling: [0, 150],
        expert: [0, 360],
        junk: [6], // 6 hình ở lưới lớn nhất.
      },
      {
        id: "circuit-link",
        durationMs: 60_000,
        seedling: [0, 150],
        expert: [0, 375],
        junk: [4], // 4 thẻ.
      },
    ];

    /** Giỏ hời nhất (best-basket.md, Miễn trừ): 250 ms mỗi món sau hai món đầu + 500 ms mỗi luật. */
    const basketAllowance = (seed: number, d: Difficulty) => {
      const p = GAMES["best-basket"].generate(seed, 0, d);
      const items = p.baskets.reduce((n, basket) => n + basket.length, 0);
      return 250 * Math.max(0, items - 2) + 500 * ((p.combo ? 1 : 0) + (p.deal ? 1 : 0));
    };

    /** Rót vừa vạch (pour-line.md, Thưởng tốc độ và miễn trừ): phần giữ tay bắt buộc = mép dưới khoảng đúng. */
    const pourAllowance = (seed: number, d: Difficulty) =>
      GAMES["pour-line"].generate(seed, 0, d).holdMinMs;

    /**
     * Nhại nhịp (rhythm-echo.md, Hệ số điểm và miễn trừ): pha nghe + thời gian gõ bắt buộc
     * = chờ đầu + lặng cuối + 2 × độ dài câu nhịp (tiếng đầu tới tiếng cuối).
     */
    const rhythmAllowance = (seed: number, d: Difficulty) => {
      const p = GAMES["rhythm-echo"].generate(seed, 0, d);
      const span = (p.hits[p.hits.length - 1]?.atMs ?? 0) - (p.hits[0]?.atMs ?? 0);
      return p.leadMs + p.tailMs + 2 * span;
    };

    /** Một lần gõ của Nhại nhịp, nhận cả giá trị sai kiểu để dựng rác. */
    const tap = (side: unknown, atMs: unknown) => ({ side, atMs });

    /**
     * 7 game đợt hai mở rộng (CR-014), mọi game vòng 60 s, không game nào có hạn trả lời. Hệ số Mầm
     * và Siêu khó, miễn trừ lấy từ đặc tả từng game:
     * - Tìm bạn (crowd-search.md): 1 / 3,45, không có miễn trừ.
     * - Giỏ hời nhất (best-basket.md): 0,85 / 1,65, miễn trừ theo số món và số luật (`basketAllowance`).
     * - Rót vừa vạch (pour-line.md): 1 / 2,55, miễn trừ = `holdMinMs` của câu (`pourAllowance`).
     * - Hình to hình nhỏ (navon-shapes.md): 1 / 3, không có miễn trừ.
     * - Nhại nhịp (rhythm-echo.md): 1 / 2,7, miễn trừ = pha nghe + độ dài câu nhịp (`rhythmAllowance`).
     * - Cổng luật (rule-gate.md): 1 / 2,4, không có miễn trừ.
     * - Đường số (number-path.md): 1 / 1,95, không có miễn trừ.
     */
    const CR014_CASES: ServerCase[] = [
      {
        id: "crowd-search",
        durationMs: 60_000,
        seedling: [0, 150],
        expert: [0, 395],
        junk: [30], // 30 bạn ở Siêu khó: ô 0–29.
      },
      {
        id: "best-basket",
        durationMs: 60_000,
        seedling: [basketAllowance, 135],
        expert: [basketAllowance, 215],
        junk: [4], // 4 giỏ.
      },
      {
        id: "pour-line",
        durationMs: 60_000,
        seedling: [pourAllowance, 150],
        expert: [pourAllowance, 305],
        // Số ms giữ tay ngoài 0–10 000, số thực, sai kiểu.
        junk: [10_001, 1_000.5, "1000", [1_000], { holdMs: 1_000 }],
      },
      {
        id: "navon-shapes",
        durationMs: 60_000,
        seedling: [0, 150],
        expert: [0, 350],
        junk: [5], // 5 nút ở Siêu khó.
      },
      {
        id: "rhythm-echo",
        durationMs: 60_000,
        seedling: [rhythmAllowance, 150],
        expert: [rhythmAllowance, 320],
        junk: [
          [tap("up", 0)],
          [tap("LEFT", 0)],
          [tap("left", 0.5)],
          [tap("left", -1)],
          [tap("left", 60_001)],
          [tap("left", "0")],
          [tap("left", Number.NaN)],
          [tap("left", null)],
          [{ side: "left" }],
          [{ atMs: 0 }],
          [["left", 0]],
          [tap("left", 0), null],
          [tap("left", 0), 300],
          // `atMs` giảm dần.
          [tap("left", 300), tap("right", 200)],
          // 7 tiếng, dài hơn câu nhịp dài nhất (6 tiếng).
          Array.from({ length: 7 }, (_, k) => tap(k % 2 === 0 ? "left" : "right", k * 300)),
        ],
      },
      {
        id: "rule-gate",
        durationMs: 60_000,
        seedling: [0, 150],
        expert: [0, 290],
        junk: ["IN", "Out", "", "in ", "yes", ["in"], { answer: "in" }, 0, 1],
      },
      {
        id: "number-path",
        durationMs: 60_000,
        seedling: [0, 150],
        expert: [0, 245],
        junk: [4], // 4 đường ở Siêu khó.
      },
    ];

    /** Đáp án rác client sửa đổi có thể gửi (msgpack giữ nguyên NaN, vô cực, số thực). */
    const JUNK_COMMON: unknown[] = [
      null,
      "0",
      true,
      {},
      [[0]],
      { 0: 0, length: 1 },
      Number.NaN,
      Number.POSITIVE_INFINITY,
      -1,
      0.5,
    ];
    const JUNK_NUMBER: unknown[] = [...JUNK_COMMON, [0], 99, 2 ** 31];
    const JUNK_ARRAY: unknown[] = [
      ...JUNK_COMMON,
      0,
      [],
      [0.5],
      [Number.NaN],
      [Number.NEGATIVE_INFINITY],
      [-1],
      [99],
      ["0"],
      [null],
      [0, 1, 2, 3, 4, 5],
    ];

    /**
     * Đóng băng giờ server (`Date.now`) để thời gian trả lời, và do đó điểm, tất định. Gọi SAU khi
     * tạo phòng: đồng hồ hẹn giờ của room đã giữ `Date.now` gốc nên vẫn chạy theo giờ thật.
     */
    function freezeNow() {
      let now = Date.now();
      const spy = vi.spyOn(Date, "now").mockImplementation(() => now);
      return {
        get: () => now,
        set: (t: number) => {
          now = t;
        },
        restore: () => spy.mockRestore(),
      };
    }

    /** Chờ server xử lý hết các tin đã gửi trước đó (server xử lý tin của một máy theo thứ tự). */
    async function barrier(client: TestClient) {
      const pong = nextMessage(client, ServerMessage.Pong);
      client.send(ClientMessage.Ping, { clientTime: 0 });
      await pong;
    }

    /**
     * Chơi lần lượt từng game trong `cases` (mỗi game một vòng): kiểm thời lượng vòng, điểm câu đầu
     * ở Mầm và Siêu khó, chặn đáp án rác, không lặp game. Số game ≤ MAX_TOTAL_ROUNDS.
     */
    async function playCases(cases: ServerCase[]) {
      const { room, clients, host } = await setup(
        ["An", "Bình"],
        [{ difficulty: 3 }, { difficulty: 0 }],
      );
      const guest = clients[1] as TestClient;
      host.send(ClientMessage.SetRounds, { totalRounds: cases.length });
      await until(() => room.state.totalRounds === cases.length);
      await toGameSelect(room, clients);

      const clock = freezeNow();
      try {
        const played: GameId[] = [];
        for (const c of cases) {
          const solve = SOLVE[c.id];
          if (!solve) throw new Error(`Thiếu cách giải ${c.id}`);
          host.send(ClientMessage.PickGame, { gameId: c.id });
          await until(() => room.state.phase === "game-intro");
          const started = nextMessage<RoundStartPayload>(guest, ServerMessage.RoundStart);
          await introToPlaying(room, clients);

          // Thời lượng vòng: tin roundStart, state và hẹn giờ hết vòng đều theo game (CR-006).
          expect((await started).durationMs, c.id).toBe(c.durationMs);
          expect(room.state.endsAt - room.state.startAt, c.id).toBe(c.durationMs);
          const active = room.clock.delayed.filter((d) => d.active);
          expect(
            active.map((d) => d.time),
            c.id,
          ).toEqual([c.durationMs + LATE_ANSWER_GRACE_MS]);
          played.push(c.id);
          expect([...room.state.playedGames]).toEqual(played);

          // Câu 0: Mầm rồi Siêu khó, mỗi người trả lời 1 giây sau mốc miễn trừ của mức mình.
          const { seed, startAt, round } = room.state;
          for (const [client, d, [allowance, points]] of [
            [guest, 0, c.seedling],
            [host, 3, c.expert],
          ] as const) {
            const ms = typeof allowance === "function" ? allowance(seed, d) : allowance;
            clock.set(startAt + ms + 1_000);
            const result = nextMessage<AnswerResultPayload>(client, ServerMessage.AnswerResult);
            client.send(ClientMessage.Answer, { round, index: 0, answer: solve(seed, 0, d) });
            expect(await result, `${c.id} mức ${d}`).toEqual({ index: 0, correct: true, points });
          }
          // Chủ phòng (Siêu khó) trả lời sau cùng: câu 1 của chủ phòng bắt đầu từ lúc này.
          const hostShownAt = clock.get();

          // Câu 1 của chủ phòng: gửi rác theo lô ≤ 9 tin mỗi giây (dưới mức chặn 10 tin/giây,
          // để từng tin thật sự tới isAnswer). Rác bị bỏ qua: không có kết quả, không khoá,
          // không sang câu. Sau đó đáp án đúng vẫn được chấm bình thường.
          const junk = Array.isArray(solve(seed, 1, 3)) ? [...JUNK_ARRAY] : [...JUNK_NUMBER];
          if (c.id === "number-balloons") {
            const order = solve(seed, 1, 3) as number[];
            junk.push([order[0], order[0]], [...order, order[0]]);
          }
          if (c.id === "hit-target") {
            // Chọn trùng thẻ, thẻ ngoài lưới 3×3, quá 3 thẻ: đều là rác.
            const [a, b] = solve(seed, 1, 3) as number[];
            junk.push([a, a, b], [a, b, 9], [0, 1, 2, 3]);
          }
          if (c.id === "aim-trainer") {
            // Toạ độ số thực, ngoài khung, thiếu/thừa khoá, sai kiểu, "nửa bỏ lỡ": đều là rác.
            junk.push(
              { x: 0.5, y: 0 },
              { x: 0, y: -1 },
              { x: 1_001, y: 0 },
              { x: 0, y: 1_401 },
              { x: -1, y: 0 },
              { x: 0 },
              { x: 0, y: 0, z: 0 },
              { x: "0", y: 0 },
              { x: Number.NaN, y: 0 },
              [0, 0],
            );
          }
          if (c.id === "chalk-arrows") {
            // Hướng ngoài 0–3: rác.
            junk.push(4, 5, -2);
          }
          if (c.id === "pour-line") {
            // Đáp án là số ms giữ tay (số nguyên 0–10 000): 99 là đáp án thật, không phải rác.
            junk.splice(junk.indexOf(99), 1);
          }
          junk.push(...(c.junk ?? []));
          const results: AnswerResultPayload[] = [];
          const off = host.onMessage(ServerMessage.AnswerResult, (r: AnswerResultPayload) => {
            results.push(r);
          });
          for (let k = 0; k < junk.length; k += 9) {
            clock.set(clock.get() + 1_100);
            for (const answer of junk.slice(k, k + 9)) {
              host.send(ClientMessage.Answer, { round, index: 1, answer });
            }
            await barrier(host);
          }
          off();
          expect(results, `${c.id}: rác không được chấm`).toEqual([]);
          expect(player(room, host).progress).toBe(1);
          expect(player(room, host).streak).toBe(1);

          clock.set(clock.get() + 1_100);
          const result = nextMessage<AnswerResultPayload>(host, ServerMessage.AnswerResult);
          host.send(ClientMessage.Answer, { round, index: 1, answer: solve(seed, 1, 3) });
          const late =
            c.expertWindowMs !== undefined &&
            clock.get() - hostShownAt > c.expertWindowMs + LATE_ANSWER_GRACE_MS;
          if (late) {
            // Game có hạn trả lời: các lô rác (+1,1 s mỗi lô) không gia hạn câu, nên đáp án đúng
            // tới sau hạn bị chấm sai, khoá và mất chuỗi (CR-012).
            expect(await result, c.id).toEqual({
              index: 1,
              correct: false,
              points: 0,
              lockedUntil: clock.get() + WRONG_ANSWER_LOCK_MS,
            });
            expect(player(room, host).streak).toBe(0);
          } else {
            expect(await result, c.id).toMatchObject({ index: 1, correct: true });
          }
          expect(player(room, host).progress).toBe(2);

          // Hết vòng đúng mốc của game: 100 ms trước vẫn đang chơi, 100 ms sau sang bảng điểm.
          const end = room.clock.delayed.find((d) => d.active);
          if (!end) throw new Error("Không còn hẹn giờ hết vòng");
          advance(room, end.time - end.elapsedTime - 100);
          expect(room.state.phase, c.id).toBe("playing");
          advance(room, 200);
          expect(room.state.phase, c.id).toBe("round-results");

          if (played.length < cases.length) {
            host.send(ClientMessage.NextRound, {});
            await until(() => room.state.phase === "game-select");
          }
        }
      } finally {
        clock.restore();
      }
    }

    it("mỗi game: thời lượng vòng riêng, điểm theo hệ số + miễn trừ của game, chặn đáp án rác, không lặp game", async () => {
      await playCases(CASES);
    }, 30_000);

    it("9 game GĐ 2–3: thời lượng vòng, điểm theo hệ số + miễn trừ trong đặc tả, chặn đáp án rác", async () => {
      expect(NEW_CASES.length).toBeLessThanOrEqual(MAX_TOTAL_ROUNDS);
      await playCases(NEW_CASES);
    }, 45_000);

    it("game GĐ 4 (CR-012): thời lượng vòng, điểm theo hệ số trong đặc tả, chặn đáp án rác, rác không gia hạn câu", async () => {
      expect(CR012_CASES.length).toBeLessThanOrEqual(MAX_TOTAL_ROUNDS);
      await playCases(CR012_CASES);
    }, 30_000);

    it("7 game CR-013: thời lượng vòng, điểm theo hệ số + miễn trừ trong đặc tả, chặn đáp án rác", async () => {
      expect(CR013_CASES.length).toBeLessThanOrEqual(MAX_TOTAL_ROUNDS);
      await playCases(CR013_CASES);
    }, 45_000);

    it("7 game CR-014: thời lượng vòng, điểm theo hệ số + miễn trừ trong đặc tả, chặn đáp án rác", async () => {
      expect(CR014_CASES.length).toBeLessThanOrEqual(MAX_TOTAL_ROUNDS);
      await playCases(CR014_CASES);
    }, 45_000);

    it("Luyện ngắm: đáp án đúng trong hạn được tính, muộn 1 ms bị chấm sai và khoá; hạn tính lại sau khoá", async () => {
      const LIFE_MS = 1_500; // Thường (aim-trainer.md); Mầm không giới hạn.
      const { room, clients, host } = await setup(
        ["An", "Bình"],
        [{ difficulty: 1 }, { difficulty: 0 }],
      );
      const guest = clients[1] as TestClient;
      await toGameSelect(room, clients);
      host.send(ClientMessage.PickGame, { gameId: "aim-trainer" });
      await until(() => room.state.phase === "game-intro");
      await introToPlaying(room, clients);

      const clock = freezeNow();
      try {
        const { seed, startAt, round } = room.state;
        const target = (i: number, d: Difficulty) => SOLVE["aim-trainer"](seed, i, d);
        async function send(client: TestClient, index: number, answer: unknown, at: number) {
          clock.set(at);
          const result = nextMessage<AnswerResultPayload>(client, ServerMessage.AnswerResult);
          client.send(ClientMessage.Answer, { round, index, answer });
          return result;
        }
        const edge = LIFE_MS + LATE_ANSWER_GRACE_MS;

        // Câu 0: đúng ngay mốc hạn + dung sai → vẫn đúng.
        const first = await send(host, 0, target(0, 1), startAt + edge);
        expect(first).toMatchObject({ index: 0, correct: true });
        expect(first.points).toBeGreaterThan(0);

        // Câu 1: bắt đầu lúc server nhận câu 0; đúng chỗ nhưng muộn 1 ms → sai, khoá, mất chuỗi.
        const shown1 = startAt + edge;
        const lateAt = shown1 + edge + 1;
        expect(await send(host, 1, target(1, 1), lateAt)).toEqual({
          index: 1,
          correct: false,
          points: 0,
          lockedUntil: lateAt + WRONG_ANSWER_LOCK_MS,
        });
        expect(player(room, host).streak).toBe(0);
        expect(player(room, host).progress).toBe(2);
        expect(player(room, host).roundScore).toBe(first.points);

        // Câu 2: hạn tính từ lúc hết khoá, nên đúng ngay mốc đó vẫn được tính.
        const shown2 = lateAt + WRONG_ANSWER_LOCK_MS;
        expect(await send(host, 2, target(2, 1), shown2 + edge)).toMatchObject({
          index: 2,
          correct: true,
        });

        // Câu 3: "bỏ lỡ" gửi trong hạn vẫn là sai.
        const shown3 = shown2 + edge;
        expect(await send(host, 3, AIM_TRAINER_MISS, shown3 + 500)).toMatchObject({
          index: 3,
          correct: false,
          points: 0,
        });

        // Mầm không có hạn: đúng sau 30 giây vẫn được tính.
        expect(await send(guest, 0, target(0, 0), startAt + 30_000)).toMatchObject({
          index: 0,
          correct: true,
        });
      } finally {
        clock.restore();
      }
    });

    it("Luyện ngắm: rớt mạng rồi nối lại giữa vòng thì hạn câu đang làm tính lại từ lúc nối lại", async () => {
      const LIFE_MS = 1_500; // Thường (aim-trainer.md).
      const { room, clients, host } = await setup(["An", "Bình"], [{ difficulty: 1 }]);
      await toGameSelect(room, clients);
      host.send(ClientMessage.PickGame, { gameId: "aim-trainer" });
      await until(() => room.state.phase === "game-intro");
      await introToPlaying(room, clients);

      const clock = freezeNow();
      try {
        const { seed, startAt, round } = room.state;
        const edge = LIFE_MS + LATE_ANSWER_GRACE_MS;
        async function send(client: TestClient, index: number, at: number) {
          clock.set(at);
          const result = nextMessage<AnswerResultPayload>(client, ServerMessage.AnswerResult);
          client.send(ClientMessage.Answer, {
            round,
            index,
            answer: SOLVE["aim-trainer"](seed, index, 1),
          });
          return result;
        }

        expect(await send(host, 0, startAt + 200)).toMatchObject({ index: 0, correct: true });
        // Mất kết nối 10 giây (lâu hơn hẳn hạn bia), nối lại rồi chạm đúng ngay mốc hạn mới.
        const backAt = startAt + 200 + 10_000;
        clock.set(backAt);
        const back = await reload(room, host);
        expect(await send(back, 1, backAt + edge)).toMatchObject({ index: 1, correct: true });
      } finally {
        clock.restore();
      }
    });

    /**
     * Vào vòng của game đáp án đo ở client (ADR 0013) với bốn người, mỗi người một mức (dung sai
     * khác nhau theo mức), đóng băng giờ server. `send` gửi câu kế của một người 2 giây sau câu trước
     * (lâu hơn khoá 1,5 s sau câu sai) và chờ kết quả.
     */
    async function playClientTimed(gameId: GameId) {
      const { room, clients, host } = await setup(
        ["An", "Bình", "Chi", "Dũng"],
        [{ difficulty: 3 }, { difficulty: 0 }, { difficulty: 1 }, { difficulty: 2 }],
      );
      await toGameSelect(room, clients);
      host.send(ClientMessage.PickGame, { gameId });
      await until(() => room.state.phase === "game-intro");
      await introToPlaying(room, clients);
      const clock = freezeNow();
      const { seed, startAt, round } = room.state;
      const lastAt = new Map<TestClient, number>();
      async function send(client: TestClient, index: number, answer: unknown) {
        const at = (lastAt.get(client) ?? startAt) + 2_000;
        lastAt.set(client, at);
        clock.set(at);
        const result = nextMessage<AnswerResultPayload>(client, ServerMessage.AnswerResult);
        client.send(ClientMessage.Answer, { round, index, answer });
        return { result: await result, at };
      }
      const seats = clients.map((client) => ({
        client,
        d: player(room, client).difficulty as Difficulty,
      }));
      return { room, seats, seed, clock, send };
    }

    it("Rót vừa vạch (ADR 0013): đúng số ms tham chiếu và hai mép khoảng đúng, lệch ra ngoài 1 ms là sai", async () => {
      const { room, seats, seed, clock, send } = await playClientTimed("pour-line");
      try {
        // Điểm câu đúng ở Mầm / Thường / Khó / Siêu khó khi trọn thưởng tốc độ, chuỗi 0: 100 × hệ số + 50.
        const fullPoints: Record<Difficulty, number> = { 0: 150, 1: 150, 2: 190, 3: 305 };
        for (const { client, d } of seats) {
          const puzzle = (i: number) => GAMES["pour-line"].generate(seed, i, d);
          // Độ lệch mức nước so với vạch khi giữ `holdMs`, tính lại độc lập với server.
          const miss = (i: number, holdMs: number) => {
            const p = puzzle(i);
            return Math.abs(pourLineLevelAt(p, holdMs) - p.target) - p.tol;
          };
          const label = `pour-line mức ${d}`;

          // Câu 0: đúng số ms tham chiếu → đúng.
          const ideal = SOLVE["pour-line"](seed, 0, d) as number;
          expect(miss(0, ideal), label).toBeLessThanOrEqual(0);
          expect((await send(client, 0, ideal)).result, label).toMatchObject({ correct: true });

          // Câu 1: buông muộn 1 ms sau mép trên → mực nước vượt dung sai → sai, khoá, mất chuỗi.
          const over = puzzle(1).holdMaxMs + 1;
          expect(miss(1, over), label).toBeGreaterThan(0);
          const late = await send(client, 1, over);
          expect(late.result, label).toEqual({
            index: 1,
            correct: false,
            points: 0,
            lockedUntil: late.at + WRONG_ANSWER_LOCK_MS,
          });
          expect(player(room, client).streak, label).toBe(0);

          // Câu 2: buông sớm 1 ms trước mép dưới → sai.
          const under = puzzle(2).holdMinMs - 1;
          expect(miss(2, under), label).toBeGreaterThan(0);
          expect((await send(client, 2, under)).result, label).toMatchObject({ correct: false });

          // Câu 3, 4: đúng mép dưới, đúng mép trên → đúng (hai đầu đều tính).
          expect((await send(client, 3, puzzle(3).holdMinMs)).result, label).toMatchObject({
            correct: true,
          });
          expect((await send(client, 4, puzzle(4).holdMaxMs)).result, label).toMatchObject({
            correct: true,
          });

          // Câu 5: giữ tới khi tràn (FE tự buông ở `fullMs`) → sai.
          expect((await send(client, 5, puzzle(5).fullMs)).result, label).toMatchObject({
            correct: false,
          });

          // Câu 6: tới server chỉ 100 ms sau khi câu bắt đầu (hết khoá câu 5) mà giữ tận mép trên:
          // server không kiểm thời gian vật lý tối thiểu (ADR 0013, mục 2), và số ms client đo
          // không vào công thức điểm: điểm theo giờ server, trọn thưởng tốc độ.
          const at = clock.get() + WRONG_ANSWER_LOCK_MS + 100;
          clock.set(at);
          const result = nextMessage<AnswerResultPayload>(client, ServerMessage.AnswerResult);
          client.send(ClientMessage.Answer, {
            round: room.state.round,
            index: 6,
            answer: puzzle(6).holdMaxMs,
          });
          expect(await result, label).toEqual({ index: 6, correct: true, points: fullPoints[d] });
          expect(player(room, client).progress, label).toBe(7);
        }
      } finally {
        clock.restore();
      }
    });

    it("Nhại nhịp (ADR 0013): chỉ chấm mặt trống và khoảng cách, dời cả chuỗi vẫn đúng, lệch quá dung sai là sai", async () => {
      const { room, seats, seed, clock, send } = await playClientTimed("rhythm-echo");
      try {
        for (const { client, d } of seats) {
          const puzzle = (i: number) => GAMES["rhythm-echo"].generate(seed, i, d);
          const solved = (i: number) => SOLVE["rhythm-echo"](seed, i, d) as RhythmEchoHit[];
          /** Dời các tiếng từ vị trí `from` trở đi thêm `by` ms (đổi đúng khoảng `from − 1 → from`). */
          const shiftFrom = (hits: RhythmEchoHit[], from: number, by: number) =>
            hits.map((h, k) => ({ ...h, atMs: k >= from ? h.atMs + by : h.atMs }));
          const label = `rhythm-echo mức ${d}`;
          const verdict = async (index: number, answer: RhythmEchoHit[]) =>
            (await send(client, index, answer)).result.correct;

          // Câu 0: đúng câu nhịp tham chiếu.
          expect(await verdict(0, solved(0)), label).toBe(true);
          // Câu 1: dời cả chuỗi 1 234 ms (lần gõ đầu không phải 0) → vẫn đúng.
          expect(await verdict(1, shiftFrom(solved(1), 0, 1_234)), label).toBe(true);
          // Câu 2: khoảng đầu dài thêm đúng `tolMs` → đúng (mép dung sai tính đúng).
          expect(await verdict(2, shiftFrom(solved(2), 1, puzzle(2).tolMs)), label).toBe(true);
          // Câu 3: khoảng đầu dài thêm `tolMs + 1` → sai.
          expect(await verdict(3, shiftFrom(solved(3), 1, puzzle(3).tolMs + 1)), label).toBe(false);
          // Câu 4: khoảng cuối ngắn đi `tolMs + 1` → sai.
          const last4 = puzzle(4).hits.length - 1;
          expect(await verdict(4, shiftFrom(solved(4), last4, -(puzzle(4).tolMs + 1))), label).toBe(
            false,
          );
          // Câu 5: mọi khoảng cùng dài thêm `tolMs` (trôi nhịp cộng dồn) → vẫn đúng, không kiểm trôi.
          const tol5 = puzzle(5).tolMs;
          const drift = solved(5).map((h, k) => ({ ...h, atMs: h.atMs + k * tol5 }));
          expect(await verdict(5, drift), label).toBe(true);
          // Câu 6: đúng nhịp nhưng tiếng cuối sai mặt trống → sai.
          const flipped = solved(6).map(
            (h, k, all): RhythmEchoHit =>
              k === all.length - 1 ? { ...h, side: h.side === "left" ? "right" : "left" } : h,
          );
          expect(await verdict(6, flipped), label).toBe(false);
          // Câu 7: thiếu tiếng cuối (client gửi ngay khi quá hạn tiếng kế) → sai.
          expect(await verdict(7, solved(7).slice(0, -1)), label).toBe(false);
          expect(player(room, client).progress, label).toBe(8);
        }
      } finally {
        clock.restore();
      }
    });

    it("mọi game trong danh mục đều có cách giải và số liệu kiểm trên server", () => {
      const covered = [...CASES, ...NEW_CASES, ...CR012_CASES, ...CR013_CASES, ...CR014_CASES]
        .map((c) => c.id)
        .sort();
      expect(covered).toEqual([...GAME_IDS].sort());
      for (const id of GAME_IDS) expect(SOLVE[id], id).toBeTypeOf("function");
    });

    it("combo có trần × 1,5 khi chấm thật trên server: câu đúng liên tiếp thứ 7, 8 cùng × 1,5", async () => {
      const { room, clients, host } = await setup(["An", "Bình"], [{ difficulty: 1 }]);
      await toPlaying(room, clients);
      const clock = freezeNow();
      try {
        const points: number[] = [];
        for (let i = 0; i < 8; i++) {
          // Mỗi câu trả lời 1 giây sau câu trước → trọn thưởng tốc độ: (100 + 50) × combo.
          clock.set(room.state.startAt + (i + 1) * 1_000);
          points.push((await answerCorrectly(room, host)).points);
        }
        expect(points).toEqual([150, 150, 165, 180, 195, 210, 225, 225]);
      } finally {
        clock.restore();
      }
    });
  });
});
