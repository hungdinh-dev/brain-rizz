import {
  ClientMessage,
  COUNTDOWN_MS,
  getGame,
  ROOM_NAME,
  type RoundStartPayload,
  ServerMessage,
} from "@brain-rizz/shared";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import appConfig from "../src/app.config";

describe("PartyRoom", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
  });
  afterAll(async () => {
    await colyseus.shutdown();
  });
  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it("tạo phòng với mã 4 ký tự, người đầu tiên là chủ phòng", async () => {
    const room = await colyseus.createRoom(ROOM_NAME, {});
    const a = await colyseus.connectTo(room, { name: "An" });
    const b = await colyseus.connectTo(room, { name: "Bình" });
    await room.waitForNextPatch();

    expect(room.roomId).toMatch(/^[A-Z2-9]{4}$/);
    expect(room.state.code).toBe(room.roomId);
    expect(room.state.hostId).toBe(a.sessionId);
    expect(room.state.players.get(b.sessionId)?.isHost).toBe(false);
  });

  it("từ chối tên không hợp lệ", async () => {
    const room = await colyseus.createRoom(ROOM_NAME, {});
    await expect(colyseus.connectTo(room, { name: "" })).rejects.toBeDefined();
  });

  it("chỉ chủ phòng được bắt đầu vòng", async () => {
    const room = await colyseus.createRoom(ROOM_NAME, {});
    await colyseus.connectTo(room, { name: "An" });
    const guest = await colyseus.connectTo(room, { name: "Bình" });

    guest.send(ClientMessage.StartRound, { gameId: "odd-one-out" });
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("lobby");
  });

  it("cả hai máy nhận cùng seed và chấm đúng đáp án", async () => {
    const room = await colyseus.createRoom(ROOM_NAME, {});
    const host = await colyseus.connectTo(room, { name: "An", difficulty: 1 });
    const guest = await colyseus.connectTo(room, { name: "Bình", difficulty: 3 });

    const hostStart = new Promise<RoundStartPayload>((resolve) =>
      host.onMessage(ServerMessage.RoundStart, resolve),
    );
    const guestStart = new Promise<RoundStartPayload>((resolve) =>
      guest.onMessage(ServerMessage.RoundStart, resolve),
    );

    host.send(ClientMessage.StartRound, { gameId: "odd-one-out", totalRounds: 1 });
    const [s1, s2] = await Promise.all([hostStart, guestStart]);
    expect(s1.seed).toBe(s2.seed);
    expect(room.state.phase).toBe("countdown");

    await new Promise((r) => setTimeout(r, COUNTDOWN_MS + 50));
    expect(room.state.phase).toBe("playing");

    // Client tự sinh câu đố từ seed rồi gửi đáp án đúng.
    const game = getGame("odd-one-out");
    const puzzle = game.generate(s1.seed, 0, 1);
    const result = new Promise<{ correct: boolean; points: number }>((resolve) =>
      host.onMessage(ServerMessage.AnswerResult, resolve),
    );
    host.send(ClientMessage.Answer, { round: 1, index: 0, answer: puzzle.oddIndex });

    const r = await result;
    expect(r.correct).toBe(true);
    expect(r.points).toBeGreaterThan(0);
    await room.waitForNextPatch();
    expect(room.state.players.get(host.sessionId)?.progress).toBe(1);
  });
});
