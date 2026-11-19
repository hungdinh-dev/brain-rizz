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
import { BellRingIcon, BookOpenIcon, CheckIcon, CrownIcon, TriangleAlertIcon } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BotBadge, PlayerName, usePlayerName } from "@/components/characters";
import { DifficultyChip } from "@/components/common/MatchChips";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNumberFormat } from "@/hooks/use-number-format";
import { useRoomScoring } from "@/hooks/use-room-scoring";
import { isCompactRoster } from "@/lib/room-size";
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
 * Phòng 8–12 người (CR-018, cùng ngưỡng 12 ô của phòng chờ): hàng gọn, máy tính chia 2 cột
 * (xem `CompactRow`).
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
  const { full } = usePlayerName();
  // "Đã hiểu" tính cả bot (bot tự bấm sau 1–3 giây).
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

  // Bot (CR-016): độ khó theo mức, không bị đánh dấu lệch, không bị nhắc.
  const isOff = (p: PlayerView) => !p.isBot && majority !== null && p.difficulty !== majority;
  // Cột nút "Nhắc" chỉ giữ chỗ khi có người nhắc được; phòng toàn bot + chủ phòng (điện thoại
  // rất hẹp) thì nhường chỗ cho tên "Fen · máy".
  const nudgeColumn = isHost && players.some((p) => isOff(p) && !p.isHost);
  const crowded = isCompactRoster(players.length);

  // Hệ số theo công thức của phòng (admin ghi đè được, CR-019); server chấm cùng hàm này.
  const scoring = useRoomScoring();
  const game = getGame(gameId);
  const multipliers = DIFFICULTIES.map(
    (d) => `${t(`difficulty.${d}`)} ×${fmt(gameMultiplier(game, d, scoring))}`,
  ).join(" · ");

  return (
    <Card
      className={cn(
        "rounded-[22px] border-4 px-3 py-3 lg:px-4",
        // Phòng đông: thẻ gọn hơn chút để nút "Bắt đầu chơi" vẫn trong màn đầu ở 1280×800.
        crowded ? "@container gap-1.5 lg:py-2.5" : "gap-2",
        className,
      )}
    >
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
      {crowded ? (
        // Phòng đông: thẻ rộng từ 34rem (máy tính, chat thu gọn) chia 2 cột đổ theo cột (cột trái
        // người 1–6, chủ phòng đầu tiên); hẹp hơn (điện thoại, cột chat mở) thì một cột.
        <ul
          className="grid gap-0.5 @min-[34rem]:grid-flow-col @min-[34rem]:grid-cols-2 @min-[34rem]:grid-rows-[repeat(var(--rows),auto)] @min-[34rem]:gap-x-3"
          // Số hàng mỗi cột tính lúc chạy (8–12 người → 4–6 hàng).
          style={{ "--rows": Math.ceil(players.length / 2) } as CSSProperties}
        >
          {players.map((p) => (
            <CompactRow
              key={p.id}
              player={p}
              isMe={p.id === sessionId}
              off={isOff(p)}
              nudgeColumn={nudgeColumn}
              canNudge={isHost && isOff(p) && !p.isHost}
              nudged={!!nudged[p.id]}
              onNudge={() => nudge(p.id)}
            />
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-1">
          {players.map((p) => {
            const off = isOff(p);
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
                  {p.isBot && <BotBadge size="sm" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight lg:w-43 lg:flex-none">
                  <span className="flex min-w-0 items-baseline gap-1.5 overflow-x-clip">
                    <PlayerName
                      player={p}
                      className="truncate font-display text-base font-extrabold lg:text-lg"
                      suffixClassName="text-xs text-muted-foreground"
                    />
                    {p.id === sessionId && (
                      <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                        {t("lobby.you")}
                      </span>
                    )}
                  </span>
                  {p.isBot && (
                    <span className="truncate text-[11.5px] text-muted-foreground">
                      {t("bots.introLevel", { level: t(`bots.level.${p.botLevel}`) })}
                    </span>
                  )}
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
                {nudgeColumn && (
                  <span className="flex w-18 shrink-0 justify-end lg:w-21">
                    {canNudge && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11 rounded-xl px-3 text-base"
                        aria-label={t("intro.nudgeLabel", { name: full(p) })}
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
      )}
      <p className="text-[12.5px] text-muted-foreground">
        {t("intro.multipliers", { list: multipliers })}
      </p>
    </Card>
  );
}

interface CompactRowProps {
  player: PlayerView;
  isMe: boolean;
  /** Lệch độ khó đa số */
  off: boolean;
  /** Giữ chỗ cột "Nhắc" để các hàng thẳng cột */
  nudgeColumn: boolean;
  canNudge: boolean;
  nudged: boolean;
  onNudge(): void;
}

/**
 * Hàng gọn (phòng 8–12 người): cao 36 px điện thoại / 38 px máy tính · avatar 28 (huy hiệu máy
 * `xs`, vương miện 16) · tên 16 px cắt "…" (hậu tố "· máy" nhường cho huy hiệu, `PlayerName
 * compact`) · chip độ khó 24 px · "Đã hiểu" / "Đang đọc…" chỉ còn icon tròn 24 px (`aria-label` +
 * `title`) · nút nhắc chỉ còn icon chuông 32 px, vùng chạm 44 px. Hàng của mình tô `bg-primary/30`
 * ("(bạn)" chỉ cho trình đọc màn hình); dòng "Độ khó theo mức" của bot và nhãn "Lệch so với cả
 * phòng" thu thành `title` + chữ cho trình đọc màn hình, lệch thì viền `identify` + icon cảnh báo
 * (icon nhường chỗ cho nút nhắc khi có nút).
 */
function CompactRow({
  player: p,
  isMe,
  off,
  nudgeColumn,
  canNudge,
  nudged,
  onNudge,
}: CompactRowProps) {
  const { t } = useTranslation();
  const { full } = usePlayerName();
  const understood = p.isHost || p.introReady;
  const botLevel = p.isBot
    ? t("bots.introLevel", { level: t(`bots.level.${p.botLevel}`) })
    : undefined;
  const status = understood ? t("intro.understood") : t("intro.reading");

  return (
    <li
      className={cn(
        "flex h-9 min-w-0 items-center gap-1.5 rounded-xl border-[2.5px] px-1.5 lg:h-9.5",
        off ? "border-identify" : "border-transparent",
        isMe ? "bg-primary/30" : off && "bg-identify/15",
        !p.connected && "opacity-50",
      )}
    >
      <span className="relative flex shrink-0">
        <PlayerAvatar avatar={p.avatar} colorIndex={p.colorIndex} size="sm" className="size-7" />
        {p.isHost && (
          <span
            role="img"
            aria-label={t("lobby.host")}
            className="absolute -top-1.5 -left-1.5 grid size-4 -rotate-14 place-items-center rounded-full border-2 border-sticker bg-primary text-primary-foreground"
          >
            <CrownIcon aria-hidden className="size-2" strokeWidth={3.4} />
          </span>
        )}
        {p.isBot && <BotBadge size="xs" />}
      </span>
      <span className="flex min-w-0 flex-1 items-center">
        <PlayerName
          player={p}
          compact
          className="font-display text-base leading-tight font-extrabold"
        />
        {/* Hàng của mình đã tô nền: "(bạn)" chỉ còn cho trình đọc màn hình. */}
        {isMe && <span className="sr-only">{` ${t("lobby.you")}`}</span>}
        {botLevel && <span className="sr-only">{`, ${botLevel}`}</span>}
        {off && <span className="sr-only">{`, ${t("intro.offMajority")}`}</span>}
      </span>
      {off && !canNudge && (
        <span
          aria-hidden
          title={t("intro.offMajority")}
          className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-sticker bg-identify text-ink"
        >
          <TriangleAlertIcon className="size-2.5" strokeWidth={3} />
        </span>
      )}
      <DifficultyChip
        difficulty={p.difficulty}
        title={botLevel}
        className="h-6 min-w-14 justify-center border-2 px-1.75 text-[11.5px]"
      />
      <span
        role="img"
        aria-label={status}
        title={status}
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border-2",
          understood
            ? "border-sticker bg-compute text-ink"
            : "border-dashed border-muted-foreground/70 text-muted-foreground",
        )}
      >
        {understood ? (
          <CheckIcon aria-hidden className="size-3.5" strokeWidth={3} />
        ) : (
          <BookOpenIcon aria-hidden className="size-3" strokeWidth={2.6} />
        )}
      </span>
      {nudgeColumn && (
        <span className="flex w-8 shrink-0 justify-end">
          {canNudge && (
            <Button
              variant="outline"
              size="icon-sm"
              // Nút 32 px cho vừa hàng 36–38 px, vùng chạm vẫn 44 px (lớp `after` trong suốt).
              className="relative size-8 rounded-[10px] border-[2.5px] after:absolute after:-inset-1.5"
              aria-label={t("intro.nudgeLabel", { name: full(p) })}
              title={nudged ? t("intro.nudged") : t("intro.nudge")}
              disabled={nudged}
              onClick={onNudge}
            >
              {nudged ? (
                <CheckIcon aria-hidden className="size-4" strokeWidth={3} />
              ) : (
                <BellRingIcon aria-hidden className="size-4" strokeWidth={2.6} />
              )}
            </Button>
          )}
        </span>
      )}
    </li>
  );
}
