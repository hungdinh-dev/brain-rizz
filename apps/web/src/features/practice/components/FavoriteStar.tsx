import type { GameId } from "@brain-rizz/shared";
import { StarIcon } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { prefersReducedMotion } from "@/features/motion";
import { cn } from "@/lib/utils";
import { useFavorites } from "../favorites";

/**
 * Nút ⭐ Yêu thích (CR-020, UI-UX 6.10): trên thẻ game ở màn chọn game và ở đầu màn hướng dẫn
 * Luyện tập. Nhãn cố định "Yêu thích: {tên}" + `aria-pressed` (trình đọc màn hình đọc đã nhấn /
 * chưa nhấn); "Thêm / Bỏ yêu thích" chỉ ở `title`. Bấm → đổi ngay, toast 2,5 s, vừa bật thì nảy.
 */

/** Nảy 1 → 1,3 → 1 trong 260 ms (`--ease-pop`), chỉ khi không giảm chuyển động. Chỉ animate transform. */
function pop(el: Element | null) {
  if (!el || typeof el.animate !== "function" || prefersReducedMotion()) return;
  const easing = getComputedStyle(el).getPropertyValue("--ease-pop").trim() || "ease-out";
  el.animate([{ transform: "scale(1)" }, { transform: "scale(1.3)" }, { transform: "scale(1)" }], {
    duration: 260,
    easing,
  });
}

/** Bấm ⭐: đổi trên máy (đồng bộ ngầm), báo bằng toast, nảy phần tử `target` khi vừa bật. */
function useToggleFavorite() {
  const { t } = useTranslation();
  const toggle = useFavorites((s) => s.toggle);
  return (gameId: GameId, name: string, target: Element | null) => {
    const added = toggle(gameId);
    if (added) pop(target);
    toast(t(added ? "practice.favoriteAdded" : "practice.favoriteRemoved", { name }), {
      // Bấm liên tiếp thì thay toast cũ, không chồng nhiều cái.
      id: "practice-favorite",
      duration: 2_500,
      icon: (
        <StarIcon
          aria-hidden
          className={cn("size-4.5", added && "fill-primary text-sticker")}
          strokeWidth={2.4}
        />
      ),
    });
  };
}

interface FavoriteProps {
  gameId: GameId;
  /** Tên game đã dịch (nhãn, toast). */
  name: string;
}

/**
 * ⭐ đè góc trên phải ô ảnh của thẻ game. Đặt làm anh em (không lồng) của nút thẻ, trong khung
 * `relative`; vùng chạm 44 × 44, hình tròn 32/34 ở giữa cách mép ảnh ~4 px.
 */
export function TileFavoriteStar({ gameId, name }: FavoriteProps) {
  const { t } = useTranslation();
  const on = useFavorites((s) => s.ids.includes(gameId));
  const toggle = useToggleFavorite();
  const circle = useRef<HTMLSpanElement>(null);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={t("practice.favoriteLabel", { name })}
      title={t(on ? "practice.favoriteRemove" : "practice.favoriteAdd")}
      onClick={() => toggle(gameId, name, circle.current)}
      className="group/star absolute top-[58px] right-3 z-10 flex size-11 cursor-pointer items-center justify-center rounded-full outline-none lg:top-[66px] lg:right-3.5"
    >
      <span
        ref={circle}
        className={cn(
          "flex size-8 items-center justify-center rounded-full transition-[scale,background-color] duration-150 group-hover/star:scale-108 group-focus-visible/star:ring-3 group-focus-visible/star:ring-ring group-focus-visible/star:ring-offset-2 group-focus-visible/star:ring-offset-sticker group-active/star:scale-92 lg:size-8.5",
          on
            ? "border-[2.5px] border-sticker bg-primary text-primary-foreground shadow-[0_2px_0_var(--sticker)]"
            : "border-2 border-chalk/85 bg-sticker/60 text-chalk group-hover/star:bg-sticker/80",
        )}
      >
        <StarIcon
          aria-hidden
          className={cn("size-4.5 lg:size-5", on && "fill-current")}
          strokeWidth={2.4}
        />
      </span>
    </button>
  );
}

/**
 * ⭐ ở đầu màn hướng dẫn Luyện tập: điện thoại = nút phấn tròn 44 chỉ có icon; máy tính
 * (`withLabel`) = nút phấn cao 44 có chữ "Yêu thích". Bật thì nền vàng, viền mực, bóng 3 px.
 */
export function SetupFavoriteButton({
  gameId,
  name,
  withLabel = false,
  className,
}: FavoriteProps & { withLabel?: boolean; className?: string }) {
  const { t } = useTranslation();
  const on = useFavorites((s) => s.ids.includes(gameId));
  const toggle = useToggleFavorite();
  const icon = useRef<SVGSVGElement>(null);
  return (
    <Button
      variant="chalk"
      size={withLabel ? "sm" : "icon-chalk"}
      aria-pressed={on}
      aria-label={t("practice.favoriteLabel", { name })}
      title={t(on ? "practice.favoriteRemove" : "practice.favoriteAdd")}
      onClick={() => toggle(gameId, name, icon.current)}
      className={cn(
        withLabel && "h-11 gap-2 pr-4 pl-3 text-base",
        on &&
          "border-sticker bg-primary text-primary-foreground shadow-[0_3px_0_var(--sticker)] hover:border-sticker",
        className,
      )}
    >
      <StarIcon
        ref={icon}
        aria-hidden
        className={cn(withLabel ? "size-5" : "size-5.5", on && "fill-current")}
        strokeWidth={2.4}
      />
      {withLabel && t("practice.favoriteButton")}
    </Button>
  );
}
