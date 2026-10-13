import type { LucideIcon } from "lucide-react";
import { ArrowRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MenuCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Màu thẻ (màu thương hiệu, giống nhau ở sáng/tối; chữ luôn màu mực) */
  tone: "mint" | "sky" | "pink" | "sun" | "grape";
  /** Nhãn góc như "Sắp có" */
  badge?: string;
  /** Có onClick → cả thẻ là một nút; không có → thẻ chứa form riêng (children) */
  onClick?(): void;
  /** Phần cuối thẻ: nhãn phụ, ô nhập mã… */
  children?: ReactNode;
  /** Nghiêng nhẹ trái/phải cho cảm giác giấy dán */
  tilt?: "left" | "right";
}

const TONE = {
  mint: "bg-mint",
  sky: "bg-sky",
  pink: "bg-pink",
  sun: "bg-sun",
  grape: "bg-grape",
} as const;

/** Thẻ lựa chọn lớn ở menu chính (Tạo phòng, Vào phòng, Tìm trận, Luyện tập). */
export function MenuCard({
  title,
  description,
  icon: Icon,
  tone,
  badge,
  onClick,
  children,
  tilt,
}: MenuCardProps) {
  const body = (
    <>
      <Icon
        aria-hidden
        className="pointer-events-none absolute -right-5 -bottom-6 size-32 opacity-10 md:size-40"
      />
      {badge && (
        <span className="absolute top-3 right-3 rotate-6 rounded-lg border-[2.5px] border-ink bg-paper px-2 font-display text-xs font-extrabold md:top-4 md:right-4 md:text-sm">
          {badge}
        </span>
      )}
      <span className="grid size-11 place-items-center rounded-2xl border-[3px] border-ink bg-paper md:size-14">
        <Icon aria-hidden className="size-6 md:size-8" strokeWidth={2.4} />
      </span>
      <span className="mt-1 font-display text-2xl leading-none font-extrabold md:text-4xl">
        {title}
      </span>
      <span className="text-[13px] leading-snug text-ink/80 md:max-w-72 md:text-[15px]">
        {description}
      </span>
      <span className="mt-auto flex items-end justify-between gap-2 pt-2">
        {children}
        {onClick && (
          <span className="ml-auto hidden size-11 shrink-0 place-items-center rounded-full bg-ink text-sun md:grid">
            <ArrowRightIcon aria-hidden className="size-5" strokeWidth={2.8} />
          </span>
        )}
      </span>
    </>
  );

  const className = cn(
    "relative flex min-h-40 flex-col items-start gap-1.5 overflow-hidden rounded-3xl border-[3.5px] border-ink p-4 text-left text-ink shadow-[0_6px_0_var(--color-ink)] md:min-h-60 md:gap-2 md:p-5",
    TONE[tone],
    tilt === "left" && "md:-rotate-1",
    tilt === "right" && "md:rotate-1",
  );

  if (!onClick) return <section className={className}>{body}</section>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        className,
        "cursor-pointer transition-[translate,box-shadow] hover:-translate-y-1 hover:shadow-[0_10px_0_var(--color-ink)] focus-visible:ring-4 focus-visible:ring-ring active:translate-y-1 active:shadow-[0_2px_0_var(--color-ink)]",
      )}
    >
      {body}
    </button>
  );
}
