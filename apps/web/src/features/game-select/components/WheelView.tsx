import { ClientMessage, GAME_IDS, GAMES, isGameId, type PartyStateView } from "@brain-rizz/shared";
import { CheckIcon, CrownIcon, RotateCwIcon } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { AvatarStrip } from "@/components/common/AvatarStrip";
import { CATEGORY_BG, CategoryChip } from "@/components/common/MatchChips";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useGameTextLookup } from "@/hooks/use-game-text";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { usePendingAction } from "@/hooks/use-pending-action";
import { cn } from "@/lib/utils";
import { send } from "@/net/connection";
import { playedGameIds, wheelSlices } from "../catalog";
import { useWheelSpin, type WheelStatus } from "../hooks/use-wheel-spin";
import { finalRotation, LuckyWheel } from "./LuckyWheel";

interface WheelViewProps {
  party: PartyStateView;
  isHost: boolean;
}

/**
 * Chế độ vòng quay (khu 6): server chọn kết quả và giờ quay, mọi máy quay đồng bộ rồi dừng đúng
 * `wheelGameId`. Chủ phòng bấm "Quay!"; người khác thấy "Chờ chủ phòng quay…".
 */
export function WheelView({ party, isHost }: WheelViewProps) {
  const { t } = useTranslation();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const slices = wheelSlices(party);
  const { progress, status } = useWheelSpin(party.wheelSpinAt, party.wheelSpinMs);
  const rotation = finalRotation(slices, party.wheelGameId) * progress;
  const players = Object.values(party.players);
  const host = party.players[party.hostId];
  // Server nhận lệnh quay thì `wheelSpinAt` đổi → hết chờ.
  const spin = usePendingAction(`${party.round}:${party.wheelSpinAt}`);

  const wheel = <LuckyWheel slices={slices} rotation={rotation} className="w-full" />;
  const spinButton = isHost && (
    <Button
      size="lg"
      disabled={status !== "idle" || spin.pending}
      data-sfx="confirm"
      className="min-h-16 rounded-[22px] border-4 text-3xl lg:min-h-21 lg:text-4xl"
      onClick={() => spin.run(() => send(ClientMessage.SpinWheel, {}))}
    >
      <RotateCwIcon aria-hidden className="size-8" strokeWidth={3} />
      {t("gameSelect.spin")}
    </Button>
  );

  if (desktop) {
    return (
      <div className="flex min-h-0 flex-1 items-center gap-6">
        <WheelList party={party} landed={status === "landed" ? party.wheelGameId : ""} />
        <div className="w-[min(30rem,58vh)] shrink-0">{wheel}</div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <ResultCard party={party} status={status} isHost={isHost} />
          {spinButton}
          {!isHost && <HostStatus party={party} status={status} />}
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-chalk-muted">
              {t("gameSelect.watching")}
            </span>
            <AvatarStrip players={players} className="justify-start" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3.5">
      <div className="mx-auto w-full max-w-80">{wheel}</div>
      {isHost ? (
        status === "idle" ? (
          spinButton
        ) : (
          <ResultCard party={party} status={status} isHost compact />
        )
      ) : (
        <HostStatus party={party} status={status} />
      )}
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-chalk-muted">
          {t("gameSelect.inWheel")}
        </span>
        <WheelChips party={party} />
      </div>
      <div className="mt-auto flex items-end justify-between gap-3">
        <AvatarStrip players={players} className="justify-start gap-x-3" />
        {host && (
          <span className="shrink-0 text-right text-xs text-chalk-muted">
            {t("gameSelect.watching")}
          </span>
        )}
      </div>
    </div>
  );
}

/** Thẻ "Trong vòng quay" (máy tính): game còn trong vòng quay và game đã chơi bị gạch. */
function WheelList({ party, landed }: { party: PartyStateView; landed: string }) {
  const { t } = useTranslation();
  const text = useGameTextLookup();
  const played = playedGameIds(party);
  const slices = wheelSlices(party);

  return (
    <Card className="w-70 shrink-0 gap-2.5 rounded-[22px] border-4 px-4 pt-4 pb-4.5">
      <h2 className="font-display text-[22px] leading-none font-extrabold">
        {t("gameSelect.inWheel")}
      </h2>
      <ul className="flex flex-col gap-2">
        {GAME_IDS.map((id) => {
          const isPlayed = played.includes(id) && !slices.includes(id);
          const category = GAMES[id].category;
          return (
            <li
              key={id}
              className={cn(
                "flex h-11.5 items-center gap-2.5 rounded-[14px] border-[3px] px-2.5",
                isPlayed
                  ? "border-dashed border-muted-foreground/70 bg-muted text-muted-foreground"
                  : "border-sticker",
                id === landed ? "bg-primary text-primary-foreground" : !isPlayed && "bg-card",
              )}
            >
              <span
                className={cn(
                  "size-5.5 shrink-0 rounded-[7px] border-[3px]",
                  isPlayed
                    ? "border-dashed border-muted-foreground/70"
                    : cn("border-sticker", CATEGORY_BG[category]),
                )}
              />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span
                  className={cn(
                    "truncate font-display text-[17px] font-extrabold",
                    isPlayed && "line-through",
                  )}
                >
                  {text(id).title}
                </span>
                <span className="text-xs opacity-80">{t(`category.${category}`)}</span>
              </span>
              {isPlayed && (
                <span className="inline-flex h-5.5 shrink-0 items-center gap-1 rounded-full bg-secondary px-2 text-[11px] font-bold text-secondary-foreground">
                  <CheckIcon aria-hidden className="size-3" strokeWidth={3} />
                  {t("gameSelect.played")}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[13px] leading-snug text-muted-foreground">{t("gameSelect.wheelNote")}</p>
    </Card>
  );
}

/** Dải nhãn "Trong vòng quay" (điện thoại). */
function WheelChips({ party }: { party: PartyStateView }) {
  const { t } = useTranslation();
  const text = useGameTextLookup();
  const played = playedGameIds(party);
  const slices = wheelSlices(party);

  return (
    <ul className="flex flex-wrap gap-1.5">
      {GAME_IDS.map((id) => {
        const isPlayed = played.includes(id) && !slices.includes(id);
        return (
          <li
            key={id}
            className={cn(
              "inline-flex h-7.5 items-center gap-1.5 rounded-full border-2 px-2.5 text-[12.5px] font-semibold",
              isPlayed
                ? "border-dashed border-chalk/50 text-chalk-muted"
                : "border-chalk/60 text-chalk",
            )}
          >
            {isPlayed ? (
              <>
                <span className="line-through">{text(id).title}</span>· {t("gameSelect.played")}
              </>
            ) : (
              <>
                <span
                  className={cn(
                    "size-3 rounded-sm border-2 border-sticker",
                    CATEGORY_BG[GAMES[id].category],
                  )}
                />
                {text(id).title}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Thẻ "Kết quả": chưa quay / đang quay / game trúng. */
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
      className={cn("gap-2 rounded-[22px] border-4 px-4.5 py-4", !compact && "min-h-49")}
    >
      <span className="text-xs font-bold tracking-[2px] text-muted-foreground uppercase">
        {t("gameSelect.result")}
      </span>
      {landed ? (
        <>
          <span className="font-display text-[34px] leading-none font-extrabold">
            {text(landed).title}
          </span>
          <CategoryChip category={GAMES[landed].category} className="self-start" />
          <p className="text-[13.5px] text-muted-foreground">{t("gameSelect.landedHint")}</p>
        </>
      ) : status === "spinning" ? (
        <>
          <span className="font-display text-3xl leading-none font-extrabold">
            {t("gameSelect.spinning")}
          </span>
          <p className="text-sm text-muted-foreground">{t("gameSelect.spinningHint")}</p>
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

/** Người chơi thường: chủ phòng đang cầm vòng quay / đang quay / kết quả. */
function HostStatus({ party, status }: { party: PartyStateView; status: WheelStatus }) {
  const { t } = useTranslation();
  const text = useGameTextLookup();
  const host = party.players[party.hostId];
  const landed = status === "landed" && isGameId(party.wheelGameId) ? party.wheelGameId : null;

  return (
    <div
      role="status"
      className="flex min-h-18.5 items-center gap-3 rounded-[18px] border-[3.5px] border-sticker bg-card px-3.5 py-2 text-card-foreground shadow-sticker-sm"
    >
      {host && (
        <span className="relative flex">
          <PlayerAvatar avatar={host.avatar} colorIndex={host.colorIndex} size="md" />
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
