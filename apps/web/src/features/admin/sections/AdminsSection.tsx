import { CircleAlertIcon, LoaderCircleIcon, Trash2Icon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { playSfx } from "@/features/sfx";
import { cn } from "@/lib/utils";
import {
  ADMIN_NOTE_MAX,
  type AdminAccount,
  addAdmin,
  fetchAdmins,
  removeAdmin,
} from "@/net/admin-api";
import { useAuth } from "@/stores/auth.store";
import { useAdminStore } from "../admin.store";
import {
  Chip,
  DataTable,
  desktopOnly,
  EmptyPanel,
  HeadRow,
  mobileOnly,
  Panel,
  PanelFoot,
  PanelTitle,
  Row,
  SectionHeader,
  SectionState,
  TBody,
  Th,
} from "../components/kit";
import { useAdminFormat } from "../format";
import { useAdminData } from "../hooks/use-admin-data";

const GRID =
  "grid-cols-[minmax(0,1fr)_auto] @min-[820px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_150px_56px]";

const displayName = (a: AdminAccount) => a.name ?? a.email ?? a.userId.slice(0, 8);

/** Quản trị viên: thêm theo email Google (+ ghi chú), danh sách, xoá quyền (hỏi lại trước). */
export function AdminsSection() {
  const { t } = useTranslation();
  const fmt = useAdminFormat();
  const me = useAuth((s) => s.userId);
  const { state, reload } = useAdminData(fetchAdmins, []);
  const [removing, setRemoving] = useState<AdminAccount | null>(null);

  return (
    <>
      <SectionHeader section="admins" />
      <AddAdminForm onAdded={reload} />
      {state.status !== "ok" ? (
        <SectionState state={state} section="admins" onRetry={reload} />
      ) : state.data.length === 0 ? (
        <EmptyPanel section="admins" />
      ) : (
        <Panel>
          <DataTable aria-label={t("admin.sections.admins.title")}>
            <HeadRow className={cn(GRID, "pt-3.5")}>
              <Th>{t("admin.admins.colAdmin")}</Th>
              <Th>{t("admin.admins.colNote")}</Th>
              <Th>{t("admin.admins.colAdded")}</Th>
              <Th />
            </HeadRow>
            <TBody>
              {state.data.map((admin) => {
                const self = admin.userId === me;
                const name = displayName(admin);
                const note = admin.note ?? t("admin.none");
                return (
                  <Row key={admin.userId} className={GRID}>
                    <td className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-sticker bg-primary font-display font-extrabold text-ink uppercase"
                      >
                        {name.charAt(0)}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate font-bold">{name}</span>
                          {self && (
                            <Chip tone="sun" className="h-4.5 px-1.5 text-[10px]">
                              {t("admin.admins.you")}
                            </Chip>
                          )}
                        </span>
                        {admin.email && (
                          <span className="truncate text-xs text-muted-foreground">
                            {admin.email}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={cn(desktopOnly, "truncate")}>{note}</td>
                    <td
                      className={cn(
                        desktopOnly,
                        "text-[12.5px] text-muted-foreground tabular-nums",
                      )}
                    >
                      {fmt.date(admin.createdAt)}
                    </td>
                    <td>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-11 text-destructive"
                        disabled={self}
                        aria-label={t("admin.admins.remove", { name })}
                        title={self ? t("admin.admins.removeSelf") : t("admin.admins.removeTitle")}
                        onClick={() => setRemoving(admin)}
                      >
                        <Trash2Icon aria-hidden />
                      </Button>
                    </td>
                    <td className={mobileOnly}>
                      {note} · {fmt.date(admin.createdAt)}
                    </td>
                  </Row>
                );
              })}
            </TBody>
          </DataTable>
          <PanelFoot>
            <span>{t("admin.admins.footer")}</span>
          </PanelFoot>
        </Panel>
      )}
      {removing && (
        <RemoveDialog
          admin={removing}
          onClose={() => setRemoving(null)}
          onRemoved={() => {
            setRemoving(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function AddAdminForm({ onAdded }: { onAdded(): void }) {
  const { t } = useTranslation();
  const reportFailure = useAdminStore((s) => s.reportFailure);
  const emailId = useId();
  const noteId = useId();
  const errorId = useId();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+$/.test(value)) {
      setError(t("admin.admins.invalidEmail"));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await addAdmin(value, note);
    setBusy(false);
    if (res.ok) {
      toast.success(t("admin.admins.added", { email: value }));
      setEmail("");
      setNote("");
      onAdded();
      return;
    }
    playSfx("error");
    if (res.reason === "not-found") setError(t("admin.admins.notFound"));
    else if (res.reason === "forbidden" || res.reason === "no-session") reportFailure(res.reason);
    else toast.error(t("admin.admins.addFailed"));
  }

  return (
    <Panel className="px-3 py-3.5 @min-[820px]:px-4">
      <PanelTitle className="mb-1">{t("admin.admins.addTitle")}</PanelTitle>
      <p className="m-0 mb-2.5 text-[12.5px] text-muted-foreground">{t("admin.admins.addHint")}</p>
      <form
        onSubmit={(e) => void submit(e)}
        className="flex flex-wrap items-end gap-2.5"
        noValidate
      >
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1">
          <Label htmlFor={emailId} className="text-[13px] font-bold">
            {t("admin.admins.email")}
          </Label>
          <Input
            id={emailId}
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? errorId : undefined}
            className="h-11 rounded-xl border-[2.5px] text-[15px]"
          />
        </div>
        <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
          <Label htmlFor={noteId} className="text-[13px] font-bold">
            {t("admin.admins.note")}
          </Label>
          <Input
            id={noteId}
            type="text"
            value={note}
            maxLength={ADMIN_NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            className="h-11 rounded-xl border-[2.5px] text-[15px]"
          />
        </div>
        <Button type="submit" className="min-h-11" disabled={busy} aria-busy={busy}>
          {busy && <LoaderCircleIcon aria-hidden className="motion-safe:animate-spin" />}
          {t("admin.admins.add")}
        </Button>
      </form>
      {error && (
        <p
          id={errorId}
          role="alert"
          className="m-0 mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-destructive"
        >
          <CircleAlertIcon aria-hidden className="size-4 shrink-0" strokeWidth={2.6} />
          {error}
        </p>
      )}
    </Panel>
  );
}

function RemoveDialog({
  admin,
  onClose,
  onRemoved,
}: {
  admin: AdminAccount;
  onClose(): void;
  onRemoved(): void;
}) {
  const { t } = useTranslation();
  const reportFailure = useAdminStore((s) => s.reportFailure);
  const [busy, setBusy] = useState(false);
  const name = displayName(admin);

  async function remove() {
    setBusy(true);
    const res = await removeAdmin(admin.userId);
    setBusy(false);
    if (res.ok) {
      toast(t("admin.admins.removed", { name }));
      onRemoved();
      return;
    }
    playSfx("error");
    if (res.reason === "last-admin") toast.error(t("admin.admins.lastAdmin"));
    else if (res.reason === "self") toast.error(t("admin.admins.self"));
    else if (res.reason === "forbidden" || res.reason === "no-session") reportFailure(res.reason);
    else toast.error(t("admin.admins.removeFailed"));
    onClose();
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-pink">
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("admin.admins.confirmTitle", { name })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("admin.admins.confirmBody", { email: admin.email ?? name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={(e) => {
              // Giữ hộp thoại mở tới khi xoá xong.
              e.preventDefault();
              void remove();
            }}
          >
            {busy && <LoaderCircleIcon aria-hidden className="motion-safe:animate-spin" />}
            {t("admin.admins.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
