import type { GameId } from "@brain-rizz/shared";
import { Maximize2Icon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { type Ref, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/features/motion";
import { GAME_CLIENTS } from "@/games/registry";
import { useGameText } from "@/hooks/use-game-text";
import { cn } from "@/lib/utils";
import { GameDemo } from "./GameDemo";

/** Thẻ hướng dẫn chạy tối đa 3 vòng rồi đứng ở khung tĩnh + "Xem lại" (UI-UX 6.11). */
const CARD_LOOPS = 3;

interface DemoFrameProps {
  gameId: GameId;
  /** Điện thoại: khung 16:9 rộng hết thẻ. Máy tính: thêm trần chiều cao cho màn thấp. */
  compact?: boolean;
  /** Hộp Phóng to đang mở: dừng hình ở thẻ (một hình động mỗi lúc). */
  zoomOpen: boolean;
  onZoom(): void;
  /** Nút Phóng to (hộp Phóng to trả focus về đây khi đóng). */
  zoomRef?: Ref<HTMLButtonElement>;
}

/**
 * Khung minh hoạ lớn của thẻ hướng dẫn: 16:9 rộng hết thẻ, viền mực 3, bo 14. Chạm khung = Dừng /
 * Chạy (WCAG 2.2.2), hết 3 vòng thì "Xem lại", góc trên phải luôn có nút Phóng to.
 */
export function DemoFrame({ gameId, compact, zoomOpen, onZoom, zoomRef }: DemoFrameProps) {
  const { t } = useTranslation();
  const game = useGameText(gameId);
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  const [run, setRun] = useState(0);
  // Giảm chuyển động / chưa có Demo: khung tĩnh, không phủ, không nút Dừng.
  const animated = Boolean(GAME_CLIENTS[gameId].Demo) && !reduced;
  const canPause = animated && !ended;

  function replay() {
    setEnded(false);
    setPaused(false);
    setRun((n) => n + 1);
  }

  return (
    <div
      className={cn(
        "relative aspect-video w-full shrink-0 overflow-hidden rounded-[14px] border-3 border-sticker bg-board",
        // Màn máy tính thấp hơn 800: khung thấp lại, sân khấu tự co giữa khung.
        !compact && "max-h-[max(160px,calc(100dvh_-_560px))]",
      )}
    >
      <div
        role="img"
        aria-label={t("intro.demoLabel", { name: game.title })}
        className="absolute inset-0"
      >
        <GameDemo
          key={run}
          gameId={gameId}
          className="size-full"
          playing={!paused && !zoomOpen}
          loops={CARD_LOOPS}
          onEnd={() => setEnded(true)}
        />
      </div>
      {canPause && (
        <button
          type="button"
          aria-label={t("intro.demoPause")}
          aria-pressed={paused}
          onClick={() => setPaused((p) => !p)}
          className="absolute inset-0 z-1 cursor-pointer rounded-[11px] outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset"
        />
      )}
      {canPause && paused && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-1 grid place-items-center bg-sticker/28"
        >
          <span className="grid size-14 place-items-center rounded-full border-3 border-sticker bg-primary text-primary-foreground shadow-sticker-sm">
            <PlayIcon className="size-6.5 translate-x-0.5 fill-current" />
          </span>
        </div>
      )}
      {animated && ended && (
        <div className="pointer-events-none absolute inset-0 z-1 grid place-items-center">
          <Button
            data-sfx="confirm"
            onClick={replay}
            className="pointer-events-auto min-h-11 rounded-full px-4 text-[15px]"
          >
            <RotateCcwIcon aria-hidden className="size-4.5" />
            {t("intro.demoReplay")}
          </Button>
        </div>
      )}
      <button
        ref={zoomRef}
        type="button"
        aria-label={t("intro.demoZoom")}
        title={t("intro.demoZoomShort")}
        onClick={onZoom}
        className="absolute top-1.5 right-1.5 z-2 grid size-9 cursor-pointer place-items-center rounded-[11px] border-2 border-chalk/85 bg-sticker/55 text-chalk outline-none after:absolute after:-inset-[5px] hover:bg-sticker/75 focus-visible:ring-3 focus-visible:ring-ring"
      >
        <Maximize2Icon aria-hidden className="size-4.5" />
      </button>
    </div>
  );
}
