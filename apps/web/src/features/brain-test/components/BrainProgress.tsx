import type { BrainGameView, BrainPhase } from "@brain-rizz/shared";
import { CheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CATEGORY_BG } from "@/components/common/MatchChips";
import { useGameTextLookup } from "@/hooks/use-game-text";
import { useNumberFormat } from "@/hooks/use-number-format";
import { cn } from "@/lib/utils";

interface BrainProgressProps {
  games: BrainGameView[];
  /** Game hiện tại, 1–5. */
  round: number;
  phase: BrainPhase;
  /** Bản gọn (điện thoại, khung chơi): vòng tròn + một dòng chữ nhỏ. */
  compact?: boolean;
  className?: string;
}

/**
 * Thanh tiến trình 5 đốt luôn ở trên trong cả lượt Kiểm tra não (khu 14): đốt xong = màu nhóm +
 * dấu tích + điểm; đốt hiện tại viền vàng; đốt chưa tới = nét đứt. Có nhãn chữ cho trình đọc màn hình.
 */
export function BrainProgress({ games, round, phase, compact, className }: BrainProgressProps) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const text = useGameTextLookup();
  // Game hiện tại tính là xong khi đang ở màn tạm / kết quả.
  const doneCount = phase === "game-result" || phase === "finished" ? round : round - 1;

  return (
    <ol
      aria-label={t("brainTest.progress", { done: doneCount, total: games.length })}
      className={cn("grid grid-cols-5 gap-1.5 lg:gap-2.5", className)}
    >
      {games.map((g, i) => {
        const done = i < doneCount;
        const current = !done && i === round - 1;
        const name = text(g.gameId).title;
        return (
          <li
            key={g.gameId}
            aria-current={current ? "step" : undefined}
            className={cn(
              "flex min-w-0 items-center gap-2",
              compact ? "flex-col gap-1 text-center" : "lg:gap-2.5",
            )}
          >
            <span
              className={cn(
                "grid shrink-0 place-items-center rounded-full font-display font-extrabold",
                compact ? "size-8 text-sm" : "size-9 text-base lg:size-10 lg:text-lg",
                done && cn("border-[3px] border-sticker text-ink", CATEGORY_BG[g.category]),
                current && "border-[3.5px] border-primary text-primary",
                !done && !current && "border-[2.5px] border-dashed border-chalk/70 text-chalk",
              )}
            >
              {done ? <CheckIcon aria-hidden className="size-4.5" strokeWidth={3.2} /> : i + 1}
            </span>
            <span className={cn("flex min-w-0 flex-col leading-tight", compact && "w-full")}>
              {/* Dòng chính: điểm (đã xong) hoặc tên game; bản gọn chỉ có dòng này. */}
              <span
                className={cn(
                  "truncate font-bold",
                  compact ? "text-[11px]" : "text-[13px] lg:text-sm",
                  current ? "text-primary" : done ? "text-chalk" : "text-chalk-muted",
                )}
              >
                {done ? fmt(g.score) : name}
              </span>
              {!compact && (
                <span className="hidden truncate text-xs text-chalk-muted lg:block">
                  {done ? name : t(`category.${g.category}`)}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
