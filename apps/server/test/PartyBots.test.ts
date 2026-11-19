import {
  BASE_CHARACTER_IDS,
  BOT_CHAT_DELAY_MS,
  BOT_INTRO_READY_MS,
  type BotLevel,
  type BotYieldedPayload,
  botDifficulty,
  type ChatMessagePayload,
  ClientMessage,
  COUNTDOWN_MS,
  type ErrorPayload,
  type GameId,
  getGame,
  initialJudgeState,
  type JoinOptions,
  type JudgeRound,
  judgeBotAnswer,
  MAX_PLAYERS,
  type NudgePayload,
  planBotAnswer,
  ROOM_NAME,
  ServerMessage,
} from "@brain-rizz/shared";
import { matchMaker } from "colyseus";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PartyRoom } from "../src/rooms/PartyRoom";
import {
  advance,
  bootOnFreePort,
  connectTo,
  freezeNow,
  ignoreServerMessages,
  nextMessage,
  settle,
  type TestServer,
  until,
} from "./helpers";

/** Chơi với bot (CR-016, ADR 0014): ghế, chủ phòng, đóng phòng, bot chơi và chat trên server. */

let colyseus: TestServer;

async function join(room: PartyRoom, name: string, opts: Partial<JoinOptions> = {}) {
  return connectTo(colyseus, room, { name, ...opts });
}
type TestClient = Awaited<ReturnType<typeof join>>;

/** Tạo phòng (kèm bot nếu có) rồi cho người thật vào; người đầu tiên là chủ phòng. */
async function setup(names: string[], bots?: { count: number; level: BotLevel }) {
  const room = (await colyseus.createRoom(ROOM_NAME, bots ? { bots } : {})) as PartyRoom;
  const clients: TestClient[] = [];
  for (const name of names) clients.push(await join(room, name));
  return { room, clients, host: clients[0] as TestClient };
}

const players = (room: PartyRoom) => [...room.state.players.values()];
const bots = (room: PartyRoom) => players(room).filter((p) => p.isBot);
const botIds = (room: PartyRoom) => bots(room).map((p) => p.id);

async function expectError(client: TestClient, code: ErrorPayload["code"], send: () => void) {
  const error = nextMessage<ErrorPayload>(client, ServerMessage.Error);
  send();
  expect((await error).code).toBe(code);
}

function activeTimers(room: PartyRoom) {
  return room.clock.delayed.filter((d) => d.active).length;
}

/** Thu mọi tin chat client nhận được. */
function collectChats(client: TestClient) {
  const chats: ChatMessagePayload[] = [];
  client.onMessage(ServerMessage.Chat, (m: ChatMessagePayload) => chats.push(m));
  return chats;
}

/** Thu mọi tin `botYielded` client nhận được. */
function collectYields(client: TestClient) {
  const yields: BotYieldedPayload[] = [];
  client.onMessage(ServerMessage.BotYielded, (m: BotYieldedPayload) => yields.push(m));
  return yields;
}

/**
 * Như `join` nhưng gắn bộ thu `botYielded` ngay khi SDK trả phòng (trước mọi tin server gửi kèm lúc
 * vào) và chờ `chatHistory`: `onJoin` phát `botYielded` TRƯỚC `chatHistory`, nên `chatHistory` đã
 * tới mà chưa có `botYielded` nghĩa là người vừa vào không nhận tin này.
 */
async function joinWatchingYields(room: PartyRoom, name: string) {
  const client = await colyseus.sdk.joinById(room.roomId, { name });
  const yields: BotYieldedPayload[] = [];
  client.onMessage(ServerMessage.BotYielded, (m: BotYieldedPayload) => yields.push(m));
  const history = nextMessage(client, ServerMessage.ChatHistory);
  ignoreServerMessages(client);
  await client.waitForInitialState();
  await history;
  return { client, yields };
}

/** Phòng chờ → chọn game → hướng dẫn. Bot luôn sẵn sàng nên chỉ người thật bấm. */
async function toGameIntro(room: PartyRoom, clients: TestClient[], gameId: GameId = "odd-one-out") {
  for (const c of clients) c.send(ClientMessage.Ready, { ready: true });
  await until(() => players(room).every((p) => p.ready));
  clients[0]?.send(ClientMessage.StartMatch, {});
  await until(() => room.state.phase === "game-select");
  clients[0]?.send(ClientMessage.PickGame, { gameId });
  await until(() => room.state.phase === "game-intro");
}

/**
 * Tua cả giờ server (`Date.now` đã đóng băng) lẫn đồng hồ hẹn giờ của room từng bước nhỏ, để bot
 * trả lời đủ mọi câu đúng theo kế hoạch (mỗi lần tua chỉ chạy hẹn giờ đã đặt trước đó).
 */
function step(room: PartyRoom, now: ReturnType<typeof freezeNow>, ms: number) {
  now.set(now.get() + ms);
  advance(room, ms);
}

/** Đang ở game-intro: chủ phòng bắt đầu (không chờ bot), tua hết đếm ngược rồi chơi tới hết giờ. */
async function playThrough(room: PartyRoom, host: TestClient, now: ReturnType<typeof freezeNow>) {
  host.send(ClientMessage.StartRound, {});
  await until(() => room.state.phase === "countdown");
  step(room, now, COUNTDOWN_MS);
  expect(room.state.phase).toBe("playing");
  for (let i = 0; i < 1_000 && room.state.phase === "playing"; i++) step(room, now, 200);
  expect(room.state.phase).toBe("round-results");
}

/** Chơi lại vòng vừa xong của bot `botId` bằng chính hàm thuần của shared (mô hình + trọng tài). */
function replayBot(room: PartyRoom, botId: string, level: BotLevel) {
  const gameId = room.state.gameId;
  const round: JudgeRound = {
    playing: true,
    round: room.state.round,
    gameId,
    seed: room.state.seed,
    startAt: room.state.startAt,
    endsAt: room.state.endsAt,
  };
  let state = initialJudgeState();
  let score = 0;
  let correct = 0;
  for (;;) {
    const index = state.progress;
    const plan = planBotAnswer({ level, gameId, roundSeed: round.seed, botId, index });
    const at = (state.shownAt ?? round.startAt) + plan.delayMs;
    if (at > round.endsAt) break;
    const j = judgeBotAnswer(
      round,
      botDifficulty(level),
      state,
      { index, correct: plan.correct },
      at,
    );
    if (!j.outcome) break;
    if (j.outcome.correct) {
      score += j.outcome.points;
      correct += 1;
    }
    state = j.next;
  }
  return { roundScore: score, roundCorrect: correct, progress: state.progress };
}

describe("PartyRoom — chơi với bot (CR-016)", () => {
  let now: ReturnType<typeof freezeNow> | null = null;

  beforeAll(async () => {
    colyseus = await bootOnFreePort();
  });
  afterAll(async () => {
    await colyseus.shutdown();
  });
  beforeEach(async () => {
    await colyseus.cleanup();
  });
  afterEach(() => {
    now?.restore();
    now = null;
    vi.restoreAllMocks();
  });

  describe("tạo phòng và ghế", () => {
    it("tạo phòng kèm bot: bot đủ trường, nhân vật và màu khác nhau, người tạo là chủ phòng", async () => {
      const { room, host } = await setup(["An"], { count: 3, level: 2 });
      expect(botIds(room)).toEqual(["bot-1", "bot-2", "bot-3"]);
      for (const b of bots(room)) {
        expect(b).toMatchObject({
          name: "",
          isBot: true,
          botLevel: 2,
          difficulty: botDifficulty(2),
          ready: true,
          connected: true,
          isHost: false,
        });
      }
      expect(new Set(bots(room).map((b) => b.avatar)).size).toBe(3);
      expect(new Set(players(room).map((p) => p.colorIndex)).size).toBe(4);
      expect(room.state.hostId).toBe(host.sessionId);
      const me = room.state.players.get(host.sessionId);
      expect(me).toMatchObject({ isBot: false, botLevel: 0, isHost: true });
      // Đồng bộ xuống client như PlayerView.
      const json = room.state.toJSON() as { players: Record<string, { isBot: boolean }> };
      expect(json.players["bot-1"]?.isBot).toBe(true);
    });

    it("tùy chọn bots sai thì bỏ như không gửi, phòng vẫn tạo được", async () => {
      for (const bad of [{ count: MAX_PLAYERS, level: 1 }, { count: 2, level: 7 }, "3"]) {
        const room = (await colyseus.createRoom(ROOM_NAME, { bots: bad })) as PartyRoom;
        const a = await join(room, "An");
        expect(players(room).map((p) => p.id)).toEqual([a.sessionId]);
      }
    });

    it("người thật vào phòng đủ ghế thì bot thêm gần nhất nhường chỗ; hết ghế thì không thêm bot được", async () => {
      const { room, host } = await setup(["An"], { count: MAX_PLAYERS - 1, level: 1 });
      expect(room.state.players.size).toBe(MAX_PLAYERS);

      /** `bot-from` … `bot-to`. */
      const range = (from: number, to: number) =>
        Array.from({ length: to - from + 1 }, (_, i) => `bot-${from + i}`);
      const b = await join(room, "Bình");
      expect(room.state.players.size).toBe(MAX_PLAYERS);
      expect(room.state.players.has(b.sessionId)).toBe(true);
      expect(botIds(room)).toEqual(range(1, MAX_PLAYERS - 2));
      // Người vào sau lấy được màu bot vừa nhường.
      expect(new Set(players(room).map((p) => p.colorIndex)).size).toBe(MAX_PLAYERS);

      await expectError(host, "invalid", () => host.send(ClientMessage.AddBot, { level: 0 }));
      expect(room.state.players.size).toBe(MAX_PLAYERS);

      // Bỏ bot-1, thêm bot mới (bot-<MAX_PLAYERS>): người kế tiếp vào thì bot mới (thêm gần nhất)
      // nhường, không phải bot-<MAX_PLAYERS - 2>.
      const fresh = `bot-${MAX_PLAYERS}`;
      host.send(ClientMessage.RemoveBot, { playerId: "bot-1" });
      await until(() => !room.state.players.has("bot-1"));
      host.send(ClientMessage.AddBot, { level: 3 });
      await until(() => room.state.players.has(fresh));
      expect(room.state.players.get(fresh)).toMatchObject({ botLevel: 3, difficulty: 3 });
      await join(room, "Cúc");
      expect(botIds(room)).toEqual(range(2, MAX_PLAYERS - 2));
      expect(room.state.players.size).toBe(MAX_PLAYERS);
    });

    it("Chơi với máy: người tạo giữ màu + nhân vật trong hồ sơ, bot tránh cả hai", async () => {
      // Đủ bot để dùng hết nhân vật còn trống, rồi đủ MAX_PLAYERS ghế (nhân vật phải dùng lại).
      const freeCharacters = BASE_CHARACTER_IDS.length - 1;
      for (const count of [Math.min(freeCharacters, MAX_PLAYERS - 1), MAX_PLAYERS - 1]) {
        // Màu 0 là ca lỗi cũ: bot đầu tiên lấy màu trống từ 0 nên người tạo bị đổi màu.
        for (const [colorIndex, avatar] of [
          [0, "khoi"],
          [5, "bap"],
        ] as const) {
          // Đúng luồng của web: tạo phòng bằng create kèm join options và `bots`.
          const me = ignoreServerMessages(
            await colyseus.sdk.create(ROOM_NAME, {
              name: "An",
              colorIndex,
              avatar,
              bots: { count, level: 1 },
            }),
          );
          await me.waitForInitialState();
          const room = colyseus.getRoomById<PartyRoom>(me.roomId);

          expect(room.state.players.get(me.sessionId)).toMatchObject({
            colorIndex,
            avatar,
            isBot: false,
            isHost: true,
          });
          expect(room.state.hostId).toBe(me.sessionId);
          // Người tạo ngồi ghế đầu, bot theo thứ tự thêm.
          expect(players(room).map((p) => p.id)).toEqual([
            me.sessionId,
            ...Array.from({ length: count }, (_, i) => `bot-${i + 1}`),
          ]);
          expect(bots(room).some((b) => b.colorIndex === colorIndex)).toBe(false);
          expect(new Set(players(room).map((p) => p.colorIndex)).size).toBe(count + 1);
          // Còn nhân vật trống thì bot không lấy nhân vật của người tạo.
          const whileFree = bots(room).slice(0, freeCharacters);
          expect(whileFree.some((b) => b.avatar === avatar)).toBe(false);
          expect(new Set(whileFree.map((b) => b.avatar)).size).toBe(whileFree.length);
          // Bot chỉ dùng 6 nhân vật luôn mở, không dùng thú khoá (CR-024).
          const base: readonly string[] = BASE_CHARACTER_IDS;
          expect(bots(room).every((b) => base.includes(b.avatar))).toBe(true);
          await me.leave();
        }
      }
    });

    it("bot nhường ghế: báo botYielded một lần cho người đã ở trong phòng, không báo người vừa vào", async () => {
      const { room, host } = await setup(["An"], { count: MAX_PLAYERS - 2, level: 1 });
      const hostYields = collectYields(host);

      // Còn ghế: không bot nào nhường, không ai nhận tin; bot lúc tạo phòng không bị thêm lại.
      const b = await join(room, "Bình");
      const guestYields = collectYields(b);
      expect(room.state.players.size).toBe(MAX_PLAYERS);
      expect(bots(room)).toHaveLength(MAX_PLAYERS - 2);

      const newest = bots(room).at(-1);
      expect(newest?.id).toBe(`bot-${MAX_PLAYERS - 2}`);
      const botAvatar = newest?.avatar;
      const toHost = nextMessage<BotYieldedPayload>(host, ServerMessage.BotYielded);
      const toGuest = nextMessage<BotYieldedPayload>(b, ServerMessage.BotYielded);
      // Tên có khoảng trắng hai đầu: payload mang tên đã qua schema (giống state).
      const { client: c, yields: newcomerYields } = await joinWatchingYields(room, "  Cúc ");

      const expected: BotYieldedPayload = {
        botId: `bot-${MAX_PLAYERS - 2}`,
        botAvatar: botAvatar as BotYieldedPayload["botAvatar"],
        playerId: c.sessionId,
        playerName: "Cúc",
      };
      expect(await toHost).toEqual(expected);
      expect(await toGuest).toEqual(expected);
      expect(room.state.players.get(c.sessionId)?.name).toBe("Cúc");
      expect(room.state.players.has(expected.botId)).toBe(false);
      expect(room.state.players.size).toBe(MAX_PLAYERS);

      await settle();
      expect(newcomerYields).toEqual([]);
      expect(hostYields).toEqual([expected]);
      expect(guestYields).toEqual([expected]);
    });
  });

  describe("lệnh bot (FR-PH-20)", () => {
    it("chỉ chủ phòng, chỉ ở phòng chờ; id không phải bot thì invalid; sai schema thì invalid", async () => {
      const { room, clients, host } = await setup(["An", "Bình"]);
      const guest = clients[1] as TestClient;

      host.send(ClientMessage.AddBot, { level: 1 });
      await until(() => bots(room).length === 1);
      host.send(ClientMessage.SetBotLevel, { playerId: "bot-1", level: 3 });
      await until(() => room.state.players.get("bot-1")?.botLevel === 3);
      expect(room.state.players.get("bot-1")?.difficulty).toBe(botDifficulty(3));

      await expectError(guest, "not-host", () => guest.send(ClientMessage.AddBot, { level: 0 }));
      await expectError(guest, "not-host", () =>
        guest.send(ClientMessage.RemoveBot, { playerId: "bot-1" }),
      );
      await expectError(guest, "not-host", () =>
        guest.send(ClientMessage.SetBotLevel, { playerId: "bot-1", level: 0 }),
      );
      // Người thật không phải bot, bot lạ cũng không.
      await expectError(host, "invalid", () =>
        host.send(ClientMessage.RemoveBot, { playerId: guest.sessionId }),
      );
      await expectError(host, "invalid", () =>
        host.send(ClientMessage.SetBotLevel, { playerId: "bot-9", level: 1 }),
      );
      for (const [type, payload] of [
        [ClientMessage.AddBot, { level: 4 }],
        [ClientMessage.AddBot, { level: "1" }],
        [ClientMessage.RemoveBot, {}],
        [ClientMessage.SetBotLevel, { playerId: "bot-1", level: -1 }],
      ] as const) {
        await expectError(host, "invalid", () => host.send(type, payload));
      }
      expect(room.state.players.has(guest.sessionId)).toBe(true);
      expect(bots(room).map((b) => [b.id, b.botLevel])).toEqual([["bot-1", 3]]);

      // Ngoài phòng chờ: bad-phase.
      await toGameIntro(room, clients);
      await expectError(host, "bad-phase", () => host.send(ClientMessage.AddBot, { level: 0 }));
      await expectError(host, "bad-phase", () =>
        host.send(ClientMessage.RemoveBot, { playerId: "bot-1" }),
      );
      await expectError(host, "bad-phase", () =>
        host.send(ClientMessage.SetBotLevel, { playerId: "bot-1", level: 0 }),
      );
      expect(bots(room).map((b) => [b.id, b.botLevel])).toEqual([["bot-1", 3]]);
    });

    it("bỏ bot ở phòng chờ: rời state, phòng chờ vẫn bình thường", async () => {
      const { room, host } = await setup(["An"], { count: 2, level: 0 });
      host.send(ClientMessage.RemoveBot, { playerId: "bot-2" });
      await until(() => bots(room).length === 1);
      expect(botIds(room)).toEqual(["bot-1"]);
    });
  });

  describe("chủ phòng và đóng phòng (FR-PH-23)", () => {
    it("bot không làm chủ phòng: chủ rời thì quyền sang người thật kể cả người đang giữ chỗ", async () => {
      const room = (await colyseus.createRoom(ROOM_NAME, {
        bots: { count: 2, level: 1 },
      })) as PartyRoom;
      const a = await join(room, "An");
      const b = await join(room, "Bình");
      // Bình rớt mạng (đang giữ chỗ), An rời hẳn: quyền sang Bình, không sang bot, phòng không đóng.
      b.reconnection.enabled = false;
      await b.leave(false);
      await until(() => room.state.players.get(b.sessionId)?.connected === false);
      await a.leave();
      await until(() => !room.state.players.has(a.sessionId));
      expect(room.state.hostId).toBe(b.sessionId);
      expect(room.state.players.get(b.sessionId)?.isHost).toBe(true);
      expect(bots(room).every((p) => !p.isHost)).toBe(true);
      expect(matchMaker.getLocalRoomById(room.roomId)).toBeDefined();
    });

    it("người thật cuối cùng rời thì phòng đóng, không còn hẹn giờ của bot", async () => {
      const { room, host } = await setup(["An"], { count: 3, level: 1 });
      const id = room.roomId;
      await toGameIntro(room, [host]);
      expect(activeTimers(room)).toBeGreaterThan(0);
      await host.leave();
      await until(() => matchMaker.getLocalRoomById(id) === undefined);
      expect(room.state.players.size).toBe(0);
      expect(activeTimers(room)).toBe(0);
    });
  });

  describe("bot theo pha", () => {
    it("game-intro: chủ phòng bắt đầu không cần chờ bot; bot tự Đã hiểu sau vài giây, giữ độ khó", async () => {
      const first = await setup(["An"], { count: 2, level: 0 });
      await toGameIntro(first.room, [first.host]);
      expect(bots(first.room).every((b) => !b.introReady)).toBe(true);
      first.host.send(ClientMessage.StartRound, {});
      await until(() => first.room.state.phase === "countdown");

      const { room, clients, host } = await setup(["Bình", "Cúc"], { count: 2, level: 3 });
      await toGameIntro(room, clients);
      advance(room, BOT_INTRO_READY_MS[1]);
      expect(bots(room).every((b) => b.introReady && b.difficulty === botDifficulty(3))).toBe(true);
      // Người thật chưa Đã hiểu thì vẫn phải chờ.
      await expectError(host, "not-ready", () => host.send(ClientMessage.StartRound, {}));
    });

    it("nhắc độ khó: nhắc bot bị từ chối; độ khó đa số chỉ tính người thật", async () => {
      const room = (await colyseus.createRoom(ROOM_NAME, {})) as PartyRoom;
      const a = await join(room, "An", { difficulty: 1 });
      const b = await join(room, "Bình", { difficulty: 3 });
      const c = await join(room, "Cúc", { difficulty: 1 });
      // Ba bot Siêu (độ khó 3): nếu tính cả bot thì đa số là 3.
      for (let i = 0; i < 3; i++) a.send(ClientMessage.AddBot, { level: 3 });
      await until(() => bots(room).length === 3);
      await toGameIntro(room, [a, b, c]);

      await expectError(a, "invalid", () =>
        a.send(ClientMessage.NudgeDifficulty, { playerId: "bot-1" }),
      );
      const nudge = nextMessage<NudgePayload>(b, ServerMessage.Nudge);
      a.send(ClientMessage.NudgeDifficulty, { playerId: b.sessionId });
      expect((await nudge).difficulty).toBe(1);
    });

    it("bot có điểm sau một vòng, đúng bằng mô hình + trọng tài của shared (cùng seed → cùng kết quả)", async () => {
      const { room, host } = await setup(["An"], { count: 3, level: 3 });
      now = freezeNow();
      await toGameIntro(room, [host]);
      await playThrough(room, host, now);

      for (const b of bots(room)) {
        expect({
          roundScore: b.roundScore,
          roundCorrect: b.roundCorrect,
          progress: b.progress,
        }).toEqual(replayBot(room, b.id, 3));
        expect(b.progress).toBeGreaterThan(0);
      }
      expect(bots(room).some((b) => b.roundScore > 0)).toBe(true);
      // Điểm vòng của bot cộng vào điểm trận như người.
      expect(bots(room).every((b) => b.totalScore === b.roundScore)).toBe(true);
      expect(activeTimers(room)).toBeLessThanOrEqual(bots(room).length);
    });

    it("biểu cảm ở bảng điểm: thắng thì khoe, thua thì than, tin có bot: true; tắt chat thì bot im", async () => {
      const { room, host } = await setup(["An"], { count: 2, level: 1 });
      const chats = collectChats(host);
      now = freezeNow();
      host.send(ClientMessage.SetRounds, { totalRounds: 2 });
      await until(() => room.state.totalRounds === 2);
      await toGameIntro(room, [host]);
      // Math.random = 0: mọi bot đều gửi, chọn biểu cảm đầu danh sách, sau thời gian ngắn nhất.
      vi.spyOn(Math, "random").mockReturnValue(0);
      await playThrough(room, host, now);
      const best = Math.max(...players(room).map((p) => p.roundScore));
      advance(room, BOT_CHAT_DELAY_MS[0]);
      await until(() => chats.length === 2);
      for (const m of chats) {
        const b = room.state.players.get(m.playerId);
        expect(b?.isBot).toBe(true);
        expect(m).toMatchObject({ kind: "quick", bot: true, name: "", avatar: b?.avatar });
        expect(m.quickId).toBe(b?.roundScore === best ? "fire" : "shock");
      }

      // Chủ phòng tắt chat: vòng sau bot không gửi gì.
      host.send(ClientMessage.SetChatEnabled, { enabled: false });
      await until(() => !room.state.chatEnabled);
      host.send(ClientMessage.NextRound, {});
      await until(() => room.state.phase === "game-select");
      const next = "rotate-match";
      host.send(ClientMessage.PickGame, { gameId: next });
      await until(() => room.state.phase === "game-intro");
      await playThrough(room, host, now);
      advance(room, BOT_CHAT_DELAY_MS[1]);
      await settle();
      expect(chats).toHaveLength(2);
    });

    it("về phòng chờ giữa trận: hết sạch hẹn giờ của bot; bot ở lại, vẫn sẵn sàng; 1 người + 1 bot chơi lại được", async () => {
      const { room, host } = await setup(["An"], { count: 1, level: 2 });
      now = freezeNow();
      host.send(ClientMessage.SetRounds, { totalRounds: 2 });
      await until(() => room.state.totalRounds === 2);
      await toGameIntro(room, [host]);
      // Không bot nào chat: hết vòng thì không còn hẹn giờ trả lời nào của bot.
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      await playThrough(room, host, now);
      expect(activeTimers(room)).toBe(0);

      host.send(ClientMessage.NextRound, {});
      await until(() => room.state.phase === "game-select");
      host.send(ClientMessage.PickGame, { gameId: "balance" });
      await until(() => room.state.phase === "game-intro");
      vi.spyOn(Math, "random").mockReturnValue(0);
      await playThrough(room, host, now);
      // Bot đang chờ gửi biểu cảm.
      expect(activeTimers(room)).toBeGreaterThan(0);

      host.send(ClientMessage.BackToLobby, {});
      await until(() => room.state.phase === "lobby");
      expect(activeTimers(room)).toBe(0);
      expect(bots(room)).toHaveLength(1);
      expect(bots(room)[0]).toMatchObject({
        ready: true,
        roundScore: 0,
        progress: 0,
        matchPoints: 0,
      });

      // 1 người + 1 bot đủ để bắt đầu và chơi lại (FR-PH-22).
      host.send(ClientMessage.SetRounds, { totalRounds: 1 });
      await until(() => room.state.totalRounds === 1);
      await toGameIntro(room, [host]);
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      await playThrough(room, host, now);
      host.send(ClientMessage.NextRound, {});
      await until(() => room.state.phase === "podium");
      host.send(ClientMessage.PlayAgain, {});
      await until(() => room.state.phase === "game-select");
      expect(bots(room)).toHaveLength(1);
    });
  });

  it("game có hạn trả lời, thời lượng, hệ số và miễn trừ riêng: bot vẫn khớp mô hình của shared", async () => {
    for (const [gameId, level] of [
      ["aim-trainer", 2],
      ["balance", 0],
    ] as const) {
      const { room, host } = await setup(["An"], { count: 2, level });
      now = freezeNow();
      await toGameIntro(room, [host], gameId);
      await playThrough(room, host, now);
      expect(room.state.endsAt - room.state.startAt).toBe(getGame(gameId).durationMs);
      for (const b of bots(room)) expect(b).toMatchObject(replayBot(room, b.id, level));
      now.restore();
      now = null;
    }
  });
});
