import { CHARACTER_IDS, type CharacterId } from "@brain-rizz/shared";
import { useTranslation } from "react-i18next";
import { Character } from "@/components/characters";
import { cn } from "@/lib/utils";

interface CharacterPickerProps {
  value: CharacterId;
  onChange(id: CharacterId): void;
  /**
   * Phòng 12 ghế (ui-ux 6.8): điện thoại chỉ còn hàng 6 nút 44 px (tiêu đề cho trình đọc màn hình)
   * để nút Sẵn sàng vẫn nằm trong màn đầu ở 390×844.
   */
  compact?: boolean;
  className?: string;
}

/**
 * Dải đổi nhân vật ngay trong phòng chờ. Đổi lúc nào cũng được, không làm mất trạng thái sẵn sàng.
 * Máy tính hiện thêm tên dưới mỗi nhân vật.
 */
export function CharacterPicker({ value, onChange, compact, className }: CharacterPickerProps) {
  const { t } = useTranslation();

  return (
    // Gọn: tiêu đề chỉ còn cho trình đọc màn hình nên bỏ khe trên hàng nút (không chừa 8 px trống).
    <div className={cn("flex flex-col gap-2", compact && "max-lg:gap-0", className)}>
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
      <fieldset className="flex min-w-0 justify-between px-1.5 lg:justify-start lg:gap-3.5 lg:px-1">
        <legend className="sr-only">{t("lobby.pickCharacter")}</legend>
        {CHARACTER_IDS.map((id) => {
          const picked = id === value;
          const name = t(`characters.${id}.name`);
          return (
            <span key={id} className="flex flex-col items-center gap-1">
              <button
                type="button"
                aria-pressed={picked}
                aria-label={t("lobby.pickCharacterItem", { name })}
                onClick={() => onChange(id)}
                className={cn(
                  "relative cursor-pointer overflow-hidden rounded-full border-[3px] border-sticker bg-card transition-[translate,box-shadow] outline-none hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring lg:size-15 lg:border-[3.5px]",
                  compact ? "size-11" : "size-11.5",
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
                  className="absolute inset-x-0 -bottom-1.5 mx-auto size-full [&_svg]:size-full"
                />
              </button>
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
    </div>
  );
}
