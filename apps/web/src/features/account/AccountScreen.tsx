import {
  CheckIcon,
  ChevronRightIcon,
  LinkIcon,
  LoaderCircleIcon,
  LogOutIcon,
  PencilIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { DataProblemState } from "@/components/common/EmptyState";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { loadProfile } from "@/features/home";
import { loadRecords } from "@/features/practice";
import { playSfx } from "@/features/sfx";
import { fetchIsAdmin } from "@/net/admin-api";
import { useAuth } from "@/stores/auth.store";
import { useNav } from "@/stores/nav.store";
import { HistoryTabs, PracticeTable } from "./components/HistoryTabs";

/**
 * Tài khoản & lịch sử (UC-16, khu 15). Mở màn → tạo phiên khách nếu chưa có (lười), đồng bộ hồ sơ,
 * tải lịch sử 3 tab. Liên kết Google, đăng xuất, xoá dữ liệu (FR-MR-04, FR-MR-11).
 * Không có máy chủ dữ liệu → chỉ hiện kỷ lục luyện tập trên máy (luồng rẽ 2a).
 */
export function AccountScreen() {
  const { t } = useTranslation();
  const go = useNav((s) => s.go);
  const goBack = useNav((s) => s.goBack);
  const auth = useAuth();
  const [profile] = useState(loadProfile);
  const [opening, setOpening] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sessionFailed, setSessionFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const configured = auth.status !== "not-configured";
  const hasSession = auth.status === "guest" || auth.status === "google";

  // Mở Lịch sử là lúc tạo phiên khách (ADR 0011), kèm đồng bộ tên + nhân vật.
  // biome-ignore lint/correctness/useExhaustiveDependencies: chạy lại khi bấm Thử lại / sau khi đăng xuất
  useEffect(() => {
    if (!configured) return;
    let live = true;
    setSessionFailed(false);
    void auth.ensureSession({ name: profile.name, avatar: profile.avatar }).then((token) => {
      if (live && !token) setSessionFailed(true);
    });
    return () => {
      live = false;
    };
  }, [configured, attempt]);

  // Lối vào trang quản trị (CR-019): chỉ khi đã đăng nhập Google và `is_admin()` đúng.
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (auth.status !== "google" || !auth.userId) {
      setIsAdmin(false);
      return;
    }
    let live = true;
    void fetchIsAdmin().then((res) => {
      if (live) setIsAdmin(res.ok && res.data);
    });
    return () => {
      live = false;
    };
  }, [auth.status, auth.userId]);

  // Lỗi quay về từ Google khác "đã có dữ liệu" → toast một lần.
  useEffect(() => {
    if (auth.oauthIssue === "failed") {
      toast.error(t("account.oauthFailed"));
      auth.clearOAuthIssue();
    }
  }, [auth.oauthIssue, auth.clearOAuthIssue, t]);

  async function linkGoogle() {
    setOpening(true);
    const ok = await auth.linkGoogle();
    // Thành công thì trình duyệt đã chuyển sang Google; còn ở đây nghĩa là lỗi.
    if (!ok) {
      playSfx("error");
      toast.error(t("account.linkFailed"));
      setOpening(false);
    }
  }

  async function signOut() {
    await auth.signOut();
    toast(t("account.signedOut"));
    go("menu");
  }

  async function deleteData() {
    setDeleting(true);
    const result = await auth.deleteMyData();
    setDeleting(false);
    setConfirmDelete(false);
    if (result === "deleted") {
      toast(t("account.deleted"));
      go("menu");
    } else if (result === "last-admin") {
      // Quản trị viên duy nhất (CR-019): không xoá gì, nói rõ cách gỡ thay vì "thử lại sau".
      playSfx("error");
      toast.error(t("account.deleteLastAdmin"), { duration: 10_000 });
    } else {
      playSfx("error");
      toast.error(t("account.deleteFailed"));
    }
  }

  const statusChip =
    auth.status === "google" ? (
      <span className="inline-flex min-h-8 items-center gap-1.5 self-start rounded-full border-[2.5px] border-sticker bg-mint px-3 text-[13px] font-bold text-ink">
        <CheckIcon aria-hidden className="size-4 shrink-0" strokeWidth={3} />
        <span className="truncate">
          {auth.email ? t("account.linkedAs", { email: auth.email }) : t("account.linked")}
        </span>
      </span>
    ) : (
      <span className="inline-flex min-h-8 items-center gap-1.5 self-start rounded-full border-[2.5px] border-dashed border-muted-foreground px-3 text-[13px] font-bold text-muted-foreground">
        <span aria-hidden className="size-2.5 rounded-full bg-muted-foreground" />
        {t("account.guest")}
      </span>
    );

  const profileCard = (
    <Card className="gap-3 rounded-[22px] border-[3.5px] px-4 py-4">
      <div className="flex items-center gap-3">
        <PlayerAvatar avatar={profile.avatar} colorIndex={profile.colorIndex} size="lg" />
        <span className="flex min-w-0 flex-col gap-0.5 leading-tight">
          <span className="truncate font-display text-2xl font-extrabold">
            {profile.name || t(`characters.${profile.avatar}.name`)}
          </span>
          <span className="text-[13px] text-muted-foreground">
            {t(`characters.${profile.avatar}.name`)} · {t(`characters.${profile.avatar}.species`)}
          </span>
          <button
            type="button"
            onClick={() => go("profile", { profileReturn: "account" })}
            className="flex cursor-pointer items-center gap-1 self-start text-[13px] font-bold text-highlight underline-offset-4 hover:underline"
          >
            <PencilIcon aria-hidden className="size-3.5" />
            {t("account.editProfile")}
          </button>
        </span>
      </div>
      {configured &&
        (hasSession ? (
          statusChip
        ) : auth.status === "unknown" || !sessionFailed ? (
          <Skeleton className="h-8 w-48" />
        ) : null)}
      {configured && auth.status === "guest" && (
        <>
          <p className="text-sm text-muted-foreground">{t("account.linkHint")}</p>
          <Button onClick={() => void linkGoogle()} disabled={opening} aria-busy={opening}>
            {opening ? (
              <LoaderCircleIcon aria-hidden className="motion-safe:animate-spin" />
            ) : (
              <LinkIcon aria-hidden />
            )}
            {opening ? t("account.opening") : t("account.linkGoogle")}
          </Button>
        </>
      )}
      {isAdmin && (
        <Button variant="outline" className="min-h-13 justify-start" onClick={() => go("admin")}>
          <ShieldCheckIcon aria-hidden />
          <span className="flex-1 text-left">{t("account.adminConsole")}</span>
          <ChevronRightIcon aria-hidden />
        </Button>
      )}
    </Card>
  );

  const dangerZone = hasSession && (
    <div className="flex flex-wrap gap-2.5 lg:flex-col">
      <Button variant="outline" data-sfx="back" onClick={() => void signOut()}>
        <LogOutIcon aria-hidden />
        {t("account.signOut")}
      </Button>
      <Button variant="outline" onClick={() => setConfirmDelete(true)} className="text-destructive">
        <Trash2Icon aria-hidden />
        {t("account.deleteData")}
      </Button>
    </div>
  );

  let content: React.ReactNode;
  if (!configured) {
    // Luồng rẽ 2a: chỉ kỷ lục luyện tập trên máy.
    content = (
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <Card className="rounded-[22px] border-[3.5px] py-2">
          <DataProblemState problem="not-configured" />
        </Card>
        <Card className="gap-2 rounded-[22px] border-[3.5px] px-4 py-4">
          <h2 className="font-display text-xl font-extrabold">{t("account.localPracticeTitle")}</h2>
          <p className="text-[13px] text-muted-foreground">{t("account.localPracticeHint")}</p>
          <PracticeTable records={loadRecords()} go={go} />
        </Card>
      </div>
    );
  } else if (sessionFailed && !hasSession) {
    content = (
      <Card className="min-w-0 flex-1 rounded-[22px] border-[3.5px] py-2">
        <DataProblemState problem="error" onRetry={() => setAttempt((n) => n + 1)} />
      </Card>
    );
  } else if (!hasSession) {
    content = (
      <div aria-busy="true" className="flex min-w-0 flex-1 flex-col gap-3">
        <Skeleton className="h-11 w-80 max-w-full bg-board-shade" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  } else {
    content = <HistoryTabs sessionKey={auth.userId ?? ""} go={go} />;
  }

  return (
    <main className="flex flex-1 flex-col gap-3.5 lg:gap-4.5">
      <ScreenHeader title={t("account.title")} onBack={() => goBack("menu")} />
      <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <div className="flex flex-col gap-3.5 lg:w-90 lg:shrink-0">
          {profileCard}
          <div className="hidden lg:block">{dangerZone}</div>
        </div>
        {content}
        <div className="lg:hidden">{dangerZone}</div>
      </div>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => !deleting && setConfirmDelete(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-pink">
              <Trash2Icon />
            </AlertDialogMedia>
            <AlertDialogTitle>{t("account.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("account.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                // Giữ hộp thoại mở tới khi xoá xong.
                e.preventDefault();
                void deleteData();
              }}
            >
              {deleting && <LoaderCircleIcon aria-hidden className="motion-safe:animate-spin" />}
              {t("account.deleteForever")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={auth.oauthIssue === "identity-taken"}
        onOpenChange={(open) => !open && auth.clearOAuthIssue()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-sky">
              <LinkIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>{t("account.googleTaken")}</AlertDialogTitle>
            <AlertDialogDescription>{t("account.googleTakenBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:grid-cols-1">
            <AlertDialogAction
              onClick={() => {
                auth.clearOAuthIssue();
                void auth.signInGoogle().then((ok) => {
                  if (!ok) toast.error(t("account.oauthFailed"));
                });
              }}
            >
              {t("account.signInGoogle")}
            </AlertDialogAction>
            <AlertDialogCancel>{t("account.stayGuest")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
