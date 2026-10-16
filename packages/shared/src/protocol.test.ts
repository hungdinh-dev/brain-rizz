import { describe, expect, it } from "vitest";
import { BRAIN_TEST_ROOM_NAME, MAX_ACCESS_TOKEN_LENGTH, ROOM_NAME } from "./constants";
import {
  BRAIN_SAVE_STATUSES,
  BrainClientMessage,
  BrainJoinOptionsSchema,
  BrainReadySchema,
  ClientMessage,
  JoinOptionsSchema,
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
