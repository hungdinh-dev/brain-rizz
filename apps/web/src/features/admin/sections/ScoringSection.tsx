import {
  comboMultiplier,
  DEFAULT_SCORING,
  type Difficulty,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  placementPoints,
  pointsForCorrect,
  type ScoringConfig,
} from "@brain-rizz/shared";
import { InfoIcon, MinusIcon, PlusIcon, RotateCcwIcon } from "lucide-react";
import { useId, useMemo, useState } from "react";
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
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { type AdminSettingsHistoryRow, fetchSettingsHistory } from "@/net/admin-api";
import { decimalSeparator, useAdminStore } from "../admin.store";
import {
  Chip,
  DataTable,
  ErrorPanel,
  LoadingPanel,
  Panel,
  PanelHead,
  PanelTitle,
  Row,
  SectionHeader,
  SectionState,
  Segmented,
  TBody,
} from "../components/kit";
import { useFieldLabel } from "../components/SaveBar";
import {
  checkDraft,
  DIFFICULTIES,
  type DraftCheck,
  draftFromConfig,
  type FieldError,
  type FieldKey,
  fieldSpec,
  fieldValue,
  multiplierField,
  type PartyDraft,
  parseDraftNumber,
  restoreDefaultFields,
  setField,
  TOP_PLACES,
  topField,
} from "../draft";
import { useAdminFormat } from "../format";
import { useAdminData } from "../hooks/use-admin-data";

/** Số bản lịch sử hiện (RPC `admin_settings_history(p_limit)`). */
const HISTORY_LIMIT = 20;

type Unit = "points" | "ms" | "times" | null;

interface FieldGroup {
  id: "points" | "combo" | "multiplier" | "top";
  /** Lưới ô: điện thoại / máy tính. */
  grid: string;
  fields: readonly (readonly [FieldKey, Unit])[];
}

const GROUPS: readonly FieldGroup[] = [
  {
    id: "points",
    grid: "grid-cols-1 @min-[560px]:grid-cols-2",
    fields: [
      ["basePoints", "points"],
      ["maxSpeedBonus", "points"],
      ["fastAnswerMs", "ms"],
      ["slowAnswerMs", "ms"],
    ],
  },
  {
    id: "combo",
    grid: "grid-cols-3",
    fields: [
      ["streakThreshold", null],
      ["streakBonusPerStep", "times"],
      ["maxComboMultiplier", "times"],
    ],
  },
  {
    id: "multiplier",
    grid: "grid-cols-2 @min-[480px]:grid-cols-4",
    fields: DIFFICULTIES.map((d) => [multiplierField(d), "times"] as const),
  },
  {
    id: "top",
    grid: "grid-cols-3",
    fields: TOP_PLACES.map((i) => [topField(i), null] as const),
  },
];

/**
 * Điểm & hệ số: form kiểm bằng `ScoringConfigSchema` (qua bản nháp), xem thử điểm một câu và bảng
 * điểm thứ hạng 2…12 người tính bằng chính hàm shared, khôi phục mặc định, lịch sử thay đổi.
 * Lưu ở thanh dưới đáy (SaveBar).
 */
export function ScoringSection() {
  const { t } = useTranslation();
  const settings = useAdminStore((s) => s.settings);
  const draft = useAdminStore((s) => s.draft);
  const loadSettings = useAdminStore((s) => s.loadSettings);
  const check = useMemo(() => (draft ? checkDraft(draft) : null), [draft]);

  return (
    <>
      <SectionHeader section="scoring">
        {settings.status === "ok" && (
          <Chip tone="sky" className="h-7.5 text-[12.5px]">
            {t("admin.scoring.applied", { version: settings.data.version })}
          </Chip>
        )}
      </SectionHeader>
      {settings.status !== "ok" ? (
        settings.status === "loading" ? (
          <LoadingPanel section="scoring" />
        ) : (
          <ErrorPanel
            section="scoring"
            reason={settings.status}
            onRetry={() => void loadSettings()}
          />
        )
      ) : !draft || !check ? (
        <LoadingPanel section="scoring" />
      ) : (
        <>
          <div
            role="note"
            className="flex items-start gap-2.5 rounded-[14px] border-[2.5px] border-dashed border-chalk/60 px-3.5 py-2.5 text-[13.5px] leading-snug text-chalk"
          >
            <InfoIcon aria-hidden className="mt-0.5 size-[18px] shrink-0" strokeWidth={2.4} />
            <span>{t("admin.scoring.note")}</span>
          </div>
          <div className="grid items-start gap-4.5 @min-[820px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <ScoringForm draft={draft} check={check} applied={settings.data.scoring} />
            <div className="flex min-w-0 flex-col gap-3.5">
              <PointsPreview check={check} applied={settings.data.scoring} />
              <PlacementTable scoring={check.preview} />
            </div>
          </div>
          <HistoryPanel currentVersion={settings.data.version} />
        </>
      )}
    </>
  );
}

function ScoringForm({
  draft,
  check,
  applied,
}: {
  draft: PartyDraft;
  check: DraftCheck;
  applied: ScoringConfig;
}) {
  const { t } = useTranslation();
  const setDraft = useAdminStore((s) => s.setDraft);
  const [confirm, setConfirm] = useState(false);

  return (
    <Panel className="pb-3.5">
      {GROUPS.map((group, gi) => (
        <div
          key={group.id}
          className={cn(
            "px-3 pt-3 pb-1 @min-[820px]:px-4",
            gi > 0 && "border-t border-card-foreground/15",
          )}
        >
          <h2 className="m-0 mb-0.5 font-display text-lg font-extrabold">
            {t(`admin.scoring.groups.${group.id}.title`)}
          </h2>
          <p className="m-0 mb-2.5 text-[12.5px] leading-snug text-muted-foreground">
            {t(`admin.scoring.groups.${group.id}.hint`)}
          </p>
          <div className={cn("grid gap-x-4 gap-y-3", group.grid)}>
            {group.fields.map(([key, unit]) => (
              <ScoreField
                key={key}
                field={key}
                unit={unit}
                text={draft.fields[key]}
                applied={fieldValue(applied, key)}
                error={check.fieldErrors[key]}
                onChange={(text) => setDraft(setField(draft, key, text))}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2.5 px-3 pt-3 @min-[820px]:px-4">
        <Button variant="outline" className="min-h-11" onClick={() => setConfirm(true)}>
          <RotateCcwIcon aria-hidden />
          {t("admin.scoring.restore")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("admin.scoring.restoreHint")}</span>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.scoring.restoreTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.scoring.restoreBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => setDraft(restoreDefaultFields(draft, decimalSeparator()))}
            >
              {t("admin.scoring.restoreConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}

function ScoreField({
  field,
  unit,
  text,
  applied,
  error,
  onChange,
}: {
  field: FieldKey;
  unit: Unit;
  text: string;
  applied: number;
  error: FieldError | undefined;
  onChange(text: string): void;
}) {
  const { t } = useTranslation();
  const fmt = useAdminFormat();
  const label = useFieldLabel();
  const inputId = useId();
  const helpId = useId();
  const spec = fieldSpec(field);
  const changed = !Object.is(parseDraftNumber(text, spec.integer), applied);
  const fallback = fieldValue(DEFAULT_SCORING, field);
  const n = (v: number) => (spec.integer ? fmt.num(v) : fmt.dec(v, 3));
  const range =
    field === "slowAnswerMs"
      ? t("admin.scoring.rangeSlow", { max: n(spec.max) })
      : spec.aboveMin
        ? t("admin.scoring.rangeMult")
        : t("admin.scoring.range", { min: n(spec.min), max: n(spec.max) });

  // Nhóm 3–4 ô hẹp (hệ số chung, thưởng top): khoảng giá trị ghi ở dòng gợi ý của nhóm.
  const compact = field.includes(".");
  let message = compact
    ? t("admin.scoring.helpShort", { value: n(fallback) })
    : t("admin.scoring.help", { value: n(fallback), range });
  if (error?.kind === "number") message = t("admin.scoring.errNumber");
  else if (error?.kind === "integer") message = t("admin.scoring.errInteger");
  else if (error?.kind === "multiplier") message = t("admin.scoring.errMult");
  else if (error?.kind === "slow") message = t("admin.scoring.errSlow", { fast: n(error.fast) });
  else if (error?.kind === "range") {
    message = t("admin.scoring.errRange", { min: n(error.min), max: n(error.max) });
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex min-h-4.5 items-center gap-1.5 text-[13px] font-bold">
        <Label htmlFor={inputId} className="block truncate text-[13px] font-bold">
          {field.startsWith("difficultyMultiplier.")
            ? t(`difficulty.${Number(field.split(".")[1]) as Difficulty}`)
            : label(field)}
        </Label>
        {changed && (
          <Chip tone="sun" className="h-4.5 px-1.5 text-[10px]">
            {t("admin.scoring.changed")}
          </Chip>
        )}
      </span>
      <span className="flex items-center gap-1.5">
        <Input
          id={inputId}
          type="text"
          inputMode={spec.integer ? "numeric" : "decimal"}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error || undefined}
          aria-describedby={helpId}
          className={cn(
            "h-11 rounded-xl border-[2.5px] px-3 text-[15px] tabular-nums",
            changed && "bg-primary/30 font-extrabold",
          )}
        />
        {unit && (
          <span className="shrink-0 text-[12.5px] text-muted-foreground">
            {t(`admin.scoring.units.${unit}`)}
          </span>
        )}
      </span>
      <span
        id={helpId}
        className={cn(
          "text-[11.5px] leading-snug",
          error ? "font-semibold text-destructive" : "text-muted-foreground",
        )}
      >
        {message}
      </span>
    </div>
  );
}

/** Xem thử điểm một câu đúng: bản nháp so với cấu hình đang áp dụng, kèm công thức. */
function PointsPreview({ check, applied }: { check: DraftCheck; applied: ScoringConfig }) {
  const { t } = useTranslation();
  const fmt = useAdminFormat();
  const [level, setLevel] = useState<Difficulty>(2);
  const [seconds, setSeconds] = useState(2.5);
  const [streak, setStreak] = useState(4);
  const draft = check.preview;
  const input = { difficulty: level, answerMs: seconds * 1000, streak };
  const draftPoints = pointsForCorrect(input, draft);
  const livePoints = pointsForCorrect(input, applied);
  // Phần thưởng nhanh tách riêng bằng chính hàm chấm: hệ số độ khó 0, combo ×1.
  const speed = pointsForCorrect(
    { ...input, streak: 0, multiplier: 0 },
    { ...draft, streakBonusPerStep: 0 },
  );
  const combo = comboMultiplier(streak, draft);

  return (
    <Panel className="pb-3.5">
      <PanelHead>
        <PanelTitle>{t("admin.scoring.previewTitle")}</PanelTitle>
      </PanelHead>
      <div className="flex flex-col gap-2.5 px-3 @min-[820px]:px-4">
        <Segmented
          label={t("admin.scoring.previewLevel")}
          value={String(level)}
          onChange={(v) => setLevel(Number(v) as Difficulty)}
          options={DIFFICULTIES.map((d) => ({ value: String(d), label: t(`difficulty.${d}`) }))}
          className="self-start"
        />
        <div className="flex min-h-11 items-center gap-2.5 text-[13px] font-bold">
          <span className="shrink-0">{t("admin.scoring.previewSeconds")}</span>
          <Slider
            min={0}
            max={10}
            step={0.5}
            value={[seconds]}
            onValueChange={([v]) => setSeconds(v ?? 0)}
            aria-label={t("admin.scoring.previewSecondsLabel")}
            className="flex-1 [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-sticker"
          />
          <span className="w-13 text-right font-display text-lg tabular-nums">
            {t("admin.scoring.seconds", { n: fmt.dec(seconds, 1) })}
          </span>
        </div>
        <div className="flex items-center gap-2.5 text-[13px] font-bold">
          <span className="flex-1">{t("admin.scoring.previewStreak")}</span>
          <Button
            variant="outline"
            size="icon"
            className="size-11"
            aria-label={t("admin.scoring.streakDec")}
            disabled={streak <= 0}
            onClick={() => setStreak((s) => Math.max(0, s - 1))}
          >
            <MinusIcon aria-hidden />
          </Button>
          <output className="w-7.5 text-center font-display text-xl tabular-nums">{streak}</output>
          <Button
            variant="outline"
            size="icon"
            className="size-11"
            aria-label={t("admin.scoring.streakInc")}
            disabled={streak >= 10}
            onClick={() => setStreak((s) => Math.min(10, s + 1))}
          >
            <PlusIcon aria-hidden />
          </Button>
        </div>
        <div
          aria-live="polite"
          className="flex flex-wrap items-center gap-3.5 rounded-2xl border-[3px] border-sticker bg-muted px-3.5 py-3"
        >
          <span className="flex flex-col leading-none">
            <span className="text-[11.5px] font-bold text-muted-foreground uppercase">
              {t("admin.scoring.draft")}
            </span>
            <span className="font-display text-[40px] font-extrabold tabular-nums">
              {fmt.num(draftPoints)}
            </span>
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[11.5px] font-bold text-muted-foreground uppercase">
              {t("admin.scoring.live")}
            </span>
            <span className="font-display text-[26px] font-extrabold text-muted-foreground tabular-nums">
              {fmt.num(livePoints)}
            </span>
          </span>
          <span className="min-w-40 flex-1 font-mono text-xs leading-normal">
            {t("admin.scoring.formula1", {
              base: fmt.num(draft.basePoints),
              factor: fmt.dec(draft.difficultyMultiplier[level], 3),
              speed: fmt.num(speed),
            })}
            <br />
            {t("admin.scoring.formula2", {
              combo: fmt.dec(combo, 2),
              points: fmt.num(draftPoints),
            })}
          </span>
        </div>
        {check.invalidCount > 0 && (
          <p className="m-0 text-xs text-muted-foreground">{t("admin.scoring.previewInvalid")}</p>
        )}
      </div>
    </Panel>
  );
}

/** Bảng điểm trận theo hạng: 2…12 ghế × hạng 1…12, hàng 12 ghế nền vàng nhạt. */
function PlacementTable({ scoring }: { scoring: ScoringConfig }) {
  const { t } = useTranslation();
  const fmt = useAdminFormat();
  const ranks = Array.from({ length: MAX_PLAYERS }, (_, r) => r);
  const seats = Array.from(
    { length: MAX_PLAYERS - MIN_PLAYERS_TO_START + 1 },
    (_, i) => i + MIN_PLAYERS_TO_START,
  );
  const cell = "h-6.5 border-b border-card-foreground/15 p-0 text-center";
  const head = "h-7 border-b-2 border-sticker p-0 text-[10.5px] font-bold text-muted-foreground";

  return (
    <Panel className="pb-3">
      <PanelHead>
        <PanelTitle>{t("admin.scoring.placementTitle")}</PanelTitle>
        <span className="text-xs text-muted-foreground">{t("admin.scoring.placementFormula")}</span>
      </PanelHead>
      <div className="overflow-x-auto px-3">
        <table
          aria-label={t("admin.scoring.placementTable")}
          className="w-full min-w-[470px] table-fixed border-collapse text-[12.5px] tabular-nums"
        >
          <thead>
            <tr>
              <th scope="col" className={cn(head, "w-16 pl-2 text-left whitespace-nowrap")}>
                {t("admin.scoring.seats")}
              </th>
              {ranks.map((r) => (
                <th key={r} scope="col" className={cn(head, "text-center")}>
                  {r + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seats.map((n) => {
              const bg = n === MAX_PLAYERS && "bg-primary/30";
              return (
                <tr key={n} className={cn(bg)}>
                  <th
                    scope="row"
                    className={cn(cell, "pl-2 text-left font-bold whitespace-nowrap")}
                  >
                    {t("admin.scoring.seatsRow", { n })}
                  </th>
                  {ranks.map((r) => (
                    <td key={r} className={cn(cell, r < 3 ? "font-extrabold" : "font-medium")}>
                      {r < n ? fmt.num(placementPoints(r, n, scoring.placementTopBonus)) : ""}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/** Lịch sử thay đổi cấu hình (20 bản gần nhất); bản cũ nạp được vào bản nháp. */
function HistoryPanel({ currentVersion }: { currentVersion: number }) {
  const { t } = useTranslation();
  const fmt = useAdminFormat();
  const savedTick = useAdminStore((s) => s.savedTick);
  const setDraft = useAdminStore((s) => s.setDraft);
  const { state, reload } = useAdminData(() => fetchSettingsHistory(HISTORY_LIMIT), [savedTick], {
    keepData: true,
  });

  function load(row: AdminSettingsHistoryRow) {
    setDraft(draftFromConfig(row.scoring, row.disabledGames, decimalSeparator()));
    toast(t("admin.scoring.historyLoaded", { version: row.version }));
  }

  return (
    <Panel>
      <PanelHead>
        <PanelTitle className="flex-1">{t("admin.scoring.historyTitle")}</PanelTitle>
        <span className="text-xs text-muted-foreground">
          {t("admin.scoring.historyCount", { n: HISTORY_LIMIT })}
        </span>
      </PanelHead>
      {state.status !== "ok" ? (
        <div className="p-3">
          <SectionState state={state} section="scoring" onRetry={reload} />
        </div>
      ) : state.data.length === 0 ? (
        <div className="border-t border-card-foreground/15 px-4 py-4 text-sm">
          <b>{t("admin.sections.scoring.emptyTitle")}</b>{" "}
          <span className="text-muted-foreground">{t("admin.sections.scoring.emptyBody")}</span>
        </div>
      ) : (
        <DataTable aria-label={t("admin.scoring.historyTitle")}>
          <TBody>
            {state.data.map((row) => {
              const current = row.version === currentVersion;
              return (
                <Row
                  key={row.id}
                  className="grid-cols-[56px_minmax(0,1fr)] @min-[560px]:grid-cols-[64px_minmax(0,1fr)_auto]"
                >
                  <td>
                    <Chip tone={current ? "sky" : "muted"}>
                      {t("admin.matches.version", { version: row.version })}
                    </Chip>
                  </td>
                  <td className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-semibold break-words">
                      {row.note ?? t("admin.scoring.historyNoNote")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("admin.scoring.historyMeta", {
                        when: fmt.when(row.changedAt),
                        who: row.changedByName ?? t("admin.scoring.unknownPerson"),
                      })}
                    </span>
                  </td>
                  <td className="col-start-2 @min-[560px]:col-start-auto">
                    {current ? (
                      <span className="text-[12.5px] font-bold text-muted-foreground">
                        {t("admin.scoring.historyCurrent")}
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        className="min-h-10 px-3 text-[15px]"
                        onClick={() => load(row)}
                      >
                        {t("admin.scoring.historyLoad")}
                      </Button>
                    )}
                  </td>
                </Row>
              );
            })}
          </TBody>
        </DataTable>
      )}
    </Panel>
  );
}
