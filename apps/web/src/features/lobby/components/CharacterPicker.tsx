import { CHARACTER_IDS, type CharacterId, isPetId, type PetId } from "@brain-rizz/shared";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Character } from "@/components/characters";
import { LockBadge, lockedLast, PetLockSheet, usePetUnlocks } from "@/features/pets";
import { cn } from "@/lib/utils";

interface CharacterPickerProps {
  value: CharacterId;
  onChange(id: CharacterId): void;
  /**
   * Phòng 12 ghế (ui-ux 6.8): điện thoại chỉ còn hàng nút 44 px (tiêu đề cho trình đọc màn hình)
   * để nút Sẵn sàng vẫn nằm trong màn đầu ở 390×844.
   */
  compact?: boolean;
  className?: string;
}

/**
 * Dải đổi nhân vật ngay trong phòng chờ. Đổi lúc nào cũng được, không làm mất trạng thái sẵn sàng.
 * 12 nhân vật (ui-ux 6.12): đã mở trước, thú khoá sau (xám + ổ khoá); điện thoại một hàng cuộn
 * ngang (snap, mờ mép phải), máy tính hiện thêm tên dưới mỗi nhân vật. Bấm thú khoá → sheet / hộp
 * điều kiện (không có nút đi tới màn khác vì đang trong phòng), không đổi nhân vật.
 */
export function CharacterPicker({ value, onChange, compact, className }: CharacterPickerProps) {
  const { t } = useTranslation();
  const unlocks = usePetUnlocks();
  const [sheet, setSheet] = useState<PetId | null>(null);
  /** Nút thú khoá vừa mở sheet: nhận lại focus khi đóng. */
  const opener = useRef<HTMLButtonElement | null>(null);
  const isOpen = (id: CharacterId) => id === value || unlocks.isUnlocked(id);

  return (
    // Gọn: tiêu đề chỉ còn cho trình đọc màn hình nên bỏ khe trên hàng nút (không chừa 8 px trống).
    <div className={cn("flex min-w-0 flex-col gap-2", compact && "max-lg:gap-0", className)}>
      <div
        className={cn(
          "flex items-baseline justify-between gap-3 lg:justify-start lg:gap-3.5",
          compact && "max-lg:sr-only",
        )}
      >
        <span className="font-display text-lg font-extrabold text-chalk lg:text-[21px]">
          {t("lobby.yourCharacter")}
        </span>
        <span className="text-xs text-chalk-muted lg:text-[13px]">{t("lobby.changeAnytime")}</span>
      </div>
      {/*
        Điện thoại: một hàng cuộn ngang, chừa lề để vòng chọn (7 px) và ổ khoá không bị cắt.
        Máy tính: xuống dòng khi cột hẹp (có cột chat) thay vì cuộn.
      */}
      <fieldset className="-mx-1.5 flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto px-3 pt-2.5 pb-2.5 [mask-image:linear-gradient(90deg,#000_88%,transparent)] [scrollbar-width:none] lg:mx-0 lg:snap-none lg:flex-wrap lg:gap-3.5 lg:overflow-visible lg:px-1 lg:pt-1.5 lg:pb-0 lg:[mask-image:none]">
        <legend className="sr-only">{t("lobby.pickCharacter")}</legend>
        {lockedLast(CHARACTER_IDS, isOpen).map((id) => {
          const locked = !isOpen(id) && isPetId(id);
          const picked = id === value;
          const name = t(`characters.${id}.name`);
          return (
            <span key={id} className="flex shrink-0 snap-start flex-col items-center gap-1">
              <span className="relative">
                <button
                  type="button"
                  aria-pressed={locked ? undefined : picked}
                  aria-haspopup={locked ? "dialog" : undefined}
                  aria-label={
                    locked
                      ? t("pets.lockedShort", { name })
                      : t("lobby.pickCharacterItem", { name })
                  }
                  onClick={(event) => {
                    if (!locked) {
                      onChange(id);
                      return;
                    }
                    opener.current = event.currentTarget;
                    setSheet(id);
                  }}
                  className={cn(
                    "relative block cursor-pointer overflow-hidden rounded-full border-[3px] border-sticker transition-[translate,box-shadow] outline-none hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring lg:size-14 lg:border-[3.5px]",
                    compact ? "size-11" : "size-11.5",
                    locked ? "bg-muted" : "bg-card",
                    picked
                      ? "shadow-[0_0_0_4px_var(--color-primary),0_0_0_7px_var(--color-sticker)]"
                      : "shadow-sticker-sm active:translate-y-1 active:shadow-none",
                  )}
                >
                  {/* Cỡ SVG theo khung tròn (CSS ghi đè width/height của SVG) */}
                  <Character
                    id={id}
                    mood={picked ? "happy" : "idle"}
                    animated={false}
                    className={cn(
                      "absolute inset-x-0 -bottom-1.5 mx-auto size-full [&_svg]:size-full",
                      locked && "opacity-55 grayscale",
                    )}
                  />
                </button>
                {locked && <LockBadge size="sm" />}
              </span>
              <span
                aria-hidden
                className={cn(
                  "hidden text-[12.5px] text-chalk lg:block",
                  picked ? "font-extrabold" : "font-medium",
                )}
              >
                {name}
              </span>
            </span>
          );
        })}
      </fieldset>
      <PetLockSheet
        pet={sheet}
        actions={false}
        onOpenChange={(open) => {
          if (!open) setSheet(null);
        }}
        returnFocus={opener}
      />
    </div>
  );
}
