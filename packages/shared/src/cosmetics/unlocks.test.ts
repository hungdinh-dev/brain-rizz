import { describe, expect, it } from "vitest";
import { CHARACTER_IDS, isCharacterId } from "../constants";
import { DIFFICULTIES } from "../difficulty";
import { GAME_IDS, getGame, isGameId } from "../games";
import { CATEGORIES } from "../games/types";
import {
  BASE_CHARACTER_IDS,
  emptyUnlockStats,
  evaluateUnlock,
  isBaseCharacterId,
  isCharacterUnlocked,
  isPetId,
  type LeafUnlockRule,
  PET_CHARACTER_IDS,
  type PetId,
  parseUnlockStats,
  petProgress,
  UNLOCK_RULES,
  type UnlockRule,
  type UnlockStats,
  unlockedCharacters,
  unlockRatio,
} from "./unlocks";

const stats = (patch: Partial<UnlockStats> = {}): UnlockStats => ({
  ...emptyUnlockStats(),
  ...patch,
});

const ANALYZE = GAME_IDS.filter((g) => getGame(g).category === "analyze");
const COMPUTE = GAME_IDS.filter((g) => getGame(g).category === "compute");

describe("danh sách nhân vật", () => {
  it("CHARACTER_IDS = 6 nhân vật cũ rồi 6 thú mới, đúng thứ tự", () => {
    expect([...CHARACTER_IDS]).toEqual([...BASE_CHARACTER_IDS, ...PET_CHARACTER_IDS]);
    expect([...BASE_CHARACTER_IDS]).toEqual(["khoi", "bo", "mochi", "bap", "cam", "tron"]);
    expect([...PET_CHARACTER_IDS]).toEqual(["pin", "op", "thong", "gai", "may", "lua"]);
  });

  it("isCharacterId nhận cả 12; isPetId / isBaseCharacterId tách đúng hai nhóm", () => {
    for (const id of CHARACTER_IDS) expect(isCharacterId(id)).toBe(true);
    for (const id of PET_CHARACTER_IDS) {
      expect(isPetId(id)).toBe(true);
      expect(isBaseCharacterId(id)).toBe(false);
    }
    for (const id of BASE_CHARACTER_IDS) {
      expect(isPetId(id)).toBe(false);
      expect(isBaseCharacterId(id)).toBe(true);
    }
    for (const v of ["", "dragon", "constructor", 0, null]) {
      expect(isPetId(v)).toBe(false);
      expect(isBaseCharacterId(v)).toBe(false);
    }
  });
});

describe("UNLOCK_RULES", () => {
  const leaves = (rule: UnlockRule): LeafUnlockRule[] =>
    rule.kind === "all" ? [...rule.rules] : [rule];

  it("mỗi thú một luật, số mục tiêu nguyên dương, game / nhóm tồn tại", () => {
    expect(Object.keys(UNLOCK_RULES).sort()).toEqual([...PET_CHARACTER_IDS].sort());
    for (const pet of PET_CHARACTER_IDS) {
      for (const leaf of leaves(UNLOCK_RULES[pet])) {
        expect(Number.isInteger(leaf.target) && leaf.target > 0).toBe(true);
        if (leaf.kind === "practice-best") expect(isGameId(leaf.game)).toBe(true);
        if (leaf.kind === "practice-category-avg") {
          expect(CATEGORIES).toContain(leaf.category);
          expect(
            GAME_IDS.filter((g) => getGame(g).category === leaf.category).length,
          ).toBeGreaterThanOrEqual(leaf.minGames);
        }
        if (leaf.kind === "party-category-avg") {
          expect(CATEGORIES).toContain(leaf.category);
          expect(leaf.minMatches).toBeGreaterThan(0);
        }
      }
    }
  });

  it("chưa chơi gì: không thú nào mở, mọi tiến độ 0", () => {
    const empty = emptyUnlockStats();
    expect(unlockedCharacters(empty)).toEqual([...BASE_CHARACTER_IDS]);
    for (const pet of PET_CHARACTER_IDS) {
      const p = petProgress(pet, empty);
      expect(p.unlocked).toBe(false);
      expect(p.current).toBe(0);
      expect(unlockRatio(p)).toBe(0);
    }
  });
});

describe("evaluateUnlock — biên từng loại luật", () => {
  it("party-matches / party-wins / brain-score: đúng mục tiêu thì mở, kém 1 thì chưa", () => {
    const cases: [LeafUnlockRule, (n: number) => UnlockStats][] = [
      [{ kind: "party-matches", target: 10 }, (n) => stats({ partyMatches: n })],
      [{ kind: "party-wins", target: 5 }, (n) => stats({ partyWins: n })],
      [{ kind: "brain-score", target: 530 }, (n) => stats({ brainBest: n })],
    ];
    for (const [rule, make] of cases) {
      expect(evaluateUnlock(rule, make(rule.target - 1))).toEqual({
        unlocked: false,
        current: rule.target - 1,
        target: rule.target,
      });
      expect(evaluateUnlock(rule, make(rule.target)).unlocked).toBe(true);
      expect(evaluateUnlock(rule, make(rule.target * 3)).unlocked).toBe(true);
    }
  });

  it("practice-best: chỉ tính độ khó từ minDifficulty trở lên, lấy kỷ lục cao nhất", () => {
    const rule: LeafUnlockRule = {
      kind: "practice-best",
      game: "number-balloons",
      minDifficulty: 1,
      target: 2_200,
    };
    // Mầm không tính dù cao.
    expect(
      evaluateUnlock(rule, stats({ practiceBest: { "number-balloons": { 0: 9_999 } } })),
    ).toEqual({ unlocked: false, current: 0, target: 2_200 });
    expect(
      evaluateUnlock(rule, stats({ practiceBest: { "number-balloons": { 1: 2_199, 0: 9_999 } } }))
        .unlocked,
    ).toBe(false);
    expect(
      evaluateUnlock(rule, stats({ practiceBest: { "number-balloons": { 1: 2_200 } } })).unlocked,
    ).toBe(true);
    const mixed = evaluateUnlock(
      rule,
      stats({ practiceBest: { "number-balloons": { 1: 1_000, 3: 2_500 } } }),
    );
    expect(mixed).toEqual({ unlocked: true, current: 2_500, target: 2_200 });
    // Game khác không tính.
    expect(evaluateUnlock(rule, stats({ practiceBest: { balance: { 1: 9_999 } } })).current).toBe(
      0,
    );
  });

  it("practice-category-avg: trung bình N kỷ lục cao nhất của nhóm, cần đủ N game", () => {
    const rule: LeafUnlockRule = {
      kind: "practice-category-avg",
      category: "analyze",
      minDifficulty: 0,
      minGames: 3,
      target: 2_500,
    };
    const [a, b, c, d] = ANALYZE;
    if (!a || !b || !c || !d) throw new Error("cần ≥ 4 game Phân tích");
    // Hai game rất cao vẫn chưa đủ (thiếu game tính 0, và thiếu số game).
    const two = evaluateUnlock(
      rule,
      stats({ practiceBest: { [a]: { 0: 9_000 }, [b]: { 1: 9_000 } } }),
    );
    expect(two).toEqual({
      unlocked: false,
      current: 6_000,
      target: 2_500,
      count: { current: 2, target: 3 },
    });
    // Đúng biên: (2 500 + 2 500 + 2 500) / 3.
    const exact = { [a]: { 0: 2_500 }, [b]: { 2: 2_500 }, [c]: { 3: 2_500 } };
    expect(evaluateUnlock(rule, stats({ practiceBest: exact })).unlocked).toBe(true);
    // Trung bình làm tròn xuống: 7 499 / 3 = 2 499,67 → 2 499 → chưa.
    const below = { [a]: { 0: 2_500 }, [b]: { 0: 2_500 }, [c]: { 0: 2_499 } };
    expect(evaluateUnlock(rule, stats({ practiceBest: below }))).toMatchObject({
      unlocked: false,
      current: 2_499,
    });
    // Thêm game điểm thấp không kéo trung bình xuống (lấy N game cao nhất).
    const withLow = { ...exact, [d]: { 0: 10 } };
    expect(evaluateUnlock(rule, stats({ practiceBest: withLow }))).toMatchObject({
      unlocked: true,
      current: 2_500,
      count: { current: 4, target: 3 },
    });
    // Game nhóm khác không tính.
    const other = Object.fromEntries(COMPUTE.map((g) => [g, { 1: 9_999 }]));
    expect(evaluateUnlock(rule, stats({ practiceBest: other }))).toMatchObject({
      unlocked: false,
      current: 0,
      count: { current: 0, target: 3 },
    });
    // minDifficulty 1: kỷ lục Mầm không tính.
    const fromNormal: LeafUnlockRule = { ...rule, minDifficulty: 1 };
    expect(evaluateUnlock(fromNormal, stats({ practiceBest: exact }))).toMatchObject({
      unlocked: false,
      count: { current: 2, target: 3 },
    });
  });

  it("party-category-avg: sum / matches (làm tròn xuống), cần đủ số trận", () => {
    const rule: LeafUnlockRule = {
      kind: "party-category-avg",
      category: "memorize",
      minMatches: 10,
      target: 1_600,
    };
    const at = (sum: number, matches: number) =>
      evaluateUnlock(rule, stats({ partyCategory: { memorize: { sum, matches } } }));
    expect(at(16_000, 10)).toEqual({
      unlocked: true,
      current: 1_600,
      target: 1_600,
      count: { current: 10, target: 10 },
    });
    expect(at(15_999, 10)).toMatchObject({ unlocked: false, current: 1_599 });
    expect(at(90_000, 9)).toMatchObject({ unlocked: false, current: 10_000 });
    // Nhóm khác không tính.
    expect(
      evaluateUnlock(rule, stats({ partyCategory: { compute: { sum: 99_999, matches: 50 } } })),
    ).toMatchObject({ unlocked: false, current: 0, count: { current: 0, target: 10 } });
  });

  it("all: mở khi đạt mọi điều kiện; current = số điều kiện đã đạt; parts theo thứ tự", () => {
    const rule: UnlockRule = {
      kind: "all",
      rules: [
        { kind: "party-matches", target: 3 },
        { kind: "party-wins", target: 1 },
        { kind: "brain-score", target: 500 },
      ],
    };
    const p = evaluateUnlock(rule, stats({ partyMatches: 3, partyWins: 0, brainBest: 600 }));
    expect(p.unlocked).toBe(false);
    expect(p.current).toBe(2);
    expect(p.target).toBe(3);
    expect(p.parts?.map((x) => x.unlocked)).toEqual([true, false, true]);
    expect(
      evaluateUnlock(rule, stats({ partyMatches: 3, partyWins: 1, brainBest: 500 })).unlocked,
    ).toBe(true);
    // Danh sách rỗng: không có gì để đạt → mở (không dùng trong UNLOCK_RULES, chỉ để hàm không lỗi).
    expect(evaluateUnlock({ kind: "all", rules: [] }, emptyUnlockStats()).unlocked).toBe(true);
  });
});

describe("unlockRatio", () => {
  it("bằng 1 khi và chỉ khi đã mở; thiếu số lượng thì không đầy", () => {
    const rule: LeafUnlockRule = {
      kind: "party-category-avg",
      category: "compute",
      minMatches: 10,
      target: 1_600,
    };
    const high = evaluateUnlock(
      rule,
      stats({ partyCategory: { compute: { sum: 20_000, matches: 4 } } }),
    );
    expect(high.unlocked).toBe(false);
    expect(unlockRatio(high)).toBeCloseTo(0.4);
    const half = evaluateUnlock({ kind: "party-matches", target: 10 }, stats({ partyMatches: 5 }));
    expect(unlockRatio(half)).toBe(0.5);
    const almost = evaluateUnlock(
      { kind: "party-matches", target: 1_000 },
      stats({ partyMatches: 999 }),
    );
    expect(unlockRatio(almost)).toBeLessThan(1);
    const done = evaluateUnlock({ kind: "party-matches", target: 10 }, stats({ partyMatches: 50 }));
    expect(unlockRatio(done)).toBe(1);
  });

  it("all: trung bình tỉ lệ các phần", () => {
    const p = evaluateUnlock(
      {
        kind: "all",
        rules: [
          { kind: "party-matches", target: 10 },
          { kind: "party-wins", target: 4 },
        ],
      },
      stats({ partyMatches: 10, partyWins: 1 }),
    );
    expect(unlockRatio(p)).toBeCloseTo((1 + 0.25) / 2);
  });
});

describe("luật thật của 6 thú: đạt đúng biên thì mở, thiếu một chút thì chưa", () => {
  /** Số liệu bằng `scale` × mục tiêu của các thú `pets` (tính theo UNLOCK_RULES hiện tại). */
  function exactStats(scale: number, pets: readonly PetId[] = PET_CHARACTER_IDS): UnlockStats {
    const s = emptyUnlockStats();
    const apply = (leaf: LeafUnlockRule) => {
      const t = Math.floor(leaf.target * scale);
      switch (leaf.kind) {
        case "party-matches":
          s.partyMatches = Math.max(s.partyMatches, t);
          break;
        case "party-wins":
          s.partyWins = Math.max(s.partyWins, t);
          break;
        case "brain-score":
          s.brainBest = Math.max(s.brainBest, t);
          break;
        case "practice-best":
          s.practiceBest[leaf.game] = { ...s.practiceBest[leaf.game], [leaf.minDifficulty]: t };
          break;
        case "practice-category-avg":
          for (const g of GAME_IDS.filter((id) => getGame(id).category === leaf.category).slice(
            0,
            leaf.minGames,
          )) {
            s.practiceBest[g] = { ...s.practiceBest[g], [leaf.minDifficulty]: t };
          }
          break;
        case "party-category-avg":
          s.partyCategory[leaf.category] = { sum: t * leaf.minMatches, matches: leaf.minMatches };
          break;
      }
    };
    for (const pet of pets) {
      const rule = UNLOCK_RULES[pet];
      for (const leaf of rule.kind === "all" ? rule.rules : [rule]) apply(leaf);
    }
    return s;
  }

  it("vừa đủ → cả 12 nhân vật", () => {
    const s = exactStats(1);
    for (const pet of PET_CHARACTER_IDS) expect(petProgress(pet, s).unlocked, pet).toBe(true);
    expect(unlockedCharacters(s)).toEqual([...CHARACTER_IDS]);
    for (const id of CHARACTER_IDS) expect(isCharacterUnlocked(id, s)).toBe(true);
  });

  it("từng thú: vừa đủ thì mở, thiếu 0,1 % ở mọi mục của thú đó thì chưa", () => {
    for (const pet of PET_CHARACTER_IDS) {
      expect(petProgress(pet, exactStats(1, [pet])).unlocked, pet).toBe(true);
      const below = exactStats(0.999, [pet]);
      expect(petProgress(pet, below).unlocked, pet).toBe(false);
      expect(isCharacterUnlocked(pet, below), pet).toBe(false);
      expect(isCharacterUnlocked("khoi", below)).toBe(true);
    }
    expect(isCharacterUnlocked("dragon", exactStats(1))).toBe(false);
  });

  it("unlockedCharacters giữ thứ tự CHARACTER_IDS khi chỉ mở một phần", () => {
    const s = stats({ partyMatches: 10, partyWins: 5 });
    expect(unlockedCharacters(s)).toEqual([...BASE_CHARACTER_IDS, "pin", "gai"]);
  });
});

describe("parseUnlockStats", () => {
  const full = {
    party_matches: 12,
    party_wins: 3,
    brain_best: 540,
    practice_best: {
      "number-balloons": { "1": 2_300, "0": 1_500 },
      balance: { "3": 4_000 },
    },
    party_category: {
      identify: { sum: 30_000, matches: 5 },
      compute: { sum: 9_000, matches: 6 },
    },
  };

  it("snake_case → camelCase, độ khó thành số", () => {
    expect(parseUnlockStats(full)).toEqual({
      partyMatches: 12,
      partyWins: 3,
      brainBest: 540,
      practiceBest: { "number-balloons": { 0: 1_500, 1: 2_300 }, balance: { 3: 4_000 } },
      partyCategory: {
        identify: { sum: 30_000, matches: 5 },
        compute: { sum: 9_000, matches: 6 },
      },
    });
  });

  it("nhận chuỗi JSON; chuỗi hỏng / kiểu lạ → số liệu rỗng, không ném", () => {
    expect(parseUnlockStats(JSON.stringify(full))).toEqual(parseUnlockStats(full));
    for (const v of [undefined, null, 0, true, "", "{", "[]", [], [full], () => full]) {
      expect(parseUnlockStats(v)).toEqual(emptyUnlockStats());
    }
  });

  it("số thiếu / âm / NaN / sai kiểu → 0; số thực làm tròn xuống; chuỗi chữ số được nhận; số quá lớn bị kẹp", () => {
    expect(
      parseUnlockStats({
        party_matches: -4,
        party_wins: "7",
        brain_best: 512.9,
        extra: 1,
      }),
    ).toMatchObject({ partyMatches: 0, partyWins: 7, brainBest: 512 });
    expect(
      parseUnlockStats({ party_matches: Number.NaN, party_wins: "abc", brain_best: null }),
    ).toMatchObject({ partyMatches: 0, partyWins: 0, brainBest: 0 });
    expect(parseUnlockStats({ party_matches: 1e15 }).partyMatches).toBe(2_147_483_647);
    expect(parseUnlockStats({ party_matches: "-3" }).partyMatches).toBe(0);
  });

  it("game, độ khó, nhóm lạ bị bỏ; kỷ lục 0 và nhóm 0 trận bị bỏ", () => {
    const parsed = parseUnlockStats({
      practice_best: {
        "no-such-game": { "1": 9_000 },
        balance: { "4": 9_000, "-1": 9_000, "1.5": 9_000, x: 9_000, "2": 0, "1": 100 },
        "cube-count": { "1": -5 },
        "marble-drop": "9000",
      },
      party_category: {
        cooking: { sum: 1, matches: 1 },
        memorize: { sum: 500 },
        analyze: { sum: 500, matches: 0 },
        visualize: { matches: 2 },
        compute: "x",
      },
    });
    expect(parsed.practiceBest).toEqual({ balance: { 1: 100 } });
    expect(parsed.partyCategory).toEqual({ visualize: { sum: 0, matches: 2 } });
  });

  it("chỉ đọc khoá snake_case của chính object (không đọc camelCase, không qua prototype)", () => {
    expect(parseUnlockStats({ partyMatches: 99, brainBest: 999 })).toEqual(emptyUnlockStats());
    const polluted = JSON.parse('{"__proto__": {"party_matches": 50}, "party_wins": 1}');
    const parsed = parseUnlockStats(polluted);
    expect(parsed.partyMatches).toBe(0);
    expect(parsed.partyWins).toBe(1);
    const inherited = Object.create({ party_matches: 50 });
    expect(parseUnlockStats(inherited).partyMatches).toBe(0);
  });

  it("mọi độ khó hợp lệ đọc được; trả object mới mỗi lần", () => {
    const raw = {
      practice_best: { balance: Object.fromEntries(DIFFICULTIES.map((d) => [String(d), d + 1])) },
    };
    expect(parseUnlockStats(raw).practiceBest.balance).toEqual({ 0: 1, 1: 2, 2: 3, 3: 4 });
    const a = parseUnlockStats(full);
    const b = parseUnlockStats(full);
    expect(a).not.toBe(b);
    a.partyMatches = 999;
    expect(parseUnlockStats(full).partyMatches).toBe(12);
  });
});
