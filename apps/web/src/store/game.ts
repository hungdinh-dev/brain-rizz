import type { AnswerResultPayload, PartyStateView, RoundStartPayload } from "@brain-rizz/shared";
import { create } from "zustand";

export type ConnectionStatus = "offline" | "online" | "reconnecting";

interface GameStore {
  sessionId: string;
  party: PartyStateView | null;
  round: RoundStartPayload | null;
  lastAnswer: AnswerResultPayload | null;
  /** serverTime ≈ Date.now() + clockOffset */
  clockOffset: number;
  connection: ConnectionStatus;
  toast: string | null;

  setSession(id: string): void;
  setParty(party: PartyStateView): void;
  setRound(round: RoundStartPayload): void;
  pushAnswerResult(result: AnswerResultPayload): void;
  setClockOffset(offset: number): void;
  setConnection(status: ConnectionStatus): void;
  setToast(message: string | null): void;
  reset(): void;
}

const initial = {
  sessionId: "",
  party: null,
  round: null,
  lastAnswer: null,
  clockOffset: 0,
  connection: "offline" as ConnectionStatus,
  toast: null,
};

export const useGame = create<GameStore>((set) => ({
  ...initial,
  setSession: (sessionId) => set({ sessionId }),
  setParty: (party) => set({ party }),
  setRound: (round) => set({ round, lastAnswer: null }),
  pushAnswerResult: (lastAnswer) => set({ lastAnswer }),
  setClockOffset: (clockOffset) => set({ clockOffset }),
  setConnection: (connection) => set({ connection }),
  setToast: (toast) => set({ toast }),
  reset: () => set(initial),
}));

/** Giờ server ước tính (ms epoch). */
export function serverNow() {
  return Date.now() + useGame.getState().clockOffset;
}

export function useMe() {
  return useGame((s) => (s.party ? s.party.players[s.sessionId] : undefined));
}
