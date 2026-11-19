import type { PlayerView } from "@brain-rizz/shared";
import { useTranslation } from "react-i18next";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { RankBadge } from "@/components/common/RankBadge";
import { Card } from "@/components/ui/card";
import { useNumberFormat } from "@/hooks/use-number-format";
import { useRoomScoring } from "@/hooks/use-room-scoring";
import { cn } from "@/lib/utils";
import { hasCombo } from "../standings";
import { ComboChip } from "./ComboChip";

interface MyScoreProps {
  me: PlayerView;
  rank: number;
  className?: string;
}

/** Góc phải thanh trên (điện thoại): hạng + điểm của tôi, nhãn combo bên dưới. */
export function MyScoreHud({ me, rank, className }: MyScoreProps) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  return (
    <div className={cn("flex min-w-0 flex-col items-end gap-1.5", className)}>
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <RankBadge rank={rank} size="sm" />
        <span className="font-display text-[25px] leading-none font-extrabold text-chalk tabular-nums">
          {fmt(me.roundScore)}
        </span>
        <span className="text-xs font-semibold text-chalk-muted">{t("play.pointsUnit")}</span>
      </span>
      <ComboChip streak={me.streak} />
    </div>
  );
}

/** Thẻ "Điểm của bạn" ở cột trái (máy tính). */
export function MyScoreCard({ me, rank, className }: MyScoreProps) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const scoring = useRoomScoring();
  return (
    <Card
      aria-label={t("play.yourScore")}
      className={cn("gap-2.5 rounded-[22px] border-4 px-4 py-3.5", className)}
    >
      <div className="flex items-center gap-3">
        <PlayerAvatar avatar={me.avatar} colorIndex={me.colorIndex} size="md" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
          <span className="flex items-baseline gap-1.5">
            <span className="truncate font-display text-[22px] font-extrabold">{me.name}</span>
            <span className="shrink-0 text-[13px] font-semibold text-muted-foreground">
              {t("lobby.you")}
            </span>
          </span>
          <span className="text-[13px] text-muted-foreground">
            {t("play.rankAt", { rank, n: me.progress + 1 })}
          </span>
        </span>
        <span className="flex flex-col items-end gap-0.5 leading-none">
          <span className="font-display text-[38px] font-extrabold tabular-nums">
            {fmt(me.roundScore)}
          </span>
          <span className="text-[13px] font-semibold text-muted-foreground">
            {t("play.pointsUnit")}
          </span>
        </span>
      </div>
      {hasCombo(me.streak, scoring) && (
        <div className="flex items-center gap-2.5">
          <ComboChip streak={me.streak} className="h-7 px-2.5 text-sm" />
          <span className="text-[13px] text-muted-foreground">
            {t("play.streak", { streak: me.streak })}
          </span>
        </div>
      )}
    </Card>
  );
}
