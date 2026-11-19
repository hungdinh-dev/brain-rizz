import {
  type BrainSkills,
  type Category,
  capChalkGrant,
  type Difficulty,
  type EarnSource,
  type PartyConfig,
  parsePartyConfig,
  parseUnlockStats,
  type UnlockStats,
} from "@brain-rizz/shared";
import type { CosmeticsWant } from "./cosmetics-cache";
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
  /**
   * Ghi một lượt Kiểm tra não (`brain_tests` + `brain_test_games`), trả `brain_tests.id` (dùng làm
   * `ref` của `grant_chalk`). Lỗi thì ném.
   */
  saveBrainTest(record: BrainTestRecord): Promise<string>;
  /**
   * Ghi kết quả một trận party (`match_results`), mỗi người đã xác thực một dòng. Trả **mã trận**:
   * chuỗi giống nhau cho mọi dòng của lần ghi này và khác mọi trận khác (bản thật: `created_at` của
   * các dòng vừa ghi), để `ref` phấn party là `<room_code>:<mã trận>`. Lỗi thì ném.
   */
  saveMatchResults(rows: readonly MatchResultRecord[]): Promise<string>;
  /**
   * Thành tích mở thú (`unlock_stats_for`, đã qua `parseUnlockStats`) và món phụ kiện đã có
   * (`user_items`) của một người (CR-023, CR-024). Bản thật đệm 60 giây theo người; bản đệm không qua
   * `want.isEnough` (người chơi xin món / thú đệm chưa có, vd. vừa quay gacha) thì đọc lại DB bỏ qua
   * đệm, tối đa 1 lần mỗi người mỗi 5 giây — trong cửa sổ đó báo `want.onDeferred` (`CosmeticsCache`).
   * `null` khi bản rỗng hoặc lỗi — phòng giữ quy tắc an toàn (thú khoá → `khoi`, không phụ kiện).
   * Không bao giờ ném.
   */
  loadCosmetics(userId: string, want?: CosmeticsWant): Promise<CosmeticsRecord | null>;
  /**
   * Cộng phấn (`grant_chalk`): kẹp trần ngày của nguồn, idempotent theo `(userId, source, ref)` —
   * gọi lại cùng `ref` không cộng thêm mà trả lại đúng số đã cộng lần đầu. Trả số **thực cộng** ≥ 0
   * (0 khi chạm trần hoặc `amount` ≤ 0), hoặc `null` khi không ghi được (lỗi, bản rỗng) — phòng
   * không báo "+0 / đã đủ phấn" khi `null`. Không bao giờ ném: lỗi phấn không làm hỏng trận.
   */
  grantChalk(
    userId: string,
    source: EarnSource,
    ref: string,
    amount: number,
  ): Promise<number | null>;
  /**
   * Cấu hình party của quản trị viên (CR-019, bảng `party_settings` dòng 1), đã qua
   * `parsePartyConfig` (không tin DB). `null` khi bản rỗng, chưa có dòng hoặc lỗi. Không bao giờ ném.
   * Phòng không gọi thẳng hàm này mà qua bộ đệm `getPartyConfig` (`party-config-cache.ts`).
   */
  loadPartyConfig(): Promise<PartyConfig | null>;
  /** `userId` có trong bảng `admins` không (CR-019). Lỗi hoặc bản rỗng → `false`. Không bao giờ ném. */
  isAdmin(userId: string): Promise<boolean>;
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
  /** `party_settings.version` trận này dùng (CR-019, cột `settings_version`); 0 = mặc định trong code. */
  settingsVersion: number;
}

/** Quyền đồ trang trí của một người (CR-023, CR-024), đọc ở `loadCosmetics`. */
export interface CosmeticsRecord {
  /** Thành tích mở thú, dạng camelCase của shared. */
  stats: UnlockStats;
  /** Id món phụ kiện đã có (`user_items.item_id`). */
  items: string[];
}

/** Một dòng sổ phấn của MemoryResultStore (như `chalk_ledger`: mỗi `(userId, source, ref)` một dòng). */
export interface ChalkGrantRecord {
  userId: string;
  source: EarnSource;
  ref: string;
  /** Số server xin cộng lần đầu (chưa kẹp). */
  amount: number;
  /** Số thực cộng (đã kẹp, 0 nếu chạm trần). */
  granted: number;
}

/** Bản rỗng khi thiếu `SUPABASE_URL` / `SUPABASE_SECRET_KEY`. */
export class NoopResultStore implements ResultStore {
  readonly enabled = false;
  async verifyToken(): Promise<string | null> {
    return null;
  }
  async saveBrainTest(): Promise<string> {
    return "";
  }
  async saveMatchResults(): Promise<string> {
    return "";
  }
  async loadCosmetics(): Promise<CosmeticsRecord | null> {
    return null;
  }
  async grantChalk(): Promise<number | null> {
    return null;
  }
  async loadPartyConfig(): Promise<PartyConfig | null> {
    return null;
  }
  async isAdmin(): Promise<boolean> {
    return false;
  }
}

/** Bản trong RAM cho test: token hợp lệ là khoá của `users`. */
export class MemoryResultStore implements ResultStore {
  readonly enabled = true;
  readonly brainTests: BrainTestRecord[] = [];
  /** `brain_tests.id` đã trả, cùng thứ tự `brainTests`. */
  readonly brainTestIds: string[] = [];
  readonly matchResults: MatchResultRecord[][] = [];
  /** Mã trận đã trả, cùng thứ tự `matchResults`. */
  readonly matchKeys: string[] = [];
  /** Đặt `true` để giả lập ghi lỗi. */
  failWrites = false;
  /**
   * user_id → kết quả `unlock_stats_for` thô (JSON snake_case như DB, đi qua `parseUnlockStats` như
   * bản thật) và món đã có. Người không có trong map → thành tích rỗng, không có món.
   */
  readonly cosmetics = new Map<string, { stats?: unknown; items?: string[] }>();
  /** Đặt `true` để giả lập đọc lỗi (`loadCosmetics` → `null`). */
  failCosmetics = false;
  /** Số lần `loadCosmetics` được gọi (theo thứ tự user_id). */
  readonly cosmeticsLoads: string[] = [];
  /** Đặt một promise để giữ `loadCosmetics` chờ tới khi nó xong (giả lập DB chậm). */
  cosmeticsGate: Promise<unknown> | null = null;
  /** Sổ phấn: mỗi `(userId, source, ref)` một dòng (lần gọi trùng ref không thêm dòng). */
  readonly chalkGrants: ChalkGrantRecord[] = [];
  /** Số lần `grantChalk` được gọi, kể cả lần trùng ref / lỗi. */
  chalkCalls = 0;
  /** Đặt `true` để giả lập `grant_chalk` lỗi (trả `null`, không ném). */
  failChalk = false;
  /**
   * Dòng `party_settings` thô như đọc từ DB (`{ version, scoring, disabledGames }`), đi qua
   * `parsePartyConfig` như bản thật; `null` = chưa có dòng. Đặt `failPartyConfig` để giả lập đọc lỗi.
   */
  partyConfig: unknown = null;
  failPartyConfig = false;
  /** Số lần `loadPartyConfig` được gọi (kiểm bộ đệm). */
  partyConfigLoads = 0;
  /** `user_id` của quản trị viên. */
  readonly admins = new Set<string>();

  /** token → user_id */
  constructor(readonly users: Map<string, string> = new Map()) {}

  async verifyToken(token: string): Promise<string | null> {
    return this.users.get(token) ?? null;
  }

  async saveBrainTest(record: BrainTestRecord): Promise<string> {
    if (this.failWrites) throw new Error("Giả lập ghi lỗi");
    this.brainTests.push(structuredClone(record));
    const id = `brain-${this.brainTests.length}`;
    this.brainTestIds.push(id);
    return id;
  }

  async saveMatchResults(rows: readonly MatchResultRecord[]): Promise<string> {
    if (this.failWrites) throw new Error("Giả lập ghi lỗi");
    this.matchResults.push(structuredClone([...rows]));
    const key = `match-${this.matchResults.length}`;
    this.matchKeys.push(key);
    return key;
  }

  /** Không đệm (mỗi lần gọi là một lần "đọc DB", không bao giờ hoãn), nên bỏ qua `_want`. */
  async loadCosmetics(userId: string, _want?: CosmeticsWant): Promise<CosmeticsRecord | null> {
    this.cosmeticsLoads.push(userId);
    if (this.cosmeticsGate) await this.cosmeticsGate;
    if (this.failCosmetics) return null;
    const raw = this.cosmetics.get(userId);
    return {
      stats: parseUnlockStats(structuredClone(raw?.stats ?? {})),
      items: [...(raw?.items ?? [])],
    };
  }

  /**
   * Như `grant_chalk` (migration `20261120000000_gacha.sql`): trùng `(userId, source, ref)` → không
   * cộng thêm, trả đúng số đã cộng lần đầu; kẹp trần ngày bằng `capChalkGrant` theo các dòng > 0
   * (mọi lần cộng trong store coi như cùng một ngày); bị kẹp hết vẫn ghi dòng 0.
   */
  async grantChalk(
    userId: string,
    source: EarnSource,
    ref: string,
    amount: number,
  ): Promise<number | null> {
    this.chalkCalls++;
    if (this.failChalk) return null;
    const done = this.chalkGrants.filter((g) => g.userId === userId && g.source === source);
    const existing = done.find((g) => g.ref === ref);
    if (existing) return existing.granted;
    const counted = done.filter((g) => g.granted > 0);
    const granted = capChalkGrant(source, amount, {
      chalk: counted.reduce((sum, g) => sum + g.granted, 0),
      grants: counted.length,
    });
    this.chalkGrants.push({ userId, source, ref, amount, granted });
    return granted;
  }

  /** Tổng phấn đã thực cộng cho một người (test). */
  balance(userId: string): number {
    return this.chalkGrants
      .filter((g) => g.userId === userId)
      .reduce((sum, g) => sum + g.granted, 0);
  }

  async loadPartyConfig(): Promise<PartyConfig | null> {
    this.partyConfigLoads++;
    if (this.failPartyConfig || this.partyConfig === null) return null;
    return parsePartyConfig(structuredClone(this.partyConfig));
  }

  async isAdmin(userId: string): Promise<boolean> {
    return this.admins.has(userId);
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
