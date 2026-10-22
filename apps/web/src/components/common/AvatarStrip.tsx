import type { PlayerView } from "@brain-rizz/shared";
import type { ReactNode } from "react";
import { BotBadge, PlayerName } from "@/components/characters";
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
  className?: string;
}

/** Hàng nhân vật cả phòng viết thẳng trên bảng: avatar, tên, dòng phụ. */
export function AvatarStrip({ players, sub, badge, hideNames, className }: AvatarStripProps) {
  return (
    <ul className={cn("flex flex-wrap justify-center gap-x-4 gap-y-2", className)}>
      {players.map((p) => (
        <li
          key={p.id}
          className={cn("flex min-w-0 flex-col items-center gap-0.5", !p.connected && "opacity-50")}
        >
          <span className="relative flex">
            <PlayerAvatar avatar={p.avatar} colorIndex={p.colorIndex} size="md" />
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
