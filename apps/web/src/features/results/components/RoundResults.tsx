import {
  type GameId,
  gameMultiplier,
  getGame,
  type PlayerView,
  rankByRound,
} from "@brain-rizz/shared";
import { CrownIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Character } from "@/components/characters";
import { DifficultyChip } from "@/components/common/MatchChips";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { RankBadge } from "@/components/common/RankBadge";
import { Card } from "@/components/ui/card";
import { ReactionBubble } from "@/features/chat";
import { useNumberFormat } from "@/hooks/use-number-format";
import { cn } from "@/lib/utils";
import { roundWinners } from "../standings";

interface RoundResultsProps {
  /** Game của vòng vừa chơi: hệ số điểm theo độ khó là của riêng game đó (CR-006). */
  gameId: GameId;
  players: PlayerView[];
  sessionId: string;
}

/** Bảng điểm vòng (khu 9): thẻ người nhất vòng + bảng hạng, độ khó, câu đúng, điểm vòng. */
export function RoundResults({ gameId, players, sessionId }: RoundResultsProps) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const ranked = rankByRound(players);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5 lg:flex-row lg:gap-6">
      <WinnerCard gameId={gameId} players={players} sessionId={sessionId} />

      {/* Điện thoại: danh sách gọn. Máy tính: bảng có tiêu đề cột. */}
      <Card className="hidden min-w-0 flex-1 gap-2.5 rounded-3xl border-4 px-4.5 py-4 lg:flex">
        <h2 className="font-display text-2xl font-extrabold">{t("results.roundTable")}</h2>
        <div className="grid grid-cols-[3rem_minmax(0,1fr)_6rem_4.5rem_6rem] items-center gap-3 px-4 text-xs font-bold tracking-[1px] text-muted-foreground uppercase">
          <span>{t("results.colRank")}</span>
          <span>{t("results.colPlayer")}</span>
          <span>{t("results.colDifficulty")}</span>
          <span className="text-right">{t("results.colCorrect")}</span>
          <span className="text-right">{t("results.colScore")}</span>
        </div>
        <ol className="flex flex-col gap-2.5">
          {ranked.map(({ player: p, rank }) => (
            <li
              key={p.id}
              className={cn(
                "grid h-17.5 grid-cols-[3rem_minmax(0,1fr)_6rem_4.5rem_6rem] items-center gap-3 rounded-2xl border-[3px] border-sticker px-3.5",
                p.id === sessionId ? "bg-primary/30" : "bg-card",
              )}
            >
              <RankBadge rank={rank + 1} size="lg" />
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="relative flex shrink-0">
                  <PlayerAvatar
                    avatar={p.avatar}
                    colorIndex={p.colorIndex}
                    size="md"
                    className="size-12"
                  />
                  <ReactionBubble playerId={p.id} placement="corner" />
                </span>
                <span className="truncate font-display text-[22px] font-extrabold">{p.name}</span>
                {p.isHost && (
                  <CrownIcon
                    role="img"
                    aria-label={t("lobby.host")}
                    className="size-4.5 shrink-0"
                    strokeWidth={2.6}
                  />
                )}
                {p.id === sessionId && (
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                    {t("lobby.you")}
                  </span>
                )}
              </span>
              <span>
                <DifficultyChip difficulty={p.difficulty} />
              </span>
              <span className="text-right text-base font-bold">
                {t("results.correctShort", { n: p.roundCorrect })}
              </span>
              <span className="text-right font-display text-[28px] font-extrabold tabular-nums">
                {fmt(p.roundScore)}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-auto text-[13px] text-muted-foreground">{t("results.roundNote")}</p>
      </Card>

      <ol className="flex flex-col gap-2 lg:hidden">
        {ranked.map(({ player: p, rank }) => (
          <li
            key={p.id}
            className={cn(
              "flex min-h-14.5 items-center gap-2.5 rounded-2xl border-[3px] border-sticker py-1 pr-3 pl-2 text-card-foreground",
              p.id === sessionId ? "bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            <RankBadge rank={rank + 1} size="md" />
            <span className="relative flex shrink-0">
              <PlayerAvatar
                avatar={p.avatar}
                colorIndex={p.colorIndex}
                size="md"
                className="size-10"
              />
              <ReactionBubble playerId={p.id} placement="corner" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
              <span className="flex min-w-0 items-baseline gap-1">
                <span className="truncate font-display text-lg font-extrabold">{p.name}</span>
                {p.id === sessionId && (
                  <span className="shrink-0 text-[11.5px] font-semibold opacity-80">
                    {t("lobby.you")}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1.5 text-[11.5px] opacity-80">
                {t("results.correct", { n: p.roundCorrect })}
                <DifficultyChip difficulty={p.difficulty} className="h-5 text-[10.5px]" />
              </span>
            </span>
            <span className="font-display text-[22px] font-extrabold tabular-nums">
              {fmt(p.roundScore)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Thẻ vàng người nhất vòng (hoà thì ghép tên). */
function WinnerCard({ gameId, players, sessionId }: RoundResultsProps) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const winners = roundWinners(players);
  const top = winners[0];
  if (!top) return null;
  const names = winners.map((p) => p.name).join(" & ");
  const iWon = winners.some((p) => p.id === sessionId);

  return (
    <section className="relative flex min-h-44 shrink-0 items-center gap-3 overflow-hidden rounded-[22px] border-4 border-sticker bg-primary px-4 py-3 text-primary-foreground shadow-sticker lg:w-95 lg:-rotate-[1.5deg] lg:flex-col lg:justify-center lg:gap-1.5 lg:rounded-[26px] lg:p-5">
      <span className="hidden rounded-full bg-secondary px-2.5 py-0.5 font-display text-sm font-extrabold tracking-[1px] text-secondary-foreground uppercase lg:px-4 lg:py-1 lg:text-lg lg:inline-flex">
        {t("results.winner")}
      </span>
      <Character
        id={top.avatar}
        mood="win"
        size={140}
        label={t("results.winnerLabel", { name: top.name })}
        className="shrink-0 max-lg:size-28 max-lg:[&_svg]:size-full"
      />
      <span className="flex min-w-0 flex-col items-start gap-1 lg:items-center">
        <span className="inline-flex rounded-full bg-secondary px-2.5 py-0.5 font-display text-sm font-extrabold tracking-[1px] text-secondary-foreground uppercase lg:px-4 lg:py-1 lg:text-lg lg:hidden">
          {t("results.winner")}
        </span>
        <span className="font-display text-[26px] leading-none font-extrabold lg:text-[46px]">
          {iWon ? t("results.youWon") : names}
        </span>
        <span className="font-display text-[22px] leading-none font-extrabold lg:text-[32px]">
          {fmt(top.roundScore)} {t("play.pointsUnit")}
        </span>
        <span className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold lg:justify-center lg:text-sm">
          {t("results.correct", { n: top.roundCorrect })}
          <DifficultyChip difficulty={top.difficulty} />×
          {/* Hệ số riêng của game có thể có 2 chữ số lẻ (vd. 1,55) nên không ép 1 chữ số. */}
          {fmt(gameMultiplier(getGame(gameId), top.difficulty))}
        </span>
      </span>
    </section>
  );
}
