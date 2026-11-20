import { ClientMessage, GAMES, type GameId, type PartyStateView } from "@brain-rizz/shared";
import { HandIcon, LockIcon, VoteIcon } from "lucide-react";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { HostWaitCard } from "@/components/common/HostWaitCard";
import { useGameTextLookup } from "@/hooks/use-game-text";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { usePendingAction } from "@/hooks/use-pending-action";
import { send } from "@/net/connection";
import {
  desktopSoonLayout,
  enabledGames,
  pickableGames,
  tallyVotes,
  topVoted,
  UPCOMING,
} from "../catalog";
import { GameCard } from "./GameCard";

/** Số ô của lưới thẻ trên máy tính (4 × 2). */
const DESKTOP_CELLS = 8;

interface PickViewProps {
  party: PartyStateView;
  sessionId: string;
  isHost: boolean;
}

/**
 * Chế độ "Chủ phòng chọn" (khu 6): lưới thẻ game, người chơi chạm để bình chọn (chạm lại = bỏ phiếu),
 * chủ phòng chọn thẻ rồi bấm "Chơi game này". Phiếu chỉ là gợi ý.
 */
export function PickView({ party, sessionId, isHost }: PickViewProps) {
  const { t } = useTranslation();
  const text = useGameTextLookup();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  // Game admin tắt (CR-019) không hiện thẻ: không chọn, không bầu được (server cũng chặn).
  const shown = enabledGames(party);
  const available = pickableGames(party);
  const tally = tallyVotes(party);
  const top = topVoted(tally);
  const myVote = party.votes[sessionId];
  const host = party.players[party.hostId];
  // "Chơi game này": server nhận lệnh thì chuyển sang pha hướng dẫn → hết chờ.
  const pick = usePendingAction(`${party.phase}:${party.round}:${party.pickMode}`);

  // Chủ phòng: mặc định chọn game được bầu nhiều nhất, tự chọn thì giữ lựa chọn đó.
  const [picked, setPicked] = useState<GameId | null>(null);
  const selected =
    picked && available.includes(picked) ? picked : (top?.id ?? available[0] ?? null);

  // Ô "Sắp có": máy tính lấp lưới 4×2 (thừa thì gom thành "+N trò"), điện thoại gom một ô.
  const soon = desktopSoonLayout(shown.length, UPCOMING.length, DESKTOP_CELLS);

  return (
    <div className="flex flex-1 flex-col gap-3 lg:gap-4">
      <div className="flex flex-col justify-center gap-0.5 rounded-[14px] border-[3px] border-sticker bg-primary px-3 py-2 text-primary-foreground shadow-sticker-sm lg:min-h-13 lg:flex-row lg:items-center lg:gap-3 lg:rounded-2xl lg:border-[3.5px] lg:px-4.5">
        <VoteIcon aria-hidden className="hidden size-6 shrink-0 lg:block" strokeWidth={2.4} />
        {top ? (
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-sm font-semibold lg:text-base">{t("gameSelect.wanted")}</span>
            <strong className="font-display text-[19px] font-extrabold lg:text-[25px]">
              {text(top.id).title}
            </strong>
            <span className="font-display text-[17px] font-bold lg:text-xl">
              · {t("gameSelect.votes", { count: top.votes })}
            </span>
          </span>
        ) : (
          <span className="font-display text-lg font-extrabold">
            {isHost ? t("gameSelect.noVotes") : t("gameSelect.noVotesTap")}
          </span>
        )}
        <span className="text-xs font-semibold text-primary-foreground/80 lg:ml-auto lg:text-sm">
          {isHost ? t("gameSelect.voteHintHost") : t("gameSelect.voteHintPlayer")}
        </span>
      </div>

      {!isHost && (
        <span className="flex items-center gap-1.5 text-sm font-semibold text-chalk lg:hidden">
          <HandIcon aria-hidden className="size-4.5" />
          {t("gameSelect.tapToVote")}
        </span>
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-3.5 pt-1 lg:grid-cols-4 lg:auto-rows-fr lg:gap-x-4.5 lg:gap-y-4">
        {shown.map((id) => {
          const isPlayed = !available.includes(id);
          const voters = tally.get(id) ?? [];
          return (
            <GameCard
              key={id}
              id={id}
              name={text(id).title}
              summary={text(id).summary}
              category={GAMES[id].category}
              state={isPlayed ? "played" : "available"}
              voters={voters}
              selected={isHost && !isPlayed && id === selected}
              myVote={isHost ? undefined : myVote === id}
              onPress={
                isPlayed
                  ? undefined
                  : isHost
                    ? () => setPicked(id)
                    : () => send(ClientMessage.VoteGame, { gameId: myVote === id ? null : id })
              }
              onPlay={() => pick.run(() => send(ClientMessage.PickGame, { gameId: id }))}
              playPending={pick.pending}
            />
          );
        })}
        {desktop ? (
          <>
            {UPCOMING.slice(0, soon.cards).map((g) => (
              <GameCard
                key={g.id}
                id={g.id}
                name={t(`catalog.${g.id}.name`)}
                summary={t(`catalog.${g.id}.desc`)}
                category={g.category}
                state="soon"
                voters={[]}
              />
            ))}
            {soon.more > 0 && (
              <div className="flex flex-col items-center justify-center gap-1 rounded-[20px] border-[3px] border-dashed border-chalk/55 text-chalk">
                <span className="font-display text-[34px] leading-none font-extrabold">
                  {t("gameSelect.moreSoon", { count: soon.more })}
                </span>
                <span className="text-sm text-chalk-muted">{t("gameSelect.moreSoonNote")}</span>
              </div>
            )}
          </>
        ) : (
          UPCOMING.length > 0 && (
            <div
              aria-disabled
              className="flex flex-col justify-center gap-1 rounded-[18px] border-[3px] border-dashed border-chalk/60 p-2.5 text-chalk"
            >
              <span className="flex items-center gap-1.5 font-display text-[17px] font-extrabold">
                <LockIcon aria-hidden className="size-4" strokeWidth={2.8} />
                {t("gameSelect.soon")}
              </span>
              <span className="text-[12.5px] leading-snug text-chalk-muted">
                {UPCOMING.slice(0, 2).map((g) => (
                  <span key={g.id} className="block">
                    {t(`catalog.${g.id}.name`)}
                  </span>
                ))}
                {UPCOMING.length > 2 && t("gameSelect.moreSoonShort", { n: UPCOMING.length - 2 })}
              </span>
            </div>
          )
        )}
      </div>

      {!isHost && (
        <HostWaitCard host={host} className="mt-auto">
          <Trans i18nKey="gameSelect.waitPick" values={{ name: host?.name ?? "" }} />
        </HostWaitCard>
      )}
    </div>
  );
}
