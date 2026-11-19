import { CATEGORIES, GAME_IDS, GAMES, type GameId } from "@brain-rizz/shared";
import { ChevronDownIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CATEGORY_BG } from "@/components/common/MatchChips";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useData } from "@/hooks/use-data";
import { useDateFormat } from "@/hooks/use-date-format";
import { useGameTextLookup } from "@/hooks/use-game-text";
import { cn } from "@/lib/utils";
import {
  fetchLeaderboard,
  fetchMyRank,
  type LeaderboardBoard,
  type LeaderboardPeriod,
} from "@/net/data-api";
import { useAuth } from "@/stores/auth.store";
import { useNav } from "@/stores/nav.store";
import { type BoardState, BoardView } from "./components/BoardView";
import { vnWeekStart } from "./week";

type Tab = "brain" | "game";

/**
 * Bảng xếp hạng (UC-19, khu 16): Điểm Não / Theo minigame, Tuần này / Mọi thời đại, top 50,
 * dòng của mình. Xem được khi chưa đăng nhập (không tạo phiên); hạng của mình chỉ khi đã có phiên.
 * Tab và game nằm trên đường dẫn (CR-022): `/leaderboard` = Điểm Não, `/leaderboard/<gameId>`.
 */
export function LeaderboardScreen() {
  const { t } = useTranslation();
  const go = useNav((s) => s.go);
  const goBack = useNav((s) => s.goBack);
  const routeGame = useNav((s) => (s.route.screen === "leaderboard" ? s.route.gameId : undefined));
  const userId = useAuth((s) => s.userId);
  const date = useDateFormat();
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  // Game chọn lần cuối: sang tab Điểm Não rồi quay lại "Theo minigame" vẫn mở game đó.
  const [lastGame, setLastGame] = useState<GameId>(routeGame ?? GAME_IDS[0]);
  useEffect(() => {
    if (routeGame) setLastGame(routeGame);
  }, [routeGame]);

  const tab: Tab = routeGame ? "game" : "brain";
  const gameId = routeGame ?? lastGame;
  const setTab = (next: Tab) =>
    go(next === "game" ? { screen: "leaderboard", gameId: lastGame } : { screen: "leaderboard" });
  const setGameId = (id: GameId) => go({ screen: "leaderboard", gameId: id });

  const board: LeaderboardBoard = tab === "brain" ? { kind: "brain" } : { kind: "game", gameId };
  const key = `${tab}:${tab === "game" ? gameId : ""}:${period}`;
  const rows = useData(() => fetchLeaderboard(board, period), [key]);
  const mine = useData(() => fetchMyRank(board, period), [key, userId], !!userId);

  const state: BoardState =
    rows.status === "ok" ? { status: "ok", rows: rows.data } : { status: rows.status };

  const periodNote =
    period === "week"
      ? t("leaderboard.weekNote", { date: date.short(vnWeekStart(new Date())) })
      : t("leaderboard.allNote");

  return (
    <main className="flex flex-1 flex-col gap-3.5 lg:gap-4.5">
      <ScreenHeader
        title={t("leaderboard.title")}
        subtitle={periodNote}
        onBack={() => goBack("menu")}
      >
        <div className="flex w-full flex-wrap items-center gap-2.5 lg:w-auto">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList variant="pill" aria-label={t("leaderboard.typeLabel")}>
              <TabsTrigger value="brain">{t("leaderboard.brain")}</TabsTrigger>
              <TabsTrigger value="game">{t("leaderboard.byGame")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <ToggleGroup
            type="single"
            value={period}
            onValueChange={(v) => v && setPeriod(v as LeaderboardPeriod)}
            aria-label={t("leaderboard.periodLabel")}
            spacing={1}
            className="ml-auto rounded-full bg-board-shade p-1 lg:ml-0"
          >
            <ToggleGroupItem
              value="week"
              className="min-h-10 rounded-full px-3.5 font-display font-extrabold text-chalk data-[state=on]:border-[3px] data-[state=on]:border-sticker"
            >
              {t("leaderboard.week")}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="all"
              className="min-h-10 rounded-full px-3.5 font-display font-extrabold text-chalk data-[state=on]:border-[3px] data-[state=on]:border-sticker"
            >
              <span className="lg:hidden">{t("leaderboard.allTimeShort")}</span>
              <span className="hidden lg:inline">{t("leaderboard.allTime")}</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </ScreenHeader>

      {tab === "game" && <GamePicker value={gameId} onChange={setGameId} />}

      <BoardView
        board={state}
        me={mine.status === "ok" ? mine.data : null}
        meId={userId}
        period={period}
        onRetry={rows.reload}
        onBrainTest={() => go("brain-test")}
      />
    </main>
  );
}

/** Nút chọn minigame (menu xổ xuống, nhóm theo kỹ năng). */
function GamePicker({ value, onChange }: { value: GameId; onChange(id: GameId): void }) {
  const { t } = useTranslation();
  const text = useGameTextLookup();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="hidden text-sm font-bold text-chalk lg:inline">
        {t("leaderboard.gamePicker")}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" aria-label={t("leaderboard.pickGame")} className="min-h-11">
            <span
              aria-hidden
              className={cn(
                "size-3.5 rounded-full border-2 border-ink",
                CATEGORY_BG[GAMES[value].category],
              )}
            />
            {text(value).title}
            <ChevronDownIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[60vh] overflow-y-auto">
          <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as GameId)}>
            {CATEGORIES.map((c) => (
              <DropdownMenuGroup key={c}>
                <DropdownMenuLabel className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn("size-2.5 rounded-full border-2 border-ink", CATEGORY_BG[c])}
                  />
                  {t(`category.${c}`)}
                </DropdownMenuLabel>
                {GAME_IDS.filter((id) => GAMES[id].category === c).map((id) => (
                  <DropdownMenuRadioItem key={id} value={id}>
                    {text(id).title}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuGroup>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="text-[13px] text-chalk-muted">{t("leaderboard.gameNote")}</span>
    </div>
  );
}
