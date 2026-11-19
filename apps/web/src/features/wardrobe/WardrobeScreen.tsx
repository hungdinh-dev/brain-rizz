import { ChevronRightIcon } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChalkChip, ChalkIcon } from "@/components/common/ChalkChip";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PetsTab } from "@/features/pets";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useNumberFormat } from "@/hooks/use-number-format";
import { useAuth } from "@/stores/auth.store";
import { useNav, type WardrobeTab } from "@/stores/nav.store";
import { useWallet } from "@/stores/wallet.store";
import { AccessoriesTab } from "./components/AccessoriesTab";

/**
 * Tủ đồ (S20, CR-023, CR-024, ui-ux 6.12): tab Phụ kiện (`/wardrobe`) và tab Bạn đồng hành
 * (`/wardrobe/pets`, `PetsTab` của features/pets). Chip số dư dẫn sang Máy quay; chưa kết nối máy chủ
 * dữ liệu thì ẩn chip, vẫn mặc được món đang lưu trên máy.
 */
export function WardrobeScreen() {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const go = useNav((s) => s.go);
  const goBack = useNav((s) => s.goBack);
  const route = useNav((s) => s.route);
  const tab: WardrobeTab =
    route.screen === "wardrobe" && route.tab === "pets" ? "pets" : "accessories";
  const tryOn = route.screen === "wardrobe" ? route.tryOn : undefined;
  const authStatus = useAuth((s) => s.status);
  const walletStatus = useWallet((s) => s.status);
  const balance = useWallet((s) => s.wallet?.balance ?? 0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: đọc lại khi trạng thái phiên đổi
  useEffect(() => {
    void useWallet.getState().load();
    void useWallet.getState().loadItems();
  }, [authStatus]);

  const showBalance = walletStatus === "ok" || walletStatus === "no-session";
  const toMachine = () => go("gacha");
  const balanceAria = t("wardrobe.balanceAria", { amount: fmt(balance) });

  const tabs = (
    <Tabs
      value={tab}
      onValueChange={(v) =>
        go(v === "pets" ? { screen: "wardrobe", tab: "pets" } : { screen: "wardrobe" })
      }
    >
      <TabsList variant="pill" aria-label={t("wardrobe.tabsLabel")}>
        <TabsTrigger value="accessories">{t("wardrobe.tabAccessories")}</TabsTrigger>
        <TabsTrigger value="pets">{t("wardrobe.tabPets")}</TabsTrigger>
      </TabsList>
    </Tabs>
  );

  return (
    <main className="flex flex-1 flex-col gap-3.5 lg:gap-5">
      <ScreenHeader title={t("wardrobe.title")} onBack={() => goBack("menu")}>
        {!desktop && showBalance && (
          <button
            type="button"
            aria-label={balanceAria}
            onClick={toMachine}
            className="cursor-pointer rounded-full focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ChalkChip tone="board" size="lg">
              {fmt(balance)}
            </ChalkChip>
          </button>
        )}
      </ScreenHeader>

      <div className="flex flex-wrap items-center gap-3">
        {tabs}
        {desktop && showBalance && (
          <button
            type="button"
            aria-label={balanceAria}
            onClick={toMachine}
            className="ml-auto flex h-11 cursor-pointer items-center gap-1.5 rounded-full border-[2.5px] border-chalk/70 bg-board-shade pr-3 pl-3.5 font-display text-lg leading-none font-extrabold text-chalk tabular-nums hover:border-chalk focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ChalkIcon />
            {fmt(balance)}
            <span aria-hidden>·</span>
            {t("wardrobe.toMachine")}
            <ChevronRightIcon aria-hidden className="size-5" strokeWidth={2.6} />
          </button>
        )}
      </div>

      {tab === "pets" ? (
        <PetsTab />
      ) : (
        <AccessoriesTab desktop={desktop} tryOn={tryOn} onMachine={toMachine} />
      )}
    </main>
  );
}
