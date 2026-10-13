import { useTranslation } from "react-i18next";
import { useServerClock } from "@/hooks/use-server-clock";
import { cn } from "@/lib/utils";

/** Từ mốc này (giây) đồng hồ đổi đỏ và nhấp nháy. */
const DANGER_SECONDS = 10;
const RING_R = 25;
const RING_LENGTH = 2 * Math.PI * RING_R;

interface RoundTimerProps {
  startAt: number;
  endsAt: number;
  /** sm = thanh trên điện thoại (66px), lg = cột trái máy tính (150px) */
  size?: "sm" | "lg";
  className?: string;
}

/**
 * Đĩa đồng hồ vòng theo giờ server: vòng vàng ngắn dần, số giây ở giữa.
 * 10 giây cuối: đĩa đỏ, nhấp nháy mỗi giây; bật "giảm chuyển động" thì chỉ đổi màu.
 */
export function RoundTimer({ startAt, endsAt, size = "sm", className }: RoundTimerProps) {
  const { t } = useTranslation();
  const now = useServerClock(250);
  const totalMs = Math.max(1, endsAt - startAt);
  const leftMs = Math.min(totalMs, Math.max(0, endsAt - now));
  const seconds = Math.ceil(leftMs / 1000);
  const danger = seconds > 0 && seconds <= DANGER_SECONDS;
  const dash = (leftMs / totalMs) * RING_LENGTH;

  return (
    <div
      role="timer"
      aria-label={seconds > 0 ? t("play.timer", { count: seconds }) : t("play.timeUpLabel")}
      className={cn(
        "relative shrink-0",
        size === "sm" ? "size-16.5" : "size-37.5",
        // Nhấp nháy: mờ 50% ↔ rõ, mỗi nhịp 1 giây (biến của tw-animate nên không phụ thuộc thứ tự class).
        danger &&
          "motion-safe:animate-in motion-safe:fade-in-50 motion-safe:repeat-infinite motion-safe:direction-alternate motion-safe:animation-duration-500",
        className,
      )}
    >
      <svg viewBox="0 0 66 66" aria-hidden className="size-full">
        <circle
          cx="33"
          cy="33"
          r={danger ? 31 : 30}
          className={danger ? "fill-destructive stroke-sticker" : "fill-sticker"}
          strokeWidth={danger ? 3 : 0}
        />
        <circle
          cx="33"
          cy="33"
          r={RING_R}
          fill="none"
          strokeWidth="6"
          className={danger ? "stroke-chalk/30" : "stroke-chalk/20"}
        />
        {leftMs > 0 && (
          <circle
            cx="33"
            cy="33"
            r={RING_R}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${RING_LENGTH}`}
            transform="rotate(-90 33 33)"
            className={danger ? "stroke-chalk" : "stroke-primary"}
          />
        )}
      </svg>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center font-display leading-none font-extrabold tabular-nums",
          size === "sm" ? "pt-0.5 text-[26px]" : "pt-1.5 text-6xl",
          danger ? "text-chalk dark:text-sticker" : "text-chalk",
        )}
      >
        {seconds}
      </span>
    </div>
  );
}
