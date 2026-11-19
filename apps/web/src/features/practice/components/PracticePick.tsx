import { CATEGORIES, type Category, GAME_IDS, GAMES, type GameId } from "@brain-rizz/shared";
import { StarIcon, TrophyIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CATEGORY_BG, CATEGORY_FG, CATEGORY_ICON } from "@/components/common/MatchChips";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import { Button } from "@/components/ui/button";
import { GAME_CLIENTS } from "@/games/registry";
import { useGameTextLookup } from "@/hooks/use-game-text";
import { useNumberFormat } from "@/hooks/use-number-format";
import { cn } from "@/lib/utils";
import { useFavorites } from "../favorites";
import type { PracticeRecords } from "../records";
import { topBestOfGame } from "../records";
import { TileFavoriteStar } from "./FavoriteStar";

/** `fav` = chỉ mục Yêu thích (CR-020). */
type Filter = Category | "all" | "fav";

interface PracticePickProps {
  records: PracticeRecords;
  onPick(gameId: GameId): void;
  onBack(): void;
}

/**
 * Luyện tập · chọn game (khu 13, khu 27): lọc theo nhóm / Yêu thích, thẻ game kèm kỷ lục cao nhất
 * của mình và nút ⭐. Lọc "Tất cả" thì mục Yêu thích đứng đầu (chưa có thì một dòng gợi ý).
 */
export function PracticePick({ records, onPick, onBack }: PracticePickProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>("all");
  const favorites = useFavorites((s) => s.ids);
  const groups = CATEGORIES.filter((c) => filter === "all" || filter === c);

  let favoritesBlock: React.ReactNode = null;
  if (filter === "all" || filter === "fav") {
    if (favorites.length > 0) {
      favoritesBlock = (
        <FavoritesSection
          ids={favorites}
          records={records}
          grow={filter === "fav"}
          onPick={onPick}
        />
      );
    } else if (filter === "all") {
      favoritesBlock = (
        <p className="flex min-h-12 items-center gap-2.5 rounded-[14px] border-[2.5px] border-dashed border-chalk/45 px-3.5 py-2 text-sm text-chalk-muted">
          <StarIcon aria-hidden className="size-5 shrink-0" strokeWidth={2.4} />
          {t("practice.favoritesHint")}
        </p>
      );
    } else {
      favoritesBlock = <FavoritesEmpty onShowAll={() => setFilter("all")} />;
    }
  }

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
        {/* 7 chip không vừa cạnh tiêu đề trên máy tính → cả hàng xuống dưới tiêu đề, căn trái. */}
        <fieldset className="-mx-4 flex w-[calc(100%+2rem)] min-w-0 gap-2 overflow-x-auto px-4 pt-0.5 pb-1.5 [scrollbar-width:none] lg:mx-0 lg:w-full lg:overflow-visible lg:px-0">
          <legend className="sr-only">{t("practice.filter")}</legend>
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            {t("practice.all")}
          </FilterChip>
          <FilterChip active={filter === "fav"} onClick={() => setFilter("fav")}>
            <StarIcon
              aria-hidden
              className={cn("size-4.25", filter === "fav" && "fill-current")}
              strokeWidth={2.4}
            />
            {t("practice.favorites")}
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

      {favoritesBlock}

      {filter !== "fav" && (
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
      )}
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
        // Chip thường và chip chọn cùng viền 3px, cùng chữ, cùng cao: đổi chọn không nhảy bố cục.
        "flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-[3px] px-3.5 font-display text-base font-extrabold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring",
        active
          ? "border-sticker bg-primary text-primary-foreground shadow-sticker-sm"
          : "border-chalk/60 bg-board-shade text-chalk",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Mục Yêu thích: thứ tự thêm (`ids`), thẻ giữ màu nhóm của game; game vẫn có ở mục nhóm của nó.
 * Điện thoại 2 cột; máy tính 5 cột thẻ 216 (xuống hàng nếu > 5), không theo cột nhóm.
 */
function FavoritesSection({
  ids,
  records,
  grow,
  onPick,
}: {
  ids: readonly GameId[];
  records: PracticeRecords;
  grow: boolean;
  onPick(gameId: GameId): void;
}) {
  const { t } = useTranslation();
  return (
    <section className={cn("flex min-w-0 flex-col gap-2.5 lg:gap-3", grow && "flex-1")}>
      <h2 className="flex items-center gap-2">
        <StarIcon
          aria-hidden
          className="size-5.5 shrink-0 fill-primary text-sticker lg:size-6.5"
          strokeWidth={2.4}
        />
        <span className="font-display text-xl leading-none font-extrabold text-chalk lg:text-[22px]">
          {t("practice.favorites")}
        </span>
        <span className="text-xs font-semibold text-chalk-muted lg:text-[13px]">
          {t("practice.gamesCount", { count: ids.length })}
        </span>
      </h2>
      <div className="grid grid-cols-2 content-start gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4.5">
        {ids.map((id) => (
          <GameTile
            key={id}
            gameId={id}
            category={GAMES[id].category}
            records={records}
            onPick={onPick}
          />
        ))}
      </div>
    </section>
  );
}

/** Lọc "Yêu thích" mà chưa có game nào: giữa vùng nội dung, nút về lọc "Tất cả". */
function FavoritesEmpty({ onShowAll }: { onShowAll(): void }) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="flex flex-1 flex-col items-center justify-center gap-2.5 px-4 py-10 text-center text-chalk"
    >
      <span
        aria-hidden
        className="flex size-24 items-center justify-center rounded-full border-[3px] border-dashed border-chalk/55"
      >
        <StarIcon className="size-13" strokeWidth={2.4} />
      </span>
      <h2 className="mt-1.5 font-display text-2xl leading-tight font-extrabold">
        {t("practice.favoritesEmptyTitle")}
      </h2>
      <p className="max-w-75 text-sm leading-normal text-chalk-muted">
        {t("practice.favoritesEmptyBody")}
      </p>
      <Button variant="chalk" onClick={onShowAll} className="mt-1.5 min-h-11 px-4.5 text-base">
        {t("practice.favoritesEmptyCta")}
      </Button>
    </div>
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
          wide ? "sm:grid-cols-3 lg:grid-cols-4" : "sm:grid-cols-3 lg:grid-cols-1",
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
  const Illustration = GAME_CLIENTS[gameId].Illustration;
  const CategoryIcon = CATEGORY_ICON[category];

  // Thẻ dọc kiểu thư viện game: tên trên nền màu nhóm, hình minh hoạ 14:9 (như thẻ hướng dẫn), dải kỷ lục.
  // Khung bọc `relative` chứa hai nút anh em (thẻ mở game + ⭐, không lồng button); nhấc 3 px ở khung
  // bọc để ⭐ nhấc theo thẻ.
  return (
    <div className="relative min-w-0 transition-[translate] hover:-translate-y-0.75">
      <button
        type="button"
        aria-label={t("practice.playGame", { name })}
        onClick={() => onPick(gameId)}
        className={cn(
          "flex size-full min-w-0 cursor-pointer flex-col gap-2 rounded-2xl border-[3px] border-sticker p-2 text-left shadow-sticker-sm outline-none focus-visible:ring-3 focus-visible:ring-ring lg:rounded-[18px] lg:p-2.5",
          CATEGORY_BG[category],
          CATEGORY_FG[category],
        )}
      >
        {/* Cao cố định 2 dòng (39 / 44 px) để ô ảnh mọi thẻ thẳng hàng và ⭐ đè đúng góc ảnh. */}
        <span className="line-clamp-2 h-[39px] shrink-0 px-0.5 font-display text-base leading-[1.2] font-extrabold lg:h-11 lg:text-lg">
          {name}
        </span>
        <span
          aria-hidden
          className="flex aspect-14/9 w-full items-center justify-center overflow-hidden rounded-xl border-[2.5px] border-sticker bg-board p-1 lg:border-[3px]"
        >
          {Illustration ? (
            <Illustration className="size-full" />
          ) : (
            <CategoryIcon className="size-1/2 text-chalk" strokeWidth={2.2} />
          )}
        </span>
        <span
          className={cn(
            "flex h-6.5 items-center gap-1.5 self-stretch rounded-[9px] border-2 border-sticker bg-card px-2 text-xs font-bold text-card-foreground lg:h-7 lg:rounded-[10px] lg:text-[13px]",
            !top && "text-muted-foreground",
          )}
        >
          {/* Kỷ lục dùng cúp: ⭐ chỉ còn nghĩa Yêu thích (UI-UX 6.10). */}
          <TrophyIcon aria-hidden className="size-3.5 shrink-0" strokeWidth={2.2} />
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
      <TileFavoriteStar gameId={gameId} name={name} />
    </div>
  );
}
