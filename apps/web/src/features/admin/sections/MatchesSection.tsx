import { ChevronDownIcon, LoaderCircleIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useGameTextLookup } from "@/hooks/use-game-text";
import { cn } from "@/lib/utils";
import { type AdminMatch, fetchMatches } from "@/net/admin-api";
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
  PersonCell,
  Row,
  SectionHeader,
  SectionState,
  TBody,
  Th,
} from "../components/kit";
import { useAdminFormat } from "../format";
import { useAdminData } from "../hooks/use-admin-data";

const PAGE_SIZE = 30;
/** Số tên game hiện trước khi gộp "+n". */
const GAMES_SHOWN = 3;

const GRID =
  "grid-cols-[minmax(0,1fr)_auto_44px] @min-[820px]:grid-cols-[118px_86px_64px_128px_minmax(0,1fr)_76px_44px]";
const RESULT_GRID =
  "grid-cols-[32px_minmax(0,1fr)_64px] @min-[820px]:grid-cols-[40px_minmax(0,1fr)_90px_90px]";

/** Nền huy hiệu hạng 1–3 (vàng, xanh trời, cam); còn lại nền giấy. */
const RANK_BG = ["bg-primary", "bg-sky", "bg-identify"] as const;

/** Trận đấu: trận party đã kết thúc, mới nhất trước, mở từng trận xem bảng kết quả. */
export function MatchesSection() {
  const { t } = useTranslation();
  const reportFailure = useAdminStore((s) => s.reportFailure);
  const { state, reload } = useAdminData(() => fetchMatches({ limit: PAGE_SIZE }), []);
  const [extra, setExtra] = useState<AdminMatch[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

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
    // Con trỏ là cặp (`created_at`, `room_code`) của trận cuối trang (khớp thứ tự sắp của RPC).
    const last = rows[rows.length - 1];
    if (!last?.createdAt) return;
    setLoadingMore(true);
    const res = await fetchMatches({
      limit: PAGE_SIZE,
      before: { createdAt: last.createdAt, roomCode: last.roomCode },
    });
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
      <SectionHeader section="matches" />
      {state.status !== "ok" ? (
        <SectionState state={state} section="matches" onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyPanel section="matches" />
      ) : (
        <Panel>
          <DataTable aria-label={t("admin.sections.matches.title")}>
            <HeadRow className={cn(GRID, "pt-3.5")}>
              <Th>{t("admin.matches.colEnded")}</Th>
              <Th>{t("admin.matches.colCode")}</Th>
              <Th>{t("admin.matches.colRounds")}</Th>
              <Th>{t("admin.matches.colPlayers")}</Th>
              <Th>{t("admin.matches.colGames")}</Th>
              <Th>{t("admin.matches.colConfig")}</Th>
              <Th />
            </HeadRow>
            <TBody>
              {rows.map((match) => {
                const key = `${match.roomCode}|${match.createdAt}`;
                return (
                  <MatchRow
                    key={key}
                    match={match}
                    open={open === key}
                    onToggle={() => setOpen((o) => (o === key ? null : key))}
                  />
                );
              })}
            </TBody>
          </DataTable>
          <PanelFoot>
            <span>{t("admin.matches.footer")}</span>
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
                {t("admin.matches.loadMore")}
              </Button>
            )}
          </PanelFoot>
        </Panel>
      )}
    </>
  );
}

function MatchRow({
  match,
  open,
  onToggle,
}: {
  match: AdminMatch;
  open: boolean;
  onToggle(): void;
}) {
  const { t } = useTranslation();
  const fmt = useAdminFormat();
  const gameText = useGameTextLookup();
  const settings = useAdminStore((s) => s.settings);
  const resultsId = useId();
  const current = settings.status === "ok" && settings.data.version === match.settingsVersion;
  const people =
    match.botCount > 0
      ? t("admin.matches.peopleBots", {
          people: t("admin.matches.people", { count: match.players }),
          bots: t("admin.matches.bots", { count: match.botCount }),
        })
      : t("admin.matches.people", { count: match.players });
  const names = match.games.map((id) => gameText(id).title);
  const games =
    names.length > GAMES_SHOWN
      ? t("admin.matches.gamesMore", {
          list: names.slice(0, GAMES_SHOWN).join(", "),
          count: names.length - GAMES_SHOWN,
        })
      : names.join(", ") || t("admin.none");
  const when = fmt.when(match.createdAt);

  return (
    <Row className={cn(GRID, open && "bg-card-foreground/[0.04]")}>
      <td className="flex min-w-0 flex-col tabular-nums">
        <span className="font-display text-lg leading-tight tracking-[2px] @min-[820px]:hidden">
          {match.roomCode}
        </span>
        {when}
      </td>
      <td className={cn(desktopOnly, "font-display text-lg tracking-[2px]")}>{match.roomCode}</td>
      <td className={cn(desktopOnly, "tabular-nums")}>{fmt.num(match.rounds)}</td>
      <td className={desktopOnly}>{people}</td>
      <td className={cn(desktopOnly, "truncate text-muted-foreground")} title={names.join(", ")}>
        {games}
      </td>
      <td>
        <Chip tone={current ? "sky" : "muted"}>
          {t("admin.matches.version", { version: match.settingsVersion })}
        </Chip>
      </td>
      <td>
        <Button
          variant="outline"
          size="icon-sm"
          aria-expanded={open}
          aria-controls={resultsId}
          aria-label={t("admin.matches.toggle", { code: match.roomCode })}
          onClick={onToggle}
          className="size-10 border-[2.5px] shadow-[0_3px_0_var(--sticker)]"
        >
          <ChevronDownIcon
            aria-hidden
            strokeWidth={3}
            className={cn(
              "transition-transform motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </Button>
      </td>
      <td className={mobileOnly}>
        {t("admin.matches.mobileLine", { count: match.rounds, people, games })}
      </td>
      {open && (
        <td
          id={resultsId}
          className="col-span-full my-1 overflow-hidden rounded-[14px] border-[2.5px] border-sticker bg-card"
        >
          {match.results.length === 0 ? (
            <p className="m-0 px-3 py-3 text-[13px] text-muted-foreground">
              {t("admin.matches.noResults")}
            </p>
          ) : (
            <DataTable aria-label={t("admin.matches.toggle", { code: match.roomCode })}>
              <HeadRow className={cn(RESULT_GRID, "pt-2")}>
                <Th>{t("admin.matches.colRank")}</Th>
                <Th>{t("admin.players.colPlayer")}</Th>
                <Th className="text-right">{t("admin.matches.colScore")}</Th>
                <Th className="text-right">{t("admin.matches.colTotal")}</Th>
              </HeadRow>
              <TBody>
                {match.results.map((r) => (
                  <Row key={r.userId} className={cn(RESULT_GRID, "min-h-10")}>
                    <td>
                      <span
                        className={cn(
                          "inline-flex size-6.5 items-center justify-center rounded-full border-2 border-ink font-display text-[13px] leading-none font-extrabold text-ink",
                          RANK_BG[r.placement] ?? "bg-paper",
                        )}
                      >
                        {r.placement + 1}
                      </span>
                    </td>
                    <td className="min-w-0">
                      <PersonCell
                        userId={r.userId}
                        avatar={r.avatar}
                        name={r.name ?? t("admin.anonymous")}
                      />
                    </td>
                    <td className="text-right font-display text-[17px] tabular-nums">
                      {fmt.num(r.matchPoints)}
                    </td>
                    <td className={cn(desktopOnly, "text-right tabular-nums")}>
                      {fmt.num(r.totalScore)}
                    </td>
                  </Row>
                ))}
              </TBody>
            </DataTable>
          )}
        </td>
      )}
    </Row>
  );
}
