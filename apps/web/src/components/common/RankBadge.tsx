import { cva, type VariantProps } from "class-variance-authority";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const rankBadgeVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full border-sticker font-display leading-none font-extrabold text-ink",
  {
    variants: {
      size: {
        /** Góc avatar trên dải đối thủ */
        xs: "size-4.5 border-2 text-[11px]",
        /** Cạnh điểm của tôi trên thanh trên */
        sm: "size-5.5 border-2 text-[13px]",
        /** Bảng điểm, danh sách xếp hạng */
        md: "size-8 border-[3px] text-base",
        /** Bảng điểm vòng / tổng điểm trên máy tính */
        lg: "size-11 border-[3px] text-[22px]",
      },
    },
    defaultVariants: { size: "sm" },
  },
);

/**
 * Màu nền theo hạng (hạng tính từ 1): vàng · xanh trời · cam · giấy. Giữ nguyên ở sáng/tối.
 * TODO (ui-designer): bản mẫu dùng bạc #d9dde6 và đồng #e8b48a cho hạng 2–3 nhưng chưa có token,
 * tạm dùng màu thương hiệu sky và identify.
 */
export const RANK_BG = ["bg-primary", "bg-sky", "bg-identify"] as const;

export function rankBg(rank: number): string {
  return RANK_BG[rank - 1] ?? "bg-paper";
}

interface RankBadgeProps extends VariantProps<typeof rankBadgeVariants> {
  /** Hạng tính từ 1 */
  rank: number;
  className?: string;
}

/** Huy hiệu hạng tròn có viền mực. */
export function RankBadge({ rank, size, className }: RankBadgeProps) {
  const { t } = useTranslation();
  return (
    <span
      role="img"
      aria-label={t("play.rank", { rank })}
      className={cn(rankBadgeVariants({ size }), rankBg(rank), className)}
    >
      {rank}
    </span>
  );
}
