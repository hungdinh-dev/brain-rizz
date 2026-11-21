import { CHARACTER_IDS, type CharacterId, isPetId, type PetId } from "@brain-rizz/shared";
import { CheckIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Character } from "@/components/characters";
import { cn } from "@/lib/utils";
import { petInfo } from "../pet-info";
import { lockedLast, usePetUnlocks } from "../use-pet-unlocks";
import { useUnlockText } from "../use-unlock-text";
import { LockBadge, UnlockBar } from "./LockParts";
import { PetLockSheet } from "./PetLockSheet";

interface PetGridProps {
  /** Nhân vật đang chọn (luôn hiện như đã mở, kể cả khi chưa tải được tiến độ). */
  value: CharacterId;
  /** Chọn một nhân vật đã mở. Thú khoá không bao giờ gọi hàm này. */
  onPick(id: CharacterId): void;
  /** Trước khi rời màn bằng nút "Luyện ngay" / "Chơi party" (Hồ sơ: lưu bản nháp). */
  beforeNavigate?(): void;
  className?: string;
}

const CARD =
  "relative flex w-full cursor-pointer flex-col items-center rounded-3xl border-[3px] border-sticker shadow-sticker transition-[translate,box-shadow] outline-none hover:-translate-y-1 focus-visible:ring-3 focus-visible:ring-ring active:translate-y-1 active:shadow-none";

/**
 * Lưới 12 bạn đồng hành của trang Hồ sơ (ui-ux 6.12; 3 cột, máy tính 4): đã mở trước, khoá sau, theo thứ tự `CHARACTER_IDS`. Đã mở:
 * đang chọn nền vàng + ✓, vừa mở chưa xem có chip "Mới!". Khoá: nền `muted`, nhân vật xám, ổ khoá,
 * điều kiện ngắn + thanh tiến độ; bấm mở sheet điều kiện (không đổi nhân vật).
 */
export function PetGrid({ value, onPick, beforeNavigate, className }: PetGridProps) {
  const { t } = useTranslation();
  const unlocks = usePetUnlocks();
  const text = useUnlockText();
  const [sheet, setSheet] = useState<PetId | null>(null);
  /** Thẻ thú khoá vừa mở sheet: nhận lại focus khi đóng. */
  const opener = useRef<HTMLButtonElement | null>(null);
  const isOpen = (id: CharacterId) => id === value || unlocks.isUnlocked(id);

  return (
    <>
      <ul className={cn("grid grid-cols-3 gap-3 md:gap-4 lg:grid-cols-4", className)}>
        {lockedLast(CHARACTER_IDS, isOpen).map((id, i) => {
          if (isOpen(id)) {
            const picked = id === value;
            return (
              <li key={id} className="relative">
                <button
                  type="button"
                  aria-pressed={picked}
                  onClick={() => onPick(id)}
                  className={cn(
                    CARD,
                    "h-full",
                    "min-h-32 px-1 pt-2 pb-3",
                    picked ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground",
                  )}
                >
                  {picked && (
                    <span className="absolute -top-3 -right-2 grid size-8 place-items-center rounded-full border-[3px] border-sticker bg-compute text-paper">
                      <CheckIcon aria-hidden className="size-4" strokeWidth={3.5} />
                    </span>
                  )}
                  {unlocks.isNew(id) && <NewChip />}
                  <Character id={id} mood={picked ? "happy" : "idle"} size={72} delay={-0.5 * i} />
                  <span className="mt-1 font-display text-lg leading-none font-extrabold md:text-xl">
                    {t(`characters.${id}.name`)}
                  </span>
                  <span
                    className={cn(
                      "text-center text-xs",
                      picked ? "text-primary-foreground/75" : "text-muted-foreground",
                    )}
                  >
                    {t(`characters.${id}.species`)}
                  </span>
                </button>
              </li>
            );
          }

          // Chỉ thú mới có thể khoá (nhân vật cũ luôn mở).
          if (!isPetId(id)) return null;
          const info = petInfo(id, unlocks.progress(id), text);
          const aria = t("pets.lockedAria", { name: info.name, condition: info.sentence });

          return (
            <li key={id} className="relative">
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={aria}
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  setSheet(id);
                }}
                className={cn(CARD, "h-full min-h-32 bg-muted px-1 pt-2 pb-3 text-card-foreground")}
              >
                <LockBadge />
                <Character id={id} size={72} animated={false} className="opacity-55 grayscale" />
                <span className="mt-1 font-display text-lg leading-none font-extrabold md:text-xl">
                  {info.name}
                </span>
                <span className="mt-1 flex w-[86%] flex-col gap-0.75">
                  <span className="line-clamp-2 text-[11px] leading-tight font-bold text-muted-foreground tabular-nums">
                    {info.label}
                  </span>
                  <UnlockBar ratio={info.ratio} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <PetLockSheet
        pet={sheet}
        onOpenChange={(open) => {
          if (!open) setSheet(null);
        }}
        beforeNavigate={beforeNavigate}
        returnFocus={opener}
      />
    </>
  );
}

/** Chip "Mới!" nghiêng ở góc trái thẻ: thú vừa mở trên máy này, chưa xem hộp chúc mừng. */
function NewChip() {
  const { t } = useTranslation();
  return (
    <span className="absolute -top-2.5 -left-1 z-10 inline-flex h-5.5 -rotate-6 items-center rounded-full border-[2.5px] border-sticker bg-mint px-2 font-display text-[12.5px] leading-none font-extrabold text-ink">
      {t("pets.isNew")}
    </span>
  );
}
