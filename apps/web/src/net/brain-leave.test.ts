import { BRAIN_TEST_IDLE_CLOSE_CODE } from "@brain-rizz/shared";
import { describe, expect, it } from "vitest";
import { brainLeaveAction } from "./brain-leave";

describe("brainLeaveAction", () => {
  it("server huỷ vì để quá lâu ở pha intro → về màn giới thiệu, không nối lại", () => {
    expect(brainLeaveAction(BRAIN_TEST_IDLE_CLOSE_CODE)).toBe("idle");
  });

  it("đóng bình thường / lỗi khác → giữ cách xử lý cũ", () => {
    for (const code of [1000, 1006, 4000, 4002, 4010]) expect(brainLeaveAction(code)).toBe("keep");
  });
});
