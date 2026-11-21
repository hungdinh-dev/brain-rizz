import type { GameId } from "@brain-rizz/shared";
import { TrophyIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { QuitDialog } from "@/components/common/QuitDialog";
import { CountdownStage, SoloPlayView, waitAnswerOutcome, waitUnlockDelay } from "@/features/play";
import type { MinigameBridge } from "@/games/types";
import { useNumberFormat } from "@/hooks/use-number-format";
import { type PracticeFilter, restoreEntry, setBackGuard, useNav } from "@/stores/nav.store";
import { PracticePick } from "./components/PracticePick";
import { PracticeResult } from "./components/PracticeResult";
import { PracticeSetup } from "./components/PracticeSetup";
import { useEnabledGames } from "./enabled-games";
import { PRACTICE_COUNTDOWN_MS, usePractice } from "./practice.store";
import { bestFor } from "./records";

/**
 * Luyện tập (UC-13, khu 13): chọn game → hướng dẫn & độ khó → đếm ngược 3 giây → chơi → kết quả.
 * Chạy hoàn toàn trên máy (seed và chấm điểm ở client, cùng luật với party), không cần server.
 *
 * Đường dẫn (CR-022): `/practice` = chọn game (`?cat=` = chip lọc đang chọn), `/practice/<gameId>` =
 * hướng dẫn game đó (`?d=` = mức tối thiểu chọn sẵn); đếm ngược, chơi, kết quả vẫn ở URL này (không
 * đẩy lịch sử). Back lúc đếm ngược / đang chơi = nút Thoát.
 */
export function PracticeScreen() {
  const s = usePractice();
  const go = useNav((n) => n.go);
  const goBack = useNav((n) => n.goBack);
  const routeGame = useNav((n) => (n.route.screen === "practice" ? n.route.gameId : undefined));
  const routeLevel = useNav((n) => (n.route.screen === "practice" ? n.route.level : undefined));
  const filter = useNav((n) => (n.route.screen === "practice" && n.route.filter) || "all");
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const [confirmQuit, setConfirmQuit] = useState(false);
  const inRound = s.step === "countdown" || s.step === "playing";

  // Layout effect: mở màn và khớp bước theo đường dẫn trước khi vẽ (F5 ở `/practice/<gameId>` không
  // loé lưới chọn game).
  // biome-ignore lint/correctness/useExhaustiveDependencies: mở một lần khi vào màn, dọn khi rời
  useLayoutEffect(() => {
    s.open();
    return () => usePractice.getState().leave();
  }, []);

  // Game quản trị viên đã tắt (CR-019) không mở được từ đường dẫn / thú khoá: về lưới chọn game.
  const enabled = useEnabledGames();
  const routeDisabled = routeGame !== undefined && !enabled.includes(routeGame);

  // Đường dẫn → bước: có `gameId` thì mở hướng dẫn game đó (giữ nguyên nếu đang chơi / xem kết quả
  // của chính game này; `?d=` = mức tối thiểu chọn sẵn), không có thì về lưới chọn game.
  useLayoutEffect(() => {
    const p = usePractice.getState();
    if (routeGame) {
      if (routeDisabled) return;
      if (p.step === "pick" || p.gameId !== routeGame) p.pickGame(routeGame, routeLevel);
    } else if (p.step !== "pick") {
      p.backToPick();
    }
  }, [routeGame, routeLevel, routeDisabled]);

  // Game bị tắt: chỉ đẩy về lưới khi chưa vào lượt (danh sách tải xong giữa lượt thì cho chơi nốt).
  useLayoutEffect(() => {
    if (routeDisabled && (s.step === "pick" || s.step === "setup")) {
      go({ screen: "practice" }, { replace: true });
    }
  }, [routeDisabled, s.step, go]);

  // Back của trình duyệt lúc đếm ngược / đang chơi → giữ URL, hỏi "Bỏ lượt này?" như nút Thoát.
  useEffect(() => {
    if (!inRound) {
      setConfirmQuit(false);
      return;
    }
    return setBackGuard(() => {
      restoreEntry();
      setConfirmQuit(true);
      return true;
    });
  }, [inRound]);

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

  const leave = () => goBack("menu");
  // Chọn game → đẩy `/practice/<gameId>`; "Chọn game khác" → về `/practice`.
  const pick = (gameId: GameId) => go({ screen: "practice", gameId });
  const otherGame = () => goBack({ screen: "practice" });
  // Đổi chip lọc → `/practice?cat=<nhóm|fav>` bằng replace (không chất lịch sử theo từng chip).
  const changeFilter = (next: PracticeFilter | "all") =>
    go(next === "all" ? { screen: "practice" } : { screen: "practice", filter: next }, {
      replace: true,
    });

  if (s.step === "pick" || !s.gameId) {
    return (
      <PracticePick
        records={s.records}
        games={enabled}
        filter={filter}
        onFilter={changeFilter}
        onPick={pick}
        onBack={leave}
      />
    );
  }

  if (s.step === "setup" || !round || !bridge) {
    return (
      <PracticeSetup
        gameId={s.gameId}
        difficulty={s.difficulty}
        records={s.records}
        onDifficulty={s.setDifficulty}
        onStart={s.start}
        onOtherGame={otherGame}
      />
    );
  }

  const quitDialog = (
    <QuitDialog
      open={confirmQuit}
      onOpenChange={setConfirmQuit}
      description={t("common.quitPractice")}
      onConfirm={() => {
        setConfirmQuit(false);
        usePractice.getState().quit();
      }}
    />
  );

  const chip = (
    <span className="inline-flex h-6.5 shrink-0 items-center rounded-full bg-secondary px-2.75 font-display text-sm font-extrabold whitespace-nowrap text-secondary-foreground lg:h-9.5 lg:px-3.5 lg:text-xl">
      {t("practice.chip")}
    </span>
  );

  if (s.step === "countdown") {
    return (
      <>
        <CountdownStage
          gameId={round.gameId}
          startAt={round.startAt}
          totalMs={PRACTICE_COUNTDOWN_MS}
          difficulty={round.difficulty}
          chip={chip}
        />
        {quitDialog}
      </>
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
        onOtherGame={otherGame}
      />
    );
  }

  const best = bestFor(s.records, round.gameId, round.difficulty);
  // Ô kỷ lục thay dải đối thủ (khu 13).
  const aside = (
    <p className="flex min-h-10 items-center gap-2 self-start rounded-2xl border-[2.5px] border-chalk/60 bg-board-shade px-3.5 py-1.5 text-sm font-bold text-chalk lg:min-h-12 lg:text-base">
      <TrophyIcon aria-hidden className="size-4.5 text-primary" strokeWidth={2.4} />
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
      {quitDialog}
    </>
  );
}
