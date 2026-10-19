import { CATEGORIES, type Category } from "@brain-rizz/shared";

/** Phần cần dùng của một dòng `match_results` (xem `MatchRow` trong net/data-api.ts). */
export interface MatchCategoryData {
  categoryScores: Partial<Record<Category, number>>;
  categoryTitles: readonly Category[];
}

export interface CategoryStrength {
  category: Category;
  /** Số trận giành danh hiệu "giỏi nhất" thể loại này. */
  titles: number;
  /** Số trận có chơi thể loại này. */
  matches: number;
  /** Điểm vòng trung bình mỗi trận có chơi (làm tròn); 0 khi chưa chơi. */
  avg: number;
}

export interface PartyStrengths {
  /** Đủ 5 thể loại, thứ tự `CATEGORIES` (chưa chơi thì `matches` = 0). */
  rows: CategoryStrength[];
  /** Thể loại "Mạnh nhất"; `null` khi chưa có dữ liệu. */
  top: Category | null;
  /** Có ít nhất một trận mang điểm theo thể loại (trận cũ trước CR-010 là `{}`). */
  hasData: boolean;
}

/**
 * Thế mạnh trong trận party (CR-010, ui-ux 6.4) — hàm thuần, có test.
 * Danh hiệu = số trận có thể loại trong `categoryTitles`; TB = trung bình `categoryScores[c]`
 * trên các trận có khoá `c` (đã chơi). "Mạnh nhất": nhiều danh hiệu nhất, hoà thì TB cao hơn;
 * chưa có danh hiệu nào thì TB cao nhất.
 */
export function partyStrengths(matches: readonly MatchCategoryData[]): PartyStrengths {
  const rows = CATEGORIES.map((category): CategoryStrength => {
    let titles = 0;
    let played = 0;
    let sum = 0;
    for (const m of matches) {
      if (m.categoryTitles.includes(category)) titles += 1;
      const score = m.categoryScores[category];
      if (score !== undefined) {
        played += 1;
        sum += score;
      }
    }
    return { category, titles, matches: played, avg: played > 0 ? Math.round(sum / played) : 0 };
  });

  let top: CategoryStrength | null = null;
  for (const row of rows) {
    if (row.matches === 0) continue;
    if (!top || row.titles > top.titles || (row.titles === top.titles && row.avg > top.avg)) {
      top = row;
    }
  }
  return {
    rows,
    top: top?.category ?? null,
    hasData: rows.some((r) => r.matches > 0),
  };
}
