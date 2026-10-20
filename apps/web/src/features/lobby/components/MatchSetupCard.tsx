import {
  COUNTDOWN_MS,
  GAME_IDS,
  GAMES,
  INTRO_AUTO_START_MS,
  MAX_TOTAL_ROUNDS,
  MIN_TOTAL_ROUNDS,
  WHEEL_RESULT_HOLD_MS,
  WHEEL_SPIN_LEAD_MS,
  WHEEL_SPIN_MS,
} from "@brain-rizz/shared";
import {
  CheckIcon,
  CrownIcon,
  HourglassIcon,
  LoaderCircleIcon,
  MinusIcon,
  PlayIcon,
  PlusIcon,
  Settings2Icon,
} from "lucide-react";
import { useId } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Xem bảng điểm vòng + bảng tổng và chờ chủ phòng bấm tiếp — ước chừng, không có hằng số. */
const RESULTS_AND_HOST_MS = 30_000;
const AVG_GAME_MS = GAME_IDS.reduce((sum, id) => sum + GAMES[id].durationMs, 0) / GAME_IDS.length;
/**
 * Ước lượng một vòng: quay chọn game + màn hướng dẫn (tối đa, rồi server tự bắt đầu) + đếm ngược
 * + thời lượng game trung bình + xem kết quả. Game 45 giây → khoảng 1,8 phút/vòng.
 */
const ROUND_ESTIMATE_MS =
  WHEEL_SPIN_LEAD_MS +
  WHEEL_SPIN_MS +
  WHEEL_RESULT_HOLD_MS +
  INTRO_AUTO_START_MS +
  COUNTDOWN_MS +
  AVG_GAME_MS +
  RESULTS_AND_HOST_MS;
const toMinutes = (ms: number) => Math.max(1, Math.round(ms / 60_000));

interface MatchSetupCardProps {
  rounds: number;
  /** Bỏ trống = thẻ chỉ đọc (người chơi thường) */
  onRoundsChange?(rounds: number): void;
  minPlayers: number;
  players: number;
  ready: number;
  onStart?(): void;
  /** Đã bấm "Bắt đầu", đang chờ server đổi pha: chỉ hiện spinner, nút không tắt (tránh nháy/mất focus). */
  pending?: boolean;
  /** Hàng bật/tắt chat cả phòng (CR-011), chỉ thẻ của chủ phòng có. */
  chatSetting?: React.ReactNode;
  className?: string;
}

/**
 * Thẻ "Thiết lập trận" ở phòng chờ: số vòng, thời lượng ước tính, điều kiện bắt đầu, nút Bắt đầu.
 * Chủ phòng chỉnh được; người chơi thường thấy bản chỉ đọc.
 */
export function MatchSetupCard({
  rounds,
  onRoundsChange,
  minPlayers,
  players,
  ready,
  onStart,
  pending = false,
  chatSetting,
  className,
}: MatchSetupCardProps) {
  const { t } = useTranslation();
  const hintId = useId();
  const editable = !!onRoundsChange;
  const enoughPlayers = players >= minPlayers;
  const allReady = ready === players;
  const canStart = enoughPlayers && allReady;

  const hint = !onStart
    ? t("lobby.setup.waitHost")
    : !enoughPlayers
      ? t("lobby.setup.needPlayers", { min: minPlayers })
      : allReady
        ? t("lobby.setup.allReady")
        : t("lobby.setup.waitReady", { ready, total: players });

  return (
    <Card className={cn("gap-3 rounded-3xl border-4 px-5 py-4.5", className)}>
      <div className="flex items-center gap-2.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border-[3px] border-sticker bg-primary text-primary-foreground">
          <Settings2Icon aria-hidden className="size-5" strokeWidth={2.6} />
        </span>
        <h2 className="font-display text-[23px] leading-none font-extrabold whitespace-nowrap">
          {t("lobby.setup.title")}
        </h2>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-secondary-foreground">
          <CrownIcon aria-hidden className="size-3" strokeWidth={2.8} />
          {t("lobby.host")}
        </span>
      </div>

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-2 text-[15px] font-bold">{t("lobby.setup.rounds")}</legend>
        <div className="flex items-center gap-3">
          {editable && (
            <Button
              variant="outline"
              size="icon"
              className="size-14"
              aria-label={t("lobby.setup.fewer")}
              disabled={rounds <= MIN_TOTAL_ROUNDS}
              onClick={() => onRoundsChange?.(Math.max(MIN_TOTAL_ROUNDS, rounds - 1))}
            >
              <MinusIcon aria-hidden className="size-6" strokeWidth={3} />
            </Button>
          )}
          <output
            aria-live="polite"
            className="flex h-16 flex-1 items-baseline justify-center gap-1.5 rounded-2xl border-[3.5px] border-sticker bg-card pt-0.5"
          >
            <span className="font-display text-[44px] leading-[1.2] font-extrabold tabular-nums">
              {rounds}
            </span>
            <span className="text-[15px] font-semibold">
              {t("lobby.setup.roundsUnit", { count: rounds })}
            </span>
          </output>
          {editable && (
            <Button
              variant="outline"
              size="icon"
              className="size-14"
              aria-label={t("lobby.setup.more")}
              disabled={rounds >= MAX_TOTAL_ROUNDS}
              onClick={() => onRoundsChange?.(Math.min(MAX_TOTAL_ROUNDS, rounds + 1))}
            >
              <PlusIcon aria-hidden className="size-6" strokeWidth={3} />
            </Button>
          )}
        </div>
        <span className="text-[13.5px] leading-snug text-muted-foreground">
          {t("lobby.setup.roundsHint", {
            perRound: toMinutes(ROUND_ESTIMATE_MS),
            min: MIN_TOTAL_ROUNDS,
            max: MAX_TOTAL_ROUNDS,
          })}
        </span>
      </fieldset>

      <div className="border-t-[2.5px] border-dashed border-sticker/30" />
      <dl className="flex flex-col gap-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t("lobby.setup.duration")}</dt>
          <dd className="text-right font-bold">
            {t("lobby.setup.durationValue", { minutes: toMinutes(rounds * ROUND_ESTIMATE_MS) })}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t("lobby.setup.pickGame")}</dt>
          <dd className="text-right font-bold">{t("lobby.setup.pickGameValue")}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t("lobby.setup.startWhen")}</dt>
          <dd className="text-right font-bold">
            {t("lobby.setup.startWhenValue", { min: minPlayers })}
          </dd>
        </div>
      </dl>

      {chatSetting && (
        <>
          <div className="border-t-[2.5px] border-dashed border-sticker/30" />
          {chatSetting}
        </>
      )}

      <div className="flex-1" />
      {onStart && (
        <Button
          size="lg"
          className="min-h-16 rounded-[18px] border-4 text-[26px]"
          disabled={!canStart}
          aria-busy={pending || undefined}
          aria-describedby={hintId}
          data-sfx="confirm"
          onClick={onStart}
        >
          {t("lobby.start")}
          {pending ? (
            <LoaderCircleIcon aria-hidden className="size-6 motion-safe:animate-spin" />
          ) : (
            <PlayIcon aria-hidden className="size-6 fill-current" />
          )}
        </Button>
      )}
      <p
        id={hintId}
        className="flex items-center justify-center gap-1.5 text-center text-sm font-semibold text-muted-foreground"
      >
        {onStart && canStart ? (
          <CheckIcon aria-hidden className="size-4 shrink-0" strokeWidth={3} />
        ) : (
          <HourglassIcon aria-hidden className="size-4 shrink-0" />
        )}
        {hint}
      </p>
    </Card>
  );
}

/** Thẻ gọn cho người chơi thường trên điện thoại: chủ phòng đang thiết lập mấy vòng. */
export function HostStatusCard({
  hostName,
  rounds,
  className,
}: {
  hostName: string;
  rounds: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex min-h-12.5 items-center gap-2.5 rounded-2xl border-[3px] border-sticker bg-card px-3 py-2 text-card-foreground shadow-sticker-sm",
        className,
      )}
    >
      <Settings2Icon aria-hidden className="size-5 shrink-0" strokeWidth={2.6} />
      <span className="text-sm leading-snug">
        <Trans
          i18nKey="lobby.setup.hostSetting"
          count={rounds}
          values={{ name: hostName }}
          components={{ b: <strong /> }}
        />
      </span>
    </div>
  );
}
