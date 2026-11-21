import { GAME_IDS, type GameId } from "@brain-rizz/shared";
import { describe, expect, it } from "vitest";
import { onlyEnabled } from "./enabled-games";

const [FIRST, SECOND, THIRD] = GAME_IDS as unknown as [GameId, GameId, GameId];

describe("onlyEnabled", () => {
  it("bỏ game bị tắt, giữ thứ tự của danh sách gốc (thứ tự thêm Yêu thích)", () => {
    const enabled = GAME_IDS.filter((id) => id !== SECOND);
    expect(onlyEnabled([THIRD, SECOND, FIRST], enabled)).toEqual([THIRD, FIRST]);
  });

  it("đủ danh mục → giữ nguyên", () => {
    expect(onlyEnabled([SECOND, FIRST], GAME_IDS)).toEqual([SECOND, FIRST]);
  });

  it("rỗng → rỗng", () => {
    expect(onlyEnabled([], GAME_IDS)).toEqual([]);
  });
});
