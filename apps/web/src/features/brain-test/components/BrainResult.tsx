import {
  BRAIN_SCORE_MAX,
  type BrainStateView,
  CATEGORIES,
  isGameId,
  skillScore,
} from "@brain-rizz/shared";
import {
  CloudCheckIcon,
  CloudOffIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { BrainRadar } from "@/components/common/BrainRadar";
import { ChalkChip } from "@/components/common/ChalkChip";
import { CATEGORY_BG } from "@/components/common/MatchChips";
import { RankBadge } from "@/components/common/RankBadge";
import { Button } from "@/components/ui/button";
import { useCountUp } from "@/hooks/use-count-up";
import { useData } from "@/hooks/use-data";
import { useDateFormat } from "@/hooks/use-date-format";
import { useGameTextLookup } from "@/hooks/use-game-text";
import { useNumberFormat } from "@/hooks/use-number-format";
import { SUPABASE_CONFIGURED } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { fetchBrainHistory, fetchMyRank } from "@/net/data-api";

interface BrainResultProps {
  brain: BrainStateView;
  onLeaderboard(): void;
  onRetake(): void;
  onMenu(): void;
}

/**
 * Kết quả Kiểm tra não (UC-14 bước 5, khu 14): Điểm Não đếm lên, biểu đồ 5 cạnh (lượt trước nét
 * đứt), điểm từng game, so với lần trước / kỷ lục, hạng tuần này, thông báo theo `saveStatus`.
 */
export function BrainResult({ brain, onLeaderboard, onRetake, onMenu }: BrainResultProps) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const date = useDateFormat();
  const text = useGameTextLookup();
  const score = useCountUp(brain.brainScore, 800);
  const settled = brain.saveStatus !== "pending";
  const saved = brain.saveStatus === "saved";
  // Server cũ chưa có trường này → coi như 0.
  const chalk = typeof brain.chalkEarned === "number" ? brain.chalkEarned : 0;

  // Lịch sử (để so lần trước / kỷ lục) và hạng tuần: chỉ hỏi khi đã chốt việc lưu.
  const history = useData(() => fetchBrainHistory(50), [saved], settled && SUPABASE_CONFIGURED);
  const rank = useData(() => fetchMyRank({ kind: "brain" }, "week"), [], saved);

  const rows = history.status === "ok" ? history.data : [];
  // Đã lưu thì lượt mới nhất là lượt này.
  const earlier = saved ? rows.slice(1) : rows;
  const previous = earlier[0];
  const bestBefore = earlier.reduce((m, r) => Math.max(m, r.brainScore), 0);
  const diff = previous ? brain.brainScore - previous.brainScore : 0;

  const compare = previous ? (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[15px] font-bold">
        {diff >= 0 ? (
          <TrendingUpIcon aria-hidden className="size-4.5" strokeWidth={2.6} />
        ) : (
          <TrendingDownIcon aria-hidden className="size-4.5" strokeWidth={2.6} />
        )}
        {diff > 0
          ? t("brainTest.vsLastUp", { diff: fmt(diff), last: fmt(previous.brainScore) })
          : diff < 0
            ? t("brainTest.vsLastDown", { diff: fmt(-diff), last: fmt(previous.brainScore) })
            : t("brainTest.vsLastSame", { last: fmt(previous.brainScore) })}
      </span>
      <span className="text-[13px] font-semibold text-muted-foreground">
        {brain.brainScore > bestBefore
          ? t("brainTest.personalBest")
          : t("brainTest.bestCompare", { best: fmt(bestBefore) })}
      </span>
    </span>
  ) : history.status === "loading" || !settled ? null : (
    <span className="text-[13px] font-semibold text-muted-foreground">
      {t("brainTest.firstRun")}
    </span>
  );

  const saveBox = (
    <SaveStatus brain={brain} rank={rank.status === "ok" ? rank.data?.rank : undefined} />
  );

  const gameList = (
    <ol className="flex flex-col gap-1.5">
      {brain.games.map((g) => {
        if (!isGameId(g.gameId)) return null;
        const skill = skillScore(g.gameId, g.score);
        return (
          <li
            key={g.gameId}
            className="flex min-h-11 items-center gap-2.5 border-b-2 border-dashed border-border/15 pb-1.5 last:border-b-0"
          >
            <span
              aria-hidden
              className={cn(
                "size-3.5 shrink-0 rounded-full border-2 border-ink",
                CATEGORY_BG[g.category],
              )}
            />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate font-display text-base font-extrabold">
                {text(g.gameId).title}
              </span>
              {/* Xuống dòng thay vì cắt "…" (tên nhóm dài, tiếng Anh). */}
              <span className="text-xs leading-snug text-muted-foreground">
                {t("brainTest.gameLine", {
                  category: t(`category.${g.category}`),
                  score: fmt(g.score),
                  correct: g.correct,
                })}
              </span>
            </span>
            <span className="shrink-0 font-display text-xl font-extrabold tabular-nums">
              {skill}
            </span>
          </li>
        );
      })}
    </ol>
  );

  return (
    <main className="flex flex-1 flex-col gap-3.5 lg:gap-4.5">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex h-8 items-center rounded-full bg-secondary px-3 font-display text-[15px] font-extrabold text-secondary-foreground lg:h-9.5 lg:px-3.5 lg:text-xl">
          {t("brainTest.title")}
        </span>
        <h1 className="font-display text-[30px] leading-none font-extrabold text-chalk lg:text-[40px]">
          {t("brainTest.resultTitle")}
        </h1>
        <span className="hidden text-[15px] text-chalk-muted lg:ml-auto lg:inline">
          {t("brainTest.resultMeta", {
            date: date.long(Date.now()),
            level: t(`difficulty.${brain.difficulty}`),
          })}
        </span>
      </header>

      <div className="grid flex-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-6">
        <div className="flex min-w-0 flex-col gap-3.5 lg:gap-4">
          <section className="flex flex-col gap-2 rounded-[22px] border-4 border-sticker bg-card px-4.5 py-4 text-card-foreground shadow-sticker">
            <span className="text-sm font-bold text-muted-foreground">
              {t("brainTest.brainScore")}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="font-display text-[72px] leading-[0.9] font-extrabold tabular-nums lg:text-[88px]">
                {fmt(score)}
              </span>
              <span className="font-display text-xl font-extrabold text-muted-foreground">
                {t("brainTest.outOf", { max: fmt(BRAIN_SCORE_MAX) })}
              </span>
            </span>
            {/* Phấn của lượt này (CR-023): server cập nhật sau khi lưu xong; 0 → ẩn. */}
            {chalk > 0 && (
              <span className="flex flex-wrap items-center gap-2">
                <ChalkChip tone="reward" size="sm" className="fx-tag-pop">
                  {t("rewards.amount", { n: fmt(chalk) })}
                </ChalkChip>
                <span className="text-xs font-semibold text-muted-foreground">
                  {t("rewards.wallet")}
                </span>
              </span>
            )}
            <p role="status" className="sr-only">
              {chalk > 0 ? t("rewards.live", { n: fmt(chalk) }) : ""}
            </p>
            {compare}
          </section>
          {saveBox}
          <div className="hidden flex-col gap-3 lg:mt-auto lg:flex">
            <Button
              size="lg"
              data-sfx="confirm"
              onClick={onLeaderboard}
              className="min-h-15 text-2xl"
            >
              {t("brainTest.viewLeaderboard")}
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={onRetake} className="min-h-12.5">
                <RotateCcwIcon aria-hidden />
                {t("brainTest.retake")}
              </Button>
              <Button variant="outline" data-sfx="back" onClick={onMenu} className="min-h-12.5">
                {t("common.backToMenu")}
              </Button>
            </div>
          </div>
        </div>

        <section className="flex min-w-0 flex-col gap-3 rounded-[22px] border-4 border-sticker bg-card px-3 py-3.5 text-card-foreground shadow-sticker lg:flex-row lg:items-center lg:gap-4 lg:px-5">
          <BrainRadar
            skills={Object.fromEntries(CATEGORIES.map((c) => [c, brain.skills[c] ?? 0]))}
            previous={previous?.skills}
            legend
            animate
            className="mx-auto w-full max-w-90 lg:max-w-100 lg:min-w-0 lg:flex-1"
          />
          <div className="min-w-0 lg:w-72 lg:shrink-0">{gameList}</div>
        </section>

        <div className="flex flex-col gap-2.5 lg:hidden">
          <Button
            size="lg"
            data-sfx="confirm"
            onClick={onRetake}
            className="min-h-14.5 text-[23px]"
          >
            <RotateCcwIcon aria-hidden />
            {t("brainTest.retake")}
          </Button>
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="outline" onClick={onLeaderboard} className="min-h-12.5 px-2">
              {t("brainTest.leaderboardShort")}
            </Button>
            <Button variant="outline" data-sfx="back" onClick={onMenu} className="min-h-12.5 px-2">
              {t("common.backToMenu")}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

/** Đã lưu + hạng tuần / đang lưu / chưa lưu kèm lý do (UC-14 luồng rẽ 5a, 5b). */
function SaveStatus({ brain, rank }: { brain: BrainStateView; rank: number | undefined }) {
  const { t } = useTranslation();
  const status = brain.saveStatus;
  if (status === "pending") {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-chalk-muted">
        <LoaderCircleIcon aria-hidden className="size-4.5 motion-safe:animate-spin" />
        {t("brainTest.saving")}
      </p>
    );
  }
  if (status === "saved") {
    return (
      <section
        role="status"
        className="flex items-center gap-3 rounded-2xl border-[3px] border-sticker bg-primary px-3.5 py-2.5 text-primary-foreground shadow-sticker-sm"
      >
        {rank !== undefined && <RankBadge rank={rank} size="lg" className="bg-paper" />}
        <span className="flex flex-col leading-tight">
          {rank !== undefined && (
            <span className="font-display text-xl font-extrabold">
              {t("brainTest.rankWeek", { rank })}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[13px] font-bold">
            <CloudCheckIcon aria-hidden className="size-4" strokeWidth={2.4} />
            {t("brainTest.saved")}
          </span>
        </span>
      </section>
    );
  }
  const reason =
    !SUPABASE_CONFIGURED || status === "no-db"
      ? t("brainTest.reasonNoDb")
      : status === "failed"
        ? t("brainTest.saveFailed")
        : t("brainTest.reasonGuest");
  return (
    <section
      role="status"
      className="flex items-start gap-2.5 rounded-2xl border-[2.5px] border-dashed border-chalk/70 px-3.5 py-3 text-chalk"
    >
      <CloudOffIcon aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={2.3} />
      <span className="flex flex-col gap-0.5">
        <span className="font-display text-base font-extrabold">{t("brainTest.notSaved")}</span>
        <span className="text-[13px] text-chalk-muted">{reason}</span>
      </span>
    </section>
  );
}
