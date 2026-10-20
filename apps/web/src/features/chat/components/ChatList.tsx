import type { ChatMessagePayload } from "@brain-rizz/shared";
import { MessageCircleIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useChat, visibleMessages } from "@/stores/chat.store";
import { useGame } from "@/stores/game.store";
import { isQuickEmoji, quickEmoji } from "../quick";
import { MuteMenu } from "./MuteMenu";

/**
 * Danh sách tin (CR-011): `role="log"`, cuộn bám đáy bằng `flex-col-reverse` (có tin mới khi
 * người xem đã cuộn lên thì không tự kéo xuống). Ẩn cả tin cũ của người bị tắt tiếng.
 * Chưa có lịch sử từ server (vừa vào / đang nối lại) → khung chờ.
 */
export function ChatList({ className }: { className?: string }) {
  const { t } = useTranslation();
  const messages = useChat((s) => s.messages);
  const muted = useChat((s) => s.muted);
  const loaded = useChat((s) => s.loaded);
  const sessionId = useGame((s) => s.sessionId);
  const hostId = useGame((s) => s.party?.hostId);
  const shown = useMemo(() => visibleMessages(messages, muted), [messages, muted]);

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label={t("chat.logLabel")}
      className={cn("flex min-h-0 flex-1 flex-col-reverse overflow-y-auto px-0.5 py-1", className)}
    >
      <div className="flex flex-col gap-3">
        {!loaded && shown.length === 0 ? (
          <ListSkeleton />
        ) : shown.length === 0 ? (
          <EmptyChat />
        ) : (
          shown.map((m) =>
            m.playerId === sessionId ? (
              <MyMessage key={m.id} msg={m} />
            ) : (
              <OtherMessage key={m.id} msg={m} isHost={m.playerId === hostId} />
            ),
          )
        )}
      </div>
    </div>
  );
}

function OtherMessage({ msg, isHost }: { msg: ChatMessagePayload; isHost: boolean }) {
  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-x-1">
      <MuteMenu sender={msg} isHost={isHost} />
      <div className="max-w-[220px] justify-self-start">
        <MessageBody msg={msg} mine={false} />
      </div>
    </div>
  );
}

function MyMessage({ msg }: { msg: ChatMessagePayload }) {
  const { t } = useTranslation();
  return (
    <div className="flex max-w-[220px] flex-col items-end self-end">
      <span className="sr-only">{t("lobby.you")}</span>
      <MessageBody msg={msg} mine />
    </div>
  );
}

/** Thân tin: chữ tự do (bóng), emoji lẻ (34 px, không bóng) hoặc câu chọn sẵn (nhãn vàng nghiêng). */
function MessageBody({ msg, mine }: { msg: ChatMessagePayload; mine: boolean }) {
  const { t } = useTranslation();
  if (msg.kind === "quick" && msg.quickId) {
    if (isQuickEmoji(msg.quickId)) {
      return <p className="text-[34px] leading-[1.1]">{quickEmoji(msg.quickId)}</p>;
    }
    return (
      <p
        className={cn(
          "mt-0.5 inline-block rounded-[14px] border-[2.5px] border-sticker bg-primary px-3 py-1 font-display text-lg leading-[1.3] font-extrabold text-primary-foreground shadow-sticker-sm",
          mine ? "rotate-2" : "-rotate-2",
        )}
      >
        {t(`chat.quick.${msg.quickId}`)}
      </p>
    );
  }
  return (
    <p
      className={cn(
        "border-[2.5px] border-sticker px-3 py-1.5 text-[15px] leading-[1.4] [overflow-wrap:anywhere]",
        mine
          ? "rounded-[16px_4px_16px_16px] bg-bubble-mine text-bubble-mine-foreground"
          : "rounded-[4px_16px_16px_16px] bg-muted text-card-foreground",
      )}
    >
      {msg.text}
    </p>
  );
}

function EmptyChat() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-7 text-center">
      <span className="grid size-14 place-items-center rounded-2xl border-[3px] border-sticker bg-muted">
        <MessageCircleIcon aria-hidden className="size-6" strokeWidth={2.4} />
      </span>
      <strong className="font-display text-[19px] font-extrabold">{t("chat.emptyTitle")}</strong>
      <span className="text-sm leading-snug text-muted-foreground">{t("chat.emptyHint")}</span>
    </div>
  );
}

function ListSkeleton() {
  return (
    <>
      <div className="flex items-start gap-2">
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <Skeleton className="h-10 w-44" />
      </div>
      <Skeleton className="h-10 w-36 self-end" />
      <div className="flex items-start gap-2">
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <Skeleton className="h-10 w-52" />
      </div>
    </>
  );
}
