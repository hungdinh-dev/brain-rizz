import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useGame } from "@/stores/game.store";
import {
  type BotNameLabels,
  botNumbers,
  joinName,
  type NameParts,
  type NameSource,
  nameParts,
} from "./bot-name";

/**
 * Tên hiển thị của người chơi trong phòng đang mở (CR-016): người thật giữ tên, bot dịch theo
 * nhân vật + hậu tố "· máy", trùng nhân vật thì đánh số theo thứ tự ghế (`bot-name.ts`).
 * `parts` cho chỗ cần tách tên/hậu tố, `full` cho chuỗi liền (aria-label, danh sách tên, toast).
 */
export function usePlayerName() {
  const { t } = useTranslation();
  const players = useGame((s) => s.party?.players);
  return useMemo(() => {
    const numbers = botNumbers(players ? Object.values(players) : []);
    const labels: BotNameLabels = {
      character: (avatar) => t(`characters.${avatar}.name`),
      numbered: (name, n) => t("bots.numbered", { name, n }),
      suffix: t("bots.suffix"),
    };
    const parts = (p: NameSource) => nameParts(p, numbers, labels);
    return { parts, full: (p: NameSource) => joinName(parts(p)) };
  }, [players, t]);
}

interface PlayerNameProps {
  player: NameSource;
  /** Lớp của phần tên (thường có `truncate`). */
  className?: string;
  /** Lớp của hậu tố "· máy": `text-muted-foreground` trong thẻ, `text-chalk-muted` trên bảng. */
  suffixClassName?: string;
  /**
   * Chỗ chật mà avatar đã có huy hiệu máy (dải điểm, bảng điểm khi chơi): nhường chỗ cho tên.
   * Hậu tố "· máy" ẩn khỏi mắt nhưng trình đọc màn hình vẫn đọc đủ "Fen 2 · máy", `title` cũng
   * vậy; tên cắt phần chữ, giữ số của bot trùng nhân vật ("Fe… 2").
   */
  compact?: boolean;
}

/**
 * Tên người chơi dạng hai phần anh em, đặt trong một hàng flex (như "(bạn)"): khi chật chỉ phần
 * tên bị cắt, hậu tố "· máy" của bot luôn giữ. `compact` thì thành một phần tử duy nhất.
 */
export function PlayerName({ player, className, suffixClassName, compact }: PlayerNameProps) {
  const { parts } = usePlayerName();
  const split = parts(player);
  if (compact) return <CompactName parts={split} className={className} />;
  const { name, suffix } = split;
  return (
    <>
      <span className={className}>{name}</span>
      {suffix && (
        <span className={cn("shrink-0 font-sans font-semibold", suffixClassName)}>{suffix}</span>
      )}
    </>
  );
}

function CompactName({ parts, className }: { parts: NameParts; className?: string }) {
  const { name, tail, suffix } = parts;
  const head = tail ? name.slice(0, -tail.length) : name;
  return (
    <span className={cn("flex min-w-0", className)} title={joinName(parts)}>
      <span className="truncate">{head}</span>
      {tail && <span className="shrink-0 whitespace-pre">{tail}</span>}
      {suffix && <span className="sr-only">{` ${suffix}`}</span>}
    </span>
  );
}
