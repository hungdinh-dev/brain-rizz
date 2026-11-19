import { GAMES, type GameId } from "@brain-rizz/shared";
import { ZapIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CategoryChip } from "@/components/common/MatchChips";
import { Card } from "@/components/ui/card";
import { useGameText } from "@/hooks/use-game-text";
import { cn } from "@/lib/utils";
import { DemoFrame } from "./DemoFrame";
import { ControlsLine, ScoringLine, StepList, useLockSeconds } from "./GuideParts";
import { GuideZoom } from "./GuideZoom";

interface GuideCardProps {
  gameId: GameId;
  /** Bản gọn cho điện thoại: tên game nằm ngoài thẻ, tính điểm gọn một dòng (đủ trong Phóng to). */
  compact?: boolean;
  className?: string;
}

/**
 * Thẻ hướng dẫn (UI-UX 6.11): khung minh hoạ 16:9 rộng hết thẻ (hình động nếu game có `Demo`,
 * không thì hình tĩnh) + nút Phóng to, cách chơi 3 bước, điều khiển và tính điểm. Dùng ở Hướng dẫn
 * party, Luyện tập và Kiểm tra não.
 */
export function GuideCard({ gameId, compact, className }: GuideCardProps) {
  const { t } = useTranslation();
  const game = useGameText(gameId);
  const lockSeconds = useLockSeconds();
  const [zoomOpen, setZoomOpen] = useState(false);
  const zoomRef = useRef<HTMLButtonElement>(null);

  const frame = (
    // Đổi game (vòng party mới) thì khung chạy lại từ đầu.
    <DemoFrame
      key={gameId}
      gameId={gameId}
      compact={compact}
      zoomOpen={zoomOpen}
      onZoom={() => setZoomOpen(true)}
      zoomRef={zoomRef}
    />
  );
  const zoom = (
    <GuideZoom
      gameId={gameId}
      compact={compact}
      open={zoomOpen}
      onOpenChange={setZoomOpen}
      returnFocus={zoomRef}
    />
  );
  const stepsTitle = <h3 className="sr-only">{t("intro.howToPlay")}</h3>;

  if (compact) {
    return (
      <Card className={cn("gap-2.5 rounded-[18px] border-[3.5px] p-3", className)}>
        {frame}
        {stepsTitle}
        <StepList steps={game.steps} size="card" />
        <p className="-mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ZapIcon aria-hidden className="size-3.5 shrink-0 text-card-foreground" />
          {t("intro.scoringShort", { seconds: lockSeconds })}
        </p>
        {zoom}
      </Card>
    );
  }

  return (
    <Card className={cn("gap-3 rounded-3xl border-4 px-5 py-4.5", className)}>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-[40px] leading-none font-extrabold">{game.title}</h2>
          <CategoryChip category={GAMES[gameId].category} className="h-7 text-sm" />
        </div>
        <p className="text-sm text-muted-foreground">{game.summary}</p>
      </div>
      {frame}
      {stepsTitle}
      <StepList steps={game.steps} size="cardDesktop" />
      <div className="border-t-2 border-dashed border-sticker/15" />
      <ControlsLine gameId={gameId} className="text-[13.5px]" />
      <ScoringLine className="-mt-1 text-[13.5px]" />
      {zoom}
    </Card>
  );
}
