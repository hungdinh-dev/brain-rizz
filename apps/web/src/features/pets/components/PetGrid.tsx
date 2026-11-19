import { CHARACTER_IDS, type CharacterId, isPetId, type PetId } from "@brain-rizz/shared";
import { CheckIcon, LockOpenIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Character } from "@/components/characters";
import { Button } from "@/components/ui/button";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { openPetGoal } from "../open-goal";
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
  /**
   * `profile`: lưới Hồ sơ (3 cột, máy tính 4). `wardrobe`: tab Bạn đồng hành của Tủ đồ (điện thoại
   * 3 cột; máy tính 6 cột thẻ cao, thú khoá ghi sẵn điều kiện + nút đi tới trong thẻ).
   */
  layout?: "profile" | "wardrobe";
  /** Trước khi rời màn bằng nút "Luyện ngay" / "Chơi party" (Hồ sơ: lưu bản nháp). */
  beforeNavigate?(): void;
  className?: string;
}

const CARD =
  "relative flex w-full cursor-pointer flex-col items-center rounded-3xl border-[3px] border-sticker shadow-sticker transition-[translate,box-shadow] outline-none hover:-translate-y-1 focus-visible:ring-3 focus-visible:ring-ring active:translate-y-1 active:shadow-none";

/**
 * Lưới 12 bạn đồng hành (ui-ux 6.12): đã mở trước, khoá sau, theo thứ tự `CHARACTER_IDS`. Đã mở:
 * đang chọn nền vàng + ✓, vừa mở chưa xem có chip "Mới!". Khoá: nền `muted`, nhân vật xám, ổ khoá,
 * điều kiện ngắn + thanh tiến độ; bấm mở sheet điều kiện (không đổi nhân vật).
 */
export function PetGrid({
  value,
  onPick,
  layout = "profile",
  beforeNavigate,
  className,
}: PetGridProps) {
  const { t } = useTranslation();
  const unlocks = usePetUnlocks();
  const text = useUnlockText();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [sheet, setSheet] = useState<PetId | null>(null);
  /** Thẻ thú khoá vừa mở sheet: nhận lại focus khi đóng. */
  const opener = useRef<HTMLButtonElement | null>(null);
  const isOpen = (id: CharacterId) => id === value || unlocks.isUnlocked(id);
  const detailed = layout === "wardrobe" && desktop;

  return (
    <>
      <ul
        className={cn(
          "grid grid-cols-3",
          layout === "wardrobe"
            ? "gap-x-2.5 gap-y-3.5 lg:grid-cols-6 lg:gap-x-4 lg:gap-y-4.5"
            : "gap-3 md:gap-4 lg:grid-cols-4",
          className,
        )}
      >
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
                    picked ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground",
                    detailed
                      ? "min-h-62 justify-center gap-1 px-2 py-3"
                      : "min-h-32 px-1 pt-2 pb-3",
                  )}
                >
                  {picked && (
                    <span className="absolute -top-3 -right-2 grid size-8 place-items-center rounded-full border-[3px] border-sticker bg-compute text-paper">
                      <CheckIcon aria-hidden className="size-4" strokeWidth={3.5} />
                    </span>
                  )}
                  {unlocks.isNew(id) && <NewChip />}
                  <Character
                    id={id}
                    mood={picked ? "happy" : "idle"}
                    size={detailed ? 118 : 72}
                    delay={-0.5 * i}
                  />
                  <span
                    className={cn(
                      "mt-1 font-display leading-none font-extrabold",
                      detailed ? "text-[22px]" : "text-lg md:text-xl",
                    )}
                  >
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
                  {detailed && isPetId(id) && (
                    <span className="mt-1 flex items-center gap-1 text-[11.5px] font-bold opacity-85">
                      <LockOpenIcon aria-hidden className="size-3.5" strokeWidth={2.6} />
                      {t("pets.wasLocked")}
                    </span>
                  )}
                </button>
              </li>
            );
          }

          // Chỉ thú mới có thể khoá (nhân vật cũ luôn mở).
          if (!isPetId(id)) return null;
          const info = petInfo(id, unlocks.progress(id), text);
          const aria = t("pets.lockedAria", { name: info.name, condition: info.sentence });

          if (detailed) {
            return (
              <li key={id} className="relative">
                {/* Thẻ khoá máy tính: điều kiện ghi sẵn trong thẻ, nút đi tới màn luyện / chơi. */}
                <fieldset className="relative flex h-full min-h-62 min-w-0 flex-col items-center gap-1 rounded-3xl border-[3px] border-sticker bg-muted px-2.5 pt-2.5 pb-3 text-center text-card-foreground shadow-sticker">
                  <legend className="sr-only">{t("pets.lockedName", { name: info.name })}</legend>
                  <LockBadge />
                  <Character id={id} size={84} animated={false} className="opacity-55 grayscale" />
                  <span className="font-display text-xl leading-none font-extrabold">
                    {info.name}
                  </span>
                  <span className="min-h-7.5 text-[11.5px] leading-tight text-muted-foreground">
                    {info.sentence}
                  </span>
                  <span className="mt-1 flex w-full items-center gap-1.5">
                    <UnlockBar ratio={info.ratio} className="flex-1" />
                    <span className="shrink-0 text-[11.5px] font-extrabold tabular-nums">
                      {info.label}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-auto min-h-11 w-full border-[2.5px] text-[13.5px]"
                    onClick={() => {
                      beforeNavigate?.();
                      openPetGoal(info.goal);
                    }}
                  >
                    {info.cta}
                  </Button>
                </fieldset>
              </li>
            );
          }

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
