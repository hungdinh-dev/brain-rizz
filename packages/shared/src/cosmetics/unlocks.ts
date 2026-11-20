/**
 * Bạn đồng hành khoá theo thành tích (CR-024, docs/01-product/gacha-pets-unlocks.md mục 3.2 và
 * 5.1). Hàm thuần: server (kiểm khi vào phòng) và web (tủ đồ, thanh tiến độ) cùng đánh giá một
 * `UnlockStats` bằng cùng luật. Số liệu chỉnh bằng mô phỏng `economy-sim.test.ts`; đổi luật thì cập
 * nhật bảng mục 3.2 của kế hoạch.
 */
import type { CharacterId } from "../constants";
import { DIFFICULTIES, type Difficulty } from "../difficulty";
import { GAME_IDS, type GameId, getGame, isGameId } from "../games";
import { CATEGORIES, type Category } from "../games/types";

// ---------- Nhân vật ----------

/** 6 nhân vật luôn mở (bot chỉ dùng các nhân vật này). */
export const BASE_CHARACTER_IDS = ["khoi", "bo", "mochi", "bap", "cam", "tron"] as const;

/**
 * 6 bạn đồng hành mở bằng thành tích. Tên hiển thị ở i18n của web (`characters.<id>`).
 * - pin: Pin (cánh cụt) · op: Ộp (ếch) · thong: Thông (cú)
 * - gai: Gai (nhím) · may: Mây (koala) · lua: Lửa (rồng con)
 */
export const PET_CHARACTER_IDS = ["pin", "op", "thong", "gai", "may", "lua"] as const;

export type BaseCharacterId = (typeof BASE_CHARACTER_IDS)[number];
export type PetId = (typeof PET_CHARACTER_IDS)[number];

// `CHARACTER_IDS` (constants.ts) phải đúng bằng 6 cũ rồi 6 mới, theo thứ tự (test kiểm thứ tự).
type _SameIds = [BaseCharacterId | PetId] extends [CharacterId]
  ? [CharacterId] extends [BaseCharacterId | PetId]
    ? true
    : never
  : never;
const _sameIds: _SameIds = true;
void _sameIds;

export function isPetId(value: unknown): value is PetId {
  return typeof value === "string" && (PET_CHARACTER_IDS as readonly string[]).includes(value);
}

export function isBaseCharacterId(value: unknown): value is BaseCharacterId {
  return typeof value === "string" && (BASE_CHARACTER_IDS as readonly string[]).includes(value);
}

// ---------- Số liệu ----------

/**
 * Số liệu để xét mở khoá — `unlock_stats_for` / `my_unlock_stats` của Supabase (mục 5.3), đọc qua
 * `parseUnlockStats`. Mọi số là số nguyên ≥ 0.
 */
export interface UnlockStats {
  /** Số trận party đã chơi xong (dòng `match_results`, kể cả trận có bot). */
  partyMatches: number;
  /** Số trận party về nhất (`placement = 0`). */
  partyWins: number;
  /** Điểm Não cao nhất mọi lượt Kiểm tra não. */
  brainBest: number;
  /** Kỷ lục luyện tập theo game và độ khó (`practice_bests.best_score`). */
  practiceBest: Partial<Record<GameId, Partial<Record<Difficulty, number>>>>;
  /**
   * Điểm theo thể loại trong trận party: `sum` = tổng `category_scores[nhóm]` mọi trận, `matches` =
   * số trận có chơi nhóm đó (một trận có 2 vòng cùng nhóm thì `category_scores` đã cộng cả hai).
   */
  partyCategory: Partial<Record<Category, { sum: number; matches: number }>>;
}

/** Người chưa chơi gì (hoặc chưa đăng nhập). */
export function emptyUnlockStats(): UnlockStats {
  return { partyMatches: 0, partyWins: 0, brainBest: 0, practiceBest: {}, partyCategory: {} };
}

/** Trần mọi số đọc vào (cột `int` của Postgres), để tổng / trung bình không tràn. */
const MAX_STAT = 2_147_483_647;

/**
 * Đọc JSON snake_case của `unlock_stats_for` (mục 5.3):
 * `{ party_matches, party_wins, brain_best, practice_best: { <game>: { <độ khó>: best } },
 *    party_category: { <nhóm>: { sum, matches } } }` → `UnlockStats` (camelCase).
 *
 * **Không bao giờ ném.** Nhận object hoặc chuỗi JSON. Thiếu / sai kiểu / âm / NaN → 0; chuỗi chữ số
 * (bigint) được nhận; số thực → làm tròn xuống; vượt `int` → kẹp. Game, độ khó ("0".."3"), nhóm lạ bị bỏ. Chỉ đọc thuộc tính của
 * chính object (bỏ qua `__proto__`…). Luôn trả object mới.
 */
export function parseUnlockStats(raw: unknown): UnlockStats {
  try {
    let src = raw;
    if (typeof src === "string") src = JSON.parse(src);
    if (!isRecord(src)) return emptyUnlockStats();

    const practiceBest: UnlockStats["practiceBest"] = {};
    const pb = own(src, "practice_best");
    if (isRecord(pb)) {
      for (const game of GAME_IDS) {
        const byDiff = own(pb, game);
        if (!isRecord(byDiff)) continue;
        const out: Partial<Record<Difficulty, number>> = {};
        for (const d of DIFFICULTIES) {
          const v = statInt(own(byDiff, String(d)));
          if (v > 0) out[d] = v;
        }
        if (Object.keys(out).length > 0) practiceBest[game] = out;
      }
    }

    const partyCategory: UnlockStats["partyCategory"] = {};
    const pc = own(src, "party_category");
    if (isRecord(pc)) {
      for (const category of CATEGORIES) {
        const entry = own(pc, category);
        if (!isRecord(entry)) continue;
        const matches = statInt(own(entry, "matches"));
        if (matches > 0) partyCategory[category] = { sum: statInt(own(entry, "sum")), matches };
      }
    }

    return {
      partyMatches: statInt(own(src, "party_matches")),
      partyWins: statInt(own(src, "party_wins")),
      brainBest: statInt(own(src, "brain_best")),
      practiceBest,
      partyCategory,
    };
  } catch {
    return emptyUnlockStats();
  }
}

// ---------- Luật ----------

/** Một điều kiện đơn. Mọi `target` là số nguyên dương. */
export type LeafUnlockRule =
  /** Chơi xong ≥ `target` trận party. */
  | { kind: "party-matches"; target: number }
  /** Về nhất ≥ `target` trận party. */
  | { kind: "party-wins"; target: number }
  /** Kỷ lục luyện tập `game` ≥ `target` ở độ khó `minDifficulty` trở lên. */
  | { kind: "practice-best"; game: GameId; minDifficulty: Difficulty; target: number }
  /**
   * Trung bình `minGames` kỷ lục luyện tập cao nhất của nhóm `category` (mỗi game lấy kỷ lục cao
   * nhất ở độ khó `minDifficulty` trở lên; thiếu game tính 0) ≥ `target`, và đã có kỷ lục ở ít nhất
   * `minGames` game của nhóm. Lấy các game cao nhất để thử thêm game mới không bị kéo điểm xuống.
   */
  | {
      kind: "practice-category-avg";
      category: Category;
      minDifficulty: Difficulty;
      minGames: number;
      target: number;
    }
  /** Trung bình điểm nhóm `category` mỗi trận party (`sum / matches`) ≥ `target`, với ≥ `minMatches` trận. */
  | { kind: "party-category-avg"; category: Category; minMatches: number; target: number }
  /** Điểm Não ≥ `target` trong một lượt Kiểm tra não. */
  | { kind: "brain-score"; target: number };

/** Luật mở khoá: một điều kiện đơn, hoặc `all` = đạt mọi điều kiện đơn trong danh sách. */
export type UnlockRule = LeafUnlockRule | { kind: "all"; rules: readonly LeafUnlockRule[] };

export type UnlockRuleKind = UnlockRule["kind"];

/**
 * Luật mở từng thú (chỉnh bằng mô phỏng, kế hoạch mục 3.2). Ba thú đầu bảng tiến độ của người
 * chơi chăm (kể cả trẻ em): `pin` (số trận), `gai` (số trận về nhất — phòng bot Dễ cũng tính),
 * `thong` (luyện tập nhóm Phân tích, tính cả mức Mầm). `op`, `may` cần chơi tốt ở mức người lớn
 * (mốc ≈ p90 của người lớn điển hình); `lua` cần chơi lâu (120 trận) và không bỏ nhóm nào.
 */
export const UNLOCK_RULES: Readonly<Record<PetId, UnlockRule>> = {
  pin: { kind: "party-matches", target: 10 },
  op: { kind: "practice-best", game: "number-balloons", minDifficulty: 1, target: 2_200 },
  thong: {
    kind: "practice-category-avg",
    category: "analyze",
    minDifficulty: 0,
    minGames: 3,
    target: 2_500,
  },
  gai: { kind: "party-wins", target: 5 },
  may: { kind: "brain-score", target: 530 },
  lua: {
    kind: "all",
    rules: [
      { kind: "party-matches", target: 120 },
      ...CATEGORIES.map(
        (category): LeafUnlockRule => ({
          kind: "party-category-avg",
          category,
          minMatches: 10,
          target: 1_600,
        }),
      ),
    ],
  },
};

// ---------- Đánh giá ----------

/**
 * Tiến độ một luật. Luật đơn: `current` / `target` cùng đơn vị (trận, điểm, Điểm Não);
 * `count` là điều kiện phụ về số lượng (số game có kỷ lục, số trận của nhóm). Luật `all`:
 * `current` = số điều kiện con đã đạt, `target` = số điều kiện con, `parts` = tiến độ từng điều kiện
 * theo thứ tự khai báo. `unlocked` = `current ≥ target` và (nếu có) `count.current ≥ count.target`.
 */
export interface UnlockProgress {
  unlocked: boolean;
  current: number;
  target: number;
  count?: { current: number; target: number };
  parts?: UnlockProgress[];
}

/** Đánh giá một luật trên số liệu đã qua `parseUnlockStats`. */
export function evaluateUnlock(rule: UnlockRule, stats: UnlockStats): UnlockProgress {
  if (rule.kind === "all") {
    const parts = rule.rules.map((r) => evaluateLeaf(r, stats));
    const done = parts.filter((p) => p.unlocked).length;
    return { unlocked: done === parts.length, current: done, target: parts.length, parts };
  }
  return evaluateLeaf(rule, stats);
}

/**
 * Tỉ lệ hoàn thành trong [0, 1] để vẽ thanh tiến độ: luật đơn lấy tỉ lệ nhỏ hơn giữa
 * `current / target` và `count`; luật `all` lấy trung bình các phần. Bằng 1 khi và chỉ khi đã mở.
 */
export function unlockRatio(progress: UnlockProgress): number {
  if (progress.parts && progress.parts.length > 0) {
    return progress.parts.reduce((sum, p) => sum + unlockRatio(p), 0) / progress.parts.length;
  }
  if (progress.unlocked) return 1;
  const main = ratio(progress.current, progress.target);
  const count = progress.count ? ratio(progress.count.current, progress.count.target) : 1;
  // Chưa mở thì không bao giờ hiện đầy thanh.
  return Math.min(main, count, 0.99);
}

/** Tiến độ mở thú `pet`. */
export function petProgress(pet: PetId, stats: UnlockStats): UnlockProgress {
  return evaluateUnlock(UNLOCK_RULES[pet], stats);
}

/** Nhân vật được dùng: 6 cũ luôn được, thú được khi đã đạt luật. Id lạ → `false`. */
export function isCharacterUnlocked(id: string, stats: UnlockStats): boolean {
  if (isBaseCharacterId(id)) return true;
  return isPetId(id) && petProgress(id, stats).unlocked;
}

/** Mọi nhân vật đã mở, theo thứ tự `CHARACTER_IDS` (6 cũ rồi các thú đã mở). */
export function unlockedCharacters(stats: UnlockStats): CharacterId[] {
  return [
    ...BASE_CHARACTER_IDS,
    ...PET_CHARACTER_IDS.filter((pet) => petProgress(pet, stats).unlocked),
  ];
}

// ---------- nội bộ ----------

function evaluateLeaf(rule: LeafUnlockRule, stats: UnlockStats): UnlockProgress {
  switch (rule.kind) {
    case "party-matches":
      return leaf(stats.partyMatches, rule.target);
    case "party-wins":
      return leaf(stats.partyWins, rule.target);
    case "brain-score":
      return leaf(stats.brainBest, rule.target);
    case "practice-best":
      return leaf(practiceBestOf(stats, rule.game, rule.minDifficulty), rule.target);
    case "practice-category-avg": {
      const bests = GAME_IDS.filter((id) => getGame(id).category === rule.category)
        .map((id) => practiceBestOf(stats, id, rule.minDifficulty))
        .filter((best) => best > 0)
        .sort((a, b) => b - a);
      const need = Math.max(1, rule.minGames);
      const top = bests.slice(0, need).reduce((sum, best) => sum + best, 0);
      return leaf(Math.floor(top / need), rule.target, { current: bests.length, target: need });
    }
    case "party-category-avg": {
      const entry = stats.partyCategory[rule.category];
      const matches = entry?.matches ?? 0;
      const avg = entry && matches > 0 ? Math.floor(entry.sum / matches) : 0;
      return leaf(avg, rule.target, { current: matches, target: rule.minMatches });
    }
  }
}

function leaf(
  current: number,
  target: number,
  count?: { current: number; target: number },
): UnlockProgress {
  const unlocked = current >= target && (!count || count.current >= count.target);
  return count ? { unlocked, current, target, count } : { unlocked, current, target };
}

/** Kỷ lục cao nhất của `game` ở độ khó `minDifficulty` trở lên. */
function practiceBestOf(stats: UnlockStats, game: GameId, minDifficulty: Difficulty): number {
  if (!isGameId(game)) return 0;
  const byDiff = stats.practiceBest[game];
  if (!byDiff) return 0;
  let best = 0;
  for (const d of DIFFICULTIES) {
    if (d < minDifficulty) continue;
    best = Math.max(best, byDiff[d] ?? 0);
  }
  return best;
}

function ratio(current: number, target: number): number {
  if (!(target > 0)) return 1;
  return Math.min(1, Math.max(0, current / target));
}

/** Số nguyên ≥ 0 từ số hoặc chuỗi chữ số (Postgres có thể trả `bigint` dạng chuỗi); còn lại → 0. */
function statInt(value: unknown): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d{1,15}$/.test(value)
        ? Number(value)
        : 0;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_STAT, Math.floor(n));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function own(obj: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(obj, key) ? obj[key] : undefined;
}
