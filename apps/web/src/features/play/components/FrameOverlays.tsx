import { WRONG_ANSWER_LOCK_MS } from "@brain-rizz/shared";
import { LoaderCircleIcon, LockIcon, TimerIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useNumberFormat } from "@/hooks/use-number-format";
import { useServerClock } from "@/hooks/use-server-clock";
import { useServerTimeReached } from "@/hooks/use-server-time-reached";
import { useGame } from "@/stores/game.store";

/*
 * Các lớp phủ của thẻ giấy chứa minigame (khu M1 trên canvas).
 * Lớp nào chặn chạm thì phủ kín thẻ (absolute inset-0) để canvas Phaser bên dưới không nhận chạm.
 */

/** Đếm ngược trước khi vào vòng (pha `countdown`) kèm một câu cách chơi. */
export function CountdownPanel({ startAt, howTo }: { startAt: number; howTo: string }) {
  const now = useServerClock(250);
  const seconds = Math.max(1, Math.ceil((startAt - now) / 1000));
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-muted-foreground">{howTo}</p>
      <span className="font-display text-8xl font-extrabold tabular-nums">{seconds}</span>
    </div>
  );
}

/** Vòng phấn quay trong lúc tải scene. */
export function SceneLoading() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground"
    >
      <LoaderCircleIcon aria-hidden className="size-14 motion-safe:animate-spin" />
      <span className="text-sm font-semibold">{t("play.loading")}</span>
    </div>
  );
}

/** Tải scene lỗi (thường do rớt mạng lúc tải chunk): tải lại trang, phòng tự nối lại. */
export function SceneError() {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted px-8 text-center"
    >
      <TriangleAlertIcon aria-hidden className="size-12 text-destructive" />
      <span className="font-display text-2xl leading-tight font-extrabold">
        {t("play.loadError")}
      </span>
      <span className="text-sm text-muted-foreground">{t("play.loadErrorHint")}</span>
      {/* Import động lỗi bị trình duyệt nhớ, thử import lại không ăn thua → tải lại trang
          (token nối lại nằm trong sessionStorage nên vẫn về đúng phòng). */}
      <Button onClick={() => location.reload()}>{t("play.retry")}</Button>
    </div>
  );
}

const LOCK_R = 12;
const LOCK_RING = 2 * Math.PI * LOCK_R;

/**
 * Huy hiệu khoá ở mép trên thẻ sau khi trả lời sai, vòng đếm ngắn dần trong 1,5 giây.
 * Khung KHÔNG phủ mờ lên scene: scene tự làm mờ và hiện đáp án đúng lúc khoá (ghi chú M1).
 */
export function LockBadge() {
  const lockedUntil = useGame((s) => s.lastAnswer?.lockedUntil ?? 0);
  const done = useServerTimeReached(lockedUntil);
  if (!lockedUntil || done) return null;
  return <LockCountdown until={lockedUntil} />;
}

function LockCountdown({ until }: { until: number }) {
  const { t } = useTranslation();
  const fmt = useNumberFormat(1);
  const now = useServerClock(100);
  const leftMs = Math.min(WRONG_ANSWER_LOCK_MS, Math.max(0, until - now));
  const seconds = fmt(leftMs / 1000);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3.5 flex justify-center">
      <div
        role="status"
        aria-label={t("play.lockedLabel", { seconds })}
        className="flex h-10.5 items-center gap-2 rounded-full border-[3px] border-sticker bg-secondary pr-4 pl-1.5 whitespace-nowrap text-secondary-foreground shadow-sticker-sm"
      >
        <span className="relative size-7.5 shrink-0">
          <svg viewBox="0 0 30 30" aria-hidden className="size-full">
            <circle
              cx="15"
              cy="15"
              r={LOCK_R}
              fill="none"
              strokeWidth="4.5"
              className="stroke-secondary-foreground/25"
            />
            <circle
              cx="15"
              cy="15"
              r={LOCK_R}
              fill="none"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeDasharray={`${(leftMs / WRONG_ANSWER_LOCK_MS) * LOCK_RING} ${LOCK_RING}`}
              transform="rotate(-90 15 15)"
              className="stroke-secondary-foreground"
            />
          </svg>
          <LockIcon aria-hidden className="absolute inset-0 m-auto size-3.5" strokeWidth={3} />
        </span>
        <span aria-hidden className="font-display text-lg leading-none font-extrabold tabular-nums">
          {t("play.locked", { seconds })}
        </span>
      </div>
    </div>
  );
}

/** "+N" bay lên rồi mờ dần sau mỗi câu đúng (FR-VC-11). Điểm lấy từ `answerResult` của server. */
export function PointsPop() {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const last = useGame((s) => s.lastAnswer);
  if (!last?.correct || last.points <= 0) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-16 flex justify-center">
      {/* key theo số câu → mỗi câu đúng dựng lại phần tử, hiệu ứng chạy lại từ đầu */}
      <span
        key={last.index}
        className="animate-out rounded-full border-[3px] border-sticker bg-compute px-3.5 py-0.5 font-display text-2xl font-extrabold text-ink tabular-nums shadow-sticker-sm fade-out fill-mode-forwards animation-duration-900 delay-200 motion-safe:slide-out-to-top-10"
      >
        {t("play.gain", { points: fmt(last.points) })}
      </span>
    </div>
  );
}

/** Hết giờ: ngừng nhận chạm, chờ server chuyển sang kết quả vòng. */
export function TimeUpOverlay() {
  const { t } = useTranslation();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-muted/70">
      <div
        role="status"
        className="flex h-18.5 -rotate-4 items-center gap-2.5 rounded-[20px] border-4 border-sticker bg-primary px-6 text-primary-foreground shadow-sticker"
      >
        <TimerIcon aria-hidden className="size-8" strokeWidth={2.6} />
        <span className="font-display text-[40px] leading-none font-extrabold">
          {t("play.timeUp")}
        </span>
      </div>
      <span className="text-[15px] font-bold">{t("play.waitingResults")}</span>
    </div>
  );
}

/** Mất kết nối: phủ mờ thẻ và tạm khoá chạm tới khi nối lại (dải vàng nằm ở trên cùng màn hình). */
export function ReconnectOverlay() {
  const { t } = useTranslation();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/90 px-8 text-center">
      <LoaderCircleIcon aria-hidden className="size-14 motion-safe:animate-spin" />
      <span className="font-display text-2xl leading-tight font-extrabold">
        {t("play.touchPaused")}
      </span>
      <span className="text-sm text-muted-foreground">{t("play.resumeHint")}</span>
    </div>
  );
}
