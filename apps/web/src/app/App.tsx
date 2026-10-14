import type { Phase } from "@brain-rizz/shared";
import { useEffect } from "react";
import { ChalkDefs } from "@/components/brand";
import { ConnectionBanner } from "@/components/common/ConnectionBanner";
import { LanguageToggle } from "@/components/common/LanguageToggle";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Toaster } from "@/components/ui/sonner";
import { GameIntroScreen } from "@/features/game-intro";
import { GameSelectScreen } from "@/features/game-select";
import { HomeScreen } from "@/features/home";
import { LobbyScreen } from "@/features/lobby";
import { MusicBar, useMusicAutoplay } from "@/features/music";
import { CountdownScreen, PlayScreen } from "@/features/play";
import { PodiumScreen, ResultsScreen } from "@/features/results";
import { resumeParty } from "@/net/connection";
import { useGame } from "@/stores/game.store";

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

/** Pha cần tập trung: ẩn nút ngôn ngữ/theme/nhạc để nhường chỗ, nhạc nền nhỏ lại. */
const FOCUS_PHASES: readonly Phase[] = ["countdown", "playing"];

/** Chọn màn hình theo pha của phòng — app không dùng router. */
export function App() {
  const party = useGame((s) => s.party);
  const phase = party?.phase;
  const focused = !!phase && FOCUS_PHASES.includes(phase);

  // Nhạc nền: phát ở thao tác đầu tiên, dừng khi ẩn tab, nhỏ tiếng lúc đếm ngược/đang chơi.
  useMusicAutoplay(focused);

  // Tải lại trang giữa trận → tự nối lại phòng cũ.
  useEffect(() => {
    void resumeParty();
  }, []);

  // Đồng bộ URL /r/<mã> để copy link mời được ngay từ thanh địa chỉ.
  const code = party?.code;
  useEffect(() => {
    if (code && location.pathname !== `/r/${code}`) history.replaceState(null, "", `/r/${code}`);
  }, [code]);

  const Screen = phase ? SCREENS[phase] : HomeScreen;

  return (
    // Khung gỗ (nền body) bao quanh mặt bảng phấn; mép dưới dày hơn làm khay phấn.
    <div className="relative h-full p-1.5 pb-4 md:p-3 md:pb-7">
      <div className="chalkboard relative flex h-full flex-col overflow-x-hidden overflow-y-auto rounded-xl bg-background text-foreground">
        <ChalkDefs />
        <div className="safe-area mx-auto flex w-full max-w-6xl flex-1 flex-col">
          {/* Trang chủ tự đặt nút ngôn ngữ/theme/nhạc; lúc đếm ngược và đang chơi thì ẩn */}
          {phase && !focused && (
            <div className="mb-3 flex flex-wrap justify-end gap-2">
              <MusicBar />
              <LanguageToggle />
              <ThemeToggle />
            </div>
          )}
          <ConnectionBanner />
          <Screen />
        </div>
      </div>
      <ChalkTray />
      <Toaster position="bottom-center" />
    </div>
  );
}

/** Mấy viên phấn và cục lau bảng nằm trên khay (chỉ trang trí, ẩn trên điện thoại). */
function ChalkTray() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-1.5 hidden md:block">
      <span className="absolute bottom-0 left-[20%] h-2.5 w-12 rounded-full bg-paper" />
      <span className="absolute bottom-0 left-[calc(20%+56px)] h-2.5 w-8 rounded-full bg-pink" />
      <span className="absolute bottom-0 left-[calc(20%+100px)] h-2.5 w-7 rounded-full bg-sun" />
      <span className="absolute right-[22%] bottom-0 h-5 w-24 rounded-md border-t-[6px] border-[#d9cfbd] bg-ink/85" />
    </div>
  );
}
