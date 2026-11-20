import {
  CATEGORIES,
  emptyUnlockStats,
  evaluateUnlock,
  type GameId,
  type LeafUnlockRule,
  PET_CHARACTER_IDS,
  UNLOCK_RULES,
  type UnlockRule,
  type UnlockStats,
} from "@brain-rizz/shared";
import { createInstance } from "i18next";
import { beforeAll, describe, expect, it } from "vitest";
import { en } from "@/i18n/locales/en";
import { vi } from "@/i18n/locales/vi";
import {
  partLines,
  petGoal,
  progressHint,
  progressLabel,
  ruleCondition,
  ruleSentence,
  type UnlockTextDeps,
} from "./unlock-text";

/**
 * Chữ điều kiện mở khoá bạn đồng hành (CR-024, ui-ux 6.12) qua i18next thật, cả tiếng Việt và
 * tiếng Anh: đủ mọi loại luật, số theo ngôn ngữ, gộp "cả 5 nhóm", nhãn tiến độ, gợi ý, nút đi tới.
 */

const TITLES: Record<string, { vi: string; en: string }> = {
  "number-balloons": { vi: "Bóng bay số", en: "Number Balloons" },
};

let viDeps: UnlockTextDeps;
let enDeps: UnlockTextDeps;

beforeAll(async () => {
  const make = async (lng: "vi" | "en"): Promise<UnlockTextDeps> => {
    const i18n = createInstance();
    await i18n.init({
      lng,
      resources: { en: { common: en }, vi: { common: vi } },
      defaultNS: "common",
      interpolation: { escapeValue: false },
    });
    const nf = new Intl.NumberFormat(lng);
    const lf = new Intl.ListFormat(lng, { type: "conjunction" });
    return {
      t: i18n.t,
      fmt: (n) => nf.format(n),
      gameTitle: (id: GameId) => TITLES[id]?.[lng] ?? id,
      list: (items) => lf.format(items),
    };
  };
  viDeps = await make("vi");
  enDeps = await make("en");
});

const balloons: LeafUnlockRule = {
  kind: "practice-best",
  game: "number-balloons",
  minDifficulty: 1,
  target: 2_200,
};
const analyzeAvg: LeafUnlockRule = {
  kind: "practice-category-avg",
  category: "analyze",
  minDifficulty: 0,
  minGames: 3,
  target: 2_500,
};
const lua: UnlockRule = {
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
};

describe("câu điều kiện đủ (ruleSentence)", () => {
  it("chơi xong N trận / về nhất N trận (số nhiều tiếng Anh)", () => {
    expect(ruleSentence({ kind: "party-matches", target: 10 }, viDeps)).toBe(
      "Chơi xong 10 trận party.",
    );
    expect(ruleSentence({ kind: "party-matches", target: 10 }, enDeps)).toBe(
      "Finish 10 party matches.",
    );
    expect(ruleSentence({ kind: "party-matches", target: 1 }, enDeps)).toBe(
      "Finish 1 party match.",
    );
    expect(ruleSentence({ kind: "party-wins", target: 5 }, viDeps)).toBe("Về nhất 5 trận party.");
    expect(ruleSentence({ kind: "party-wins", target: 5 }, enDeps)).toBe("Win 5 party matches.");
  });

  it("kỷ lục một game: tên game + mức tối thiểu, số theo ngôn ngữ", () => {
    expect(ruleSentence(balloons, viDeps)).toBe(
      "Kỷ lục Luyện tập Bóng bay số từ 2.200 điểm ở mức Thường trở lên.",
    );
    expect(ruleSentence(balloons, enDeps)).toBe(
      "Reach a Practice best of 2,200 in Number Balloons on Normal or harder.",
    );
    expect(ruleSentence({ ...balloons, minDifficulty: 0 }, viDeps)).toBe(
      "Kỷ lục Luyện tập Bóng bay số từ 2.200 điểm.",
    );
  });

  it("trung bình kỷ lục cao nhất của nhóm (tính cả mức Mầm / từ mức nào)", () => {
    expect(ruleSentence(analyzeAvg, viDeps)).toBe(
      "Trung bình 3 kỷ lục Luyện tập cao nhất nhóm Phân tích từ 2.500 điểm (cần kỷ lục ở ít nhất 3 game của nhóm, tính cả mức Mầm).",
    );
    expect(ruleSentence({ ...analyzeAvg, minDifficulty: 2 }, viDeps)).toContain(
      "từ mức Khó trở lên",
    );
    expect(ruleSentence(analyzeAvg, enDeps)).toBe(
      "Average 2,500 over your top 3 Practice bests in Analyze (needs bests in at least 3 games of the group, Sprout counts too).",
    );
  });

  it("trung bình nhóm trong party (một nhóm) và Điểm Não", () => {
    expect(
      ruleSentence(
        { kind: "party-category-avg", category: "compute", minMatches: 10, target: 1_600 },
        viDeps,
      ),
    ).toBe("Trung bình điểm nhóm Tính toán mỗi trận party từ 1.600 (ít nhất 10 trận).");
    expect(ruleSentence({ kind: "brain-score", target: 530 }, viDeps)).toBe(
      "Điểm Não từ 530 trong một lượt Kiểm tra não.",
    );
    expect(ruleSentence({ kind: "brain-score", target: 530 }, enDeps)).toBe(
      "Score 530 or more in one Brain Test.",
    );
  });

  it("luật nhiều điều kiện: gộp 5 nhóm cùng mốc thành 'cả 5 nhóm', nối bằng 'và'", () => {
    expect(ruleSentence(lua, viDeps)).toBe(
      "Chơi xong 120 trận party và trung bình điểm mỗi trận party từ 1.600 ở cả 5 nhóm (mỗi nhóm ít nhất 10 trận).",
    );
    expect(ruleSentence(lua, enDeps)).toBe(
      "Finish 120 party matches and average 1,600 points per party match in all 5 groups (at least 10 matches each).",
    );
    // Chỉ vài nhóm → liệt kê tên nhóm; điều kiện lẻ giữ nguyên.
    const some: UnlockRule = {
      kind: "all",
      rules: [
        { kind: "party-category-avg", category: "analyze", minMatches: 3, target: 1_000 },
        { kind: "brain-score", target: 400 },
        { kind: "party-category-avg", category: "compute", minMatches: 3, target: 1_000 },
      ],
    };
    expect(ruleCondition(some, viDeps)).toBe(
      "Trung bình điểm mỗi trận party từ 1.000 ở Phân tích và Tính toán (mỗi nhóm ít nhất 3 trận) và Điểm Não từ 400 trong một lượt Kiểm tra não",
    );
  });

  it("luật thật của 6 thú: đủ chữ, có số mốc, không sót biến chưa thay", () => {
    for (const pet of PET_CHARACTER_IDS) {
      for (const deps of [viDeps, enDeps]) {
        const text = ruleSentence(UNLOCK_RULES[pet], deps);
        expect(text).not.toMatch(/\{\{|\}\}|pets\./);
        expect(text.endsWith(".")).toBe(true);
        const rule = UNLOCK_RULES[pet];
        const first = rule.kind === "all" ? rule.rules[0] : rule;
        expect(text).toContain(deps.fmt(first?.target ?? 0));
      }
    }
  });
});

describe("nhãn tiến độ, gợi ý, điều kiện con", () => {
  const stats = (patch: Partial<UnlockStats>): UnlockStats => ({ ...emptyUnlockStats(), ...patch });
  const label = (rule: UnlockRule, s: UnlockStats, deps = viDeps) =>
    progressLabel(rule, evaluateUnlock(rule, s), deps);

  it("mỗi loại luật một nhãn ngắn", () => {
    expect(label({ kind: "party-matches", target: 10 }, stats({ partyMatches: 3 }))).toBe(
      "3/10 trận",
    );
    expect(label({ kind: "party-wins", target: 5 }, stats({ partyWins: 1 }))).toBe("Nhất 1/5 trận");
    expect(label({ kind: "party-wins", target: 5 }, stats({ partyWins: 1 }), enDeps)).toBe(
      "1/5 wins",
    );
    const best = stats({ practiceBest: { "number-balloons": { 1: 1_560, 0: 3_000 } } });
    // Mức Mầm không tính cho luật "từ Thường".
    expect(label(balloons, best)).toBe("1.560/2.200");
    expect(label({ kind: "brain-score", target: 530 }, stats({ brainBest: 471 }))).toBe("471/530");
    expect(label(lua, stats({ partyMatches: 37 }))).toBe("Đạt 0/6 mục");
  });

  it("trung bình nhóm: chưa đủ số game thì nhãn là số game, đủ rồi là điểm", () => {
    const two = stats({ practiceBest: { "cube-count": { 0: 2_000 }, "rule-gate": { 1: 2_400 } } });
    expect(label(analyzeAvg, two)).toBe("2/3 game");
    expect(label(analyzeAvg, two, enDeps)).toBe("2/3 games");
    expect(progressHint(analyzeAvg, evaluateUnlock(analyzeAvg, two), viDeps)).toBe(
      "Đã có kỷ lục ở 2/3 game nhóm Phân tích.",
    );
  });

  it("Lửa: từng nhóm hiện ✓ / số trận còn thiếu / trung bình hiện tại", () => {
    const s = stats({
      partyMatches: 37,
      partyCategory: {
        identify: { sum: 20_000, matches: 11 },
        memorize: { sum: 13_200, matches: 10 },
        visualize: { sum: 4_000, matches: 2 },
      },
    });
    const progress = evaluateUnlock(lua, s);
    const lines = partLines(lua, progress, viDeps);
    expect(lines.map((l) => [l.label, l.mark, l.done])).toEqual([
      ["Trận party", "37/120 trận", false],
      ["Nhận diện", "✓", true],
      ["Ghi nhớ", "1.320", false],
      ["Phân tích", "0/10 trận", false],
      ["Tính toán", "0/10 trận", false],
      ["Hình dung", "2/10 trận", false],
    ]);
    expect(lines[1]?.category).toBe("identify");
    expect(lines[0]?.category).toBeUndefined();
    expect(label(lua, s)).toBe("Đạt 1/6 mục");
    expect(progressHint(lua, progress, viDeps)).toContain("✓");
    // Luật đơn không có điều kiện con.
    expect(partLines(balloons, evaluateUnlock(balloons, s), viDeps)).toEqual([]);
  });

  it("gợi ý theo loại luật", () => {
    const p = evaluateUnlock({ kind: "party-wins", target: 5 }, emptyUnlockStats());
    expect(progressHint({ kind: "party-wins", target: 5 }, p, viDeps)).toBe(
      "Trận chỉ có bạn với máy cũng tính.",
    );
    expect(progressHint(balloons, evaluateUnlock(balloons, emptyUnlockStats()), viDeps)).toBe(
      "Chọn mức Thường trở lên khi luyện.",
    );
    expect(
      progressHint(
        { kind: "brain-score", target: 530 },
        evaluateUnlock({ kind: "brain-score", target: 530 }, stats({ brainBest: 488 })),
        enDeps,
      ),
    ).toBe("Your best Brain Score: 488.");
  });
});

describe("nút đi tới (petGoal)", () => {
  it("party → menu, luyện tập → đúng game / nhóm kèm mức, Điểm Não → Kiểm tra não", () => {
    expect(petGoal({ kind: "party-matches", target: 10 })).toEqual({ kind: "party" });
    expect(petGoal({ kind: "party-wins", target: 5 })).toEqual({ kind: "party" });
    expect(petGoal(balloons)).toEqual({
      kind: "practice",
      gameId: "number-balloons",
      minDifficulty: 1,
    });
    expect(petGoal(analyzeAvg)).toEqual({
      kind: "practice",
      category: "analyze",
      minDifficulty: 0,
    });
    expect(petGoal({ kind: "brain-score", target: 530 })).toEqual({ kind: "brain" });
    expect(petGoal(lua)).toEqual({ kind: "party" });
    expect(petGoal({ kind: "all", rules: [{ kind: "brain-score", target: 1 }, balloons] })).toEqual(
      { kind: "brain" },
    );
  });
});
