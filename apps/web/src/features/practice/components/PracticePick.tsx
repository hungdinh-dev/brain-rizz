import { CATEGORIES, type Category, GAME_IDS, GAMES, type GameId } from "@brain-rizz/shared";
import { PlayIcon, StarIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CATEGORY_BG } from "@/components/common/MatchChips";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import { useGameTextLookup } from "@/hooks/use-game-text";
import { useNumberFormat } from "@/hooks/use-number-format";
import { cn } from "@/lib/utils";
import type { PracticeRecords } from "../records";
import { topBestOfGame } from "../records";

type Filter = Category | "all";

interface PracticePickProps {
  records: PracticeRecords;
  onPick(gameId: GameId): void;
  onBack(): void;
}

/** Luyện tập · chọn game (khu 13): lọc theo nhóm, thẻ game kèm kỷ lục cao nhất của mình. */
export function PracticePick({ records, onPick, onBack }: PracticePickProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>("all");
  const groups = CATEGORIES.filter((c) => filter === "all" || filter === c);

  return (
    <main className="flex flex-1 flex-col gap-3 lg:gap-4.5">
      <ScreenHeader
        title={t("practice.title")}
        subtitle={
          <>
            <span className="lg:hidden">{t("practice.subtitleShort")}</span>
            <span className="hidden lg:inline">{t("practice.subtitle")}</span>
          </>
        }
        onBack={onBack}
      >
        <fieldset className="-mx-4 flex w-[calc(100%+2rem)] min-w-0 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:w-auto lg:px-0 lg:pb-0">
          <legend className="sr-only">{t("practice.filter")}</legend>
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            {t("practice.all")}
          </FilterChip>
          {CATEGORIES.map((c) => (
            <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>
              <span
                aria-hidden
                className={cn("size-3 rounded-full border-2 border-ink", CATEGORY_BG[c])}
              />
              {t(`category.${c}`)}
            </FilterChip>
          ))}
        </fieldset>
      </ScreenHeader>

      <div
        className={cn(
          "grid flex-1 content-start gap-4 lg:gap-4.5",
          filter === "all" && "lg:grid-cols-5",
        )}
      >
        {groups.map((category) => (
          <CategoryColumn
            key={category}
            category={category}
            records={records}
            wide={filter !== "all"}
            onPick={onPick}
          />
        ))}
      </div>
      <p className="text-[13px] text-chalk-muted">{t("practice.notRanked")}</p>
    </main>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-bold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring",
        active
          ? "border-[3px] border-sticker bg-primary font-display text-base font-extrabold text-primary-foreground shadow-sticker-sm"
          : "border-[2.5px] border-chalk/60 bg-board-shade text-chalk",
      )}
    >
      {children}
    </button>
  );
}

function CategoryColumn({
  category,
  records,
  wide,
  onPick,
}: {
  category: Category;
  records: PracticeRecords;
  wide: boolean;
  onPick(gameId: GameId): void;
}) {
  const { t } = useTranslation();
  const ids = GAME_IDS.filter((id) => GAMES[id].category === category);
  return (
    <section className="flex min-w-0 flex-col gap-2.5 lg:gap-3">
      <h2 className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "size-4 rounded-full border-[3px] border-ink lg:size-4.5",
            CATEGORY_BG[category],
          )}
        />
        <span className="font-display text-xl leading-none font-extrabold text-chalk lg:text-[22px]">
          {t(`category.${category}`)}
        </span>
        <span className="text-xs font-semibold text-chalk-muted lg:text-[13px]">
          {t("practice.gamesCount", { count: ids.length })}
        </span>
      </h2>
      <div
        className={cn(
          "grid grid-cols-2 gap-3",
          wide ? "sm:grid-cols-3 lg:grid-cols-4" : "lg:grid-cols-1",
        )}
      >
        {ids.map((id) => (
          <GameTile key={id} gameId={id} category={category} records={records} onPick={onPick} />
        ))}
      </div>
    </section>
  );
}

function GameTile({
  gameId,
  category,
  records,
  onPick,
}: {
  gameId: GameId;
  category: Category;
  records: PracticeRecords;
  onPick(gameId: GameId): void;
}) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const text = useGameTextLookup();
  const name = text(gameId).title;
  const top = topBestOfGame(records, gameId);

  return (
    <button
      type="button"
      aria-label={t("practice.playGame", { name })}
      onClick={() => onPick(gameId)}
      className="flex min-h-24 min-w-0 cursor-pointer flex-col gap-2 rounded-2xl border-[3px] border-sticker bg-card p-2.5 text-left text-card-foreground shadow-sticker-sm transition-[translate] outline-none hover:-translate-y-0.75 focus-visible:ring-3 focus-visible:ring-ring lg:rounded-[18px] lg:border-[3.5px] lg:p-3"
    >
      <span className="flex items-center gap-2 lg:gap-2.5">
        <span
          aria-hidden
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-[11px] border-[2.5px] border-ink lg:size-11 lg:rounded-[13px] lg:border-[3px]",
            CATEGORY_BG[category],
          )}
        >
          <PlayIcon className="size-4 fill-paper text-ink lg:size-5" strokeWidth={2.6} />
        </span>
        <span className="font-display text-base leading-tight font-extrabold lg:text-[19px]">
          {name}
        </span>
      </span>
      <span
        className={cn(
          "mt-auto flex h-6.5 items-center gap-1.5 self-stretch rounded-[9px] bg-muted px-2 text-xs font-bold lg:h-7 lg:rounded-[10px] lg:px-2.5 lg:text-[13px]",
          !top && "text-muted-foreground",
        )}
      >
        <StarIcon
          aria-hidden
          className={cn("size-3.5 shrink-0", top && "fill-primary")}
          strokeWidth={2.2}
        />
        <span className="truncate">
          {top
            ? t("practice.best", {
                score: fmt(top.best.score),
                level: t(`difficulty.${top.difficulty}`),
              })
            : t("practice.notPlayed")}
        </span>
      </span>
    </button>
  );
}
