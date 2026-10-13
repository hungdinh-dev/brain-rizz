import type { CharacterId } from "@brain-rizz/shared";
import { cva, type VariantProps } from "class-variance-authority";
import { Character } from "@/components/characters";
import { avatarColor } from "@/lib/avatar";
import { cn } from "@/lib/utils";

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

/* Nhân vật to gấp ~1.6 lần khung tròn (mặt nằm đúng tâm), đẩy xuống chút để lộ cả tai. */
const CHARACTER_SIZE = { sm: 50, md: 70, lg: 108 } as const;

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
      <Character
        id={avatar}
        size={CHARACTER_SIZE[size ?? "md"]}
        animated={false}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[43%]"
      />
    </span>
  );
}
