import { create } from "zustand";
import { currentLanguage } from "@/i18n";
import { type AdminFailure, type AdminPartySettings, fetchPartySettings } from "@/net/admin-api";
import { type DecimalSeparator, draftFromConfig, type PartyDraft } from "./draft";

/** Trạng thái tải một mục: đang tải / xong / lý do lỗi. */
export type AdminLoad<T> =
  | { status: "loading" }
  | { status: "ok"; data: T }
  | { status: AdminFailure };

/** Mất quyền giữa phiên (RPC 42501, hết phiên) → trang về cổng tương ứng. */
export type AdminLost = "forbidden" | "signin";

interface AdminStore {
  lost: AdminLost | null;
  /** Cấu hình trận party đang áp dụng (`admin_get_party_settings`). */
  settings: AdminLoad<AdminPartySettings>;
  /** Bản nháp chung của mục Game và Điểm & hệ số; `null` khi chưa tải cấu hình. */
  draft: PartyDraft | null;
  /** Tăng sau mỗi lần lưu: mục Điểm & hệ số tải lại lịch sử. */
  savedTick: number;
  /** Số phòng đang mở (chip ở menu, thẻ Tổng cộng); `null` = chưa biết. */
  roomCount: number | null;
  reportFailure(reason: AdminFailure): void;
  loadSettings(options?: { resetDraft?: boolean }): Promise<void>;
  setDraft(draft: PartyDraft): void;
  discardDraft(): void;
  markSaved(): void;
  setRoomCount(count: number | null): void;
  reset(): void;
}

/** Dấu thập phân của ô nhập theo ngôn ngữ đang chọn. */
export function decimalSeparator(): DecimalSeparator {
  return currentLanguage() === "vi" ? "," : ".";
}

const INITIAL = {
  lost: null,
  settings: { status: "loading" } as AdminLoad<AdminPartySettings>,
  draft: null,
  savedTick: 0,
  roomCount: null,
} satisfies Partial<AdminStore>;

/** Trạng thái dùng chung giữa các mục của trang quản trị. Rời trang thì `reset()`. */
export const useAdminStore = create<AdminStore>((set, get) => ({
  ...INITIAL,

  reportFailure(reason) {
    if (reason === "forbidden") set({ lost: "forbidden" });
    else if (reason === "no-session") set({ lost: "signin" });
  },

  async loadSettings(options) {
    if (get().settings.status !== "ok") set({ settings: { status: "loading" } });
    const res = await fetchPartySettings();
    if (!res.ok) {
      get().reportFailure(res.reason);
      // Đã có cấu hình thì giữ (lỗi tải lại sau khi lưu không làm mất bản nháp).
      if (get().settings.status !== "ok") set({ settings: { status: res.reason } });
      return;
    }
    const { draft } = get();
    set({
      settings: { status: "ok", data: res.data },
      draft:
        draft && !options?.resetDraft
          ? draft
          : draftFromConfig(res.data.scoring, res.data.disabledGames, decimalSeparator()),
    });
  },

  setDraft: (draft) => set({ draft }),

  discardDraft() {
    const { settings } = get();
    if (settings.status !== "ok") return;
    set({
      draft: draftFromConfig(
        settings.data.scoring,
        settings.data.disabledGames,
        decimalSeparator(),
      ),
    });
  },

  markSaved: () => set((s) => ({ savedTick: s.savedTick + 1 })),
  setRoomCount: (roomCount) => set({ roomCount }),
  reset: () => set(INITIAL),
}));
