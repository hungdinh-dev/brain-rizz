import { BellOffIcon, BellRingIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useSfx } from "../sfx.store";

/**
 * Nút bật/tắt âm thanh hiệu ứng (tiếng bấm nút, đếm ngược, đúng/sai) — độc lập với nhạc nền.
 * Icon chuông thay cho loa: loa đứng cạnh thanh âm lượng nhạc dễ bị hiểu là tắt nhạc.
 */
export function SfxToggle() {
  const { t } = useTranslation();
  const enabled = useSfx((s) => s.enabled);
  const toggle = useSfx((s) => s.toggle);
  const label = enabled ? t("sfx.turnOff") : t("sfx.turnOn");

  return (
    <Button
      variant="chalk"
      size="icon-chalk"
      data-sfx="toggle"
      aria-label={label}
      title={label}
      onClick={toggle}
    >
      {enabled ? <BellRingIcon /> : <BellOffIcon />}
    </Button>
  );
}
