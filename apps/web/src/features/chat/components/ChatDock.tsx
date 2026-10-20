import type { Phase } from "@brain-rizz/shared";
import {
  MessageCircleIcon,
  MessageCircleOffIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useReducedMotion } from "@/features/motion";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { STORAGE_KEYS, safeLocal } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { useChat } from "@/stores/chat.store";
import { useKeyboardInset } from "../use-keyboard-inset";
import { useChatEnabled } from "./ChatEnabledSwitch";
import { ChatBody, ChatHeader } from "./ChatPanel";
import { UnreadBadge } from "./UnreadBadge";

/** Nhãn "N tin mới" cạnh nút chat khi vừa sang bảng điểm vòng (ui-ux 6.5). */
const NEW_HINT_MS = 3_000;

/**
 * Khung chat trong phòng (CR-011, S16). Chỉ dựng ở các pha có chat (`CHAT_PHASES`); lúc đếm
 * ngược / đang chơi bị gỡ hẳn, tin vẫn về store và tính chưa đọc.
 * Điện thoại và máy tính bảng (< 1024 px): nút nổi + sheet. Máy tính: cột phải thu gọn được.
 */
export function ChatDock({ phase }: { phase: Phase }) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  return desktop ? <ChatColumn /> : <ChatFab phase={phase} />;
}

/** Nhãn nút mở chat, đọc cả số chưa đọc: "Mở chat · 3 tin chưa đọc". */
function useOpenLabel(unread: number) {
  const { t } = useTranslation();
  const enabled = useChatEnabled();
  const base = enabled ? t("chat.open") : t("chat.openOff");
  return unread > 0 ? `${base} · ${t("chat.unread", { count: unread })}` : base;
}

// ------------------------------------------------------------------ điện thoại

function ChatFab({ phase }: { phase: Phase }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const unread = useChat((s) => s.unread);
  const setStoreOpen = useChat((s) => s.setOpen);
  const enabled = useChatEnabled();
  const reduced = useReducedMotion();
  const label = useOpenLabel(unread);
  const keyboard = useKeyboardInset(open);
  const [hint, setHint] = useState(0);

  useEffect(() => {
    setStoreOpen(open);
  }, [open, setStoreOpen]);
  useEffect(() => () => setStoreOpen(false), [setStoreOpen]);

  // Vừa sang bảng điểm vòng mà có tin lúc đang chơi → nhãn "N tin mới" 3 giây.
  useEffect(() => {
    if (phase !== "round-results") return;
    const count = useChat.getState().unread;
    if (count <= 0) return;
    setHint(count);
    const timer = setTimeout(() => setHint(0), NEW_HINT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const Icon = enabled ? MessageCircleIcon : MessageCircleOffIcon;

  return (
    <>
      {hint > 0 && !open && (
        <span
          role="status"
          className={cn(
            "fixed right-[calc(max(16px,env(safe-area-inset-right))+68px)] bottom-[calc(max(16px,env(safe-area-inset-bottom))+10px)] z-40 flex h-9 items-center rounded-xl border-[2.5px] border-sticker bg-card px-3 text-[13px] font-bold whitespace-nowrap text-card-foreground shadow-sticker-sm",
            reduced ? "chat-hint-fade" : "fx-chat-hint",
          )}
        >
          {t("chat.newMessages", { count: hint })}
        </span>
      )}
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed right-[max(16px,env(safe-area-inset-right))] bottom-[max(16px,env(safe-area-inset-bottom))] z-40 grid size-14 cursor-pointer place-items-center rounded-[18px] border-[3px] border-sticker bg-card text-card-foreground shadow-sticker-sm transition-[translate,box-shadow] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-0.5 active:shadow-none motion-reduce:transition-none",
          open && "invisible",
        )}
      >
        <Icon aria-hidden className="size-6.5" strokeWidth={2.4} />
        {enabled && <UnreadBadge count={unread} />}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          aria-describedby={undefined}
          overlayClassName="bg-ink/30"
          className="h-[60dvh] max-h-[560px] min-h-[min(440px,90dvh)] gap-2.5 bg-card px-3.5 pt-2 text-card-foreground"
          // Bàn phím ảo mở: sheet bám trên bàn phím, danh sách co lại.
          style={
            keyboard
              ? {
                  bottom: keyboard.bottom,
                  height: Math.min(keyboard.height - 12, 560),
                  minHeight: 0,
                }
              : undefined
          }
        >
          <span aria-hidden className="h-1.25 w-11 shrink-0 self-center rounded-full bg-border" />
          <ChatHeader
            title={(children) => (
              <SheetTitle className="text-2xl leading-none">{children}</SheetTitle>
            )}
            action={
              <SheetClose
                aria-label={t("chat.close")}
                className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border-[3px] border-sticker bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <XIcon aria-hidden className="size-5" strokeWidth={2.6} />
              </SheetClose>
            }
          />
          <ChatBody layout="row" />
        </SheetContent>
      </Sheet>
    </>
  );
}

// ------------------------------------------------------------------ máy tính

function loadCollapsed() {
  return safeLocal.get(STORAGE_KEYS.chatCollapsed) === "1";
}

function ChatColumn() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const unread = useChat((s) => s.unread);
  const setStoreOpen = useChat((s) => s.setOpen);
  const enabled = useChatEnabled();
  const label = useOpenLabel(unread);

  useEffect(() => {
    setStoreOpen(!collapsed);
  }, [collapsed, setStoreOpen]);
  useEffect(() => () => setStoreOpen(false), [setStoreOpen]);

  function toggle(next: boolean) {
    setCollapsed(next);
    if (next) safeLocal.set(STORAGE_KEYS.chatCollapsed, "1");
    else safeLocal.remove(STORAGE_KEYS.chatCollapsed);
  }

  const Icon = enabled ? MessageCircleIcon : MessageCircleOffIcon;

  return (
    <aside
      aria-label={t("chat.title")}
      className={cn(
        "sticky top-0 flex max-h-[calc(100dvh-8rem)] min-h-[28rem] shrink-0 flex-col rounded-[22px] border-[3px] border-sticker bg-card text-card-foreground shadow-sticker-sm transition-[width] duration-200 motion-reduce:transition-none",
        collapsed ? "w-17 items-center gap-2 py-3" : "w-80 gap-2.5 px-3.5 pt-3 pb-3.5",
      )}
    >
      {collapsed ? (
        <>
          <button
            type="button"
            aria-label={label}
            onClick={() => toggle(false)}
            className="relative grid size-12 cursor-pointer place-items-center rounded-[14px] border-[3px] border-sticker bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Icon aria-hidden className="size-5.5" strokeWidth={2.4} />
            {enabled && <UnreadBadge count={unread} className="h-6 min-w-6 text-xs" />}
          </button>
          <span aria-hidden className="font-display text-sm font-extrabold">
            {t("chat.collapsedLabel")}
          </span>
          <button
            type="button"
            aria-label={t("chat.expand")}
            onClick={() => toggle(false)}
            className="mt-auto grid size-11 cursor-pointer place-items-center rounded-xl outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <PanelRightOpenIcon aria-hidden className="size-5" strokeWidth={2.4} />
          </button>
        </>
      ) : (
        <>
          <ChatHeader
            title={(children) => (
              <h2 className="font-display text-[22px] leading-none font-extrabold">{children}</h2>
            )}
            action={
              <button
                type="button"
                aria-label={t("chat.collapse")}
                onClick={() => toggle(true)}
                className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-[14px] border-[3px] border-sticker bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <PanelRightCloseIcon aria-hidden className="size-5" strokeWidth={2.4} />
              </button>
            }
          />
          <ChatBody layout="grid" />
        </>
      )}
    </aside>
  );
}
