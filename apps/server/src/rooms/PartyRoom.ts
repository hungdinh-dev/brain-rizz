import {
  AnswerSchema,
  AVATAR_COLORS,
  availableGames,
  BackToLobbySchema,
  ClientMessage,
  COUNTDOWN_MS,
  type ErrorPayload,
  type GameId,
  generateRoomCode,
  getGame,
  INTRO_AUTO_START_MS,
  IntroReadySchema,
  isGameId,
  JoinOptionsSchema,
  LATE_ANSWER_GRACE_MS,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  majorityDifficulty,
  NextRoundSchema,
  NUDGE_COOLDOWN_MS,
  NudgeDifficultySchema,
  type NudgePayload,
  type Phase,
  PickGameSchema,
  PlayAgainSchema,
  placementPoints,
  RECONNECT_WINDOW_S,
  ReadySchema,
  type RoundStartPayload,
  randomSeed,
  rankByMatch,
  rankByRound,
  ServerMessage,
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
import { getResultStore, type MatchResultRecord } from "../store/ResultStore";
import { AnswerJudge } from "./AnswerJudge";
import { parseMessage, replyPong, sendError } from "./messages";
import { PartyState, Player } from "./schema/PartyState";

/**
 * Một phòng chơi = một nhóm bạn (tối đa 8 người), vào bằng mã 4 ký tự.
 *
 * Mô hình "server làm trọng tài, client tự chơi":
 *  - Server phát seed, giữ đồng hồ, chấm điểm.
 *  - Client tự sinh câu đố từ seed (cùng code trong @brain-rizz/shared) và chỉ gửi đáp án.
 *
 * Vòng đời một trận (CR-005, xem docs/02-architecture/overview.md):
 * lobby → game-select → game-intro → countdown → playing → round-results
 *       → (còn vòng) game-select … | (hết vòng) podium → game-select (Chơi lại) | lobby
 *
 * Mỗi lần đổi pha đều huỷ hẹn giờ của pha cũ (`clearTimers`), nên hẹn giờ không bao giờ
 * "bắn nhầm" sang pha khác; mỗi callback hẹn giờ vẫn tự kiểm tra lại pha cho chắc.
 */
export class PartyRoom extends Room<{ state: PartyState }> {
  override maxClients = MAX_PLAYERS;
  override state = new PartyState();

  /** Chấm từng câu (giờ hiện câu, khoá khi sai, chống spam), dùng chung với BrainTestRoom. */
  private judge = new AnswerJudge();
  /** Lần cuối chủ phòng nhắc độ khó từng người (giờ server). */
  private lastNudgeAt = new Map<string, number>();
  private timers: Delayed[] = [];

  /** Nơi ghi kết quả trận (ADR 0011). */
  private store = getResultStore();
  /** sessionId → user_id Supabase đã xác thực. Không đồng bộ xuống client; giữ qua nối lại. */
  private userIds = new Map<string, string>();
  /** Xác thực token đang chạy (ghi kết quả trận chờ các lượt này xong). */
  private pendingAuth = new Map<string, Promise<void>>();
  /** Game đã chơi trong trận này, theo thứ tự (ghi vào match_results). */
  private matchGames: string[] = [];
  /** Đã ghi kết quả trận hiện tại chưa (mỗi trận đúng một lần). */
  private matchRecorded = false;

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
      if (msg.avatar !== undefined) p.avatar = msg.avatar;
      if (msg.difficulty !== undefined) p.difficulty = msg.difficulty;
    },

    [ClientMessage.SetRounds]: (client: Client, raw: unknown) => {
      const msg = this.parse(client, SetRoundsSchema, raw);
      if (!msg || !this.requireHost(client) || !this.requirePhase(client, "lobby")) return;
      this.state.totalRounds = msg.totalRounds;
    },

    [ClientMessage.StartMatch]: (client: Client, raw: unknown) => {
      if (!this.parse(client, StartMatchSchema, raw) || !this.requireHost(client)) return;
      if (!this.requirePhase(client, "lobby") || !this.requireEnoughPlayers(client)) return;
      if (![...this.state.players.values()].every((p) => p.ready)) {
        this.sendError(client, { code: "not-ready", message: "Chờ mọi người sẵn sàng." });
        return;
      }
      this.beginMatch();
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
      const waiting = [...this.state.players.values()].some(
        (p) => p.id !== this.state.hostId && !p.introReady,
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
      if (!this.requirePhase(client, "podium") || !this.requireEnoughPlayers(client)) return;
      this.beginMatch();
    },

    [ClientMessage.BackToLobby]: (client: Client, raw: unknown) => {
      if (!this.parse(client, BackToLobbySchema, raw) || !this.requireHost(client)) return;
      if (!this.requirePhase(client, "podium", "round-results")) return;
      this.resetMatch();
    },

    [ClientMessage.Ping]: (client: Client, raw: unknown) => replyPong(client, raw),
  };

  // ---------------------------------------------------------------- lifecycle

  override async onCreate() {
    this.roomId = await this.uniqueRoomCode();
    this.state.code = this.roomId;
    // Phòng riêng: chỉ vào được bằng mã, không bị ghép ngẫu nhiên.
    await this.setPrivate(true);
  }

  override onJoin(client: Client, options: unknown) {
    if (this.state.phase !== "lobby") {
      throw new Error("Phòng đang chơi, vui lòng chờ hết trận.");
    }
    const opts = JoinOptionsSchema.parse(options ?? {});
    const player = new Player();
    player.id = client.sessionId;
    player.name = opts.name;
    player.colorIndex = this.freeColor(opts.colorIndex);
    player.avatar = opts.avatar;
    player.difficulty = opts.difficulty;
    this.state.players.set(client.sessionId, player);
    if (!this.state.hostId) this.setHost(client.sessionId);
    if (opts.accessToken) this.authenticate(client.sessionId, opts.accessToken);
  }

  override async onDrop(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (p) p.connected = false;
    // Giữ chỗ để người chơi điện thoại chuyển app / mất sóng có thể quay lại.
    await this.allowReconnection(client, RECONNECT_WINDOW_S);
  }

  override onReconnect(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (p) p.connected = true;
  }

  override onLeave(client: Client) {
    const id = client.sessionId;
    this.state.players.delete(id);
    this.state.votes.delete(id);
    this.judge.forget(id);
    this.lastNudgeAt.delete(id);
    this.userIds.delete(id);
    this.pendingAuth.delete(id);
    // Hẹn giờ của pha hiện tại (vòng quay, tự bắt đầu, hết giờ) vẫn chạy tiếp,
    // nên phòng không bị kẹt khi chủ phòng rời giữa chừng.
    if (this.state.hostId === id) {
      const next = this.state.players.keys().next().value;
      this.setHost(next ?? "");
    }
  }

  override onDispose() {
    this.clearTimers();
  }

  // ---------------------------------------------------------------- game flow

  /** Bắt đầu trận (từ phòng chờ hoặc "Chơi lại"): xoá điểm và tiến độ, vào chọn game vòng 1. */
  private beginMatch() {
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
  }

  private enterGameSelect() {
    this.clearTimers();
    // Chơi hết mọi game rồi thì làm mới danh sách (FR-VC-16).
    if (availableGames([...this.state.playedGames]).length === 0) this.state.playedGames.clear();
    this.state.votes.clear();
    this.clearWheel();
    this.state.introEndsAt = 0;
    for (const p of this.state.players.values()) p.introReady = false;
    this.state.phase = "game-select";
  }

  /** Server chọn kết quả vòng quay; mọi máy quay cùng lúc tới đúng lát đó (FR-VC-14). */
  private spinWheel() {
    const games = availableGames([...this.state.playedGames]);
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
    });
  }

  private handleAnswer(client: Client, msg: z.infer<typeof AnswerSchema>) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    const outcome = this.judge.judge(
      client.sessionId,
      p,
      {
        playing: this.state.phase === "playing",
        round: this.state.round,
        gameId: this.state.gameId,
        seed: this.state.seed,
        startAt: this.state.startAt,
        endsAt: this.state.endsAt,
      },
      msg,
    );
    if (!outcome) return;
    if (outcome.correct) {
      p.roundScore += outcome.points;
      p.roundCorrect += 1;
    }
    client.send(ServerMessage.AnswerResult, outcome.result);
  }

  /** Hết giờ: xếp hạng có hoà, cộng điểm trận, luôn sang bảng điểm vòng (kể cả vòng cuối). */
  private endRound() {
    if (this.state.phase !== "playing") return;
    this.clearTimers();
    for (const { player, rank } of rankByRound([...this.state.players.values()])) {
      player.lastPoints = placementPoints(rank);
      player.matchPoints += player.lastPoints;
      player.totalScore += player.roundScore;
    }
    this.state.phase = "round-results";
  }

  private nextRound() {
    if (this.state.round >= this.state.totalRounds) {
      this.clearTimers();
      this.state.phase = "podium";
      this.recordMatch();
      return;
    }
    this.state.round += 1;
    this.enterGameSelect();
  }

  /** Về phòng chờ: huỷ hẹn giờ, xoá điểm, tiến độ, sẵn sàng, game đã chơi. */
  private resetMatch() {
    this.clearTimers();
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
      p.ready = false;
    }
  }

  /** Chủ phòng nhắc một người về độ khó đa số; tối đa 1 lần / NUDGE_COOLDOWN_MS / người. */
  private nudge(host: Client, targetId: string) {
    if (targetId === this.state.hostId || !this.state.players.has(targetId)) {
      this.sendError(host, { code: "invalid", message: "Không nhắc được người này." });
      return;
    }
    const now = Date.now();
    if (now - (this.lastNudgeAt.get(targetId) ?? 0) < NUDGE_COOLDOWN_MS) {
      this.sendError(host, { code: "rate-limited", message: "Vừa nhắc người này, chờ một chút." });
      return;
    }
    const difficulty = majorityDifficulty(
      [...this.state.players.values()].map((p) => p.difficulty),
    );
    if (difficulty === null) {
      this.sendError(host, { code: "invalid", message: "Cả phòng chưa có mức độ khó chung." });
      return;
    }
    this.lastNudgeAt.set(targetId, now);
    const payload: NudgePayload = { difficulty };
    this.clients.getById(targetId)?.send(ServerMessage.Nudge, payload);
  }

  // ---------------------------------------------------------------- tài khoản (ADR 0011)

  /** Xác thực token chạy nền: không chặn vào phòng; token sai vẫn chơi, chỉ không ghi kết quả. */
  private authenticate(id: string, token: string) {
    if (!this.store.enabled) return;
    const task: Promise<void> = this.store.verifyToken(token).then((userId) => {
      // Người chơi đã rời trong lúc chờ thì bỏ.
      if (userId && this.state.players.has(id)) this.userIds.set(id, userId);
      if (this.pendingAuth.get(id) === task) this.pendingAuth.delete(id);
    });
    this.pendingAuth.set(id, task);
  }

  /** Vào `podium`: ghi `match_results` cho người đã xác thực, chạy nền, lỗi chỉ log. */
  private recordMatch() {
    if (this.matchRecorded || !this.store.enabled) return;
    this.matchRecorded = true;
    const roomCode = this.state.code;
    const rounds = this.state.round;
    const games = [...this.matchGames];
    // Chốt bảng xếp hạng ngay lúc vào podium (người rời sau đó vẫn được ghi đúng hạng).
    const ranked = rankByMatch([...this.state.players.values()]).map(({ player, rank }) => ({
      id: player.id,
      placement: rank,
      matchPoints: player.matchPoints,
      totalScore: player.totalScore,
    }));
    const userIds = this.userIds;
    void Promise.all(this.pendingAuth.values())
      .then(() => {
        const rows: MatchResultRecord[] = [];
        for (const r of ranked) {
          const userId = userIds.get(r.id);
          if (!userId) continue;
          rows.push({
            userId,
            roomCode,
            placement: r.placement,
            players: ranked.length,
            matchPoints: r.matchPoints,
            totalScore: r.totalScore,
            rounds,
            games,
          });
        }
        return rows.length > 0 ? this.store.saveMatchResults(rows) : undefined;
      })
      .catch((err: unknown) => {
        console.error(`[PartyRoom ${roomCode}] Không ghi được kết quả trận:`, err);
      });
  }

  // ---------------------------------------------------------------- helpers

  private resetPlayerScores(p: Player) {
    p.matchPoints = 0;
    p.lastPoints = 0;
    p.totalScore = 0;
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

  private clearTimers() {
    for (const t of this.timers) t.clear();
    this.timers = [];
  }

  private async uniqueRoomCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = generateRoomCode();
      const existing = await matchMaker.query({ roomId: code });
      if (existing.length === 0) return code;
    }
    throw new Error("Không tạo được mã phòng, hãy thử lại.");
  }

  private parse<S extends z.ZodType>(client: Client, schema: S, raw: unknown) {
    return parseMessage(client, schema, raw);
  }

  private requireHost(client: Client) {
    if (client.sessionId === this.state.hostId) return true;
    this.sendError(client, { code: "not-host", message: "Chỉ chủ phòng mới làm được việc này." });
    return false;
  }

  private requirePhase(client: Client, ...phases: Phase[]) {
    if (phases.includes(this.state.phase as Phase)) return true;
    this.sendError(client, { code: "bad-phase", message: "Không thể làm việc này lúc này." });
    return false;
  }

  /** Trận chỉ bắt đầu (startMatch) hoặc chơi lại (playAgain) khi phòng có ≥ MIN_PLAYERS_TO_START người. */
  private requireEnoughPlayers(client: Client) {
    if (this.state.players.size >= MIN_PLAYERS_TO_START) return true;
    this.sendError(client, {
      code: "not-ready",
      message: `Cần ít nhất ${MIN_PLAYERS_TO_START} người để bắt đầu.`,
    });
    return false;
  }

  /** Vòng quay đã quay thì không đổi chế độ, không quay lại, không chọn game khác được nữa. */
  private requireWheelIdle(client: Client) {
    if (this.state.wheelGameId === "") return true;
    this.sendError(client, { code: "bad-phase", message: "Vòng quay đang quay." });
    return false;
  }

  /** Game phải còn trong danh sách chưa chơi của trận (FR-VC-16). */
  private requireAvailable(client: Client, gameId: GameId) {
    if (availableGames([...this.state.playedGames]).includes(gameId)) return true;
    this.sendError(client, { code: "invalid", message: "Game này đã chơi trong trận." });
    return false;
  }

  private sendError(client: Client, error: ErrorPayload) {
    sendError(client, error);
  }
}
