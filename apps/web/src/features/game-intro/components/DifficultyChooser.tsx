import { DIFFICULTIES, type Difficulty } from "@brain-rizz/shared";
import { CheckIcon, FlameIcon, type LucideIcon, SproutIcon, StarIcon, ZapIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const ICON: Record<Difficulty, LucideIcon> = {
  0: SproutIcon,
  1: StarIcon,
  2: FlameIcon,
  3: ZapIcon,
};

interface DifficultyChooserProps {
  value: Difficulty;
  onChange(value: Difficulty): void;
  /** Mô tả từng mức của game này (vd. "Lưới 3×3") */
  levels: readonly string[];
  className?: string;
}

/** 4 nút chọn độ khó kèm mô tả theo game (2×2 trên điện thoại, 4 cột trên máy tính). */
export function DifficultyChooser({ value, onChange, levels, className }: DifficultyChooserProps) {
  const { t } = useTranslation();

  return (
    <fieldset className={cn("grid min-w-0 grid-cols-2 gap-2.5 lg:grid-cols-4", className)}>
      <legend className="sr-only">{t("intro.pickDifficulty")}</legend>
      {DIFFICULTIES.map((d) => {
        const Icon = ICON[d];
        const on = d === value;
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(d)}
            className={cn(
              "relative flex min-h-15.5 cursor-pointer items-center gap-2 rounded-[14px] border-[3px] border-sticker px-2.5 text-left transition-[translate,box-shadow] outline-none focus-visible:ring-3 focus-visible:ring-ring lg:min-h-18 lg:rounded-2xl",
              on
                ? "bg-primary text-primary-foreground shadow-sticker-sm"
                : "bg-card text-card-foreground hover:-translate-y-0.5",
            )}
          >
            {on && (
              <span className="absolute -top-2.5 -right-2 grid size-6 place-items-center rounded-full border-[2.5px] border-sticker bg-compute text-ink lg:size-6.5">
                <CheckIcon aria-hidden className="size-3.5" strokeWidth={3.2} />
              </span>
            )}
            <Icon aria-hidden className="size-6 shrink-0" strokeWidth={2.4} />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="font-display text-[17px] font-extrabold lg:text-[19px]">
                {t(`difficulty.${d}`)}
              </span>
              <span
                className={cn(
                  "text-[11px] lg:text-xs",
                  on ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {levels[d]}
              </span>
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}
