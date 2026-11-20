import { GAMES, type GameId, isGameId } from "@brain-rizz/shared";
import { CATEGORY_ICON } from "@/components/common/MatchChips";
import { GAME_CLIENTS } from "@/games/registry";
import { cn } from "@/lib/utils";

/**
 * Ô hình 46×30 của game (mục Game, Phòng đang mở): hình minh hoạ cách chơi trên nền bảng, game
 * không có hình thì biểu tượng nhóm kỹ năng; id lạ (phòng chưa chọn game) → ô bảng trống.
 */
export function GameIcon({ id, className }: { id: string; className?: string }) {
  const known = isGameId(id);
  const Illustration = known ? GAME_CLIENTS[id as GameId].Illustration : undefined;
  const Icon = known ? CATEGORY_ICON[GAMES[id as GameId].category] : undefined;
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-7.5 w-11.5 shrink-0 items-center justify-center overflow-hidden rounded-[9px] border-[2.5px] border-sticker bg-board p-px",
        className,
      )}
    >
      {Illustration ? (
        <Illustration className="h-full w-auto" />
      ) : Icon ? (
        <Icon className="size-4.5 text-chalk" strokeWidth={2.2} />
      ) : null}
    </span>
  );
}
