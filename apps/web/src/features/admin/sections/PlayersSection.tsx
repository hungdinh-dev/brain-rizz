import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { type AccountProvider, fetchOverview, fetchUsers } from "@/net/admin-api";
import {
  Chip,
  DataTable,
  desktopOnly,
  EmptyPanel,
  HeadRow,
  mobileOnly,
  Panel,
  PanelFoot,
  PanelHead,
  PersonCell,
  Row,
  SearchInput,
  SectionHeader,
  SectionState,
  Segmented,
  TBody,
  Th,
} from "../components/kit";
import { useAdminFormat } from "../format";
import { useAdminData, useDebounced } from "../hooks/use-admin-data";

const PAGE_SIZE = 20;

const GRID =
  "grid-cols-[minmax(0,1fr)_auto] @min-[820px]:grid-cols-[minmax(0,1.7fr)_84px_92px_104px_104px_52px_58px_64px]";

type ProviderFilter = AccountProvider | "all";

/** Người chơi: tìm tên/email, lọc Google/Khách (kèm số), phân trang 20 dòng. */
export function PlayersSection() {
  const { t } = useTranslation();
  const fmt = useAdminFormat();
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<ProviderFilter>("all");
  const [page, setPage] = useState(0);
  const search = useDebounced(query);
  const { state, reload } = useAdminData(
    () =>
      fetchUsers({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        query: search,
        provider: provider === "all" ? null : provider,
      }),
    [search, provider, page],
  );
  // Số tài khoản cho nhóm nút (lỗi thì nhóm nút không kèm số).
  const totals = useAdminData(() => fetchOverview(1), []);

  // Đổi bộ lọc → về trang đầu.
  // biome-ignore lint/correctness/useExhaustiveDependencies: chỉ chạy khi bộ lọc đổi
  useEffect(() => setPage(0), [search, provider]);

  const counts =
    totals.state.status === "ok"
      ? {
          all: totals.state.data.totals.users,
          google: totals.state.data.totals.googleUsers,
          anonymous: totals.state.data.totals.guestUsers,
        }
      : null;
  const option = (value: ProviderFilter, label: string) => ({
    value,
    label: counts ? t("admin.players.withCount", { label, n: fmt.num(counts[value]) }) : label,
  });

  const total = state.status === "ok" ? state.data.total : 0;
  const from = page * PAGE_SIZE;

  return (
    <>
      <SectionHeader section="players" />
      <Panel>
        <PanelHead>
          <SearchInput
            label={t("admin.players.search")}
            placeholder={t("admin.players.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-45 @min-[820px]:max-w-75"
          />
          <Segmented
            label={t("admin.players.providerLabel")}
            value={provider}
            onChange={setProvider}
            options={[
              option("all", t("admin.players.all")),
              option("google", t("admin.players.google")),
              option("anonymous", t("admin.players.guest")),
            ]}
          />
        </PanelHead>
        {state.status !== "ok" ? (
          <div className="p-3">
            <SectionState state={state} section="players" onRetry={reload} />
          </div>
        ) : state.data.rows.length === 0 ? (
          <div className="border-t border-card-foreground/15 p-3">
            <EmptyPanel
              section="players"
              body={
                search.trim() ? t("admin.players.emptyQuery", { query: search.trim() }) : undefined
              }
            />
          </div>
        ) : (
          <DataTable aria-label={t("admin.sections.players.title")}>
            <HeadRow className={GRID}>
              <Th>{t("admin.players.colPlayer")}</Th>
              <Th>{t("admin.players.colType")}</Th>
              <Th>{t("admin.players.colCreated")}</Th>
              <Th>{t("admin.players.colLogin")}</Th>
              <Th>{t("admin.players.colSeen")}</Th>
              <Th className="text-right">{t("admin.players.colMatches")}</Th>
              <Th className="text-right">{t("admin.players.colBrain")}</Th>
              <Th className="text-right">{t("admin.players.colRecords")}</Th>
            </HeadRow>
            <TBody>
              {state.data.rows.map((row) => {
                const seen = fmt.when(row.lastSeenAt);
                return (
                  <Row key={row.userId} className={GRID}>
                    <td className="min-w-0">
                      <PersonCell
                        userId={row.userId}
                        avatar={row.avatar}
                        name={row.name ?? t("admin.anonymous")}
                        sub={row.email ?? t("admin.players.notLinked")}
                        badge={
                          row.isAdmin && (
                            <Chip tone="sun" className="h-4.5 px-1.5 text-[10px]">
                              {t("admin.players.adminChip")}
                            </Chip>
                          )
                        }
                      />
                    </td>
                    <td>
                      <Chip tone={row.provider === "google" ? "sky" : "muted"}>
                        {row.provider === "google"
                          ? t("admin.players.google")
                          : t("admin.players.guest")}
                      </Chip>
                    </td>
                    <td className={`${desktopOnly} tabular-nums`}>{fmt.date(row.createdAt)}</td>
                    <td className={`${desktopOnly} tabular-nums`}>{fmt.when(row.lastSignInAt)}</td>
                    <td className={`${desktopOnly} tabular-nums`}>{seen}</td>
                    <td className={`${desktopOnly} text-right tabular-nums`}>
                      {fmt.num(row.matches)}
                    </td>
                    <td className={`${desktopOnly} text-right tabular-nums`}>
                      {fmt.num(row.brainTests)}
                    </td>
                    <td className={`${desktopOnly} text-right tabular-nums`}>
                      {fmt.num(row.practiceRecords)}
                    </td>
                    <td className={mobileOnly}>
                      {t("admin.players.mobileLine", {
                        seen,
                        matches: fmt.num(row.matches),
                        brain: fmt.num(row.brainTests),
                        records: fmt.num(row.practiceRecords),
                      })}
                    </td>
                  </Row>
                );
              })}
            </TBody>
          </DataTable>
        )}
        {state.status === "ok" && total > 0 && (
          <PanelFoot className="justify-end">
            <span className="tabular-nums">
              {t("admin.players.range", {
                from: fmt.num(from + 1),
                to: fmt.num(Math.min(total, from + state.data.rows.length)),
                total: fmt.num(total),
              })}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-11"
              aria-label={t("admin.players.prev")}
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-11"
              aria-label={t("admin.players.next")}
              disabled={from + PAGE_SIZE >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRightIcon aria-hidden />
            </Button>
          </PanelFoot>
        )}
      </Panel>
    </>
  );
}
