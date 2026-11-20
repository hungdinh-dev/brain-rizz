import type { AnswerResultPayload, BrainStateView, PartyStateView } from "@brain-rizz/shared";
import { create } from "zustand";

export type ConnectionStatus = "offline" | "online" | "reconnecting";

/**
 * State phiên chơi đang mở. Mỗi lúc chỉ một: phòng party (`party`), phòng Kiểm tra não (`brain`),
 * hoặc lượt Luyện tập chạy trên máy (cả hai `null`; chỉ dùng `lastAnswer`).
 * `lastAnswer`, `clockOffset`, `connection`, `errorSeq` dùng chung cho cả ba để khung chơi
 * (khoá sau câu sai, +điểm, âm thanh đúng/sai, nút chờ phản hồi) chạy giống nhau.
 */
interface GameStore {
  sessionId: string;
  /** State đồng bộ từ server: nguồn chính cho vòng, seed, đồng hồ, tiến độ. */
  party: PartyStateView | null;
  /** State phòng Kiểm tra não (UC-14). */
  brain: BrainStateView | null;
  /**
   * Kết quả câu vừa trả lời (tin một lần). Bỏ khi sang vòng mới: tin `roundStart` tới,
   * hoặc seed trong state đổi (phòng khi tin đó mất lúc SDK tự nối lại).
   */
  lastAnswer: AnswerResultPayload | null;
  /** Tăng mỗi lần server báo lỗi — nút đang chờ phản hồi (usePendingAction) mở khoá lại. */
  errorSeq: number;
  /** serverTime ≈ Date.now() + clockOffset */
  clockOffset: number;
  connection: ConnectionStatus;
  /**
   * Phấn vừa nhận sau trận party (`ServerMessage.Reward`, CR-023), đã kẹp trần ngày; `null` = chưa
   * nhận (khách không phiên, chưa xong trận). Bỏ khi phòng rời pha vinh danh (chơi lại / về phòng chờ).
   */
  reward: number | null;

  setSession(id: string): void;
  setParty(party: PartyStateView): void;
  setBrain(brain: BrainStateView): void;
  /** Tin `roundStart` tới: bỏ kết quả câu của vòng trước. */
  onRoundStart(): void;
  pushAnswerResult(result: AnswerResultPayload | null): void;
  pushError(): void;
  setClockOffset(offset: number): void;
  setConnection(status: ConnectionStatus): void;
  setReward(chalk: number): void;
  reset(): void;
}

const initial = {
  sessionId: "",
  party: null,
  brain: null,
  lastAnswer: null,
  errorSeq: 0,
  clockOffset: 0,
  connection: "offline" as ConnectionStatus,
  reward: null,
};

export const useGame = create<GameStore>((set) => ({
  ...initial,
  setSession: (sessionId) => set({ sessionId }),
  // State đồng bộ thắng tin nhắn một lần: seed đổi (sang vòng mới, kể cả khi tin `roundStart`
  // bị mất lúc SDK tự nối lại) thì bỏ kết quả câu trả lời của vòng cũ.
  setParty: (party) =>
    set((s) => ({
      party,
      ...(s.party?.seed === party.seed ? {} : { lastAnswer: null }),
      // Phấn chỉ hiện ở vinh danh của trận vừa xong: rời vinh danh (chơi lại, về phòng chờ) thì bỏ.
      ...(s.party?.phase === "podium" && party.phase !== "podium" ? { reward: null } : {}),
    })),
  setBrain: (brain) =>
    set((s) => (s.brain?.seed === brain.seed ? { brain } : { brain, lastAnswer: null })),
  onRoundStart: () => set({ lastAnswer: null }),
  pushAnswerResult: (lastAnswer) => set({ lastAnswer }),
  pushError: () => set((s) => ({ errorSeq: s.errorSeq + 1 })),
  setClockOffset: (clockOffset) => set({ clockOffset }),
  setConnection: (connection) => set({ connection }),
  setReward: (chalk) =>
    set({ reward: Number.isFinite(chalk) ? Math.max(0, Math.floor(chalk)) : 0 }),
  reset: () => set(initial),
}));

/** Giờ server ước tính (ms epoch). Luyện tập cũng dùng đồng hồ này (lúc đó độ lệch = 0). */
export function serverNow() {
  return Date.now() + useGame.getState().clockOffset;
}

export function useMe() {
  return useGame((s) => (s.party ? s.party.players[s.sessionId] : undefined));
}
