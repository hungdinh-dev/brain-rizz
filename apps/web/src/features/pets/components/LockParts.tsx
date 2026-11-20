import { LockIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Ổ khoá tròn ở góc phải trên của thú khoá (ui-ux 6.12): nền mực chữ giấy, chế độ tối đảo lại
 * (nền giấy) nhờ token `card-foreground` / `card`. Trang trí: trạng thái khoá đã có trong nhãn.
 */
export function LockBadge({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-10 grid place-items-center rounded-full border-sticker bg-card-foreground text-card",
        size === "md"
          ? "-top-2 -right-1.5 size-7 border-[2.5px] [&_svg]:size-3.5"
          : "-top-1 -right-1 size-5.5 border-2 [&_svg]:size-3",
        className,
      )}
    >
      <LockIcon strokeWidth={2.8} />
    </span>
  );
}

interface UnlockBarProps {
  /** 0…1 (`unlockRatio`). */
  ratio: number;
  size?: "sm" | "lg";
  /** Có nhãn → `role="progressbar"` đọc được; không có → trang trí (thẻ đã có nhãn đủ). */
  label?: string;
  className?: string;
}

/** Thanh tiến độ mở khoá: rãnh viền mực, phần đã đạt màu vàng. */
export function UnlockBar({ ratio, size = "sm", label, className }: UnlockBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  const track = cn(
    "relative block w-full overflow-hidden rounded-full border-sticker bg-muted",
    size === "lg" ? "h-4 border-[2.5px]" : "h-2.5 border-2",
    className,
  );
  const fill = (
    <span
      className={cn(
        "absolute inset-y-0 left-0 bg-primary",
        pct > 0 && pct < 100 && "border-r-2 border-sticker",
      )}
      // Độ dài tính lúc chạy theo tiến độ.
      style={{ width: `${pct}%` }}
    />
  );
  if (!label) {
    return (
      <span aria-hidden className={track}>
        {fill}
      </span>
    );
  }
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={track}
    >
      {fill}
    </span>
  );
}
