import {
  type AnswerPayload,
  type Difficulty,
  gameAnswerWindowMs,
  getGame,
  isGameId,
  type JudgeOutcome,
  type JudgeRound,
  judgeAnswer,
} from "@brain-rizz/shared";

/** Phần state đồng bộ của người trả lời mà trọng tài đọc và cập nhật (`progress`, `streak`). */
export interface Contestant {
  difficulty: number;
  progress: number;
  streak: number;
}

/**
 * Bọc `judgeAnswer` của shared (luật chấm một câu, dùng chung với Luyện tập trên web) cho phòng
 * Colyseus: giữ riêng từng người — không đồng bộ xuống client — giờ hiện câu, hạn khoá và bộ đếm
 * chống spam; `progress`/`streak` nằm trong state đồng bộ (`Contestant`).
 * Dùng chung cho `PartyRoom` và `BrainTestRoom`.
 */
export class AnswerJudge {
  /** Thời điểm câu hiện tại của từng người bắt đầu (giờ server); thiếu thì lấy `startAt`. */
  private shownAt = new Map<string, number>();
  private lockedUntil = new Map<string, number>();
  private recentAnswers = new Map<string, readonly number[]>();

  /** Đầu mỗi vòng/game: câu đầu của mọi người hiện lúc `startAt`, không ai bị khoá. */
  resetRound() {
    this.shownAt.clear();
    this.lockedUntil.clear();
  }

  /** Người chơi rời phòng hẳn. */
  forget(id: string) {
    this.shownAt.delete(id);
    this.lockedUntil.delete(id);
    this.recentAnswers.delete(id);
  }

  /**
   * Người `id` vừa nối lại. Game có hạn trả lời (`answerWindowMs`): câu đang làm được tính là hiện
   * lại từ lúc này (hoặc lúc hết khoá / lúc vòng bắt đầu nếu muộn hơn), vì trong lúc rớt mạng
   * người chơi không thấy vật; giữ giờ cũ thì đáp án đầu sau khi nối lại chắc chắn bị chấm muộn.
   * Client cũng hiện lại câu với hạn mới khi nối lại. Game không có hạn: giữ nguyên — thời gian
   * rớt mạng vẫn tính vào tốc độ, không cho nối lại để lấy thưởng nhanh.
   */
  resume(id: string, who: Contestant, round: JudgeRound, now = Date.now()) {
    if (!round.playing || !isGameId(round.gameId)) return;
    const game = getGame(round.gameId);
    const difficulty = who.difficulty as Difficulty;
    const puzzle = game.generate(round.seed, who.progress, difficulty);
    if (gameAnswerWindowMs(game, puzzle, difficulty) === undefined) return;
    this.shownAt.set(id, Math.max(now, this.lockedUntil.get(id) ?? 0, round.startAt));
  }

  /** Chấm đáp án của người `id`; `null` = bỏ qua (không gửi gì). Cập nhật `who.progress`/`who.streak`. */
  judge(
    id: string,
    who: Contestant,
    round: JudgeRound,
    msg: AnswerPayload,
    now = Date.now(),
  ): JudgeOutcome | null {
    const { outcome, next } = judgeAnswer(
      round,
      who.difficulty as Difficulty,
      {
        progress: who.progress,
        streak: who.streak,
        shownAt: this.shownAt.get(id),
        lockedUntil: this.lockedUntil.get(id) ?? 0,
        recentAnswers: this.recentAnswers.get(id) ?? [],
      },
      msg,
      now,
    );
    this.recentAnswers.set(id, next.recentAnswers);
    if (!outcome) return null;
    who.progress = next.progress;
    who.streak = next.streak;
    if (next.shownAt !== undefined) this.shownAt.set(id, next.shownAt);
    if (next.lockedUntil > 0) this.lockedUntil.set(id, next.lockedUntil);
    return outcome;
  }
}
