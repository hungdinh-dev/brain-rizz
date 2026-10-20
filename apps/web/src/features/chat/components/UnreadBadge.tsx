import { useReducedMotion } from "@/features/motion";
import { cn } from "@/lib/utils";

/**
 * Số tin chưa đọc trên nút chat (CR-011): tròn đỏ viền mực, quá 9 ghi "9+", nảy một lần mỗi khi
 * số đổi (giảm chuyển động: hiện thẳng). Trình đọc màn hình đọc số qua `aria-label` của nút cha.
 */
export function UnreadBadge({ count, className }: { count: number; className?: string }) {
  const reduced = useReducedMotion();
  if (count <= 0) return null;
  return (
    <span
      key={count}
      aria-hidden
      className={cn(
        "absolute -top-2.5 -right-2.5 flex h-6.5 min-w-6.5 items-center justify-center rounded-full border-[2.5px] border-sticker bg-destructive px-1.5 text-[13px] leading-none font-extrabold text-destructive-foreground tabular-nums",
        !reduced && "fx-chat-badge",
        className,
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
