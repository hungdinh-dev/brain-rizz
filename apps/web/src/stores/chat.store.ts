import {
  CHAT_HISTORY_SIZE,
  type ChatBucket,
  type ChatMessagePayload,
  type ChatQuickId,
  consumeToken,
  type ErrorPayload,
} from "@brain-rizz/shared";
import { create } from "zustand";
import { STORAGE_KEYS, safeLocal } from "@/lib/storage";

/**
 * Chat trong phòng party (CR-011): tin nhận từ server (tin một lần, không nằm trong state đồng bộ),
 * số chưa đọc, bong bóng biểu cảm đang hiện, danh sách tắt tiếng trên máy này.
 * Client chỉ hiển thị: tên/màu người gửi do server gắn, server lọc từ tục và giới hạn tần suất.
 * Hàm thuần ở đầu file có test (`chat.store.test.ts`).
 */

/** Số tin giữ trên máy: rộng hơn bộ đệm server một chút để tin cũ không biến mất khi nối lại. */
export const CHAT_KEEP = Math.max(50, CHAT_HISTORY_SIZE);
/** Bong bóng biểu cảm trên avatar hiện ngần này ms (ui-ux 6.5). */
export const CHAT_BUBBLE_MS = 2_500;
/** Dòng "Gửi chậm lại chút nhé" và khoá hàng biểu cảm trong ngần này ms. */
export const CHAT_RATE_NOTICE_MS = 1_500;
/** Nhớ danh sách tắt tiếng của tối đa ngần này phòng gần nhất (mã phòng không dùng lại lâu). */
export const CHAT_MUTE_ROOMS = 10;

// ------------------------------------------------------------------ hàm thuần

/** Thêm tin, bỏ trùng theo id, giữ thứ tự cũ → mới và tối đa `max` tin. */
export function mergeMessages(
  current: readonly ChatMessagePayload[],
  incoming: readonly ChatMessagePayload[],
  max = CHAT_KEEP,
): ChatMessagePayload[] {
  const byId = new Map<number, ChatMessagePayload>();
  for (const m of current) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  const merged = [...byId.values()].sort((a, b) => a.id - b.id);
  return merged.length > max ? merged.slice(merged.length - max) : merged;
}

/** Tin mới (chưa có trong `current`) trong một gói lịch sử. */
export function newMessages(
  current: readonly ChatMessagePayload[],
  incoming: readonly ChatMessagePayload[],
): ChatMessagePayload[] {
  const seen = new Set(current.map((m) => m.id));
  return incoming.filter((m) => !seen.has(m.id));
}

export interface UnreadContext {
  selfId: string;
  muted: readonly string[];
  /** Khung chat đang mở và nhìn thấy được (không ở pha đếm ngược / đang chơi). */
  open: boolean;
}

/** Tin này có làm tăng số chưa đọc không: không phải của mình, không bị tắt tiếng, khung đang đóng. */
export function countsAsUnread(msg: ChatMessagePayload, ctx: UnreadContext): boolean {
  return !ctx.open && msg.playerId !== ctx.selfId && !ctx.muted.includes(msg.playerId);
}

/** Tin còn hiện trên máy này (bỏ tin của người bị tắt tiếng, kể cả tin cũ). */
export function visibleMessages(
  messages: readonly ChatMessagePayload[],
  muted: readonly string[],
): ChatMessagePayload[] {
  if (muted.length === 0) return messages as ChatMessagePayload[];
  return messages.filter((m) => !muted.includes(m.playerId));
}

/** Danh sách tắt tiếng lưu trên máy: mã phòng → id người chơi, phòng mới nhất ở cuối. */
export type MuteBook = Record<string, string[]>;

/** Đọc JSON đã lưu; hỏng hay sai hình dạng → rỗng (không làm vỡ app). */
export function parseMuteBook(raw: string | null): MuteBook {
  if (!raw) return {};
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const book: MuteBook = {};
    for (const [room, ids] of Object.entries(data)) {
      if (!Array.isArray(ids)) continue;
      const clean = ids.filter((id): id is string => typeof id === "string" && id.length > 0);
      if (clean.length > 0) book[room] = [...new Set(clean)];
    }
    return book;
  } catch {
    return {};
  }
}

/** Ghi danh sách của một phòng (rỗng = xoá phòng đó), giữ tối đa `maxRooms` phòng gần nhất. */
export function setRoomMutes(
  book: MuteBook,
  room: string,
  ids: readonly string[],
  maxRooms = CHAT_MUTE_ROOMS,
): MuteBook {
  const next: MuteBook = {};
  for (const [r, list] of Object.entries(book)) if (r !== room) next[r] = list;
  if (ids.length > 0) next[room] = [...new Set(ids)];
  const rooms = Object.keys(next);
  for (const r of rooms.slice(0, Math.max(0, rooms.length - maxRooms))) delete next[r];
  return next;
}

export function serializeMuteBook(book: MuteBook): string {
  return JSON.stringify(book);
}

function loadMutes(room: string): string[] {
  return parseMuteBook(safeLocal.get(STORAGE_KEYS.chatMute))[room] ?? [];
}

function saveMutes(room: string, ids: readonly string[]) {
  if (!room) return;
  const book = parseMuteBook(safeLocal.get(STORAGE_KEYS.chatMute));
  safeLocal.set(STORAGE_KEYS.chatMute, serializeMuteBook(setRoomMutes(book, room, ids)));
}

// ------------------------------------------------------------------ store

export interface ChatBubble {
  /** Id tin: đổi id = bong bóng mới, hoạt ảnh chạy lại. */
  id: number;
  quickId: ChatQuickId;
}

/**
 * Cách xử lý một lỗi server có thể là của tin chat:
 * - `not-chat`: lỗi của lệnh khác → mở khoá nút đang chờ + toast;
 * - `notice`: dòng nhắc trong khung chat; `silent`: bỏ qua;
 * - `toast`: chỉ hiện toast, không đụng trạng thái chờ của lệnh khác.
 */
export type ChatErrorHandling = "not-chat" | "notice" | "silent" | "toast";

interface ChatStore {
  /** Mã phòng đang mở (khoá danh sách tắt tiếng). */
  roomCode: string;
  /** Mọi tin đã nhận, cũ → mới (gồm cả tin người bị tắt tiếng; lọc lúc hiển thị). */
  messages: ChatMessagePayload[];
  /** Đã có lịch sử từ server kể từ lần vào / nối lại gần nhất (chưa có → hiện khung chờ). */
  loaded: boolean;
  unread: number;
  /** Khung chat đang mở và nhìn thấy được. ChatDock cập nhật; đóng/ẩn → tin mới tính chưa đọc. */
  open: boolean;
  /** Bong bóng biểu cảm đang hiện theo id người chơi. */
  bubbles: Record<string, ChatBubble>;
  /** Người bị tắt tiếng trên máy này (không báo server). */
  muted: string[];
  /** Vừa gửi nhanh quá: hiện dòng nhắc, khoá hàng biểu cảm và nút Gửi. */
  rateLimited: boolean;
  /** Giới hạn tần suất phía client (cùng luật với server) để khỏi gửi tin chắc chắn bị từ chối. */
  bucket: ChatBucket | undefined;
  /** Bản nháp ô nhập: giữ khi đóng khung / sang pha chơi, xoá khi rời phòng. */
  draft: string;

  /** Vào phòng mới: xoá tin cũ, nạp danh sách tắt tiếng của phòng này. */
  attach(roomCode: string): void;
  setDraft(draft: string): void;
  /** Tin `ServerMessage.Chat`. `showBubble` = đang ở pha có khung chat (không bong bóng lúc chơi). */
  receive(msg: ChatMessagePayload, selfId: string, showBubble: boolean): void;
  /** Tin `ServerMessage.ChatHistory` (lúc vào phòng và lúc nối lại). Không hiện bong bóng. */
  receiveHistory(messages: readonly ChatMessagePayload[], selfId: string): void;
  /** Mất kết nối: chờ server gửi lại lịch sử. */
  markStale(): void;
  setOpen(open: boolean): void;
  mute(playerId: string): void;
  unmuteAll(): void;
  /** Gọi trước khi gửi: `false` = gửi nhanh quá (đã bật dòng nhắc), đừng gửi. */
  allowSend(now: number): boolean;
  /**
   * Lỗi server vừa tới: có phải của chat không (server gắn `source: "chat"`), và xử lý thế nào.
   * Lỗi không có nguồn luôn là `not-chat` để lệnh khác đang chờ được mở khoá + báo lỗi;
   * lỗi có `source: "chat"` không bao giờ là `not-chat`.
   */
  handleError(error: Pick<ErrorPayload, "code" | "source">): ChatErrorHandling;
  reset(): void;
}

const initial = {
  roomCode: "",
  messages: [] as ChatMessagePayload[],
  loaded: false,
  unread: 0,
  open: false,
  bubbles: {} as Record<string, ChatBubble>,
  muted: [] as string[],
  rateLimited: false,
  bucket: undefined as ChatBucket | undefined,
  draft: "",
};

const bubbleTimers = new Map<string, ReturnType<typeof setTimeout>>();
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

function clearTimers() {
  for (const timer of bubbleTimers.values()) clearTimeout(timer);
  bubbleTimers.clear();
  clearTimeout(noticeTimer);
}

export const useChat = create<ChatStore>((set, get) => {
  function showNotice() {
    set({ rateLimited: true });
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => set({ rateLimited: false }), CHAT_RATE_NOTICE_MS);
  }

  function showBubble(msg: ChatMessagePayload) {
    const quickId = msg.quickId;
    if (msg.kind !== "quick" || !quickId) return;
    const playerId = msg.playerId;
    set((s) => ({ bubbles: { ...s.bubbles, [playerId]: { id: msg.id, quickId } } }));
    clearTimeout(bubbleTimers.get(playerId));
    bubbleTimers.set(
      playerId,
      setTimeout(() => {
        bubbleTimers.delete(playerId);
        set((s) => {
          if (s.bubbles[playerId]?.id !== msg.id) return s;
          const { [playerId]: _gone, ...rest } = s.bubbles;
          return { bubbles: rest };
        });
      }, CHAT_BUBBLE_MS),
    );
  }

  return {
    ...initial,

    attach(roomCode) {
      clearTimers();
      set({ ...initial, roomCode, muted: loadMutes(roomCode) });
    },

    receive(msg, selfId, bubble) {
      const s = get();
      if (s.messages.some((m) => m.id === msg.id)) return;
      const unread = countsAsUnread(msg, { selfId, muted: s.muted, open: s.open });
      set({
        messages: mergeMessages(s.messages, [msg]),
        unread: s.unread + (unread ? 1 : 0),
      });
      if (bubble && !s.muted.includes(msg.playerId)) showBubble(msg);
    },

    receiveHistory(messages, selfId) {
      const s = get();
      // Lần đầu vào phòng: tin cũ không tính chưa đọc. Nối lại: tin lỡ lúc mất mạng thì có tính.
      const fresh = s.messages.length > 0 ? newMessages(s.messages, messages) : [];
      const ctx = { selfId, muted: s.muted, open: s.open };
      const added = fresh.filter((m) => countsAsUnread(m, ctx)).length;
      set({
        messages: mergeMessages(s.messages, messages),
        loaded: true,
        unread: s.unread + added,
      });
    },

    markStale: () => set({ loaded: false }),

    setDraft: (draft) => set({ draft }),

    setOpen(open) {
      set(open ? { open, unread: 0 } : { open });
    },

    mute(playerId) {
      const s = get();
      if (s.muted.includes(playerId)) return;
      const muted = [...s.muted, playerId];
      const { [playerId]: _gone, ...bubbles } = s.bubbles;
      saveMutes(s.roomCode, muted);
      set({ muted, bubbles });
    },

    unmuteAll() {
      saveMutes(get().roomCode, []);
      set({ muted: [] });
    },

    allowSend(now) {
      const { ok, bucket } = consumeToken(get().bucket, now);
      set({ bucket });
      if (!ok) {
        showNotice();
        return false;
      }
      return true;
    },

    handleError({ code, source }) {
      if (source !== "chat") return "not-chat";
      if (code === "rate-limited") {
        showNotice();
        return "notice";
      }
      // Khung chat ẩn ở pha chơi nên sai pha gần như không xảy ra; tin rỗng client đã chặn.
      if (code === "bad-phase" || code === "invalid") return "silent";
      // chat-disabled, not-host, mã lạ: báo bằng toast, không mở khoá nút đang chờ của lệnh khác.
      return "toast";
    },

    reset() {
      clearTimers();
      set(initial);
    },
  };
});

export interface ServerErrorHandlers {
  /** Mở khoá nút đang chờ phản hồi (`useGame.pushError`). */
  pushError(): void;
  /** Hiện toast lỗi (dịch theo `errors.<code>`). */
  showError(): void;
}

/**
 * Định tuyến một tin `ServerMessage.Error`: lỗi chat (có `source: "chat"`) không bao giờ gọi
 * `pushError` (khỏi mở khoá nhầm nút đang chờ của lệnh khác); lỗi không nguồn → `pushError` + toast.
 */
export function routeServerError(
  error: Pick<ErrorPayload, "code" | "source">,
  handlers: ServerErrorHandlers,
): ChatErrorHandling {
  const handling = useChat.getState().handleError(error);
  if (handling === "not-chat") handlers.pushError();
  if (handling === "not-chat" || handling === "toast") handlers.showError();
  return handling;
}

/** Bong bóng mới nhất của một hoặc nhiều người (đồng hạng trên bục vinh danh). */
export function pickBubble(
  bubbles: Record<string, ChatBubble>,
  playerIds: string | readonly string[],
): ChatBubble | undefined {
  const ids = typeof playerIds === "string" ? [playerIds] : playerIds;
  let best: ChatBubble | undefined;
  for (const id of ids) {
    const b = bubbles[id];
    if (b && (!best || b.id > best.id)) best = b;
  }
  return best;
}
