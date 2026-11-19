import {
  CATEGORIES,
  type Category,
  ClientMessage,
  categoryLeaders,
  MIN_PLAYERS_TO_START,
  type PlayerView,
} from "@brain-rizz/shared";
import { CrownIcon, DoorOpenIcon, HouseIcon, RotateCcwIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BotBadge, Character, PlayerName, usePlayerName } from "@/components/characters";
import { HostWaitCard } from "@/components/common/HostWaitCard";
import { RoundChip } from "@/components/common/MatchChips";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { RankBadge, rankBg } from "@/components/common/RankBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReactionBubble } from "@/features/chat";
import { useReducedMotion } from "@/features/motion";
import { playSfx, type StopSfx } from "@/features/sfx";
import { usePendingAction } from "@/hooks/use-pending-action";
import { cn } from "@/lib/utils";
import { leaveParty, send } from "@/net/connection";
import { useGame } from "@/stores/game.store";
import { CategoryBest } from "./components/CategoryBest";
import { Confetti } from "./components/Confetti";
import { PODIUM_TIMING, type PodiumTimeline, podiumTimeline } from "./podium-timeline";
import { podiumGroups } from "./standings";

/** Thứ tự cột trên bục: nhì · nhất · ba. */
const COLUMN_ORDER = [1, 0, 2] as const;
/** Chiều cao bục theo hạng (lớp Tailwind; điện thoại / máy tính). */
const STEP_HEIGHT = ["h-26 lg:h-52.5", "h-19 lg:h-37.5", "h-17 lg:h-28"] as const;
/** Nhân vật hạng 1 bắt đầu lắc lư sau khi bung (ms). */
const WINNER_IDLE_AFTER = 1000;
/** Tiếng tick của từng hàng hạng 4+ nhỏ hơn tiếng bấm. */
const ROW_TICK_VOLUME = 0.5;
/** Hạng 4+ từ ngần này người (phòng 9–12 người) thì dùng hàng gọn (ui-ux 6.8). */
const DENSE_REST_MIN = 6;

/**
 * Vào pha `podium` ngay trong phiên này (từ pha khác) thì chạy nhịp vinh danh; mở màn khi pha đã
 * là `podium` (tải lại trang, vào lại phòng) thì hiện hết ngay, không phát trống/kèn (ui-ux 6.2).
 */
let livePodium = false;
useGame.subscribe((s, prev) => {
  if (s.party?.phase === "podium" && prev.party?.phase !== "podium") {
    livePodium = prev.party !== null;
  }
});

/** Thể loại đã chơi trong trận = mọi khoá có trong `categoryScores` (server tạo khoá lúc chốt vòng). */
function playedOf(players: readonly PlayerView[]): Category[] {
  return CATEGORIES.filter((c) => players.some((p) => p.categoryScores?.[c] !== undefined));
}

/** Mọi mốc cần render lại (lật hàng/bậc, trống, nhãn của mình, nhân vật hạng 1 lắc lư). */
function marksOf(timeline: PodiumTimeline, youAt: number | null): number[] {
  const marks = new Set<number>(timeline.rest);
  for (const at of timeline.podium) if (at !== null) marks.add(at);
  if (timeline.drum) marks.add(timeline.drum.start);
  if (timeline.podium[0] !== null) marks.add(timeline.podium[0] + WINNER_IDLE_AFTER);
  for (const at of timeline.best?.rows ?? []) marks.add(at);
  if (youAt !== null) marks.add(youAt);
  return [...marks];
}

/**
 * Vinh danh chung cuộc (pha `podium`, khu 11 + khu 19): hồi hộp kiểu Kahoot — hạng 4+ lần lượt
 * từ dưới lên, hạng 3, hạng 2, trống dồn, rồi hạng 1 bung lên với pháo giấy và kèn; sau đó thẻ
 * Giỏi nhất mỗi thể loại. Bục và khung đứng sẵn nên bố cục không nhảy. Nút chủ phòng bấm được ngay.
 * Giảm chuyển động: giữ nguyên nhịp, chỉ mờ dần, không pháo giấy (ui-ux 6.2).
 */
export function PodiumScreen() {
  const { t } = useTranslation();
  const { full } = usePlayerName();
  const party = useGame((s) => s.party)!;
  const sessionId = useGame((s) => s.sessionId);
  const reduced = useReducedMotion();
  const players = Object.values(party.players);
  const { podium, rest } = podiumGroups(players);
  /** Phòng đông: hạng 4+ có từ 6 người thì dùng hàng gọn (lưới 2 cột trên máy tính). */
  const denseRest = rest.length >= DENSE_REST_MIN;
  const leaders = categoryLeaders(players, playedOf(players));
  const hasBest = leaders.length > 0;
  const isHost = party.hostId === sessionId;
  const host = party.players[party.hostId];
  // Server đếm cả người đang rớt mạng (còn giữ chỗ), nên đếm mọi người trong state cho khớp.
  const canPlayAgain = players.length >= MIN_PLAYERS_TO_START;
  const needPlayersId = useId();
  // "Chơi lại" / "Về phòng chờ": server nhận lệnh thì đổi pha → hết chờ.
  const hostAction = usePendingAction(`${party.phase}:${party.round}`);

  const myPodium = podium.findIndex((g) => g.some((p) => p.id === sessionId));
  const myRestIndex = rest.findIndex((r) => r.player.id === sessionId);
  const rank = myPodium >= 0 ? myPodium : rest[myRestIndex]?.rank;
  const me = party.players[sessionId];

  // Lịch chốt lúc vào màn: người rời giữa chừng không làm xô lệch nhịp.
  const [skip] = useState(() => !livePodium);
  const [timeline] = useState(() =>
    podiumTimeline({
      podiumSizes: [podium[0].length, podium[1].length, podium[2].length],
      restCount: rest.length,
      bestRows: leaders.length,
    }),
  );
  const [youAt] = useState(() => {
    const at = myPodium >= 0 ? timeline.podium[myPodium] : timeline.rest[myRestIndex];
    return at === null || at === undefined ? null : at + PODIUM_TIMING.youDelay;
  });
  // Mốc thời gian đã tới (ms từ lúc vào màn); vào lại giữa chừng → coi như đã hết nhịp.
  const [now, setNow] = useState(skip ? Number.POSITIVE_INFINITY : 0);

  useEffect(() => {
    if (skip) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    let drum: StopSfx | null = null;
    let fanfare: StopSfx | null = null;

    for (const ms of marksOf(timeline, youAt)) at(ms, () => setNow((n) => Math.max(n, ms)));
    for (const ms of timeline.rest) at(ms, () => playSfx("tick", { volume: ROW_TICK_VOLUME }));
    for (const ms of [timeline.podium[2], timeline.podium[1]]) {
      if (ms !== null) at(ms, () => playSfx("reveal"));
    }
    if (timeline.drum) {
      at(timeline.drum.start, () => {
        drum = playSfx("drumroll");
      });
    }
    const winnerAt = timeline.podium[0];
    if (winnerAt !== null) {
      at(winnerAt, () => {
        drum?.();
        fanfare = playSfx("fanfare");
      });
    }
    return () => {
      timers.forEach(clearTimeout);
      drum?.();
      fanfare?.();
    };
  }, [skip, timeline, youAt]);

  const shownAt = (ms: number | null | undefined) => ms !== null && ms !== undefined && now >= ms;
  const winnerShown = shownAt(timeline.podium[0]);
  const drumming = !!timeline.drum && now >= timeline.drum.start && !winnerShown;
  const bestRevealed = shownAt(timeline.best?.start);
  const bestRows = timeline.best?.rows.filter((ms) => now >= ms).length ?? 0;
  /** Lớp hiện của một phần tử: vào lại giữa chừng thì không hoạt ảnh. */
  const enter = (normal: string, fade = "duration-320") =>
    skip ? "" : reduced ? cn("animate-in fade-in", fade) : normal;

  // Trình đọc màn hình: đọc nhịp mới nhất đã tới.
  const events: { at: number; text: string }[] = [];
  rest.forEach(({ player: p, rank: r }, k) => {
    const ms = timeline.rest[k];
    if (ms !== undefined) {
      events.push({
        at: ms,
        text: t("results.revealLive", { rank: r + 1, name: full(p), count: p.matchPoints }),
      });
    }
  });
  podium.forEach((group, r) => {
    const ms = timeline.podium[r];
    const top = group[0];
    if (ms !== null && ms !== undefined && top) {
      events.push({
        at: ms,
        text: t("results.revealLive", {
          rank: r + 1,
          name: group.map(full).join(", "),
          count: top.matchPoints,
        }),
      });
    }
  });
  if (timeline.drum) events.push({ at: timeline.drum.start, text: t("results.drumroll") });
  const announce = events.filter((e) => e.at <= now).sort((a, b) => b.at - a.at)[0]?.text ?? "";

  // Điện thoại: thẻ thể loại hiện mà người chơi chưa tự cuộn → cuộn nhẹ tới thẻ.
  const bestRef = useRef<HTMLElement>(null);
  const userScrolled = useRef(false);
  useEffect(() => {
    const mark = () => {
      userScrolled.current = true;
    };
    const inputs = ["wheel", "touchmove", "keydown"] as const;
    for (const e of inputs) window.addEventListener(e, mark, { passive: true });
    return () => {
      for (const e of inputs) window.removeEventListener(e, mark);
    };
  }, []);
  useEffect(() => {
    if (!bestRevealed || skip || userScrolled.current) return;
    bestRef.current?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [bestRevealed, skip, reduced]);

  const place =
    rank === undefined
      ? ""
      : rank <= 3
        ? t(`ordinal.${rank as 0 | 1 | 2 | 3}`)
        : t("ordinal.other", { n: rank + 1 });
  const youShown = shownAt(youAt);

  const actions = (
    <div
      className={cn(
        "flex flex-col gap-3 lg:col-start-2 lg:row-start-2",
        hasBest && "xl:col-start-3",
      )}
    >
      {isHost ? (
        <>
          <Button
            size="lg"
            className="min-h-16 rounded-[18px] border-4 text-[26px]"
            disabled={!canPlayAgain || hostAction.pending}
            data-sfx="confirm"
            aria-describedby={canPlayAgain ? undefined : needPlayersId}
            onClick={() => hostAction.run(() => send(ClientMessage.PlayAgain, {}))}
          >
            <RotateCcwIcon aria-hidden className="size-6" strokeWidth={3} />
            {t("results.playAgain")}
          </Button>
          {!canPlayAgain && (
            <p
              id={needPlayersId}
              className="-mt-1 text-center text-[13px] font-semibold text-chalk-muted"
            >
              {t("results.playAgainNeedPlayers", { min: MIN_PLAYERS_TO_START })}
            </p>
          )}
          <Button
            variant="outline"
            className="min-h-13.5 rounded-2xl border-[3.5px] text-[21px]"
            disabled={hostAction.pending}
            onClick={() => hostAction.run(() => send(ClientMessage.BackToLobby, {}))}
            data-sfx="back"
          >
            <HouseIcon aria-hidden strokeWidth={2.6} />
            {t("results.backToLobby")}
          </Button>
        </>
      ) : (
        <HostWaitCard host={host}>{t("results.waitPodium")}</HostWaitCard>
      )}
      <Button
        variant="chalk"
        className="min-h-12.5 rounded-2xl text-[19px]"
        onClick={() => void leaveParty()}
        data-sfx="back"
      >
        <DoorOpenIcon aria-hidden strokeWidth={2.6} />
        {t("results.leaveRoom")}
      </Button>
      {isHost && canPlayAgain && (
        <p className="text-center text-[12.5px] text-chalk-muted">{t("results.playAgainNote")}</p>
      )}
    </div>
  );

  return (
    <main className="relative flex flex-1 flex-col gap-3 lg:gap-3.5">
      {winnerShown && !reduced && <Confetti burst={!skip} className="-m-4 lg:-m-6" />}
      <p role="status" className="sr-only">
        {announce}
      </p>
      <header className="relative flex items-center justify-between gap-4 lg:min-h-14 lg:justify-start">
        <h1 className="font-display text-4xl leading-none font-extrabold text-primary lg:sticker-text lg:text-5xl lg:[--stroke:8px]">
          {t("results.final")}
        </h1>
        <RoundChip size="md" className="lg:hidden">
          {t("results.roundsCount", { count: party.totalRounds })}
        </RoundChip>
        <RoundChip size="md" className="hidden lg:inline-flex">
          {t("results.roundsCount", { count: party.totalRounds })} ·{" "}
          {t("results.playersCount", { count: players.length })}
        </RoundChip>
      </header>

      {me && rank !== undefined && (
        // Giữ chỗ từ đầu, chỉ hiện sau khi chỗ của mình đã lật (không lộ kết quả sớm).
        <div
          aria-hidden={!youShown}
          className={cn(
            "relative -rotate-2 self-center rounded-[14px] border-[3px] border-sticker bg-card px-3.5 py-1.5 font-display text-[19px] font-extrabold text-card-foreground shadow-sticker-sm lg:hidden",
            youShown ? enter("fx-tag-pop") : "invisible",
          )}
        >
          {t("results.youPlace", { place, count: me.matchPoints })}
        </div>
      )}

      <div
        className={cn(
          "relative flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-x-7 lg:gap-y-3.5",
          hasBest
            ? "lg:grid-rows-[1fr_auto_auto] xl:grid-cols-[320px_minmax(0,1fr)_330px] xl:grid-rows-[1fr_auto] xl:gap-x-5"
            : "lg:grid-rows-[1fr_auto]",
        )}
      >
        <div
          className={cn(
            "flex flex-1 items-end justify-center pt-9 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:pt-12 lg:pb-1.5",
            hasBest && "xl:col-start-2",
          )}
        >
          {COLUMN_ORDER.map((r) => (
            <PodiumColumn
              key={r}
              rank={r}
              group={podium[r]}
              shown={shownAt(timeline.podium[r])}
              idle={r !== 0 || now >= (timeline.podium[0] ?? 0) + (skip ? 0 : WINNER_IDLE_AFTER)}
              drumming={r === 0 && drumming}
              reduced={reduced}
              instant={skip}
              compact={hasBest}
            />
          ))}
        </div>

        {rest.length > 0 && (
          <Card
            className={cn(
              "gap-2 rounded-[18px] border-[3.5px] p-3 lg:col-start-2 lg:row-start-1 lg:self-end lg:rounded-[22px] lg:border-4 lg:px-4 lg:py-3.5",
              hasBest && "xl:col-start-3",
            )}
          >
            <h2 className="font-display text-lg font-extrabold lg:text-[21px]">
              {t("results.restTitle")}
            </h2>
            {/*
              Phòng đông (từ 6 người hạng 4+, ui-ux 6.8): máy tính lưới 2 cột × 5 hàng 36 px đổ theo
              cột (cột trái hạng 4–8); điện thoại một cột hàng 44 px. Nhịp lật giữ nguyên: từ hạng
              thấp nhất lên (cột phải trước, rồi cột trái).
            */}
            <ol
              className={cn(
                "flex flex-col",
                denseRest
                  ? "gap-1.5 lg:grid lg:grid-flow-col lg:grid-cols-2 lg:grid-rows-[repeat(5,2.25rem)] lg:gap-x-1.5 lg:gap-y-1.25"
                  : "gap-2",
              )}
            >
              {rest.map(({ player: p, rank: r }, k) => {
                const shown = shownAt(timeline.rest[k]);
                return (
                  <li
                    key={p.id}
                    aria-hidden={!shown}
                    className={cn(
                      "flex items-center border-sticker",
                      denseRest
                        ? "h-11 min-w-0 gap-2.25 rounded-[14px] border-[3px] pr-3 pl-1.75 lg:h-9 lg:gap-1.25 lg:rounded-[11px] lg:border-[2.5px] lg:pr-1.75 lg:pl-1"
                        : "min-h-12.5 gap-2.5 rounded-[14px] border-[3px] pr-3 pl-2",
                      p.id === sessionId ? "bg-primary/30" : "bg-card",
                      shown ? enter("fx-row-in") : "opacity-0",
                    )}
                  >
                    <RankBadge
                      rank={r + 1}
                      size="md"
                      className={
                        denseRest
                          ? "size-7 border-[2.5px] text-[15px] lg:size-5.5 lg:border-2 lg:text-xs"
                          : undefined
                      }
                    />
                    <span className="relative flex shrink-0">
                      <PlayerAvatar
                        avatar={p.avatar}
                        colorIndex={p.colorIndex}
                        size="md"
                        className={denseRest ? "size-8 border-2 lg:size-6" : "size-9.5"}
                      />
                      {p.isBot && (
                        <BotBadge
                          size={denseRest ? "xs" : "sm"}
                          // Avatar 24 px (máy tính): huy hiệu 14 px như dải ghế của hộp thoại bot.
                          className={
                            denseRest
                              ? "lg:-right-0.75 lg:-bottom-0.75 lg:size-3.5 lg:[&_svg]:size-2"
                              : undefined
                          }
                        />
                      )}
                      {shown && <ReactionBubble playerId={p.id} placement="corner" />}
                    </span>
                    {/*
                      Lưới 2 cột (máy tính) chỉ còn ~60 px cho tên: "· máy" nhường cho huy hiệu máy
                      trên avatar (`compact`, trình đọc màn hình và `title` vẫn đủ). Điện thoại một
                      cột còn chỗ nên giữ hậu tố.
                    */}
                    {denseRest && (
                      <span className="hidden min-w-0 flex-1 lg:flex">
                        <PlayerName
                          player={p}
                          compact
                          className="font-display text-[14.5px] leading-none font-extrabold"
                        />
                      </span>
                    )}
                    <span
                      className={cn(
                        "flex min-w-0 flex-1 items-baseline gap-1 overflow-x-clip",
                        denseRest && "lg:hidden",
                      )}
                    >
                      <PlayerName
                        player={p}
                        className={cn(
                          "truncate font-display font-extrabold",
                          denseRest ? "text-[17px]" : "text-lg",
                        )}
                        suffixClassName={cn(
                          "text-muted-foreground",
                          denseRest ? "text-[11.5px]" : "text-xs",
                        )}
                      />
                    </span>
                    <span
                      className={cn(
                        "font-display font-extrabold tabular-nums",
                        denseRest ? "text-[19px] lg:text-base lg:leading-none" : "text-xl",
                      )}
                    >
                      {p.matchPoints}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card>
        )}

        {hasBest && (
          <CategoryBest
            ref={bestRef}
            leaders={leaders}
            players={party.players}
            sessionId={sessionId}
            revealed={bestRevealed}
            shownRows={bestRows}
            reduced={reduced}
            instant={skip}
            className="lg:col-span-2 lg:row-start-3 xl:col-span-1 xl:col-start-1 xl:row-span-2 xl:row-start-1 xl:self-end"
          />
        )}

        {actions}
      </div>
    </main>
  );
}

/**
 * Một bục: đứng sẵn từ đầu (màu theo hạng, số hạng) với vòng phấn "?" thay nhân vật; tới lượt
 * thì nhân vật chiến thắng nhô lên (hạng 1: bung, vương miện rơi, viền bục loé), tên + điểm mờ
 * dần vào. Đồng hạng thì tên xếp dọc, lật cùng lúc.
 */
function PodiumColumn({
  rank,
  group,
  shown,
  idle,
  drumming,
  reduced,
  instant,
  compact,
}: {
  rank: number;
  group: readonly PlayerView[];
  shown: boolean;
  /** Nhân vật được lắc lư (hạng 1: sau khi bung xong). */
  idle: boolean;
  /** Đang trống dồn chờ hạng 1. */
  drumming: boolean;
  reduced: boolean;
  /** Vào lại giữa chừng: hiện ngay, không hoạt ảnh. */
  instant: boolean;
  /** Có thẻ thể loại bên trái (máy tính ≥ 1280): bậc hẹp lại. */
  compact: boolean;
}) {
  const { t } = useTranslation();
  const { full } = usePlayerName();
  const top = group[0];
  const width = cn("w-27.5 lg:w-55", compact && "xl:w-auto xl:min-w-0 xl:max-w-40 xl:flex-1");
  if (!top) return <div className={width} />;

  const winner = rank === 0;
  const enter = (normal: string, fade: string) =>
    instant ? "" : reduced ? cn("animate-in fade-in", fade) : normal;

  return (
    <div className={cn("flex flex-col items-center", width)}>
      <span className="relative -mb-1.5 lg:-mb-2.5">
        {drumming && (
          <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 font-display text-lg leading-none font-extrabold whitespace-nowrap text-primary motion-safe:animate-pulse lg:mb-2 lg:text-2xl">
            {t("results.drumroll")}
          </span>
        )}
        {winner && shown && (
          <CrownIcon
            aria-hidden
            className={cn(
              "absolute -top-3 left-1/2 z-10 size-6 -translate-x-1/2 fill-primary text-sticker lg:-top-6.5 lg:size-10",
              enter("fx-crown-drop", "duration-400"),
            )}
            strokeWidth={2.2}
          />
        )}
        <span
          className={cn(
            "block",
            shown
              ? winner
                ? enter("fx-win-pop", "duration-400")
                : enter("fx-step-rise", "duration-320")
              : "invisible",
          )}
        >
          <Character
            id={top.avatar}
            mood="win"
            size={150}
            animated={shown && idle && !reduced}
            label={t("results.winnerLabel", { name: full(top) })}
            className={cn("max-lg:[&_svg]:size-21", compact && !winner && "xl:[&_svg]:size-30")}
          />
        </span>
        {shown && (
          <ReactionBubble playerId={group.map((p) => p.id)} className="bottom-[calc(100%-6px)]" />
        )}
        {!shown && (
          <span
            aria-hidden
            className={cn(
              "absolute inset-[14%] flex items-center justify-center rounded-full border-[3px] border-dashed border-chalk/55 font-display text-3xl font-extrabold text-chalk-muted lg:text-5xl",
              drumming && !reduced && "fx-breathe",
            )}
          >
            {t("results.unknown")}
          </span>
        )}
      </span>
      <div
        className={cn(
          "flex w-full flex-col items-center gap-px rounded-t-[9px] border-[3px] border-sticker pt-1.5 text-ink shadow-sticker lg:gap-0.5 lg:rounded-t-[18px] lg:border-4 lg:pt-2.5",
          rankBg(rank + 1),
          STEP_HEIGHT[rank],
          winner && shown && !instant && !reduced && "fx-step-flash",
        )}
      >
        <span className="font-display text-[28px] leading-[0.9] font-extrabold lg:text-[56px]">
          {rank + 1}
        </span>
        <span
          aria-hidden={!shown}
          className={cn(
            "flex w-full flex-col items-center gap-px lg:gap-0.5",
            shown ? "opacity-100" : "opacity-0",
            !instant && "transition-opacity delay-150 duration-300",
          )}
        >
          {group.map((p) => (
            // Bot: huy hiệu đứng trước tên (nhân vật trên bục không có khung tròn). Bậc hẹp (máy
            // tính có cột chat) thì "· máy" xuống dòng thay vì cắt mất tên.
            <span
              key={p.id}
              className="flex max-w-full min-w-0 flex-wrap items-center justify-center gap-x-1 gap-y-px px-1"
            >
              {p.isBot && <BotBadge size="sm" inline />}
              <PlayerName
                player={p}
                className="max-w-full truncate font-display text-[15px] leading-none font-extrabold lg:text-2xl"
                suffixClassName="text-[11px] leading-none lg:text-sm"
              />
            </span>
          ))}
          <span className="text-xs font-bold lg:text-[15px]">
            {t("results.points", { count: top.matchPoints })}
          </span>
        </span>
      </div>
    </div>
  );
}
