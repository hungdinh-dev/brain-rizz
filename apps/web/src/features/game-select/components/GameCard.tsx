import type { Category, PlayerView } from "@brain-rizz/shared";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CategoryChip } from "@/components/common/MatchChips";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GameThumb } from "./GameThumb";

export type GameCardState =
  /** Chơi được: chủ phòng chọn, người khác bình chọn */
  | "available"
  /** Đã chơi trong trận */
  | "played"
  /** Chưa có code */
  | "soon";

interface GameCardProps {
  id: string;
  name: string;
  summary: string;
  category: Category;
  state: GameCardState;
  voters: PlayerView[];
  /** Chủ phòng đang chọn thẻ này (hiện nút "Chơi game này") */
  selected?: boolean;
  /** Người chơi đã bầu thẻ này */
  myVote?: boolean;
  /** Bấm vào thẻ: chủ phòng = chọn, người chơi = bình chọn/bỏ phiếu. Bỏ trống = không bấm được */
  onPress?(): void;
  /** Chủ phòng chốt game (chỉ khi `selected`) */
  onPlay?(): void;
  /** Đã bấm "Chơi game này", đang chờ server → khoá nút */
  playPending?: boolean;
}

/** Thẻ game ở chế độ "Chủ phòng chọn": ảnh, tên, nhóm kỹ năng, mô tả, số phiếu + người bầu. */
export function GameCard(props: GameCardProps) {
  const { t } = useTranslation();
  const {
    id,
    name,
    summary,
    category,
    state,
    voters,
    selected,
    myVote,
    onPress,
    onPlay,
    playPending,
  } = props;
  const highlighted = selected || myVote;
  const muted = state !== "available";

  const body = (
    <>
      {state === "played" && (
        <span className="absolute -top-3 right-3 z-10 inline-flex h-6 rotate-5 items-center gap-1 rounded-full bg-secondary px-2.5 text-xs font-bold text-secondary-foreground">
          <CheckIcon aria-hidden className="size-3" strokeWidth={3} />
          {t("gameSelect.played")}
        </span>
      )}
      {state === "soon" && (
        <span className="absolute -top-3 right-3 z-10 rotate-6 rounded-[9px] border-[3px] border-sticker bg-primary px-2.5 font-display text-sm font-extrabold text-primary-foreground">
          {t("gameSelect.soon")}
        </span>
      )}
      {myVote && (
        <span className="absolute -top-3 -right-2 z-10 inline-flex h-6.5 items-center gap-1 rounded-full border-[2.5px] border-sticker bg-compute px-2 text-[11.5px] font-bold text-ink">
          <CheckIcon aria-hidden className="size-3" strokeWidth={3} />
          {t("gameSelect.yourVote")}
        </span>
      )}
      <GameThumb
        id={id}
        category={category}
        locked={state === "soon"}
        dimmed={state === "played"}
        className="h-10 lg:h-14"
      />
      <span className="flex flex-col items-start gap-1.5 lg:flex-row lg:items-center lg:justify-between">
        <span
          className={cn(
            "font-display text-[17px] leading-tight font-extrabold lg:text-[21px]",
            muted && "text-muted-foreground",
          )}
        >
          {name}
        </span>
        <CategoryChip category={category} className="h-6 text-[11px] lg:text-xs" />
      </span>
      <span
        className={cn(
          "hidden truncate text-[13px] leading-snug lg:block",
          highlighted ? "text-primary-foreground/80" : "text-muted-foreground",
        )}
      >
        {summary}
      </span>
      <span className="mt-auto flex min-h-7.5 items-center">
        {state === "played" ? (
          <span className="text-xs font-semibold text-muted-foreground lg:text-[13px]">
            {t("gameSelect.playedNote")}
          </span>
        ) : state === "soon" ? (
          <span className="text-xs font-semibold text-muted-foreground lg:text-[13px]">
            {t("gameSelect.soonNote")}
          </span>
        ) : voters.length > 0 ? (
          <span className="flex items-center gap-2">
            <span className="flex">
              {voters.map((p, i) => (
                <PlayerAvatar
                  key={p.id}
                  avatar={p.avatar}
                  colorIndex={p.colorIndex}
                  size="sm"
                  className={cn(i > 0 && "-ml-2.5")}
                />
              ))}
            </span>
            <span className="font-display text-[15px] font-extrabold lg:text-base">
              {t("gameSelect.votes", { count: voters.length })}
            </span>
          </span>
        ) : (
          <span
            className={cn(
              "text-xs",
              highlighted ? "text-primary-foreground/80" : "text-muted-foreground",
            )}
          >
            {t("gameSelect.noVotes")}
          </span>
        )}
      </span>
      {selected && onPlay && (
        <Button
          variant="secondary"
          className="min-h-11 rounded-[14px]"
          disabled={playPending}
          onClick={onPlay}
        >
          {t("gameSelect.playThis")}
          <ArrowRightIcon aria-hidden strokeWidth={3} />
        </Button>
      )}
    </>
  );

  const frame = cn(
    "relative flex min-w-0 flex-col gap-1.5 rounded-[18px] p-2 text-left lg:rounded-[20px] lg:p-2.5",
    muted
      ? "border-[3px] border-dashed border-muted-foreground/70 bg-muted text-card-foreground"
      : "border-[3.5px] border-sticker shadow-sticker lg:border-4",
    !muted && (highlighted ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground"),
    selected && "outline-4 outline-offset-4 outline-primary",
  );

  // Thẻ đang được chủ phòng chọn chứa nút riêng → không bọc trong <button> (không lồng nút).
  if (!onPress || selected) {
    return (
      <div className={frame} aria-disabled={muted || undefined}>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={myVote}
      aria-label={
        myVote === undefined ? t("gameSelect.select", { name }) : t("gameSelect.voteFor", { name })
      }
      onClick={onPress}
      className={cn(
        frame,
        "cursor-pointer transition-[translate] outline-none hover:-translate-y-0.75 focus-visible:ring-3 focus-visible:ring-ring",
      )}
    >
      {body}
    </button>
  );
}
