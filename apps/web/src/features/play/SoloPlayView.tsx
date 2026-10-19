import type { Difficulty, GameId } from "@brain-rizz/shared";
import { LogOutIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BrainMascot } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MinigameBridge } from "@/games/types";
import { levelHint, useGameText } from "@/hooks/use-game-text";
import { DESKTOP_QUERY, TOUCH_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useNumberFormat } from "@/hooks/use-number-format";
import { ComboChip } from "./components/ComboChip";
import { GameFrame } from "./components/GameFrame";
import { RoundInfo } from "./components/RoundInfo";
import { RoundTimer } from "./components/RoundTimer";

interface SoloPlayViewProps {
  gameId: GameId;
  bridge: MinigameBridge;
  startAt: number;
  endsAt: number;
  difficulty: Difficulty;
  /** Nhãn thay "Vòng x/y": "Luyện tập", "Kiểm tra não · 2/5"… */
  chip: ReactNode;
  score: number;
  streak: number;
  /**
   * Ô thay dải đối thủ (khu 13/14): kỷ lục cần phá (Luyện tập) hoặc thanh 5 game (Kiểm tra não).
   * Điện thoại: dưới thanh trên; máy tính: đầu cột phải.
   */
  aside?: ReactNode;
  /** Bấm Thoát (màn gọi tự hỏi xác nhận). */
  onQuit(): void;
}

/**
 * Khung chơi một mình (Luyện tập, Kiểm tra não): bố cục khu M1 nhưng không có đối thủ.
 * Chỉ render một bộ HUD; thẻ minigame luôn ở cùng vị trí trong cây nên canvas không bị dựng lại.
 */
export function SoloPlayView(props: SoloPlayViewProps) {
  const { gameId, bridge, startAt, endsAt, difficulty, chip, score, streak, aside, onQuit } = props;
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const game = useGameText(gameId);
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const touch = useMediaQuery(TOUCH_QUERY);

  const frame = (
    <GameFrame
      gameId={gameId}
      bridge={bridge}
      startAt={startAt}
      endsAt={endsAt}
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
          levelHint={levelHint(game, difficulty, touch)}
          round={0}
          totalRounds={0}
          chip={chip}
          difficulty={difficulty}
          startAt={startAt}
          endsAt={endsAt}
          className="flex-1 basis-0"
        >
          <Card
            aria-label={t("play.yourScore")}
            className="gap-2 rounded-[22px] border-4 px-4 py-3.5"
          >
            <div className="flex items-end justify-between gap-3">
              <span className="font-display text-[22px] font-extrabold">{t("play.yourScore")}</span>
              <span className="flex items-baseline gap-1.5 leading-none">
                <span className="font-display text-[38px] font-extrabold tabular-nums">
                  {fmt(score)}
                </span>
                <span className="text-[13px] font-semibold text-muted-foreground">
                  {t("play.pointsUnit")}
                </span>
              </span>
            </div>
            <ComboChip streak={streak} className="h-7 self-start px-2.5 text-sm" />
          </Card>
        </RoundInfo>
      ) : (
        <>
          <header className="flex h-16.5 shrink-0 items-center gap-2">
            <Button
              variant="chalk"
              size="icon-chalk"
              aria-label={t("common.quit")}
              data-sfx="back"
              onClick={onQuit}
            >
              <XIcon />
            </Button>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
              {chip}
              <h1 className="max-w-full truncate font-display text-[19px] leading-none font-extrabold text-chalk">
                {game.title}
              </h1>
            </div>
            <RoundTimer startAt={startAt} endsAt={endsAt} size="sm" />
            <div className="flex min-w-0 flex-1 flex-col items-end gap-1.5">
              <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="font-display text-[25px] leading-none font-extrabold text-chalk tabular-nums">
                  {fmt(score)}
                </span>
                <span className="text-xs font-semibold text-chalk-muted">
                  {t("play.pointsUnit")}
                </span>
              </span>
              <ComboChip streak={streak} />
            </div>
          </header>
          {aside}
        </>
      )}

      {frame}

      {desktop && (
        <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col gap-4">
          {aside}
          <div aria-hidden className="mt-auto flex items-end justify-end gap-1.5">
            <span className="mb-17 -rotate-4 rounded-[18px] border-[2.5px] border-chalk px-3.5 py-2 font-display text-[19px] font-bold text-chalk">
              {t("play.hurry")}
            </span>
            <BrainMascot size={120} />
          </div>
          <Button variant="outline" className="self-end" data-sfx="back" onClick={onQuit}>
            <LogOutIcon aria-hidden />
            {t("common.quit")}
          </Button>
        </div>
      )}
    </main>
  );
}
