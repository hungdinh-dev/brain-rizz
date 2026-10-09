import { z } from "zod";
import { AVATAR_COLORS, MAX_NAME_LENGTH } from "./constants";
import { GAME_IDS, type GameId } from "./games";

/**
 * Giao thức tin nhắn giữa client và server.
 * Server luôn validate bằng các schema zod dưới đây trước khi xử lý.
 */

export type Phase = "lobby" | "countdown" | "playing" | "round-results" | "podium";

// ---------- Client → Server ----------

export const ClientMessage = {
  Ready: "ready",
  SetProfile: "setProfile",
  StartRound: "startRound",
  Answer: "answer",
  BackToLobby: "backToLobby",
  Ping: "ping",
} as const;

export const JoinOptionsSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  colorIndex: z
    .number()
    .int()
    .min(0)
    .max(AVATAR_COLORS.length - 1)
    .default(0),
  difficulty: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).default(1),
});
export type JoinOptions = z.input<typeof JoinOptionsSchema>;

export const ReadySchema = z.object({ ready: z.boolean() });
export type ReadyPayload = z.infer<typeof ReadySchema>;

export const SetProfileSchema = JoinOptionsSchema.partial();
export type SetProfilePayload = z.infer<typeof SetProfileSchema>;

export const StartRoundSchema = z.object({
  gameId: z.enum(GAME_IDS),
  /** Chỉ dùng ở vòng đầu: tổng số vòng của trận. */
  totalRounds: z.number().int().min(1).max(10).optional(),
});
export type StartRoundPayload = z.infer<typeof StartRoundSchema>;

export const AnswerSchema = z.object({
  round: z.number().int().min(1),
  index: z.number().int().min(0),
  answer: z.unknown(),
});
export type AnswerPayload = z.infer<typeof AnswerSchema>;

export const PingSchema = z.object({ clientTime: z.number() });
export type PingPayload = z.infer<typeof PingSchema>;

// ---------- Server → Client ----------

export const ServerMessage = {
  RoundStart: "roundStart",
  AnswerResult: "answerResult",
  Pong: "pong",
  Error: "error",
} as const;

export interface RoundStartPayload {
  round: number;
  gameId: GameId;
  seed: number;
  /** Thời điểm bắt đầu theo giờ server (ms epoch). */
  startAt: number;
  durationMs: number;
}

export interface AnswerResultPayload {
  index: number;
  correct: boolean;
  points: number;
  /** Bị khoá thao tác tới thời điểm này (giờ server), nếu trả lời sai. */
  lockedUntil?: number;
}

export interface PongPayload {
  clientTime: number;
  serverTime: number;
}

export interface ErrorPayload {
  code: "not-host" | "bad-phase" | "invalid" | "rate-limited";
  message: string;
}

// ---------- Hình dạng state đồng bộ (client đọc) ----------

export interface PlayerView {
  id: string;
  name: string;
  colorIndex: number;
  difficulty: 0 | 1 | 2 | 3;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
  /** Điểm trận (cộng dồn theo thứ hạng mỗi vòng). */
  matchPoints: number;
  /** Điểm trong vòng hiện tại. */
  roundScore: number;
  /** Số câu đã trả lời trong vòng, đúng hoặc sai (cũng là index câu đang làm). */
  progress: number;
  streak: number;
}

export interface PartyStateView {
  code: string;
  phase: Phase;
  hostId: string;
  gameId: string;
  round: number;
  totalRounds: number;
  seed: number;
  startAt: number;
  endsAt: number;
  players: Record<string, PlayerView>;
}
