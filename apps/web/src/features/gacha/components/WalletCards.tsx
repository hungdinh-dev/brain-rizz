import {
  BRAIN_CHALK,
  DAILY_BONUS,
  GACHA_PRICE_SINGLE,
  PARTY_CHALK,
  PRACTICE_CHALK,
} from "@brain-rizz/shared";
import {
  BrainIcon,
  CheckIcon,
  GiftIcon,
  type LucideIcon,
  PartyPopperIcon,
  RotateCwIcon,
  TargetIcon,
  TriangleAlertIcon,
  UnplugIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ChalkChip } from "@/components/common/ChalkChip";
import { RarityBadge } from "@/components/common/RarityBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Wallet } from "@/net/gacha-api";
import { pityBars } from "../pulls";

/** Thẻ giấy nhỏ của màn Máy quay (viền mực 3, bóng nhãn dán). */
export function GachaCard({ className, children, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "flex flex-col gap-2.5 rounded-[18px] border-[3px] border-sticker bg-card px-3.5 py-3 text-card-foreground shadow-sticker-sm",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

/** Bảo hiểm (hiện thường trực): hai thanh `since / max` + luật gói 10. */
export function PityCard({ wallet, loading }: { wallet: Wallet | null; loading: boolean }) {
  const { t } = useTranslation();
  const bars = pityBars(wallet?.sinceEpic ?? 0, wallet?.sinceLegendary ?? 0);
  return (
    <GachaCard aria-labelledby="gacha-pity-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="gacha-pity-title" className="font-display text-lg leading-none font-extrabold">
          {t("gacha.pity.title")}
        </h2>
        {wallet && (
          <span className="text-xs text-muted-foreground">
            {t("gacha.pity.total", { count: wallet.totalPulls })}
          </span>
        )}
      </div>
      {loading || !wallet ? (
        <>
          <Skeleton className="h-8.5" />
          <Skeleton className="h-8.5" />
        </>
      ) : (
        bars.map((bar) => {
          const name = t(bar.rarity === "epic" ? "gacha.pity.epic" : "gacha.pity.legendary");
          return (
            <div key={bar.rarity} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1 text-[12.5px] font-semibold">
                <span className="flex items-center gap-1.5">
                  <RarityBadge rarity={bar.rarity} label={name} size="xs" />
                  {name}
                </span>
                <span>
                  <Trans
                    i18nKey="gacha.pity.within"
                    count={bar.left}
                    components={{ b: <b className="font-display text-base" /> }}
                  />
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={t("gacha.pity.barLabel", {
                  name,
                  since: bar.since,
                  max: bar.max,
                  left: bar.left,
                })}
                aria-valuenow={bar.since}
                aria-valuemin={0}
                aria-valuemax={bar.max}
                className="relative h-3 overflow-hidden rounded-full border-[2.5px] border-sticker bg-muted"
              >
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 border-sticker",
                    bar.since > 0 && "border-r-[2.5px]",
                    bar.rarity === "epic" ? "bg-rarity-epic" : "bg-rarity-legendary",
                  )}
                  style={{ width: `${(bar.since / bar.max) * 100}%` }}
                />
              </div>
            </div>
          );
        })
      )}
      <p className="text-[12.5px] text-muted-foreground">{t("gacha.pity.tenRare")}</p>
    </GachaCard>
  );
}

function EarnRow({
  icon: Icon,
  tone,
  title,
  hint,
  children,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  hint: string;
  children?: ReactNode;
}) {
  return (
    <li className="flex min-h-11 items-center gap-2.5">
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl border-[2.5px] border-ink text-ink",
          tone,
        )}
      >
        <Icon aria-hidden className="size-4.5" strokeWidth={2.4} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-sm font-bold">{title}</span>
        <span className="text-[12.5px] text-muted-foreground">{hint}</span>
      </span>
      {children}
    </li>
  );
}

interface EarnCardProps {
  balance: number;
  dailyClaimed: boolean;
  claiming: boolean;
  onClaim(): void;
  onParty(): void;
  onPractice(): void;
}

/** Thiếu phấn: cần thêm bao nhiêu + 4 nguồn kiếm phấn (số đọc từ economy.ts) + lối đi chơi. */
export function EarnCard({
  balance,
  dailyClaimed,
  claiming,
  onClaim,
  onParty,
  onPractice,
}: EarnCardProps) {
  const { t } = useTranslation();
  const need = Math.max(1, GACHA_PRICE_SINGLE - balance);
  return (
    <GachaCard aria-labelledby="gacha-earn-title">
      <p className="flex items-center gap-2 text-sm font-bold">
        <ChalkChip tone="card" size="sm" srLabel={t("gacha.chalk")}>
          {need}
        </ChalkChip>
        {t("gacha.earn.need", { count: need })}
      </p>
      <h2 id="gacha-earn-title" className="font-display text-lg leading-none font-extrabold">
        {t("gacha.earn.title")}
      </h2>
      <ul className="flex flex-col gap-1">
        <EarnRow
          icon={PartyPopperIcon}
          tone="bg-mint"
          title={t("gacha.earn.party")}
          hint={t("gacha.earn.partyHint", {
            base: PARTY_CHALK.base,
            perRound: PARTY_CHALK.perRound,
          })}
        />
        <EarnRow
          icon={BrainIcon}
          tone="bg-pink"
          title={t("gacha.earn.brain")}
          hint={t("gacha.earn.brainHint", { base: BRAIN_CHALK.base, per: BRAIN_CHALK.perPoints })}
        />
        <EarnRow
          icon={TargetIcon}
          tone="bg-sun"
          title={t("gacha.earn.practice")}
          hint={t("gacha.earn.practiceHint", { amount: PRACTICE_CHALK })}
        />
        <EarnRow
          icon={GiftIcon}
          tone="bg-sky"
          title={t("gacha.earn.daily")}
          hint={t("gacha.earn.dailyHint", { amount: DAILY_BONUS })}
        >
          {dailyClaimed ? (
            <span className="flex shrink-0 items-center gap-1 text-[13px] font-bold text-muted-foreground">
              <CheckIcon aria-hidden className="size-4 text-highlight" strokeWidth={3} />
              {t("gacha.earn.claimed")}
            </span>
          ) : (
            <Button
              size="sm"
              className="h-11 shrink-0 px-3.5 text-base"
              disabled={claiming}
              aria-label={t("gacha.earn.claimAria", { amount: DAILY_BONUS })}
              onClick={onClaim}
            >
              {t("gacha.earn.claim")}
            </Button>
          )}
        </EarnRow>
      </ul>
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="outline" className="min-h-11 text-base" onClick={onParty}>
          <PartyPopperIcon aria-hidden />
          {t("gacha.earn.playParty")}
        </Button>
        <Button variant="outline" className="min-h-11 text-base" onClick={onPractice}>
          <TargetIcon aria-hidden />
          {t("gacha.earn.practiceCta")}
        </Button>
      </div>
      <p className="text-[12.5px] text-muted-foreground">{t("gacha.earn.caps")}</p>
    </GachaCard>
  );
}

/** Chưa kết nối máy chủ dữ liệu (thiếu cấu hình / DB chưa có máy quay): ổ cắm + Thử lại. */
export function OfflineCard({ onRetry }: { onRetry(): void }) {
  const { t } = useTranslation();
  return (
    <GachaCard role="status" className="items-center gap-2 px-4 py-4 text-center">
      <span className="grid size-14 place-items-center rounded-full border-[3px] border-dashed border-muted-foreground">
        <UnplugIcon aria-hidden className="size-7" strokeWidth={2.3} />
      </span>
      <h2 className="mt-1 font-display text-xl leading-tight font-extrabold">
        {t("gacha.offline.title")}
      </h2>
      <p className="max-w-90 text-sm text-muted-foreground">{t("gacha.offline.body")}</p>
      <Button variant="outline" className="mt-1 min-h-11 text-base" onClick={onRetry}>
        <RotateCwIcon aria-hidden />
        {t("common.retry")}
      </Button>
    </GachaCard>
  );
}

/**
 * Lỗi + Thử lại: lượt quay chưa nhận được kết quả (mạng / hết giờ chờ — Thử lại không trừ thêm
 * phấn), hoặc chưa tải được ví. `busy`: Thử lại đang đọc lại ví → nút tắt.
 */
export function PullErrorCard({
  message,
  busy = false,
  onRetry,
}: {
  message: string;
  busy?: boolean;
  onRetry(): void;
}) {
  const { t } = useTranslation();
  return (
    <GachaCard role="alert" className="flex-row items-center gap-2.5 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl border-[2.5px] border-ink bg-pink text-ink">
        <TriangleAlertIcon aria-hidden className="size-4.5" strokeWidth={2.4} />
      </span>
      <p className="min-w-0 flex-1 text-sm font-semibold">{message}</p>
      <Button
        variant="outline"
        size="sm"
        className="h-11 shrink-0 px-3 text-sm"
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={onRetry}
      >
        <RotateCwIcon aria-hidden className={cn(busy && "motion-safe:animate-spin")} />
        {t("common.retry")}
      </Button>
    </GachaCard>
  );
}
