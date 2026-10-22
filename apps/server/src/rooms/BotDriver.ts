import {
  BOT_CHAT_CHANCE,
  BOT_CHAT_DELAY_MS,
  BOT_INTRO_READY_MS,
  type BotLevel,
  type BotModelId,
  botDifficulty,
  CHARACTER_IDS,
  type CharacterId,
  type ChatQuickId,
  DEFAULT_BOT_MODEL_ID,
  isGameId,
  type JudgeOutcome,
  type JudgeRound,
  MAX_PLAYERS,
  planBotAnswer,
} from "@brain-rizz/shared";
import type { Delayed } from "colyseus";
import type { AnswerJudge } from "./AnswerJudge";
import { type PartyState, Player } from "./schema/PartyState";

/** Phần của `PartyRoom` mà bot cần. Bot đi qua đúng các hàm người dùng (chấm, cộng điểm, chat). */
export interface BotRoom {
  state: PartyState;
  judge: AnswerJudge;
  /** Hẹn giờ trên `this.clock` của phòng. */
  setTimeout(fn: () => void, ms: number): Delayed;
  /** Vòng đang chơi theo góc nhìn của trọng tài (như khi chấm người). */
  judgeRound(): JudgeRound;
  /** Cộng kết quả một câu vào điểm vòng — CÙNG hàm với người. */
  applyOutcome(p: Player, outcome: JudgeOutcome): void;
  /** Gửi biểu cảm qua `ChatRelay` (tôn trọng `chatEnabled`, pha, giới hạn tần suất). */
  sendChat(p: Player, quickId: ChatQuickId): void;
  /** Màu avatar còn trống (giữ `preferred` nếu chưa ai dùng). */
  freeColor(preferred: number): number;
}

interface BotEntry {
  level: BotLevel;
  modelId: BotModelId;
}

/** Biểu cảm bot chọn ngẫu nhiên theo kết quả (docs/01-product/bot-players.md mục 3.3). */
const CHAT_WIN: readonly ChatQuickId[] = ["fire", "laugh"];
const CHAT_LOSE: readonly ChatQuickId[] = ["shock", "gg"];
const CHAT_PODIUM: readonly ChatQuickId[] = ["gg", "clap"];

/**
 * Bot của một phòng party (CR-016, ADR 0014). Bot KHÔNG giải câu đố: mỗi câu, model của shared
 * (`planBotAnswer`) bốc thời gian nghĩ và đúng/sai; tới giờ thì chấm qua `AnswerJudge.judgeBot`
 * (cùng luật với người) và cộng điểm bằng hàm của người.
 *
 * Hành vi theo pha (mục 3.3): `lobby` luôn sẵn sàng; `game-select` không làm gì; `game-intro`
 * bấm "Đã hiểu" sau `BOT_INTRO_READY_MS`; `playing` trả lời; `round-results`/`podium` có thể gửi
 * một biểu cảm. Mọi hẹn giờ nằm trong `timers`; `PartyRoom` gọi `clear()` mỗi lần đổi pha (cùng
 * `clearTimers`), về phòng chờ, chơi lại, dispose. Callback nào cũng kiểm lại pha và bot còn không.
 *
 * Ngẫu nhiên của câu trả lời đi qua `createRng` trong shared (tất định theo seed vòng, mã bot,
 * index). Riêng nhịp "Đã hiểu", chọn biểu cảm và nhân vật dùng `Math.random` (chỉ ở server, không
 * ảnh hưởng điểm).
 */
export class BotDriver {
  /** Bot theo thứ tự thêm (Map giữ thứ tự chèn; đổi mức không chèn lại). */
  private bots = new Map<string, BotEntry>();
  private timers: Delayed[] = [];
  /** Số của id bot kế tiếp (`bot-<n>`), không dùng lại trong phòng. */
  private nextNumber = 1;

  constructor(private readonly room: BotRoom) {}

  get count(): number {
    return this.bots.size;
  }

  has(id: string): boolean {
    return this.bots.has(id);
  }

  /** Id các bot theo thứ tự thêm. */
  ids(): string[] {
    return [...this.bots.keys()];
  }

  /** Bot được thêm gần nhất (nhường ghế trước khi người thật vào phòng đầy). */
  newest(): string | undefined {
    return this.ids().at(-1);
  }

  /**
   * Thêm một bot vào ghế trống; trả id, hoặc `undefined` nếu hết ghế. Quyền và pha do PartyRoom
   * kiểm. Bot: `name = ""` (web dịch theo nhân vật), luôn sẵn sàng, độ khó theo mức.
   */
  add(level: BotLevel, modelId: BotModelId = DEFAULT_BOT_MODEL_ID): string | undefined {
    const { players } = this.room.state;
    if (players.size >= MAX_PLAYERS) return undefined;
    let id = `bot-${this.nextNumber++}`;
    // sessionId của Colyseus không có dạng này, nhưng vẫn tránh trùng cho chắc.
    while (players.has(id)) id = `bot-${this.nextNumber++}`;

    const p = new Player();
    p.id = id;
    p.name = "";
    p.isBot = true;
    p.avatar = this.pickAvatar();
    p.colorIndex = this.room.freeColor(0);
    p.ready = true;
    p.connected = true;
    this.applyLevel(p, level);
    this.bots.set(id, { level, modelId });
    players.set(id, p);
    return id;
  }

  /** Bỏ bot `id` khỏi danh sách và khỏi state. Dọn phần chấm/chat do PartyRoom làm. */
  remove(id: string): boolean {
    if (!this.bots.delete(id)) return false;
    this.room.state.players.delete(id);
    return true;
  }

  /** Đổi mức bot (chỉ ở phòng chờ): độ khó câu đố đi theo mức. */
  setLevel(id: string, level: BotLevel): boolean {
    const bot = this.bots.get(id);
    const p = this.room.state.players.get(id);
    if (!bot || !p) return false;
    bot.level = level;
    this.applyLevel(p, level);
    return true;
  }

  /** Huỷ mọi hẹn giờ của bot (trả lời, "Đã hiểu", biểu cảm). */
  clear() {
    for (const t of this.timers) t.clear();
    this.timers = [];
  }

  // ---------------------------------------------------------------- theo pha

  /** `game-intro`: mỗi bot bấm "Đã hiểu" sau một khoảng ngẫu nhiên. Độ khó giữ theo mức. */
  onIntro() {
    for (const id of this.bots.keys()) {
      this.schedule(randomBetween(BOT_INTRO_READY_MS), () => {
        const p = this.player(id);
        if (p && this.room.state.phase === "game-intro") p.introReady = true;
      });
    }
  }

  /** Vừa vào `playing`: mỗi bot bắt đầu làm câu 0 (hiện lúc `startAt`). */
  onPlaying() {
    for (const id of this.bots.keys()) this.planNext(id);
  }

  /** `round-results`: thắng vòng (hạng 1, kể cả hoà) thì khoe, thua thì than — nếu bốc trúng. */
  onRoundResults(winners: ReadonlySet<string>) {
    for (const id of this.bots.keys()) {
      this.maybeChat(id, "round-results", winners.has(id) ? CHAT_WIN : CHAT_LOSE);
    }
  }

  /** `podium`: chúc mừng, nếu bốc trúng. */
  onPodium() {
    for (const id of this.bots.keys()) this.maybeChat(id, "podium", CHAT_PODIUM);
  }

  // ---------------------------------------------------------------- nội bộ

  /**
   * Hẹn câu kế của bot `id`: câu hiện lúc `shownAt` (giờ hiện câu của trọng tài: `startAt`, lúc
   * trả lời câu trước, hoặc lúc hết khoá), model cho `delayMs` và đúng/sai. Tới giờ thì chấm với
   * `now` = giờ trả lời theo kế hoạch, nên điểm không phụ thuộc độ trễ của hẹn giờ. Giờ trả lời rơi
   * sau `endsAt` thì bot dừng (mục 3.2).
   */
  private planNext(id: string) {
    const bot = this.bots.get(id);
    const p = this.player(id);
    const round = this.room.judgeRound();
    if (!bot || !p || !round.playing || !isGameId(round.gameId)) return;
    const index = p.progress;
    const plan = planBotAnswer({
      modelId: bot.modelId,
      level: bot.level,
      gameId: round.gameId,
      roundSeed: round.seed,
      botId: id,
      index,
    });
    const at = this.room.judge.shownAtOf(id, round) + plan.delayMs;
    if (at > round.endsAt) return;
    this.schedule(Math.max(0, at - Date.now()), () => {
      const who = this.player(id);
      if (!who || !this.bots.has(id)) return;
      const outcome = this.room.judge.judgeBot(
        id,
        who,
        this.room.judgeRound(),
        { index, correct: plan.correct },
        at,
      );
      // Bị bỏ qua (đã hết pha chơi…) thì dừng, không hẹn lại câu cũ.
      if (!outcome) return;
      this.room.applyOutcome(who, outcome);
      this.planNext(id);
    });
  }

  private maybeChat(
    id: string,
    phase: "round-results" | "podium",
    choices: readonly ChatQuickId[],
  ) {
    if (Math.random() >= BOT_CHAT_CHANCE) return;
    const quickId = choices[Math.floor(Math.random() * choices.length)];
    if (!quickId) return;
    this.schedule(randomBetween(BOT_CHAT_DELAY_MS), () => {
      const p = this.player(id);
      if (p && this.room.state.phase === phase) this.room.sendChat(p, quickId);
    });
  }

  private applyLevel(p: Player, level: BotLevel) {
    p.botLevel = level;
    p.difficulty = botDifficulty(level);
  }

  /**
   * Nhân vật cho bot mới: ưu tiên nhân vật chưa bot nào dùng, rồi nhân vật người thật chưa dùng;
   * còn hoà thì bốc ngẫu nhiên. Web dịch tên bot theo nhân vật nên ít trùng thì dễ phân biệt.
   */
  private pickAvatar(): CharacterId {
    const botUses = new Map<string, number>();
    const humanUses = new Map<string, number>();
    for (const p of this.room.state.players.values()) {
      const uses = p.isBot ? botUses : humanUses;
      uses.set(p.avatar, (uses.get(p.avatar) ?? 0) + 1);
    }
    const score = (c: CharacterId) => (botUses.get(c) ?? 0) * 100 + (humanUses.get(c) ?? 0);
    const best = Math.min(...CHARACTER_IDS.map(score));
    const candidates = CHARACTER_IDS.filter((c) => score(c) === best);
    return candidates[Math.floor(Math.random() * candidates.length)] ?? "khoi";
  }

  private player(id: string): Player | undefined {
    return this.bots.has(id) ? this.room.state.players.get(id) : undefined;
  }

  private schedule(ms: number, fn: () => void) {
    // Bỏ hẹn giờ đã chạy để danh sách không dài ra theo số câu trong vòng.
    this.timers = this.timers.filter((t) => t.active);
    this.timers.push(this.room.setTimeout(fn, ms));
  }
}

/** Số nguyên ngẫu nhiên trong [min, max] (Math.random: chỉ ở server, không ảnh hưởng điểm). */
function randomBetween([min, max]: readonly [number, number]): number {
  return Math.round(min + Math.random() * (max - min));
}
