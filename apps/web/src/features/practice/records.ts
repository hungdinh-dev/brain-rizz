import { type Difficulty, GAME_IDS, type GameId, isDifficulty, isGameId } from "@brain-rizz/shared";
import { STORAGE_KEYS, safeLocal } from "@/lib/storage";

/**
 * Kỷ lục luyện tập (FR-MR-07): theo game + độ khó, lưu trên máy (`brain-rizz:practice`) và đồng bộ
 * lên `practice_bests` khi có phiên. Hàm thuần (trừ load/save), có test.
 */

export interface PracticeBest {
  score: number;
  correct: number;
  plays: number;
  /** ms epoch lần cập nhật gần nhất. */
  updatedAt: number;
}

export interface PracticeRecords {
  /** Khoá `<gameId>:<difficulty>`. */
  bests: Record<string, PracticeBest>;
  /** Độ khó chọn lần trước của từng game (mặc định ở màn hướng dẫn). */
  lastDifficulty: Partial<Record<GameId, Difficulty>>;
}

export const EMPTY_RECORDS: PracticeRecords = { bests: {}, lastDifficulty: {} };

export function recordKey(gameId: GameId, difficulty: Difficulty): string {
  return `${gameId}:${difficulty}`;
}

const isCount = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 10_000_000;

function parseBest(v: unknown): PracticeBest | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  if (!isCount(b.score) || !isCount(b.correct) || !isCount(b.plays)) return null;
  return {
    score: b.score,
    correct: b.correct,
    plays: b.plays,
    updatedAt: typeof b.updatedAt === "number" && Number.isFinite(b.updatedAt) ? b.updatedAt : 0,
  };
}

/** Đọc JSON đã lưu; hỏng, sai kiểu hay game lạ thì bỏ phần đó, không bao giờ ném lỗi. */
export function parseRecords(raw: string | null): PracticeRecords {
  if (!raw) return EMPTY_RECORDS;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY_RECORDS;
  }
  if (!data || typeof data !== "object") return EMPTY_RECORDS;
  const d = data as Record<string, unknown>;
  const bests: Record<string, PracticeBest> = {};
  if (d.bests && typeof d.bests === "object") {
    for (const [key, value] of Object.entries(d.bests)) {
      const [gameId, diff] = key.split(":");
      const difficulty = Number(diff);
      if (!isGameId(gameId) || !isDifficulty(difficulty)) continue;
      const best = parseBest(value);
      if (best) bests[recordKey(gameId, difficulty)] = best;
    }
  }
  const lastDifficulty: PracticeRecords["lastDifficulty"] = {};
  if (d.lastDifficulty && typeof d.lastDifficulty === "object") {
    for (const [gameId, difficulty] of Object.entries(d.lastDifficulty)) {
      if (isGameId(gameId) && isDifficulty(difficulty)) lastDifficulty[gameId] = difficulty;
    }
  }
  return { bests, lastDifficulty };
}

export function loadRecords(): PracticeRecords {
  return parseRecords(safeLocal.get(STORAGE_KEYS.practice));
}

export function saveRecords(records: PracticeRecords) {
  safeLocal.set(STORAGE_KEYS.practice, JSON.stringify(records));
}

export function bestFor(
  records: PracticeRecords,
  gameId: GameId,
  difficulty: Difficulty,
): PracticeBest | undefined {
  return records.bests[recordKey(gameId, difficulty)];
}

/** Kỷ lục cao nhất của một game ở mọi độ khó (thẻ ở màn chọn game). Bằng điểm thì lấy mức khó hơn. */
export function topBestOfGame(
  records: PracticeRecords,
  gameId: GameId,
): { best: PracticeBest; difficulty: Difficulty } | undefined {
  let top: { best: PracticeBest; difficulty: Difficulty } | undefined;
  for (const difficulty of [0, 1, 2, 3] as const) {
    const best = bestFor(records, gameId, difficulty);
    if (best && best.plays > 0 && (!top || best.score >= top.best.score))
      top = { best, difficulty };
  }
  return top;
}

export interface RecordOutcome {
  records: PracticeRecords;
  /** Kỷ lục trước lượt này (`undefined` = lần đầu chơi game ở độ khó này). */
  previous: PracticeBest | undefined;
  /** Vượt kỷ lục cũ (lần đầu: điểm > 0). */
  isNewBest: boolean;
}

/** Ghi một lượt: giữ điểm cao nhất (kèm số câu đúng của lượt đó), cộng số lượt. */
export function applyResult(
  records: PracticeRecords,
  gameId: GameId,
  difficulty: Difficulty,
  score: number,
  correct: number,
  now: number,
): RecordOutcome {
  const key = recordKey(gameId, difficulty);
  const previous = records.bests[key];
  const isNewBest = score > (previous?.score ?? 0);
  const next: PracticeBest = {
    score: isNewBest ? score : (previous?.score ?? 0),
    correct: isNewBest
      ? correct
      : score === previous?.score
        ? Math.max(previous.correct, correct)
        : (previous?.correct ?? 0),
    plays: (previous?.plays ?? 0) + 1,
    updatedAt: now,
  };
  return {
    records: {
      bests: { ...records.bests, [key]: next },
      lastDifficulty: { ...records.lastDifficulty, [gameId]: difficulty },
    },
    previous,
    isNewBest,
  };
}

/** Dòng `practice_bests` đọc từ máy chủ dữ liệu. */
export interface RemoteBest {
  gameId: string;
  difficulty: number;
  bestScore: number;
  bestCorrect: number;
  plays: number;
}

/**
 * Gộp kỷ lục trên tài khoản vào bản trên máy: mỗi ô lấy điểm cao hơn, số lượt lấy số lớn hơn
 * (máy chủ đếm cả lượt ở máy khác; máy này có thể có lượt chưa đồng bộ).
 */
export function mergeRemoteBests(
  records: PracticeRecords,
  rows: readonly RemoteBest[],
): PracticeRecords {
  const bests = { ...records.bests };
  for (const row of rows) {
    if (!isGameId(row.gameId) || !isDifficulty(row.difficulty)) continue;
    const key = recordKey(row.gameId, row.difficulty);
    const local = bests[key];
    const remoteWins = !local || row.bestScore > local.score;
    bests[key] = {
      score: remoteWins ? row.bestScore : local.score,
      correct: remoteWins ? row.bestCorrect : local.correct,
      plays: Math.max(local?.plays ?? 0, row.plays),
      updatedAt: local?.updatedAt ?? 0,
    };
  }
  return { ...records, bests };
}

/** Danh sách game đã chơi (có ít nhất một lượt), theo thứ tự danh mục. */
export function playedGames(records: PracticeRecords): GameId[] {
  return GAME_IDS.filter((id) =>
    ([0, 1, 2, 3] as const).some((d) => (bestFor(records, id, d)?.plays ?? 0) > 0),
  );
}
