import {
  BRAIN_TEST_COUNTDOWN_MS,
  BrainClientMessage,
  type BrainStateView,
  type GameId,
  isGameId,
} from "@brain-rizz/shared";
import { UnplugIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/EmptyState";
import { QuitDialog } from "@/components/common/QuitDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadProfile } from "@/features/home";
import { CountdownStage, SoloPlayView, waitUnlockDelay } from "@/features/play";
import { playSfx } from "@/features/sfx";
import type { MinigameBridge } from "@/games/types";
import { useData } from "@/hooks/use-data";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { hasStoredSession } from "@/lib/supabase";
import { leaveBrainTest, sendBrain, startBrainTest } from "@/net/connection";
import { fetchBrainHistory } from "@/net/data-api";
import { useGame } from "@/stores/game.store";
import { useNav } from "@/stores/nav.store";
import { BrainGameIntro } from "./components/BrainGameIntro";
import { BrainIntro } from "./components/BrainIntro";
import { BrainProgress } from "./components/BrainProgress";
import { BrainResult } from "./components/BrainResult";
import { BrainStep } from "./components/BrainStep";

/**
 * Kiểm tra não (UC-14, khu 14). Trước khi vào phòng: màn giới thiệu. Trong phòng `brain-test`
 * chọn màn theo pha: intro → countdown → playing → game-result → … → finished.
 * Server phát seed, giữ đồng hồ, chấm từng câu, tính Điểm Não và lưu (bất biến 2).
 */
export function BrainTestScreen() {
  const brain = useGame((s) => s.brain);
  const connection = useGame((s) => s.connection);
  const go = useNav((s) => s.go);
  const setSoloFocus = useNav((s) => s.setSoloFocus);
  const { t } = useTranslation();
  const [connecting, setConnecting] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const phase = brain?.phase;

  // Rời màn (về menu, sang bảng xếp hạng) → rời phòng; lượt dở bị huỷ, không lưu.
  useEffect(
    () => () => {
      if (useGame.getState().brain) void leaveBrainTest();
    },
    [],
  );

  useEffect(() => {
    setSoloFocus(phase === "countdown" || phase === "playing");
  }, [phase, setSoloFocus]);

  // Lịch sử cho màn giới thiệu ("Lần trước · Cao nhất"); chỉ khi máy đã có phiên.
  const history = useData(() => fetchBrainHistory(20), [brain === null], hasStoredSession());

  async function start() {
    if (connecting) return;
    setConnecting(true);
    try {
      const profile = loadProfile();
      await startBrainTest({ name: profile.name, avatar: profile.avatar });
    } catch {
      // UC-14 luồng rẽ 2a: ở lại màn giới thiệu.
      playSfx("error");
      toast.error(t("connection.failed"));
    } finally {
      setConnecting(false);
    }
  }

  async function exit(next: "menu" | "leaderboard" | "retake") {
    await leaveBrainTest();
    if (next === "retake") void start();
    else go(next);
  }

  if (!brain) {
    return (
      <BrainIntro
        history={history.status === "ok" ? history.data : null}
        connecting={connecting}
        onStart={() => void start()}
        onLeaderboard={() => go("leaderboard")}
        onBack={() => go("menu")}
      />
    );
  }

  // Server đóng phòng giữa lượt (hết thời gian giữ chỗ khi rớt mạng, server khởi động lại).
  if (connection === "offline" && brain.phase !== "finished") {
    return <ConnectionLost onBack={() => void exit("menu")} onRetake={() => void exit("retake")} />;
  }

  const quitDialog = (
    <QuitDialog
      open={confirmQuit}
      onOpenChange={setConfirmQuit}
      description={t("common.quitBrain")}
      onConfirm={() => {
        setConfirmQuit(false);
        void leaveBrainTest();
      }}
    />
  );

  let screen: React.ReactNode = null;
  if (brain.phase === "finished") {
    screen = (
      <BrainResult
        brain={brain}
        onLeaderboard={() => void exit("leaderboard")}
        onRetake={() => void exit("retake")}
        onMenu={() => void exit("menu")}
      />
    );
  } else if (brain.phase === "game-result") {
    screen = <BrainStep brain={brain} />;
  } else if (isGameId(brain.gameId)) {
    screen =
      brain.phase === "intro" ? (
        <BrainGameIntro brain={brain} gameId={brain.gameId} onQuit={() => setConfirmQuit(true)} />
      ) : (
        <BrainRound brain={brain} gameId={brain.gameId} onQuit={() => setConfirmQuit(true)} />
      );
  }

  return (
    <>
      {screen}
      {quitDialog}
    </>
  );
}

/** Đếm ngược 3 giây rồi khung chơi (pha `countdown` → `playing`). */
function BrainRound({
  brain,
  gameId,
  onQuit,
}: {
  brain: BrainStateView;
  gameId: GameId;
  onQuit(): void;
}) {
  const { t } = useTranslation();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const total = brain.games.length;
  const { seed, round, difficulty } = brain;
  // Bridge chỉ tạo lại khi sang game mới (seed đổi). `startIndex` đọc lúc tạo (nối lại giữa game).
  // biome-ignore lint/correctness/useExhaustiveDependencies: startIndex chỉ đọc lúc tạo bridge
  const bridge = useMemo<MinigameBridge>(
    () => ({
      seed,
      round,
      difficulty,
      startIndex: brain.progress,
      submit: (index, answer) => sendBrain(BrainClientMessage.Answer, { round, index, answer }),
      unlockDelay: waitUnlockDelay,
    }),
    [seed, round, difficulty],
  );

  const chip = (
    <span className="inline-flex h-6.5 shrink-0 items-center rounded-full bg-secondary px-2.75 font-display text-sm font-extrabold whitespace-nowrap text-secondary-foreground lg:h-9.5 lg:px-3.5 lg:text-xl">
      {/* Điện thoại: nhãn ngắn để không đè đồng hồ ở thanh trên. */}
      <span className="lg:hidden">{t("brainTest.gameOf", { n: round, total })}</span>
      <span className="hidden lg:inline">{t("brainTest.chip", { n: round, total })}</span>
    </span>
  );
  const progress = (
    <BrainProgress
      games={brain.games}
      round={round}
      phase={brain.phase}
      compact={!desktop || brain.phase === "playing"}
      className="w-full"
    />
  );

  if (brain.phase === "countdown") {
    return (
      <CountdownStage
        gameId={gameId}
        startAt={brain.startAt}
        totalMs={BRAIN_TEST_COUNTDOWN_MS}
        difficulty={difficulty}
        chip={chip}
        footer={<div className="w-full max-w-2xl">{progress}</div>}
      />
    );
  }

  const game = brain.games[round - 1];
  return (
    <SoloPlayView
      gameId={gameId}
      bridge={bridge}
      startAt={brain.startAt}
      endsAt={brain.endsAt}
      difficulty={difficulty}
      chip={chip}
      score={game?.score ?? 0}
      streak={brain.streak}
      aside={progress}
      onQuit={onQuit}
    />
  );
}

function ConnectionLost({ onBack, onRetake }: { onBack(): void; onRetake(): void }) {
  const { t } = useTranslation();
  return (
    <main className="flex flex-1 items-center justify-center">
      <Card className="w-full max-w-md">
        <EmptyState
          role="alert"
          icon={UnplugIcon}
          tone="bg-pink"
          title={t("brainTest.connectionLost")}
          action={
            <div className="flex flex-wrap justify-center gap-2.5">
              <Button onClick={onRetake}>{t("brainTest.retake")}</Button>
              <Button variant="outline" data-sfx="back" onClick={onBack}>
                {t("common.backToMenu")}
              </Button>
            </div>
          }
        />
      </Card>
    </main>
  );
}
