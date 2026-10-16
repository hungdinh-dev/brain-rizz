import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Gốc từ shadcn. Khung nhạt giữ chỗ khi đang tải, đặt bên trong thẻ (bg-muted theo sáng/tối).
 * Nhấp nháy chậm; tự đứng yên khi người dùng bật giảm chuyển động.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-xl bg-muted motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Skeleton };
