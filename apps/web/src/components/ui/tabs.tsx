import { cva, type VariantProps } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

/*
 * Gốc từ shadcn (style radix-vega), đã chỉnh theo bảng phấn (ADR 0009):
 * - variant "folder" (mặc định): tab kiểu bìa hồ sơ, tab đang chọn liền với thẻ nội dung bên dưới
 *   (dùng cho Tài khoản & lịch sử). TabsContent tự có viền nhãn dán.
 * - variant "pill": cụm nút tròn đặt thẳng trên bảng, tab đang chọn tô vàng primary
 *   (dùng cho Bảng xếp hạng: Điểm Não / Theo minigame).
 * - Cao tối thiểu 44px để dễ chạm.
 */
function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn("group/tabs flex flex-col", className)}
      {...props}
    />
  );
}

const tabsListVariants = cva("group/tabs-list flex items-end", {
  variants: {
    variant: {
      folder: "relative z-10 -mb-[3px] gap-1.5 px-3",
      pill: "w-fit items-center gap-1 rounded-full bg-board-shade p-1",
    },
  },
  defaultVariants: { variant: "folder" },
});

function TabsList({
  className,
  variant = "folder",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 px-4 font-display text-base font-extrabold whitespace-nowrap text-chalk transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 md:flex-none md:text-lg [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // Bìa hồ sơ: tab chưa chọn viền phấn mờ, tab chọn là giấy liền thẻ bên dưới
        "group-data-[variant=folder]/tabs-list:rounded-t-2xl group-data-[variant=folder]/tabs-list:border-[3px] group-data-[variant=folder]/tabs-list:border-b-0 group-data-[variant=folder]/tabs-list:border-chalk/60 group-data-[variant=folder]/tabs-list:bg-board-shade",
        "group-data-[variant=folder]/tabs-list:data-[state=active]:border-sticker group-data-[variant=folder]/tabs-list:data-[state=active]:bg-card group-data-[variant=folder]/tabs-list:data-[state=active]:text-card-foreground",
        // Viên thuốc: tab chọn tô vàng có viền mực
        "group-data-[variant=pill]/tabs-list:rounded-full group-data-[variant=pill]/tabs-list:border-[3px] group-data-[variant=pill]/tabs-list:border-transparent",
        "group-data-[variant=pill]/tabs-list:data-[state=active]:border-sticker group-data-[variant=pill]/tabs-list:data-[state=active]:bg-primary group-data-[variant=pill]/tabs-list:data-[state=active]:text-primary-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** Thẻ nội dung của tab. Với variant "folder" thì dùng `className` mặc định (viền nhãn dán). */
function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "rounded-3xl border-[3px] border-sticker bg-card p-4 text-card-foreground shadow-sticker outline-none focus-visible:ring-4 focus-visible:ring-ring/50 md:p-5",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants };
