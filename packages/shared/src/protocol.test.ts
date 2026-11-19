import { describe, expect, it } from "vitest";
import { CHAT_MAX_INPUT_LENGTH, CHAT_QUICK_IDS } from "./chat/constants";
import { BRAIN_TEST_ROOM_NAME, MAX_ACCESS_TOKEN_LENGTH, MAX_PLAYERS, ROOM_NAME } from "./constants";
import { MAX_ACCESSORIES, MAX_COSMETIC_ID_LENGTH, PET_CHARACTER_IDS } from "./cosmetics";
import {
  AddBotSchema,
  BRAIN_SAVE_STATUSES,
  BrainClientMessage,
  BrainJoinOptionsSchema,
  BrainReadySchema,
  ChatSendSchema,
  ClientMessage,
  CreateOptionsSchema,
  JoinOptionsSchema,
  RemoveBotSchema,
  ServerMessage,
  SetBotLevelSchema,
  SetChatEnabledSchema,
  SetProfileSchema,
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

describe("giao thức bot (CR-016)", () => {
  it("tên lệnh", () => {
    expect(ClientMessage.AddBot).toBe("addBot");
    expect(ClientMessage.RemoveBot).toBe("removeBot");
    expect(ClientMessage.SetBotLevel).toBe("setBotLevel");
    expect(new Set(Object.values(ClientMessage)).size).toBe(Object.values(ClientMessage).length);
    expect(ServerMessage.BotYielded).toBe("botYielded");
    expect(new Set(Object.values(ServerMessage)).size).toBe(Object.values(ServerMessage).length);
  });

  it("mức bot chỉ là 0–3 (số nguyên, không nhận chuỗi)", () => {
    for (const level of [0, 1, 2, 3]) {
      expect(AddBotSchema.parse({ level })).toEqual({ level });
      expect(SetBotLevelSchema.parse({ playerId: "bot-1", level })).toEqual({
        playerId: "bot-1",
        level,
      });
    }
    for (const level of [-1, 4, 1.5, "2", null, undefined]) {
      expect(AddBotSchema.safeParse({ level }).success).toBe(false);
      expect(SetBotLevelSchema.safeParse({ playerId: "bot-1", level }).success).toBe(false);
    }
    expect(AddBotSchema.safeParse(undefined).success).toBe(false);
  });

  it("playerId: chuỗi 1–64 ký tự; trường lạ bị bỏ", () => {
    expect(RemoveBotSchema.parse({ playerId: "bot-3", level: 9 })).toEqual({ playerId: "bot-3" });
    for (const playerId of ["", "x".repeat(65), 7, null]) {
      expect(RemoveBotSchema.safeParse({ playerId }).success).toBe(false);
      expect(SetBotLevelSchema.safeParse({ playerId, level: 1 }).success).toBe(false);
    }
    expect(RemoveBotSchema.safeParse({}).success).toBe(false);
  });

  it(`tùy chọn tạo phòng: 1 → ${MAX_PLAYERS - 1} bot cùng một mức`, () => {
    expect(CreateOptionsSchema.parse({ bots: { count: 3, level: 1 } })).toEqual({
      bots: { count: 3, level: 1 },
    });
    expect(CreateOptionsSchema.parse({ bots: { count: MAX_PLAYERS - 1, level: 3 } }).bots).toEqual({
      count: MAX_PLAYERS - 1,
      level: 3,
    });
    // Gửi kèm join options (tên, nhân vật…) thì chỉ giữ `bots`.
    expect(
      CreateOptionsSchema.parse({ name: "An", avatar: "bo", bots: { count: 1, level: 0 } }),
    ).toEqual({ bots: { count: 1, level: 0 } });
  });

  it("tùy chọn bots sai thì bỏ như không gửi, không làm hỏng việc tạo phòng", () => {
    for (const bots of [
      { count: 0, level: 1 },
      { count: MAX_PLAYERS, level: 1 },
      { count: 2.5, level: 1 },
      { count: 2, level: 4 },
      { count: "3", level: 1 },
      { count: 3 },
      "3",
      null,
      undefined,
    ]) {
      const parsed = CreateOptionsSchema.safeParse({ name: "An", bots });
      expect(parsed.success).toBe(true);
      expect(parsed.data?.bots).toBeUndefined();
    }
    for (const options of [undefined, null, "party", 42, []]) {
      expect(CreateOptionsSchema.parse(options)).toEqual({ bots: undefined });
    }
  });

  it("join options không đọc bots (onJoin bỏ trường này)", () => {
    expect(
      JoinOptionsSchema.parse({ name: "An", bots: { count: 3, level: 1 } }),
    ).not.toHaveProperty("bots");
  });
});

describe("giao thức phụ kiện + phấn (CR-023, CR-024)", () => {
  const tooLongId = "x".repeat(MAX_COSMETIC_ID_LENGTH + 1);
  const tooMany = Array.from({ length: MAX_ACCESSORIES + 1 }, (_, i) => `item-${i}`);

  it("join options: accessories tuỳ chọn; id lạ vẫn qua (server lọc), không ép danh mục", () => {
    expect(JoinOptionsSchema.parse({ name: "An" }).accessories).toBeUndefined();
    expect(
      JoinOptionsSchema.parse({ name: "An", accessories: ["crown", "khong-co-mon-nay"] })
        .accessories,
    ).toEqual(["crown", "khong-co-mon-nay"]);
    expect(JoinOptionsSchema.parse({ name: "An", accessories: [] }).accessories).toEqual([]);
    const max = "x".repeat(MAX_COSMETIC_ID_LENGTH);
    expect(JoinOptionsSchema.parse({ name: "An", accessories: [max] }).accessories).toEqual([max]);
  });

  it("join options: accessories sai thì bỏ như không gửi, không làm hỏng việc vào phòng", () => {
    for (const accessories of [tooMany, [tooLongId], [""], [42], "crown", { 0: "crown" }, null]) {
      const parsed = JoinOptionsSchema.safeParse({ name: "An", accessories });
      expect(parsed.success).toBe(true);
      expect(parsed.data?.accessories).toBeUndefined();
      expect(parsed.data?.name).toBe("An");
    }
  });

  it("join options nhận cả 12 nhân vật (thú khoá do server kiểm sở hữu)", () => {
    for (const avatar of PET_CHARACTER_IDS) {
      expect(JoinOptionsSchema.parse({ name: "An", avatar }).avatar).toBe(avatar);
      expect(BrainJoinOptionsSchema.parse({ name: "An", avatar }).avatar).toBe(avatar);
    }
  });

  it("setProfile: accessories tuỳ chọn, không mặc định; sai giới hạn thì từ chối (invalid)", () => {
    expect(SetProfileSchema.parse({ name: "An" })).toEqual({ name: "An" });
    expect(SetProfileSchema.parse({ accessories: [] })).toEqual({ accessories: [] });
    expect(SetProfileSchema.parse({ accessories: ["crown", "scarf"], avatar: "pin" })).toEqual({
      accessories: ["crown", "scarf"],
      avatar: "pin",
    });
    for (const accessories of [tooMany, [tooLongId], [""], [1], "crown", null]) {
      expect(SetProfileSchema.safeParse({ accessories }).success).toBe(false);
    }
  });

  it("tin reward là tin S → C riêng, không trùng tên", () => {
    expect(ServerMessage.Reward).toBe("reward");
    expect(new Set(Object.values(ServerMessage)).size).toBe(Object.values(ServerMessage).length);
    expect(Object.values(ClientMessage)).not.toContain(ServerMessage.Reward);
  });
});
