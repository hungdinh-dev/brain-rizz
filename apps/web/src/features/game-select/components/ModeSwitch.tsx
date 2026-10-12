import { PICK_MODES, type PickMode } from "@brain-rizz/shared";
import { CrownIcon, Disc3Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const ICON = { wheel: Disc3Icon, pick: CrownIcon } as const;

interface ModeSwitchProps {
  value: PickMode;
  /** Bỏ trống = chỉ hiển thị (người chơi thường) */
  onChange?(mode: PickMode): void;
  /** Khoá khi vòng quay đã quay */
  disabled?: boolean;
  className?: string;
}

/** Công tắc "Vòng quay may mắn / Chủ phòng chọn" dạng viên thuốc giấy. */
export function ModeSwitch({ value, onChange, disabled, className }: ModeSwitchProps) {
  const { t } = useTranslation();
  const label = { wheel: t("gameSelect.modeWheel"), pick: t("gameSelect.modePick") };

  return (
    <fieldset
      className={cn(
        "flex min-w-0 gap-1 rounded-full border-[3.5px] border-sticker bg-card p-1 text-card-foreground shadow-sticker-sm",
        className,
      )}
    >
      <legend className="sr-only">{t("gameSelect.modeGroup")}</legend>
      {PICK_MODES.map((mode) => {
        const Icon = ICON[mode];
        const on = mode === value;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={on}
            disabled={!onChange || disabled}
            onClick={() => onChange?.(mode)}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-3.5 font-display text-base font-extrabold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-default lg:text-[17px]",
              on ? "bg-secondary text-secondary-foreground" : "enabled:hover:bg-accent",
              !on && (!onChange || disabled) && "opacity-60",
            )}
          >
            <Icon aria-hidden className="size-5 shrink-0" strokeWidth={2.4} />
            {label[mode]}
          </button>
        );
      })}
    </fieldset>
  );
}
