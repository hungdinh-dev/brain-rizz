import {
  type BotLevel,
  type CharacterId,
  ClientMessage,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
} from "@brain-rizz/shared";
import { ArrowLeftIcon, CheckIcon, InfoIcon, UserPlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChatSettingRow } from "@/features/chat";
import { loadProfile, saveProfile } from "@/features/home";
import { usePendingAction } from "@/hooks/use-pending-action";
import { CLASSIC_SEATS, lobbySlotCount } from "@/lib/room-size";
import { cn } from "@/lib/utils";
import { leaveParty, SERVER_ERROR_TOAST_ID, send } from "@/net/connection";
import { useAuth } from "@/stores/auth.store";
import { useGame, useMe } from "@/stores/game.store";
import { AddBotSlot, BotSlot } from "./components/BotSlot";
import { CharacterPicker } from "./components/CharacterPicker";
import { HostStatusCard, MatchSetupCard } from "./components/MatchSetupCard";
import { EmptySlot, PlayerSlot } from "./components/PlayerSlot";
import { ReadyMeter } from "./components/ReadyMeter";
import { RoomCodePanel } from "./components/RoomCodePanel";

/** Server chưa thêm bot sau ngần này ms (tin mất lúc rớt mạng) thì mở khoá ô chọn mức. */
const ADD_BOT_TIMEOUT_MS = 5_000;

/**
 * Phòng chờ 2D (khu 5): mã phòng, 8 ô người chơi, đổi nhân vật, sẵn sàng; chủ phòng thiết lập trận.
 * Điện thoại một cột; máy tính chia lưới: người chơi bên trái, thẻ thiết lập bên phải.
 * Bot (CR-016): chủ phòng thêm bot ở ô trống, đổi mức / bỏ bot ngay trong ô bot.
 */
export function LobbyScreen() {
  const { t } = useTranslation();
  const party = useGame((s) => s.party)!;
  const sessionId = useGame((s) => s.sessionId);
  const reconnecting = useGame((s) => s.connection === "reconnecting");
  const me = useMe();

  // Chủ phòng đứng đầu, còn lại giữ thứ tự vào phòng (bot cũng vậy, đổi mức không đổi ghế).
  const players = Object.values(party.players).sort((a, b) => Number(b.isHost) - Number(a.isHost));
  // Bot luôn sẵn sàng và được tính vào "Người chơi" / "Sẵn sàng" (CR-016).
  const readyCount = players.filter((p) => p.ready).length;
  const botCount = players.filter((p) => p.isBot).length;
  // Tới 7 người: 8 ô như cũ. Từ 8 người: đủ 12 ô, bố cục gọn (CR-018, ui-ux 6.8).
  const slotCount = lobbySlotCount(players.length);
  const compact = slotCount > CLASSIC_SEATS;
  const emptyCount = Math.max(0, slotCount - players.length);
  const isHost = party.hostId === sessionId;
  const hostName = party.players[party.hostId]?.name ?? "";
  const inviteUrl = `${location.origin}/r/${party.code}`;
  // Bấm đúp "Bắt đầu" không gửi hai lần (lần hai server báo sai pha).
  const startMatch = usePendingAction(party.phase);

  // Ô đang mở bảng chọn mức (mỗi lúc một ô): `add:<i>` = ô trống thứ i, còn lại = id bot.
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const errorSeq = useGame((s) => s.errorSeq);
  // Đang chờ server thêm bot: xong khi số bot đổi, hỏng khi server báo lỗi, quá 5 giây thì mở khoá.
  const [adding, setAdding] = useState<{ level: BotLevel; bots: number; errorSeq: number } | null>(
    null,
  );

  useEffect(() => {
    if (!adding) return;
    if (botCount !== adding.bots) {
      setAdding(null);
      setOpenSlot(null);
      return;
    }
    if (errorSeq !== adding.errorSeq) {
      setAdding(null);
      setOpenSlot(null);
      // Thay câu lỗi chung ("Dữ liệu không hợp lệ") bằng câu rõ hơn: thường là vừa có người vào.
      toast.error(t("bots.addFailed"), { id: SERVER_ERROR_TOAST_ID });
      return;
    }
    const id = setTimeout(() => setAdding(null), ADD_BOT_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [adding, botCount, errorSeq, t]);

  // Ô trống vừa có người vào thì bảng thêm bot trong ô đó đóng theo.
  useEffect(() => {
    if (!openSlot?.startsWith("add:")) return;
    if (Number(openSlot.slice(4)) >= emptyCount || !isHost) setOpenSlot(null);
  }, [openSlot, emptyCount, isHost]);

  function addBot(level: BotLevel) {
    if (adding) return;
    setAdding({ level, bots: botCount, errorSeq });
    send(ClientMessage.AddBot, { level });
  }

  const slotOpenChange = (key: string) => (open: boolean) =>
    setOpenSlot((cur) => (open ? key : cur === key ? null : cur));

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
    // Nhớ cho lần sau vào phòng (hồ sơ lưu ở máy) và đồng bộ lên tài khoản nếu có phiên.
    const next = { ...loadProfile(), avatar };
    saveProfile(next);
    void useAuth.getState().syncProfile(next);
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
    // Phòng 12 ghế trên điện thoại: khe giữa các khối 8 px (như khe lưới ghế) để nút Sẵn sàng
    // vẫn nằm trong màn đầu ở 390×844 (ui-ux 6.8).
    <main className={cn("@container flex flex-1 flex-col lg:gap-4", compact ? "gap-2" : "gap-3")}>
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
      <RoomCodePanel code={party.code} className={cn("lg:hidden", compact && "h-15")} />

      {/*
        Điện thoại: một cột theo thứ tự khai báo. Máy tính: 3 cột, thẻ thiết lập chiếm cột phải.
        Màn hẹp (cột chat CR-011 chiếm 340 px) thì chọn nhân vật và nút Sẵn sàng xếp chồng
        thay vì nằm cạnh nhau, theo bề rộng thật của màn (container query).
      */}
      <div
        className={cn(
          "flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_auto_21.25rem] lg:grid-rows-[auto_auto_1fr_auto] lg:gap-x-5 lg:gap-y-3.5 lg:[grid-template-areas:'meter_meter_setup'_'grid_grid_setup'_'chars_chars_setup'_'ready_ready_setup'] @min-[66rem]:lg:grid-rows-[auto_auto_1fr] @min-[66rem]:lg:[grid-template-areas:'meter_meter_setup'_'grid_grid_setup'_'chars_ready_setup']",
          compact ? "gap-2" : "gap-3",
        )}
      >
        <ReadyMeter
          players={players.length}
          ready={readyCount}
          bots={botCount}
          className="lg:[grid-area:meter]"
        />

        <div className="flex flex-col gap-2.5 lg:gap-3 lg:[grid-area:grid]">
          {/*
            Điện thoại: ô đang mở bảng chọn mức cao hơn, ô bên cạnh giữ chiều cao (items-start).
            Phòng 12 ô trên máy tính: tối đa 6 cột (ô ≥ 7rem); vùng lưới hẹp (có cột chat) tự
            xuống 4 cột × 3 hàng. Ô mở bảng chọn mức thì hàng đó cao thêm.
          */}
          <section
            aria-label={t("lobby.playersLabel")}
            className={cn(
              "grid grid-cols-2 items-start lg:items-stretch",
              compact
                ? "gap-2 pt-1 lg:auto-rows-[minmax(7rem,auto)] lg:grid-cols-[repeat(auto-fill,minmax(max(7rem,calc((100%_-_3.75rem)/6)),1fr))] lg:gap-x-3 lg:gap-y-4 lg:pt-1.5"
                : "gap-2.5 lg:auto-rows-[9.25rem] lg:grid-cols-4 lg:gap-x-4 lg:gap-y-4.5 lg:pt-1",
            )}
          >
            {players.map((p) =>
              p.isBot ? (
                <BotSlot
                  key={p.id}
                  player={p}
                  canEdit={isHost}
                  open={openSlot === p.id}
                  onOpenChange={slotOpenChange(p.id)}
                  compact={compact}
                />
              ) : (
                <PlayerSlot key={p.id} player={p} isMe={p.id === sessionId} compact={compact} />
              ),
            )}
            {Array.from({ length: emptyCount }, (_, i) =>
              isHost ? (
                <AddBotSlot
                  // biome-ignore lint/suspicious/noArrayIndexKey: ô trống không có danh tính riêng
                  key={`empty-${i}`}
                  open={openSlot === `add:${i}`}
                  onOpenChange={slotOpenChange(`add:${i}`)}
                  onAdd={addBot}
                  pending={adding && openSlot === `add:${i}` ? adding.level : null}
                  compact={compact}
                />
              ) : (
                <EmptySlot
                  // biome-ignore lint/suspicious/noArrayIndexKey: ô trống không có danh tính riêng
                  key={`empty-${i}`}
                  onInvite={() => void share()}
                  compact={compact}
                />
              ),
            )}
          </section>
          {emptyCount === 0 && botCount > 0 && (
            <p
              role="note"
              className={cn(
                "flex items-start gap-2 text-[13px] leading-snug font-semibold text-chalk-muted lg:text-sm",
                // Điện thoại, người thường: nhường chỗ cho nút Sẵn sàng (chỉ chủ phòng thêm/bỏ bot).
                compact && !isHost && "max-lg:hidden",
              )}
            >
              <InfoIcon aria-hidden className="mt-px size-4 shrink-0 text-chalk" />
              {t("bots.full", { max: MAX_PLAYERS })}
            </p>
          )}
        </div>

        <div className="lg:[grid-area:setup]">
          {isHost ? (
            <MatchSetupCard
              rounds={party.totalRounds}
              onRoundsChange={(totalRounds) => send(ClientMessage.SetRounds, { totalRounds })}
              minPlayers={MIN_PLAYERS_TO_START}
              players={players.length}
              ready={readyCount}
              bots={botCount}
              onStart={() => startMatch.run(() => send(ClientMessage.StartMatch, {}))}
              pending={startMatch.pending}
              chatSetting={<ChatSettingRow />}
              className="h-full"
            />
          ) : (
            <>
              <HostStatusCard
                hostName={hostName}
                rounds={party.totalRounds}
                compact={compact}
                className="lg:hidden"
              />
              <MatchSetupCard
                rounds={party.totalRounds}
                minPlayers={MIN_PLAYERS_TO_START}
                players={players.length}
                ready={readyCount}
                bots={botCount}
                className="hidden h-full lg:flex"
              />
            </>
          )}
        </div>

        {me && (
          <CharacterPicker
            value={me.avatar}
            onChange={pickCharacter}
            compact={compact}
            className="lg:self-end lg:[grid-area:chars]"
          />
        )}

        {me && (
          <div className="mt-auto flex flex-col gap-2 lg:mt-0 lg:self-end lg:justify-self-end lg:[grid-area:ready]">
            {me.ready && !isHost && (
              // Phòng 12 ghế: dòng này xuống dưới nút để bấm Sẵn sàng không đẩy nút ra khỏi màn.
              <p
                className={cn(
                  "flex items-center justify-center gap-1.5 text-[13px] font-semibold text-chalk-muted lg:hidden",
                  compact && "order-last",
                )}
              >
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
