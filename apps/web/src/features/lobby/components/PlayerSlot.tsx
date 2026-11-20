import type { PlayerView } from "@brain-rizz/shared";
import { CheckIcon, CrownIcon, PlusIcon, WifiOffIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { ReactionBubble } from "@/features/chat";
import { cn } from "@/lib/utils";

/**
 * Lớp của ô người chơi theo bố cục (ui-ux 6.8). Thường: điện thoại ô ngang 60 px, máy tính thẻ
 * đứng 194×148 (lưới 4 × 2). Gọn (phòng 12 ghế): điện thoại 52 px, máy tính thẻ cao 136 px (4 cột × 3 hàng).
 */
export const SLOT_FRAME = {
  classic:
    "h-15 gap-2 rounded-2xl border-[3px] px-2 shadow-sticker-sm lg:h-auto lg:flex-col lg:justify-center lg:gap-1.5 lg:rounded-[20px] lg:border-4 lg:px-2.5 lg:pt-2 lg:pb-2.5 lg:shadow-sticker",
  compact:
    "h-13 gap-2 rounded-[15px] border-[3px] pr-2 pl-1.75 shadow-sticker-sm lg:h-auto lg:flex-col lg:justify-center lg:gap-1 lg:rounded-[18px] lg:border-4 lg:px-1.5 lg:pt-1.5 lg:pb-2",
} as const;

/** Ô trống (mời bạn / thêm bot) cùng cỡ với ô người chơi. */
export const EMPTY_FRAME = {
  classic: "h-15 gap-2 rounded-2xl px-2.5 lg:gap-1.5 lg:rounded-[20px]",
  compact: "h-13 gap-2 rounded-[15px] px-2 lg:gap-1 lg:rounded-[18px] lg:px-1.5",
} as const;

/**
 * Ô người chơi ở phòng chờ: nhân vật, tên, vương miện chủ phòng, "(bạn)", trạng thái.
 * Điện thoại: ô ngang thấp (lưới 2 cột); máy tính: thẻ đứng (lưới 4 cột × 3 hàng).
 */
export function PlayerSlot({
  player,
  isMe,
  compact = false,
}: {
  player: PlayerView;
  isMe: boolean;
  /** Phòng 12 ghế: ô gọn (avatar 36 / 52, tên 16 / 17 px, nhãn 20 / 22 px). */
  compact?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "relative flex min-w-0 items-center border-sticker text-card-foreground",
        compact ? SLOT_FRAME.compact : SLOT_FRAME.classic,
        compact && isMe ? "bg-primary/30 lg:bg-card" : "bg-card",
        !player.connected && "opacity-60",
      )}
    >
      {player.isHost && (
        <span
          role="img"
          aria-label={t("lobby.host")}
          className={cn(
            "absolute z-10 grid -rotate-14 place-items-center rounded-full border-sticker bg-primary text-primary-foreground",
            compact
              ? "-top-2.25 -left-1.75 size-5.5 border-[2.5px] lg:-top-3.25 lg:-left-2.75 lg:size-8.5 lg:border-[3px]"
              : "-top-2.5 -left-2 size-6 border-[3px] lg:-top-3.5 lg:-left-3 lg:size-10",
          )}
        >
          <CrownIcon
            aria-hidden
            className={compact ? "size-2.75 lg:size-4.25" : "size-3 lg:size-5"}
            strokeWidth={2.8}
          />
        </span>
      )}
      {/* Bọc avatar để bong bóng biểu cảm (CR-011) đứng ngay trên avatar, tràn ra ngoài ô. */}
      <span className="relative flex shrink-0">
        {compact ? (
          <PlayerAvatar
            avatar={player.avatar}
            accessories={player.accessories}
            colorIndex={player.colorIndex}
            size="md"
            className="size-9 lg:size-13"
          />
        ) : (
          <>
            <PlayerAvatar
              avatar={player.avatar}
              accessories={player.accessories}
              colorIndex={player.colorIndex}
              size="md"
              className="lg:hidden"
            />
            <PlayerAvatar
              avatar={player.avatar}
              accessories={player.accessories}
              colorIndex={player.colorIndex}
              size="lg"
              className="hidden lg:inline-block"
            />
          </>
        )}
        <ReactionBubble playerId={player.id} />
      </span>
      <span
        className={cn(
          "flex min-w-0 flex-col items-start lg:items-center",
          compact ? "gap-0.75 lg:max-w-full lg:gap-1" : "gap-0.75 lg:gap-1.5",
        )}
      >
        <span className="flex max-w-full items-baseline gap-1 leading-none lg:gap-1.5">
          <span
            className={cn(
              "truncate font-display font-extrabold",
              compact ? "text-base lg:text-[17px]" : "text-lg lg:text-[22px]",
            )}
          >
            {player.name}
          </span>
          {isMe && (
            <span
              className={cn(
                "shrink-0 font-semibold text-muted-foreground",
                compact ? "text-[11px] lg:text-[11.5px]" : "text-xs lg:text-[13px]",
              )}
            >
              {t("lobby.you")}
            </span>
          )}
        </span>
        <PlayerStatus player={player} compact={compact} />
      </span>
    </div>
  );
}

function PlayerStatus({ player, compact }: { player: PlayerView; compact: boolean }) {
  const { t } = useTranslation();
  const pill = cn(
    "inline-flex items-center gap-1 rounded-full whitespace-nowrap",
    compact
      ? "h-5 border-2 px-1.75 text-[10.5px] lg:h-5.5 lg:border-[2.5px] lg:px-2 lg:text-[11.5px]"
      : "h-6 border-[2.5px] px-2.5 text-[11px] lg:h-6.5 lg:text-[13px]",
  );
  const icon = compact ? "size-2.75 lg:size-3" : "size-3 lg:size-3.5";

  if (!player.connected) {
    return (
      <span className={cn(pill, "border-sticker bg-muted font-semibold text-muted-foreground")}>
        <WifiOffIcon aria-hidden className={icon} strokeWidth={2.6} />
        {t("lobby.status.offline")}
      </span>
    );
  }
  if (player.ready) {
    return (
      <span className={cn(pill, "border-sticker bg-compute font-bold text-ink")}>
        {t("lobby.status.ready")}
        <CheckIcon aria-hidden className={icon} strokeWidth={3.2} />
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
export function EmptySlot({ onInvite, compact = false }: { onInvite(): void; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onInvite}
      className={cn(
        "flex min-w-0 cursor-pointer items-center border-[3px] border-dashed border-chalk/60 bg-board-shade text-left text-chalk transition-colors outline-none hover:border-chalk focus-visible:ring-3 focus-visible:ring-primary",
        "lg:h-auto lg:flex-col lg:justify-center lg:text-center",
        compact ? EMPTY_FRAME.compact : EMPTY_FRAME.classic,
      )}
    >
      <EmptyIcon compact={compact}>
        <PlusIcon aria-hidden className="size-4 lg:size-5" strokeWidth={3} />
      </EmptyIcon>
      <EmptyText compact={compact} action={t("lobby.invite")} />
    </button>
  );
}

/** Vòng nét đứt chứa icon của ô trống. */
export function EmptyIcon({ compact, children }: { compact: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full border-[2.5px] border-dashed border-chalk/70 lg:border-[3px]",
        compact ? "size-8 lg:size-10" : "size-9 lg:size-11.5",
      )}
    >
      {children}
    </span>
  );
}

/** Hai dòng chữ của ô trống: "Chỗ trống" + việc làm được (mời bạn / thêm bot). */
export function EmptyText({ compact, action }: { compact: boolean; action: string }) {
  const { t } = useTranslation();
  return (
    <span className="flex min-w-0 flex-col leading-tight lg:items-center lg:gap-1">
      <span
        className={cn(
          "font-display font-extrabold lg:leading-none",
          compact ? "text-[15px] lg:text-base" : "text-base lg:text-[19px]",
        )}
      >
        {t("lobby.emptySlot")}
      </span>
      <span
        className={cn(
          "font-semibold text-chalk-muted underline underline-offset-2 lg:underline-offset-3",
          compact ? "text-[11.5px] lg:text-xs" : "text-xs lg:text-[13px]",
        )}
      >
        {action}
      </span>
    </span>
  );
}
