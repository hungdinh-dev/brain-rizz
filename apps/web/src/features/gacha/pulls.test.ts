import {
  COSMETIC_ITEMS,
  GACHA_PITY,
  GACHA_PRICE_SINGLE,
  GACHA_PRICE_TEN,
  GACHA_RATES,
  RARITIES,
} from "@brain-rizz/shared";
import { describe, expect, it, vi } from "vitest";
import { EMPTY_WALLET, type PullBatch, type PullResult, type Wallet } from "@/net/gacha-api";
import {
  focusFirst,
  itemShare,
  itemsOfRarity,
  type PendingPull,
  PULL_PRICE,
  pityBars,
  pityLeft,
  rarestPull,
  retryPlan,
  slotOf,
  summarizePulls,
  walletOnScreen,
} from "./pulls";

const pull = (
  itemId: PullResult["itemId"],
  rarity: PullResult["rarity"],
  refund = 0,
): PullResult => ({ itemId, rarity, duplicate: refund > 0, refund });

describe("màn Máy quay: hàm thuần", () => {
  it("tỉ lệ mỗi món cộng lại đúng 100 % và khớp số món của danh mục", () => {
    expect(RARITIES.map(itemsOfRarity).reduce((a, b) => a + b, 0)).toBe(COSMETIC_ITEMS.length);
    const total = RARITIES.reduce((sum, r) => sum + itemShare(r) * itemsOfRarity(r), 0);
    expect(total).toBeCloseTo(100, 10);
    expect(itemShare("legendary")).toBeCloseTo(GACHA_RATES.legendary / 3, 10);
  });

  it("bảo hiểm: còn ít nhất 1 lượt, số lần đã quay kẹp trong [0, max − 1]", () => {
    expect(pityLeft(0, 15)).toBe(15);
    expect(pityLeft(14, 15)).toBe(1);
    expect(pityLeft(99, 15)).toBe(1);
    expect(pityLeft(-4, 15)).toBe(15);
    expect(pityBars(6, 17)).toEqual([
      { rarity: "epic", since: 6, max: GACHA_PITY.epic, left: GACHA_PITY.epic - 6 },
      {
        rarity: "legendary",
        since: 17,
        max: GACHA_PITY.legendary,
        left: GACHA_PITY.legendary - 17,
      },
    ]);
    expect(pityBars(40, -1)[0]).toMatchObject({ since: GACHA_PITY.epic - 1, left: 1 });
    expect(pityBars(40, -1)[1]).toMatchObject({ since: 0, left: GACHA_PITY.legendary });
  });

  it("tóm tắt: số món mới, số món trùng, tổng phấn đổi lại", () => {
    expect(
      summarizePulls([pull("cap", "common"), pull("bow", "common", 10), pull("lei", "rare", 30)]),
    ).toEqual({ newCount: 1, dupCount: 2, refund: 40 });
    expect(summarizePulls([])).toEqual({ newCount: 0, dupCount: 0, refund: 0 });
  });

  it("Mặc thử: món hiếm nhất; cùng độ hiếm ưu tiên món mới rồi món ra trước", () => {
    expect(rarestPull([])).toBeUndefined();
    expect(
      rarestPull([pull("cap", "common"), pull("crown", "epic", 80), pull("lei", "rare")])?.itemId,
    ).toBe("crown");
    expect(
      rarestPull([pull("cape", "rare", 30), pull("lei", "rare"), pull("headphones", "rare")])
        ?.itemId,
    ).toBe("lei");
    expect(rarestPull([pull("bow", "common", 10), pull("cap", "common", 10)])?.itemId).toBe("bow");
    expect(slotOf("crown")).toBe("head");
    expect(slotOf("lei")).toBe("neck");
    expect(slotOf("khong-co")).toBeUndefined();
  });
});

describe("màn Máy quay: Thử lại không trừ phấn hai lần", () => {
  const pending: PendingPull = { id: "0b6f2a4e-6c1d-4f3a-9a52-3c7d1e2f4a01", count: 10 };

  it("còn mã cũ → gửi lại đúng mã và số lượt cũ, kể cả khi số dư (đã đọc lại) không đủ", () => {
    expect(retryPlan(pending, 1, 0)).toEqual({ kind: "replay", pull: pending });
    expect(retryPlan(pending, 10, GACHA_PRICE_TEN)).toEqual({ kind: "replay", pull: pending });
  });

  it("không còn mã → lượt mới, phải đủ phấn cho đúng số lượt", () => {
    expect(retryPlan(null, 1, GACHA_PRICE_SINGLE)).toEqual({ kind: "fresh", count: 1 });
    expect(retryPlan(null, 1, GACHA_PRICE_SINGLE - 1)).toEqual({ kind: "insufficient" });
    expect(retryPlan(null, 10, GACHA_PRICE_TEN)).toEqual({ kind: "fresh", count: 10 });
    expect(retryPlan(null, 10, GACHA_PRICE_TEN - 1)).toEqual({ kind: "insufficient" });
    expect(PULL_PRICE).toEqual({ 1: GACHA_PRICE_SINGLE, 10: GACHA_PRICE_TEN });
  });
});

describe("màn Máy quay: ví trên màn không lộ độ hiếm trước khi mở", () => {
  const before: Wallet = { ...EMPTY_WALLET, balance: 1_000, sinceEpic: 14, sinceLegendary: 59 };
  // Ví thật đã nhận kết quả (vd. đọc lại ví trước khi Thử lại): ra Huyền thoại → bảo hiểm về 0.
  const after: Wallet = { ...before, balance: 200, sinceEpic: 0, sinceLegendary: 0 };
  const batch: PullBatch = {
    results: [pull("halo", "legendary"), pull("cap", "common", 5), pull("lei", "rare", 15)],
    balance: 200,
    sinceEpic: 0,
    sinceLegendary: 0,
    replayed: false,
  };

  it("đang quay / chờ Thử lại: hiện ví lúc bấm, không phải ví thật", () => {
    expect(
      walletOnScreen({ wallet: after, frozen: before, batch: null, openedAll: false }),
    ).toEqual({ wallet: before, balance: 1_000 });
  });

  it("đang mở quà: bảo hiểm vẫn lúc bấm, số dư đã trừ giá chưa cộng phấn trùng", () => {
    expect(walletOnScreen({ wallet: after, frozen: before, batch, openedAll: false })).toEqual({
      wallet: before,
      balance: 180,
    });
  });

  it("mở hết (hoặc không quay): ví thật", () => {
    expect(walletOnScreen({ wallet: after, frozen: null, batch, openedAll: true })).toEqual({
      wallet: after,
      balance: 200,
    });
    expect(walletOnScreen({ wallet: null, frozen: null, batch: null, openedAll: false })).toEqual({
      wallet: null,
      balance: 0,
    });
  });
});

describe("màn Máy quay: trả tiêu điểm khi đóng hộp thoại / màn mở quà", () => {
  const el = (patch: { isConnected?: boolean; disabled?: boolean } = {}) => ({
    isConnected: true,
    disabled: false,
    ...patch,
    focus: vi.fn(),
  });

  it("về nút đầu tiên còn trên trang và không bị tắt", () => {
    const gone = el({ isConnected: false });
    const off = el({ disabled: true });
    const quay1 = el();
    const odds = el();
    expect(focusFirst([null, gone, off, quay1, odds])).toBe(true);
    expect(quay1.focus).toHaveBeenCalledTimes(1);
    expect(gone.focus).not.toHaveBeenCalled();
    expect(off.focus).not.toHaveBeenCalled();
    expect(odds.focus).not.toHaveBeenCalled();
  });

  it("không còn nút nào → báo false để Radix tự xử lý", () => {
    expect(focusFirst([undefined, el({ disabled: true })])).toBe(false);
  });
});
