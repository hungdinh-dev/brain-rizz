import { ClientMessage, GAMES, type GameId, isGameId, type PlayerView } from "@brain-rizz/shared";
import { ArrowRightIcon, TimerIcon, TrendingUpIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { usePlayerName } from "@/components/characters";
import { HostWaitCard } from "@/components/common/HostWaitCard";
import { CategoryChip, RoundChip } from "@/components/common/MatchChips";
import { Button } from "@/components/ui/button";
import { useGameText } from "@/hooks/use-game-text";
import { usePendingAction } from "@/hooks/use-pending-action";
import { useRoomScoring } from "@/hooks/use-room-scoring";
import { isCrowded } from "@/lib/room-size";
import { send } from "@/net/connection";
import { useGame } from "@/stores/game.store";
import { MatchTotals, usePlacementLegend } from "./components/MatchTotals";
import { RoundResults } from "./components/RoundResults";
import { biggestClimber, matchRows, placementList } from "./standings";

/** Bảng điểm vòng hiện bao lâu rồi tự sang bảng tổng điểm (ms). */
const ROUND_VIEW_MS = 5_000;

/**
 * Sau mỗi vòng (pha `round-results`): bảng điểm vòng (khu 9) rồi tự sang bảng cộng điểm trận (khu 10).
 * Chủ phòng bấm "Vòng tiếp theo" (vòng cuối: "Xem người thắng"); người khác chờ.
 */
export function ResultsScreen() {
  const party = useGame((s) => s.party)!;
  if (!isGameId(party.gameId)) return null;
  // key theo vòng → sang vòng mới thì bắt đầu lại từ bảng điểm vòng.
  return <ResultsView key={party.round} gameId={party.gameId} />;
}

function ResultsView({ gameId }: { gameId: GameId }) {
  const { t } = useTranslation();
  const party = useGame((s) => s.party)!;
  const sessionId = useGame((s) => s.sessionId);
  const game = useGameText(gameId);
  const [view, setView] = useState<"round" | "total">("round");
  // Giây còn lại trước khi tự sang bảng tổng điểm; −1 = đã sang một lần (tự hoặc bấm), từ đó
  // "Xem lại kết quả vòng" đứng yên ở bảng vòng, không bị đẩy ngay về bảng tổng.
  const [left, setLeft] = useState(Math.round(ROUND_VIEW_MS / 1000));
  const showTotal = () => {
    setView("total");
    setLeft(-1);
  };

  useEffect(() => {
    if (view !== "round" || left < 0) return;
    if (left === 0) {
      setView("total");
      setLeft(-1);
      return;
    }
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [view, left]);

  const players = Object.values(party.players);
  const isHost = party.hostId === sessionId;
  const lastRound = party.round >= party.totalRounds;

  if (view === "round") {
    return (
      <main className="flex flex-1 flex-col gap-3.5 lg:gap-4.5">
        <header className="flex flex-col gap-2 lg:min-h-14 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex items-center gap-2.5">
            <RoundChip round={party.round} total={party.totalRounds} size="lg" />
            <CategoryChip category={GAMES[gameId].category} className="lg:hidden" />
          </div>
          <h1 className="font-display text-[28px] leading-tight font-extrabold text-chalk lg:sticker-text lg:text-[40px] lg:leading-none lg:text-paper lg:[--stroke:7px]">
            {t("results.title", { game: game.title })}
          </h1>
          <CategoryChip
            category={GAMES[gameId].category}
            className="hidden h-7 text-sm lg:inline-flex"
          />
          {left >= 0 && (
            <span className="hidden items-center gap-2 text-sm text-chalk-muted lg:ml-auto lg:flex">
              <TimerIcon aria-hidden className="size-4.5" />
              {t("results.toTotalIn", { count: left })}
            </span>
          )}
        </header>
        <RoundResults gameId={gameId} players={players} sessionId={sessionId} />
        <div className="mt-auto flex flex-col items-center gap-2 lg:mt-0 lg:items-end">
          {left >= 0 && (
            <span className="flex items-center gap-2 text-[13px] text-chalk-muted lg:hidden">
              <TimerIcon aria-hidden className="size-4" />
              {t("results.toTotalIn", { count: left })}
            </span>
          )}
          <Button variant="chalk" className="rounded-2xl px-5" onClick={showTotal}>
            {t("results.showTotal")}
            <ArrowRightIcon aria-hidden strokeWidth={3} />
          </Button>
        </div>
      </main>
    );
  }

  return (
    <TotalView
      players={players}
      sessionId={sessionId}
      isHost={isHost}
      lastRound={lastRound}
      gameTitle={game.title}
      onBack={() => setView("round")}
    />
  );
}

function TotalView({
  players,
  sessionId,
  isHost,
  lastRound,
  gameTitle,
  onBack,
}: {
  players: PlayerView[];
  sessionId: string;
  isHost: boolean;
  lastRound: boolean;
  gameTitle: string;
  onBack(): void;
}) {
  const { t } = useTranslation();
  const { full } = usePlayerName();
  const party = useGame((s) => s.party)!;
  // Điểm thứ hạng theo đúng số ghế và thưởng top của trận (CR-018, CR-019).
  const { placementTopBonus } = useRoomScoring();
  const crowded = isCrowded(players.length);
  const legend = usePlacementLegend(players.length, placementTopBonus);
  const rows = matchRows(players);
  const showMovement = party.round > 1;
  const climber = showMovement ? biggestClimber(rows) : null;
  const mine = rows.find((r) => r.player.id === sessionId);
  const host = party.players[party.hostId];
  const roundsLeft = party.totalRounds - party.round;
  // Server nhận "Vòng tiếp theo" thì đổi pha (chọn game / vinh danh) → hết chờ.
  const next = usePendingAction(`${party.phase}:${party.round}`);

  const myClimb = mine ? mine.prevRank - mine.rank : 0;
  const personal = mine && showMovement && (
    <div className="flex items-center gap-2.5 rounded-2xl border-[3px] border-sticker bg-compute px-3 py-2.5 text-ink shadow-sticker-sm lg:hidden">
      <TrendingUpIcon aria-hidden className="size-5 shrink-0" strokeWidth={2.6} />
      <span className="text-sm leading-snug font-semibold">
        {myClimb > 0 ? (
          <Trans i18nKey="results.youClimb" count={myClimb} components={{ b: <strong /> }} />
        ) : myClimb < 0 ? (
          t("results.youDrop", { count: -myClimb })
        ) : (
          t("results.youKeep", { rank: mine.rank + 1 })
        )}
        {" · "}
        {lastRound ? t("results.lastRound") : t("results.roundsLeft", { count: roundsLeft })}
      </span>
    </div>
  );

  return (
    <main className="flex flex-1 flex-col gap-3.5 lg:gap-4">
      <header className="flex flex-col gap-2 lg:min-h-14 lg:flex-row lg:items-center lg:gap-4">
        <RoundChip size="lg" className="self-start lg:order-2 lg:self-auto">
          {t("results.afterRound", { round: party.round, total: party.totalRounds })}
        </RoundChip>
        <h1 className="font-display text-3xl leading-none font-extrabold text-chalk lg:order-1 lg:sticker-text lg:text-[44px] lg:text-paper lg:[--stroke:7px]">
          {t("results.totalTitle")}
        </h1>
        <span className="hidden items-center gap-3.5 text-[13px] text-chalk-muted lg:order-3 lg:ml-auto lg:flex">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-4.5 rounded border-2 border-sticker bg-sky" />
            {t("results.legendBefore")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-4.5 rounded border-2 border-sticker bg-mint" />
            {t("results.legendGained")}
          </span>
        </span>
      </header>
      <p className="-mt-1.5 text-[12.5px] text-chalk-muted lg:text-sm">
        {crowded
          ? t("results.placementAll", {
              count: players.length,
              list: placementList(players.length, placementTopBonus).join(" · "),
            })
          : t("results.placement", { list: legend })}
      </p>

      <MatchTotals
        rows={rows}
        sessionId={sessionId}
        showMovement={showMovement}
        compact={crowded}
      />
      {personal}

      <div className="mt-auto flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
        <span className="hidden flex-1 text-sm text-chalk-muted lg:block">
          {climber &&
            t("results.climb", {
              name: full(climber.player),
              count: climber.prevRank - climber.rank,
              game: gameTitle,
            })}
        </span>
        <Button
          variant="chalk"
          className="self-center rounded-2xl px-4 lg:self-auto"
          onClick={onBack}
        >
          {t("results.showRound")}
        </Button>
        {isHost ? (
          <Button
            size="lg"
            className="min-h-16 rounded-[18px] border-4 text-[26px] lg:w-80"
            disabled={next.pending}
            data-sfx="confirm"
            onClick={() => next.run(() => send(ClientMessage.NextRound, {}))}
          >
            {lastRound ? t("results.seeWinner") : t("results.nextRound")}
            <ArrowRightIcon aria-hidden className="size-6" strokeWidth={3} />
          </Button>
        ) : (
          <HostWaitCard host={host} className="lg:w-96">
            {lastRound ? t("results.waitWinner") : t("results.waitNext")}
          </HostWaitCard>
        )}
      </div>
    </main>
  );
}
