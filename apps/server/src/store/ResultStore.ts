import type { BrainSkills, Category, Difficulty } from "@brain-rizz/shared";
import { SupabaseResultStore } from "./SupabaseResultStore";

/**
 * Nơi game server ghi kết quả được xếp hạng (ADR 0011). Phòng chơi chỉ biết interface này:
 * - `SupabaseResultStore`: bản thật, dùng khoá secret (bỏ qua RLS).
 * - `NoopResultStore`: thiếu biến môi trường → không xác thực, không ghi; game vẫn chơi được.
 * - `MemoryResultStore`: trong RAM, cho test (không gọi mạng).
 */
export interface ResultStore {
  /** `false` khi chưa cấu hình máy chủ dữ liệu (bản rỗng). */
  readonly enabled: boolean;
  /** Xác thực JWT Supabase → `user_id`, hoặc `null` nếu token sai/hết hạn/lỗi. Không bao giờ ném lỗi. */
  verifyToken(token: string): Promise<string | null>;
  /** Ghi một lượt Kiểm tra não (`brain_tests` + `brain_test_games`). Lỗi thì ném. */
  saveBrainTest(record: BrainTestRecord): Promise<void>;
  /** Ghi kết quả một trận party (`match_results`), mỗi người đã xác thực một dòng. Lỗi thì ném. */
  saveMatchResults(rows: readonly MatchResultRecord[]): Promise<void>;
}

export interface BrainTestGameRecord {
  gameId: string;
  category: Category;
  score: number;
  correct: number;
}

export interface BrainTestRecord {
  userId: string;
  brainScore: number;
  difficulty: Difficulty;
  /** `BRAIN_TEST_RULES_VERSION`: bảng xếp hạng chỉ so các lượt cùng phiên bản luật. */
  rulesVersion: number;
  skills: BrainSkills;
  games: BrainTestGameRecord[];
}

export interface MatchResultRecord {
  userId: string;
  roomCode: string;
  /** Hạng chung cuộc theo `rankByMatch`, 0 = nhất. */
  placement: number;
  /** Số ghế còn trong phòng lúc vào `podium`, gồm cả bot (CR-016). */
  players: number;
  /**
   * Số bot trong `players` (CR-016, cột `bot_count`); 0 = trận chỉ có người thật. Bot không có tài
   * khoản nên không có dòng riêng. Màn Tài khoản gắn nhãn "Đấu với máy" khi > 0.
   */
  botCount: number;
  matchPoints: number;
  totalScore: number;
  rounds: number;
  games: string[];
  /** Tổng điểm vòng theo thể loại (CR-010); chỉ thể loại đã chơi có khoá, kể cả 0 điểm. */
  categoryScores: Partial<Record<Category, number>>;
  /** Thể loại người này giành danh hiệu "giỏi nhất" trong trận (`categoryLeaders`), thứ tự CATEGORIES. */
  categoryTitles: Category[];
}

/** Bản rỗng khi thiếu `SUPABASE_URL` / `SUPABASE_SECRET_KEY`. */
export class NoopResultStore implements ResultStore {
  readonly enabled = false;
  async verifyToken(): Promise<string | null> {
    return null;
  }
  async saveBrainTest(): Promise<void> {}
  async saveMatchResults(): Promise<void> {}
}

/** Bản trong RAM cho test: token hợp lệ là khoá của `users`. */
export class MemoryResultStore implements ResultStore {
  readonly enabled = true;
  readonly brainTests: BrainTestRecord[] = [];
  readonly matchResults: MatchResultRecord[][] = [];
  /** Đặt `true` để giả lập ghi lỗi. */
  failWrites = false;

  /** token → user_id */
  constructor(readonly users: Map<string, string> = new Map()) {}

  async verifyToken(token: string): Promise<string | null> {
    return this.users.get(token) ?? null;
  }

  async saveBrainTest(record: BrainTestRecord): Promise<void> {
    if (this.failWrites) throw new Error("Giả lập ghi lỗi");
    this.brainTests.push(structuredClone(record));
  }

  async saveMatchResults(rows: readonly MatchResultRecord[]): Promise<void> {
    if (this.failWrites) throw new Error("Giả lập ghi lỗi");
    this.matchResults.push(structuredClone([...rows]));
  }
}

/** Tạo store theo biến môi trường; thiếu biến thì trả bản rỗng và log một lần. */
export function createResultStore(env: NodeJS.ProcessEnv = process.env): ResultStore {
  const url = env.SUPABASE_URL?.trim();
  const secretKey = env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secretKey) {
    console.info(
      "[store] Chưa đặt SUPABASE_URL / SUPABASE_SECRET_KEY: không xác thực tài khoản, không lưu kết quả.",
    );
    return new NoopResultStore();
  }
  return new SupabaseResultStore(url, secretKey);
}

let current: ResultStore | null = null;

/** Store dùng chung của tiến trình; tạo lười từ biến môi trường ở lần gọi đầu. */
export function getResultStore(): ResultStore {
  current ??= createResultStore();
  return current;
}

/** Thay store (test dùng `MemoryResultStore`). Phòng tạo sau lời gọi này sẽ dùng store mới. */
export function setResultStore(store: ResultStore) {
  current = store;
}
