import {
  BRAIN_TEST_DIFFICULTY,
  BRAIN_TEST_ESTIMATED_TOTAL_MS,
  BRAIN_TEST_GAME_COUNT,
  CATEGORIES,
} from "@brain-rizz/shared";
import {
  ArrowRightIcon,
  ClockIcon,
  CloudCheckIcon,
  CloudOffIcon,
  LoaderCircleIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { BrainMascot } from "@/components/brand";
import { BrainRadar } from "@/components/common/BrainRadar";
import { CATEGORY_BG } from "@/components/common/MatchChips";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDateFormat } from "@/hooks/use-date-format";
import { useNumberFormat } from "@/hooks/use-number-format";
import { SUPABASE_CONFIGURED } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { BrainTestRow } from "@/net/data-api";

interface BrainIntroProps {
  /** Lịch sử Kiểm tra não (mới nhất trước); `null` khi chưa có / không tải được. */
  history: BrainTestRow[] | null;
  connecting: boolean;
  onStart(): void;
  onLeaderboard(): void;
  onBack(): void;
}

/**
 * Kiểm tra não · giới thiệu (UC-14 bước 1, khu 14): 5 ô "?" màu 5 nhóm (server bốc game khi bấm
 * Bắt đầu), độ khó cố định, tổng thời gian dự kiến, lần trước / cao nhất, dòng lưu kết quả.
 */
export function BrainIntro({
  history,
  connecting,
  onStart,
  onLeaderboard,
  onBack,
}: BrainIntroProps) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const date = useDateFormat();
  const minutes = Math.max(1, Math.round(BRAIN_TEST_ESTIMATED_TOTAL_MS / 60_000));
  const level = t(`difficulty.${BRAIN_TEST_DIFFICULTY}`);
  const last = history?.[0];
  const best = history?.reduce((m, r) => Math.max(m, r.brainScore), 0) ?? 0;

  const chips = [
    t("brainTest.gamesChip", { count: BRAIN_TEST_GAME_COUNT }),
    t("brainTest.fixedLevel", { level }),
    t("brainTest.duration", { minutes }),
  ];

  return (
    <main className="flex flex-1 flex-col gap-3.5 lg:gap-4.5">
      <ScreenHeader title={t("brainTest.title")} onBack={onBack} />

      <div className="grid flex-1 gap-3.5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-6.5">
        <section className="flex flex-col gap-3.5 rounded-[22px] border-4 border-sticker bg-pink px-4 py-4 text-ink shadow-sticker lg:gap-4 lg:rounded-[26px] lg:px-6.5 lg:py-6">
          <div className="flex items-center gap-3.5 lg:gap-4.5">
            <BrainMascot size={88} className="char-idle shrink-0 lg:hidden" />
            <BrainMascot size={128} className="char-idle hidden shrink-0 lg:block" />
            <div className="flex flex-col gap-2.5">
              <p className="font-display text-[22px] leading-tight font-extrabold lg:text-[28px]">
                {t("brainTest.lead")}
              </p>
              <p className="hidden text-[15px] leading-relaxed text-ink/80 lg:block">
                {t("brainTest.body")}
              </p>
              <ChipRow chips={chips} className="hidden lg:flex" />
            </div>
          </div>
          <p className="text-sm leading-relaxed text-ink/80 lg:hidden">{t("brainTest.body")}</p>
          <ChipRow chips={chips} className="lg:hidden" />
          <ol className="mt-auto grid grid-cols-5 gap-2 lg:gap-3">
            {CATEGORIES.map((c, i) => (
              <li key={c} className="flex min-w-0 flex-col items-center gap-1.5 lg:gap-2">
                <span className="flex h-18 w-full flex-col items-center justify-center gap-1 rounded-[14px] border-[3px] border-dashed border-ink bg-paper font-display text-3xl leading-none font-extrabold lg:h-27 lg:rounded-[18px] lg:border-[3.5px] lg:text-[44px]">
                  <span
                    aria-hidden
                    className={cn(
                      "h-2 w-6 rounded-full border-2 border-ink lg:h-2.5 lg:w-7.5",
                      CATEGORY_BG[c],
                    )}
                  />
                  ?
                </span>
                <span className="w-full truncate text-center text-[11px] font-bold lg:text-sm">
                  <span className="hidden lg:inline">{i + 1} · </span>
                  {t(`category.${c}`)}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <div className="flex min-w-0 flex-col gap-3.5 lg:gap-4">
          {last && (
            <Card className="flex-row items-center gap-3.5 rounded-[22px] border-[3.5px] px-4.5 py-4">
              <BrainRadar
                compact
                skills={last.skills}
                previous={history?.[1]?.skills}
                className="w-28 shrink-0"
              />
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-bold text-muted-foreground">
                  {t("brainTest.lastTime", { date: date.short(last.createdAt) })}
                </span>
                <span className="font-display text-[40px] leading-none font-extrabold">
                  {fmt(last.brainScore)}
                </span>
                <span className="text-sm font-semibold">
                  {t("brainTest.bestEver", { score: fmt(best) })}
                </span>
              </div>
            </Card>
          )}

          {SUPABASE_CONFIGURED ? (
            <p
              role="status"
              className="flex items-start gap-2 text-sm leading-relaxed text-chalk-muted"
            >
              <CloudCheckIcon aria-hidden className="size-5 shrink-0" strokeWidth={2.3} />
              {t("brainTest.willSave")}
            </p>
          ) : (
            <section
              role="status"
              className="flex items-start gap-2.5 rounded-2xl border-[2.5px] border-dashed border-chalk/70 px-3.5 py-3 text-chalk"
            >
              <CloudOffIcon aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={2.3} />
              <span className="flex flex-col gap-0.5">
                <span className="font-display text-base font-extrabold">
                  {t("common.noDataServer")}
                </span>
                <span className="text-[13px] leading-snug text-chalk-muted">
                  {t("brainTest.notSavedIntro")}
                </span>
              </span>
            </section>
          )}
          {history && history.length === 0 && (
            <p className="text-center font-display text-lg font-bold text-chalk">
              {t("brainTest.firstTime")}
            </p>
          )}

          <div className="mt-auto flex flex-col gap-2.5 lg:gap-3">
            <Button
              size="lg"
              data-sfx="confirm"
              disabled={connecting}
              aria-busy={connecting}
              onClick={onStart}
              className="min-h-15 rounded-[18px] border-4 text-[26px] lg:min-h-18 lg:text-[30px]"
            >
              {connecting ? (
                <>
                  <LoaderCircleIcon aria-hidden className="size-6 motion-safe:animate-spin" />
                  {t("brainTest.connecting")}
                </>
              ) : (
                <>
                  {t("brainTest.start")}
                  <ArrowRightIcon aria-hidden className="size-6.5" strokeWidth={2.8} />
                </>
              )}
            </Button>
            <Button variant="outline" onClick={onLeaderboard} className="min-h-12.5">
              {t("brainTest.viewLeaderboard")}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function ChipRow({ chips, className }: { chips: string[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {chips.map((c, i) => (
        <span
          key={c}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink/12 px-3 py-1 text-[13px] font-bold"
        >
          {i === chips.length - 1 && (
            <ClockIcon aria-hidden className="size-3.5" strokeWidth={2.6} />
          )}
          {c}
        </span>
      ))}
    </div>
  );
}
