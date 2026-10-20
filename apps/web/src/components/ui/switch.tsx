import { Switch as SwitchPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

/*
 * Gốc từ shadcn (style radix-vega), đã chỉnh theo kiểu nhãn dán (ADR 0009):
 * rãnh 48×28 viền mực 3px, bật = nền primary, núm giấy viền mực.
 * Vùng chạm mở rộng tới 64×44 bằng ::after (đạt chuẩn ≥ 44px dù rãnh nhỏ hơn).
 * Trạng thái không chỉ báo bằng màu: núm đổi bên. Giảm chuyển động: núm nhảy, không trượt.
 * Dùng cho: chủ phòng bật/tắt chat cả phòng (CR-011). Đặt nhãn bằng <Label htmlFor> hoặc aria-label.
 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer group/switch relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-[3px] border-sticker p-0.5 transition-colors outline-none after:absolute after:-inset-x-2 after:-inset-y-2 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 rounded-full border-2 border-sticker bg-card transition-transform data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0 motion-reduce:transition-none"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
