import type { PlayerView } from "@brain-rizz/shared";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "./PlayerAvatar";

/** Thẻ "Chờ chủ phòng…" kèm nhân vật của chủ phòng — cho người chơi thường ở các màn chờ. */
export function HostWaitCard({
  host,
  children,
  className,
}: {
  host?: PlayerView;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex min-h-14 items-center gap-2.5 rounded-2xl border-[3px] border-sticker bg-card px-3 py-2 text-card-foreground shadow-sticker-sm",
        className,
      )}
    >
      {host && (
        <PlayerAvatar
          avatar={host.avatar}
          accessories={host.accessories}
          colorIndex={host.colorIndex}
          size="md"
        />
      )}
      <span className="text-sm leading-snug font-semibold">{children}</span>
    </div>
  );
}
