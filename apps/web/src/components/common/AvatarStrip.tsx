import type { PlayerView } from "@brain-rizz/shared";
import type { ReactNode } from "react";
import { BotBadge, PlayerName } from "@/components/characters";
import { isCrowded } from "@/lib/room-size";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "./PlayerAvatar";

interface AvatarStripProps {
  players: PlayerView[];
  /** Dòng chữ nhỏ dưới tên (vd. độ khó); bỏ trống thì không có */
  sub?(player: PlayerView): ReactNode;
  /** Huy hiệu nhỏ góc dưới phải avatar (vd. dấu "đã hiểu"); bỏ trống thì bot có huy hiệu máy */
  badge?(player: PlayerView): ReactNode;
  /** Ẩn tên (chỉ còn avatar) */
  hideNames?: boolean;
  /**
   * Bố cục phòng đông (ui-ux 6.8): máy tính lưới 6 cột (avatar 40, tên 12 px), điện thoại avatar
   * 30 px chồng nhau (lệch −8, viền 2 px màu bảng), không tên. Mặc định bật từ 9 người.
   */
  crowded?: boolean;
  className?: string;
}

/** Hàng nhân vật cả phòng viết thẳng trên bảng: avatar, tên, dòng phụ. */
export function AvatarStrip({
  players,
  sub,
  badge,
  hideNames,
  crowded = isCrowded(players.length),
  className,
}: AvatarStripProps) {
  if (crowded) {
    return (
      <ul
        className={cn(
          "flex pl-2 lg:grid lg:grid-cols-6 lg:gap-x-1.5 lg:gap-y-2 lg:pl-0",
          className,
        )}
      >
        {players.map((p) => (
          <li
            key={p.id}
            className={cn(
              "-ml-2 flex min-w-0 flex-col items-center gap-0.75 lg:ml-0",
              !p.connected && "opacity-50",
            )}
          >
            <span className="relative flex">
              <PlayerAvatar
                avatar={p.avatar}
                accessories={p.accessories}
                colorIndex={p.colorIndex}
                size="sm"
                className="size-7.5 shadow-[0_0_0_2px_var(--color-board)] lg:size-10 lg:border-[3px] lg:shadow-none"
              />
              {badge?.(p) ??
                (p.isBot && (
                  <BotBadge
                    size="sm"
                    className="max-lg:-right-0.75 max-lg:-bottom-0.75 max-lg:size-4 max-lg:[&_svg]:size-2.5"
                  />
                ))}
            </span>
            {/* Điện thoại không có chỗ cho tên: chỉ còn cho trình đọc màn hình. */}
            <span className="flex max-w-full min-w-0 items-baseline gap-0.5 overflow-x-clip max-lg:sr-only">
              <PlayerName player={p} compact className="truncate text-xs font-bold text-chalk" />
            </span>
            {sub && <span className="text-[11px] text-chalk-muted max-lg:hidden">{sub(p)}</span>}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className={cn("flex flex-wrap justify-center gap-x-4 gap-y-2", className)}>
      {players.map((p) => (
        <li
          key={p.id}
          className={cn("flex min-w-0 flex-col items-center gap-0.5", !p.connected && "opacity-50")}
        >
          <span className="relative flex">
            <PlayerAvatar
              avatar={p.avatar}
              accessories={p.accessories}
              colorIndex={p.colorIndex}
              size="md"
            />
            {badge?.(p) ?? (p.isBot && <BotBadge size="sm" />)}
          </span>
          {!hideNames && (
            <span className="flex max-w-24 min-w-0 items-baseline gap-0.5 overflow-x-clip">
              <PlayerName
                player={p}
                className="truncate text-[13px] font-bold text-chalk"
                suffixClassName="text-[11px] text-chalk-muted"
              />
            </span>
          )}
          {sub && <span className="text-[11px] text-chalk-muted">{sub(p)}</span>}
        </li>
      ))}
    </ul>
  );
}
