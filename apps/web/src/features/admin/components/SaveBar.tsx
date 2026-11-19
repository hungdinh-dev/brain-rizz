import type { Difficulty, GameId } from "@brain-rizz/shared";
import { LoaderCircleIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { playSfx } from "@/features/sfx";
import { useGameTextLookup } from "@/hooks/use-game-text";
import { ADMIN_NOTE_MAX, reloadPartyConfig, savePartySettings } from "@/net/admin-api";
import { useAdminStore } from "../admin.store";
import { checkDraft, type DraftChange, diffDraft, type FieldKey } from "../draft";
import { useAdminFormat } from "../format";

/** Tên một ô của bản nháp (dùng trong tóm tắt thay đổi). */
export function useFieldLabel() {
  const { t } = useTranslation();
  return (key: FieldKey) => {
    const [name, index] = key.split(".");
    if (name === "difficultyMultiplier") {
      return t("admin.scoring.fields.multiplier", {
        level: t(`difficulty.${Number(index) as Difficulty}`),
      });
    }
    if (name === "placementTopBonus")
      return t("admin.scoring.fields.top", { n: Number(index) + 1 });
    return t(`admin.scoring.fields.${name as Exclude<FieldKey, `${string}.${string}`>}`);
  };
}

/** Câu tóm tắt từng thay đổi: ngắn (thanh dưới đáy) hoặc đủ (hộp Lưu). */
function useChangeText() {
  const { t } = useTranslation();
  const fmt = useAdminFormat();
  const label = useFieldLabel();
  const gameText = useGameTextLookup();
  const name = (id: GameId) => gameText(id).title;
  const value = (n: number) => (Number.isFinite(n) ? fmt.dec(n, 3) : "?");
  const quad = (q: readonly number[] | null) =>
    q ? q.map((v) => fmt.dec(v, 3)).join(" · ") : t("admin.draft.defaultMult");

  const short = (c: DraftChange) => {
    switch (c.kind) {
      case "disable":
        return t("admin.draft.disabledN", { count: c.ids.length });
      case "enable":
        return t("admin.draft.enabledN", { count: c.ids.length });
      case "field":
        return t("admin.draft.fieldChange", {
          label: label(c.key),
          from: value(c.from),
          to: value(c.to),
        });
      case "game":
        return t("admin.draft.gameMult", { name: name(c.id) });
    }
  };
  const long = (c: DraftChange) => {
    switch (c.kind) {
      case "disable":
        return t("admin.draft.disabledList", { list: c.ids.map(name).join(", ") });
      case "enable":
        return t("admin.draft.enabledList", { list: c.ids.map(name).join(", ") });
      case "field":
        return short(c);
      case "game":
        return t("admin.draft.gameMultList", {
          name: name(c.id),
          from: quad(c.from),
          to: quad(c.to),
        });
    }
  };
  return { short, long };
}

/** Số thay đổi tóm tắt hiện trên thanh dưới đáy; còn lại gộp thành "+n". */
const SHORT_LIMIT = 2;

/**
 * Thanh dưới đáy dính (mục Game và Điểm & hệ số) khi bản nháp khác cấu hình đang áp dụng:
 * "n thay đổi chưa lưu · …" + Huỷ nháp + Lưu…; Lưu mở hộp tóm tắt + ghi chú → lưu → báo game server.
 */
export function SaveBar() {
  const { t } = useTranslation();
  const draft = useAdminStore((s) => s.draft);
  const settings = useAdminStore((s) => s.settings);
  const discardDraft = useAdminStore((s) => s.discardDraft);
  const text = useChangeText();
  const [open, setOpen] = useState(false);

  const check = useMemo(() => (draft ? checkDraft(draft) : null), [draft]);
  const diff = useMemo(
    () =>
      draft && check && settings.status === "ok" ? diffDraft(settings.data, draft, check) : null,
    [draft, check, settings],
  );
  if (!draft || !check || !diff || diff.count === 0 || settings.status !== "ok") return null;

  const shown = diff.changes.slice(0, SHORT_LIMIT).map(text.short);
  const hidden = diff.changes.length - shown.length;
  const summary = [...shown, ...(hidden > 0 ? [t("admin.draft.more", { count: hidden })] : [])];

  return (
    <>
      <section
        aria-label={t("admin.draft.region")}
        className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2.5 rounded-[20px] border-4 border-sticker bg-card px-3.5 py-2.5 text-card-foreground shadow-sticker"
      >
        <span aria-hidden className="size-3 shrink-0 rounded-full border-2 border-ink bg-primary" />
        <span className="min-w-[180px] flex-1 text-[13.5px]">
          <b>{t("admin.draft.count", { count: diff.count })}</b> · {summary.join(", ")}
          {check.invalidCount > 0 && (
            <span role="alert" className="block text-[12.5px] font-semibold text-destructive">
              {t("admin.draft.invalid", { count: check.invalidCount })}
            </span>
          )}
        </span>
        <Button variant="outline" className="min-h-11" onClick={discardDraft}>
          {t("admin.draft.discard")}
        </Button>
        <Button className="min-h-11" disabled={!check.config} onClick={() => setOpen(true)}>
          {t("admin.draft.save")}
        </Button>
      </section>
      {open && check.config && (
        <SaveDialog
          nextVersion={settings.data.version + 1}
          lines={diff.changes.map(text.long)}
          disabled={draft.disabled}
          scoring={check.config}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function SaveDialog({
  nextVersion,
  lines,
  disabled,
  scoring,
  onClose,
}: {
  nextVersion: number;
  lines: string[];
  disabled: readonly string[];
  scoring: NonNullable<ReturnType<typeof checkDraft>["config"]>;
  onClose(): void;
}) {
  const { t } = useTranslation();
  const loadSettings = useAdminStore((s) => s.loadSettings);
  const markSaved = useAdminStore((s) => s.markSaved);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await savePartySettings(scoring, disabled, note);
    if (!res.ok) {
      setSaving(false);
      playSfx("error");
      // Bản nháp giữ nguyên (không đưa trang về cổng) để quản trị viên đăng nhập lại rồi lưu tiếp.
      toast.error(
        res.reason === "forbidden" || res.reason === "no-session"
          ? t("admin.draft.saveForbidden")
          : t("admin.draft.saveFailed"),
        { duration: 8_000 },
      );
      return;
    }
    const version = res.data;
    // Báo game server nạp lại ngay; lỗi chỉ cảnh báo (server tự nạp lại sau ≤ 30 giây).
    const reload = await reloadPartyConfig();
    if (reload.ok) toast.success(t("admin.draft.saved", { version }));
    else toast.warning(t("admin.draft.savedNoReload", { version }), { duration: 10_000 });
    await loadSettings({ resetDraft: true });
    markSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent closeLabel={saving ? undefined : t("admin.draft.close")}>
        <DialogHeader>
          <DialogTitle>{t("admin.draft.dialogTitle", { version: nextVersion })}</DialogTitle>
          <DialogDescription>{t("admin.draft.dialogBody")}</DialogDescription>
        </DialogHeader>
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="admin-save-note" className="text-[13px] font-bold">
            {t("admin.draft.noteLabel")}
          </Label>
          <textarea
            id="admin-save-note"
            value={note}
            maxLength={ADMIN_NOTE_MAX}
            rows={2}
            placeholder={t("admin.draft.notePlaceholder")}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-16 w-full resize-y rounded-xl border-[2.5px] border-input bg-card px-3 py-2 text-[15px] text-card-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <span className="self-end text-xs text-muted-foreground tabular-nums">
            {t("admin.draft.noteCount", { n: note.length, max: ADMIN_NOTE_MAX })}
          </span>
        </div>
        <DialogFooter className="sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={saving} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={saving} aria-busy={saving} onClick={() => void save()}>
            {saving && <LoaderCircleIcon aria-hidden className="motion-safe:animate-spin" />}
            {t("admin.draft.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
