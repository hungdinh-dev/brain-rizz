import { ClientMessage, MIN_PLAYERS_TO_START, type PlayerView } from "@brain-rizz/shared";
import { CrownIcon, DoorOpenIcon, HouseIcon, RotateCcwIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Character } from "@/components/characters";
import { HostWaitCard } from "@/components/common/HostWaitCard";
import { RoundChip } from "@/components/common/MatchChips";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { RankBadge, rankBg } from "@/components/common/RankBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePendingAction } from "@/hooks/use-pending-action";
import { cn } from "@/lib/utils";
import { leaveParty, send } from "@/net/connection";
import { useGame } from "@/stores/game.store";
import { Confetti } from "./components/Confetti";
import { podiumGroups } from "./standings";

/** Nhịp hiện lần lượt hạng 3 → 2 → 1 kiểu Kahoot (ms). */
const REVEAL_MS = [500, 1500, 2700] as const;
/** Thứ tự cột trên bục: nhì · nhất · ba. */
const COLUMN_ORDER = [1, 0, 2] as const;
/** Chiều cao bục theo hạng (lớp Tailwind; điện thoại / máy tính). */
const STEP_HEIGHT = ["h-26 lg:h-52.5", "h-19 lg:h-37.5", "h-17 lg:h-28"] as const;

/**
 * Vinh danh chung cuộc (pha `podium`, khu 11): bục 2D, hiện lần lượt hạng 3, 2, 1 với nhân vật
 * biểu cảm chiến thắng, pháo giấy; hạng 4 trở đi xếp danh sách. Chủ phòng "Chơi lại" / "Về phòng chờ".
 */
export function PodiumScreen() {
  const { t } = useTranslation();
  const party = useGame((s) => s.party)!;
  const sessionId = useGame((s) => s.sessionId);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const players = Object.values(party.players);
  const { podium, rest } = podiumGroups(players);
  const isHost = party.hostId === sessionId;
  const host = party.players[party.hostId];
  // Server đếm cả người đang rớt mạng (còn giữ chỗ), nên đếm mọi người trong state cho khớp.
  const canPlayAgain = players.length >= MIN_PLAYERS_TO_START;
  const needPlayersId = useId();
  // "Chơi lại" / "Về phòng chờ": server nhận lệnh thì đổi pha → hết chờ.
  const hostAction = usePendingAction(`${party.phase}:${party.round}`);

  // Số bục đã hiện (0 → 3). Giảm chuyển động: hiện hết ngay.
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    if (reduced) {
      setRevealed(3);
      return;
    }
    const timers = REVEAL_MS.map((ms, i) => setTimeout(() => setRevealed(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [reduced]);

  const myRank = podium.findIndex((g) => g.some((p) => p.id === sessionId));
  const myRestRank = rest.find((r) => r.player.id === sessionId)?.rank;
  const rank = myRank >= 0 ? myRank : myRestRank;
  const me = party.players[sessionId];
  const place =
    rank === undefined
      ? ""
      : rank <= 3
        ? t(`ordinal.${rank as 0 | 1 | 2 | 3}`)
        : t("ordinal.other", { n: rank + 1 });

  const actions = (
    <div className="flex flex-col gap-3">
      {isHost ? (
        <>
          <Button
            size="lg"
            className="min-h-16 rounded-[18px] border-4 text-[26px]"
            disabled={!canPlayAgain || hostAction.pending}
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
      {revealed >= 3 && <Confetti className="-m-4 lg:-m-6" />}
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
        <div className="relative -rotate-2 self-center rounded-[14px] border-[3px] border-sticker bg-card px-3.5 py-1.5 font-display text-[19px] font-extrabold text-card-foreground shadow-sticker-sm lg:hidden">
          {t("results.youPlace", { place, count: me.matchPoints })}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-7">
        <div className="flex flex-1 items-end justify-center pt-4 lg:pb-1.5">
          {COLUMN_ORDER.map((r) => (
            <PodiumColumn key={r} rank={r} group={podium[r]} shown={revealed >= 3 - r} />
          ))}
        </div>

        <div className="flex flex-col justify-end gap-3.5 lg:w-82.5 lg:shrink-0">
          {rest.length > 0 && (
            <Card className="gap-2 rounded-[18px] border-[3.5px] p-3 lg:rounded-[22px] lg:border-4 lg:px-4 lg:py-3.5">
              <h2 className="font-display text-lg font-extrabold lg:text-[21px]">
                {t("results.restTitle")}
              </h2>
              <ol className="flex flex-col gap-2">
                {rest.map(({ player: p, rank: r }) => (
                  <li
                    key={p.id}
                    className={cn(
                      "flex min-h-12.5 items-center gap-2.5 rounded-[14px] border-[3px] border-sticker pr-3 pl-2",
                      p.id === sessionId ? "bg-primary/30" : "bg-card",
                    )}
                  >
                    <RankBadge rank={r + 1} size="md" />
                    <PlayerAvatar
                      avatar={p.avatar}
                      colorIndex={p.colorIndex}
                      size="md"
                      className="size-9.5"
                    />
                    <span className="flex-1 truncate font-display text-lg font-extrabold">
                      {p.name}
                    </span>
                    <span className="font-display text-xl font-extrabold tabular-nums">
                      {p.matchPoints}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
          {actions}
        </div>
      </div>
    </main>
  );
}

/** Một bục: nhân vật chiến thắng đứng trên khối màu theo hạng; đồng hạng thì tên xếp dọc. */
function PodiumColumn({
  rank,
  group,
  shown,
}: {
  rank: number;
  group: readonly PlayerView[];
  shown: boolean;
}) {
  const { t } = useTranslation();
  const top = group[0];
  if (!top) return <div className="w-27.5 lg:w-55" />;

  return (
    <div
      className={cn(
        "flex w-27.5 flex-col items-center transition-[opacity,translate] duration-500 lg:w-55",
        shown ? "opacity-100" : "translate-y-6 opacity-0",
      )}
    >
      <span className="relative -mb-1.5 lg:-mb-2.5">
        {rank === 0 && (
          <CrownIcon
            aria-hidden
            className="absolute -top-3 left-1/2 size-6 -translate-x-1/2 fill-primary text-sticker lg:-top-6.5 lg:size-10"
            strokeWidth={2.2}
          />
        )}
        <Character
          id={top.avatar}
          mood="win"
          size={150}
          animated={shown}
          label={t("results.winnerLabel", { name: top.name })}
          className="max-lg:[&_svg]:size-21"
        />
      </span>
      <div
        className={cn(
          "flex w-full flex-col items-center gap-px rounded-t-[9px] border-[3px] border-sticker pt-1.5 text-ink shadow-sticker lg:gap-0.5 lg:rounded-t-[18px] lg:border-4 lg:pt-2.5",
          rankBg(rank + 1),
          STEP_HEIGHT[rank],
        )}
      >
        <span className="font-display text-[28px] leading-[0.9] font-extrabold lg:text-[56px]">
          {rank + 1}
        </span>
        {group.map((p) => (
          <span
            key={p.id}
            className="max-w-full truncate px-1 font-display text-[15px] leading-none font-extrabold lg:text-2xl"
          >
            {p.name}
          </span>
        ))}
        <span className="text-xs font-bold lg:text-[15px]">
          {t("results.points", { count: top.matchPoints })}
        </span>
      </div>
    </div>
  );
}
