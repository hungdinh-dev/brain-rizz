import { GAMES, type GameId } from "@brain-rizz/shared";
import { PauseIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { type ReactNode, type RefObject, useState } from "react";
import { useTranslation } from "react-i18next";
import { CategoryChip } from "@/components/common/MatchChips";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useReducedMotion } from "@/features/motion";
import { GAME_CLIENTS } from "@/games/registry";
import { useGameText } from "@/hooks/use-game-text";
import { cn } from "@/lib/utils";
import { GameDemo } from "./GameDemo";
import { ControlsLine, ScoringLine, StepList } from "./GuideParts";

interface GuideZoomProps {
  gameId: GameId;
  /** Điện thoại: sheet từ dưới lên; máy tính: hộp thoại. */
  compact?: boolean;
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Nút Phóng to: nhận lại focus khi đóng hộp (mở không qua DialogTrigger nên Radix không tự trả). */
  returnFocus: RefObject<HTMLButtonElement | null>;
}

/**
 * Hộp Phóng to (UI-UX 6.11): chỉ hình minh hoạ + cách chơi, không độ khó, không nút chính. Hình lặp
 * mãi, có Dừng/Chạy + Xem lại. Đóng bằng Esc, lớp phủ, × hoặc "Đóng" (điện thoại); focus trả về
 * nút Phóng to.
 */
export function GuideZoom({ gameId, compact, open, onOpenChange, returnFocus }: GuideZoomProps) {
  const { t } = useTranslation();
  const game = useGameText(gameId);
  const category = GAMES[gameId].category;

  function onCloseAutoFocus(event: Event) {
    event.preventDefault();
    returnFocus.current?.focus();
  }

  if (compact) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          onCloseAutoFocus={onCloseAutoFocus}
          closeLabel={t("intro.demoClose")}
          className="h-[calc(100dvh_-_40px)] gap-3 overflow-y-auto rounded-t-[28px] p-4"
        >
          <div className="flex min-h-11 flex-wrap items-center gap-2.5 pr-12">
            <SheetTitle className="text-2xl leading-[1.1]">{game.title}</SheetTitle>
            <CategoryChip category={category} />
          </div>
          <SheetDescription className="sr-only">{game.summary}</SheetDescription>
          <ZoomStage gameId={gameId} compact />
          <StepList steps={game.steps} size="zoomCompact" className="mt-1" />
          <div className="border-t-2 border-dashed border-sticker/30" />
          <ControlsLine gameId={gameId} className="text-[13.5px]" />
          <ScoringLine className="-mt-1 text-[13.5px]" />
          <SheetClose asChild>
            <Button variant="outline" className="mt-auto min-h-13 w-full text-[17px]">
              {t("intro.demoClose")}
            </Button>
          </SheetClose>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        closeLabel={t("intro.demoClose")}
        className="max-w-[936px] gap-3.5 rounded-[28px] px-6 pt-4.5 pb-5"
      >
        <div className="flex min-h-11 flex-wrap items-center gap-3 pr-12">
          <DialogTitle className="text-[30px]">{game.title}</DialogTitle>
          <CategoryChip category={category} />
        </div>
        <DialogDescription className="sr-only">{game.summary}</DialogDescription>
        <ZoomStage gameId={gameId}>
          <ControlsLine gameId={gameId} className="ml-auto text-sm" />
        </ZoomStage>
        <StepList steps={game.steps} size="zoom" />
        <ScoringLine
          className="text-[13.5px] text-muted-foreground"
          labelClassName="text-card-foreground"
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Sân khấu lớn + hàng nút Dừng/Chạy, Xem lại (ẩn khi giảm chuyển động hoặc game chưa có Demo).
 * Nằm trong nội dung hộp nên mỗi lần mở là chạy lại từ đầu.
 */
function ZoomStage({
  gameId,
  compact,
  children,
}: {
  gameId: GameId;
  compact?: boolean;
  /** Phần thêm bên phải hàng nút (máy tính: "Điều khiển:"). */
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const game = useGameText(gameId);
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [run, setRun] = useState(0);
  const animated = Boolean(GAME_CLIENTS[gameId].Demo) && !reduced;

  return (
    <>
      <div
        role="img"
        aria-label={t("intro.demoLabel", { name: game.title })}
        className={cn(
          "relative aspect-video w-full shrink-0 overflow-hidden border-3 border-sticker bg-board",
          compact ? "rounded-[14px]" : "max-h-[calc(100dvh_-_300px)] rounded-[18px]",
        )}
      >
        <GameDemo
          key={run}
          gameId={gameId}
          className="absolute inset-0 size-full"
          playing={!paused}
        />
      </div>
      {(animated || children) && (
        <div className="flex flex-wrap items-center gap-2.5">
          {animated && (
            <>
              <Button
                variant="outline"
                aria-pressed={paused}
                onClick={() => setPaused((p) => !p)}
                className="min-h-11 rounded-[14px] px-4 text-[15px]"
              >
                {paused ? (
                  <PlayIcon aria-hidden className="size-4.5 fill-current" />
                ) : (
                  <PauseIcon aria-hidden className="size-4.5 fill-current" />
                )}
                {paused ? t("intro.demoPlay") : t("intro.demoStop")}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPaused(false);
                  setRun((n) => n + 1);
                }}
                className="min-h-11 rounded-[14px] px-4 text-[15px]"
              >
                <RotateCcwIcon aria-hidden className="size-4.5" />
                {t("intro.demoReplay")}
              </Button>
            </>
          )}
          {children}
        </div>
      )}
    </>
  );
}
