import { type Difficulty, GAMES, type GameId, getGame } from "@brain-rizz/shared";
import type { Room } from "colyseus";
import { vi } from "vitest";

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
