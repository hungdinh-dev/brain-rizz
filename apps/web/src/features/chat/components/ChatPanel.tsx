import { RefreshCwIcon, VolumeXIcon } from "lucide-react";
import type * as React from "react";
import { useTranslation } from "react-i18next";
import { chatSender, usePlayerName } from "@/components/characters";
import { useChat } from "@/stores/chat.store";
import { useGame } from "@/stores/game.store";
import { ChatComposer } from "./ChatComposer";
import { ChatEnabledSwitch, useChatEnabled } from "./ChatEnabledSwitch";
import { ChatList } from "./ChatList";

interface ChatHeaderProps {
  /** Tiêu đề: sheet điện thoại truyền `SheetTitle`, cột máy tính truyền `h2`. */
  title: (children: React.ReactNode) => React.ReactNode;
  /** Nút đóng (sheet) hoặc thu gọn (cột). */
  action: React.ReactNode;
}

/** Tiêu đề khung chat: "Chat phòng" + số người, công tắc (chủ phòng) hoặc nhãn "Đã tắt", nút đóng. */
export function ChatHeader({ title, action }: ChatHeaderProps) {
  const { t } = useTranslation();
  const players = useGame((s) => (s.party ? Object.keys(s.party.players).length : 0));
  const isHost = useGame((s) => !!s.party && s.party.hostId === s.sessionId);
  const enabled = useChatEnabled();

  return (
    <header className="flex h-11 shrink-0 items-center gap-2">
      {title(t("chat.title"))}
      <span className="text-[13px] font-semibold whitespace-nowrap text-muted-foreground">
        {t("chat.players", { count: players })}
      </span>
      <span className="flex-1" />
      {isHost ? (
        <ChatEnabledSwitch />
      ) : (
        !enabled && (
          <span className="rounded-full border-2 border-dashed border-muted-foreground px-2 py-0.5 text-xs font-bold text-muted-foreground">
            {t("chat.offBadge")}
          </span>
        )
      )}
      {action}
    </header>
  );
}

/**
 * Thân khung chat dùng chung cho sheet điện thoại và cột máy tính (CR-011): dải đã tắt tiếng,
 * dải đang nối lại, danh sách tin, phần nhập.
 */
export function ChatBody({ layout }: { layout: "row" | "grid" }) {
  return (
    <>
      <MutedStrip />
      <ReconnectStrip />
      <ChatList />
      <ChatComposer layout={layout} />
    </>
  );
}

/** "Đã tắt tiếng Lan" / "Đã tắt tiếng 2 người" + nút "Bật lại" (bật lại tất cả). */
function MutedStrip() {
  const { t } = useTranslation();
  const muted = useChat((s) => s.muted);
  const unmuteAll = useChat((s) => s.unmuteAll);
  const players = useGame((s) => s.party?.players);
  const messages = useChat((s) => s.messages);
  const { full } = usePlayerName();
  if (muted.length === 0) return null;

  // Tên lấy từ phòng; người đã rời thì lấy từ tin cũ của họ (bot dịch theo nhân vật, CR-016).
  const first = muted[0] ?? "";
  const inRoom = players?.[first];
  const lastMsg = messages.findLast((m) => m.playerId === first);
  const name = inRoom ? full(inRoom) : lastMsg ? full(chatSender(lastMsg)) : "";
  const text =
    muted.length === 1 && name
      ? t("chat.mutedOne", { name })
      : t("chat.mutedMany", { count: muted.length });

  return (
    <div className="flex min-h-11 shrink-0 items-center gap-2 rounded-[14px] bg-muted pr-0.5 pl-3 text-[13px] font-semibold">
      <VolumeXIcon aria-hidden className="size-4 shrink-0" />
      <span className="flex-1">{text}</span>
      <button
        type="button"
        onClick={unmuteAll}
        className="h-11 cursor-pointer rounded-xl px-3 text-sm font-bold underline underline-offset-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {t("chat.unmute")}
      </button>
    </div>
  );
}

/** Mất kết nối: dải "Đang kết nối lại…"; ô nhập khoá nhưng giữ bản nháp. */
function ReconnectStrip() {
  const { t } = useTranslation();
  const reconnecting = useGame((s) => s.connection === "reconnecting");
  if (!reconnecting) return null;
  return (
    <div
      role="status"
      className="flex min-h-10 shrink-0 items-center gap-2 rounded-[14px] bg-muted px-3 text-[13px] font-semibold"
    >
      <RefreshCwIcon aria-hidden className="size-4 shrink-0 motion-safe:animate-spin" />
      {t("chat.reconnecting")}
    </div>
  );
}
