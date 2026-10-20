import { useTranslation } from "react-i18next";
import { useReducedMotion } from "@/features/motion";
import { cn } from "@/lib/utils";
import { pickBubble, useChat } from "@/stores/chat.store";
import { isQuickEmoji, quickEmoji } from "../quick";

interface ReactionBubbleProps {
  /** Một người, hoặc cả nhóm đồng hạng trên bục (lấy bong bóng mới nhất). */
  playerId: string | readonly string[];
  /** `top`: giữa, ngay trên avatar (phòng chờ, bục). `corner`: lệch góc trên phải (hàng bảng điểm). */
  placement?: "top" | "corner";
  className?: string;
}

/**
 * Bong bóng biểu cảm ngắn trên avatar (CR-011, ui-ux 6.5): chỉ cho emoji và câu chọn sẵn của
 * tin vừa tới (không cho lịch sử), hiện 2,5 giây, cái mới thay cái cũ. Đặt trong một phần tử
 * `relative` bọc avatar; không đẩy bố cục, không nhận chuột, ẩn với trình đọc màn hình
 * (nội dung đã có trong danh sách tin).
 */
export function ReactionBubble({ playerId, placement = "top", className }: ReactionBubbleProps) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const bubble = useChat((s) => pickBubble(s.bubbles, playerId));
  if (!bubble) return null;

  const emoji = isQuickEmoji(bubble.quickId);

  return (
    <span
      key={bubble.id}
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-20 flex h-9 min-w-9.5 items-center justify-center rounded-[14px] border-[2.5px] border-sticker px-2 whitespace-nowrap shadow-sticker-sm",
        emoji ? "bg-card text-card-foreground" : "bg-primary text-primary-foreground",
        placement === "top"
          ? "bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 origin-bottom"
          : "-top-8 -right-5 origin-bottom-left",
        reduced ? "chat-bubble-fade" : "fx-chat-bubble",
        className,
      )}
    >
      {isQuickEmoji(bubble.quickId) ? (
        <span className="text-[22px] leading-none">{quickEmoji(bubble.quickId)}</span>
      ) : (
        <span className="font-display text-[15px] leading-none font-extrabold">
          {t(`chat.quick.${bubble.quickId}`)}
        </span>
      )}
      {/* Đuôi nhọn chỉ xuống avatar */}
      <span
        className={cn(
          "absolute -bottom-[7px] size-2.5 rotate-45 border-r-[2.5px] border-b-[2.5px] border-sticker bg-inherit",
          placement === "top" ? "left-1/2 -ml-1.5" : "left-2",
        )}
      />
    </span>
  );
}
