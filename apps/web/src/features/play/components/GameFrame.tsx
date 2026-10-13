import type { GameId } from "@brain-rizz/shared";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PhaserHost, preloadGame, type SceneStatus } from "@/games/PhaserHost";
import type { MinigameBridge } from "@/games/types";
import { useServerTimeReached } from "@/hooks/use-server-time-reached";
import { cn } from "@/lib/utils";
import { useGame } from "@/stores/game.store";
import {
  CountdownPanel,
  LockBadge,
  PointsPop,
  ReconnectOverlay,
  SceneError,
  SceneLoading,
  TimeUpOverlay,
} from "./FrameOverlays";

interface GameFrameProps {
  gameId: GameId;
  bridge: MinigameBridge;
  startAt: number;
  endsAt: number;
  howTo: string;
  className?: string;
}

/**
 * Thẻ giấy chứa canvas Phaser (khung 720×1280 thu nhỏ vừa khít) và các lớp trạng thái:
 * đếm ngược, đang tải, lỗi tải, khoá sau khi sai, điểm cộng, hết giờ, mất kết nối.
 */
export function GameFrame({ gameId, bridge, startAt, endsAt, howTo, className }: GameFrameProps) {
  const { t } = useTranslation();
  const started = useServerTimeReached(startAt);
  const timeUp = useServerTimeReached(endsAt);
  const reconnecting = useGame((s) => s.connection === "reconnecting");
  const [status, setStatus] = useState<SceneStatus>("loading");

  // Tải trước scene trong lúc đếm ngược để hết đếm là chơi được ngay.
  useEffect(() => preloadGame(gameId), [gameId]);

  return (
    <section
      aria-label={t("play.frame")}
      className={cn(
        "relative overflow-hidden rounded-3xl border-[3px] border-sticker bg-muted text-card-foreground shadow-sticker",
        className,
      )}
    >
      {started ? (
        <PhaserHost gameId={gameId} bridge={bridge} onStatus={setStatus} />
      ) : (
        <CountdownPanel startAt={startAt} howTo={howTo} />
      )}
      {started && status === "loading" && <SceneLoading />}
      {started && status === "error" && <SceneError />}
      {started && status === "ready" && (
        <>
          <LockBadge />
          <PointsPop />
        </>
      )}
      {started && timeUp && <TimeUpOverlay />}
      {reconnecting && !timeUp && <ReconnectOverlay />}
    </section>
  );
}
