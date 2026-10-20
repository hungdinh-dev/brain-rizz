import {
  CHAT_HISTORY_SIZE,
  CHAT_MAX_LENGTH,
  type ChatHistoryPayload,
  type ChatMessagePayload,
  ClientMessage,
  COUNTDOWN_MS,
  type ErrorPayload,
  type GameId,
  getGame,
  type JoinOptions,
  LATE_ANSWER_GRACE_MS,
  ROOM_NAME,
  ServerMessage,
} from "@brain-rizz/shared";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import appConfig from "../src/app.config";
import { ChatRelay, type ChatSender } from "../src/rooms/ChatRelay";
import type { PartyRoom } from "../src/rooms/PartyRoom";
import { advance, freezeNow, settle, until } from "./helpers";

/** Chat real-time trong phòng party (CR-011). */

let colyseus: ColyseusTestServer<typeof appConfig>;

type SdkRoom = Awaited<ReturnType<ColyseusTestServer<typeof appConfig>["sdk"]["joinById"]>>;

/** Một máy trong phòng, ghi lại mọi tin chat / lịch sử / lỗi nhận được. */
interface Peer {
  room: SdkRoom;
  chats: ChatMessagePayload[];
  histories: ChatHistoryPayload[];
  errors: ErrorPayload[];
}

/**
 * Gắn handler NGAY khi SDK trả phòng (trước khi chờ state): lịch sử chat được server gửi
 * ngay sau state đầu tiên nên phải nghe sẵn.
 */
function attach(room: SdkRoom): Peer {
  const peer: Peer = { room, chats: [], histories: [], errors: [] };
  room.onMessage(ServerMessage.Chat, (m: ChatMessagePayload) => peer.chats.push(m));
  room.onMessage(ServerMessage.ChatHistory, (m: ChatHistoryPayload) => peer.histories.push(m));
  room.onMessage(ServerMessage.Error, (m: ErrorPayload) => peer.errors.push(m));
  for (const type of [ServerMessage.RoundStart, ServerMessage.AnswerResult, ServerMessage.Pong]) {
    room.onMessage(type, () => {});
  }
  return peer;
}

async function join(room: PartyRoom, name: string, opts: Partial<JoinOptions> = {}) {
  const sdkRoom = await colyseus.sdk.joinById(room.roomId, { name, ...opts });
  const peer = attach(sdkRoom);
  await sdkRoom.waitForInitialState();
  await until(() => peer.histories.length === 1);
  return peer;
}

async function setup(names: string[], opts: Partial<JoinOptions>[] = []) {
  const room = (await colyseus.createRoom(ROOM_NAME, {})) as PartyRoom;
  const peers: Peer[] = [];
  for (const [i, name] of names.entries()) peers.push(await join(room, name, opts[i]));
  return { room, peers };
}

/** Rớt kết nối rồi nối lại bằng reconnection token; `whileAway` chạy lúc đang mất kết nối. */
async function reload(room: PartyRoom, peer: Peer, whileAway?: () => Promise<void>) {
  const id = peer.room.sessionId;
  const token = peer.room.reconnectionToken;
  peer.room.reconnection.enabled = false;
  await peer.room.leave(false);
  await until(() => room.state.players.get(id)?.connected === false);
  await whileAway?.();
  const back = attach((await colyseus.sdk.reconnect(token)) as unknown as SdkRoom);
  await until(() => room.state.players.get(id)?.connected === true);
  await until(() => back.histories.length === 1);
  return back;
}

const say = (peer: Peer, text: string) =>
  peer.room.send(ClientMessage.Chat, { kind: "text", text });

/** Gửi một tin và chờ server trả lỗi đúng mã; không ai nhận tin chat mới. */
async function expectChatError(peer: Peer, code: ErrorPayload["code"], payload: unknown) {
  const errors = peer.errors.length;
  const chats = peer.chats.length;
  peer.room.send(ClientMessage.Chat, payload);
  await until(() => peer.errors.length === errors + 1);
  expect(peer.errors.at(-1)?.code).toBe(code);
  // Lỗi của tin chat luôn gắn nguồn để client không nhầm với lệnh khác đang chờ.
  expect(peer.errors.at(-1)?.source).toBe("chat");
  await settle();
  expect(peer.chats.length).toBe(chats);
}

async function toPhase(room: PartyRoom, peers: Peer[], phase: "countdown" | "playing") {
  for (const p of peers) p.room.send(ClientMessage.Ready, { ready: true });
  await until(() => [...room.state.players.values()].every((p) => p.ready));
  peers[0]?.room.send(ClientMessage.StartMatch, {});
  await until(() => room.state.phase === "game-select");
  peers[0]?.room.send(ClientMessage.PickGame, { gameId: "odd-one-out" });
  await until(() => room.state.phase === "game-intro");
  for (const p of peers.slice(1)) p.room.send(ClientMessage.IntroReady, { ready: true });
  await until(() => [...room.state.players.values()].every((p) => p.isHost || p.introReady));
  peers[0]?.room.send(ClientMessage.StartRound, {});
  await until(() => room.state.phase === "countdown");
  if (phase === "playing") {
    advance(room, COUNTDOWN_MS);
    expect(room.state.phase).toBe("playing");
  }
}

function finishRound(room: PartyRoom) {
  advance(room, getGame(room.state.gameId as GameId).durationMs + LATE_ANSWER_GRACE_MS);
  expect(room.state.phase).toBe("round-results");
}

describe("PartyRoom — chat (CR-011)", () => {
  let clock: ReturnType<typeof freezeNow> | null = null;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
  });
  afterAll(async () => {
    await colyseus.shutdown();
  });
  beforeEach(async () => {
    await colyseus.cleanup();
  });
  afterEach(() => {
    clock?.restore();
    clock = null;
  });

  it("phát cho cả phòng; tên, màu, nhân vật do server gắn, bỏ qua danh tính client tự khai", async () => {
    const { room, peers } = await setup(["An", "Bình"], [{ avatar: "bo", colorIndex: 2 }]);
    const [a, b] = peers as [Peer, Peer];
    expect(a.histories[0]).toEqual({ messages: [] });

    a.room.send(ClientMessage.Chat, {
      kind: "text",
      text: "  xin   chào ",
      name: "Giả mạo",
      playerId: b.room.sessionId,
      colorIndex: 7,
    });
    await until(() => a.chats.length === 1 && b.chats.length === 1);
    const msg = b.chats[0];
    expect(msg).toMatchObject({
      id: 1,
      playerId: a.room.sessionId,
      name: "An",
      colorIndex: 2,
      avatar: "bo",
      kind: "text",
      text: "xin chào",
    });
    expect(msg?.quickId).toBeUndefined();
    expect(typeof msg?.at).toBe("number");
    expect(a.chats[0]).toEqual(msg);

    b.room.send(ClientMessage.Chat, { kind: "quick", id: "fire" });
    await until(() => a.chats.length === 2);
    expect(a.chats[1]).toMatchObject({
      id: 2,
      playerId: b.room.sessionId,
      name: "Bình",
      kind: "quick",
      quickId: "fire",
    });
    expect(a.chats[1]?.text).toBeUndefined();

    // Nội dung chat không nằm trong state đồng bộ.
    expect(JSON.stringify(room.state.toJSON())).not.toContain("xin chào");
  });

  it("sai schema → invalid: biểu cảm lạ, thiếu kind, chữ quá dài", async () => {
    const { peers } = await setup(["An"]);
    const [a] = peers as [Peer];
    await expectChatError(a, "invalid", { kind: "quick", id: "poop" });
    await expectChatError(a, "invalid", { text: "chào" });
    await expectChatError(a, "invalid", { kind: "text", text: "a".repeat(481) });
    await expectChatError(a, "invalid", { kind: "text", text: "   \n " });
  });

  it("lọc từ tục thành *** và cắt còn 120 ký tự", async () => {
    const { peers } = await setup(["An", "Bình"]);
    const [a, b] = peers as [Peer, Peer];
    say(a, "đồ c.ặ.c, F U C K, vcl");
    await until(() => b.chats.length === 1);
    expect(b.chats[0]?.text).toBe("đồ ***, ***, ***");

    say(a, `${"😂".repeat(100)}${"a".repeat(100)}`);
    await until(() => b.chats.length === 2);
    const text = b.chats[1]?.text ?? "";
    expect(Array.from(text)).toHaveLength(CHAT_MAX_LENGTH);
    expect(text).toBe(`${"😂".repeat(100)}${"a".repeat(20)}`);
  });

  it("giới hạn tần suất: cụm 3 tin, tin thứ 4 bị rate-limited, hồi 1 tin mỗi giây; mỗi người riêng", async () => {
    const { peers } = await setup(["An", "Bình"]);
    const [a, b] = peers as [Peer, Peer];
    clock = freezeNow();
    for (let i = 1; i <= 4; i++) say(a, `tin ${i}`);
    await until(() => a.errors.length === 1 && b.chats.length === 3);
    expect(a.errors[0]).toMatchObject({ code: "rate-limited", source: "chat" });
    expect(b.chats.map((m) => m.text)).toEqual(["tin 1", "tin 2", "tin 3"]);

    // Người khác vẫn gửi được.
    say(b, "mình nữa");
    await until(() => a.chats.length === 4);

    await expectChatError(a, "rate-limited", { kind: "quick", id: "gg" });
    clock.set(clock.get() + 1_000);
    say(a, "tin 5");
    await until(() => b.chats.length === 5);
    expect(b.chats[4]?.text).toBe("tin 5");
  });

  it("chỉ chủ phòng bật/tắt chat; chat tắt → chat-disabled; cờ giữ qua Chơi lại / Về phòng chờ", async () => {
    const { room, peers } = await setup(["An", "Bình"]);
    const [a, b] = peers as [Peer, Peer];
    expect(room.state.chatEnabled).toBe(true);

    b.room.send(ClientMessage.SetChatEnabled, { enabled: false });
    await until(() => b.errors.length === 1);
    expect(b.errors[0]).toMatchObject({ code: "not-host", source: "chat" });
    expect(room.state.chatEnabled).toBe(true);

    // Lỗi của lệnh không phải chat thì không gắn nguồn (client vẫn mở khoá nút + toast).
    b.room.send(ClientMessage.SetRounds, { totalRounds: 3 });
    await until(() => b.errors.length === 2);
    expect(b.errors[1]?.code).toBe("not-host");
    expect(b.errors[1]).not.toHaveProperty("source");

    a.room.send(ClientMessage.SetChatEnabled, { enabled: "off" });
    await until(() => a.errors.length === 1);
    expect(a.errors[0]).toMatchObject({ code: "invalid", source: "chat" });

    a.room.send(ClientMessage.SetChatEnabled, { enabled: false });
    await until(() => !room.state.chatEnabled);
    await expectChatError(b, "chat-disabled", { kind: "text", text: "alo" });
    await expectChatError(a, "chat-disabled", { kind: "quick", id: "clap" });

    // Một trận 1 vòng: podium → Chơi lại → hết vòng → Về phòng chờ, cờ vẫn tắt.
    a.room.send(ClientMessage.SetRounds, { totalRounds: 1 });
    await until(() => room.state.totalRounds === 1);
    await toPhase(room, peers, "playing");
    finishRound(room);
    a.room.send(ClientMessage.NextRound, {});
    await until(() => room.state.phase === "podium");
    a.room.send(ClientMessage.PlayAgain, {});
    await until(() => room.state.phase === "game-select");
    expect(room.state.chatEnabled).toBe(false);
    a.room.send(ClientMessage.PickGame, { gameId: "balance" });
    await until(() => room.state.phase === "game-intro");
    b.room.send(ClientMessage.IntroReady, { ready: true });
    await until(() => [...room.state.players.values()].every((p) => p.isHost || p.introReady));
    a.room.send(ClientMessage.StartRound, {});
    await until(() => room.state.phase === "countdown");
    advance(room, COUNTDOWN_MS);
    finishRound(room);
    a.room.send(ClientMessage.BackToLobby, {});
    await until(() => room.state.phase === "lobby");
    expect(room.state.chatEnabled).toBe(false);

    a.room.send(ClientMessage.SetChatEnabled, { enabled: true });
    await until(() => room.state.chatEnabled);
    say(b, "mở lại rồi");
    await until(() => a.chats.length === 1);
  });

  it("lúc đếm ngược và đang chơi → bad-phase; bảng điểm vòng chat lại được", async () => {
    const { room, peers } = await setup(["An", "Bình"]);
    const [a, b] = peers as [Peer, Peer];
    await toPhase(room, peers, "countdown");
    await expectChatError(a, "bad-phase", { kind: "text", text: "nhanh lên" });
    advance(room, COUNTDOWN_MS);
    expect(room.state.phase).toBe("playing");
    await expectChatError(b, "bad-phase", { kind: "quick", id: "hurry" });
    finishRound(room);
    say(b, "GG");
    await until(() => a.chats.length === 1);
    expect(a.chats[0]?.text).toBe("GG");
  });

  it(`giữ đúng ${CHAT_HISTORY_SIZE} tin mới nhất, gửi cho người vào sau và người nối lại`, async () => {
    const { room, peers } = await setup(["An", "Bình"]);
    const [a, b] = peers as [Peer, Peer];
    clock = freezeNow();
    const total = CHAT_HISTORY_SIZE + 5;
    for (let i = 1; i <= total; i++) {
      // Mỗi tin cách 1 giây theo giờ server để không vướng giới hạn tần suất.
      clock.set(clock.get() + 1_000);
      say(a, `tin ${i}`);
      await until(() => b.chats.length === i);
    }

    const c = await join(room, "Chi");
    const history = c.histories[0]?.messages ?? [];
    expect(history).toHaveLength(CHAT_HISTORY_SIZE);
    expect(history.map((m) => m.text)).toEqual(
      Array.from({ length: CHAT_HISTORY_SIZE }, (_, k) => `tin ${k + 6}`),
    );
    expect(history.map((m) => m.id)).toEqual(
      Array.from({ length: CHAT_HISTORY_SIZE }, (_, k) => k + 6),
    );

    // Bình mất kết nối; trong lúc đó An nhắn thêm; nối lại thì nhận lịch sử có tin đã lỡ.
    const back = await reload(room, b, async () => {
      clock?.set(clock.get() + 1_000);
      say(a, "lúc Bình vắng");
      await until(() => c.chats.length === 1);
    });
    const after = back.histories[0]?.messages ?? [];
    expect(after).toHaveLength(CHAT_HISTORY_SIZE);
    expect(after.at(-1)).toMatchObject({ id: total + 1, text: "lúc Bình vắng", name: "An" });
    expect(after[0]?.id).toBe(7);

    // Người nối lại chat tiếp bình thường.
    clock.set(clock.get() + 1_000);
    say(back, "mình về rồi");
    await until(() => a.chats.at(-1)?.text === "mình về rồi");
    expect(a.chats.at(-1)?.playerId).toBe(back.room.sessionId);
  });
});

describe("ChatRelay (đơn vị)", () => {
  const an: ChatSender = { id: "an", name: "An", colorIndex: 1, avatar: "bo" };

  it("tin rỗng không được cấp id nhưng vẫn trừ lượt; id tăng liên tục", () => {
    const relay = new ChatRelay();
    expect(relay.accept(an, { kind: "text", text: "một" }, 0)).toMatchObject({
      ok: true,
      message: { id: 1 },
    });
    expect(relay.accept(an, { kind: "text", text: " ​ " }, 0)).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(relay.accept(an, { kind: "quick", id: "gg" }, 0)).toMatchObject({
      ok: true,
      message: { id: 2, kind: "quick", quickId: "gg" },
    });
    // Cụm 3 đã dùng hết (kể cả tin rỗng).
    expect(relay.accept(an, { kind: "text", text: "bốn" }, 0)).toEqual({
      ok: false,
      reason: "rate-limited",
    });
    expect(relay.history().messages.map((m) => m.id)).toEqual([1, 2]);
  });

  it("nhân vật lạ trong PlayerState → nhân vật mặc định, không phát chuỗi tuỳ ý", () => {
    const relay = new ChatRelay();
    const out = relay.accept({ ...an, avatar: "<script>" }, { kind: "quick", id: "fire" }, 0);
    expect(out.ok && out.message.avatar).toBe("khoi");
  });

  it("bộ đệm giữ đúng N tin mới nhất; history() trả bản sao", () => {
    const relay = new ChatRelay(2);
    for (let i = 1; i <= 3; i++) relay.accept(an, { kind: "text", text: `tin ${i}` }, i * 1_000);
    const snap = relay.history();
    expect(snap.messages.map((m) => m.text)).toEqual(["tin 2", "tin 3"]);
    snap.messages.length = 0;
    expect(relay.history().messages).toHaveLength(2);
  });

  it("forget xoá lượt của người rời phòng, tin cũ vẫn trong lịch sử", () => {
    const relay = new ChatRelay();
    for (let i = 0; i < 3; i++) relay.accept(an, { kind: "quick", id: "clap" }, 0);
    expect(relay.accept(an, { kind: "quick", id: "clap" }, 0).ok).toBe(false);
    relay.forget("an");
    expect(relay.accept(an, { kind: "quick", id: "clap" }, 0).ok).toBe(true);
    expect(relay.history().messages).toHaveLength(4);
  });
});
