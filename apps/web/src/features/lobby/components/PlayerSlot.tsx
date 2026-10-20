import type { PlayerView } from "@brain-rizz/shared";
import { CheckIcon, CrownIcon, PlusIcon, WifiOffIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { ReactionBubble } from "@/features/chat";
import { cn } from "@/lib/utils";

/**
 * Ô người chơi ở phòng chờ: nhân vật, tên, vương miện chủ phòng, "(bạn)", trạng thái.
 * Điện thoại: ô ngang thấp (lưới 2 cột); máy tính: thẻ đứng (lưới 4×2).
 */
export function PlayerSlot({ player, isMe }: { player: PlayerView; isMe: boolean }) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "relative flex h-15 min-w-0 items-center gap-2 rounded-2xl border-[3px] border-sticker bg-card px-2 text-card-foreground shadow-sticker-sm",
        "lg:h-auto lg:flex-col lg:justify-center lg:gap-1.5 lg:rounded-[20px] lg:border-4 lg:px-2.5 lg:pt-2 lg:pb-2.5 lg:shadow-sticker",
        !player.connected && "opacity-60",
      )}
    >
      {player.isHost && (
        <span
          role="img"
          aria-label={t("lobby.host")}
          className="absolute -top-2.5 -left-2 z-10 grid size-6 -rotate-14 place-items-center rounded-full border-[3px] border-sticker bg-primary text-primary-foreground lg:-top-3.5 lg:-left-3 lg:size-10"
        >
          <CrownIcon aria-hidden className="size-3 lg:size-5" strokeWidth={2.8} />
        </span>
      )}
      {/* Bọc avatar để bong bóng biểu cảm (CR-011) đứng ngay trên avatar, tràn ra ngoài ô. */}
      <span className="relative flex shrink-0">
        <PlayerAvatar
          avatar={player.avatar}
          colorIndex={player.colorIndex}
          size="md"
          className="lg:hidden"
        />
        <PlayerAvatar
          avatar={player.avatar}
          colorIndex={player.colorIndex}
          size="lg"
          className="hidden lg:inline-block"
        />
        <ReactionBubble playerId={player.id} />
      </span>
      <span className="flex min-w-0 flex-col items-start gap-0.75 lg:items-center lg:gap-1.5">
        <span className="flex max-w-full items-baseline gap-1 leading-none lg:gap-1.5">
          <span className="truncate font-display text-lg font-extrabold lg:text-[22px]">
            {player.name}
          </span>
          {isMe && (
            <span className="shrink-0 text-xs font-semibold text-muted-foreground lg:text-[13px]">
              {t("lobby.you")}
            </span>
          )}
        </span>
        <PlayerStatus player={player} />
      </span>
    </div>
  );
}

function PlayerStatus({ player }: { player: PlayerView }) {
  const { t } = useTranslation();
  const pill =
    "inline-flex h-6 items-center gap-1 rounded-full border-[2.5px] px-2.5 text-[11px] whitespace-nowrap lg:h-6.5 lg:text-[13px]";

  if (!player.connected) {
    return (
      <span className={cn(pill, "border-sticker bg-muted font-semibold text-muted-foreground")}>
        <WifiOffIcon aria-hidden className="size-3 lg:size-3.5" strokeWidth={2.6} />
        {t("lobby.status.offline")}
      </span>
    );
  }
  if (player.ready) {
    return (
      <span className={cn(pill, "border-sticker bg-compute font-bold text-ink")}>
        {t("lobby.status.ready")}
        <CheckIcon aria-hidden className="size-3 lg:size-3.5" strokeWidth={3.2} />
      </span>
    );
  }
  return (
    <span
      className={cn(
        pill,
        "border-dashed border-muted-foreground/70 font-semibold text-muted-foreground",
      )}
    >
      {t("lobby.status.waiting")}
    </span>
  );
}

/** Ô trống: chạm để mời bạn (mở bảng chia sẻ / chép link mời). */
export function EmptySlot({ onInvite }: { onInvite(): void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onInvite}
      className={cn(
        "flex h-15 min-w-0 cursor-pointer items-center gap-2 rounded-2xl border-[3px] border-dashed border-chalk/60 bg-board-shade px-2.5 text-left text-chalk transition-colors outline-none hover:border-chalk focus-visible:ring-3 focus-visible:ring-primary",
        "lg:h-auto lg:flex-col lg:justify-center lg:gap-1.5 lg:rounded-[20px] lg:text-center",
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full border-[2.5px] border-dashed border-chalk/70 lg:size-11.5 lg:border-[3px]">
        <PlusIcon aria-hidden className="size-4 lg:size-5" strokeWidth={3} />
      </span>
      <span className="flex min-w-0 flex-col leading-tight lg:items-center lg:gap-1">
        <span className="font-display text-base font-extrabold lg:text-[19px] lg:leading-none">
          {t("lobby.emptySlot")}
        </span>
        <span className="text-xs font-semibold text-chalk-muted underline underline-offset-2 lg:text-[13px] lg:underline-offset-3">
          {t("lobby.invite")}
        </span>
      </span>
    </button>
  );
}
