import { type GameId, WRONG_ANSWER_LOCK_MS } from "@brain-rizz/shared";
import { HandIcon, MouseIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGameText } from "@/hooks/use-game-text";
import { TOUCH_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useNumberFormat } from "@/hooks/use-number-format";
import { useRoomScoring } from "@/hooks/use-room-scoring";
import { cn } from "@/lib/utils";

/** Số giây khoá khi sai, định dạng theo ngôn ngữ (1,5 / 1.5). */
export function useLockSeconds(): string {
  const fmt = useNumberFormat(1);
  return fmt(WRONG_ANSWER_LOCK_MS / 1000);
}

/** "Điều khiển:" + icon và chữ của thiết bị đang dùng (chạm / chuột). */
export function ControlsLine({ gameId, className }: { gameId: GameId; className?: string }) {
  const { t } = useTranslation();
  const game = useGameText(gameId);
  const touch = useMediaQuery(TOUCH_QUERY);
  const Icon = touch ? HandIcon : MouseIcon;
  return (
    <p className={cn("flex items-center gap-2", className)}>
      <strong>{t("intro.controlsInline")}</strong>
      <Icon aria-hidden className="size-4.5 shrink-0" />
      {touch ? game.controls.touch : game.controls.mouse}
    </p>
  );
}

/** "Tính điểm:" + một dòng công thức (combo theo công thức của phòng ở trận party, CR-019). */
export function ScoringLine({
  className,
  labelClassName,
}: {
  className?: string;
  labelClassName?: string;
}) {
  const { t } = useTranslation();
  const seconds = useLockSeconds();
  const { streakThreshold } = useRoomScoring();
  return (
    <p className={cn("leading-[1.45]", className)}>
      <strong className={labelClassName}>{t("intro.scoringInline")}</strong>{" "}
      {t("intro.scoringLine", { n: streakThreshold, seconds })}
    </p>
  );
}

/** Cỡ danh sách 3 bước: thẻ điện thoại / thẻ máy tính / hộp Phóng to máy tính / sheet điện thoại. */
const STEP_SIZE = {
  card: {
    list: "gap-[5px]",
    item: "gap-[9px] text-[13px] leading-tight",
    num: "size-5.5 text-[13px]",
  },
  cardDesktop: { list: "gap-2", item: "gap-2.5 text-sm leading-[1.3]", num: "size-7 text-[17px]" },
  zoom: {
    list: "grid grid-cols-3 gap-4",
    item: "gap-2.5 text-base leading-[1.3] font-semibold",
    num: "size-8.5 text-xl",
  },
  zoomCompact: {
    list: "gap-2.5",
    item: "gap-3 text-base leading-[1.3] font-semibold",
    num: "size-7.5 text-lg",
  },
} as const;

/** Cách chơi 3 bước, số khớp huy hiệu bước trong hình động. */
export function StepList({
  steps,
  size,
  className,
}: {
  steps: readonly string[];
  size: keyof typeof STEP_SIZE;
  className?: string;
}) {
  const s = STEP_SIZE[size];
  return (
    <ol className={cn("flex flex-col", s.list, className)}>
      {steps.map((step, i) => (
        <li key={step} className={cn("flex items-center", s.item)}>
          <span
            className={cn(
              "grid shrink-0 place-items-center rounded-full bg-secondary font-display font-extrabold text-secondary-foreground",
              s.num,
            )}
          >
            {i + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}
