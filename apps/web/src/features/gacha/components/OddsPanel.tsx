import {
  COSMETIC_ITEMS,
  type CosmeticId,
  DUPLICATE_REFUND,
  GACHA_PITY,
  GACHA_RATES,
  RARITIES,
  type Rarity,
} from "@brain-rizz/shared";
import { CheckIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessoryIcon } from "@/components/characters";
import { ChalkChip } from "@/components/common/ChalkChip";
import { RarityBadge } from "@/components/common/RarityBadge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDateFormat } from "@/hooks/use-date-format";
import { cn } from "@/lib/utils";
import { fetchGachaHistory, type GachaHistoryRow } from "@/net/gacha-api";
import { itemShare, itemsOfRarity } from "../pulls";

/** Số phần trăm có tối đa 2 chữ số thập phân theo ngôn ngữ ("6,67" / "6.67"). */
function usePercentFormat() {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language;
  return useMemo(() => {
    const nf = new Intl.NumberFormat(lang, { maximumFractionDigits: 2 });
    return (value: number) => nf.format(value);
  }, [lang]);
}

/** 4 dòng "Tỉ lệ mỗi lượt": nhãn độ hiếm + % + số món, % mỗi món. */
export function RatesList({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const pct = usePercentFormat();
  return (
    <ul className="flex flex-col gap-2">
      {RARITIES.map((rarity) => (
        <li key={rarity} className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
          <RarityBadge
            rarity={rarity}
            label={t(`gacha.rarity.${rarity}`)}
            className={compact ? undefined : "min-w-28"}
          />
          <span className="font-display text-[22px] leading-none font-extrabold whitespace-nowrap tabular-nums">
            {t("gacha.rates.percent", { value: pct(GACHA_RATES[rarity]) })}
          </span>
          <span className="ml-auto text-right text-xs whitespace-nowrap text-muted-foreground">
            {t("gacha.rates.itemsShare", {
              count: itemsOfRarity(rarity),
              each: pct(itemShare(rarity)),
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="font-display text-lg leading-none font-extrabold">{children}</h3>;
}

function RulesSections() {
  const { t } = useTranslation();
  const rules = [
    t("gacha.rates.pityEpic", { count: GACHA_PITY.epic }),
    t("gacha.rates.pityLegendary", { count: GACHA_PITY.legendary }),
    t("gacha.rates.pityTen"),
    t("gacha.rates.legendaryFresh"),
  ];
  return (
    <>
      <section className="flex flex-col gap-2.5">
        <SectionTitle>{t("gacha.rates.perPull")}</SectionTitle>
        <RatesList />
      </section>
      <section className="flex flex-col gap-2">
        <SectionTitle>{t("gacha.rates.pityTitle")}</SectionTitle>
        <ul className="flex flex-col gap-1.5">
          {rules.map((rule) => (
            <li key={rule} className="flex items-start gap-2 text-sm">
              <CheckIcon
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-highlight"
                strokeWidth={3}
              />
              {rule}
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <SectionTitle>{t("gacha.rates.dupTitle")}</SectionTitle>
        <p className="text-sm">{t("gacha.rates.dupBody", { ...DUPLICATE_REFUND })}</p>
      </section>
    </>
  );
}

function ItemsSection({
  owned,
  desktop,
}: {
  owned: ReadonlySet<CosmeticId> | null;
  desktop: boolean;
}) {
  const { t } = useTranslation();
  const ownedCount = owned ? COSMETIC_ITEMS.filter((item) => owned.has(item.id)).length : 0;
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>
        {t("gacha.rates.items", { count: ownedCount, total: COSMETIC_ITEMS.length })}
      </SectionTitle>
      {RARITIES.map((rarity) => (
        <RarityGroup key={rarity} rarity={rarity} owned={owned} desktop={desktop} />
      ))}
    </section>
  );
}

function RarityGroup({
  rarity,
  owned,
  desktop,
}: {
  rarity: Rarity;
  owned: ReadonlySet<CosmeticId> | null;
  desktop: boolean;
}) {
  const { t } = useTranslation();
  const items = COSMETIC_ITEMS.filter((item) => item.rarity === rarity);
  const have = owned ? items.filter((item) => owned.has(item.id)).length : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <RarityBadge rarity={rarity} label={t(`gacha.rarity.${rarity}`)} />
        {owned && (
          <span className="text-xs text-muted-foreground">
            {t("gacha.rates.groupOwned", { owned: have, total: items.length })}
          </span>
        )}
      </div>
      <ul className={cn("grid gap-2.5", desktop ? "grid-cols-6" : "grid-cols-3")}>
        {items.map((item) => {
          const has = owned?.has(item.id) ?? false;
          return (
            <li
              key={item.id}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-[14px] border-[2.5px] border-sticker px-1 py-1.5 text-center",
                has ? "bg-muted" : "border-dashed",
              )}
            >
              <AccessoryIcon
                id={item.id}
                size={desktop ? 56 : 48}
                className={has ? undefined : "opacity-45 grayscale"}
              />
              <span className="text-xs leading-tight font-semibold">
                {t(`gacha.items.${item.id}`)}
              </span>
              <span className="sr-only">
                {has ? t("gacha.rates.owned") : t("gacha.rates.notOwned")}
              </span>
              {has && (
                <span
                  aria-hidden
                  className="absolute -top-2 -right-1.5 grid size-5.5 place-items-center rounded-full border-[2.5px] border-ink bg-compute text-ink"
                >
                  <CheckIcon className="size-3" strokeWidth={3.5} />
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type HistoryState =
  | { status: "loading" }
  | { status: "ok"; rows: GachaHistoryRow[] }
  | { status: "error" };

function HistorySection() {
  const { t } = useTranslation();
  const date = useDateFormat();
  const [state, setState] = useState<HistoryState>({ status: "loading" });
  useEffect(() => {
    let live = true;
    void fetchGachaHistory(30).then((res) => {
      if (!live) return;
      setState(
        res.ok
          ? { status: "ok", rows: res.data }
          : res.reason === "no-session"
            ? { status: "ok", rows: [] }
            : { status: "error" },
      );
    });
    return () => {
      live = false;
    };
  }, []);
  return (
    <section className="flex flex-col gap-2.5">
      <SectionTitle>{t("gacha.history.title")}</SectionTitle>
      {state.status === "loading" ? (
        <>
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </>
      ) : state.status === "error" ? (
        <p className="text-sm text-muted-foreground">{t("gacha.history.error")}</p>
      ) : state.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("gacha.history.empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y-2 divide-dashed divide-muted-foreground/25">
          {state.rows.map((row) => (
            <li key={row.id} className="flex min-h-11 items-center gap-2.5 py-1.5">
              <AccessoryIcon id={row.itemId} size={32} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {t(`gacha.items.${row.itemId}`)}
              </span>
              <RarityBadge rarity={row.rarity} label={t(`gacha.rarity.${row.rarity}`)} size="xs" />
              {row.duplicate ? (
                <ChalkChip tone="card" size="sm" srLabel={t("gacha.chalk")}>
                  +{row.refund}
                </ChalkChip>
              ) : (
                <span className="text-xs font-bold text-highlight">{t("gacha.reveal.new")}</span>
              )}
              <span className="w-11 text-right text-xs text-muted-foreground tabular-nums">
                {date.short(row.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface OddsPanelProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /**
   * Đóng sheet / hộp thoại → trả tiêu điểm về nút đã mở (mở không qua DialogTrigger nên Radix không
   * tự trả, tiêu điểm rơi về <body>). Gọi `event.preventDefault()` khi đã tự đưa tiêu điểm.
   */
  onCloseAutoFocus?(event: Event): void;
  desktop: boolean;
  /** Món đã có; `null` = chưa biết (chưa kết nối / chưa tải) → không đánh dấu có/chưa. */
  owned: readonly CosmeticId[] | null;
  /** Có ví (đã kết nối) → hiện lịch sử quay. */
  showHistory: boolean;
}

/**
 * "Tỉ lệ & 24 món" (ui-ux 6.12): tỉ lệ 4 độ hiếm, luật bảo hiểm, phấn trùng, đủ 24 món có/chưa có
 * (không giấu món nào), lịch sử quay. Điện thoại: sheet 92 % chiều cao; máy tính: hộp thoại
 * 1040 × 700, cột trái cố định, cột phải cuộn.
 */
export function OddsPanel({
  open,
  onOpenChange,
  onCloseAutoFocus,
  desktop,
  owned,
  showHistory,
}: OddsPanelProps) {
  const { t } = useTranslation();
  const ownedSet = useMemo(() => (owned ? new Set(owned) : null), [owned]);
  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          onCloseAutoFocus={onCloseAutoFocus}
          closeLabel={t("gacha.rates.close")}
          className="h-[min(700px,calc(100dvh-2rem))] max-w-[1040px] gap-0 overflow-hidden p-0"
        >
          <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)]">
            <div className="flex flex-col gap-5 overflow-y-auto border-r-[2.5px] border-dashed border-muted-foreground/30 px-6 py-6">
              <div className="flex flex-col gap-1">
                <DialogTitle>{t("gacha.rates.title")}</DialogTitle>
                <DialogDescription className="text-[13px]">
                  {t("gacha.noRealMoney")}
                </DialogDescription>
              </div>
              <RulesSections />
            </div>
            <div className="flex flex-col gap-6 overflow-y-auto px-6 pt-16 pb-6">
              <ItemsSection owned={ownedSet} desktop />
              {showHistory && open && <HistorySection />}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        onCloseAutoFocus={onCloseAutoFocus}
        closeLabel={t("gacha.rates.close")}
        className="h-[92dvh] gap-0"
      >
        <div className="px-4 pt-4 pb-3 pr-16">
          <SheetTitle>{t("gacha.rates.title")}</SheetTitle>
          <SheetDescription className="text-[13px]">{t("gacha.noRealMoney")}</SheetDescription>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
          <RulesSections />
          <ItemsSection owned={ownedSet} desktop={false} />
          {showHistory && open && <HistorySection />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
