import { ClientMessage, type Difficulty, GAMES, isGameId } from "@brain-rizz/shared";
import { useEffect, useMemo, useState } from "react";
import { PhaserHost } from "../../games/PhaserHost";
import type { MinigameBridge } from "../../games/types";
import { send } from "../../net/connection";
import { serverNow, useGame, useMe } from "../../store/game";
import { avatarColor } from "../components/PlayerChip";

function useServerClock(intervalMs = 100) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function GameScreen() {
  const party = useGame((s) => s.party)!;
  const round = useGame((s) => s.round);
  const sessionId = useGame((s) => s.sessionId);
  const me = useMe();
  const now = useServerClock();

  const players = Object.values(party.players).sort((a, b) => b.roundScore - a.roundScore);
  const countdown = Math.ceil((party.startAt - now) / 1000);
  const remaining = Math.max(0, Math.ceil((party.endsAt - now) / 1000));
  const started = now >= party.startAt;

  // Bridge chỉ tạo lại khi sang vòng mới (seed đổi), không phải mỗi lần state đổi.
  const seed = round?.seed ?? party.seed;
  const roundNo = party.round;
  const difficulty = (me?.difficulty ?? 1) as Difficulty;
  // biome-ignore lint/correctness/useExhaustiveDependencies: startIndex chỉ đọc lúc tạo bridge
  const bridge = useMemo<MinigameBridge>(
    () => ({
      seed,
      round: roundNo,
      difficulty,
      startIndex: me?.progress ?? 0,
      submit: (index, answer) => send(ClientMessage.Answer, { round: roundNo, index, answer }),
    }),
    [seed, roundNo, difficulty],
  );

  if (!isGameId(party.gameId)) return null;
  const game = GAMES[party.gameId];

  return (
    <main className="flex flex-1 flex-col gap-3">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-sm text-white/60">
            Vòng {party.round}/{party.totalRounds}
          </div>
          <div className="text-xl font-extrabold">{game.title}</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-extrabold tabular-nums">{started ? remaining : "–"}</div>
          <div className="text-sm text-white/60">{me?.roundScore ?? 0} điểm</div>
        </div>
      </header>

      {/* Tiến độ đối thủ — trên điện thoại là một dải avatar gọn */}
      <div className="flex gap-2 overflow-x-auto">
        {players.map((p) => (
          <div
            key={p.id}
            className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-sm ${p.id === sessionId ? "bg-white/15" : "bg-white/5"}`}
          >
            <span
              className="size-3 rounded-full"
              style={{ background: avatarColor(p.colorIndex) }}
            />
            <span className="max-w-20 truncate">{p.name}</span>
            <span className="font-semibold tabular-nums">{p.roundScore}</span>
          </div>
        ))}
      </div>

      <div className="relative flex-1 overflow-hidden rounded-3xl bg-white/5">
        {started ? (
          <PhaserHost gameId={party.gameId} bridge={bridge} />
        ) : (
          <div className="grid h-full place-items-center text-center">
            <div>
              <div className="text-white/60">{game.howTo}</div>
              <div className="mt-4 text-8xl font-extrabold tabular-nums">
                {Math.max(1, countdown)}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
