import { describe, expect, it } from "vitest";
import {
  BRAIN_SCORE_MAX,
  BRAIN_SKILL_MAX,
  BRAIN_SKILL_REFERENCE,
  BRAIN_TEST_DIFFICULTY,
  BRAIN_TEST_DURATION_MS_BY_CATEGORY,
  BRAIN_TEST_ESTIMATED_TOTAL_MS,
  BRAIN_TEST_GAME_COUNT,
  BRAIN_TEST_PLAY_MS,
  BRAIN_TEST_REFERENCE_SCORE,
  type BrainGameResult,
  brainTestDurationMs,
  computeBrainResult,
  pickBrainTestGames,
  skillScore,
} from "./brain-test";
import { isDifficulty } from "./difficulty";
import { GAME_IDS, type GameId, getGame } from "./games";
import { CATEGORIES } from "./games/types";

const SEEDS = 10_000;
const seedAt = (i: number) => (Math.imul(i + 1, 0x9e3779b1) ^ 0x5bd1e995) >>> 0;
const byCategory = (category: string) => GAME_IDS.filter((id) => getGame(id).category === category);

describe("hằng số Kiểm tra não", () => {
  it("5 game, độ khó cố định hợp lệ", () => {
    expect(BRAIN_TEST_GAME_COUNT).toBe(CATEGORIES.length);
    expect(isDifficulty(BRAIN_TEST_DIFFICULTY)).toBe(true);
  });

  it("mỗi nhóm có ít nhất một game đã đăng ký", () => {
    for (const c of CATEGORIES) expect(byCategory(c).length).toBeGreaterThan(0);
  });

  it("mọi game đã đăng ký đều có điểm chuẩn dương hữu hạn", () => {
    for (const id of GAME_IDS) {
      const ref = BRAIN_TEST_REFERENCE_SCORE[id];
      expect(Number.isFinite(ref) && ref > 0, `thiếu điểm chuẩn cho ${id}`).toBe(true);
    }
    // Không khai báo dư game đã gỡ.
    expect(Object.keys(BRAIN_TEST_REFERENCE_SCORE).sort()).toEqual([...GAME_IDS].sort());
  });

  it("thời lượng: không dài hơn vòng party, tổng một lượt 4–5 phút", () => {
    for (const id of GAME_IDS) {
      const ms = brainTestDurationMs(id);
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(getGame(id).durationMs);
      expect(ms).toBeLessThanOrEqual(BRAIN_TEST_DURATION_MS_BY_CATEGORY[getGame(id).category]);
    }
    expect(BRAIN_TEST_PLAY_MS).toBe(
      CATEGORIES.reduce((s, c) => s + BRAIN_TEST_DURATION_MS_BY_CATEGORY[c], 0),
    );
    expect(BRAIN_TEST_ESTIMATED_TOTAL_MS).toBeGreaterThanOrEqual(4 * 60_000);
    expect(BRAIN_TEST_ESTIMATED_TOTAL_MS).toBeLessThanOrEqual(5 * 60_000);
  });
});

describe("pickBrainTestGames", { timeout: 60_000 }, () => {
  it(`${SEEDS} seed: tất định, đủ 5 game, đúng thứ tự nhóm, mọi game đều được chọn`, () => {
    const counts = new Map<GameId, number>();
    for (let i = 0; i < SEEDS; i++) {
      const seed = seedAt(i);
      const picked = pickBrainTestGames(seed);
      expect(pickBrainTestGames(seed)).toEqual(picked);
      expect(picked.map((id) => getGame(id).category)).toEqual([...CATEGORIES]);
      for (const id of picked) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    // Mỗi game được chọn xấp xỉ đều trong nhóm của nó (±20 % so với kỳ vọng).
    for (const c of CATEGORIES) {
      const ids = byCategory(c);
      const expected = SEEDS / ids.length;
      for (const id of ids) {
        const n = counts.get(id) ?? 0;
        expect(n, `${id} được chọn ${n} lần`).toBeGreaterThan(expected * 0.8);
        expect(n).toBeLessThan(expected * 1.2);
      }
    }
  });

  it("chỉ bốc trong `available`; thứ tự và id trùng không ảnh hưởng", () => {
    const available: GameId[] = ["odd-one-out", "pair-flip", "balance", "cash-count", "top-view"];
    const shuffled: GameId[] = [
      "top-view",
      "cash-count",
      "balance",
      "pair-flip",
      "odd-one-out",
      "balance",
    ];
    for (let i = 0; i < 1000; i++) {
      const seed = seedAt(i);
      expect(pickBrainTestGames(seed, available)).toEqual(available);
      expect(pickBrainTestGames(seed, shuffled)).toEqual(available);
    }
  });

  it("nhóm thiếu trong `available` → bốc từ mọi game của nhóm đó, vẫn đủ 5 game", () => {
    const available: GameId[] = ["light-trail"];
    const seen = new Set<GameId>();
    for (let i = 0; i < SEEDS; i++) {
      const seed = seedAt(i);
      const picked = pickBrainTestGames(seed, available);
      expect(picked).toHaveLength(BRAIN_TEST_GAME_COUNT);
      expect(picked.map((id) => getGame(id).category)).toEqual([...CATEGORIES]);
      expect(picked[1]).toBe("light-trail");
      // Nhóm thiếu được bốc giống hệt khi không giới hạn: đổi một nhóm không làm đổi nhóm khác.
      const full = pickBrainTestGames(seed);
      expect([picked[0], ...picked.slice(2)]).toEqual([full[0], ...full.slice(2)]);
      for (const id of picked) seen.add(id);
    }
    for (const c of CATEGORIES.filter((c) => c !== "memorize")) {
      for (const id of byCategory(c)) expect(seen.has(id)).toBe(true);
    }
  });

  it("`available` rỗng hoặc toàn id lạ → như mặc định", () => {
    for (let i = 0; i < 200; i++) {
      const seed = seedAt(i);
      expect(pickBrainTestGames(seed, [])).toEqual(pickBrainTestGames(seed));
      expect(pickBrainTestGames(seed, ["khong-co" as GameId])).toEqual(pickBrainTestGames(seed));
    }
  });
});

describe("skillScore", { timeout: 60_000 }, () => {
  it("đạt điểm chuẩn = 100, gấp đôi = 150, nửa = 50", () => {
    for (const id of GAME_IDS) {
      const ref = BRAIN_TEST_REFERENCE_SCORE[id];
      expect(skillScore(id, ref)).toBe(BRAIN_SKILL_REFERENCE);
      expect(skillScore(id, ref * 2)).toBe(150);
      expect(skillScore(id, ref / 2)).toBe(50);
    }
  });

  it("không âm, không vượt trần, đơn điệu tăng", () => {
    for (const id of GAME_IDS) {
      let prev = -1;
      const bad: number[] = [];
      for (let score = 0; score <= 60_000; score += 7) {
        const s = skillScore(id, score);
        const ok = Number.isInteger(s) && s >= 0 && s <= BRAIN_SKILL_MAX && s >= prev;
        if (!ok) bad.push(score);
        prev = s;
      }
      expect(bad, `${id}: lỗi ở các điểm ${bad.slice(0, 5).join(", ")}`).toEqual([]);
    }
  });

  it("điểm lạ coi như 0; điểm cực lớn chạm trần", () => {
    for (const bad of [-1, -500, Number.NaN, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]) {
      expect(skillScore("balance", bad)).toBe(0);
    }
    expect(skillScore("balance", 0)).toBe(0);
    expect(skillScore("balance", 1e9)).toBe(BRAIN_SKILL_MAX);
  });
});

describe("computeBrainResult", { timeout: 60_000 }, () => {
  const atRef = (ids: readonly GameId[], k = 1): BrainGameResult[] =>
    ids.map((gameId) => ({ gameId, score: BRAIN_TEST_REFERENCE_SCORE[gameId] * k, correct: 5 }));

  it("không có game → mọi kỹ năng 0, Điểm Não 0", () => {
    const r = computeBrainResult([]);
    expect(r.brainScore).toBe(0);
    for (const c of CATEGORIES) expect(r.skills[c]).toBe(0);
  });

  it("5 game đạt điểm chuẩn → 5 × 100 = 500", () => {
    const r = computeBrainResult(atRef(pickBrainTestGames(1)));
    expect(r.brainScore).toBe(5 * BRAIN_SKILL_REFERENCE);
    for (const c of CATEGORIES) expect(r.skills[c]).toBe(BRAIN_SKILL_REFERENCE);
  });

  it("điểm cực lớn → trần 1 000", () => {
    const r = computeBrainResult(atRef(pickBrainTestGames(2), 1e6));
    expect(r.brainScore).toBe(BRAIN_SCORE_MAX);
    expect(BRAIN_SCORE_MAX).toBe(1000);
  });

  it("thiếu nhóm → kỹ năng đó 0; Điểm Não = tổng kỹ năng", () => {
    const picked = pickBrainTestGames(3);
    const r = computeBrainResult(atRef(picked.slice(0, 3)));
    expect(r.skills.compute).toBe(0);
    expect(r.skills.visualize).toBe(0);
    expect(r.brainScore).toBe(300);
    for (let i = 0; i < 2000; i++) {
      const games = pickBrainTestGames(seedAt(i)).map((gameId, j) => ({
        gameId,
        score: ((i * 37 + j * 911) % 4000) - 200,
        correct: 0,
      }));
      const res = computeBrainResult(games);
      expect(res.brainScore).toBe(CATEGORIES.reduce((s, c) => s + res.skills[c], 0));
      expect(res.brainScore).toBeGreaterThanOrEqual(0);
      expect(res.brainScore).toBeLessThanOrEqual(BRAIN_SCORE_MAX);
    }
  });

  it("game dễ ăn điểm không lấn át: cùng tỉ lệ so với chuẩn → cùng điểm kỹ năng", () => {
    const easy = skillScore("odd-one-out", BRAIN_TEST_REFERENCE_SCORE["odd-one-out"] * 1.3);
    const hard = skillScore("light-trail", BRAIN_TEST_REFERENCE_SCORE["light-trail"] * 1.3);
    expect(easy).toBe(hard);
  });

  it("id lạ bị bỏ qua; một nhóm có nhiều kết quả thì lấy cao nhất", () => {
    const r = computeBrainResult([
      { gameId: "khong-co" as GameId, score: 99_999, correct: 1 },
      { gameId: "light-trail", score: BRAIN_TEST_REFERENCE_SCORE["light-trail"] / 2, correct: 1 },
      { gameId: "pair-flip", score: BRAIN_TEST_REFERENCE_SCORE["pair-flip"], correct: 1 },
    ]);
    expect(r.skills.memorize).toBe(100);
    expect(r.brainScore).toBe(100);
  });
});
