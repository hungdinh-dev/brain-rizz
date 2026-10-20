import { CHAT_MAX_LENGTH, type ChatQuickId } from "@brain-rizz/shared";
import { CircleAlertIcon, MessageCircleOffIcon, SendIcon } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { sendChat } from "@/net/connection";
import { useChat } from "@/stores/chat.store";
import { useGame } from "@/stores/game.store";
import { limitChatText } from "../limit-text";
import { isQuickEmoji, QUICK_ORDER, quickEmoji } from "../quick";
import { useChatEnabled } from "./ChatEnabledSwitch";

/** Bộ đếm ký tự chuyển đỏ từ ngưỡng này (ui-ux 6.5). */
const COUNTER_WARN = 100;

/**
 * Phần dưới khung chat (CR-011): dòng nhắc gửi nhanh quá, hàng biểu cảm, ô nhập. Chủ phòng tắt chat
 * → thay bằng khối viền nét đứt giải thích (người chơi / chủ phòng khác câu).
 */
export function ChatComposer({ layout }: { layout: "row" | "grid" }) {
  const { t } = useTranslation();
  const enabled = useChatEnabled();
  const rateLimited = useChat((s) => s.rateLimited);
  const isHost = useGame((s) => !!s.party && s.party.hostId === s.sessionId);

  if (!enabled) {
    return (
      <div
        role="status"
        className="flex shrink-0 items-center gap-2.5 rounded-2xl border-[2.5px] border-dashed border-muted-foreground px-3.5 py-3"
      >
        <MessageCircleOffIcon aria-hidden className="size-5 shrink-0" strokeWidth={2.4} />
        <span className="flex flex-col gap-0.5 text-sm leading-snug">
          <strong>{isHost ? t("chat.offTitleHost") : t("chat.offTitle")}</strong>
          <span className="text-muted-foreground">
            {isHost ? t("chat.offBodyHost") : t("chat.offBody")}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col gap-2">
      {rateLimited && (
        <p
          role="status"
          className="flex items-center gap-1.5 text-[13px] font-bold text-destructive"
        >
          <CircleAlertIcon aria-hidden className="size-4 shrink-0" strokeWidth={2.6} />
          {t("chat.rateLimited")}
        </p>
      )}
      <QuickReactions layout={layout} disabled={rateLimited} />
      <ChatInput disabled={rateLimited} />
    </div>
  );
}

/**
 * Hàng biểu cảm / câu chọn sẵn bấm một chạm. Điện thoại: 1 hàng (câu chọn sẵn co theo chữ).
 * Máy tính (cột 320 px): 2 hàng, 4 emoji rồi 2 câu chọn sẵn, để "Nhanh lên!" không bị cắt.
 */
function QuickReactions({ layout, disabled }: { layout: "row" | "grid"; disabled: boolean }) {
  const { t } = useTranslation();
  const offline = useGame((s) => s.connection !== "online");

  function sendQuick(id: ChatQuickId) {
    sendChat({ kind: "quick", id });
  }

  return (
    <fieldset
      aria-label={t("chat.quickGroup")}
      className={cn("flex min-w-0 gap-1.5", layout === "grid" && "flex-wrap")}
    >
      {QUICK_ORDER.map((id) => {
        const emoji = isQuickEmoji(id);
        return (
          <button
            key={id}
            type="button"
            aria-label={t(`chat.quickAria.${id}`)}
            disabled={disabled || offline}
            onClick={() => sendQuick(id)}
            className={cn(
              "flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-[14px] border-[2.5px] border-sticker shadow-sticker-sm transition-[translate,box-shadow,opacity] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none",
              emoji
                ? "bg-card text-card-foreground"
                : "bg-primary px-2.5 font-display text-base font-extrabold whitespace-nowrap text-primary-foreground",
              emoji
                ? layout === "row"
                  ? "w-11 shrink-0"
                  : "grow basis-[calc(25%-0.375rem)]"
                : "min-w-0 flex-auto",
            )}
          >
            {isQuickEmoji(id) ? (
              <span aria-hidden className="text-[22px] leading-none">
                {quickEmoji(id)}
              </span>
            ) : (
              <span aria-hidden className="truncate leading-none">
                {t(`chat.quick.${id}`)}
              </span>
            )}
          </button>
        );
      })}
    </fieldset>
  );
}

/** Ô nhập một dòng, tối đa 120 ký tự, Enter để gửi. Bản nháp giữ trong store khi đóng khung. */
function ChatInput({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation();
  const inputId = useId();
  const draft = useChat((s) => s.draft);
  const setDraft = useChat((s) => s.setDraft);
  const offline = useGame((s) => s.connection !== "online");
  const empty = draft.trim().length === 0;
  const length = [...draft].length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || disabled || offline) return;
    if (sendChat({ kind: "text", text })) setDraft("");
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <label htmlFor={inputId} className="sr-only">
          {t("chat.inputLabel", { max: CHAT_MAX_LENGTH })}
        </label>
        <Input
          id={inputId}
          value={draft}
          autoComplete="off"
          enterKeyHint="send"
          disabled={offline}
          placeholder={t("chat.placeholder")}
          // Không dùng `maxLength` (đếm UTF-16, emoji tính 2): giới hạn theo code point như server.
          onChange={(e) => setDraft(limitChatText(e.target.value, CHAT_MAX_LENGTH))}
          className="border-sticker pr-16.5 text-base"
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-bold tabular-nums",
            length >= COUNTER_WARN ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {length}/{CHAT_MAX_LENGTH}
        </span>
      </div>
      <button
        type="submit"
        aria-label={t("chat.send")}
        disabled={empty || disabled || offline}
        className="grid size-12 shrink-0 cursor-pointer place-items-center rounded-2xl border-[3px] border-sticker bg-primary text-primary-foreground shadow-sticker-sm transition-[translate,box-shadow,opacity] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
      >
        <SendIcon aria-hidden className="size-5" strokeWidth={2.6} />
      </button>
    </form>
  );
}
