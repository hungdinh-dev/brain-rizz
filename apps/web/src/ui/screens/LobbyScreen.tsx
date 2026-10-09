import {
  CATEGORY_LABELS,
  ClientMessage,
  DEFAULT_TOTAL_ROUNDS,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  GAME_IDS,
  GAMES,
  type GameId,
} from "@brain-rizz/shared";
import { lazy, Suspense, useState } from "react";
import { leaveParty, send } from "../../net/connection";
import { useGame, useMe } from "../../store/game";
import { PlayerChip } from "../components/PlayerChip";

// three.js chỉ được tải khi vào sảnh, không làm chậm màn hình đầu.
const LobbyStage = lazy(() => import("../../three/LobbyStage"));

export function LobbyScreen() {
  const party = useGame((s) => s.party)!;
  const sessionId = useGame((s) => s.sessionId);
  const setToast = useGame((s) => s.setToast);
  const me = useMe();
  const [gameId, setGameId] = useState<GameId>(GAME_IDS[0]!);
  const [rounds, setRounds] = useState(DEFAULT_TOTAL_ROUNDS);

  const players = Object.values(party.players);
  const isHost = party.hostId === sessionId;
  const inviteUrl = `${location.origin}/r/${party.code}`;

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Brain Rizz",
          text: `Vào phòng ${party.code} nhé!`,
          url: inviteUrl,
        });
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        setToast("Đã copy link mời");
      }
    } catch {
      /* người dùng huỷ chia sẻ */
    }
  }

  return (
    <main className="grid flex-1 gap-4 md:grid-cols-[1fr_360px]">
      <section className="card relative flex min-h-64 flex-col overflow-hidden p-0">
        <div className="flex items-center justify-between p-5">
          <div>
            <div className="text-sm text-white/60">Mã phòng</div>
            <div className="text-4xl font-extrabold tracking-[0.3em]">{party.code}</div>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={share}>
              Mời bạn
            </button>
            <button type="button" className="btn-ghost" onClick={() => void leaveParty()}>
              Thoát
            </button>
          </div>
        </div>
        <div className="min-h-56 flex-1">
          <Suspense
            fallback={
              <div className="grid h-full place-items-center text-white/40">
                Đang dựng sân khấu…
              </div>
            }
          >
            <LobbyStage players={players} />
          </Suspense>
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <div className="card flex flex-col gap-2">
          <div className="mb-1 text-sm text-white/60">Người chơi ({players.length}/8)</div>
          {players.map((p) => (
            <PlayerChip key={p.id} player={p} isMe={p.id === sessionId} />
          ))}
        </div>

        {me && (
          <div className="card flex flex-col gap-3">
            <div className="text-sm text-white/60">Độ khó của bạn</div>
            <div className="grid grid-cols-4 gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => send(ClientMessage.SetProfile, { difficulty: d })}
                  className={d === me.difficulty ? "btn-primary px-2" : "btn-ghost px-2"}
                >
                  {DIFFICULTY_LABELS[d]}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={me.ready ? "btn-ghost" : "btn-primary"}
              onClick={() => send(ClientMessage.Ready, { ready: !me.ready })}
            >
              {me.ready ? "Huỷ sẵn sàng" : "Sẵn sàng"}
            </button>
          </div>
        )}

        {isHost && (
          <div className="card flex flex-col gap-3">
            <div className="text-sm text-white/60">Chủ phòng chọn game</div>
            {GAME_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setGameId(id)}
                className={`rounded-2xl p-3 text-left ring-1 ${id === gameId ? "bg-white/10 ring-mint" : "ring-white/10"}`}
              >
                <div className="font-semibold">{GAMES[id].title}</div>
                <div className="text-sm text-white/50">
                  {CATEGORY_LABELS[GAMES[id].category]} · {GAMES[id].howTo}
                </div>
              </button>
            ))}
            <label className="flex items-center justify-between gap-3">
              <span className="text-white/70">Số vòng</span>
              <input
                type="number"
                min={1}
                max={10}
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                className="field w-24 text-center"
              />
            </label>
            <button
              type="button"
              className="btn-primary text-lg"
              onClick={() => send(ClientMessage.StartRound, { gameId, totalRounds: rounds })}
            >
              Bắt đầu
            </button>
          </div>
        )}
      </aside>
    </main>
  );
}
