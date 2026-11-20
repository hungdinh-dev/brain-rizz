import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Ví phấn dùng chung (CR-023): lý do lỗi → trạng thái màn hình, quà mỗi ngày, cập nhật sau lượt quay.
 * `net/gacha-api` giả để không chạm mạng.
 */

type Res = { ok: true; data: unknown } | { ok: false; reason: string };

async function load(api: { wallet?: () => Res; items?: () => Res; claim?: () => Res }) {
  vi.resetModules();
  const fetchWallet = vi.fn(async () => api.wallet?.() ?? { ok: false, reason: "no-session" });
  const fetchMyItems = vi.fn(async () => api.items?.() ?? { ok: true, data: [] });
  const claimDailyChalk = vi.fn(async () => api.claim?.() ?? { ok: true, data: 20 });
  vi.doMock("@/net/gacha-api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/net/gacha-api")>()),
    fetchWallet,
    fetchMyItems,
    claimDailyChalk,
  }));
  const store = await import("./wallet.store");
  return { ...store, fetchWallet, claimDailyChalk };
}

const WALLET = {
  balance: 130,
  sinceEpic: 3,
  sinceLegendary: 9,
  totalPulls: 9,
  dailyClaimed: false,
  today: { party: 0, brain: 0, practice: 0 },
};

describe("wallet.store", { timeout: 30_000 }, () => {
  afterEach(() => {
    vi.doUnmock("@/net/gacha-api");
    vi.restoreAllMocks();
  });

  it("lý do lỗi → trạng thái: chưa cấu hình / DB chưa có máy quay = offline", async () => {
    const { walletStatusOf } = await load({});
    expect(walletStatusOf("not-configured")).toBe("offline");
    expect(walletStatusOf("unavailable")).toBe("offline");
    expect(walletStatusOf("no-session")).toBe("no-session");
    expect(walletStatusOf("error")).toBe("error");
    expect(walletStatusOf("insufficient")).toBe("error");
  });

  it("chưa có phiên → ví trống; DB chưa có máy quay → offline, không có ví", async () => {
    const guest = await load({});
    await guest.useWallet.getState().load({ probe: true });
    expect(guest.fetchWallet).toHaveBeenCalledWith(true);
    expect(guest.useWallet.getState()).toMatchObject({
      status: "no-session",
      wallet: { balance: 0 },
    });

    const missing = await load({ wallet: () => ({ ok: false, reason: "unavailable" }) });
    await missing.useWallet.getState().load();
    expect(missing.useWallet.getState()).toMatchObject({ status: "offline", wallet: null });
  });

  it("quà mỗi ngày: cộng vào số dư, đánh dấu đã nhận; 0 = đã nhận ở máy khác", async () => {
    // Nhận xong store đọc lại ví (không chờ): máy chủ giả trả ví đã cộng quà.
    let claimed = false;
    const { useWallet } = await load({
      wallet: () => ({
        ok: true,
        data: claimed ? { ...WALLET, balance: 150, dailyClaimed: true } : WALLET,
      }),
      claim: () => {
        claimed = true;
        return { ok: true, data: 20 };
      },
    });
    await useWallet.getState().load();
    await expect(useWallet.getState().claimDaily()).resolves.toBe("claimed");
    expect(useWallet.getState().wallet).toMatchObject({ balance: 150, dailyClaimed: true });

    const again = await load({
      wallet: () => ({ ok: true, data: { ...WALLET, dailyClaimed: true } }),
      claim: () => ({ ok: true, data: 0 }),
    });
    await expect(again.useWallet.getState().claimDaily()).resolves.toBe("already");
    const offline = await load({ claim: () => ({ ok: false, reason: "unavailable" }) });
    await expect(offline.useWallet.getState().claimDaily()).resolves.toBe("offline");
    expect(offline.useWallet.getState().status).toBe("offline");
  });

  it("sau lượt quay: số dư, bảo hiểm, tổng lượt, món mới (không trùng)", async () => {
    const { useWallet } = await load({
      wallet: () => ({ ok: true, data: WALLET }),
      items: () => ({ ok: true, data: ["cap"] }),
    });
    await useWallet.getState().load();
    await useWallet.getState().loadItems();
    useWallet.getState().applyPull({
      results: [
        { itemId: "cap", rarity: "common", duplicate: true, refund: 10 },
        { itemId: "crown", rarity: "epic", duplicate: false, refund: 0 },
      ],
      balance: 40,
      sinceEpic: 0,
      sinceLegendary: 11,
      replayed: false,
    });
    expect(useWallet.getState().wallet).toMatchObject({
      balance: 40,
      sinceEpic: 0,
      sinceLegendary: 11,
      totalPulls: 11,
    });
    expect(useWallet.getState().items).toEqual(["cap", "crown"]);
  });

  it("kết quả trả lại (Thử lại cùng mã): không cộng tổng lượt lần hai, không trùng món", async () => {
    // Màn đã đọc lại ví trước khi Thử lại: ví máy chủ đã tính lượt quay đầu (tổng 10, có "crown").
    const { useWallet } = await load({
      wallet: () => ({ ok: true, data: { ...WALLET, balance: 30, totalPulls: 10, sinceEpic: 0 } }),
      items: () => ({ ok: true, data: ["cap", "crown"] }),
    });
    await useWallet.getState().load();
    await useWallet.getState().loadItems();
    useWallet.getState().applyPull({
      results: [{ itemId: "crown", rarity: "epic", duplicate: false, refund: 0 }],
      balance: 30,
      sinceEpic: 0,
      sinceLegendary: 10,
      replayed: true,
    });
    expect(useWallet.getState().wallet).toMatchObject({ balance: 30, totalPulls: 10 });
    expect(useWallet.getState().items).toEqual(["cap", "crown"]);
  });
});
