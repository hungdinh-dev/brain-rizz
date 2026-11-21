import { CHARACTER_IDS, MAX_NAME_LENGTH } from "@brain-rizz/shared";
import { ChevronRightIcon, CloudIcon, HardDriveIcon, UserIcon } from "lucide-react";
import { type FormEvent, lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { Character } from "@/components/characters";
import { ChalkIcon } from "@/components/common/ChalkChip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PetGrid, usePetUnlocks } from "@/features/pets";
import { useNumberFormat } from "@/hooks/use-number-format";
import { loadGachaLocales } from "@/i18n/gacha";
import { type AuthStatus, useAuth } from "@/stores/auth.store";
import { type ProfileTab, useNav } from "@/stores/nav.store";
import { useLoadingWhile } from "@/stores/top-loading.store";
import { useWallet } from "@/stores/wallet.store";
import { type Profile, saveProfile, useProfile } from "../profile";

/*
 * Tab Phụ kiện (Tủ đồ cũ, CR-023) tải lười thành chunk riêng cùng chữ 24 món / độ hiếm
 * (i18n/gacha.ts), để gói đầu vẫn ≤ 300 KB gzip (NFR-PERF-01). Rê chuột / chạm vào tab thì tải trước.
 */
const loadAccessories = () =>
  Promise.all([import("@/features/wardrobe"), loadGachaLocales()]).then(([m]) => ({
    default: m.AccessoriesTab,
  }));
const AccessoriesTab = lazy(loadAccessories);
const prefetchAccessories = () => void loadAccessories().catch(() => {});

interface ProfileScreenProps {
  profile: Profile;
  onBack(): void;
  onConfirm(profile: Profile): void;
}

/**
 * "Hồ sơ của bạn" (gộp Tủ đồ): thẻ danh thiếp (nhân vật đang đeo + tên + trạng thái tài khoản) bên
 * cạnh hai tab — Bạn đồng hành (`/profile`, lưới 12 nhân vật) và Phụ kiện (`/profile/accessories`,
 * Tủ đồ cũ). Tên + nhân vật là bản nháp, lưu khi bấm Xác nhận (rồi làm tiếp việc dở nếu có);
 * phụ kiện lưu ngay khi đeo như Tủ đồ cũ. Độ khó không chọn ở đây (màn giới thiệu game nhớ lựa chọn).
 */
export function ProfileScreen({ profile, onBack, onConfirm }: ProfileScreenProps) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar);
  // Phụ kiện lưu ngay khi đeo (`saveAccessories` cập nhật store hồ sơ) → thẻ vẽ lại ngay.
  const accessories = useProfile((s) => s.profile.accessories);
  const go = useNav((s) => s.go);
  const route = useNav((s) => s.route);
  const setProfileTab = useNav((s) => s.setProfileTab);
  const tab: ProfileTab =
    route.screen === "profile" && route.tab === "accessories" ? "accessories" : "pets";
  const tryOn = route.screen === "profile" ? route.tryOn : undefined;
  const walletStatus = useWallet((s) => s.status);
  const balance = useWallet((s) => s.wallet?.balance ?? 0);
  const unlocks = usePetUnlocks();
  // Chưa có tiến độ mở khoá (lần đầu) → khung xương thay lưới, thanh tải trên đầu.
  const petsLoading = unlocks.load === "idle" || unlocks.load === "loading";
  useLoadingWhile(tab === "pets" && petsLoading);
  const trimmed = name.trim();
  const openCount = CHARACTER_IDS.filter((id) => id === avatar || unlocks.isUnlocked(id)).length;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (trimmed) onConfirm({ ...profile, name: trimmed, avatar, accessories });
  }

  // Rời trang giữa chừng (Tài khoản, Máy quay, "Luyện ngay"): lưu tên + nhân vật đang sửa để không
  // mất (tên trống thì giữ tên cũ).
  function saveDraft() {
    saveProfile({ ...profile, name: trimmed || profile.name, avatar, accessories });
  }

  function toMachine() {
    saveDraft();
    go("gacha");
  }

  const showBalance = walletStatus === "ok" || walletStatus === "no-session";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 md:gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="sticker-text font-display text-4xl leading-none font-extrabold text-paper [--stroke:7px] md:text-5xl">
          {t("home.profile.title")}
        </h2>
        <p className="mt-2 text-chalk-muted">{t("home.profile.desc")}</p>
      </header>

      <form onSubmit={submit} className="flex flex-1 flex-col gap-5 md:gap-6">
        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-6">
          {/* Thẻ danh thiếp: máy tính / máy tính bảng dính trên cùng để luôn thấy nhân vật đang đeo. */}
          <Card className="min-w-0 gap-0 py-0 md:sticky md:top-2">
            <div className="flex flex-col items-center gap-1 border-b-[3px] border-sticker bg-primary px-4 pt-4 pb-3 text-primary-foreground">
              <Character id={avatar} mood="happy" size={140} accessories={accessories} />
              <span className="max-w-full truncate font-display text-3xl leading-none font-extrabold">
                {t(`characters.${avatar}.name`)}
              </span>
              <span className="text-sm text-primary-foreground/75">
                {t(`characters.${avatar}.species`)}
              </span>
            </div>
            <div className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="player-name" className="text-muted-foreground">
                  {t("home.profile.nameLabel")}
                </Label>
                <Input
                  id="player-name"
                  value={name}
                  maxLength={MAX_NAME_LENGTH}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("home.profile.namePlaceholder")}
                  autoComplete="nickname"
                />
              </div>
              <AccountLine beforeOpen={saveDraft} />
            </div>
          </Card>

          <section className="flex min-w-0 flex-col gap-3 md:gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Tabs
                value={tab}
                onValueChange={(v) => setProfileTab(v === "accessories" ? "accessories" : "pets")}
              >
                <TabsList variant="pill" aria-label={t("home.profile.tabsLabel")}>
                  <TabsTrigger value="pets">{t("home.profile.buddies")}</TabsTrigger>
                  <TabsTrigger
                    value="accessories"
                    onPointerEnter={prefetchAccessories}
                    onFocus={prefetchAccessories}
                  >
                    {t("home.profile.tabAccessories")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {tab === "accessories" && showBalance && (
                <button
                  type="button"
                  aria-label={t("home.menu.gacha.balanceAria", { amount: fmt(balance) })}
                  onClick={toMachine}
                  className="ml-auto flex h-11 cursor-pointer items-center gap-1.5 rounded-full border-[2.5px] border-chalk/70 bg-board-shade pr-3 pl-3.5 font-display text-lg leading-none font-extrabold text-chalk tabular-nums hover:border-chalk focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <ChalkIcon />
                  {fmt(balance)}
                  <span aria-hidden className="hidden sm:inline">
                    · {t("home.profile.toMachine")}
                  </span>
                  <ChevronRightIcon aria-hidden className="size-5" strokeWidth={2.6} />
                </button>
              )}
            </div>

            {tab === "accessories" ? (
              <Suspense fallback={<AccessoriesLoading />}>
                <AccessoriesTab
                  tryOn={tryOn}
                  onMachine={toMachine}
                  preview={
                    <Character id={avatar} mood="happy" size={56} accessories={accessories} />
                  }
                />
              </Suspense>
            ) : (
              /*
               * Lưới 12 bạn đồng hành (ui-ux 6.12): đã mở trước, thú khoá sau (xám + ổ khoá); bấm thú
               * khoá mở điều kiện, không đổi nhân vật. Đi "Luyện ngay" thì lưu bản nháp trước.
               */
              <div className="flex flex-col gap-3">
                {petsLoading ? (
                  <PetsLoading />
                ) : (
                  <>
                    <p className="text-sm text-chalk-muted">
                      {t("pets.unlockedCount", { count: openCount, total: CHARACTER_IDS.length })}{" "}
                      {t("pets.unlockedNote")}
                    </p>
                    <PetGrid value={avatar} onPick={setAvatar} beforeNavigate={saveDraft} />
                  </>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="mt-auto flex justify-end gap-3">
          <Button
            type="button"
            variant="chalk"
            data-sfx="back"
            className="rounded-2xl px-6"
            onClick={onBack}
          >
            {t("home.profile.back")}
          </Button>
          <Button type="submit" data-sfx="confirm" size="lg" disabled={!trimmed}>
            {t("home.profile.confirm")}
          </Button>
        </div>
      </form>
    </main>
  );
}

/** Đang tải chunk tab Phụ kiện: khung xương 3 chỗ đeo + thẻ lưới món (giữ bố cục). */
function AccessoriesLoading() {
  const { t } = useTranslation();
  useLoadingWhile(true);
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">{t("common.loading")}</span>
      <div className="grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} tone="board" className="h-14 rounded-2xl" />
        ))}
      </div>
      <Skeleton tone="board" className="h-60 w-full rounded-3xl" />
    </div>
  );
}

/** Đang tải tiến độ mở khoá lần đầu: dòng đếm + 12 thẻ bạn đồng hành (khớp lưới PetGrid). */
function PetsLoading() {
  const { t } = useTranslation();
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">{t("common.loading")}</span>
      <Skeleton tone="board" className="h-5 w-64 max-w-full" />
      <div className="grid grid-cols-3 gap-3 md:gap-4 lg:grid-cols-4">
        {CHARACTER_IDS.map((id) => (
          <Skeleton key={id} tone="board" className="h-32 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

type AccountKey = `home.profile.${"accountGoogle" | "accountGuest" | "accountLocal"}`;

const ACCOUNT_LINE: Record<AuthStatus, { key: AccountKey; Icon: typeof CloudIcon }> = {
  google: { key: "home.profile.accountGoogle", Icon: CloudIcon },
  guest: { key: "home.profile.accountGuest", Icon: UserIcon },
  "signed-out": { key: "home.profile.accountLocal", Icon: HardDriveIcon },
  unknown: { key: "home.profile.accountLocal", Icon: HardDriveIcon },
  "not-configured": { key: "home.profile.accountLocal", Icon: HardDriveIcon },
};

/** Dòng trạng thái tài khoản trong thẻ danh thiếp; không cấu hình Supabase thì ẩn nút Tài khoản. */
function AccountLine({ beforeOpen }: { beforeOpen(): void }) {
  const { t } = useTranslation();
  const status = useAuth((s) => s.status);
  const go = useNav((s) => s.go);
  const { key, Icon } = ACCOUNT_LINE[status];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-dashed border-border pt-3">
      <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <Icon aria-hidden className="size-4 shrink-0" strokeWidth={2.4} />
        {t(key)}
      </span>
      {status !== "not-configured" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            beforeOpen();
            go("account");
          }}
        >
          {t("home.profile.account")}
        </Button>
      )}
    </div>
  );
}
