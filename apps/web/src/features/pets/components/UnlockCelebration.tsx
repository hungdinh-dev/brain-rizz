import { type PetId, UNLOCK_RULES } from "@brain-rizz/shared";
import { CheckIcon, LockOpenIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Character } from "@/components/characters";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { usePetUnlockStore } from "../pets.store";
import { pendingCelebrations } from "../seen";
import { ruleCondition } from "../unlock-text";
import { usePetUnlocks } from "../use-pet-unlocks";
import { useUnlockText } from "../use-unlock-text";

interface UnlockCelebrationProps {
  /** "Chọn X làm bạn đồng hành": nơi gắn lưu hồ sơ. */
  onChoose(pet: PetId): void;
}

/**
 * Hộp chúc mừng mở thú mới (ui-ux 6.12): so thú đang mở với danh sách đã thấy trên máy này. Nhiều
 * thú cùng lúc → lần lượt từng hộp. Lần đầu có số liệu thì chỉ ghi lại, không chúc mừng thú đã mở
 * sẵn. Đóng (Esc, "Để sau") hay chọn đều đánh dấu đã thấy. Giảm chuyển động: chỉ mờ dần.
 */
export function UnlockCelebration({ onChoose }: UnlockCelebrationProps) {
  const { t } = useTranslation();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const unlocks = usePetUnlocks();
  const text = useUnlockText();
  const seen = usePetUnlockStore((s) => s.seen);
  const fromServer = usePetUnlockStore((s) => s.fromServer);
  const markSeen = usePetUnlockStore((s) => s.markSeen);
  // Chỉ so khi số liệu đọc từ máy chủ (chưa có phiên = số 0, không có gì mới thật).
  const queue =
    unlocks.hasData && fromServer ? pendingCelebrations(unlocks.unlockedPets, seen) : [];
  const pet = queue[0];
  if (!pet) return null;
  const name = t(`characters.${pet}.name`);
  const done = () => markSeen([pet]);

  return (
    <Dialog
      // key theo thú: hộp sau mở lại từ đầu (hoạt ảnh vào).
      key={pet}
      open
      onOpenChange={(open) => {
        if (!open) done();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="max-w-[340px] items-center gap-2.5 overflow-hidden px-4.5 pt-5.5 pb-4.5 text-center lg:max-w-[460px] lg:px-7 lg:pt-6.5 lg:pb-6"
      >
        <ChalkConfetti />
        <span className="relative inline-flex h-7 items-center gap-1.5 rounded-full border-[2.5px] border-sticker bg-mint px-3 text-[13px] font-extrabold text-ink">
          <LockOpenIcon aria-hidden className="size-3.75" strokeWidth={2.6} />
          {t("pets.celebrate.chip")}
        </span>
        <DialogTitle className="relative mt-0.5 lg:text-[30px]">
          {t("pets.celebrate.title")}
        </DialogTitle>
        <Character id={pet} mood="happy" size={desktop ? 170 : 150} />
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-[30px] leading-none font-extrabold">{name}</span>
          <span className="text-sm text-muted-foreground">{t(`characters.${pet}.species`)}</span>
        </div>
        <p className="mt-0.5 inline-flex items-start gap-1.5 rounded-xl bg-muted px-3 py-1.5 text-left text-[13.5px] font-bold">
          <CheckIcon
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-highlight"
            strokeWidth={3}
          />
          {t("pets.celebrate.achieved", { condition: ruleCondition(UNLOCK_RULES[pet], text) })}
        </p>
        <div className="mt-1.5 flex w-full flex-col gap-2.5">
          <Button
            size="lg"
            data-sfx="confirm"
            className="min-h-13.5 text-lg whitespace-normal lg:text-[21px]"
            onClick={() => {
              done();
              onChoose(pet);
            }}
          >
            {t("pets.celebrate.choose", { name })}
          </Button>
          <Button variant="outline" className="min-h-11.5 text-[15px] shadow-none" onClick={done}>
            {t("pets.celebrate.later")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Pháo giấy vẽ phấn tĩnh trên đầu hộp (trang trí, không chuyển động). */
function ChalkConfetti() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 300 90"
      className="pointer-events-none absolute top-1.5 left-1/2 h-[90px] w-[300px] -translate-x-1/2"
    >
      <g fill="none" strokeWidth={4} strokeLinecap="round">
        <path d="M30 40 L44 34" className="stroke-memorize" />
        <path d="M70 14 L76 26" className="stroke-compute" />
        <path d="M250 20 L262 30" className="stroke-analyze" />
        <path d="M220 58 L232 52" className="stroke-identify" />
        <path d="M120 8 L128 18" className="stroke-grape" />
        <path d="M180 12 L186 4" className="stroke-memorize" />
      </g>
      <path
        d="M20 70 L23 63 L26 70 L23 77 Z M276 64 L279 57 L282 64 L279 71 Z M150 30 L152 25 L154 30 L152 35 Z"
        className="fill-sun stroke-ink"
        strokeWidth={2}
      />
    </svg>
  );
}
