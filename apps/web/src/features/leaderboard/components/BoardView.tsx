import { AVATAR_COLORS } from "@brain-rizz/shared";
import { PinIcon, TrophyIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DataProblemState, EmptyState } from "@/components/common/EmptyState";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { RankBadge, rankBg } from "@/components/common/RankBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDateFormat } from "@/hooks/use-date-format";
import { useNumberFormat } from "@/hooks/use-number-format";
import { cn } from "@/lib/utils";
import { LEADERBOARD_LIMIT, type LeaderboardRow, type MyRank } from "@/net/data-api";
import { colorIndexOf } from "../week";

export type BoardState =
  | { status: "loading" }
  | { status: "ok"; rows: LeaderboardRow[] }
  | { status: "not-configured" | "error" | "no-session" };

interface BoardViewProps {
  board: BoardState;
  /** Hạng của mình trong kỳ (`null` = chưa có điểm / chưa có phiên). */
  me: MyRank | null;
  meId: string | null;
  period: "week" | "all";
  onRetry(): void;
  onBrainTest(): void;
}

const colorOf = (userId: string) => colorIndexOf(userId, AVATAR_COLORS.length);

/** Top 3 nổi bật + danh sách từ hạng 4 (tối đa 50) + dòng của mình (FR-MR-12, FR-MR-13, khu 16). */
export function BoardView({ board, me, meId, period, onRetry, onBrainTest }: BoardViewProps) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const date = useDateFormat();

  if (board.status === "loading") return <BoardLoading />;
  if (board.status !== "ok") {
    return (
      <section className="rounded-3xl border-[3px] border-sticker bg-card text-card-foreground shadow-sticker">
        <DataProblemState
          problem={board.status === "not-configured" ? "not-configured" : "error"}
          onRetry={onRetry}
        />
      </section>
    );
  }

  const rows = board.rows;
  if (rows.length === 0) {
    return (
      <section className="rounded-3xl border-[3px] border-sticker bg-card text-card-foreground shadow-sticker">
        <EmptyState
          icon={TrophyIcon}
          tone="bg-sun"
          title={period === "week" ? t("leaderboard.emptyWeek") : t("leaderboard.emptyAll")}
          body={t("leaderboard.emptyBody")}
          action={<Button onClick={onBrainTest}>{t("leaderboard.inviteCta")}</Button>}
        />
      </section>
    );
  }

  const name = (r: LeaderboardRow) => r.name ?? t("common.anonymous");
  const top = rows.slice(0, 3);
  // Thứ tự bục: nhì · nhất · ba.
  const podium = [top[1], top[0], top[2]].filter((r): r is LeaderboardRow => !!r);
  const rest = rows.slice(3);
  const meInTop = !!meId && rows.some((r) => r.userId === meId);

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-6">
      <ol
        aria-label={t("leaderboard.top3")}
        className="grid grid-cols-3 items-end gap-2.5 lg:gap-3.5"
      >
        {podium.map((r) => {
          const mine = r.userId === meId;
          return (
            <li
              key={r.userId}
              aria-label={t("leaderboard.rowLabel", {
                rank: r.rank,
                name: name(r),
                score: fmt(r.score),
              })}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-[20px] border-[3.5px] border-sticker px-1.5 pt-2.5 pb-3 text-center text-ink shadow-sticker lg:gap-1.5 lg:rounded-3xl lg:px-3 lg:pb-5",
                rankBg(r.rank),
                r.rank === 1
                  ? "min-h-43 lg:min-h-80"
                  : r.rank === 2
                    ? "min-h-37.5 lg:min-h-68"
                    : "min-h-35 lg:min-h-60",
                r.rank === 2 && "lg:-rotate-[1.5deg]",
                r.rank === 3 && "lg:rotate-[1.5deg]",
                mine && "outline-4 outline-offset-2 outline-chalk",
              )}
            >
              <span className="font-display text-2xl leading-none font-extrabold lg:text-4xl">
                {r.rank}
              </span>
              <PlayerAvatar
                avatar={r.avatar}
                colorIndex={colorOf(r.userId)}
                size="lg"
                className="size-13 lg:size-22"
              />
              <span className="w-full truncate font-display text-[15px] font-extrabold lg:text-xl">
                {name(r)}
                {mine && <span className="sr-only"> ({t("leaderboard.you")})</span>}
              </span>
              <span className="font-display text-xl leading-none font-extrabold tabular-nums lg:text-[32px]">
                {fmt(r.score)}
              </span>
              <span className="hidden text-xs font-semibold text-ink/70 lg:block">
                {date.short(r.achievedAt)}
              </span>
            </li>
          );
        })}
      </ol>

      <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl border-[3px] border-sticker bg-card text-card-foreground shadow-sticker">
        {rest.length > 0 && (
          <ol className="flex flex-col overflow-y-auto px-2 py-1.5 lg:max-h-[min(60vh,560px)]">
            {rest.map((r) => {
              const mine = r.userId === meId;
              return (
                <li
                  key={r.userId}
                  className={cn(
                    "flex min-h-14 items-center gap-2.5 rounded-2xl px-2",
                    mine
                      ? "my-1 border-[3px] border-sticker bg-primary/35"
                      : "border-b-2 border-dashed border-border/10 last:border-b-0",
                  )}
                >
                  <RankBadge rank={r.rank} size="md" />
                  <PlayerAvatar avatar={r.avatar} colorIndex={colorOf(r.userId)} size="sm" />
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="truncate font-display text-base font-extrabold">
                      {name(r)}
                    </span>
                    {mine && (
                      <span className="shrink-0 rounded-md border-2 border-ink bg-primary px-1.5 text-xs font-bold text-ink">
                        {t("leaderboard.you")}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">{date.short(r.achievedAt)}</span>
                  <span className="w-16 text-right font-display text-lg font-extrabold tabular-nums">
                    {fmt(r.score)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {!meInTop && <MyRow me={me} onBrainTest={onBrainTest} />}
      </section>
    </div>
  );
}

/** Dòng ghim cuối khung: hạng của mình khi ngoài top, hoặc lời mời làm Kiểm tra não. */
function MyRow({ me, onBrainTest }: { me: MyRank | null; onBrainTest(): void }) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  if (!me) {
    return (
      <div className="mt-auto flex flex-wrap items-center gap-2.5 border-t-[3px] border-sticker bg-muted px-3.5 py-3">
        <PinIcon aria-hidden className="size-4.5 shrink-0" />
        <span className="flex-1 text-sm font-bold">{t("leaderboard.invite")}</span>
        <Button size="sm" onClick={onBrainTest}>
          {t("leaderboard.inviteCta")}
        </Button>
      </div>
    );
  }
  return (
    <div className="mt-auto flex min-h-14 items-center gap-2.5 border-t-[3px] border-sticker bg-primary px-3.5 text-primary-foreground">
      <PinIcon aria-hidden className="size-4.5 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="font-display text-base font-extrabold">
          {t("leaderboard.pinned", { rank: me.rank })}
        </span>
        <span className="text-xs font-semibold">
          {t("leaderboard.outsideTop", { n: LEADERBOARD_LIMIT })}
        </span>
      </span>
      <span className="font-display text-xl font-extrabold tabular-nums">{fmt(me.score)}</span>
    </div>
  );
}

function BoardLoading() {
  const { t } = useTranslation();
  return (
    <div
      aria-busy="true"
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-6"
    >
      <span className="sr-only">{t("leaderboard.loadingLabel")}</span>
      <div className="grid grid-cols-3 items-end gap-2.5 lg:gap-3.5">
        <Skeleton className="h-37.5 bg-board-shade lg:h-68" />
        <Skeleton className="h-43 bg-board-shade lg:h-80" />
        <Skeleton className="h-35 bg-board-shade lg:h-60" />
      </div>
      <div className="flex flex-col gap-2 rounded-3xl border-[3px] border-sticker bg-card p-3 shadow-sticker">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}
