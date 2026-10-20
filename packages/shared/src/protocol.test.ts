import { describe, expect, it } from "vitest";
import { CHAT_MAX_INPUT_LENGTH, CHAT_QUICK_IDS } from "./chat/constants";
import { BRAIN_TEST_ROOM_NAME, MAX_ACCESS_TOKEN_LENGTH, ROOM_NAME } from "./constants";
import {
  BRAIN_SAVE_STATUSES,
  BrainClientMessage,
  BrainJoinOptionsSchema,
  BrainReadySchema,
  ChatSendSchema,
  ClientMessage,
  JoinOptionsSchema,
  ServerMessage,
  SetChatEnabledSchema,
} from "./protocol";

describe("giao thức tài khoản + Kiểm tra não (CR-009)", () => {
  it("tên room riêng cho Kiểm tra não", () => {
    expect(BRAIN_TEST_ROOM_NAME).toBe("brain-test");
    expect(BRAIN_TEST_ROOM_NAME).not.toBe(ROOM_NAME);
  });

  it("join options party: accessToken tuỳ chọn, tương thích ngược", () => {
    expect(JoinOptionsSchema.parse({ name: "An" })).toEqual({
      name: "An",
      colorIndex: 0,
      difficulty: 1,
      avatar: "khoi",
      accessToken: undefined,
    });
    expect(JoinOptionsSchema.parse({ name: "An", accessToken: "abc" }).accessToken).toBe("abc");
  });

  it("accessToken sai kiểu, rỗng hoặc quá dài bị bỏ, không làm hỏng việc vào phòng", () => {
    for (const accessToken of [42, null, "", "x".repeat(MAX_ACCESS_TOKEN_LENGTH + 1), {}]) {
      const party = JoinOptionsSchema.safeParse({ name: "An", accessToken });
      expect(party.success).toBe(true);
      expect(party.data?.accessToken).toBeUndefined();
      const brain = BrainJoinOptionsSchema.safeParse({ name: "An", accessToken });
      expect(brain.success).toBe(true);
      expect(brain.data?.accessToken).toBeUndefined();
    }
    const max = "x".repeat(MAX_ACCESS_TOKEN_LENGTH);
    expect(JoinOptionsSchema.parse({ name: "An", accessToken: max }).accessToken).toBe(max);
  });

  it("join options Kiểm tra não: tên bắt buộc, nhân vật mặc định khoi, bỏ trường lạ", () => {
    expect(BrainJoinOptionsSchema.parse({ name: " An ", difficulty: 3 })).toEqual({
      name: "An",
      avatar: "khoi",
      accessToken: undefined,
    });
    expect(BrainJoinOptionsSchema.safeParse({ name: "" }).success).toBe(false);
    expect(BrainJoinOptionsSchema.safeParse({ name: "An", avatar: "dragon" }).success).toBe(false);
  });

  it("brainReady không có nội dung; answer và ping dùng chung tên với party", () => {
    expect(BrainClientMessage.Ready).toBe("brainReady");
    expect(BrainClientMessage.Answer).toBe(ClientMessage.Answer);
    expect(BrainClientMessage.Ping).toBe(ClientMessage.Ping);
    expect(Object.values(ClientMessage)).not.toContain(BrainClientMessage.Ready);
    expect(BrainReadySchema.parse(undefined)).toEqual({});
    expect(BrainReadySchema.safeParse("now").success).toBe(false);
  });

  it("trạng thái lưu kết quả", () => {
    expect([...BRAIN_SAVE_STATUSES]).toEqual(["pending", "saved", "guest", "no-db", "failed"]);
  });
});

describe("giao thức chat (CR-011)", () => {
  it("tên tin nhắn", () => {
    expect(ClientMessage.Chat).toBe("chat");
    expect(ClientMessage.SetChatEnabled).toBe("setChatEnabled");
    expect(ServerMessage.Chat).toBe("chat");
    expect(ServerMessage.ChatHistory).toBe("chatHistory");
  });

  it("tin chữ: chấp nhận tới CHAT_MAX_INPUT_LENGTH, server tự cắt; bỏ trường danh tính lạ", () => {
    expect(
      ChatSendSchema.parse({ kind: "text", text: "chào", name: "Giả", playerId: "x" }),
    ).toEqual({ kind: "text", text: "chào" });
    expect(
      ChatSendSchema.safeParse({ kind: "text", text: "a".repeat(CHAT_MAX_INPUT_LENGTH) }).success,
    ).toBe(true);
    expect(
      ChatSendSchema.safeParse({ kind: "text", text: "a".repeat(CHAT_MAX_INPUT_LENGTH + 1) })
        .success,
    ).toBe(false);
    expect(ChatSendSchema.safeParse({ kind: "text", text: 42 }).success).toBe(false);
    expect(ChatSendSchema.safeParse({ kind: "text" }).success).toBe(false);
  });

  it("tin chọn sẵn: chỉ id trong CHAT_QUICK_IDS", () => {
    for (const id of CHAT_QUICK_IDS) {
      expect(ChatSendSchema.parse({ kind: "quick", id })).toEqual({ kind: "quick", id });
    }
    expect(ChatSendSchema.safeParse({ kind: "quick", id: "poop" }).success).toBe(false);
    expect(ChatSendSchema.safeParse({ kind: "sticker", id: "fire" }).success).toBe(false);
    expect(ChatSendSchema.safeParse(null).success).toBe(false);
  });

  it("bật/tắt chat cần boolean", () => {
    expect(SetChatEnabledSchema.parse({ enabled: false })).toEqual({ enabled: false });
    expect(SetChatEnabledSchema.safeParse({ enabled: "no" }).success).toBe(false);
    expect(SetChatEnabledSchema.safeParse({}).success).toBe(false);
  });
});
