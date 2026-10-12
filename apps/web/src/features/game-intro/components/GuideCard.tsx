import { GAMES, type GameId, STREAK_THRESHOLD, WRONG_ANSWER_LOCK_MS } from "@brain-rizz/shared";
import {
  CheckIcon,
  FlameIcon,
  HandIcon,
  LockIcon,
  type LucideIcon,
  MouseIcon,
  ZapIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { CATEGORY_ICON, CategoryChip } from "@/components/common/MatchChips";
import { Card } from "@/components/ui/card";
import { GAME_CLIENTS } from "@/games/registry";
import { useGameText } from "@/hooks/use-game-text";
import { TOUCH_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useNumberFormat } from "@/hooks/use-number-format";
import { cn } from "@/lib/utils";

interface GuideCardProps {
  gameId: GameId;
  /** Bản gọn cho điện thoại: tên game nằm ngoài thẻ, điều khiển + tính điểm mỗi thứ một dòng */
  compact?: boolean;
  className?: string;
}

/** Thẻ hướng dẫn: tên, nhóm kỹ năng, hình minh hoạ, cách chơi 3 bước, điều khiển, tính điểm. */
export function GuideCard({ gameId, compact, className }: GuideCardProps) {
  const { t } = useTranslation();
  const game = useGameText(gameId);
  const touch = useMediaQuery(TOUCH_QUERY);
  const fmt = useNumberFormat(1);
  const Illustration = GAME_CLIENTS[gameId].Illustration;
  const CategoryIcon = CATEGORY_ICON[GAMES[gameId].category];
  const lockSeconds = fmt(WRONG_ANSWER_LOCK_MS / 1000);

  // Khung ngang 14:9 như artboard hình hướng dẫn (560×360). Hình vuông (Kẻ lạc đàn) và biểu tượng
  // nhóm kỹ năng (game chưa có hình, vd. vừa tạo bằng `pnpm new-game`) nằm giữa khung,
  // cùng kiểu với ảnh thẻ game ở màn Chọn game (GameThumb).
  const illustration = (
    <span
      aria-hidden
      className={cn(
        "flex aspect-14/9 shrink-0 items-center justify-center border-sticker bg-board",
        compact ? "w-35 rounded-xl border-[3px] p-1" : "w-56 rounded-2xl border-4 p-1.5",
      )}
    >
      {Illustration ? (
        <Illustration className="size-full" />
      ) : (
        <CategoryIcon className="size-1/2 text-chalk" strokeWidth={2.2} />
      )}
    </span>
  );

  const steps = (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 lg:gap-2.5">
      <h3 className="font-display text-[17px] leading-tight font-extrabold lg:text-[19px]">
        {t("intro.howToPlay")}
      </h3>
      <ol className="flex flex-col gap-1.5 lg:gap-2.5">
        {game.steps.map((step, i) => (
          <li
            key={step}
            className="flex items-center gap-2.5 text-[12.5px] leading-snug lg:text-sm"
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary font-display text-sm font-extrabold text-secondary-foreground lg:size-7.5 lg:text-lg">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );

  if (compact) {
    return (
      <Card className={cn("gap-2.5 rounded-[18px] border-[3.5px] p-3", className)}>
        <div className="flex items-center gap-3">
          {illustration}
          {steps}
        </div>
        <div className="border-t-2 border-dashed border-sticker/30" />
        <p className="flex items-center gap-2 text-[13px]">
          <strong>{t("intro.controlsInline")}</strong>
          {touch ? (
            <HandIcon aria-hidden className="size-4" />
          ) : (
            <MouseIcon aria-hidden className="size-4" />
          )}
          {touch ? game.controls.touch : game.controls.mouse}
        </p>
        <p className="text-[13px] leading-relaxed">
          <strong>{t("intro.scoringInline")}</strong>{" "}
          {t("intro.scoringLine", { n: STREAK_THRESHOLD, seconds: lockSeconds })}
        </p>
      </Card>
    );
  }

  const scoring: { icon: LucideIcon; bg: string; label: string }[] = [
    { icon: CheckIcon, bg: "bg-compute", label: t("intro.scoreCorrect") },
    { icon: ZapIcon, bg: "bg-primary", label: t("intro.scoreFast") },
    { icon: FlameIcon, bg: "bg-identify", label: t("intro.scoreCombo", { n: STREAK_THRESHOLD }) },
    { icon: LockIcon, bg: "bg-pink", label: t("intro.scoreWrong", { seconds: lockSeconds }) },
  ];

  return (
    <Card className={cn("gap-3 rounded-3xl border-4 px-5 py-4.5", className)}>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-[40px] leading-none font-extrabold">{game.title}</h2>
          <CategoryChip category={GAMES[gameId].category} className="h-7 text-sm" />
        </div>
        <p className="text-sm text-muted-foreground">{game.summary}</p>
      </div>
      <div className="flex items-start gap-3.5">
        {illustration}
        {steps}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="font-display text-[19px] leading-tight font-extrabold">
          {t("intro.controls")}
        </h3>
        <div className="flex gap-2.5">
          <span className="flex min-h-10 flex-1 items-center gap-2 rounded-xl border-[2.5px] border-sticker px-3 text-[13.5px] font-semibold">
            <HandIcon aria-hidden className="size-5 shrink-0" />
            {t("intro.onPhone", { action: game.controls.touch })}
          </span>
          <span className="flex min-h-10 flex-1 items-center gap-2 rounded-xl border-[2.5px] border-sticker px-3 text-[13.5px] font-semibold">
            <MouseIcon aria-hidden className="size-5 shrink-0" />
            {t("intro.onDesktop", { action: game.controls.mouse })}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="font-display text-[19px] leading-tight font-extrabold">
          {t("intro.scoring")}
        </h3>
        <ul className="grid grid-cols-2 gap-x-2.5 gap-y-1">
          {scoring.map(({ icon: Icon, bg, label }) => (
            <li key={label} className="flex min-h-8.5 items-center gap-2 text-[13px] font-semibold">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-[9px] border-[2.5px] border-sticker text-ink",
                  bg,
                )}
              >
                <Icon aria-hidden className="size-4" strokeWidth={2.6} />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
