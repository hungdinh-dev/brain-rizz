import { StarIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { QuitDialog } from "@/components/common/QuitDialog";
import { CountdownStage, SoloPlayView, waitAnswerOutcome, waitUnlockDelay } from "@/features/play";
import type { MinigameBridge } from "@/games/types";
import { useNumberFormat } from "@/hooks/use-number-format";
import { useNav } from "@/stores/nav.store";
import { PracticePick } from "./components/PracticePick";
import { PracticeResult } from "./components/PracticeResult";
import { PracticeSetup } from "./components/PracticeSetup";
import { PRACTICE_COUNTDOWN_MS, usePractice } from "./practice.store";
import { bestFor } from "./records";

/**
 * Luyện tập (UC-13, khu 13): chọn game → hướng dẫn & độ khó → đếm ngược 3 giây → chơi → kết quả.
 * Chạy hoàn toàn trên máy (seed và chấm điểm ở client, cùng luật với party), không cần server.
 */
export function PracticeScreen() {
  const s = usePractice();
  const go = useNav((n) => n.go);
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const [confirmQuit, setConfirmQuit] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mở một lần khi vào màn, dọn khi rời
  useEffect(() => {
    s.open();
    return () => usePractice.getState().leave();
  }, []);

  const round = s.round;
  // Bridge chỉ tạo lại khi sang lượt mới (seed đổi); canvas Phaser không bị dựng lại giữa lượt.
  const bridge = useMemo<MinigameBridge | null>(
    () =>
      round && {
        seed: round.seed,
        round: 1,
        difficulty: round.difficulty,
        startIndex: 0,
        submit: (index, answer) => usePractice.getState().answer(index, answer),
        unlockDelay: waitUnlockDelay,
        answerOutcome: waitAnswerOutcome,
      },
    [round],
  );

  const leave = () => go("menu");

  if (s.step === "pick" || !s.gameId) {
    return <PracticePick records={s.records} onPick={s.pickGame} onBack={leave} />;
  }

  if (s.step === "setup" || !round || !bridge) {
    return (
      <PracticeSetup
        gameId={s.gameId}
        difficulty={s.difficulty}
        records={s.records}
        onDifficulty={s.setDifficulty}
        onStart={s.start}
        onOtherGame={s.backToPick}
      />
    );
  }

  const chip = (
    <span className="inline-flex h-6.5 shrink-0 items-center rounded-full bg-secondary px-2.75 font-display text-sm font-extrabold whitespace-nowrap text-secondary-foreground lg:h-9.5 lg:px-3.5 lg:text-xl">
      {t("practice.chip")}
    </span>
  );

  if (s.step === "countdown") {
    return (
      <CountdownStage
        gameId={round.gameId}
        startAt={round.startAt}
        totalMs={PRACTICE_COUNTDOWN_MS}
        difficulty={round.difficulty}
        chip={chip}
      />
    );
  }

  if (s.step === "result" && s.outcome) {
    return (
      <PracticeResult
        gameId={round.gameId}
        difficulty={round.difficulty}
        outcome={s.outcome}
        records={s.records}
        sync={s.sync}
        onPlayAgain={s.start}
        onChangeLevel={s.quit}
        onOtherGame={s.backToPick}
      />
    );
  }

  const best = bestFor(s.records, round.gameId, round.difficulty);
  // Ô kỷ lục thay dải đối thủ (khu 13).
  const aside = (
    <p className="flex min-h-10 items-center gap-2 self-start rounded-2xl border-[2.5px] border-chalk/60 bg-board-shade px-3.5 py-1.5 text-sm font-bold text-chalk lg:min-h-12 lg:text-base">
      <StarIcon aria-hidden className="size-4.5 fill-primary text-primary" />
      {best ? t("practice.toBeat", { score: fmt(best.score) }) : t("practice.noRecordYet")}
    </p>
  );

  return (
    <>
      <SoloPlayView
        gameId={round.gameId}
        bridge={bridge}
        startAt={round.startAt}
        endsAt={round.endsAt}
        difficulty={round.difficulty}
        chip={chip}
        score={s.progress?.score ?? 0}
        streak={s.progress?.streak ?? 0}
        aside={aside}
        onQuit={() => setConfirmQuit(true)}
      />
      <QuitDialog
        open={confirmQuit}
        onOpenChange={setConfirmQuit}
        description={t("common.quitPractice")}
        onConfirm={() => {
          setConfirmQuit(false);
          usePractice.getState().quit();
        }}
      />
    </>
  );
}
