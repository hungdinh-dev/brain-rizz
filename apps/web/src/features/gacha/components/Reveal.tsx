import { ChevronsRightIcon, ShirtIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessoryIcon } from "@/components/characters";
import { ChalkChip } from "@/components/common/ChalkChip";
import { RarityBadge } from "@/components/common/RarityBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useNumberFormat } from "@/hooks/use-number-format";
import { cn } from "@/lib/utils";
import type { PullBatch, PullResult } from "@/net/gacha-api";
import { summarizePulls } from "../pulls";
import { CapsuleIcon } from "./GachaMachine";

/** Gói 10: cứ 420 ms mở một viên. Một lượt: viên nang lắc 900 ms rồi bật. */
const STEP_MS = 420;
const SINGLE_MS = 900;

interface RevealProps {
  batch: PullBatch;
  /** Máy tính: hộp thoại trên lớp phủ; điện thoại: thay nội dung màn (giữ tiêu đề). */
  desktop: boolean;
  /** Giảm chuyển động: hiện thẳng mọi món, không lắc, không tia xoay. */
  reduced: boolean;
  /** Đã mở hết (tự mở xong hoặc bấm "Mở hết"): màn cộng phấn trùng vào số dư. */
  onOpenedAll(): void;
  onTryOn(item: PullResult): void;
  onDone(): void;
  /**
   * Máy tính: hộp thoại đóng → trả tiêu điểm về nút quay (mở không qua DialogTrigger nên Radix không
   * tự trả, tiêu điểm rơi về <body>). Điện thoại: màn tự đưa tiêu điểm về khi nút quay hiện lại.
   */
  onCloseAutoFocus?(event: Event): void;
  tryOnItem: PullResult | undefined;
}

/** Màn mở quà (ui-ux 6.12 "Mở quà"): viên nang giống hệt nhau, mở lần lượt, sáng theo độ hiếm. */
export function Reveal({
  batch,
  desktop,
  reduced,
  onOpenedAll,
  onTryOn,
  onDone,
  onCloseAutoFocus,
  tryOnItem,
}: RevealProps) {
  const { t } = useTranslation();
  const total = batch.results.length;
  const [opened, setOpened] = useState(reduced ? total : 0);
  const done = opened >= total;

  // Mỗi viên mở xong hẹn viên kế tiếp (`opened` đổi → hẹn lại).
  useEffect(() => {
    if (done) return;
    const timer = window.setTimeout(
      () => setOpened(Math.min(total, opened + 1)),
      total === 1 ? SINGLE_MS : STEP_MS,
    );
    return () => window.clearTimeout(timer);
  }, [done, total, opened]);

  const reported = useRef(false);
  useEffect(() => {
    if (done && !reported.current) {
      reported.current = true;
      onOpenedAll();
    }
  }, [done, onOpenedAll]);

  const single = total === 1;
  const body = single ? (
    <SingleReveal
      result={batch.results[0] as PullResult}
      opened={done}
      reduced={reduced}
      desktop={desktop}
    />
  ) : (
    <ol
      aria-label={t("gacha.reveal.title")}
      className={cn("grid gap-2.5", desktop ? "grid-cols-5 gap-3.5" : "grid-cols-2")}
    >
      {batch.results.map((result, i) => (
        <RevealTile
          // biome-ignore lint/suspicious/noArrayIndexKey: thứ tự lượt cố định, một món có thể ra hai lần
          key={i}
          result={result}
          state={i < opened ? "open" : i === opened ? "next" : "wait"}
          reduced={reduced}
          desktop={desktop}
        />
      ))}
    </ol>
  );

  const progress = t("gacha.reveal.progress", { total, opened });
  const skip = !done && (
    <Button
      variant={desktop ? "outline" : "chalk"}
      className={cn("min-h-11 px-3.5 text-sm", !desktop && "h-11")}
      onClick={() => setOpened(total)}
    >
      <ChevronsRightIcon aria-hidden />
      {t("gacha.reveal.openAll")}
    </Button>
  );
  const footer = done && (
    <RevealFooter
      batch={batch}
      desktop={desktop}
      single={single}
      onTryOn={tryOnItem ? () => onTryOn(tryOnItem) : undefined}
      onDone={onDone}
    />
  );

  if (desktop) {
    return (
      <Dialog open onOpenChange={(open) => !open && onDone()}>
        <DialogContent
          onCloseAutoFocus={onCloseAutoFocus}
          className={cn(
            "gap-4 px-7 py-6",
            single ? "max-w-[520px] items-center" : "max-w-[1000px]",
            reduced && "duration-300",
          )}
        >
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <DialogTitle className="text-[32px]">{t("gacha.reveal.title")}</DialogTitle>
              <DialogDescription aria-live="polite" className="text-[13px]">
                {progress}
              </DialogDescription>
            </div>
            {skip}
          </div>
          {body}
          {footer}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <PhoneReveal progress={progress} skip={skip} reduced={reduced} single={single}>
      {body}
      {footer}
    </PhoneReveal>
  );
}

function PhoneReveal({
  progress,
  skip,
  reduced,
  single,
  children,
}: {
  progress: string;
  skip: React.ReactNode;
  reduced: boolean;
  single: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  // Nội dung màn đổi hẳn: đưa tiêu điểm tới tiêu đề để trình đọc màn hình đọc từ đầu.
  useEffect(() => heading.current?.focus(), []);
  return (
    <section
      aria-labelledby="gacha-reveal-title"
      className={cn("flex flex-1 flex-col gap-3", reduced && "animate-in duration-300 fade-in-0")}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2
            id="gacha-reveal-title"
            ref={heading}
            tabIndex={-1}
            className="font-display text-[28px] leading-none font-extrabold text-chalk outline-none"
          >
            {t("gacha.reveal.title")}
          </h2>
          <span aria-live="polite" className="text-[13px] text-chalk-muted">
            {progress}
          </span>
        </div>
        {skip}
      </div>
      <div className={cn("flex flex-1 flex-col gap-3", single && "items-center justify-center")}>
        {children}
      </div>
    </section>
  );
}

/** Quầng màu độ hiếm + tia (Sử thi, Huyền thoại) + món + hạt ◆ ở góc. */
function OpenedItem({
  result,
  glow,
  item,
  reduced,
  badge = true,
}: {
  result: PullResult;
  glow: number;
  item: number;
  reduced: boolean;
  badge?: boolean;
}) {
  const { t } = useTranslation();
  const rays = result.rarity === "epic" || result.rarity === "legendary";
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full",
        `gacha-glow-${result.rarity}`,
        !reduced && "fx-gacha-pop",
      )}
      style={{ width: glow, height: glow }}
    >
      {rays && (
        <span
          aria-hidden
          className={cn("gacha-rays", `gacha-rays-${result.rarity}`, !reduced && "fx-gacha-rays")}
        />
      )}
      <AccessoryIcon id={result.itemId} size={item} animated={!reduced} className="relative" />
      {badge && (
        <RarityBadge
          rarity={result.rarity}
          label={t(`gacha.rarity.${result.rarity}`)}
          size="xs"
          className="absolute -top-1 -left-1"
        />
      )}
    </span>
  );
}

function NewChip({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit items-center rounded-full border-2 border-ink bg-mint px-1.5 font-display text-xs leading-none font-extrabold whitespace-nowrap text-ink",
        className,
      )}
    >
      <span aria-hidden>{t("gacha.reveal.new")}</span>
      <span className="sr-only">{t("gacha.reveal.newAria")}</span>
    </span>
  );
}

function RefundChip({
  amount,
  long = false,
  className,
}: {
  amount: number;
  long?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  return (
    <span className={cn("inline-flex", className)}>
      <span className="sr-only">{t("gacha.reveal.dupAria", { count: amount })}</span>
      <span aria-hidden className="inline-flex">
        <ChalkChip
          tone="reward"
          size={long ? "md" : "sm"}
          className={long ? undefined : "h-5.5 px-1.5 text-[13px]"}
        >
          {long ? t("gacha.reveal.dupLong", { amount: fmt(amount) }) : `+${fmt(amount)}`}
        </ChalkChip>
      </span>
    </span>
  );
}

function RevealTile({
  result,
  state,
  reduced,
  desktop,
}: {
  result: PullResult;
  state: "open" | "next" | "wait";
  reduced: boolean;
  desktop: boolean;
}) {
  const { t } = useTranslation();
  const name = t(`gacha.items.${result.itemId}`);
  const glow = desktop ? 112 : 58;
  return (
    <li
      className={cn(
        "flex rounded-2xl border-[3px] border-sticker bg-card text-card-foreground shadow-sticker-sm",
        desktop
          ? "h-[214px] flex-col items-center justify-start gap-2 px-2 pt-3.5 pb-2.5 text-center"
          : "h-[76px] items-center gap-2 px-2",
      )}
    >
      {state === "open" ? (
        <>
          <OpenedItem result={result} glow={glow} item={desktop ? 84 : 44} reduced={reduced} />
          <span
            className={cn("flex min-w-0 flex-col gap-1", desktop ? "items-center" : "items-start")}
          >
            <span className={cn("leading-tight font-bold", desktop ? "text-sm" : "text-[13px]")}>
              <span className="sr-only">
                {t("gacha.reveal.itemLabel", {
                  name,
                  rarity: t(`gacha.rarity.${result.rarity}`),
                })}
              </span>
              <span aria-hidden>{name}</span>
            </span>
            {result.duplicate ? <RefundChip amount={result.refund} /> : <NewChip />}
          </span>
        </>
      ) : (
        <>
          <span className="grid shrink-0 place-items-center" style={{ width: glow, height: glow }}>
            <CapsuleIcon size={desktop ? 92 : 46} wobble={state === "next" && !reduced} />
          </span>
          <span className="text-[13px] font-bold text-muted-foreground">
            {state === "next" ? t("gacha.reveal.opening") : t("gacha.reveal.waiting")}
          </span>
        </>
      )}
    </li>
  );
}

function SingleReveal({
  result,
  opened,
  reduced,
  desktop,
}: {
  result: PullResult;
  opened: boolean;
  reduced: boolean;
  desktop: boolean;
}) {
  const { t } = useTranslation();
  const glow = desktop ? 260 : 270;
  if (!opened) {
    return (
      <div className="grid place-items-center" style={{ width: glow, height: glow }}>
        <CapsuleIcon size={150} wobble={!reduced} />
        <span className="sr-only">{t("gacha.reveal.opening")}</span>
      </div>
    );
  }
  const name = t(`gacha.items.${result.itemId}`);
  const rarity = t(`gacha.rarity.${result.rarity}`);
  return (
    <div className={cn("flex flex-col items-center gap-2.5 text-center", !desktop && "text-chalk")}>
      <OpenedItem result={result} glow={glow} item={160} reduced={reduced} badge={false} />
      <p className="font-display text-[32px] leading-none font-extrabold">{name}</p>
      <RarityBadge rarity={result.rarity} label={rarity} size="md" />
      {result.duplicate ? (
        <RefundChip amount={result.refund} long />
      ) : (
        <NewChip className="h-7 px-2.5 text-sm" />
      )}
      <p className={cn("text-sm", desktop ? "text-muted-foreground" : "text-chalk-muted")}>
        {t("gacha.reveal.stored")}
      </p>
    </div>
  );
}

function RevealFooter({
  batch,
  desktop,
  single,
  onTryOn,
  onDone,
}: {
  batch: PullBatch;
  desktop: boolean;
  single: boolean;
  onTryOn?(): void;
  onDone(): void;
}) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const summary = summarizePulls(batch.results);
  const done = useRef<HTMLButtonElement>(null);
  // Mở xong: tiêu điểm sang "Xong" (bấm Enter là về máy quay).
  useEffect(() => done.current?.focus({ preventScroll: true }), []);
  return (
    <div className={cn("mt-auto flex w-full flex-col gap-3", desktop && "mt-0")}>
      {!single && (
        <div
          role="status"
          className={cn(
            "flex flex-wrap items-center justify-between gap-2.5",
            desktop
              ? "border-t-[2.5px] border-dashed border-muted-foreground/35 pt-3.5"
              : "rounded-2xl border-[3px] border-sticker bg-card px-3 py-2.5 text-card-foreground shadow-sticker-sm",
          )}
        >
          <span className="text-sm leading-snug font-semibold">
            {summary.newCount > 0 && (
              <b>{t("gacha.reveal.summaryNew", { count: summary.newCount })}</b>
            )}
            {summary.newCount > 0 && summary.dupCount > 0 && " · "}
            {summary.dupCount > 0 && t("gacha.reveal.summaryDup", { count: summary.dupCount })}
          </span>
          {summary.refund > 0 && (
            <ChalkChip tone="reward" size="md" srLabel={t("gacha.chalk")}>
              +{fmt(summary.refund)}
            </ChalkChip>
          )}
        </div>
      )}
      <div
        className={cn(
          "flex gap-3",
          desktop ? "justify-end" : "w-full",
          single && desktop && "justify-center",
        )}
      >
        {onTryOn && (
          <Button
            variant="outline"
            className={cn("h-13 text-base", !desktop && "flex-1")}
            onClick={onTryOn}
          >
            <ShirtIcon aria-hidden />
            {t("gacha.reveal.tryOn")}
          </Button>
        )}
        <Button
          ref={done}
          className={cn("h-13 text-[22px]", desktop ? "w-45" : "flex-1")}
          onClick={onDone}
        >
          {t("gacha.reveal.done")}
        </Button>
      </div>
    </div>
  );
}
