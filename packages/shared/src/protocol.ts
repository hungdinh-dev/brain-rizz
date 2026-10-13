import { z } from "zod";
import {
  AVATAR_COLORS,
  CHARACTER_IDS,
  type CharacterId,
  MAX_NAME_LENGTH,
  MAX_TOTAL_ROUNDS,
  MIN_TOTAL_ROUNDS,
} from "./constants";
import type { Difficulty } from "./difficulty";
import { GAME_IDS, type GameId } from "./games";

/**
 * Giao thức tin nhắn giữa client và server.
 * Server luôn validate bằng các schema zod dưới đây trước khi xử lý.
 *
 * Vòng đời một trận (CR-005):
 * lobby → game-select → game-intro → countdown → playing → round-results
 *       → (còn vòng) game-select … | (hết vòng) podium → game-select (Chơi lại) | lobby
 */

export type Phase =
  | "lobby"
  | "game-select"
  | "game-intro"
  | "countdown"
  | "playing"
  | "round-results"
  | "podium";

/** Cách chọn game ở pha `game-select`: vòng quay may mắn hoặc chủ phòng chọn (có bình chọn). */
export const PICK_MODES = ["wheel", "pick"] as const;
export type PickMode = (typeof PICK_MODES)[number];

// ---------- Client → Server ----------

export const ClientMessage = {
  /** Mọi người, pha `lobby`. */
  Ready: "ready",
  /** Mọi người, pha `lobby`. Không làm mất trạng thái sẵn sàng. */
  SetProfile: "setProfile",
  /** Chủ phòng, pha `lobby`. */
  SetRounds: "setRounds",
  /** Chủ phòng, pha `lobby`: cần ≥ MIN_PLAYERS_TO_START và tất cả đã sẵn sàng. */
  StartMatch: "startMatch",
  /** Chủ phòng, pha `game-select`, khi vòng quay chưa quay. */
  SetPickMode: "setPickMode",
  /** Người không phải chủ phòng, pha `game-select`. `gameId: null` là bỏ phiếu. */
  VoteGame: "voteGame",
  /** Chủ phòng, pha `game-select`, chỉ một lần mỗi vòng. */
  SpinWheel: "spinWheel",
  /** Chủ phòng, pha `game-select`, khi vòng quay không đang quay. */
  PickGame: "pickGame",
  /** Mọi người, pha `game-intro` hoặc `lobby`. */
  SetDifficulty: "setDifficulty",
  /** Mọi người, pha `game-intro` ("Đã hiểu"). */
  IntroReady: "introReady",
  /** Chủ phòng, pha `game-intro`: nhắc một người về độ khó đa số. */
  NudgeDifficulty: "nudgeDifficulty",
  /** Chủ phòng, pha `game-intro`, khi mọi người khác đã bấm "Đã hiểu". */
  StartRound: "startRound",
  /** Mọi người, pha `playing`. */
  Answer: "answer",
  /** Chủ phòng, pha `round-results`: còn vòng → `game-select`, hết vòng → `podium`. */
  NextRound: "nextRound",
  /** Chủ phòng, pha `podium`, cần ≥ MIN_PLAYERS_TO_START: giữ người chơi và số vòng, chơi lại từ vòng 1. */
  PlayAgain: "playAgain",
  /** Chủ phòng, pha `podium` hoặc `round-results`. */
  BackToLobby: "backToLobby",
  /** Bất cứ lúc nào (đồng bộ giờ). */
  Ping: "ping",
} as const;

/** Các trường hồ sơ người chơi, chưa gắn giá trị mặc định. */
const profileFields = {
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  colorIndex: z
    .number()
    .int()
    .min(0)
    .max(AVATAR_COLORS.length - 1),
  difficulty: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  avatar: z.enum(CHARACTER_IDS),
};

export const JoinOptionsSchema = z.object({
  name: profileFields.name,
  colorIndex: profileFields.colorIndex.default(0),
  difficulty: profileFields.difficulty.default(1),
  avatar: profileFields.avatar.default("khoi"),
});
export type JoinOptions = z.input<typeof JoinOptionsSchema>;

/**
 * Tin không có nội dung: chấp nhận `{}`, `undefined` hoặc `null` (đều chuẩn hoá thành `{}`);
 * trường lạ bị bỏ. Dùng cho startMatch, spinWheel, startRound, nextRound, playAgain, backToLobby.
 */
export const EmptyPayloadSchema = z
  .object({})
  .nullish()
  .transform((v) => v ?? {});
export type EmptyPayload = z.input<typeof EmptyPayloadSchema>;

export const ReadySchema = z.object({ ready: z.boolean() });
export type ReadyPayload = z.infer<typeof ReadySchema>;

/**
 * Mọi trường đều tuỳ chọn và KHÔNG có mặc định: trường không gửi thì giữ nguyên.
 * (Không dùng `JoinOptionsSchema.partial()` vì zod 4 vẫn điền `.default()` trong trường optional,
 * khiến đổi tên cũng làm reset màu/độ khó/nhân vật.)
 */
export const SetProfileSchema = z.object(profileFields).partial();
export type SetProfilePayload = z.infer<typeof SetProfileSchema>;

export const SetRoundsSchema = z.object({
  totalRounds: z.number().int().min(MIN_TOTAL_ROUNDS).max(MAX_TOTAL_ROUNDS),
});
export type SetRoundsPayload = z.infer<typeof SetRoundsSchema>;

export const StartMatchSchema = EmptyPayloadSchema;

export const SetPickModeSchema = z.object({ mode: z.enum(PICK_MODES) });
export type SetPickModePayload = z.infer<typeof SetPickModeSchema>;

export const VoteGameSchema = z.object({ gameId: z.enum(GAME_IDS).nullable() });
export type VoteGamePayload = z.infer<typeof VoteGameSchema>;

export const SpinWheelSchema = EmptyPayloadSchema;

export const PickGameSchema = z.object({ gameId: z.enum(GAME_IDS) });
export type PickGamePayload = z.infer<typeof PickGameSchema>;

export const SetDifficultySchema = z.object({ difficulty: profileFields.difficulty });
export type SetDifficultyPayload = z.infer<typeof SetDifficultySchema>;

export const IntroReadySchema = z.object({ ready: z.boolean() });
export type IntroReadyPayload = z.infer<typeof IntroReadySchema>;

export const NudgeDifficultySchema = z.object({ playerId: z.string().min(1).max(64) });
export type NudgeDifficultyPayload = z.infer<typeof NudgeDifficultySchema>;

/** Game đã chốt ở pha `game-select`, nên bắt đầu vòng không cần nội dung. */
export const StartRoundSchema = EmptyPayloadSchema;

export const AnswerSchema = z.object({
  round: z.number().int().min(1),
  index: z.number().int().min(0),
  answer: z.unknown(),
});
export type AnswerPayload = z.infer<typeof AnswerSchema>;

export const NextRoundSchema = EmptyPayloadSchema;
export const PlayAgainSchema = EmptyPayloadSchema;
export const BackToLobbySchema = EmptyPayloadSchema;

export const PingSchema = z.object({ clientTime: z.number() });
export type PingPayload = z.infer<typeof PingSchema>;

// ---------- Server → Client ----------

export const ServerMessage = {
  RoundStart: "roundStart",
  AnswerResult: "answerResult",
  /** Gửi riêng cho người bị chủ phòng nhắc độ khó. */
  Nudge: "nudge",
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

export interface NudgePayload {
  /** Độ khó mà nhiều người trong phòng đang chọn nhất. */
  difficulty: Difficulty;
}

export interface PongPayload {
  clientTime: number;
  serverTime: number;
}

export interface ErrorPayload {
  /** `not-ready`: chưa đủ người, chưa ai cũng sẵn sàng / chưa ai cũng "Đã hiểu". */
  code: "not-host" | "bad-phase" | "invalid" | "rate-limited" | "not-ready";
  message: string;
}

// ---------- Hình dạng state đồng bộ (client đọc) ----------

export interface PlayerView {
  id: string;
  name: string;
  colorIndex: number;
  /** Nhân vật đại diện (được phép trùng giữa người chơi). */
  avatar: CharacterId;
  /** Độ khó của người này cho vòng hiện tại (chọn lại ở pha `game-intro`; mặc định mức lần trước). */
  difficulty: 0 | 1 | 2 | 3;
  /** Sẵn sàng ở phòng chờ. */
  ready: boolean;
  /** Đã bấm "Đã hiểu" ở màn hướng dẫn (pha `game-intro`). */
  introReady: boolean;
  connected: boolean;
  isHost: boolean;
  /** Điểm trận (cộng dồn theo thứ hạng mỗi vòng). */
  matchPoints: number;
  /** Điểm trận vừa cộng ở vòng gần nhất (cho hiệu ứng "+10" ở bảng cộng điểm). */
  lastPoints: number;
  /** Tổng điểm vòng cả trận — để phá hoà điểm trận ở chung cuộc. */
  totalScore: number;
  /** Điểm trong vòng hiện tại. */
  roundScore: number;
  /** Số câu đúng trong vòng hiện tại. */
  roundCorrect: number;
  /** Số câu đã trả lời trong vòng, đúng hoặc sai (cũng là index câu đang làm). */
  progress: number;
  streak: number;
}

export interface PartyStateView {
  code: string;
  phase: Phase;
  hostId: string;
  /** Game của vòng hiện tại (đặt khi vào `game-intro`). */
  gameId: string;
  round: number;
  totalRounds: number;
  seed: number;
  startAt: number;
  endsAt: number;
  /** Cách chọn game ở pha `game-select`. */
  pickMode: PickMode;
  /** Phiếu bình chọn: sessionId → gameId. Xoá khi bắt đầu vòng. */
  votes: Record<string, string>;
  /** Game đã chơi trong trận (không lặp; chơi hết thì làm mới). */
  playedGames: string[];
  /** Kết quả vòng quay do server chọn ("" khi chưa quay). */
  wheelGameId: string;
  /** Thời điểm bắt đầu quay theo giờ server (0 khi chưa quay). */
  wheelSpinAt: number;
  /** Thời lượng hiệu ứng quay (ms). */
  wheelSpinMs: number;
  /** Hạn tự bắt đầu vòng ở pha `game-intro` theo giờ server (0 ở pha khác). */
  introEndsAt: number;
  players: Record<string, PlayerView>;
}
