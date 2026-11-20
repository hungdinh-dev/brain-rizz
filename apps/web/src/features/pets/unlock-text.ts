import {
  CATEGORIES,
  type Category,
  type Difficulty,
  type GameId,
  type LeafUnlockRule,
  type UnlockProgress,
  type UnlockRule,
} from "@brain-rizz/shared";
import type { TFunction } from "i18next";

/**
 * Chữ điều kiện mở khoá bạn đồng hành (CR-024, ui-ux 6.12): dựng từ chính luật `UNLOCK_RULES` nên
 * đổi số ở shared (sau mô phỏng) thì chữ tự đúng, không viết cứng "10 trận" hay "2.200".
 * Hàm thuần (nhận `t`, cách định dạng số, tên game), có test cho mọi loại luật.
 */
export interface UnlockTextDeps {
  t: TFunction;
  /** Định dạng số theo ngôn ngữ (vi "2.200", en "2,200"). */
  fmt(value: number): string;
  /** Tên minigame theo ngôn ngữ đang chọn. */
  gameTitle(id: GameId): string;
  /** Nối danh sách "a, b và c" theo ngôn ngữ (`Intl.ListFormat`). */
  list(items: string[]): string;
}

/** Viết hoa chữ cái đầu (tiếng Việt có dấu vẫn đúng: "đ" → "Đ"). */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function levelText(min: Difficulty, deps: UnlockTextDeps): string {
  const { t } = deps;
  return min === 0
    ? t("pets.rule.levelsAll", { level: t("difficulty.0") })
    : t("pets.rule.levelsFrom", { level: t(`difficulty.${min}`) });
}

/** Mệnh đề (chữ thường đầu câu, không dấu chấm) của một điều kiện đơn. */
function leafClause(rule: LeafUnlockRule, deps: UnlockTextDeps): string {
  const { t, fmt } = deps;
  switch (rule.kind) {
    case "party-matches":
      return t("pets.rule.partyMatches", { count: rule.target, target: fmt(rule.target) });
    case "party-wins":
      return t("pets.rule.partyWins", { count: rule.target, target: fmt(rule.target) });
    case "brain-score":
      return t("pets.rule.brainScore", { target: fmt(rule.target) });
    case "practice-best":
      return rule.minDifficulty === 0
        ? t("pets.rule.practiceBestAny", {
            game: deps.gameTitle(rule.game),
            target: fmt(rule.target),
          })
        : t("pets.rule.practiceBest", {
            game: deps.gameTitle(rule.game),
            target: fmt(rule.target),
            level: t(`difficulty.${rule.minDifficulty}`),
          });
    case "practice-category-avg":
      return t("pets.rule.practiceCategoryAvg", {
        count: rule.minGames,
        category: t(`category.${rule.category}`),
        target: fmt(rule.target),
        levels: levelText(rule.minDifficulty, deps),
      });
    case "party-category-avg":
      return t("pets.rule.partyCategoryAvg", {
        count: rule.minMatches,
        category: t(`category.${rule.category}`),
        target: fmt(rule.target),
      });
  }
}

type CategoryAvgRule = Extract<LeafUnlockRule, { kind: "party-category-avg" }>;

/**
 * Mệnh đề của luật `all`: các điều kiện "trung bình nhóm trong party" cùng mốc gộp thành một câu
 * ("… ở cả 5 nhóm (mỗi nhóm ít nhất 10 trận)"), điều kiện khác giữ nguyên, rồi nối bằng "và".
 */
function allClauses(rules: readonly LeafUnlockRule[], deps: UnlockTextDeps): string[] {
  const { t, fmt } = deps;
  const clauses: string[] = [];
  const groups = new Map<string, CategoryAvgRule[]>();
  for (const rule of rules) {
    if (rule.kind !== "party-category-avg") continue;
    const key = `${rule.target}|${rule.minMatches}`;
    groups.set(key, [...(groups.get(key) ?? []), rule]);
  }
  const done = new Set<string>();
  for (const rule of rules) {
    if (rule.kind !== "party-category-avg") {
      clauses.push(leafClause(rule, deps));
      continue;
    }
    const key = `${rule.target}|${rule.minMatches}`;
    const group = groups.get(key) ?? [rule];
    if (group.length < 2) {
      clauses.push(leafClause(rule, deps));
      continue;
    }
    if (done.has(key)) continue;
    done.add(key);
    const cats = CATEGORIES.filter((c) => group.some((r) => r.category === c));
    const categories =
      cats.length === CATEGORIES.length
        ? t("pets.rule.allCategories", { count: cats.length })
        : deps.list(cats.map((c) => t(`category.${c}`)));
    clauses.push(
      t("pets.rule.partyCategoryGroup", {
        count: rule.minMatches,
        target: fmt(rule.target),
        categories,
      }),
    );
  }
  return clauses;
}

/** Điều kiện đủ câu, viết hoa đầu câu, chưa có dấu chấm (dùng trong câu khác như "Đã đạt: …"). */
export function ruleCondition(rule: UnlockRule, deps: UnlockTextDeps): string {
  const clauses = rule.kind === "all" ? allClauses(rule.rules, deps) : [leafClause(rule, deps)];
  return capitalize(deps.list(clauses));
}

/** Điều kiện đủ câu có dấu chấm (sheet, thẻ máy tính, aria-label thẻ khoá). */
export function ruleSentence(rule: UnlockRule, deps: UnlockTextDeps): string {
  return deps.t("pets.sentence", { text: ruleCondition(rule, deps) });
}

/** Nhãn tiến độ ngắn trên thẻ khoá và cạnh thanh tiến độ ("3/10 trận", "Nhất 1/5", "1.560/2.200"). */
export function progressLabel(
  rule: UnlockRule,
  progress: UnlockProgress,
  deps: UnlockTextDeps,
): string {
  const { t, fmt } = deps;
  const pair = (current: number, target: number) => ({
    current: fmt(current),
    target: fmt(target),
  });
  switch (rule.kind) {
    case "all":
      return t("pets.short.goals", pair(progress.current, progress.target));
    case "party-matches":
      return t("pets.short.matches", pair(progress.current, progress.target));
    case "party-wins":
      return t("pets.short.wins", pair(progress.current, progress.target));
    case "practice-category-avg":
    case "party-category-avg": {
      // Chưa đủ số game / số trận thì đó là việc cần làm trước.
      const count = progress.count;
      if (count && count.current < count.target) {
        return rule.kind === "practice-category-avg"
          ? t("pets.short.games", pair(count.current, count.target))
          : t("pets.short.matches", pair(count.current, count.target));
      }
      return t("pets.short.score", pair(progress.current, progress.target));
    }
    case "practice-best":
    case "brain-score":
      return t("pets.short.score", pair(progress.current, progress.target));
  }
}

/** Gợi ý dưới thanh tiến độ trong sheet; `null` = không có. */
export function progressHint(
  rule: UnlockRule,
  progress: UnlockProgress,
  deps: UnlockTextDeps,
): string | null {
  const { t, fmt } = deps;
  switch (rule.kind) {
    case "all":
      return rule.rules.some((r) => r.kind === "party-category-avg") ? t("pets.hint.groups") : null;
    case "party-matches":
      return t("pets.hint.partyMatches");
    case "party-wins":
      return t("pets.hint.partyWins");
    case "practice-best":
      return t("pets.hint.practiceBest", { level: t(`difficulty.${rule.minDifficulty}`) });
    case "practice-category-avg":
      return t("pets.hint.practiceCategory", {
        current: fmt(progress.count?.current ?? 0),
        target: fmt(progress.count?.target ?? rule.minGames),
        category: t(`category.${rule.category}`),
      });
    case "party-category-avg":
      return null;
    case "brain-score":
      return t("pets.hint.brainScore", { current: fmt(progress.current) });
  }
}

/** Một dòng trong danh sách điều kiện con của luật `all` (chấm màu nhóm + tên + dấu đạt / số). */
export interface PartLine {
  /** Nhóm của điều kiện "trung bình nhóm" (để tô chấm màu); không có với điều kiện khác. */
  category?: Category;
  label: string;
  /** "✓" khi đạt, không thì số hiện tại ("1.320", "4/10 trận"). */
  mark: string;
  done: boolean;
}

/** Các điều kiện con của luật `all` theo thứ tự khai báo. Luật đơn → mảng rỗng. */
export function partLines(
  rule: UnlockRule,
  progress: UnlockProgress,
  deps: UnlockTextDeps,
): PartLine[] {
  if (rule.kind !== "all" || !progress.parts) return [];
  const { t, fmt } = deps;
  return rule.rules.map((leaf, i): PartLine => {
    const p = progress.parts?.[i] ?? { unlocked: false, current: 0, target: 1 };
    const done = p.unlocked;
    const check = t("pets.part.done");
    if (leaf.kind === "party-category-avg") {
      // Chưa đủ số trận của nhóm thì hiện số trận, đủ rồi thì hiện trung bình hiện tại.
      const count = p.count;
      const mark = done
        ? check
        : count && count.current < count.target
          ? t("pets.short.matches", { current: fmt(count.current), target: fmt(count.target) })
          : fmt(p.current);
      return { category: leaf.category, label: t(`category.${leaf.category}`), mark, done };
    }
    return {
      ...(leaf.kind === "practice-category-avg" ? { category: leaf.category } : {}),
      label: partLabel(leaf, deps),
      mark: done ? check : progressLabel(leaf, p, deps),
      done,
    };
  });
}

/** Tên ngắn của một điều kiện con (không phải "trung bình nhóm trong party"). */
function partLabel(leaf: LeafUnlockRule, deps: UnlockTextDeps): string {
  const { t } = deps;
  switch (leaf.kind) {
    case "party-matches":
      return t("pets.part.partyMatches");
    case "party-wins":
      return t("pets.part.partyWins");
    case "brain-score":
      return t("pets.part.brainScore");
    case "practice-best":
      return deps.gameTitle(leaf.game);
    case "practice-category-avg":
    case "party-category-avg":
      return t(`category.${leaf.category}`);
  }
}

/** Nút đi tới đúng màn để tiến gần điều kiện (URL CR-022). */
export type PetGoal =
  | { kind: "practice"; gameId?: GameId; category?: Category; minDifficulty: Difficulty }
  | { kind: "party" }
  | { kind: "brain" };

function leafGoal(rule: LeafUnlockRule): PetGoal {
  switch (rule.kind) {
    case "practice-best":
      return { kind: "practice", gameId: rule.game, minDifficulty: rule.minDifficulty };
    case "practice-category-avg":
      return { kind: "practice", category: rule.category, minDifficulty: rule.minDifficulty };
    case "brain-score":
      return { kind: "brain" };
    case "party-matches":
    case "party-wins":
    case "party-category-avg":
      return { kind: "party" };
  }
}

/** Luật `all`: có điều kiện party thì "Chơi party", không thì theo điều kiện đầu tiên. */
export function petGoal(rule: UnlockRule): PetGoal {
  if (rule.kind !== "all") return leafGoal(rule);
  const goals = rule.rules.map(leafGoal);
  return goals.find((g) => g.kind === "party") ?? goals[0] ?? { kind: "party" };
}
