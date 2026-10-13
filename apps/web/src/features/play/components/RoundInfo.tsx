import { type Difficulty, GAMES, type GameId } from "@brain-rizz/shared";
import { LightbulbIcon, MousePointerClickIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CategoryChip, RoundChip } from "@/components/common/MatchChips";
import { cn } from "@/lib/utils";
import { RoundTimer } from "./RoundTimer";

interface RoundInfoProps {
  gameId: GameId;
  title: string;
  howTo: string;
  /** Câu nhắc riêng của mức người chơi đang chơi (vd. Siêu khó chạm ngược), nếu game có. */
  levelHint?: string;
  round: number;
  totalRounds: number;
  difficulty: Difficulty;
  startAt: number;
  endsAt: number;
  /** Thẻ "Điểm của bạn" chèn giữa đồng hồ và câu gợi ý */
  children?: React.ReactNode;
  className?: string;
}

/** Cột trái (máy tính): vòng, nhóm kỹ năng, tên game, độ khó của tôi, đồng hồ lớn, điểm, câu nhắc theo mức, gợi ý. */
export function RoundInfo(props: RoundInfoProps) {
  const { t } = useTranslation();
  const { gameId, title, howTo, levelHint, round, totalRounds, difficulty, startAt, endsAt } =
    props;
  const roundSeconds = Math.round((endsAt - startAt) / 1000);

  return (
    <div className={cn("flex min-w-0 flex-col gap-3.5", props.className)}>
      <div className="flex flex-wrap items-center gap-2.5">
        <RoundChip round={round} total={totalRounds} size="lg" />
        <CategoryChip category={GAMES[gameId].category} className="h-7.5 px-3 text-sm" />
      </div>
      <h1 className="sticker-text font-display text-5xl leading-none font-extrabold text-paper [--stroke:8px]">
        {title}
      </h1>
      <span className="inline-flex h-7.5 items-center self-start rounded-full border-[2.5px] border-sticker bg-secondary px-3 text-[15px] font-bold text-secondary-foreground">
        {t("play.yourDifficulty", { level: t(`difficulty.${difficulty}`) })}
      </span>
      <div className="flex items-center gap-4.5">
        <RoundTimer startAt={startAt} endsAt={endsAt} size="lg" />
        <div className="flex flex-col gap-1">
          <span className="font-display text-2xl leading-tight font-extrabold text-chalk">
            {t("play.secondsLeft")}
          </span>
          <span className="text-sm text-chalk-muted">
            {t("play.roundLength", { seconds: roundSeconds })}
          </span>
        </div>
      </div>
      {props.children}
      <div className="mt-auto flex flex-col gap-2.5">
        {levelHint && (
          <p className="flex items-center gap-2 text-[15px] leading-snug font-bold text-chalk">
            <span className="grid size-7 shrink-0 place-items-center rounded-[9px] border-[2.5px] border-sticker bg-primary text-ink">
              <LightbulbIcon aria-hidden className="size-4" strokeWidth={2.6} />
            </span>
            {levelHint}
          </p>
        )}
        <p className="flex items-center gap-2 text-[15px] font-semibold text-chalk">
          <MousePointerClickIcon aria-hidden className="size-5 shrink-0 text-primary" />
          {howTo}
        </p>
      </div>
    </div>
  );
}
