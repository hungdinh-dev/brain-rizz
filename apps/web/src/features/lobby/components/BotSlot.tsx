import { type BotLevel, ClientMessage, type PlayerView } from "@brain-rizz/shared";
import { BotIcon, XIcon } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { BotBadge, PlayerName, usePlayerName } from "@/components/characters";
import { BotLevelButtons, BotLevelChip, BotLevelPicker } from "@/components/common/BotLevel";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { ReactionBubble } from "@/features/chat";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { send } from "@/net/connection";
import { EMPTY_FRAME, EmptyIcon, EmptyText } from "./PlayerSlot";
import { useInlinePanel } from "./use-inline-panel";

/*
 * Ô bot và ô thêm bot ở phòng chờ (CR-016, ui-ux 6.6 "Phòng chờ · ô bot / ô trống"). Thêm, bỏ,
 * đổi mức chỉ chủ phòng làm, chỉ ở phòng chờ; server kiểm lại quyền và pha (bất biến 2).
 * Điện thoại (ô 60 px): cả ô bot là một nút mở bảng đổi mức + "Bỏ bot". Máy tính (ô 148 px): bấm
 * nhãn mức để đổi mức, nút × trên ô để bỏ bot.
 */

/** Ô mới mở / bot mới vào: nảy vào 220 ms; giảm chuyển động thì chỉ mờ dần. */
const POP_IN =
  "animate-in fade-in duration-200 motion-safe:zoom-in-90 motion-safe:duration-220 motion-safe:ease-[cubic-bezier(.34,1.56,.64,1)]";

const CARD_MOBILE =
  "relative flex h-15 min-w-0 items-center gap-2 rounded-2xl border-[3px] border-sticker bg-card px-2 text-card-foreground shadow-sticker-sm";
const CARD_DESKTOP =
  "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[20px] border-4 border-sticker bg-card px-2 pt-2 pb-1.5 text-card-foreground shadow-sticker";
/** Phòng 12 ghế (ui-ux 6.8): điện thoại ô 52 px, máy tính thẻ cao 136 px trong lưới 4 cột. */
const CARD_MOBILE_COMPACT =
  "relative flex h-13 min-w-0 items-center gap-2 rounded-[15px] border-[3px] border-sticker bg-card pr-2 pl-1.75 text-card-foreground shadow-sticker-sm";
const CARD_DESKTOP_COMPACT =
  "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] border-4 border-sticker bg-card px-1.5 pt-1.5 pb-1 text-card-foreground shadow-sticker-sm";
/** Nhãn mức trong ô gọn: cao 20 / 22 px, chữ 10,5 / 11,5 px. */
const CHIP_COMPACT = "h-5 gap-1 pl-1.75 text-[10.5px] lg:h-5.5 lg:text-[11.5px]";

interface PanelProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Phòng 12 ghế: ô gọn. */
  compact?: boolean;
}

/** Nút × 44 px (vòng 30–32 px). `corner`: lệch ra góc trên phải của ô (máy tính, nằm trong khe lưới). */
function CloseButton({
  label,
  onClick,
  corner = false,
}: {
  label: string;
  onClick(): void;
  corner?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "group/close grid size-11 shrink-0 cursor-pointer place-items-center rounded-full outline-none",
        corner && "absolute -top-4 -right-4 z-10",
      )}
    >
      <span
        className={cn(
          "grid place-items-center rounded-full border-[2.5px] border-sticker bg-card text-card-foreground group-focus-visible/close:ring-3 group-focus-visible/close:ring-primary",
          corner ? "size-8" : "size-7.5",
        )}
      >
        <XIcon aria-hidden className="size-4" strokeWidth={3} />
      </span>
    </button>
  );
}

interface BotSlotProps extends PanelProps {
  player: PlayerView;
  /** Chủ phòng: đổi mức và bỏ bot được. */
  canEdit: boolean;
}

/** Ô của một bot: nhân vật + huy hiệu máy, tên "Fen · máy", nhãn mức (thay nhãn trạng thái). */
export function BotSlot({ player, canEdit, open, onOpenChange, compact = false }: BotSlotProps) {
  const { t } = useTranslation();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const { full } = usePlayerName();
  const panel = useInlinePanel(open && canEdit, onOpenChange);
  const name = full(player);
  const levelName = t(`bots.level.${player.botLevel}`);
  const chip = compact ? CHIP_COMPACT : undefined;

  function pick(level: BotLevel) {
    if (level !== player.botLevel) {
      send(ClientMessage.SetBotLevel, { playerId: player.id, level });
    }
    panel.close();
  }

  function remove() {
    send(ClientMessage.RemoveBot, { playerId: player.id });
    onOpenChange(false);
  }

  // Ô gọn: avatar 52 / 36, huy hiệu máy sm / xs (ui-ux 6.8).
  const avatar = (
    <span className="relative flex shrink-0">
      <PlayerAvatar
        avatar={player.avatar}
        colorIndex={player.colorIndex}
        size={desktop && !compact ? "lg" : "md"}
        className={compact ? (desktop ? "size-13" : "size-9") : undefined}
      />
      <BotBadge size={compact ? (desktop ? "sm" : "xs") : desktop ? "md" : "sm"} />
      <ReactionBubble playerId={player.id} />
    </span>
  );

  if (open && canEdit) {
    const picker = (
      <BotLevelPicker
        value={player.botLevel}
        onChange={pick}
        size="slot"
        label={t("bots.levelLabel")}
        selectedRef={panel.focusRef}
        className={
          desktop
            ? cn(
                "flex-1 grid-cols-2 grid-rows-[repeat(2,2.75rem)] px-0.5",
                // Ô gọn hẹp (≈ 115 px): ô chọn 52×44, chữ mức nhỏ lại cho vừa.
                compact ? "gap-1.5 [&_.font-display]:text-[13px]" : "gap-2",
              )
            : "grid-cols-2 gap-2 px-1.25 pt-1 pb-0.5"
        }
      />
    );
    return (
      <fieldset
        ref={panel.panelRef}
        aria-label={t("bots.editGroup", { name })}
        onKeyDown={panel.onKeyDown}
        className={cn(
          "relative flex min-w-0 flex-col border-sticker bg-card text-card-foreground",
          desktop
            ? compact
              ? "gap-1 rounded-[18px] border-4 px-1.5 pt-1 pb-1.5 shadow-sticker-sm"
              : "gap-1.5 rounded-[20px] border-4 px-2 pt-1.5 pb-2 shadow-sticker"
            : cn(
                "gap-1 border-[3px] px-1 pt-0.5 pb-2 shadow-sticker-sm",
                compact ? "rounded-[15px]" : "rounded-2xl",
              ),
          POP_IN,
        )}
      >
        {desktop ? (
          <>
            <span className="truncate pr-8.5 pl-0.5 text-[12.5px] leading-4 font-bold text-muted-foreground">
              <Trans
                i18nKey="bots.editTitleWide"
                values={{ name }}
                components={{ b: <span className="text-card-foreground" /> }}
              />
            </span>
            {picker}
            <CloseButton label={t("bots.close")} onClick={panel.close} corner />
          </>
        ) : (
          <>
            <div className="flex h-11 items-center gap-0.5">
              <span className="flex min-w-0 flex-1 flex-col pl-1 leading-[1.1]">
                <span className="text-[11px] font-bold text-muted-foreground">
                  {t("bots.editTitle")}
                </span>
                <span className="truncate font-display text-[15px] font-extrabold">{name}</span>
              </span>
              <CloseButton label={t("bots.close")} onClick={panel.close} />
            </div>
            {picker}
            <button
              type="button"
              onClick={remove}
              className="mx-0.5 mt-1.5 flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-[2.5px] border-sticker bg-card font-display text-base font-extrabold text-destructive outline-none focus-visible:ring-3 focus-visible:ring-primary active:translate-y-0.5"
            >
              <XIcon aria-hidden className="size-4" strokeWidth={3} />
              {t("bots.remove")}
            </button>
          </>
        )}
      </fieldset>
    );
  }

  if (desktop) {
    return (
      <div className={cn(compact ? CARD_DESKTOP_COMPACT : CARD_DESKTOP, POP_IN)}>
        {avatar}
        <span className="flex max-w-full min-w-0 items-baseline gap-1 overflow-x-clip leading-none">
          <PlayerName
            player={player}
            className={cn(
              "truncate font-display font-extrabold",
              compact ? "text-[17px]" : "text-[22px]",
            )}
            suffixClassName={cn("text-muted-foreground", compact ? "text-[11.5px]" : "text-sm")}
          />
        </span>
        {canEdit ? (
          <>
            <button
              ref={panel.triggerRef}
              type="button"
              aria-label={t("bots.chipLabel", { name, level: levelName })}
              aria-expanded={false}
              onClick={() => onOpenChange(true)}
              className={cn(
                "group/chip flex h-11 cursor-pointer items-center rounded-full px-1.5 outline-none",
                compact ? "-my-2.5" : "-mt-1.5 -mb-2",
              )}
            >
              <BotLevelChip
                level={player.botLevel}
                editable
                className={cn(
                  "group-hover/chip:-translate-y-px group-focus-visible/chip:ring-3 group-focus-visible/chip:ring-primary",
                  chip,
                )}
              />
            </button>
            {/* Ô gọn hẹp: nút × lệch ra góc trên phải, nằm trong khe lưới (vòng 28 px). */}
            <button
              type="button"
              aria-label={t("bots.removeLabel", { name })}
              onClick={remove}
              className={cn(
                "group/remove absolute z-10 grid size-11 cursor-pointer place-items-center rounded-full outline-none",
                compact ? "-top-3 -right-3" : "top-0.5 right-0.5",
              )}
            >
              <span
                className={cn(
                  "grid place-items-center rounded-full border-[2.5px] border-sticker bg-card group-focus-visible/remove:ring-3 group-focus-visible/remove:ring-primary",
                  compact ? "size-7" : "size-7.5",
                )}
              >
                <XIcon aria-hidden className={compact ? "size-3.5" : "size-4"} strokeWidth={3} />
              </span>
            </button>
          </>
        ) : (
          <BotLevelChip level={player.botLevel} className={chip} />
        )}
      </div>
    );
  }

  return (
    <div className={cn(compact ? CARD_MOBILE_COMPACT : CARD_MOBILE, POP_IN)}>
      {avatar}
      <span
        className={cn("flex min-w-0 flex-1 flex-col items-start", compact ? "gap-0.75" : "gap-1")}
      >
        <span className="flex max-w-full min-w-0 items-baseline gap-0.75 overflow-x-clip leading-none">
          <PlayerName
            player={player}
            className={cn(
              "truncate font-display font-extrabold",
              compact ? "text-base" : "text-[17px]",
            )}
            suffixClassName={cn("text-muted-foreground", compact ? "text-[11px]" : "text-xs")}
          />
        </span>
        <BotLevelChip level={player.botLevel} editable={canEdit} className={chip} />
      </span>
      {canEdit && (
        // Ô quá hẹp cho cả nhãn mức lẫn nút × đủ 44 px: cả ô là một nút mở bảng đổi mức / bỏ bot.
        <button
          ref={panel.triggerRef}
          type="button"
          aria-label={t("bots.editLabel", { name, level: levelName })}
          aria-expanded={false}
          onClick={() => onOpenChange(true)}
          className={cn(
            "absolute -inset-0.75 cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-primary",
            compact ? "rounded-[15px]" : "rounded-2xl",
          )}
        />
      )}
    </div>
  );
}

interface AddBotSlotProps extends PanelProps {
  /** Gửi `addBot` ở mức này. */
  onAdd(level: BotLevel): void;
  /** Đang chờ máy chủ thêm bot ở mức này (ô đó quay vòng, các ô khác khoá). */
  pending: BotLevel | null;
}

/** Ô trống của chủ phòng: "+ Thêm bot", bấm thì 4 ô chọn mức mở ngay trong ô. */
export function AddBotSlot({
  open,
  onOpenChange,
  onAdd,
  pending,
  compact = false,
}: AddBotSlotProps) {
  const { t } = useTranslation();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const panel = useInlinePanel(open, onOpenChange);

  if (open) {
    const buttons = (
      <BotLevelButtons
        onPick={onAdd}
        pending={pending}
        labelOf={(level) => t("bots.addAt", { level: t(`bots.level.${level}`) })}
        busyLabel={t("bots.adding")}
        defaultRef={panel.focusRef}
        className={
          desktop
            ? cn(
                "flex-1 grid-cols-2 grid-rows-[repeat(2,2.75rem)] px-0.5",
                // Ô gọn hẹp (≈ 115 px): ô chọn 52×44, chữ mức nhỏ lại cho vừa.
                compact ? "gap-1.5 [&_.font-display]:text-[13px]" : "gap-2",
              )
            : "grid-cols-2 gap-2 px-1.25 pt-1"
        }
      />
    );
    return (
      <fieldset
        ref={panel.panelRef}
        aria-label={t("bots.pickGroup")}
        onKeyDown={panel.onKeyDown}
        className={cn(
          "relative flex min-w-0 flex-col border-[3px] border-chalk bg-board-shade text-chalk",
          desktop
            ? compact
              ? "gap-1 rounded-[18px] px-1.5 pt-1 pb-1.5"
              : "gap-1.5 rounded-[20px] px-2 pt-1.5 pb-2"
            : cn("gap-1 px-1 pt-0.5 pb-2.5", compact ? "rounded-[15px]" : "rounded-2xl"),
          POP_IN,
        )}
      >
        {desktop ? (
          <>
            <span
              className={cn(
                "pr-8.5 pl-0.5 font-display leading-4 font-extrabold",
                compact ? "truncate text-sm" : "text-[15px]",
              )}
            >
              {compact ? t("bots.pickTitle") : t("bots.pickTitleWide")}
            </span>
            {buttons}
            <CloseButton label={t("bots.close")} onClick={panel.close} corner />
          </>
        ) : (
          <>
            <div className="flex h-11 items-center gap-0.5">
              <span className="flex min-w-0 flex-1 flex-col pl-1.5 leading-[1.1]">
                <span className="font-display text-base font-extrabold">{t("bots.pickTitle")}</span>
                <span className="text-[11.5px] font-semibold text-chalk-muted">
                  {t("bots.pickHint")}
                </span>
              </span>
              <CloseButton label={t("bots.close")} onClick={panel.close} />
            </div>
            {buttons}
          </>
        )}
      </fieldset>
    );
  }

  return (
    <button
      ref={panel.triggerRef}
      type="button"
      aria-label={t("bots.emptyAddLabel")}
      aria-expanded={false}
      onClick={() => onOpenChange(true)}
      className={cn(
        "flex min-w-0 cursor-pointer items-center border-[3px] border-dashed border-chalk/60 bg-board-shade text-left text-chalk transition-colors outline-none hover:border-chalk focus-visible:ring-3 focus-visible:ring-primary",
        "lg:h-auto lg:flex-col lg:justify-center lg:text-center",
        compact ? EMPTY_FRAME.compact : EMPTY_FRAME.classic,
      )}
    >
      <EmptyIcon compact={compact}>
        <BotIcon aria-hidden className="size-4.5 lg:size-5.5" strokeWidth={2.4} />
      </EmptyIcon>
      <EmptyText compact={compact} action={t("bots.addBot")} />
    </button>
  );
}
