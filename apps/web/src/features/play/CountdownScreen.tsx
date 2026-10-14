import { COUNTDOWN_MS, GAMES, type GameId, isGameId } from "@brain-rizz/shared";
import { HandIcon, MousePointerClickIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { BrainMascot } from "@/components/brand";
import { AvatarStrip } from "@/components/common/AvatarStrip";
import { CategoryChip, RoundChip } from "@/components/common/MatchChips";
import { playSfx } from "@/features/sfx";
import { preloadGame } from "@/games/PhaserHost";
import { countdownHint, useGameText } from "@/hooks/use-game-text";
import { TOUCH_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useServerClock } from "@/hooks/use-server-clock";
import { useGame, useMe } from "@/stores/game.store";

const TOTAL_SECONDS = Math.round(COUNTDOWN_MS / 1000);
const SEG = 360 / TOTAL_SECONDS;
const GAP = 10;
const RING_R = 132;

const arc = (from: number, to: number) => {
  const p = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${(150 + RING_R * Math.cos(rad)).toFixed(2)} ${(150 + RING_R * Math.sin(rad)).toFixed(2)}`;
  };
  return `M${p(from)} A${RING_R} ${RING_R} 0 0 1 ${p(to)}`;
};

/**
 * Đếm ngược 5 giây trước khi vào chơi (pha `countdown`, khu 8) theo giờ server: số to viết phấn,
 * vòng 5 đoạn mất dần, tên game, độ khó của mình, câu nhắc (theo độ khó nếu game có câu riêng),
 * hàng nhân vật cả phòng.
 * Tải trước Phaser + scene trong lúc chờ.
 */
export function CountdownScreen() {
  const party = useGame((s) => s.party)!;
  if (!isGameId(party.gameId)) return null;
  return <CountdownView gameId={party.gameId} />;
}

function CountdownView({ gameId }: { gameId: GameId }) {
  const { t } = useTranslation();
  const party = useGame((s) => s.party)!;
  const me = useMe();
  const game = useGameText(gameId);
  const touch = useMediaQuery(TOUCH_QUERY);
  const now = useServerClock(100);
  const seconds = Math.min(TOTAL_SECONDS, Math.max(1, Math.ceil((party.startAt - now) / 1000)));
  const players = Object.values(party.players);
  // Câu nhắc theo độ khó của mình (vd. Siêu khó Theo dấu ánh đèn: chạm ngược).
  const hint = countdownHint(game, me?.difficulty, touch);

  useEffect(() => preloadGame(gameId), [gameId]);
  // Mỗi giây một tiếng tick, giây cuối cao hơn (đổi số mới kêu, không kêu lại khi re-render).
  const lastTick = useRef(0);
  useEffect(() => {
    // Nhớ giây đã kêu: StrictMode (dev) chạy effect hai lần lúc mount, khỏi kêu đúp.
    if (lastTick.current === seconds) return;
    lastTick.current = seconds;
    playSfx("tick", { accent: seconds === 1 });
  }, [seconds]);

  return (
    <main className="relative flex flex-1 flex-col items-center justify-between gap-4 text-center">
      <RoundChip
        round={party.round}
        total={party.totalRounds}
        size="lg"
        className="self-start lg:absolute lg:top-0 lg:left-0"
      />
      <div className="flex flex-col items-center gap-2.5">
        <h1 className="font-display text-[40px] leading-none font-extrabold text-chalk lg:sticker-text lg:text-[54px] lg:text-paper lg:[--stroke:8px]">
          {game.title}
        </h1>
        <div className="flex flex-wrap justify-center gap-2.5">
          <CategoryChip category={GAMES[gameId].category} className="lg:h-7 lg:text-[15px]" />
          {me && (
            <span className="inline-flex h-7 items-center rounded-full border-[2.5px] border-sticker bg-secondary px-3 text-[13px] font-bold text-secondary-foreground lg:text-[15px]">
              {t("play.yourDifficulty", { level: t(`difficulty.${me.difficulty}`) })}
            </span>
          )}
        </div>
      </div>

      <div
        role="timer"
        aria-label={t("countdown.startsIn", { count: seconds })}
        className="relative size-65 shrink-0 lg:size-75"
      >
        <svg viewBox="0 0 300 300" aria-hidden className="size-full">
          {/* Đoạn sáng gom chung một nhóm để vùng filter phấn đủ rộng, không cắt mất nét. */}
          {[false, true].map((lit) => (
            <g key={String(lit)} className={lit ? "filter-[url(#chalk)]" : undefined}>
              {Array.from({ length: TOTAL_SECONDS }, (_, i) => i)
                .filter((i) => i < seconds === lit)
                .map((i) => {
                  const from = -90 + i * SEG + GAP / 2;
                  return (
                    <path
                      key={i}
                      d={arc(from, from + SEG - GAP)}
                      fill="none"
                      strokeWidth={16}
                      strokeLinecap="round"
                      className={lit ? "stroke-primary" : "stroke-chalk/20"}
                    />
                  );
                })}
            </g>
          ))}
        </svg>
        {/* key theo số giây → mỗi giây dựng lại để chạy hiệu ứng nảy (tắt khi giảm chuyển động) */}
        <span
          key={seconds}
          className="absolute inset-0 flex items-center justify-center pt-3.5 font-display text-[170px] leading-none font-extrabold text-chalk filter-[url(#chalk)] motion-safe:animate-in motion-safe:fade-in-40 motion-safe:zoom-in-125 motion-safe:duration-300 lg:pt-4.5 lg:text-[200px]"
        >
          {seconds}
        </span>
      </div>

      <div className="flex min-h-14 -rotate-2 items-center gap-2.5 rounded-2xl border-[3.5px] border-sticker bg-primary px-4.5 py-1.5 text-primary-foreground shadow-sticker lg:min-h-15.5 lg:gap-3 lg:rounded-[18px] lg:border-4 lg:px-6.5">
        {touch ? (
          <HandIcon aria-hidden className="size-6 shrink-0 lg:size-7" />
        ) : (
          <MousePointerClickIcon aria-hidden className="size-6 shrink-0 lg:size-7" />
        )}
        <span className="font-display text-[22px] leading-tight font-extrabold lg:text-[30px]">
          {hint}
        </span>
      </div>

      <AvatarStrip
        players={players}
        sub={(p) => t(`difficulty.${p.difficulty}`)}
        className="gap-x-4.5 lg:gap-x-7"
      />

      <div aria-hidden className="absolute right-2 bottom-2 hidden items-end gap-1.5 lg:flex">
        <span className="mb-17 -rotate-4 rounded-[18px] border-[2.5px] border-chalk px-3.5 py-2 font-display text-[19px] font-bold text-chalk">
          {t("countdown.focus")}
        </span>
        <BrainMascot size={120} className="fx-float" />
      </div>
    </main>
  );
}
