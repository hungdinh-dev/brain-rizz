import { FlameIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNumberFormat } from "@/hooks/use-number-format";
import { cn } from "@/lib/utils";
import { appliedComboMultiplier, hasCombo } from "../standings";

/** Nhãn "Combo ×1,2" — chỉ hiện từ câu đúng liên tiếp thứ 3, sai một câu là mất. */
export function ComboChip({ streak, className }: { streak: number; className?: string }) {
  const { t } = useTranslation();
  const fmt = useNumberFormat(1);
  if (!hasCombo(streak)) return null;
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full border-[2.5px] border-sticker bg-identify px-2 text-xs font-bold whitespace-nowrap text-ink",
        className,
      )}
    >
      <FlameIcon aria-hidden className="size-3.5" strokeWidth={2.6} />
      {t("play.combo", { multiplier: fmt(appliedComboMultiplier(streak)) })}
    </span>
  );
}

/** Ngọn lửa nhỏ cạnh điểm đối thủ khi họ đang combo. */
export function ComboFlame({ streak, className }: { streak: number; className?: string }) {
  const { t } = useTranslation();
  if (!hasCombo(streak)) return null;
  return (
    <FlameIcon
      role="img"
      aria-label={t("play.comboing")}
      className={cn("size-3 shrink-0 fill-identify text-sticker", className)}
      strokeWidth={2.6}
    />
  );
}
