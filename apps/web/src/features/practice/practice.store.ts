import { type Difficulty, type GameId, getGame, LATE_ANSWER_GRACE_MS } from "@brain-rizz/shared";
import { create } from "zustand";
import { currentProfile } from "@/lib/profile";
import { hasStoredSession, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { fetchPracticeBests, submitPracticeResult } from "@/net/data-api";
import { serverNow, useGame } from "@/stores/game.store";
import { useNav } from "@/stores/nav.store";
import { useFavorites } from "./favorites";
import {
  initialProgress,
  judgePracticeAnswer,
  type PracticeProgress,
  type PracticeRound,
  practiceSeed,
} from "./judge";
import {
  applyResult,
  loadRecords,
  mergeRemoteBests,
  type PracticeBest,
  type PracticeRecords,
  saveRecords,
} from "./records";

/** Đếm ngược trước mỗi lượt luyện tập (UC-13 bước 3). */
export const PRACTICE_COUNTDOWN_MS = 3_000;

export type PracticeStep = "pick" | "setup" | "countdown" | "playing" | "result";

/** Đồng bộ kỷ lục lên tài khoản: `local` = chưa cấu hình máy chủ dữ liệu (chỉ lưu trên máy). */
export type SyncStatus = "idle" | "syncing" | "synced" | "failed" | "local";

export interface PracticeOutcome {
  score: number;
  correct: number;
  wrong: number;
  bestStreak: number;
  previous: PracticeBest | undefined;
  isNewBest: boolean;
  /** Số lượt đã chơi game này ở độ khó này (kể cả lượt vừa xong). */
  plays: number;
}

interface PracticeStore {
  step: PracticeStep;
  gameId: GameId | null;
  difficulty: Difficulty;
  records: PracticeRecords;
  round: PracticeRound | null;
  progress: PracticeProgress | null;
  outcome: PracticeOutcome | null;
  sync: SyncStatus;

  /** Mở màn Luyện tập: đọc kỷ lục trên máy, gộp kỷ lục trên tài khoản (nếu có phiên). */
  open(): void;
  /**
   * Mở hướng dẫn một game. `minLevel` (`/practice/<game>?d=`): mức tối thiểu chọn sẵn lần này —
   * mức đang nhớ thấp hơn thì nâng lên, không ghi gì (mức lần trước chỉ lưu khi chơi xong lượt).
   */
  pickGame(gameId: GameId, minLevel?: Difficulty): void;
  setDifficulty(difficulty: Difficulty): void;
  start(): void;
  answer(index: number, answer: unknown): void;
  /** Bỏ lượt giữa chừng (sau khi xác nhận): không lưu, về màn hướng dẫn. */
  quit(): void;
  /** Về lưới chọn game. */
  backToPick(): void;
  /** Rời hẳn màn Luyện tập. */
  leave(): void;
}

let timers: ReturnType<typeof setTimeout>[] = [];
function clearTimers() {
  for (const id of timers) clearTimeout(id);
  timers = [];
}

function setFocus(step: PracticeStep) {
  useNav.getState().setSoloFocus(step === "countdown" || step === "playing");
}

export const usePractice = create<PracticeStore>((set, get) => ({
  step: "pick",
  gameId: null,
  difficulty: 1,
  records: loadRecords(),
  round: null,
  progress: null,
  outcome: null,
  sync: "idle",

  open() {
    clearTimers();
    set({ step: "pick", records: loadRecords(), round: null, progress: null, outcome: null });
    // Game yêu thích: đọc lại từ máy, gộp/lấy từ tài khoản khi có phiên (CR-020).
    void useFavorites.getState().sync();
    if (!SUPABASE_CONFIGURED || !hasStoredSession()) return;
    // Kỷ lục ở máy khác / trước khi xoá dữ liệu trình duyệt: gộp về, giữ điểm cao hơn.
    void fetchPracticeBests().then((res) => {
      if (!res.ok) return;
      const merged = mergeRemoteBests(get().records, res.data);
      saveRecords(merged);
      set({ records: merged });
    });
  },

  pickGame(gameId, minLevel) {
    const { records } = get();
    // Mặc định mức lần trước của game này, không có thì mức trong hồ sơ.
    const remembered = records.lastDifficulty[gameId] ?? currentProfile().difficulty;
    const difficulty = minLevel !== undefined && minLevel > remembered ? minLevel : remembered;
    set({ step: "setup", gameId, difficulty, outcome: null });
  },

  setDifficulty: (difficulty) => set({ difficulty }),

  start() {
    const { gameId, difficulty } = get();
    if (!gameId) return;
    clearTimers();
    const startAt = serverNow() + PRACTICE_COUNTDOWN_MS;
    const round: PracticeRound = {
      gameId,
      seed: practiceSeed(),
      difficulty,
      startAt,
      endsAt: startAt + getGame(gameId).durationMs,
    };
    useGame.getState().pushAnswerResult(null);
    set({ step: "countdown", round, progress: initialProgress(round), outcome: null });
    setFocus("countdown");
    timers.push(
      setTimeout(() => {
        if (get().round !== round) return;
        set({ step: "playing" });
        setFocus("playing");
      }, PRACTICE_COUNTDOWN_MS),
      // Như server: hết giờ + dung sai mới chốt (đáp án gửi sát giờ vẫn được chấm).
      setTimeout(() => finish(round), round.endsAt + LATE_ANSWER_GRACE_MS - serverNow()),
    );
  },

  answer(index, answer) {
    const { round, progress, step } = get();
    if (!round || !progress || step !== "playing") return;
    const out = judgePracticeAnswer(round, progress, index, answer, serverNow());
    set({ progress: out.state });
    if (out.result) useGame.getState().pushAnswerResult(out.result);
  },

  quit() {
    clearTimers();
    useGame.getState().pushAnswerResult(null);
    set({ step: "setup", round: null, progress: null });
    setFocus("setup");
  },

  backToPick() {
    clearTimers();
    set({ step: "pick", round: null, progress: null, outcome: null });
    setFocus("pick");
  },

  leave() {
    clearTimers();
    useGame.getState().pushAnswerResult(null);
    set({ step: "pick", gameId: null, round: null, progress: null, outcome: null });
    setFocus("pick");
  },
}));

/** Hết giờ: chốt điểm, ghi kỷ lục trên máy, đồng bộ ngầm lên tài khoản (UC-13 bước 4, 4a, 4b). */
function finish(round: PracticeRound) {
  const s = usePractice.getState();
  if (s.round !== round || !s.progress) return;
  clearTimers();
  const p = s.progress;
  const result = applyResult(
    loadRecords(),
    round.gameId,
    round.difficulty,
    p.score,
    p.correct,
    Date.now(),
  );
  saveRecords(result.records);
  const plays =
    result.records.bests[`${round.gameId}:${round.difficulty}`]?.plays ??
    (result.previous?.plays ?? 0) + 1;
  usePractice.setState({
    step: "result",
    records: result.records,
    outcome: {
      score: p.score,
      correct: p.correct,
      wrong: p.wrong,
      bestStreak: p.bestStreak,
      previous: result.previous,
      isNewBest: result.isNewBest,
      plays,
    },
    sync: SUPABASE_CONFIGURED ? "syncing" : "local",
  });
  setFocus("result");
  useGame.getState().pushAnswerResult(null);

  if (!SUPABASE_CONFIGURED) return;
  const profile = currentProfile();
  void submitPracticeResult(round.gameId, round.difficulty, p.score, p.correct, {
    name: profile.name,
    avatar: profile.avatar,
  }).then((res) => {
    // Người chơi đã sang lượt khác thì thôi báo.
    if (usePractice.getState().round !== round) return;
    usePractice.setState({ sync: res.ok ? "synced" : "failed" });
  });
}
