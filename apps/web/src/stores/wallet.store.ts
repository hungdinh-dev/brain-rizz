import type { CosmeticId } from "@brain-rizz/shared";
import { create } from "zustand";
import {
  claimDailyChalk,
  EMPTY_WALLET,
  fetchMyItems,
  fetchWallet,
  type GachaFailure,
  type PullBatch,
  type Wallet,
} from "@/net/gacha-api";
import type { ProfileForAccount } from "./auth.store";

/**
 * Ví phấn + món đã có (CR-023), dùng chung cho menu (chip số dư, quà mỗi ngày), Máy quay và Tủ đồ.
 * Chỉ giữ bản sao để hiển thị: số dư, bảo hiểm, sở hữu do Postgres quyết (net/gacha-api).
 *
 * - `loading`: đang hỏi lần đầu (chưa có số nào để hiện).
 * - `ok`: có ví của phiên đang có.
 * - `no-session`: chưa có phiên → ví trống (`EMPTY_WALLET`), quà mỗi ngày tạo phiên khách.
 * - `offline`: chưa cấu hình Supabase hoặc DB chưa có máy quay (404) → "chưa kết nối máy chủ dữ liệu".
 * - `error`: mạng / RPC lỗi → Thử lại.
 */
export type WalletStatus = "loading" | "ok" | "no-session" | "offline" | "error";

/** `busy`: đang nhận dở (bấm đúp) — bỏ qua, không báo gì. */
export type ClaimOutcome = "claimed" | "already" | "offline" | "failed" | "busy";

export function walletStatusOf(reason: GachaFailure): Exclude<WalletStatus, "loading" | "ok"> {
  if (reason === "not-configured" || reason === "unavailable") return "offline";
  if (reason === "no-session") return "no-session";
  return "error";
}

interface WalletStore {
  status: WalletStatus;
  /** `null` khi `loading` / `offline` / `error` lần đầu. */
  wallet: Wallet | null;
  itemsStatus: WalletStatus;
  /** Món đã có, theo thứ tự nhận; `null` khi chưa tải được. */
  items: CosmeticId[] | null;
  claiming: boolean;
  /** Tải lại ví. `probe`: xem `fetchWallet`. Giữ số cũ trong lúc tải lại. */
  load(options?: { probe?: boolean }): Promise<void>;
  loadItems(): Promise<void>;
  /** Nhận quà mỗi ngày (tạo phiên khách nếu chưa có). */
  claimDaily(profile?: ProfileForAccount): Promise<ClaimOutcome>;
  /**
   * Kết quả `gacha_pull`: số dư, bảo hiểm, món mới. Màn Máy quay chỉ gọi khi bắt đầu mở quà (không
   * trong lúc máy đang quay, để bảo hiểm / số dư không lộ độ hiếm trước).
   */
  applyPull(batch: PullBatch): void;
}

let walletRequest = 0;
let itemsRequest = 0;

export const useWallet = create<WalletStore>((set, get) => ({
  status: "loading",
  wallet: null,
  itemsStatus: "loading",
  items: null,
  claiming: false,

  async load(options = {}) {
    const id = ++walletRequest;
    if (get().status !== "ok") set({ status: "loading" });
    const res = await fetchWallet(options.probe);
    if (id !== walletRequest) return;
    if (res.ok) {
      set({ status: "ok", wallet: res.data });
      return;
    }
    const status = walletStatusOf(res.reason);
    set({ status, wallet: status === "no-session" ? EMPTY_WALLET : null });
  },

  async loadItems() {
    const id = ++itemsRequest;
    if (get().itemsStatus !== "ok") set({ itemsStatus: "loading" });
    const res = await fetchMyItems();
    if (id !== itemsRequest) return;
    if (res.ok) {
      set({ itemsStatus: "ok", items: res.data });
      return;
    }
    const itemsStatus = walletStatusOf(res.reason);
    set({ itemsStatus, items: itemsStatus === "no-session" ? [] : null });
  },

  async claimDaily(profile) {
    if (get().claiming) return "busy";
    set({ claiming: true });
    const res = await claimDailyChalk(profile);
    set({ claiming: false });
    if (!res.ok) {
      const status = walletStatusOf(res.reason);
      if (status === "offline") {
        walletRequest++;
        set({ status: "offline", wallet: null });
        return "offline";
      }
      return "failed";
    }
    const wallet = get().wallet ?? EMPTY_WALLET;
    walletRequest++;
    set({
      status: "ok",
      wallet: { ...wallet, balance: wallet.balance + res.data, dailyClaimed: true },
    });
    // Phiên khách vừa tạo / số dư đổi ở máy khác: đọc lại ví thật (không chặn giao diện).
    void get().load();
    return res.data > 0 ? "claimed" : "already";
  },

  applyPull(batch) {
    const wallet = get().wallet ?? EMPTY_WALLET;
    const items = get().items;
    walletRequest++;
    set({
      status: "ok",
      wallet: {
        ...wallet,
        balance: batch.balance,
        sinceEpic: batch.sinceEpic,
        sinceLegendary: batch.sinceLegendary,
        // Kết quả trả lại (`replayed`): lượt này máy chủ đã tính từ lần gọi đầu, và màn đã đọc lại ví
        // trước khi Thử lại → không cộng lần hai.
        totalPulls: wallet.totalPulls + (batch.replayed ? 0 : batch.results.length),
      },
      // Chưa tải danh sách món thì để màn tự tải (`loadItems`), không đoán.
      items: items && [...new Set([...items, ...batch.results.map((r) => r.itemId)])],
    });
  },
}));
