import { z } from "zod";
import { CHAT_MAX_INPUT_LENGTH, CHAT_QUICK_IDS, type ChatQuickId } from "./chat/constants";
import {
  AVATAR_COLORS,
  CHARACTER_IDS,
  type CharacterId,
  MAX_ACCESS_TOKEN_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MAX_TOTAL_ROUNDS,
  MIN_TOTAL_ROUNDS,
} from "./constants";
import type { Difficulty } from "./difficulty";
import { GAME_IDS, type GameId } from "./games";
import type { Category } from "./games/types";

/**
 * Giao thức tin nhắn giữa client và server.
 * Server luôn validate bằng các schema zod dưới đây trước khi xử lý.
 *
 * Phòng Kiểm tra não (`BRAIN_TEST_ROOM_NAME`, UC-14) dùng chung `answer`, `ping` và các tin S → C;
 * riêng phần cuối file (`BrainJoinOptionsSchema`, `BrainClientMessage`, `BrainStateView`).
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
  /**
   * Mọi người, các pha trong `CHAT_PHASES`, khi `chatEnabled` (CR-011). Server làm sạch, lọc từ tục,
   * gắn tên/màu/nhân vật người gửi rồi phát `ServerMessage.Chat` cho cả phòng.
   */
  Chat: "chat",
  /** Chủ phòng, mọi pha: bật/tắt chat cả phòng (CR-011). */
  SetChatEnabled: "setChatEnabled",
  /**
   * Chủ phòng, pha `lobby` (CR-016): thêm một bot ở mức `level` vào ghế trống. Hết ghế
   * (người thật + bot = `MAX_PLAYERS`) thì `invalid`.
   */
  AddBot: "addBot",
  /** Chủ phòng, pha `lobby` (CR-016): bỏ bot `playerId`. Id không phải bot thì `invalid`. */
  RemoveBot: "removeBot",
  /** Chủ phòng, pha `lobby` (CR-016): đổi mức bot `playerId`. Id không phải bot thì `invalid`. */
  SetBotLevel: "setBotLevel",
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

/** Id người chơi trong tin nhắn (sessionId hoặc id ghế bot `bot-<n>`). */
const playerIdField = z.string().min(1).max(64);

/**
 * Mức bot (CR-016): 0 Dễ, 1 Vừa, 2 Khó, 3 Siêu. Khai báo tại chỗ để giao thức không phụ thuộc
 * `./bots`; cùng kiểu với `BotLevel` ở đó.
 */
const botLevelField = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

/**
 * JWT phiên Supabase (ADR 0011), tuỳ chọn. Sai kiểu hoặc dài quá giới hạn thì bị bỏ (coi như không gửi),
 * không làm hỏng việc vào phòng. Server chỉ dùng để lấy `user_id`, **không** đưa vào state.
 */
const accessTokenField = z.string().min(1).max(MAX_ACCESS_TOKEN_LENGTH).optional().catch(undefined);

export const JoinOptionsSchema = z.object({
  name: profileFields.name,
  colorIndex: profileFields.colorIndex.default(0),
  difficulty: profileFields.difficulty.default(1),
  avatar: profileFields.avatar.default("khoi"),
  accessToken: accessTokenField,
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

export const NudgeDifficultySchema = z.object({ playerId: playerIdField });
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

/**
 * Một tin chat (CR-011): chữ tự do hoặc biểu cảm/câu chọn sẵn. Chữ dài hơn `CHAT_MAX_LENGTH`
 * vẫn qua schema (tới `CHAT_MAX_INPUT_LENGTH`), server tự cắt. Không có trường danh tính:
 * tên/màu người gửi do server gắn, trường lạ bị bỏ.
 */
export const ChatSendSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string().max(CHAT_MAX_INPUT_LENGTH) }),
  z.object({ kind: z.literal("quick"), id: z.enum(CHAT_QUICK_IDS) }),
]);
export type ChatSendPayload = z.infer<typeof ChatSendSchema>;

/** Chủ phòng bật/tắt chat cả phòng. */
export const SetChatEnabledSchema = z.object({ enabled: z.boolean() });
export type SetChatEnabledPayload = z.infer<typeof SetChatEnabledSchema>;

// ---------- Bot (CR-016, ADR 0014) ----------

export const AddBotSchema = z.object({ level: botLevelField });
export type AddBotPayload = z.infer<typeof AddBotSchema>;

export const RemoveBotSchema = z.object({ playerId: playerIdField });
export type RemoveBotPayload = z.infer<typeof RemoveBotSchema>;

export const SetBotLevelSchema = z.object({ playerId: playerIdField, level: botLevelField });
export type SetBotLevelPayload = z.infer<typeof SetBotLevelSchema>;

/** Bot kèm theo khi tạo phòng ("Chơi với máy"): 1 → `MAX_PLAYERS - 1` bot, cùng một mức. */
export const RoomBotsOptionSchema = z.object({
  count: z
    .number()
    .int()
    .min(1)
    .max(MAX_PLAYERS - 1),
  level: botLevelField,
});
export type RoomBotsOption = z.infer<typeof RoomBotsOptionSchema>;

/**
 * Tùy chọn chỉ dùng lúc TẠO phòng party (`client.create(ROOM_NAME, { ...JoinOptions, bots })`),
 * server đọc ở `onCreate`; `onJoin` không đọc. Bot được thêm ngay SAU khi người tạo vào phòng, để
 * người tạo giữ đúng màu và nhân vật của mình, bot tránh cả hai. `bots` sai kiểu hoặc ngoài khoảng
 * thì bị bỏ (coi như không gửi), không làm hỏng việc tạo phòng; trường lạ bị bỏ.
 */
export const CreateOptionsSchema = z
  .object({ bots: RoomBotsOptionSchema.optional().catch(undefined) })
  .catch({ bots: undefined });
export interface CreateOptions {
  bots?: RoomBotsOption;
}

// ---------- Server → Client ----------

export const ServerMessage = {
  RoundStart: "roundStart",
  AnswerResult: "answerResult",
  /** Gửi riêng cho người bị chủ phòng nhắc độ khó. */
  Nudge: "nudge",
  Pong: "pong",
  Error: "error",
  /** Một tin chat mới, phát cho cả phòng (kể cả người gửi) — `ChatMessagePayload`. */
  Chat: "chat",
  /**
   * Lịch sử chat gần nhất (tối đa `CHAT_HISTORY_SIZE`, cũ → mới) — `ChatHistoryPayload`.
   * Gửi riêng khi vào phòng và khi nối lại thành công; client gộp vào danh sách đang có theo `id`
   * (bỏ trùng, giữ thứ tự cũ → mới, tối đa 50 tin gần nhất), không xoá tin cũ hơn bộ đệm server.
   */
  ChatHistory: "chatHistory",
  /**
   * Bot nhường ghế (CR-016) — `BotYieldedPayload`. Người thật vào phòng đủ ghế ở `lobby` nên bot
   * thêm gần nhất rời phòng. Gửi một lần cho những người ĐÃ ở trong phòng, không gửi người vừa vào;
   * web hiện toast "<tên> vào phòng · <bot> nhường ghế".
   */
  BotYielded: "botYielded",
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

/**
 * Một tin chat đã qua server (CR-011). Danh tính người gửi lấy từ `PlayerView` lúc gửi,
 * client không tự khai. Không nằm trong state đồng bộ.
 */
export interface ChatMessagePayload {
  /** Số tăng dần trong phòng (dùng làm key, bỏ trùng khi nhận lại lịch sử). */
  id: number;
  playerId: string;
  name: string;
  colorIndex: number;
  avatar: CharacterId;
  kind: "text" | "quick";
  /** Có khi `kind = "text"`: đã làm sạch, cắt 120 ký tự, che từ tục bằng `***`. */
  text?: string;
  /** Có khi `kind = "quick"`. */
  quickId?: ChatQuickId;
  /** Giờ server (ms epoch). */
  at: number;
  /**
   * Người gửi là bot (CR-016): web dịch tên theo `avatar` (`name` của bot là `""`), kể cả khi
   * bot đã bị bỏ khỏi phòng. Không có = người thật.
   */
  bot?: true;
}

export interface ChatHistoryPayload {
  /** Cũ → mới. */
  messages: ChatMessagePayload[];
}

/**
 * Tin `botYielded` (CR-016). Không có chữ giao diện: web dịch tên bot theo `botAvatar` (bot đã rời
 * state lúc tin tới nên không tra lại được), tên người vào lấy từ `playerName`.
 */
export interface BotYieldedPayload {
  /** Id ghế bot vừa rời (`bot-<n>`). */
  botId: string;
  /** Nhân vật của bot vừa rời. */
  botAvatar: CharacterId;
  /** sessionId của người thật vừa vào. */
  playerId: string;
  /** Tên người thật vừa vào (đã qua schema: cắt khoảng trắng hai đầu). */
  playerName: string;
}

export interface ErrorPayload {
  /**
   * `not-ready`: chưa đủ người, chưa ai cũng sẵn sàng / chưa ai cũng "Đã hiểu".
   * `chat-disabled`: chủ phòng đã tắt chat (CR-011). Chat sai pha dùng `bad-phase`,
   * gửi quá nhanh dùng `rate-limited`, tin rỗng/sai schema dùng `invalid`.
   */
  code: "not-host" | "bad-phase" | "invalid" | "rate-limited" | "not-ready" | "chat-disabled";
  message: string;
  /**
   * Lệnh gây ra lỗi. `chat`: lỗi của tin `Chat` hoặc `SetChatEnabled` — client xử lý trong khung
   * chat thay vì coi là lệnh khác bị từ chối. Không có = lỗi của lệnh khác (server cũ cũng không gửi).
   */
  source?: "chat";
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
  /**
   * Tổng điểm vòng cả trận theo thể loại game (`GAMES[id].category`), CR-010.
   * QUY ƯỚC: chỉ thể loại đã chơi trong trận mới có khoá — kể cả khi người này được 0 điểm ở
   * thể loại đó (server tạo khoá cho mọi người còn trong phòng lúc chốt vòng). Thiếu khoá nghĩa
   * là "chưa chơi", khác với "chơi được 0 điểm". Xoá về `{}` khi Chơi lại / Về phòng chờ.
   */
  categoryScores: Partial<Record<Category, number>>;
  /** Điểm trong vòng hiện tại. */
  roundScore: number;
  /** Số câu đúng trong vòng hiện tại. */
  roundCorrect: number;
  /** Số câu đã trả lời trong vòng, đúng hoặc sai (cũng là index câu đang làm). */
  progress: number;
  streak: number;
  /**
   * Ghế do server chơi thay (CR-016, ADR 0014). Bot có `name = ""` (web dịch theo nhân vật), luôn
   * `ready` và `connected`, không bao giờ là chủ phòng, không bỏ phiếu.
   */
  isBot: boolean;
  /** Mức bot: 0 Dễ, 1 Vừa, 2 Khó, 3 Siêu (`BotLevel`). Người thật luôn là 0. */
  botLevel: 0 | 1 | 2 | 3;
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
  /** Chat cả phòng đang bật (CR-011). Chủ phòng đổi; giữ nguyên qua Chơi lại / Về phòng chờ. */
  chatEnabled: boolean;
  players: Record<string, PlayerView>;
}

// ---------- Phòng Kiểm tra não (UC-14, ADR 0011) ----------

/**
 * Vòng đời một lượt Kiểm tra não (một người, 5 game):
 * intro (game i) → countdown → playing → game-result → intro (game i + 1) … → finished
 */
export type BrainPhase = "intro" | "countdown" | "playing" | "game-result" | "finished";

/**
 * Trạng thái lưu kết quả lên tài khoản:
 * - `pending`: chưa xong lượt, đang xác thực token hoặc đang ghi.
 * - `saved`: đã ghi vào tài khoản.
 * - `guest`: không có phiên hợp lệ (không gửi token, token sai/hết hạn) → không lưu.
 * - `no-db`: server chưa cấu hình Supabase → không lưu.
 * - `failed`: ghi lỗi (Supabase tạm dừng, mạng…).
 * `guest` và `no-db` có thể hiện ngay từ đầu lượt; `saved`/`failed` chỉ có sau `finished`.
 */
export const BRAIN_SAVE_STATUSES = ["pending", "saved", "guest", "no-db", "failed"] as const;
export type BrainSaveStatus = (typeof BRAIN_SAVE_STATUSES)[number];

/** Join options của phòng Kiểm tra não (tạo bằng `client.create(BRAIN_TEST_ROOM_NAME, …)`). */
export const BrainJoinOptionsSchema = z.object({
  name: profileFields.name,
  avatar: profileFields.avatar.default("khoi"),
  accessToken: accessTokenField,
});
export type BrainJoinOptions = z.input<typeof BrainJoinOptionsSchema>;

/** Tin client → server của phòng Kiểm tra não. */
export const BrainClientMessage = {
  /** Pha `intro`: bắt đầu đếm ngược game hiện tại ("Sẵn sàng"). Nội dung `{}`. */
  Ready: "brainReady",
  /** Pha `playing`: `{ round, index, answer }` như phòng party, `round` = thứ tự game (1–5). */
  Answer: ClientMessage.Answer,
  /** Bất cứ lúc nào (đồng bộ giờ). */
  Ping: ClientMessage.Ping,
} as const;

export const BrainReadySchema = EmptyPayloadSchema;

/** Một game trong lượt Kiểm tra não. */
export interface BrainGameView {
  gameId: GameId;
  category: Category;
  /** Điểm của game này (cập nhật trực tiếp khi đang chơi). */
  score: number;
  /** Số câu đúng của game này. */
  correct: number;
}

export interface BrainStateView {
  phase: BrainPhase;
  name: string;
  avatar: CharacterId;
  /** Độ khó cố định của Kiểm tra não (`BRAIN_TEST_DIFFICULTY`). */
  difficulty: Difficulty;
  /** 5 game theo thứ tự chơi, mỗi nhóm kỹ năng một game; chọn sẵn khi tạo phòng. */
  games: BrainGameView[];
  /** Thứ tự game hiện tại, 1–5. Gửi đúng số này trong `answer.round`. */
  round: number;
  /** Game hiện tại (= `games[round - 1].gameId`). */
  gameId: string;
  /** Seed của game hiện tại (0 ở pha `intro`). */
  seed: number;
  /** Mốc bắt đầu chơi / hết giờ của game hiện tại theo giờ server (0 ở pha `intro`). */
  startAt: number;
  endsAt: number;
  /** Pha `game-result`: thời điểm server tự sang game kế / `finished` (0 ở pha khác). */
  resultEndsAt: number;
  /** Số câu đã trả lời trong game hiện tại, đúng hoặc sai (cũng là index câu đang làm). */
  progress: number;
  /** Số câu đúng liên tiếp hiện tại. */
  streak: number;
  /** Điểm Não; 0 tới khi `finished`. */
  brainScore: number;
  /** Điểm 5 kỹ năng; rỗng tới khi `finished`. */
  skills: Partial<Record<Category, number>>;
  saveStatus: BrainSaveStatus;
}
