import { describe, expect, it } from "vitest";
import { QuestionInfoCache, type SimPlayer, simulateRound } from "../bots/simulate";
import { brainTestDurationMs, computeBrainResult, pickBrainTestGames } from "../brain-test";
import { GAME_IDS, type GameId, getGame } from "../games";
import { CATEGORIES, type Category } from "../games/types";
import { rankByMatch, rankByRound } from "../match";
import { createRng, type Rng } from "../rng";
import { placementPoints } from "../scoring";
import { COSMETIC_ITEMS, type Rarity } from "./catalog";
import {
  brainChalkReward,
  CHALK_DAILY_CAPS,
  capChalkGrant,
  DAILY_BONUS,
  DUPLICATE_REFUND,
  type EarnSource,
  GACHA_PRICE_SINGLE,
  GACHA_PRICE_TEN,
  GACHA_TEN_COUNT,
  type GachaPityState,
  INITIAL_PITY_STATE,
  PRACTICE_CHALK,
  partyChalkReward,
  pickGachaItem,
  rollGachaBatch,
} from "./economy";
import {
  emptyUnlockStats,
  PET_CHARACTER_IDS,
  type PetId,
  petProgress,
  UNLOCK_RULES,
  type UnlockStats,
} from "./unlocks";

/**
 * Mô phỏng kinh tế phấn và mở khoá thú (kế hoạch gacha-pets-unlocks.md mục 3.2 và 4).
 *
 * Người chơi mô hình hoá bằng lõi bot "basic" (`bots/simulate.ts`), chấm bằng chính hàm điểm của
 * server: người lớn điển hình = người chơi chuẩn của mô phỏng bot (Thường, thời gian `T`, tỉ lệ
 * đúng chuẩn của game); trẻ em = trẻ 7 tuổi chơi Mầm đúng sức. Để chạy nhanh, điểm một vòng lấy mẫu
 * từ kho điểm dựng sẵn cho từng game (`POOL_SIZE` vòng mỗi game, mỗi kiểu người).
 *
 * Bốn kiểu người chơi (`ARCHETYPES`), mỗi kiểu `PLAYERS` người, chơi `DAYS` ngày; mỗi ngày nhận quà
 * ngày, chơi trận party 3 vòng (phòng 4 ghế), Kiểm tra não, luyện tập theo kiểu; phấn qua đúng
 * `partyChalkReward` / `brainChalkReward` / `capChalkGrant`; ví tiêu hết bằng gói 10 lần ngay khi đủ
 * (`rollGachaBatch` + `pickGachaItem`: bốc đều trong độ hiếm, Huyền thoại không trùng tới khi đủ
 * bộ, trùng đổi phấn). Luyện tập nhắm vào thú còn khoá (nút
 * Luyện ngay): xen kẽ Bóng bay số (`op`) và lần lượt các game Phân tích (`thong`).
 *
 * In bảng số liệu: đặt biến môi trường `BRAIN_RIZZ_ECONOMY_SIM=1` rồi chạy
 * `pnpm --filter @brain-rizz/shared exec vitest run src/cosmetics/economy-sim.test.ts`.
 * Test chỉ kiểm các khoảng mục tiêu; không đạt thì CHỈ chỉnh số ở `economy.ts` / `UNLOCK_RULES`,
 * rồi cập nhật bảng mục 3.2 + 4 của kế hoạch và mục Kinh tế của GDD.
 */

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const PRINT = env?.BRAIN_RIZZ_ECONOMY_SIM === "1";
/** `console.log` (gói shared không nạp kiểu của Node / DOM). */
const log = (msg: string) =>
  (globalThis as unknown as { console: { log(msg: string): void } }).console.log(msg);

const POOL_SIZE = 60;
const BRAIN_POOL_SIZE = 400;
const PLAYERS = 200;
const DAYS = 120;
const ROUNDS_PER_MATCH = 3;
const SEATS = 4;

type ModelId = "adult" | "child" | "botEasy";
const MODELS: Record<ModelId, Omit<SimPlayer, "id">> = {
  /** Người lớn điển hình = người chơi chuẩn = bot Vừa. */
  adult: { difficulty: 1, timeFactor: 1, accuracy: 0.9 },
  /** Trẻ 7 tuổi chơi Mầm đúng sức. */
  child: { difficulty: 0, timeFactor: 1, accuracy: 0.9 },
  /** Bot Dễ (`BOT_LEVEL_SPECS[0]`). */
  botEasy: { difficulty: 0, timeFactor: 1.2, accuracy: 0.78 },
};

const cache = new QuestionInfoCache();
const seedOf = (salt: number, i: number) => (Math.imul(i + 1, 0x9e3779b1) ^ salt) >>> 0;

/** Điểm một vòng party / một lượt luyện tập (cùng thời lượng, cùng công thức chuẩn). */
const POOLS = Object.fromEntries(
  (Object.keys(MODELS) as ModelId[]).map((model, m) => [
    model,
    Object.fromEntries(
      GAME_IDS.map((game) => [
        game,
        Array.from(
          { length: POOL_SIZE },
          (_, i) =>
            simulateRound(
              game,
              seedOf(0x51ed + m, i),
              { ...MODELS[model], id: `${model}-${i}` },
              cache,
            ).score,
        ),
      ]),
    ),
  ]),
) as Record<ModelId, Record<GameId, number[]>>;

/** Điểm Não của người lớn điển hình (độ khó cố định Thường, thời lượng Kiểm tra não). */
const BRAIN_POOL = Array.from({ length: BRAIN_POOL_SIZE }, (_, i) => {
  const seed = seedOf(0xb7a1, i);
  const games = pickBrainTestGames(seed);
  return computeBrainResult(
    games.map((gameId, k) => {
      const r = simulateRound(
        gameId,
        seedOf(seed, k),
        { ...MODELS.adult, id: `brain-${i}` },
        cache,
        brainTestDurationMs(gameId),
      );
      return { gameId, score: r.score, correct: r.correct };
    }),
  ).brainScore;
});

const ANALYZE_GAMES = GAME_IDS.filter((g) => getGame(g).category === "analyze");
const PARTY_CAP = CHALK_DAILY_CAPS.party.maxChalk ?? Infinity;
/** Số trận của điều kiện số trận trong luật `lua` (chụp trung bình nhóm lúc vừa đủ). */
const SNAPSHOT_MATCHES =
  UNLOCK_RULES.lua.kind === "all"
    ? (UNLOCK_RULES.lua.rules.find((r) => r.kind === "party-matches")?.target ?? 0)
    : 0;

interface Archetype {
  label: string;
  me: ModelId;
  /** Số trận party mỗi ngày; `"cap"` = chơi tới khi chạm trần phấn party. */
  matches: number | "cap";
  /** Trận thứ i (0-based) trong ngày là phòng với bạn (4 người thật) hay một mình với 3 bot. */
  withFriends(i: number): boolean;
  /** Đối thủ khi chơi một mình (bot Vừa = người lớn chuẩn; trẻ em chơi với bot Dễ). */
  bot: ModelId;
  brainTests: number;
  practice: number;
}

const ARCHETYPES = {
  light: {
    label: "Nhẹ: 2 trận với bạn",
    me: "adult",
    matches: 2,
    withFriends: () => true,
    bot: "adult",
    brainTests: 0,
    practice: 0,
  },
  medium: {
    label: "Vừa: 5 trận (3 bạn + 2 bot) + 1 Kiểm tra não + 5 luyện tập",
    me: "adult",
    matches: 5,
    withFriends: (i) => i < 3,
    bot: "adult",
    brainTests: 1,
    practice: 5,
  },
  heavy: {
    label: "Nhiều: chạm mọi trần",
    me: "adult",
    matches: "cap",
    withFriends: (i) => i % 2 === 0,
    bot: "adult",
    brainTests: 3,
    practice: 10,
  },
  child: {
    label: "Trẻ em: 3 trận với bot Dễ + 5 luyện tập Mầm",
    me: "child",
    matches: 3,
    withFriends: () => false,
    bot: "botEasy",
    brainTests: 0,
    practice: 5,
  },
} as const satisfies Record<string, Archetype>;
type ArchetypeId = keyof typeof ARCHETYPES;

interface PlayerRun {
  /** Phấn kiếm được mỗi ngày (đã kẹp trần). */
  daily: number[];
  partyChalk: number;
  partyMatches: number;
  /** Ngày (1-based) đủ phấn cho 1 lần quay lẻ. */
  firstPullDay: number;
  /** Ngày đủ 24 món, `Infinity` nếu chưa đủ sau `DAYS` ngày. */
  collectionDay: number;
  /** Ngày mở từng thú, `Infinity` nếu chưa mở. */
  unlockDay: Record<PetId, number>;
  /** Trung bình điểm mỗi nhóm mỗi trận party lúc vừa đủ `SNAPSHOT_MATCHES` trận. */
  categoryAvg: Record<Category, number>;
}

function sample(rng: Rng, pool: readonly number[]): number {
  return pool[rng.int(0, pool.length - 1)] ?? 0;
}

/** Một trận 3 vòng, phòng 4 ghế: trả hạng chung cuộc của "tôi" và điểm theo nhóm. */
function playMatch(rng: Rng, me: ModelId, others: ModelId) {
  const games = rng.shuffle(GAME_IDS).slice(0, ROUNDS_PER_MATCH);
  const seats = Array.from({ length: SEATS }, (_, i) => ({
    model: i === 0 ? me : others,
    matchPoints: 0,
    totalScore: 0,
    roundScore: 0,
  }));
  const categoryScores: Partial<Record<string, number>> = {};
  for (const game of games) {
    for (const seat of seats) {
      seat.roundScore = sample(rng, POOLS[seat.model][game]);
      seat.totalScore += seat.roundScore;
    }
    for (const { player, rank } of rankByRound(seats)) {
      player.matchPoints += placementPoints(rank, SEATS);
    }
    const cat = getGame(game).category;
    categoryScores[cat] = (categoryScores[cat] ?? 0) + (seats[0]?.roundScore ?? 0);
  }
  const placement = rankByMatch(seats).find((r) => r.player === seats[0])?.rank ?? SEATS - 1;
  return { placement, categoryScores };
}

class Wallet {
  balance = 0;
  pity: GachaPityState = { ...INITIAL_PITY_STATE };
  readonly owned = new Set<string>();

  constructor(private readonly rng: Rng) {}

  /** Tiêu bằng gói 10 lần khi đủ; trả true khi đã đủ 24 món. */
  spend(): boolean {
    while (this.owned.size < COSMETIC_ITEMS.length && this.balance >= GACHA_PRICE_TEN) {
      this.balance -= GACHA_PRICE_TEN;
      const uniforms = Array.from({ length: GACHA_TEN_COUNT }, () => this.rng.next());
      const { rarities, state } = rollGachaBatch(uniforms, this.pity);
      this.pity = state;
      for (const rarity of rarities) this.receive(rarity);
    }
    return this.owned.size === COSMETIC_ITEMS.length;
  }

  private receive(rarity: Rarity) {
    const item = pickGachaItem(this.rng.next(), rarity, this.owned);
    if (this.owned.has(item.id)) this.balance += DUPLICATE_REFUND[rarity];
    else this.owned.add(item.id);
  }
}

function runPlayer(id: ArchetypeId, index: number): PlayerRun {
  const a: Archetype = ARCHETYPES[id];
  const rng = createRng(seedOf(0xda75 + index, PET_CHARACTER_IDS.length));
  const wallet = new Wallet(createRng(seedOf(0x9ac4, index)));
  const stats: UnlockStats = emptyUnlockStats();
  const unlockDay = Object.fromEntries(PET_CHARACTER_IDS.map((p) => [p, Infinity])) as Record<
    PetId,
    number
  >;
  const run: PlayerRun = {
    daily: [],
    partyChalk: 0,
    partyMatches: 0,
    firstPullDay: Infinity,
    collectionDay: Infinity,
    unlockDay,
    categoryAvg: Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>,
  };
  const practiceDifficulty = MODELS[a.me].difficulty;
  let analyzeTurn = 0;

  for (let day = 1; day <= DAYS; day++) {
    const today: Record<EarnSource, { chalk: number; grants: number }> = {
      party: { chalk: 0, grants: 0 },
      brain: { chalk: 0, grants: 0 },
      practice: { chalk: 0, grants: 0 },
    };
    let earned = DAILY_BONUS;
    const grant = (source: EarnSource, amount: number) => {
      const got = capChalkGrant(source, amount, today[source]);
      today[source].chalk += got;
      today[source].grants += 1;
      earned += got;
      return got;
    };

    // Trận party.
    const matchCount = a.matches === "cap" ? 40 : a.matches;
    for (let i = 0; i < matchCount; i++) {
      if (a.matches === "cap" && today.party.chalk >= PARTY_CAP) break;
      const friends = a.withFriends(i);
      const { placement, categoryScores } = playMatch(rng, a.me, friends ? a.me : a.bot);
      const got = grant(
        "party",
        partyChalkReward({ rounds: ROUNDS_PER_MATCH, placement, humans: friends ? SEATS : 1 }),
      );
      if (a.matches === "cap" && got === 0) break;
      run.partyChalk += got;
      run.partyMatches += 1;
      stats.partyMatches += 1;
      if (placement === 0) stats.partyWins += 1;
      for (const [cat, score] of Object.entries(categoryScores)) {
        const key = cat as keyof UnlockStats["partyCategory"];
        const entry = stats.partyCategory[key] ?? { sum: 0, matches: 0 };
        entry.sum += score ?? 0;
        entry.matches += 1;
        stats.partyCategory[key] = entry;
      }
      if (stats.partyMatches === SNAPSHOT_MATCHES) {
        for (const c of CATEGORIES) {
          const e = stats.partyCategory[c];
          run.categoryAvg[c] = e ? Math.floor(e.sum / e.matches) : 0;
        }
      }
    }

    // Kiểm tra não.
    for (let i = 0; i < a.brainTests; i++) {
      const brain = sample(rng, BRAIN_POOL);
      stats.brainBest = Math.max(stats.brainBest, brain);
      grant("brain", brainChalkReward(brain));
    }

    // Luyện tập: nhắm vào thú còn khoá, hết thì chơi game bất kỳ.
    for (let i = 0; i < a.practice; i++) {
      const opRule = UNLOCK_RULES.op;
      const wantsOp =
        opRule.kind === "practice-best" &&
        practiceDifficulty >= opRule.minDifficulty &&
        !petProgress("op", stats).unlocked;
      const wantsThong = !petProgress("thong", stats).unlocked;
      let game: GameId;
      if (wantsOp && (i % 2 === 0 || !wantsThong) && opRule.kind === "practice-best") {
        game = opRule.game;
      } else if (wantsThong) {
        game = ANALYZE_GAMES[analyzeTurn++ % ANALYZE_GAMES.length] ?? "balance";
      } else {
        game = rng.pick(GAME_IDS);
      }
      const score = sample(rng, POOLS[a.me][game]);
      const byDiff = stats.practiceBest[game] ?? {};
      byDiff[practiceDifficulty] = Math.max(byDiff[practiceDifficulty] ?? 0, score);
      stats.practiceBest[game] = byDiff;
      grant("practice", PRACTICE_CHALK);
    }

    run.daily.push(earned);
    wallet.balance += earned;
    if (run.firstPullDay === Infinity && wallet.balance >= GACHA_PRICE_SINGLE) {
      run.firstPullDay = day;
    }
    if (run.collectionDay === Infinity && wallet.spend()) run.collectionDay = day;
    for (const pet of PET_CHARACTER_IDS) {
      if (unlockDay[pet] === Infinity && petProgress(pet, stats).unlocked) unlockDay[pet] = day;
    }
  }
  return run;
}

const quantile = (xs: readonly number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? Infinity;
};
const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const fmtDay = (d: number) => (Number.isFinite(d) ? String(d) : `>${DAYS}`);

const RUNS = Object.fromEntries(
  (Object.keys(ARCHETYPES) as ArchetypeId[]).map((id) => [
    id,
    Array.from({ length: PLAYERS }, (_, i) => runPlayer(id, i)),
  ]),
) as Record<ArchetypeId, PlayerRun[]>;

interface Summary {
  chalkPerDay: number;
  chalkPerMatch: number;
  firstPull: number;
  collection50: number;
  collection90: number;
  unlock50: Record<PetId, number>;
  unlock90: Record<PetId, number>;
  /** Số thú trung vị đã mở sau 30 ngày. */
  petsAt30: number;
}

function summarize(runs: readonly PlayerRun[]): Summary {
  const unlock = (p: number) =>
    Object.fromEntries(
      PET_CHARACTER_IDS.map((pet) => [
        pet,
        quantile(
          runs.map((r) => r.unlockDay[pet]),
          p,
        ),
      ]),
    ) as Record<PetId, number>;
  return {
    chalkPerDay: mean(runs.map((r) => mean(r.daily))),
    chalkPerMatch: mean(runs.map((r) => r.partyChalk / Math.max(1, r.partyMatches))),
    firstPull: quantile(
      runs.map((r) => r.firstPullDay),
      0.5,
    ),
    collection50: quantile(
      runs.map((r) => r.collectionDay),
      0.5,
    ),
    collection90: quantile(
      runs.map((r) => r.collectionDay),
      0.9,
    ),
    unlock50: unlock(0.5),
    unlock90: unlock(0.9),
    petsAt30: quantile(
      runs.map((r) => PET_CHARACTER_IDS.filter((pet) => r.unlockDay[pet] <= 30).length),
      0.5,
    ),
  };
}

const SUMMARY = Object.fromEntries(
  (Object.keys(RUNS) as ArchetypeId[]).map((id) => [id, summarize(RUNS[id])]),
) as Record<ArchetypeId, Summary>;

/** Chi phí ròng (giá − phấn trùng đổi lại) để đủ 24 món, chỉ quay gói 10. */
function collectionCost(index: number): number {
  const wallet = new Wallet(createRng(seedOf(0xc011, index)));
  let spent = 0;
  for (;;) {
    wallet.balance += GACHA_PRICE_TEN;
    spent += GACHA_PRICE_TEN;
    if (wallet.spend()) return spent - wallet.balance;
  }
}
const COSTS = Array.from({ length: 2_000 }, (_, i) => collectionCost(i));

if (PRINT) {
  const lines: string[] = [];
  lines.push(
    `Chi phí ròng đủ 24 món (gói 10): trung bình ${Math.round(mean(COSTS))}, trung vị ${quantile(COSTS, 0.5)}, p90 ${quantile(COSTS, 0.9)} phấn`,
  );
  lines.push(
    `Điểm Não người lớn điển hình: trung vị ${quantile(BRAIN_POOL, 0.5)}, p90 ${quantile(BRAIN_POOL, 0.9)}, P(≥ ${UNLOCK_RULES.may.kind === "brain-score" ? UNLOCK_RULES.may.target : "?"}) = ${(BRAIN_POOL.filter((b) => UNLOCK_RULES.may.kind === "brain-score" && b >= UNLOCK_RULES.may.target).length / BRAIN_POOL.length).toFixed(3)}`,
  );
  const nb = POOLS.adult["number-balloons"];
  lines.push(
    `Bóng bay số (Thường, người lớn): trung vị ${quantile(nb, 0.5)}, p90 ${quantile(nb, 0.9)}`,
  );
  for (const id of ["medium", "child"] as const) {
    lines.push(
      `Trung bình điểm nhóm mỗi trận party khi vừa đủ ${SNAPSHOT_MATCHES} trận (${id}, p10 / trung vị): ` +
        CATEGORIES.map(
          (c) =>
            `${c} ${quantile(
              RUNS[id].map((r) => r.categoryAvg[c]),
              0.1,
            )} / ${quantile(
              RUNS[id].map((r) => r.categoryAvg[c]),
              0.5,
            )}`,
        ).join(" · "),
    );
  }
  for (const id of Object.keys(SUMMARY) as ArchetypeId[]) {
    const s = SUMMARY[id];
    lines.push(
      `\n${ARCHETYPES[id].label}\n  phấn/ngày ${s.chalkPerDay.toFixed(0)} · phấn/trận ${s.chalkPerMatch.toFixed(1)} (${(GACHA_PRICE_SINGLE / s.chalkPerMatch).toFixed(1)} trận/lượt quay) · ` +
        `lượt quay đầu: ngày ${fmtDay(s.firstPull)} · đủ 24 món: ngày ${fmtDay(s.collection50)} (p90 ${fmtDay(s.collection90)}) · ` +
        `thú sau 30 ngày: ${s.petsAt30}`,
    );
    lines.push(
      `  mở thú (trung vị / p90 ngày): ${PET_CHARACTER_IDS.map((p) => `${p} ${fmtDay(s.unlock50[p])}/${fmtDay(s.unlock90[p])}`).join(" · ")}`,
    );
  }
  log(lines.join("\n"));
}

describe("mô phỏng kinh tế phấn (kế hoạch mục 4)", () => {
  it("người chơi nhẹ có lượt quay đầu tiên trong 2 ngày", () => {
    expect(SUMMARY.light.firstPull).toBeLessThanOrEqual(2);
  });

  it("chơi vừa đủ 24 món trong khoảng 1–2 tháng (trung vị 30–60 ngày)", () => {
    expect(SUMMARY.medium.collection50).toBeGreaterThanOrEqual(30);
    expect(SUMMARY.medium.collection50).toBeLessThanOrEqual(60);
  });

  it("thứ tự hợp lý: nhiều nhanh hơn vừa, vừa nhanh hơn nhẹ", () => {
    expect(SUMMARY.heavy.collection50).toBeLessThan(SUMMARY.medium.collection50);
    expect(SUMMARY.medium.collection50).toBeLessThan(SUMMARY.light.collection50);
  });
});

describe("mô phỏng mở khoá thú (kế hoạch mục 3.2)", () => {
  it("chơi vừa: thú đầu tiên mở trong 1–3 ngày", () => {
    const first = Math.min(...PET_CHARACTER_IDS.map((p) => SUMMARY.medium.unlock50[p]));
    expect(first).toBeGreaterThanOrEqual(1);
    expect(first).toBeLessThanOrEqual(3);
  });

  it("chơi vừa: Lửa (khó nhất) mở sau khoảng 3–4 tuần (trung vị 18–32 ngày) và là thú mở muộn nhất", () => {
    const lua = SUMMARY.medium.unlock50.lua;
    expect(lua).toBeGreaterThanOrEqual(18);
    expect(lua).toBeLessThanOrEqual(32);
    for (const pet of PET_CHARACTER_IDS)
      expect(SUMMARY.medium.unlock50[pet]).toBeLessThanOrEqual(lua);
  });

  it("chơi vừa: mọi thú đều mở được trong 6 tuần với 9/10 người điển hình (không ai kẹt)", () => {
    for (const pet of PET_CHARACTER_IDS)
      expect(SUMMARY.medium.unlock90[pet]).toBeLessThanOrEqual(42);
  });

  it("trẻ em chăm chơi mở ít nhất 3 thú trong 30 ngày", () => {
    expect(SUMMARY.child.petsAt30).toBeGreaterThanOrEqual(3);
  });
});
