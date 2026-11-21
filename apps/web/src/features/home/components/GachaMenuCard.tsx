import { DAILY_BONUS } from "@brain-rizz/shared";
import { CheckIcon, ChevronRightIcon, GiftIcon, ShirtIcon, UnplugIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ChalkChip } from "@/components/common/ChalkChip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useClaimDaily } from "@/hooks/use-claim-daily";
import { useNumberFormat } from "@/hooks/use-number-format";
import { useNav } from "@/stores/nav.store";
import { useWallet } from "@/stores/wallet.store";
import type { Profile } from "../profile";

/** Máy quay thu nhỏ trên nền bảng (trang trí thẻ menu, bản mẫu khu 32). */
function MiniMachine() {
  return (
    <span
      aria-hidden
      className="flex h-15 w-14 shrink-0 items-end justify-center overflow-hidden rounded-2xl border-[3px] border-ink bg-board"
    >
      <svg aria-hidden width="44" height="51" viewBox="0 0 80 92" className="shrink-0">
        <g stroke="#1f1b3a">
          <rect x="14" y="52" width="52" height="34" rx="8" fill="#f27d93" strokeWidth="3.5" />
          <circle cx="52" cy="72" r="8" fill="#ffd166" strokeWidth="3" />
          <rect x="20" y="66" width="18" height="14" rx="5" fill="#2a2540" strokeWidth="3" />
          <circle cx="40" cy="30" r="25" fill="rgba(255,255,255,.35)" stroke="none" />
          <path d="M26 40 A8 8 0 0 1 42 40 Z" fill="#8ec5ff" strokeWidth="2.5" />
          <path d="M26 40 A8 8 0 0 0 42 40 Z" fill="#fff8ef" strokeWidth="2.5" />
          <path d="M40 42 A8 8 0 0 1 56 42 Z" fill="#ffd166" strokeWidth="2.5" />
          <path d="M40 42 A8 8 0 0 0 56 42 Z" fill="#fff8ef" strokeWidth="2.5" />
          <path d="M32 26 A8 8 0 0 1 48 26 Z" fill="#c3a6ff" strokeWidth="2.5" />
          <path d="M32 26 A8 8 0 0 0 48 26 Z" fill="#fff8ef" strokeWidth="2.5" />
          <circle cx="40" cy="30" r="25" fill="none" strokeWidth="3.5" />
          <rect x="12" y="48" width="56" height="8" rx="4" fill="#7768ae" strokeWidth="3" />
          <rect x="34" y="2" width="12" height="6" rx="3" fill="#ffd166" strokeWidth="2.5" />
        </g>
        <path
          d="M24 18 C28 12 33 9 38 8"
          stroke="#ffffff"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/** Chip số dư phấn cạnh nút hồ sơ ở menu (chỉ khi đã có ví) → Máy quay. */
export function MenuChalkChip() {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const go = useNav((s) => s.go);
  const status = useWallet((s) => s.status);
  const balance = useWallet((s) => s.wallet?.balance ?? 0);
  if (status !== "ok") return null;
  return (
    <button
      type="button"
      aria-label={t("home.menu.gacha.balanceAria", { amount: fmt(balance) })}
      onClick={() => go("gacha")}
      className="shrink-0 cursor-pointer rounded-full transition-transform hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none active:translate-y-0.5"
    >
      <ChalkChip tone="board" size="lg">
        {fmt(balance)}
      </ChalkChip>
    </button>
  );
}

/**
 * Thẻ Máy quay phụ kiện ở menu (CR-023, ui-ux 6.12 "Menu"): link sang `/gacha`, nút nhận quà mỗi
 * ngày (+20) và nút Tủ đồ. Đã nhận → một dòng chữ nhẹ, không đếm giờ; chưa kết nối → "Cần máy chủ
 * dữ liệu". Không chấm đỏ, không nhắc.
 */
export function GachaMenuCard({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const go = useNav((s) => s.go);
  const status = useWallet((s) => s.status);
  const dailyClaimed = useWallet((s) => s.wallet?.dailyClaimed ?? false);
  const { claim, claiming } = useClaimDaily(profile);

  let daily: React.ReactNode;
  if (status === "offline") {
    daily = (
      <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <UnplugIcon aria-hidden className="size-4.5 shrink-0" strokeWidth={2.4} />
        {t("home.menu.gacha.offline")}
      </span>
    );
  } else if (status === "loading") {
    daily = <Skeleton className="h-11 w-44" />;
  } else if (dailyClaimed) {
    daily = (
      <span
        role="status"
        className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-muted-foreground"
      >
        <CheckIcon aria-hidden className="size-4.5 shrink-0 text-highlight" strokeWidth={3} />
        {t("home.menu.gacha.claimed")}
      </span>
    );
  } else {
    daily = (
      <Button
        className="h-11 min-h-11 gap-1.5 px-2.5 text-[15px]"
        disabled={claiming}
        aria-label={t("home.menu.gacha.claimAria", { amount: DAILY_BONUS })}
        onClick={() => void claim()}
      >
        <GiftIcon aria-hidden className="size-4.5" />
        {t("home.menu.gacha.claim")}
        <span className="flex h-6 items-center rounded-full border-2 border-ink bg-paper px-1.5 text-[13px] leading-none text-ink">
          +{DAILY_BONUS}
        </span>
      </Button>
    );
  }

  return (
    <section className="flex shrink-0 flex-col gap-2.5 rounded-[22px] border-[3.5px] border-sticker bg-card p-3 text-card-foreground shadow-sticker lg:border-4">
      <button
        type="button"
        onClick={() => go("gacha")}
        className="flex cursor-pointer items-center gap-3 rounded-2xl text-left focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <MiniMachine />
        <span className="flex min-w-0 flex-1 flex-col gap-0.75 leading-[1.15]">
          <span className="font-display text-[21px] leading-none font-extrabold lg:text-[22px]">
            {t("home.menu.gacha.title")}
          </span>
          <span className="text-[13px] text-muted-foreground">{t("home.menu.gacha.desc")}</span>
        </span>
        <ChevronRightIcon aria-hidden className="size-5 shrink-0" strokeWidth={2.8} />
      </button>
      <div aria-hidden className="border-t-[2.5px] border-dashed border-muted-foreground/30" />
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
        {daily}
        <Button
          variant="outline"
          className="ml-auto h-11 min-h-11 gap-1 px-3 text-[14.5px]"
          onClick={() => go({ screen: "profile", tab: "accessories" })}
        >
          <ShirtIcon aria-hidden className="size-4" />
          {t("home.menu.gacha.wardrobe")}
        </Button>
      </div>
    </section>
  );
}
