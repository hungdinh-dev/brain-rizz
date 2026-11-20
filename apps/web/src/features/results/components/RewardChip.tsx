import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChalkChip } from "@/components/common/ChalkChip";
import { useReducedMotion } from "@/features/motion";
import { useNumberFormat } from "@/hooks/use-number-format";
import { cn } from "@/lib/utils";
import { useGame } from "@/stores/game.store";

/** Chip "+N phấn" nảy vào sau khi chỗ của mình đã lật xong ngần này ms (ui-ux 6.12). */
export const REWARD_POP_DELAY_MS = 360;

interface RewardChipProps {
  /** Chỗ của mình trên bục / bảng đã hiện (chip nảy vào sau đó). */
  shown: boolean;
  /** Đọc "Bạn nhận N phấn" cho trình đọc màn hình (chỉ một chip mỗi màn bật). */
  announce?: boolean;
  /** Dòng nhỏ "Đã cộng vào ví" cạnh chip. */
  note?: boolean;
  /** Giữ chỗ (ẩn) ngay khi đã biết số phấn để nhãn bên cạnh không xô lệch lúc chip nảy vào. */
  reserve?: boolean;
  className?: string;
}

/**
 * "+N phấn" sau trận party (CR-023) từ `ServerMessage.Reward`. Khách không phiên / chưa kết nối
 * (máy chủ không gửi tin) → không hiện gì. Tin chỉ tới người có phiên trong trận đã ghi; `0` = đã
 * chạm trần phấn party hôm nay → chip "+0 phấn" tông thẻ + dòng nhỏ giải thích (ui-ux 6.12, không đỏ).
 */
export function RewardChip({
  shown,
  announce = false,
  note = false,
  reserve = false,
  className,
}: RewardChipProps) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const reduced = useReducedMotion();
  const reward = useGame((s) => s.reward);
  const has = reward !== null;
  const capped = reward === 0;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!(shown && has)) {
      setVisible(false);
      return;
    }
    const id = setTimeout(() => setVisible(true), REWARD_POP_DELAY_MS);
    return () => clearTimeout(id);
  }, [shown, has]);

  const n = fmt(reward ?? 0);
  return (
    <>
      {announce && (
        <p role="status" className="sr-only">
          {visible ? (capped ? t("rewards.capped") : t("rewards.live", { n })) : ""}
        </p>
      )}
      {has && (visible || reserve) && (
        <span
          aria-hidden
          className={cn(
            "flex items-center gap-2",
            capped && "flex-col gap-1 text-center",
            !visible ? "invisible" : reduced ? "animate-in duration-300 fade-in" : "fx-tag-pop",
            className,
          )}
        >
          <ChalkChip tone={capped ? "card" : "reward"} size="sm">
            {t("rewards.amount", { n })}
          </ChalkChip>
          {capped ? (
            <span className="max-w-44 text-[12.5px] leading-tight text-chalk-muted">
              {t("rewards.capped")}
            </span>
          ) : (
            note && <span className="text-[12.5px] text-chalk-muted">{t("rewards.wallet")}</span>
          )}
        </span>
      )}
    </>
  );
}
