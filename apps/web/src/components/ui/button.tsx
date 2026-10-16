import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

/*
 * Gốc từ shadcn (style radix-vega), đã chỉnh cho party game:
 * - Cỡ mặc định cao 48px (min-h-12) để dễ chạm trên điện thoại.
 * - Bo góc rounded-2xl, chữ font-display đậm, nhún nhẹ khi bấm (active:scale-95).
 * - Kiểu nhãn dán (ADR 0009): viền mực + bóng đổ, bấm xuống thì lún vào.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-transparent bg-clip-padding font-display text-lg font-extrabold whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default:
          "border-[3px] border-sticker bg-primary text-primary-foreground shadow-sticker-sm hover:-translate-y-0.5 active:translate-y-1 active:shadow-none",
        outline:
          "border-[3px] border-sticker bg-card text-card-foreground shadow-sticker-sm hover:-translate-y-0.5 hover:bg-accent active:translate-y-1 active:shadow-none aria-expanded:bg-accent",
        secondary:
          "border-[3px] border-sticker bg-secondary text-secondary-foreground shadow-sticker-sm hover:-translate-y-0.5 active:translate-y-1 active:shadow-none",
        /** Nút tròn viết phấn đặt thẳng trên bảng (ngôn ngữ, sáng/tối…) */
        chalk:
          "rounded-full border-[2.5px] border-chalk/70 bg-board-shade text-chalk hover:border-chalk aria-expanded:border-chalk",
        ghost: "hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent",
        /** Thao tác không hoàn tác được (Xoá dữ liệu của tôi): nền đỏ đặc, vẫn kiểu nhãn dán */
        destructive:
          "border-[3px] border-sticker bg-destructive text-destructive-foreground shadow-sticker-sm hover:-translate-y-0.5 focus-visible:ring-destructive/30 active:translate-y-1 active:shadow-none",
        link: "text-highlight underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-12 px-5",
        sm: "h-9 gap-1.5 rounded-xl px-3 text-sm [&_svg:not([class*='size-'])]:size-4",
        lg: "min-h-14 px-6 text-lg",
        icon: "size-12",
        "icon-chalk": "size-11",
        "icon-sm": "size-9 rounded-xl [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
