import {
  AnswerSchema,
  BRAIN_TEST_COUNTDOWN_MS,
  BRAIN_TEST_DIFFICULTY,
  BRAIN_TEST_GAME_RESULT_MS,
  BRAIN_TEST_IDLE_CLOSE_CODE,
  BRAIN_TEST_INTRO_IDLE_MS,
  BRAIN_TEST_RULES_VERSION,
  BrainClientMessage,
  type BrainGameResult,
  type BrainGameView,
  BrainJoinOptionsSchema,
  type BrainPhase,
  BrainReadySchema,
  type BrainSaveStatus,
  type BrainTestResult,
  brainTestDurationMs,
  computeBrainResult,
  getGame,
  isGameId,
  LATE_ANSWER_GRACE_MS,
  pickBrainTestGames,
  RECONNECT_WINDOW_S,
  type RoundStartPayload,
  randomSeed,
  ServerMessage,
} from "@brain-rizz/shared";
import { type Client, type Delayed, Room } from "colyseus";
import { getResultStore, type ResultStore } from "../store/ResultStore";
import { AnswerJudge } from "./AnswerJudge";
import { parseMessage, replyPong, sendError } from "./messages";
import { BrainGame, BrainState } from "./schema/BrainState";

/**
 * Kiểm tra não (UC-14, ADR 0011): phòng solo một người, 5 game, mỗi nhóm kỹ năng một game.
 * Server phát seed, giữ đồng hồ, chấm từng câu bằng `AnswerJudge` (cùng luật với PartyRoom).
 *
 * intro (game i) → [brainReady] → countdown → playing → game-result → intro (game i + 1) … → finished
 * Ở `intro` quá `BRAIN_TEST_INTRO_IDLE_MS` mà chưa bấm Sẵn sàng → huỷ lượt, đóng phòng
 * (close code `BRAIN_TEST_IDLE_CLOSE_CODE`).
 *
 * Xong game thứ 5: tính Điểm Não bằng `computeBrainResult`, ghi `brain_tests` + `brain_test_games`
 * nếu token hợp lệ. Rời phòng (hoặc hết giờ giữ chỗ khi rớt mạng) trước khi xong → huỷ, không lưu.
 * Không có mã phòng, không vào lại sau khi đã rời; "Làm lại" là tạo phòng mới.
 */
export class BrainTestRoom extends Room<{ state: BrainState }> {
  override maxClients = 1;
  override state = new BrainState();

  private judge = new AnswerJudge();
  private timers: Delayed[] = [];
  private store: ResultStore = getResultStore();
  /** user_id Supabase của người chơi (`null` nếu không có/sai token). Không đồng bộ xuống client. */
  private userId: Promise<string | null> = Promise.resolve(null);
  private connected = false;
  /** Người chơi đã rời hẳn trước khi xong: không lưu gì nữa. */
  private cancelled = false;
  /** Đã bắt đầu ghi kết quả (mỗi lượt đúng một lần). */
  private saveStarted = false;
  /** Điểm Não + 5 kỹ năng, có khi xong lượt. */
  private result: BrainTestResult | null = null;

  override messages = {
    [BrainClientMessage.Ready]: (client: Client, raw: unknown) => {
      if (!parseMessage(client, BrainReadySchema, raw)) return;
      if (!this.requirePhase(client, "intro")) return;
      this.startGame();
    },

    [BrainClientMessage.Answer]: (client: Client, raw: unknown) => {
      const msg = parseMessage(client, AnswerSchema, raw);
      if (!msg) return;
      const s = this.state;
      const outcome = this.judge.judge(
        client.sessionId,
        s,
        {
          playing: s.phase === "playing",
          round: s.round,
          gameId: s.gameId,
          seed: s.seed,
          startAt: s.startAt,
          endsAt: s.endsAt,
        },
        msg,
      );
      if (!outcome) return;
      const game = this.currentGame();
      if (game && outcome.correct) {
        game.score += outcome.points;
        game.correct += 1;
      }
      client.send(ServerMessage.AnswerResult, outcome.result);
    },

    [BrainClientMessage.Ping]: (client: Client, raw: unknown) => replyPong(client, raw),
  };

  // ---------------------------------------------------------------- lifecycle

  override async onCreate() {
    // Không vào được bằng joinOrCreate/mã: mỗi lượt một phòng riêng.
    await this.setPrivate(true);
    this.state.difficulty = BRAIN_TEST_DIFFICULTY;
    for (const gameId of pickBrainTestGames(randomSeed())) {
      const game = new BrainGame();
      game.gameId = gameId;
      game.category = getGame(gameId).category;
      this.state.games.push(game);
    }
    if (!this.store.enabled) this.state.saveStatus = "no-db";
  }

  override onJoin(_client: Client, options: unknown) {
    const opts = BrainJoinOptionsSchema.parse(options ?? {});
    this.state.name = opts.name;
    this.state.avatar = opts.avatar;
    this.connected = true;
    this.authenticate(opts.accessToken);
    this.enterIntro(1);
  }

  override async onDrop(client: Client) {
    // Giữ chỗ như phòng party; đồng hồ game vẫn chạy (server là trọng tài).
    this.connected = false;
    await this.allowReconnection(client, RECONNECT_WINDOW_S);
  }

  override onReconnect() {
    this.connected = true;
    // Lượt xong trong lúc rớt mạng: chỉ lưu khi người chơi quay lại kịp.
    if (this.state.phase === "finished") void this.save();
  }

  override onLeave() {
    this.connected = false;
    if (this.state.phase !== "finished") {
      // Thoát giữa chừng hoặc hết giờ giữ chỗ: huỷ lượt, không lưu.
      this.cancelled = true;
      this.clearTimers();
    }
  }

  override onDispose() {
    this.clearTimers();
  }

  // ---------------------------------------------------------------- game flow

  private enterIntro(round: number) {
    this.clearTimers();
    const s = this.state;
    const game = s.games[round - 1];
    if (!game) return;
    s.round = round;
    s.gameId = game.gameId;
    s.seed = 0;
    s.startAt = 0;
    s.endsAt = 0;
    s.resultEndsAt = 0;
    s.progress = 0;
    s.streak = 0;
    this.setPhase("intro");
    // Chờ Sẵn sàng quá lâu: huỷ lượt, đóng phòng (startGame huỷ hẹn giờ này).
    this.schedule(BRAIN_TEST_INTRO_IDLE_MS, () => this.expireIdle());
  }

  /** Hết giờ chờ ở `intro`: huỷ lượt, không lưu, đóng phòng với `BRAIN_TEST_IDLE_CLOSE_CODE`. */
  private expireIdle() {
    if (this.state.phase !== "intro") return;
    this.cancelled = true;
    this.clearTimers();
    void this.disconnect(BRAIN_TEST_IDLE_CLOSE_CODE);
  }

  private startGame() {
    const s = this.state;
    if (s.phase !== "intro" || !isGameId(s.gameId)) return;
    this.clearTimers();
    const durationMs = brainTestDurationMs(s.gameId);
    s.seed = randomSeed();
    s.startAt = Date.now() + BRAIN_TEST_COUNTDOWN_MS;
    s.endsAt = s.startAt + durationMs;
    s.progress = 0;
    s.streak = 0;
    this.judge.resetRound();
    this.setPhase("countdown");

    const payload: RoundStartPayload = {
      round: s.round,
      gameId: s.gameId,
      seed: s.seed,
      startAt: s.startAt,
      durationMs,
    };
    this.broadcast(ServerMessage.RoundStart, payload);

    this.schedule(BRAIN_TEST_COUNTDOWN_MS, () => {
      if (s.phase !== "countdown") return;
      this.setPhase("playing");
      this.schedule(durationMs + LATE_ANSWER_GRACE_MS, () => this.endGame());
    });
  }

  private endGame() {
    const s = this.state;
    if (s.phase !== "playing") return;
    this.clearTimers();
    s.resultEndsAt = Date.now() + BRAIN_TEST_GAME_RESULT_MS;
    this.setPhase("game-result");
    this.schedule(BRAIN_TEST_GAME_RESULT_MS, () => {
      if (s.phase !== "game-result") return;
      if (s.round < s.games.length) this.enterIntro(s.round + 1);
      else this.finish();
    });
  }

  private finish() {
    this.clearTimers();
    const s = this.state;
    const results: BrainGameResult[] = [];
    for (const g of s.games) {
      if (isGameId(g.gameId))
        results.push({ gameId: g.gameId, score: g.score, correct: g.correct });
    }
    this.result = computeBrainResult(results);
    s.brainScore = this.result.brainScore;
    s.skills.clear();
    for (const [category, value] of Object.entries(this.result.skills)) {
      s.skills.set(category, value);
    }
    s.resultEndsAt = 0;
    this.setPhase("finished");
    if (this.connected) void this.save();
  }

  // ---------------------------------------------------------------- lưu kết quả

  /** Xác thực token chạy nền, không chặn việc chơi. Không có/sai token → `guest`. */
  private authenticate(token: string | undefined) {
    if (!this.store.enabled) return;
    if (!token) {
      this.setSaveStatus("guest");
      return;
    }
    this.userId = this.store.verifyToken(token).catch(() => null);
    void this.userId.then((id) => {
      if (!id) this.setSaveStatus("guest");
    });
  }

  private async save() {
    const result = this.result;
    if (this.saveStarted || this.cancelled || !result) return;
    this.saveStarted = true;
    if (!this.store.enabled) return this.setSaveStatus("no-db");
    const userId = await this.userId;
    if (!userId) return this.setSaveStatus("guest");

    try {
      await this.store.saveBrainTest({
        userId,
        brainScore: result.brainScore,
        difficulty: BRAIN_TEST_DIFFICULTY,
        rulesVersion: BRAIN_TEST_RULES_VERSION,
        skills: result.skills,
        games: this.state.games.map((g) => ({
          gameId: g.gameId,
          category: g.category as BrainGameView["category"],
          score: g.score,
          correct: g.correct,
        })),
      });
      this.setSaveStatus("saved");
    } catch (err) {
      console.error(`[BrainTestRoom ${this.roomId}] Không lưu được kết quả:`, err);
      this.setSaveStatus("failed");
    }
  }

  // ---------------------------------------------------------------- helpers

  private currentGame() {
    return this.state.games[this.state.round - 1];
  }

  private setPhase(phase: BrainPhase) {
    this.state.phase = phase;
  }

  private setSaveStatus(status: BrainSaveStatus) {
    // `saved` / `failed` là kết quả cuối, không bị xác thực chậm ghi đè.
    if (this.state.saveStatus === "saved" || this.state.saveStatus === "failed") return;
    this.state.saveStatus = status;
  }

  private schedule(ms: number, fn: () => void) {
    this.timers.push(this.clock.setTimeout(fn, ms));
  }

  private clearTimers() {
    for (const t of this.timers) t.clear();
    this.timers = [];
  }

  private requirePhase(client: Client, ...phases: BrainPhase[]) {
    if (phases.includes(this.state.phase as BrainPhase)) return true;
    sendError(client, { code: "bad-phase", message: "Không thể làm việc này lúc này." });
    return false;
  }
}
