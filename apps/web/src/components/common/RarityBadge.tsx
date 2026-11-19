import { RARITIES, type Rarity } from "@brain-rizz/shared";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Độ hiếm phụ kiện (CR-023, ui-ux 6.12): nền màu + số hạt ◆ (Thường 1 … Huyền thoại 4) + tên, để
 * không chỉ dựa vào màu. Màu giữ nguyên ở sáng/tối (nhãn dán, luôn viền sticker).
 */
export const RARITY_BG: Record<Rarity, string> = {
  common: "bg-rarity-common",
  rare: "bg-rarity-rare",
  epic: "bg-rarity-epic",
  legendary: "bg-rarity-legendary",
};

/** Hạt ◆ theo độ hiếm: 1–4 hình thoi mực, rộng 7 px, cách 2 px. */
export function RarityPips({ rarity, className }: { rarity: Rarity; className?: string }) {
  const n = RARITIES.indexOf(rarity) + 1;
  const w = n * 7 + (n - 1) * 2;
  return (
    <svg
      aria-hidden
      width={w}
      height={9}
      viewBox={`0 0 ${w} 9`}
      className={cn("shrink-0 fill-current", className)}
    >
      {Array.from({ length: n }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: số hạt cố định theo độ hiếm
        <path key={i} d={`M${i * 9 + 3.5} 0 L${i * 9 + 7} 4.5 L${i * 9 + 3.5} 9 L${i * 9} 4.5 Z`} />
      ))}
    </svg>
  );
}

const rarityBadgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border-sticker font-display leading-none font-extrabold whitespace-nowrap text-rarity-foreground",
  {
    variants: {
      size: {
        /** Góc ô món, viên nang: chỉ hạt, tên đọc bằng aria-label */
        xs: "h-5 border-2 px-1.5",
        /** Dòng tên món, danh sách tỉ lệ */
        sm: "h-6 border-2 px-2 text-[13px]",
        /** Màn mở quà (một món) */
        md: "h-8 border-[2.5px] px-3 text-base",
      },
    },
    defaultVariants: { size: "sm" },
  },
);

interface RarityBadgeProps extends VariantProps<typeof rarityBadgeVariants> {
  rarity: Rarity;
  /** Tên độ hiếm đã dịch (`t("gacha.rarity.<rarity>")`); cỡ `xs` dùng làm aria-label */
  label: string;
  className?: string;
}

/** Nhãn độ hiếm: hạt ◆ + tên trên nền màu độ hiếm, viền mực. */
export function RarityBadge({ rarity, label, size, className }: RarityBadgeProps) {
  const classes = cn(rarityBadgeVariants({ size }), RARITY_BG[rarity], className);
  if (size === "xs") {
    return (
      <span role="img" aria-label={label} className={classes}>
        <RarityPips rarity={rarity} />
      </span>
    );
  }
  return (
    <span className={classes}>
      <RarityPips rarity={rarity} />
      {label}
    </span>
  );
}
