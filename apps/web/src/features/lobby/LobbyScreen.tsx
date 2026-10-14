import {
  type CharacterId,
  ClientMessage,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
} from "@brain-rizz/shared";
import { ArrowLeftIcon, CheckIcon, UserPlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { loadProfile, saveProfile } from "@/features/home";
import { usePendingAction } from "@/hooks/use-pending-action";
import { cn } from "@/lib/utils";
import { leaveParty, send } from "@/net/connection";
import { useGame, useMe } from "@/stores/game.store";
import { CharacterPicker } from "./components/CharacterPicker";
import { HostStatusCard, MatchSetupCard } from "./components/MatchSetupCard";
import { EmptySlot, PlayerSlot } from "./components/PlayerSlot";
import { ReadyMeter } from "./components/ReadyMeter";
import { RoomCodePanel } from "./components/RoomCodePanel";

/**
 * Phòng chờ 2D (khu 5): mã phòng, 8 ô người chơi, đổi nhân vật, sẵn sàng; chủ phòng thiết lập trận.
 * Điện thoại một cột; máy tính chia lưới: người chơi bên trái, thẻ thiết lập bên phải.
 */
export function LobbyScreen() {
  const { t } = useTranslation();
  const party = useGame((s) => s.party)!;
  const sessionId = useGame((s) => s.sessionId);
  const reconnecting = useGame((s) => s.connection === "reconnecting");
  const me = useMe();

  // Chủ phòng đứng đầu, còn lại giữ thứ tự vào phòng.
  const players = Object.values(party.players).sort((a, b) => Number(b.isHost) - Number(a.isHost));
  const readyCount = players.filter((p) => p.ready).length;
  const isHost = party.hostId === sessionId;
  const hostName = party.players[party.hostId]?.name ?? "";
  const inviteUrl = `${location.origin}/r/${party.code}`;
  // Bấm đúp "Bắt đầu" không gửi hai lần (lần hai server báo sai pha).
  const startMatch = usePendingAction(party.phase);

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Brain Rizz",
          text: t("lobby.shareText", { code: party.code }),
          url: inviteUrl,
        });
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        toast.success(t("lobby.linkCopied"));
      }
    } catch {
      /* người dùng huỷ chia sẻ */
    }
  }

  function pickCharacter(avatar: CharacterId) {
    send(ClientMessage.SetProfile, { avatar });
    // Nhớ cho lần sau vào phòng (hồ sơ lưu ở máy).
    saveProfile({ ...loadProfile(), avatar });
  }

  const inviteButton = (className?: string) => (
    <Button
      variant="outline"
      className={cn(
        "min-h-11 bg-sky px-3.5 text-[17px] text-ink hover:bg-sky lg:min-h-12 lg:px-4 lg:text-lg",
        className,
      )}
      onClick={() => void share()}
    >
      <UserPlusIcon aria-hidden />
      {t("lobby.invite")}
    </Button>
  );

  return (
    <main className="flex flex-1 flex-col gap-3 lg:gap-4">
      <header className="flex items-center gap-2.5 lg:gap-4">
        <Button
          variant="chalk"
          size="icon-chalk"
          aria-label={t("lobby.leaveRoom")}
          data-sfx="back"
          className="lg:h-12 lg:w-auto lg:gap-2 lg:pr-4 lg:pl-3"
          onClick={() => void leaveParty()}
        >
          <ArrowLeftIcon aria-hidden />
          <span className="hidden lg:inline">{t("lobby.leave")}</span>
        </Button>
        <h1 className="flex-1 font-display text-[26px] leading-none font-extrabold text-chalk lg:sr-only">
          {t("lobby.title")}
        </h1>
        {inviteButton("lg:hidden")}
        <RoomCodePanel code={party.code} invite={inviteButton()} className="hidden lg:flex" />
      </header>
      <RoomCodePanel code={party.code} className="lg:hidden" />

      {/* Điện thoại: một cột theo thứ tự khai báo. Máy tính: 3 cột, thẻ thiết lập chiếm cột phải. */}
      <div className="flex flex-1 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_21.25rem] lg:grid-rows-[auto_auto_1fr] lg:gap-x-5 lg:gap-y-3.5 lg:[grid-template-areas:'meter_meter_setup'_'grid_grid_setup'_'chars_ready_setup']">
        <ReadyMeter players={players.length} ready={readyCount} className="lg:[grid-area:meter]" />

        <section
          aria-label={t("lobby.playersLabel")}
          className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:auto-rows-[9.25rem] lg:gap-x-4 lg:gap-y-4.5 lg:pt-1 lg:[grid-area:grid]"
        >
          {players.map((p) => (
            <PlayerSlot key={p.id} player={p} isMe={p.id === sessionId} />
          ))}
          {Array.from({ length: Math.max(0, MAX_PLAYERS - players.length) }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: ô trống không có danh tính riêng
            <EmptySlot key={`empty-${i}`} onInvite={() => void share()} />
          ))}
        </section>

        <div className="lg:[grid-area:setup]">
          {isHost ? (
            <MatchSetupCard
              rounds={party.totalRounds}
              onRoundsChange={(totalRounds) => send(ClientMessage.SetRounds, { totalRounds })}
              minPlayers={MIN_PLAYERS_TO_START}
              players={players.length}
              ready={readyCount}
              onStart={() => startMatch.run(() => send(ClientMessage.StartMatch, {}))}
              pending={startMatch.pending}
              className="h-full"
            />
          ) : (
            <>
              <HostStatusCard
                hostName={hostName}
                rounds={party.totalRounds}
                className="lg:hidden"
              />
              <MatchSetupCard
                rounds={party.totalRounds}
                minPlayers={MIN_PLAYERS_TO_START}
                players={players.length}
                ready={readyCount}
                className="hidden h-full lg:flex"
              />
            </>
          )}
        </div>

        {me && (
          <CharacterPicker
            value={me.avatar}
            onChange={pickCharacter}
            className="lg:self-end lg:[grid-area:chars]"
          />
        )}

        {me && (
          <div className="mt-auto flex flex-col gap-2 lg:mt-0 lg:self-end lg:[grid-area:ready]">
            {me.ready && !isHost && (
              <p className="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-chalk-muted lg:hidden">
                <CheckIcon aria-hidden className="size-4 shrink-0" strokeWidth={3} />
                {t("lobby.readyWaitHost")}
              </p>
            )}
            <Button
              variant={me.ready ? "outline" : "default"}
              aria-pressed={me.ready}
              disabled={reconnecting}
              className="min-h-14.5 w-full rounded-[18px] border-4 text-2xl lg:min-h-19 lg:w-65 lg:rounded-[20px] lg:text-[28px]"
              onClick={() => send(ClientMessage.Ready, { ready: !me.ready })}
            >
              {me.ready ? t("lobby.unready") : t("lobby.ready")}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
