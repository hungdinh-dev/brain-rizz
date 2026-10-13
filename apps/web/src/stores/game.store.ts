import type { AnswerResultPayload, PartyStateView } from "@brain-rizz/shared";
import { create } from "zustand";

export type ConnectionStatus = "offline" | "online" | "reconnecting";

interface GameStore {
  sessionId: string;
  /** State đồng bộ từ server: nguồn chính cho vòng, seed, đồng hồ, tiến độ. */
  party: PartyStateView | null;
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

  setSession(id: string): void;
  setParty(party: PartyStateView): void;
  /** Tin `roundStart` tới: bỏ kết quả câu của vòng trước. */
  onRoundStart(): void;
  pushAnswerResult(result: AnswerResultPayload): void;
  pushError(): void;
  setClockOffset(offset: number): void;
  setConnection(status: ConnectionStatus): void;
  reset(): void;
}

const initial = {
  sessionId: "",
  party: null,
  lastAnswer: null,
  errorSeq: 0,
  clockOffset: 0,
  connection: "offline" as ConnectionStatus,
};

export const useGame = create<GameStore>((set) => ({
  ...initial,
  setSession: (sessionId) => set({ sessionId }),
  // State đồng bộ thắng tin nhắn một lần: seed đổi (sang vòng mới, kể cả khi tin `roundStart`
  // bị mất lúc SDK tự nối lại) thì bỏ kết quả câu trả lời của vòng cũ.
  setParty: (party) =>
    set((s) => (s.party?.seed === party.seed ? { party } : { party, lastAnswer: null })),
  onRoundStart: () => set({ lastAnswer: null }),
  pushAnswerResult: (lastAnswer) => set({ lastAnswer }),
  pushError: () => set((s) => ({ errorSeq: s.errorSeq + 1 })),
  setClockOffset: (clockOffset) => set({ clockOffset }),
  setConnection: (connection) => set({ connection }),
  reset: () => set(initial),
}));

/** Giờ server ước tính (ms epoch). */
export function serverNow() {
  return Date.now() + useGame.getState().clockOffset;
}

export function useMe() {
  return useGame((s) => (s.party ? s.party.players[s.sessionId] : undefined));
}
