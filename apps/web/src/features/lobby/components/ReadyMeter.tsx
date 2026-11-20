import { MAX_PLAYERS } from "@brain-rizz/shared";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface ReadyMeterProps {
  /** Số ghế đã có người, gồm cả bot (CR-016). */
  players: number;
  /** Số người sẵn sàng; bot luôn sẵn sàng nên được tính. */
  ready: number;
  /** Số bot: có bot thì máy tính thêm dòng nhắc "tính cả bot". */
  bots?: number;
  className?: string;
}

/** Bộ đếm "Người chơi x/12", "Sẵn sàng y/x" và thanh tiến độ sẵn sàng, viết thẳng trên bảng. */
export function ReadyMeter({ players, ready, bots = 0, className }: ReadyMeterProps) {
  const { t } = useTranslation();
  const pct = players > 0 ? (ready / players) * 100 : 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 lg:h-8.5 lg:flex-row lg:items-center lg:gap-6",
        className,
      )}
    >
      <div className="flex items-baseline justify-between lg:contents">
        <span className="flex items-baseline gap-1.5 lg:gap-2">
          <span className="text-[13px] font-semibold text-chalk-muted lg:text-[15px]">
            {t("lobby.playersLabel")}
          </span>
          <span className="font-display text-[21px] font-extrabold text-chalk tabular-nums lg:text-[26px]">
            {players}/{MAX_PLAYERS}
          </span>
        </span>
        <span className="flex items-baseline gap-1.5 lg:gap-2">
          <span className="text-[13px] font-semibold text-chalk-muted lg:text-[15px]">
            {t("lobby.readyLabel")}
          </span>
          <span className="font-display text-[21px] font-extrabold text-primary tabular-nums lg:text-[26px]">
            {ready}/{players}
          </span>
        </span>
      </div>
      <span
        role="progressbar"
        aria-label={t("lobby.readyProgress")}
        aria-valuemin={0}
        aria-valuemax={players}
        aria-valuenow={ready}
        className="block h-3.5 rounded-full border-2 border-chalk p-0.5 lg:h-4.5 lg:max-w-80 lg:flex-1 lg:border-[2.5px]"
      >
        <span
          className="block h-full rounded-full bg-primary transition-[width] duration-300"
          // Độ rộng tính lúc chạy theo số người sẵn sàng.
          style={{ width: `${pct}%` }}
        />
      </span>
      {/* Chỉ khi màn đủ rộng (cột chat chiếm chỗ thì bỏ, không bóp thanh tiến độ). */}
      {bots > 0 && (
        <span className="hidden text-[13px] font-semibold whitespace-nowrap text-chalk-muted @min-[66rem]:lg:inline">
          {t("bots.meterHint")}
        </span>
      )}
    </div>
  );
}
