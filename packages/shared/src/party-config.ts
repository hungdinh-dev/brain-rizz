import { z } from "zod";
import { DIFFICULTY_MULTIPLIER } from "./difficulty";
import { GAME_IDS, type GameId } from "./games";

/**
 * Cấu hình điểm của trận party do quản trị viên chỉnh (CR-019, docs/01-product/admin-console.md
 * mục 4.1). Chỉ trận party dùng; Luyện tập và Kiểm tra não luôn chấm bằng `DEFAULT_SCORING`
 * (không truyền `scoring`) để bảng xếp hạng không lệch.
 *
 * Server không tin dữ liệu đọc từ DB: mọi cấu hình đi qua `parsePartyConfig` (kiểm từng trường,
 * sai trường nào về mặc định trường đó, không bao giờ ném). Web kiểm form admin bằng
 * `ScoringConfigSchema` và đọc cấu hình của phòng từ state bằng `parseScoringJson`.
 */

// ---------- Hằng số của công thức chuẩn (tên và giá trị giữ nguyên từ trước CR-019) ----------

export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 50;
/** Trả lời trong vòng ngần này ms thì được trọn thưởng tốc độ. */
export const FAST_ANSWER_MS = 1_500;
/** Sau ngần này ms thì không còn thưởng tốc độ. */
export const SLOW_ANSWER_MS = 8_000;
export const STREAK_THRESHOLD = 3;
export const STREAK_BONUS_PER_STEP = 0.1;
/** Trần hệ số combo (CR-006): từ câu đúng liên tiếp thứ 7 trở đi giữ × 1,5. */
export const MAX_COMBO_MULTIPLIER = 1.5;
/** Thưởng thêm cho hạng nhất, nhì, ba mỗi vòng, cộng trên phần co giãn theo số người (CR-018). */
export const PLACEMENT_TOP_BONUS = [3, 2, 1] as const;

// ---------- Kiểu ----------

/** Bốn số theo `Difficulty` 0..3 (Mầm, Thường, Khó, Siêu khó). */
export type Quad = [number, number, number, number];

export interface ScoringConfig {
  /** Điểm gốc một câu đúng, trước hệ số độ khó. Số nguyên [10, 1000]. */
  basePoints: number;
  /** Thưởng tốc độ tối đa. Số nguyên [0, 500]. */
  maxSpeedBonus: number;
  /** Trả lời trong ngần này ms thì trọn thưởng tốc độ. Số nguyên [0, 10000]. */
  fastAnswerMs: number;
  /** Sau ngần này ms thì hết thưởng tốc độ. Số nguyên (fastAnswerMs, 30000]. */
  slowAnswerMs: number;
  /** Câu đúng liên tiếp thứ mấy bắt đầu có combo. Số nguyên [1, 10]. */
  streakThreshold: number;
  /** Mỗi câu đúng liên tiếp thêm cộng ngần này vào hệ số combo. [0, 1]. */
  streakBonusPerStep: number;
  /** Trần hệ số combo. [1, 5]. */
  maxComboMultiplier: number;
  /** Hệ số chung theo độ khó cho game không khai báo hệ số riêng. Mỗi số (0, 5]. */
  difficultyMultiplier: Quad;
  /** Ghi đè hệ số theo game id (chỉ id có trong `GAME_IDS`), ưu tiên hơn hệ số game khai báo. */
  gameMultipliers: Record<string, Quad>;
  /** Thưởng top 3 mỗi vòng, cộng trên `max(1, N − hạng)`. Mỗi số nguyên [0, 50]. */
  placementTopBonus: [number, number, number];
}

export interface PartyConfig {
  /** `party_settings.version` (0 = mặc định trong code). */
  version: number;
  scoring: ScoringConfig;
  /** Game bị tắt: không lên vòng quay, không chọn/bầu được. Chỉ id có trong `GAME_IDS`, không trùng. */
  disabledGames: string[];
}

// ---------- Mặc định ----------

/** Công thức chuẩn — Luyện tập, Kiểm tra não và trận party khi admin chưa chỉnh gì. Đóng băng. */
export const DEFAULT_SCORING: ScoringConfig = deepFreeze({
  basePoints: BASE_POINTS,
  maxSpeedBonus: MAX_SPEED_BONUS,
  fastAnswerMs: FAST_ANSWER_MS,
  slowAnswerMs: SLOW_ANSWER_MS,
  streakThreshold: STREAK_THRESHOLD,
  streakBonusPerStep: STREAK_BONUS_PER_STEP,
  maxComboMultiplier: MAX_COMBO_MULTIPLIER,
  difficultyMultiplier: [
    DIFFICULTY_MULTIPLIER[0],
    DIFFICULTY_MULTIPLIER[1],
    DIFFICULTY_MULTIPLIER[2],
    DIFFICULTY_MULTIPLIER[3],
  ],
  gameMultipliers: {},
  placementTopBonus: [...PLACEMENT_TOP_BONUS],
});

/** Cấu hình party khi chưa có gì trong DB (hoặc chưa cấu hình Supabase). Đóng băng. */
export const DEFAULT_PARTY_CONFIG: PartyConfig = deepFreeze({
  version: 0,
  scoring: DEFAULT_SCORING,
  disabledGames: [],
});

// ---------- Schema (zod) ----------

/** Giới hạn `party_settings.version` (cột `int` của Postgres). */
const MAX_CONFIG_VERSION = 2_147_483_647;

const int = (min: number, max: number) => z.number().int().min(min).max(max);
const multiplierSchema = z.number().gt(0).max(5);
const quadSchema = z.tuple([
  multiplierSchema,
  multiplierSchema,
  multiplierSchema,
  multiplierSchema,
]);
const topBonusSchema = int(0, 50);
const GAME_ID_SET: ReadonlySet<string> = new Set(GAME_IDS);
const isKnownGameId = (id: string): id is GameId => GAME_ID_SET.has(id);

/** Từng trường riêng — `parseScoringConfig` kiểm theo bảng này. */
const scoringFields = {
  basePoints: int(10, 1_000),
  maxSpeedBonus: int(0, 500),
  fastAnswerMs: int(0, 10_000),
  slowAnswerMs: int(0, 30_000),
  streakThreshold: int(1, 10),
  streakBonusPerStep: z.number().min(0).max(1),
  maxComboMultiplier: z.number().min(1).max(5),
  difficultyMultiplier: quadSchema,
  gameMultipliers: z
    .record(z.string(), quadSchema)
    .refine((v) => Object.keys(v).every(isKnownGameId), {
      message: "Id game không có trong danh mục",
    }),
  placementTopBonus: z.tuple([topBonusSchema, topBonusSchema, topBonusSchema]),
};

/**
 * Kiểm form "Điểm & hệ số" của trang admin (web). Đúng các giới hạn ở `ScoringConfig`, thêm
 * `slowAnswerMs > fastAnswerMs`. Server không dùng schema này để đọc DB (một trường sai sẽ làm
 * hỏng cả bản ghi) mà dùng `parseScoringConfig`.
 */
export const ScoringConfigSchema = z
  .object(scoringFields)
  .refine((v) => v.slowAnswerMs > v.fastAnswerMs, {
    message: "slowAnswerMs phải lớn hơn fastAnswerMs",
    path: ["slowAnswerMs"],
  });

// Kiểu suy ra từ schema phải gán được cho ScoringConfig (và ngược lại).
type _SchemaMatches = [z.infer<typeof ScoringConfigSchema>] extends [ScoringConfig]
  ? [ScoringConfig] extends [z.infer<typeof ScoringConfigSchema>]
    ? true
    : never
  : never;
const _schemaMatches: _SchemaMatches = true;
void _schemaMatches;

// ---------- Đọc cấu hình không tin cậy ----------

/**
 * Đọc `ScoringConfig` từ dữ liệu bất kỳ (DB, JSON). **Không bao giờ ném.** Kiểm từng trường
 * riêng: thiếu hoặc sai → giá trị mặc định của trường đó; `slowAnswerMs ≤ fastAnswerMs` → cả hai
 * về mặc định; `gameMultipliers` bỏ id lạ và bộ số sai. Luôn trả bản mới (sửa được, không đóng băng).
 */
export function parseScoringConfig(raw: unknown): ScoringConfig {
  try {
    const src = isPlainRecord(raw) ? raw : {};
    const field = <K extends Exclude<keyof ScoringConfig, "gameMultipliers">>(
      key: K,
    ): ScoringConfig[K] => {
      const r = scoringFields[key].safeParse(ownValue(src, key));
      return (r.success ? r.data : copyValue(DEFAULT_SCORING[key])) as ScoringConfig[K];
    };
    let fastAnswerMs = field("fastAnswerMs");
    let slowAnswerMs = field("slowAnswerMs");
    if (slowAnswerMs <= fastAnswerMs) {
      fastAnswerMs = DEFAULT_SCORING.fastAnswerMs;
      slowAnswerMs = DEFAULT_SCORING.slowAnswerMs;
    }
    return {
      basePoints: field("basePoints"),
      maxSpeedBonus: field("maxSpeedBonus"),
      fastAnswerMs,
      slowAnswerMs,
      streakThreshold: field("streakThreshold"),
      streakBonusPerStep: field("streakBonusPerStep"),
      maxComboMultiplier: field("maxComboMultiplier"),
      difficultyMultiplier: field("difficultyMultiplier"),
      gameMultipliers: parseGameMultipliers(ownValue(src, "gameMultipliers")),
      placementTopBonus: field("placementTopBonus"),
    };
  } catch {
    return defaultScoringCopy();
  }
}

/**
 * Đọc `PartyConfig` từ dữ liệu bất kỳ — server gọi cho mọi bản ghi `party_settings`.
 * **Không bao giờ ném.** `version` sai → 0; `scoring` qua `parseScoringConfig`; `disabledGames`
 * bỏ id lạ, bỏ trùng, giữ thứ tự `GAME_IDS`.
 */
export function parsePartyConfig(raw: unknown): PartyConfig {
  try {
    const src = isPlainRecord(raw) ? raw : {};
    const version = int(0, MAX_CONFIG_VERSION).safeParse(ownValue(src, "version"));
    return {
      version: version.success ? version.data : 0,
      scoring: parseScoringConfig(ownValue(src, "scoring")),
      disabledGames: parseDisabledGames(ownValue(src, "disabledGames")),
    };
  } catch {
    return { version: 0, scoring: defaultScoringCopy(), disabledGames: [] };
  }
}

/** Đọc `PartyStateView.scoringJson` (web). JSON hỏng hoặc chuỗi rỗng → `DEFAULT_SCORING` (bản sao). */
export function parseScoringJson(json: string): ScoringConfig {
  try {
    return parseScoringConfig(JSON.parse(json));
  } catch {
    return defaultScoringCopy();
  }
}

/**
 * Game được bật trong trận: `GAME_IDS` trừ game bị tắt, theo thứ tự `GAME_IDS`. Còn **ít hơn 2
 * game** thì trả cả `GAME_IDS` để trận không kẹt. Server truyền kết quả cho `availableGames`.
 */
export function enabledGameIds(disabled: readonly string[]): GameId[] {
  const off = new Set(disabled);
  const enabled = GAME_IDS.filter((id) => !off.has(id));
  return enabled.length < 2 ? [...GAME_IDS] : enabled;
}

// ---------- nội bộ ----------

function parseGameMultipliers(raw: unknown): Record<string, Quad> {
  const out: Record<string, Quad> = {};
  if (!isPlainRecord(raw)) return out;
  // Theo thứ tự GAME_IDS: JSON của state ổn định, không phụ thuộc thứ tự khoá trong DB.
  for (const id of GAME_IDS) {
    const r = quadSchema.safeParse(ownValue(raw, id));
    if (r.success) out[id] = r.data;
  }
  return out;
}

function parseDisabledGames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const wanted = new Set(raw.filter((v): v is string => typeof v === "string"));
  return GAME_IDS.filter((id) => wanted.has(id));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Chỉ đọc thuộc tính của chính object (không đọc `__proto__`, `constructor`… qua prototype). */
function ownValue(obj: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(obj, key) ? obj[key] : undefined;
}

/** Bản sao sửa được của `DEFAULT_SCORING` (bản gốc đóng băng). */
function defaultScoringCopy(): ScoringConfig {
  return copyValue(DEFAULT_SCORING);
}

/** Sao chép sâu một giá trị chỉ gồm số, mảng và object thường (mặc định của cấu hình). */
function copyValue<T>(value: T): T {
  return typeof value === "object" && value !== null
    ? (JSON.parse(JSON.stringify(value)) as T)
    : value;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}
