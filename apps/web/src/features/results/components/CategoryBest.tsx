import type { CategoryLeader, PlayerView } from "@brain-rizz/shared";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { CategoryChip } from "@/components/common/MatchChips";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { useNumberFormat } from "@/hooks/use-number-format";
import { cn } from "@/lib/utils";

interface CategoryBestProps {
  /** Từ `categoryLeaders()`: chỉ thể loại đã chơi và có người > 0 điểm, thứ tự cố định. */
  leaders: readonly CategoryLeader[];
  players: Record<string, PlayerView>;
  sessionId: string;
  /** Đã thay khung giữ chỗ bằng thẻ thật (sau khi lật hạng 1). */
  revealed: boolean;
  /** Số hàng đã hiện (hàng sau cùng lật cách nhau 120 ms). */
  shownRows: number;
  reduced: boolean;
  /** Vào lại giữa chừng: hiện ngay, không hoạt ảnh. */
  instant?: boolean;
  className?: string;
  ref?: Ref<HTMLElement>;
}

/** Tối đa 2 avatar / 2 tên mỗi hàng; nhiều hơn thì gộp "+k". */
const MAX_FACES = 2;

/**
 * Thẻ "Giỏi nhất mỗi thể loại" ở màn vinh danh (CR-010, ui-ux 6.3): mỗi thể loại một hàng —
 * nhãn thể loại + tổng điểm vòng, avatar + tên người giỏi nhất (hoà thì cùng nhận). Trước khi
 * lật hạng 1 là khung giữ chỗ nét đứt cùng kích thước để bố cục không nhảy.
 */
export function CategoryBest({
  leaders,
  players,
  sessionId,
  revealed,
  shownRows,
  reduced,
  instant = false,
  className,
  ref,
}: CategoryBestProps) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  if (leaders.length === 0) return null;
  const enter = (normal: string, fade: string) =>
    instant ? "" : reduced ? cn("animate-in fade-in", fade) : normal;

  if (!revealed) {
    return (
      <section
        ref={ref}
        aria-label={t("results.bestTitle")}
        className={cn(
          "flex flex-col gap-2 rounded-[18px] border-[3px] border-dashed border-chalk/55 bg-board-shade p-3 lg:rounded-[22px] lg:px-4 lg:py-3.5",
          className,
        )}
      >
        <header className="flex flex-col">
          <h2 className="font-display text-lg font-extrabold text-chalk lg:text-[21px]">
            {t("results.bestTitle")}
          </h2>
          <p className="text-[12.5px] text-chalk-muted">{t("results.bestPending")}</p>
        </header>
        <ul className="grid gap-2 lg:max-xl:grid-cols-2">
          {leaders.map((row) => (
            <li
              key={row.category}
              className="flex h-18.5 flex-col justify-center gap-1.5 rounded-[14px] border-[3px] border-dashed border-chalk/40 px-3"
            >
              <CategoryChip category={row.category} className="self-start" />
              <span className="flex items-center gap-2 font-display text-base font-extrabold text-chalk-muted">
                <span
                  aria-hidden
                  className="flex size-7 items-center justify-center rounded-full border-2 border-dashed border-chalk/55"
                >
                  {t("results.unknown")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const nameOf = (p: PlayerView) =>
    p.id === sessionId ? t("results.bestYou", { name: p.name }) : p.name;

  return (
    <section
      ref={ref}
      aria-label={t("results.bestTitle")}
      className={cn(
        "flex flex-col gap-2 rounded-[18px] border-[3.5px] border-sticker bg-card p-3 text-card-foreground shadow-sticker lg:rounded-[22px] lg:border-4 lg:px-4 lg:py-3.5",
        enter("fx-card-in", "duration-400"),
        className,
      )}
    >
      <header className="flex flex-col">
        <h2 className="font-display text-lg font-extrabold lg:text-[21px]">
          {t("results.bestTitle")}
        </h2>
        <p className="text-[12.5px] text-muted-foreground">{t("results.bestSub")}</p>
      </header>
      <ul className="grid gap-2 lg:max-xl:grid-cols-2">
        {leaders.map((row, i) => {
          const people = row.leaderIds
            .map((id) => players[id])
            .filter((p): p is PlayerView => p !== undefined)
            // Mình đứng đầu để "(bạn)" không bị gộp vào "+k".
            .sort((x, y) => Number(y.id === sessionId) - Number(x.id === sessionId));
          const mine = row.leaderIds.includes(sessionId);
          const faces = people.slice(0, MAX_FACES);
          const extra = people.length - faces.length;
          const [a, b] = faces.map(nameOf);
          const shortNames =
            people.length <= 1
              ? (a ?? "")
              : people.length === 2
                ? t("results.bestTwo", { a, b })
                : t("results.bestMany", { a, b, count: extra });
          const allNames = people.length === 2 ? shortNames : people.map(nameOf).join(", ");
          const shown = i < shownRows;
          return (
            <li
              key={row.category}
              aria-hidden={!shown}
              aria-label={t("results.bestRowLabel", {
                category: t(`category.${row.category}`),
                names: allNames,
                score: fmt(row.score),
              })}
              className={cn(
                "flex h-18.5 min-w-0 flex-col justify-center gap-1.5 rounded-[14px] border-[3px] border-sticker px-3",
                mine ? "bg-primary/30" : "bg-card",
                shown ? enter("fx-row-in", "duration-320") : "opacity-0",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <CategoryChip category={row.category} />
                <span className="font-display text-lg leading-none font-extrabold tabular-nums">
                  {fmt(row.score)}
                </span>
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex shrink-0 items-center" aria-hidden>
                  {faces.map((p, k) => (
                    <PlayerAvatar
                      key={p.id}
                      avatar={p.avatar}
                      colorIndex={p.colorIndex}
                      size="sm"
                      className={cn("size-7 [&_svg]:size-11", k > 0 && "-ml-2.25")}
                    />
                  ))}
                  {extra > 0 && (
                    <span className="-ml-2.25 flex size-7 items-center justify-center rounded-full border-2 border-sticker bg-muted text-[11px] font-bold text-card-foreground">
                      +{extra}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-base font-extrabold">
                  {shortNames}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
