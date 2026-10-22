import { BotIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Cỡ theo ui-ux 6.6:
 * - xs 16 px (viền 2, icon 10): avatar 32 (dải điểm điện thoại, tin chat, dải ghế của hộp thoại);
 * - sm 20 px (viền 2, icon 12): avatar 36–48 (ô phòng chờ điện thoại, "Đã hiểu", bảng điểm);
 * - md 28 px (viền 3, icon 16): avatar 68 (ô phòng chờ máy tính).
 * Lệch ra ngoài góc dưới phải của avatar (vương miện chủ phòng, hạng ở góc trên trái).
 */
const SIZE = {
  xs: "size-4 border-2 [&_svg]:size-2.5",
  sm: "size-5 border-2 [&_svg]:size-3",
  md: "size-7 border-[3px] [&_svg]:size-4",
} as const;

const OFFSET = {
  xs: "-right-[3px] -bottom-[3px]",
  sm: "-right-1 -bottom-1",
  md: "-right-[5px] -bottom-[5px]",
} as const;

interface BotBadgeProps {
  size?: keyof typeof SIZE;
  /**
   * Đứng trong dòng (trước tên) thay vì đè lên góc avatar: dùng khi không có avatar tròn,
   * vd. tên dưới nhân vật trên bục vinh danh.
   */
  inline?: boolean;
  className?: string;
}

/**
 * Huy hiệu máy (CR-016): vòng tròn màu `bot` có icon robot, đánh dấu ghế do server chơi thay.
 * Luôn `aria-hidden` vì tên bot đã có hậu tố "· máy". Đặt trong phần tử `relative` bọc avatar.
 */
export function BotBadge({ size = "sm", inline = false, className }: BotBadgeProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "z-10 grid shrink-0 place-items-center rounded-full border-sticker bg-bot text-bot-foreground",
        SIZE[size],
        !inline && cn("absolute", OFFSET[size]),
        className,
      )}
    >
      <BotIcon strokeWidth={2.6} />
    </span>
  );
}
