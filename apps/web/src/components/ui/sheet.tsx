import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * Gốc từ shadcn (style radix-vega), đã chỉnh theo kiểu nhãn dán (ADR 0009):
 * thẻ giấy viền mực 4px, bo góc lớn ở cạnh hướng vào màn hình, lớp phủ mực mờ.
 * Dùng cho: khung chat trên điện thoại (side="bottom", CR-011).
 * Giảm chuyển động (nút Hiệu ứng): chỉ mờ dần, không trượt.
 * Nút đóng chỉ hiện khi truyền `closeLabel` (chữ đã qua t()), vì components/ui không chứa chữ giao diện.
 */
function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-ink/55 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "bottom",
  closeLabel,
  overlayClassName,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
  /** Nhãn cho trình đọc màn hình của nút đóng (đã dịch). Bỏ trống = không có nút đóng. */
  closeLabel?: string;
  /** Lớp phủ nhạt hơn khi cần thấy nội dung phía sau (khung chat: `bg-ink/30`). */
  overlayClassName?: string;
}) {
  return (
    <SheetPortal>
      <SheetOverlay className={overlayClassName} />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-3 border-sticker bg-popover text-popover-foreground shadow-sticker duration-200 ease-out outline-none",
          "data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:rounded-t-3xl data-[side=bottom]:border-x-4 data-[side=bottom]:border-t-4 data-[side=bottom]:pb-[max(12px,env(safe-area-inset-bottom))]",
          "data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:rounded-b-3xl data-[side=top]:border-x-4 data-[side=top]:border-b-4",
          "data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:w-3/4 data-[side=right]:max-w-sm data-[side=right]:rounded-l-3xl data-[side=right]:border-y-4 data-[side=right]:border-l-4",
          "data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:w-3/4 data-[side=left]:max-w-sm data-[side=left]:rounded-r-3xl data-[side=left]:border-y-4 data-[side=left]:border-r-4",
          "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none",
          "motion-safe:data-[side=bottom]:data-open:slide-in-from-bottom-10 motion-safe:data-[side=bottom]:data-closed:slide-out-to-bottom-10",
          "motion-safe:data-[side=top]:data-open:slide-in-from-top-10 motion-safe:data-[side=top]:data-closed:slide-out-to-top-10",
          "motion-safe:data-[side=right]:data-open:slide-in-from-right-10 motion-safe:data-[side=right]:data-closed:slide-out-to-right-10",
          "motion-safe:data-[side=left]:data-open:slide-in-from-left-10 motion-safe:data-[side=left]:data-closed:slide-out-to-left-10",
          className,
        )}
        {...props}
      >
        {children}
        {closeLabel && (
          <SheetPrimitive.Close data-slot="sheet-close" asChild>
            <Button
              variant="outline"
              size="icon-chalk"
              className="absolute top-3 right-3 rounded-full"
              aria-label={closeLabel}
            >
              <XIcon />
            </Button>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1 px-4 pt-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 px-4", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-display text-2xl leading-tight font-extrabold", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
