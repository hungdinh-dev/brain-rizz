import { type Category, isGameId } from "@brain-rizz/shared";
import { LockIcon } from "lucide-react";
import { memo } from "react";
import { CATEGORY_ICON } from "@/components/common/MatchChips";
import { GAME_CLIENTS } from "@/games/registry";
import { cn } from "@/lib/utils";

interface GameThumbProps {
  id: string;
  category: Category;
  /** Game chưa có code: ảnh mờ + ổ khoá */
  locked?: boolean;
  /** Đã chơi: ảnh mờ */
  dimmed?: boolean;
  className?: string;
}

/**
 * Dải ảnh của game trên nền bảng (khu 6, trống quay khu 24): biểu tượng riêng của game
 * (`GameClient.Icon`) nếu có, không thì hình minh hoạ cao gần kín dải, không nữa thì biểu tượng
 * nhóm kỹ năng. Cỡ do chỗ dùng đặt qua `className` (bản mẫu: 40 / 56 px; trống quay 72×46, 54×34).
 * `memo`: trống quay vẽ lại mỗi khung hình, ảnh game không đổi thì không vẽ lại.
 */
export const GameThumb = memo(function GameThumb({
  id,
  category,
  locked,
  dimmed,
  className,
}: GameThumbProps) {
  const client = isGameId(id) ? GAME_CLIENTS[id] : undefined;
  const Art = client?.Icon ?? client?.Illustration;
  const Icon = CATEGORY_ICON[category];

  return (
    <span
      aria-hidden
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] border-[2.5px] border-sticker bg-board p-0.5 lg:rounded-xl lg:border-[3px]",
        (locked || dimmed) && "opacity-60 grayscale",
        className,
      )}
    >
      {Art ? (
        <Art className="h-full w-auto" />
      ) : (
        <Icon className="size-7 max-h-[80%] text-chalk" strokeWidth={2.2} />
      )}
      {locked && (
        <span className="absolute grid size-8.5 place-items-center rounded-full border-[3px] border-sticker bg-paper text-ink">
          <LockIcon className="size-4" strokeWidth={2.8} />
        </span>
      )}
    </span>
  );
});
