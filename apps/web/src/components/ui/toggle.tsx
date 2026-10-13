import { cva, type VariantProps } from "class-variance-authority";
import { Toggle as TogglePrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Gốc từ shadcn, chỉnh: cao 48px, bo rounded-2xl; khi bật (data-state=on) tô màu primary
 * giống nút chính — dùng cho chọn độ khó, chọn game…
 */
const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-2xl font-semibold whitespace-nowrap transition-all outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-95 disabled:pointer-events-none disabled:opacity-40 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border-[3px] border-sticker bg-card text-card-foreground",
      },
      size: {
        default: "min-h-12 min-w-12 px-3",
        sm: "h-9 min-w-9 rounded-xl px-2.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
