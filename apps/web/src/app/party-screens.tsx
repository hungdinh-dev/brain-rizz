import type { Phase } from "@brain-rizz/shared";
import { GameIntroScreen } from "@/features/game-intro";
import { GameSelectScreen } from "@/features/game-select";
import { LobbyScreen } from "@/features/lobby";
import { CountdownScreen, PlayScreen } from "@/features/play";
import { PodiumScreen, ResultsScreen } from "@/features/results";
import { registerGameLocales } from "@/i18n/games";

/*
 * Các màn trong phòng party, tải lười thành chunk riêng (cùng registry minigame: chữ + hình minh hoạ)
 * để gói đầu chỉ có menu (NFR-PERF-01). App tải trước chunk này lúc rảnh ở menu.
 */
registerGameLocales();

/** Màn hình theo pha của phòng (CR-005): lobby → game-select → game-intro → countdown → playing → round-results → podium. */
const SCREENS: Record<Phase, () => React.ReactNode> = {
  lobby: LobbyScreen,
  "game-select": GameSelectScreen,
  "game-intro": GameIntroScreen,
  countdown: CountdownScreen,
  playing: PlayScreen,
  "round-results": ResultsScreen,
  podium: PodiumScreen,
};

export function PartyScreen({ phase }: { phase: Phase }) {
  const Screen = SCREENS[phase];
  return <Screen />;
}
