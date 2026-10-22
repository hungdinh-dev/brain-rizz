import { type BotLevel, botDifficulty, MAX_PLAYERS, type RoomBotsOption } from "@brain-rizz/shared";
import {
  ArrowRightIcon,
  BotIcon,
  LoaderCircleIcon,
  MinusIcon,
  PlusIcon,
  RefreshCwIcon,
  WifiOffIcon,
} from "lucide-react";
import { useId, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { BotBadge } from "@/components/characters";
import { BotLevelPicker } from "@/components/common/BotLevel";
import { DifficultyChip } from "@/components/common/MatchChips";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { playSfx } from "@/features/sfx";
import {
  BOT_COUNT_MAX,
  BOT_COUNT_MIN,
  DEFAULT_BOT_SETUP,
  freeSeats,
  previewBotFaces,
  type SeatFace,
  toBotsOption,
} from "../bot-setup";

type Status = "idle" | "creating" | "error";

interface BotDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Nhân vật của mình (ghế đầu trong dải ghế minh hoạ). */
  me: SeatFace;
  /**
   * Tạo phòng party kèm bot rồi vào thẳng phòng chờ. Ném lỗi = chưa tạo được phòng (hộp thoại hiện
   * lỗi và nút Thử lại). `signal` bị huỷ khi người chơi đóng hộp thoại giữa chừng.
   */
  onStart(bots: RoomBotsOption, signal: AbortSignal): Promise<void>;
}

/**
 * Hộp thoại "Chơi với máy" (S17, CR-016, ui-ux 6.6): số bot 1–7 (mặc định 3) và một mức chung
 * (mặc định Vừa). "Vào phòng" tạo phòng party bình thường (vẫn có mã) kèm bot. Vào phòng chờ rồi
 * vẫn chỉnh từng bot. Mở ra thì focus vào nút chính: một chạm là chơi với mặc định.
 */
export function BotDialog({ open, onOpenChange, me, onStart }: BotDialogProps) {
  const { t } = useTranslation();
  const [count, setCount] = useState(DEFAULT_BOT_SETUP.count);
  const [level, setLevel] = useState<BotLevel>(DEFAULT_BOT_SETUP.level);
  const [status, setStatus] = useState<Status>("idle");
  const abortRef = useRef<AbortController | null>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const countId = useId();
  const busy = status === "creating";

  function changeOpen(next: boolean) {
    if (!next) {
      // Đóng giữa lúc đang tạo = huỷ: phòng tạo xong thì rời ngay (connection.createParty).
      abortRef.current?.abort();
      abortRef.current = null;
      setStatus("idle");
    }
    onOpenChange(next);
  }

  async function submit() {
    if (busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("creating");
    try {
      await onStart(toBotsOption(count, level), controller.signal);
      // Thành công: màn menu đóng theo khi vào phòng chờ.
      if (!controller.signal.aborted) setStatus("idle");
    } catch {
      if (controller.signal.aborted) return;
      playSfx("error");
      setStatus("error");
    }
  }

  const free = freeSeats(count);

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        closeLabel={t("bots.close")}
        className="max-w-120 gap-4 sm:p-6"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          startRef.current?.focus();
        }}
      >
        <DialogHeader className="flex-row items-center gap-3 pr-11">
          <span className="grid size-12 shrink-0 -rotate-4 place-items-center rounded-2xl border-[3px] border-sticker bg-bot text-bot-foreground sm:size-13.5">
            <BotIcon aria-hidden className="size-6.5 sm:size-7.5" strokeWidth={2.3} />
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <DialogTitle className="sm:text-[30px]">{t("bots.dialogTitle")}</DialogTitle>
            <DialogDescription className="text-[13px] leading-snug sm:text-sm">
              {t("bots.dialogDesc")}
            </DialogDescription>
          </span>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span id={countId} className="text-[15px] font-bold">
              {t("bots.countLabel")}
            </span>
            <span className="text-[13px] text-muted-foreground">
              {t("bots.countRange", { min: BOT_COUNT_MIN, max: BOT_COUNT_MAX })}
            </span>
          </div>
          <fieldset aria-labelledby={countId} className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="size-13 sm:size-14"
              aria-label={t("bots.decrease")}
              disabled={busy || count <= BOT_COUNT_MIN}
              onClick={() => setCount((c) => Math.max(BOT_COUNT_MIN, c - 1))}
            >
              <MinusIcon aria-hidden className="size-6" strokeWidth={3} />
            </Button>
            <output
              aria-live="polite"
              className="flex h-15 flex-1 items-baseline justify-center gap-1.5 rounded-2xl border-[3.5px] border-sticker bg-card pt-0.5"
            >
              <span className="font-display text-[42px] leading-[1.2] font-extrabold tabular-nums">
                {count}
              </span>
              <span className="text-[15px] font-semibold">{t("bots.countUnit", { count })}</span>
            </output>
            <Button
              variant="outline"
              size="icon"
              className="size-13 sm:size-14"
              aria-label={t("bots.increase")}
              disabled={busy || count >= BOT_COUNT_MAX}
              onClick={() => setCount((c) => Math.min(BOT_COUNT_MAX, c + 1))}
            >
              <PlusIcon aria-hidden className="size-6" strokeWidth={3} />
            </Button>
          </fieldset>
          <SeatStrip me={me} count={count} />
          <p className="text-[13px] leading-snug text-muted-foreground">
            {free > 0
              ? t("bots.seatsFree", { count, free })
              : t("bots.seatsFull", { count, max: MAX_PLAYERS })}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="text-[15px] font-bold">{t("bots.levelLabel")}</span>
            <span className="text-[12.5px] text-muted-foreground">{t("bots.levelHint")}</span>
          </div>
          <BotLevelPicker
            value={level}
            onChange={setLevel}
            size="dialog"
            label={t("bots.levelLabel")}
            disabled={busy}
            className="grid-cols-4 gap-2 px-1.5 pt-1.5 pb-1 sm:gap-2.5"
          />
          <div
            aria-live="polite"
            className="flex flex-col gap-1.25 rounded-[14px] bg-muted px-3 py-2.5"
          >
            <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
              <Trans
                i18nKey="bots.playsAt"
                values={{ level: t(`bots.level.${level}`) }}
                components={{
                  b: (
                    <strong className="font-display text-[17px] leading-none font-extrabold text-card-foreground" />
                  ),
                  chip: <DifficultyChip difficulty={botDifficulty(level)} />,
                }}
              />
            </span>
            <span className="text-sm leading-snug">{t(`bots.levelDesc.${level}`)}</span>
          </div>
        </div>

        {status === "error" && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-[14px] border-[2.5px] border-destructive bg-destructive/10 px-3 py-2.5"
          >
            <WifiOffIcon aria-hidden className="mt-px size-5 shrink-0 text-destructive" />
            <span className="flex flex-col gap-0.5">
              <strong className="text-sm">{t("bots.errorTitle")}</strong>
              <span className="text-[13px] leading-snug text-muted-foreground">
                {t("bots.errorBody")}
              </span>
            </span>
          </div>
        )}

        <Button
          ref={startRef}
          size="lg"
          data-sfx="confirm"
          disabled={busy}
          className="min-h-14.5 rounded-[18px] border-4 text-2xl sm:min-h-15.5 sm:text-[26px]"
          onClick={() => void submit()}
        >
          {busy ? (
            <>
              <LoaderCircleIcon aria-hidden className="size-6 motion-safe:animate-spin" />
              <span role="status">{t("bots.creating")}</span>
            </>
          ) : status === "error" ? (
            <>
              {t("bots.retry")}
              <RefreshCwIcon aria-hidden className="size-6" />
            </>
          ) : (
            <>
              {t("bots.start")}
              <ArrowRightIcon aria-hidden className="size-6" strokeWidth={2.8} />
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** Dải 8 ghế minh hoạ: mình (vòng vàng), N bot (huy hiệu máy), còn lại vòng nét đứt. */
function SeatStrip({ me, count }: { me: SeatFace; count: number }) {
  const bots = previewBotFaces(me, count);
  const empty = Math.max(0, MAX_PLAYERS - 1 - bots.length);
  return (
    <div aria-hidden className="flex flex-wrap items-center gap-1.5 px-0.5 pt-1 sm:gap-2">
      <PlayerAvatar
        avatar={me.avatar}
        colorIndex={me.colorIndex}
        size="sm"
        className="shadow-[0_0_0_3px_var(--color-primary)]"
      />
      {bots.map((face, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: ghế minh hoạ, không có danh tính
          key={i}
          className="relative flex"
        >
          <PlayerAvatar avatar={face.avatar} colorIndex={face.colorIndex} size="sm" />
          <BotBadge size="xs" />
        </span>
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: ghế trống, không có danh tính
          key={`empty-${i}`}
          className="block size-8 rounded-full border-2 border-dashed border-muted-foreground"
        />
      ))}
    </div>
  );
}
