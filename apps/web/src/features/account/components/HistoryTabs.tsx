import { DIFFICULTIES, GAME_IDS, GAMES, type GameId } from "@brain-rizz/shared";
import { BrainIcon, HousePlusIcon, TargetIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BrainRadar } from "@/components/common/BrainRadar";
import { DataProblemState, EmptyState } from "@/components/common/EmptyState";
import { CATEGORY_BG } from "@/components/common/MatchChips";
import { RankBadge } from "@/components/common/RankBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  loadRecords,
  mergeRemoteBests,
  type PracticeRecords,
  playedGames,
} from "@/features/practice";
import { useData } from "@/hooks/use-data";
import { useDateFormat } from "@/hooks/use-date-format";
import { useGameTextLookup } from "@/hooks/use-game-text";
import { useNumberFormat } from "@/hooks/use-number-format";
import { cn } from "@/lib/utils";
import {
  type BrainTestRow,
  fetchBrainHistory,
  fetchMatchHistory,
  fetchPracticeBests,
  type MatchRow,
} from "@/net/data-api";
import type { Screen } from "@/stores/nav.store";
import { ScoreTrend } from "./ScoreTrend";

interface HistoryTabsProps {
  /** Đổi khi phiên đổi (liên kết / đăng nhập Google, xoá dữ liệu) → tải lại. */
  sessionKey: string;
  go(screen: Screen): void;
}

/** Lịch sử 3 tab (FR-MR-09, khu 15): Kiểm tra não · Trận party · Luyện tập. */
export function HistoryTabs({ sessionKey, go }: HistoryTabsProps) {
  const { t } = useTranslation();
  return (
    <Tabs defaultValue="brain" className="min-w-0 flex-1">
      <TabsList aria-label={t("account.historyLabel")} className="px-2 lg:px-3">
        <TabsTrigger value="brain" className="px-3 lg:px-4">
          {t("account.tabBrain")}
        </TabsTrigger>
        <TabsTrigger value="party" className="px-3 lg:px-4">
          {t("account.tabParty")}
        </TabsTrigger>
        <TabsTrigger value="practice" className="px-3 lg:px-4">
          {t("account.tabPractice")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="brain" className="min-h-72">
        <BrainTab sessionKey={sessionKey} go={go} />
      </TabsContent>
      <TabsContent value="party" className="min-h-72">
        <PartyTab sessionKey={sessionKey} go={go} />
      </TabsContent>
      <TabsContent value="practice" className="min-h-72">
        <PracticeTab sessionKey={sessionKey} go={go} />
      </TabsContent>
    </Tabs>
  );
}

/** Khung nhạt giữ chỗ khi đang tải (giữ bố cục, có aria-busy). */
function TabLoading() {
  const { t } = useTranslation();
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">{t("common.loading")}</span>
      <Skeleton className="h-28 w-full" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

function stateView(status: string, reload: () => void, empty: ReactNode): ReactNode | undefined {
  if (status === "loading") return <TabLoading />;
  if (status === "not-configured") return <DataProblemState problem="not-configured" />;
  if (status === "error") return <DataProblemState problem="error" onRetry={reload} />;
  if (status === "no-session") return empty;
  return undefined;
}

/** Bảng có thể cuộn ngang trong khung trên điện thoại. */
function TableBox({ children }: { children: ReactNode }) {
  return <div className="-mx-1 overflow-x-auto px-1">{children}</div>;
}

const TH = "h-9 px-2 text-left text-xs font-bold whitespace-nowrap text-muted-foreground";
const TD = "h-11 border-t-2 border-dashed border-border/15 px-2 text-sm whitespace-nowrap";

function GameDots({ games }: { games: { gameId: GameId }[] }) {
  return (
    <span className="inline-flex shrink-0 gap-1" aria-hidden>
      {games.map((g) => (
        <span
          key={g.gameId}
          className={cn(
            "size-3 rounded-full border-2 border-ink",
            CATEGORY_BG[GAMES[g.gameId].category],
          )}
        />
      ))}
    </span>
  );
}

function BrainTab({ sessionKey, go }: { sessionKey: string; go(s: Screen): void }) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const date = useDateFormat();
  const text = useGameTextLookup();
  const data = useData(() => fetchBrainHistory(50), [sessionKey]);
  const empty = (
    <EmptyState
      icon={BrainIcon}
      tone="bg-pink"
      title={t("account.emptyBrainTitle")}
      body={t("account.emptyBrainBody")}
      action={<Button onClick={() => go("brain-test")}>{t("account.emptyBrainCta")}</Button>}
    />
  );
  const other = stateView(data.status, data.reload, empty);
  if (other) return other;
  const rows = (data as { data: BrainTestRow[] }).data;
  if (rows.length === 0) return empty;
  const latest = rows[0]!;
  const best = rows.reduce((m, r) => Math.max(m, r.brainScore), 0);
  const names = (r: BrainTestRow) => {
    const list = r.games.map((g) => text(g.gameId).title);
    return list.length > 3 ? `${list.slice(0, 3).join(", ")}…` : list.join(", ");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
        <div className="flex items-center gap-3">
          <BrainRadar
            compact
            skills={latest.skills}
            previous={rows[1]?.skills}
            className="w-30 shrink-0"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-bold text-muted-foreground">
              {t("account.latest", { date: date.short(latest.createdAt) })}
            </span>
            <span className="font-display text-[40px] leading-none font-extrabold">
              {fmt(latest.brainScore)}
            </span>
            <span className="text-[13px] font-semibold">
              {t("account.bestAndCount", { best: fmt(best), count: rows.length })}
            </span>
          </span>
        </div>
        <ScoreTrend rows={rows} />
      </div>
      <TableBox>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th scope="col" className={TH}>
                {t("account.colDate")}
              </th>
              <th scope="col" className={TH}>
                {t("account.colBrainScore")}
              </th>
              <th scope="col" className={TH}>
                {t("account.colGames")}
              </th>
              <th scope="col" className={TH}>
                <span className="sr-only">{t("account.bestTag")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={TD}>{date.short(r.createdAt)}</td>
                <td className={cn(TD, "font-display text-lg font-extrabold")}>
                  {fmt(r.brainScore)}
                </td>
                <td className={TD}>
                  <span className="flex items-center gap-2">
                    <GameDots games={r.games} />
                    <span className="max-w-56 truncate text-[13px] text-muted-foreground">
                      {names(r)}
                    </span>
                  </span>
                </td>
                <td className={TD}>
                  {r.brainScore === best && (
                    <span className="rounded-lg border-2 border-ink bg-primary px-2 py-0.5 text-xs font-bold text-ink">
                      {t("account.bestTag")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableBox>
    </div>
  );
}

function PartyTab({ sessionKey, go }: { sessionKey: string; go(s: Screen): void }) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const date = useDateFormat();
  const text = useGameTextLookup();
  const data = useData(() => fetchMatchHistory(50), [sessionKey]);
  const empty = (
    <EmptyState
      icon={HousePlusIcon}
      tone="bg-mint"
      title={t("account.emptyPartyTitle")}
      body={t("account.emptyPartyBody")}
      action={<Button onClick={() => go("menu")}>{t("account.emptyPartyCta")}</Button>}
    />
  );
  const other = stateView(data.status, data.reload, empty);
  if (other) return other;
  const rows = (data as { data: MatchRow[] }).data;
  if (rows.length === 0) return empty;
  const games = (m: MatchRow) => {
    const list = m.games.map((g) => text(g).title);
    return list.length > 3
      ? `${list.slice(0, 3).join(", ")}, +${list.length - 3}`
      : list.join(", ");
  };

  return (
    <TableBox>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th scope="col" className={TH}>
              {t("account.colDate")}
            </th>
            <th scope="col" className={TH}>
              {t("account.colRoom")}
            </th>
            <th scope="col" className={TH}>
              {t("account.colRank")}
            </th>
            <th scope="col" className={TH}>
              {t("account.colMatchPoints")}
            </th>
            <th scope="col" className={TH}>
              {t("account.colRounds")}
            </th>
            <th scope="col" className={TH}>
              {t("account.colPlayedGames")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td className={TD}>{date.short(m.createdAt)}</td>
              <td className={cn(TD, "font-display font-extrabold tracking-wider")}>{m.roomCode}</td>
              <td className={TD}>
                <span className="flex items-center gap-1.5">
                  <RankBadge rank={m.placement + 1} size="md" />
                  <span className="text-xs text-muted-foreground">
                    {t("account.rankOf", { count: m.players })}
                  </span>
                </span>
              </td>
              <td className={cn(TD, "font-display text-lg font-extrabold")}>
                {fmt(m.matchPoints)}
              </td>
              <td className={TD}>{m.rounds}</td>
              <td className={cn(TD, "max-w-64 truncate text-[13px] text-muted-foreground")}>
                {games(m)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableBox>
  );
}

function PracticeTab({ sessionKey, go }: { sessionKey: string; go(s: Screen): void }) {
  const data = useData(() => fetchPracticeBests(), [sessionKey]);
  const local = loadRecords();
  // Không tải được kỷ lục trên tài khoản → vẫn hiện kỷ lục trên máy.
  const records = data.status === "ok" ? mergeRemoteBests(local, data.data) : local;
  if (data.status === "loading") return <TabLoading />;
  return <PracticeTable records={records} go={go} />;
}

/** Bảng kỷ lục game × 4 độ khó + số lượt; điện thoại: mỗi game một thẻ 4 ô. */
export function PracticeTable({ records, go }: { records: PracticeRecords; go(s: Screen): void }) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const text = useGameTextLookup();
  const ids = playedGames(records);
  if (ids.length === 0) {
    return (
      <EmptyState
        icon={TargetIcon}
        tone="bg-sun"
        title={t("account.emptyPracticeTitle")}
        body={t("account.emptyPracticeBody")}
        action={<Button onClick={() => go("practice")}>{t("account.emptyPracticeCta")}</Button>}
      />
    );
  }
  const cell = (id: GameId, d: (typeof DIFFICULTIES)[number]) => {
    const b = records.bests[`${id}:${d}`];
    return b && b.plays > 0 ? fmt(b.score) : t("common.none");
  };
  const plays = (id: GameId) =>
    DIFFICULTIES.reduce<number>((sum, d) => sum + (records.bests[`${id}:${d}`]?.plays ?? 0), 0);
  // Giữ thứ tự danh mục (GAME_IDS) để hai lần mở không nhảy dòng.
  const sorted = GAME_IDS.filter((id) => ids.includes(id));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted-foreground">
        {t("account.practiceSummary", { count: sorted.length })}
      </p>
      <TableBox>
        <table className="hidden w-full border-collapse md:table">
          <thead>
            <tr>
              <th scope="col" className={TH}>
                {t("account.colGame")}
              </th>
              {DIFFICULTIES.map((d) => (
                <th key={d} scope="col" className={cn(TH, "text-right")}>
                  {t(`difficulty.${d}`)}
                </th>
              ))}
              <th scope="col" className={cn(TH, "text-right")}>
                {t("account.colPlays")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((id) => (
              <tr key={id}>
                <th scope="row" className={cn(TD, "text-left font-bold")}>
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        "size-3 rounded-full border-2 border-ink",
                        CATEGORY_BG[GAMES[id].category],
                      )}
                    />
                    {text(id).title}
                  </span>
                </th>
                {DIFFICULTIES.map((d) => (
                  <td
                    key={d}
                    className={cn(TD, "text-right font-display text-base font-extrabold")}
                  >
                    {cell(id, d)}
                  </td>
                ))}
                <td className={cn(TD, "text-right")}>{plays(id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableBox>
      <ul className="flex flex-col gap-2.5 md:hidden">
        {sorted.map((id) => (
          <li
            key={id}
            className="flex flex-col gap-1.5 border-b-2 border-dashed border-border/15 pb-2.5 last:border-b-0"
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "size-3 rounded-full border-2 border-ink",
                  CATEGORY_BG[GAMES[id].category],
                )}
              />
              <span className="flex-1 truncate font-display text-base font-extrabold">
                {text(id).title}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("account.playsCount", { count: plays(id) })}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              {DIFFICULTIES.map((d) => (
                <span key={d} className="flex flex-col rounded-[10px] bg-muted py-1">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {t(`difficulty.${d}`)}
                  </span>
                  <span className="font-display text-[15px] font-extrabold">{cell(id, d)}</span>
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
