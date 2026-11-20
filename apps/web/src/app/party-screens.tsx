import { isChatPhase, type Phase } from "@brain-rizz/shared";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { QuitDialog } from "@/components/common/QuitDialog";
import { ChatDock } from "@/features/chat";
import { GameIntroScreen } from "@/features/game-intro";
import { GameSelectScreen } from "@/features/game-select";
import { LobbyScreen } from "@/features/lobby";
import { CountdownScreen, PlayScreen } from "@/features/play";
import { PodiumScreen, ResultsScreen } from "@/features/results";
import { registerGameLocales } from "@/i18n/games";
import { leaveParty } from "@/net/connection";
import { useGame } from "@/stores/game.store";
import { type Route, restoreEntry, setBackGuard, useNav } from "@/stores/nav.store";

/*
 * Các màn trong phòng party, tải lười thành chunk riêng (cùng registry minigame: chữ + hình minh hoạ)
 * để gói đầu chỉ có menu (NFR-PERF-01). App tải trước chunk này lúc rảnh ở menu.
 */
registerGameLocales();

/** Màn hình theo pha của phòng (CR-005): lobby → game-select → game-intro → countdown → playing → round-results → podium. */
const SCREENS: Record<Phase, () => React.ReactNode> = {
  lobby: LobbyScreen,
  "game-select": GameSelectScreen,
  "game-intro": GameIntroScreen,
  countdown: CountdownScreen,
  playing: PlayScreen,
  "round-results": ResultsScreen,
  podium: PodiumScreen,
};

/**
 * Màn của pha hiện tại, kèm khung chat ở các pha có chat (CR-011). Lúc đếm ngược / đang chơi
 * màn đứng một mình như trước (khung chat gỡ hẳn, không chừa chỗ).
 */
export function PartyScreen({ phase }: { phase: Phase }) {
  const Screen = SCREENS[phase];
  return (
    <>
      {isChatPhase(phase) ? (
        <div className="flex flex-1 gap-5">
          {/* Điện thoại: chừa đáy để nút chính không nằm dưới nút chat nổi (cách đáy màn ≥ 80 px). */}
          <div className="flex min-w-0 flex-1 flex-col max-lg:pb-12">
            <Screen />
          </div>
          <ChatDock phase={phase} />
        </div>
      ) : (
        <Screen />
      )}
      {/* Cùng một vị trí ở mọi pha: hộp "Rời phòng?" không bị dựng lại khi đổi pha. */}
      <LeaveOnBack />
    </>
  );
}

/**
 * Back của trình duyệt khi đang trong phòng (CR-022): hỏi "Rời phòng?". Đồng ý → rời phòng (server
 * bỏ ghế, không để phòng treo) rồi về màn trước; Ở lại → đẩy lại mục `/r/<mã>`, trận không lệch
 * (màn vẫn theo pha do server quyết).
 */
function LeaveOnBack() {
  const { t } = useTranslation();
  const code = useGame((s) => s.party?.code ?? "");
  const [open, setOpen] = useState(false);
  // Màn muốn về; ref vì nút Rời phòng chạy trước onOpenChange(false) trong cùng một lần bấm.
  const target = useRef<Route | null>(null);

  useEffect(() => {
    const remove = setBackGuard((to) => {
      target.current = to;
      setOpen(true);
      return true;
    });
    return () => {
      remove();
      // Phòng mất (bị đóng, rời bằng nút khác) khi hộp đang mở: URL đã là màn trước, khớp màn theo nó.
      const to = target.current;
      target.current = null;
      if (to) useNav.getState().go(to, { replace: true });
    };
  }, []);

  return (
    <QuitDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && target.current) {
          target.current = null;
          restoreEntry();
        }
      }}
      title={t("common.leaveRoomTitle")}
      description={t("common.leaveRoomBody", { code })}
      cancelLabel={t("common.stay")}
      confirmLabel={t("common.leaveRoomConfirm")}
      onConfirm={() => {
        const to = target.current;
        target.current = null;
        setOpen(false);
        void leaveParty().finally(() => {
          if (to) useNav.getState().go(to, { replace: true });
        });
      }}
    />
  );
}
