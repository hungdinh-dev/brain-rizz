import { ClientMessage } from "@brain-rizz/shared";
import { CrownIcon, Disc3Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RoundChip } from "@/components/common/MatchChips";
import { send } from "@/net/connection";
import { useGame } from "@/stores/game.store";
import { ModeSwitch } from "./components/ModeSwitch";
import { PickView } from "./components/PickView";
import { WheelView } from "./components/WheelView";

/**
 * Chọn game đầu mỗi vòng (pha `game-select`, khu 6): vòng quay may mắn hoặc chủ phòng chọn
 * (người khác bình chọn gợi ý). Chỉ chủ phòng đổi chế độ, và chỉ khi vòng quay chưa quay.
 */
export function GameSelectScreen() {
  const { t } = useTranslation();
  const party = useGame((s) => s.party)!;
  const sessionId = useGame((s) => s.sessionId);
  const isHost = party.hostId === sessionId;
  const spun = party.wheelSpinAt > 0;
  const ModeIcon = party.pickMode === "wheel" ? Disc3Icon : CrownIcon;

  return (
    <main className="flex flex-1 flex-col gap-3.5 lg:gap-4.5">
      <header className="flex flex-col gap-2.5 lg:min-h-14 lg:flex-row lg:items-center lg:gap-4">
        <div className="flex items-center gap-2.5 lg:gap-4">
          <RoundChip
            round={party.round}
            total={party.totalRounds}
            size="lg"
            className="lg:text-xl"
          />
          <h1 className="font-display text-[26px] leading-none font-extrabold text-chalk lg:sticker-text lg:text-[42px] lg:text-paper lg:[--stroke:7px]">
            {t("gameSelect.title")}
          </h1>
        </div>
        {isHost ? (
          <ModeSwitch
            value={party.pickMode}
            disabled={spun}
            onChange={(mode) => send(ClientMessage.SetPickMode, { mode })}
            className="lg:ml-auto"
          />
        ) : (
          <>
            <span className="inline-flex h-8 items-center gap-1.5 self-start rounded-full border-2 border-chalk/70 px-3 text-[13px] font-semibold text-chalk lg:hidden">
              <ModeIcon aria-hidden className="size-4" />
              {t("gameSelect.modeLabel", {
                mode:
                  party.pickMode === "wheel" ? t("gameSelect.modeWheel") : t("gameSelect.modePick"),
              })}
            </span>
            <span className="hidden items-center gap-3 lg:ml-auto lg:flex">
              <span className="max-w-28 text-right text-[13px] leading-snug text-chalk-muted">
                {t("gameSelect.hostOnly")}
              </span>
              <ModeSwitch value={party.pickMode} />
            </span>
          </>
        )}
      </header>

      {party.pickMode === "wheel" ? (
        <WheelView party={party} isHost={isHost} />
      ) : (
        <PickView party={party} sessionId={sessionId} isHost={isHost} />
      )}
    </main>
  );
}
