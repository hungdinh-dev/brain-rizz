import type { CharacterId } from "@brain-rizz/shared";
import { cva, type VariantProps } from "class-variance-authority";
import { Character } from "@/components/characters";
import { avatarColor } from "@/lib/avatar";
import { cn } from "@/lib/utils";

/**
 * Cỡ có sẵn. Chỗ cần cỡ khác (phòng 12 người, ui-ux 6.8: 22–52 px) ghi đè bằng `className`
 * (vd. `size-7.5 border-2`): nhân vật luôn theo tỉ lệ khung tròn nên không cần cỡ riêng.
 */
const avatarVariants = cva(
  "relative inline-block shrink-0 overflow-hidden rounded-full border-sticker",
  {
    variants: {
      size: {
        /** Dải điểm lúc chơi, bảng kết quả */
        sm: "size-8 border-2",
        /** Ô người chơi ở phòng chờ (điện thoại), bảng điểm lúc chơi */
        md: "size-11 border-[3px]",
        /** Ô người chơi ở phòng chờ (máy tính) */
        lg: "size-17 border-[3px]",
      },
    },
    defaultVariants: { size: "md" },
  },
);

interface PlayerAvatarProps extends VariantProps<typeof avatarVariants> {
  avatar: CharacterId;
  colorIndex: number;
  className?: string;
}

/** Avatar tròn: nhân vật người chơi chọn trên nền màu của người chơi (màu do server cấp, không trùng). */
export function PlayerAvatar({ avatar, colorIndex, size, className }: PlayerAvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(avatarVariants({ size }), className)}
      // Màu do server cấp lúc chạy nên phải gán inline, không viết trước thành class được.
      style={{ background: avatarColor(colorIndex) }}
    >
      {/*
       * Nhân vật to 1,6 lần khung tròn (mặt nằm đúng tâm), đẩy xuống chút để lộ cả tai. Cỡ theo
       * khung bằng CSS (ghi đè width/height của SVG) nên đổi cỡ khung qua className vẫn đúng tỉ lệ.
       */}
      <Character
        id={avatar}
        animated={false}
        className="absolute top-1/2 left-1/2 size-[160%] -translate-x-1/2 -translate-y-[43%] [&>svg]:size-full"
      />
    </span>
  );
}
