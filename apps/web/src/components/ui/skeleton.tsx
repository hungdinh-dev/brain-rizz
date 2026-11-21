import type * as React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps extends React.ComponentProps<"div"> {
  /**
   * Nền đặt khung xương:
   * - `card` (mặc định): bên trong thẻ giấy — `bg-muted`, tự đổi theo sáng/tối.
   * - `board`: thẳng trên bảng phấn — mảng bóng `bg-board-shade` (ADR 0009).
   */
  tone?: "card" | "board";
}

/**
 * Gốc từ shadcn. Khung nhạt giữ chỗ khi đang tải. Nhấp nháy chậm; đứng yên khi giảm chuyển động
 * (`motion-safe:` đọc cả cài đặt máy lẫn nút Hiệu ứng của app — features/motion).
 * Chỉ để trang trí (`aria-hidden`): chỗ dùng tự đặt `aria-busy` / chữ "Đang tải…" cho trình đọc màn hình.
 */
function Skeleton({ className, tone = "card", ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "rounded-xl motion-safe:animate-pulse",
        tone === "board" ? "bg-board-shade" : "bg-muted",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
