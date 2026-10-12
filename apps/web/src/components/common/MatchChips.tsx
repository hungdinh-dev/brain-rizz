import type { Category, Difficulty } from "@brain-rizz/shared";
import { cva, type VariantProps } from "class-variance-authority";
import {
  BrainIcon,
  CalculatorIcon,
  type LucideIcon,
  ScaleIcon,
  ScanSearchIcon,
  ShapesIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/* Các nhãn nhỏ dùng lại ở nhiều màn trong trận: vòng, nhóm kỹ năng, độ khó. */

const roundChipVariants = cva(
  "inline-flex shrink-0 items-center rounded-full bg-secondary font-display font-extrabold whitespace-nowrap text-secondary-foreground",
  {
    variants: {
      size: {
        sm: "h-6.5 px-2.75 text-sm",
        md: "h-8.5 px-3.5 text-base",
        lg: "h-9.5 px-3.5 text-xl",
      },
    },
    defaultVariants: { size: "md" },
  },
);

/** "Vòng 2/3" (hoặc chữ khác truyền qua `children`, vd. "Sau vòng 2/3"). */
export function RoundChip({
  round,
  total,
  size,
  className,
  children,
}: VariantProps<typeof roundChipVariants> & {
  round?: number;
  total?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <span className={cn(roundChipVariants({ size }), className)}>
      {children ?? t("play.round", { round, total })}
    </span>
  );
}

/** Màu nhãn nhóm kỹ năng — viết sẵn từng class để Tailwind sinh ra được. */
export const CATEGORY_BG: Record<Category, string> = {
  identify: "bg-identify",
  memorize: "bg-memorize",
  analyze: "bg-analyze",
  compute: "bg-compute",
  visualize: "bg-visualize",
};

/** Chữ trên nền màu nhóm: nền tím (Hình dung) cần chữ sáng, còn lại chữ mực. */
export const CATEGORY_FG: Record<Category, string> = {
  identify: "text-ink",
  memorize: "text-ink",
  analyze: "text-ink",
  compute: "text-ink",
  visualize: "text-paper",
};

/** Biểu tượng nhóm kỹ năng — thay hình minh hoạ khi game chưa có (`GameClient.Illustration`). */
export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  identify: ScanSearchIcon,
  memorize: BrainIcon,
  analyze: ScaleIcon,
  compute: CalculatorIcon,
  visualize: ShapesIcon,
};

export function CategoryChip({ category, className }: { category: Category; className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex h-6.5 shrink-0 items-center rounded-full border-[2.5px] border-sticker px-2.5 text-[13px] font-bold whitespace-nowrap",
        CATEGORY_BG[category],
        CATEGORY_FG[category],
        className,
      )}
    >
      {t(`category.${category}`)}
    </span>
  );
}

/**
 * Màu nhãn độ khó (giữ nguyên ở sáng/tối, chữ mực). Bản mẫu dùng các sắc nhạt hơn
 * (#d6f2e1, #ffe2bd, #ffd3db) chưa có token — tạm dùng màu thương hiệu gần nhất.
 */
const DIFFICULTY_BG: Record<Difficulty, string> = {
  0: "bg-mint",
  1: "bg-paper",
  2: "bg-identify",
  3: "bg-pink",
};

export function DifficultyChip({
  difficulty,
  className,
}: {
  difficulty: Difficulty;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex h-5.5 shrink-0 items-center rounded-full border-2 border-sticker px-2 text-xs font-bold whitespace-nowrap text-ink",
        DIFFICULTY_BG[difficulty],
        className,
      )}
    >
      {t(`difficulty.${difficulty}`)}
    </span>
  );
}
