import type { ChatMessagePayload } from "@brain-rizz/shared";
import { CrownIcon, VolumeXIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChat } from "@/stores/chat.store";

interface MuteMenuProps {
  sender: Pick<ChatMessagePayload, "playerId" | "name" | "avatar" | "colorIndex">;
  isHost: boolean;
}

/**
 * Avatar + tên người gửi trong danh sách tin; bấm avatar (vùng chạm 44 px) hoặc tên mở menu
 * "Tắt tiếng" (CR-011). Tắt tiếng chỉ ẩn trên máy này, không báo server. Tin của mình không có menu.
 * Dùng trong lưới 2 cột của một tin: avatar chiếm cột 1 (2 hàng), tên ở hàng 1 cột 2.
 */
export function MuteMenu({ sender, isHost }: MuteMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const mute = useChat((s) => s.mute);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("chat.options", { name: sender.name })}
          className="row-span-2 -mt-1.5 -ml-1.5 grid size-11 cursor-pointer place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <PlayerAvatar avatar={sender.avatar} colorIndex={sender.colorIndex} size="sm" />
        </button>
      </DropdownMenuTrigger>
      {/* Bấm tên cũng mở menu; bàn phím / trình đọc màn hình dùng nút avatar ở trên. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={() => setOpen(true)}
        className="-my-3 -ml-1.5 flex min-h-11 cursor-pointer items-center gap-1 justify-self-start rounded-[10px] px-1.5"
      >
        <span className="font-display text-[15px] leading-none font-extrabold">{sender.name}</span>
        {isHost && <CrownIcon aria-hidden className="size-3.5" strokeWidth={2.8} />}
      </button>
      <DropdownMenuContent
        align="start"
        className="w-60 rounded-2xl border-[3px] border-sticker bg-card p-1.5 text-card-foreground shadow-sticker-sm ring-0"
      >
        <DropdownMenuItem
          onSelect={() => mute(sender.playerId)}
          className="min-h-11 gap-2.5 rounded-[10px] bg-muted px-2.5 text-[15px] font-bold"
        >
          <VolumeXIcon aria-hidden className="size-4.5" />
          {t("chat.mute", { name: sender.name })}
        </DropdownMenuItem>
        <p className="mx-2.5 mt-1.5 mb-1 text-xs leading-snug text-muted-foreground">
          {t("chat.muteHint", { name: sender.name })}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
