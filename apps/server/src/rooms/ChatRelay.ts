import {
  CHAT_HISTORY_SIZE,
  type ChatHistoryPayload,
  type ChatMessagePayload,
  type ChatSendPayload,
  createChatRateLimiter,
  isCharacterId,
  sanitizeChatText,
} from "@brain-rizz/shared";

/** Danh tính người gửi, server lấy từ PlayerState (client không tự khai). */
export interface ChatSender {
  id: string;
  name: string;
  colorIndex: number;
  avatar: string;
  /** Bot (CR-016): tin mang `bot: true` để web dịch tên theo nhân vật, kể cả khi bot đã bị bỏ. */
  isBot?: boolean;
}

/** Kết quả nhận một tin: tin đã sẵn sàng phát, hoặc lý do từ chối. */
export type ChatOutcome =
  | { ok: true; message: ChatMessagePayload }
  | { ok: false; reason: "rate-limited" | "empty" };

/**
 * Chat của một phòng party (CR-011): giới hạn tần suất, làm sạch + lọc từ tục, gắn danh tính,
 * giữ `CHAT_HISTORY_SIZE` tin gần nhất trong RAM (không DB, không vào state đồng bộ).
 * Kiểm tra cờ `chatEnabled` và pha do PartyRoom làm trước khi gọi `accept`.
 */
export class ChatRelay {
  private limiter = createChatRateLimiter();
  private buffer: ChatMessagePayload[] = [];
  private nextId = 1;

  constructor(private readonly historySize = CHAT_HISTORY_SIZE) {}

  accept(sender: ChatSender, msg: ChatSendPayload, now: number): ChatOutcome {
    // Trừ lượt trước khi làm sạch: tin rỗng gửi dồn cũng bị giới hạn.
    if (!this.limiter.consume(sender.id, now)) return { ok: false, reason: "rate-limited" };
    const base: Pick<
      ChatMessagePayload,
      "playerId" | "name" | "colorIndex" | "avatar" | "at" | "bot"
    > = {
      playerId: sender.id,
      name: sender.name,
      colorIndex: sender.colorIndex,
      avatar: isCharacterId(sender.avatar) ? sender.avatar : "khoi",
      at: now,
      // Người thật không có trường `bot` (không gửi `bot: false`).
      ...(sender.isBot ? { bot: true as const } : {}),
    };
    let message: ChatMessagePayload;
    if (msg.kind === "quick") {
      message = { id: this.nextId, ...base, kind: "quick", quickId: msg.id };
    } else {
      const text = sanitizeChatText(msg.text);
      if (text === null) return { ok: false, reason: "empty" };
      message = { id: this.nextId, ...base, kind: "text", text };
    }
    this.nextId += 1;
    this.buffer.push(message);
    if (this.buffer.length > this.historySize)
      this.buffer.splice(0, this.buffer.length - this.historySize);
    return { ok: true, message };
  }

  /** Lịch sử gần nhất, cũ → mới (bản sao). */
  history(): ChatHistoryPayload {
    return { messages: [...this.buffer] };
  }

  /** Người rời hẳn phòng: bỏ trạng thái giới hạn tần suất (tin cũ vẫn giữ trong lịch sử). */
  forget(id: string) {
    this.limiter.forget(id);
  }
}
