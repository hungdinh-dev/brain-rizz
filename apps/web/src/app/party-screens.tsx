import { isChatPhase, type Phase } from "@brain-rizz/shared";
import { ChatDock } from "@/features/chat";
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

/**
 * Màn của pha hiện tại, kèm khung chat ở các pha có chat (CR-011). Lúc đếm ngược / đang chơi
 * màn đứng một mình như trước (khung chat gỡ hẳn, không chừa chỗ).
 */
export function PartyScreen({ phase }: { phase: Phase }) {
  const Screen = SCREENS[phase];
  if (!isChatPhase(phase)) return <Screen />;
  return (
    <div className="flex flex-1 gap-5">
      {/* Điện thoại: chừa đáy để nút chính không nằm dưới nút chat nổi (cách đáy màn ≥ 80 px). */}
      <div className="flex min-w-0 flex-1 flex-col max-lg:pb-12">
        <Screen />
      </div>
      <ChatDock phase={phase} />
    </div>
  );
}
