import { CHAT_RATE, type ChatMessagePayload } from "@brain-rizz/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAT_BUBBLE_MS,
  countsAsUnread,
  mergeMessages,
  newMessages,
  parseMuteBook,
  pickBubble,
  routeServerError,
  serializeMuteBook,
  setRoomMutes,
  useChat,
  visibleMessages,
} from "./chat.store";

const ME = "me";

function msg(id: number, over: Partial<ChatMessagePayload> = {}): ChatMessagePayload {
  return {
    id,
    playerId: "lan",
    name: "Lan",
    colorIndex: 1,
    avatar: "khoi",
    kind: "text",
    text: `tin ${id}`,
    at: 1_000 + id,
    ...over,
  };
}

describe("mergeMessages", () => {
  it("bỏ trùng theo id và sắp cũ → mới", () => {
    const merged = mergeMessages([msg(1), msg(3)], [msg(2), msg(3), msg(4)]);
    expect(merged.map((m) => m.id)).toEqual([1, 2, 3, 4]);
  });

  it("giữ tối đa `max` tin mới nhất", () => {
    const many = Array.from({ length: 60 }, (_, i) => msg(i + 1));
    const merged = mergeMessages([], many, 50);
    expect(merged).toHaveLength(50);
    expect(merged[0]?.id).toBe(11);
    expect(merged.at(-1)?.id).toBe(60);
  });

  it("lịch sử nối lại không làm mất tin cũ hơn bộ đệm server", () => {
    const local = Array.from({ length: 40 }, (_, i) => msg(i + 1));
    const history = Array.from({ length: 30 }, (_, i) => msg(i + 13));
    expect(mergeMessages(local, history).map((m) => m.id)).toEqual(
      Array.from({ length: 42 }, (_, i) => i + 1),
    );
  });
});

describe("newMessages", () => {
  it("chỉ trả tin chưa có", () => {
    expect(newMessages([msg(1), msg(2)], [msg(2), msg(3)]).map((m) => m.id)).toEqual([3]);
  });
});

describe("countsAsUnread", () => {
  const ctx = { selfId: ME, muted: [] as string[], open: false };
  it("tin người khác khi khung đóng → chưa đọc", () => {
    expect(countsAsUnread(msg(1), ctx)).toBe(true);
  });
  it("khung đang mở → không", () => {
    expect(countsAsUnread(msg(1), { ...ctx, open: true })).toBe(false);
  });
  it("tin của mình → không", () => {
    expect(countsAsUnread(msg(1, { playerId: ME }), ctx)).toBe(false);
  });
  it("người bị tắt tiếng → không", () => {
    expect(countsAsUnread(msg(1), { ...ctx, muted: ["lan"] })).toBe(false);
  });
});

describe("visibleMessages", () => {
  it("ẩn cả tin cũ của người bị tắt tiếng", () => {
    const all = [msg(1), msg(2, { playerId: "minh" }), msg(3)];
    expect(visibleMessages(all, ["lan"]).map((m) => m.id)).toEqual([2]);
    expect(visibleMessages(all, [])).toHaveLength(3);
  });
});

describe("danh sách tắt tiếng", () => {
  it("đọc dữ liệu hỏng hay sai hình dạng → rỗng", () => {
    expect(parseMuteBook(null)).toEqual({});
    expect(parseMuteBook("{không phải json")).toEqual({});
    expect(parseMuteBook("[1,2]")).toEqual({});
    expect(parseMuteBook('{"ABCD":"lan","EFGH":[1,"minh","",null,"minh"]}')).toEqual({
      EFGH: ["minh"],
    });
  });

  it("ghi rồi đọc lại đúng như cũ", () => {
    const book = setRoomMutes({}, "ABCD", ["lan", "minh"]);
    expect(parseMuteBook(serializeMuteBook(book))).toEqual({ ABCD: ["lan", "minh"] });
  });

  it("danh sách rỗng xoá phòng đó; giữ tối đa N phòng gần nhất", () => {
    let book = setRoomMutes({}, "R1", ["a"], 2);
    book = setRoomMutes(book, "R2", ["b"], 2);
    book = setRoomMutes(book, "R3", ["c"], 2);
    expect(Object.keys(book)).toEqual(["R2", "R3"]);
    // Ghi lại R2 → R2 thành mới nhất.
    book = setRoomMutes(book, "R2", ["b", "d"], 2);
    expect(Object.keys(book)).toEqual(["R3", "R2"]);
    expect(setRoomMutes(book, "R3", [], 2)).toEqual({ R2: ["b", "d"] });
  });
});

describe("pickBubble", () => {
  it("lấy bong bóng mới nhất trong nhóm đồng hạng", () => {
    const bubbles = {
      a: { id: 3, quickId: "gg" as const },
      b: { id: 7, quickId: "fire" as const },
    };
    expect(pickBubble(bubbles, ["a", "b", "c"])?.id).toBe(7);
    expect(pickBubble(bubbles, "a")?.quickId).toBe("gg");
    expect(pickBubble(bubbles, "c")).toBeUndefined();
  });
});

describe("useChat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useChat.getState().attach("ABCD");
  });
  afterEach(() => {
    useChat.getState().reset();
    vi.useRealTimers();
  });

  it("lịch sử lúc vào phòng không tính chưa đọc; tin trực tiếp có tính", () => {
    const chat = useChat.getState();
    chat.receiveHistory([msg(1), msg(2)], ME);
    expect(useChat.getState()).toMatchObject({ loaded: true, unread: 0 });
    chat.receive(msg(3), ME, true);
    chat.receive(msg(3), ME, true); // trùng → bỏ
    expect(useChat.getState().unread).toBe(1);
    expect(useChat.getState().messages).toHaveLength(3);
  });

  it("nối lại: tin lỡ lúc mất mạng tính chưa đọc", () => {
    const chat = useChat.getState();
    chat.receiveHistory([msg(1)], ME);
    chat.markStale();
    expect(useChat.getState().loaded).toBe(false);
    chat.receiveHistory([msg(1), msg(2), msg(3, { playerId: ME })], ME);
    expect(useChat.getState()).toMatchObject({ loaded: true, unread: 1 });
  });

  it("mở khung → về 0; đang mở thì tin mới không tính", () => {
    const chat = useChat.getState();
    chat.receive(msg(1), ME, true);
    chat.setOpen(true);
    expect(useChat.getState().unread).toBe(0);
    chat.receive(msg(2), ME, true);
    expect(useChat.getState().unread).toBe(0);
    chat.setOpen(false);
    chat.receive(msg(3), ME, true);
    expect(useChat.getState().unread).toBe(1);
  });

  it("bong bóng chỉ cho tin chọn sẵn, tự tắt sau 2,5 giây, không hiện lúc chơi", () => {
    const chat = useChat.getState();
    chat.receive(msg(1), ME, true);
    expect(useChat.getState().bubbles).toEqual({});
    chat.receive(msg(2, { kind: "quick", quickId: "fire", text: undefined }), ME, false);
    expect(useChat.getState().bubbles).toEqual({});
    chat.receive(msg(3, { kind: "quick", quickId: "gg", text: undefined }), ME, true);
    expect(useChat.getState().bubbles.lan).toEqual({ id: 3, quickId: "gg" });
    vi.advanceTimersByTime(CHAT_BUBBLE_MS - 100);
    // Bong bóng mới thay cái cũ, đếm lại từ đầu.
    chat.receive(msg(4, { kind: "quick", quickId: "clap", text: undefined }), ME, true);
    vi.advanceTimersByTime(200);
    expect(useChat.getState().bubbles.lan?.id).toBe(4);
    vi.advanceTimersByTime(CHAT_BUBBLE_MS);
    expect(useChat.getState().bubbles).toEqual({});
  });

  it("tắt tiếng: không chưa đọc, không bong bóng, bật lại thì tin cũ hiện lại", () => {
    const chat = useChat.getState();
    chat.receive(msg(1, { kind: "quick", quickId: "fire", text: undefined }), ME, true);
    chat.mute("lan");
    expect(useChat.getState().bubbles).toEqual({});
    chat.receive(msg(2), ME, true);
    chat.receive(msg(3, { kind: "quick", quickId: "gg", text: undefined }), ME, true);
    const s = useChat.getState();
    expect(s.unread).toBe(1); // chỉ tin số 1 (trước khi tắt tiếng)
    expect(s.bubbles).toEqual({});
    expect(visibleMessages(s.messages, s.muted)).toHaveLength(0);
    chat.unmuteAll();
    const after = useChat.getState();
    expect(visibleMessages(after.messages, after.muted)).toHaveLength(3);
  });

  it("giới hạn tần suất phía client theo cùng luật server", () => {
    const chat = useChat.getState();
    const t0 = 10_000;
    for (let i = 0; i < CHAT_RATE.burst; i++) expect(chat.allowSend(t0)).toBe(true);
    expect(chat.allowSend(t0)).toBe(false);
    expect(useChat.getState().rateLimited).toBe(true);
    expect(chat.allowSend(t0 + CHAT_RATE.refillMs)).toBe(true);
  });

  it("lỗi chat (source chat): rate-limited → nhắc, bad-phase/invalid → im lặng, chat-disabled → báo", () => {
    const chat = useChat.getState();
    expect(chat.handleError({ code: "rate-limited", source: "chat" })).toBe("notice");
    expect(useChat.getState().rateLimited).toBe(true);
    expect(chat.handleError({ code: "bad-phase", source: "chat" })).toBe("silent");
    expect(chat.handleError({ code: "invalid", source: "chat" })).toBe("silent");
    expect(chat.handleError({ code: "chat-disabled", source: "chat" })).toBe("toast");
    expect(chat.handleError({ code: "not-host", source: "chat" })).toBe("toast");
  });

  it("routeServerError: lỗi chat-disabled / not-host có source chat → toast, không pushError", () => {
    const pushError = vi.fn();
    const showError = vi.fn();
    for (const code of ["chat-disabled", "not-host"] as const) {
      expect(routeServerError({ code, source: "chat" }, { pushError, showError })).toBe("toast");
    }
    expect(showError).toHaveBeenCalledTimes(2);
    // Nhắc / im lặng: không toast thêm, vẫn không pushError.
    routeServerError({ code: "rate-limited", source: "chat" }, { pushError, showError });
    routeServerError({ code: "bad-phase", source: "chat" }, { pushError, showError });
    expect(showError).toHaveBeenCalledTimes(2);
    expect(pushError).not.toHaveBeenCalled();
  });

  it("routeServerError: lỗi không source → pushError + toast", () => {
    const pushError = vi.fn();
    const showError = vi.fn();
    expect(routeServerError({ code: "chat-disabled" }, { pushError, showError })).toBe("not-chat");
    expect(pushError).toHaveBeenCalledTimes(1);
    expect(showError).toHaveBeenCalledTimes(1);
  });

  it("lỗi không có source (lệnh khác) luôn là not-chat, kể cả ngay sau khi vừa chat", () => {
    const chat = useChat.getState();
    expect(chat.allowSend(5_000)).toBe(true);
    // Vd. bấm Nhắc bị rate-limited, chủ phòng bấm lệnh bị bad-phase: phải tới pushError + toast.
    expect(chat.handleError({ code: "rate-limited" })).toBe("not-chat");
    expect(chat.handleError({ code: "bad-phase" })).toBe("not-chat");
    expect(chat.handleError({ code: "invalid" })).toBe("not-chat");
    expect(useChat.getState().rateLimited).toBe(false);
  });

  it("vào phòng khác: xoá tin của phòng cũ", () => {
    const chat = useChat.getState();
    chat.receive(msg(1), ME, true);
    chat.attach("WXYZ");
    expect(useChat.getState()).toMatchObject({ roomCode: "WXYZ", messages: [], unread: 0 });
  });
});
