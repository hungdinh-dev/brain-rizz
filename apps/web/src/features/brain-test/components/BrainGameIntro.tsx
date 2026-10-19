import { BrainClientMessage, type BrainStateView, GAMES, type GameId } from "@brain-rizz/shared";
import { LockIcon, LogOutIcon, PlayIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CategoryChip } from "@/components/common/MatchChips";
import { Button } from "@/components/ui/button";
import { GuideCard } from "@/features/game-intro";
import { useGameText } from "@/hooks/use-game-text";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { usePendingAction } from "@/hooks/use-pending-action";
import { sendBrain } from "@/net/connection";
import { BrainProgress } from "./BrainProgress";

interface BrainGameIntroProps {
  brain: BrainStateView;
  gameId: GameId;
  onQuit(): void;
}

/**
 * Hướng dẫn trước mỗi game Kiểm tra não (pha `intro`, khu 14 — dùng lại khu 7): bỏ bảng cả phòng
 * và đồng hồ 20 giây, ô độ khó thay bằng nhãn "Thường · cố định", nút "Sẵn sàng" → đếm ngược.
 */
export function BrainGameIntro({ brain, gameId, onQuit }: BrainGameIntroProps) {
  const { t } = useTranslation();
  const game = useGameText(gameId);
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const ready = usePendingAction(`${brain.phase}:${brain.round}`);
  const total = brain.games.length;
  const category = GAMES[gameId].category;

  const fixed = (
    <span className="inline-flex h-9 items-center gap-1.5 self-start rounded-full border-[2.5px] border-sticker bg-secondary px-3.5 text-[15px] font-bold text-secondary-foreground">
      <LockIcon aria-hidden className="size-4" strokeWidth={2.6} />
      {t("brainTest.fixedShort", { level: t(`difficulty.${brain.difficulty}`) })}
    </span>
  );

  const readyButton = (
    <Button
      size="lg"
      data-sfx="confirm"
      disabled={ready.pending}
      onClick={() => ready.run(() => sendBrain(BrainClientMessage.Ready, {}))}
      className="min-h-14.5 w-full rounded-[18px] border-4 text-[26px] lg:min-h-15.5 lg:w-75"
    >
      {t("brainTest.ready")}
      <PlayIcon aria-hidden className="size-6 fill-current" />
    </Button>
  );

  const header = (
    <header className="flex flex-wrap items-center gap-3">
      <span className="inline-flex h-8.5 items-center rounded-full bg-secondary px-3.5 font-display text-base font-extrabold whitespace-nowrap text-secondary-foreground lg:h-9.5 lg:text-xl">
        {t("brainTest.chip", { n: brain.round, total })}
      </span>
      <BrainProgress
        games={brain.games}
        round={brain.round}
        phase={brain.phase}
        compact={!desktop}
        className="order-last w-full lg:order-none lg:w-auto lg:flex-1"
      />
      <Button
        variant="chalk"
        size="sm"
        data-sfx="back"
        onClick={onQuit}
        className="ml-auto h-10 px-3.5 lg:ml-0"
      >
        <LogOutIcon aria-hidden />
        {t("common.quit")}
      </Button>
    </header>
  );

  if (desktop) {
    return (
      <main className="flex flex-1 flex-col gap-4">
        {header}
        <div className="flex min-h-0 flex-1 gap-5">
          <GuideCard gameId={gameId} className="w-117.5 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-3.5">
            <section className="flex flex-col gap-3 rounded-[22px] border-4 border-sticker bg-card px-4.5 pt-3.5 pb-4 text-card-foreground shadow-sticker">
              <h2 className="font-display text-[22px] leading-tight font-extrabold">
                {t("intro.yourDifficulty")}
              </h2>
              {fixed}
              <p className="text-sm text-muted-foreground">{game.levels[brain.difficulty]}</p>
            </section>
            <p className="text-[15px] text-chalk">{t("brainTest.readyHint")}</p>
            <div className="mt-auto flex justify-end">{readyButton}</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-3">
      {header}
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="font-display text-[32px] leading-none font-extrabold text-chalk">
          {game.title}
        </h1>
        <CategoryChip category={category} />
      </div>
      <GuideCard gameId={gameId} compact />
      {fixed}
      <p className="text-[13px] text-chalk-muted">{t("brainTest.readyHint")}</p>
      <div className="mt-auto pt-2">{readyButton}</div>
    </main>
  );
}
