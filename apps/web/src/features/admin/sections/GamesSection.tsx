import {
  CATEGORIES,
  type Category,
  type Difficulty,
  GAME_IDS,
  GAMES,
  type GameId,
  type Quad,
} from "@brain-rizz/shared";
import { RotateCcwIcon } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CategoryChip } from "@/components/common/MatchChips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useGameTextLookup } from "@/hooks/use-game-text";
import { cn } from "@/lib/utils";
import { type AdminGameStat, fetchGameStats } from "@/net/admin-api";
import { useAdminStore } from "../admin.store";
import { GameIcon } from "../components/GameIcon";
import {
  Chip,
  DataTable,
  desktopOnly,
  EmptyPanel,
  ErrorPanel,
  HeadRow,
  LoadingPanel,
  mobileOnly,
  Panel,
  PanelHead,
  Row,
  SearchInput,
  SectionHeader,
  Segmented,
  TBody,
  Th,
} from "../components/kit";
import {
  baseMultiplier,
  type Cells,
  checkDraft,
  DIFFICULTIES,
  draftGeneral,
  enabledCount,
  formatDraftNumber,
  isOverrideCell,
  isToggleLocked,
  resetGame,
  setCell,
  setGameEnabled,
} from "../draft";
import { useAdminFormat } from "../format";
import { useAdminData } from "../hooks/use-admin-data";

type Period = "30" | "all";
type Filter = Category | "all";

/** Lưới hàng: điện thoại 3 cột + hàng hệ số; máy tính 8 cột (ui-ux 6.9). */
const GRID =
  "grid-cols-[46px_minmax(0,1fr)_56px] @min-[820px]:grid-cols-[52px_minmax(0,1fr)_96px_56px_268px_56px_96px_84px]";

/**
 * Mục Game: mọi game trong `GAME_IDS` — bật/tắt (giữ ≥ 2 game bật), 4 ô hệ số hiệu lực (ghi đè
 * được, nút về mặc định của game), số liệu `admin_game_stats`. Thay đổi vào bản nháp chung.
 */
export function GamesSection() {
  const { t } = useTranslation();
  const settings = useAdminStore((s) => s.settings);
  const draft = useAdminStore((s) => s.draft);
  const loadSettings = useAdminStore((s) => s.loadSettings);
  const gameText = useGameTextLookup();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [period, setPeriod] = useState<Period>("30");
  const stats = useAdminData(() => fetchGameStats(period === "30" ? 30 : null), [period], {
    keepData: true,
  });

  const fields = draft?.fields;
  const general = useMemo(() => (fields ? draftGeneral({ fields }) : null), [fields]);
  const check = useMemo(() => (draft ? checkDraft(draft) : null), [draft]);
  const statsById = useMemo(
    () =>
      stats.state.status === "ok"
        ? new Map(stats.state.data.map((s) => [s.gameId, s]))
        : new Map<GameId, AdminGameStat>(),
    [stats.state],
  );

  const onToggle = useCallback(
    (id: GameId, on: boolean) => {
      const { draft: current, setDraft } = useAdminStore.getState();
      if (!current) return;
      const next = setGameEnabled(current, id, on);
      if (next) setDraft(next);
      else toast.error(t("admin.games.minTwo"), { id: "admin-min-two" });
    },
    [t],
  );
  const onCell = useCallback((id: GameId, d: Difficulty, text: string) => {
    const { draft: current, setDraft } = useAdminStore.getState();
    if (current) setDraft(setCell(current, id, d, text));
  }, []);
  const onReset = useCallback((id: GameId) => {
    const { draft: current, setDraft } = useAdminStore.getState();
    if (current) setDraft(resetGame(current, id));
  }, []);

  const needle = query.trim().toLocaleLowerCase();
  const ids = GAME_IDS.filter(
    (id) =>
      (filter === "all" || GAMES[id].category === filter) &&
      (!needle || id.includes(needle) || gameText(id).title.toLocaleLowerCase().includes(needle)),
  );

  let body: React.ReactNode;
  if (settings.status === "loading" || !draft || !general || !check) {
    body =
      settings.status === "loading" || settings.status === "ok" ? (
        <LoadingPanel section="games" />
      ) : (
        <ErrorPanel
          section="scoring"
          reason={settings.status}
          onRetry={() => void loadSettings()}
        />
      );
  } else {
    body = (
      <Panel>
        <PanelHead>
          <Chip tone="mint" className="h-7.5 text-[13px]">
            {t("admin.games.enabledCount", {
              on: enabledCount(draft),
              total: GAME_IDS.length,
            })}
          </Chip>
          <SearchInput
            label={t("admin.games.search")}
            placeholder={t("admin.games.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-40 @min-[820px]:max-w-65"
          />
          <Segmented
            label={t("admin.games.filterLabel")}
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: t("admin.games.all") },
              ...CATEGORIES.map((c) => ({ value: c, label: t(`category.${c}`) })),
            ]}
          />
          <span className="ml-auto flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
            {t("admin.games.period")}
            <Segmented
              label={t("admin.games.period")}
              value={period}
              onChange={setPeriod}
              options={[
                { value: "30", label: t("admin.games.period30") },
                { value: "all", label: t("admin.games.periodAll") },
              ]}
            />
          </span>
        </PanelHead>
        {stats.state.status !== "ok" && stats.state.status !== "loading" && (
          <p role="alert" className="mx-3 mb-2 text-[12.5px] text-destructive @min-[820px]:mx-4">
            {t("admin.games.statsError")}
          </p>
        )}
        {ids.length === 0 ? (
          <div className="border-t border-card-foreground/15 p-3">
            <EmptyPanel section="games" />
          </div>
        ) : (
          <DataTable aria-label={t("admin.sections.games.title")}>
            <HeadRow className={GRID}>
              <Th />
              <Th>{t("admin.games.colGame")}</Th>
              <Th>{t("admin.games.colCategory")}</Th>
              <Th>{t("admin.games.colOn")}</Th>
              <Th>{t("admin.games.colMult")}</Th>
              <Th className="text-right">{t("admin.games.colParty")}</Th>
              <Th className="text-right">{t("admin.games.colBrain")}</Th>
              <Th className="text-right">{t("admin.games.colPractice")}</Th>
            </HeadRow>
            <TBody>
              {ids.map((id) => (
                <GameRow
                  key={id}
                  id={id}
                  name={gameText(id).title}
                  off={draft.disabled.includes(id)}
                  locked={isToggleLocked(draft, id)}
                  cells={draft.overrides[id]}
                  general={general}
                  errorMask={(check.cellErrors[id] ?? []).map((e) => (e ? "1" : "0")).join("")}
                  stat={statsById.get(id)}
                  statsLoading={stats.state.status === "loading"}
                  onToggle={onToggle}
                  onCell={onCell}
                  onReset={onReset}
                />
              ))}
            </TBody>
          </DataTable>
        )}
        <p className="m-0 border-t border-card-foreground/15 px-3 py-3 text-[12.5px] leading-normal text-muted-foreground @min-[820px]:px-4">
          {t("admin.games.footnote")}
        </p>
      </Panel>
    );
  }

  return (
    <>
      <SectionHeader section="games" />
      {body}
    </>
  );
}

interface GameRowProps {
  id: GameId;
  name: string;
  off: boolean;
  locked: boolean;
  cells: Cells | undefined;
  general: Quad;
  /** "0100": ô hệ số sai theo độ khó (chuỗi để `memo` so sánh được). */
  errorMask: string;
  stat: AdminGameStat | undefined;
  statsLoading: boolean;
  onToggle(id: GameId, on: boolean): void;
  onCell(id: GameId, d: Difficulty, text: string): void;
  onReset(id: GameId): void;
}

const GameRow = memo(function GameRow({
  id,
  name,
  off,
  locked,
  cells,
  general,
  errorMask,
  stat,
  statsLoading,
  onToggle,
  onCell,
  onReset,
}: GameRowProps) {
  const { t, i18n } = useTranslation();
  const fmt = useAdminFormat();
  const decimal = i18n.resolvedLanguage === "vi" ? "," : ".";
  const dim = off && "opacity-55";
  const hasOverride = DIFFICULTIES.some((d) =>
    isOverrideCell(cells?.[d] ?? null, baseMultiplier(id, d, general)),
  );
  const none = t("admin.none");
  const statText = (n: number | undefined) =>
    statsLoading && !stat ? "…" : n === undefined ? none : fmt.num(n);
  const brain = stat
    ? `${fmt.num(stat.brainPlays)} · ${stat.brainAvgScore === null ? none : fmt.dec(stat.brainAvgScore, 0)}`
    : statText(undefined);

  return (
    <Row className={GRID}>
      <td className={cn(dim)}>
        <GameIcon id={id} />
      </td>
      <td className={cn("flex min-w-0 flex-col gap-0.5", dim)}>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-display text-base leading-tight font-extrabold">
            {name}
          </span>
          {off && (
            <Chip tone="dashed" className="h-5 px-1.5 text-[10.5px]">
              {t("admin.games.off")}
            </Chip>
          )}
        </span>
        <span className="truncate font-mono text-xs text-muted-foreground">{id}</span>
        <span className="@min-[820px]:hidden">
          <CategoryChip category={GAMES[id].category} className="h-5 text-[10.5px]" />
        </span>
      </td>
      <td className={cn(desktopOnly, dim)}>
        <CategoryChip category={GAMES[id].category} />
      </td>
      <td className="flex h-11 w-14 items-center justify-center">
        <Switch
          checked={!off}
          aria-label={t("admin.games.enable", { name })}
          aria-disabled={locked || undefined}
          title={locked ? t("admin.games.minTwo") : undefined}
          className={cn(locked && "opacity-40")}
          onCheckedChange={(on) => onToggle(id, on)}
        />
      </td>
      <td
        className={cn(
          "col-span-full grid grid-cols-[repeat(4,minmax(0,1fr))_44px] items-center gap-1.5 @min-[820px]:col-span-1 @min-[820px]:grid-cols-[repeat(4,50px)_40px]",
          dim,
        )}
      >
        <fieldset aria-label={t("admin.games.multGroup", { name })} className="contents">
          {DIFFICULTIES.map((d) => {
            const base = baseMultiplier(id, d, general);
            const cell = cells?.[d] ?? null;
            const overridden = isOverrideCell(cell, base);
            return (
              <Input
                key={d}
                type="text"
                inputMode="decimal"
                value={cell ?? formatDraftNumber(base, decimal)}
                onChange={(e) => onCell(id, d, e.target.value)}
                aria-label={t("admin.games.multCell", { name, level: t(`difficulty.${d}`) })}
                aria-invalid={errorMask[d] === "1" || undefined}
                title={
                  overridden
                    ? t("admin.games.overrideTitle", { value: fmt.dec(base, 3) })
                    : t("admin.games.defaultTitle")
                }
                className={cn(
                  "h-11 rounded-[10px] border-[2.5px] px-1 text-center text-sm tabular-nums @min-[820px]:h-10",
                  overridden && "bg-primary/30 font-extrabold",
                )}
              />
            );
          })}
        </fieldset>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={!hasOverride}
          aria-label={t("admin.games.reset", { name })}
          title={t("admin.games.resetTitle")}
          onClick={() => onReset(id)}
          className="size-10 border-[2.5px] shadow-[0_3px_0_var(--sticker)]"
        >
          <RotateCcwIcon aria-hidden />
        </Button>
      </td>
      <td className={cn(desktopOnly, "text-right tabular-nums", dim)}>
        {statText(stat?.partyMatches)}
      </td>
      <td className={cn(desktopOnly, "text-right tabular-nums", dim)}>{brain}</td>
      <td className={cn(desktopOnly, "text-right tabular-nums", dim)}>
        {statText(stat?.practicePlayers)}
      </td>
      <td className={cn(mobileOnly, dim)}>
        {t("admin.games.statsLine", {
          party: statText(stat?.partyMatches),
          brain,
          practice: statText(stat?.practicePlayers),
        })}
      </td>
    </Row>
  );
});
