import {
  DEFAULT_SCORING,
  type Difficulty,
  GAME_IDS,
  GAMES,
  type GameId,
  gameMultiplier,
  parseScoringConfig,
  type Quad,
  type ScoringConfig,
  ScoringConfigSchema,
} from "@brain-rizz/shared";

/**
 * Bản nháp cấu hình trận party của trang quản trị (CR-019, ui-ux 6.9 "Bản nháp và lưu"): các ô ở
 * Điểm & hệ số, bật/tắt game và hệ số ghi đè ở mục Game là MỘT bản nháp. Hàm thuần, có test.
 *
 * Ô nhập giữ nguyên chữ người gõ (dấu thập phân "," hoặc "."); hợp lệ hay không do
 * `ScoringConfigSchema` của shared quyết định, ở đây chỉ dịch lỗi thành câu dễ hiểu.
 */

export const DIFFICULTIES = [0, 1, 2, 3] as const satisfies readonly Difficulty[];
export const TOP_PLACES = [0, 1, 2] as const;

export const SCALAR_FIELDS = [
  "basePoints",
  "maxSpeedBonus",
  "fastAnswerMs",
  "slowAnswerMs",
  "streakThreshold",
  "streakBonusPerStep",
  "maxComboMultiplier",
] as const;

export type ScalarField = (typeof SCALAR_FIELDS)[number];
export type MultiplierField = `difficultyMultiplier.${Difficulty}`;
export type TopField = `placementTopBonus.${(typeof TOP_PLACES)[number]}`;
export type FieldKey = ScalarField | MultiplierField | TopField;

export const multiplierField = (d: Difficulty): MultiplierField => `difficultyMultiplier.${d}`;
export const topField = (i: (typeof TOP_PLACES)[number]): TopField => `placementTopBonus.${i}`;

export const FIELD_KEYS: readonly FieldKey[] = [
  ...SCALAR_FIELDS,
  ...DIFFICULTIES.map(multiplierField),
  ...TOP_PLACES.map(topField),
];

/** Giới hạn từng ô — khớp `ScoringConfig` / `ScoringConfigSchema` (chỉ dùng để viết câu lỗi). */
export interface FieldSpec {
  min: number;
  max: number;
  integer: boolean;
  /** `true`: phải lớn hơn hẳn `min` (hệ số > 0). */
  aboveMin?: boolean;
}

const SCALAR_SPECS: Record<ScalarField, FieldSpec> = {
  basePoints: { min: 10, max: 1_000, integer: true },
  maxSpeedBonus: { min: 0, max: 500, integer: true },
  fastAnswerMs: { min: 0, max: 10_000, integer: true },
  slowAnswerMs: { min: 0, max: 30_000, integer: true },
  streakThreshold: { min: 1, max: 10, integer: true },
  streakBonusPerStep: { min: 0, max: 1, integer: false },
  maxComboMultiplier: { min: 1, max: 5, integer: false },
};

export const MULTIPLIER_SPEC: FieldSpec = { min: 0, max: 5, integer: false, aboveMin: true };
const TOP_SPEC: FieldSpec = { min: 0, max: 50, integer: true };

export function fieldSpec(key: FieldKey): FieldSpec {
  if (key.startsWith("difficultyMultiplier.")) return MULTIPLIER_SPEC;
  if (key.startsWith("placementTopBonus.")) return TOP_SPEC;
  return SCALAR_SPECS[key as ScalarField];
}

/** Giá trị của một ô trong cấu hình. */
export function fieldValue(config: ScoringConfig, key: FieldKey): number {
  const [name, index] = key.split(".");
  if (name === "difficultyMultiplier") return config.difficultyMultiplier[Number(index)] ?? NaN;
  if (name === "placementTopBonus") return config.placementTopBonus[Number(index)] ?? NaN;
  return config[key as ScalarField];
}

export type DecimalSeparator = "," | ".";

/** Số → chữ trong ô nhập (không nhóm hàng nghìn, dấu thập phân theo ngôn ngữ). */
export function formatDraftNumber(n: number, decimal: DecimalSeparator): string {
  if (!Number.isFinite(n)) return "";
  const text = String(Number(n.toFixed(6)));
  return decimal === "," ? text.replace(".", ",") : text;
}

/**
 * Chữ trong ô → số; không phải số → NaN. Nhận "," hoặc "." làm dấu thập phân; ô số nguyên nhận
 * thêm dấu nhóm hàng nghìn ("1.500", "10,000").
 */
export function parseDraftNumber(text: string, integer: boolean): number {
  const t = text.trim().replace(/[\s ]/g, "");
  if (!t) return NaN;
  if (integer && /^\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ""));
  if (!/^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(t)) return NaN;
  return Number(t.replace(",", "."));
}

/** 4 ô hệ số của một game ở mục Game: `null` = không ghi đè (hiện hệ số đang có hiệu lực). */
export type Cells = [string | null, string | null, string | null, string | null];

export interface PartyDraft {
  fields: Record<FieldKey, string>;
  /** Game bị tắt, theo thứ tự `GAME_IDS`. */
  disabled: GameId[];
  overrides: Partial<Record<GameId, Cells>>;
}

/** Hệ số của game khi KHÔNG ghi đè: hệ số game khai báo, không có thì hệ số chung `general`. */
export function baseMultiplier(id: GameId, d: Difficulty, general: Quad): number {
  return gameMultiplier(GAMES[id], d, {
    ...DEFAULT_SCORING,
    difficultyMultiplier: general,
    gameMultipliers: {},
  });
}

const sameQuad = (a: readonly number[] | null, b: readonly number[] | null) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((v, i) => Object.is(v, b[i])));

/** Ghi đè của cấu hình, bỏ bộ số trùng hệ số mặc định của game (coi như không ghi đè). */
function effectiveOverride(config: ScoringConfig, id: GameId): Quad | null {
  const quad = Object.hasOwn(config.gameMultipliers, id) ? config.gameMultipliers[id] : undefined;
  if (!quad) return null;
  const base = DIFFICULTIES.map((d) => baseMultiplier(id, d, config.difficultyMultiplier));
  return sameQuad(quad, base) ? null : quad;
}

/** Bản nháp từ một cấu hình (đang áp dụng, mặc định, hay một bản trong lịch sử). */
export function draftFromConfig(
  scoring: ScoringConfig,
  disabled: readonly string[],
  decimal: DecimalSeparator,
): PartyDraft {
  const fields = Object.fromEntries(
    FIELD_KEYS.map((k) => [k, formatDraftNumber(fieldValue(scoring, k), decimal)]),
  ) as Record<FieldKey, string>;
  const overrides: Partial<Record<GameId, Cells>> = {};
  for (const id of GAME_IDS) {
    const quad = effectiveOverride(scoring, id);
    if (!quad) continue;
    overrides[id] = DIFFICULTIES.map((d) =>
      quad[d] === baseMultiplier(id, d, scoring.difficultyMultiplier)
        ? null
        : formatDraftNumber(quad[d], decimal),
    ) as Cells;
  }
  return { fields, disabled: GAME_IDS.filter((id) => disabled.includes(id)), overrides };
}

const parseField = (draft: Pick<PartyDraft, "fields">, key: FieldKey) =>
  parseDraftNumber(draft.fields[key], fieldSpec(key).integer);

/** Hệ số chung của bản nháp; ô chưa hợp lệ dùng mặc định (để hiện hệ số game không bị trống). */
export function draftGeneral(draft: Pick<PartyDraft, "fields">): Quad {
  return DIFFICULTIES.map((d) => {
    const v = parseField(draft, multiplierField(d));
    return v > 0 && v <= MULTIPLIER_SPEC.max ? v : DEFAULT_SCORING.difficultyMultiplier[d];
  }) as Quad;
}

/** Ô hệ số của game đang ghi đè (khác hệ số mặc định của game) không. */
export function isOverrideCell(cell: string | null, base: number): boolean {
  return cell !== null && !Object.is(parseDraftNumber(cell, false), base);
}

function buildOverrides(draft: PartyDraft, general: Quad): Record<string, Quad> {
  const out: Record<string, Quad> = {};
  for (const id of GAME_IDS) {
    const cells = draft.overrides[id];
    if (!cells) continue;
    const base = DIFFICULTIES.map((d) => baseMultiplier(id, d, general));
    const quad = DIFFICULTIES.map((d) => {
      const cell = cells[d];
      return cell === null ? base[d]! : parseDraftNumber(cell, false);
    }) as Quad;
    if (!sameQuad(quad, base)) out[id] = quad;
  }
  return out;
}

export type FieldError =
  | { kind: "number" }
  | { kind: "integer" }
  | { kind: "range"; min: number; max: number }
  | { kind: "slow"; fast: number }
  | { kind: "multiplier" };

export interface DraftCheck {
  /** Cấu hình dựng từ bản nháp (ô sai là NaN). */
  candidate: ScoringConfig;
  /** Cấu hình hợp lệ theo `ScoringConfigSchema`, sẵn sàng lưu; `null` khi còn ô sai. */
  config: ScoringConfig | null;
  /** Để xem thử: ô sai về mặc định của trường đó (`parseScoringConfig`). */
  preview: ScoringConfig;
  fieldErrors: Partial<Record<FieldKey, FieldError>>;
  /** Ô hệ số sai của từng game (theo độ khó). */
  cellErrors: Partial<Record<GameId, boolean[]>>;
  invalidCount: number;
}

function explain(value: number, spec: FieldSpec): FieldError {
  if (!Number.isFinite(value)) return { kind: "number" };
  if (spec.aboveMin) return { kind: "multiplier" };
  if (spec.integer && !Number.isInteger(value)) return { kind: "integer" };
  return { kind: "range", min: spec.min, max: spec.max };
}

/** Kiểm bản nháp bằng `ScoringConfigSchema` và dịch từng lỗi về ô của nó. */
export function checkDraft(draft: PartyDraft): DraftCheck {
  const general = DIFFICULTIES.map((d) => parseField(draft, multiplierField(d))) as Quad;
  const candidate: ScoringConfig = {
    basePoints: parseField(draft, "basePoints"),
    maxSpeedBonus: parseField(draft, "maxSpeedBonus"),
    fastAnswerMs: parseField(draft, "fastAnswerMs"),
    slowAnswerMs: parseField(draft, "slowAnswerMs"),
    streakThreshold: parseField(draft, "streakThreshold"),
    streakBonusPerStep: parseField(draft, "streakBonusPerStep"),
    maxComboMultiplier: parseField(draft, "maxComboMultiplier"),
    difficultyMultiplier: general,
    gameMultipliers: buildOverrides(draft, draftGeneral(draft)),
    placementTopBonus: TOP_PLACES.map((i) => parseField(draft, topField(i))) as [
      number,
      number,
      number,
    ],
  };

  const fieldErrors: Partial<Record<FieldKey, FieldError>> = {};
  const cellErrors: Partial<Record<GameId, boolean[]>> = {};
  const result = ScoringConfigSchema.safeParse(candidate);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const [name, a, b] = issue.path;
      if (name === "gameMultipliers" && typeof a === "string" && typeof b === "number") {
        const id = a as GameId;
        const cells = cellErrors[id] ?? [false, false, false, false];
        cells[b] = true;
        cellErrors[id] = cells;
      } else if (
        (name === "difficultyMultiplier" || name === "placementTopBonus") &&
        typeof a === "number"
      ) {
        const key = `${name}.${a}` as FieldKey;
        fieldErrors[key] ??= explain(fieldValue(candidate, key), fieldSpec(key));
      } else if (typeof name === "string" && (SCALAR_FIELDS as readonly string[]).includes(name)) {
        const key = name as ScalarField;
        fieldErrors[key] ??= explain(candidate[key], SCALAR_SPECS[key]);
      }
    }
  }
  // Mốc Chậm phải sau mốc Nhanh: schema kiểm bằng `refine` (có thể không chạy khi ô khác đang sai)
  // và báo vào ô Chậm → luôn ghi câu riêng khi cả hai ô đều đúng khoảng.
  const { fastAnswerMs: fast, slowAnswerMs: slow } = candidate;
  if (!fieldErrors.fastAnswerMs && Number.isFinite(fast) && Number.isFinite(slow)) {
    const slowOk = !fieldErrors.slowAnswerMs || fieldErrors.slowAnswerMs.kind === "range";
    if (slowOk && Number.isInteger(slow) && slow <= fast) {
      fieldErrors.slowAnswerMs = { kind: "slow", fast };
    }
  }

  const invalidCount =
    Object.keys(fieldErrors).length +
    Object.values(cellErrors).reduce((n, cells) => n + (cells?.filter(Boolean).length ?? 0), 0);
  return {
    candidate,
    config: result.success && invalidCount === 0 ? result.data : null,
    preview: parseScoringConfig(candidate),
    fieldErrors,
    cellErrors,
    invalidCount,
  };
}

export type DraftChange =
  | { kind: "disable"; ids: GameId[] }
  | { kind: "enable"; ids: GameId[] }
  | { kind: "field"; key: FieldKey; from: number; to: number }
  | { kind: "game"; id: GameId; from: Quad | null; to: Quad | null };

export interface AppliedConfig {
  scoring: ScoringConfig;
  disabledGames: readonly string[];
}

/** Khác biệt giữa bản nháp và cấu hình đang áp dụng (thanh "n thay đổi chưa lưu", hộp Lưu). */
export function diffDraft(applied: AppliedConfig, draft: PartyDraft, check: DraftCheck) {
  const changes: DraftChange[] = [];
  const wasOff = new Set(applied.disabledGames);
  const isOff = new Set(draft.disabled);
  const disable = GAME_IDS.filter((id) => isOff.has(id) && !wasOff.has(id));
  const enable = GAME_IDS.filter((id) => wasOff.has(id) && !isOff.has(id));
  if (disable.length) changes.push({ kind: "disable", ids: disable });
  if (enable.length) changes.push({ kind: "enable", ids: enable });
  for (const key of FIELD_KEYS) {
    const from = fieldValue(applied.scoring, key);
    const to = parseField(draft, key);
    if (!Object.is(from, to)) changes.push({ kind: "field", key, from, to });
  }
  for (const id of GAME_IDS) {
    const from = effectiveOverride(applied.scoring, id);
    const to = Object.hasOwn(check.candidate.gameMultipliers, id)
      ? (check.candidate.gameMultipliers[id] ?? null)
      : null;
    if (!sameQuad(from, to)) changes.push({ kind: "game", id, from, to });
  }
  const count = changes.reduce(
    (n, c) => n + (c.kind === "disable" || c.kind === "enable" ? c.ids.length : 1),
    0,
  );
  return { changes, count };
}

// ------------------------------------------------------------- sửa bản nháp

/** Phải bật ít nhất ngần này game (khớp `enabledGameIds` của shared: < 2 thì server bật lại hết). */
export const MIN_ENABLED_GAMES = 2;

export const enabledCount = (draft: PartyDraft) => GAME_IDS.length - draft.disabled.length;

/** Bật/tắt một game; `null` khi tắt sẽ còn dưới `MIN_ENABLED_GAMES` game bật. */
export function setGameEnabled(draft: PartyDraft, id: GameId, on: boolean): PartyDraft | null {
  const off = new Set(draft.disabled);
  if (on) off.delete(id);
  else {
    if (!off.has(id) && enabledCount(draft) <= MIN_ENABLED_GAMES) return null;
    off.add(id);
  }
  return { ...draft, disabled: GAME_IDS.filter((g) => off.has(g)) };
}

/** Công tắc này đang bị khoá (game đang bật và chỉ còn đúng số game tối thiểu). */
export function isToggleLocked(draft: PartyDraft, id: GameId): boolean {
  return !draft.disabled.includes(id) && enabledCount(draft) <= MIN_ENABLED_GAMES;
}

export function setField(draft: PartyDraft, key: FieldKey, text: string): PartyDraft {
  return { ...draft, fields: { ...draft.fields, [key]: text } };
}

export function setCell(draft: PartyDraft, id: GameId, d: Difficulty, text: string): PartyDraft {
  const cells = [...(draft.overrides[id] ?? [null, null, null, null])] as Cells;
  cells[d] = text;
  return { ...draft, overrides: { ...draft.overrides, [id]: cells } };
}

/** Bỏ mọi ghi đè hệ số của một game (nút "Về mặc định của game"). */
export function resetGame(draft: PartyDraft, id: GameId): PartyDraft {
  const overrides = { ...draft.overrides };
  delete overrides[id];
  return { ...draft, overrides };
}

/** "Khôi phục mặc định": chỉ các ô ở Điểm & hệ số; bật/tắt game và ghi đè ở mục Game giữ nguyên. */
export function restoreDefaultFields(draft: PartyDraft, decimal: DecimalSeparator): PartyDraft {
  return { ...draft, fields: draftFromConfig(DEFAULT_SCORING, [], decimal).fields };
}
