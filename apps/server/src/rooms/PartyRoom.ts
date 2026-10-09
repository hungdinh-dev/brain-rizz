import {
  type AnswerResultPayload,
  AnswerSchema,
  AVATAR_COLORS,
  ClientMessage,
  COUNTDOWN_MS,
  DEFAULT_TOTAL_ROUNDS,
  type Difficulty,
  type ErrorPayload,
  generateRoomCode,
  getGame,
  isGameId,
  JoinOptionsSchema,
  LATE_ANSWER_GRACE_MS,
  MAX_ANSWERS_PER_SECOND,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  type Phase,
  PingSchema,
  type PongPayload,
  placementPoints,
  pointsForCorrect,
  RECONNECT_WINDOW_S,
  ReadySchema,
  type RoundStartPayload,
  randomSeed,
  ServerMessage,
  SetProfileSchema,
  StartRoundSchema,
  WRONG_ANSWER_LOCK_MS,
} from "@brain-rizz/shared";
import { type Client, type Delayed, matchMaker, Room } from "colyseus";
import type { z } from "zod";
import { PartyState, Player } from "./schema/PartyState";

/**
 * Một phòng chơi = một nhóm bạn (tối đa 8 người), vào bằng mã 4 ký tự.
 *
 * Mô hình "server làm trọng tài, client tự chơi":
 *  - Server phát seed, giữ đồng hồ, chấm điểm.
 *  - Client tự sinh câu đố từ seed (cùng code trong @brain-rizz/shared) và chỉ gửi đáp án.
 */
export class PartyRoom extends Room<{ state: PartyState }> {
  override maxClients = MAX_PLAYERS;
  override state = new PartyState();

  /** Thời điểm câu hiện tại của từng người bắt đầu (giờ server). */
  private questionShownAt = new Map<string, number>();
  private lockedUntil = new Map<string, number>();
  private recentAnswers = new Map<string, number[]>();
  private timers: Delayed[] = [];

  override messages = {
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
      if (msg.name !== undefined) p.name = msg.name;
      if (msg.colorIndex !== undefined) p.colorIndex = msg.colorIndex;
      if (msg.difficulty !== undefined) p.difficulty = msg.difficulty;
    },

    [ClientMessage.StartRound]: (client: Client, raw: unknown) => {
      const msg = this.parse(client, StartRoundSchema, raw);
      if (!msg || !this.requireHost(client)) return;
      if (!this.requirePhase(client, "lobby", "round-results")) return;
      if (this.state.players.size < MIN_PLAYERS_TO_START) return;
      if (this.state.round === 0) this.state.totalRounds = msg.totalRounds ?? DEFAULT_TOTAL_ROUNDS;
      this.startRound(msg.gameId);
    },

    [ClientMessage.Answer]: (client: Client, raw: unknown) => {
      const msg = this.parse(client, AnswerSchema, raw);
      if (msg) this.handleAnswer(client, msg);
    },

    [ClientMessage.BackToLobby]: (client: Client) => {
      if (!this.requireHost(client) || !this.requirePhase(client, "podium", "round-results"))
        return;
      this.resetMatch();
    },

    [ClientMessage.Ping]: (client: Client, raw: unknown) => {
      const msg = PingSchema.safeParse(raw);
      if (!msg.success) return;
      const pong: PongPayload = { clientTime: msg.data.clientTime, serverTime: Date.now() };
      client.send(ServerMessage.Pong, pong);
    },
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
    player.difficulty = opts.difficulty;
    this.state.players.set(client.sessionId, player);
    if (!this.state.hostId) this.setHost(client.sessionId);
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
    this.questionShownAt.delete(id);
    this.lockedUntil.delete(id);
    this.recentAnswers.delete(id);
    if (this.state.hostId === id) {
      const next = this.state.players.keys().next().value;
      this.setHost(next ?? "");
    }
  }

  override onDispose() {
    for (const t of this.timers) t.clear();
  }

  // ---------------------------------------------------------------- game flow

  private startRound(gameId: string) {
    if (!isGameId(gameId)) return;
    const game = getGame(gameId);
    const now = Date.now();

    this.state.round += 1;
    this.state.gameId = gameId;
    this.state.seed = randomSeed();
    this.state.startAt = now + COUNTDOWN_MS;
    this.state.endsAt = this.state.startAt + game.durationMs;
    this.state.phase = "countdown";

    for (const p of this.state.players.values()) {
      p.roundScore = 0;
      p.progress = 0;
      p.streak = 0;
      p.ready = false;
    }
    this.questionShownAt.clear();
    this.lockedUntil.clear();

    const payload: RoundStartPayload = {
      round: this.state.round,
      gameId,
      seed: this.state.seed,
      startAt: this.state.startAt,
      durationMs: game.durationMs,
    };
    this.broadcast(ServerMessage.RoundStart, payload);

    this.schedule(COUNTDOWN_MS, () => {
      this.state.phase = "playing";
      for (const id of this.state.players.keys()) this.questionShownAt.set(id, this.state.startAt);
    });
    this.schedule(COUNTDOWN_MS + game.durationMs + LATE_ANSWER_GRACE_MS, () => this.endRound());
  }

  private handleAnswer(client: Client, msg: z.infer<typeof AnswerSchema>) {
    const now = Date.now();
    const id = client.sessionId;
    const p = this.state.players.get(id);
    if (!p || this.state.phase !== "playing" || !isGameId(this.state.gameId)) return;
    if (msg.round !== this.state.round || msg.index !== p.progress) return;
    if (now > this.state.endsAt + LATE_ANSWER_GRACE_MS) return;
    if ((this.lockedUntil.get(id) ?? 0) > now) return;
    if (this.isRateLimited(id, now)) return;

    const game = getGame(this.state.gameId);
    if (!game.isAnswer(msg.answer)) return;

    const difficulty = p.difficulty as Difficulty;
    const puzzle = game.generate(this.state.seed, msg.index, difficulty);
    const correct = game.check(puzzle, msg.answer);
    const shownAt = this.questionShownAt.get(id) ?? this.state.startAt;

    const result: AnswerResultPayload = { index: msg.index, correct, points: 0 };
    if (correct) {
      result.points = pointsForCorrect({ difficulty, answerMs: now - shownAt, streak: p.streak });
      p.roundScore += result.points;
      p.streak += 1;
    } else {
      p.streak = 0;
      result.lockedUntil = now + WRONG_ANSWER_LOCK_MS;
      this.lockedUntil.set(id, result.lockedUntil);
    }
    // Đúng hay sai đều sang câu tiếp theo.
    p.progress += 1;
    this.questionShownAt.set(id, correct ? now : now + WRONG_ANSWER_LOCK_MS);
    client.send(ServerMessage.AnswerResult, result);
  }

  private endRound() {
    if (this.state.phase !== "playing") return;
    const ranked = [...this.state.players.values()].sort((a, b) => b.roundScore - a.roundScore);
    ranked.forEach((p, rank) => {
      p.matchPoints += placementPoints(rank);
    });
    this.state.phase = this.state.round >= this.state.totalRounds ? "podium" : "round-results";
  }

  private resetMatch() {
    this.clearTimers();
    this.state.phase = "lobby";
    this.state.round = 0;
    this.state.gameId = "";
    for (const p of this.state.players.values()) {
      p.matchPoints = 0;
      p.roundScore = 0;
      p.progress = 0;
      p.streak = 0;
      p.ready = false;
    }
  }

  // ---------------------------------------------------------------- helpers

  private setHost(id: string) {
    this.state.hostId = id;
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

  private isRateLimited(id: string, now: number) {
    const recent = (this.recentAnswers.get(id) ?? []).filter((t) => now - t < 1_000);
    recent.push(now);
    this.recentAnswers.set(id, recent);
    return recent.length > MAX_ANSWERS_PER_SECOND;
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
    const result = schema.safeParse(raw);
    if (result.success) return result.data as z.infer<S>;
    this.sendError(client, { code: "invalid", message: "Dữ liệu không hợp lệ." });
    return null;
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

  private sendError(client: Client, error: ErrorPayload) {
    client.send(ServerMessage.Error, error);
  }
}
