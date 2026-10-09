import { AVATAR_COLORS, DIFFICULTY_LABELS, type PlayerView } from "@brain-rizz/shared";

export function avatarColor(index: number) {
  return AVATAR_COLORS[index] ?? AVATAR_COLORS[0];
}

export function PlayerChip({ player, isMe }: { player: PlayerView; isMe: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2 ${player.connected ? "" : "opacity-40"}`}
    >
      <span
        className="grid size-10 shrink-0 place-items-center rounded-full font-extrabold text-ink"
        style={{ background: avatarColor(player.colorIndex) }}
      >
        {player.name.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">
          {player.name}
          {isMe && <span className="text-white/50"> (bạn)</span>}
          {player.isHost && <span className="ml-1 text-sun">★</span>}
        </div>
        <div className="text-sm text-white/50">{DIFFICULTY_LABELS[player.difficulty]}</div>
      </div>
      {player.ready && (
        <span className="rounded-full bg-mint px-2 py-0.5 text-sm font-semibold text-ink">
          Sẵn sàng
        </span>
      )}
    </div>
  );
}
