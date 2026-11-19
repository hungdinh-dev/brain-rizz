import {
  AddBotSchema,
  type AdminRoomView,
  AnswerSchema,
  AVATAR_COLORS,
  availableGames,
  BackToLobbySchema,
  type BotYieldedPayload,
  type Category,
  type ChatQuickId,
  ChatSendSchema,
  ClientMessage,
  COUNTDOWN_MS,
  CreateOptionsSchema,
  categoryLeaders,
  DEFAULT_PARTY_CONFIG,
  type ErrorPayload,
  enabledGameIds,
  type GameId,
  generateRoomCode,
  getGame,
  INTRO_AUTO_START_MS,
  IntroReadySchema,
  isCharacterId,
  isChatPhase,
  isGameId,
  JoinOptionsSchema,
  type JudgeOutcome,
  type JudgeRound,
  LATE_ANSWER_GRACE_MS,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  majorityDifficulty,
  NextRoundSchema,
  NUDGE_COOLDOWN_MS,
  NudgeDifficultySchema,
  type NudgePayload,
  type PartyConfig,
  type Phase,
  PickGameSchema,
  PlayAgainSchema,
  partyChalkReward,
  placementPoints,
  playedCategories,
  RECONNECT_WINDOW_S,
  ReadySchema,
  RemoveBotSchema,
  type RewardPayload,
  type RoomBotsOption,
  type RoundStartPayload,
  randomSeed,
  rankByMatch,
  rankByRound,
  ServerMessage,
  SetBotLevelSchema,
  SetChatEnabledSchema,
  SetDifficultySchema,
  SetPickModeSchema,
  SetProfileSchema,
  SetRoundsSchema,
  SpinWheelSchema,
  StartMatchSchema,
  StartRoundSchema,
  VoteGameSchema,
  WHEEL_RESULT_HOLD_MS,
  WHEEL_SPIN_LEAD_MS,
  WHEEL_SPIN_MS,
} from "@brain-rizz/shared";
import { type Client, type Delayed, matchMaker, Room } from "colyseus";
import type { z } from "zod";
import { getPartyConfig } from "../store/party-config-cache";
import { type CosmeticsRecord, getResultStore, type MatchResultRecord } from "../store/ResultStore";
import { AnswerJudge } from "./AnswerJudge";
import { BotDriver } from "./BotDriver";
import { ChatRelay } from "./ChatRelay";
import {
  needsOwnership,
  OWNERSHIP_RETRY_MARGIN_MS,
  ownsRequested,
  type RequestedLoadout,
  resolveLoadout,
} from "./loadout";
import { parseMessage, replyPong, sendError, withSource } from "./messages";
import { PartyState, Player } from "./schema/PartyState";

/** Pha bắt đầu một trận: phòng chờ (startMatch) hoặc vinh danh (playAgain). */
type StartFrom = "lobby" | "podium";

/** Người nhận phấn sau trận: đã xác thực, hạng chốt lúc vào `podium`. */
interface ChalkEarner {
  sessionId: string;
  userId: string;
  placement: number;
}

/**
 * Số người thật cho `partyChalkReward` (× 0,5 khi chỉ 1): số tài khoản khác nhau trong các ghế người
 * đã xác thực + số ghế người chưa xác thực (khách, token sai); bot không tính. Một tài khoản mở hai
 * thẻ chỉ tính một lần, nên không né được × 0,5 trong phòng bot.
 */
function countHumans(
  seats: readonly Pick<Player, "id" | "isBot">[],
  userIdOf: (sessionId: string) => string | undefined,
): number {
  const accounts = new Set<string>();
  let guests = 0;
  for (const p of seats) {
    if (p.isBot) continue;
    const userId = userIdOf(p.id);
    if (userId) accounts.add(userId);
    else guests++;
  }
  return accounts.size + guests;
}

/**
 * Một phòng chơi = một nhóm bạn (tối đa `MAX_PLAYERS` = 12 ghế, CR-018), vào bằng mã 4 ký tự.
 *
 * Mô hình "server làm trọng tài, client tự chơi":
 *  - Server phát seed, giữ đồng hồ, chấm điểm.
 *  - Client tự sinh câu đố từ seed (cùng code trong @brain-rizz/shared) và chỉ gửi đáp án.
 *
 * Vòng đời một trận (CR-005, xem docs/02-architecture/overview.md):
 * lobby → game-select → game-intro → countdown → playing → round-results
 *       → (còn vòng) game-select … | (hết vòng) podium → game-select (Chơi lại) | lobby
 *
 * Mỗi lần đổi pha đều huỷ hẹn giờ của pha cũ (`clearTimers`, kể cả hẹn giờ của bot), nên hẹn giờ
 * không bao giờ "bắn nhầm" sang pha khác; mỗi callback hẹn giờ vẫn tự kiểm tra lại pha cho chắc.
 *
 * Bot (CR-016, ADR 0014): ghế do server chơi thay, quản lý ở `BotDriver`. Ghế tính cả bot
 * (≤ MAX_PLAYERS); bot nhường ghế cho người thật ở phòng chờ, không làm chủ phòng; hết người thật
 * thì phòng đóng.
 *
 * Cấu hình party của quản trị viên (CR-019): nạp lúc tạo phòng và mỗi lần bắt đầu trận
 * (`beginMatch`), qua bộ đệm 30 giây; cả trận dùng một bản chụp (`config`) cho điểm câu
 * (`AnswerJudge`, cả bot), điểm thứ hạng và game bị tắt. Bản chụp nằm trong state
 * (`disabledGames`, `scoringJson`, `configVersion`) để web hiện đúng hệ số.
 *
 * Thú khoá + phụ kiện (CR-023, CR-024): vào phòng / đổi hồ sơ thì áp ngay bản an toàn
 * (`resolveLoadout` chưa có quyền: nhân vật cũ giữ, thú khoá → `khoi`, không phụ kiện), rồi nạp quyền
 * chạy nền (`loadCosmetics`, cần token hợp lệ) và áp lại khi xong nếu người đó còn trong phòng.
 * Không bao giờ từ chối vào phòng vì đồ trang trí. Vào `podium` và ghi `match_results` xong thì cộng
 * phấn (`grantChalk`) cho người đã xác thực rồi gửi riêng `ServerMessage.Reward`.
 */
export class PartyRoom extends Room<{ state: PartyState }> {
  override maxClients = MAX_PLAYERS;
  override state = new PartyState();

  /** Cấu hình party của trận hiện tại (CR-019). Chỉ đổi lúc tạo phòng và lúc bắt đầu trận. */
  private config: PartyConfig = DEFAULT_PARTY_CONFIG;
  /** Đang chờ nạp cấu hình để bắt đầu trận (một lượt chờ cho mọi lệnh bắt đầu trong lúc này). */
  private starting = false;
  /**
   * Lệnh bắt đầu trận mới nhất đang chờ cấu hình (`requestBegin`); lượt chờ đang chạy dùng lệnh
   * này, nên lệnh tới trong lúc chờ không bị bỏ im lặng. `null` = không có, hoặc đã huỷ (Về phòng chờ).
   */
  private startRequest: { from: StartFrom; requesterId: string } | null = null;
  /** Lúc tạo phòng (trang quản trị, `adminView`). */
  private createdAt = new Date();

  /** Chấm từng câu (giờ hiện câu, khoá khi sai, chống spam), dùng chung với BrainTestRoom. */
  private judge = new AnswerJudge(() => this.config.scoring);
  /** Lần cuối chủ phòng nhắc độ khó từng người (giờ server). */
  private lastNudgeAt = new Map<string, number>();
  private timers: Delayed[] = [];

  /** Nơi ghi kết quả trận (ADR 0011). */
  private store = getResultStore();
  /** sessionId → user_id Supabase đã xác thực. Không đồng bộ xuống client; giữ qua nối lại. */
  private userIds = new Map<string, string>();
  /** Xác thực token đang chạy (ghi kết quả trận chờ các lượt này xong). */
  private pendingAuth = new Map<string, Promise<void>>();
  /** sessionId → nhân vật + phụ kiện người chơi xin (chưa kiểm sở hữu). Giữ qua nối lại. */
  private requestedLoadouts = new Map<string, RequestedLoadout>();
  /** sessionId → quyền đồ trang trí đã nạp (CR-023, CR-024). Không đồng bộ xuống client. */
  private ownership = new Map<string, CosmeticsRecord>();
  /** sessionId → số thứ tự lượt nạp quyền mới nhất: kết quả của lượt cũ / người đã rời bị bỏ. */
  private ownershipLoads = new Map<string, number>();
  /**
   * sessionId → hẹn đọc lại quyền (bản đệm thiếu món / thú đang xin, còn trong cửa sổ chống dồn).
   * Mỗi người tối đa một hẹn; không thuộc `timers` nên đổi pha không huỷ.
   */
  private ownershipRetries = new Map<string, Delayed>();
  /** Game đã chơi trong trận này, theo thứ tự (ghi vào match_results). */
  private matchGames: string[] = [];
  /** Đã ghi kết quả trận hiện tại chưa (mỗi trận đúng một lần). */
  private matchRecorded = false;
  /** Chat trong phòng (CR-011): giới hạn tần suất, lọc, 30 tin gần nhất trong RAM. */
  private chat = new ChatRelay();
  /** Bot của phòng (CR-016): danh sách, hành vi theo pha, hẹn giờ trả lời trên `this.clock`. */
  private bots = new BotDriver({
    state: this.state,
    judge: this.judge,
    setTimeout: (fn, ms) => this.clock.setTimeout(fn, ms),
    judgeRound: () => this.judgeRound(),
    applyOutcome: (p, outcome) => this.applyOutcome(p, outcome),
    sendChat: (p, quickId) => this.sendBotChat(p, quickId),
    freeColor: (preferred) => this.freeColor(preferred),
  });
  /**
   * Bot xin kèm lúc tạo phòng ("Chơi với máy"), chờ người tạo vào rồi mới thêm (xem `onJoin`):
   * thêm trước thì bot lấy mất màu và nhân vật trong hồ sơ của người tạo.
   */
  private pendingBots: RoomBotsOption | undefined;

  override messages = {
    // ------------------------------------------------------------ phòng chờ

    [ClientMessage.Ready]: (client: Client, raw: unknown) => {
      const msg = this.parse(client, ReadySchema, raw);
      if (!msg || !this.requirePhase(client, "lobby")) return;
      const p = this.state.players.get(client.sessionId);
      if (p) p.ready = msg.ready;
    },

    [ClientMessage.SetProfile]: (client: Client, raw: unknown) => {
      const msg = this.parse(client, SetProfileSchema, raw);
      if (!msg || !this.requirePhase(client, "lobby")) return;
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      // Không đụng tới `ready`: đổi nhân vật không làm mất trạng thái sẵn sàng.
      if (msg.name !== undefined) p.name = msg.name;
      if (msg.colorIndex !== undefined) p.colorIndex = msg.colorIndex;
      if (msg.difficulty !== undefined) p.difficulty = msg.difficulty;
      if (msg.avatar !== undefined || msg.accessories !== undefined) {
        const id = client.sessionId;
        const prev = this.requestedLoadouts.get(id);
        this.requestLoadout(id, {
          avatar: msg.avatar ?? prev?.avatar ?? "khoi",
          accessories: msg.accessories ?? prev?.accessories ?? [],
        });
      }
    },

    [ClientMessage.SetRounds]: (client: Client, raw: unknown) => {
      const msg = this.parse(client, SetRoundsSchema, raw);
      if (!msg || !this.requireHost(client) || !this.requirePhase(client, "lobby")) return;
      this.state.totalRounds = msg.totalRounds;
    },

    [ClientMessage.StartMatch]: (client: Client, raw: unknown) => {
      if (!this.parse(client, StartMatchSchema, raw) || !this.requireHost(client)) return;
      this.requestBegin(client, "lobby");
    },

    // ------------------------------------------------------------ chọn game

    [ClientMessage.SetPickMode]: (client: Client, raw: unknown) => {
      const msg = this.parse(client, SetPickModeSchema, raw);
      if (!msg || !this.requireHost(client) || !this.requirePhase(client, "game-select")) return;
      if (!this.requireWheelIdle(client)) return;
      this.state.pickMode = msg.mode;
    },

    [ClientMessage.VoteGame]: (client: Client, raw: unknown) => {
      const msg = this.parse(client, VoteGameSchema, raw);
      if (!msg || !this.requirePhase(client, "game-select")) return;
      const id = client.sessionId;
      if (id === this.state.hostId) {
        this.sendError(client, { code: "invalid", message: "Chủ phòng không bỏ phiếu." });
        return;
      }
      if (msg.gameId === null) {
        this.state.votes.delete(id);
        return;
      }
      if (!this.requireAvailable(client, msg.gameId)) return;
      this.state.votes.set(id, msg.gameId);
    },

    [ClientMessage.SpinWheel]: (client: Client, raw: unknown) => {
      if (!this.parse(client, SpinWheelSchema, raw) || !this.requireHost(client)) return;
      if (!this.requirePhase(client, "game-select") || !this.requireWheelIdle(client)) return;
      this.spinWheel();
    },

    [ClientMessage.PickGame]: (client: Client, raw: unknown) => {
      const msg = this.parse(client, PickGameSchema, raw);
      if (!msg || !this.requireHost(client) || !this.requirePhase(client, "game-select")) return;
      if (!this.requireWheelIdle(client) || !this.requireAvailable(client, msg.gameId)) return;
      this.enterGameIntro(msg.gameId);
    },

    // ------------------------------------------------------------ hướng dẫn + độ khó

    [ClientMessage.SetDifficulty]: (client: Client, raw: unknown) => {
      const msg = this.parse(client, SetDifficultySchema, raw);
      if (!msg || !this.requirePhase(client, "lobby", "game-intro")) return;
      const p = this.state.players.get(client.sessionId);
      if (p) p.difficulty = msg.difficulty;
    },

    [ClientMessage.IntroReady]: (client: Client, raw: unknown) => {
      const msg = this.parse(client, IntroReadySchema, raw);
      if (!msg || !this.requirePhase(client, "game-intro")) return;
      const p = this.state.players.get(client.sessionId);
      if (p) p.introReady = msg.ready;
    },

    [ClientMessage.NudgeDifficulty]: (client: Client, raw: unknown) => {
      const msg = this.parse(client, NudgeDifficultySchema, raw);
      if (!msg || !this.requireHost(client) || !this.requirePhase(client, "game-intro")) return;
      this.nudge(client, msg.playerId);
    },

    [ClientMessage.StartRound]: (client: Client, raw: unknown) => {
      if (!this.parse(client, StartRoundSchema, raw) || !this.requireHost(client)) return;
      if (!this.requirePhase(client, "game-intro")) return;
      // Chủ phòng bấm "Bắt đầu chơi" tức là chủ phòng đã hiểu; chỉ chờ những người còn lại.
      // Không chờ bot (CR-016): bot tự "Đã hiểu" sau vài giây, chủ phòng không phải đợi.
      const waiting = [...this.state.players.values()].some(
        (p) => p.id !== this.state.hostId && !p.isBot && !p.introReady,
      );
      if (waiting) {
        this.sendError(client, { code: "not-ready", message: "Chờ mọi người bấm Đã hiểu." });
        return;
      }
      this.startRound();
    },

    // ------------------------------------------------------------ chơi + kết quả

    [ClientMessage.Answer]: (client: Client, raw: unknown) => {
      const msg = this.parse(client, AnswerSchema, raw);
      if (msg) this.handleAnswer(client, msg);
    },

    [ClientMessage.NextRound]: (client: Client, raw: unknown) => {
      if (!this.parse(client, NextRoundSchema, raw) || !this.requireHost(client)) return;
      if (!this.requirePhase(client, "round-results")) return;
      this.nextRound();
    },

    [ClientMessage.PlayAgain]: (client: Client, raw: unknown) => {
      if (!this.parse(client, PlayAgainSchema, raw) || !this.requireHost(client)) return;
      // Cùng điều kiện số người như startMatch: những người khác rời hết thì chỉ về phòng chờ được.
      this.requestBegin(client, "podium");
    },

    [ClientMessage.BackToLobby]: (client: Client, raw: unknown) => {
      if (!this.parse(client, BackToLobbySchema, raw) || !this.requireHost(client)) return;
      if (!this.requirePhase(client, "podium", "round-results")) return;
      this.resetMatch();
    },

    [ClientMessage.Ping]: (client: Client, raw: unknown) => replyPong(client, raw),

    // ------------------------------------------------------------ chat (CR-011)

    [ClientMessage.Chat]: (client: Client, raw: unknown) => {
      const msg = this.parse(client, ChatSendSchema, raw, "chat");
      if (msg) this.handleChat(client, msg);
    },

    [ClientMessage.SetChatEnabled]: (client: Client, raw: unknown) => {
      const msg = this.parse(client, SetChatEnabledSchema, raw, "chat");
      if (!msg || !this.requireHost(client, "chat")) return;
      this.state.chatEnabled = msg.enabled;
    },

    // ------------------------------------------------------------ bot (CR-016)

    [ClientMessage.AddBot]: (client: Client, raw: unknown) => {
      const msg = this.parse(client, AddBotSchema, raw);
      if (!msg || !this.requireHost(client) || !this.requirePhase(client, "lobby")) return;
      // Ghế tính cả bot (FR-PH-22).
      if (this.state.players.size >= MAX_PLAYERS) {
        this.sendError(client, { code: "invalid", message: "Phòng đã hết ghế." });
        return;
      }
      this.bots.add(msg.level);
    },

    [ClientMessage.RemoveBot]: (client: Client, raw: unknown) => {
      const msg = this.parse(client, RemoveBotSchema, raw);
      if (!msg || !this.requireHost(client) || !this.requirePhase(client, "lobby")) return;
      if (this.requireBot(client, msg.playerId)) this.removeBot(msg.playerId);
    },

    [ClientMessage.SetBotLevel]: (client: Client, raw: unknown) => {
      const msg = this.parse(client, SetBotLevelSchema, raw);
      if (!msg || !this.requireHost(client) || !this.requirePhase(client, "lobby")) return;
      if (this.requireBot(client, msg.playerId)) this.bots.setLevel(msg.playerId, msg.level);
    },
  };

  // ---------------------------------------------------------------- lifecycle

  override async onCreate(options: unknown) {
    this.roomId = await this.uniqueRoomCode();
    this.state.code = this.roomId;
    // Phòng riêng: chỉ vào được bằng mã, không bị ghép ngẫu nhiên.
    await this.setPrivate(true);
    this.createdAt = new Date();
    // Cấu hình party của quản trị viên (CR-019): phòng chờ hiện đúng hệ số ngay từ đầu.
    this.applyConfig(await getPartyConfig());
    // "Chơi với máy" (FR-PH-21): tạo phòng kèm bot. `bots` sai thì bị bỏ như không gửi.
    // Chỉ ghi nhớ ở đây; bot vào ngay sau người tạo (onJoin).
    this.pendingBots = CreateOptionsSchema.parse(options).bots;
  }

  override onJoin(client: Client, options: unknown) {
    if (this.state.phase !== "lobby") {
      throw new Error("Phòng đang chơi, vui lòng chờ hết trận.");
    }
    const opts = JoinOptionsSchema.parse(options ?? {});
    // Ghế tính cả bot (FR-PH-22): đủ ghế thì bot thêm gần nhất nhường chỗ cho người thật.
    let yielded: Omit<BotYieldedPayload, "playerId" | "playerName"> | undefined;
    if (this.state.players.size >= MAX_PLAYERS) {
      const botId = this.bots.newest();
      const bot = botId ? this.state.players.get(botId) : undefined;
      if (!botId || !bot) throw new Error("Phòng đã đầy.");
      yielded = { botId, botAvatar: isCharacterId(bot.avatar) ? bot.avatar : "khoi" };
      this.removeBot(botId);
    }
    const player = new Player();
    player.id = client.sessionId;
    player.name = opts.name;
    player.colorIndex = this.freeColor(opts.colorIndex);
    player.difficulty = opts.difficulty;
    this.state.players.set(client.sessionId, player);
    // Bản an toàn ngay (thú khoá → khoi, chưa đeo phụ kiện); có token thì nạp quyền chạy nền
    // (`authenticate`) rồi áp lại. Đặt trước khi thêm bot để bot tránh đúng nhân vật đang hiện.
    this.requestLoadout(client.sessionId, {
      avatar: opts.avatar,
      accessories: opts.accessories ?? [],
    });
    if (!this.state.hostId) this.setHost(client.sessionId);
    // Bot của "Chơi với máy" vào SAU người tạo: `freeColor` và chọn nhân vật thấy người tạo nên
    // tránh màu + nhân vật của họ. Người tạo đã là chủ phòng nên bot không bao giờ làm chủ.
    if (this.pendingBots) {
      const { count, level } = this.pendingBots;
      this.pendingBots = undefined;
      for (let i = 0; i < count; i++) this.bots.add(level);
    }
    if (yielded) {
      // Chỉ báo những người đã ở trong phòng; người vừa vào không nhận toast này.
      const payload: BotYieldedPayload = {
        ...yielded,
        playerId: client.sessionId,
        playerName: player.name,
      };
      this.broadcast(ServerMessage.BotYielded, payload, { except: client });
    }
    if (opts.accessToken) this.authenticate(client.sessionId, opts.accessToken);
    // Gửi trong onJoin: Colyseus giữ lại tới khi client xác nhận vào phòng rồi mới phát.
    client.send(ServerMessage.ChatHistory, this.chat.history());
  }

  override async onDrop(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (p) p.connected = false;
    // Giữ chỗ để người chơi điện thoại chuyển app / mất sóng có thể quay lại.
    await this.allowReconnection(client, RECONNECT_WINDOW_S);
  }

  override onReconnect(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (p) {
      p.connected = true;
      // Game có hạn trả lời: câu đang làm tính lại giờ hiện từ lúc nối lại (xem AnswerJudge.resume).
      this.judge.resume(client.sessionId, p, this.judgeRound());
    }
    // Nối lại thành công: gửi lại lịch sử để bù những tin lỡ trong lúc mất kết nối.
    client.send(ServerMessage.ChatHistory, this.chat.history());
  }

  override onLeave(client: Client) {
    const id = client.sessionId;
    this.state.players.delete(id);
    this.state.votes.delete(id);
    this.judge.forget(id);
    this.lastNudgeAt.delete(id);
    this.userIds.delete(id);
    this.pendingAuth.delete(id);
    this.requestedLoadouts.delete(id);
    this.ownership.delete(id);
    this.ownershipLoads.delete(id);
    this.cancelOwnershipRetry(id);
    this.chat.forget(id);
    // Bot không giữ phòng (FR-PH-23): hết người thật, kể cả người đang giữ chỗ, thì dọn bot và đóng
    // phòng. Phòng không có bot thì Colyseus tự huỷ khi trống như trước.
    if (!this.firstHumanId() && this.bots.count > 0) {
      this.clearTimers();
      for (const bot of this.bots.ids()) this.removeBot(bot);
      this.setHost("");
      void this.disconnect();
      return;
    }
    // Hẹn giờ của pha hiện tại (vòng quay, tự bắt đầu, hết giờ) vẫn chạy tiếp,
    // nên phòng không bị kẹt khi chủ phòng rời giữa chừng. Quyền chủ phòng chỉ sang người thật.
    if (this.state.hostId === id) this.setHost(this.firstHumanId() ?? "");
  }

  override onDispose() {
    this.clearTimers();
  }

  // ---------------------------------------------------------------- game flow

  /**
   * Lệnh bắt đầu trận (startMatch từ phòng chờ, playAgain từ vinh danh; người gọi đã kiểm quyền
   * chủ phòng). Sai điều kiện thì báo lỗi ngay. Đúng thì ghi lại làm lệnh mới nhất rồi chờ cấu
   * hình (`beginMatch`); đang chờ sẵn thì lượt chờ đó dùng lệnh này — vd. bấm Bắt đầu hai lần, hay
   * Chơi lại → Về phòng chờ → Bắt đầu trong lúc chờ — nên không lệnh nào bị bỏ im lặng.
   */
  private requestBegin(client: Client, from: StartFrom) {
    const error = this.beginError(from);
    if (error) {
      this.sendError(client, error);
      return;
    }
    this.startRequest = { from, requesterId: client.sessionId };
    if (this.starting) return;
    this.starting = true;
    // Lỗi sau `await` không được thành unhandled rejection (làm sập tiến trình): chỉ log.
    this.beginMatch().catch((err: unknown) => {
      console.error(`[PartyRoom ${this.state.code}] Không bắt đầu được trận:`, err);
    });
  }

  /**
   * Bắt đầu trận theo lệnh mới nhất (`startRequest`): nạp cấu hình party (CR-019, đệm 30 giây,
   * chờ tối đa `PARTY_CONFIG_WAIT_MS`), xoá điểm và tiến độ, vào chọn game vòng 1. Sau khi chờ thì
   * kiểm lại điều kiện (`beginError`) vì phòng có thể đã đổi (người mới vào, bỏ sẵn sàng, rời):
   * không bắt đầu được thì báo lỗi cho người ra lệnh (chủ phòng), không huỷ im lặng.
   */
  private async beginMatch() {
    try {
      const config = await getPartyConfig();
      const request = this.startRequest;
      // Lệnh đã bị huỷ trong lúc chờ (Về phòng chờ): chủ phòng tự huỷ nên không báo lỗi.
      if (!request) return;
      const error = this.beginError(request.from);
      if (error) {
        const requester = this.clients.getById(request.requesterId);
        if (requester) this.sendError(requester, error);
        return;
      }
      this.applyConfig(config);
      this.state.round = 1;
      this.state.gameId = "";
      this.state.seed = 0;
      this.state.startAt = 0;
      this.state.endsAt = 0;
      this.state.pickMode = "wheel";
      this.state.playedGames.clear();
      this.matchGames = [];
      this.matchRecorded = false;
      for (const p of this.state.players.values()) this.resetPlayerScores(p);
      this.enterGameSelect();
    } finally {
      this.starting = false;
      this.startRequest = null;
    }
  }

  /**
   * Lý do chưa bắt đầu được trận từ `from` (`null` = được): đúng pha, đủ người, ở phòng chờ thì mọi
   * người đã sẵn sàng. Dùng cho cả lúc nhận lệnh và lúc chờ cấu hình xong.
   */
  private beginError(from: StartFrom): ErrorPayload | null {
    if (this.state.phase !== from) {
      return { code: "bad-phase", message: "Không thể làm việc này lúc này." };
    }
    if (this.state.players.size < MIN_PLAYERS_TO_START) {
      return {
        code: "not-ready",
        message: `Cần ít nhất ${MIN_PLAYERS_TO_START} người để bắt đầu.`,
      };
    }
    if (from === "lobby" && ![...this.state.players.values()].every((p) => p.ready)) {
      return { code: "not-ready", message: "Chờ mọi người sẵn sàng." };
    }
    return null;
  }

  /** Áp bản chụp cấu hình party (CR-019) cho trận sắp chơi; chỉ ghi trường state nào đổi. */
  private applyConfig(config: PartyConfig) {
    this.config = config;
    this.state.configVersion = config.version;
    const scoringJson = JSON.stringify(config.scoring);
    if (this.state.scoringJson !== scoringJson) this.state.scoringJson = scoringJson;
    if ([...this.state.disabledGames].join(",") !== config.disabledGames.join(",")) {
      this.state.disabledGames.clear();
      this.state.disabledGames.push(...config.disabledGames);
    }
  }

  /** Game còn chơi được ở trận này: chưa chơi và không bị admin tắt (FR-VC-16, CR-019). */
  private availableGames(): GameId[] {
    return availableGames([...this.state.playedGames], enabledGameIds(this.config.disabledGames));
  }

  private enterGameSelect() {
    this.clearTimers();
    // Chơi hết mọi game đang bật rồi thì làm mới danh sách (FR-VC-16).
    if (this.availableGames().length === 0) this.state.playedGames.clear();
    this.state.votes.clear();
    this.clearWheel();
    this.state.introEndsAt = 0;
    for (const p of this.state.players.values()) p.introReady = false;
    this.state.phase = "game-select";
  }

  /** Server chọn kết quả vòng quay; mọi máy quay cùng lúc tới đúng lát đó (FR-VC-14). */
  private spinWheel() {
    const games = this.availableGames();
    const gameId = games[Math.floor(Math.random() * games.length)];
    if (!gameId) return;
    this.state.pickMode = "wheel";
    this.state.wheelGameId = gameId;
    this.state.wheelSpinAt = Date.now() + WHEEL_SPIN_LEAD_MS;
    this.state.wheelSpinMs = WHEEL_SPIN_MS;
    this.schedule(WHEEL_SPIN_LEAD_MS + WHEEL_SPIN_MS + WHEEL_RESULT_HOLD_MS, () => {
      if (this.state.phase === "game-select" && this.state.wheelGameId === gameId) {
        this.enterGameIntro(gameId);
      }
    });
  }

  private enterGameIntro(gameId: GameId) {
    this.clearTimers();
    this.state.gameId = gameId;
    for (const p of this.state.players.values()) p.introReady = false;
    this.state.introEndsAt = Date.now() + INTRO_AUTO_START_MS;
    this.state.phase = "game-intro";
    // Hết hạn thì tự bắt đầu, kể cả khi chưa ai bấm "Đã hiểu" (FR-VC-19).
    this.schedule(INTRO_AUTO_START_MS, () => this.startRound());
    // Bot bấm "Đã hiểu" sau vài giây (FR-PH-23).
    this.bots.onIntro();
  }

  private startRound() {
    const gameId = this.state.gameId;
    if (this.state.phase !== "game-intro" || !isGameId(gameId)) return;
    this.clearTimers();
    const game = getGame(gameId);
    const now = Date.now();

    this.state.seed = randomSeed();
    this.state.startAt = now + COUNTDOWN_MS;
    this.state.endsAt = this.state.startAt + game.durationMs;
    this.state.introEndsAt = 0;
    if (!this.state.playedGames.includes(gameId)) this.state.playedGames.push(gameId);
    this.matchGames.push(gameId);
    this.state.votes.clear();
    this.clearWheel();

    for (const p of this.state.players.values()) {
      p.roundScore = 0;
      p.roundCorrect = 0;
      p.progress = 0;
      p.streak = 0;
      p.lastPoints = 0;
    }
    this.judge.resetRound();
    this.state.phase = "countdown";

    const payload: RoundStartPayload = {
      round: this.state.round,
      gameId,
      seed: this.state.seed,
      startAt: this.state.startAt,
      durationMs: game.durationMs,
    };
    this.broadcast(ServerMessage.RoundStart, payload);

    this.schedule(COUNTDOWN_MS, () => {
      if (this.state.phase !== "countdown") return;
      this.state.phase = "playing";
      this.schedule(game.durationMs + LATE_ANSWER_GRACE_MS, () => this.endRound());
      // Hẹn giờ của bot đặt SAU hẹn hết giờ: cùng tới hạn trong một tick thì bot được chấm trước
      // (đồng hồ Colyseus chạy hẹn giờ mới đặt trước).
      this.bots.onPlaying();
    });
  }

  /** Vòng đang chơi theo góc nhìn của trọng tài chấm câu. */
  private judgeRound(): JudgeRound {
    return {
      playing: this.state.phase === "playing",
      round: this.state.round,
      gameId: this.state.gameId,
      seed: this.state.seed,
      startAt: this.state.startAt,
      endsAt: this.state.endsAt,
    };
  }

  private handleAnswer(client: Client, msg: z.infer<typeof AnswerSchema>) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    const outcome = this.judge.judge(client.sessionId, p, this.judgeRound(), msg);
    if (!outcome) return;
    this.applyOutcome(p, outcome);
    client.send(ServerMessage.AnswerResult, outcome.result);
  }

  /** Cộng kết quả một câu đã chấm vào điểm vòng — dùng chung cho người và bot (CR-016). */
  private applyOutcome(p: Player, outcome: JudgeOutcome) {
    if (!outcome.correct) return;
    p.roundScore += outcome.points;
    p.roundCorrect += 1;
  }

  /** Hết giờ: xếp hạng có hoà, cộng điểm trận, luôn sang bảng điểm vòng (kể cả vòng cuối). */
  private endRound() {
    if (this.state.phase !== "playing") return;
    this.clearTimers();
    const category = isGameId(this.state.gameId) ? getGame(this.state.gameId).category : null;
    const winners = new Set<string>();
    const seats = [...this.state.players.values()];
    const { placementTopBonus } = this.config.scoring;
    for (const { player, rank } of rankByRound(seats)) {
      if (rank === 0) winners.add(player.id);
      // Co giãn theo số ghế lúc hết vòng, tính cả bot và người đang giữ chỗ (CR-018).
      player.lastPoints = placementPoints(rank, seats.length, placementTopBonus);
      player.matchPoints += player.lastPoints;
      player.totalScore += player.roundScore;
      // Tạo khoá cả khi 0 điểm: có khoá = đã chơi thể loại này (PlayerView.categoryScores).
      if (category) {
        const prev = player.categoryScores.get(category) ?? 0;
        player.categoryScores.set(category, prev + player.roundScore);
      }
    }
    this.state.phase = "round-results";
    this.bots.onRoundResults(winners);
  }

  private nextRound() {
    if (this.state.round >= this.state.totalRounds) {
      this.clearTimers();
      this.state.phase = "podium";
      this.recordMatch();
      this.bots.onPodium();
      return;
    }
    this.state.round += 1;
    this.enterGameSelect();
  }

  /** Về phòng chờ: huỷ hẹn giờ và lệnh bắt đầu đang chờ cấu hình, xoá điểm, tiến độ, sẵn sàng, game đã chơi. */
  private resetMatch() {
    this.clearTimers();
    this.startRequest = null;
    this.state.phase = "lobby";
    this.state.round = 0;
    this.state.gameId = "";
    this.state.seed = 0;
    this.state.startAt = 0;
    this.state.endsAt = 0;
    this.state.pickMode = "wheel";
    this.state.playedGames.clear();
    this.state.votes.clear();
    this.clearWheel();
    this.state.introEndsAt = 0;
    for (const p of this.state.players.values()) {
      this.resetPlayerScores(p);
      // Bot giữ ghế qua Về phòng chờ và luôn sẵn sàng (CR-016).
      p.ready = p.isBot;
    }
  }

  /** Chủ phòng nhắc một người về độ khó đa số; tối đa 1 lần / NUDGE_COOLDOWN_MS / người. */
  private nudge(host: Client, targetId: string) {
    // Bot không bị nhắc độ khó (FR-PH-23): độ khó của bot cố định theo mức.
    if (
      targetId === this.state.hostId ||
      !this.state.players.has(targetId) ||
      this.bots.has(targetId)
    ) {
      this.sendError(host, { code: "invalid", message: "Không nhắc được người này." });
      return;
    }
    const now = Date.now();
    if (now - (this.lastNudgeAt.get(targetId) ?? 0) < NUDGE_COOLDOWN_MS) {
      this.sendError(host, { code: "rate-limited", message: "Vừa nhắc người này, chờ một chút." });
      return;
    }
    // Độ khó đa số chỉ tính người thật (FR-PH-23).
    const difficulty = majorityDifficulty(
      [...this.state.players.values()].filter((p) => !p.isBot).map((p) => p.difficulty),
    );
    if (difficulty === null) {
      this.sendError(host, { code: "invalid", message: "Cả phòng chưa có mức độ khó chung." });
      return;
    }
    this.lastNudgeAt.set(targetId, now);
    const payload: NudgePayload = { difficulty };
    this.clients.getById(targetId)?.send(ServerMessage.Nudge, payload);
  }

  /**
   * Tin chat: chặn khi chat tắt hoặc sai pha, giới hạn tần suất, làm sạch + lọc, gắn danh tính
   * từ PlayerState rồi phát cho cả phòng. Không đụng state đồng bộ.
   */
  private handleChat(client: Client, msg: z.infer<typeof ChatSendSchema>) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    if (!this.state.chatEnabled) {
      this.chatError(client, "chat-disabled", "Chủ phòng đã tắt chat.");
      return;
    }
    if (!isChatPhase(this.state.phase)) {
      this.chatError(client, "bad-phase", "Không chat được khi đang chơi.");
      return;
    }
    const outcome = this.chat.accept(p, msg, Date.now());
    if (outcome.ok) {
      this.broadcast(ServerMessage.Chat, outcome.message);
    } else if (outcome.reason === "rate-limited") {
      this.chatError(client, "rate-limited", "Gửi chậm lại một chút.");
    } else {
      this.chatError(client, "invalid", "Tin nhắn trống.");
    }
  }

  /**
   * Biểu cảm nhanh của bot (FR-PH-25): cùng luật chat với người — chat tắt hoặc sai pha thì im,
   * giới hạn tần suất của `ChatRelay`; tin mang `bot: true`. Bị chặn thì bỏ, không báo lỗi.
   */
  private sendBotChat(bot: Player, quickId: ChatQuickId) {
    if (!this.state.chatEnabled || !isChatPhase(this.state.phase)) return;
    const outcome = this.chat.accept(bot, { kind: "quick", id: quickId }, Date.now());
    if (outcome.ok) this.broadcast(ServerMessage.Chat, outcome.message);
  }

  // ---------------------------------------------------------------- tài khoản (ADR 0011)

  /**
   * Xác thực token chạy nền: không chặn vào phòng; token sai vẫn chơi, chỉ không ghi kết quả, không
   * nhận phấn, không dùng được thú khoá / phụ kiện. Xác thực xong thì nạp quyền đồ trang trí.
   */
  private authenticate(id: string, token: string) {
    if (!this.store.enabled) return;
    const task: Promise<void> = this.store
      .verifyToken(token)
      .catch(() => null)
      .then((userId) => {
        // Người chơi đã rời trong lúc chờ thì bỏ.
        if (userId && this.state.players.has(id)) {
          this.userIds.set(id, userId);
          this.loadOwnership(id);
        }
        if (this.pendingAuth.get(id) === task) this.pendingAuth.delete(id);
      });
    this.pendingAuth.set(id, task);
  }

  // ---------------------------------------------------------------- đồ trang trí (CR-023, CR-024)

  /** Ghi bộ đồ người chơi xin, áp ngay theo quyền đang có, rồi nạp lại quyền nếu cần. */
  private requestLoadout(id: string, requested: RequestedLoadout) {
    this.requestedLoadouts.set(id, {
      avatar: requested.avatar,
      accessories: [...requested.accessories],
    });
    this.applyLoadout(id);
    this.loadOwnership(id);
  }

  /**
   * Nạp quyền (`loadCosmetics`, store đệm 60 giây; bản đệm thiếu món / thú đang xin thì đọc lại DB,
   * ≤ 1 lần mỗi người mỗi 5 giây) cho người đã xác thực đang xin thú khoá hoặc phụ kiện, chạy nền.
   * Xong thì áp lại — trừ khi người đó đã rời hoặc đã có lượt nạp mới hơn.
   * Store lỗi (`null`) thì giữ quyền đã nạp trước đó (chưa có thì vẫn là bản an toàn).
   * Store báo hoãn (bản đệm thiếu món / thú vừa có mà còn trong cửa sổ chống dồn) → hẹn đúng một lần
   * đọc lại khi hết cửa sổ (`retry` = lượt đọc lại đó, không hẹn tiếp). Lượt nạp mới huỷ hẹn cũ.
   */
  private loadOwnership(id: string, retry = false) {
    if (!retry) this.cancelOwnershipRetry(id);
    const userId = this.userIds.get(id);
    const requested = this.requestedLoadouts.get(id);
    if (!userId || !requested || !needsOwnership(requested)) return;
    const seq = (this.ownershipLoads.get(id) ?? 0) + 1;
    this.ownershipLoads.set(id, seq);
    let retryInMs = -1;
    void this.store
      .loadCosmetics(userId, {
        isEnough: (owned) => ownsRequested(requested, owned),
        onDeferred: retry
          ? undefined
          : (ms) => {
              retryInMs = ms;
            },
      })
      .catch(() => null)
      .then((owned) => {
        if (this.ownershipLoads.get(id) !== seq || !this.state.players.has(id)) return;
        if (owned) this.ownership.set(id, owned);
        this.applyLoadout(id);
        if (retryInMs >= 0) this.scheduleOwnershipRetry(id, seq, requested, retryInMs);
      });
  }

  /** Hẹn một lần đọc lại quyền; bỏ nếu khi tới giờ người đó đã rời, đổi yêu cầu hoặc có lượt nạp mới. */
  private scheduleOwnershipRetry(
    id: string,
    seq: number,
    requested: RequestedLoadout,
    retryInMs: number,
  ) {
    this.cancelOwnershipRetry(id);
    const timer = this.clock.setTimeout(() => {
      if (this.ownershipRetries.get(id) === timer) this.ownershipRetries.delete(id);
      if (
        this.ownershipLoads.get(id) !== seq ||
        this.requestedLoadouts.get(id) !== requested ||
        !this.state.players.has(id)
      ) {
        return;
      }
      this.loadOwnership(id, true);
    }, retryInMs + OWNERSHIP_RETRY_MARGIN_MS);
    this.ownershipRetries.set(id, timer);
  }

  private cancelOwnershipRetry(id: string) {
    this.ownershipRetries.get(id)?.clear();
    this.ownershipRetries.delete(id);
  }

  /** Đưa bộ đồ đã kiểm (`resolveLoadout`) vào state; chỉ ghi trường nào đổi. Bot không có phụ kiện. */
  private applyLoadout(id: string) {
    const p = this.state.players.get(id);
    const requested = this.requestedLoadouts.get(id);
    if (!p || p.isBot || !requested) return;
    const { avatar, accessories } = resolveLoadout(requested, this.ownership.get(id));
    if (p.avatar !== avatar) p.avatar = avatar;
    if ([...p.accessories].join(",") !== accessories.join(",")) {
      p.accessories.clear();
      p.accessories.push(...accessories);
    }
  }

  // ---------------------------------------------------------------- kết quả + phấn

  /**
   * Vào `podium`: ghi `match_results` cho người đã xác thực, rồi cộng phấn party cho từng người
   * (`grantPartyChalk`). Chạy nền; lỗi ghi trận chỉ log (khi đó không cộng phấn).
   */
  private recordMatch() {
    if (this.matchRecorded || !this.store.enabled) return;
    this.matchRecorded = true;
    const roomCode = this.state.code;
    const rounds = this.state.round;
    const settingsVersion = this.config.version;
    const games = [...this.matchGames];
    const seats = [...this.state.players.values()];
    // Bot tính vào `players` (tổng ghế) nhưng không có dòng riêng (không có tài khoản), CR-016.
    const botCount = seats.filter((p) => p.isBot).length;
    // Chụp user_id lúc vào podium (người rời sau đó vẫn được tính); người xác thực xong sau đó thì
    // đọc ở `this.userIds` khi các lượt xác thực đang chạy đã xong.
    const authedAtPodium = new Map(this.userIds);
    const userIdOf = (id: string) => authedAtPodium.get(id) ?? this.userIds.get(id);
    // Chốt bảng xếp hạng ngay lúc vào podium (người rời sau đó vẫn được ghi đúng hạng).
    const ranked = rankByMatch(seats).map(({ player, rank }) => ({
      id: player.id,
      placement: rank,
      matchPoints: player.matchPoints,
      totalScore: player.totalScore,
      categoryScores: Object.fromEntries(player.categoryScores.entries()) as Partial<
        Record<Category, number>
      >,
    }));
    // Danh hiệu "giỏi nhất mỗi thể loại" (CR-010): id người → các thể loại người đó giành.
    const titles = new Map<string, Category[]>();
    for (const { category, leaderIds } of categoryLeaders(ranked, playedCategories(games))) {
      for (const id of leaderIds) titles.set(id, [...(titles.get(id) ?? []), category]);
    }
    void Promise.all(this.pendingAuth.values())
      .then(async () => {
        const humans = countHumans(seats, userIdOf);
        const rows: MatchResultRecord[] = [];
        const earners: ChalkEarner[] = [];
        for (const r of ranked) {
          const userId = userIdOf(r.id);
          if (!userId) continue;
          earners.push({ sessionId: r.id, userId, placement: r.placement });
          rows.push({
            userId,
            roomCode,
            placement: r.placement,
            players: ranked.length,
            botCount,
            matchPoints: r.matchPoints,
            totalScore: r.totalScore,
            rounds,
            games,
            categoryScores: r.categoryScores,
            categoryTitles: titles.get(r.id) ?? [],
            settingsVersion,
          });
        }
        if (rows.length === 0) return;
        const matchKey = await this.store.saveMatchResults(rows);
        // `ref` theo bản ghi vừa lưu: cùng trận → cùng ref → `grant_chalk` không cộng hai lần.
        await this.grantPartyChalk(earners, `${roomCode}:${matchKey}`, rounds, humans);
      })
      .catch((err: unknown) => {
        console.error(`[PartyRoom ${roomCode}] Không ghi được kết quả trận:`, err);
      });
  }

  /**
   * Cộng phấn party (`partyChalkReward`, Postgres kẹp trần ngày) cho từng tài khoản đã xác thực rồi
   * gửi riêng `ServerMessage.Reward` với số thực cộng cho các phiên của tài khoản đó còn kết nối.
   * Một tài khoản mở hai thẻ trong cùng phòng chỉ được cộng một lần, theo hạng tốt hơn (cùng `ref`
   * nên `grant_chalk` cũng chặn). Chạm trần → gửi `{ chalk: 0 }` (web hiện "đã đủ phấn"); lỗi phấn
   * (store trả `null` hoặc ném) → không gửi gì. Không bao giờ ném: lỗi phấn không làm hỏng trận.
   */
  private async grantPartyChalk(
    earners: readonly ChalkEarner[],
    ref: string,
    rounds: number,
    humans: number,
  ) {
    const byUser = new Map<string, { placement: number; sessionIds: string[] }>();
    for (const { sessionId, userId, placement } of earners) {
      const seen = byUser.get(userId);
      if (!seen) byUser.set(userId, { placement, sessionIds: [sessionId] });
      else {
        seen.placement = Math.min(seen.placement, placement);
        seen.sessionIds.push(sessionId);
      }
    }
    await Promise.all(
      [...byUser].map(async ([userId, { placement, sessionIds }]) => {
        const amount = partyChalkReward({ rounds, placement, humans });
        const chalk = await this.store
          .grantChalk(userId, "party", ref, amount)
          .catch((err: unknown) => {
            console.warn(`[PartyRoom ${ref}] Không cộng được phấn:`, err);
            return null;
          });
        if (chalk === null) return;
        const payload: RewardPayload = { chalk };
        for (const id of sessionIds) this.clients.getById(id)?.send(ServerMessage.Reward, payload);
      }),
    );
  }

  // ---------------------------------------------------------------- trang quản trị (CR-019)

  /** Tóm tắt phòng cho `GET /admin/rooms`: chỉ số liệu, không có tên người chơi. */
  adminView(): AdminRoomView {
    let humans = 0;
    let bots = 0;
    let connected = 0;
    for (const p of this.state.players.values()) {
      if (p.isBot) {
        bots++;
      } else {
        humans++;
        if (p.connected) connected++;
      }
    }
    return {
      roomId: this.roomId,
      code: this.state.code,
      phase: this.state.phase as Phase,
      round: this.state.round,
      totalRounds: this.state.totalRounds,
      gameId: this.state.gameId,
      humans,
      bots,
      connected,
      configVersion: this.state.configVersion,
      createdAt: this.createdAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------- helpers

  private resetPlayerScores(p: Player) {
    p.matchPoints = 0;
    p.lastPoints = 0;
    p.totalScore = 0;
    p.categoryScores.clear();
    p.roundScore = 0;
    p.roundCorrect = 0;
    p.progress = 0;
    p.streak = 0;
    p.introReady = false;
  }

  private clearWheel() {
    this.state.wheelGameId = "";
    this.state.wheelSpinAt = 0;
    this.state.wheelSpinMs = 0;
  }

  /** Người thật đầu tiên còn trong phòng (kể cả đang giữ chỗ); bot không bao giờ làm chủ phòng. */
  private firstHumanId(): string | undefined {
    for (const p of this.state.players.values()) if (!p.isBot) return p.id;
    return undefined;
  }

  /** Bỏ một bot khỏi phòng (chủ phòng bỏ, nhường ghế, đóng phòng). */
  private removeBot(id: string) {
    this.bots.remove(id);
    this.state.votes.delete(id);
    this.judge.forget(id);
    this.lastNudgeAt.delete(id);
    this.chat.forget(id);
  }

  private setHost(id: string) {
    this.state.hostId = id;
    // Chủ phòng không bỏ phiếu: người vừa nhận quyền mất phiếu đang có.
    this.state.votes.delete(id);
    for (const p of this.state.players.values()) p.isHost = p.id === id;
  }

  /** Giữ màu người chơi chọn nếu chưa ai dùng, nếu trùng thì lấy màu trống đầu tiên. */
  private freeColor(preferred: number) {
    const used = new Set([...this.state.players.values()].map((p) => p.colorIndex));
    if (!used.has(preferred)) return preferred;
    for (let i = 0; i < AVATAR_COLORS.length; i++) if (!used.has(i)) return i;
    return preferred;
  }

  private schedule(ms: number, fn: () => void) {
    this.timers.push(this.clock.setTimeout(fn, ms));
  }

  /** Huỷ hẹn giờ của pha hiện tại, gồm cả hẹn giờ của bot (trả lời, "Đã hiểu", biểu cảm). */
  private clearTimers() {
    for (const t of this.timers) t.clear();
    this.timers = [];
    this.bots.clear();
  }

  private async uniqueRoomCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = generateRoomCode();
      const existing = await matchMaker.query({ roomId: code });
      if (existing.length === 0) return code;
    }
    throw new Error("Không tạo được mã phòng, hãy thử lại.");
  }

  private parse<S extends z.ZodType>(
    client: Client,
    schema: S,
    raw: unknown,
    source?: ErrorPayload["source"],
  ) {
    return parseMessage(client, schema, raw, source);
  }

  private requireHost(client: Client, source?: ErrorPayload["source"]) {
    if (client.sessionId === this.state.hostId) return true;
    this.sendError(
      client,
      withSource({ code: "not-host", message: "Chỉ chủ phòng mới làm được việc này." }, source),
    );
    return false;
  }

  private requirePhase(client: Client, ...phases: Phase[]) {
    if (phases.includes(this.state.phase as Phase)) return true;
    this.sendError(client, { code: "bad-phase", message: "Không thể làm việc này lúc này." });
    return false;
  }

  /** `playerId` phải là bot của phòng (lệnh removeBot, setBotLevel). */
  private requireBot(client: Client, playerId: string) {
    if (this.bots.has(playerId)) return true;
    this.sendError(client, { code: "invalid", message: "Không có bot này trong phòng." });
    return false;
  }

  /** Vòng quay đã quay thì không đổi chế độ, không quay lại, không chọn game khác được nữa. */
  private requireWheelIdle(client: Client) {
    if (this.state.wheelGameId === "") return true;
    this.sendError(client, { code: "bad-phase", message: "Vòng quay đang quay." });
    return false;
  }

  /** Game phải còn trong danh sách chưa chơi của trận (FR-VC-16) và không bị admin tắt (CR-019). */
  private requireAvailable(client: Client, gameId: GameId) {
    if (this.availableGames().includes(gameId)) return true;
    const disabled = !enabledGameIds(this.config.disabledGames).includes(gameId);
    this.sendError(client, {
      code: "invalid",
      message: disabled ? "Game này đang tắt." : "Game này đã chơi trong trận.",
    });
    return false;
  }

  private sendError(client: Client, error: ErrorPayload) {
    sendError(client, error);
  }

  /** Lỗi của tin chat: gắn `source: "chat"` để client không nhầm với lệnh khác đang chờ. */
  private chatError(client: Client, code: ErrorPayload["code"], message: string) {
    sendError(client, { code, message, source: "chat" });
  }
}
