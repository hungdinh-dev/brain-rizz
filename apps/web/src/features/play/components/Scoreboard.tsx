import type { PlayerView } from "@brain-rizz/shared";
import { useTranslation } from "react-i18next";
import { BotBadge, PlayerName } from "@/components/characters";
import { DifficultyChip } from "@/components/common/MatchChips";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { RankBadge } from "@/components/common/RankBadge";
import { Card } from "@/components/ui/card";
import { useNumberFormat } from "@/hooks/use-number-format";
import { cn } from "@/lib/utils";
import type { Standing } from "../standings";
import { ComboFlame } from "./ComboChip";

/**
 * Trần độ rộng của tên: không quá 7rem, không quá cột; chừa 1,125rem cho viên màu độ khó, trừ khi
 * chừa vậy làm tên hẹp hơn 4,75rem (khoảng 6 ký tự, rộng hơn mọi tên bot như "Ember 2").
 */
const NAME_MAX = "max-w-[min(7rem,100%,max(100%_-_1.125rem,4.75rem))]";

/**
 * Nhãn độ khó nhận phần còn lại của hàng (khung `@container` bọc ngoài): đủ chỗ thì cắt chữ,
 * hẹp hơn 2,75rem (không còn nổi "S…") thì thành viên màu 12 px, hẹp hơn 1,125rem thì chỉ còn cho
 * trình đọc màn hình. Chữ luôn nằm trong DOM, `title` cho chuột.
 */
const DIFFICULTY_FIT =
  "ml-1.5 block h-5 min-w-0 shrink truncate text-[11px] leading-4 @max-[2.75rem]:size-3 @max-[2.75rem]:p-0 @max-[2.75rem]:text-[0px] @max-[1.125rem]:sr-only";

interface ScoreboardProps {
  standings: Standing[];
  meId: string;
  round: number;
  /** Phòng đông (9–12 người, ui-ux 6.8): hàng 40 px, 12 hàng vừa cột không cuộn. */
  compact?: boolean;
  className?: string;
}

/** Bảng điểm cả phòng ở cột phải (máy tính): hạng, nhân vật, độ khó, câu đang làm, điểm. */
export function Scoreboard({ standings, meId, round, compact, className }: ScoreboardProps) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();

  return (
    <Card
      aria-label={t("play.scoreboard")}
      className={cn(
        "min-h-0 rounded-[22px] border-4",
        compact ? "gap-2 px-3 pt-3 pb-3.5" : "gap-2.5 px-3.5 pt-3.5 pb-4",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <h2
          className={cn(
            "font-display leading-tight font-extrabold",
            compact ? "text-[22px]" : "text-2xl",
          )}
        >
          {t("play.scoreboard")}
        </h2>
        <span className="text-[13px] text-muted-foreground">
          {t("play.scoreboardMeta", { round, count: standings.length })}
        </span>
      </div>
      {compact ? (
        <ol className="flex min-h-0 flex-col gap-1 overflow-y-auto">
          {standings.map(({ player: p, rank }) => (
            <CompactRow key={p.id} player={p} rank={rank} isMe={p.id === meId} />
          ))}
        </ol>
      ) : (
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
                <span className="relative flex shrink-0">
                  <PlayerAvatar
                    avatar={p.avatar}
                    accessories={p.accessories}
                    colorIndex={p.colorIndex}
                    size="md"
                  />
                  {p.isBot && <BotBadge size="sm" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
                  {/*
                   * Tên không co theo tỉ lệ (shrink-0), chỉ cắt khi dài hơn trần; huy hiệu máy trên
                   * avatar thay cho hậu tố "· máy" (compact). Độ khó lấy phần còn lại.
                   */}
                  <span className="flex min-w-0 items-center">
                    <PlayerName
                      player={p}
                      compact
                      className={cn(NAME_MAX, "shrink-0 font-display text-lg font-extrabold")}
                    />
                    {/* Hàng của mình đã tô nền: "(bạn)" chỉ còn cho trình đọc màn hình. */}
                    {isMe && <span className="sr-only">{` ${t("lobby.you")}`}</span>}
                    <span className="@container flex min-w-0 flex-1 items-center">
                      <DifficultyChip
                        difficulty={p.difficulty}
                        title={t(`difficulty.${p.difficulty}`)}
                        className={DIFFICULTY_FIT}
                      />
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("play.atQuestion", { n: p.progress + 1 })}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <ComboFlame streak={p.streak} className="size-4" />
                  <span className="font-display text-2xl font-extrabold tabular-nums">
                    {fmt(p.roundScore)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

/**
 * Hàng gọn 40 px (9–12 người): hạng 24 · avatar 30 · tên 16 px (tối đa 96 px) · chấm độ khó 11 px
 * (chữ mức vẫn trong DOM cho trình đọc màn hình, `title` cho chuột) · "câu n" · lửa combo · điểm.
 */
function CompactRow({
  player: p,
  rank,
  isMe,
}: {
  player: PlayerView;
  rank: number;
  isMe: boolean;
}) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const level = t(`difficulty.${p.difficulty}`);
  return (
    <li
      className={cn(
        "flex h-10 shrink-0 items-center gap-2 rounded-xl border-[2.5px] border-sticker pr-2.5 pl-1.5",
        isMe ? "bg-primary/30" : "bg-card",
        !p.connected && "opacity-50",
      )}
    >
      <RankBadge rank={rank} size="sm" className="size-6 text-[13px]" />
      <span className="relative flex shrink-0">
        <PlayerAvatar
          avatar={p.avatar}
          accessories={p.accessories}
          colorIndex={p.colorIndex}
          size="sm"
          className="size-7.5"
        />
        {p.isBot && <BotBadge size="xs" />}
      </span>
      <PlayerName
        player={p}
        compact
        className="max-w-24 shrink font-display text-base leading-none font-extrabold"
      />
      {isMe && <span className="sr-only">{` ${t("lobby.you")}`}</span>}
      <DifficultyChip
        difficulty={p.difficulty}
        title={level}
        className="size-2.75 border-2 p-0 text-[0px]"
      />
      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
        {t("play.question", { n: p.progress + 1 })}
      </span>
      <ComboFlame streak={p.streak} className="size-3.25" />
      <span className="font-display text-xl leading-none font-extrabold tabular-nums">
        {fmt(p.roundScore)}
      </span>
    </li>
  );
}
