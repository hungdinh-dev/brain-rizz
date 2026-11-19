import { LoaderCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { type AdminLoginEvent, fetchLoginEvents, LOGIN_EVENTS } from "@/net/admin-api";
import type { LoginEvent } from "@/stores/auth.store";
import { useAdminStore } from "../admin.store";
import {
  Chip,
  type ChipTone,
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

const PAGE_SIZE = 50;

const GRID =
  "grid-cols-[minmax(0,1fr)_auto] @min-[820px]:grid-cols-[112px_minmax(0,1.5fr)_168px_84px_minmax(0,1fr)]";

/** Màu chip sự kiện (ui-ux 6.9): khách mới nhạt, đăng nhập xanh trời, liên kết bạc hà… */
export const EVENT_TONE: Record<LoginEvent, ChipTone> = {
  guest_created: "muted",
  google_sign_in: "sky",
  google_linked: "mint",
  session_resumed: "dashed",
  sign_out: "pink",
};

type EventFilter = LoginEvent | "all";

/** Lịch sử đăng nhập: tìm tên/email, lọc loại sự kiện, "Tải thêm" theo `p_before`. */
export function LoginsSection() {
  const { t } = useTranslation();
  const fmt = useAdminFormat();
  const reportFailure = useAdminStore((s) => s.reportFailure);
  const [query, setQuery] = useState("");
  const [event, setEvent] = useState<EventFilter>("all");
  const search = useDebounced(query);
  const filter = { query: search, event: event === "all" ? null : event };
  const { state, reload } = useAdminData(
    () => fetchLoginEvents({ ...filter, limit: PAGE_SIZE }),
    [search, event],
  );
  const [extra, setExtra] = useState<AdminLoginEvent[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Đổi bộ lọc / tải lại → bỏ các trang đã nối thêm.
  useEffect(() => {
    if (state.status === "loading") {
      setExtra([]);
      setHasMore(true);
    } else if (state.status === "ok") {
      setHasMore(state.data.length >= PAGE_SIZE);
    }
  }, [state]);

  const rows = state.status === "ok" ? [...state.data, ...extra] : [];

  async function loadMore() {
    const before = rows[rows.length - 1]?.createdAt;
    if (!before) return;
    setLoadingMore(true);
    const res = await fetchLoginEvents({ ...filter, limit: PAGE_SIZE, before });
    setLoadingMore(false);
    if (!res.ok) {
      reportFailure(res.reason);
      toast.error(t("admin.logins.loadMoreFailed"));
      return;
    }
    setExtra((prev) => [...prev, ...res.data]);
    setHasMore(res.data.length >= PAGE_SIZE);
  }

  return (
    <>
      <SectionHeader section="logins" />
      <Panel>
        <PanelHead>
          <SearchInput
            label={t("admin.logins.search")}
            placeholder={t("admin.logins.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-45 @min-[820px]:max-w-75"
          />
          <Segmented
            label={t("admin.logins.filterLabel")}
            value={event}
            onChange={setEvent}
            options={[
              { value: "all", label: t("admin.logins.all") },
              ...LOGIN_EVENTS.map((e) => ({ value: e, label: t(`admin.logins.events.${e}`) })),
            ]}
          />
        </PanelHead>
        {state.status !== "ok" ? (
          <div className="p-3">
            <SectionState state={state} section="logins" onRetry={reload} />
          </div>
        ) : rows.length === 0 ? (
          <div className="border-t border-card-foreground/15 p-3">
            <EmptyPanel section="logins" />
          </div>
        ) : (
          <DataTable aria-label={t("admin.sections.logins.title")}>
            <HeadRow className={GRID}>
              <Th>{t("admin.logins.colTime")}</Th>
              <Th>{t("admin.logins.colPlayer")}</Th>
              <Th>{t("admin.logins.colEvent")}</Th>
              <Th>{t("admin.logins.colAccount")}</Th>
              <Th>{t("admin.logins.colDevice")}</Th>
            </HeadRow>
            <TBody>
              {rows.map((row) => {
                const when = fmt.when(row.createdAt);
                const provider =
                  row.provider === "google" ? t("admin.logins.google") : t("admin.logins.guest");
                const device = row.device ?? t("admin.none");
                return (
                  <Row key={row.id} className={GRID}>
                    <td className={`${desktopOnly} tabular-nums`}>{when}</td>
                    <td className="min-w-0">
                      <PersonCell
                        userId={row.userId}
                        avatar={row.avatar}
                        name={row.name ?? t("admin.anonymous")}
                        sub={row.email ?? t("admin.logins.guest")}
                      />
                    </td>
                    <td>
                      <Chip tone={EVENT_TONE[row.event]}>
                        {t(`admin.logins.events.${row.event}`)}
                      </Chip>
                    </td>
                    <td className={desktopOnly}>{provider}</td>
                    <td className={`${desktopOnly} truncate text-muted-foreground`}>{device}</td>
                    <td className={mobileOnly}>
                      {when} · {provider} · {device}
                    </td>
                  </Row>
                );
              })}
            </TBody>
          </DataTable>
        )}
        {state.status === "ok" && rows.length > 0 && (
          <PanelFoot>
            <span>{t("admin.logins.footer", { count: rows.length })}</span>
            {hasMore && (
              <Button
                variant="outline"
                className="min-h-11"
                disabled={loadingMore}
                aria-busy={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore && (
                  <LoaderCircleIcon aria-hidden className="motion-safe:animate-spin" />
                )}
                {t("admin.logins.loadMore")}
              </Button>
            )}
          </PanelFoot>
        )}
      </Panel>
    </>
  );
}
