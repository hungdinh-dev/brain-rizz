import {
  ClientMessage,
  type Difficulty,
  GAMES,
  type GameId,
  isGameId,
  majorityDifficulty,
} from "@brain-rizz/shared";
import { CheckIcon, LightbulbIcon, PlayIcon, TimerIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BotBadge } from "@/components/characters";
import { CategoryChip, RoundChip } from "@/components/common/MatchChips";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { Button } from "@/components/ui/button";
import { loadProfile, saveProfile } from "@/features/home";
import { countdownHint, useGameText } from "@/hooks/use-game-text";
import { DESKTOP_QUERY, TOUCH_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { usePendingAction } from "@/hooks/use-pending-action";
import { useServerClock } from "@/hooks/use-server-clock";
import { isCompactRoster } from "@/lib/room-size";
import { cn } from "@/lib/utils";
import { send } from "@/net/connection";
import { useGame, useMe } from "@/stores/game.store";
import { DifficultyChooser } from "./components/DifficultyChooser";
import { GuideCard } from "./components/GuideCard";
import { RoomDifficulty } from "./components/RoomDifficulty";

/**
 * Hướng dẫn & độ khó (pha `game-intro`, khu 7): cách chơi game vừa chọn, mỗi người tự chọn độ khó,
 * bấm "Đã hiểu!". Chủ phòng xem độ khó cả phòng, nhắc người lệch, bấm "Bắt đầu chơi";
 * hết giờ thì server tự bắt đầu.
 */
export function GameIntroScreen() {
  const party = useGame((s) => s.party)!;
  if (!isGameId(party.gameId)) return null;
  return <IntroView gameId={party.gameId} />;
}

function IntroView({ gameId }: { gameId: GameId }) {
  const { t } = useTranslation();
  const party = useGame((s) => s.party)!;
  const sessionId = useGame((s) => s.sessionId);
  const me = useMe();
  const game = useGameText(gameId);
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const touch = useMediaQuery(TOUCH_QUERY);
  const isHost = party.hostId === sessionId;
  // Game có câu nhắc riêng theo mức (vd. Siêu khó chạm ngược): hiện câu nhắc của mức đang chọn dưới
  // ô chọn độ khó, cũng là câu sẽ hiện lúc đếm ngược. Mức không có câu riêng hiện câu chung, để dòng
  // này luôn có chữ và không nhảy bố cục khi đổi mức. Game không có câu riêng thì không có dòng này.
  const tip = me && game.levelHints ? countdownHint(game, me.difficulty, touch) : undefined;

  const players = Object.values(party.players).sort((a, b) => Number(b.isHost) - Number(a.isHost));
  // Độ khó đa số chỉ tính người thật (CR-016): độ khó của bot theo mức, không đổi được.
  const humans = players.filter((p) => !p.isBot);
  const majority = majorityDifficulty(humans.map((p) => p.difficulty));
  const majorityCount =
    majority === null ? 0 : humans.filter((p) => p.difficulty === majority).length;
  // Chủ phòng bấm "Bắt đầu chơi" tức là đã hiểu → chỉ chờ những người còn lại.
  const understood = players.filter((p) => p.isHost || p.introReady).length;
  const othersReady = players.every((p) => p.isHost || p.introReady);
  // Khoá nút tới khi server đổi state: "Bắt đầu chơi" → sang đếm ngược; "Đã hiểu" → introReady đổi.
  // Nút bật/tắt "Đã hiểu" chỉ bỏ qua cú bấm thứ hai, không `disabled` để khỏi nháy và mất focus.
  const start = usePendingAction(`${party.phase}:${party.round}`);
  const gotIt = usePendingAction(`${party.phase}:${party.round}:${me?.introReady}`);

  function chooseDifficulty(difficulty: Difficulty) {
    send(ClientMessage.SetDifficulty, { difficulty });
    // Lần sau mặc định mức vừa chọn.
    saveProfile({ ...loadProfile(), difficulty });
  }

  const autoStart = (
    <AutoStart
      introEndsAt={party.introEndsAt}
      waiting={isHost && !othersReady ? { n: understood, total: players.length } : undefined}
    />
  );

  const action = isHost ? (
    <Button
      size="lg"
      disabled={!othersReady || start.pending}
      data-sfx="confirm"
      className="min-h-14.5 w-full rounded-[18px] border-4 text-[26px] lg:min-h-15.5 lg:w-75"
      onClick={() => start.run(() => send(ClientMessage.StartRound, {}))}
    >
      {t("intro.start")}
      <PlayIcon aria-hidden className="size-6 fill-current" />
    </Button>
  ) : (
    me && (
      <Button
        size="lg"
        variant={me.introReady ? "outline" : "default"}
        aria-pressed={me.introReady}
        data-sfx="confirm"
        className="min-h-14.5 w-full rounded-[18px] border-4 text-[26px] lg:min-h-15.5 lg:w-75"
        onClick={() => gotIt.run(() => send(ClientMessage.IntroReady, { ready: !me.introReady }))}
      >
        {me.introReady ? t("intro.readAgain") : t("intro.gotIt")}
      </Button>
    )
  );

  const chooser = me && (
    <DifficultyChooser value={me.difficulty} onChange={chooseDifficulty} levels={game.levels} />
  );

  const waitOthers = !isHost && me?.introReady && (
    <p className="text-center text-[13px] font-semibold text-chalk-muted">
      {t("intro.waitOthers")}
    </p>
  );
  const crowded = isCompactRoster(players.length);

  if (desktop) {
    return (
      <main className="flex flex-1 flex-col gap-4">
        <header className="flex min-h-13 items-center gap-4">
          <RoundChip round={party.round} total={party.totalRounds} size="lg" />
          <h1 className="sticker-text font-display text-[40px] leading-none font-extrabold text-paper [--stroke:7px]">
            {t("intro.title")}
          </h1>
          <span className="ml-auto text-sm text-chalk-muted">{t("intro.selfPick")}</span>
        </header>
        <div className="flex min-h-0 flex-1 gap-5">
          <GuideCard gameId={gameId} className="w-117.5 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-3.5">
            <section className="flex flex-col gap-2.5 rounded-[22px] border-4 border-sticker bg-card px-4.5 pt-3.5 pb-4 text-card-foreground shadow-sticker">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-[22px] leading-tight font-extrabold">
                  {t("intro.yourDifficulty")}
                </h2>
                <span className="text-[13px] text-muted-foreground">{t("intro.defaultLast")}</span>
              </div>
              {chooser}
              {tip && <LevelTip text={tip} />}
            </section>
            <RoomDifficulty
              gameId={gameId}
              players={players}
              sessionId={sessionId}
              majority={majority}
              isHost={isHost}
            />
            <div className="mt-auto flex items-center gap-4">
              <div className="flex-1">{autoStart}</div>
              {action}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-3">
      <header className="flex min-h-10 items-center gap-2.5">
        <RoundChip round={party.round} total={party.totalRounds} size="md" />
        <h1 className="flex-1 font-display text-2xl leading-none font-extrabold text-chalk">
          {t("intro.title")}
        </h1>
        <IntroTimerChip introEndsAt={party.introEndsAt} />
      </header>
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="font-display text-[32px] leading-none font-extrabold text-chalk">
          {game.title}
        </h2>
        <CategoryChip category={GAMES[gameId].category} />
      </div>
      <GuideCard gameId={gameId} compact />
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-[19px] font-extrabold text-chalk">
            {t("intro.yourDifficulty")}
          </span>
          <span className="text-xs text-chalk-muted">
            {t("intro.defaultLast")}
            {majority !== null &&
              ` · ${t("intro.roomMajority", { n: majorityCount, level: t(`difficulty.${majority}`) })}`}
          </span>
        </div>
        {chooser}
        {tip && <LevelTip text={tip} className="text-chalk" />}
      </div>
      {/*
        Phòng 8–12 người: danh sách cả phòng dài nên nút chính lên ngay dưới ô chọn độ khó (vẫn
        trong màn đầu ở 390×844, trên nút chat nổi), dòng phụ xuống dưới nút; danh sách theo sau.
      */}
      {crowded && (
        <div className="flex flex-col gap-2">
          {action}
          {isHost && autoStart}
          {waitOthers}
        </div>
      )}
      {isHost ? (
        <RoomDifficulty
          gameId={gameId}
          players={players}
          sessionId={sessionId}
          majority={majority}
          isHost
        />
      ) : (
        <div className="flex items-center justify-between gap-3">
          <ul className="flex flex-wrap gap-2.5">
            {players.map((p) => (
              <li key={p.id} className={cn("relative flex", !p.connected && "opacity-50")}>
                <PlayerAvatar avatar={p.avatar} colorIndex={p.colorIndex} size="md" />
                {/* Góc dưới phải đã dành cho dấu "Đã hiểu" nên huy hiệu máy sang góc dưới trái. */}
                {p.isBot && <BotBadge size="sm" className="right-auto -left-1" />}
                {(p.isHost || p.introReady) && (
                  <span className="absolute -right-1.5 -bottom-1 grid size-5 place-items-center rounded-full border-2 border-sticker bg-compute text-ink">
                    <CheckIcon
                      aria-label={t("intro.understood")}
                      className="size-3"
                      strokeWidth={3.2}
                    />
                  </span>
                )}
              </li>
            ))}
          </ul>
          <span className="shrink-0 font-display text-[17px] font-extrabold text-chalk">
            {t("intro.understoodCount", { n: understood, total: players.length })}
          </span>
        </div>
      )}
      {!crowded && (
        <div className="mt-auto flex flex-col gap-2">
          {isHost && autoStart}
          {waitOthers}
          {action}
        </div>
      )}
    </main>
  );
}

/** Câu nhắc của mức đang chọn, đọc lại cho trình đọc màn hình mỗi khi đổi mức. */
function LevelTip({ text, className }: { text: string; className?: string }) {
  return (
    <p
      aria-live="polite"
      className={cn("flex items-center gap-2 text-[13.5px] font-bold leading-snug", className)}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-[9px] border-[2.5px] border-sticker bg-primary text-ink">
        <LightbulbIcon aria-hidden className="size-4" strokeWidth={2.6} />
      </span>
      {text}
    </p>
  );
}

function useSecondsLeft(until: number) {
  const now = useServerClock(500);
  return Math.max(0, Math.ceil((until - now) / 1000));
}

/** "Tự bắt đầu sau Ns" (+ "· bấm được khi cả phòng đã hiểu (x/y)" cho chủ phòng). */
function AutoStart({
  introEndsAt,
  waiting,
}: {
  introEndsAt: number;
  waiting?: { n: number; total: number };
}) {
  const { t } = useTranslation();
  const seconds = useSecondsLeft(introEndsAt);
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-[15px] font-semibold text-chalk">
      <TimerIcon aria-hidden className="size-5 shrink-0 text-primary" />
      {t("intro.autoStart", { count: seconds })}
      {waiting && (
        <span className="font-normal text-chalk-muted">{t("intro.startWhenAll", waiting)}</span>
      )}
    </p>
  );
}

/** Đồng hồ nhỏ góc phải (điện thoại). */
function IntroTimerChip({ introEndsAt }: { introEndsAt: number }) {
  const { t } = useTranslation();
  const seconds = useSecondsLeft(introEndsAt);
  return (
    <span
      role="timer"
      className="inline-flex h-8 items-center gap-1.5 rounded-full border-2 border-chalk/70 px-2.5 font-display text-[15px] font-extrabold text-chalk tabular-nums"
    >
      <TimerIcon aria-hidden className="size-4" />
      {t("intro.seconds", { seconds })}
    </span>
  );
}
