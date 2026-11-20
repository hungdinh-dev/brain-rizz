import type { PetId } from "@brain-rizz/shared";
import { LockIcon } from "lucide-react";
import { type RefObject, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Character } from "@/components/characters";
import { CATEGORY_BG } from "@/components/common/MatchChips";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { openPetGoal } from "../open-goal";
import { type PetInfo, petInfo } from "../pet-info";
import { usePetUnlocks } from "../use-pet-unlocks";
import { useUnlockText } from "../use-unlock-text";
import { LockBadge, UnlockBar } from "./LockParts";

interface PetLockSheetProps {
  /** Thú đang xem điều kiện; `null` = đóng. */
  pet: PetId | null;
  onOpenChange(open: boolean): void;
  /**
   * Nút đi tới màn luyện / chơi ("Luyện ngay", "Chơi party", "Kiểm tra não"). Tắt ở phòng chờ:
   * đang trong phòng thì chỉ xem điều kiện.
   */
  actions?: boolean;
  /** Ngay trước khi rời màn (Hồ sơ: lưu tên + nhân vật đang sửa). */
  beforeNavigate?(): void;
  /**
   * Thẻ / nút thú đã mở sheet: nhận lại focus khi đóng (mở không qua DialogTrigger nên Radix không
   * tự trả, focus rơi về `body`). Đã rời màn ("Luyện ngay") thì thôi.
   */
  returnFocus?: RefObject<HTMLElement | null>;
}

/**
 * Điều kiện mở một thú khoá (ui-ux 6.12): điện thoại là sheet dưới, máy tính là hộp nhỏ. Nhân vật
 * xám + ổ khoá, "Cách mở khoá" đủ câu, "Tiến độ" + thanh, gợi ý; Lửa có thêm từng nhóm. Bấm thú
 * khoá không đổi nhân vật.
 */
export function PetLockSheet({
  pet,
  onOpenChange,
  actions = true,
  beforeNavigate,
  returnFocus,
}: PetLockSheetProps) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const unlocks = usePetUnlocks();
  const text = useUnlockText();
  // Giữ nội dung trong lúc hoạt ảnh đóng chạy (pet đã về null).
  const last = useRef<PetId | null>(pet);
  if (pet) last.current = pet;
  const id = pet ?? last.current;
  if (!id) return null;

  const info = petInfo(id, unlocks.progress(id), text);
  const close = () => onOpenChange(false);
  const go = () => {
    beforeNavigate?.();
    close();
    openPetGoal(info.goal);
  };
  const onCloseAutoFocus = (event: Event) => {
    const target = returnFocus?.current;
    if (!target?.isConnected) return;
    event.preventDefault();
    target.focus();
  };
  const body = <PetLockBody info={info} actions={actions} onClose={close} onGo={go} />;

  return desktop ? (
    <Dialog open={pet !== null} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
        className="max-w-[460px] gap-3 px-6.5 py-6"
      >
        {body}
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet open={pet !== null} onOpenChange={onOpenChange}>
      <SheetContent
        aria-describedby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
        side="bottom"
        className="gap-3 px-4.5 pt-4"
      >
        {body}
      </SheetContent>
    </Sheet>
  );
}

function PetLockBody({
  info,
  actions,
  onClose,
  onGo,
}: {
  info: PetInfo;
  actions: boolean;
  onClose(): void;
  onGo(): void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex items-center gap-3.5">
        <span className="relative shrink-0">
          <Character id={info.id} size={104} animated={false} className="opacity-55 grayscale" />
          <LockBadge className="top-0.5 right-0" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-muted-foreground">
            <LockIcon aria-hidden className="size-3.5" strokeWidth={2.6} />
            {t("pets.locked")}
          </span>
          <DialogTitle className="text-[30px]">{info.name}</DialogTitle>
          <span className="text-sm text-muted-foreground">{info.species}</span>
        </div>
      </div>

      <section className="flex flex-col gap-1.5">
        <h3 className="font-display text-[17px] leading-none font-extrabold">{t("pets.howTo")}</h3>
        <p className="text-[14.5px] leading-snug">{info.sentence}</p>
      </section>

      <section className="flex flex-col gap-1.5">
        <div className="flex justify-between gap-3 text-[13px] font-bold">
          <span>{t("pets.progress")}</span>
          <span className="tabular-nums">{info.label}</span>
        </div>
        <UnlockBar
          size="lg"
          ratio={info.ratio}
          label={t("pets.progressAria", { name: info.name })}
        />
        {info.parts.length > 0 && (
          <ul aria-label={t("pets.partsLabel")} className="mt-1 flex flex-wrap gap-x-3 gap-y-1.5">
            {info.parts.map((part) => (
              <li
                key={part.category ?? part.label}
                className="flex items-center gap-1 text-xs font-semibold"
              >
                {part.category && (
                  <span
                    aria-hidden
                    className={cn(
                      "size-3.5 shrink-0 rounded-full border-2 border-sticker",
                      CATEGORY_BG[part.category],
                    )}
                  />
                )}
                {part.label}{" "}
                <b className={cn("tabular-nums", part.done && "text-highlight")}>{part.mark}</b>
              </li>
            ))}
          </ul>
        )}
        {info.hint && <span className="text-[12.5px] text-muted-foreground">{info.hint}</span>}
      </section>

      <div className="mt-1 flex gap-2.5">
        <Button variant="outline" className="min-h-13 px-4.5 text-base" onClick={onClose}>
          {t("pets.close")}
        </Button>
        {actions && (
          <Button className="min-h-13 flex-1 text-[19px]" data-sfx="confirm" onClick={onGo}>
            {info.cta}
          </Button>
        )}
      </div>
    </>
  );
}
