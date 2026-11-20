import { type Difficulty, GAMES, type GameId } from "@brain-rizz/shared";
import { ChevronLeftIcon, PlayIcon, TrophyIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CategoryChip } from "@/components/common/MatchChips";
import { Button } from "@/components/ui/button";
import { DifficultyChooser, GuideCard } from "@/features/game-intro";
import { useGameText } from "@/hooks/use-game-text";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useNumberFormat } from "@/hooks/use-number-format";
import { bestFor, type PracticeRecords } from "../records";
import { SetupFavoriteButton } from "./FavoriteStar";

interface PracticeSetupProps {
  gameId: GameId;
  difficulty: Difficulty;
  records: PracticeRecords;
  onDifficulty(d: Difficulty): void;
  onStart(): void;
  onOtherGame(): void;
}

/**
 * Luyện tập · hướng dẫn & độ khó (khu 13, dùng lại khu 7): không có bảng cả phòng, không đồng hồ
 * 20 giây; dưới ô độ khó ghi kỷ lục ở mức đang chọn; nút chính "Bắt đầu".
 */
export function PracticeSetup({
  gameId,
  difficulty,
  records,
  onDifficulty,
  onStart,
  onOtherGame,
}: PracticeSetupProps) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const game = useGameText(gameId);
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const best = bestFor(records, gameId, difficulty);

  const back = (
    <Button variant="chalk" size="sm" data-sfx="back" onClick={onOtherGame} className="h-10 px-3">
      <ChevronLeftIcon aria-hidden />
      {t("practice.otherGame")}
    </Button>
  );

  const levelBest = (
    <p aria-live="polite" className="flex items-center gap-2 text-[13.5px] font-bold">
      <TrophyIcon aria-hidden className="size-4.5" strokeWidth={2.2} />
      {best ? t("practice.levelBest", { score: fmt(best.score) }) : t("practice.levelNoBest")}
    </p>
  );

  const start = (
    <Button
      size="lg"
      data-sfx="confirm"
      onClick={onStart}
      className="min-h-14.5 w-full rounded-[18px] border-4 text-[26px] lg:min-h-15.5 lg:w-75"
    >
      {t("practice.start")}
      <PlayIcon aria-hidden className="size-6 fill-current" />
    </Button>
  );

  const chooser = (
    <DifficultyChooser value={difficulty} onChange={onDifficulty} levels={game.levels} />
  );

  if (desktop) {
    return (
      <main className="flex flex-1 flex-col gap-4">
        <header className="flex min-h-13 items-center gap-4">
          {back}
          <span className="inline-flex h-9.5 items-center rounded-full bg-secondary px-3.5 font-display text-xl font-extrabold text-secondary-foreground">
            {t("practice.chip")}
          </span>
          <h1 className="sticker-text font-display text-[40px] leading-none font-extrabold text-paper [--stroke:7px]">
            {t("intro.title")}
          </h1>
          <SetupFavoriteButton gameId={gameId} name={game.title} withLabel className="ml-auto" />
        </header>
        <div className="flex min-h-0 flex-1 gap-5">
          <GuideCard gameId={gameId} className="w-117.5 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-3.5">
            <section className="flex flex-col gap-2.5 rounded-[22px] border-4 border-sticker bg-card px-4.5 pt-3.5 pb-4 text-card-foreground shadow-sticker">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-[22px] leading-tight font-extrabold">
                  {t("intro.yourDifficulty")}
                </h2>
                <span className="text-[13px] text-muted-foreground">{t("intro.defaultLast")}</span>
              </div>
              {chooser}
              {levelBest}
            </section>
            <p className="text-sm text-chalk-muted">{t("practice.notRanked")}</p>
            <div className="mt-auto flex justify-end">{start}</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-3">
      <header className="flex min-h-10 items-center gap-2.5">
        {back}
        <SetupFavoriteButton gameId={gameId} name={game.title} className="ml-auto" />
      </header>
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="font-display text-[28px] leading-none font-extrabold text-chalk">
          {game.title}
        </h1>
        <CategoryChip category={GAMES[gameId].category} />
      </div>
      <GuideCard gameId={gameId} compact />
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-[19px] font-extrabold text-chalk">
            {t("intro.yourDifficulty")}
          </span>
          <span className="text-xs text-chalk-muted">{t("intro.defaultLast")}</span>
        </div>
        {chooser}
        <div className="text-chalk">{levelBest}</div>
      </div>
      <div className="mt-auto pt-2">{start}</div>
    </main>
  );
}
