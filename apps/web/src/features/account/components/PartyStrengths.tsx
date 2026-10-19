import { CATEGORIES } from "@brain-rizz/shared";
import { CrownIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CategoryChip } from "@/components/common/MatchChips";
import { Skeleton } from "@/components/ui/skeleton";
import { useNumberFormat } from "@/hooks/use-number-format";
import { cn } from "@/lib/utils";
import type { MatchRow } from "@/net/data-api";
import { type CategoryStrength, partyStrengths } from "../strengths";

const FRAME = "@container flex flex-col gap-2.5 rounded-[18px] border-[3px] p-3";

function Header() {
  const { t } = useTranslation();
  return (
    <header className="flex flex-col gap-0.5">
      <h3 className="font-display text-lg leading-tight font-extrabold">
        {t("account.strengthsTitle")}
      </h3>
      <p className="text-xs text-muted-foreground">{t("account.strengthsNote")}</p>
    </header>
  );
}

/** Khung giữ chỗ lúc đang tải: cùng kích thước thẻ thật. */
export function PartyStrengthsLoading() {
  return (
    <div aria-hidden className={cn(FRAME, "border-sticker bg-muted")}>
      <Header />
      <div className="grid gap-2 @2xl:grid-cols-5">
        {CATEGORIES.map((c) => (
          <Skeleton key={c} className="h-12.5 w-full @2xl:h-27" />
        ))}
      </div>
    </div>
  );
}

/**
 * Thẻ "Thế mạnh trong trận party" đầu tab Trận party (CR-010, ui-ux 6.4): mỗi thể loại số danh
 * hiệu giỏi nhất, điểm vòng trung bình và số trận có chơi; ô "Mạnh nhất" có nhãn. Khung rộng
 * (≥ 672 px, container query) xếp 5 ô một hàng; hẹp hơn thì 5 hàng.
 */
export function PartyStrengths({ rows }: { rows: readonly MatchRow[] }) {
  const { t } = useTranslation();
  const { rows: strengths, top, hasData } = partyStrengths(rows);

  if (!hasData) {
    return (
      <div className={cn(FRAME, "flex-row items-center gap-3 border-dashed border-sticker")}>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border-[3px] border-sticker bg-primary">
          <CrownIcon aria-hidden className="size-5.5 text-ink" strokeWidth={2.4} />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="font-display text-base leading-tight font-extrabold">
            {t("account.strengthsTitle")}
          </span>
          <span className="text-[13px] text-muted-foreground">{t("account.strengthsEmpty")}</span>
        </span>
      </div>
    );
  }

  return (
    <section
      aria-label={t("account.strengthsTitle")}
      className={cn(FRAME, "border-sticker bg-muted")}
    >
      <Header />
      <ul className="grid gap-2 pt-1 @2xl:grid-cols-5">
        {strengths.map((row) => (
          <StrengthCell key={row.category} row={row} top={row.category === top} />
        ))}
      </ul>
    </section>
  );
}

function StrengthCell({ row, top }: { row: CategoryStrength; top: boolean }) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const cell =
    "relative flex min-h-12.5 items-center gap-2.5 rounded-[14px] border-[3px] px-2.5 py-1.5 @2xl:min-h-27 @2xl:flex-col @2xl:items-start @2xl:justify-center @2xl:gap-1.5 @2xl:p-2.5";
  const chip = <CategoryChip category={row.category} className="w-23 justify-center @2xl:w-auto" />;

  if (row.matches === 0) {
    return (
      <li className={cn(cell, "border-dashed border-muted-foreground")}>
        {chip}
        <span className="text-[13px] font-semibold text-muted-foreground">
          {t("account.notPlayed")}
        </span>
      </li>
    );
  }

  return (
    <li className={cn(cell, "border-sticker", top ? "bg-primary/30" : "bg-card")}>
      {top && (
        <span className="absolute -top-2.5 right-2 rounded-full border-2 border-sticker bg-primary px-2 text-[11px] leading-4 font-bold text-ink">
          {t("account.topSkill")}
        </span>
      )}
      {chip}
      <span className="flex flex-1 items-center gap-1 text-[13px] font-bold @2xl:flex-none">
        <CrownIcon
          aria-hidden
          className={cn(
            "size-5 shrink-0",
            row.titles > 0 ? "fill-primary text-sticker" : "text-muted-foreground",
          )}
          strokeWidth={2.2}
        />
        {t("account.titles", { count: row.titles })}
      </span>
      <span className="flex flex-col items-end text-right @2xl:items-start @2xl:text-left">
        <span className="font-display text-base leading-tight font-extrabold tabular-nums">
          <span className="@2xl:hidden">{t("account.avgShort", { n: fmt(row.avg) })}</span>
          <span className="hidden @2xl:inline">{t("account.avgPoints", { n: fmt(row.avg) })}</span>
        </span>
        <span className="text-xs text-muted-foreground">
          <span className="@2xl:hidden">{t("account.matchesShort", { count: row.matches })}</span>
          <span className="hidden @2xl:inline">
            {t("account.inMatches", { count: row.matches })}
          </span>
        </span>
      </span>
    </li>
  );
}
