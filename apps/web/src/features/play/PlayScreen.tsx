import { ClientMessage, type Difficulty, type GameId, isGameId } from "@brain-rizz/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BrainMascot } from "@/components/brand";
import { RoundChip } from "@/components/common/MatchChips";
import type { MinigameBridge } from "@/games/types";
import { levelHint, useGameText } from "@/hooks/use-game-text";
import { DESKTOP_QUERY, TOUCH_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { send } from "@/net/connection";
import { useGame, useMe } from "@/stores/game.store";
import { GameFrame } from "./components/GameFrame";
import { MyScoreCard, MyScoreHud } from "./components/MyScore";
import { RoundInfo } from "./components/RoundInfo";
import { RoundTimer } from "./components/RoundTimer";
import { Scoreboard } from "./components/Scoreboard";
import { ScoreStrip } from "./components/ScoreStrip";
import { rankByRoundScore } from "./standings";
import { waitUnlockDelay } from "./unlock-delay";

/** Bảng điểm đông hơn ngần này người thì ẩn linh vật cho đủ chỗ. */
const MASCOT_MAX_PLAYERS = 5;

/**
 * Khung chơi chung (khu M1): thanh trên + dải đối thủ (điện thoại) hoặc 3 cột (máy tính),
 * minigame Phaser nằm trong thẻ giấy ở giữa. Điểm, đồng hồ đều đọc từ server.
 */
export function PlayScreen() {
  const party = useGame((s) => s.party)!;
  if (!isGameId(party.gameId)) return null;
  return <PlayView gameId={party.gameId} />;
}

function PlayView({ gameId }: { gameId: GameId }) {
  const { t } = useTranslation();
  const party = useGame((s) => s.party)!;
  const sessionId = useGame((s) => s.sessionId);
  const me = useMe();
  const game = useGameText(gameId);
  // Chỉ render một bộ HUD; thẻ minigame luôn ở cùng vị trí trong cây nên canvas không bị dựng lại.
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const touch = useMediaQuery(TOUCH_QUERY);

  const standings = rankByRoundScore(Object.values(party.players));
  const myRank = standings.find((s) => s.player.id === sessionId)?.rank ?? 1;

  // Seed, số vòng, độ khó, giờ bắt đầu/kết thúc đều đọc từ state đồng bộ, KHÔNG từ tin `roundStart`:
  // tin đó mất nếu rớt mạng đúng lúc server phát (SDK tự nối lại giữa hướng dẫn/đếm ngược),
  // còn state luôn được gửi lại đủ khi nối lại. Sai seed = sinh sai đề, server chấm sai hết.
  // Bridge chỉ tạo lại khi sang vòng mới (seed đổi), không phải mỗi lần state đổi.
  const seed = party.seed;
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
      unlockDelay: waitUnlockDelay,
    }),
    [seed, roundNo, difficulty],
  );

  const frame = (
    <GameFrame
      gameId={gameId}
      bridge={bridge}
      startAt={party.startAt}
      endsAt={party.endsAt}
      howTo={game.howTo}
      className="min-h-80 flex-1 lg:aspect-9/16 lg:h-full lg:flex-none"
    />
  );

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-2.5 lg:max-w-none lg:flex-row lg:gap-6">
      {desktop ? (
        <RoundInfo
          gameId={gameId}
          title={game.title}
          howTo={game.howTo}
          levelHint={levelHint(game, me?.difficulty, touch)}
          round={party.round}
          totalRounds={party.totalRounds}
          difficulty={difficulty}
          startAt={party.startAt}
          endsAt={party.endsAt}
          className="flex-1 basis-0"
        >
          {me && <MyScoreCard me={me} rank={myRank} />}
        </RoundInfo>
      ) : (
        <>
          <header className="flex h-16.5 shrink-0 items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
              <RoundChip round={party.round} total={party.totalRounds} size="sm" />
              <h1 className="max-w-full truncate font-display text-[19px] leading-none font-extrabold text-chalk">
                {game.title}
              </h1>
            </div>
            <RoundTimer startAt={party.startAt} endsAt={party.endsAt} size="sm" />
            {me ? (
              <MyScoreHud me={me} rank={myRank} className="flex-1" />
            ) : (
              <div className="flex-1" />
            )}
          </header>
          <ScoreStrip opponents={standings.filter((s) => s.player.id !== sessionId)} />
        </>
      )}

      {frame}

      {desktop && (
        <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col gap-4">
          <Scoreboard standings={standings} meId={sessionId} round={party.round} />
          {standings.length <= MASCOT_MAX_PLAYERS && (
            <div aria-hidden className="mt-auto flex items-end justify-end gap-1.5">
              <span className="mb-17 -rotate-4 rounded-[18px] border-[2.5px] border-chalk px-3.5 py-2 font-display text-[19px] font-bold text-chalk">
                {t("play.hurry")}
              </span>
              <BrainMascot size={120} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
