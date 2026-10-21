import { type Difficulty, GAMES, type GameId, getGame, ServerMessage } from "@brain-rizz/shared";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { Room } from "colyseus";
import { vi } from "vitest";
import type appConfig from "../src/app.config";

/** Tiện ích dùng chung cho test phòng (PartyRoom, BrainTestRoom). */

/** Đáp án đúng câu `index`: client sinh lại câu đố bằng chính bộ sinh shared rồi giải. */
export const SOLVE: Record<GameId, (seed: number, index: number, d: Difficulty) => unknown> = {
  "odd-one-out": (s, i, d) => GAMES["odd-one-out"].generate(s, i, d).oddIndex,
  "light-trail": (s, i, d) => GAMES["light-trail"].generate(s, i, d).expected,
  balance: (s, i, d) => GAMES.balance.generate(s, i, d).answer,
  "number-balloons": (s, i, d) => GAMES["number-balloons"].generate(s, i, d).order,
  "rotate-match": (s, i, d) => GAMES["rotate-match"].generate(s, i, d).answerIndex,
  "hit-target": (s, i, d) => GAMES["hit-target"].generate(s, i, d).answer,
  "cash-count": (s, i, d) => GAMES["cash-count"].generate(s, i, d).answerIndex,
  "top-view": (s, i, d) => GAMES["top-view"].generate(s, i, d).answerIndex,
  "fold-box": (s, i, d) => GAMES["fold-box"].generate(s, i, d).answerIndex,
  "who-vanished": (s, i, d) => GAMES["who-vanished"].generate(s, i, d).answerIndex,
  "pair-flip": (s, i, d) => GAMES["pair-flip"].generate(s, i, d).answer,
  "cube-count": (s, i, d) => GAMES["cube-count"].generate(s, i, d).answerIndex,
  "marble-drop": (s, i, d) => GAMES["marble-drop"].generate(s, i, d).answer,
  "shadow-match": (s, i, d) => GAMES["shadow-match"].generate(s, i, d).answerIndex,
  "chalk-arrows": (s, i, d) => GAMES["chalk-arrows"].generate(s, i, d).answer,
  "aim-trainer": (s, i, d) => {
    const p = GAMES["aim-trainer"].generate(s, i, d);
    return { x: p.x, y: p.y };
  },
  "cup-shuffle": (s, i, d) => GAMES["cup-shuffle"].generate(s, i, d).answer,
  "bead-pattern": (s, i, d) => GAMES["bead-pattern"].generate(s, i, d).answer,
  "latin-cell": (s, i, d) => GAMES["latin-cell"].generate(s, i, d).answer,
  "stack-recall": (s, i, d) => GAMES["stack-recall"].generate(s, i, d).layers,
  "head-count": (s, i, d) => GAMES["head-count"].generate(s, i, d).answerIndex,
  "piece-fit": (s, i, d) => GAMES["piece-fit"].generate(s, i, d).answerIndex,
  "circuit-link": (s, i, d) => GAMES["circuit-link"].generate(s, i, d).answerIndex,
  "crowd-search": (s, i, d) => GAMES["crowd-search"].generate(s, i, d).answerIndex,
  "navon-shapes": (s, i, d) => GAMES["navon-shapes"].generate(s, i, d).answerIndex,
  "rhythm-echo": (s, i, d) => GAMES["rhythm-echo"].generate(s, i, d).hits,
  "rule-gate": (s, i, d) => GAMES["rule-gate"].generate(s, i, d).answer,
  "best-basket": (s, i, d) => GAMES["best-basket"].generate(s, i, d).answerIndex,
  "number-path": (s, i, d) => GAMES["number-path"].generate(s, i, d).answer,
  "pour-line": (s, i, d) => GAMES["pour-line"].generate(s, i, d).idealHoldMs,
};

/**
 * Một đáp án đúng kiểu nhưng sai cho câu `index`: thử đáp án đúng của các câu khác cùng seed,
 * lấy cái đầu tiên mà `check()` chấm sai.
 */
export function wrongAnswer(gameId: GameId, seed: number, index: number, d: Difficulty): unknown {
  const game = getGame(gameId);
  const puzzle = game.generate(seed, index, d);
  for (let k = 1; k < 200; k++) {
    const candidate = SOLVE[gameId](seed, index + k, d);
    if (game.isAnswer(candidate) && !game.check(puzzle, candidate)) return candidate;
  }
  throw new Error(`Không tìm được đáp án sai cho ${gameId}`);
}

/** Chờ tới khi điều kiện trên state của server đúng (tin nhắn từ client tới không đồng bộ). */
export async function until(check: () => boolean, timeoutMs = 3_000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error("Hết thời gian chờ điều kiện");
    await new Promise((r) => setTimeout(r, 5));
  }
}

/** Chờ một chút để chắc chắn KHÔNG có gì xảy ra thêm (vd. không ghi lần hai). */
export function settle(ms = 50) {
  return new Promise((r) => setTimeout(r, ms));
}

interface MessageSource<T> {
  onMessage(type: string, cb: (msg: T) => void): () => void;
}

export function nextMessage<T>(
  client: MessageSource<T>,
  type: string,
  timeoutMs = 3_000,
): Promise<T> {
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

interface MessageTarget {
  onMessage(type: string, cb: (msg: unknown) => void): () => void;
}

/**
 * Gắn handler rỗng cho mọi loại tin server → client để SDK không cảnh báo
 * "onMessage() not registered" (vd. `chatHistory` server gửi ngay khi vào/nối lại phòng).
 */
export function ignoreServerMessages<C extends MessageTarget>(client: C): C {
  for (const type of Object.values(ServerMessage)) client.onMessage(type, () => {});
  return client;
}

type TestServer = ColyseusTestServer<typeof appConfig>;
declare const testServer: TestServer;
type ConnectedClient<R extends Room> = Awaited<ReturnType<typeof testServer.connectTo<R>>>;

/**
 * Như `colyseus.connectTo()` nhưng gắn handler (`ignoreServerMessages`) NGAY khi SDK trả phòng,
 * trước khi chờ state đầu tiên: `chatHistory` tới sát state đầu nên gắn sau là đã muộn.
 */
export async function connectTo<R extends Room>(
  colyseus: TestServer,
  room: R,
  options: object,
): Promise<ConnectedClient<R>> {
  const client = await colyseus.sdk.joinById(room.roomId, options);
  ignoreServerMessages(client);
  await client.waitForInitialState();
  return client as unknown as ConnectedClient<R>;
}

/** Tua nhanh đồng hồ của room (mọi hẹn giờ đang chờ) thêm `ms` rồi chạy những hẹn giờ đã tới hạn. */
export function advance(room: Room, ms: number) {
  for (const d of room.clock.delayed) d.elapsedTime += ms;
  room.clock.tick();
}

/**
 * Đóng băng giờ server (`Date.now`) để thời gian trả lời tất định và không vướng chống spam.
 * Gọi SAU khi tạo phòng: đồng hồ hẹn giờ của room đã giữ `Date.now` gốc nên vẫn chạy theo giờ thật.
 */
export function freezeNow() {
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
