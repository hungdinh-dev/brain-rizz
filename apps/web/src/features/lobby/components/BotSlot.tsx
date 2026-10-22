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

interface PanelProps {
  open: boolean;
  onOpenChange(open: boolean): void;
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
export function BotSlot({ player, canEdit, open, onOpenChange }: BotSlotProps) {
  const { t } = useTranslation();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const { full } = usePlayerName();
  const panel = useInlinePanel(open && canEdit, onOpenChange);
  const name = full(player);
  const levelName = t(`bots.level.${player.botLevel}`);

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

  const avatar = (
    <span className="relative flex shrink-0">
      <PlayerAvatar
        avatar={player.avatar}
        colorIndex={player.colorIndex}
        size={desktop ? "lg" : "md"}
      />
      <BotBadge size={desktop ? "md" : "sm"} />
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
            ? "flex-1 grid-cols-2 grid-rows-[repeat(2,2.75rem)] gap-2 px-0.5"
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
            ? "gap-1.5 rounded-[20px] border-4 px-2 pt-1.5 pb-2 shadow-sticker"
            : "gap-1 rounded-2xl border-[3px] px-1 pt-0.5 pb-2 shadow-sticker-sm",
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
      <div className={cn(CARD_DESKTOP, POP_IN)}>
        {avatar}
        <span className="flex max-w-full min-w-0 items-baseline gap-1 overflow-x-clip leading-none">
          <PlayerName
            player={player}
            className="truncate font-display text-[22px] font-extrabold"
            suffixClassName="text-sm text-muted-foreground"
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
              className="group/chip -mt-1.5 -mb-2 flex h-11 cursor-pointer items-center rounded-full px-1.5 outline-none"
            >
              <BotLevelChip
                level={player.botLevel}
                editable
                className="group-hover/chip:-translate-y-px group-focus-visible/chip:ring-3 group-focus-visible/chip:ring-primary"
              />
            </button>
            <button
              type="button"
              aria-label={t("bots.removeLabel", { name })}
              onClick={remove}
              className="group/remove absolute top-0.5 right-0.5 grid size-11 cursor-pointer place-items-center rounded-full outline-none"
            >
              <span className="grid size-7.5 place-items-center rounded-full border-[2.5px] border-sticker bg-card group-focus-visible/remove:ring-3 group-focus-visible/remove:ring-primary">
                <XIcon aria-hidden className="size-4" strokeWidth={3} />
              </span>
            </button>
          </>
        ) : (
          <BotLevelChip level={player.botLevel} />
        )}
      </div>
    );
  }

  return (
    <div className={cn(CARD_MOBILE, POP_IN)}>
      {avatar}
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="flex max-w-full min-w-0 items-baseline gap-0.75 overflow-x-clip leading-none">
          <PlayerName
            player={player}
            className="truncate font-display text-[17px] font-extrabold"
            suffixClassName="text-xs text-muted-foreground"
          />
        </span>
        <BotLevelChip level={player.botLevel} editable={canEdit} />
      </span>
      {canEdit && (
        // Ô quá hẹp cho cả nhãn mức lẫn nút × đủ 44 px: cả ô là một nút mở bảng đổi mức / bỏ bot.
        <button
          ref={panel.triggerRef}
          type="button"
          aria-label={t("bots.editLabel", { name, level: levelName })}
          aria-expanded={false}
          onClick={() => onOpenChange(true)}
          className="absolute -inset-0.75 cursor-pointer rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-primary"
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
export function AddBotSlot({ open, onOpenChange, onAdd, pending }: AddBotSlotProps) {
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
            ? "flex-1 grid-cols-2 grid-rows-[repeat(2,2.75rem)] gap-2 px-0.5"
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
            ? "gap-1.5 rounded-[20px] px-2 pt-1.5 pb-2"
            : "gap-1 rounded-2xl px-1 pt-0.5 pb-2.5",
          POP_IN,
        )}
      >
        {desktop ? (
          <>
            <span className="pr-8.5 pl-0.5 font-display text-[15px] leading-4 font-extrabold">
              {t("bots.pickTitleWide")}
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
        "flex h-15 min-w-0 cursor-pointer items-center gap-2 rounded-2xl border-[3px] border-dashed border-chalk/60 bg-board-shade px-2.5 text-left text-chalk transition-colors outline-none hover:border-chalk focus-visible:ring-3 focus-visible:ring-primary",
        "lg:h-auto lg:flex-col lg:justify-center lg:gap-1.5 lg:rounded-[20px] lg:text-center",
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full border-[2.5px] border-dashed border-chalk/70 lg:size-11.5 lg:border-[3px]">
        <BotIcon aria-hidden className="size-4.5 lg:size-5.5" strokeWidth={2.4} />
      </span>
      <span className="flex min-w-0 flex-col leading-tight lg:items-center lg:gap-1">
        <span className="font-display text-base font-extrabold lg:text-[19px] lg:leading-none">
          {t("lobby.emptySlot")}
        </span>
        <span className="text-xs font-semibold text-chalk-muted underline underline-offset-2 lg:text-[13px] lg:underline-offset-3">
          {t("bots.addBot")}
        </span>
      </span>
    </button>
  );
}
