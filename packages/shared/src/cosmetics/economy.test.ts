import { describe, expect, it } from "vitest";
import { createRng } from "../rng";
import { cosmeticsByRarity, RARITIES, type Rarity } from "./catalog";
import {
  advancePity,
  BRAIN_CHALK,
  brainChalkReward,
  CHALK_DAILY_CAPS,
  CHALK_DAY_TIMEZONE,
  capChalkGrant,
  DAILY_BONUS,
  DUPLICATE_REFUND,
  ECONOMY_SQL_CONSTANTS,
  GACHA_PITY,
  GACHA_PRICE_SINGLE,
  GACHA_PRICE_TEN,
  GACHA_RATES,
  GACHA_TEN_COUNT,
  type GachaPityState,
  gachaRarityPool,
  INITIAL_PITY_STATE,
  PARTY_CHALK,
  PRACTICE_CHALK,
  partyChalkReward,
  pickGachaItem,
  rollGachaBatch,
  rollGachaRarity,
} from "./economy";

const fresh: GachaPityState = { ...INITIAL_PITY_STATE };

describe("hằng số kinh tế", () => {
  it("tỉ lệ là số nguyên phần trăm, tổng 100, giảm dần theo độ hiếm", () => {
    const rates = RARITIES.map((r) => GACHA_RATES[r]);
    expect(rates.every((r) => Number.isInteger(r) && r > 0)).toBe(true);
    expect(rates.reduce((a, b) => a + b, 0)).toBe(100);
    expect([...rates].sort((a, b) => b - a)).toEqual(rates);
  });

  it("bảo hiểm đúng nguyên tắc mục 2 (≤ 15 lần ra Sử thi+, ≤ 60 lần ra Huyền thoại, gói 10)", () => {
    expect(GACHA_PITY.epic).toBeLessThanOrEqual(15);
    expect(GACHA_PITY.legendary).toBeLessThanOrEqual(60);
    expect(GACHA_TEN_COUNT).toBe(10);
  });

  it("gói 10 rẻ hơn 10 lần lẻ; trùng đổi lại tăng theo độ hiếm, dưới Huyền thoại thì ít hơn giá một lần", () => {
    expect(GACHA_PRICE_TEN).toBeLessThan(GACHA_TEN_COUNT * GACHA_PRICE_SINGLE);
    const refunds = RARITIES.map((r) => DUPLICATE_REFUND[r]);
    expect([...refunds].sort((a, b) => a - b)).toEqual(refunds);
    for (const r of ["common", "rare", "epic"] as const) {
      expect(DUPLICATE_REFUND[r]).toBeLessThan(GACHA_PRICE_SINGLE);
    }
  });

  it("mọi số là số nguyên dương", () => {
    const numbers = [
      GACHA_PRICE_SINGLE,
      GACHA_PRICE_TEN,
      PRACTICE_CHALK,
      DAILY_BONUS,
      PARTY_CHALK.base,
      PARTY_CHALK.perRound,
      ...PARTY_CHALK.placement,
      PARTY_CHALK.soloPercent,
      BRAIN_CHALK.base,
      BRAIN_CHALK.perPoints,
      ...RARITIES.map((r) => DUPLICATE_REFUND[r]),
      ...Object.values(CHALK_DAILY_CAPS).flatMap((c) => [c.maxChalk ?? 1, c.maxGrants ?? 1]),
    ];
    for (const n of numbers) expect(Number.isInteger(n) && n > 0).toBe(true);
  });

  it("ECONOMY_SQL_CONSTANTS liệt kê đúng giá trị đang dùng", () => {
    expect(ECONOMY_SQL_CONSTANTS).toMatchObject({
      GACHA_PRICE_SINGLE,
      GACHA_PRICE_TEN,
      GACHA_TEN_COUNT,
      "GACHA_PITY.epic": GACHA_PITY.epic,
      "GACHA_PITY.legendary": GACHA_PITY.legendary,
      PRACTICE_CHALK,
      DAILY_BONUS,
      CHALK_DAY_TIMEZONE,
    });
    for (const r of RARITIES) {
      expect(ECONOMY_SQL_CONSTANTS[`GACHA_RATES.${r}`]).toBe(GACHA_RATES[r]);
      expect(ECONOMY_SQL_CONSTANTS[`DUPLICATE_REFUND.${r}`]).toBe(DUPLICATE_REFUND[r]);
    }
    expect(ECONOMY_SQL_CONSTANTS["CHALK_DAILY_CAPS.party.maxChalk"]).toBe(
      CHALK_DAILY_CAPS.party.maxChalk,
    );
    expect(ECONOMY_SQL_CONSTANTS["CHALK_DAILY_CAPS.brain.maxGrants"]).toBe(
      CHALK_DAILY_CAPS.brain.maxGrants,
    );
    expect(ECONOMY_SQL_CONSTANTS["CHALK_DAILY_CAPS.practice.maxGrants"]).toBe(
      CHALK_DAILY_CAPS.practice.maxGrants,
    );
  });
});

describe("partyChalkReward", () => {
  const full = (rounds: number, placement: number) =>
    PARTY_CHALK.base + PARTY_CHALK.perRound * rounds + (PARTY_CHALK.placement[placement] ?? 0);

  it("có người thật khác: base + mỗi vòng + thưởng hạng nhất / nhì / ba", () => {
    expect(partyChalkReward({ rounds: 3, placement: 0, humans: 4 })).toBe(full(3, 0));
    expect(partyChalkReward({ rounds: 3, placement: 1, humans: 2 })).toBe(full(3, 1));
    expect(partyChalkReward({ rounds: 3, placement: 2, humans: 12 })).toBe(full(3, 2));
    expect(partyChalkReward({ rounds: 3, placement: 3, humans: 12 })).toBe(full(3, 3));
    expect(partyChalkReward({ rounds: 3, placement: 11, humans: 12 })).toBe(full(3, 99));
    // Số cụ thể của bảng mục 4 (trận 3 vòng).
    expect(
      [0, 1, 2, 3].map((p) => partyChalkReward({ rounds: 3, placement: p, humans: 4 })),
    ).toEqual([45, 37, 33, 25]);
  });

  it("trận chỉ 1 người thật (còn lại là bot) nhận một nửa, làm tròn xuống", () => {
    for (const p of [0, 1, 2, 3]) {
      const solo = partyChalkReward({ rounds: 3, placement: p, humans: 1 });
      expect(solo).toBe(Math.floor((full(3, p) * PARTY_CHALK.soloPercent) / 100));
    }
    expect(
      [0, 1, 2, 3].map((p) => partyChalkReward({ rounds: 3, placement: p, humans: 1 })),
    ).toEqual([22, 18, 16, 12]);
    // 0 hoặc số lạ → coi như một mình (không bao giờ thưởng nhiều hơn).
    expect(partyChalkReward({ rounds: 3, placement: 0, humans: 0 })).toBe(22);
    expect(partyChalkReward({ rounds: 3, placement: 0, humans: Number.NaN })).toBe(22);
    expect(partyChalkReward({ rounds: 3, placement: 0, humans: 2 })).toBe(45);
  });

  it("số vòng kẹp về [1, 10]; hạng lạ không có thưởng hạng; không ném", () => {
    expect(partyChalkReward({ rounds: 0, placement: 3, humans: 2 })).toBe(full(1, 3));
    expect(partyChalkReward({ rounds: 99, placement: 3, humans: 2 })).toBe(full(10, 3));
    expect(partyChalkReward({ rounds: Number.NaN, placement: 3, humans: 2 })).toBe(full(1, 3));
    expect(partyChalkReward({ rounds: 3.9, placement: 3, humans: 2 })).toBe(full(3, 3));
    expect(partyChalkReward({ rounds: 3, placement: -1, humans: 2 })).toBe(full(3, 3));
    expect(partyChalkReward({ rounds: 3, placement: Number.NaN, humans: 2 })).toBe(full(3, 3));
    expect(partyChalkReward({ rounds: 3, placement: 1.5, humans: 2 })).toBe(full(3, 1));
  });
});

describe("brainChalkReward", () => {
  it("30 + Điểm Não / 20 (làm tròn xuống), Điểm Não kẹp về [0, 1 000]", () => {
    expect(brainChalkReward(0)).toBe(30);
    expect(brainChalkReward(19)).toBe(30);
    expect(brainChalkReward(20)).toBe(31);
    expect(brainChalkReward(500)).toBe(55);
    expect(brainChalkReward(1_000)).toBe(80);
    expect(brainChalkReward(5_000)).toBe(80);
    expect(brainChalkReward(-10)).toBe(30);
    expect(brainChalkReward(Number.NaN)).toBe(30);
  });
});

describe("capChalkGrant (bản tham chiếu của grant_chalk)", () => {
  const cap = CHALK_DAILY_CAPS.party.maxChalk ?? 0;

  it("party: kẹp theo tổng phấn trong ngày, phần vượt bị cắt", () => {
    expect(capChalkGrant("party", 45, { chalk: 0, grants: 0 })).toBe(45);
    expect(capChalkGrant("party", 45, { chalk: cap - 20, grants: 9 })).toBe(20);
    expect(capChalkGrant("party", 45, { chalk: cap, grants: 10 })).toBe(0);
    expect(capChalkGrant("party", 45, { chalk: cap + 5, grants: 10 })).toBe(0);
  });

  it("brain / practice: kẹp theo số lần trong ngày", () => {
    const brain = CHALK_DAILY_CAPS.brain.maxGrants ?? 0;
    const practice = CHALK_DAILY_CAPS.practice.maxGrants ?? 0;
    expect(capChalkGrant("brain", 55, { chalk: 0, grants: brain - 1 })).toBe(55);
    expect(capChalkGrant("brain", 55, { chalk: 0, grants: brain })).toBe(0);
    expect(capChalkGrant("practice", PRACTICE_CHALK, { chalk: 0, grants: practice - 1 })).toBe(
      PRACTICE_CHALK,
    );
    expect(capChalkGrant("practice", PRACTICE_CHALK, { chalk: 0, grants: practice })).toBe(0);
  });

  it("số cộng ≤ 0 hoặc không hợp lệ → 0", () => {
    expect(capChalkGrant("party", 0, { chalk: 0, grants: 0 })).toBe(0);
    expect(capChalkGrant("party", -5, { chalk: 0, grants: 0 })).toBe(0);
    expect(capChalkGrant("brain", Number.NaN, { chalk: 0, grants: 0 })).toBe(0);
  });
});

// Có vòng 10 000 gói / 2 000 người: máy tải nặng (cả repo chạy song song) có thể quá 5 giây mặc định.
describe("quay: bốc độ hiếm", { timeout: 60_000 }, () => {
  it("ngưỡng theo trọng số: floor(u × 100) đi theo common → legendary", () => {
    expect(rollGachaRarity(0, fresh)).toBe("common");
    expect(rollGachaRarity(0.599, fresh)).toBe("common");
    expect(rollGachaRarity(0.6, fresh)).toBe("rare");
    expect(rollGachaRarity(0.899, fresh)).toBe("rare");
    expect(rollGachaRarity(0.9, fresh)).toBe("epic");
    expect(rollGachaRarity(0.979, fresh)).toBe("epic");
    expect(rollGachaRarity(0.98, fresh)).toBe("legendary");
    expect(rollGachaRarity(0.999_999, fresh)).toBe("legendary");
    // u ngoài [0, 1) bị kẹp, không ném.
    expect(rollGachaRarity(1, fresh)).toBe("legendary");
    expect(rollGachaRarity(-3, fresh)).toBe("common");
    expect(rollGachaRarity(Number.NaN, fresh)).toBe("common");
  });

  it("bảo hiểm Hiếm của gói 10: chỉ Hiếm trở lên, tỉ lệ 30 : 8 : 2", () => {
    expect(gachaRarityPool(fresh, true)).toEqual(["rare", "epic", "legendary"]);
    expect(rollGachaRarity(0, fresh, true)).toBe("rare");
    expect(rollGachaRarity(0.749, fresh, true)).toBe("rare");
    expect(rollGachaRarity(0.75, fresh, true)).toBe("epic");
    expect(rollGachaRarity(0.95, fresh, true)).toBe("legendary");
  });

  it("bảo hiểm Sử thi ở lần thứ GACHA_PITY.epic (8 : 2), Huyền thoại ở lần thứ GACHA_PITY.legendary", () => {
    const epicDue = { sinceEpic: GACHA_PITY.epic - 1, sinceLegendary: GACHA_PITY.epic - 1 };
    expect(gachaRarityPool({ ...epicDue, sinceEpic: GACHA_PITY.epic - 2 })).toEqual(RARITIES);
    expect(gachaRarityPool(epicDue)).toEqual(["epic", "legendary"]);
    expect(rollGachaRarity(0, epicDue)).toBe("epic");
    expect(rollGachaRarity(0.799, epicDue)).toBe("epic");
    expect(rollGachaRarity(0.8, epicDue)).toBe("legendary");
    // Bảo hiểm Sử thi mạnh hơn bảo hiểm Hiếm của gói 10.
    expect(rollGachaRarity(0, epicDue, true)).toBe("epic");

    const legendaryDue = { sinceEpic: 3, sinceLegendary: GACHA_PITY.legendary - 1 };
    expect(gachaRarityPool({ ...legendaryDue, sinceLegendary: GACHA_PITY.legendary - 2 })).toEqual(
      RARITIES,
    );
    for (const u of [0, 0.5, 0.99])
      expect(rollGachaRarity(u, legendaryDue, true)).toBe("legendary");
  });

  it("bộ đếm: Huyền thoại về 0 cả hai, Sử thi về 0 bộ đếm Sử thi, còn lại cùng tăng", () => {
    const s = { sinceEpic: 4, sinceLegendary: 20 };
    expect(advancePity(s, "legendary")).toEqual({ sinceEpic: 0, sinceLegendary: 0 });
    expect(advancePity(s, "epic")).toEqual({ sinceEpic: 0, sinceLegendary: 21 });
    expect(advancePity(s, "rare")).toEqual({ sinceEpic: 5, sinceLegendary: 21 });
    expect(advancePity(s, "common")).toEqual({ sinceEpic: 5, sinceLegendary: 21 });
  });

  it("gói 10 toàn số 0: 9 Thường + lần cuối được bảo hiểm Hiếm", () => {
    const { rarities, state } = rollGachaBatch(Array(10).fill(0), fresh);
    expect(rarities).toEqual([...Array<Rarity>(9).fill("common"), "rare"]);
    expect(state).toEqual({ sinceEpic: 10, sinceLegendary: 10 });
  });

  it("quay lẻ không có bảo hiểm Hiếm; bảo hiểm Sử thi chạy giữa gói thì lần cuối không cần bảo hiểm Hiếm", () => {
    expect(rollGachaBatch([0], fresh).rarities).toEqual(["common"]);
    const { rarities } = rollGachaBatch(Array(10).fill(0), { sinceEpic: 10, sinceLegendary: 10 });
    expect(rarities[4]).toBe("epic");
    expect(rarities.filter((r) => r !== "common")).toEqual(["epic"]);
  });

  it("10 000 gói ngẫu nhiên: mọi gói có Hiếm+, không bao giờ quá hạn bảo hiểm; tỉ lệ thực ≈ công bố", () => {
    const rng = createRng(20_261_120);
    let state = { ...fresh };
    let sinceEpic = 0;
    let sinceLegendary = 0;
    const counts: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
    for (let b = 0; b < 10_000; b++) {
      const batch = rollGachaBatch(
        Array.from({ length: GACHA_TEN_COUNT }, () => rng.next()),
        state,
      );
      expect(batch.rarities.some((r) => r !== "common")).toBe(true);
      for (const r of batch.rarities) {
        counts[r]++;
        sinceEpic = r === "epic" || r === "legendary" ? 0 : sinceEpic + 1;
        sinceLegendary = r === "legendary" ? 0 : sinceLegendary + 1;
        expect(sinceEpic).toBeLessThan(GACHA_PITY.epic);
        expect(sinceLegendary).toBeLessThan(GACHA_PITY.legendary);
      }
      expect(batch.state).toEqual({ sinceEpic, sinceLegendary });
      state = batch.state;
    }
    const total = 10_000 * GACHA_TEN_COUNT;
    // Bảo hiểm chỉ nâng độ hiếm: Thường ít hơn công bố một chút, Huyền thoại nhiều hơn.
    expect(counts.common / total).toBeLessThan(GACHA_RATES.common / 100);
    expect(counts.common / total).toBeGreaterThan(GACHA_RATES.common / 100 - 0.06);
    expect(counts.legendary / total).toBeGreaterThan(GACHA_RATES.legendary / 100);
    expect(counts.legendary / total).toBeLessThan(0.035);
  });

  it("tất định: cùng dãy số → cùng kết quả", () => {
    const us = Array.from({ length: 10 }, (_, i) => (i * 0.37) % 1);
    expect(rollGachaBatch(us, fresh)).toEqual(rollGachaBatch(us, fresh));
  });
});

describe("quay: chọn món (pickGachaItem)", { timeout: 60_000 }, () => {
  const ids = (rarity: Rarity) => cosmeticsByRarity(rarity).map((item) => item.id);

  it("đều nhau trong độ hiếm theo thứ tự COSMETIC_ITEMS: floor(u × n); u lạ bị kẹp, không ném", () => {
    const commons = ids("common");
    expect(pickGachaItem(0, "common").id).toBe(commons[0]);
    expect(pickGachaItem(0.999_999, "common").id).toBe(commons[commons.length - 1]);
    expect(pickGachaItem(1 / commons.length, "common").id).toBe(commons[1]);
    expect(pickGachaItem(1, "rare").id).toBe(ids("rare").at(-1));
    expect(pickGachaItem(-2, "epic").id).toBe(ids("epic")[0]);
    expect(pickGachaItem(Number.NaN, "legendary").id).toBe(ids("legendary")[0]);
    for (const rarity of RARITIES) {
      for (const u of [0, 0.3, 0.7, 0.99]) expect(pickGachaItem(u, rarity).rarity).toBe(rarity);
    }
  });

  it("Thường / Hiếm / Sử thi: trùng được (không xét món đã có)", () => {
    for (const rarity of ["common", "rare", "epic"] as const) {
      const owned = new Set(ids(rarity));
      expect(pickGachaItem(0, rarity, owned).id).toBe(ids(rarity)[0]);
    }
  });

  it("Huyền thoại: chỉ bốc món chưa có; đủ cả rồi mới bốc đều", () => {
    const legends = ids("legendary");
    expect(legends.length).toBeGreaterThan(1);
    const [first, ...rest] = legends;
    const ownedFirst = new Set([first ?? ""]);
    for (const u of [0, 0.4, 0.8, 0.999]) {
      expect(rest).toContain(pickGachaItem(u, "legendary", ownedFirst).id);
    }
    // Còn đúng một món chưa có → luôn ra món đó.
    const last = legends.at(-1) ?? "";
    const allButLast = new Set(legends.slice(0, -1));
    for (const u of [0, 0.5, 0.999])
      expect(pickGachaItem(u, "legendary", allButLast).id).toBe(last);
    // Đủ bộ → bốc đều trong cả độ hiếm.
    const all = new Set(legends);
    expect(pickGachaItem(0, "legendary", all).id).toBe(legends[0]);
    expect(pickGachaItem(0.999, "legendary", all).id).toBe(last);
  });

  it("mô phỏng 2 000 người: n lần ra Huyền thoại đầu tiên luôn là n món khác nhau (n = số món Huyền thoại)", () => {
    const rng = createRng(20_261_121);
    const legendCount = ids("legendary").length;
    for (let player = 0; player < 2_000; player++) {
      const owned = new Set<string>();
      let state = { ...fresh };
      const legendsSeen: string[] = [];
      while (legendsSeen.length < legendCount) {
        const batch = rollGachaBatch(
          Array.from({ length: GACHA_TEN_COUNT }, () => rng.next()),
          state,
        );
        state = batch.state;
        for (const rarity of batch.rarities) {
          const item = pickGachaItem(rng.next(), rarity, owned);
          if (rarity === "legendary" && legendsSeen.length < legendCount) legendsSeen.push(item.id);
          owned.add(item.id);
        }
      }
      expect(new Set(legendsSeen).size).toBe(legendCount);
    }
  });
});
