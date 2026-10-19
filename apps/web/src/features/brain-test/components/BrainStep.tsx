import {
  BRAIN_SKILL_MAX,
  BRAIN_TEST_GAME_RESULT_MS,
  type BrainStateView,
  isGameId,
  skillScore,
} from "@brain-rizz/shared";
import { useTranslation } from "react-i18next";
import { CATEGORY_BG } from "@/components/common/MatchChips";
import { useGameTextLookup } from "@/hooks/use-game-text";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useNumberFormat } from "@/hooks/use-number-format";
import { useServerClock } from "@/hooks/use-server-clock";
import { cn } from "@/lib/utils";
import { BrainProgress } from "./BrainProgress";

/**
 * Màn tạm giữa hai game (pha `game-result`, khu 14): điểm thô + kỹ năng của game vừa chơi, game kế
 * tiếp, thanh mảnh chạy hết 3 giây (giảm chuyển động → chỉ đếm số). Server tự sang game kế.
 */
export function BrainStep({ brain }: { brain: BrainStateView }) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const text = useGameTextLookup();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const now = useServerClock(100);
  const total = brain.games.length;
  const game = brain.games[brain.round - 1];
  const next = brain.games[brain.round];
  const leftMs = Math.max(0, brain.resultEndsAt - now);
  const seconds = Math.ceil(leftMs / 1000);
  const ratio = Math.min(1, leftMs / BRAIN_TEST_GAME_RESULT_MS);
  if (!game || !isGameId(game.gameId)) return null;
  const skill = skillScore(game.gameId, game.score);
  const category = t(`category.${game.category}`);

  return (
    <main className="flex flex-1 flex-col gap-4 lg:gap-6">
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
      </header>

      <div className="grid flex-1 content-center gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-7">
        <section
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-[24px] border-4 border-sticker px-5 py-6 text-center text-ink shadow-sticker lg:py-9",
            CATEGORY_BG[game.category],
            game.category === "visualize" && "text-paper",
          )}
        >
          <span className="text-sm font-bold opacity-85">
            {t("brainTest.gameOfCategory", { n: brain.round, total, category })}
          </span>
          <h1 className="font-display text-4xl leading-none font-extrabold lg:text-5xl">
            {text(game.gameId).title}
          </h1>
          <span className="mt-2 font-display text-7xl leading-none font-extrabold tabular-nums lg:text-[88px]">
            {fmt(game.score)}
          </span>
          <span className="text-[15px] font-bold">{t("brainTest.score", { n: game.correct })}</span>
          <span className="mt-2 rounded-full border-[2.5px] border-ink bg-paper px-3.5 py-1 text-sm font-bold text-ink">
            {t("brainTest.skillLine", { category, skill, max: BRAIN_SKILL_MAX })}
          </span>
        </section>

        <section className="flex flex-col gap-3">
          {next && isGameId(next.gameId) && (
            <>
              <span className="font-display text-lg font-extrabold text-chalk-muted">
                {t("brainTest.next")}
              </span>
              <div className="flex items-center gap-3 rounded-2xl border-[3px] border-sticker bg-card px-4 py-3 text-card-foreground shadow-sticker-sm">
                <span className="grid size-11 shrink-0 place-items-center rounded-full border-[3.5px] border-sticker bg-primary font-display text-xl font-extrabold text-primary-foreground">
                  {brain.round + 1}
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate font-display text-[22px] font-extrabold">
                    {text(next.gameId).title}
                  </span>
                  <span className="text-[13px] text-muted-foreground">
                    {t(`category.${next.category}`)} · {t(`difficulty.${brain.difficulty}`)}
                  </span>
                </span>
              </div>
            </>
          )}
          <div
            role="timer"
            aria-label={
              next
                ? t("brainTest.nextIn", { n: brain.round + 1, count: seconds })
                : t("brainTest.resultIn", { count: seconds })
            }
            className="flex flex-col gap-2"
          >
            <span aria-hidden className="text-[15px] text-chalk">
              {next
                ? t("brainTest.nextIn", { n: brain.round + 1, count: seconds })
                : t("brainTest.resultIn", { count: seconds })}
            </span>
            <span
              aria-hidden
              className="block h-2.5 overflow-hidden rounded-full bg-board-shade motion-reduce:hidden"
            >
              <span
                className="block h-full rounded-full bg-primary"
                // Độ dài thanh tính theo giờ server lúc chạy.
                style={{ width: `${ratio * 100}%` }}
              />
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
