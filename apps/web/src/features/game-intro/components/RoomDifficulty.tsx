import {
  ClientMessage,
  DIFFICULTIES,
  type Difficulty,
  type GameId,
  gameMultiplier,
  getGame,
  NUDGE_COOLDOWN_MS,
  type PlayerView,
} from "@brain-rizz/shared";
import { CheckIcon, CrownIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DifficultyChip } from "@/components/common/MatchChips";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNumberFormat } from "@/hooks/use-number-format";
import { cn } from "@/lib/utils";
import { send } from "@/net/connection";

interface RoomDifficultyProps {
  /** Game của vòng này: mỗi game có hệ số điểm theo độ khó riêng (CR-006). */
  gameId: GameId;
  players: PlayerView[];
  sessionId: string;
  /** Độ khó đa số (null = hoà, không đánh dấu ai) */
  majority: Difficulty | null;
  isHost: boolean;
  className?: string;
}

/**
 * Bảng "Độ khó của cả phòng": độ khó và trạng thái "Đã hiểu" của từng người; người lệch đa số
 * được đánh dấu, chủ phòng bấm "Nhắc" (mỗi người tối đa 1 lần / 10 giây).
 */
export function RoomDifficulty({
  gameId,
  players,
  sessionId,
  majority,
  isHost,
  className,
}: RoomDifficultyProps) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const understood = players.filter((p) => p.isHost || p.introReady).length;
  const [nudged, setNudged] = useState<Record<string, true>>({});
  // Mỗi người một hẹn giờ: nhắc người sau không kéo dài thời gian khoá nút của người trước.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const id of map.values()) clearTimeout(id);
      map.clear();
    };
  }, []);

  function nudge(playerId: string) {
    if (timers.current.has(playerId)) return;
    send(ClientMessage.NudgeDifficulty, { playerId });
    setNudged((n) => ({ ...n, [playerId]: true }));
    // Hết thời gian chờ (cùng mức server chặn) thì nút "Đã nhắc" của người này trở lại "Nhắc".
    const id = setTimeout(() => {
      timers.current.delete(playerId);
      setNudged(({ [playerId]: _done, ...rest }) => rest);
    }, NUDGE_COOLDOWN_MS);
    timers.current.set(playerId, id);
  }

  const game = getGame(gameId);
  const multipliers = DIFFICULTIES.map(
    (d) => `${t(`difficulty.${d}`)} ×${fmt(gameMultiplier(game, d))}`,
  ).join(" · ");

  return (
    <Card className={cn("gap-2 rounded-[22px] border-4 px-3 py-3 lg:px-4", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-display text-lg leading-tight font-extrabold lg:text-[22px]">
          {t("intro.roomDifficulty")}
        </h2>
        <span className="ml-auto font-display text-base font-extrabold lg:text-lg">
          {t("intro.understoodCount", { n: understood, total: players.length })}
        </span>
        <span
          role="progressbar"
          aria-label={t("intro.understoodProgress")}
          aria-valuemin={0}
          aria-valuemax={players.length}
          aria-valuenow={understood}
          className="block h-3.5 w-24 rounded-full border-[2.5px] border-sticker p-0.5 lg:w-27.5"
        >
          <span
            className="block h-full rounded-full bg-compute transition-[width] duration-300"
            style={{ width: `${(understood / Math.max(1, players.length)) * 100}%` }}
          />
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {players.map((p) => {
          const off = majority !== null && p.difficulty !== majority;
          const canNudge = isHost && off && !p.isHost;
          return (
            <li
              key={p.id}
              className={cn(
                "flex min-h-12 items-center gap-2.5 rounded-[14px] border-[3px] px-2 py-1",
                off ? "border-identify bg-identify/15" : "border-transparent",
                !p.connected && "opacity-50",
              )}
            >
              <span className="relative flex">
                <PlayerAvatar
                  avatar={p.avatar}
                  colorIndex={p.colorIndex}
                  size="sm"
                  className="size-9"
                />
                {p.isHost && (
                  <span
                    role="img"
                    aria-label={t("lobby.host")}
                    className="absolute -top-2 -left-1.5 grid size-5 -rotate-14 place-items-center rounded-full border-2 border-sticker bg-primary text-primary-foreground"
                  >
                    <CrownIcon aria-hidden className="size-2.5" strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight lg:w-43 lg:flex-none">
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span className="truncate font-display text-base font-extrabold lg:text-lg">
                    {p.name}
                  </span>
                  {p.id === sessionId && (
                    <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                      {t("lobby.you")}
                    </span>
                  )}
                </span>
                {off && (
                  <span className="inline-flex items-center gap-1 self-start rounded-full bg-identify px-2 py-px text-[11px] font-bold text-ink">
                    <TriangleAlertIcon aria-hidden className="size-3" strokeWidth={2.6} />
                    {t("intro.offMajority")}
                  </span>
                )}
              </span>
              <DifficultyChip
                difficulty={p.difficulty}
                className="h-7.5 min-w-20 justify-center border-[2.5px] px-2.5 text-[13px] lg:min-w-24"
              />
              <span className="hidden flex-1 lg:block" />
              {p.isHost || p.introReady ? (
                <span className="inline-flex h-6.5 shrink-0 items-center gap-1 rounded-full border-[2.5px] border-sticker bg-compute px-2 text-xs font-bold text-ink">
                  <span className="hidden sm:inline">{t("intro.understood")}</span>
                  <CheckIcon
                    aria-label={t("intro.understood")}
                    className="size-3.5"
                    strokeWidth={3}
                  />
                </span>
              ) : (
                <span className="inline-flex h-6.5 shrink-0 items-center rounded-full border-[2.5px] border-dashed border-muted-foreground/70 px-2 text-xs font-semibold text-muted-foreground">
                  {t("intro.reading")}
                </span>
              )}
              {isHost && (
                <span className="flex w-18 shrink-0 justify-end lg:w-21">
                  {canNudge && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 rounded-xl px-3 text-base"
                      aria-label={t("intro.nudgeLabel", { name: p.name })}
                      disabled={!!nudged[p.id]}
                      onClick={() => nudge(p.id)}
                    >
                      {nudged[p.id] ? t("intro.nudged") : t("intro.nudge")}
                    </Button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[12.5px] text-muted-foreground">
        {t("intro.multipliers", { list: multipliers })}
      </p>
    </Card>
  );
}
