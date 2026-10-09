import { ClientMessage, GAME_IDS } from "@brain-rizz/shared";
import { leaveParty, send } from "../../net/connection";
import { useGame } from "../../store/game";
import { avatarColor } from "../components/PlayerChip";

const MEDALS = ["🥇", "🥈", "🥉"];

export function ResultsScreen() {
  const party = useGame((s) => s.party)!;
  const sessionId = useGame((s) => s.sessionId);
  const isHost = party.hostId === sessionId;
  const isPodium = party.phase === "podium";

  const players = Object.values(party.players).sort((a, b) =>
    isPodium ? b.matchPoints - a.matchPoints : b.roundScore - a.roundScore,
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4">
      <h2 className="text-center text-3xl font-extrabold">
        {isPodium ? "Chung cuộc" : `Kết quả vòng ${party.round}/${party.totalRounds}`}
      </h2>

      {/* TODO (giai đoạn 2): thay bằng bục trao giải 3D trong src/three/ */}
      <ol className="card flex flex-col gap-2">
        {players.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2">
            <span className="w-8 text-center text-xl">{MEDALS[i] ?? i + 1}</span>
            <span
              className="size-4 rounded-full"
              style={{ background: avatarColor(p.colorIndex) }}
            />
            <span className="flex-1 truncate font-semibold">{p.name}</span>
            <span className="tabular-nums text-white/60">{p.roundScore} điểm</span>
            <span className="w-14 text-right font-extrabold tabular-nums">{p.matchPoints}</span>
          </li>
        ))}
      </ol>

      {isHost ? (
        isPodium ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => send(ClientMessage.BackToLobby)}
          >
            Chơi lại
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            // Xoay vòng qua danh mục game; sau này cho chủ phòng chọn như ở sảnh.
            onClick={() =>
              send(ClientMessage.StartRound, { gameId: GAME_IDS[party.round % GAME_IDS.length] })
            }
          >
            Vòng tiếp theo
          </button>
        )
      ) : (
        <p className="text-center text-white/60">Chờ chủ phòng…</p>
      )}
      <button type="button" className="btn-ghost" onClick={() => void leaveParty()}>
        Rời phòng
      </button>
    </main>
  );
}
