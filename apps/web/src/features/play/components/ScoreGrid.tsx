import { useTranslation } from "react-i18next";
import { BotBadge, usePlayerName } from "@/components/characters";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { RankBadge } from "@/components/common/RankBadge";
import { useNumberFormat } from "@/hooks/use-number-format";
import { cn } from "@/lib/utils";
import type { Standing } from "../standings";
import { ComboFlame } from "./ComboChip";

/** Từ ngần này đối thủ (7 người trở lên) thì điện thoại dùng lưới thay cho dải thẻ ngang. */
export const SCORE_GRID_MIN_OPPONENTS = 6;

/**
 * Lưới điểm cả phòng trên điện thoại khi đông người (ui-ux 6.8): 6 cột, ô 46 px gồm cả mình (ô của
 * mình nền vàng): avatar 26, hạng góc trên trái, điểm, lửa combo góc trên phải. Không có chỗ cho
 * tên: tên, hạng, điểm, câu đang làm nằm trong `aria-label` và `title` của ô.
 */
export function ScoreGrid({ standings, meId }: { standings: Standing[]; meId: string }) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const { full } = usePlayerName();

  return (
    <ol
      aria-label={t("play.scoreboard")}
      className="grid shrink-0 grid-cols-6 gap-x-1.25 gap-y-1.5 pt-1.5"
    >
      {standings.map(({ player: p, rank }) => {
        const isMe = p.id === meId;
        const label = t("play.cellLabel", {
          name: isMe ? t("play.youName", { name: full(p) }) : full(p),
          rank,
          score: fmt(p.roundScore),
          n: p.progress + 1,
        });
        return (
          <li
            key={p.id}
            aria-label={label}
            title={label}
            className={cn(
              "relative flex h-11.5 min-w-0 rounded-xl border-[2.5px] border-sticker",
              isMe ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground",
              !p.connected && "opacity-50",
            )}
          >
            <span
              aria-hidden
              className="flex size-full flex-col items-center justify-center gap-0.5"
            >
              <span className="relative mt-0.5 flex">
                <PlayerAvatar
                  avatar={p.avatar}
                  accessories={p.accessories}
                  colorIndex={p.colorIndex}
                  size="sm"
                  className="size-6.5"
                />
                {p.isBot && <BotBadge size="xs" />}
              </span>
              <RankBadge
                rank={rank}
                size="xs"
                className="absolute -top-1.75 -left-1.5 size-4.25 text-[10px]"
              />
              <ComboFlame streak={p.streak} className="absolute -top-1.25 -right-1 size-3" />
              <span className="font-display text-xs leading-none font-extrabold tabular-nums">
                {fmt(p.roundScore)}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
