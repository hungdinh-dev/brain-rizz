import { SparklesIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMotion } from "../motion.store";

/**
 * Nút Hiệu ứng (CR-010, ui-ux 6.1): "Theo hệ thống" ↔ "Luôn bật". Máy đang giảm chuyển động mà
 * vẫn theo hệ thống thì có chấm cam ở góc; "Luôn bật" thì nền phấn đặc — không chỉ báo bằng màu.
 */
export function MotionToggle() {
  const { t } = useTranslation();
  const preference = useMotion((s) => s.preference);
  const systemReduced = useMotion((s) => s.systemReduced);
  const toggle = useMotion((s) => s.toggle);
  const on = preference === "on";
  const title = on
    ? t("motion.titleOn")
    : systemReduced
      ? t("motion.titleReduced")
      : t("motion.titleSystem");

  return (
    <Button
      variant="chalk"
      size="icon-chalk"
      data-sfx="toggle"
      aria-label={t("motion.toggle")}
      aria-pressed={on}
      title={title}
      className={cn("relative", on && "border-chalk bg-chalk text-background hover:border-chalk")}
      onClick={() => {
        toggle();
        toast(on ? t("motion.toastSystem") : t("motion.toastOn"), { duration: 2500 });
      }}
    >
      <SparklesIcon aria-hidden />
      {!on && systemReduced && (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-sticker bg-identify"
        />
      )}
    </Button>
  );
}
