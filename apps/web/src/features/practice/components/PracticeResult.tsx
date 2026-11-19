import { DIFFICULTIES, type Difficulty, GAMES, type GameId } from "@brain-rizz/shared";
import {
  CloudCheckIcon,
  CloudOffIcon,
  LayoutGridIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  TrophyIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { BrainMascot } from "@/components/brand";
import { CategoryChip, DifficultyChip } from "@/components/common/MatchChips";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/features/results";
import { useGameText } from "@/hooks/use-game-text";
import { useNumberFormat } from "@/hooks/use-number-format";
import { cn } from "@/lib/utils";
import type { PracticeOutcome, SyncStatus } from "../practice.store";
import { bestFor, type PracticeRecords } from "../records";

interface PracticeResultProps {
  gameId: GameId;
  difficulty: Difficulty;
  outcome: PracticeOutcome;
  records: PracticeRecords;
  sync: SyncStatus;
  onPlayAgain(): void;
  onChangeLevel(): void;
  onOtherGame(): void;
}

/** Luyện tập · kết quả lượt (khu 13): điểm, dấu "Kỷ lục mới!", bảng kỷ lục 4 mức, 3 nút. */
export function PracticeResult({
  gameId,
  difficulty,
  outcome,
  records,
  sync,
  onPlayAgain,
  onChangeLevel,
  onOtherGame,
}: PracticeResultProps) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const game = useGameText(gameId);
  const { score, previous, isNewBest } = outcome;
  const best = previous?.score ?? 0;

  const scoreLine = isNewBest
    ? previous
      ? t("practice.beatBy", { n: fmt(score - best) })
      : t("practice.firstRecord")
    : null;
  const recordLine =
    !isNewBest && previous
      ? score === best
        ? t("practice.equalLine", { best: fmt(best) })
        : t("practice.toBeatLine", { best: fmt(best), n: fmt(best - score) })
      : null;

  const stats = [
    { value: fmt(outcome.correct), label: t("practice.statCorrect") },
    { value: fmt(outcome.wrong), label: t("practice.statWrong") },
    {
      value: t("practice.streakValue", { n: outcome.bestStreak }),
      label: t("practice.statStreak"),
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-3.5 lg:gap-4.5">
      <header className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-8 items-center rounded-full bg-secondary px-3 font-display text-[15px] font-extrabold text-secondary-foreground lg:h-9 lg:px-4 lg:text-[17px]">
            {t("practice.chip")}
          </span>
          <CategoryChip category={GAMES[gameId].category} />
          <DifficultyChip difficulty={difficulty} className="h-6.5 px-2.5 text-[13px]" />
        </div>
        <h1 className="font-display text-[28px] leading-tight font-extrabold text-chalk lg:ml-1.5 lg:text-[38px] lg:leading-none">
          {t("practice.resultTitle", { game: game.title })}
        </h1>
      </header>

      <div className="grid flex-1 gap-3.5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-6.5">
        <section
          className={cn(
            "relative flex flex-col items-center gap-1.5 overflow-hidden rounded-[22px] border-4 border-sticker px-4 pt-4.5 pb-4 shadow-sticker lg:flex-row lg:gap-6 lg:rounded-[26px] lg:px-7.5 lg:py-6.5",
            isNewBest ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground",
          )}
        >
          {isNewBest && <Confetti />}
          <BrainMascot
            size={180}
            mood={isNewBest ? "grin" : "smile"}
            className="char-idle hidden shrink-0 lg:block"
          />
          <BrainMascot size={64} className="char-idle absolute top-2 right-2.5 lg:hidden" />
          <div className="relative flex w-full flex-col items-center gap-1.5 lg:items-start lg:gap-2.5">
            {isNewBest ? (
              <span className="-rotate-9 rounded-xl border-4 border-destructive bg-paper px-4 py-0.5 font-display text-2xl leading-tight font-extrabold text-destructive shadow-sticker-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-150 motion-safe:delay-300 motion-safe:duration-400 motion-safe:fill-mode-both lg:text-[30px]">
                {t("practice.newRecord")}
              </span>
            ) : (
              <span className="text-[13px] font-bold text-muted-foreground">
                {t("practice.yourScore")}
              </span>
            )}
            <span className="font-display text-[72px] leading-[0.95] font-extrabold tracking-tight tabular-nums lg:text-[88px]">
              {fmt(score)}
            </span>
            {scoreLine && <span className="text-[15px] font-bold lg:text-[17px]">{scoreLine}</span>}
            {recordLine && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[13px] font-bold">
                <TrophyIcon aria-hidden className="size-3.5" strokeWidth={2.2} />
                {recordLine}
              </span>
            )}
            <div className="mt-2.5 grid w-full grid-cols-3 gap-2 lg:mt-1.5 lg:gap-2.5">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border-[2.5px] border-ink bg-paper px-2 py-2 text-center text-ink lg:rounded-[14px] lg:border-[3px] lg:px-3 lg:py-2.5 lg:text-left"
                >
                  <div className="font-display text-2xl leading-none font-extrabold lg:text-[28px]">
                    {s.value}
                  </div>
                  <div className="text-[11.5px] font-semibold text-ink/75 lg:text-[13px]">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-3.5 lg:gap-4">
          <section className="flex flex-col gap-2 rounded-[18px] border-[3px] border-sticker bg-card px-3.5 py-3 text-card-foreground shadow-sticker-sm lg:rounded-[22px] lg:border-[3.5px] lg:px-5 lg:py-4.5">
            <h2 className="font-display text-[17px] leading-none font-extrabold lg:text-[22px]">
              {t("practice.recordsOf", { game: game.title })}
            </h2>
            <ul className="grid grid-cols-4 gap-1.5 text-center lg:grid-cols-1 lg:gap-0 lg:text-left">
              {DIFFICULTIES.map((d) => {
                const b = bestFor(records, gameId, d);
                const current = d === difficulty;
                return (
                  <li
                    key={d}
                    className={cn(
                      "flex flex-col rounded-[10px] px-0.5 py-1.5 lg:h-11 lg:flex-row lg:items-center lg:justify-between lg:rounded-none lg:border-b-2 lg:border-dashed lg:border-border/20 lg:px-0 lg:last:border-b-0",
                      current
                        ? "border-[2.5px] border-ink bg-primary text-primary-foreground lg:border-x-0 lg:border-t-0 lg:bg-transparent lg:text-card-foreground"
                        : "bg-muted lg:bg-transparent",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[11px] lg:text-[15px]",
                        current ? "font-extrabold" : "font-semibold text-muted-foreground",
                        current && "text-primary-foreground lg:text-card-foreground",
                      )}
                    >
                      {t(`difficulty.${d}`)}
                    </span>
                    <span className="font-display text-base font-extrabold lg:text-xl">
                      {b ? fmt(b.score) : t("common.none")}
                      {current && isNewBest && (
                        <span className="ml-1.5 hidden rounded-lg border-2 border-ink bg-primary px-2 py-px align-middle text-xs text-ink lg:inline">
                          {t("practice.newTag")}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="hidden text-[13px] text-muted-foreground lg:block">
              {t("practice.playsNth", { n: outcome.plays })}
            </p>
          </section>

          <SyncLine sync={sync} />

          <div className="mt-auto flex flex-col gap-2.5 lg:gap-3">
            <Button
              size="lg"
              data-sfx="confirm"
              onClick={onPlayAgain}
              className="min-h-14.5 rounded-2xl border-[3.5px] text-[23px] lg:min-h-16 lg:text-[26px]"
            >
              <RotateCcwIcon aria-hidden className="size-6" strokeWidth={2.8} />
              {t("practice.playAgain")}
            </Button>
            <div className="grid grid-cols-2 gap-2.5 lg:gap-3">
              <Button variant="outline" onClick={onChangeLevel} className="min-h-12.5 px-2">
                <SlidersHorizontalIcon aria-hidden className="hidden sm:block" />
                {t("practice.changeLevel")}
              </Button>
              <Button variant="outline" onClick={onOtherGame} className="min-h-12.5 px-2">
                <LayoutGridIcon aria-hidden className="hidden sm:block" />
                {t("practice.otherGame")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/** Dòng nhỏ trạng thái đồng bộ kỷ lục (lỗi không chặn màn). */
function SyncLine({ sync }: { sync: SyncStatus }) {
  const { t } = useTranslation();
  if (sync === "idle") return null;
  const Icon =
    sync === "synced" ? CloudCheckIcon : sync === "syncing" ? LoaderCircleIcon : CloudOffIcon;
  const text =
    sync === "synced"
      ? t("practice.synced")
      : sync === "syncing"
        ? t("practice.syncing")
        : sync === "failed"
          ? t("practice.syncFailed")
          : t("practice.localOnly");
  return (
    <p
      role="status"
      className="flex items-start gap-2 text-[12.5px] leading-snug text-chalk-muted lg:text-sm"
    >
      <Icon
        aria-hidden
        className={cn("size-4.5 shrink-0", sync === "syncing" && "motion-safe:animate-spin")}
        strokeWidth={2.3}
      />
      {text}
    </p>
  );
}
