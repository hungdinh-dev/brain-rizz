import type { CharacterId } from "@brain-rizz/shared";
import {
  ArrowLeftIcon,
  CloudOffIcon,
  LoaderCircleIcon,
  LogInIcon,
  RotateCwIcon,
  ShieldIcon,
  ShieldXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BrainMascot } from "@/components/brand";
import { LanguageToggle } from "@/components/common/LanguageToggle";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth.store";
import { useLoadingWhile } from "@/stores/top-loading.store";
import { ADMIN_SECTIONS, type AdminSection, SECTION_ICON } from "../sections";
import { Chip, IconTile, Panel } from "./kit";

/** Thanh trên: linh vật + "Brain Rizz" + chip Quản trị · email + avatar · ngôn ngữ, giao diện · Về trò chơi. */
export function AdminHeader({
  identity,
  onBack,
}: {
  /** Email + avatar của quản trị viên (ẩn ở cổng và trên điện thoại). */
  identity?: { email: string | null; avatar: CharacterId; colorIndex: number };
  onBack(): void;
}) {
  const { t } = useTranslation();
  return (
    <header className="flex flex-none items-center gap-2.5 @min-[820px]/root:gap-3">
      <BrainMascot size={40} className="shrink-0" />
      <span className="hidden font-display text-[22px] leading-none font-extrabold text-chalk @min-[440px]/root:inline">
        {t("admin.brand")}
      </span>
      <Chip tone="sun">{t("admin.chip")}</Chip>
      <span className="flex-1" />
      {identity?.email && (
        <span className="hidden min-w-0 items-center gap-2 text-[13px] text-chalk-muted @min-[820px]/root:flex">
          <PlayerAvatar avatar={identity.avatar} colorIndex={identity.colorIndex} size="sm" />
          <span className="truncate">{identity.email}</span>
        </span>
      )}
      <LanguageToggle />
      <ThemeToggle />
      <Button
        variant="chalk"
        data-sfx="back"
        onClick={onBack}
        aria-label={t("admin.backToGame")}
        className="min-h-11 rounded-full px-3 text-[17px] @min-[820px]/root:px-4"
      >
        <ArrowLeftIcon aria-hidden strokeWidth={2.6} />
        <span className="hidden @min-[820px]/root:inline">{t("admin.backToGame")}</span>
      </Button>
    </header>
  );
}

/**
 * Menu 8 mục: máy tính là cột trái 224 px (nút 44 px, mục đang mở là thẻ giấy); điện thoại là hàng
 * tab cuộn ngang ngay dưới thanh trên. Mục Phòng đang mở có chip số phòng.
 */
export function AdminNav({
  variant,
  section,
  roomCount,
  onChange,
}: {
  variant: "side" | "tabs";
  section: AdminSection;
  roomCount: number | null;
  onChange(section: AdminSection): void;
}) {
  const { t } = useTranslation();
  const side = variant === "side";
  return (
    <nav
      aria-label={t("admin.navLabel")}
      className={cn(
        side
          ? "hidden flex-col gap-1.5 @min-[820px]/root:flex"
          : "-mx-4 flex gap-2 overflow-x-auto px-4 pt-0.5 pb-2 @min-[820px]/root:hidden",
      )}
    >
      {ADMIN_SECTIONS.map((id) => {
        const Icon = SECTION_ICON[id];
        const on = id === section;
        return (
          <button
            key={id}
            type="button"
            aria-current={on ? "page" : undefined}
            onClick={() => onChange(id)}
            className={cn(
              "flex shrink-0 cursor-pointer items-center font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              side
                ? "min-h-11 w-full gap-2.5 rounded-[14px] border-[3px] px-3 text-left text-[15px]"
                : "h-11 gap-1.5 rounded-full border-[2.5px] px-3.5 text-sm whitespace-nowrap",
              on
                ? cn("border-sticker bg-card text-card-foreground", side && "shadow-sticker-sm")
                : side
                  ? "border-transparent text-chalk hover:bg-board-shade"
                  : "border-chalk/60 bg-board-shade text-chalk",
            )}
          >
            <Icon aria-hidden className={side ? "size-[19px]" : "size-4"} strokeWidth={2.4} />
            <span className={cn(side && "flex-1")}>{t(`admin.sections.${id}.title`)}</span>
            {id === "rooms" && roomCount !== null && roomCount > 0 && (
              <Chip tone="sun" className="h-5.5 px-1.5 text-[11px]">
                {roomCount}
              </Chip>
            )}
          </button>
        );
      })}
      {side && (
        <p className="mx-1 mt-2.5 text-xs leading-snug text-chalk-muted">{t("admin.navNote")}</p>
      )}
    </nav>
  );
}

export type GateKind = "checking" | "signin" | "forbidden" | "offline" | "error";

/**
 * Đang kiểm quyền: khung xương đúng bố cục bảng điều khiển (hàng tab trên điện thoại, menu cạnh +
 * thẻ trên máy tính) để vào được thì không nhảy bố cục, kèm thanh tải trên đầu trang.
 */
function GateChecking() {
  const { t } = useTranslation();
  useLoadingWhile(true);
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <div className="-mx-4 flex gap-2 overflow-hidden px-4 pt-0.5 pb-2 @min-[820px]/root:hidden">
        {ADMIN_SECTIONS.slice(0, 4).map((id) => (
          <Skeleton key={id} tone="board" className="h-11 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="grid items-start gap-3 @min-[820px]/root:grid-cols-[224px_minmax(0,1fr)] @min-[820px]/root:gap-5.5">
        <div className="hidden flex-col gap-1.5 @min-[820px]/root:flex">
          {ADMIN_SECTIONS.map((id) => (
            <Skeleton key={id} tone="board" className="h-11 rounded-[14px]" />
          ))}
        </div>
        <Panel className="flex flex-col gap-3 p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-18" />
            ))}
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8.5" />
          ))}
          <output className="block text-[12.5px] text-muted-foreground">
            {t("admin.gate.checking")}
          </output>
        </Panel>
      </div>
    </div>
  );
}

/** Cổng (ẩn menu): chưa đăng nhập Google, không có quyền, chưa kết nối, lỗi kiểm quyền. */
export function AdminGate({
  kind,
  email,
  onRetry,
  onBack,
}: {
  kind: GateKind;
  email: string | null;
  onRetry(): void;
  onBack(): void;
}) {
  const { t } = useTranslation();
  const signInGoogle = useAuth((s) => s.signInGoogle);
  const [opening, setOpening] = useState(false);

  if (kind === "checking") return <GateChecking />;

  async function openGoogle(selectAccount: boolean) {
    setOpening(true);
    const ok = await signInGoogle({ returnTo: "admin", selectAccount });
    // Thành công thì trình duyệt đã chuyển sang Google; còn ở đây nghĩa là lỗi.
    if (!ok) {
      toast.error(t("admin.gate.googleFailed"));
      setOpening(false);
    }
  }

  const google = kind === "signin" || kind === "forbidden";
  const view = {
    signin: {
      icon: ShieldIcon,
      tone: "bg-sky",
      title: t("admin.gate.signinTitle"),
      body: t("admin.gate.signinBody"),
      note: t("admin.gate.signinNote"),
      cta: t("admin.gate.signinCta"),
    },
    forbidden: {
      icon: ShieldXIcon,
      tone: "bg-pink",
      title: t("admin.gate.forbiddenTitle"),
      body: email ? t("admin.gate.forbiddenBody", { email }) : t("admin.gate.forbiddenBodyNoEmail"),
      note: null,
      cta: t("admin.gate.forbiddenCta"),
    },
    offline: {
      icon: CloudOffIcon,
      tone: "bg-grape",
      title: t("admin.gate.offlineTitle"),
      body: t("admin.gate.offlineBody"),
      note: t("admin.gate.offlineNote"),
      cta: t("common.retry"),
    },
    error: {
      icon: TriangleAlertIcon,
      tone: "bg-pink",
      title: t("admin.gate.errorTitle"),
      body: t("admin.gate.errorBody"),
      note: null,
      cta: t("common.retry"),
    },
  }[kind];

  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <Panel
        role={kind === "forbidden" || kind === "error" ? "alert" : undefined}
        aria-label={view.title}
        className="flex w-full max-w-[460px] flex-col items-center gap-3 border-4 px-6 py-6.5 text-center shadow-sticker"
      >
        <IconTile icon={view.icon} tone={view.tone} size="lg" />
        <h1 className="m-0 font-display text-[26px] leading-tight font-extrabold">{view.title}</h1>
        <p className="m-0 max-w-[38ch] text-sm leading-normal text-muted-foreground">{view.body}</p>
        <div className="mt-1 flex flex-wrap justify-center gap-2.5">
          <Button
            onClick={() => (google ? void openGoogle(kind === "forbidden") : onRetry())}
            disabled={opening}
            aria-busy={opening}
          >
            {opening ? (
              <LoaderCircleIcon aria-hidden className="motion-safe:animate-spin" />
            ) : google ? (
              <LogInIcon aria-hidden />
            ) : (
              <RotateCwIcon aria-hidden />
            )}
            {opening ? t("admin.gate.opening") : view.cta}
          </Button>
          <Button variant="outline" data-sfx="back" onClick={onBack}>
            {t("admin.backToGame")}
          </Button>
        </div>
        {view.note && <p className="m-0 text-[12.5px] text-muted-foreground">{view.note}</p>}
      </Panel>
    </div>
  );
}
