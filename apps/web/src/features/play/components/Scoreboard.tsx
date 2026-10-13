import { useTranslation } from "react-i18next";
import { DifficultyChip } from "@/components/common/MatchChips";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { RankBadge } from "@/components/common/RankBadge";
import { Card } from "@/components/ui/card";
import { useNumberFormat } from "@/hooks/use-number-format";
import { cn } from "@/lib/utils";
import type { Standing } from "../standings";
import { ComboFlame } from "./ComboChip";

interface ScoreboardProps {
  standings: Standing[];
  meId: string;
  round: number;
  className?: string;
}

/** Bảng điểm cả phòng ở cột phải (máy tính): hạng, nhân vật, độ khó, câu đang làm, điểm. */
export function Scoreboard({ standings, meId, round, className }: ScoreboardProps) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();

  return (
    <Card
      aria-label={t("play.scoreboard")}
      className={cn("min-h-0 gap-2.5 rounded-[22px] border-4 px-3.5 pt-3.5 pb-4", className)}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl leading-tight font-extrabold">
          {t("play.scoreboard")}
        </h2>
        <span className="text-[13px] text-muted-foreground">
          {t("play.scoreboardMeta", { round, count: standings.length })}
        </span>
      </div>
      <ol className="-mx-1 flex min-h-0 flex-col gap-1.5 overflow-y-auto px-1 pb-1">
        {standings.map(({ player: p, rank }) => {
          const isMe = p.id === meId;
          return (
            <li
              key={p.id}
              className={cn(
                "flex h-15.5 shrink-0 items-center gap-2.5 rounded-2xl border-[3px] border-sticker pr-3 pl-2",
                isMe ? "bg-primary/30" : "bg-card",
                !p.connected && "opacity-50",
              )}
            >
              <RankBadge rank={rank} size="md" />
              <PlayerAvatar avatar={p.avatar} colorIndex={p.colorIndex} size="md" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-display text-lg font-extrabold">{p.name}</span>
                  {isMe && (
                    <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                      {t("lobby.you")}
                    </span>
                  )}
                  <DifficultyChip difficulty={p.difficulty} className="h-5 text-[11px]" />
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("play.atQuestion", { n: p.progress + 1 })}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <ComboFlame streak={p.streak} className="size-4" />
                <span className="font-display text-2xl font-extrabold tabular-nums">
                  {fmt(p.roundScore)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
