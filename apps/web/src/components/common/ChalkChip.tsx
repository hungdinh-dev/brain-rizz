import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Biểu tượng "phấn" (tiền trong game, CR-023): viên phấn trắng viền mực, đầu bọc giấy vàng, bụi
 * phấn ở đầu viết. Màu cố định kiểu nhãn dán nên đứng được trên bảng, thẻ giấy và thẻ tối.
 */
export function ChalkIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={cn("size-5 shrink-0", className)}>
      <g transform="rotate(-35 12 12)">
        <rect
          x="2.5"
          y="8.25"
          width="19"
          height="7.5"
          rx="3.75"
          className="fill-paper stroke-ink"
          strokeWidth={2}
        />
        <path
          d="M14.5 8.25 H17.75 A3.75 3.75 0 0 1 17.75 15.75 H14.5 Z"
          className="fill-sun stroke-ink"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </g>
      <circle cx="4" cy="20.5" r="1.3" className="fill-paper stroke-ink" strokeWidth={1} />
      <circle cx="8" cy="21.5" r="0.9" className="fill-paper stroke-ink" strokeWidth={0.8} />
    </svg>
  );
}

const chalkChipVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full font-display leading-none font-extrabold whitespace-nowrap tabular-nums",
  {
    variants: {
      tone: {
        /** Số dư viết thẳng trên bảng (đầu màn Máy quay, Tủ đồ) */
        board: "border-[2.5px] border-chalk/70 bg-board-shade text-chalk",
        /** Trong thẻ (giá trên nút, dòng tỉ lệ) */
        card: "border-2 border-sticker bg-muted text-card-foreground",
        /** "+N phấn" vừa nhận (kết quả trận, Kiểm tra não, món trùng): nổi như nhãn dán vàng */
        reward:
          "border-[2.5px] border-sticker bg-primary text-primary-foreground shadow-[0_3px_0_var(--color-sticker)]",
      },
      size: {
        sm: "h-7 px-2.5 text-sm [&_svg]:size-4",
        md: "h-9 px-3 text-lg [&_svg]:size-5",
        lg: "h-11 px-4 text-xl [&_svg]:size-6",
      },
    },
    defaultVariants: { tone: "board", size: "md" },
  },
);

interface ChalkChipProps extends VariantProps<typeof chalkChipVariants> {
  /** Số đã định dạng, vd "1.240" hoặc "+12" */
  children: ReactNode;
  /** Chữ cho trình đọc màn hình đọc sau số, vd "phấn" (biểu tượng chỉ để trang trí) */
  srLabel?: string;
  className?: string;
}

/** Số phấn kèm biểu tượng viên phấn: số dư, giá, "+N phấn". Chỉ hiển thị, không bấm được. */
export function ChalkChip({ children, srLabel, tone, size, className }: ChalkChipProps) {
  return (
    <span className={cn(chalkChipVariants({ tone, size }), className)}>
      <ChalkIcon />
      {children}
      {srLabel && <span className="sr-only"> {srLabel}</span>}
    </span>
  );
}
