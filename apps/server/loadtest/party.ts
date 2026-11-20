import {
  availableGames,
  ClientMessage,
  type Difficulty,
  enabledGameIds,
  GAMES,
  type GameId,
  isGameId,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  ServerMessage,
} from "@brain-rizz/shared";
import { cli, type Options } from "@colyseus/loadtest";
import { Client, type Room } from "@colyseus/sdk";

/**
 * Load test NFR-REL-02: `--numClients` người (mặc định script: 12 = MAX_PLAYERS) vào CÙNG một
 * phòng party và trả lời liên tục. Người đầu (clientId 0) tạo phòng và làm chủ phòng; những người
 * sau vào bằng mã phòng. Mỗi trận 1 vòng "Tìm hình khác" (đáp án sinh lại bằng bộ sinh shared),
 * hết trận thì Chơi lại, lặp tới khi dừng script.
 *
 * Chạy (cần server đang chạy, `pnpm dev:server`): pnpm --filter @brain-rizz/server loadtest
 */

/** Game của mỗi vòng: đáp án đúng là `oddIndex` của câu sinh lại. Bị admin tắt thì lấy game khác. */
const GAME = "odd-one-out" satisfies GameId;
/** Khoảng giữa hai lần trả lời của một người (ms), cộng ngẫu nhiên tới `ANSWER_JITTER_MS`. */
const ANSWER_EVERY_MS = 350;
const ANSWER_JITTER_MS = 350;
/** Chủ phòng bắt đầu khi đủ người, hoặc sau ngần này ms nếu có người không vào được. */
const START_ANYWAY_MS = 20_000;

/** Phần state đồng bộ mà load test đọc (khớp `PartyStateView`). */
interface LoadPlayer {
  id: string;
  ready: boolean;
  introReady: boolean;
  progress: number;
  difficulty: number;
}
interface LoadState {
  phase: string;
  hostId: string;
  gameId: string;
  round: number;
  seed: number;
  playedGames: Iterable<string>;
  disabledGames: Iterable<string>;
  players: {
    size: number;
    get(id: string): LoadPlayer | undefined;
    values(): Iterable<LoadPlayer>;
  };
}

/** Mã phòng do người đầu tạo, những người sau chờ để vào cùng phòng. */
let resolveRoomId: (id: string) => void = () => {};
const sharedRoomId = new Promise<string>((resolve) => {
  resolveRoomId = resolve;
});

export async function main(options: Options) {
  const client = new Client(options.endpoint);
  const name = `bot-${options.clientId + 1}`;
  const first = options.clientId === 0 && !options.roomId;
  const room: Room = first
    ? await client.create(options.roomName, { name })
    : await client.joinById(options.roomId || (await sharedRoomId), { name });
  if (first) resolveRoomId(room.roomId);
  for (const type of Object.values(ServerMessage)) room.onMessage(type, () => {});

  const target = Math.min(options.numClients, MAX_PLAYERS);
  const joinedAt = Date.now();
  const state = () => room.state as unknown as LoadState;
  const me = () => state().players.get(room.sessionId);
  const isHost = () => state().hostId === room.sessionId;

  // Mỗi lần đổi pha tăng `epoch`; mỗi hành động chỉ gửi một lần trong một pha.
  let phase = "";
  let epoch = 0;
  const done = new Set<string>();
  const once = (action: string, fn: () => void) => {
    const key = `${epoch}:${action}`;
    if (done.has(key)) return;
    done.add(key);
    fn();
  };
  const later = (action: string, ms: number, fn: () => void) => {
    const at = epoch;
    once(action, () => {
      setTimeout(() => {
        if (epoch === at) fn();
      }, ms);
    });
  };

  const send = (type: string, payload: object) => room.send(type, payload);
  const ping = setInterval(() => send(ClientMessage.Ping, { clientTime: Date.now() }), 1_000);
  let answering: ReturnType<typeof setTimeout> | undefined;

  /** Trả lời đúng câu đang làm, rồi hẹn lần kế; dừng khi hết pha chơi. */
  const answerLoop = () => {
    const s = state();
    const p = me();
    if (s.phase !== "playing" || !p) {
      answering = undefined;
      return;
    }
    if (s.gameId === GAME) {
      const puzzle = GAMES[GAME].generate(s.seed, p.progress, p.difficulty as Difficulty);
      send(ClientMessage.Answer, { round: s.round, index: p.progress, answer: puzzle.oddIndex });
    } else {
      // Game khác (odd-one-out bị tắt): đáp án sai kiểu, server bỏ qua — vẫn tạo tải mạng.
      send(ClientMessage.Answer, { round: s.round, index: p.progress, answer: 0 });
    }
    answering = setTimeout(answerLoop, ANSWER_EVERY_MS + Math.random() * ANSWER_JITTER_MS);
  };

  room.onStateChange(() => {
    const s = state();
    const p = me();
    if (!p) return;
    if (s.phase !== phase) {
      phase = s.phase;
      epoch++;
    }
    const seats = [...s.players.values()];
    switch (s.phase) {
      case "lobby":
        if (!p.ready) once("ready", () => send(ClientMessage.Ready, { ready: true }));
        if (isHost()) once("rounds", () => send(ClientMessage.SetRounds, { totalRounds: 1 }));
        if (
          isHost() &&
          seats.every((x) => x.ready) &&
          (s.players.size >= target ||
            (s.players.size >= MIN_PLAYERS_TO_START && Date.now() - joinedAt > START_ANYWAY_MS))
        ) {
          once("start", () => send(ClientMessage.StartMatch, {}));
        }
        break;
      case "game-select":
        if (isHost()) {
          const games = availableGames([...s.playedGames], enabledGameIds([...s.disabledGames]));
          const gameId = games.includes(GAME) ? GAME : games[0];
          if (gameId && isGameId(gameId))
            once("pick", () => send(ClientMessage.PickGame, { gameId }));
        }
        break;
      case "game-intro":
        if (!isHost()) once("intro", () => send(ClientMessage.IntroReady, { ready: true }));
        if (isHost() && seats.every((x) => x.id === s.hostId || x.introReady)) {
          once("round", () => send(ClientMessage.StartRound, {}));
        }
        break;
      case "playing":
        if (!answering) answerLoop();
        break;
      case "round-results":
        if (isHost()) later("next", 1_500, () => send(ClientMessage.NextRound, {}));
        break;
      case "podium":
        if (isHost()) later("again", 2_000, () => send(ClientMessage.PlayAgain, {}));
        break;
    }
  });

  room.onLeave(() => {
    clearInterval(ping);
    clearTimeout(answering);
    console.log("bot left", room.sessionId);
  });
}

cli(main);
