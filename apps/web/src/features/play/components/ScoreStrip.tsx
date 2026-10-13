import { useTranslation } from "react-i18next";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { RankBadge } from "@/components/common/RankBadge";
import { useNumberFormat } from "@/hooks/use-number-format";
import { cn } from "@/lib/utils";
import type { Standing } from "../standings";
import { ComboFlame } from "./ComboChip";

/**
 * Dải điểm đối thủ trên điện thoại: nhân vật + hạng, tên, điểm, câu đang làm.
 * Xếp theo điểm; đông người thì cuộn ngang. Phòng một người thì không hiện.
 */
export function ScoreStrip({ opponents }: { opponents: Standing[] }) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  if (opponents.length === 0) return null;

  return (
    // pt/pl chừa chỗ cho huy hiệu hạng nhô ra ngoài thẻ (cuộn ngang thì phần tràn bị cắt).
    <ol
      aria-label={t("play.opponents")}
      className="-mt-1.5 -ml-1.5 flex shrink-0 gap-1.5 overflow-x-auto pt-1.5 pb-0.5 pl-1.5"
    >
      {opponents.map(({ player: p, rank }) => (
        <li
          key={p.id}
          className={cn(
            "flex h-13 min-w-27 flex-1 basis-0 items-center gap-1.5 rounded-[14px] border-[2.5px] border-sticker bg-card pr-1.5 pl-1.5 text-card-foreground",
            !p.connected && "opacity-50",
          )}
        >
          <span className="relative flex shrink-0">
            <PlayerAvatar avatar={p.avatar} colorIndex={p.colorIndex} size="sm" />
            <RankBadge rank={rank} size="xs" className="absolute -top-1.5 -left-1.5" />
          </span>
          <span className="flex min-w-0 flex-col leading-[1.12]">
            <span className="truncate text-xs font-bold">{p.name}</span>
            <span className="flex items-center gap-0.5">
              <span className="font-display text-base font-extrabold tabular-nums">
                {fmt(p.roundScore)}
              </span>
              <ComboFlame streak={p.streak} />
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              {t("play.question", { n: p.progress + 1 })}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
