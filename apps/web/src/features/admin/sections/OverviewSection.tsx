import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { type AdminDailyRow, type AdminOverview, fetchOverview } from "@/net/admin-api";
import { useAdminStore } from "../admin.store";
import { BarChart } from "../components/BarChart";
import {
  DataTable,
  EmptyPanel,
  Panel,
  PanelHead,
  PanelTitle,
  RefreshButton,
  Row,
  SectionHeader,
  SectionState,
  Segmented,
  TBody,
} from "../components/kit";
import { useAdminFormat } from "../format";
import { useAdminData } from "../hooks/use-admin-data";
import { compareToYesterday } from "../stats";

/** Số ngày của biểu đồ (RPC `admin_overview(p_days)`). */
const OVERVIEW_DAYS = 14;

const METRICS = ["logins", "activeUsers", "newUsers", "matches", "brainTests"] as const;
type Metric = (typeof METRICS)[number];

function isEmpty(o: AdminOverview) {
  return o.totals.users === 0 && o.totals.matches === 0 && o.totals.brainTests === 0;
}

/** Tổng quan: 4 thẻ hôm nay · biểu đồ 14 ngày · thẻ Tổng cộng. */
export function OverviewSection() {
  const { t } = useTranslation();
  const fmt = useAdminFormat();
  const { state, reload, refreshing, loadedAt } = useAdminData(
    () => fetchOverview(OVERVIEW_DAYS),
    [],
    { keepData: true },
  );

  return (
    <>
      <SectionHeader section="overview">
        {loadedAt !== null && state.status === "ok" && (
          <span>{t("admin.updatedAt", { time: fmt.time(loadedAt) })}</span>
        )}
        <RefreshButton onClick={reload} busy={refreshing} />
      </SectionHeader>
      {state.status !== "ok" ? (
        <SectionState state={state} section="overview" onRetry={reload} />
      ) : isEmpty(state.data) ? (
        <EmptyPanel section="overview" />
      ) : (
        <OverviewBody data={state.data} />
      )}
    </>
  );
}

function OverviewBody({ data }: { data: AdminOverview }) {
  const { t } = useTranslation();
  const fmt = useAdminFormat();
  const roomCount = useAdminStore((s) => s.roomCount);
  const [metric, setMetric] = useState<Metric>("logins");
  const yesterday: AdminDailyRow | undefined = data.daily[data.daily.length - 2];

  const kpis = [
    { label: t("admin.overview.kpiLogins"), value: data.today.logins, prev: yesterday?.logins },
    {
      label: t("admin.overview.kpiActive"),
      value: data.today.activeUsers,
      prev: yesterday?.activeUsers,
    },
    { label: t("admin.overview.kpiNew"), value: data.today.newUsers, prev: yesterday?.newUsers },
    { label: t("admin.overview.kpiMatches"), value: data.today.matches, prev: yesterday?.matches },
  ];

  const totals = [
    {
      label: t("admin.overview.totalPlayers"),
      sub: t("admin.overview.totalPlayersSub", {
        google: fmt.num(data.totals.googleUsers),
        guest: fmt.num(data.totals.guestUsers),
      }),
      value: fmt.num(data.totals.users),
    },
    {
      label: t("admin.overview.totalMatches"),
      sub: t("admin.overview.totalMatchesSub"),
      value: fmt.num(data.totals.matches),
    },
    { label: t("admin.overview.totalBrain"), sub: "", value: fmt.num(data.totals.brainTests) },
    {
      label: t("admin.overview.totalRecords"),
      sub: t("admin.overview.totalRecordsSub"),
      value: fmt.num(data.totals.practiceRecords),
    },
    {
      label: t("admin.overview.totalRooms"),
      sub: t("admin.overview.totalRoomsSub"),
      value: roomCount === null ? t("admin.none") : fmt.num(roomCount),
    },
    { label: t("admin.overview.totalAdmins"), sub: "", value: fmt.num(data.totals.admins) },
  ];

  const metricLabel = t(`admin.overview.metrics.${metric}`);

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 @min-[820px]:grid-cols-4 @min-[820px]:gap-3">
        {kpis.map((k) => {
          const c = compareToYesterday(k.value, k.prev);
          return (
            <Panel key={k.label} className="flex flex-col gap-1 px-3.5 py-3">
              <span className="text-[12.5px] font-bold text-muted-foreground">{k.label}</span>
              <span className="font-display text-[32px] leading-none font-extrabold tabular-nums">
                {fmt.num(k.value)}
              </span>
              <span
                className={cn(
                  "text-xs font-semibold",
                  c.up ? "text-highlight" : "text-muted-foreground",
                )}
              >
                {t(`admin.overview.${c.key}`, { n: fmt.num(c.n) })}
              </span>
            </Panel>
          );
        })}
      </div>
      <div className="grid items-start gap-4.5 @min-[820px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHead>
            <PanelTitle className="flex-1">
              {t("admin.overview.chartTitle", { count: data.daily.length })}
            </PanelTitle>
            <Segmented
              label={t("admin.overview.metricLabel")}
              value={metric}
              onChange={setMetric}
              options={METRICS.map((m) => ({
                value: m,
                label: t(`admin.overview.metrics.${m}`),
              }))}
            />
          </PanelHead>
          <BarChart
            metricLabel={metricLabel}
            points={data.daily.map((d) => ({ day: d.day, value: d[metric] }))}
          />
          <p className="mx-4 mt-2 mb-3.5 text-xs text-muted-foreground">
            {t("admin.overview.chartHint")}
          </p>
        </Panel>
        <Panel>
          <PanelHead>
            <PanelTitle>{t("admin.overview.totals")}</PanelTitle>
          </PanelHead>
          <DataTable aria-label={t("admin.overview.totals")}>
            <TBody>
              {totals.map((row) => (
                <Row key={row.label} className="min-h-11 grid-cols-[minmax(0,1fr)_auto]">
                  <td>
                    {row.label}
                    {row.sub && (
                      <span className="block text-[11.5px] text-muted-foreground">{row.sub}</span>
                    )}
                  </td>
                  <td className="font-display text-xl font-extrabold tabular-nums">{row.value}</td>
                </Row>
              ))}
            </TBody>
          </DataTable>
        </Panel>
      </div>
    </>
  );
}
