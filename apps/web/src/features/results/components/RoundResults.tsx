import {
  type GameId,
  gameMultiplier,
  getGame,
  type PlayerView,
  rankByRound,
} from "@brain-rizz/shared";
import { CrownIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BotBadge, Character, PlayerName, usePlayerName } from "@/components/characters";
import { DifficultyChip } from "@/components/common/MatchChips";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { RankBadge } from "@/components/common/RankBadge";
import { Card } from "@/components/ui/card";
import { ReactionBubble } from "@/features/chat";
import { useNumberFormat } from "@/hooks/use-number-format";
import { useRoomScoring } from "@/hooks/use-room-scoring";
import { isCrowded } from "@/lib/room-size";
import { cn } from "@/lib/utils";
import { roundWinners } from "../standings";

interface RoundResultsProps {
  /** Game của vòng vừa chơi: hệ số điểm theo độ khó là của riêng game đó (CR-006). */
  gameId: GameId;
  players: PlayerView[];
  sessionId: string;
}

/** Số hàng mỗi cột của bảng 2 cột (phòng 9–12 người, máy tính). */
const ROWS_PER_COLUMN = 6;

/**
 * Cột của bảng gọn: hạng 32 · người chơi · độ khó 62 · đúng 36 · điểm 62 (vừa "2.150" 23 px). Cột
 * hẹp hơn 22rem (máy tính mở cột chat) thì bỏ cột độ khó và đúng, hai thứ đó xuống dòng phụ dưới tên.
 */
const COMPACT_COLS =
  "grid-cols-[2rem_minmax(0,1fr)_3.875rem_2.25rem_3.875rem] @max-[22rem]:grid-cols-[2rem_minmax(0,1fr)_3.875rem]";
/** Ô chỉ có ở cột rộng. */
const WIDE_ONLY = "@max-[22rem]:hidden";

/**
 * Bảng điểm vòng (khu 9): thẻ người nhất vòng + bảng hạng, độ khó, câu đúng, điểm vòng.
 * Phòng 9–12 người (ui-ux 6.8): máy tính chia bảng 2 cột × 6 hàng; điện thoại hàng 48 px, hàng
 * của mình dính mép trên/dưới màn nên luôn thấy.
 */
export function RoundResults({ gameId, players, sessionId }: RoundResultsProps) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const ranked = rankByRound(players);
  const crowded = isCrowded(players.length);
  const columns = crowded
    ? [ranked.slice(0, ROWS_PER_COLUMN), ranked.slice(ROWS_PER_COLUMN)]
    : [ranked];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5 lg:flex-row lg:gap-6">
      <WinnerCard gameId={gameId} players={players} sessionId={sessionId} compact={crowded} />

      {/* Điện thoại: danh sách gọn. Máy tính: bảng có tiêu đề cột. */}
      {crowded ? (
        <Card className="hidden min-w-0 flex-1 gap-2 rounded-3xl border-4 px-4 py-3.5 lg:flex">
          <h2 className="font-display text-[22px] leading-tight font-extrabold">
            {t("results.roundTable")} · {t("results.playersCount", { count: players.length })}
          </h2>
          <div className="grid grid-cols-2 gap-x-4.5">
            {columns.map((column, c) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: hai cột cố định (hạng 1–6, 7–12)
              <div key={c} className="@container flex min-w-0 flex-col gap-1.5">
                <div
                  className={cn(
                    "grid items-end gap-2 px-2.5 text-[10.5px] leading-tight font-bold tracking-[1px] text-muted-foreground uppercase",
                    COMPACT_COLS,
                  )}
                >
                  <span>{t("results.colRank")}</span>
                  <span>{t("results.colPlayer")}</span>
                  <span className={WIDE_ONLY}>{t("results.colDifficulty")}</span>
                  <span className={cn("text-right", WIDE_ONLY)}>{t("results.colCorrect")}</span>
                  <span className="text-right">{t("results.colScore")}</span>
                </div>
                <ol className="flex flex-col gap-1.5">
                  {column.map(({ player: p, rank }) => (
                    <li
                      key={p.id}
                      className={cn(
                        "grid h-13 items-center gap-2 rounded-[15px] border-[3px] border-sticker px-2.5",
                        COMPACT_COLS,
                        p.id === sessionId ? "bg-primary/30" : "bg-card",
                      )}
                    >
                      <RankBadge rank={rank + 1} size="md" />
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="relative flex shrink-0">
                          <PlayerAvatar
                            avatar={p.avatar}
                            colorIndex={p.colorIndex}
                            size="sm"
                            className="size-9 border-[2.5px]"
                          />
                          {p.isBot && <BotBadge size="sm" />}
                          <ReactionBubble playerId={p.id} placement="corner" />
                        </span>
                        {/*
                          Tên gọn: hậu tố "· máy" nhường cho huy hiệu máy trên avatar, "(bạn)"
                          nhường cho nền tô của hàng (cả hai vẫn có cho trình đọc màn hình).
                        */}
                        <span className="flex min-w-0 flex-col gap-0.5 leading-tight">
                          <span className="flex min-w-0">
                            <PlayerName
                              player={p}
                              compact
                              className="font-display text-lg leading-tight font-extrabold"
                            />
                            {p.id === sessionId && (
                              <span className="sr-only">{` ${t("lobby.you")}`}</span>
                            )}
                          </span>
                          {/* Cột hẹp: chip độ khó dưới tên, số câu đúng dưới điểm. */}
                          <DifficultyChip
                            difficulty={p.difficulty}
                            className="hidden h-4.25 self-start px-1.5 text-[10px] @max-[22rem]:inline-flex"
                          />
                        </span>
                      </span>
                      <span className={WIDE_ONLY}>
                        <DifficultyChip
                          difficulty={p.difficulty}
                          className="h-5.5 px-1.75 text-[11px]"
                        />
                      </span>
                      <span className={cn("text-right text-sm font-bold tabular-nums", WIDE_ONLY)}>
                        {p.roundCorrect}
                      </span>
                      <span className="flex flex-col items-end gap-0.5">
                        <span className="font-display text-[23px] leading-none font-extrabold tabular-nums">
                          {fmt(p.roundScore)}
                        </span>
                        <span className="hidden text-[11px] leading-tight whitespace-nowrap text-muted-foreground @max-[22rem]:block">
                          {t("results.correct", { n: p.roundCorrect })}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <p className="mt-auto text-[12.5px] text-muted-foreground">{t("results.roundNote")}</p>
        </Card>
      ) : (
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
                    {p.isBot && <BotBadge size="sm" />}
                    <ReactionBubble playerId={p.id} placement="corner" />
                  </span>
                  <span className="flex min-w-0 items-baseline gap-1 overflow-x-clip">
                    <PlayerName
                      player={p}
                      className="truncate font-display text-[22px] font-extrabold"
                      suffixClassName="text-sm text-muted-foreground"
                    />
                  </span>
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
      )}

      <ol className="flex flex-col gap-2 lg:hidden">
        {ranked.map(({ player: p, rank }) => {
          const isMe = p.id === sessionId;
          return (
            <li
              key={p.id}
              className={cn(
                "flex items-center rounded-2xl border-[3px] border-sticker text-card-foreground",
                crowded
                  ? "h-12 gap-2.25 rounded-[15px] pr-3 pl-1.75"
                  : "min-h-14.5 gap-2.5 py-1 pr-3 pl-2",
                isMe ? "bg-primary text-primary-foreground" : "bg-card",
                // Phòng đông: hàng của mình dính mép trên/dưới màn (chừa 80 px cho nút chat nổi).
                crowded && isMe && "sticky top-0 bottom-20 z-10 shadow-sticker-sm",
              )}
            >
              <RankBadge
                rank={rank + 1}
                size="md"
                className={crowded ? "size-7 border-[2.5px] text-[15px]" : undefined}
              />
              <span className="relative flex shrink-0">
                <PlayerAvatar
                  avatar={p.avatar}
                  colorIndex={p.colorIndex}
                  size="md"
                  className={crowded ? "size-8.5 border-[2.5px]" : "size-10"}
                />
                {p.isBot && <BotBadge size={crowded ? "xs" : "sm"} />}
                <ReactionBubble playerId={p.id} placement="corner" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
                <span className="flex min-w-0 items-baseline gap-1 overflow-x-clip">
                  <PlayerName
                    player={p}
                    className={cn(
                      "truncate font-display font-extrabold",
                      crowded ? "text-[17px]" : "text-lg",
                    )}
                    suffixClassName="text-[11.5px] opacity-80"
                  />
                  {isMe && (
                    <span className="shrink-0 text-[11.5px] font-semibold opacity-80">
                      {t("lobby.you")}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1.5 opacity-80",
                    crowded ? "text-[11px]" : "text-[11.5px]",
                  )}
                >
                  {t("results.correct", { n: p.roundCorrect })}
                  <DifficultyChip
                    difficulty={p.difficulty}
                    className={crowded ? "h-4.25 px-1.5 text-[10px]" : "h-5 text-[10.5px]"}
                  />
                </span>
              </span>
              <span
                className={cn(
                  "font-display font-extrabold tabular-nums",
                  crowded ? "text-xl leading-none" : "text-[22px]",
                )}
              >
                {fmt(p.roundScore)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Thẻ vàng người nhất vòng (hoà thì ghép tên). Hệ số độ khó theo công thức của phòng (CR-019). */
function WinnerCard({
  gameId,
  players,
  sessionId,
  compact,
}: RoundResultsProps & { compact?: boolean }) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const { full } = usePlayerName();
  const scoring = useRoomScoring();
  const winners = roundWinners(players);
  const top = winners[0];
  if (!top) return null;
  const names = winners.map(full).join(" & ");
  const iWon = winners.some((p) => p.id === sessionId);

  return (
    <section
      className={cn(
        "relative flex min-h-44 shrink-0 items-center gap-3 overflow-hidden rounded-[22px] border-4 border-sticker bg-primary px-4 py-3 text-primary-foreground shadow-sticker lg:-rotate-[1.5deg] lg:flex-col lg:justify-center lg:gap-1.5 lg:rounded-[26px] lg:p-5",
        compact ? "max-lg:min-h-30 lg:w-75 lg:self-center" : "lg:w-95",
      )}
    >
      <span className="hidden rounded-full bg-secondary px-2.5 py-0.5 font-display text-sm font-extrabold tracking-[1px] text-secondary-foreground uppercase lg:px-4 lg:py-1 lg:text-lg lg:inline-flex">
        {t("results.winner")}
      </span>
      <Character
        id={top.avatar}
        mood="win"
        size={compact ? 132 : 140}
        label={t("results.winnerLabel", { name: full(top) })}
        className={cn(
          "shrink-0 max-lg:[&_svg]:size-full",
          compact ? "max-lg:size-24" : "max-lg:size-28",
        )}
      />
      <span className="flex min-w-0 flex-col items-start gap-1 lg:items-center">
        <span className="inline-flex rounded-full bg-secondary px-2.5 py-0.5 font-display text-sm font-extrabold tracking-[1px] text-secondary-foreground uppercase lg:px-4 lg:py-1 lg:text-lg lg:hidden">
          {t("results.winner")}
        </span>
        <span
          className={cn(
            "font-display text-[26px] leading-none font-extrabold",
            compact ? "lg:text-[40px]" : "lg:text-[46px]",
          )}
        >
          {iWon ? t("results.youWon") : names}
        </span>
        <span
          className={cn(
            "font-display leading-none font-extrabold",
            compact ? "text-[21px] lg:text-[28px]" : "text-[22px] lg:text-[32px]",
          )}
        >
          {fmt(top.roundScore)} {t("play.pointsUnit")}
        </span>
        <span className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold lg:justify-center lg:text-sm">
          {t("results.correct", { n: top.roundCorrect })}
          <DifficultyChip difficulty={top.difficulty} />×
          {/* Hệ số riêng của game có thể có 2 chữ số lẻ (vd. 1,55) nên không ép 1 chữ số. */}
          {fmt(gameMultiplier(getGame(gameId), top.difficulty, scoring))}
        </span>
      </span>
    </section>
  );
}
