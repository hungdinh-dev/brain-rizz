import {
  ClientMessage,
  GAMES,
  type GameId,
  isGameId,
  type PartyStateView,
} from "@brain-rizz/shared";
import { CrownIcon, InfoIcon, RotateCwIcon } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { AvatarStrip } from "@/components/common/AvatarStrip";
import { CategoryChip } from "@/components/common/MatchChips";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useGameTextLookup } from "@/hooks/use-game-text";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { usePendingAction } from "@/hooks/use-pending-action";
import { isCrowded } from "@/lib/room-size";
import { cn } from "@/lib/utils";
import { send } from "@/net/connection";
import { playedNote, wheelSlices } from "../catalog";
import { useWheelStatus, type WheelStatus } from "../hooks/use-wheel-spin";
import { Drum } from "./Drum";

interface WheelViewProps {
  party: PartyStateView;
  isHost: boolean;
}

/**
 * Chế độ vòng quay (khu 24, CR-017): trống quay dọc cuộn vô hạn; server chọn kết quả và giờ quay,
 * mọi máy cùng quay rồi dừng đúng `wheelGameId`. Chủ phòng bấm "Quay!"; người khác thấy chủ phòng
 * đang cầm trống. Màn chỉ vẽ lại khi trạng thái đổi (chờ → đang quay → trúng); trống tự vẽ mỗi khung.
 */
export function WheelView({ party, isHost }: WheelViewProps) {
  const { t } = useTranslation();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const slices = wheelSlices(party);
  const target = Math.max(0, slices.indexOf(party.wheelGameId as GameId));
  const status = useWheelStatus(party.wheelSpinAt, party.wheelSpinMs);
  const players = Object.values(party.players);
  // Server nhận lệnh quay thì `wheelSpinAt` đổi → hết chờ.
  const spin = usePendingAction(`${party.round}:${party.wheelSpinAt}`);

  const drum = (
    <Drum
      slices={slices}
      target={target}
      spinAt={party.wheelSpinAt}
      spinMs={party.wheelSpinMs}
      compact={!desktop}
    />
  );
  const spinButton = isHost && (
    <Button
      size="lg"
      disabled={status !== "idle" || spin.pending}
      data-sfx="confirm"
      className="min-h-16 rounded-[20px] border-4 text-3xl lg:min-h-21 lg:rounded-[22px] lg:text-4xl"
      onClick={() => spin.run(() => send(ClientMessage.SpinWheel, {}))}
    >
      <RotateCwIcon aria-hidden className="size-7 lg:size-8" strokeWidth={3} />
      {t("gameSelect.spin")}
    </Button>
  );

  if (desktop) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center gap-10">
        <div className="flex max-w-155 min-w-0 flex-1 flex-col items-center gap-3.5">
          {drum}
          <DrumNote party={party} slices={slices} />
        </div>
        <div className="flex w-101 shrink-0 flex-col gap-4">
          <ResultCard party={party} status={status} isHost={isHost} />
          {spinButton}
          {!isHost && <HostStatus party={party} status={status} />}
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-chalk-muted">
              {t("gameSelect.watching", { count: players.length })}
            </span>
            <AvatarStrip players={players} className="justify-start" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      {drum}
      <DrumNote party={party} slices={slices} short className="-mt-0.5 justify-center" />
      {isHost ? (
        status === "idle" ? (
          spinButton
        ) : (
          <ResultCard party={party} status={status} isHost compact />
        )
      ) : (
        <HostStatus party={party} status={status} />
      )}
      <div className="mt-auto flex items-center justify-between gap-2.5">
        <AvatarStrip
          players={players}
          className={cn("justify-start", !isCrowded(players.length) && "gap-x-3")}
        />
        {/* Dải avatar không co được (12 người: 272 px) nên chữ co lại, xuống dòng theo từ. */}
        <span className="max-w-20 min-w-0 text-right text-xs leading-snug text-chalk-muted">
          {t("gameSelect.watchingShort", { count: players.length })}
        </span>
      </div>
    </div>
  );
}

/**
 * Dòng phấn dưới trống (thay thẻ "Trong vòng quay"): số trò trên trống và game đã chơi (tối đa 2
 * tên, còn lại "+n"). Chưa chơi game nào thì chỉ còn vế đầu.
 */
function DrumNote({
  party,
  slices,
  short,
  className,
}: {
  party: PartyStateView;
  slices: readonly GameId[];
  /** Điện thoại: câu ngắn, không icon. */
  short?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const text = useGameTextLookup();
  const { shown, more } = playedNote(party, slices);
  const count = slices.length;
  let line: string;
  if (shown.length === 0) {
    line = short ? t("gameSelect.drumCountShort", { count }) : t("gameSelect.drumCount", { count });
  } else {
    const list = shown.map((id) => text(id).title).join(", ");
    const played = more > 0 ? t("gameSelect.playedMore", { list, n: more }) : list;
    line = short
      ? t("gameSelect.drumNoteShort", { count, played })
      : t("gameSelect.drumNote", { count, played });
  }

  return (
    <p
      className={cn(
        "flex items-center gap-2 text-center font-semibold text-chalk-muted",
        short ? "text-[12.5px]" : "text-[13.5px]",
        className,
      )}
    >
      {!short && <InfoIcon aria-hidden className="size-4 shrink-0" strokeWidth={2.4} />}
      {line}
    </p>
  );
}

/** Thẻ "Kết quả": chưa quay / đang quay / game trúng. Đọc kết quả qua `aria-live`, không đọc từng dòng. */
function ResultCard({
  party,
  status,
  isHost,
  compact,
}: {
  party: PartyStateView;
  status: WheelStatus;
  isHost: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const text = useGameTextLookup();
  const landed = status === "landed" && isGameId(party.wheelGameId) ? party.wheelGameId : null;

  return (
    <Card
      aria-live="polite"
      className={cn(
        "gap-2 border-4",
        compact ? "gap-1.5 rounded-[20px] px-4 py-3" : "min-h-47 rounded-[22px] px-4.5 py-4",
      )}
    >
      <span
        className={cn(
          "font-bold tracking-[2px] text-muted-foreground uppercase",
          compact ? "text-[11.5px]" : "text-xs",
        )}
      >
        {t("gameSelect.result")}
      </span>
      {landed ? (
        <span
          className={cn(
            "flex flex-col gap-2",
            compact && "gap-1.5",
            "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1.5 motion-safe:duration-300",
          )}
        >
          <span
            className={cn("flex gap-2", compact ? "flex-row items-center" : "flex-col items-start")}
          >
            <span
              className={cn(
                "font-display leading-none font-extrabold",
                compact ? "text-[28px]" : "text-[34px]",
              )}
            >
              {text(landed).title}
            </span>
            <CategoryChip
              category={GAMES[landed].category}
              className={compact ? "h-6 text-xs" : undefined}
            />
          </span>
          <span className={cn("text-muted-foreground", compact ? "text-[13px]" : "text-[13.5px]")}>
            {t("gameSelect.landedHint")}
          </span>
        </span>
      ) : status === "spinning" ? (
        <>
          <span
            className={cn(
              "font-display leading-none font-extrabold",
              compact ? "text-[26px]" : "text-3xl",
            )}
          >
            {t("gameSelect.spinning")}
          </span>
          <p className={cn("text-muted-foreground", compact ? "text-[13px]" : "text-sm")}>
            {t("gameSelect.spinningHint")}
          </p>
        </>
      ) : (
        <>
          <span className="font-display text-3xl leading-none font-extrabold">
            {t("gameSelect.notSpun")}
          </span>
          {isHost && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              <Trans
                i18nKey="gameSelect.notSpunHint"
                values={{ round: party.round }}
                components={{ b: <strong className="text-card-foreground" /> }}
              />
            </p>
          )}
        </>
      )}
    </Card>
  );
}

/** Người chơi thường: chủ phòng đang cầm trống quay / đang quay / kết quả. */
function HostStatus({ party, status }: { party: PartyStateView; status: WheelStatus }) {
  const { t } = useTranslation();
  const text = useGameTextLookup();
  const host = party.players[party.hostId];
  const landed = status === "landed" && isGameId(party.wheelGameId) ? party.wheelGameId : null;

  return (
    <div
      role="status"
      className="flex min-h-18.5 items-center gap-3 rounded-[18px] border-[3.5px] border-sticker bg-card px-3.5 py-2 text-card-foreground shadow-sticker-sm lg:min-h-19"
    >
      {host && (
        <span className="relative flex">
          <PlayerAvatar
            avatar={host.avatar}
            accessories={host.accessories}
            colorIndex={host.colorIndex}
            size="md"
          />
          <span
            role="img"
            aria-label={t("lobby.host")}
            className="absolute -top-2.5 -left-2 grid size-6 -rotate-14 place-items-center rounded-full border-[2.5px] border-sticker bg-primary text-primary-foreground"
          >
            <CrownIcon aria-hidden className="size-3" strokeWidth={2.8} />
          </span>
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-display text-xl leading-tight font-extrabold">
          {landed
            ? text(landed).title
            : status === "spinning"
              ? t("gameSelect.spinning")
              : t("gameSelect.waitSpin")}
        </span>
        <span className="text-[13px] text-muted-foreground">
          {landed
            ? t("gameSelect.landedHint")
            : t("gameSelect.holdingWheel", { name: host?.name ?? "" })}
        </span>
      </span>
    </div>
  );
}
