import { useEffect } from "react";
import { resumeParty } from "./net/connection";
import { useGame } from "./store/game";
import { ConnectionBanner, Toast } from "./ui/components/Overlays";
import { GameScreen } from "./ui/screens/GameScreen";
import { HomeScreen } from "./ui/screens/HomeScreen";
import { LobbyScreen } from "./ui/screens/LobbyScreen";
import { ResultsScreen } from "./ui/screens/ResultsScreen";

export function App() {
  const party = useGame((s) => s.party);

  // Tải lại trang giữa trận → tự nối lại phòng cũ.
  useEffect(() => {
    void resumeParty();
  }, []);

  // Đồng bộ URL /r/<mã> để copy link mời được ngay từ thanh địa chỉ.
  const code = party?.code;
  useEffect(() => {
    if (code && location.pathname !== `/r/${code}`) history.replaceState(null, "", `/r/${code}`);
  }, [code]);

  return (
    <div className="safe-area mx-auto flex h-full max-w-5xl flex-col">
      <ConnectionBanner />
      {!party ? (
        <HomeScreen />
      ) : party.phase === "lobby" ? (
        <LobbyScreen />
      ) : party.phase === "countdown" || party.phase === "playing" ? (
        <GameScreen />
      ) : (
        <ResultsScreen />
      )}
      <Toast />
    </div>
  );
}
