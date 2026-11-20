import { MAX_PLAYERS } from "@brain-rizz/shared";
import { describe, expect, it } from "vitest";
import { CLASSIC_SEATS, isCompactRoster, isCrowded, lobbySlotCount } from "./room-size";

describe("bố cục theo số ghế (CR-018)", () => {
  it("tới 8 ghế giữ bố cục cũ, từ 9 ghế dùng bố cục gọn", () => {
    expect(CLASSIC_SEATS).toBe(8);
    expect(isCrowded(2)).toBe(false);
    expect(isCrowded(8)).toBe(false);
    expect(isCrowded(9)).toBe(true);
    expect(isCrowded(MAX_PLAYERS)).toBe(true);
  });

  it("phòng chờ: luôn đủ 12 ô (khớp n/12), còn ô trống khi chưa đầy, bố cục gọn", () => {
    expect(MAX_PLAYERS).toBe(12);
    for (let n = 0; n <= MAX_PLAYERS; n++) {
      expect(lobbySlotCount(n)).toBe(MAX_PLAYERS);
      // LobbyScreen bật bố cục gọn theo số ô: 12 ô thì luôn gọn, kể cả khi mới có 1 người.
      expect(lobbySlotCount(n) > CLASSIC_SEATS).toBe(true);
    }
    for (let n = 1; n < MAX_PLAYERS; n++) expect(lobbySlotCount(n)).toBeGreaterThan(n);
  });

  it("danh sách cả phòng (Hướng dẫn): hàng gọn từ 8 người", () => {
    for (let n = 1; n <= 7; n++) expect(isCompactRoster(n)).toBe(false);
    for (let n = 8; n <= MAX_PLAYERS; n++) expect(isCompactRoster(n)).toBe(true);
  });
});
